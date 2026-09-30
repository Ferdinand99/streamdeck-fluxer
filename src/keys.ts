import streamDeck from "@elgato/streamdeck";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

/**
 * Sends global keyboard shortcuts on Windows through one long-lived PowerShell process
 * (SendInput is compiled once, so presses are instant). Needed because Fluxer has no local
 * RPC: muting the running client is only possible by pressing the shortcut set in its settings.
 */

const SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public static class K {
  [StructLayout(LayoutKind.Sequential)] struct KI { public ushort vk; public ushort scan; public uint flags; public uint time; public IntPtr extra; }
  [StructLayout(LayoutKind.Explicit)] struct U { [FieldOffset(0)] public KI ki; [FieldOffset(0)] public long pad1; [FieldOffset(8)] public long pad2; [FieldOffset(16)] public long pad3; [FieldOffset(24)] public long pad4; }
  [StructLayout(LayoutKind.Sequential)] struct IN { public uint type; public U u; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, IN[] i, int size);
  [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint type);
  public static void Key(ushort vk, bool up) {
    var i = new IN[1]; i[0].type = 1;
    i[0].u.ki.vk = vk; i[0].u.ki.scan = (ushort)MapVirtualKey(vk, 0);
    i[0].u.ki.flags = (up ? 2u : 0u);
    if (SendInput(1, i, Marshal.SizeOf(typeof(IN))) != 1) Console.Error.WriteLine("SendInput failed: " + Marshal.GetLastWin32Error());
  }
}
"@
[Console]::Out.WriteLine('ready')
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $p = $line.Split(' ')
  $up = ($p[0] -eq 'up')
  $codes = @($p[1].Split(',') | ForEach-Object { [uint16]$_ })
  if ($up) { [array]::Reverse($codes) }
  foreach ($c in $codes) { [K]::Key($c, $up) }
}
`;

const MODIFIERS: Record<string, number> = { ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, meta: 0x5b };
const NAMED: Record<string, number> = {
	space: 0x20, enter: 0x0d, tab: 0x09, esc: 0x1b, backspace: 0x08, insert: 0x2d, delete: 0x2e,
	home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22, left: 0x25, up: 0x26, right: 0x27, down: 0x28,
	";": 0xba, "=": 0xbb, ",": 0xbc, "-": 0xbd, ".": 0xbe, "/": 0xbf, "`": 0xc0, "[": 0xdb, "\\": 0xdc, "]": 0xdd, "'": 0xde,
	numpad0: 0x60, numpad1: 0x61, numpad2: 0x62, numpad3: 0x63, numpad4: 0x64,
	numpad5: 0x65, numpad6: 0x66, numpad7: 0x67, numpad8: 0x68, numpad9: 0x69,
};

/** "ctrl+shift+m" → virtual-key codes, modifiers first. Returns undefined if unparseable. */
export function parseShortcut(spec: string | undefined): number[] | undefined {
	if (!spec?.trim()) return undefined;
	const mods: number[] = [];
	const keys: number[] = [];
	for (const raw of spec.toLowerCase().split("+")) {
		const part = raw.trim();
		if (!part) continue;
		if (part in MODIFIERS) mods.push(MODIFIERS[part]);
		else if (/^[a-z]$/.test(part)) keys.push(part.toUpperCase().charCodeAt(0));
		else if (/^[0-9]$/.test(part)) keys.push(part.charCodeAt(0));
		else if (/^f([1-9]|1\d|2[0-4])$/.test(part)) keys.push(0x6f + Number(part.slice(1)));
		else if (part in NAMED) keys.push(NAMED[part]);
		else return undefined;
	}
	return keys.length === 1 ? [...new Set(mods), ...keys] : undefined;
}

let proc: ChildProcessWithoutNullStreams | null = null;

function helper(): ChildProcessWithoutNullStreams {
	if (proc && !proc.killed && proc.exitCode === null) return proc;
	const encoded = Buffer.from(SCRIPT, "utf16le").toString("base64");
	proc = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-EncodedCommand", encoded], {
		windowsHide: true,
	});
	proc.stderr.on("data", (d) => streamDeck.logger.error("keys helper:", String(d)));
	proc.on("exit", () => (proc = null));
	return proc;
}

function write(verb: "down" | "up", codes: number[]): void {
	helper().stdin.write(`${verb} ${codes.join(",")}\n`);
}

export function keyDown(spec: string | undefined): boolean {
	const codes = parseShortcut(spec);
	if (!codes) return false;
	write("down", codes);
	return true;
}

export function keyUp(spec: string | undefined): void {
	const codes = parseShortcut(spec);
	if (codes) write("up", codes);
}

export function tap(spec: string | undefined): boolean {
	const codes = parseShortcut(spec);
	if (!codes) return false;
	write("down", codes);
	write("up", codes);
	return true;
}

export function stopKeys(): void {
	proc?.kill();
	proc = null;
}
