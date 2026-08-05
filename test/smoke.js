#!/usr/bin/env node
/* Headless smoke test. Runs the whole bundle against a fake DOM/canvas/audio,
   pumps frames through every scene at both difficulty levels, and fuzzes it
   with random taps and drags. Any thrown error or console.error is a failure.

   `node test/smoke.js`  — exit code 0 = clean. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src');

const NOOP = function () {};
const failures = [];
let phase = 'boot';

/* ------------------------------------------------------------ fake canvas */
function gradient() { return { addColorStop: NOOP }; }

// Counted so we can tell "the scene rendered" from "the scene rendered nothing",
// and so a NaN coordinate — which silently voids an entire canvas path — is caught.
const DRAW_OPS = ['fill', 'stroke', 'fillRect', 'strokeRect', 'fillText', 'strokeText', 'arc', 'arcTo',
  'ellipse', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'rect', 'translate', 'rotate', 'drawImage'];
let drawCount = 0;
const counted = {};
DRAW_OPS.forEach((name) => {
  counted[name] = function () {
    drawCount++;
    for (let i = 0; i < arguments.length; i++) {
      const v = arguments[i];
      if (typeof v === 'number' && !Number.isFinite(v)) { fail('ctx.' + name + '() argomento ' + i + ' = ' + v); break; }
    }
  };
});

function ctx2d() {
  const store = { canvas: null };
  const special = {
    ...counted,
    createLinearGradient: gradient,
    createRadialGradient: gradient,
    createConicGradient: gradient,
    createPattern: () => ({ setTransform: NOOP }),
    measureText: (s) => ({ width: String(s).length * 9, actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 4 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }),
    isPointInPath: () => false,
    isPointInStroke: () => false,
    getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }),
    getLineDash: () => []
  };
  return new Proxy(store, {
    get(t, k) {
      if (k in special) return special[k];
      if (k in t) return t[k];
      if (typeof k === 'symbol') return undefined;
      return NOOP;                       // any unknown 2d method is a no-op
    },
    set(t, k, v) {
      // Catch the classic canvas bug: a NaN coordinate silently kills a draw.
      if ((k === 'lineWidth' || k === 'globalAlpha' || k === 'shadowBlur') && Number.isNaN(v)) {
        fail('ctx.' + k + ' set to NaN');
      }
      if ((k === 'fillStyle' || k === 'strokeStyle') && typeof v === 'string' && /NaN|undefined/.test(v)) {
        fail('ctx.' + k + ' = "' + v + '"');
      }
      t[k] = v; return true;
    }
  });
}

function fail(msg) {
  const line = '[' + phase + '] ' + msg;
  if (failures.length < 400 && !failures.includes(line)) failures.push(line);
}

/* --------------------------------------------------------------- fake DOM */
function classList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    contains: (c) => set.has(c),
    toggle: (c, on) => { if (on === undefined) { set.has(c) ? set.delete(c) : set.add(c); } else if (on) set.add(c); else set.delete(c); return set.has(c); }
  };
}
function el(id) {
  const listeners = {};
  return {
    id,
    listeners,
    style: {},
    classList: classList(),
    value: '',
    textContent: '',
    width: 0, height: 0,
    addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
    removeEventListener: NOOP,
    dispatch: (t, e) => (listeners[t] || []).forEach((f) => f(e)),
    getContext: () => el._ctx || (el._ctx = ctx2d()),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: WIN.innerWidth, height: WIN.innerHeight, right: WIN.innerWidth, bottom: WIN.innerHeight }),
    setPointerCapture: NOOP, releasePointerCapture: NOOP,
    focus: NOOP, blur: NOOP, select: NOOP,
    requestFullscreen: () => Promise.resolve(),
    appendChild: NOOP, remove: NOOP
  };
}

const ELS = {};
['c', 'ovl', 'ovl-t', 'ovl-i', 'ovl-y', 'ovl-n', 'rot'].forEach((id) => { ELS[id] = el(id); });

/* --------------------------------------------------------- virtual timers */
let vclock = 0;
const timers = [];
function fakeSetTimeout(fn, ms) {
  const t = { at: vclock + (ms || 0), fn, id: timers.length + 1 };
  timers.push(t);
  return t.id;
}
function fakeClearTimeout(id) {
  const i = timers.findIndex((t) => t.id === id);
  if (i >= 0) timers.splice(i, 1);
}
function flushTimers() {
  for (let guard = 0; guard < 500; guard++) {
    const due = timers.filter((t) => t.at <= vclock);
    if (!due.length) return;
    due.forEach((t) => {
      timers.splice(timers.indexOf(t), 1);
      try { t.fn(); } catch (e) { fail('setTimeout callback: ' + e.message); }
    });
  }
}

