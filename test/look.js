#!/usr/bin/env node
/* THE TEST THAT LOOKS AT THE SCREEN.

   `test/smoke.js` drives the game and checks numbers: speed, lap, position,
   whether a passive driver loses. It passed forty assertions on a build that
   was, in the words of the person it is for, "oggettivamente ancora
   ingiocabile" — because not one of those assertions had ever looked at a
   picture. The road was nearly three screens wide where the kart sat, so both
   edges were off-frame and you could not tell where on the road you were; the
   moment you slid onto the grass the tarmac left the screen entirely and you
   were alone in a field with a tree; and light and dark road bands differed by
   eight units out of 255, so at full speed the ground did not appear to move.
   Every one of those is invisible to a numeric test and obvious in one frame.

   So this renders the real draw calls to a bitmap and asserts on the PIXELS.
   It also writes the frames to test/frames/ so a human can look too.

   `node test/look.js`  — exit code 0 = clean. */
'use strict';
const path = require('path');
const boot = require('./harness.js');

const GAME = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'frames');
const { G, quiet, shot, px, steer } = boot(GAME);

const failures = [];
function fail(m) { if (!failures.includes(m)) failures.push(m); }

const W = 1280, H = 720;

/* What is this pixel? Deliberately coarse: the question is never "is this
   #6b6f76", it is "is this road, or is this the stuff beside the road". */
function kind(c) {
  const [r, g, b] = c;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx - mn < 26 && r > 60 && r < 190) return 'strada';
  if (b > r + 25 && b > g + 10) return 'cielo';
  return 'bordo';                                    // erba, sabbia, qualunque cosa
}
function luma(c) { return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }

/* Where the player's kart actually got painted. Found by its own colour — the
   dino wears the account colour and nothing else on the lower band does, since
   crates and rivals are never drawn nearer than the kart. */
function kartSpan() {
  const want = G.account && G.account.color ? G.account.color : '#57c98a';
  const r0 = parseInt(want.slice(1, 3), 16), g0 = parseInt(want.slice(3, 5), 16), b0 = parseInt(want.slice(5, 7), 16);
  let first = -1, last = -1, n = 0;
  for (let y = 590; y < H - 20; y += 4) {
    for (let x = 2; x < W - 2; x += 2) {
      const c = px(x, y);
      if (Math.abs(c[0] - r0) < 24 && Math.abs(c[1] - g0) < 24 && Math.abs(c[2] - b0) < 24) {
        if (first < 0 || x < first) first = x;
        if (x > last) last = x;
        n++;
      }
    }
  }
  return { first, last, px: n };
}

/* Left and right edge of the tarmac on one screen row. */
function roadSpan(y) {
  let first = -1, last = -1, n = 0;
  for (let x = 2; x < W - 2; x += 2) {
    if (kind(px(x, y)) === 'strada') {
      if (first < 0) first = x;
      last = x; n++;
    }
  }
  return { first, last, px: n * 2 };
}

console.log('Dino Kart — collaudo a occhio\n');

const tracks = G.kartTracks();
quiet(20);

