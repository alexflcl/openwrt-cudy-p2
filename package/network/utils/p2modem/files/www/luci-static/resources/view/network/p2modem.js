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

function parseSections(status) {
	var lines = (status || "").split(/\r?\n/);
	var sections = {};
	var current = "_top";

	sections[current] = [];

	lines.forEach(function(line) {
		var match = line.match(/^\[([A-Z0-9_]+)\]$/);

		if (match) {
			current = match[1];
			sections[current] = [];
			return;
		}

		sections[current].push(line);
	});

	return sections;
}

function firstMatch(text, regex, fallback) {
	var match = text.match(regex);
	return match ? match[1] : (fallback || "");
}

function parseJsonBlock(lines) {
	var text = (lines || []).join("\n").trim();

	if (!text)
		return null;

	try {
		return JSON.parse(text);
	} catch (err) {
		return null;
	}
}

function csqPercent(csq) {
	var n = parseInt(csq, 10);

	if (isNaN(n) || n < 0)
		return 0;
	if (n > 31)
		n = 31;

	return Math.round((n / 31) * 100);
}

function qualityLabel(metric, value) {
	var n = parseFloat(value);

	if (isNaN(n))
		return "";

	if (metric === "csq") {
		if (n >= 20) return "Muy buena";
		if (n >= 15) return "Buena";
		if (n >= 10) return "Aceptable";
		return "Débil";
	}

	if (metric === "rsrp") {
		if (n >= -90) return "Excelente";
		if (n >= -100) return "Buena";
		if (n >= -110) return "Débil";
		return "Muy débil";
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
		return "Débil";
	}

	return "";
}

function progressColor(metric, value) {
	var n = parseFloat(value);

	if (isNaN(n))
		return "#9ca3af";

	if (metric === "csq") {
		if (n >= 20) return "#16a34a";
		if (n >= 15) return "#eab308";
		return "#dc2626";
	}

	if (metric === "sinr") {
		if (n >= 13) return "#16a34a";
		if (n >= 0) return "#eab308";
		return "#dc2626";
	}

	if (metric === "rsrp" || metric === "rsrq" || metric === "rssi") {
		if (qualityLabel(metric, value) === "Excelente" || qualityLabel(metric, value) === "Buena")
			return "#16a34a";
		if (qualityLabel(metric, value) === "Aceptable")
			return "#eab308";
		return "#dc2626";
	}

	return "#2563eb";
}