/* ------------------------------------------------------------- fake world */
const WIN = {
  innerWidth: 1600, innerHeight: 900, devicePixelRatio: 2,
  listeners: {},
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  removeEventListener: NOOP,
  matchMedia: () => ({ matches: false, addEventListener: NOOP }),
  setTimeout: fakeSetTimeout, clearTimeout: fakeClearTimeout,
  setInterval: () => 0, clearInterval: NOOP,
  requestAnimationFrame(cb) { WIN._raf = cb; return 1; },
  cancelAnimationFrame: NOOP,
  speechSynthesis: { speak: NOOP, cancel: NOOP, getVoices: () => [{ lang: 'it-IT', name: 'Fake' }], addEventListener: NOOP },
  SpeechSynthesisUtterance: function (s) { this.text = s; },
  AudioContext: function () {
    const node = () => ({
      connect: NOOP, disconnect: NOOP, start: NOOP, stop: NOOP,
      gain: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP, linearRampToValueAtTime: NOOP },
      frequency: { value: 0, setValueAtTime: NOOP, exponentialRampToValueAtTime: NOOP },
      Q: { value: 0 }, type: '', buffer: null
    });
    this.currentTime = 0; this.state = 'running'; this.sampleRate = 44100;
    this.destination = node();
    this.createGain = node; this.createOscillator = node; this.createBufferSource = node; this.createBiquadFilter = node;
    this.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
    this.resume = () => Promise.resolve();
  },
  navigator: { wakeLock: null, userAgent: 'smoke' },
  performance: { now: () => vclock },
  console
};

const localStore = new Map();
WIN.localStorage = {
  getItem: (k) => (localStore.has(k) ? localStore.get(k) : null),
  setItem: (k, v) => localStore.set(k, String(v)),
  removeItem: (k) => localStore.delete(k),
  clear: () => localStore.clear()
};

WIN.document = {
  hidden: false,
  documentElement: el('html'),
  listeners: {},
  getElementById: (id) => ELS[id] || el(id),
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
  removeEventListener: NOOP,
  createElement: (t) => el(t),
  fullscreenElement: null,
  exitFullscreen: () => Promise.resolve(),
  body: el('body')
};

const sandbox = WIN;
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
sandbox.Math = Math; sandbox.JSON = JSON; sandbox.Date = Date;
sandbox.console = {
  log: NOOP, warn: (...a) => fail('console.warn: ' + a.join(' ')),
  error: (...a) => fail('console.error: ' + a.map((x) => (x && x.stack ? x.stack.split('\n').slice(0, 3).join(' | ') : String(x))).join(' ')),
  info: NOOP, debug: NOOP
};

/* --------------------------------------------------------------- load src */
const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort();
const code = files.map((f) => '/* ' + f + ' */\n' + fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n;\n');

vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: 'bundle.js' });
} catch (e) {
  console.error('\n✗ il bundle non parte affatto:\n' + (e.stack || e.message) + '\n');
  process.exit(1);
}

const G = sandbox.G;
if (!G) { console.error('✗ G non e stato creato'); process.exit(1); }

/* ------------------------------------------------------------ frame pump */
function pump(n) {
  for (let i = 0; i < n; i++) {
    vclock += 16.7;
    flushTimers();
    if (!WIN._raf) { fail('nessun requestAnimationFrame registrato'); return; }
    try { WIN._raf(vclock); } catch (e) { fail('frame: ' + (e.stack || e.message).split('\n').slice(0, 3).join(' | ')); }
  }
}

function toClient(x, y) {
  const v = G.view;
  return { clientX: v.ox + x * v.s, clientY: v.oy + y * v.s };
}
function pev(x, y) { const c = toClient(x, y); return { clientX: c.clientX, clientY: c.clientY, pointerId: 1, preventDefault: NOOP }; }

function tap(x, y) {
  ELS.c.dispatch('pointerdown', pev(x, y));
  pump(1);
  ELS.c.dispatch('pointerup', pev(x, y));
  pump(1);
}
function drag(x0, y0, x1, y1, steps) {
  steps = steps || 8;
  ELS.c.dispatch('pointerdown', pev(x0, y0));
  for (let i = 1; i <= steps; i++) {
    ELS.c.dispatch('pointermove', pev(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps));
    pump(1);
  }
  ELS.c.dispatch('pointerup', pev(x1, y1));
  pump(1);
}
function closeOverlayIfOpen(name) {
  if (ELS.ovl.classList.contains('on')) {
    ELS['ovl-i'].value = name || 'Prova';
    ELS['ovl-y'].dispatch('click', {});
    pump(2);
  }
}