tracks.forEach((track, ti) => {
  const label = track.name;
  G.kartSave().diff = 1;
  G.kartSave().track = ti;
  G.go('pista'); quiet(30);
  quiet(230);                                        // oltre il semaforo
  /* E poi GUIDO per un po'. Prima qui c'era solo un'attesa, e su una pista che
     gira sempre dallo stesso lato l'attesa finisce nell'erba: il collaudo
     fotografava un kart fuori strada e poi si lamentava che sotto il kart non
     c'era asfalto. Giusta l'asserzione, sbagliato il pilota. */
  for (let i = 0; i < 130; i++) {
    const s = G.kartState();
    if (s.x > 0.18) steer(-1); else if (s.x < -0.18) steer(1); else steer(0);
    quiet(1);
  }
  steer(0); quiet(2);

  shot(OUT, (ti + 1) + '-' + track.id + '-rettilineo');

  /* 1. SI DEVONO VEDERE TUTTI E DUE I BORDI DELLA STRADA.
     Con la strada larga il doppio dello schermo non ne vedevi nessuno dei due
     nella meta bassa dell immagine: guidavi al centro di una lastra grigia
     senza nessun riferimento, e scoprivi dov eri solo finendo sull erba. */
  /* Le righe dove si GUARDA, non quella sotto il muso. In fondo allo schermo la
     strada e larghissima ed e giusto che sfori: e il metro davanti alle ruote.
     La riga 520 basta e avanza a beccare il difetto originale — con ROAD_W a
     2000 sforava proprio li. */
  [470, 520].forEach((y) => {
    const s = roadSpan(y);
    if (s.first < 0) { fail(label + ': a y=' + y + ' non c e strada in vista'); return; }
    if (s.first < 16) fail(label + ': a y=' + y + ' il bordo sinistro della strada e fuori schermo');
    if (s.last > W - 16) fail(label + ': a y=' + y + ' il bordo destro della strada e fuori schermo');
  });

  /* 2. IL KART DEVE STARE SULLA STRADA, e va cercato dove e disegnato davvero,
     non dove spero che sia. Per un po il kart si spostava di 64px per ogni
     larghezza-di-strada mentre la strada sotto se ne spostava 773: al bordo
     dell asfalto il dino veniva disegnato ACCANTO alla pista, in mezzo al
     prato. Un controllo sul pixel centrale non se ne sarebbe mai accorto,
     perche il centro dello schermo era ancora asfalto. */
  const me = kartSpan();
  if (me.px < 400) {
    fail(label + ': non trovo il kart disegnato in fondo allo schermo');
  } else {
    const mid = (me.first + me.last) / 2;
    if (Math.abs(mid - W / 2) > 40) {
      fail(label + ': il kart e disegnato a x=' + Math.round(mid) + ' invece che al centro (' + (W / 2) + ')');
    }
    if (kind(px(Math.round(mid), H - 10)) !== 'strada') {
      fail(label + ': stando in mezzo alla strada, sotto il kart non c e asfalto');
    }
  }

  /* 3. LE BANDE DEVONO AVERE CONTRASTO. E' il contrasto chiaro/scuro che fa la
     velocita in un renderer a segmenti, non la velocita. A 8 unita su 255 la
     strada era una lastra ferma: a 12000 o a 4000 lo schermo era identico. */
  let lo = 999, hi = -999;
  for (let y = 420; y < 700; y += 3) {
    const c = px(W / 2 - 260, y);
    if (kind(c) !== 'strada') continue;
    const l = luma(c);
    if (l < lo) lo = l;
    if (l > hi) hi = l;
  }
  if (hi - lo < 14) {
    fail(label + ': le bande della strada non si distinguono (' + Math.round(hi - lo) + ' su 255): niente senso di velocita');
  }

  /* 4. FUORI STRADA NON SI PERDE LA STRADA. Questo era il peggio di tutti: a
     2,4 larghezze di scarto l asfalto usciva dall inquadratura e restavi in un
     prato con un albero, senza sapere da che parte fosse finita la pista.
     CTR ha i muri; qui basta che la pista resti in vista. */
  /* Vado fuori FINCHE NON MI FERMO DA SOLO, cioe fino al limite vero qualunque
     esso sia. Fermarsi a una soglia scelta da me collauderebbe la soglia, non
     il gioco: col vecchio limite di 2,4 il test si fermava a 1,24 e non vedeva
     mai lo stato in cui la pista sparisce. */
  const stick = G.kartState().x >= 0 ? -1 : 1;
  steer(stick);
  let prev = 99, still = 0, guard = 0;
  while (guard++ < 900 && still < 14) {
    quiet(1);
    const x = G.kartState().x;
    if (Math.abs(x - prev) < 0.0009) still++; else still = 0;
    prev = x;
  }
  steer(0);
  quiet(1);
  shot(OUT, (ti + 1) + '-' + track.id + '-fuoripista');

  const off = G.kartState();
  if (Math.abs(off.x) < 1.2) {
    fail(label + ': il test non e riuscito a uscire di strada, x=' + off.x.toFixed(2));
  } else {
    const s = roadSpan(560);
    if (s.px < 220) {
      fail(label + ': fuori strada si vedono solo ' + s.px + 'px di asfalto: la pista sparisce');
    }
  }

  G.go('menu'); quiet(30);
});

console.log('');
if (failures.length) {
  console.log('✗ ' + failures.length + ' problemi:\n');
  failures.forEach((f) => console.log('  · ' + f));
  console.log('\nfotogrammi in test/frames/ — guardali.');
  process.exit(1);
} else {
  console.log('✓ la pista si vede: due bordi in quadro, kart sull asfalto,');
  console.log('  bande con contrasto, e fuori strada la pista resta in vista.');
  console.log('  fotogrammi in test/frames/');
  process.exit(0);
}
