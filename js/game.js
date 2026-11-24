/* Reglas y máquina de estados. Lógica pura: sin acceso al DOM. Todo el estado es JSON simple. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U, W = W4.World, SAT = W4.Saturno, EV = W4.Events, M = W4.Missions, SV = W4.Save, PE = W4.Persist, MG = W4.Minigames;

  var DIFF = {
    easy:   { label: 'Analista',  desc: 'Más energía y herramientas. SATURNO se adapta despacio.', energy: 10, integ: 100, vis: 0,  noise: 5, trust: 1, items: ['ghostsim', 'decoy', 'jammer', 'sniffer'], adapt: 0.75 },
    normal: { label: 'Operativo', desc: 'La experiencia pensada.',                                 energy: 8,  integ: 100, vis: 8,  noise: 0, trust: 1, items: ['decoy', 'ghostsim'],              adapt: 1.0 },
    hard:   { label: 'Fantasma',  desc: 'Pocos recursos. SATURNO aprende rápido.',                 energy: 7,  integ: 85,  vis: 14, noise: 0, trust: 0, items: ['ration'],                         adapt: 1.35 }
  };

  var ITEMS = {
    ration:  { name: 'Celdas de Ración',        desc: 'Recupera 3 de energía.' },
    ghostsim:{ name: 'SIM Fantasma',            desc: 'Reduce 20 la Visibilidad.' },
    decoy:   { name: 'Guion Señuelo',           desc: 'Enséñale a SATURNO un hábito falso: elige un enfoque y creerá que lo prefieres.', param: 'approach' },
    jammer:  { name: 'Inhibidor de Señal',      desc: 'Tu próxima misión ignora las contramedidas de SATURNO.' },
    burner:  { name: 'Credenciales Desechables',desc: 'Tu próxima misión: la sospecha que acumulas baja un 30%.' },
    sniffer: { name: 'Rastreador de Paquetes',  desc: 'Escanea un nodo gratis. Selecciónalo en el mapa, o úsalo dentro del nodo.', param: 'node' }
  };
  var ITEM_POOL = ['ration', 'ration', 'ghostsim', 'decoy', 'jammer', 'burner', 'sniffer'];
  var MAX_ITEMS = 6;

  var ENDINGS = {
    exposure: { title: 'EXPOSICIÓN', tag: 'Evidencia verificada, publicada desde la fuente.',
      text: 'Liberas el archivo a la vista de todos, firmado y contrastado. SATURNO no puede llamarlo rumor. Las instituciones que dependían de su silencio empiezan a responder preguntas y, por primera vez, no puede predecir cuáles.',
      cost: 'El sistema sobrevive, pero una de sus estructuras de control no.' },
    liberation: { title: 'LIBERACIÓN', tag: 'Una red que te sobrevive.',
      text: 'Relés, contactos y rutas independientes se sostienen sin centro. Cuando SATURNO barre la malla no encuentra nada que cortar: ni líder, ni lista, solo personas que hablan entre sí.',
      cost: 'Independencia no es seguridad. Cada nodo que construiste es ahora un blanco.' },
    reform: { title: 'REFORMA', tag: 'Un sistema que ahora debe explicarse.',
      text: 'Con pruebas en la mano y el modelo fallando una y otra vez contigo, fuerzas una audiencia. SATURNO queda limitado: sus predicciones deben registrarse, impugnarse y, a veces, ser anuladas por una persona.',
      cost: 'Varela lo llama un compromiso. No le falta razón.' },
    stability: { title: 'ESTABILIDAD', tag: 'Un pacto con el sistema.',
      text: 'Aceptas el argumento de Varela: menos sorpresas, menos heridos. A cambio, SATURNO acepta límites escritos y tú un lugar dentro de la institución. La calma llega pronto y es real, y todos los que alguna vez dudaron de ti la notan.',
      cost: 'SATURNO sabe más de ti que nunca. La resistencia no confía en tu palabra.' },
    resonance: { title: 'RESONANCIA', tag: 'La señal que ya no te necesita.',
      text: 'El Ruido deja de depender de ti. Cada relé, cada contacto y cada rumor se refuerzan entre sí hasta que SATURNO ya no distingue una fuente de otra. Nadie dirige lo que ocurre a continuación.',
      cost: 'No hay plan, ni líder, ni garantía. Solo una red que se sostiene sola.' },
    anomaly: { title: 'SIN CLASIFICAR', tag: 'El patrón que no es un patrón.',
      text: 'El modelo no converge. Cada predicción falla, cada clasificación caduca antes de escribirse. SATURNO te etiqueta "SIN CLASIFICAR" y entonces, por primera vez, pregunta qué significa eso.',
      cost: 'Nadie puede describir lo que hiciste. Ni siquiera tú.' }
  };
  var DEFEATS = {
    neutralized: { title: 'NEUTRALIZADO', text: 'La Visibilidad llegó a 100%. SATURNO tiene ahora una imagen completa de este operativo y actúa en consecuencia.' },
    integrity:   { title: 'COLAPSO DE IDENTIDAD', text: 'La integridad de identidad llegó a cero. Cada credencial que llevabas fue invalidada.' },
    abandoned:   { title: 'ABANDONADO', text: 'La operación se retiró antes de llegar a una conclusión.' },
    confronted:  { title: 'SUPERADO', text: 'Te enfrentaste a Primarca sin los medios para terminarlo. SATURNO cerró el círculo a tu alrededor.' }
  };
  var FAVORS = {
    vis: 'Coartada: -20 de Visibilidad.', energy: 'Paso seguro: +4 de energía.', verify: 'Autenticar: verifica hasta 3 evidencias.',
    noise: 'Amplificar: +12 de Ruido.', intel: 'Contramodelo: SATURNO olvida el 40% de lo que sabe.'
  };

  var G = { meta: null, state: null, DIFF: DIFF, ITEMS: ITEMS, ENDINGS: ENDINGS, DEFEATS: DEFEATS, FAVORS: FAVORS };

  /* ---------- auxiliares ---------- */
  function log(state, msg, kind) {
    state.log.push({ t: state.turn, m: msg, k: kind || 'info' });
    if (state.log.length > 200) state.log.shift();
  }
  function persist() { if (G.meta) SV.save(G.meta, G.state && G.state.phase !== 'end' ? G.state : null); }
  function node(state, id) { return W.getNode(state, id); }
  function evidenceWeight(state) { return state.evidence.reduce(function (a, e) { return a + (e.verified ? 2 : 1); }, 0); }
  function verifiedCount(state) { return state.evidence.filter(function (e) { return e.verified; }).length; }
  var DISCOVERY_FLAGS = ['archive_key', 'ghost_hint', 'knows_pattern', 'fabrication_proof'];
  function discoveries(state) { return DISCOVERY_FLAGS.filter(function (f) { return state.flags.indexOf(f) >= 0; }).length; }

  var EV_SUBJECTS = ['Expediente judicial alterado', 'Registro de matrícula borrado', 'Archivo de queja reclasificado', 'Registro falso de cómplice', 'Exportación de puntaje conductual', 'Bitácora de marcas de control', 'Archivo de titular editado', 'Rastro de perfil inactivo', 'Memorando institucional', 'Nota de auditoría sin registrar', 'Carta sellada de cumplimiento', 'Orden de retención predictiva'];

  function addEvidence(state, n, verified) {
    for (var i = 0; i < n; i++) {
      var code = 1000 + Math.floor(U.rollState(state) * 9000);
      state.evidence.push({ id: U.uid('ev'), title: U.pickState(state, EV_SUBJECTS) + ' #' + code, layer: state.layerIdx, verified: !!verified });
    }
  }
  function addItem(state, id) {
    if (id === 'rand') id = U.pickState(state, ITEM_POOL);
    if (!ITEMS[id]) return null;
    if (state.items.length >= MAX_ITEMS) { log(state, 'Mochila llena: ' + ITEMS[id].name + ' se queda atrás.', 'warn'); return null; }
    state.items.push(id); state.stats.items++;
    return ITEMS[id].name;
  }
  function addContact(state, c) {
    for (var i = 0; i < state.contacts.length; i++) if (state.contacts[i].name === c.name) return null;
    state.contacts.push({ id: U.uid('ct'), name: c.name, role: c.role, favor: c.favor, used: false, layer: state.layerIdx });
    return c.name;
  }

  function applyFx(state, fx) {
    fx = fx || {};
    var r = state.res, mods = W.layerMods(state);
    var b = { vis: r.vis, div: r.div, noise: r.noise, energy: r.energy, integ: r.integ, trust: r.trust, ev: state.evidence.length };
    var out = { items: [], contact: null, notes: [] };
    if (fx.vis) r.vis = U.clamp(r.vis + fx.vis, 0, 100);
    if (fx.div) r.div = U.clamp(r.div + (fx.div > 0 ? fx.div * (mods.divMult || 1) : fx.div), 0, 100);
    if (fx.noise) r.noise = U.clamp(r.noise + (fx.noise > 0 ? Math.round(fx.noise * (mods.noiseMult || 1)) : fx.noise), 0, 100);
    if (fx.energy) r.energy = U.clamp(r.energy + fx.energy, 0, r.maxEnergy);
    if (fx.integ) r.integ = U.clamp(r.integ + fx.integ, 0, 100);
    if (fx.trust) r.trust = Math.max(0, r.trust + fx.trust);
    if (fx.evidence) addEvidence(state, fx.evidence, false);
    if (fx.evidenceV) addEvidence(state, fx.evidenceV, true);
    if (fx.item) { var nm = addItem(state, fx.item); if (nm) out.items.push(nm); }
    if (fx.contact) { out.contact = addContact(state, fx.contact); }
    if (fx.flag && state.flags.indexOf(fx.flag) < 0) state.flags.push(fx.flag);
    if (fx.feed) { SAT.feed(state, fx.feed, 3); out.notes.push('SATURNO ahora cree que prefieres ' + SAT.LABEL[fx.feed].toUpperCase() + '.'); }
    if (fx.relay) state.relays += fx.relay;
    if (fx.rep) Object.keys(fx.rep).forEach(function (f) { if (state.rep[f] != null) state.rep[f] = U.clamp(state.rep[f] + fx.rep[f], -5, 5); });
    if (fx.verify) { var vk = 0; state.evidence.forEach(function (e) { if (!e.verified && vk < fx.verify) { e.verified = true; vk++; } }); if (vk) out.notes.push(vk + ' evidencia(s) verificada(s).'); }
    if (fx.mask) { state.masks = (state.masks || 0) + fx.mask; out.notes.push('Ganas ' + fx.mask + ' máscara(s): cada una absorbe una detección en misión.'); }
    if (fx.scanAll && state.cur) { var cn = node(state, state.cur.nodeId); (cn ? cn.next : []).forEach(function (id) { var x = node(state, id); if (x) x.scanned = true; }); out.notes.push('Los nodos siguientes quedan escaneados.'); }
    if (fx.strike) { SAT.strike(state, fx.strike); out.notes.push('SATURNO olvidó parte de su modelo sobre ti.'); }
    out.d = {
      vis: Math.round(r.vis - b.vis), div: Math.round(r.div - b.div), noise: Math.round(r.noise - b.noise),
      energy: Math.round(r.energy - b.energy), integ: Math.round(r.integ - b.integ), trust: Math.round(r.trust - b.trust),
      evidence: state.evidence.length - b.ev
    };
    return out;
  }

  function touchStats(state) {
    if (state.res.vis > state.stats.peakVis) state.stats.peakVis = Math.round(state.res.vis);
    if (state.res.div > state.stats.peakDiv) state.stats.peakDiv = Math.round(state.res.div);
  }
  function checkEnd(state) {
    touchStats(state);
    if (state.phase === 'end') return true;
    if (state.res.integ <= 0) { G.endRun(state, 'integrity'); return true; }
    if (state.res.vis >= 100) { G.endRun(state, 'neutralized'); return true; }
    return false;
  }

  /* ---------- ciclo de partida ---------- */
  var FACTIONS = { w4k3up: 'W4K3UP', saturno: 'SATURNO', noise: 'RUIDO', inst: 'OPERADORES' };
  G.FACTIONS = FACTIONS;
  G.init = function () {
    var d = SV.load();
    G.meta = d.meta; G.state = d.run; G.recovered = d.recovered;
    if (G.state) { SAT.ensure(G.state.saturno); G.state.ghosts = G.state.ghosts || []; G.state.decisions = G.state.decisions || []; G.state.ghostLayers = G.state.ghostLayers || []; G.state.rep = G.state.rep || { w4k3up: 0, saturno: 0, noise: 0, inst: 0 }; G.state.masks = G.state.masks || 0; }
    return d;
  };
  G.saveMeta = function () { persist(); };

  G.newRun = function (seed, diffKey, inherit) {
    seed = String(seed || '').trim().toUpperCase().slice(0, 24) || U.randomSeed();
    var D = DIFF[diffKey] || DIFF.normal;
    var layers = W.generate(seed);
    var rng = new U.RNG(seed + '|run');
    var s = {
      v: SV.VERSION, seed: seed, diff: DIFF[diffKey] ? diffKey : 'normal', adapt: D.adapt, rngState: rng.s,
      layerIdx: 0, layers: layers, availIds: [layers[0].nodes[0].id], lastNodeId: null, phase: 'map', cur: null,
      res: { vis: D.vis, div: 0, noise: D.noise, energy: D.energy, maxEnergy: D.energy, integ: D.integ, trust: D.trust },
      evidence: [], contacts: [], items: D.items.slice(), armed: {}, flags: [], seen: [], relays: 0,
      saturno: SAT.init(), routePred: null, log: [], turn: 0, backchannel: false, end: null,
      stats: { nodes: 0, ops: 0, success: 0, fails: 0, peakVis: D.vis, peakDiv: 0, surprised: 0, hits: 0, items: 0, scans: 0 }
    };
    s.ghosts = []; s.decisions = []; s.ghostLayers = []; s.rep = { w4k3up: 0, saturno: 0, noise: 0, inst: 0 }; s.masks = 0;
    if (inherit !== false) PE.applyStart(s, G.meta);
    G.state = s;
    log(s, 'Conexión establecida. Semilla ' + seed + '. Dificultad: ' + D.label + '.', 'sys');
    log(s, 'Capa 0: Clearnet. Algo aquí no coincide con el registro oficial.', 'sys');
    if (s.inherited && s.inherited.lines.length) log(s, 'Herencia del mundo: ' + s.inherited.lines.length + ' efecto(s) activo(s). Revisa la pestaña Operativo.', 'sat');
    G.meta.lastSeed = seed;
    persist();
    return s;
  };

  G.abandon = function () { if (G.state && G.state.phase !== 'end') G.endRun(G.state, 'abandoned'); };

  function computeRoute(state) {
    var layer = state.layers[state.layerIdx];
    layer.nodes.forEach(function (n) { if (n.status !== 'current') n.watch = false; });
    var opts = state.availIds.map(function (id) { return node(state, id); }).filter(Boolean);
    var pred = SAT.predictRoute(state, opts);
    state.routePred = pred;
    if (pred && pred.conf >= 0.3 && pred.n >= 2) {
      var n = node(state, pred.nodeId);
      if (n) { n.watch = true; log(state, 'SATURNO espera que tomes la ruta ' + (pred.kind === 'safe' ? 'más segura' : 'más riesgosa') + '. Vigila ' + n.name + '.', 'sat'); }
    }
  }

  G.scanNode = function (state, id, free) {
    var n = node(state, id);
    if (!n) return { ok: false, msg: 'Nodo desconocido.' };
    if (n.scanned) return { ok: false, msg: 'Ya fue escaneado.' };
    var cost = (free || W.layerMods(state).obsFree) ? 0 : 1;
    if (state.res.energy < cost) return { ok: false, msg: 'Energía insuficiente.' };
    state.res.energy -= cost; n.scanned = true; state.stats.scans++; state.saturno.scans++;
    log(state, 'Escaneado ' + n.name + ': amenaza ' + n.threat + (n.type === 'safehouse' ? ' (seguro)' : '') + '.', 'info');
    persist();
    return { ok: true };
  };

  G.enterNode = function (state, id) {
    if (state.phase !== 'map') return { ok: false, msg: 'Termina primero lo que estás haciendo.' };
    var n = node(state, id);
    if (!n || state.availIds.indexOf(id) < 0) return { ok: false, msg: 'Ese nodo no es alcanzable.' };
    var opts = state.availIds.map(function (i) { return node(state, i); }).filter(Boolean);
    var obs = SAT.observeRoute(state, n, opts);
    opts.forEach(function (o) { if (o.id !== n.id) o.watch = false; });
    state.routePred = null; state.backchannel = false; state.turn++;
    n.status = 'current';
    var cur = { nodeId: id, kind: 'op', stage: 'brief', routeObs: obs, result: null, intercept: null };
    if (obs) log(state, 'SATURNO predijo una ruta ' + (obs.predicted === 'safe' ? 'segura' : 'riesgosa') + '; tomaste una ' + (obs.actual === 'safe' ? 'segura' : (obs.actual === 'risky' ? 'riesgosa' : 'intermedia')) + '. ' + (obs.hit ? 'La predicción acertó.' : 'La predicción falló.'), 'sat');
    var r = state.res;
    if (r.vis >= 70 && U.rollState(state) < (r.vis - 60) / 100) {
      r.integ = Math.max(0, r.integ - 12); r.vis = Math.max(0, r.vis - 8);
      cur.intercept = 'Interceptado al entrar: -12 Integridad, -8 Visibilidad. SATURNO te perdió un momento, pero no por mucho.';
      log(state, cur.intercept, 'warn');
    }
    if (n.type === 'safehouse') cur.kind = 'safe';
    else if (n.final) cur.kind = 'finale';
    else if (n.type === 'social' || n.type === 'resource') {
      var ev = EV.select(state, n.type);
      cur.kind = 'event'; cur.eventId = ev.id;
      if (!ev.repeatable && !ev.fallback) state.seen.push(ev.id);
    } else {
      var pred = SAT.predictApproach(state, n.type);
      cur.pred = pred; cur.counter = SAT.countermeasure(state, pred);
      cur.trap = !!(n.rescue && state.saturno.help >= 1.5 && (U.hashSeed(state.seed + n.id) % 10) < 7);
      cur.toolPred = SAT.predictTool(state); cur.tcm = SAT.toolCounter(state, cur.toolPred);
      SAT.observeEnergy(state);
      if (state.ghosts.length && state.layerIdx >= 1 && state.ghostLayers.indexOf(state.layerIdx) < 0 && U.rollState(state) < (W.layerMods(state).ghostP || 0.4)) {
        cur.ghost = state.ghosts[Math.floor(U.rollState(state) * state.ghosts.length)].id; state.ghostLayers.push(state.layerIdx);
        log(state, 'Un eco de una operación anterior opera en este nodo.', 'sat');
      }
      if (pred.n >= 3 && pred.conf >= 0.5 && state.turn % 3 === 0) log(state, 'SATURNO transmite: "Tu próximo enfoque será ' + SAT.LABEL[pred.approach].toUpperCase() + '." No es una amenaza; es una demostración.', 'sat');
    }
    state.cur = cur; state.phase = 'node';
    log(state, 'Entraste en ' + n.name + '.', 'info');
    if (!checkEnd(state)) persist();
    return { ok: true };
  };

  var FLAVOR = {
    stealth: { clean: 'Te moviste como un rumor. Nada te registró.', success: 'Entraste y saliste. Queda un rastro menor.', partial: 'Saliste sin cumplir todo, pero con lo que pudiste cargar.', fail: 'Fuiste visto antes de terminar. Escapaste, pero no sin dejar huella.' },
    hack:    { clean: 'El sistema se abrió con cortesía y se cerró detrás de ti.', success: 'Sacaste los datos. El registro de intrusión no se verá inocente.', partial: 'Cortaste la conexión antes de terminar. Algo se salvó.', fail: 'Una contramedida mordió tu sesión. Quemaste la conexión.' },
    direct:  { clean: 'Forzaste la puerta y cedió. Todos lo notaron.', success: 'Ruidoso, desordenado, y funcionó.', partial: 'Te abriste paso hasta la salida a medias. Algo se salvó.', fail: 'Todo salió mal al mismo volumen.' }
  };

  var TCM_TEXT = { distract: 'los señuelos atraen solo a patrullas cercanas y por poco tiempo', hide: 'las coberturas ya no te ocultan a 2 celdas', disable: 'desactivar sensores cuesta 2 PA', observe: 'observar cuesta 2 PA' };
  G.TCM_TEXT = TCM_TEXT;
  var WHO = [{ name: 'Irene Soto', role: 'Archivista', favor: 'verify' }, { name: 'Dario Vega', role: 'Técnico de red', favor: 'energy' }, { name: 'Noor Hadad', role: 'Periodista', favor: 'noise' }, { name: 'Pablo Ríos', role: 'Mensajero', favor: 'vis' }, { name: 'Ximena Cruz', role: 'Analista desertora', favor: 'intel' }];
  function pickWho(state, n) {
    var start = U.hashSeed(n.id + state.seed) % WHO.length;
    for (var i = 0; i < WHO.length; i++) {
      var w = WHO[(start + i) % WHO.length];
      if (!state.contacts.some(function (c) { return c.name === w.name; })) return w;
    }
    return WHO[start];
  }
  // Brief -> inicia la misión táctica con el enfoque elegido.
  G.doOp = function (state, ap) {
    var cur = state.cur;
    if (!cur || cur.kind !== 'op' || cur.stage !== 'brief' || cur.result) return { ok: false, msg: 'No hay operación pendiente.' };
    var n = node(state, cur.nodeId), r = state.res, mods = W.layerMods(state);
    if (ap === 'withdraw') {
      var o = applyFx(state, { vis: 3 });
      cur.result = { title: 'Retirada', outcome: 'withdraw', text: 'Te retiras antes de que algo quede registrado. SATURNO anota la duda.', fx: o, lines: [] };
      cur.stage = 'result';
      log(state, 'Te retiraste de ' + n.name + '.', 'info');
      if (!checkEnd(state)) persist();
      return { ok: true };
    }
    var A = M.APPROACHES[ap];
    if (!A) return { ok: false, msg: 'Enfoque desconocido.' };
    var cost = M.energyCost(state, ap);
    if (r.energy < cost) return { ok: false, msg: 'Energía insuficiente (' + cost + ').' };
    r.energy -= cost;
    var lines = [], pred = cur.pred;
    // La predicción se guardó ANTES de la acción: se puntúa y luego SATURNO aprende.
    if (pred && pred.n >= 2) {
      var dv = SAT.updateDivergence(state, 'op', pred.approach, ap, pred.conf);
      lines.push('SATURNO predijo ' + SAT.LABEL[pred.approach].toUpperCase() + ' (' + Math.round(pred.conf * 100) + '%). Usaste ' + SAT.LABEL[ap].toUpperCase() + '. ' +
        (dv.hit ? 'La predicción acertó: Divergencia ' + dv.div + '.' : 'La predicción falló: Divergencia +' + dv.div + '.'));
    } else if (pred) lines.push('SATURNO aún tenía muy pocos datos para predecirte.');
    SAT.observeApproach(state, n.type, ap);
    var counterOn = !!(cur.counter && cur.counter.approach === ap && !state.armed.jam);
    var cm = counterOn ? (cur.counter.penalty >= 15 ? 2 : 1) : 0;
    if (cur.counter && cur.counter.approach === ap && state.armed.jam) lines.push('Tu inhibidor anuló la contramedida de SATURNO.');
    var tcmOn = !!(cur.tcm && !state.armed.jam);
    if (cur.tcm && state.armed.jam) lines.push('Tu inhibidor también anuló el entrenamiento táctico de SATURNO.');
    else if (tcmOn) lines.push('SATURNO entrenó a sus unidades contra ' + SAT.TOOL_LABEL[cur.tcm.tool].toUpperCase() + ': ' + TCM_TEXT[cur.tcm.tool] + '.');
    SAT.observeType(state, n.type);
    var ctx = { puzzle: G.meta.settings.hackGame !== false, tcm: tcmOn ? cur.tcm.tool : null, vision: (mods.fog && r.noise < 30) ? 3 : 6, remote: !!mods.remote, hackExtra: mods.hackCost || 0, masks: state.masks || 0, sealed: !!(mods.sealed && !n.scanned), burner: !!state.armed.burner, susp: r.vis >= 70 ? 1.3 : (r.vis >= 40 ? 1.15 : 1) };
    var gObj = null, gs = cur.ghost ? state.ghosts.filter(function (x) { return x.id === cur.ghost; })[0] : null;
    if (gs) { var gp = PE.ghostProfile(gs); gObj = { id: gs.id, name: gs.name, mode: gp.mode, ignoreDecoy: gp.ignoreDecoy, label: gs.label }; lines.push('Tu fantasma ' + gs.name + ' opera aquí: ' + PE.MODE_TEXT[gp.mode]); }
    cur.mission = M.generate(state.seed, n, ap, cm, ctx, n.scanned, M.effThreat(state, n), gObj, n.rescue ? { trap: !!cur.trap, who: pickWho(state, n) } : null);
    if (r.div >= 60) { cur.mission.player.maxAp += 1; cur.mission.player.ap += 1; lines.push('El modelo de SATURNO está ciego contigo: +1 PA en esta misión.'); }
    cur.stage = 'tac'; cur.startLines = lines; cur.cmCount = cm;
    state.armed = {};
    state.stats.ops++;
    log(state, 'Misión en ' + n.name + ' con ' + A.label + '.', 'info');
    persist();
    return { ok: true };
  };

  // Acción táctica del jugador.
  G.tac = function (state, action, params) {
    var cur = state.cur;
    if (!cur || cur.stage !== 'tac' || !cur.mission) return { ok: false, msg: 'No hay misión activa.' };
    var res = M.act(cur.mission, action, params);
    if (!res.ok) return res;
    if (cur.mission.status !== 'play') resolveMission(state);
    persist();
    return res;
  };

  function resolveMission(state) {
    var cur = state.cur, m = cur.mission, n = node(state, cur.nodeId), ap = m.approach, A = M.APPROACHES[ap], mods = W.layerMods(state);
    var lines = (cur.startLines || []).slice(), fx = {}, outcome, text, title;
    var won = m.status === 'won', partial = m.status === 'extracted';
    var verified = ap === 'hack' || m.terminalUsed;
    var vis = A.vis + (ap === 'direct' ? (mods.directVis || 0) : 0);
    if (partial && n.type === 'gateway') { partial = false; m.status = 'caught'; lines.push('La puerta no se abre sin completar el objetivo: te empuja a cruzar por la fuerza.'); }
    if (won || partial) {
      var ev = m.collected + (won && m.pickups.length === 0 ? n.rewards.evidence : 0);
      if (verified) fx.evidenceV = ev; else fx.evidence = ev;
      if (won) {
        outcome = m.alerted ? 'success' : 'clean'; title = m.alerted ? 'Éxito' : 'Éxito limpio';
        fx.vis = outcome === 'clean' ? Math.max(1, Math.round(vis / 2)) : vis;
        var nz = n.rewards.noise + A.noise; if (nz) fx.noise = nz;
        if (n.rewards.item) fx.item = 'rand';
        if (n.rewards.relay) fx.relay = 1;
        if (n.rewards.strike) fx.strike = 0.5;
        text = FLAVOR[ap][outcome === 'clean' ? 'clean' : 'success'];
        state.stats.success++;
      } else {
        outcome = 'partial'; title = 'Extracción parcial'; fx.vis = vis; text = FLAVOR[ap].partial;
      }
    } else {
      outcome = 'fail'; title = 'Fracaso'; state.stats.fails++;
      fx.vis = A.failVis; fx.integ = -(A.failInteg + (M.effThreat(state, n) >= 4 ? 2 : 0));
      if (ap === 'direct') fx.noise = 4;
      n.scanned = true;
      text = m.status === 'timeout' ? 'Se acabó el tiempo y tuviste que huir sin nada.' : FLAVOR[ap].fail;
      if (n.type === 'gateway') { fx.integ -= 4; fx.vis += 5; text += ' La puerta te obliga a cruzar de todos modos, a un precio.'; }
      if (m.collected) lines.push('Perdiste la evidencia que cargabas.');
    }
    if (m.kills) {
      fx.integ = (fx.integ || 0) - 5 * m.kills; fx.vis = (fx.vis || 0) + 10 * m.kills; fx.noise = (fx.noise || 0) + 4 * m.kills;
      lines.push('Neutralizar patrullas tuvo un costo: -' + (5 * m.kills) + ' Integridad, +' + (10 * m.kills) + ' Visibilidad.');
    }
    if (m.antQ === 'clear' && won) { fx.noise = (fx.noise || 0) + 8; lines.push('El enlace limpio de la antena amplifica tu señal: +8 Ruido.'); }
    if (m.rescue) {
      var RS = m.rescue, who = RS.who;
      if (RS.state === 'free' && won) {
        fx.trust = (fx.trust || 0) + 2; fx.contact = who; fx.rep = fx.rep || {}; fx.rep.w4k3up = (fx.rep.w4k3up || 0) + 1; SAT.noteHelp(state);
        lines.push('Rescataste a ' + who.name + ' (' + who.role + '). Se une a tu red. SATURNO anota que acudes a quien pide ayuda.');
      } else if (RS.state === 'trap') {
        fx.evidence = (fx.evidence || 0) + 1; fx.flag = fx.flag || 'fabrication_proof';
        lines.push('Era un señuelo fabricado por SATURNO. Guardas la señal falsa como prueba de que fabrica peticiones de auxilio.');
      } else if (RS.state === 'captured') {
        fx.trust = (fx.trust || 0) - 1; fx.rep = fx.rep || {}; fx.rep.w4k3up = (fx.rep.w4k3up || 0) - 1;
        lines.push(who.name + ' fue capturada. La red lo sabrá.');
      } else if (RS.state === 'free') lines.push('No lograste sacar a ' + who.name + ' a tiempo: queda atrás.');
      else lines.push('Dejaste atrás a ' + who.name + ', retenida.');
    }
    // SATURNO puntúa su predicción táctica y luego aprende de lo que hiciste en la misión.
    var tp = cur.toolPred, fav = SAT.favoriteTool(m.acts);
    if (tp && tp.n >= 3 && fav) {
      var dt = SAT.updateDivergence(state, 'tool', tp.tool, fav, tp.conf);
      lines.push('SATURNO esperaba que usaras ' + SAT.TOOL_LABEL[tp.tool].toUpperCase() + ' (' + Math.round(tp.conf * 100) + '%); tu herramienta fue ' + SAT.TOOL_LABEL[fav].toUpperCase() + '. ' + (dt.hit ? 'Acertó.' : 'Falló: Divergencia +' + dt.div + '.'));
    }
    SAT.observeTools(state, m.acts);
    if (won || partial) SAT.observeExtract(state, won);
    if ((state.masks || 0) !== m.masks) { lines.push('Máscaras usadas: ' + ((state.masks || 0) - m.masks) + '. Te quedan ' + m.masks + '.'); state.masks = m.masks; }
    fx.rep = fx.rep || {};
    if (won && n.type === 'disruption') { fx.rep.noise = (fx.rep.noise || 0) + 1; fx.rep.w4k3up = (fx.rep.w4k3up || 0) + 1; }
    if (won && n.type === 'elite') fx.rep.saturno = (fx.rep.saturno || 0) - 1;
    var o2 = applyFx(state, fx);
    lines = lines.concat(o2.notes);
    if (outcome === 'fail' && cur.pred && cur.pred.n >= 2) lines.push('El fracaso revela lo que SATURNO esperaba de ti: ' + SAT.LABEL[cur.pred.approach].toUpperCase() + '.');
    cur.result = { title: title, outcome: outcome, text: text, fx: o2, lines: lines, turns: m.turn };
    cur.stage = 'result';
    log(state, n.name + ': ' + title.toLowerCase() + ' (' + SAT.LABEL[ap] + ').', outcome === 'fail' ? 'warn' : 'good');
    checkEnd(state);
  }

  G.eventChoice = function (state, idx) {
    var cur = state.cur;
    if (!cur || cur.kind !== 'event' || cur.result) return { ok: false, msg: 'No hay evento en curso.' };
    var ev = EV.get(cur.eventId), ch = ev && ev.choices[idx];
    if (!ch) return { ok: false, msg: 'Opción inválida.' };
    if (ch.mg) {
      cur.mg = ch.mg === 'salvat' ? MG.salvatCreate(state) : (ch.mg === 'ghostloop' ? MG.glCreate(state) : MG.hnCreate(state.seed, cur.nodeId));
      state.decisions.push(ev.title + ': ' + ch.label); if (state.decisions.length > 8) state.decisions.shift();
      log(state, 'Comienza un minijuego: ' + ev.title + '.', 'sat'); persist();
      return { ok: true };
    }
    if (ch.debate) {
      cur.debate = MG.debateCreate(state);
      state.decisions.push(ev.title + ': ' + ch.label); if (state.decisions.length > 8) state.decisions.shift();
      log(state, 'Comienza un debate con Varela.', 'sat'); persist();
      return { ok: true };
    }
    var res = ch.fn ? ch.fn(state) : { fx: ch.fx, out: ch.out };
    var fx = res.fx || {};
    if (fx.energy && fx.energy < 0 && state.res.energy < -fx.energy) return { ok: false, msg: 'Energía insuficiente.' };
    if (ch.help || res.help) SAT.noteHelp(state);
    var f2 = {}; Object.keys(fx).forEach(function (k) { f2[k] = fx[k]; });
    if (ch.flag && !f2.flag) f2.flag = ch.flag;
    state.decisions.push(ev.title + ': ' + ch.label); if (state.decisions.length > 8) state.decisions.shift();
    var o = applyFx(state, f2);
    cur.result = { title: ev.title, outcome: 'event', text: res.out, fx: o, lines: o.notes.slice() };
    log(state, ev.title + ': ' + ch.label + '.', 'info');
    if (!checkEnd(state)) persist();
    return { ok: true };
  };

  // Una ronda del debate con Varela; al terminar la tercera se aplican los efectos.
  G.debateChoice = function (state, choice) {
    var cur = state.cur;
    if (!cur || cur.kind !== 'event' || !cur.debate || cur.debate.done || cur.result) return { ok: false, msg: 'No hay debate en curso.' };
    var r = MG.debateChoose(state, cur.debate, choice);
    if (!r) return { ok: false, msg: 'Opción inválida.' };
    if (r.done) {
      var oc = MG.debateOutcome(cur.debate.score), o = applyFx(state, oc.fx);
      cur.result = { title: oc.title, outcome: oc.key === 'lose' ? 'fail' : 'success', text: oc.text, fx: o, lines: ['Puntaje del debate: ' + cur.debate.score + '/6. ' + cur.debate.reaction] };
      log(state, 'Debate con Varela: ' + oc.title.toLowerCase() + ' (' + cur.debate.score + '/6).', oc.key === 'lose' ? 'warn' : 'good');
      if (!checkEnd(state)) persist();
    } else persist();
    return { ok: true };
  };

  function finishMg(state, oc, extra) {
    var cur = state.cur, o = applyFx(state, oc.fx), bad = ['absorbed', 'auto', 'broken'].indexOf(oc.key) >= 0;
    cur.result = { title: oc.title, outcome: bad ? 'fail' : 'success', text: oc.text, fx: o, lines: [extra].concat(o.notes) };
    log(state, oc.title + '.', bad ? 'warn' : 'good');
    if (!checkEnd(state)) persist();
  }
  // Acciones de los minijuegos de evento: clasificar casos, Ghost Loop y red humana.
  G.mgAct = function (state, action, p) {
    var cur = state.cur, g = cur && cur.mg;
    if (!g || cur.result) return { ok: false, msg: 'No hay minijuego en curso.' };
    if (g.type === 'salvat') {
      var ok = action === 'cat' ? MG.salvatPick(g, p) : (action === 'why' ? MG.salvatWhy(g, p) : (action === 'next' ? MG.salvatNext(g) : false));
      if (!ok) return { ok: false, msg: 'Acción no válida.' };
      if (g.done) finishMg(state, MG.salvatOutcome(g), 'Puntaje: ' + g.pts + '/12. Falsos positivos: ' + g.fp + ', falsos negativos: ' + g.fn + '.');
    } else if (g.type === 'ghostloop') {
      var r = action === 'opt' ? MG.glChoose(state, g, p) : null;
      if (!r) return { ok: false, msg: 'Acción no válida.' };
      if (g.done) finishMg(state, MG.glOutcome(g), 'Puntaje: ' + g.pts + '/10. ' + g.fb);
    } else if (cur.mg.edges) {
      if (action === 'toggle') { var t = MG.hnToggle(g, p.a, p.b); if (!t.ok) return t; }
      else if (action === 'test') MG.hnTest(g);
      else if (action === 'confirm') { g.done = true; finishMg(state, MG.hnOutcome(g), 'Coste usado: ' + MG.hnCheck(g, g.links).cost + ' de ' + g.budget + '.'); }
      else return { ok: false, msg: 'Acción no válida.' };
    }
    persist();
    return { ok: true };
  };

  G.safeAction = function (state, kind) {
    var cur = state.cur, r = state.res;
    if (!cur || cur.kind !== 'safe' || cur.result) return { ok: false, msg: 'No hay acción de refugio disponible.' };
    var fx, text;
    if (kind === 'rest') {
      fx = { energy: r.maxEnergy, vis: -20, integ: 12 };
      text = 'Duermes por turnos y despiertas con la cabeza clara. SATURNO anota que te quedaste en silencio.';
      state.saturno.rest++;
    } else if (kind === 'identity') {
      if (r.trust < 1) return { ok: false, msg: 'Requiere 1 de Confianza.' };
      fx = { trust: -1, integ: -8, vis: -30, strike: 0.75 };
      text = 'Un nombre nuevo, un andar nuevo, una historia nueva. El perfil viejo pierde agarre.';
    } else if (kind === 'cover') {
      if (r.noise < 10) return { ok: false, msg: 'Requiere 10 de Ruido.' };
      fx = { noise: -10, vis: -15, energy: 2 };
      text = 'Inundas el canal de charla inofensiva y desapareces dentro de ella.';
    } else return { ok: false, msg: 'Acción desconocida.' };
    var o = applyFx(state, fx);
    cur.result = { title: 'Refugio', outcome: 'safe', text: text, fx: o, lines: o.notes.slice() };
    log(state, 'Refugio: ' + kind + '.', 'good');
    if (!checkEnd(state)) persist();
    return { ok: true };
  };

  // Efectos propios de cada capa y ventajas de facción al descender.
  function layerEnter(state) {
    var L = state.layerIdx;
    if (L === 2) { state.masks = (state.masks || 0) + 2; log(state, 'Recibes 2 máscaras: cada una absorbe una detección en misión.', 'good'); }
    if (L === 4) {
      var unv = state.evidence.filter(function (e) { return !e.verified; });
      if (unv.length) {
        if (state.res.noise >= 20) log(state, 'Tu Ruido protegió tu evidencia de la reescritura narrativa.', 'good');
        else { var lost = unv[unv.length - 1]; state.evidence.splice(state.evidence.indexOf(lost), 1); log(state, 'La reescritura narrativa borró: ' + lost.title + '. Verifica o acumula Ruido para protegerla.', 'warn'); }
      }
    }
    if (state.rep.w4k3up >= 3) { state.res.energy = Math.min(state.res.maxEnergy, state.res.energy + 1); log(state, 'La red W4K3UP te cubre: +1 energía.', 'good'); }
    if (state.rep.noise >= 3) { state.res.noise = Math.min(100, state.res.noise + 3); log(state, 'La señal emergente te encuentra: +3 Ruido.', 'good'); }
  }
  G.finishNode = function (state) {
    var cur = state.cur;
    if (!cur || !cur.result) return { ok: false, msg: 'Nada que terminar.' };
    var n = node(state, cur.nodeId);
    n.status = 'done'; state.stats.nodes++; state.lastNodeId = n.id; state.turn++;
    state.res.energy = Math.min(state.res.maxEnergy, state.res.energy + 2);
    if (n.type === 'gateway' && !n.final && state.layerIdx < 8) {
      state.layerIdx += 1;
      var L = state.layers[state.layerIdx], first = L.nodes[0];
      first.status = 'available';
      state.availIds = [first.id]; state.lastNodeId = null;
      state.res.vis = Math.max(0, state.res.vis - 8);
      layerEnter(state);
      log(state, 'Descendiste a la Capa ' + state.layerIdx + ': ' + W.LAYERS[state.layerIdx].name + '. Visibilidad -8. ' + W.LAYERS[state.layerIdx].rule, 'sys');
    } else {
      state.availIds = n.next.filter(function (id) { var x = node(state, id); return x && x.status !== 'done'; });
    }
    state.cur = null; state.phase = 'map';
    computeRoute(state);
    persist();
    return { ok: true };
  };

  /* ---------- objetos, evidencia, contactos, canal alterno ---------- */
  G.useItem = function (state, idx, param) {
    var id = state.items[idx], it = ITEMS[id];
    if (!it) return { ok: false, msg: 'No existe ese objeto.' };
    var msg = '';
    switch (id) {
      case 'ration': applyFx(state, { energy: 3 }); msg = '+3 de energía.'; break;
      case 'ghostsim': applyFx(state, { vis: -20 }); msg = 'Visibilidad reducida.'; break;
      case 'decoy':
        if (SAT.AP.indexOf(param) < 0) return { ok: false, msg: 'Elige un enfoque para fingir.' };
        SAT.feed(state, param, 3); msg = 'SATURNO ahora se inclina por ' + SAT.LABEL[param].toUpperCase() + '.'; break;
      case 'jammer': state.armed.jam = true; msg = 'Armado: tu próxima misión ignora las contramedidas.'; break;
      case 'burner': state.armed.burner = true; msg = 'Armado: sospecha -30% en tu próxima misión.'; break;
      case 'sniffer':
        var target = null;
        if (state.phase === 'node' && state.cur && state.cur.kind === 'op' && state.cur.stage === 'brief' && !node(state, state.cur.nodeId).scanned) target = state.cur.nodeId;
        else if (param && state.availIds.indexOf(param) >= 0 && !node(state, param).scanned) target = param;
        if (!target) return { ok: false, msg: 'Selecciona primero un nodo sin escanear.' };
        G.scanNode(state, target, true); msg = 'Nodo escaneado.'; break;
      default: return { ok: false, msg: 'No se puede usar.' };
    }
    state.items.splice(idx, 1);
    log(state, 'Usaste ' + it.name + '. ' + msg, 'good');
    if (!checkEnd(state)) persist();
    return { ok: true, msg: msg };
  };

  G.verifyEvidence = function (state, id) {
    var e = state.evidence.filter(function (x) { return x.id === id; })[0];
    if (!e || e.verified) return { ok: false, msg: 'Nada que verificar.' };
    if (state.res.energy < 1) return { ok: false, msg: 'Requiere 1 de energía.' };
    state.res.energy -= 1; e.verified = true;
    log(state, 'Verificado: ' + e.title + '.', 'good'); persist();
    return { ok: true };
  };

  G.activateContact = function (state, id) {
    var c = state.contacts.filter(function (x) { return x.id === id; })[0];
    if (!c || c.used) return { ok: false, msg: 'Ya se usó.' };
    var freeF = !!W.layerMods(state).freeFavor;
    if (!freeF && state.res.trust < 1) return { ok: false, msg: 'Requiere 1 de Confianza.' };
    if (!freeF) state.res.trust -= 1;
    c.used = true;
    var msg = '';
    switch (c.favor) {
      case 'vis': applyFx(state, { vis: -20 }); msg = 'Visibilidad -20.'; break;
      case 'energy': applyFx(state, { energy: 4 }); msg = '+4 de energía.'; break;
      case 'noise': applyFx(state, { noise: 12 }); msg = 'Ruido aumentado.'; break;
      case 'intel': SAT.strike(state, 0.6); msg = 'SATURNO olvidó parte de su modelo sobre ti.'; break;
      case 'verify':
        var k = 0;
        state.evidence.forEach(function (e) { if (!e.verified && k < 3) { e.verified = true; k++; } });
        msg = k + ' evidencia(s) verificada(s).'; break;
      default: break;
    }
    log(state, c.name + ' cobró un favor. ' + msg, 'good'); persist();
    return { ok: true, msg: msg };
  };

  G.backChannel = function (state) {
    if (state.phase !== 'map') return { ok: false, msg: 'Solo disponible en el mapa.' };
    var bcCost = state.bcCost || 20;
    if (state.res.noise < bcCost) return { ok: false, msg: 'Requiere ' + bcCost + ' de Ruido.' };
    if (state.backchannel) return { ok: false, msg: 'Ya está abierto.' };
    var last = state.lastNodeId && node(state, state.lastNodeId);
    if (!last) return { ok: false, msg: 'Completa primero un nodo.' };
    var deeper = [];
    last.next.forEach(function (id) {
      var a = node(state, id);
      if (a) a.next.forEach(function (id2) { var b = node(state, id2); if (b && b.status !== 'done' && deeper.indexOf(id2) < 0) deeper.push(id2); });
    });
    if (!deeper.length) return { ok: false, msg: 'No hay ruta más profunda desde aquí.' };
    state.res.noise -= bcCost;
    deeper.forEach(function (id) { if (state.availIds.indexOf(id) < 0) state.availIds.push(id); });
    state.backchannel = true;
    log(state, 'Canal alterno abierto: la clandestinidad te llevó más allá de un nodo.', 'good');
    computeRoute(state); persist();
    return { ok: true };
  };

  /* ---------- final y desenlaces ---------- */
  G.finaleStatus = function (state) {
    var r = state.res, ew = evidenceWeight(state), vc = verifiedCount(state);
    function q(label, cur, need) { return { label: label, cur: Math.round(cur), need: need, ok: cur >= need }; }
    var list = [
      { key: 'exposure', req: [q('Peso de evidencia (verificada vale doble)', ew, 14), q('Evidencias verificadas', vc, 3), q('Integridad', r.integ, 20)] },
      { key: 'liberation', req: [q('Ruido', r.noise, 30), q('Contactos', state.contacts.length, 2), q('Relés independientes', state.relays, 2)] },
      { key: 'reform', req: [q('Divergencia', r.div, 45), q('Confianza', r.trust, 4), q('Peso de evidencia', ew, 6)] }
    ];
    list.forEach(function (e) { e.ok = e.req.every(function (x) { return x.ok; }); });
    var an = { key: 'anomaly', req: [q('Divergencia', r.div, 85), q('Descubrimientos', discoveries(state), 2)] };
    an.ok = an.req.every(function (x) { return x.ok; });
    an.hidden = !(r.div >= 70);
    list.push(an);
    var st = { key: 'stability', req: [q('Pacto con Varela', state.flags.indexOf('varela_pact') >= 0 ? 1 : 0, 1), q('Relación con operadores', state.rep.inst, 3), q('Peso de evidencia', ew, 4)] };
    st.ok = st.req.every(function (x) { return x.ok; }); st.hidden = state.flags.indexOf('varela_met') < 0 && state.flags.indexOf('varela_pact') < 0;
    var rs = { key: 'resonance', req: [q('Ruido', r.noise, 60), q('Afinidad con el Ruido', state.rep.noise, 3), q('Relés independientes', state.relays, 1)] };
    rs.ok = rs.req.every(function (x) { return x.ok; }); rs.hidden = r.noise < 40;
    list.push(st); list.push(rs);
    return list;
  };

  G.finale = function (state, key) {
    if (!state.cur || state.cur.kind !== 'finale') return { ok: false, msg: 'No estás en el nodo final.' };
    if (key === 'confront') { G.endRun(state, 'confronted'); return { ok: true }; }
    var st = G.finaleStatus(state).filter(function (e) { return e.key === key; })[0];
    if (!st || !st.ok) return { ok: false, msg: 'No se cumplen los requisitos.' };
    G.endRun(state, 'victory', key);
    return { ok: true };
  };

  G.debrief = function (state, result) {
    var out = [], sh = SAT.shares(state.saturno), S = state.saturno;
    var top = 'stealth'; SAT.AP.forEach(function (a) { if (sh.ap[a] > sh.ap[top]) top = a; });
    if (sh.hasAp && sh.ap[top] >= 0.5) out.push('Te apoyaste en ' + SAT.LABEL[top].toUpperCase() + ' (' + Math.round(sh.ap[top] * 100) + '% de tus acciones observadas). SATURNO se preparó para eso. Varía el enfoque o usa un Guion Señuelo.');
    if (S.help >= 1.5) out.push('Respondías siempre a peticiones de ayuda, así que SATURNO pudo fabricar una. Rastrea la señal antes de acudir.');
    if (state.stats.peakVis >= 85) out.push('La Visibilidad llegó a ' + state.stats.peakVis + '%. Los refugios, las SIM Fantasma y los enfoques silenciosos la bajan.');
    var tcs = SAT.style(state);
    if (tcs) out.push('Tu estilo táctico fue ' + tcs + ': SATURNO lo aprendió y entrenó a sus unidades contra él. Alterna herramientas.');
    if (state.res.noise < 15) out.push('El Ruido se quedó bajo. El Ruido debilita a SATURNO y abre canales alternos.');
    if (state.stats.surprised === 0 && state.stats.hits > 0) out.push('SATURNO nunca se sorprendió. Crea un patrón y rómpelo: la Divergencia crece cuando una predicción confiada falla.');
    if (result === 'confronted') {
      var fs = G.finaleStatus(state).filter(function (e) { return !e.hidden; });
      fs.sort(function (a, b) { return b.req.filter(function (x) { return x.ok; }).length / b.req.length - a.req.filter(function (x) { return x.ok; }).length / a.req.length; });
      var best = fs[0], miss = best.req.filter(function (x) { return !x.ok; }).map(function (x) { return x.label + ' ' + x.cur + '/' + x.need; });
      out.unshift('Desenlace más cercano: ' + ENDINGS[best.key].title + '. Faltó: ' + miss.join(', ') + '.');
    }
    if (!out.length) out.push('Prueba otra ruta por la red, o una semilla distinta, y observa cómo responde SATURNO.');
    return out.slice(0, 4);
  };

  G.endRun = function (state, result, key) {
    if (state.phase === 'end') return;
    var cls = SAT.classify(state);
    var cons = PE.finish(G.meta, state, result, key);
    var entry = {
      id: U.uid('run'), date: Date.now(), seed: state.seed, diff: state.diff, result: result, ending: key || null,
      layer: state.layerIdx, nodes: state.stats.nodes, turns: state.turn, peakVis: state.stats.peakVis, peakDiv: state.stats.peakDiv,
      evidence: evidenceWeight(state), noise: Math.round(state.res.noise), contacts: state.contacts.length,
      label: cls.label, consequences: cons, profile: SAT.snapshot(state), surprised: state.stats.surprised, hits: state.stats.hits
    };
    state.phase = 'end';
    state.end = { result: result, key: key || null, entry: entry, debrief: G.debrief(state, result), classification: cls, consequences: cons };
    G.meta.history.push(entry);
    if (G.meta.history.length > 60) G.meta.history.shift();
    G.meta.lastSeed = state.seed;
    log(state, (result === 'victory' ? 'Operación concluida: ' + ENDINGS[key].title : 'Operación terminada: ' + DEFEATS[result].title) + '.', result === 'victory' ? 'good' : 'bad');
    SV.save(G.meta, null);
  };

  G.discoveries = discoveries; G.evidenceWeight = evidenceWeight; G.verifiedCount = verifiedCount;
  G.node = node;
  W4.Game = G;
})();
