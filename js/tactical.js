/* Renderizado en Canvas 2D de la misión táctica y traducción de toques a celdas. Solo dibuja: no cambia reglas. */
(function () {
  'use strict';
  var W4 = window.W4, M = W4.Missions;
  var C = { floor: '#0b1218', grid: '#16222b', wall: '#2b3944', wallTop: '#3a4b58', cover: '#17323a', fog: '#04070a', dim: 'rgba(4,7,10,.55)',
    cyan: '#46e3f2', red: '#ff4d5e', amber: '#ffb340', blue: '#3d7bff', text: '#e7eef3' };
  var T = { canvas: null, cs: 0 };

  function size(canvas, m) {
    var avail = Math.min((canvas.parentNode ? canvas.parentNode.clientWidth : 360) || 360, 560);
    var cs = Math.max(24, Math.floor(avail / m.w)), dpr = window.devicePixelRatio || 1;
    canvas.style.width = (cs * m.w) + 'px'; canvas.style.height = (cs * m.h) + 'px';
    canvas.width = Math.round(cs * m.w * dpr); canvas.height = Math.round(cs * m.h * dpr);
    var g = canvas.getContext && canvas.getContext('2d'); if (!g) return null; g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g: g, cs: cs };
  }
  function poly(g, pts, fill, stroke) {
    g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(p[0], p[1]); else g.moveTo(p[0], p[1]); }); g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 2; g.stroke(); }
  }

  // mode: 'move' | 'distract' | 'disable' | 'neutralize'
  T.draw = function (canvas, state, mode, preview) {
    var cur = state.cur, m = cur && cur.mission;
    if (!canvas || !m) return;
    var sz = size(canvas, m); if (!sz) return; var g = sz.g, cs = sz.cs; T.canvas = canvas; T.cs = cs;
    var vis = M.visible(m), reach = M.reachable(m), P = m.player;
    var x, y, i;
    g.clearRect(0, 0, canvas.width, canvas.height);
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var k = y * m.w + x, t = m.tiles[k], px = x * cs, py = y * cs;
      if (!m.seen[k]) { g.fillStyle = C.fog; g.fillRect(px, py, cs, cs); continue; }
      g.fillStyle = t === 1 ? C.wall : (t === 2 ? C.cover : C.floor); g.fillRect(px, py, cs, cs);
      g.strokeStyle = C.grid; g.lineWidth = 1; g.strokeRect(px + .5, py + .5, cs - 1, cs - 1);
      if (t === 1) { g.fillStyle = C.wallTop; g.fillRect(px + 3, py + 3, cs - 6, 3); }
      if (t === 2) { g.strokeStyle = '#2b6b76'; g.lineWidth = 1; g.strokeRect(px + 5, py + 5, cs - 10, cs - 10); g.fillStyle = '#2b6b76'; g.fillRect(px + cs * .35, py + cs * .45, cs * .3, cs * .1); }
    }
    // alcance de movimiento
    if (mode === 'move' && m.status === 'play') {
      for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
        var c = reach[y * m.w + x];
        if (c > 0 && m.seen[y * m.w + x]) { g.fillStyle = 'rgba(70,227,242,.10)'; g.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2); }
      }
    }
    // conos de visión de enemigos conocidos o visibles
    var showAll = m.reveal > 0;
    m.enemies.forEach(function (e) {
      if (e.disabled) return;
      var seenNow = vis[e.y * m.w + e.x] || showAll || (e.type !== 'patrol' && e.known);
      if (!seenNow) return;
      for (var yy = 0; yy < m.h; yy++) for (var xx = 0; xx < m.w; xx++) {
        if (!m.seen[yy * m.w + xx] && !showAll) continue;
        if ((xx !== e.x || yy !== e.y) && M.inView(m, e, xx, yy)) {
          g.fillStyle = e.ghost ? 'rgba(61,123,255,.20)' : (e.type === 'sentinel' ? 'rgba(255,179,64,.16)' : 'rgba(255,77,94,.17)');
          g.fillRect(xx * cs + 1, yy * cs + 1, cs - 2, cs - 2);
        }
      }
    });
    // celdas recordadas pero fuera de visión
    for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
      var kk = y * m.w + x;
      if (m.seen[kk] && !vis[kk] && !showAll) { g.fillStyle = C.dim; g.fillRect(x * cs, y * cs, cs, cs); }
    }
    // objetos
    function cell(x2, y2) { return [x2 * cs, y2 * cs]; }
    var o = cell(m.exit.x, m.exit.y);
    g.strokeStyle = C.cyan; g.lineWidth = 2; g.strokeRect(o[0] + 4, o[1] + 4, cs - 8, cs - 8);
    g.fillStyle = C.cyan; g.font = 'bold ' + Math.round(cs * .45) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('X', o[0] + cs / 2, o[1] + cs / 2 + 1);
    m.terminals.forEach(function (t2) {
      if (!m.seen[t2.y * m.w + t2.x]) return;
      var p = cell(t2.x, t2.y);
      g.fillStyle = t2.done ? '#123238' : '#0e2a33'; g.fillRect(p[0] + 5, p[1] + 5, cs - 10, cs - 10);
      g.strokeStyle = t2.done ? '#2b6b76' : C.cyan; g.lineWidth = 2; g.strokeRect(p[0] + 5, p[1] + 5, cs - 10, cs - 10);
      g.fillStyle = t2.done ? '#2b6b76' : C.cyan; g.fillText(t2.kind === 'relay' ? 'R' : (t2.kind === 'core' ? 'N' : 'T'), p[0] + cs / 2, p[1] + cs / 2 + 1);
    });
    m.pickups.forEach(function (u) {
      if (u.got || !m.seen[u.y * m.w + u.x]) return;
      var p = cell(u.x, u.y), r = cs * .26;
      poly(g, [[p[0] + cs / 2, p[1] + cs / 2 - r], [p[0] + cs / 2 + r, p[1] + cs / 2], [p[0] + cs / 2, p[1] + cs / 2 + r], [p[0] + cs / 2 - r, p[1] + cs / 2]], C.amber, null);
    });
    var RS = m.rescue;
    if (RS && (RS.state === 'bound' || RS.state === 'free') && m.seen[RS.y * m.w + RS.x]) {
      var rx = RS.x * cs + cs / 2, ry = RS.y * cs + cs / 2;
      g.beginPath(); g.arc(rx, ry, cs * .3, 0, 7); g.fillStyle = '#0e2a33'; g.fill();
      g.strokeStyle = C.cyan; g.lineWidth = 2; if (RS.state === 'bound') g.setLineDash([3, 3]); g.stroke(); g.setLineDash([]);
      g.fillStyle = C.cyan; g.font = 'bold ' + Math.round(cs * .36) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('C', rx, ry + 1);
    }
    // enemigos
    m.enemies.forEach(function (e) {
      var seenNow = vis[e.y * m.w + e.x] || showAll || (e.type !== 'patrol' && e.known);
      if (!seenNow) return;
      var p = cell(e.x, e.y), cx = p[0] + cs / 2, cy = p[1] + cs / 2, r = cs * .32;
      var col = e.disabled ? '#4a5560' : (e.ghost ? C.blue : (e.type === 'sentinel' ? C.amber : C.red)), f = M.DIRN ? [[0, -1], [1, 0], [0, 1], [-1, 0]][e.dir] : [0, 0];
      if (e.type === 'camera') {
        poly(g, [[cx + f[0] * r * 1.2, cy + f[1] * r * 1.2], [cx - f[1] * r - f[0] * r * .6, cy + f[0] * r - f[1] * r * .6], [cx + f[1] * r - f[0] * r * .6, cy - f[0] * r - f[1] * r * .6]], e.disabled ? null : col + '55', col);
      } else if (e.type === 'patrol') {
        g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fillStyle = e.disabled ? '#1a2128' : '#2a0f14'; g.fill(); g.strokeStyle = col; g.lineWidth = 2; g.stroke();
        if (!e.disabled) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + f[0] * r * 1.3, cy + f[1] * r * 1.3); g.stroke(); }
        if (e.ghost && !e.disabled) { g.fillStyle = C.blue; g.font = 'bold ' + Math.round(cs * .3) + 'px monospace'; g.fillText('F', cx, cy + 1); }
      } else {
        var pts = []; for (var a = 0; a < 6; a++) pts.push([cx + Math.cos(Math.PI / 3 * a) * r * 1.1, cy + Math.sin(Math.PI / 3 * a) * r * 1.1]);
        poly(g, pts, e.disabled ? null : col + '33', col);
      }
      if (e.cm && !e.disabled) { g.strokeStyle = C.amber; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(p[0] + 2, p[1] + 2, cs - 4, cs - 4); g.setLineDash([]); }
    });
    // jugador
    var pp = cell(P.x, P.y), pcx = pp[0] + cs / 2, pcy = pp[1] + cs / 2;
    g.beginPath(); g.arc(pcx, pcy, cs * .28, 0, 7); g.fillStyle = P.hidden ? '#9fb2bd' : C.text; g.fill();
    g.strokeStyle = P.hidden ? C.cyan : '#0b1218'; g.lineWidth = 2; if (P.hidden) g.setLineDash([3, 3]); g.beginPath(); g.arc(pcx, pcy, cs * .38, 0, 7); g.stroke(); g.setLineDash([]);
    if (preview) {
      var qx = preview.x * cs, qy = preview.y * cs;
      g.fillStyle = 'rgba(70,227,242,.28)'; g.fillRect(qx + 1, qy + 1, cs - 2, cs - 2);
      g.strokeStyle = C.cyan; g.lineWidth = 2; g.strokeRect(qx + 2, qy + 2, cs - 4, cs - 4);
      g.fillStyle = C.text; g.font = 'bold ' + Math.round(cs * .42) + 'px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(preview.cost), qx + cs / 2, qy + cs / 2 + 1);
    }
    // marcos de modo de objetivo
    if (mode === 'distract') {
      for (y = 0; y < m.h; y++) for (x = 0; x < m.w; x++) {
        if (Math.max(Math.abs(x - P.x), Math.abs(y - P.y)) <= 5 && m.tiles[y * m.w + x] !== 1 && vis[y * m.w + x]) { g.strokeStyle = 'rgba(255,179,64,.35)'; g.lineWidth = 1; g.strokeRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4); }
      }
    }
  };

  T.cellFromEvent = function (ev, canvas, m) {
    var rect = canvas.getBoundingClientRect(), cs = rect.width / m.w;
    var x = Math.floor((ev.clientX - rect.left) / cs), y = Math.floor((ev.clientY - rect.top) / cs);
    if (x < 0 || y < 0 || x >= m.w || y >= m.h) return null;
    return { x: x, y: y };
  };

  W4.Tactical = T;
})();
