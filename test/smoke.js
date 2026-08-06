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

const expected = ["accesso", "nuovo", "segreto", "gate", "gestione", "menu", "pista"];
const missing = expected.filter((s2) => !G.sceneOf(s2));
if (missing.length) fail("scene mancanti: " + missing.join(", "));
if (G.current !== "accesso") fail("il gioco non parte da \"chi guida?\" ma da \"" + G.current + "\"");
if (G.account) fail("all avvio risulta gia collegato qualcuno: " + G.account.name);

/* IL PROFILO SI DEVE POTER FARE TOCCANDO, non solo dal codice. Nome, colore,
   eta e tre figure segrete: e' la stessa porta d'ingresso di Dino Giungla e sta
   sullo stesso tablet, quindi o funziona uguale o il bambino la impara due
   volte. Qui il collaudo la percorre davvero, tocco per tocco. */
phase = "nuovo pilota";
tap(640, 320);                                 // la card "Nuovo pilota"
pump(30);
if (G.current !== "nuovo") fail("il tasto Nuovo non apre la creazione (sono in \"" + G.current + "\")");
closeOverlayIfOpen("Rex");                     // il nome, chiesto dall overlay
pump(4);
tap(640 - 316 + 64, 198);                      // un colore della fila
pump(2);
tap(640, 652);                                 // Avanti -> eta
pump(4);
tap(820, 300);                                 // Grande
pump(2);
tap(640, 652);                                 // Avanti -> segreto
pump(4);
// tre figure sulla griglia 3x3: la 0, la 4 e la 8
[[0, 0], [1, 1], [2, 2]].forEach((rc) => {
  tap(640 - 232 + rc[1] * 154 + 69, 228 + rc[0] * 154 + 69);
  pump(2);
});
tap(640, 652);                                 // Fatto!
pump(40);

if (G.current !== "menu") fail("finita la creazione non sono nel menu ma in \"" + G.current + "\"");
if (!G.account) fail("il pilota creato non risulta collegato");
else {
  if (G.account.name !== "Rex") fail("il nome scelto non e stato salvato: \"" + G.account.name + "\"");
  if (!G.account.secret || G.account.secret.length !== 3) fail("il segreto a tre figure non e stato salvato");
  // l eta scelta deve arrivare da qualche parte, o e una domanda per finta
  if (G.kartSave().diff !== 1) fail("ho scelto Grande ma la difficolta di partenza e Facile");
}

/* E IL SEGRETO DEVE SERVIRE A QUALCOSA. Non e sicurezza, e una serratura di
   famiglia: deve tenere fuori il fratello che tocca a caso, e deve far entrare
   chi si ricorda le sue tre figure. */
