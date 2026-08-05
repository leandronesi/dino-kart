/* Boots the real Dino Kart bundle against the software rasteriser and hands
   back the pieces a probe needs. Shared so a probe is ten lines, not two
   hundred. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeSurface, Ctx, writePNG } = require('./raster.js');

module.exports = function boot(gameDir) {
  const SRC = path.join(gameDir, 'src');
  const NOOP = () => {};
  const surf = makeSurface(1280, 720);
  const ctx = new Ctx(surf);

  const classList = () => { const s = new Set(); return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c), toggle: () => false }; };
  const el = (id) => {
    const L = {};
    return {
      id, style: {}, classList: classList(), value: '', textContent: '',
      width: 2560, height: 1440,
      addEventListener: (t, f) => { (L[t] = L[t] || []).push(f); },
      removeEventListener: NOOP,
      dispatch: (t, e) => (L[t] || []).forEach((f) => f(e)),
      getContext: () => ctx,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720, right: 1280, bottom: 720 }),
      setPointerCapture: NOOP, releasePointerCapture: NOOP, focus: NOOP, blur: NOOP, select: NOOP,
      requestFullscreen: () => Promise.resolve(), appendChild: NOOP, remove: NOOP
    };
  };
  const ELS = {};
  ['c', 'ovl', 'ovl-t', 'ovl-i', 'ovl-y', 'ovl-n', 'rot'].forEach((id) => { ELS[id] = el(id); });

  let vclock = 0;
  const timers = [];
  const W = {
    innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, listeners: {},
    addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
    removeEventListener: NOOP,
    matchMedia: () => ({ matches: false, addEventListener: NOOP }),
    setTimeout: (fn, ms) => { timers.push({ at: vclock + (ms || 0), fn }); return timers.length; },
    clearTimeout: NOOP, setInterval: () => 0, clearInterval: NOOP,
    requestAnimationFrame(cb) { W._raf = cb; return 1; }, cancelAnimationFrame: NOOP,
    speechSynthesis: { speak: NOOP, cancel: NOOP, getVoices: () => [], addEventListener: NOOP },
    SpeechSynthesisUtterance: function () {},
    AudioContext: function () {
      const n = () => ({ connect: NOOP, disconnect: NOOP, start: NOOP, stop: NOOP,
        gain: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP, linearRampToValueAtTime: NOOP },
        frequency: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP }, Q: { value: 0 }, type: '', buffer: null });
      this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100;
      this.destination = n(); this.createGain = n; this.createOscillator = n;
      this.createBufferSource = n; this.createBiquadFilter = n;
      this.createBuffer = (c, l) => ({ getChannelData: () => new Float32Array(l) });
      this.resume = () => Promise.resolve();
    },
    navigator: { wakeLock: null, userAgent: 'shot' }, performance: { now: () => vclock }
  };
  const store = new Map();
  W.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k), clear: () => store.clear() };
  W.document = { hidden: false, documentElement: el('html'), listeners: {}, getElementById: (id) => ELS[id] || el(id), addEventListener: NOOP, removeEventListener: NOOP, createElement: el, fullscreenElement: null, exitFullscreen: () => Promise.resolve(), body: el('body') };
  W.window = W; W.globalThis = W; W.self = W; W.Math = Math; W.JSON = JSON; W.Date = Date;
  W.console = { log: NOOP, warn: NOOP, error: (...a) => console.error('GAME:', ...a), info: NOOP, debug: NOOP };

  const code = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort()
    .map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n');
  vm.createContext(W);
  vm.runInContext(code, W, { filename: 'bundle.js' });
  const G = W.G;

  const pump = (n) => {
    for (let i = 0; i < n; i++) {
      vclock += 16.7;
      for (let g = 0; g < 200; g++) {
        const due = timers.filter((t) => t.at <= vclock);
        if (!due.length) break;
        due.forEach((t) => { timers.splice(timers.indexOf(t), 1); t.fn(); });
      }
      W._raf(vclock);
    }
  };
  const pev = (x, y) => ({ clientX: G.view.ox + x * G.view.s, clientY: G.view.oy + (y || 500) * G.view.s, pointerId: 1, preventDefault: NOOP });
  const tap = (x, y) => { ELS.c.dispatch('pointerdown', pev(x, y)); pump(1); ELS.c.dispatch('pointerup', pev(x, y)); pump(1); };

  let holding = 0;
  const steer = (d) => {
    if (d === 0) { if (holding) { ELS.c.dispatch('pointerup', pev(640)); holding = 0; } return; }
    const px = d > 0 ? 1080 : 200;
    if (!holding) { ELS.c.dispatch('pointerdown', pev(px)); holding = d; }
    else if (holding !== d) { ELS.c.dispatch('pointermove', pev(px)); holding = d; }
  };

  /* Draw is expensive; only turn it on for the frame being captured. */
  ctx.off = false;
  const quiet = (n) => { ctx.off = true; pump(n); ctx.off = false; };

  const px = (x, y) => {
    const i = ((y * 2) * surf.W + (x * 2)) * 3;
    return [Math.round(surf.buf[i]), Math.round(surf.buf[i + 1]), Math.round(surf.buf[i + 2])];
  };
  const shot = (dir, name) => {
    surf.buf.fill(0);
    ctx.ops = 0;
    pump(1);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writePNG(surf, path.join(dir, name + '.png'));
    return ctx.ops;
  };

  return { G, W, ELS, surf, ctx, pump, quiet, tap, steer, pev, shot, px };
};