function rangePercent(metric, value) {
	var n = parseFloat(value);

	if (isNaN(n))
		return 0;

	if (metric === "csq")
		return csqPercent(n);
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

function summarizeStatus(status) {
	var sections = parseSections(status);
	var operator = firstMatch((sections.MODEM_OPERATOR || []).join("\n"), /\+QSPN:\s+"([^"]+)"/, "");
	var network = (sections.MODEM_NETWORK || []).filter(function(line) {
		return line.indexOf("+QNWINFO:") === 0;
	});
	var serving = (sections.MODEM_SERVING_CELL || []).filter(function(line) {
		return line.indexOf("+QENG:") === 0;
	});
	var cainfo = (sections.MODEM_CAINFO || []).filter(function(line) {
		return line.indexOf("+QCAINFO:") === 0;
	});
	var portStatus = parseSections((sections.PORT_STATUS || []).join("\n"));
	var lan = parseJsonBlock(portStatus["### LAN ###"]);
	var wan = parseJsonBlock(portStatus["### WAN ###"]);
	var wan6 = parseJsonBlock(portStatus["### WAN6 ###"]);
	var wwan = parseJsonBlock(portStatus["### WWAN ###"]);
	var tempText = (sections.TEMPS || []).join("\n");
	var chipName = firstMatch((sections.BOARD || []).join("\n"), /"model":\s*"([^"]+)"/, "Cudy P2");
	var simReady = firstMatch((sections.MODEM_SIM || []).join("\n"), /\+CPIN:\s*([A-Z]+)/, "");
	var simId = firstMatch((sections.MODEM_SIM || []).join("\n"), /\+QCCID:\s*([0-9A-F]+)/, "");
	var csq = firstMatch((sections.MODEM_SIGNAL || []).join("\n"), /\+CSQ:\s*(\d+)/, "");
	var activeRoute = firstMatch((sections.ACTIVE_ROUTE || []).join("\n"), /dev\s+([^\s]+)/, "");
	var cpuTemp = firstMatch(tempText, /cpu=([0-9.]+)\s*C/, "");
	var wifi2gTemp = firstMatch(tempText, /wifi_2g=([0-9.]+)\s*C/, "");
	var wifi5gTemp = firstMatch(tempText, /wifi_5g=([0-9.]+)\s*C/, "");
	var lteLine = serving.filter(function(line) { return line.indexOf('"LTE"') > -1; })[0] || "";
	var nrLine = serving.filter(function(line) { return line.indexOf('"NR5G-NSA"') > -1 || line.indexOf('"NR5G-SA"') > -1; })[0] || "";
	var rssi = firstMatch(lteLine, /"LTE"[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,(-?\d+)/, "");
	var rsrq = firstMatch(lteLine, /"LTE"[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,-?\d+,(-?\d+)/, "");
	var rsrp = firstMatch(lteLine, /"LTE"[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,[^,]*,-?\d+,-?\d+,(-?\d+)/, "");
	var sinr = firstMatch(nrLine || lteLine, /,(-?\d+)\s*$/, "");
	var tech = network.map(function(line) {
		var m = line.match(/\+QNWINFO:\s*"([^"]+)"[^,]*,"([^"]+)"/);
		return m ? (m[1] + " / " + m[2]) : null;
	}).filter(Boolean).join(" + ");
	var caSummary = cainfo.map(function(line) {
		var m = line.match(/\+QCAINFO:\s*"([^"]+)",\d+,\d+,"([^"]+)"/);
		return m ? (m[1] + " " + m[2]) : null;
	}).filter(Boolean).join(" + ");
	var dnsServers = (wwan && wwan["dns-server"]) ? wwan["dns-server"].join(", ") : "";
	var wwanIp = "";

	if (wwan && wwan["ipv4-address"] && wwan["ipv4-address"][0])
		wwanIp = wwan["ipv4-address"][0].address;

	return {
		chipName: chipName,
		operator: operator,
		technology: tech,
		carrierAggregation: caSummary,
		simStatus: simReady || "Unknown",
		simId: simId,
		csq: csq,
		rssi: rssi,
		rsrp: rsrp,
		rsrq: rsrq,
		sinr: sinr,
		cpuTemp: cpuTemp,
		wifi2gTemp: wifi2gTemp,
		wifi5gTemp: wifi5gTemp,
		wwanIp: wwanIp,
		dnsServers: dnsServers,
		activeRoute: activeRoute,
		portState: {
			lan: lan && lan.up,
			wan: wan && wan.up,
			wan6: wan6 && wan6.up,
			wwan: wwan && wwan.up
		},
		wwanUptime: wwan && wwan.uptime ? wwan.uptime : 0,
		rawStatus: status
	};
}

function fmtDuration(seconds) {
	var n = parseInt(seconds, 10);
	var h, m, s;

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

function statRow(label, value, help) {
	return E("tr", {}, [
		E("td", { "style": "width: 32%; font-weight: 600; vertical-align: top;" }, [ label ]),
		E("td", {}, [
			E("div", {}, [ value || "-" ]),
			help ? E("div", { "style": "font-size: 0.85em; color: #6b7280;" }, [ help ]) : ""
		])
	]);
}

function progressRow(label, value, unit, metric) {
	var pct = rangePercent(metric, value);
	var text = value ? (value + unit + " | " + qualityLabel(metric, value)) : "-";

	return E("tr", {}, [
		E("td", { "style": "width: 32%; font-weight: 600; vertical-align: top;" }, [ label ]),
		E("td", {}, [
			E("div", { "style": "margin-bottom: 0.25rem;" }, [ text ]),
			E("div", {
				"style": "border: 1px solid #d1d5db; border-radius: 999px; height: 8px; background: #f3f4f6; overflow: hidden; max-width: 280px;"
			}, [
				E("div", {
					"style": "height: 100%; width: " + pct + "%; background: " + progressColor(metric, value) + ";"
				})
			])
		])
	]);
}

function sectionTable(title, rows) {
	return E("div", { "class": "cbi-section" }, [
		E("h3", {}, [ title ]),
		E("table", { "class": "table", "style": "width: 100%;" }, [
			E("tbody", {}, rows)
		])
	]);
}

function portBadge(name, up) {
	return E("div", {
		"style": "border: 1px solid #d1d5db; border-radius: 10px; padding: 0.9rem; min-width: 120px; background: #fff;"
	}, [
		E("div", { "style": "font-weight: 700; margin-bottom: 0.4rem;" }, [ name ]),
		E("div", { "style": "color: " + (up ? "#16a34a" : "#dc2626") + "; font-weight: 600;" }, [ up ? "up" : "down" ])
	]);
}

function statsPanel(summary) {
	return E("div", {}, [
		E("div", {
			"style": "display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;"
		}, [
			E("div", { "class": "cbi-section", "style": "margin: 0;" }, [
				E("h3", {}, [ "Resumen" ]),
				E("div", { "style": "display: grid; gap: 0.45rem;" }, [
					E("div", {}, [ E("strong", {}, [ "Operador: " ]), summary.operator || "-" ]),
					E("div", {}, [ E("strong", {}, [ "Tecnologia: " ]), summary.technology || "-" ]),
					E("div", {}, [ E("strong", {}, [ "SIM: " ]), summary.simStatus || "-" ]),
					E("div", {}, [ E("strong", {}, [ "IP WWAN: " ]), summary.wwanIp || "-" ]),
					E("div", {}, [ E("strong", {}, [ "Tiempo conectado: " ]), fmtDuration(summary.wwanUptime) ])
				])
			]),
			E("div", { "class": "cbi-section", "style": "margin: 0;" }, [
				E("h3", {}, [ "Puertos" ]),
				E("div", {
					"style": "display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 0.75rem;"
				}, [
					portBadge("LAN", summary.portState.lan),
					portBadge("WAN", summary.portState.wan),
					portBadge("WAN6", summary.portState.wan6),
					portBadge("WWAN", summary.portState.wwan)
				])
			])
		]),
		sectionTable("Informacion general", [
			statRow("Router", summary.chipName),
			statRow("Operador", summary.operator),
			statRow("Tecnologia", summary.technology),
			statRow("Carrier aggregation", summary.carrierAggregation),
			statRow("SIM", summary.simStatus),
			statRow("ICCID", summary.simId),
			statRow("Ruta activa", summary.activeRoute),
			statRow("DNS", summary.dnsServers)
		]),
		sectionTable("Senal", [
			progressRow("CSQ", summary.csq, "", "csq"),
			progressRow("RSSI", summary.rssi, " dBm", "rssi"),
			progressRow("RSRP", summary.rsrp, " dBm", "rsrp"),
			progressRow("RSRQ", summary.rsrq, " dB", "rsrq"),
			progressRow("SINR", summary.sinr, " dB", "sinr")
		]),
		sectionTable("Temperaturas", [
			statRow("CPU", summary.cpuTemp ? summary.cpuTemp + " C" : "-"),
			statRow("WiFi 2.4 GHz", summary.wifi2gTemp ? summary.wifi2gTemp + " C" : "-"),
			statRow("WiFi 5 GHz", summary.wifi5gTemp ? summary.wifi5gTemp + " C" : "-")
		])
	]);
}

function makeTabs(sections, initialName) {
	var nav = E("div", { "style": "display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;" });
	var content = E("div");
	var active = initialName;

	function render() {
		nav.innerHTML = "";
		content.innerHTML = "";

		sections.forEach(function(section) {
			var selected = section.name === active;
			var btn = E("button", {
				"class": "btn cbi-button " + (selected ? "cbi-button-positive" : ""),
				"click": function(ev) {
					ev.preventDefault();
					active = section.name;
					render();
				}
			}, [ section.title ]);

			nav.appendChild(btn);
		});

		sections.forEach(function(section) {
			var panel = E("div", {
				"style": section.name === active ? "" : "display:none;"
			}, [ section.node ]);
			content.appendChild(panel);
		});
	}

	render();

	return E("div", {}, [ nav, content ]);
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct("/usr/bin/p2modemctl", [ "status" ], "text"), ""),
			uci.load("p2modem")
		]);
	},
	queueApplyMode: function(mode) {
		if (!mode)
			return Promise.resolve();

		var shellcmd = "nohup /usr/bin/p2modemctl apply-mode " + mode + " >/tmp/p2modem-apply.log 2>&1 &";
		return fs.exec_direct("/bin/sh", [ "-c", shellcmd ], "text");
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
			return Promise.all([
				this.queueApplyMode(wanMode),
				this.queueApplyMode(ratMode)
			]);
		}, this)).then(function() {
			return ui.changes.apply(mode === "0");
		});
	},
	handleAction: function(action, extra) {
		var args = [ action ];
		if (extra)
			args.push(extra);

		return fs.exec_direct("/usr/bin/p2modemctl", args, "text").then(function(res) {
			ui.showModal(_("P2 Modem: %s").format(action), [
				E("pre", { "style": "white-space: pre-wrap" }, [ res || _("No output") ]),
				E("div", { "class": "right" }, [ E("button", { "class": "btn", "click": ui.hideModal }, [ _("Close") ]) ])
			]);
		}).catch(function(err) {
			ui.addNotification(null, E("p", err.message || err));
		});
	},
	render: function(data) {
		var status = data[0] || "";
		var summary = summarizeStatus(status);
		var currentMode = uci.get("p2modem", "main", "wan_mode") || "sim-primary";
		var currentRat = uci.get("p2modem", "main", "rat_pref") || "auto";
		var m = new form.Map("p2modem", _("P2 Modem"), _("Gestion del modem interno del Cudy P2 con estadisticas visuales, configuracion del enlace movil y estado detallado para diagnostico."));
		var s = m.section(form.TypedSection, "settings", _("Configuracion"));
		s.anonymous = true;
		s.addremove = false;
		var o;

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
			var headerActions = E("div", { "class": "cbi-page-actions" }, [
				E("button", { "class": "btn cbi-button cbi-button-action important", "click": ui.createHandlerFn(this, "handleAction", "connect") }, [ _("Connect SIM") ]),
				" ",
				E("button", { "class": "btn cbi-button cbi-button-action", "click": ui.createHandlerFn(this, "handleAction", "disconnect") }, [ _("Disconnect SIM") ]),
				" ",
				E("button", { "class": "btn cbi-button", "click": ui.createHandlerFn(this, "handleAction", "status") }, [ _("Refresh status") ])
			]);
			var rawPanel = E("div", { "class": "cbi-section" }, [
				E("h3", {}, [ _("Estado detallado") ]),
				E("pre", {
					"style": "white-space: pre-wrap; max-height: 26rem; overflow: auto; margin-top: 0.5rem;"
				}, [ status || _("No status available") ])
			]);
			var tabs = makeTabs([
				{ name: "stats", title: _("Stats"), node: statsPanel(summary) },
				{ name: "config", title: _("Configuracion"), node: nodes },
				{ name: "raw", title: _("Raw status"), node: rawPanel }
			], "stats");

			return E("div", {}, [ headerActions, tabs ]);
		}, this));
	}
});
