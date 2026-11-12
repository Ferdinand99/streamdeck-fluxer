// Tells the user which Fluxer keybind a key presses, and what the plugin's default is.
// Fluxer only sets mute and deafen by default; push to talk, camera and disconnect have
// no shortcut until you set one in Fluxer.
(function () {
	const KEYS = {
		"net.opland.fluxer.mute": { name: "Toggle mute", def: "ctrl+shift+m", preset: true },
		"net.opland.fluxer.deafen": { name: "Toggle deafen", def: "ctrl+shift+d", preset: true },
		"net.opland.fluxer.ptt": { name: "Push to talk", def: "ctrl+shift+t", preset: false },
		"net.opland.fluxer.camera": { name: "Toggle camera", def: "ctrl+shift+k", preset: false },
		"net.opland.fluxer.disconnect": { name: "Disconnect from voice", def: "ctrl+shift+e", preset: false },
	};
	const MODS = " Modifiers: ctrl, shift, alt, win. Keys: a-z, 0-9, f1-f24, space, etc.";

	function apply(uuid) {
		const k = KEYS[uuid];
		if (!k) return;
		const field = document.getElementById("fx-shortcut");
		if (field) field.setAttribute("placeholder", k.def);
		const hint = document.getElementById("fx-hint");
		if (!hint) return;
		const where = "Fluxer → User Settings → Keybinds → “" + k.name + "” (with Global on)";
		hint.textContent = k.preset
			? "Fluxer's default for “" + k.name + "” is " + k.def + ", which this key presses when the field is empty. If you changed it in Fluxer, enter the same shortcut here." + MODS
			: "Fluxer has no shortcut for this by default. Set one in " + where + ", for example " + k.def + ", which this key presses when the field is empty." + MODS;
	}

	function init() {
		const client = window.SDPIComponents && window.SDPIComponents.streamDeckClient;
		if (!client || typeof client.getConnectionInfo !== "function") return setTimeout(init, 150);
		client.getConnectionInfo().then((info) => apply(info && info.actionInfo && info.actionInfo.action)).catch(() => {});
	}

	init();
})();
