"use strict";
"require view";
"require dom";
"require form";
"require fs";
"require ui";
"require uci";

function statusValue(status, key, fallback) {
	var match = status.match(new RegExp('^' + key + '=(.*)$', 'm'));
	return match ? match[1] : (fallback || '-');
}

function modeInfo(mode) {
	if (mode === 'wan-primary')
		return 'WAN=10 / SIM=20';
	if (mode === 'wan-as-lan')
		return 'SIM=10 / WAN unido a LAN';
	return 'SIM=10 / WAN=30';
}

function ratInfo(mode) {
	if (mode === '4g')
		return 'Solo 4G/LTE';
	if (mode === '5g')
		return 'Preferencia 5G';
	return 'Automatico';
}

function setText(id, value) {
	var node = document.getElementById(id);
	if (node)
		node.textContent = value || '-';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/bin/p2modemctl', [ 'status' ], 'text'), ''),
			uci.load('p2modem')
		]);
	},

	queueApplyMode: function(mode) {
		return mode ? fs.exec_direct('/usr/bin/p2modemctl', [ 'apply-mode', mode ], 'text') : Promise.resolve();
	},

	readSelectedMode: function(name, fallback) {
		var el = document.querySelector('select[id*="' + name + '"]');
		return el ? el.value : fallback;
	},

	handleSave: function() {
		var tasks = [];

		document.getElementById('maincontent').querySelectorAll('.cbi-map').forEach(function(map) {
			tasks.push(dom.callClassMethod(map, 'save'));
		});

		return Promise.all(tasks);
	},

	handleSaveApply: function(ev, mode) {
		var wanMode = this.readSelectedMode('wan_mode', 'sim-primary');
		var ratMode = this.readSelectedMode('rat_pref', 'auto');

		return this.handleSave(ev).then(L.bind(function() {
			return Promise.all([
				this.queueApplyMode(wanMode),
				this.queueApplyMode(ratMode)
			]);
		}, this)).then(function() {
			return ui.changes.apply(mode === '0');
		});
	},

	showAction: function(action) {
		return fs.exec_direct('/usr/bin/p2modemctl', [ action ], 'text').then(function(res) {
			ui.showModal(_('P2 Modem: %s').format(action), [
				E('pre', { 'style': 'white-space: pre-wrap' }, [ res || _('No output') ]),
				E('div', { 'class': 'right' }, [
					E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
				])
			]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', err.message || err));
		});
	},


	parseSms: function(output) {
		var messages = [];
		var current = null;

		(output || '').replace(/\r/g, '').split('\n').forEach(function(line) {
			var match = line.match(/^\+CMGL:\s*(\d+),"([^"]*)","([^"]*)".*,"([^"]*)"\s*$/);

			if (match) {
				if (current)
					messages.push(current);
				current = {
					index: match[1],
					status: match[2],
					sender: match[3],
					date: match[4],
					body: []
				};
			}
			else if (current && line && line !== 'OK' && !/^AT\+CMGL/.test(line)) {
				current.body.push(line);
			}
		});

		if (current)
			messages.push(current);

		return messages;
	},


	deleteSms: function(message) {
		ui.showModal(_('Borrar SMS'), [
			E('p', {}, [ _('Se borrara el SMS %s de %s. Esta accion no se puede deshacer.').format(message.index, message.sender || _('Unknown')) ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Cancel') ]),
				' ',
				E('button', {
					'class': 'btn cbi-button-negative',
					'click': L.bind(function() {
						ui.hideModal();
						return fs.exec_direct('/usr/bin/p2modemctl', [ 'sms-delete', message.index ], 'text').then(L.bind(function() {
							this.refreshSms();
						}, this));
					}, this)
				}, [ _('Borrar') ])
			])
		]);
	},

	showSms: function(message) {
		ui.showModal(_('SMS de %s').format(message.sender || _('Unknown')), [
			E('dl', { 'class': 'cbi-value-field' }, [
				E('dt', {}, [ _('Estado') ]), E('dd', {}, [ message.status || '-' ]),
				E('dt', {}, [ _('Fecha') ]), E('dd', {}, [ message.date || '-' ])
			]),
			E('pre', { 'style': 'white-space:pre-wrap;max-height:24rem;overflow:auto' },
				[ message.body.join('\n') || _('Empty message') ]),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ])
			])
		]);
	},

	refreshSms: function() {
		var output = document.getElementById('p2modem-sms-output');

		if (output)
			output.textContent = _('Leyendo SMS de la SIM...');

		return fs.exec_direct('/usr/bin/p2modemctl', [ 'sms-cache' ], 'text').then(L.bind(function(res) {
			var messages = this.parseSms(res || '');
			var rows;

			if (!messages.length) {
				output.textContent = _('Bandeja vacia o sincronizandose. El servicio comprueba la SIM cada 30 segundos.');
				return;
			}

			rows = messages.map(L.bind(function(message) {
				return E('tr', {}, [
					E('td', {}, [ message.index ]),
					E('td', {}, [ message.status || '-' ]),
					E('td', {}, [ message.sender || '-' ]),
					E('td', {}, [ message.date || '-' ]),
					E('td', {}, [ (message.body.join(' ') || '-').slice(0, 72) ]),
					E('td', {}, [
						E('button', {
							'class': 'btn cbi-button',
							'click': L.bind(this.showSms, this, message)
						}, [ _('Leer') ]),
						' ',
						E('button', {
							'class': 'btn cbi-button-negative',
							'click': L.bind(this.deleteSms, this, message)
						}, [ _('Borrar') ])
					])
				]);
			}, this));

			dom.content(output, E('table', { 'class': 'table cbi-section-table' }, [
				E('thead', {}, [
					E('tr', { 'class': 'tr table-titles' }, [
						E('th', { 'class': 'th' }, [ '#' ]),
						E('th', { 'class': 'th' }, [ _('Estado') ]),
						E('th', { 'class': 'th' }, [ _('Remitente') ]),
						E('th', { 'class': 'th' }, [ _('Fecha') ]),
						E('th', { 'class': 'th' }, [ _('Vista previa') ]),
						E('th', { 'class': 'th' }, [ '' ])
					])
				]),
				E('tbody', {}, rows)
			]));
		}, this)).catch(function(err) {
			if (output)
				output.textContent = err.message || String(err);
		});
	},

	updateAdvancedStats: function(output) {
		var operator = output.match(/\+COPS:\s*\d+,\d+,"([^"]+)"/);
		var technology = output.match(/\+QNWINFO:\s*"([^"]+)"/);
		var address = output.match(/\+CGPADDR:\s*1,"([^"]+)"/);

		if (operator)
			setText('p2modem-stat-operator', operator[1]);
		if (technology)
			setText('p2modem-stat-technology', technology[1]);
		if (address)
			setText('p2modem-stat-ip', address[1]);
	},

	refreshDetails: function() {
		var output = document.getElementById('p2modem-raw-output');

		if (output)
			output.textContent = _('Consultando modem...');

		return fs.exec_direct('/usr/bin/p2modemctl', [ 'details' ], 'text').then(L.bind(function(res) {
			if (output)
				output.textContent = res || _('No output');
			this.updateAdvancedStats(res || '');
		}, this)).catch(function(err) {
			if (output)
				output.textContent = err.message || String(err);
		});
	},

	render: function(data) {
		var status = data[0] || '';
		var currentMode = uci.get('p2modem', 'main', 'wan_mode') || 'sim-primary';
		var currentRat = uci.get('p2modem', 'main', 'rat_pref') || 'auto';
		var wwanUp = /"up":\s*true/.test(status) ? _('Conectada') : _('Desconectada');
		var m = new form.Map('p2modem', _('P2 Modem'),
			_('Gestion del modem interno por PCIe. La telemetria AT avanzada se consulta solo desde Raw status.'));
		var s = m.section(form.NamedSection, 'main', 'main', _('Configuracion'));
		var o;

		s.addremove = false;
		o = s.option(form.Flag, 'enabled', _('Activado en arranque')); o.default = '1';
		o = s.option(form.Value, 'apn', _('APN')); o.placeholder = _('Detect from modem profile'); o.rmempty = true;
		o = s.option(form.ListValue, 'pdp_type', _('Tipo PDP')); o.value('IP', _('IPv4')); o.value('IPV4V6', _('IPv4/IPv6')); o.default = 'IP';
		o = s.option(form.Value, 'at_port', _('Puerto AT')); o.placeholder = '/dev/stty_nr31';
		o = s.option(form.Value, 'data_if', _('Interfaz de datos')); o.placeholder = 'pcie0';
		o = s.option(form.Value, 'dummy_if', _('Interfaz dummy')); o.placeholder = 'sipa_dummy0';
		o = s.option(form.Value, 'wwan_iface', _('Interfaz OpenWrt')); o.placeholder = 'wwan';
		o = s.option(form.ListValue, 'wan_mode', _('Modo WAN'));
		o.value('sim-primary', _('SIM principal, WAN secundaria'));
		o.value('wan-primary', _('WAN principal, SIM secundaria'));
		o.value('wan-as-lan', _('SIM principal, WAN como LAN'));
		o.default = 'sim-primary';
		o = s.option(form.DummyValue, '_metric_info', _('Prioridad efectiva'));
		o.cfgvalue = function() { return modeInfo(currentMode); };
		o = s.option(form.ListValue, 'rat_pref', _('Modo radio'));
		o.value('auto', _('Automatico'));
		o.value('4g', _('Solo 4G'));
		o.value('5g', _('Preferir 5G'));
		o.default = 'auto';
		o = s.option(form.DummyValue, '_rat_info', _('Radio efectiva'));
		o.cfgvalue = function() { return ratInfo(currentRat); };

		return m.render().then(L.bind(function(configForm) {
			var stats = E('div', { 'id': 'p2modem-stats' }, [
				E('h2', {}, [ _('Resumen') ]),
				E('dl', { 'class': 'cbi-value-field' }, [
					E('dt', {}, [ _('Router') ]), E('dd', {}, [ 'Cudy P2 v1' ]),
					E('dt', {}, [ _('PCIe datos') ]), E('dd', {}, [ statusValue(status, 'pcie_data') ]),
					E('dt', {}, [ _('Puerto AT') ]), E('dd', {}, [ statusValue(status, 'at_port') ]),
					E('dt', {}, [ _('WWAN') ]), E('dd', {}, [ wwanUp ]),
					E('dt', {}, [ _('Operador') ]), E('dd', { 'id': 'p2modem-stat-operator' }, [ '-' ]),
					E('dt', {}, [ _('Tecnologia') ]), E('dd', { 'id': 'p2modem-stat-technology' }, [ '-' ]),
					E('dt', {}, [ _('IP WWAN') ]), E('dd', { 'id': 'p2modem-stat-ip' }, [ '-' ]),
					E('dt', {}, [ _('Numero SIM') ]), E('dd', {}, [ statusValue(status, 'sim_number') ])
				]),
				E('h3', {}, [ _('Temperaturas') ]),
				E('dl', { 'class': 'cbi-value-field' }, [
					E('dt', {}, [ _('CPU') ]), E('dd', {}, [ statusValue(status, 'cpu') ]),
					E('dt', {}, [ _('WiFi 2.4 GHz') ]), E('dd', {}, [ statusValue(status, 'wifi_2g') ]),
					E('dt', {}, [ _('WiFi 5 GHz') ]), E('dd', {}, [ statusValue(status, 'wifi_5g') ])
				]),
				E('p', { 'class': 'cbi-value-description' }, [
					_('Pulsa Refresh status en Raw status para consultar operador, tecnologia, IP y diagnostico AT.')
				])
			]);

			var config = E('div', { 'id': 'p2modem-config', 'style': 'display:none' }, [
				configForm,
				E('div', { 'class': 'cbi-page-actions' }, [
					E('button', {
						'class': 'btn cbi-button cbi-button-action important',
						'click': ui.createHandlerFn(this, 'showAction', 'connect')
					}, [ _('Connect SIM') ]),
					' ',
					E('button', {
						'class': 'btn cbi-button cbi-button-action',
						'click': ui.createHandlerFn(this, 'showAction', 'disconnect')
					}, [ _('Disconnect SIM') ])
				])
			]);

			var raw = E('div', { 'id': 'p2modem-raw', 'style': 'display:none' }, [
				E('p', {}, [
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.createHandlerFn(this, 'refreshDetails')
					}, [ _('Refresh status') ])
				]),
				E('details', { 'open': 'open', 'class': 'cbi-section' }, [
					E('summary', { 'style': 'cursor:pointer;font-weight:bold' }, [ _('Current status') ]),
					E('pre', {
						'id': 'p2modem-raw-output',
						'style': 'white-space:pre-wrap;max-height:30rem;overflow:auto;margin-top:0.75rem'
					}, [ status || _('No status available') ])
				])
			]);


			var sms = E('div', { 'id': 'p2modem-sms', 'style': 'display:none' }, [
				E('p', { 'class': 'cbi-value-description' }, [
					_('La bandeja se sincroniza en RAM cada 30 segundos. La SIM solo se lee completa cuando cambia el numero de mensajes.')
				]),
				E('p', {}, [
					E('button', {
						'class': 'btn cbi-button',
						'click': ui.createHandlerFn(this, 'refreshSms')
					}, [ _('Actualizar bandeja') ])
				]),
				E('div', { 'id': 'p2modem-sms-output' }, [
					_('Pulsa Actualizar SMS para consultar los mensajes almacenados en la SIM.')
				])
			]);

			var panels = {
				stats: stats,
				config: config,
				raw: raw,
				sms: sms
			};

			var smsTimer = null;

			function selectTab(name) {
				Object.keys(panels).forEach(function(key) {
					panels[key].style.display = key === name ? '' : 'none';
					var button = document.getElementById('p2modem-tab-' + key);
					if (button)
						button.classList.toggle('cbi-button-positive', key === name);
				});
				if (smsTimer) {
					window.clearInterval(smsTimer);
					smsTimer = null;
				}
				if (name === 'sms') {
					this.refreshSms();
					smsTimer = window.setInterval(L.bind(this.refreshSms, this), 10000);
				}
			}

			var tabs = E('div', { 'class': 'cbi-page-actions', 'style': 'margin-bottom:1rem' }, [
				E('button', { 'id': 'p2modem-tab-stats', 'class': 'btn cbi-button cbi-button-positive', 'click': function() { selectTab('stats'); } }, [ _('Stats') ]),
				' ',
				E('button', { 'id': 'p2modem-tab-config', 'class': 'btn cbi-button', 'click': function() { selectTab('config'); } }, [ _('Configuracion') ]),
				' ',
				E('button', { 'id': 'p2modem-tab-raw', 'class': 'btn cbi-button', 'click': function() { selectTab('raw'); } }, [ _('Raw status') ]),
				' ',
				E('button', { 'id': 'p2modem-tab-sms', 'class': 'btn cbi-button', 'click': function() { selectTab('sms'); } }, [ _('SMS') ])
			]);

			return E([], [ tabs, stats, config, raw, sms ]);
		}, this));
	}
});
