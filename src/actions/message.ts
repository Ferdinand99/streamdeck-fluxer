import streamDeck, { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { client, FluxerAction } from "../app.js";
import { ChannelType } from "../fluxer/client.js";
import { messageIcon } from "../render.js";

type Settings = {
	channelId?: string;
	text?: string;
	name?: string;
};

@action({ UUID: "net.opland.fluxer.message" })
export class MessageAction extends FluxerAction<Settings> {
	protected override datasources = { textChannels: [ChannelType.GuildText, ChannelType.DM, ChannelType.GroupDM] };

	protected override async draw(a: KeyAction<Settings>, s: Settings): Promise<void> {
		await a.setImage(messageIcon(s.name || (s.channelId && client.channelName(s.channelId)?.split("›").pop()?.trim()) || ""));
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const { channelId, text } = ev.payload.settings;
		streamDeck.logger.info(`message key: channel=${channelId ?? "none"} text=${text ? text.length + " chars" : "none"} connected=${client.connected}`);
		if (!channelId || !text?.trim()) return ev.action.showAlert();
		try {
			await client.sendMessage(channelId, text);
			streamDeck.logger.info("message sent");
			await ev.action.showOk();
		} catch (err) {
			streamDeck.logger.error(err);
			await ev.action.showAlert();
		}
	}
}