/* ------------------------------------------------------------------ tests */
console.log("Dino Kart — collaudo headless");
console.log("moduli: " + files.join(", ") + "\n");

phase = "avvio";
pump(20);
if (!G.current) fail("nessuna scena attiva dopo l avvio");

const expected = ["menu", "pista"];
const missing = expected.filter((s2) => !G.sceneOf(s2));
if (missing.length) fail("scene mancanti: " + missing.join(", "));
if (!G.account) fail("il boot non ha creato un profilo");

// the road must actually draw something, and never a NaN coordinate
phase = "pista";
if (G.sceneOf("pista")) {
  G.go("pista"); pump(40);
  if (G.current !== "pista") fail("non sono entrato in pista (sono in \"" + G.current + "\")");
  pump(200);                                   // oltre il semaforo: qui si prova la guida
  drawCount = 0;
  pump(60);
  if (drawCount < 2000) fail("la strada disegna quasi nulla: " + drawCount + " operazioni in 60 frame");

  // STEERING MUST ACTUALLY MOVE THE KART. Nothing asserted this before.
  pump(120);                                   // let it get up to speed
  const st0 = G.kartState();
  if (st0.spd < 1000) fail("il kart non accelera: velocita " + Math.round(st0.spd));

  ELS.c.dispatch("pointerdown", pev(1080, 500));
  for (let i = 0; i < 90; i++) { ELS.c.dispatch("pointermove", pev(1080, 500)); pump(1); }
  ELS.c.dispatch("pointerup", pev(1080, 500));
  const stR = G.kartState();
  if (stR.x <= st0.x + 0.05) fail("toccando a destra il kart non va a destra: x " + st0.x.toFixed(3) + " -> " + stR.x.toFixed(3));

  ELS.c.dispatch("pointerdown", pev(200, 500));
  for (let i = 0; i < 140; i++) { ELS.c.dispatch("pointermove", pev(200, 500)); pump(1); }
  ELS.c.dispatch("pointerup", pev(200, 500));
  const stL = G.kartState();
  if (stL.x >= stR.x - 0.05) fail("toccando a sinistra il kart non va a sinistra: x " + stR.x.toFixed(3) + " -> " + stL.x.toFixed(3));

  // NESSUN KART PUO ESSERE PIU GRANDE DEL MIO: chi e piu lontano e piu piccolo.
  // Era il bug per cui un avversario a dieci segmenti veniva il doppio di me.
  const W2 = 1280, CAM_D2 = 0.84, CAM_BACK2 = 800, KART_W2 = 313, SEG2 = 200;
  const mine = (CAM_D2 / CAM_BACK2) * KART_W2 * W2 / 2;
  let prev = Infinity;
  for (let d = 1; d <= 60; d++) {
    const sz = (CAM_D2 / (CAM_BACK2 + d * SEG2)) * KART_W2 * W2 / 2;
    if (sz > mine) { fail("un avversario a " + d + " segmenti e piu grande del mio kart: " + Math.round(sz) + " > " + Math.round(mine)); break; }
    if (sz > prev) { fail("la dimensione degli avversari non cala con la distanza, a " + d + " segmenti"); break; }
    prev = sz;
  }

  // and releasing must stop the steering, not leave it stuck
  const xa = G.kartState().x; pump(60);
  const xb = G.kartState().x;
  if (Math.abs(xb - xa) > 0.35) fail("lo sterzo resta incastrato dopo il rilascio: x " + xa.toFixed(3) + " -> " + xb.toFixed(3));
}

/* LA GARA HA UN INIZIO E UNA FINE. Questo blocco esiste perche il gioco per
   settimane e stato una prova su strada: entravi ed eri gia in corsa, senza
   semaforo, senza giri contati, senza arrivo. Un test che guarda solo se la
   strada si disegna non se ne accorge. Qui si guida davvero un intero Gran
   Premio, dal menu al podio. */
