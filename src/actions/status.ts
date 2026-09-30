import streamDeck, { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { client, FluxerAction } from "../app.js";
import type { Status } from "../fluxer/client.js";
import { problemLabel, statusIcon } from "../render.js";

type Settings = {
	status?: Status;
};

@action({ UUID: "net.opland.fluxer.status" })
export class StatusAction extends FluxerAction<Settings> {
	protected override async draw(a: KeyAction<Settings>, s: Settings): Promise<void> {
		const status = s.status ?? "online";
		await a.setImage(statusIcon(status, client.connected && client.status === status, client.connected ? null : problemLabel(client.problem)));
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		try {
			await client.setStatus(ev.payload.settings.status ?? "online");
		} catch (err) {
			streamDeck.logger.error(err);
			await ev.action.showAlert();
		}
	}
}
