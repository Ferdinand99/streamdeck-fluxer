// Renders the Marketplace preview images (1920x960) from the plugin's real key artwork, using headless Edge.
// Run: npm run previews
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as r from "../src/render.ts";

const EDGE = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(existsSync);
if (!EDGE) throw new Error("Microsoft Edge not found");

const OUT = "net.opland.fluxer.sdPlugin/previews";
mkdirSync(OUT, { recursive: true });

const key = (src, caption) => `<figure><img src="${src}" width="200" height="200"><figcaption>${caption}</figcaption></figure>`;

const slides = [
	{
		file: "1-overview",
		title: "Fluxer on your Stream Deck",
		sub: "Mute, deafen, status, quick messages and more. One key each.",
		keys: [
			key(r.micIcon(true), "Mute"),
			key(r.headphonesIcon(true), "Deafen"),
			key(r.pttIcon(false), "Push to Talk"),
			key(r.statusIcon("online", true), "Status"),
			key(r.messageIcon("Good night"), "Quick Message"),
			key(r.voiceIcon("Lounge", ["Gina", "Aleks"], true), "Voice Channel"),
			key(r.mentionsIcon(3, true), "Mentions"),
		],
	},
	{
		file: "2-voice",
		title: "Always see your voice state",
		sub: "Keys show whether you are muted or deafened, read live from Fluxer.",
		keys: [
			key(r.micIcon(true), "Mic on"),
			key(r.micIcon(false), "Muted"),
			key(r.headphonesIcon(true), "Sound on"),
			key(r.headphonesIcon(false), "Deafened"),
			key(r.pttIcon(true), "Talking"),
		],
	},
	{
		file: "3-status",
		title: "Status, messages and mentions",
		sub: "Switch status, send a preset message and keep an eye on unread mentions.",
		keys: [
			key(r.statusIcon("online", true), "Online"),
			key(r.statusIcon("idle", false), "Idle"),
			key(r.statusIcon("dnd", false), "Do not disturb"),
			key(r.statusIcon("invisible", false), "Invisible"),
			key(r.messageIcon("Brb", "ok"), "Sent"),
			key(r.mentionsIcon(12, true), "Unread"),
		],
	},
];

for (const s of slides) {
	const html = `<!doctype html><meta charset="utf-8"><style>
		html,body{margin:0;width:1920px;height:960px;overflow:hidden}
		body{background:radial-gradient(1200px 700px at 50% 0%,#2b2a6e 0%,#141521 70%);color:#f2f3f5;font-family:"Segoe UI",Arial,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px}
		h1{font-size:84px;margin:0;font-weight:700;letter-spacing:-1px}
		p{font-size:36px;margin:-28px 0 0;color:#b5b8c4}
		.row{display:flex;gap:36px;flex-wrap:wrap;justify-content:center;max-width:1700px}
		figure{margin:0;text-align:center}
		img{border-radius:28px;box-shadow:0 12px 40px #0008;display:block}
		figcaption{margin-top:16px;font-size:28px;color:#d6d8e0}
		small{position:absolute;bottom:28px;font-size:22px;color:#80848e}
	</style><h1>${s.title}</h1><p>${s.sub}</p><div class="row">${s.keys.join("")}</div><small>Unofficial plugin. Not affiliated with Fluxer or Elgato.</small>`;
	const page = join(tmpdir(), `fx-${s.file}.html`);
	writeFileSync(page, html);
	const out = resolve(OUT, `${s.file}.png`);
	execFileSync(EDGE, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1920,960", `--screenshot=${out}`, pathToFileURL(page).href], { stdio: "ignore" });
	console.log("wrote", out);
}
