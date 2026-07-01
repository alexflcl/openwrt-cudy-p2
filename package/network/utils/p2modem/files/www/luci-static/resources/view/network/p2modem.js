"use strict";
"require view";
"require dom";
"require form";
"require fs";
"require ui";
"require uci";

function modeInfo(mode) {
	if (mode === "wan-primary")
		return "WAN=10 / SIM=20 / DNS por WAN";
	if (mode === "wan-as-lan")
		return "SIM=10 / WAN puenteado a LAN";
	return "SIM=10 / WAN=30 / DNS por SIM";
}

function ratInfo(mode) {
	if (mode === "4g")
		return "Solo 4G/LTE";
	if (mode === "5g")
		return "Preferencia 5G";
	return "Automatico";
}

function fmtDuration(seconds) {
	var n = parseInt(seconds, 10), h, m, s;

	if (isNaN(n) || n <= 0)
		return "-";

	h = Math.floor(n / 3600);
	m = Math.floor((n % 3600) / 60);
	s = n % 60;

	if (h > 0)
		return h + "h " + m + "m " + s + "s";
	if (m > 0)
		return m + "m " + s + "s";
	return s + "s";
}

function qualityLabel(metric, value) {
	var n = parseFloat(value);

	if (isNaN(n))
		return "";

	if (metric === "csq") {
		if (n >= 20) return "Muy buena";
		if (n >= 15) return "Buena";
		if (n >= 10) return "Aceptable";
		return "Debil";
	}

	if (metric === "rsrp") {
		if (n >= -90) return "Excelente";
		if (n >= -100) return "Buena";
		if (n >= -110) return "Debil";
		return "Muy debil";
	}

	if (metric === "rsrq") {
		if (n >= -10) return "Excelente";
		if (n >= -15) return "Aceptable";
		return "Mala";
	}

	if (metric === "sinr") {
		if (n >= 20) return "Excelente";
		if (n >= 13) return "Buena";
		if (n >= 0) return "Aceptable";
		return "Borde de celda";
	}

	if (metric === "rssi") {
		if (n >= -65) return "Excelente";
		if (n >= -75) return "Buena";
		if (n >= -85) return "Aceptable";
		return "Debil";
	}

	return "";
}

function rangePercent(metric, value) {
	var n = parseFloat(value);

	if (isNaN(n))
		return 0;
	if (metric === "csq")
		return Math.max(0, Math.min(100, Math.round((Math.min(n, 31) / 31) * 100)));
	if (metric === "rsrp")
		return Math.max(0, Math.min(100, Math.round(((n + 140) / 60) * 100)));
	if (metric === "rsrq")
		return Math.max(0, Math.min(100, Math.round(((n + 20) / 17) * 100)));
	if (metric === "sinr")
		return Math.max(0, Math.min(100, Math.round(((n + 10) / 30) * 100)));
	if (metric === "rssi")
		return Math.max(0, Math.min(100, Math.round(((n + 110) / 60) * 100)));
	return 0;
}

function progressColor(metric, value) {
	var label = qualityLabel(metric, value);

	if (label === "Excelente" || label === "Muy buena" || label === "Buena")
		return "#16a34a";
	if (label === "Aceptable")
		return "#eab308";
	return "#dc2626";
}

function statRow(label, value, help) {
	return E("tr", {}, [
		E("td", { "style": "width:32%; font-weight:600; vertical-align:top;" }, [ label ]),
		E("td", {}, [
			E("div", {}, [ value || "-" ]),
			help ? E("div", { "style": "font-size:.85em; color:#6b7280;" }, [ help ]) : ""
		])
	]);
}

function progressRow(label, value, unit, metric) {
	var pct = rangePercent(metric, value);
	var text = value ? (value + unit + " | " + qualityLabel(metric, value)) : "-";

	return E("tr", {}, [
		E("td", { "style": "width:32%; font-weight:600; vertical-align:top;" }, [ label ]),
		E("td", {}, [
			E("div", { "style": "margin-bottom:.25rem;" }, [ text ]),
			E("div", { "style": "border:1px solid #d1d5db; border-radius:999px; height:8px; background:#f3f4f6; overflow:hidden; max-width:280px;" }, [
				E("div", { "style": "height:100%; width:" + pct + "%; background:" + progressColor(metric, value) + ";" })
			])
		])
	]);
}

function sectionTable(title, rows) {
	return E("div", { "class": "cbi-section" }, [
		E("h3", {}, [ title ]),
		E("table", { "class": "table", "style": "width:100%;" }, [ E("tbody", {}, rows) ])
	]);
}

