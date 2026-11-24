/* Versioned save data with validation and corrupted-save recovery. */
(function () {
  'use strict';
  var W4 = window.W4;
  var KEY = 'w4k3up.save';
  var VER = 2;
  var memory = null; // fallback when localStorage is unavailable (private mode, file:// quirks)

  function defaultWorld() {
    return { knowledge: { ap: { stealth: 0, hack: 0, direct: 0 }, tac: { distract: 0, hide: 0, disable: 0, observe: 0 }, routeRisk: 0.5, help: 0, runs: 0, mult: 1 },
      ghosts: [], archive: [], discoveries: [], network: 0, contacts: [], vault: [], victories: {}, consequences: { reform: 0, anomaly: 0 } };
  }
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function sanitizeWorld(w) {
    var d = defaultWorld();
    if (!w || typeof w !== 'object') return d;
    if (w.knowledge && typeof w.knowledge === 'object') {
      var k = w.knowledge;
      ['stealth', 'hack', 'direct'].forEach(function (a) { d.knowledge.ap[a] = num(k.ap && k.ap[a], 0); });
      ['distract', 'hide', 'disable', 'observe'].forEach(function (t) { d.knowledge.tac[t] = num(k.tac && k.tac[t], 0); });
      d.knowledge.routeRisk = num(k.routeRisk, 0.5); d.knowledge.help = num(k.help, 0); d.knowledge.runs = Math.max(0, Math.floor(num(k.runs, 0))); d.knowledge.mult = num(k.mult, 1);
    }
    function ok(g) { return g && typeof g === 'object' && g.ap && typeof g.ap === 'object' && typeof g.name === 'string'; }
    if (Array.isArray(w.ghosts)) d.ghosts = w.ghosts.filter(ok).slice(0, 5);
    if (Array.isArray(w.archive)) d.archive = w.archive.filter(function (g) { return g && typeof g === 'object'; }).slice(0, 30);
    if (Array.isArray(w.discoveries)) d.discoveries = w.discoveries.filter(function (x) { return typeof x === 'string'; });
    d.network = Math.max(0, Math.min(8, Math.floor(num(w.network, 0))));
    if (Array.isArray(w.contacts)) d.contacts = w.contacts.filter(function (c) { return c && typeof c.name === 'string'; }).slice(-6);
    if (Array.isArray(w.vault)) d.vault = w.vault.filter(function (x) { return typeof x === 'string'; }).slice(0, 3);
    if (w.victories && typeof w.victories === 'object') Object.keys(w.victories).forEach(function (key) { d.victories[key] = num(w.victories[key], 0); });
    if (w.consequences && typeof w.consequences === 'object') { d.consequences.reform = Math.min(3, Math.max(0, Math.floor(num(w.consequences.reform, 0)))); d.consequences.anomaly = Math.min(2, Math.max(0, Math.floor(num(w.consequences.anomaly, 0)))); }
    return d;
  }
  function defaultMeta() {
    return {
      settings: { muted: false, hints: true, difficulty: 'normal', inherit: true, confirmMove: null, bigText: false, reduceMotion: false, hackGame: true },
      history: [], hintsSeen: [], lastSeed: '', world: defaultWorld()
    };
  }
  function read() { try { return window.localStorage.getItem(KEY); } catch (e) { return memory; } }
  function write(s) { try { window.localStorage.setItem(KEY, s); } catch (e) { memory = s; } }

  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function validateRun(r) {
    if (!r || typeof r !== 'object' || r.v !== VER) return false;
    if (typeof r.seed !== 'string' || !isNum(r.rngState) || !Array.isArray(r.layers) || r.layers.length !== 9) return false;
    if (!r.res || !isNum(r.res.vis) || !isNum(r.res.div) || !isNum(r.res.noise) || !isNum(r.res.energy) || !isNum(r.res.integ)) return false;
    if (!r.saturno || typeof r.saturno !== 'object' || !r.saturno.ap) return false;
    if (!Array.isArray(r.availIds) || !Array.isArray(r.evidence) || !Array.isArray(r.items) || !Array.isArray(r.contacts)) return false;
    if (r.phase !== 'map' && r.phase !== 'node') return false;
    if (!isNum(r.layerIdx) || r.layerIdx < 0 || r.layerIdx > 8) return false;
    for (var i = 0; i < r.layers.length; i++) {
      if (!r.layers[i] || !Array.isArray(r.layers[i].nodes) || r.layers[i].nodes.length < 4) return false;
    }
    return true;
  }
  function sanitizeMeta(m) {
    var d = defaultMeta();
    if (!m || typeof m !== 'object') return d;
    if (m.settings && typeof m.settings === 'object') {
      d.settings.muted = !!m.settings.muted;
      d.settings.hints = m.settings.hints !== false;
      d.settings.inherit = m.settings.inherit !== false;
      d.settings.confirmMove = typeof m.settings.confirmMove === 'boolean' ? m.settings.confirmMove : null;
      d.settings.hackGame = m.settings.hackGame !== false; d.settings.bigText = m.settings.bigText === true; d.settings.reduceMotion = m.settings.reduceMotion === true;
      if (['easy', 'normal', 'hard'].indexOf(m.settings.difficulty) >= 0) d.settings.difficulty = m.settings.difficulty;
    }
    if (Array.isArray(m.history)) d.history = m.history.filter(function (h) { return h && typeof h === 'object'; }).slice(-60);
    if (Array.isArray(m.hintsSeen)) d.hintsSeen = m.hintsSeen.filter(function (h) { return typeof h === 'string'; });
    d.world = sanitizeWorld(m.world);
    if (typeof m.lastSeed === 'string') d.lastSeed = m.lastSeed.slice(0, 24);
    return d;
  }

  function load() {
    var raw = read();
    if (!raw) return { meta: defaultMeta(), run: null, recovered: false };
    try {
      var d = JSON.parse(raw);
      if (d && d.v === 1 && d.meta && typeof d.meta === 'object') return { meta: sanitizeMeta(d.meta), run: null, recovered: false };
      if (!d || d.v !== VER || typeof d.meta !== 'object') throw new Error('bad shape');
      var run = validateRun(d.run) ? d.run : null;
      return { meta: sanitizeMeta(d.meta), run: run, recovered: !!(d.run && !run) };
    } catch (e) {
      try { window.localStorage.setItem(KEY + '.corrupt', raw); } catch (_) {}
      return { meta: defaultMeta(), run: null, recovered: true };
    }
  }
  function save(meta, run) { write(JSON.stringify({ v: VER, meta: meta, run: run || null })); }
  function wipe() { try { window.localStorage.removeItem(KEY); } catch (e) {} memory = null; }

  W4.Save = { load: load, save: save, wipe: wipe, validateRun: validateRun, defaultMeta: defaultMeta, defaultWorld: defaultWorld, VERSION: VER };
})();
