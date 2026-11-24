/* Procedural sound effects (Web Audio API). No audio files. */
(function () {
  'use strict';
  var W4 = window.W4;
  var ctx = null, muted = false;

  function ensure() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }
  function tone(freq, dur, type, vol, delay, slideTo) {
    var c = ensure(); if (!c || muted) return;
    if (c.state === 'suspended' && c.resume) c.resume();
    var t0 = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.05, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  var SOUNDS = {
    click: function () { tone(660, 0.04, 'square', 0.03); },
    good: function () { tone(520, 0.08, 'triangle', 0.06); tone(780, 0.12, 'triangle', 0.06, 0.07); },
    bad: function () { tone(220, 0.18, 'sawtooth', 0.05, 0, 110); },
    alert: function () { tone(880, 0.09, 'square', 0.04); tone(880, 0.09, 'square', 0.04, 0.14); },
    sat: function () { tone(300, 0.25, 'sine', 0.05, 0, 600); },
    win: function () { [523, 659, 784, 1046].forEach(function (f, i) { tone(f, 0.18, 'triangle', 0.06, i * 0.12); }); },
    lose: function () { [330, 262, 196, 131].forEach(function (f, i) { tone(f, 0.25, 'sawtooth', 0.05, i * 0.16); }); }
  };
  W4.Audio = {
    play: function (n) { try { if (SOUNDS[n]) SOUNDS[n](); } catch (e) {} },
    setMuted: function (m) { muted = !!m; },
    isMuted: function () { return muted; }
  };
})();
