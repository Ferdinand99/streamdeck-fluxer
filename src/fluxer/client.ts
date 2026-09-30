import { EventEmitter } from "node:events";
import streamDeck from "@elgato/streamdeck";
import WebSocket from "ws";

const log = streamDeck.logger.createScope("fluxer");

export type Status = "online" | "idle" | "dnd" | "invisible";

export interface FluxerChannel {
	id: string;
	type: number;
	name?: string;
	guild_id?: string;
	recipients?: { id: string; username?: string; global_name?: string | null }[];
}

export interface VoiceState {
	guild_id: string | null;
	channel_id: string | null;
	user_id: string | null;
	self_mute: boolean;
	self_deaf: boolean;
	member?: { nick?: string | null; user?: { username?: string; global_name?: string | null } };
}

export interface GuildInfo {
	id: string;
	name: string;
	channels: Map<string, FluxerChannel>;
}

export const ChannelType = { GuildText: 0, DM: 1, GuildVoice: 2, GroupDM: 3 } as const;

const DEFAULT_INSTANCE = "https://fluxer.app";

interface Discovery {
	endpoints: { api_client: string; gateway: string; webapp?: string };
}

type Events = {
	ready: [];
	state: [];
	connection: [status: "connecting" | "connected" | "disconnected" | "invalid-token"];
};

/**
 * Minimal Fluxer client: REST + one Gateway session, with just the state the plugin needs.
 * Uses a user token, so it never sends anything the official client would not.
 */
export class FluxerClient extends EventEmitter<Events> {
	me: { id: string; username: string } | null = null;
	status: Status = "online";
	guilds = new Map<string, GuildInfo>();
	dms = new Map<string, FluxerChannel>();
	voiceStates = new Map<string, VoiceState>(); // key: `${guild_id ?? "dm"}:${user_id}`
	mentions = new Map<string, number>(); // channel_id -> unread mentions/DMs
	webapp = "https://web.fluxer.app";

	/** Why we are not connected, if we know: shown on keys. */
	problem: "connecting" | "offline" | "invalid-token" | null = null;

	private token = "";
	private instance = "";
	private apiBase = "";
	private ws: WebSocket | null = null;
	private heartbeat: NodeJS.Timeout | null = null;
	private seq: number | null = null;
	private sessionId: string | null = null;
	private resumeUrl = "";
	private gatewayUrl = "";
	private ackReceived = true;
	private retry = 0;
	private reconnectTimer: NodeJS.Timeout | null = null;
	private stopped = true;

	get connected(): boolean {
		return this.me !== null && this.ws?.readyState === WebSocket.OPEN;
	}

	get totalMentions(): number {
		let n = 0;
		for (const c of this.mentions.values()) n += c;
		return n;
	}

