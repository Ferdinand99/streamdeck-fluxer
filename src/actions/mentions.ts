import streamDeck, { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { client, FluxerAction } from "../app.js";
import { mentionsIcon, problemLabel } from "../render.js";

/** Counts unread mentions and DMs; pressing opens the Fluxer web app. */
@action({ UUID: "net.opland.fluxer.mentions" })
export class MentionsAction extends FluxerAction {
	protected override async draw(a: KeyAction<any>): Promise<void> {
		await a.setImage(mentionsIcon(client.totalMentions, client.connected, problemLabel(client.problem)));
	}

	override async onKeyDown(_ev: KeyDownEvent): Promise<void> {
		await streamDeck.system.openUrl(client.webapp);
	}
}
