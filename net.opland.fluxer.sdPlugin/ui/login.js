// Email login for the property inspector. The password is sent to the plugin only; it is never saved.
(function () {
	const $ = (id) => document.getElementById(id);
	let ticket = null;

	function show(text, ok) {
		const el = $("fx-msg");
		el.textContent = text || "";
		el.style.color = ok ? "#3ba55d" : "#e5484d";
	}

	function init() {
		const client = window.SDPIComponents && window.SDPIComponents.streamDeckClient;
		if (!client || !$("fx-go")) return setTimeout(init, 150);

		client.sendToPropertyInspector.subscribe((ev) => {
			const p = ev.payload;
			if (!p || p.event !== "loginResult") return;
			$("fx-go").disabled = false;
			$("fx-pass").value = "";
			if (p.ok) {
				ticket = null;
				$("fx-mfa").hidden = true;
				$("fx-code").value = "";
				show(p.message, true);
			} else if (p.mfaTicket) {
				ticket = p.mfaTicket;
				$("fx-mfa").hidden = false;
				$("fx-code").value = "";
				$("fx-code").focus();
				show(p.message, false);
			} else {
				ticket = null;
				$("fx-mfa").hidden = true;
				show(p.message, false);
			}
		});

		$("fx-go").addEventListener("click", () => {
			$("fx-go").disabled = true;
			show("Logging in…", true);
			const payload = ticket
				? { event: "loginMfa", ticket, code: $("fx-code").value }
				: { event: "login", email: $("fx-email").value, password: $("fx-pass").value };
			client.send("sendToPlugin", payload);
		});
	}
	init();
})();
