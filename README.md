# Fluxer for Stream Deck

Stream Deck plugin for [Fluxer](https://fluxer.app). Windows, Stream Deck 7.1+.

## Install (development)

```
npm install
npm run build
npm run link      # registers the plugin with Stream Deck (restart the app if asked)
```

`npm run watch` rebuilds on change; `npm run pack` creates a distributable `.streamDeckPlugin`.

## Setup

Drag any Fluxer action onto a key. In the property inspector fill in **Token** (and **Instance** only for
self-hosted Fluxer; empty = fluxer.app). The token is stored in Stream Deck's global settings and is shared by all keys.

## Actions

| Action | What it does |
| --- | --- |
| Mute / Deafen | Presses the shortcut you set in Fluxer. The key shows the real state, read from the gateway. |
| Push to Talk | Holds your push-to-talk shortcut while the key is down. |
| Camera | Presses your Fluxer "Toggle camera" shortcut. The key shows whether your camera is on. |
| Live | Shows whether you are streaming (screen share). Pressing it does nothing, see Limits. |
| Disconnect | Presses your Fluxer "Disconnect from voice" shortcut. The key is red while you are in voice. |
| Status | Online / Idle / Do not disturb / Invisible (`PATCH /v1/users/@me/settings`). |
| Quick Message | Sends a preset message to a channel or DM. |
| Voice Channel | Shows who is in a voice channel; press to open it in the web app. |
| Mentions | Unread mentions + DMs; press to open the web app. |

## Limits

Fluxer has no local RPC like Discord, and voice state is per gateway session, so the plugin cannot mute the running
client through the API. Mute/Deafen/PTT therefore press a keyboard shortcut. Set a matching **global** keybind in
Fluxer (defaults used when the field is empty: mute `ctrl+shift+m`, deafen `ctrl+shift+d`, PTT `ctrl+shift+t`,
camera `ctrl+shift+k`, disconnect `ctrl+shift+e`).

Fluxer has no shortcut to start or stop a stream, and starting one needs you to pick a screen or window, so the
plugin cannot start or stop streaming. The Live key shows the state instead. A start/stop key can follow if
Fluxer adds a shortcut for it.
