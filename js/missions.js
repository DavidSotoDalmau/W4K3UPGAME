/* Motor táctico por turnos sobre cuadrícula. Lógica pura y serializable: sin DOM.
   La misión es un objeto JSON guardado dentro del estado de la partida. */
(function () {
  'use strict';
  var W4 = window.W4, U = W4.U;

  var APPROACHES = {
    stealth: { label: 'Sigilo', cost: 1, ap: 3, charges: 2, vis: 3, failVis: 12, failInteg: 7, noise: 0,
      desc: '3 PA por turno, 2 señuelos. Silencioso: ideal para pasar sin ser visto. SATURNO aprende tu cautela.' },
    hack: { label: 'Hackeo', cost: 2, ap: 3, charges: 1, vis: 6, failVis: 10, failInteg: 5, noise: 0,
      desc: '3 PA, 1 señuelo. Accede a terminales más rápido, desactiva sensores a distancia y la evidencia sale verificada.' },
    direct: { label: 'Directo', cost: 2, ap: 4, charges: 3, vis: 16, failVis: 18, failInteg: 12, noise: 8,
      desc: '4 PA, 3 señuelos. Puedes neutralizar patrullas (costoso). Ruidoso: sube Visibilidad pero genera Ruido.' }
  };
  var DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S O
  var DIRN = ['N', 'E', 'S', 'O'];

  function energyCost(state, ap) {
    var m = W4.World.layerMods(state);
    return APPROACHES[ap].cost + (ap === 'hack' ? (m.hackCost || 0) : 0);
  }
  function effThreat(state, node) { return node.threat + (node.watch ? 1 : 0); }
  function visRisk(state, node) {
    var base = { investigation: 1, infiltration: 2, social: 1, resource: 1, safehouse: 0, disruption: 3, highrisk: 4, elite: 4, gateway: 2 }[node.type] + effThreat(state, node) * 0.5;
    return base < 1.5 ? 'BAJO' : (base < 3.5 ? 'MODERADO' : 'ALTO');
  }

  /* ---------- utilidades de cuadrícula ---------- */
  function ix(m, x, y) { return y * m.w + x; }
  function inb(m, x, y) { return x >= 0 && y >= 0 && x < m.w && y < m.h; }
  function wall(m, x, y) { return !inb(m, x, y) || m.tiles[ix(m, x, y)] === 1; }
  function cheb(ax, ay, bx, by) { return Math.max(Math.abs(ax - bx), Math.abs(ay - by)); }

  function los(m, x0, y0, x1, y1) {
    var dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx - dy, x = x0, y = y0;
    while (!(x === x1 && y === y1)) {
      if (!(x === x0 && y === y0) && wall(m, x, y)) return false;
      var e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
    }
    return true;
  }
  // distancias BFS desde (sx,sy); 'blocked' decide qué celdas no se pueden cruzar
  function bfs(m, sx, sy, blocked, maxD) {
    var dist = new Array(m.w * m.h).fill(-1), q = [[sx, sy]];
    dist[ix(m, sx, sy)] = 0;
    for (var h = 0; h < q.length; h++) {
      var c = q[h], d = dist[ix(m, c[0], c[1])];
      if (maxD != null && d >= maxD) continue;
      for (var k = 0; k < 4; k++) {
        var nx = c[0] + DIRS[k][0], ny = c[1] + DIRS[k][1];
        if (!inb(m, nx, ny) || dist[ix(m, nx, ny)] >= 0 || wall(m, nx, ny) || (blocked && blocked(nx, ny))) continue;
        dist[ix(m, nx, ny)] = d + 1; q.push([nx, ny]);
      }
    }
    return dist;
  }
  function enemyAt(m, x, y, includeDisabled) {
    for (var i = 0; i < m.enemies.length; i++) {
      var e = m.enemies[i];
      if (e.x === x && e.y === y && (includeDisabled || !e.disabled)) return e;
    }
    return null;
  }
  function blockedForPlayer(m) { return function (x, y) { return !!enemyAt(m, x, y, false); }; }

  /* ---------- generación ---------- */
  function generate(seed, node, ap, cmCount, ctx, scanned, threat, ghost, rescue) {
    var rng = new U.RNG(seed + '|tac|' + node.id);
    var big = threat >= 4 || node.type === 'highrisk' || node.type === 'elite' || node.type === 'gateway';
    var w = big ? 12 : 10, h = w;
    var m = { w: w, h: h, tiles: [], terminals: [], pickups: [], exit: { x: w - 1, y: h - 1 }, enemies: [], seen: [], approach: ap, ctx: ctx,
      player: { x: 0, y: h - 1, ap: APPROACHES[ap].ap, maxAp: APPROACHES[ap].ap, hidden: false, charges: APPROACHES[ap].charges },
      masks: ctx.masks || 0, seed: seed, nodeId: node.id, layer: node.layer, hack: null, turn: 1, maxTurn: big ? 28 : 24, suspicion: 0, alerted: false, lastSeen: null, reveal: scanned ? 2 : 0, status: 'play',
      acts: { distract: 0, hide: 0, disable: 0, observe: 0, neutralize: 0 }, kills: 0, terminalUsed: false, collected: 0, msgs: [], nodeType: node.type, cm: cmCount > 0 ? cmCount : 0 };
    m.seen = new Array(w * h).fill(0);

    // muros con conectividad garantizada
    var ok = false, attempt;
    for (attempt = 0; attempt < 30 && !ok; attempt++) {
      m.tiles = new Array(w * h).fill(0);
      var segs = Math.floor(w * h / 13);
      for (var i = 0; i < segs; i++) {
        var horiz = rng.chance(0.5), len = rng.int(2, 4), x = rng.int(1, w - 2), y = rng.int(1, h - 2);
        for (var j = 0; j < len; j++) {
          var cx = x + (horiz ? j : 0), cy = y + (horiz ? 0 : j);
          if (inb(m, cx, cy) && cheb(cx, cy, 0, h - 1) > 1 && cheb(cx, cy, w - 1, h - 1) > 1) m.tiles[ix(m, cx, cy)] = 1;
        }
      }
      var d = bfs(m, 0, h - 1, null);
      if (d[ix(m, w - 1, h - 1)] >= 0) {
        for (var k = 0; k < m.tiles.length; k++) if (m.tiles[k] === 0 && d[k] < 0) m.tiles[k] = 1;
        ok = true;
      }
    }
    if (!ok) m.tiles = new Array(w * h).fill(0);
    var dist0 = bfs(m, 0, h - 1, null);
    var free = [];
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      if (m.tiles[ix(m, xx, yy)] === 0 && dist0[ix(m, xx, yy)] >= 0 && cheb(xx, yy, 0, h - 1) > 0 && cheb(xx, yy, w - 1, h - 1) > 0) free.push([xx, yy]);
    }
    free = rng.shuffle(free);
    // cobertura
    var nCover = rng.int(6, 8);
    for (var c = 0; c < nCover && free.length > 20; c++) { var cc = free.pop(); m.tiles[ix(m, cc[0], cc[1])] = 2; }
    function take(minStart, minOther, others) {
      for (var t = 0; t < free.length; t++) {
        var f = free[t];
        if (m.tiles[ix(m, f[0], f[1])] !== 0) continue;
        if (cheb(f[0], f[1], 0, h - 1) < minStart) continue;
        var good = true;
        for (var o = 0; o < others.length; o++) if (cheb(f[0], f[1], others[o][0], others[o][1]) < minOther) { good = false; break; }
        if (good) { free.splice(t, 1); return f; }
      }
      return null;
    }
    // objetivos
    var needT = 0, needP = 0, relay = false, t = node.type;
    if (t === 'investigation') needP = Math.max(1, node.rewards.evidence);
    else if (t === 'infiltration') { needT = 1; needP = 1; }
    else if (t === 'disruption') { needT = 1; relay = true; }
    else if (t === 'highrisk') { needT = 1; needP = 2; }
    else if (t === 'elite') needT = 2;
    else if (t === 'gateway') needT = 1;
    var placed = [];
    for (var a = 0; a < needT; a++) {
      var tp = take(4, 3, placed) || take(2, 1, placed) || free.pop();
      placed.push(tp);
      m.terminals.push({ x: tp[0], y: tp[1], done: false, kind: relay ? 'relay' : (t === 'elite' ? 'core' : 'terminal') });
    }
    for (var b = 0; b < needP; b++) {
      var pp = take(3, 3, placed) || take(2, 1, placed) || free.pop();
      placed.push(pp); m.pickups.push({ x: pp[0], y: pp[1], got: false });
    }
    if (rescue) {
      var rp = take(4, 3, placed) || take(2, 1, placed) || free.pop();
      placed.push(rp);
      m.rescue = { x: rp[0], y: rp[1], state: 'bound', trap: !!rescue.trap, who: rescue.who };
    }
    // enemigos base
    var cams = Math.min(4, 1 + Math.floor(threat / 2)), pats = Math.min(3, Math.max(1, Math.ceil(threat / 2)));
    var sents = Math.min(2, (threat >= 3 ? 1 : 0) + ((t === 'highrisk' || t === 'elite') ? 1 : 0));
    var id = 0, occupied = placed.slice();
    function addStatic(type, cm, pos) {
      var f = pos || take(4, 2, occupied);
      if (!f) return;
      occupied.push(f);
      m.enemies.push({ id: 'e' + (id++), type: type, x: f[0], y: f[1], dir: rng.int(0, 3), disabled: false, cm: !!cm, known: !!scanned });
    }
    function addPatrol(cm) {
      var wp = [], n = rng.int(2, 3);
      for (var q = 0; q < n; q++) { var f = take(q === 0 ? 4 : 2, 3, wp.concat(placed)); if (f) wp.push(f); }
      if (wp.length < 2) return;
      m.enemies.push({ id: 'e' + (id++), type: 'patrol', x: wp[0][0], y: wp[0][1], dir: 1, route: wp.map(function (p) { return { x: p[0], y: p[1] }; }), ri: 1,
        state: 'patrol', tx: 0, ty: 0, timer: 0, disabled: false, cm: !!cm, known: false });
    }
    for (var i1 = 0; i1 < cams; i1++) addStatic('camera', false);
    for (var i2 = 0; i2 < sents; i2++) addStatic('sentinel', false);
    for (var i3 = 0; i3 < pats - (ghost ? 1 : 0); i3++) addPatrol(false);
    // El fantasma sustituye a una patrulla y decide según el perfil guardado de tu operación anterior.
    if (ghost) {
      var route = [];
      if (ghost.mode === 'guard' && m.terminals.length) {
        var tt = m.terminals[0], best = null;
        for (var gy = -1; gy <= 1 && !best; gy++) for (var gx = -1; gx <= 1 && !best; gx++) {
          var cx2 = tt.x + gx, cy2 = tt.y + gy;
          if ((gx || gy) && inb(m, cx2, cy2) && m.tiles[ix(m, cx2, cy2)] === 0 && !enemyAt(m, cx2, cy2, true)) best = [cx2, cy2];
        }
        if (best) route = [best];
      } else if (ghost.mode === 'lurk') {
        var covers = [];
        for (var cy3 = 0; cy3 < h; cy3++) for (var cx3 = 0; cx3 < w; cx3++) if (m.tiles[ix(m, cx3, cy3)] === 2 && cheb(cx3, cy3, 0, h - 1) >= 4) covers.push([cx3, cy3]);
        covers = rng.shuffle(covers).slice(0, 3);
        if (covers.length >= 2) route = covers;
      }
      if (!route.length) { var wp2 = [], n3 = rng.int(2, 3); for (var q2 = 0; q2 < n3; q2++) { var f2 = take(q2 === 0 ? 4 : 2, 3, wp2.concat(placed)); if (f2) wp2.push(f2); } route = wp2; }
      if (route.length) m.enemies.push({ id: 'e' + (id++), type: 'patrol', x: route[0][0], y: route[0][1], dir: 1, route: route.map(function (p) { return { x: p[0], y: p[1] }; }),
        ri: route.length > 1 ? 1 : 0, state: 'patrol', tx: 0, ty: 0, timer: 0, disabled: false, cm: false, known: false,
        ghost: { id: ghost.id, name: ghost.name, mode: ghost.mode, ignoreDecoy: ghost.ignoreDecoy, label: ghost.label, met: false } });
    }
    // contramedidas de SATURNO, telegrafiadas en el informe
    for (var n2 = 0; n2 < cmCount; n2++) {
      if (ap === 'stealth') addStatic('camera', true);
      else if (ap === 'direct') addPatrol(true);
      else {
        var tt = m.terminals[n2 % Math.max(1, m.terminals.length)];
        var near = null;
        for (var s2 = 0; s2 < free.length && !near; s2++) if (m.tiles[ix(m, free[s2][0], free[s2][1])] === 0 && cheb(free[s2][0], free[s2][1], tt ? tt.x : 5, tt ? tt.y : 5) <= 3) near = free.splice(s2, 1)[0];
        addStatic('sentinel', true, near || null);
      }
    }
    updateSeen(m);
    msg(m, 'Misión iniciada. Llega a la salida (X) con vida; completa los objetivos para una extracción total.');
    return m;
  }

  /* ---------- visión, detección ---------- */
  function msg(m, t) { m.msgs.push(t); if (m.msgs.length > 8) m.msgs.shift(); }
  function visibleSet(m) {
    var r = m.ctx.vision, set = new Array(m.w * m.h).fill(0), p = m.player;
    for (var y = Math.max(0, p.y - r); y <= Math.min(m.h - 1, p.y + r); y++)
      for (var x = Math.max(0, p.x - r); x <= Math.min(m.w - 1, p.x + r); x++)
        if (cheb(x, y, p.x, p.y) <= r && los(m, p.x, p.y, x, y)) set[ix(m, x, y)] = 1;
    return set;
  }
  function updateSeen(m) {
    var v = visibleSet(m);
    for (var i = 0; i < v.length; i++) if (v[i]) m.seen[i] = 1;
    m.enemies.forEach(function (e) {
      if (v[ix(m, e.x, e.y)] && e.type !== 'patrol') e.known = true;
      if (e.ghost && !e.ghost.met && v[ix(m, e.x, e.y)]) { e.ghost.met = true; msg(m, 'Reconoces tu propio patrón: es ' + e.ghost.name + '. ' + (W4.Persist ? W4.Persist.MODE_TEXT[e.ghost.mode] : '')); }
    });
    return v;
  }
  // ¿ve este enemigo la celda (x,y)?
  function inView(m, e, x, y) {
    if (e.disabled) return false;
    var dx = x - e.x, dy = y - e.y, c = Math.max(Math.abs(dx), Math.abs(dy));
    if (c === 0) return true;
    if (e.ghost && e.ghost.mode === 'guard') return c <= 2 && los(m, e.x, e.y, x, y);
    if (e.type === 'sentinel') return c <= 2 && los(m, e.x, e.y, x, y);
    if (e.type === 'patrol' && c <= 1) return los(m, e.x, e.y, x, y);
    var range = e.type === 'camera' ? 5 : 4;
    if (c > range) return false;
    var f = DIRS[e.dir], along = dx * f[0] + dy * f[1], perp = Math.abs(dx * f[1] - dy * f[0]);
    if (along <= 0 || perp > along) return false;
    return los(m, e.x, e.y, x, y);
  }
  function seeGain(m, e) {
    var p = m.player;
    if (!inView(m, e, p.x, p.y)) return 0;
    var c = cheb(e.x, e.y, p.x, p.y);
    if (p.hidden && c > (m.ctx.tcm === 'hide' ? 2 : 1)) return 0;
    var g = e.type === 'patrol' ? (c <= 1 ? 60 : 30) : (e.type === 'camera' ? 22 : 18);
    if (m.suspicion >= 50 && e.type === 'patrol') g = Math.round(g * 1.3);
    if (p.hidden) g *= 0.5;
    if (m.ctx.burner) g *= 0.7;
    g *= (m.ctx.susp || 1);
    return g;
  }

  /* ---------- fase enemiga ---------- */
  function stepToward(m, e, tx, ty) {
    var d = bfs(m, tx, ty, null), best = null, bd = d[ix(m, e.x, e.y)];
    if (bd < 0) return null;
    for (var k = 0; k < 4; k++) {
      var nx = e.x + DIRS[k][0], ny = e.y + DIRS[k][1];
      if (!inb(m, nx, ny) || wall(m, nx, ny)) continue;
      var dd = d[ix(m, nx, ny)];
      if (dd >= 0 && dd < bd) { bd = dd; best = { x: nx, y: ny, dir: k }; }
    }
    return best;
  }
  function movePatrol(m, e) {
    var gh = e.ghost, huntG = gh && gh.mode === 'hunt';
    var tx, ty, chase = m.suspicion >= (huntG ? 25 : 50) && m.lastSeen;
    if (gh && gh.mode === 'guard') chase = false;
    if (gh && gh.mode === 'lurk' && !chase && e.state !== 'investigate' && m.turn % 2 === 1) return;
    if (chase) { tx = m.lastSeen.x; ty = m.lastSeen.y; e.state = 'chase'; }
    else if (e.state === 'investigate' && e.timer > 0) { tx = e.tx; ty = e.ty; e.timer--; if (e.x === tx && e.y === ty) e.timer = 0; }
    else {
      e.state = 'patrol';
      var wp = e.route[e.ri];
      if (e.x === wp.x && e.y === wp.y) { e.ri = (e.ri + 1) % e.route.length; wp = e.route[e.ri]; }
      tx = wp.x; ty = wp.y;
    }
    var steps = chase && (m.suspicion >= 80 || huntG) ? 2 : 1;
    for (var s = 0; s < steps; s++) {
      var st = stepToward(m, e, tx, ty);
      if (!st) return;
      if (st.x === m.player.x && st.y === m.player.y) { e.dir = st.dir; if (tryMask(m)) return; m.status = 'caught'; msg(m, 'Una patrulla te alcanzó.'); return; }
      var other = enemyAt(m, st.x, st.y, false);
      if (other) return;
      e.x = st.x; e.y = st.y; e.dir = st.dir;
    }
  }
  function endTurn(m) {
    m.enemies.forEach(function (e) {
      if (e.disabled) return;
      if (e.type === 'camera') e.dir = (e.dir + 1) % 4;
      else if (e.type === 'patrol' && m.status === 'play') movePatrol(m, e);
    });
    if (m.status === 'play') {
      var sum = 0;
      m.enemies.forEach(function (e) { sum += seeGain(m, e); });
      var R = m.rescue;
      if (R && R.state === 'free') {
        var cHid = m.player.hidden && cheb(R.x, R.y, m.player.x, m.player.y) <= 1, capt = false;
        if (!cHid) m.enemies.forEach(function (e) {
          if (e.disabled) return;
          if (inView(m, e, R.x, R.y)) sum += (e.type === 'patrol' ? 20 : (e.type === 'camera' ? 12 : 10)) * (m.ctx.burner ? 0.7 : 1) * (m.ctx.susp || 1);
          if (e.type === 'patrol' && cheb(e.x, e.y, R.x, R.y) <= 1) capt = true;
        });
        if (capt) { R.state = 'captured'; msg(m, R.who.name + ' fue capturada por una patrulla.'); }
      }
      sum = Math.min(70, Math.round(sum));
      if (sum > 0) {
        m.suspicion = Math.min(100, m.suspicion + sum); m.lastSeen = { x: m.player.x, y: m.player.y };
        msg(m, 'Te vieron: sospecha +' + sum + '.');
      } else m.suspicion = Math.max(0, m.suspicion - 10);
      if (m.suspicion >= 50 && !m.alerted) { m.alerted = true; msg(m, 'ALERTA: las patrullas te persiguen.'); }
      if (m.suspicion >= 100 && !tryMask(m)) { m.status = 'caught'; msg(m, 'Te detectaron.'); }
    }
    if (m.status === 'play') {
      m.turn++;
      if (m.turn > m.maxTurn) { m.status = 'timeout'; msg(m, 'Se agotó el tiempo de la misión.'); }
    }
    m.player.ap = m.player.maxAp;
    if (m.reveal > 0) m.reveal--;
    updateSeen(m);
  }

  /* ---------- acciones del jugador ---------- */
  // Coste real de una herramienta: SATURNO puede encarecer la que más usas.
  function toolCost(m, k) { return (m.ctx.tcm === k && (k === 'observe' || k === 'disable')) ? 2 : 1; }
  // Una máscara absorbe una detección: la sospecha baja a 60 y la misión continúa.
  function tryMask(m) {
    if (m.masks > 0) { m.masks--; m.suspicion = 60; msg(m, 'Una máscara absorbe la detección (' + m.masks + ' restantes).'); return true; }
    return false;
  }
  function fail(t) { return { ok: false, msg: t }; }
  function termCost(m, t) {
    var c = m.approach === 'hack' ? 1 : 2;
    if (m.approach === 'hack') c += m.ctx.hackExtra || 0;
    if (t.kind === 'relay') c += 1;
    if (m.ctx.sealed) c += 1;
    return c;
  }
  function accessRange(m) { return (m.approach === 'hack' && m.ctx.remote) ? 3 : 1; }
  function disableRange(m) { return m.approach === 'hack' ? (m.ctx.remote ? 5 : 3) : 1; }

  function nearbyTerminal(m) {
    var p = m.player, r = accessRange(m), best = null;
    m.terminals.forEach(function (t) { if (!t.done && cheb(p.x, p.y, t.x, t.y) <= r && (r === 1 || los(m, p.x, p.y, t.x, t.y))) best = best || t; });
    return best;
  }
  function pickupHere(m) {
    var p = m.player, r = null;
    m.pickups.forEach(function (u) { if (!u.got && u.x === p.x && u.y === p.y) r = u; });
    return r;
  }
  function disableTargets(m) {
    var p = m.player, r = disableRange(m);
    return m.enemies.filter(function (e) { return !e.disabled && (e.type === 'camera' || e.type === 'sentinel') && cheb(p.x, p.y, e.x, e.y) <= r && (r === 1 || los(m, p.x, p.y, e.x, e.y)); });
  }
  function neutralizeTargets(m) {
    var p = m.player;
    if (m.approach !== 'direct') return [];
    return m.enemies.filter(function (e) { return !e.disabled && e.type === 'patrol' && cheb(p.x, p.y, e.x, e.y) <= 1; });
  }
  function complete(m) {
    var rescued = !m.rescue || m.rescue.state === 'free' || m.rescue.state === 'trap';
    return rescued && m.terminals.every(function (t) { return t.done; }) && m.pickups.every(function (u) { return u.got; });
  }
  function rescueTargetNear(m) { var R = m.rescue, P = m.player; return !!(R && R.state === 'bound' && cheb(P.x, P.y, R.x, R.y) <= 1); }
  function freeCost(m) { return m.approach === 'hack' ? 1 : 2; }
  // La persona liberada te sigue: avanza hacia ti hasta quedar a una celda.
  function followContact(m, steps) {
    var R = m.rescue;
    if (!R || R.state !== 'free') return;
    for (var i = 0; i < steps && cheb(R.x, R.y, m.player.x, m.player.y) > 1; i++) {
      var st = stepToward(m, { x: R.x, y: R.y }, m.player.x, m.player.y);
      if (!st || (st.x === m.player.x && st.y === m.player.y) || enemyAt(m, st.x, st.y, false)) break;
      R.x = st.x; R.y = st.y;
    }
  }
  function objectives(m) {
    var out = [], tdone = m.terminals.filter(function (t) { return t.done; }).length, pdone = m.pickups.filter(function (u) { return u.got; }).length;
    if (m.terminals.length) {
      var k = m.terminals[0].kind;
      out.push({ text: (k === 'relay' ? 'Instalar el relé' : (k === 'core' ? 'Destruir los núcleos de SATURNO' : 'Acceder a la terminal')) + ' (' + tdone + '/' + m.terminals.length + ')', done: tdone === m.terminals.length });
    }
    if (m.pickups.length) out.push({ text: 'Recuperar evidencia (' + pdone + '/' + m.pickups.length + ')', done: pdone === m.pickups.length });
    if (m.rescue) {
      var R = m.rescue, who = R.who.name;
      out.push({ text: R.state === 'free' ? 'Llevar a ' + who + ' hasta la salida' : (R.state === 'trap' ? 'Era una trampa de SATURNO (objetivo cancelado)' : (R.state === 'captured' ? who + ' fue capturada' : 'Liberar a la persona retenida')), done: R.state === 'trap' });
    }
    out.push({ text: 'Extraer en la salida (X)', done: false });
    return out;
  }

  function act(m, a, p) {
    if (m.status !== 'play') return fail('La misión ya terminó.');
    if (m.hack && a !== 'hackguess' && a !== 'hackforce') return fail('Termina primero la intrusión.');
    if (m.ant && a !== 'antscan' && a !== 'anttx' && a !== 'antforce') return fail('Termina primero el montaje de la antena.');
    var P = m.player, res = { ok: true };
    function spend(n) { if (P.ap < n) return false; P.ap -= n; return true; }
    switch (a) {
      case 'move': {
        if (!p || !inb(m, p.x, p.y)) return fail('Destino inválido.');
        var d = bfs(m, P.x, P.y, blockedForPlayer(m), P.ap), c = d[ix(m, p.x, p.y)];
        if (c <= 0) return fail(c === 0 ? 'Ya estás ahí.' : 'Fuera de alcance con tus PA.');
        P.ap -= c; P.x = p.x; P.y = p.y; P.hidden = false;
        followContact(m, c);
        break;
      }
      case 'observe':
        if (!spend(toolCost(m, 'observe'))) return fail('Necesitas ' + toolCost(m, 'observe') + ' PA.');
        m.reveal = Math.max(m.reveal, 1); msg(m, 'Observas: ves a todos los enemigos este turno.');
        break;
      case 'access': {
        var t = nearbyTerminal(m);
        if (!t) return fail(accessRange(m) > 1 ? 'No hay terminales a distancia 3 con línea de visión.' : 'Colócate junto a una terminal.');
        var cost = termCost(m, t);
        if (P.ap < cost) return fail('Necesitas ' + cost + ' PA para esto.');
        P.ap -= cost;
        if (m.ctx.puzzle && W4.Minigames && t.kind === 'relay') {
          m.ant = W4.Minigames.antCreate(m.seed, m.nodeId, m.layer, m.approach); m.ant.tIdx = m.terminals.indexOf(t);
          msg(m, 'Subes a la azotea con la antena: ajusta orientación, mástil y frecuencia.');
          break;
        }
        if (m.ctx.puzzle && W4.Minigames) {
          m.hack = W4.Minigames.hackCreate(m.seed, m.nodeId, m.terminals.indexOf(t), m.layer, m.approach);
          msg(m, 'Intrusión iniciada: descifra el código de ' + m.hack.len + ' símbolos.');
          break;
        }
        t.done = true; m.terminalUsed = true;
        msg(m, t.kind === 'relay' ? 'Relé instalado.' : (t.kind === 'core' ? 'Núcleo destruido.' : 'Terminal comprometida.'));
        break;
      }
      case 'collect': {
        var u = pickupHere(m);
        if (!u) return fail('No hay evidencia en esta celda.');
        if (!spend(1)) return fail('Sin PA suficientes.');
        u.got = true; m.collected++; msg(m, 'Evidencia recuperada.');
        break;
      }
      case 'distract': {
        if (!p || !inb(m, p.x, p.y) || wall(m, p.x, p.y)) return fail('Elige una celda libre.');
        if (P.charges < 1) return fail('Sin señuelos.');
        if (cheb(P.x, P.y, p.x, p.y) > 5 || !los(m, P.x, P.y, p.x, p.y)) return fail('Demasiado lejos o sin línea de visión (alcance 5).');
        if (!spend(1)) return fail('Sin PA suficientes.');
        P.charges--; var n = 0;
        m.enemies.forEach(function (e) {
          var dr = m.ctx.tcm === 'distract' ? 4 : 7;
          if (e.type === 'patrol' && !e.disabled && !(e.ghost && e.ghost.ignoreDecoy) && Math.abs(e.x - p.x) + Math.abs(e.y - p.y) <= dr) { e.state = 'investigate'; e.tx = p.x; e.ty = p.y; e.timer = m.ctx.tcm === 'distract' ? 2 : 4; n++; }
        });
        msg(m, n ? 'El señuelo atrae a ' + n + ' patrulla(s).' : 'El señuelo no atrajo a nadie.');
        break;
      }
      case 'hide':
        if (m.tiles[ix(m, P.x, P.y)] !== 2) return fail('Solo puedes esconderte sobre una cobertura.');
        if (P.hidden) return fail('Ya estás escondido.');
        if (!spend(1)) return fail('Sin PA suficientes.');
        P.hidden = true; msg(m, 'Te escondes: solo te verán a una celda de distancia.');
        break;
      case 'disable': {
        var tg = disableTargets(m), e1 = null;
        if (p) tg.forEach(function (e) { if (e.x === p.x && e.y === p.y) e1 = e; });
        if (!e1) e1 = tg[0];
        if (!e1) return fail(disableRange(m) > 1 ? 'No hay sensores a tu alcance.' : 'Colócate junto a un sensor.');
        if (!spend(toolCost(m, 'disable'))) return fail('Necesitas ' + toolCost(m, 'disable') + ' PA.');
        e1.disabled = true; e1.known = true; msg(m, (e1.type === 'camera' ? 'Cámara' : 'Proceso de monitoreo') + ' desactivado.');
        break;
      }
      case 'neutralize': {
        var nt = neutralizeTargets(m), e2 = null;
        if (p) nt.forEach(function (e) { if (e.x === p.x && e.y === p.y) e2 = e; });
        if (!e2) e2 = nt[0];
        if (!e2) return fail(m.approach === 'direct' ? 'No hay patrullas adyacentes.' : 'Solo el enfoque Directo puede neutralizar.');
        if (!spend(2)) return fail('Necesitas 2 PA.');
        e2.disabled = true; m.kills++; m.suspicion = Math.min(99, m.suspicion + 20);
        msg(m, 'Patrulla neutralizada. El ruido de la pelea sube la sospecha.');
        break;
      }
      case 'hackguess': {
        var hk = m.hack;
        if (!hk) return fail('No hay una intrusión abierta.');
        var gr = W4.Minigames.hackGuess(hk, p && p.guess);
        if (!gr.ok) return fail(gr.msg);
        if (gr.status === 'won') finishHack(m, true);
        else if (gr.status === 'lost') finishHack(m, false);
        return { ok: true, feedback: gr };
      }
      case 'antscan': {
        if (!m.ant) return fail('No hay una antena en montaje.');
        var sr = W4.Minigames.antScan(m.ant, p && p.freq);
        if (!sr.ok) return fail(sr.msg);
        return { ok: true, scan: sr };
      }
      case 'anttx': {
        if (!m.ant) return fail('No hay una antena en montaje.');
        var tr = W4.Minigames.antTx(m.ant, p && p.dir, p && p.h, p && p.f);
        if (!tr.ok) return fail(tr.msg);
        if (tr.res === 'detectada' || tr.res === 'visible') { m.suspicion = Math.min(99, m.suspicion + 10); msg(m, tr.text + ' (sospecha +10)'); } else msg(m, tr.text);
        if (tr.status === 'won') finishAnt(m, true, tr.quality); else if (tr.status === 'lost') finishAnt(m, false);
        return { ok: true, tx: tr };
      }
      case 'antforce':
        if (!m.ant) return fail('No hay una antena en montaje.');
        finishAnt(m, false, 'forced');
        break;
      case 'hackforce':
        if (!m.hack) return fail('No hay una intrusión abierta.');
        finishHack(m, false, true);
        break;
      case 'free': {
        var R0 = m.rescue;
        if (!R0 || R0.state !== 'bound') return fail('No hay nadie a quien liberar.');
        if (cheb(P.x, P.y, R0.x, R0.y) > 1) return fail('Colócate junto a la persona retenida.');
        var fc = freeCost(m);
        if (!spend(fc)) return fail('Necesitas ' + fc + ' PA.');
        if (R0.trap) {
          R0.state = 'trap'; m.suspicion = Math.min(99, m.suspicion + 45); m.alerted = true; m.lastSeen = { x: P.x, y: P.y };
          msg(m, 'Era un señuelo de SATURNO: sus unidades se activan y te buscan.');
        } else { R0.state = 'free'; msg(m, 'Liberas a ' + R0.who.name + '. Te seguirá: llévala hasta la salida.'); }
        break;
      }
      case 'extract': {
        if (P.x !== m.exit.x || P.y !== m.exit.y) return fail('Debes estar en la salida (X).');
        if (m.rescue && m.rescue.state === 'free' && cheb(m.rescue.x, m.rescue.y, m.exit.x, m.exit.y) > 1) return fail('Tu contacto debe estar junto a la salida. Espera a que te alcance.');
        if (!spend(1)) return fail('Sin PA suficientes.');
        m.status = complete(m) ? 'won' : 'extracted';
        break;
      }
      case 'endturn': endTurn(m); return res;
      default: return fail('Acción desconocida.');
    }
    if (m.acts && m.acts[a] != null) m.acts[a]++;
    if (m.status === 'play') {
      updateSeen(m);
      if (P.ap <= 0 && !m.hack && !m.ant) endTurn(m);
    }
    return res;
  }

  function finishHack(m, won, forced) {
    var h = m.hack, t = m.terminals[h.tIdx], P = m.player;
    t.done = true; m.terminalUsed = true; m.hack = null;
    var what = t.kind === 'relay' ? 'Relé instalado' : (t.kind === 'core' ? 'Núcleo destruido' : 'Terminal comprometida');
    if (won) {
      if (h.guesses.length <= 2) { P.ap = Math.min(P.maxAp, P.ap + 1); msg(m, what + ' con una intrusión limpia: recuperas 1 PA.'); }
      else msg(m, what + '.');
    } else {
      m.suspicion = Math.min(99, m.suspicion + 30); m.lastSeen = { x: P.x, y: P.y };
      if (m.suspicion >= 50) m.alerted = true;
      msg(m, (forced ? 'Forzaste el acceso' : 'La intrusión falló (el código era ' + W4.Minigames.codeText(h) + ')') + ': ' + what.toLowerCase() + ', pero saltó una alarma (sospecha +30).');
    }
  }
  function finishAnt(m, won, quality) {
    var a = m.ant, t = m.terminals[a.tIdx], P = m.player;
    t.done = true; m.terminalUsed = true; m.ant = null;
    if (won) { m.antQ = quality; msg(m, quality === 'clear' ? 'Relé instalado con un enlace limpio: SATURNO no lo ve.' : 'Relé instalado, con mucha estática.'); }
    else {
      m.antQ = 'fail'; m.suspicion = Math.min(99, m.suspicion + 30); m.lastSeen = { x: P.x, y: P.y };
      if (m.suspicion >= 50) m.alerted = true;
      msg(m, (quality === 'forced' ? 'Dejas la antena como está' : 'No logras un enlace estable') + ': el relé queda instalado a medias y salta una alarma (sospecha +30).');
    }
  }
  function reachable(m) { return bfs(m, m.player.x, m.player.y, blockedForPlayer(m), m.player.ap); }

  W4.Missions = {
    APPROACHES: APPROACHES, DIRN: DIRN, energyCost: energyCost, effThreat: effThreat, visRisk: visRisk,
    generate: generate, act: act, reachable: reachable, visible: visibleSet, inView: inView, objectives: objectives, complete: complete,
    nearbyTerminal: nearbyTerminal, pickupHere: pickupHere, disableTargets: disableTargets, neutralizeTargets: neutralizeTargets,
    termCost: termCost, toolCost: toolCost, rescueTargetNear: rescueTargetNear, freeCost: freeCost, ix: ix
  };
})();
