/** Key images as SVG data URIs, drawn on a 144×144 canvas. */

export const COLORS = {
	bg: "#1e1f22",
	fg: "#f2f3f5",
	dim: "#80848e",
	brand: "#4641D9",
	red: "#e5484d",
	green: "#3ba55d",
	yellow: "#f0b232",
	offline: "#747f8d",
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function svg(body: string, bg = COLORS.bg): string {
	const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" fill="${bg}"/>${body}</svg>`;
	return `data:image/svg+xml;charset=utf8,${encodeURIComponent(doc)}`;
}

function text(s: string, y: number, size: number, fill = COLORS.fg, weight = 600): string {
	return `<text x="72" y="${y}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}">${esc(s)}</text>`;
}

/** Truncates to fit a key, preferring two lines. */
export function label(s: string, y: number, fill = COLORS.fg): string {
	const max = 11;
	if (s.length <= max) return text(s, y, 20, fill);
	const words = s.split(/\s+/);
	let a = "";
	let b = "";
	for (const w of words) (a + " " + w).trim().length <= max && !b ? (a = (a + " " + w).trim()) : (b = (b + " " + w).trim());
	if (!a) [a, b] = [s.slice(0, max), s.slice(max)];
	if (b.length > max) b = b.slice(0, max - 1) + "…";
	return text(a, y - 11, 20, fill) + text(b, y + 11, 20, fill);
}

const slash = (c: string) =>
	`<line x1="36" y1="34" x2="108" y2="106" stroke="${COLORS.bg}" stroke-width="16" stroke-linecap="round"/><line x1="36" y1="34" x2="108" y2="106" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`;

export function micIcon(on: boolean, known = true): string {
	const c = !known ? COLORS.dim : on ? COLORS.fg : COLORS.red;
	return svg(
		`<g fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round">
			<rect x="56" y="22" width="32" height="56" rx="16" fill="${c}"/>
			<path d="M40 64a32 32 0 0 0 64 0M72 96v16M54 112h36"/></g>${on || !known ? "" : slash(COLORS.red)}
			${text(known ? (on ? "Mic on" : "Muted") : "Mute", 138, 16, c, 500)}`,
	);
}

export function headphonesIcon(on: boolean, known = true): string {
	const c = !known ? COLORS.dim : on ? COLORS.fg : COLORS.red;
	return svg(
		`<g fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round">
			<path d="M32 84V70a40 40 0 0 1 80 0v14"/>
			<rect x="26" y="78" width="20" height="36" rx="8" fill="${c}"/>
			<rect x="98" y="78" width="20" height="36" rx="8" fill="${c}"/></g>${on || !known ? "" : slash(COLORS.red)}
			${text(known ? (on ? "Sound on" : "Deafened") : "Deafen", 138, 16, c, 500)}`,
	);
}

export function pttIcon(active: boolean): string {
	const c = active ? COLORS.green : COLORS.fg;
	return svg(
		`<circle cx="72" cy="60" r="34" fill="none" stroke="${c}" stroke-width="8"/>
		<rect x="62" y="40" width="20" height="36" rx="10" fill="${c}"/>${text("Push to talk", 128, 16, c, 500)}`,
	);
}

export function statusIcon(status: string, active: boolean, problem?: string | null): string {
	const map: Record<string, [string, string]> = {
		online: [COLORS.green, "Online"],
		idle: [COLORS.yellow, "Idle"],
		dnd: [COLORS.red, "Do not disturb"],
		invisible: [COLORS.offline, "Invisible"],
	};
	const [c, name] = map[status] ?? map.online;
	const glyph =
		status === "idle"
			? `<circle cx="72" cy="56" r="30" fill="${c}"/><circle cx="88" cy="42" r="22" fill="${COLORS.bg}"/>`
			: status === "dnd"
				? `<circle cx="72" cy="56" r="30" fill="${c}"/><rect x="52" y="50" width="40" height="12" rx="6" fill="${COLORS.bg}"/>`
				: status === "invisible"
					? `<circle cx="72" cy="56" r="26" fill="none" stroke="${c}" stroke-width="9"/>`
					: `<circle cx="72" cy="56" r="30" fill="${c}"/>`;
	const ring = active ? `<rect x="4" y="4" width="136" height="136" rx="14" fill="none" stroke="${c}" stroke-width="6"/>` : "";
	return svg(`${glyph}${problem ? text(problem, 126, 18, COLORS.red, 600) : label(name, 122, active ? COLORS.fg : COLORS.dim)}${ring}`);
}

export function messageIcon(name: string, state: "idle" | "ok" | "error" = "idle"): string {
	const c = state === "ok" ? COLORS.green : state === "error" ? COLORS.red : COLORS.fg;
	return svg(
		`<path d="M30 28h84a8 8 0 0 1 8 8v46a8 8 0 0 1-8 8H74l-24 20V90H30a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" fill="${c}"/>
		<rect x="40" y="46" width="64" height="8" rx="4" fill="${COLORS.bg}"/><rect x="40" y="62" width="40" height="8" rx="4" fill="${COLORS.bg}"/>
		${label(name || "Message", 134, COLORS.dim)}`,
	);
}

export function voiceIcon(name: string, members: string[], live: boolean): string {
	const c = members.length ? COLORS.green : live ? COLORS.dim : COLORS.offline;
	const shown = members.slice(0, 2).join(", ");
	return svg(
		`<g transform="translate(13 -8) scale(0.84)"><path d="M40 54h22l26-22v80L62 90H40z" fill="${c}"/>
		<path d="M100 48a30 30 0 0 1 0 44M112 34a50 50 0 0 1 0 72" fill="none" stroke="${c}" stroke-width="8" stroke-linecap="round"/></g>
		${text(members.length ? String(members.length) : "–", 114, 28, COLORS.fg, 700)}
		${text(shown.length > 16 ? shown.slice(0, 15) + "…" : shown || name.slice(0, 16), 136, 14, COLORS.dim, 500)}`,
	);
}

export function mentionsIcon(count: number, live: boolean, problemText = "Offline"): string {
	const c = !live ? COLORS.offline : count > 0 ? COLORS.red : COLORS.dim;
	return svg(
		`<circle cx="72" cy="58" r="36" fill="none" stroke="${c}" stroke-width="8"/>
		${text(count > 99 ? "99+" : String(count), 70, 34, COLORS.fg, 700)}
		${text(live ? (count > 0 ? "Unread" : "All read") : problemText, 130, 18, c, 500)}`,
	);
}

export const problemLabel = (p: string | null): string => (p === "invalid-token" ? "Bad token" : p === "connecting" ? "Connecting" : "Offline");

export const fluxerLogo = svg(`<circle cx="72" cy="72" r="40" fill="${COLORS.brand}"/>${text("F", 88, 56, "#fff", 700)}`);
