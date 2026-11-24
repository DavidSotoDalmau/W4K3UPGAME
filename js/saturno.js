/* SATURNO: transparent behavioral prediction engine.
   Weighted, exponentially-decayed action frequencies. No hidden information, no future reads:
   every prediction is computed BEFORE the player acts and stored so it can be audited later. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U;
  var AP = ['stealth', 'hack', 'direct'];
  var DECAY = 0.9;
  var LABEL = { stealth: 'Sigilo', hack: 'Hackeo', direct: 'Directo' };

  var TOOLS = ['distract', 'hide', 'disable', 'observe'];
  var TOOL_LABEL = { distract: 'Señuelo', hide: 'Esconderse', disable: 'Desactivar', observe: 'Observar', neutralize: 'Neutralizar' };
  // Garantiza los campos de la Etapa 3 también en partidas guardadas antes de ella.
  function ensure(S) {
    if (!S.tac) S.tac = { distract: 0, hide: 0, disable: 0, observe: 0, neutralize: 0 };
    if (S.tacN == null) S.tacN = 0;
    if (!S.ext) S.ext = { full: 0, partial: 0 };
    if (!S.types) S.types = {};
    if (S.enSum == null) { S.enSum = 0; S.enN = 0; }
    return S;
  }
  function init() {
    return ensure({ ap: { stealth: 0, hack: 0, direct: 0 }, typed: {}, route: { safe: 0, risky: 0 },
             n: 0, nRoute: 0, help: 0, rest: 0, scans: 0, ledger: [] });
  }

  // --- hábitos tácticos, tipos de misión, ahorro de energía y extracción ---
  function observeTools(state, acts) {
    var S = ensure(state.saturno), used = false, inc = state.adapt || 1;
    Object.keys(S.tac).forEach(function (k) { S.tac[k] *= DECAY; });
    Object.keys(acts || {}).forEach(function (k) {
      if (acts[k] > 0 && S.tac[k] != null) { S.tac[k] += inc * Math.min(acts[k], 2) * 0.8; used = true; }
    });
    if (used) S.tacN += 1;
  }
  function favoriteTool(acts) {
    var best = null, bc = 0;
    TOOLS.forEach(function (k) { if ((acts[k] || 0) > bc) { bc = acts[k]; best = k; } });
    return best;
  }
  function predictTool(state) {
    var S = ensure(state.saturno), sum = 0, p = {}, best = TOOLS[0];
    TOOLS.forEach(function (k) { sum += S.tac[k]; });
    TOOLS.forEach(function (k) { p[k] = (S.tac[k] + 0.5) / (sum + 2); });
    TOOLS.forEach(function (k) { if (p[k] > p[best] + 1e-9) best = k; });
    var norm = Math.max(0, (p[best] - 0.25) / 0.75);
    return { tool: best, conf: U.clamp(norm * (S.tacN / (S.tacN + 3)) * modifiers(state), 0, 0.95), probs: p, n: S.tacN };
  }
  // Una sola contramedida táctica por misión y de fuerza fija: la adaptación es gradual y justa.
  function toolCounter(state, pred) {
    if (!pred || pred.n < 3 || pred.conf < 0.38) return null;
    return { tool: pred.tool, conf: pred.conf };
  }
  function observeType(state, type) { var S = ensure(state.saturno); S.types[type] = (S.types[type] || 0) + 1; }
  function observeExtract(state, full) { var S = ensure(state.saturno); if (full) S.ext.full++; else S.ext.partial++; }
  function observeEnergy(state) { var S = ensure(state.saturno); S.enSum += state.res.energy / state.res.maxEnergy; S.enN++; }
  function style(state) {
    var S = ensure(state.saturno), sum = 0, top = null;
    TOOLS.forEach(function (k) { sum += S.tac[k]; if (!top || S.tac[k] > S.tac[top]) top = k; });
    if (S.tacN < 3 || sum <= 0 || S.tac[top] / sum < 0.45) return null;
    return { distract: 'SEÑUELISTA', hide: 'SOMBRA', disable: 'SABOTEADOR', observe: 'VIGÍA' }[top];
  }
  function conserve(state) { var S = ensure(state.saturno); return S.enN ? S.enSum / S.enN : null; }

  function decayAll(S) {
    AP.forEach(function (a) { S.ap[a] *= DECAY; });
    Object.keys(S.typed).forEach(function (k) { S.typed[k] *= DECAY; });
    S.route.safe *= DECAY; S.route.risky *= DECAY;
    S.help *= DECAY;
  }

  function observeApproach(state, nodeType, ap) {
    var S = state.saturno, inc = state.adapt || 1;
    decayAll(S);
    S.ap[ap] += inc;
    var k = nodeType + ':' + ap;
    S.typed[k] = (S.typed[k] || 0) + inc;
    S.n += 1;
  }
  // Decoy: deliberately teach SATURNO a false habit.
  function feed(state, ap, amount) {
    var S = state.saturno;
    S.ap[ap] += amount; S.n += 1;
    S.typed['*:' + ap] = (S.typed['*:' + ap] || 0) + amount;
  }
  function noteHelp(state) { state.saturno.help += 1; }

  function modifiers(state) {
    var r = state.res;
    return (1 - 0.4 * r.div / 100) * (1 - Math.min(0.3, r.noise / 200));
  }

  function approachProbs(S, type) {
    var sumG = 0, g = {}, t = {}, sumT = 0;
    AP.forEach(function (a) { sumG += S.ap[a]; });
    AP.forEach(function (a) { g[a] = (S.ap[a] + 0.5) / (sumG + 1.5); });
    AP.forEach(function (a) { t[a] = (S.typed[type + ':' + a] || 0); sumT += t[a]; });
    var p = {};
    AP.forEach(function (a) {
      p[a] = sumT > 0.6 ? 0.5 * g[a] + 0.5 * ((t[a] + 0.5) / (sumT + 1.5)) : g[a];
    });
    return p;
  }

  function predictApproach(state, nodeType) {
    var S = state.saturno, p = approachProbs(S, nodeType), best = AP[0];
    AP.forEach(function (a) { if (p[a] > p[best] + 1e-9) best = a; });
    var norm = Math.max(0, (p[best] - 1 / 3) / (2 / 3));
    var conf = norm * (S.n / (S.n + 2)) * modifiers(state);
    return { approach: best, conf: U.clamp(conf, 0, 0.97), probs: p, n: S.n };
  }

  // A countermeasure only exists when SATURNO is confident. It is shown to the player before they commit.
  function countermeasure(state, pred) {
    if (!pred || pred.conf < 0.32) return null;
    var mods = W4.World.layerMods(state);
    var raw = (6 + 18 * pred.conf) * (state.adapt || 1) * (mods.satMult || 1) * (state.satScale || 1);
    var penalty = Math.round(raw - Math.min(8, Math.floor(state.res.noise / 20) * 2));
    if (penalty < 3) return null;
    return { approach: pred.approach, penalty: penalty, conf: pred.conf };
  }

  function riskScore(n) {
    var s = n.threat;
    if (n.type === 'highrisk' || n.type === 'elite') s += 1;
    if (n.type === 'safehouse') s -= 2;
    if (n.type === 'social' || n.type === 'resource') s -= 1;
    return s;
  }
  function scoreRange(opts) {
    var min = 99, max = -99;
    opts.forEach(function (n) { var s = riskScore(n); if (s < min) min = s; if (s > max) max = s; });
    return { min: min, max: max };
  }

  function predictRoute(state, opts) {
    if (!opts || opts.length < 2) return null;
    var r = scoreRange(opts);
    if (r.min === r.max) return null;
    var S = state.saturno, pSafe = (S.route.safe + 0.5) / (S.route.safe + S.route.risky + 1);
    var kind = pSafe >= 0.5 ? 'safe' : 'risky', pTop = kind === 'safe' ? pSafe : 1 - pSafe;
    var conf = ((pTop - 0.5) / 0.5) * (S.nRoute / (S.nRoute + 2)) * modifiers(state);
    var target = opts.filter(function (n) { return riskScore(n) === (kind === 'safe' ? r.min : r.max); })[0];
    return { kind: kind, nodeId: target.id, conf: U.clamp(conf, 0, 0.97), n: S.nRoute,
             optionIds: opts.map(function (n) { return n.id; }) };
  }

  function pushLedger(S, entry) {
    S.ledger.push(entry);
    if (S.ledger.length > 14) S.ledger.shift();
  }

  // Divergence is computed from the gap between what SATURNO predicted and what the player did.
  function updateDivergence(state, kind, predicted, actual, conf) {
    var r = state.res, mods = W4.World.layerMods(state), hit = predicted === actual, delta;
    if (hit) delta = -(3 + 5 * conf);
    else delta = (4 + 14 * conf) * (mods.divMult || 1);
    var before = r.div;
    r.div = U.clamp(r.div + delta, 0, 100);
    var visBump = 0;
    if (!hit && r.div > 80) { visBump = 3; r.vis = U.clamp(r.vis + 3, 0, 100); }
    pushLedger(state.saturno, { k: kind, p: predicted, a: actual, c: Math.round(conf * 100), hit: hit });
    if (hit) state.stats.hits++; else state.stats.surprised++;
    return { hit: hit, div: Math.round(r.div - before), vis: visBump };
  }

  function observeRoute(state, chosen, opts) {
    var pred = state.routePred;
    if (!opts || opts.length < 2) return null;
    var r = scoreRange(opts);
    if (r.min === r.max) return null;
    var s = riskScore(chosen), actual = s === r.min ? 'safe' : (s === r.max ? 'risky' : 'mid');
    var S = state.saturno, res = null;
    if (pred && pred.optionIds.indexOf(chosen.id) >= 0) res = updateDivergence(state, 'route', pred.kind, actual, pred.conf);
    if (actual !== 'mid') {
      S.route.safe *= DECAY; S.route.risky *= DECAY;
      S.route[actual] += state.adapt || 1; S.nRoute += 1;
    }
    return res ? { hit: res.hit, div: res.div, predicted: pred.kind, actual: actual } : null;
  }

  // Elite node strike: SATURNO forgets half of what it believed.
  function strike(state, factor) {
    var S = state.saturno, f = factor == null ? 0.5 : factor;
    AP.forEach(function (a) { S.ap[a] *= f; });
    Object.keys(S.typed).forEach(function (k) { S.typed[k] *= f; });
    S.route.safe *= f; S.route.risky *= f; S.help *= f;
    S.n = Math.floor(S.n * f); S.nRoute = Math.floor(S.nRoute * f);
  }

  function shares(S) {
    var sum = 0, out = {};
    AP.forEach(function (a) { sum += S.ap[a]; });
    AP.forEach(function (a) { out[a] = sum > 0 ? S.ap[a] / sum : 0; });
    var rs = S.route.safe + S.route.risky;
    return { ap: out, routeRisk: rs > 0 ? S.route.risky / rs : 0, hasAp: sum > 0, hasRoute: rs > 0 };
  }

  function classify(state) {
    var S = state.saturno, sh = shares(S), top = 'stealth';
    AP.forEach(function (a) { if (sh.ap[a] > sh.ap[top]) top = a; });
    if (S.n < 3) return { label: 'SIN CLASIFICAR', note: 'Datos insuficientes. SATURNO aún te observa.' };
    if (state.res.div >= 60) return { label: 'ANOMALÍA', note: 'Tu conducta ya no encaja en el modelo. Sus predicciones no son fiables.' };
    if (sh.ap[top] >= 0.5) {
      var m = { stealth: ['INFILTRADOR', 'Prefiere el sigilo. Los nodos de apariencia segura serán vigilados.'],
                hack: ['TÉCNICO', 'Prefiere acceder a sistemas. Las defensas se ajustan contra la intrusión.'],
                direct: ['ASALTANTE', 'Prefiere la fuerza. Espera respuestas preparadas ante el choque abierto.'] }[top];
      return { label: m[0], note: m[1] };
    }
    return { label: 'PERFIL MIXTO', note: 'Sin hábito dominante. Difícil de contrarrestar y de leer.' };
  }

  function activeCountermeasures(state) {
    var out = [], W = W4.World;
    if (state.cur && state.cur.kind === 'op' && state.cur.counter && !state.cur.result && state.cur.stage === 'brief') {
      out.push('Preparada contra ' + LABEL[state.cur.counter.approach].toUpperCase() + ' en esta misión: unidades adicionales.');
    }
    state.availIds.forEach(function (id) {
      var n = W.getNode(state, id);
      if (n && n.watch) out.push('Vigilando ' + n.name + ': +1 amenaza.');
    });
    if (state.cur && state.cur.kind === 'op' && state.cur.tcm && !state.cur.result && state.cur.stage === 'brief') out.push('Entrenada contra ' + TOOL_LABEL[state.cur.tcm.tool].toUpperCase() + ' en esta misión.');
    if (state.saturno.help >= 1.5) out.push('Señales de auxilio falsas en cola: algunas peticiones de ayuda serán trampas.');
    if (state.res.vis >= 70) out.push('Cacería activa: riesgo de intercepción cada vez que entras a un nodo.');
    else if (state.res.vis >= 40) out.push('Vigilancia: tu suspicacia sube más rápido mientras la Visibilidad siga alta.');
    return out;
  }

  function snapshot(state) {
    var S = state.saturno, c = classify(state);
    return { ap: U.clone(S.ap), route: U.clone(S.route), tac: U.clone(ensure(S).tac), help: S.help, label: c.label, n: S.n };
  }

  W4.Saturno = { AP: AP, init: init, observeApproach: observeApproach, feed: feed, noteHelp: noteHelp,
    predictApproach: predictApproach, countermeasure: countermeasure, predictRoute: predictRoute,
    observeRoute: observeRoute, updateDivergence: updateDivergence, strike: strike, shares: shares,
    classify: classify, LABEL: LABEL, TOOLS: TOOLS, TOOL_LABEL: TOOL_LABEL, ensure: ensure, observeTools: observeTools, favoriteTool: favoriteTool, predictTool: predictTool, toolCounter: toolCounter, observeType: observeType, observeExtract: observeExtract, observeEnergy: observeEnergy, style: style, conserve: conserve, activeCountermeasures: activeCountermeasures, riskScore: riskScore, snapshot: snapshot };
})();