phase = "gara";
if (G.sceneOf("menu") && G.sceneOf("pista")) {
  G.go("menu"); pump(30);
  const g = G.kartSave();
  g.diff = 0;                                  // Facile: 2 giri, e il test dura meno
  const races0 = g.races;

  tap(640, 559);                               // VIA!
  pump(30);
  if (G.current !== "pista") fail("il tasto VIA non porta in pista (sono in \"" + G.current + "\")");

  let st = G.kartState();
  if (st.phase !== "via") fail("la gara non parte dal semaforo: fase \"" + st.phase + "\"");
  if (st.laps !== 2) fail("Facile non da 2 giri ma " + st.laps);
  pump(60);
  if (G.kartState().spd !== 0) fail("il kart si muove durante il conto alla rovescia");

  pump(180);                                   // ~4s: il semaforo dura 3,3
  if (G.kartState().phase !== "gara") fail("il semaforo non finisce mai: fase \"" + G.kartState().phase + "\"");

  /* LA CURVA NON PUO ESSERE PIU FORTE DELLO STERZO. Detto in numeri, perche
     detto in comportamento e sfuggito una volta gia: alla curva piu stretta la
     spinta verso l esterno deve restare ben sotto il volante a fondo corsa. Con
     0,55 di centrifuga era 2,5 contro 1: la strada era letteralmente
     intenibile, e nessuna bravura rispondeva a questo. */
  const push = st.maxCurve * st.centrif;
  if (push > st.steerRate * 0.7) {
    fail("la curva piu stretta spinge " + push.toFixed(2) + " contro uno sterzo di " + st.steerRate.toFixed(2));
  }

  // pilota automatico: correggo quando sono a un terzo dal bordo, come farebbe
  // un bambino — non con micro-correzioni continue che nasconderebbero il difetto
  let holding = 0;
  function steerTo(dir) {
    if (dir === 0) { if (holding) { ELS.c.dispatch("pointerup", pev(640, 500)); holding = 0; } return; }
    const px = dir > 0 ? 1080 : 200;
    if (!holding) { ELS.c.dispatch("pointerdown", pev(px, 500)); holding = dir; }
    else if (holding !== dir) { ELS.c.dispatch("pointermove", pev(px, 500)); holding = dir; }
  }

  let offFrames = 0, ran = 0, maxLap = 1, badPlace = 0;
  for (ran = 0; ran < 14000; ran++) {
    st = G.kartState();
    if (st.phase === "fine") break;
    if (st.x > 0.34) steerTo(-1); else if (st.x < -0.34) steerTo(1); else steerTo(0);
    if (Math.abs(st.x) >= 1) offFrames++;
    if (st.lap > maxLap) maxLap = st.lap;
    if (!(st.place >= 1 && st.place <= st.field)) badPlace++;
    pump(1);
  }
  steerTo(0);

  st = G.kartState();
  if (st.phase !== "fine") fail("la gara non finisce mai: " + ran + " frame, giro " + st.lap + "/" + st.laps);
  if (maxLap < 2) fail("il contagiri non avanza: mai oltre il giro " + maxLap);
  if (badPlace) fail("posizione fuori dal gruppo in " + badPlace + " frame");
  if (st.order !== 6) fail("l ordine d arrivo non ha 6 kart ma " + st.order);
  if (!(st.place >= 1 && st.place <= 6)) fail("posizione finale assurda: " + st.place);

  /* LA STRADA DEVE ESSERE TENIBILE. Il bug che ha reso il gioco ingiocabile
     era una forza centrifuga piu forte dello sterzo: con quella, correggendo
     sempre si finiva lo stesso sull erba. Un pilota che corregge deve stare
     dentro. */
  if (offFrames > ran * 0.25) {
    fail("la pista non e tenibile: fuori strada per " + Math.round(offFrames / ran * 100) + "% della gara");
  }

  // un giro deve durare quanto una gara di kart, non quanto uno starnuto
  const lapSecs = ran * 0.0167 / 2;
  if (lapSecs < 12) fail("il giro dura solo " + lapSecs.toFixed(1) + "s: la pista e troppo corta");

  const g2 = G.kartSave();
  if (g2.races !== races0 + 1) fail("la gara finita non e stata contata");
  if (!isFinite(g2.best.collina) || g2.best.collina <= 0) fail("nessun tempo sul giro salvato");

  // e dal podio si riparte
  drawCount = 0; pump(2);
  if (drawCount < 200) fail("la schermata d arrivo non disegna nulla");
  tap(470, 720 - 70);                          // Ancora!
  pump(30);
  if (G.current !== "pista" || G.kartState().phase !== "via") {
    fail("\"Ancora!\" non fa ripartire una gara nuova");
  }
  G.go("menu"); pump(30);
}

phase = "salvataggio";
try {
  const j = JSON.stringify(G.save);
  if (/NaN|Infinity/.test(j)) fail("salvataggio contiene NaN/Infinity");
} catch (e) { fail("salvataggio non serializzabile: " + e.message); }

/* ---------------------------------------------------------------- verdict */
console.log("");
if (failures.length) {
  console.log("✗ " + failures.length + " problemi:\n");
  failures.slice(0, 40).forEach((f) => console.log("  · " + f));
  process.exit(1);
} else {
  console.log("\n✓ collaudo pulito — la pista gira, nessun errore");
  process.exit(0);
}
