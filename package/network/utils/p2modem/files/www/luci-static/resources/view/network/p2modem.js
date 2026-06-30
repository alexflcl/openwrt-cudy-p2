"use strict";
"require view";
"require form";
"require fs";
"require ui";
"require uci";

function modeInfo(mode) {
	if (mode === 'wan-primary')
		return 'WAN=10 / SIM=20 / DNS por WAN';
	if (mode === 'wan-as-lan')
		return 'SIM=10 / WAN puenteado a LAN';
	return 'SIM=10 / WAN=30 / DNS por SIM';
}

function ratInfo(mode) {
	if (mode === '4g')
		return 'Solo 4G/LTE';
	if (mode === '5g')
		return 'Preferencia 5G';
	return 'Automatico';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(fs.exec_direct('/usr/bin/p2modemctl', [ 'status' ], 'text'), ''),
			uci.load('p2modem')
		]);
	},
	handleAction: function(action, extra) {
		var args = [ action ];
		if (extra)
			args.push(extra);

		if (action === 'apply-mode') {
			var mode = extra || 'sim-primary';
			var shellcmd = 'nohup /usr/bin/p2modemctl apply-mode ' + mode + ' >/tmp/p2modem-apply.log 2>&1 &';
			return fs.exec_direct('/bin/sh', [ '-c', shellcmd ], 'text').then(function() {
				ui.showModal(_('P2 Modem'), [
					E('p', _('Cambio lanzado en segundo plano. Espera 10-20 segundos y pulsa "Refresh status".')),
					E('div', { 'class': 'right' }, [ E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ]) ])
				]);
			}).catch(function(err) {
				ui.addNotification(null, E('p', err.message || err));
			});
		}

		return fs.exec_direct('/usr/bin/p2modemctl', args, 'text').then(function(res) {
			ui.showModal(_('P2 Modem: %s').format(action), [
				E('pre', { 'style': 'white-space: pre-wrap' }, [ res || _('No output') ]),
				E('div', { 'class': 'right' }, [ E('button', { 'class': 'btn', 'click': ui.hideModal }, [ _('Close') ]) ])
			]);
		}).catch(function(err) {
			ui.addNotification(null, E('p', err.message || err));
		});
	},
	render: function(data) {
		var status = data[0] || '';
		var currentMode = uci.get('p2modem', 'main', 'wan_mode') || 'sim-primary';
		var currentRat = uci.get('p2modem', 'main', 'rat_pref') || 'auto';
		var m = new form.Map('p2modem', _('P2 Modem'), _('Configura el modem interno del Cudy P2, el comportamiento WAN/LAN y el modo radio 4G/5G. Para aplicar un cambio usa su boton correspondiente.'));
		var s = m.section(form.TypedSection, 'settings', _('Ajustes'));
		s.anonymous = true;
		s.addremove = false;
		var o;
		o = s.option(form.Flag, 'enabled', _('Activado en arranque')); o.default = '1';
		o = s.option(form.Value, 'apn', _('APN')); o.placeholder = 'internet'; o.rmempty = false;
		o = s.option(form.ListValue, 'pdp_type', _('Tipo PDP')); o.value('IP'); o.value('IPV4V6'); o.default = 'IP';
		o = s.option(form.Value, 'at_port', _('Puerto AT')); o.placeholder = '/dev/stty_nr31';
		o = s.option(form.Value, 'data_if', _('Interfaz de datos')); o.placeholder = 'pcie0';
		o = s.option(form.Value, 'dummy_if', _('Interfaz dummy')); o.placeholder = 'sipa_dummy0';
		o = s.option(form.Value, 'wwan_iface', _('Interfaz OpenWrt')); o.placeholder = 'wwan';
		o = s.option(form.DummyValue, '_metric_info', _('Prioridad efectiva'));
		o.cfgvalue = function() { return modeInfo(currentMode); };
		o = s.option(form.DummyValue, '_port_info', _('Puertos fisicos'));
		o.cfgvalue = function() {
			return currentMode === 'wan-as-lan' ? 'LAN + WAN unidos al bridge LAN' : 'Solo LAN en bridge; WAN separado';
		};
		o = s.option(form.ListValue, 'wan_mode', _('Modo del puerto WAN'));
		o.value('sim-primary', _('SIM principal, WAN secundaria'));
		o.value('wan-primary', _('WAN principal, SIM secundaria'));
		o.value('wan-as-lan', _('WAN como puerto LAN'));
		o.default = 'sim-primary';
		o = s.option(form.ListValue, 'rat_pref', _('Modo radio'));
		o.value('auto', _('Automatico'));
		o.value('4g', _('Solo 4G'));
		o.value('5g', _('Preferir 5G'));
		o.default = 'auto';
		o = s.option(form.DummyValue, '_rat_info', _('Radio efectiva'));
		o.cfgvalue = function() { return ratInfo(currentRat); };
		return m.render().then(L.bind(function(nodes) {
			var modeSelect = nodes.querySelector('select[id*="wan_mode"]');
			var ratSelect = nodes.querySelector('select[id*="rat_pref"]');
			nodes.appendChild(E('div', { 'class': 'cbi-page-actions' }, [
				E('button', { 'class': 'btn cbi-button cbi-button-action important', 'click': ui.createHandlerFn(this, 'handleAction', 'connect') }, [ _('Connect SIM') ]),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-action', 'click': ui.createHandlerFn(this, 'handleAction', 'disconnect') }, [ _('Disconnect SIM') ]),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-positive important', 'click': ui.createHandlerFn(this, function() { return this.handleAction('apply-mode', modeSelect ? modeSelect.value : 'sim-primary'); }) }, [ _('Apply WAN mode') ]),
				' ',
				E('button', { 'class': 'btn cbi-button cbi-button-positive', 'click': ui.createHandlerFn(this, function() { return this.handleAction('apply-mode', ratSelect ? ratSelect.value : 'auto'); }) }, [ _('Apply radio mode') ]),
				' ',
				E('button', { 'class': 'btn cbi-button', 'click': ui.createHandlerFn(this, 'handleAction', 'status') }, [ _('Refresh status') ])
			]));
			nodes.appendChild(E('div', { 'class': 'cbi-section' }, [ E('h3', {}, [ _('Current status') ]), E('pre', { 'style': 'white-space: pre-wrap' }, [ status || _('No status available') ]) ]));
			return nodes;
		}, this));
	}
});
