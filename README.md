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
| Status | Online / Idle / Do not disturb / Invisible (`PATCH /v1/users/@me/settings`). |
| Quick Message | Sends a preset message to a channel or DM. |
| Voice Channel | Shows who is in a voice channel; press to open it in the web app. |
| Mentions | Unread mentions + DMs; press to open the web app. |

## Limits

Fluxer has no local RPC like Discord, and voice state is per gateway session, so the plugin cannot mute the running
client through the API. Mute/Deafen/PTT therefore press a keyboard shortcut. Set a matching **global** keybind in
Fluxer (defaults used when the field is empty: mute `ctrl+shift+m`, deafen `ctrl+shift+d`, PTT `ctrl+shift+t`).
