/* W4K3UP: UNCLASSIFIED - shared utilities (classic script, shared namespace W4) */
(function () {
  'use strict';
  var W4 = (window.W4 = window.W4 || {});

  function hashSeed(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) >>> 0;
  }

  // mulberry32: tiny deterministic PRNG whose whole state is one integer (serializable)
  function RNG(seed) {
    this.s = (typeof seed === 'number' ? seed : hashSeed(String(seed))) >>> 0;
  }
  RNG.prototype.next = function () {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  RNG.prototype.int = function (a, b) { return a + Math.floor(this.next() * (b - a + 1)); };
  RNG.prototype.pick = function (arr) { return arr[Math.floor(this.next() * arr.length)]; };
  RNG.prototype.chance = function (p) { return this.next() < p; };
  RNG.prototype.shuffle = function (arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // Run-time rolls use a single integer stored in the save, so a given seed replays identically.
  function rollState(state) {
    var r = new RNG(state.rngState);
    var v = r.next();
    state.rngState = r.s;
    return v;
  }
  function pickState(state, arr) { return arr[Math.floor(rollState(state) * arr.length)]; }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function randomSeed() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = 'WK-';
    for (var i = 0; i < 6; i++) s += a.charAt(Math.floor(Math.random() * a.length));
    return s;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var _uid = 0;
  function uid(p) { _uid++; return (p || 'id') + Date.now().toString(36) + _uid; }

  W4.U = { RNG: RNG, hashSeed: hashSeed, rollState: rollState, pickState: pickState,
           clamp: clamp, esc: esc, randomSeed: randomSeed, clone: clone, uid: uid };
})();
