import streamDeck, {
	SingletonAction,
	type KeyAction,
	type DidReceiveSettingsEvent,
	type SendToPluginEvent,
	type WillAppearEvent,
	type WillDisappearEvent,
} from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { FluxerClient } from "./fluxer/client.js";
import { login, loginMfa, type LoginResult } from "./fluxer/login.js";

export interface GlobalSettings extends JsonObject {
	token?: string;
	instance?: string;
}

export const client = new FluxerClient();

/** Keeps the client in sync with the credentials entered in any property inspector. */
export async function initClient(): Promise<void> {
	const apply = (s: GlobalSettings) => client.configure(s.token ?? "", s.instance ?? "");
	streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => apply(ev.settings));
	apply(await streamDeck.settings.getGlobalSettings<GlobalSettings>());
}

/**
 * Base for actions whose key image depends on live Fluxer state. Caches each key's settings and
 * redraws every visible key whenever the client's state changes.
 */
export abstract class FluxerAction<S extends JsonObject = JsonObject> extends SingletonAction<S> {
	protected keys = new Map<string, { action: KeyAction<S>; settings: S }>();
	private hooked = false;

	protected abstract draw(action: KeyAction<S>, settings: S): void | Promise<void>;

	/** Channel types offered in the property inspector's channel picker, keyed by datasource name. */
	protected datasources: Record<string, number[]> = {};

	private hook(): void {
		if (this.hooked) return;
		this.hooked = true;
		client.on("state", () => this.refresh());
		client.on("connection", () => this.refresh());
	}

	protected refresh(): void {
		for (const { action, settings } of this.keys.values()) void this.draw(action, settings);
	}

	override async onWillAppear(ev: WillAppearEvent<S>): Promise<void> {
		this.hook();
		if (!ev.action.isKey()) return;
		this.keys.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });
		await this.draw(ev.action, ev.payload.settings);
	}

	override onWillDisappear(ev: WillDisappearEvent<S>): void {
		this.keys.delete(ev.action.id);
	}

	override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<S>): Promise<void> {
		if (!ev.action.isKey()) return;
		this.keys.set(ev.action.id, { action: ev.action, settings: ev.payload.settings });
		await this.draw(ev.action, ev.payload.settings);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<any, S>): Promise<void> {
		const payload = ev.payload as { event?: string; email?: string; password?: string; ticket?: string; code?: string };
		const event = payload.event;
		if (event === "login" || event === "loginMfa") return handleLogin(payload);
		streamDeck.logger.debug(`sendToPlugin event=${event}`);
		const types = event ? this.datasources[event] : undefined;
		if (!event || !types) return;
		await streamDeck.ui.sendToPropertyInspector({
			event,
			items: client.connected
				? client.channelsOfType(types)
				: [{ label: "Not connected – enter your token first", value: "", disabled: true }],
		});
	}

	protected settingsOf(id: string): S | undefined {
		return this.keys.get(id)?.settings;
	}
}

/** Logs in from the property inspector; only the resulting token is stored, never the password. */
async function handleLogin(p: { event?: string; email?: string; password?: string; ticket?: string; code?: string }): Promise<void> {
	const settings = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	const instance = (settings.instance?.trim() || "https://fluxer.app").replace(/\/+$/, "");
	const result: LoginResult = !p.email || !p.password
		? p.event === "loginMfa" && p.ticket && p.code
			? await loginMfa(instance, p.ticket, p.code)
			: { ok: false, message: "Enter your email and password." }
		: await login(instance, p.email.trim(), p.password);
	if (result.ok) {
		await streamDeck.settings.setGlobalSettings<GlobalSettings>({ ...settings, instance: settings.instance ?? "", token: result.token });
		client.configure(result.token, instance);
	}
	await streamDeck.ui.sendToPropertyInspector({
		event: "loginResult",
		ok: result.ok,
		message: result.ok ? `Logged in${result.username ? " as " + result.username : ""}.` : result.message,
		mfaTicket: result.ok ? undefined : (result.mfaTicket ?? null),
	});
}
