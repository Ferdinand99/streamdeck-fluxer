import streamDeck, { action, type KeyAction, type KeyDownEvent } from "@elgato/streamdeck";
import { client, FluxerAction } from "../app.js";
import { ChannelType } from "../fluxer/client.js";
import { voiceIcon } from "../render.js";

type Settings = {
	channelId?: string;
};

/** Shows who is in a voice channel; pressing opens it in the Fluxer web app. */
@action({ UUID: "net.opland.fluxer.voice" })
export class VoiceChannelAction extends FluxerAction<Settings> {
	protected override datasources = { voiceChannels: [ChannelType.GuildVoice, ChannelType.GroupDM, ChannelType.DM] };

	protected override async draw(a: KeyAction<Settings>, s: Settings): Promise<void> {
		const id = s.channelId;
		const name = (id && client.channelName(id)?.split("›").pop()?.trim()) || "Voice";
		await a.setImage(voiceIcon(name, id ? client.membersInChannel(id) : [], client.connected));
	}

	override async onKeyDown(ev: KeyDownEvent<Settings>): Promise<void> {
		const id = ev.payload.settings.channelId;
		if (!id) return ev.action.showAlert();
		const guildId = [...client.guilds.values()].find((g) => g.channels.has(id))?.id ?? "@me";
		await streamDeck.system.openUrl(`${client.webapp}/channels/${guildId}/${id}`);
	}
}