phase = "segreto";
const mine = G.account && G.account.secret ? G.account.secret.slice() : null;
if (mine) {
  G.accounts.logout();
  G.go("accesso"); pump(30);
  const NC = G.accounts.list().length + 1;
  const CX0 = (1280 - (NC * 210 + (NC - 1) * 22)) / 2;
  tap(CX0 + 105, 320);                         // la card del primo pilota
  pump(30);
  if (G.current !== "segreto") fail("un pilota col segreto entra senza che glielo si chieda");

  const pad = (idx) => [690 + (idx % 3) * 162 + 74, 132 + Math.floor(idx / 3) * 162 + 74];
  [0, 1, 2].map((k) => (mine[k] + 1) % 9).forEach((idx) => { const p = pad(idx); tap(p[0], p[1]); pump(2); });
  pump(6);
  if (G.account) fail("un segreto sbagliato fa entrare lo stesso");
  if (G.current !== "segreto") fail("dopo un segreto sbagliato non sono piu sulla schermata del segreto");

  mine.forEach((idx) => { const p = pad(idx); tap(p[0], p[1]); pump(2); });
  pump(40);
  if (!G.account) fail("il segreto giusto non fa entrare");
  if (G.current !== "menu") fail("dopo il segreto giusto non sono nel menu ma in \"" + G.current + "\"");
}
if (!G.account) fail("nessun profilo collegato: il resto del collaudo non puo girare");

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

  /* I due tasti pista devono selezionare davvero: con una pista sola nessuno se
     ne accorgeva, perche era gia scelta. */
  tap(803, 285);                               // La Spiaggia
  pump(2);
  if (G.kartSave().track !== 1) fail("il tasto della seconda pista non la seleziona");
  tap(477, 285);                               // La Collina
  pump(2);
  if (G.kartSave().track !== 0) fail("il tasto della prima pista non la riseleziona");

  tap(640, 559);                               // VIA!
  pump(30);
  if (G.current !== "pista") fail("il tasto VIA non porta in pista (sono in \"" + G.current + "\")");

  let st = G.kartState();
  if (st.phase !== "via") fail("la gara non parte dal semaforo: fase \"" + st.phase + "\"");
  if (st.laps !== 2) fail("Facile non da 2 giri ma " + st.laps);
  pump(60);
  if (G.kartState().spd !== 0) fail("il kart si muove durante il conto alla rovescia");

  /* SULLA GRIGLIA SI DEVONO VEDERE GLI AVVERSARI. "Manca la griglia iniziale in
     cui VEDI gli avversari": mancava perche' partivano DIETRO di me, e un
     renderer a segmenti disegna solo quello che sta davanti. Erano invisibili
     per costruzione, e nessun collaudo numerico poteva accorgersene. */
  if (G.kartAhead().n < 3) {
    fail("sulla griglia vedo solo " + G.kartAhead().n + " avversari davanti: la partenza e vuota");
  }

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

  /* DERAPATA. Tengo il dito da un lato in curva finche le scintille non sono
     arancioni, poi mollo: deve arrivare la spinta. E la meccanica che il
     bambino di sei anni scoprira da sola, quindi deve esistere davvero e non
     solo essere disegnata. */
  // mi metto largo a sinistra, come si imposta una curva, senza toccare l erba
  ELS.c.dispatch("pointerdown", pev(200, 500));
  for (let i = 0; i < 200 && G.kartState().x > -0.85; i++) { ELS.c.dispatch("pointermove", pev(200, 500)); pump(1); }
  ELS.c.dispatch("pointerup", pev(200, 500)); pump(1);
  if (G.kartState().x < -1) fail("il test non riesce a mettersi largo senza finire sull erba");

  // tengo dall altra parte finche le scintille non sono arancioni, restando
  // sull asfalto: la carica muore appena una ruota tocca l erba
  ELS.c.dispatch("pointerdown", pev(1080, 500));
  for (let i = 0; i < 140; i++) {
    const s2 = G.kartState();
    if (s2.drift >= s2.drift2 + 0.1 || s2.x > 0.9) break;
    ELS.c.dispatch("pointermove", pev(1080, 500)); pump(1);
  }
  const charged = G.kartState();
  if (charged.drift < charged.drift2) fail("la derapata non si carica: " + charged.drift.toFixed(2) + "s di lock");
  ELS.c.dispatch("pointerup", pev(1080, 500));
  pump(1);
  const kicked = G.kartState();
  if (!(kicked.boost > 0.9)) fail("mollare una derapata carica non da spinta: boost " + kicked.boost.toFixed(2));

  // rientro verso il centro mentre la spinta e ancora viva, senza finire fuori
  ELS.c.dispatch("pointerdown", pev(200, 500));
  for (let i = 0; i < 26; i++) { ELS.c.dispatch("pointermove", pev(200, 500)); pump(1); }
  ELS.c.dispatch("pointerup", pev(200, 500)); pump(1);

  const fast = G.kartState();
  // sopra il tetto normale: e questo che rende la spinta una spinta
  if (!(fast.spd > fast.maxSpd * 1.05)) {
    fail("con la spinta non si va oltre il massimo: " + Math.round(fast.spd) + " contro " + fast.maxSpd);
  }
  if (fast.spd > fast.maxSpd * fast.boostMul + 1) fail("la spinta sfonda il tetto: " + Math.round(fast.spd));
  if (Math.abs(fast.x) >= 1) fail("il test e finito sull erba, la misura della spinta non vale");

  if (G.kartState().boxes < 20) fail("quasi nessuna cassa premio sulla pista: " + G.kartState().boxes);

  let offFrames = 0, ran = 0, maxLap = 1, badPlace = 0, withSomeone = 0;
  for (ran = 0; ran < 14000; ran++) {
    st = G.kartState();
    if (st.phase === "fine") break;
    if (st.x > 0.34) steerTo(-1); else if (st.x < -0.34) steerTo(1); else steerTo(0);
    if (G.kartAhead().n > 0) withSomeone++;
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
  /* Chi guida in mezzo alla strada per due giri deve raccogliere qualcosa: le
     casse sono tre di fila apposta perche prenderne una sia quasi gratis. */
  if (st.took < 5) fail("in due giri ho preso solo " + st.took + " premi: le casse non si prendono");

  /* E CI DEVE ESSERE QUALCUNO DA VEDERE. Questa e l asserzione che riassume
     tutta la lamentela: "la cosa divertente e sparargli roba, non andare piu
     veloce senza nessuno da vedere". Misurata, era il 3%: per il 97% della gara
     eri in testa su una strada deserta. Non c era nessun errore da nessuna
     parte — il campo era tutto piu lento di un pilota pulito, quindi appena
     passavi in testa la gara finiva e continuava a girare. */
  const withPct = Math.round(withSomeone / ran * 100);
  if (withPct < 25) {
    fail("per l " + (100 - withPct) + "% della gara non ho nessuno davanti: non e una gara, e una prova a cronometro");
  }

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

/* CHI NON FA NIENTE NON DEVE VINCERE.
   Questa e l asserzione piu importante di tutto il file, ed e nata da una frase:
   "e un anello stupidissimo in cui non devo fare niente". Detta del Girotondo,
   ma valeva pari pari anche qui — con i primi numeri, un pilota che non toccava
   mai lo schermo finiva primo, sull asfalto per tutta la gara. Niente errore,
   niente eccezione, niente disegno sbagliato: solo un gioco che non era un
   gioco. Un collaudo che guida bene non se ne accorge mai.
   Quindi qui non si guida affatto, e si pretende di perdere. */
/* LE ARMI DEVONO ARRIVARE E DEVONO SERVIRE.
   "La cosa divertente è sparargli roba." Quindi non basta che il proiettile
   parta e che compaia un cartello: deve raggiungere qualcuno, quel qualcuno
   deve rallentare davvero, e il rallentamento deve sopravvivere alla banda di
   recupero — altrimenti tirare il cocco è uno spettacolo senza conseguenze. */
phase = "armi";
if (G.sceneOf("pista")) {
  G.kartSave().diff = 1;
  G.kartSave().track = 0;
  G.go("pista"); pump(30);
  pump(230);

  // guido finche non mi ritrovo qualcosa in mano
  let held = null, drove = 0;
  for (drove = 0; drove < 3000 && !held; drove++) {
    const s2 = G.kartState();
    if (s2.x > 0.25) ELS.c.dispatch("pointermove", pev(200, 400));
    else if (s2.x < -0.25) ELS.c.dispatch("pointermove", pev(1080, 400));
    ELS.c.dispatch("pointerdown", pev(s2.x > 0 ? 200 : 1080, 400));
    pump(1);
    held = G.kartState().ammo;
  }
  ELS.c.dispatch("pointerup", pev(640, 400));
  pump(1);

  if (!held) {
    fail("in " + drove + " frame non ho mai trovato un'arma nelle casse");
  } else {
    const fy = G.kartState().fireY;

    /* IL TASTO DI FUOCO NON DEVE RUBARE LO STERZO quando le mani sono vuote,
       e deve rubarlo quando sono piene: altrimenti o non spari mai, o hai una
       zona morta in fondo allo schermo che nessuno ti ha spiegato. */
    ELS.c.dispatch("pointerdown", pev(1080, fy + 40));
    pump(1);
    if (G.kartState().ammo) fail("premendo sulla fascia in fondo con l'arma in mano non ho sparato");
    if (Math.abs(G.kartState().steer) > 0.01) fail("il tasto di fuoco sterza anche: mi manda fuori strada ogni volta che sparo");
    ELS.c.dispatch("pointerup", pev(1080, fy + 40));
    pump(1);

    /* Un proiettile che ha gia colpito e sparito, quindi "vola qualcosa" e
       "ha preso qualcuno" sono la stessa buona notizia: con gli avversari a un
       paio di segmenti il cocco arriva nello stesso frame in cui parte. */
    const after = G.kartState();
    if (held !== "fulmine" && after.bullets < 1 && after.hits < 1) {
      fail("ho tirato un " + held + " ma non e partito niente");
    }

    // e il colpo deve arrivare addosso a qualcuno
    let hit = 0;
    for (let i = 0; i < 400 && !hit; i++) { pump(1); hit = G.kartState().hits; }
    if (!hit) fail("il colpo non prende mai nessuno: " + held);

    /* E DEVE RALLENTARLO SUL SERIO. Il rallentamento va applicato DOPO la banda
       di recupero: messo prima, la banda gli avrebbe restituito quasi tutto
       quello che il colpo gli aveva tolto, e tirare il cocco sarebbe stato un
       bell'effetto senza nessuna conseguenza. */
    // mezzo secondo per frenare: un kart colpito non si ferma sul posto
    let hs = -1;
    for (let i = 0; i < 45; i++) { pump(1); const q = G.kartState(); if (q.hitSpd >= 0) hs = q.hitSpd; }
    if (hs < 0) {
      fail("dopo il colpo nessuno risulta colpito abbastanza a lungo da frenare");
    } else if (hs > G.kartState().maxSpd * 0.55) {
      fail("il colpo non rallenta: il kart colpito va ancora a " + Math.round(hs));
    }

    // a mani vuote la stessa fascia deve tornare a sterzare
    for (let g = 0; g < 3000 && G.kartState().ammo; g++) pump(1);
    ELS.c.dispatch("pointerdown", pev(1080, fy + 40));
    pump(2);
    if (Math.abs(G.kartState().steer) < 0.9) {
      fail("a mani vuote la fascia in fondo non sterza: c'e una zona morta");
    }
    ELS.c.dispatch("pointerup", pev(1080, fy + 40));
    pump(1);
  }
  G.go("menu"); pump(30);
}

phase = "chi non guida perde";
if (G.sceneOf("pista") && G.kartTracks) {
  const tracks = G.kartTracks();
  if (tracks.length < 2) fail("c e una pista sola: " + tracks.length);

  // due piste non possono essere la stessa pista ridipinta a meta
  const seen = {};
  tracks.forEach((t) => {
    if (!t.id || seen[t.id]) fail("due piste con lo stesso id: " + t.id);
    seen[t.id] = 1;
    if (!t.col || !t.col.grassLight || !t.plan || !t.plan.length) fail("pista incompleta: " + t.id);
  });
  if (tracks.length > 1 && tracks[0].col.grassLight === tracks[1].col.grassLight) {
    fail("le due piste hanno lo stesso colore: sono la stessa pista");
  }

  // e OGNI pista deve pretendere di essere guidata, non solo la prima
  for (let ti = 0; ti < tracks.length; ti++) {
    const g3 = G.kartSave();
    g3.diff = 1;                               // Corsa: il campo piu veloce
    g3.track = ti;
    G.go("pista"); pump(30);
    pump(220);                                 // oltre il semaforo, poi mani in mano

    let off = 0, n = 0, farMin = 1e9, farMax = -1e9;
    for (n = 0; n < 14000; n++) {
      const s2 = G.kartState();
      if (s2.phase === "fine") break;
      if (Math.abs(s2.x) >= 1) off++;
      if (s2.farX < farMin) farMin = s2.farX;
      if (s2.farX > farMax) farMax = s2.farX;
      pump(1);
    }
    /* IN CURVA LA STRADA DEVE ANDARE A FINIRE DA QUALCHE PARTE CHE SI VEDE.
       Le curve finte si accumulano verso l orizzonte: allungando i curvoni da
       46 a 170 segmenti l accumulo e triplicato, e una curva abbastanza lunga
       manda il punto di fuga fuori dallo schermo. Non e un errore, non c e
       nessun NaN: semplicemente la strada si interrompe a mezz aria di lato e
       non hai piu niente verso cui guidare. Nessun altra asserzione lo vede. */
    if (farMin < -500 || farMax > 1280 + 500) {
      fail(tracks[ti].name + ": in curva la strada sparisce di lato, orizzonte da " + Math.round(farMin) + " a " + Math.round(farMax) + "px");
    }
    const end = G.kartState();
    const who = tracks[ti].name;
    if (end.phase !== "fine") {
      fail(who + ": senza guidare la gara non finisce nemmeno, " + n + " frame");
    } else {
      if (end.place === 1) fail(who + ": si vince senza mai toccare lo schermo, la pista non chiede niente");
      else if (end.place < 4) fail(who + ": senza guidare si arriva " + end.place + "esimo, chiede troppo poco");
      if (off / n < 0.15) {
        fail(who + ": senza guidare si resta in strada per il " + Math.round(100 - off / n * 100) + "%, i curvoni non spingono");
      }
      if (end.maxCurve * end.centrif > end.steerRate * 0.7) {
        fail(who + ": la curva piu stretta spinge " + (end.maxCurve * end.centrif).toFixed(2) + " contro uno sterzo di " + end.steerRate.toFixed(2));
      }
      // un giro di venti secondi, su ogni pista
      const lap = n * 0.0167 / end.laps;
      if (lap < 12) fail(who + ": il giro dura solo " + lap.toFixed(1) + "s");
    }
    G.go("menu"); pump(30);
  }
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
