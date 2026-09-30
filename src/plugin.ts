import streamDeck from "@elgato/streamdeck";
import { initClient } from "./app.js";
import { MentionsAction } from "./actions/mentions.js";
import { MessageAction } from "./actions/message.js";
import { StatusAction } from "./actions/status.js";
import { VoiceChannelAction } from "./actions/voice-channel.js";
import { DeafenAction, MuteAction, PushToTalkAction } from "./actions/voice-toggle.js";
import { stopKeys } from "./keys.js";

streamDeck.actions.registerAction(new MuteAction());
streamDeck.actions.registerAction(new DeafenAction());
streamDeck.actions.registerAction(new PushToTalkAction());
streamDeck.actions.registerAction(new StatusAction());
streamDeck.actions.registerAction(new MessageAction());
streamDeck.actions.registerAction(new VoiceChannelAction());
streamDeck.actions.registerAction(new MentionsAction());

process.on("exit", stopKeys);

await streamDeck.connect();
await initClient();