function makeTabs(sections, initialName) {
	var nav = E("div", { "style": "display:flex; gap:.5rem; margin-bottom:1rem; flex-wrap:wrap;" });
	var content = E("div");
	var active = initialName;

	function render() {
		nav.innerHTML = "";
		content.innerHTML = "";

		sections.forEach(function(section) {
			var selected = section.name === active;
			nav.appendChild(E("button", {
				"class": "btn cbi-button " + (selected ? "cbi-button-positive" : ""),
				"click": function(ev) {
					ev.preventDefault();
					active = section.name;
					render();
				}
			}, [ section.title ]));
		});

		sections.forEach(function(section) {
			content.appendChild(E("div", { "style": section.name === active ? "" : "display:none;" }, [ section.node ]));
		});
	}

	render();
	return E("div", {}, [ nav, content ]);
}

return view.extend({
	rawStatusText: "",
	rawStatusNode: null,
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct("/usr/bin/p2modemctl", [ "summary" ], "json"), "{}"),
			uci.load("p2modem")
		]);
	},
	queueApplyMode: function(mode) {
		if (!mode)
			return Promise.resolve();
		return fs.exec_direct("/bin/sh", [ "-c", "nohup /usr/bin/p2modemctl apply-mode " + mode + " >/tmp/p2modem-apply.log 2>&1 &" ], "text");
	},
	readSelectedMode: function(name, fallback) {
		var el = document.querySelector('select[id*="' + name + '"]');
		return el ? el.value : fallback;
	},
	handleSave: function(ev) {
		var tasks = [];
		document.getElementById("maincontent").querySelectorAll(".cbi-map").forEach(function(map) {
			tasks.push(dom.callClassMethod(map, "save"));
		});
		return Promise.all(tasks);
	},
	handleSaveApply: function(ev, mode) {
		var wanMode = this.readSelectedMode("wan_mode", "sim-primary");
		var ratMode = this.readSelectedMode("rat_pref", "auto");

		return this.handleSave(ev).then(L.bind(function() {
			return Promise.all([ this.queueApplyMode(wanMode), this.queueApplyMode(ratMode) ]);
		}, this)).then(function() {
			return ui.changes.apply(mode === "0");
		});
	},
	handleAction: function(action) {
		return fs.exec_direct("/usr/bin/p2modemctl", [ action ], "text").then(function(res) {
			ui.showModal(_("P2 Modem: %s").format(action), [
				E("pre", { "style": "white-space:pre-wrap" }, [ res || _("No output") ]),
				E("div", { "class": "right" }, [ E("button", { "class": "btn", "click": ui.hideModal }, [ _("Close") ]) ])
			]);
		}).catch(function(err) {
			ui.addNotification(null, E("p", err.message || err));
		});
	},
	refreshRawStatus: function() {
		var self = this;
		if (self.rawStatusNode)
			self.rawStatusNode.textContent = "Cargando...";

		return fs.exec_direct("/usr/bin/p2modemctl", [ "status" ], "text").then(function(res) {
			self.rawStatusText = res || _("No status available");
			if (self.rawStatusNode)
				self.rawStatusNode.textContent = self.rawStatusText;
		}).catch(function(err) {
			if (self.rawStatusNode)
				self.rawStatusNode.textContent = err.message || String(err);
		});
	},
	renderStats: function(summary) {
		return E("div", {}, [
			E("div", { "style": "display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; margin-bottom:1rem;" }, [
				E("div", { "class": "cbi-section", "style": "margin:0;" }, [
					E("h3", {}, [ "Resumen" ]),
					E("div", { "style": "display:grid; gap:.45rem;" }, [
						E("div", {}, [ E("strong", {}, [ "Operador: " ]), summary.operator || "-" ]),
						E("div", {}, [ E("strong", {}, [ "Tecnologia: " ]), summary.technology || "-" ]),
						E("div", {}, [ E("strong", {}, [ "SIM: " ]), summary.sim_status || "-" ]),
						E("div", {}, [ E("strong", {}, [ "IP WWAN: " ]), summary.wwan_ip || "-" ]),
						E("div", {}, [ E("strong", {}, [ "Tiempo conectado: " ]), fmtDuration(summary.uptime) ])
					])
				])
			]),
			sectionTable("Informacion general", [
				statRow("Router", summary.model),
				statRow("Operador", summary.operator),
				statRow("Tecnologia", summary.technology),
				statRow("Carrier aggregation", summary.carrier_aggregation),
				statRow("SIM", summary.sim_status),
				statRow("ICCID", summary.iccid),
				statRow("Ruta activa", summary.route_device),
				statRow("DNS", summary.dns)
			]),
			sectionTable("Senal", [
				progressRow("CSQ", summary.csq, "", "csq"),
				progressRow("RSSI", summary.rssi, " dBm", "rssi"),
				progressRow("RSRP", summary.rsrp, " dBm", "rsrp"),
				progressRow("RSRQ", summary.rsrq, " dB", "rsrq"),
				progressRow("SINR", summary.sinr, " dB", "sinr")
			]),
			sectionTable("Temperaturas", [
				statRow("CPU", summary.cpu_temp ? summary.cpu_temp + " C" : "-"),
				statRow("WiFi 2.4 GHz", summary.wifi2g_temp ? summary.wifi2g_temp + " C" : "-"),
				statRow("WiFi 5 GHz", summary.wifi5g_temp ? summary.wifi5g_temp + " C" : "-")
			])
		]);
	},
	render: function(data) {
		var summary = {};
		var currentMode = uci.get("p2modem", "main", "wan_mode") || "sim-primary";
		var currentRat = uci.get("p2modem", "main", "rat_pref") || "auto";
		var m = new form.Map("p2modem", _("P2 Modem"), _("Gestion del modem interno del Cudy P2 con estadisticas visuales, configuracion del enlace movil y estado detallado para diagnostico."));
		var s = m.section(form.TypedSection, "settings", _("Configuracion"));
		var self = this;
		var o;

		try { summary = JSON.parse(data[0] || "{}"); } catch (e) {}

		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, "enabled", _("Activado en arranque")); o.default = "1";
		o = s.option(form.Value, "apn", _("APN")); o.placeholder = "internet"; o.rmempty = false;
		o = s.option(form.ListValue, "pdp_type", _("Tipo PDP")); o.value("IP"); o.value("IPV4V6"); o.default = "IP";
		o = s.option(form.Value, "at_port", _("Puerto AT")); o.placeholder = "/dev/stty_nr31";
		o = s.option(form.Value, "data_if", _("Interfaz de datos")); o.placeholder = "pcie0";
		o = s.option(form.Value, "dummy_if", _("Interfaz dummy")); o.placeholder = "sipa_dummy0";
		o = s.option(form.Value, "wwan_iface", _("Interfaz OpenWrt")); o.placeholder = "wwan";
		o = s.option(form.ListValue, "wan_mode", _("Modo WAN"));
		o.value("sim-primary", _("SIM principal, WAN secundaria"));
		o.value("wan-primary", _("WAN principal, SIM secundaria"));
		o.value("wan-as-lan", _("SIM principal, WAN como LAN"));
		o.default = "sim-primary";
		o = s.option(form.DummyValue, "_metric_info", _("Prioridad efectiva"));
		o.cfgvalue = function() { return modeInfo(currentMode); };
		o = s.option(form.DummyValue, "_port_info", _("Puertos fisicos"));
		o.cfgvalue = function() {
			return currentMode === "wan-as-lan" ? "LAN + WAN unidos al bridge LAN" : "Solo LAN en bridge; WAN separado";
		};
		o = s.option(form.ListValue, "rat_pref", _("Modo radio"));
		o.value("auto", _("Automatico"));
		o.value("4g", _("Solo 4G"));
		o.value("5g", _("Preferir 5G"));
		o.default = "auto";
		o = s.option(form.DummyValue, "_rat_info", _("Radio efectiva"));
		o.cfgvalue = function() { return ratInfo(currentRat); };

		return m.render().then(L.bind(function(nodes) {
			self.rawStatusNode = E("pre", { "style": "white-space:pre-wrap; max-height:26rem; overflow:auto; margin-top:.5rem;" }, [ _("Pulsa \"Refresh status\" para cargar el volcado completo.") ]);

			var statsNode = self.renderStats(summary);
			var configNode = E("div", {}, [
				E("div", { "class": "cbi-page-actions" }, [
					E("button", { "class": "btn cbi-button cbi-button-action important", "click": ui.createHandlerFn(self, "handleAction", "connect") }, [ _("Connect SIM") ]),
					" ",
					E("button", { "class": "btn cbi-button cbi-button-action", "click": ui.createHandlerFn(self, "handleAction", "disconnect") }, [ _("Disconnect SIM") ])
				]),
				nodes
			]);
			var rawNode = E("div", {}, [
				E("div", { "class": "cbi-page-actions" }, [
					E("button", { "class": "btn cbi-button", "click": ui.createHandlerFn(self, "refreshRawStatus") }, [ _("Refresh status") ])
				]),
				E("div", { "class": "cbi-section" }, [
					E("h3", {}, [ _("Estado detallado") ]),
					self.rawStatusNode
				])
			]);

			return E("div", {}, [
				makeTabs([
					{ name: "stats", title: _("Stats"), node: statsNode },
					{ name: "config", title: _("Configuracion"), node: configNode },
					{ name: "raw", title: _("Raw status"), node: rawNode }
				], "stats")
			]);
		}, this));
	}
});
