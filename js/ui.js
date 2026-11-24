/* Renderizado e interacción. Lee el estado de W4.Game; nunca modifica reglas directamente. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U, G = W4.Game, W = W4.World, SAT = W4.Saturno, M = W4.Missions, PE = W4.Persist, EV = W4.Events, AU = W4.Audio, T = W4.Tactical;
  var esc = U.esc, LBL = SAT.LABEL;
  var $ = function (id) { return document.getElementById(id); };

  var UI = { screen: 'menu', tab: 'map', selNode: null, modal: null, tacMode: 'move', tacPreview: null, inspect: '', target: null, _prev: null };

  var HELP = {
    vis: ['Visibilidad', 'Cuánto sabe SATURNO de tu actividad actual (0-100). Con 40 o más tu sospecha sube más rápido. Con 70 te cazan y pueden interceptarte al entrar a un nodo. Con 100 quedas neutralizado. Refugios, SIM Fantasma y enfoques silenciosos la reducen.'],
    div: ['Divergencia', 'Cuánto se aparta tu conducta de lo que SATURNO predijo. Sube cuando una predicción confiada falla y baja cuando acierta. Con 60 o más el modelo no es fiable: SATURNO te ve peor y ganas 1 PA extra al inicio de cada misión. Pasando 80, cada sorpresa también sube la Visibilidad.'],
    noise: ['Ruido', 'Señal incontrolada e influencia humana independiente. Debilita las contramedidas y la confianza de SATURNO. Gasta 20 para abrir un canal alterno que salte un nodo, o 10 para tráfico de cobertura en un refugio. Liberación necesita tenerlo acumulado.'],
    energy: ['Energía', 'Se gasta para escanear nodos y lanzar misiones. Recuperas 2 después de cada nodo. Los refugios y las raciones restauran más.'],
    integ: ['Integridad', 'Qué tan intacta está tu identidad. Las misiones fallidas y neutralizar patrullas la dañan. En cero tus credenciales colapsan y termina la partida.'],
    trust: ['Confianza', 'Se gana ayudando a la gente. Se gasta para cobrar favores de contactos o cambiar de identidad. Reforma la necesita.'],
    evid: ['Evidencia', 'La verificada vale doble. Hackeo y las terminales comprometidas dan copias verificadas; el Sigilo da copias sin verificar, que puedes verificar tú por 1 de energía. Exposición la necesita.']
  };
  var TYPE_RISK = {
    investigation: 'Fallar: sube la Visibilidad y se daña la Integridad.', infiltration: 'Fallar: daño fuerte a la Integridad.',
    social: 'Desconocidas. La gente tiene agendas.', resource: 'Desconocidas. Las ofertas traen condiciones.',
    safehouse: 'Ninguna. Un lugar seguro para recuperarte.', disruption: 'Ruidoso: sube la Visibilidad, acumula Ruido.',
    highrisk: 'Severas. Muy vigilado.', elite: 'SATURNO responde. Vencer borra la mitad de su modelo sobre ti.',
    gateway: 'Fallar te obliga a cruzar igualmente, a un alto precio.'
  };
  var OBJ_PREVIEW = {
    investigation: 'Recuperar evidencia y extraer.', infiltration: 'Comprometer una terminal, recuperar evidencia y extraer.',
    disruption: 'Instalar un relé y extraer.', highrisk: 'Comprometer una terminal, recuperar 2 evidencias y extraer.',
    elite: 'Destruir 2 núcleos de SATURNO y extraer.', gateway: 'Comprometer la terminal de la puerta y extraer.'
  };
  var CM_TEXT = { stealth: 'cámaras adicionales', hack: 'procesos de monitoreo junto a la terminal', direct: 'patrullas adicionales' };
  var HINTS = [
    ['map1', function (s) { return s.phase === 'map' && s.stats.nodes === 0; },
      'Elige un nodo del mapa. Las recompensas y la amenaza exacta están ocultas hasta que lo escanees (1 de energía, gratis en Clearnet). Cada nodo que visitas también le enseña algo a SATURNO sobre ti.'],
    ['op1', function (s) { return s.cur && s.cur.kind === 'op' && s.cur.stage === 'brief'; },
      'Antes de entrar eliges un enfoque. Sigilo: silencioso y con más señuelos. Hackeo: terminales rápidas, evidencia verificada. Directo: más PA y puedes neutralizar patrullas, pero hace ruido. Cada enfoque es también lo que SATURNO intenta predecir.'],
    ['tac1', function (s) { return s.cur && s.cur.stage === 'tac'; },
      'Toca una celda para moverte (gasta 1 PA por celda). Las zonas rojas son conos de visión: te detectan cuando termina el turno enemigo y estás dentro. Las cámaras giran cada turno. Escóndete en coberturas, usa señuelos y llega a la salida (X).'],
    ['forecast', function (s) { return s.cur && s.cur.kind === 'op' && s.cur.stage === 'brief' && s.saturno.n >= 2; },
      'SATURNO predice tu enfoque según tus hábitos. Cuando está seguro prepara una contramedida: más unidades justo contra ese enfoque. Cambia de enfoque, usa un Inhibidor de Señal o alimenta su modelo con un Guion Señuelo.'],
    ['div1', function (s) { return s.res.div > 0 && s.phase === 'map'; },
      'La Divergencia subió porque SATURNO esperaba otra cosa. Crea un hábito, deja que se confíe y luego rómpelo: ahí la Divergencia crece más rápido.'],
    ['safe1', function (s) { return s.cur && s.cur.kind === 'safe' && !s.cur.result; },
      'Los refugios restauran energía y bajan la Visibilidad. Cambiar de identidad hace que SATURNO olvide un cuarto de lo que sabe, pero cuesta Confianza.'],
    ['finale1', function (s) { return s.cur && s.cur.kind === 'finale' && !s.cur.result; },
      'Cada desenlace tiene sus requisitos. Las barras muestran qué tan cerca estás. Un desenlace oculto aparece solo cuando has divergido lo suficiente.']
  ];

  /* ---------- auxiliares ---------- */
  function toast(msg) {
    var t = $('toast'); if (!t) return;
    t.textContent = msg; t.className = 'show';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.className = ''; }, 2600);
  }
  function pct(v) { return Math.round(v * 100); }
  function bar(v, max, cls) { return '<span class="bar ' + (cls || '') + '"><i style="width:' + U.clamp(v / max * 100, 0, 100).toFixed(0) + '%"></i></span>'; }

  var CHIP_LABELS = { vis: 'VIS', div: 'DIV', noise: 'RUIDO', energy: 'ENERGÍA', integ: 'INTEG', trust: 'CONFIANZA', evidence: 'EVIDENCIA' };
  function chipClass(k, v) {
    if (k === 'div') return 'blue';
    var good = k === 'vis' ? v < 0 : v > 0;
    return good ? 'pos' : 'neg';
  }
  function deltaChips(d) {
    if (!d) return '';
    var out = '';
    Object.keys(CHIP_LABELS).forEach(function (k) {
      if (d[k]) out += '<span class="chip ' + chipClass(k, d[k]) + '">' + CHIP_LABELS[k] + ' ' + (d[k] > 0 ? '+' : '') + d[k] + '</span>';
    });
    return out;
  }
  function fxChips(fx) {
    var out = '';
    Object.keys(CHIP_LABELS).forEach(function (k) {
      var v = fx[k]; if (k === 'evidence') v = (fx.evidence || 0) + (fx.evidenceV || 0);
      if (v) out += '<span class="chip ' + chipClass(k, v) + '">' + CHIP_LABELS[k] + ' ' + (v > 0 ? '+' : '') + v + '</span>';
    });
    if (fx.evidenceV) out += '<span class="chip pos">VERIFICADA</span>';
    if (fx.item) out += '<span class="chip pos">HERRAMIENTA</span>';
    if (fx.contact) out += '<span class="chip pos">CONTACTO</span>';
    if (fx.relay) out += '<span class="chip pos">RELÉ</span>';
    if (fx.feed) out += '<span class="chip blue">ENGAÑA A SATURNO</span>';
    if (fx.strike) out += '<span class="chip blue">SATURNO OLVIDA</span>';
    if (fx.mask) out += '<span class="chip pos">MÁSCARA +' + fx.mask + '</span>';
    if (fx.scanAll) out += '<span class="chip pos">REVELA NODOS</span>';
    if (fx.verify) out += '<span class="chip pos">VERIFICA ' + fx.verify + '</span>';
    if (fx.rep) Object.keys(fx.rep).forEach(function (f) { out += '<span class="chip blue">' + G.FACTIONS[f] + ' ' + (fx.rep[f] > 0 ? '+' : '') + fx.rep[f] + '</span>'; });
    return out;
  }
  function wrapName(name) {
    if (name.length <= 15) return [name];
    var words = name.split(' '), best = 1, bd = 99;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' ').length, b = words.slice(i).join(' ').length;
      if (Math.abs(a - b) < bd) { bd = Math.abs(a - b); best = i; }
    }
    return [words.slice(0, best).join(' '), words.slice(best).join(' ')];
  }
  function rewardText(n) {
    var r = n.rewards, p = [];
    if (n.type === 'social' || n.type === 'resource') return 'Un encuentro con una decisión que tomar';
    if (n.type === 'safehouse') return 'Recuperación, nueva identidad o tráfico de cobertura';
    if (n.type === 'gateway') return n.final ? 'El final de la red' : 'Acceso a la siguiente capa';
    if (r.evidence) p.push('evidencia x' + r.evidence);
    if (r.noise) p.push('ruido +' + r.noise);
    if (r.item) p.push('una herramienta');
    if (r.relay) p.push('un relé independiente');
    if (r.strike) p.push('borra la mitad de lo que SATURNO sabe');
    return p.join(', ') || 'poco';
  }
  function threatText(n) {
    if (n.type === 'safehouse') return 'ninguna';
    return n.scanned ? String(n.threat) : (n.thrLo === n.thrHi ? String(n.thrLo) : n.thrLo + '-' + n.thrHi) + ' (estimada)';
  }

  /* ---------- HUD y navegación ---------- */
  function renderHud(s) {
    var r = s.res;
    function res(k, label, v, max, cls) {
      return '<button class="res ' + k + ' ' + (cls || '') + '" data-act="help" data-k="' + k + '" aria-label="' + label + ' ' + Math.round(v) + '">' +
        '<span class="rk">' + label + '</span>' + bar(v, max, cls) + '<span class="rv">' + Math.round(v) + (k === 'energy' ? '/' + max : '') + '</span></button>';
    }
    var visCls = r.vis >= 70 ? 'danger' : (r.vis >= 40 ? 'warn' : '');
    $('hud').innerHTML = res('vis', 'VIS', r.vis, 100, visCls) + res('div', 'DIV', r.div, 100, '') + res('noise', 'RUIDO', r.noise, 100, '') +
      res('energy', 'ENERG', r.energy, r.maxEnergy, '') + res('integ', 'INTEG', r.integ, 100, r.integ <= 30 ? 'danger' : '') +
      '<button class="res mini" data-act="help" data-k="trust"><span class="rk">CONF</span><span class="rv">' + r.trust + '</span></button>' +
      '<button class="res mini" data-act="help" data-k="evid"><span class="rk">EVID</span><span class="rv">' + G.evidenceWeight(s) + '</span></button>' +
      '<button class="res mini menu-btn" data-act="gomenu" aria-label="Menú">MENÚ</button>';
    $('hud').hidden = false;
    var cur = { vis: r.vis, div: r.div, noise: r.noise, energy: r.energy, integ: r.integ };
    if (UI._prev) Object.keys(cur).forEach(function (k) {
      var a = Math.round(cur[k]), b = Math.round(UI._prev[k]);
      if (a === b) return;
      var up = a > b, good = k === 'vis' ? !up : up, el = $('hud').querySelector('.res.' + k);
      if (el) el.classList.add(good ? 'flash-good' : 'flash-bad');
    });
    UI._prev = cur;
  }
  var TABS = [['map', 'Mapa'], ['intel', 'SATURNO'], ['status', 'Operativo'], ['contacts', 'Contactos'], ['evidence', 'Evidencia'], ['log', 'Registro']];
  function renderNav(s) {
    $('nav').innerHTML = TABS.map(function (t) {
      var extra = '';
      if (t[0] === 'contacts' && s.contacts.some(function (c) { return !c.used; }) && s.res.trust >= 1) extra = ' <i class="dot"></i>';
      if (t[0] === 'evidence' && s.evidence.some(function (e) { return !e.verified; })) extra = ' <i class="dot"></i>';
      return '<button class="tab' + (UI.tab === t[0] ? ' on' : '') + '" data-act="tab" data-k="' + t[0] + '">' + t[1] + extra + '</button>';
    }).join('');
    $('nav').hidden = false;
  }
  function hintHtml(s) {
    var meta = G.meta;
    if (!meta.settings.hints) return '';
    for (var i = 0; i < HINTS.length; i++) {
      var h = HINTS[i];
      if (meta.hintsSeen.indexOf(h[0]) >= 0) continue;
      if (h[1](s)) return '<div class="hint"><b>Instrucciones</b><p>' + esc(h[2]) + '</p><button class="btn small" data-act="hint" data-k="' + h[0] + '">Entendido</button></div>';
    }
    return '';
  }

  /* ---------- mapa ---------- */
  function nodeShape(type, r, cls) {
    var c = 'nd ' + cls;
    switch (type) {
      case 'safehouse': return '<rect class="' + c + '" x="' + (-r) + '" y="' + (-r) + '" width="' + (2 * r) + '" height="' + (2 * r) + '" rx="4"/>';
      case 'gateway': return '<polygon class="' + c + '" points="0,' + (-r * 1.2) + ' ' + (r * 1.2) + ',0 0,' + (r * 1.2) + ' ' + (-r * 1.2) + ',0"/>';
      case 'elite': var pts = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i + Math.PI / 6; pts.push((Math.cos(a) * r * 1.15).toFixed(1) + ',' + (Math.sin(a) * r * 1.15).toFixed(1)); } return '<polygon class="' + c + '" points="' + pts.join(' ') + '"/>';
      case 'highrisk': return '<polygon class="' + c + '" points="0,' + (-r * 1.15) + ' ' + (r * 1.1) + ',' + (r * 0.85) + ' ' + (-r * 1.1) + ',' + (r * 0.85) + '"/>';
      default: return '<circle class="' + c + '" r="' + r + '"/>';
    }
  }
  function layout(n, vertical) {
    var cross = n.col === 0 || n.col === 3 ? 0.5 : (n.row === 0 ? 0.27 : 0.73);
    return vertical ? { x: 320 * cross, y: 52 + n.col * 112 } : { x: 70 + n.col * 167, y: 40 + 190 * cross };
  }
  function displayState(s, n) {
    if (n.status === 'done') return 'done';
    if (s.cur && s.cur.nodeId === n.id) return 'current';
    if (s.availIds.indexOf(n.id) >= 0) return 'avail';
    var refCol = s.cur ? W.getNode(s, s.cur.nodeId).col : (s.lastNodeId ? W.getNode(s, s.lastNodeId).col : -1);
    if (n.col <= refCol) return 'skipped';
    return 'locked';
  }
  var ST_ES = { avail: 'alcanzable', done: 'completado', current: 'actual', skipped: 'omitido', locked: 'fuera de alcance' };
  function mapSvg(s) {
    var L = s.layers[s.layerIdx], vertical = window.innerWidth < 700;
    var svg = '<svg class="map" viewBox="' + (vertical ? '0 0 320 470' : '0 0 640 270') + '" role="group" aria-label="Mapa de la red">';
    var pos = {};
    L.nodes.forEach(function (n) { pos[n.id] = layout(n, vertical); });
    L.nodes.forEach(function (n) {
      n.next.forEach(function (id) {
        var a = pos[n.id], b = pos[id], t = W.getNode(s, id), sa = displayState(s, n);
        var on = (sa === 'done' || sa === 'current') && t && displayState(s, t) === 'avail';
        svg += '<line class="edge' + (on ? ' on' : '') + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"/>';
      });
    });
    L.nodes.forEach(function (n) {
      var p = pos[n.id], st = displayState(s, n), r = vertical ? 24 : 20, sel = UI.selNode === n.id;
      svg += '<g class="node ' + st + (sel ? ' sel' : '') + '" transform="translate(' + p.x + ',' + p.y + ')" data-act="sel" data-k="' + n.id + '" tabindex="0" role="button" aria-label="' + esc(n.name) + ', ' + ST_ES[st] + '">';
      svg += '<circle class="hit" r="' + (r + 14) + '"/>';
      if (n.watch) svg += '<circle class="eye" r="' + (r + 8) + '"/>';
      if (sel) svg += '<circle class="selring" r="' + (r + 5) + '"/>';
      svg += nodeShape(n.type, r, st) + '<text class="glyph" y="5">' + W.TYPE_INFO[n.type].glyph + '</text>';
      var lines = wrapName(n.name), ly = r + 16;
      lines.forEach(function (ln, i) { svg += '<text class="lbl" y="' + (ly + i * 12) + '">' + esc(ln) + '</text>'; });
      if ((st === 'avail' || st === 'current') && n.type !== 'safehouse') {
        var th = n.scanned ? n.threat : (n.thrLo === n.thrHi ? n.thrLo : n.thrLo + '-' + n.thrHi);
        svg += '<text class="thr" y="' + (ly + lines.length * 12) + '">A' + th + (n.watch ? ' +1' : '') + '</text>';
      }
      if (n.watch) svg += '<text class="eyeg" x="' + (r + 4) + '" y="' + (-r) + '">◉</text>';
      svg += '</g>';
    });
    return svg + '</svg>';
  }
  function logHtml(s, n) {
    return '<div class="term">' + s.log.slice(-n).map(function (l) { return '<div class="ll ' + l.k + '"><span>&gt;</span> ' + esc(l.m) + '</div>'; }).join('') + '</div>';
  }
  function nodePanel(s) {
    var n = UI.selNode && W.getNode(s, UI.selNode);
    if (!n || n.layer !== s.layerIdx) return '<div class="panel dim">Selecciona un nodo para inspeccionarlo.</div>';
    var st = displayState(s, n), scanCost = W.layerMods(s).obsFree ? 0 : 1;
    var h = '<div class="panel"><div class="ph"><b>' + esc(n.name) + '</b><span class="tag">' + W.TYPE_INFO[n.type].label + '</span></div>';
    h += '<p class="muted">' + esc(W.TYPE_INFO[n.type].desc) + '</p><dl class="kv">';
    h += '<dt>Amenaza</dt><dd>' + esc(threatText(n)) + '</dd>';
    h += '<dt>Recompensa</dt><dd>' + (n.scanned ? esc(rewardText(n)) : '<span class="hide">desconocida hasta escanear</span>') + '</dd>';
    h += '<dt>Riesgo de Visibilidad</dt><dd>' + M.visRisk(s, n) + '</dd>';
    h += '<dt>Consecuencias</dt><dd>' + esc(TYPE_RISK[n.type]) + '</dd>';
    h += '<dt>Estado</dt><dd>' + ST_ES[st].charAt(0).toUpperCase() + ST_ES[st].slice(1) + '</dd></dl>';
    if (n.watch) h += '<p class="warn-t">◉ SATURNO vigila este nodo: +1 amenaza. Predijo que vendrías aquí.</p>';
    if (st === 'avail') {
      h += '<div class="row"><button class="btn" data-act="scan" data-k="' + n.id + '"' + (n.scanned || s.res.energy < scanCost ? ' disabled' : '') + '>' + (n.scanned ? 'Escaneado' : 'Escanear' + (scanCost ? ' (1 energía)' : ' (gratis)')) + '</button>' +
        '<button class="btn primary" data-act="enter" data-k="' + n.id + '">Entrar al nodo</button></div>';
    }
    return h + '</div>';
  }
  function renderMap(s) {
    var L = W.LAYERS[s.layerIdx], h = hintHtml(s), pips = '';
    for (var i = 0; i < 9; i++) pips += '<i class="pip' + (i < s.layerIdx ? ' done' : i === s.layerIdx ? ' now' : '') + '"></i>';
    h += '<div class="layerhead"><div><b>Capa ' + L.id + ': ' + esc(L.name) + '</b><div class="muted">' + esc(L.focus) + '</div></div><div class="pips">' + pips + '</div></div>';
    h += '<p class="rule"><b>Regla de capa.</b> ' + esc(L.rule) + '</p>';
    if (s.res.vis >= 70) h += '<p class="alert">CACERÍA ACTIVA. Probabilidad de intercepción al entrar a un nodo: ' + Math.round(s.res.vis - 60) + '%.</p>';
    else if (s.res.vis >= 40) h += '<p class="warn-t">Vigilancia: SATURNO te detecta con más facilidad mientras la Visibilidad sea 40 o más.</p>';
    if (s.availIds.length === 1 && !UI.selNode) UI.selNode = s.availIds[0];
    if (UI.selNode && W.getNode(s, UI.selNode) && W.getNode(s, UI.selNode).layer !== s.layerIdx) UI.selNode = null;
    h += mapSvg(s);
    var rp = s.routePred;
    if (rp && rp.conf >= 0.25) h += '<p class="sat">Pronóstico de SATURNO: tomarás la ruta ' + (rp.kind === 'safe' ? 'más segura' : 'más riesgosa') + ' (' + pct(rp.conf) + '% de confianza).</p>';
    h += nodePanel(s);
    if (s.lastNodeId && !s.backchannel) h += '<div class="row"><button class="btn" data-act="backchannel"' + (s.res.noise < (s.bcCost || 20) ? ' disabled' : '') + '>Abrir canal alterno (' + (s.bcCost || 20) + ' Ruido)</button><span class="muted small">Salta un nodo por la clandestinidad.</span></div>';
    return h + '<h3>Terminal</h3>' + logHtml(s, 5);
  }

  /* ---------- pantallas de nodo ---------- */
  function resultView(s) {
    var c = s.cur, r = c.result, n = W.getNode(s, c.nodeId);
    var cls = r.outcome === 'fail' ? 'bad' : (r.outcome === 'clean' || r.outcome === 'success' || r.outcome === 'safe' ? 'good' : '');
    var h = '<div class="panel result ' + cls + '"><div class="ph"><b>' + esc(r.title) + '</b>' + (r.turns ? '<span class="tag">' + r.turns + ' turnos</span>' : '') + '</div>';
    h += '<p>' + esc(r.text) + '</p><div class="chips">' + deltaChips(r.fx.d) + '</div>';
    var extra = [];
    if (r.fx.items && r.fx.items.length) extra.push('Obtenido: ' + r.fx.items.join(', '));
    if (r.fx.contact) extra.push('Nuevo contacto: ' + r.fx.contact);
    if (extra.length) h += '<p class="good-t">' + esc(extra.join('. ')) + '.</p>';
    (r.lines || []).forEach(function (l) { h += '<p class="sat">' + esc(l) + '</p>'; });
    if (c.routeObs) h += '<p class="sat">Pronóstico de ruta: SATURNO esperaba una ruta ' + (c.routeObs.predicted === 'safe' ? 'segura' : 'riesgosa') + ' y tomaste una ' + (c.routeObs.actual === 'safe' ? 'segura' : (c.routeObs.actual === 'risky' ? 'riesgosa' : 'intermedia')) + '. ' + (c.routeObs.hit ? 'Acertó.' : 'Falló.') + '</p>';
    var label = (n.type === 'gateway' && !n.final) ? 'Descender a la Capa ' + (s.layerIdx + 1) : 'Continuar';
    return h + '<div class="row"><button class="btn primary" data-act="continue">' + label + '</button></div></div>';
  }
  function itemButtons(s, ctx) {
    var out = '';
    s.items.forEach(function (id, i) {
      var it = G.ITEMS[id];
      if (ctx === 'op' && (id === 'ration' || id === 'ghostsim')) return;
      if (it.param === 'approach') {
        out += '<div class="itemrow"><span><b>' + esc(it.name) + '</b><br><span class="muted small">' + esc(it.desc) + '</span></span><span class="btnset">' +
          SAT.AP.map(function (a) { return '<button class="btn small" data-act="use" data-k="' + i + '" data-p="' + a + '">' + LBL[a] + '</button>'; }).join('') + '</span></div>';
      } else {
        var p = (id === 'sniffer' && UI.selNode) ? ' data-p="' + UI.selNode + '"' : '';
        out += '<div class="itemrow"><span><b>' + esc(it.name) + '</b><br><span class="muted small">' + esc(it.desc) + '</span></span><button class="btn small" data-act="use" data-k="' + i + '"' + p + '>Usar</button></div>';
      }
    });
    return out;
  }
  function scoutReport(s, n) {
    if (!n.scanned) return '<span class="hide">desconocido hasta escanear</span>';
    var m = M.generate(s.seed, n, 'stealth', 0, { vision: 6 }, true, M.effThreat(s, n)), c = { camera: 0, patrol: 0, sentinel: 0 };
    m.enemies.forEach(function (e) { c[e.type]++; });
    if (W.layerMods(s).fog && s.res.noise < 30) {
      var off = (U.hashSeed(n.id + 'fog') % 3) - 1;
      return Math.max(0, c.camera + off) + ' cámaras, ' + Math.max(0, c.patrol - off) + ' patrullas, ' + c.sentinel + ' procesos de monitoreo <span class="hide">(niebla: dato poco fiable)</span>';
    }
    return c.camera + ' cámaras, ' + c.patrol + ' patrullas, ' + c.sentinel + ' procesos de monitoreo';
  }
  function briefView(s) {
    var c = s.cur, n = W.getNode(s, c.nodeId), h = hintHtml(s);
    h += '<div class="panel"><div class="ph"><b>' + esc(n.name) + '</b><span class="tag">' + W.TYPE_INFO[n.type].label + '</span></div>';
    h += '<dl class="kv"><dt>Objetivo</dt><dd>' + esc(OBJ_PREVIEW[n.type] || 'Extraer.') + '</dd>' +
      '<dt>Amenaza</dt><dd>' + (n.scanned ? M.effThreat(s, n) + (n.watch ? ' (vigilado)' : '') : esc(threatText(n))) + '</dd>' +
      '<dt>Defensas</dt><dd>' + scoutReport(s, n) + '</dd>' +
      '<dt>Recompensa</dt><dd>' + (n.scanned ? esc(rewardText(n)) : '<span class="hide">desconocida hasta escanear</span>') + '</dd>' +
      '<dt>Riesgo de Visibilidad</dt><dd>' + M.visRisk(s, n) + '</dd></dl>';
    if (c.intercept) h += '<p class="alert">' + esc(c.intercept) + '</p>';
    var gh = c.ghost ? s.ghosts.filter(function (x) { return x.id === c.ghost; })[0] : null;
    if (gh) { var gpf = PE.ghostProfile(gh); h += '<p class="sat">Eco de una operación anterior (' + esc(gh.name) + ') opera aquí y sustituye a una patrulla.' + (s.flags.indexOf('ghost_hint') >= 0 ? ' ' + esc(PE.MODE_TEXT[gpf.mode]) : ' Su comportamiento se revelará al verlo.') + '</p>'; }
    var armed = Object.keys(s.armed).map(function (k) { return k === 'jam' ? 'Inhibidor de Señal' : 'Credenciales Desechables'; });
    if (armed.length) h += '<p class="good-t">Armado: ' + armed.join(', ') + '.</p>';
    h += '</div>';
    var p = c.pred;
    h += '<div class="panel sat-box"><div class="ph"><b>Pronóstico de SATURNO</b>' + (p && p.conf >= 0.05 ? '<span class="tag">' + pct(p.conf) + '% de confianza</span>' : '') + '</div>';
    if (p && p.n >= 2 && p.conf >= 0.05) h += '<p>Espera que uses <b>' + LBL[p.approach].toUpperCase() + '</b>.</p>' + bar(p.conf, 1, 'sat');
    else h += '<p class="muted">Muy pocos datos. SATURNO aún no tiene un pronóstico estable.</p>';
    if (c.counter) h += s.armed.jam ? '<p class="good-t"><s>Contramedida contra ' + LBL[c.counter.approach].toUpperCase() + '</s> inhibida.</p>'
      : '<p class="alert">CONTRAMEDIDA: preparada contra ' + LBL[c.counter.approach].toUpperCase() + ' (' + (c.counter.penalty >= 15 ? 2 : 1) + ' unidad(es): ' + CM_TEXT[c.counter.approach] + '). Cambia de enfoque o inhíbela.</p>';
    var tp = c.toolPred;
    if (tp && tp.n >= 3 && tp.conf >= 0.05) h += '<p class="muted small">Herramienta táctica que espera: <b>' + SAT.TOOL_LABEL[tp.tool].toUpperCase() + '</b> (' + pct(tp.conf) + '%).</p>';
    if (c.tcm) h += s.armed.jam ? '<p class="good-t"><s>Entrenamiento contra ' + SAT.TOOL_LABEL[c.tcm.tool].toUpperCase() + '</s> inhibido.</p>'
      : '<p class="alert">ENTRENAMIENTO TÁCTICO: SATURNO preparó a sus unidades contra ' + SAT.TOOL_LABEL[c.tcm.tool].toUpperCase() + ': ' + esc(G.TCM_TEXT[c.tcm.tool]) + '. Usa otra herramienta o inhíbelo.</p>';
    h += '</div><h3>Elige un enfoque</h3>';
    SAT.AP.forEach(function (ap) {
      var A = M.APPROACHES[ap], cost = M.energyCost(s, ap), cant = s.res.energy < cost, countered = c.counter && c.counter.approach === ap && !s.armed.jam;
      h += '<div class="approach' + (countered ? ' countered' : '') + '"><div class="ah"><b>' + A.label + '</b><span class="odds">' + A.ap + ' PA</span></div>' +
        '<p class="muted">' + esc(A.desc) + '</p><div class="chips"><span class="chip">ENERGÍA ' + cost + '</span><span class="chip">SEÑUELOS ' + A.charges + '</span>' +
        (countered ? '<span class="chip neg">CONTRAMEDIDA ACTIVA</span>' : '') + '</div>' +
        '<button class="btn primary" data-act="op" data-k="' + ap + '"' + (cant ? ' disabled' : '') + '>' + (cant ? 'Energía insuficiente' : 'Iniciar misión con ' + A.label) + '</button></div>';
    });
    var scanCost = W.layerMods(s).obsFree ? 0 : 1;
    h += '<div class="row"><button class="btn" data-act="scan" data-k="' + n.id + '"' + (n.scanned || s.res.energy < scanCost ? ' disabled' : '') + '>' + (n.scanned ? 'Escaneado' : 'Escanear' + (scanCost ? ' (1 energía)' : ' (gratis)')) + '</button><button class="btn" data-act="withdraw">Retirarse (+3 VIS)</button></div>';
    var ib = itemButtons(s, 'op');
    if (ib) h += '<h3>Herramientas</h3><div class="panel">' + ib + '</div>';
    return h;
  }

  function tacView(s) {
    var c = s.cur, m = c.mission, n = W.getNode(s, c.nodeId), P = m.player, h = hintHtml(s);
    var A = M.APPROACHES[m.approach];
    h += '<div class="tachead"><div><b>' + esc(n.name) + '</b><div class="muted small">' + A.label + ' · turno ' + m.turn + '/' + m.maxTurn + '</div></div>' +
      '<div class="ap"><b>' + P.ap + '</b>/' + P.maxAp + ' PA' + (m.masks ? ' · ' + m.masks + ' máscara(s)' : '') + '</div></div>';
    h += '<div class="susp"><span>SOSPECHA</span>' + bar(m.suspicion, 100, m.suspicion >= 50 ? 'danger' : (m.suspicion >= 25 ? 'warn' : '')) + '<b>' + Math.round(m.suspicion) + '%</b></div>';
    h += '<div class="objs">' + M.objectives(m).map(function (o) { return '<span class="obj' + (o.done ? ' ok' : '') + '">' + (o.done ? '✔ ' : '○ ') + esc(o.text) + '</span>'; }).join('') + '</div>';
    h += '<div class="canvas-wrap"><canvas id="tac" data-act="tapcell" aria-label="Cuadrícula táctica"></canvas></div>';
    if (UI.inspect) h += '<p class="insp">' + esc(UI.inspect) + '</p>';
    if (m.cm) h += '<p class="warn-t small">Contramedida de SATURNO en esta misión: unidades marcadas con borde punteado ámbar.</p>';
    var onExit = P.x === m.exit.x && P.y === m.exit.y, hasTerm = !!M.nearbyTerminal(m), term = hasTerm ? M.nearbyTerminal(m) : null;
    var onPickup = !!M.pickupHere(m), onCover = m.tiles[P.y * m.w + P.x] === 2;
    var dis = M.disableTargets(m), neu = M.neutralizeTargets(m), complete = M.complete(m);
    function b(act, k, label, ok, extra) { return '<button class="btn small act' + (extra || '') + '" data-act="' + act + '" data-k="' + k + '"' + (ok ? '' : ' disabled') + '>' + label + '</button>'; }
    h += '<div class="actions">' +
      b('tmode', 'move', 'Mover', true, UI.tacMode === 'move' ? ' on' : '') +
      b('tac', 'observe', 'Observar (' + M.toolCost(m, 'observe') + ')', P.ap >= M.toolCost(m, 'observe')) +
      b('tac', 'access', 'Acceder' + (term ? ' (' + M.termCost(m, term) + ')' : ''), hasTerm && P.ap >= (term ? M.termCost(m, term) : 99)) +
      b('tac', 'collect', 'Recoger (1)', onPickup && P.ap >= 1) +
      b('tmode', 'distract', 'Señuelo (' + P.charges + ')', P.charges > 0 && P.ap >= 1, UI.tacMode === 'distract' ? ' on' : '') +
      b('tac', 'hide', 'Esconderse (1)', onCover && !P.hidden && P.ap >= 1) +
      b('tac', 'disable', 'Desactivar (' + M.toolCost(m, 'disable') + ')', dis.length > 0 && P.ap >= M.toolCost(m, 'disable')) +
      (m.approach === 'direct' ? b('tac', 'neutralize', 'Neutralizar (2)', neu.length > 0 && P.ap >= 2) : '') +
      b('tac', 'extract', complete ? 'Extraer (1)' : 'Extraer parcial (1)', onExit && P.ap >= 1, complete ? ' primary' : '') +
      b('tac', 'endturn', 'Terminar turno', true) + '</div>';
    if (m.ctx.tcm) h += '<p class="warn-t small">Entrenamiento de SATURNO: ' + esc(G.TCM_TEXT[m.ctx.tcm]) + '.</p>';
    if (UI.tacMode === 'distract') h += '<p class="warn-t small">Toca una celda a 5 o menos con línea de visión para lanzar el señuelo.</p>';
    h += '<div class="term">' + m.msgs.slice(-4).map(function (t) { return '<div class="ll"><span>&gt;</span> ' + esc(t) + '</div>'; }).join('') + '</div>';
    h += '<details class="legend"><summary>Leyenda</summary><ul class="plain small">' +
      '<li>Círculo blanco: tú. Con borde punteado: escondido (solo te ven desde 1 celda).</li><li>▲ cámara: gira 90° cada turno. ⬡ proceso de monitoreo: radio 2, fijo. ● patrulla: ve en cono hacia donde mira.</li>' +
      '<li>◆ evidencia. ▣ T/R/N terminal, relé o núcleo. X salida. Celdas con marco: cobertura.</li><li>Rojo/ámbar translúcido: zona vigilada. Te detectan al terminar el turno enemigo.</li><li>Toca un enemigo u objeto para inspeccionarlo. En pantallas táctiles, toca dos veces una celda para moverte.</li><li>Teclado: flechas o WASD mueven; T termina el turno; O observar; C recoger; X acceder; H esconderse; F desactivar; N neutralizar; E extraer.</li></ul></details>';
    return h;
  }
  function eventView(s) {
    var c = s.cur, ev = EV.get(c.eventId), h = hintHtml(s);
    if (!ev) return '<div class="panel">Señal perdida.</div><button class="btn" data-act="gomenu">Menú</button>';
    h += '<div class="panel event"><div class="ph"><b>' + esc(ev.title) + '</b><span class="tag">' + esc(W.getNode(s, c.nodeId).name) + '</span></div>';
    if (c.intercept) h += '<p class="alert">' + esc(c.intercept) + '</p>';
    h += '<p>' + esc(EV.textOf(ev, s)) + '</p></div>';
    ev.choices.forEach(function (ch, i) {
      var fx = ch.fx || {}, cant = fx.energy && fx.energy < 0 && s.res.energy < -fx.energy;
      h += '<button class="choice" data-act="ev" data-k="' + i + '"' + (cant ? ' disabled' : '') + '><span class="cl">' + esc(ch.label) + '</span><span class="chips">' +
        (ch.fn ? '<span class="chip amber">EL RESULTADO DEPENDE DE LO QUE SATURNO SEPA</span>' : fxChips(fx)) + '</span></button>';
    });
    return h;
  }
  function safeView(s) {
    var c = s.cur, r = s.res, h = hintHtml(s);
    h += '<div class="panel"><div class="ph"><b>' + esc(W.getNode(s, c.nodeId).name) + '</b><span class="tag">Refugio</span></div><p>Una puerta con cerrojo, una cama, un router que no es tuyo. Elige una forma de usar el tiempo.</p></div>';
    [['rest', 'Descansar', 'Restaura toda la energía y recupera Integridad. SATURNO anota que te quedaste en silencio.', { energy: r.maxEnergy - r.energy, vis: -20, integ: 12 }, false],
     ['identity', 'Cambiar de identidad', 'Cuesta 1 de Confianza. SATURNO olvida el 25% de lo que sabe de ti.', { trust: -1, integ: -8, vis: -30, strike: 1 }, r.trust < 1],
     ['cover', 'Tráfico de cobertura', 'Cuesta 10 de Ruido. Entierra tu señal en charla inofensiva.', { noise: -10, vis: -15, energy: 2 }, r.noise < 10]].forEach(function (o) {
      h += '<button class="choice" data-act="safe" data-k="' + o[0] + '"' + (o[4] ? ' disabled' : '') + '><span class="cl">' + o[1] + '</span><span class="muted small">' + esc(o[2]) + '</span><span class="chips">' + fxChips(o[3]) + '</span></button>';
    });
    return h;
  }
  function finaleView(s) {
    var h = hintHtml(s);
    h += '<div class="panel primarch"><div class="ph"><b>Núcleo de Primarca</b><span class="tag">Nodo final</span></div><p>La última sala es la primera honesta. El sistema se explica: estabilidad, orden, menos gente herida por las sorpresas. Luego espera tu respuesta. Cada salida exige algo que debiste construir en el camino.</p></div>';
    G.finaleStatus(s).forEach(function (e) {
      var E = G.ENDINGS[e.key];
      if (e.hidden) { h += '<div class="panel dim"><b>???</b><p class="muted">Algo en el modelo no deja de fallar al converger. Sigue divergiendo y busca lo que esconde.</p></div>'; return; }
      h += '<div class="panel ending' + (e.ok ? ' ready' : '') + '"><div class="ph"><b>' + E.title + '</b><span class="tag">' + (e.ok ? 'LISTO' : 'NO LISTO') + '</span></div><p class="muted">' + esc(E.tag) + '</p>';
      e.req.forEach(function (q) { h += '<div class="req' + (q.ok ? ' ok' : '') + '"><span>' + esc(q.label) + '</span>' + bar(Math.min(q.cur, q.need), q.need, q.ok ? 'sat' : '') + '<b>' + q.cur + '/' + q.need + '</b></div>'; });
      h += '<button class="btn primary" data-act="finale" data-k="' + e.key + '"' + (e.ok ? '' : ' disabled') + '>' + (e.ok ? 'Elegir ' + E.title : 'Requisitos sin cumplir') + '</button></div>';
    });
    return h + '<div class="panel"><b>Enfrentar a Primarca sin preparación</b><p class="muted">Si no cumples ningún desenlace, aún puedes enfrentarlo. La operación termina en derrota y el informe te muestra qué te faltó.</p><button class="btn danger" data-act="finale" data-k="confront">Enfrentar de todos modos</button></div>';
  }
  function renderNode(s) {
    var c = s.cur;
    if (!c) return '<div class="panel">No hay nodo activo.</div>';
    if (c.result) return resultView(s);
    if (c.kind === 'op') return c.stage === 'tac' ? tacView(s) : briefView(s);
    if (c.kind === 'event') return eventView(s);
    if (c.kind === 'safe') return safeView(s);
    if (c.kind === 'finale') return finaleView(s);
    return '<div class="panel">Nodo desconocido.</div>';
  }

  /* ---------- pestañas ---------- */
  function renderIntel(s) {
    var S = s.saturno, cls = SAT.classify(s), sh = SAT.shares(S), h = '';
    h += '<div class="panel sat-box"><div class="ph"><b>Clasificación conductual</b><span class="tag">' + S.n + ' observaciones</span></div><div class="class">' + cls.label + '</div><p class="muted">' + esc(cls.note) + '</p>' + (SAT.style(s) ? '<p>Estilo táctico: <b>' + SAT.style(s) + '</b></p>' : '') + '</div>';
    if (s.inherited && s.inherited.strength > 0) h += '<div class="panel dim"><p class="sat">Memoria heredada: SATURNO empezó esta operación recordando el ' + pct(s.inherited.strength) + '% de tu historial.</p></div>';
    if (s.ghosts.length) h += '<div class="panel dim"><b>Fantasmas en esta operación</b><ul class="plain small">' + s.ghosts.map(function (g) { var pf = PE.ghostProfile(g); return '<li>' + esc(g.name) + ': ' + (s.flags.indexOf('ghost_hint') >= 0 ? esc(PE.MODE_TEXT[pf.mode]) : 'comportamiento desconocido hasta verlo') + '</li>'; }).join('') + '</ul></div>';
    h += '<h3>Pronóstico</h3><div class="panel">';
    var c = s.cur, pr = (c && c.kind === 'op' && c.pred) ? c.pred : null;
    if (pr && !c.result && c.stage === 'brief') {
      h += '<p>Próximo enfoque: <b>' + LBL[pr.approach].toUpperCase() + '</b> con ' + pct(pr.conf) + '% de confianza.</p>' + bar(pr.conf, 1, 'sat');
      SAT.AP.forEach(function (a) { h += '<div class="req"><span>' + LBL[a] + '</span>' + bar(pr.probs[a], 1, a === pr.approach ? 'sat' : '') + '<b>' + pct(pr.probs[a]) + '%</b></div>'; });
    } else if (s.routePred && s.phase === 'map') {
      h += '<p>Próxima ruta: la opción <b>' + (s.routePred.kind === 'safe' ? 'más segura' : 'más riesgosa') + '</b> con ' + pct(s.routePred.conf) + '% de confianza.</p>' + bar(s.routePred.conf, 1, 'sat');
    } else {
      var p0 = SAT.predictApproach(s, 'infiltration');
      h += '<p>Si entras a una operación ahora, SATURNO esperaría <b>' + LBL[p0.approach].toUpperCase() + '</b> (' + pct(p0.conf) + '% de confianza).</p>' + bar(p0.conf, 1, 'sat');
    }
    h += '<p class="muted small">Los pronósticos se calculan solo con tus acciones pasadas. SATURNO nunca ve tu próxima decisión.</p></div>';
    h += '<h3>Tendencias conocidas</h3><div class="panel">';
    if (!sh.hasAp) h += '<p class="muted">Aún no hay nada registrado.</p>';
    else SAT.AP.forEach(function (a) { h += '<div class="req"><span>' + LBL[a] + '</span>' + bar(sh.ap[a], 1, '') + '<b>' + pct(sh.ap[a]) + '%</b></div>'; });
    h += '<div class="req"><span>rutas riesgosas</span>' + bar(sh.routeRisk, 1, '') + '<b>' + (sh.hasRoute ? pct(sh.routeRisk) + '%' : 'n/d') + '</b></div>';
    h += '<dl class="kv"><dt>Ayuda a contactos</dt><dd>' + (S.help >= 1.5 ? 'siempre' : S.help > 0.3 ? 'a veces' : 'rara vez') + '</dd><dt>Visitas a refugios</dt><dd>' + S.rest + '</dd><dt>Nodos escaneados</dt><dd>' + S.scans + '</dd></dl></div>';
    var tl = SAT.TOOLS, tsum = 0; tl.forEach(function (k) { tsum += S.tac[k]; });
    h += '<h3>Hábitos tácticos</h3><div class="panel">';
    if (tsum <= 0) h += '<p class="muted">Aún no ha visto cómo juegas una misión.</p>';
    else tl.forEach(function (k) { h += '<div class="req"><span>' + SAT.TOOL_LABEL[k] + '</span>' + bar(S.tac[k] / tsum, 1, '') + '<b>' + pct(S.tac[k] / tsum) + '%</b></div>'; });
    var tpr = SAT.predictTool(s);
    h += '<p class="muted small">Herramienta que espera de ti: <b>' + SAT.TOOL_LABEL[tpr.tool] + '</b> (' + pct(tpr.conf) + '%). Con 38% o más y 3 misiones de datos entrena a sus unidades contra ella.</p></div>';
    var tkeys = Object.keys(S.types), cons = SAT.conserve(s), ext = S.ext, extN = ext.full + ext.partial;
    h += '<h3>Perfil de riesgo y recursos</h3><div class="panel"><dl class="kv">' +
      '<dt>Tipos de misión</dt><dd>' + (tkeys.length ? tkeys.map(function (k) { return W.TYPE_INFO[k].label + ' x' + S.types[k]; }).join(', ') : 'sin datos') + '</dd>' +
      '<dt>Energía al entrar</dt><dd>' + (cons == null ? 'sin datos' : (cons >= 0.65 ? 'conservas (' + pct(cons) + '%)' : (cons <= 0.4 ? 'gastas sin reservas (' + pct(cons) + '%)' : 'moderada (' + pct(cons) + '%)'))) + '</dd>' +
      '<dt>Tolerancia al riesgo</dt><dd>' + (sh.hasRoute ? (sh.routeRisk >= 0.6 ? 'alta' : (sh.routeRisk <= 0.4 ? 'baja' : 'media')) : 'sin datos') + '</dd>' +
      '<dt>Extracción</dt><dd>' + (extN ? ext.full + ' completas, ' + ext.partial + ' parciales' : 'sin datos') + '</dd></dl></div>';
    h += '<h3>Pronóstico por tipo de nodo</h3><div class="panel">';
    ['investigation', 'infiltration', 'disruption', 'highrisk', 'elite', 'gateway'].forEach(function (t) {
      var pp = SAT.predictApproach(s, t);
      h += '<div class="req"><span>' + W.TYPE_INFO[t].label + '</span>' + bar(pp.conf, 1, 'sat') + '<b>' + LBL[pp.approach] + ' ' + pct(pp.conf) + '%</b></div>';
    });
    h += '</div><h3>Contramedidas activas</h3><div class="panel">';
    var cm = SAT.activeCountermeasures(s);
    h += cm.length ? '<ul class="plain">' + cm.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted">Ninguna. SATURNO no está lo bastante seguro como para preparar algo.</p>';
    h += '</div><h3>Registro de predicciones</h3><div class="panel"><div class="ledger">';
    if (!S.ledger.length) h += '<span class="muted">Aún no hay predicciones puntuadas.</span>';
    S.ledger.forEach(function (e) { h += '<i class="lg ' + (e.hit ? 'hit' : 'miss') + '" title="' + (e.k === 'route' ? 'ruta' : (e.k === 'tool' ? 'herramienta' : 'enfoque')) + ': predijo ' + e.p + ', real ' + e.a + ' (' + e.c + '%)">' + (e.hit ? '■' : '□') + '</i>'; });
    h += '</div><p class="muted small">■ SATURNO acertó. □ SATURNO falló. Un fallo confiado sube más la Divergencia.</p></div>';
    return h + '<h3>Cómo engañarlo</h3><div class="panel"><ul class="plain"><li>Crea un hábito, deja que SATURNO se confíe y luego rómpelo.</li><li>Un Guion Señuelo o una opción de "alimentar" le enseña un hábito falso.</li><li>El Ruido debilita su confianza y sus contramedidas.</li><li>Los nodos élite, los cambios de identidad y algunos contactos lo hacen olvidar.</li><li>Alterna también tus herramientas tácticas: si abusas del señuelo o de esconderte, entrenará a sus unidades contra eso.</li></ul></div>';
  }
  function renderStatus(s) {
    var D = G.DIFF[s.diff], h = '<div class="panel"><div class="ph"><b>Operativo</b><span class="tag">' + D.label + '</span></div><dl class="kv">' +
      '<dt>Semilla</dt><dd>' + esc(s.seed) + ' <button class="btn small" data-act="copyseed">Copiar</button></dd><dt>Capa</dt><dd>' + s.layerIdx + ': ' + esc(W.LAYERS[s.layerIdx].name) + '</dd>' +
      '<dt>Nodos completados</dt><dd>' + s.stats.nodes + '</dd><dt>Misiones</dt><dd>' + s.stats.success + ' ganadas, ' + s.stats.fails + ' fallidas</dd>' +
      '<dt>Relés instalados</dt><dd>' + s.relays + '</dd><dt>Descubrimientos</dt><dd>' + G.discoveries(s) + '</dd></dl></div>';
    var FD = { w4k3up: 'Resistencia descentralizada. Con 3+: +1 energía al descender de capa.', saturno: 'Qué tan tolerado o vigilado te considera. Define el pacto de Estabilidad.', noise: 'Afinidad con la señal emergente. Con 3+: +3 Ruido al descender.', inst: 'Relación con los operadores institucionales. Necesaria para Estabilidad.' };
    h += '<h3>Facciones</h3><div class="panel">' + Object.keys(G.FACTIONS).map(function (f) { var v = s.rep[f] || 0; return '<div class="req"><span>' + G.FACTIONS[f] + '</span>' + bar(v + 5, 10, v < 0 ? 'danger' : '') + '<b>' + (v > 0 ? '+' : '') + v + '</b></div><p class="muted small">' + FD[f] + '</p>'; }).join('') + '<p class="muted small">Máscaras disponibles: ' + (s.masks || 0) + '.</p></div>';
    h += '<h3>Recursos</h3><div class="panel">' + ['vis', 'div', 'noise', 'energy', 'integ', 'trust', 'evid'].map(function (k) { return '<p><b>' + HELP[k][0] + '.</b> <span class="muted">' + esc(HELP[k][1]) + '</span></p>'; }).join('') + '</div>';
    return h + '<h3>Inventario (' + s.items.length + '/6)</h3><div class="panel">' + (s.items.length ? itemButtons(s, 'all') : '<p class="muted">Vacío. Las misiones y los encuentros a veces dan herramientas.</p>') + '</div>';
  }
  function renderContacts(s) {
    var h = '<div class="panel dim"><p class="muted">Los contactos te deben un favor. Cobrarlo cuesta 1 de Confianza y solo se puede una vez por contacto. Tienes ' + s.res.trust + ' de Confianza.</p></div>';
    if (!s.contacts.length) return h + '<div class="panel"><p class="muted">Aún no tienes contactos. Ayuda a la gente en los encuentros sociales y quizá te recuerden.</p></div>';
    s.contacts.forEach(function (c) {
      h += '<div class="panel"><div class="ph"><b>' + esc(c.name) + '</b><span class="tag">' + esc(c.role) + '</span></div><p class="muted">Favor: ' + esc(G.FAVORS[c.favor] || '') + '</p>' +
        '<button class="btn" data-act="favor" data-k="' + c.id + '"' + (c.used || (s.res.trust < 1 && !W.layerMods(s).freeFavor) ? ' disabled' : '') + '>' + (c.used ? 'Favor usado' : 'Cobrar favor (' + (W.layerMods(s).freeFavor ? 'gratis en esta capa' : '1 Confianza') + ')') + '</button></div>';
    });
    return h;
  }
  function renderEvidence(s) {
    var h = '<div class="panel dim"><p class="muted">Peso ' + G.evidenceWeight(s) + ' (' + G.verifiedCount(s) + ' verificadas). La evidencia verificada vale doble. Verificar cuesta 1 de energía.</p></div>';
    if (!s.evidence.length) return h + '<div class="panel"><p class="muted">El archivo está vacío. Las investigaciones, infiltraciones y fuentes producen evidencia.</p></div>';
    s.evidence.slice().reverse().forEach(function (e) {
      h += '<div class="panel evrow"><div><b>' + esc(e.title) + '</b><div class="muted small">Capa ' + e.layer + ' · ' + (e.verified ? 'verificada' : 'sin verificar') + '</div></div>' +
        (e.verified ? '<span class="tag good">VERIFICADA</span>' : '<button class="btn small" data-act="verify" data-k="' + e.id + '"' + (s.res.energy < 1 ? ' disabled' : '') + '>Verificar (1)</button>') + '</div>';
    });
    return h;
  }
  function renderLog(s) { return '<h3>Registro de eventos</h3><div class="term">' + s.log.slice().reverse().map(function (l) { return '<div class="ll ' + l.k + '"><span>t' + l.t + '</span> ' + esc(l.m) + '</div>'; }).join('') + '</div>'; }

  function renderRun(s) {
    renderHud(s); renderNav(s);
    var body;
    if (UI.tab === 'map') body = s.phase === 'node' ? renderNode(s) : renderMap(s);
    else if (UI.tab === 'intel') body = renderIntel(s);
    else if (UI.tab === 'status') body = renderStatus(s);
    else if (UI.tab === 'contacts') body = renderContacts(s);
    else if (UI.tab === 'evidence') body = renderEvidence(s);
    else body = renderLog(s);
    $('screen').innerHTML = '<div class="wrap">' + body + '</div>';
    if (UI.tab === 'map' && s.phase === 'node' && s.cur && s.cur.stage === 'tac' && !s.cur.result) T.draw($('tac'), s, UI.tacMode, UI.tacPreview);
  }

  /* ---------- menú, historial, ayuda, final ---------- */
  function renderMenu() {
    $('hud').hidden = true; $('nav').hidden = true;
    var has = !!G.state && G.state.phase !== 'end', meta = G.meta;
    var h = '<div class="wrap menu"><div class="title"><div class="t1">W4K3UP</div><div class="t2">SIN CLASIFICAR</div></div>' +
      '<p class="tag-line">El sistema no teme a la violencia. Teme lo que no puede clasificar.</p>';
    if (G.recovered) h += '<p class="warn-t">Se encontró un guardado dañado y se recuperó. Se reiniciaron tus ajustes e historial.</p>';
    h += '<div class="menu-btns">';
    if (has) h += '<button class="btn primary big" data-act="continue-run">Reanudar operación <span class="muted">Capa ' + G.state.layerIdx + ', semilla ' + esc(G.state.seed) + '</span></button>';
    h += '<button class="btn big' + (has ? '' : ' primary') + '" data-act="new">Nueva operación</button>' +
      '<button class="btn big" data-act="history">Historial de operaciones (' + meta.history.length + ')</button>' +
      '<button class="btn big" data-act="world">Mundo persistente (' + meta.world.ghosts.length + ' fantasmas)</button>' +
      '<button class="btn big" data-act="howto">Cómo jugar</button>' +
      '<button class="btn big" data-act="settings">Ajustes</button>';
    if (has) h += '<button class="btn danger" data-act="abandon">Abandonar la operación actual</button>';
    $('screen').innerHTML = h + '</div><p class="muted small center">Versión estática. El progreso se guarda solo en este navegador.</p></div>';
  }
  function renderHistory() {
    $('hud').hidden = true; $('nav').hidden = true;
    var hist = G.meta.history.slice().reverse();
    var h = '<div class="wrap"><div class="ph"><h2>Historial de operaciones</h2><button class="btn small" data-act="gomenu">Volver</button></div>';
    if (!hist.length) h += '<div class="panel"><p class="muted">No hay operaciones registradas. Empieza una desde el menú: cada partida, ganada o perdida, queda aquí con lo que SATURNO aprendió de ti.</p></div>';
    hist.forEach(function (e) {
      var win = e.result === 'victory', title = win ? G.ENDINGS[e.ending].title : (G.DEFEATS[e.result] || { title: e.result }).title;
      h += '<div class="panel ' + (win ? 'good' : '') + '"><div class="ph"><b>' + esc(title) + '</b><span class="tag">' + esc(e.seed) + '</span></div>' +
        '<p class="muted">' + (G.DIFF[e.diff] ? G.DIFF[e.diff].label : e.diff) + ' · Capa ' + e.layer + ' · ' + e.nodes + ' nodos · ' + new Date(e.date).toLocaleDateString('es') + '</p>' +
        '<p>Clasificado como <b>' + esc(e.label || 'SIN CLASIFICAR') + '</b>. Visibilidad máxima ' + e.peakVis + '%, divergencia máxima ' + e.peakDiv + '%. SATURNO se sorprendió ' + (e.surprised || 0) + ' veces.</p>' +
        (e.consequences && e.consequences.length ? '<details><summary>Consecuencias</summary><ul class="plain small">' + e.consequences.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') +
        '<button class="btn small" data-act="replay" data-k="' + esc(e.seed) + '" data-p="' + esc(e.diff) + '">Repetir semilla</button></div>';
    });
    $('screen').innerHTML = h + '</div>';
  }
  function renderHowto() {
    $('hud').hidden = true; $('nav').hidden = true;
    $('screen').innerHTML = '<div class="wrap"><div class="ph"><h2>Cómo jugar</h2><button class="btn small" data-act="gomenu">Volver</button></div>' +
      '<div class="panel"><b>Objetivo</b><p>Baja desde Clearnet hasta Primarca a través de nueve capas. En el último nodo cierras la operación de una de varias maneras. Cada desenlace exige recursos distintos.</p></div>' +
      '<div class="panel"><b>Misiones tácticas</b><p>Cada operación es un mapa por turnos. Gastas puntos de acción (PA) para moverte, observar, hackear terminales, recoger evidencia, lanzar señuelos o esconderte. Las cámaras, patrullas y procesos de monitoreo tienen conos de visión visibles: te detectan cuando termina su turno si estás dentro. Llega a la salida X para extraer.</p></div>' +
      '<div class="panel"><b>El juego mental</b><p>SATURNO predice tu enfoque y tu ruta según tus hábitos, y prepara unidades extra contra lo que espera. Úsalo: crea un patrón y rómpelo, alimenta falsos hábitos, hazlo olvidar.</p></div>' +
      '<div class="panel"><b>Recursos</b><p><b>Visibilidad</b> es cuánto te ve SATURNO. <b>Divergencia</b> es cuánto fallan sus predicciones. <b>Ruido</b> es señal independiente. Toca cualquier barra superior para ver detalles.</p></div>' +
      '<div class="panel"><b>Mundo persistente</b><p>Si una operación termina en derrota, SATURNO crea un fantasma con tu conducta: puede aparecer como patrulla que actúa como tú lo hiciste, como contacto falso, como aliado inesperado o como fuente de evidencia histórica. Además conservas descubrimientos, contactos y nodos clandestinos... y SATURNO conserva parte de lo que aprendió de ti.</p></div>' +
      '<div class="panel"><b>Capas y facciones</b><p>Cada capa tiene su propia mecánica: máscaras en la Web Bergie, reescritura narrativa en la Web Charter, favores gratis en la Web de Mariana, sellado en los sistemas cerrados y niebla en La Niebla. Tus decisiones mueven la reputación con W4K3UP, SATURNO, el Ruido y los operadores institucionales.</p></div>' +
      '<div class="panel"><b>Desenlaces</b><p><b>Exposición:</b> evidencia verificada. <b>Liberación:</b> ruido, contactos y relés. <b>Reforma:</b> divergencia, confianza y pruebas. <b>Estabilidad:</b> un pacto con Varela (aparece si la conociste). <b>Resonancia:</b> el Ruido sostenido (aparece con mucho Ruido). <b>Sin clasificar:</b> permanece oculto hasta que diverjas lo suficiente.</p></div>' +
      '<p class="muted small">Cada semilla genera siempre la misma red y los mismos mapas tácticos, así que puedes repetirla o compartirla.</p></div>';
  }
  function renderWorld() {
    $('hud').hidden = true; $('nav').hidden = true;
    var w = G.meta.world, mem = PE.memory(G.meta), k = w.knowledge;
    var h = '<div class="wrap"><div class="ph"><h2>Mundo persistente</h2><button class="btn small" data-act="gomenu">Volver</button></div>';
    h += '<p class="muted">La muerte reinicia al operativo, no al mundo. Lo que persiste es información, contactos y herramientas; también lo que SATURNO sabe de ti.</p>';
    h += '<h3>Memoria de SATURNO</h3><div class="panel">';
    if (!mem.runs) h += '<p class="muted">SATURNO aún no tiene memoria de ti.</p>';
    else {
      h += '<p>Recuerda ' + pct(mem.strength) + '% de tu historial en ' + mem.runs + ' partida(s).</p>';
      SAT.AP.forEach(function (a) { h += '<div class="req"><span>' + LBL[a] + '</span>' + bar(k.ap[a] || 0, 1, '') + '<b>' + pct(k.ap[a] || 0) + '%</b></div>'; });
      h += '<p class="muted small">Esta memoria se aplica al empezar. Una Exposición la reduce a la mitad; una Anomalía la borra.</p>';
    }
    h += '</div><h3>Fantasmas activos (' + w.ghosts.length + '/' + PE.MAX_GHOSTS + ')</h3>';
    if (!w.ghosts.length) h += '<div class="panel"><p class="muted">Ninguno. Cuando una operación termina en derrota, SATURNO crea un fantasma con tu conducta y puede usarlo contra ti o ponerlo en tu camino.</p></div>';
    w.ghosts.forEach(function (g) {
      var pf = PE.ghostProfile(g), sum = 0; SAT.AP.forEach(function (a) { sum += g.ap[a] || 0; });
      h += '<div class="panel"><div class="ph"><b>' + esc(g.name) + '</b><span class="tag">' + esc(g.label) + '</span></div>' +
        '<p class="muted">Última misión: ' + esc(g.last.name) + ' (capa ' + g.last.layer + '). Semilla ' + esc(g.seed) + '.</p>' +
        '<p>' + esc(PE.MODE_TEXT[pf.mode]) + (pf.ignoreDecoy ? ' Ignora señuelos.' : ' Cae en los señuelos.') + (pf.helps ? ' Responde a peticiones de ayuda.' : '') + '</p>';
      if (sum > 0) SAT.AP.forEach(function (a) { h += '<div class="req"><span>' + LBL[a] + '</span>' + bar((g.ap[a] || 0) / sum, 1, '') + '<b>' + pct((g.ap[a] || 0) / sum) + '%</b></div>'; });
      h += '<p class="muted small">Equipo: ' + (g.items && g.items.length ? g.items.map(function (i) { return G.ITEMS[i] ? G.ITEMS[i].name : i; }).join(', ') : 'ninguno') + '.</p>';
      if (g.decisions && g.decisions.length) h += '<details><summary>Decisiones importantes</summary><ul class="plain small">' + g.decisions.map(function (d) { return '<li>' + esc(d) + '</li>'; }).join('') + '</ul></details>';
      h += '</div>';
    });
    h += '<h3>Red clandestina</h3><div class="panel"><p>' + w.network + ' nodo(s) activo(s).</p><div class="pips">' + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { return '<i class="pip' + (i < w.network ? ' now' : '') + '"></i>'; }).join('') + '</div><p class="muted small">Cada nodo da +4 de Ruido inicial (máx. 16). Con 3 nodos el canal alterno cuesta 15.</p></div>';
    h += '<h3>Descubrimientos</h3><div class="panel">' + Object.keys(PE.DISC).map(function (f) { var on = w.discoveries.indexOf(f) >= 0; return '<p><b>' + (on ? esc(PE.DISC[f].label) : '???') + '.</b> <span class="muted">' + (on ? esc(PE.DISC[f].desc) : 'Aún no descubierto.') + '</span></p>'; }).join('') + '</div>';
    h += '<h3>Contactos y archivo</h3><div class="panel"><p>Contactos veteranos: ' + (w.contacts.length ? w.contacts.map(function (c) { return esc(c.name); }).join(', ') : 'ninguno') + '.</p><p>Archivo salvado: ' + (w.vault.length ? w.vault.map(esc).join('; ') : 'vacío') + '.</p></div>';
    var vk = Object.keys(w.victories);
    h += '<h3>Desenlaces logrados</h3><div class="panel">' + (vk.length ? vk.map(function (x) { return '<p><b>' + (G.ENDINGS[x] ? G.ENDINGS[x].title : x) + '</b> x' + w.victories[x] + '</p>'; }).join('') : '<p class="muted">Ninguno todavía.</p>') + '</div>';
    if (w.archive.length) h += '<h3>Archivo histórico (' + w.archive.length + ')</h3><div class="panel">' + w.archive.slice(0, 8).map(function (g) { return '<p class="small"><b>' + esc(g.name) + '</b> <span class="muted">' + esc(g.label || '') + ' · ' + esc((g.last && g.last.name) || '') + '</span></p>'; }).join('') + '</div>';
    $('screen').innerHTML = h + '<div class="row"><button class="btn danger" data-act="reset-world">Borrar mundo y historial</button></div></div>';
  }
  function renderEnd(s) {
    $('hud').hidden = true; $('nav').hidden = true;
    var e = s.end, win = e.result === 'victory', E = win ? G.ENDINGS[e.key] : null, D = win ? null : G.DEFEATS[e.result];
    var h = '<div class="wrap"><div class="panel endhead ' + (win ? 'good' : 'bad') + '"><div class="big-t">' + (win ? E.title : D.title) + '</div><p class="muted">' + esc(win ? E.tag : 'Operación terminada') + '</p><p>' + esc(win ? E.text : D.text) + '</p>' + (win ? '<p class="muted">' + esc(E.cost) + '</p>' : '') + '</div>';
    h += '<h3>Lectura final de SATURNO</h3><div class="panel"><div class="class">' + e.classification.label + '</div><p class="muted">' + esc(e.classification.note) + '</p>';
    var sh = SAT.shares(s.saturno);
    SAT.AP.forEach(function (a) { h += '<div class="req"><span>' + LBL[a] + '</span>' + bar(sh.ap[a], 1, '') + '<b>' + pct(sh.ap[a]) + '%</b></div>'; });
    h += '</div>' + (e.consequences && e.consequences.length ? '<h3>Consecuencias en el mundo</h3><div class="panel"><ul class="plain">' + e.consequences.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') + '<h3>Informe</h3><div class="panel"><ul class="plain">' + e.debrief.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>';
    h += '<div class="panel"><dl class="kv"><dt>Capa alcanzada</dt><dd>' + s.layerIdx + ': ' + esc(W.LAYERS[s.layerIdx].name) + '</dd><dt>Nodos</dt><dd>' + s.stats.nodes + '</dd><dt>Visibilidad máxima</dt><dd>' + s.stats.peakVis + '%</dd><dt>Divergencia máxima</dt><dd>' + s.stats.peakDiv + '%</dd><dt>Predicciones falladas</dt><dd>' + s.stats.surprised + '</dd><dt>Semilla</dt><dd>' + esc(s.seed) + '</dd></dl></div>';
    $('screen').innerHTML = h + '<div class="menu-btns"><button class="btn primary big" data-act="replay" data-k="' + esc(s.seed) + '" data-p="' + esc(s.diff) + '">Repetir esta semilla</button><button class="btn big" data-act="new">Nueva operación</button><button class="btn big" data-act="history">Historial</button><button class="btn big" data-act="gomenu">Menú principal</button></div></div>';
  }

  /* ---------- modales ---------- */
  function openModal(html) { var m = $('modal'); m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true">' + html + '</div>'; m.hidden = false; }
  function closeModal() { $('modal').hidden = true; $('modal').innerHTML = ''; UI.modal = null; }
  function openSetup(seed, diff) {
    var meta = G.meta, d = diff || meta.settings.difficulty, has = G.state && G.state.phase !== 'end';
    UI.modal = 'setup';
    var h = '<h2>Nueva operación</h2>' + (has ? '<p class="warn-t">Esto reemplaza tu operación actual.</p>' : '') +
      '<label class="fld">Semilla<input id="seedIn" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" value="' + esc(seed || U.randomSeed()) + '"></label>' +
      '<div class="row"><button class="btn small" data-act="rndseed">Semilla aleatoria</button><button class="btn small" data-act="daysed">Semilla del día</button><span class="muted small">Misma semilla, misma red.</span></div><div class="diffs">';
    ['easy', 'normal', 'hard'].forEach(function (k) {
      h += '<label class="diff"><input type="radio" name="diff" value="' + k + '"' + (k === d ? ' checked' : '') + '><span><b>' + G.DIFF[k].label + '</b><br><span class="muted small">' + esc(G.DIFF[k].desc) + '</span></span></label>';
    });
    var inh = PE.inheritance(meta);
    h += '</div><div class="panel dim"><b>Herencia del mundo</b>' + (inh.length ? '<ul class="plain small">' + inh.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '<p class="muted small">Todavía no hay nada que heredar.</p>') + '<label class="chk"><input id="inhIn" type="checkbox"' + (meta.settings.inherit ? ' checked' : '') + '> Heredar el mundo persistente</label></div>';
    openModal(h + '<label class="chk"><input id="hintsIn" type="checkbox"' + (meta.settings.hints ? ' checked' : '') + '> Mostrar instrucciones del tutorial</label>' +
      '<div class="row"><button class="btn primary" data-act="start">Comenzar</button><button class="btn" data-act="closemodal">Cancelar</button></div>');
  }
  function openHelp(k) {
    var x = HELP[k]; if (!x) return;
    openModal('<h2>' + esc(x[0]) + '</h2><p>' + esc(x[1]) + '</p><div class="row"><button class="btn primary" data-act="closemodal">Cerrar</button></div>');
  }

  /* ---------- render principal ---------- */
  function render() {
    var s = G.state;
    if (s && s.phase === 'end' && UI.screen === 'run') UI.screen = 'end';
    if (UI.screen === 'run' && (!s || s.phase === 'end')) UI.screen = s && s.phase === 'end' ? 'end' : 'menu';
    if (UI.screen === 'end' && s && s.phase === 'end') renderEnd(s);
    else if (UI.screen === 'run' && s) renderRun(s);
    else if (UI.screen === 'history') renderHistory();
    else if (UI.screen === 'howto') renderHowto();
    else if (UI.screen === 'world') renderWorld();
    else renderMenu();
    var sc = $('screen'); if (sc && UI._scrollTop) sc.scrollTop = 0;
    UI._scrollTop = false;
  }
  function after(res, sound) {
    var s = G.state;
    if (res && res.ok === false) { toast(res.msg || 'No es posible.'); AU.play('bad'); render(); return; }
    if (s && s.phase === 'end') { AU.play(s.end.result === 'victory' ? 'win' : 'lose'); UI.screen = 'end'; UI._scrollTop = true; render(); return; }
    AU.play(sound || 'click'); render();
  }
  function top() { UI._scrollTop = true; }

  function describeEnemy(m, e) {
    var dirs = ['norte', 'este', 'sur', 'oeste'], d = e.disabled ? ' (desactivado)' : '';
    if (e.ghost) return 'Eco ' + e.ghost.name + d + ': ' + PE.MODE_TEXT[e.ghost.mode] + (e.ghost.ignoreDecoy ? ' Ignora señuelos.' : ' Cae en señuelos.');
    if (e.type === 'camera') return 'Cámara' + d + ': cono de 5 celdas, mira al ' + dirs[e.dir] + ' y gira 90° al final de cada turno.' + (e.cm ? ' Contramedida de SATURNO.' : '');
    if (e.type === 'sentinel') return 'Proceso de monitoreo' + d + ': ve todo en radio 2. No se mueve.' + (e.cm ? ' Contramedida de SATURNO.' : '');
    return 'Patrulla' + d + ': cono de 4 celdas hacia el ' + dirs[e.dir] + ', sigue una ruta' + (m.suspicion >= 50 ? ' y ahora te persigue.' : '.') + (e.cm ? ' Contramedida de SATURNO.' : '');
  }
  function describeCell(m, x, y) {
    var out = [];
    m.terminals.forEach(function (t) { if (t.x === x && t.y === y) out.push((t.kind === 'relay' ? 'Punto de relé' : (t.kind === 'core' ? 'Núcleo de SATURNO' : 'Terminal')) + (t.done ? ' (completado)' : '') + '.'); });
    m.pickups.forEach(function (u) { if (u.x === x && u.y === y && !u.got) out.push('Evidencia: colócate encima y recoge.'); });
    if (m.exit.x === x && m.exit.y === y) out.push('Salida: extrae aquí.');
    var t = m.tiles[y * m.w + x];
    if (t === 2) out.push('Cobertura: escóndete aquí para que solo te vean a 1 celda.');
    if (t === 1) out.push('Muro: bloquea el paso y la visión.');
    return out.join(' ');
  }
  function tacDo(s, action, params) {
    var m = s.cur && s.cur.mission, b = m ? m.suspicion : 0, ms = m ? m.masks : 0;
    var r = G.tac(s, action, params);
    UI.tacPreview = null; UI.inspect = ''; UI.target = null;
    var snd = action === 'move' ? 'click' : (action === 'endturn' ? 'sat' : 'good');
    if (m && r.ok) { if (m.suspicion > b + 0.5) snd = 'alert'; if (m.masks < ms) snd = 'bad'; }
    return { res: r, snd: snd };
  }
  function tapCell(s, ev) {
    var c = s.cur;
    if (!c || c.stage !== 'tac' || c.result) return;
    var m = c.mission, cell = T.cellFromEvent(ev, $('tac'), m);
    if (!cell) return;
    var mode = UI.tacMode, idx = cell.y * m.w + cell.x;
    if (mode === 'distract') { var rd = tacDo(s, 'distract', cell); if (rd.res.ok) UI.tacMode = 'move'; return after(rd.res, rd.snd); }
    var vis = M.visible(m), en = null;
    m.enemies.forEach(function (e) { if (e.x === cell.x && e.y === cell.y && (vis[idx] || m.reveal > 0 || (e.type !== 'patrol' && e.known))) en = e; });
    if (en) { UI.inspect = describeEnemy(m, en); UI.target = { x: en.x, y: en.y }; UI.tacPreview = null; AU.play('click'); return render(); }
    if (!m.seen[idx]) { UI.inspect = 'Zona inexplorada.'; UI.tacPreview = null; return render(); }
    var info = describeCell(m, cell.x, cell.y), reach = M.reachable(m), cost = reach[idx];
    if (cost <= 0) { UI.inspect = info || (cost === 0 ? 'Estás aquí.' : 'No puedes llegar con tus PA actuales.'); UI.tacPreview = null; AU.play('click'); return render(); }
    if (G.meta.settings.confirmMove && !(UI.tacPreview && UI.tacPreview.x === cell.x && UI.tacPreview.y === cell.y)) {
      UI.tacPreview = { x: cell.x, y: cell.y, cost: cost }; UI.inspect = (info ? info + ' ' : '') + 'Toca de nuevo para moverte (' + cost + ' PA).'; AU.play('click'); return render();
    }
    var r = tacDo(s, 'move', cell); after(r.res, r.snd);
  }

  var SET_LABELS = [['muted', 'Sonido'], ['hints', 'Instrucciones del tutorial'], ['confirmMove', 'Confirmar movimientos con un segundo toque'], ['bigText', 'Texto grande'], ['reduceMotion', 'Reducir animaciones']];
  function applySettings() {
    var st = G.meta.settings;
    if (st.confirmMove === null) st.confirmMove = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    document.body.classList.toggle('big-text', !!st.bigText);
    document.body.classList.toggle('reduce-motion', !!st.reduceMotion);
    AU.setMuted(!!st.muted);
  }
  function openSettings() {
    var st = G.meta.settings; UI.modal = 'settings';
    var h = '<h2>Ajustes</h2>';
    SET_LABELS.forEach(function (x) {
      var on = x[0] === 'muted' ? !st.muted : !!st[x[0]];
      h += '<button class="choice" data-act="set" data-k="' + x[0] + '"><span class="cl">' + x[1] + ': ' + (on ? 'sí' : 'no') + '</span></button>';
    });
    openModal(h + '<div class="row"><button class="btn" data-act="reset-hints">Reiniciar tutorial</button><button class="btn primary" data-act="closemodal">Cerrar</button></div>');
  }
  function dayLabel() { var d = new Date(); return 'DIA-' + d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2); }
  function keyAction(e) {
    var s = G.state;
    if (UI.modal || !s || UI.screen !== 'run' || UI.tab !== 'map' || !s.cur || s.cur.stage !== 'tac' || s.cur.result) return false;
    var t = e.target && e.target.tagName; if (t === 'INPUT' || t === 'TEXTAREA') return false;
    var k = e.key.toLowerCase(), m = s.cur.mission, P = m.player;
    var map = { arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1], arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0] };
    var acts = { t: 'endturn', o: 'observe', e: 'extract', c: 'collect', x: 'access', h: 'hide', f: 'disable', n: 'neutralize' };
    if (map[k]) { var r1 = tacDo(s, 'move', { x: P.x + map[k][0], y: P.y + map[k][1] }); after(r1.res, r1.snd); return true; }
    if (acts[k]) { var r2 = tacDo(s, acts[k]); after(r2.res, r2.snd); return true; }
    return false;
  }
  function act(el, ev) {
    var a = el.getAttribute('data-act'), k = el.getAttribute('data-k'), p = el.getAttribute('data-p'), s = G.state;
    switch (a) {
      case 'help': return openHelp(k);
      case 'closemodal': return closeModal();
      case 'tab': UI.tab = k; top(); AU.play('click'); return render();
      case 'gomenu': UI.screen = 'menu'; top(); AU.play('click'); return render();
      case 'new': return openSetup('', null);
      case 'rndseed': var si = $('seedIn'); if (si) si.value = U.randomSeed(); return;
      case 'replay': return openSetup(k, p);
      case 'start':
        var seed = ($('seedIn') && $('seedIn').value) || '', dEl = document.querySelector('input[name=diff]:checked'), diff = dEl ? dEl.value : 'normal';
        G.meta.settings.difficulty = diff; G.meta.settings.hints = $('hintsIn') ? $('hintsIn').checked : true;
        if (G.state && G.state.phase !== 'end') G.abandon();
        G.meta.settings.inherit = $('inhIn') ? $('inhIn').checked : true;
        G.newRun(seed, diff, G.meta.settings.inherit); closeModal(); UI.screen = 'run'; UI.tab = 'map'; UI.selNode = null; UI.tacMode = 'move'; UI.tacPreview = null; UI.inspect = ''; UI.target = null; UI._prev = null; top();
        G.saveMeta(); AU.play('good'); return render();
      case 'continue-run': UI.screen = 'run'; UI.tab = 'map'; UI.tacMode = 'move'; top(); AU.play('click'); return render();
      case 'history': UI.screen = 'history'; top(); return render();
      case 'howto': UI.screen = 'howto'; top(); return render();
      case 'world': UI.screen = 'world'; top(); return render();
      case 'reset-world': return openModal('<h2>¿Borrar el mundo?</h2><p>Se perderán fantasmas, memoria de SATURNO, red clandestina, descubrimientos e historial. No se puede deshacer.</p><div class="row"><button class="btn danger" data-act="reset-world-yes">Borrar todo</button><button class="btn" data-act="closemodal">Cancelar</button></div>');
      case 'reset-world-yes': closeModal(); PE.reset(G.meta); G.saveMeta(); toast('Mundo reiniciado.'); return render();
      case 'settings': return openSettings();
      case 'set': G.meta.settings[k] = k === 'muted' ? !G.meta.settings.muted : !G.meta.settings[k]; applySettings(); G.saveMeta(); AU.play('click'); openSettings(); return render();
      case 'reset-hints': G.meta.hintsSeen = []; G.saveMeta(); toast('Tutorial reiniciado.'); return;
      case 'daysed': var si2 = $('seedIn'); if (si2) si2.value = dayLabel(); return;
      case 'mute': G.meta.settings.muted = !G.meta.settings.muted; AU.setMuted(G.meta.settings.muted); G.saveMeta(); AU.play('click'); return render();
      case 'abandon':
        return openModal('<h2>¿Abandonar la operación?</h2><p>La partida quedará registrada en tu historial como abandonada.</p><div class="row"><button class="btn danger" data-act="abandon-yes">Abandonar</button><button class="btn" data-act="closemodal">Seguir jugando</button></div>');
      case 'abandon-yes': closeModal(); G.abandon(); UI.screen = 'end'; top(); return render();
      case 'hint': if (G.meta.hintsSeen.indexOf(k) < 0) G.meta.hintsSeen.push(k); G.saveMeta(); return render();
      case 'copyseed':
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.seed).then(function () { toast('Semilla copiada.'); }, function () { toast('Semilla: ' + s.seed); });
        else toast('Semilla: ' + s.seed);
        return;
    }
    if (!s) return;
    switch (a) {
      case 'sel': UI.selNode = k; AU.play('click'); return render();
      case 'scan': return after(G.scanNode(s, k, false), 'good');
      case 'enter': UI.selNode = null; UI.tacMode = 'move'; top(); return after(G.enterNode(s, k), 'sat');
      case 'backchannel': return after(G.backChannel(s), 'good');
      case 'op': UI.tacMode = 'move'; top(); return after(G.doOp(s, k), 'sat');
      case 'withdraw': return after(G.doOp(s, 'withdraw'), 'click');
      case 'tapcell': return tapCell(s, ev);
      case 'tmode': UI.tacMode = (UI.tacMode === k && k !== 'move') ? 'move' : k; AU.play('click'); return render();
      case 'tac':
        var r0 = tacDo(s, k, (k === 'disable' || k === 'neutralize') && UI.target ? UI.target : undefined);
        if (k === 'extract' && r0.res.ok) top();
        return after(r0.res, r0.snd);
      case 'ev': return after(G.eventChoice(s, parseInt(k, 10)), 'click');
      case 'safe': return after(G.safeAction(s, k), 'good');
      case 'finale': return after(G.finale(s, k), 'click');
      case 'continue': top(); return after(G.finishNode(s), 'click');
      case 'use': var r3 = G.useItem(s, parseInt(k, 10), p || undefined); if (r3.ok) toast(r3.msg); return after(r3, 'good');
      case 'verify': return after(G.verifyEvidence(s, k), 'good');
      case 'favor': var r4 = G.activateContact(s, k); if (r4.ok) toast(r4.msg); return after(r4, 'good');
    }
  }

  UI.init = function () {
    document.body.addEventListener('click', function (e) {
      var el = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!el || el.disabled) return;
      try { act(el, e); } catch (err) { if (window.console) console.error(err); toast('Algo salió mal. Volviendo al menú.'); UI.screen = 'menu'; closeModal(); render(); }
    });
    document.body.addEventListener('keydown', function (e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target && e.target.getAttribute && e.target.getAttribute('role') === 'button' && e.target.getAttribute('data-act')) {
        e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      if (e.key === 'Escape' && UI.modal) closeModal();
    });
    var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { if (UI.screen === 'run' && UI.tab === 'map') render(); }, 150); });
    document.addEventListener('keydown', function (e) { if (!e.ctrlKey && !e.metaKey && !e.altKey && keyAction(e)) e.preventDefault(); });
    applySettings();
    render();
  };
  UI.render = render;
  W4.UI = UI;
})();
