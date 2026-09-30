import { action, type KeyAction, type KeyDownEvent, type KeyUpEvent } from "@elgato/streamdeck";
import { client, FluxerAction } from "../app.js";
import { keyDown, keyUp, tap } from "../keys.js";
import { headphonesIcon, micIcon, pttIcon } from "../render.js";

type Shortcut = {
	shortcut?: string;
};

/** Shared by mute and deafen: the key presses Fluxer's own shortcut, and mirrors the state the client reports. */
abstract class VoiceToggle extends FluxerAction<Shortcut> {
	protected abstract defaultShortcut: string;
	protected abstract flag: "self_mute" | "self_deaf";
	protected abstract icon(on: boolean, known: boolean): string;

	protected override async draw(a: KeyAction<Shortcut>): Promise<void> {
		const v = client.ownVoice;
		// `on` = audio flowing. Unknown (not in a call) shows the neutral icon.
		await a.setImage(this.icon(v ? !v[this.flag] : true, v !== null));
	}

	override async onKeyDown(ev: KeyDownEvent<Shortcut>): Promise<void> {
		if (!tap(ev.payload.settings.shortcut || this.defaultShortcut)) await ev.action.showAlert();
	}
}

@action({ UUID: "net.opland.fluxer.mute" })
export class MuteAction extends VoiceToggle {
	protected defaultShortcut = "ctrl+shift+m";
	protected flag = "self_mute" as const;
	protected icon = micIcon;
}

@action({ UUID: "net.opland.fluxer.deafen" })
export class DeafenAction extends VoiceToggle {
	protected defaultShortcut = "ctrl+shift+d";
	protected flag = "self_deaf" as const;
	protected icon = headphonesIcon;
}

@action({ UUID: "net.opland.fluxer.ptt" })
export class PushToTalkAction extends FluxerAction<Shortcut> {
	protected override async draw(a: KeyAction<Shortcut>): Promise<void> {
		await a.setImage(pttIcon(false));
	}

	override async onKeyDown(ev: KeyDownEvent<Shortcut>): Promise<void> {
		if (!keyDown(ev.payload.settings.shortcut || "ctrl+shift+t")) return ev.action.showAlert();
		await ev.action.setImage(pttIcon(true));
	}

	override async onKeyUp(ev: KeyUpEvent<Shortcut>): Promise<void> {
		keyUp(ev.payload.settings.shortcut || "ctrl+shift+t");
		await ev.action.setImage(pttIcon(false));
	}
}
