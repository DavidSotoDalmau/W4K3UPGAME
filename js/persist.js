/* Mundo persistente: fantasmas, memoria de SATURNO, red clandestina, descubrimientos y consecuencias.
   La muerte reinicia al operativo, no al mundo. Nada aquí da bonos de combate: solo información, contactos,
   herramientas y condiciones iniciales (y también más memoria para SATURNO). */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U, SAT = W4.Saturno;

  var DISC = {
    archive_key: { label: 'Llave del archivo', desc: 'Empiezas con Credenciales Desechables.' },
    ghost_hint: { label: 'Rastro del perfil fantasma', desc: 'Los fantasmas se identifican en el informe antes de la misión.' },
    knows_pattern: { label: 'Cuaderno de John', desc: 'Empiezas con un Guion Señuelo.' },
    fabrication_proof: { label: 'Prueba de fabricación', desc: 'Empiezas con 1 evidencia verificada.' }
  };
  var MODE = { stealth: 'lurk', hack: 'guard', direct: 'hunt' };
  var MODE_TEXT = {
    lurk: 'Acecha entre coberturas y se mueve cada dos turnos (usaba Sigilo).',
    guard: 'Custodia una terminal con visión de radio 2 (usaba Hackeo).',
    hunt: 'Patrulla en cono y persigue con paso doble cuando te detecta (usaba Directo).'
  };
  var MAX_GHOSTS = 5;

  function top(obj) { var b = null; Object.keys(obj).forEach(function (k) { if (b === null || obj[k] > obj[b]) b = k; }); return b; }
  function sum(obj) { var s = 0; Object.keys(obj).forEach(function (k) { s += obj[k]; }); return s; }
  function norm(obj) { var s = sum(obj), o = {}; Object.keys(obj).forEach(function (k) { o[k] = s > 0 ? obj[k] / s : 0; }); return o; }

  function ghostProfile(g) {
    var ap = g.ap || {}, tac = g.tac || {}, topAp = sum(ap) > 0 ? top(ap) : 'stealth', tsum = sum(tac);
    var distractShare = tsum > 0 ? (tac.distract || 0) / tsum : 0;
    return { topAp: topAp, mode: MODE[topAp], topTool: tsum > 0 ? top(tac) : null, ignoreDecoy: distractShare < 0.3, helps: (g.help || 0) >= 1.5 };
  }

  function createGhost(state) {
    var S = SAT.ensure(state.saturno), nid = (state.cur && state.cur.nodeId) || state.lastNodeId, n = nid ? W4.World.getNode(state, nid) : null;
    return {
      id: U.uid('gh'), name: 'Eco-' + state.seed.slice(-4), date: Date.now(), seed: state.seed, diff: state.diff, label: SAT.classify(state).label,
      ap: U.clone(S.ap), tac: U.clone(S.tac), route: U.clone(S.route), help: S.help, items: state.items.slice(0, 3),
      layer: state.layerIdx, last: n ? { name: n.name, type: n.type, layer: n.layer } : { name: 'Clearnet', type: 'investigation', layer: 0 },
      decisions: (state.decisions || []).slice(-4), contacts: state.contacts.length
    };
  }

  function memory(meta) {
    var k = meta.world.knowledge, strength = Math.min(0.7, 0.3 + 0.12 * k.runs) * (k.mult || 1);
    return { runs: k.runs, strength: k.runs > 0 ? strength : 0 };
  }

  // Resumen de lo que heredará una nueva partida (también sirve para mostrarlo antes de empezar).
  function inheritance(meta) {
    var w = meta.world, out = [], m = memory(meta);
    if (m.runs > 0) out.push('SATURNO recuerda tu historial (' + Math.round(m.strength * 100) + '% de memoria).');
    if (w.ghosts.length) out.push(w.ghosts.length + ' fantasma(s) activo(s): hasta 2 aparecerán en esta operación.');
    if (w.network > 0) out.push('Red clandestina: ' + w.network + ' nodo(s). +' + Math.min(16, 4 * w.network) + ' Ruido inicial' + (w.network >= 3 ? ' y canal alterno por 15.' : '.'));
    if (w.contacts.length) out.push('Contactos veteranos: ' + Math.min(2, w.contacts.length) + '.');
    if (w.vault.length) out.push('Archivo salvado: ' + w.vault.length + ' evidencia(s) verificada(s).');
    w.discoveries.forEach(function (f) { if (DISC[f]) out.push(DISC[f].label + ': ' + DISC[f].desc); });
    if (w.consequences.reform) out.push('Reforma previa: las contramedidas de SATURNO son ' + (10 * Math.min(3, w.consequences.reform)) + '% más débiles.');
    if (w.consequences.anomaly) out.push('Anomalía previa: empiezas con Divergencia 15.');
    return out;
  }

  function pickGhosts(state, meta) {
    var rng = new U.RNG(state.seed + '|ghosts'), pool = rng.shuffle(meta.world.ghosts);
    return pool.slice(0, 2).map(function (g) { return U.clone(g); });
  }

  function applyStart(state, meta) {
    var w = meta.world, S = state.saturno, k = w.knowledge, m = memory(meta);
    state.ghosts = pickGhosts(state, meta); state.decisions = []; state.ghostLayers = [];
    state.inherited = { strength: m.strength, lines: inheritance(meta) };
    if (m.runs > 0) {
      var s = m.strength, ap = k.ap, tc = k.tac;
      SAT.AP.forEach(function (a) { S.ap[a] = (ap[a] || 0) * 3 * s; });
      SAT.TOOLS.forEach(function (t) { S.tac[t] = (tc[t] || 0) * 3 * s; });
      S.route.risky = (k.routeRisk || 0) * 2 * s; S.route.safe = (1 - (k.routeRisk || 0)) * 2 * s;
      S.help = (k.help || 0) * 1.2 * s; S.n = Math.min(4, m.runs * 2); S.nRoute = Math.min(3, m.runs); S.tacN = Math.min(3, m.runs);
    }
    if (w.network) { state.res.noise = Math.min(100, state.res.noise + Math.min(16, 4 * w.network)); if (w.network >= 3) state.bcCost = 15; }
    w.contacts.slice(0, 2).forEach(function (c) { state.contacts.push({ id: U.uid('ct'), name: c.name, role: c.role, favor: c.favor, used: false, layer: 0 }); });
    w.vault.forEach(function (t) { state.evidence.push({ id: U.uid('ev'), title: t, layer: 0, verified: true }); });
    w.discoveries.forEach(function (f) { if (state.flags.indexOf(f) < 0) state.flags.push(f); });
    var give = { archive_key: 'burner', knows_pattern: 'decoy' };
    w.discoveries.forEach(function (f) { if (give[f] && state.items.length < 6) state.items.push(give[f]); });
    if (w.discoveries.indexOf('fabrication_proof') >= 0) state.evidence.push({ id: U.uid('ev'), title: 'Prueba de fabricación de señales', layer: 0, verified: true });
    if (w.consequences.reform) state.satScale = 1 - 0.1 * Math.min(3, w.consequences.reform);
    if (w.consequences.anomaly) state.res.div = 15;
  }

  // Al terminar una partida: fantasma, memoria, red, descubrimientos, contactos, archivo y consecuencias.
  function finish(meta, state, result, key) {
    var w = meta.world, lines = [], S = SAT.ensure(state.saturno), k = w.knowledge;
    if (result === 'abandoned') return ['Abandonar no deja huella en el mundo.'];
    // memoria de SATURNO
    var sh = SAT.shares(S), cur = { ap: sh.ap, tac: norm(S.tac), routeRisk: sh.hasRoute ? sh.routeRisk : 0.5, help: Math.min(1, S.help / 2) };
    var blend = k.runs > 0 ? 0.5 : 1;
    SAT.AP.forEach(function (a) { k.ap[a] = (k.ap[a] || 0) * (1 - blend) + cur.ap[a] * blend; });
    SAT.TOOLS.forEach(function (t) { k.tac[t] = (k.tac[t] || 0) * (1 - blend) + cur.tac[t] * blend; });
    k.routeRisk = k.routeRisk * (1 - blend) + cur.routeRisk * blend; k.help = k.help * (1 - blend) + cur.help * blend;
    k.runs += 1;
    lines.push('SATURNO añadió esta partida a su memoria sobre ti.');
    // descubrimientos, contactos, archivo salvado
    state.flags.forEach(function (f) { if (DISC[f] && w.discoveries.indexOf(f) < 0) { w.discoveries.push(f); lines.push('Descubrimiento conservado: ' + DISC[f].label + '. ' + DISC[f].desc); } });
    state.contacts.forEach(function (c) {
      if (!w.contacts.some(function (x) { return x.name === c.name; })) w.contacts.push({ name: c.name, role: c.role, favor: c.favor });
    });
    w.contacts = w.contacts.slice(-6);
    var keep = Math.floor(state.res.noise / 20), ev = state.evidence.filter(function (e) { return e.verified; }).slice(-Math.min(3, keep));
    w.vault = ev.map(function (e) { return e.title; });
    if (w.vault.length) lines.push('El Ruido preservó ' + w.vault.length + ' evidencia(s) verificada(s) para la próxima operación.');
    // red clandestina
    var add = result === 'victory' ? state.relays : Math.floor(state.relays / 2);
    if (add > 0) { w.network = Math.min(8, w.network + add); lines.push('Nodos clandestinos activos: +' + add + ' (total ' + w.network + ').'); }
    // victoria vs derrota
    if (result === 'victory') {
      w.victories[key] = (w.victories[key] || 0) + 1;
      if (key === 'exposure') { k.mult = Math.max(0.25, (k.mult || 1) * 0.5); lines.push('Estructura de control expuesta: la memoria de SATURNO sobre ti se reduce a la mitad.'); }
      if (key === 'liberation') { w.network = Math.min(8, w.network + 2); lines.push('Liberación: dos nodos clandestinos más sobreviven a la supresión.'); }
      if (key === 'reform') { w.consequences.reform = Math.min(3, w.consequences.reform + 1); lines.push('Reforma: SATURNO queda limitado; sus contramedidas serán un 10% más débiles.'); }
      if (key === 'stability') { k.mult = Math.min(2, (k.mult || 1) * 1.5); w.network = Math.max(0, w.network - 2); lines.push('Estabilidad: SATURNO amplía su memoria sobre ti y la resistencia pierde 2 nodos que no confían en tu pacto.'); }
      if (key === 'resonance') { w.network = Math.min(8, w.network + 3); lines.push('Resonancia: el Ruido sostiene 3 nodos clandestinos nuevos que nadie dirige.'); }
      if (key === 'anomaly') { w.consequences.anomaly = Math.min(2, w.consequences.anomaly + 1); k.runs = 0; k.mult = 1; lines.push('Anomalía: SATURNO olvida por completo tu perfil y tú empiezas con Divergencia 15.'); }
    } else {
      var g = createGhost(state);
      w.ghosts.unshift(g);
      while (w.ghosts.length > MAX_GHOSTS) {
        var old = w.ghosts.pop();
        w.archive.unshift({ name: old.name, date: old.date, seed: old.seed, label: old.label, last: old.last, topAp: ghostProfile(old).topAp, decisions: old.decisions });
        w.archive = w.archive.slice(0, 30);
        lines.push('El fantasma ' + old.name + ' pasó al archivo histórico.');
      }
      lines.unshift('SATURNO creó un fantasma de esta partida: ' + g.name + '. ' + MODE_TEXT[ghostProfile(g).mode]);
    }
    return lines;
  }

  function reset(meta) { meta.world = W4.Save.defaultWorld(); meta.history = []; }

  W4.Persist = { DISC: DISC, MODE_TEXT: MODE_TEXT, ghostProfile: ghostProfile, inheritance: inheritance, memory: memory, applyStart: applyStart, finish: finish, reset: reset, MAX_GHOSTS: MAX_GHOSTS };
})();
