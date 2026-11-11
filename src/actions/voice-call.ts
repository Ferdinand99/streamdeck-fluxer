import { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { client, FluxerAction } from "../app.js";
import { tap } from "../keys.js";
import { cameraIcon, disconnectIcon, liveIcon } from "../render.js";

type Shortcut = {
	shortcut?: string;
};

/** Presses Fluxer's "Toggle camera" global shortcut and shows whether the camera is on. */
@action({ UUID: "net.opland.fluxer.camera" })
export class CameraAction extends FluxerAction<Shortcut> {
	protected override async draw(a: KeyAction<Shortcut>): Promise<void> {
		const v = client.ownVoice;
		await a.setImage(cameraIcon(Boolean(v?.self_video), v !== null));
	}

	override async onKeyDown(ev: KeyDownEvent<Shortcut>): Promise<void> {
		if (!tap(ev.payload.settings.shortcut || "ctrl+shift+k")) await ev.action.showAlert();
	}
}

/**
 * Shows whether you are streaming (screen share). Fluxer has no shortcut to start or stop a
 * stream, so the key only reflects the state; pressing it does nothing.
 */
@action({ UUID: "net.opland.fluxer.live" })
export class LiveAction extends FluxerAction {
	protected override async draw(a: KeyAction<JsonObject>): Promise<void> {
		const v = client.ownVoice;
		await a.setImage(liveIcon(Boolean(v?.self_stream), v !== null));
	}
}

/** Presses Fluxer's "Disconnect from voice" global shortcut. */
@action({ UUID: "net.opland.fluxer.disconnect" })
export class DisconnectAction extends FluxerAction<Shortcut> {
	protected override async draw(a: KeyAction<Shortcut>): Promise<void> {
		await a.setImage(disconnectIcon(client.ownVoice !== null));
	}

	override async onKeyDown(ev: KeyDownEvent<Shortcut>): Promise<void> {
		if (!tap(ev.payload.settings.shortcut || "ctrl+shift+e")) await ev.action.showAlert();
	}
}