	/** (Re)connects if the credentials changed. Safe to call repeatedly. */
	configure(token: string, instance: string): void {
		token = token.trim().replace(/^["']+|["']+$/g, "").replace(/^(Bearer|Bot)s+/i, "").trim();
		instance = (instance.trim() || DEFAULT_INSTANCE).replace(/\/+$/, "");
		if (token === this.token && instance === this.instance && !this.stopped) return;
		this.disconnect();
		this.token = token;
		this.instance = instance;
		log.info(`configure: instance=${instance} token length=${token.length} dots=${token.split(".").length - 1}`);
		if (token && !/^flx_[A-Za-z0-9]{36}$/.test(token)) log.warn("token does not look like flx_ + 36 characters; it will probably be rejected");
		if (token) void this.connect();
	}

	disconnect(): void {
		this.stopped = true;
		this.cleanupSocket();
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		this.reconnectTimer = null;
		this.me = null;
		this.sessionId = null;
		this.guilds.clear();
		this.dms.clear();
		this.voiceStates.clear();
		this.mentions.clear();
		this.emit("connection", "disconnected");
		this.emit("state");
	}

	// ---- REST -------------------------------------------------------------------------------

	async api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
		const res = await fetch(`${this.apiBase}${path}`, {
			method,
			headers: {
				Authorization: this.token,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
		});
		if (!res.ok) log.error(`${method} ${path} → ${res.status}`);
		if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${(await res.text()).slice(0, 200)}`);
		return (res.status === 204 ? undefined : await res.json()) as T;
	}

	async setStatus(status: Status): Promise<void> {
		await this.api("PATCH", "/v1/users/@me/settings", { status });
		this.status = status;
		this.emit("state");
	}

	async sendMessage(channelId: string, content: string): Promise<void> {
		await this.api("POST", `/v1/channels/${channelId}/messages`, {
			content,
			nonce: String(Date.now()),
		});
	}

	// ---- Helpers for actions --------------------------------------------------------------------

	channelName(channelId: string): string | undefined {
		const dm = this.dms.get(channelId);
		if (dm) return dmName(dm);
		for (const g of this.guilds.values()) {
			const c = g.channels.get(channelId);
			if (c) return `${g.name} › ${c.name ?? c.id}`;
		}
		return undefined;
	}

	channelsOfType(types: number[]): { label: string; value: string }[] {
		const out: { label: string; value: string }[] = [];
		for (const g of this.guilds.values()) {
			for (const c of g.channels.values()) {
				if (types.includes(c.type)) out.push({ label: `${g.name} › ${c.name ?? c.id}`, value: c.id });
			}
		}
		for (const c of this.dms.values()) {
			if (types.includes(c.type)) out.push({ label: `DM › ${dmName(c)}`, value: c.id });
		}
		return out.sort((a, b) => a.label.localeCompare(b.label));
	}

	membersInChannel(channelId: string): string[] {
		const names: string[] = [];
		for (const v of this.voiceStates.values()) {
			if (v.channel_id !== channelId) continue;
			const u = v.member?.user;
			names.push(v.member?.nick || u?.global_name || u?.username || v.user_id || "?");
		}
		return names;
	}

	/** The state of our own user in voice, as reported by the real client's session. */
	get ownVoice(): VoiceState | null {
		if (!this.me) return null;
		for (const v of this.voiceStates.values()) {
			if (v.user_id === this.me.id && v.channel_id) return v;
		}
		return null;
	}

	// ---- Connection -----------------------------------------------------------------------------

	private async connect(): Promise<void> {
		this.stopped = false;
		this.problem = "connecting";
		this.emit("connection", "connecting");
		try {
			const res = await fetch(`${this.instance}/.well-known/fluxer`);
			if (!res.ok) throw new Error(`discovery ${res.status}`);
			const doc = (await res.json()) as Discovery;
			this.apiBase = doc.endpoints.api_client.replace(/\/+$/, "");
			this.gatewayUrl = doc.endpoints.gateway;
			if (doc.endpoints.webapp) this.webapp = doc.endpoints.webapp.replace(/\/+$/, "");
			log.info(`discovered api=${this.apiBase} gateway=${this.gatewayUrl}`);
			this.openSocket(this.resumeUrl || this.gatewayUrl);
		} catch (err) {
			log.error("connect failed", err);
			this.scheduleReconnect();
		}
	}

	private openSocket(url: string): void {
		this.cleanupSocket();
		const u = new URL(url);
		u.searchParams.set("v", "1");
		u.searchParams.set("encoding", "json");
		const ws = new WebSocket(u.toString());
		this.ws = ws;
		ws.on("message", (raw) => this.onFrame(ws, raw.toString()));
		ws.on("close", (code) => this.onClose(ws, code));
		ws.on("error", (err) => log.error("gateway error", err.message));
	}

	private cleanupSocket(): void {
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = null;
		const ws = this.ws;
		this.ws = null;
		if (ws) {
			ws.removeAllListeners("close");
			ws.on("error", () => {});
			try {
				ws.close();
			} catch {
				/* already closed */
			}
		}
	}

	private scheduleReconnect(): void {
		if (this.stopped || this.reconnectTimer) return;
		const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			void this.connect();
		}, delay);
	}

	private onClose(ws: WebSocket, code: number): void {
		if (ws !== this.ws) return;
		log.warn(`gateway closed code=${code}`);
		this.problem = code === 4004 ? "invalid-token" : "offline";
		if (code === 4004) void this.diagnoseToken();
		if (this.heartbeat) clearInterval(this.heartbeat);
		this.heartbeat = null;
		this.emit("connection", "disconnected");
		if (code === 4004) {
			this.stopped = true;
			this.me = null;
			this.emit("connection", "invalid-token");
			this.emit("state");
			return;
		}
		if (code === 4007 || code === 4012) this.sessionId = null;
		this.scheduleReconnect();
	}

	/** Logs how the REST API reacts to the token, to tell a wrong token from a wrong scheme. Never logs the token. */
	private async diagnoseToken(): Promise<void> {
		for (const scheme of ["", "Bearer ", "Bot "]) {
			try {
				const res = await fetch(`${this.apiBase}/v1/users/@me`, { headers: { Authorization: scheme + this.token } });
				log.info(`diagnose: scheme=${JSON.stringify(scheme)} → ${res.status} ${(await res.text()).slice(0, 120).replace(/s+/g, " ")}`);
			} catch (err) {
				log.error("diagnose failed", err);
			}
		}
	}

	private send(op: number, d: unknown): void {
		if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ op, d }));
	}

	private onFrame(ws: WebSocket, text: string): void {
		if (ws !== this.ws) return;
		let msg: { op: number; d?: any; s?: number | null; t?: string };
		try {
			msg = JSON.parse(text);
		} catch {
			return;
		}
		if (typeof msg.s === "number") this.seq = msg.s;

		switch (msg.op) {
			case 10: {
				const interval: number = msg.d.heartbeat_interval;
				this.ackReceived = true;
				this.heartbeat = setInterval(() => {
					if (!this.ackReceived) return ws.close(4009);
					this.ackReceived = false;
					this.send(1, this.seq);
				}, interval);
				if (this.sessionId) {
					this.send(6, { token: this.token, session_id: this.sessionId, seq: this.seq ?? 0 });
				} else {
					this.send(2, {
						token: this.token,
						properties: { os: process.platform, browser: "Stream Deck", device: "Stream Deck" },
					});
				}
				break;
			}
			case 11:
				this.ackReceived = true;
				break;
			case 1:
				this.send(1, this.seq);
				break;
			case 7:
				ws.close(4000);
				break;
			case 9:
				this.sessionId = null;
				this.seq = null;
				this.resumeUrl = "";
				ws.close(4000);
				break;
			case 0:
				this.onDispatch(msg.t ?? "", msg.d);
				break;
		}
	}

	// ---- State ------------------------------------------------------------------------------------

	private onDispatch(t: string, d: any): void {
		switch (t) {
			case "READY": {
				this.retry = 0;
				this.problem = null;
				this.sessionId = d.session_id;
				this.resumeUrl = d.resume_gateway_url ?? "";
				this.me = { id: d.user.id, username: d.user.username };
				this.status = normaliseStatus(d.user_settings?.status) ?? "online";
				this.guilds.clear();
				this.dms.clear();
				this.voiceStates.clear();
				this.mentions.clear();
				for (const g of d.guilds ?? []) this.addGuild(g);
				for (const c of d.private_channels ?? []) this.dms.set(c.id, c);
				for (const r of d.read_states ?? []) {
					if (r.mention_count > 0) this.mentions.set(r.channel_id, r.mention_count);
				}
				log.info(`ready as ${this.me.username}: ${this.guilds.size} guilds, ${this.dms.size} DMs`);
				this.emit("connection", "connected");
				this.emit("ready");
				break;
			}
			case "RESUMED":
				this.retry = 0;
				this.emit("connection", "connected");
				break;
			case "GUILD_CREATE":
				this.addGuild(d);
				break;
			case "GUILD_DELETE":
				this.guilds.delete(d.id);
				break;
			case "CHANNEL_CREATE":
			case "CHANNEL_UPDATE":
				if (d.guild_id) this.guilds.get(d.guild_id)?.channels.set(d.id, d);
				else this.dms.set(d.id, d);
				break;
			case "CHANNEL_DELETE":
				if (d.guild_id) this.guilds.get(d.guild_id)?.channels.delete(d.id);
				else this.dms.delete(d.id);
				this.mentions.delete(d.id);
				break;
			case "VOICE_STATE_UPDATE": {
				const key = `${d.guild_id ?? "dm"}:${d.user_id}`;
				if (d.channel_id) this.voiceStates.set(key, d);
				else this.voiceStates.delete(key);
				break;
			}
			case "USER_SETTINGS_UPDATE": {
				const s = normaliseStatus(d.status);
				if (s) this.status = s;
				break;
			}
			case "MESSAGE_CREATE": {
				if (!this.me || d.author?.id === this.me.id) break;
				const isDm = !d.guild_id;
				const mentioned =
					d.mention_everyone ||
					d.mention_here ||
					d.mentions?.some((u: { id: string }) => u.id === this.me!.id) ||
					d.content?.includes(`<@${this.me.id}>`);
				if (isDm || mentioned) this.mentions.set(d.channel_id, (this.mentions.get(d.channel_id) ?? 0) + 1);
				break;
			}
			case "MESSAGE_ACK":
				if (d.mention_count > 0) this.mentions.set(d.channel_id, d.mention_count);
				else this.mentions.delete(d.channel_id);
				break;
			default:
				return;
		}
		this.emit("state");
	}

	private addGuild(g: any): void {
		if (g.unavailable) return;
		const channels = new Map<string, FluxerChannel>();
		for (const c of g.channels ?? []) channels.set(c.id, { ...c, guild_id: g.id });
		this.guilds.set(g.id, { id: g.id, name: g.properties?.name ?? g.name ?? g.id, channels });
		for (const v of g.voice_states ?? []) {
			if (v.channel_id) this.voiceStates.set(`${g.id}:${v.user_id}`, { ...v, guild_id: g.id });
		}
	}
}

function dmName(c: FluxerChannel): string {
	if (c.name) return c.name;
	return (c.recipients ?? []).map((r) => r.global_name || r.username || r.id).join(", ") || c.id;
}

function normaliseStatus(s: unknown): Status | undefined {
	return s === "online" || s === "idle" || s === "dnd" || s === "invisible" ? s : undefined;
}
