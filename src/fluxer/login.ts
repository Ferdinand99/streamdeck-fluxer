import { pbkdf2Sync } from "node:crypto";
import streamDeck from "@elgato/streamdeck";

const log = streamDeck.logger.createScope("login");

export type LoginResult =
	| { ok: true; token: string; username?: string }
	| { ok: false; message: string; mfaTicket?: string };

interface AltchaChallenge {
	parameters: { algorithm: string; cost: number; keyLength: number; keyPrefix: string; nonce: string; salt: string };
	signature: string;
}

/**
 * Solves an ALTCHA v2 PBKDF2/SHA-256 challenge, the proof-of-work the Fluxer web client also solves
 * in the browser: find the counter whose derived key starts with `keyPrefix`.
 */
function solveAltcha(challenge: AltchaChallenge): string {
	const p = challenge.parameters;
	if (!/PBKDF2\/SHA-256/i.test(p.algorithm)) throw new Error(`Unsupported captcha algorithm ${p.algorithm}`);
	const nonce = Buffer.from(p.nonce, "hex");
	const salt = Buffer.from(p.salt, "hex");
	const started = Date.now();
	const counterBytes = Buffer.alloc(4);
	for (let counter = 0; counter < 5_000_000; counter++) {
		counterBytes.writeUInt32BE(counter);
		const key = pbkdf2Sync(Buffer.concat([nonce, counterBytes]), salt, p.cost, p.keyLength, "sha256").toString("hex");
		if (key.startsWith(p.keyPrefix)) {
			const solution = { counter, derivedKey: key, time: Date.now() - started };
			return Buffer.from(JSON.stringify({ challenge, solution })).toString("base64");
		}
	}
	throw new Error("Could not solve the captcha");
}

async function discoverApi(instance: string): Promise<string> {
	const res = await fetch(`${instance}/.well-known/fluxer`);
	if (!res.ok) throw new Error(`Could not reach ${instance} (${res.status})`);
	const doc = (await res.json()) as { endpoints: { api_client: string } };
	return doc.endpoints.api_client.replace(/\/+$/, "");
}

async function post(api: string, path: string, body: unknown): Promise<{ status: number; json: any }> {
	let captcha: string | undefined;
	for (let attempt = 0; attempt < 3; attempt++) {
		const res = await fetch(`${api}${path}`, {
			method: "POST",
			headers: { "Content-Type": "application/json", ...(captcha ? { "X-Captcha-Token": captcha } : {}) },
			body: JSON.stringify(body),
		});
		const json = await res.json().catch(() => ({}));
		const code = json?.code;
		if (res.status === 400 && (code === "CAPTCHA_REQUIRED" || code === "INVALID_CAPTCHA") && json.altcha_challenge) {
			captcha = solveAltcha(json.altcha_challenge);
			continue;
		}
		return { status: res.status, json };
	}
	return { status: 400, json: { message: "Captcha was rejected" } };
}

function describe(status: number, json: any): string {
	const codes: string[] = (json?.errors ?? []).map((e: { code?: string }) => e.code);
	if (codes.includes("INVALID_EMAIL_OR_PASSWORD")) return "Wrong email or password.";
	if (status === 429) return "Too many attempts. Wait a few minutes and try again.";
	return json?.message ?? `Login failed (${status}).`;
}

function tokenResult(json: any): LoginResult {
	if (typeof json?.token === "string") return { ok: true, token: json.token, username: json.user?.username };
	return { ok: false, message: "The server did not return a token." };
}

export async function login(instance: string, email: string, password: string): Promise<LoginResult> {
	try {
		const api = await discoverApi(instance);
		const { status, json } = await post(api, "/v1/auth/login", { email, password });
		if (status === 200 && json.mfa && json.ticket) {
			const methods: string[] = json.allowed_methods ?? [];
			if (!methods.includes("totp") && !methods.includes("backup_codes")) {
				return { ok: false, message: "This account needs a passkey for 2FA, which the plugin does not support." };
			}
			return { ok: false, mfaTicket: json.ticket, message: "Enter your 2FA code (or a backup code)." };
		}
		if (status === 200) return tokenResult(json);
		log.warn(`login → ${status} ${json?.code ?? ""}`);
		return { ok: false, message: describe(status, json) };
	} catch (err) {
		log.error("login failed", err);
		return { ok: false, message: err instanceof Error ? err.message : "Login failed." };
	}
}

export async function loginMfa(instance: string, ticket: string, code: string): Promise<LoginResult> {
	try {
		const api = await discoverApi(instance);
		const { status, json } = await post(api, "/v1/auth/login/mfa/totp", { code: code.trim(), ticket });
		if (status === 200) return tokenResult(json);
		log.warn(`mfa → ${status} ${json?.code ?? ""}`);
		// A bad code keeps the ticket valid (five minutes), so let the user retry with it.
		return { ok: false, mfaTicket: status === 400 ? ticket : undefined, message: status === 400 ? "Wrong code, try again." : describe(status, json) };
	} catch (err) {
		log.error("mfa failed", err);
		return { ok: false, message: err instanceof Error ? err.message : "Login failed." };
	}
}
