// Generates the plugin's PNG icons (no dependencies). Run: npm run icons
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "net.opland.fluxer.sdPlugin/imgs";
mkdirSync(OUT, { recursive: true });

// --- tiny PNG encoder -----------------------------------------------------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
	let c = n;
	for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
	return c >>> 0;
});
const crc = (buf) => {
	let c = 0xffffffff;
	for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
	const out = Buffer.alloc(12 + data.length);
	out.writeUInt32BE(data.length, 0);
	out.write(type, 4, "ascii");
	data.copy(out, 8);
	out.writeUInt32BE(crc(out.subarray(4, 8 + data.length)), 8 + data.length);
	return out;
};
function png(size, pixel) {
	const raw = Buffer.alloc((size * 4 + 1) * size);
	const SS = 3; // supersampling for smooth edges
	for (let y = 0; y < size; y++) {
		raw[y * (size * 4 + 1)] = 0;
		for (let x = 0; x < size; x++) {
			let r = 0, g = 0, b = 0, a = 0;
			for (let sy = 0; sy < SS; sy++)
				for (let sx = 0; sx < SS; sx++) {
					const p = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
					r += p[0] * p[3]; g += p[1] * p[3]; b += p[2] * p[3]; a += p[3];
				}
			const o = y * (size * 4 + 1) + 1 + x * 4;
			const n = SS * SS;
			raw[o] = a ? Math.round(r / a) : 0;
			raw[o + 1] = a ? Math.round(g / a) : 0;
			raw[o + 2] = a ? Math.round(b / a) : 0;
			raw[o + 3] = Math.round((a / n) * 255);
		}
	}
	const ihdr = Buffer.alloc(13);
	ihdr.writeUInt32BE(size, 0);
	ihdr.writeUInt32BE(size, 4);
	ihdr[8] = 8;
	ihdr[9] = 6;
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// --- shapes in unit coordinates ------------------------------------------------------------
const rrect = (x, y, cx, cy, hw, hh, r) => {
	const dx = Math.abs(x - cx) - (hw - r), dy = Math.abs(y - cy) - (hh - r);
	return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) <= r;
};
const disc = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;
const ring = (x, y, cx, cy, r, w, keep = () => true) => Math.abs(Math.hypot(x - cx, y - cy) - r) <= w / 2 && keep(x, y);

const glyphs = {
	mute: (x, y) => rrect(x, y, 0.5, 0.36, 0.14, 0.26, 0.14) || ring(x, y, 0.5, 0.42, 0.26, 0.08, (_, yy) => yy > 0.42) || rrect(x, y, 0.5, 0.82, 0.04, 0.08, 0.02),
	deafen: (x, y) => ring(x, y, 0.5, 0.52, 0.32, 0.09, (_, yy) => yy < 0.52) || rrect(x, y, 0.22, 0.66, 0.1, 0.18, 0.05) || rrect(x, y, 0.78, 0.66, 0.1, 0.18, 0.05),
	ptt: (x, y) => ring(x, y, 0.5, 0.5, 0.36, 0.08) || rrect(x, y, 0.5, 0.5, 0.1, 0.2, 0.1),
	status: (x, y) => disc(x, y, 0.5, 0.5, 0.34),
	message: (x, y) => (rrect(x, y, 0.5, 0.42, 0.4, 0.28, 0.08) || (y > 0.6 && y < 0.88 && x > 0.3 && x < 0.52 && y - 0.6 < (0.52 - x) * 1.6 + 0.1 && x + (y - 0.6) > 0.3)) && !rrect(x, y, 0.5, 0.34, 0.25, 0.04, 0.03),
	voice: (x, y) => (x > 0.14 && x < 0.34 && y > 0.38 && y < 0.62) || (x >= 0.34 && x < 0.58 && Math.abs(y - 0.5) < 0.12 + (x - 0.34) * 1.1) || ring(x, y, 0.56, 0.5, 0.2, 0.07, (xx) => xx > 0.62) || ring(x, y, 0.56, 0.5, 0.34, 0.07, (xx) => xx > 0.62),
	mentions: (x, y) => ring(x, y, 0.5, 0.5, 0.3, 0.1) || disc(x, y, 0.5, 0.5, 0.1),
};

const WHITE = [255, 255, 255, 1];
const BRAND = [70, 65, 217, 1];
const CLEAR = [0, 0, 0, 0];

const logo = (x, y) => {
	if (!rrect(x, y, 0.5, 0.5, 0.5, 0.5, 0.22)) return CLEAR;
	const f = rrect(x, y, 0.36, 0.5, 0.07, 0.3, 0.02) || rrect(x, y, 0.56, 0.23, 0.2, 0.07, 0.02) || rrect(x, y, 0.52, 0.47, 0.16, 0.06, 0.02);
	return f ? WHITE : BRAND;
};

const write = (name, size, fn) => writeFileSync(`${OUT}/${name}.png`, png(size, fn));
const both = (name, size, fn) => {
	write(name, size, fn);
	write(`${name}@2x`, size * 2, fn);
};

both("plugin-icon", 288, logo);
both("category-icon", 28, (x, y) => (glyphs.message(x, y) ? WHITE : CLEAR));
both("key", 72, logo);
for (const [name, g] of Object.entries(glyphs)) both(`action-${name}`, 20, (x, y) => (g(x, y) ? WHITE : CLEAR));
console.log("icons written to", OUT);
