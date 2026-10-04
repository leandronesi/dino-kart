/* Dino Kart — the race on screen: 3D world, camera, sparks, HUD, controls.
   Touch: hold the left half to steer left, the right half to steer right.
   Hold all the way into a bend and the kart drifts — blue, orange, purple
   sparks — let go for the mini-turbo. The round button in the middle uses the
   item. In the air, a tap is a trick (a little boost on landing).
   Keyboard: arrows or A/D to steer, space to use, up for tricks. */
(function () {
  'use strict';
  var C = G.C, W = G.W, H = G.H, DT = 1 / 60, GL = G.GL, M4 = GL.M4;
  var S = null, acc = 0, touches = {}, keys = {}, steerV = 0, mesh = {}, camH = 0, camP = null, parts = [], banner = null, quiet = false, gp = null, eng = null, shown = { lap: 0 };
  var ITEM_BTN = { x: 640, y: 628, r: 72 };

  function T() { return G.tracks.TRACKS[S.ti]; }
  function theme() { return G.tracks.THEMES[T().theme]; }
  function sfx(n) { if (!quiet) G.sfx(n); }
  function say(s) { if (!quiet) G.say(s); }

  function start(o) {
    gp = o.gp || null; quiet = !!o.quiet;
    var acct = G.account || { name: 'Dino', color: C.dino };
    S = G.race.create({ ti: o.ti, level: G.level, player: { name: acct.name, color: acct.color }, seed: o.seed || ((Date.now() & 0xffff) | 1) });
    if (!mesh[o.ti]) mesh[o.ti] = G.tracks.build(G.tracks.TRACKS[o.ti]);
    var P = S.karts[S.player], p = G.tracks.at(T(), P.s);
    camH = p.th; camP = null; parts = []; banner = null; steerV = 0; touches = {}; keys = {}; acc = 0; shown.lap = 0;
    if (!quiet) setTimeout(function () { if (G.current === 'gara') say(T().name + '! Pronti...'); }, 200);
  }

  /* ---------------------------------------------------------------- input */
  function input() {
    if (S.auto) { var ai = G.race.aiControl(S, S.karts[S.player]); ai.bot = false; return ai; }   // for the look test
    var l = !!keys.l, r = !!keys.r, use = false, trick = !!keys.up;
    for (var id in touches) { if (touches[id] === 'l') l = true; if (touches[id] === 'r') r = true; }
    var target = (r ? 1 : 0) - (l ? 1 : 0);
    steerV += G.clamp(target - steerV, -6 * DT, 6 * DT);
    if (S.useTap) { use = true; S.useTap = false; }
    if (S.trickTap) { trick = true; S.trickTap = false; }
    return { steer: steerV, use: use, trick: trick, drift: !!keys.drift };
  }

  /* ---------------------------------------------------------------- update */
  function update(dt) {
    acc += dt; var n = 0;
    while (acc >= DT && n < 4) {
      if (S.phase !== 'pause') { G.race.step(S, input()); events(); }
      acc -= DT; n++;
    }
    if (n === 4) acc = 0;
    parts = parts.filter(function (p) { p.t -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; return p.t > 0; });
    if (banner) { banner.t -= dt; if (banner.t <= 0) banner = null; }
    engine();
  }
  function events() {
    var P = S.karts[S.player];
    S.events.forEach(function (e) {
      var mine = e.id === P.id;
      if (e.k === 'go') { sfx('win'); banner = { s: 'VIA!', t: 1, col: C.leaf }; }
      if (!mine) return;
      if (e.k === 'box') sfx('pop');
      if (e.k === 'fruit') sfx('coin');
      if (e.k === 'turbo') { sfx('whoosh'); banner = { s: ['', 'TURBO!', 'SUPER TURBO!', 'ULTRA TURBO!'][e.lvl], t: .9, col: ['', '#4d80e4', C.tangerine, C.plum][e.lvl] }; }
      if (e.k === 'pad' || e.k === 'trick') sfx('whoosh');
      if (e.k === 'hit') { sfx('bad'); if (!quiet) G.shake(6); banner = { s: 'Ahi!', t: .9, col: C.berry }; }
      if (e.k === 'bump') { if (!quiet && Math.random() < .3) sfx('tap'); }
      if (e.k === 'fall') { sfx('bad'); banner = { s: 'Oplà! Ti riporto su', t: 1.4, col: C.plum }; }
      if (e.k === 'use') sfx('whoosh');
      if (e.k === 'lap') { sfx('chime'); if (e.lap === S.laps) { banner = { s: 'ULTIMO GIRO!', t: 1.8, col: C.berry }; say('Ultimo giro!'); } else banner = { s: 'Giro ' + e.lap, t: 1.2, col: C.sun }; }
      if (e.k === 'finish') { sfx('win'); if (!quiet) G.fx.confetti(); say(P.place === 1 ? 'Primo posto! Sei il campione!' : P.place <= 3 ? 'Sul podio! Bravissimo!' : 'Arrivato! ' + P.place + ' posto'); }
    });
  }
  /* a soft engine hum that follows the speed */
  function engine() {
    if (quiet || (G.save && G.save.mute) || !window.AudioContext || S.phase === 'pause' || document.hidden) { if (eng) { try { eng.g.gain.value = 0; } catch (e) {} } return; }
    try {
      if (!eng) {
        var ac = G.audioCtx || (G.audioCtx = new (window.AudioContext || window.webkitAudioContext)());
        var o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
        o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
        o.connect(f); f.connect(g); g.connect(ac.destination); o.start(); eng = { o: o, g: g, ac: ac };
      }
      var P = S.karts[S.player];
      eng.o.frequency.value = 55 + P.v * 5 + (P.boost > 0 ? 40 : 0);
      eng.g.gain.value = S.phase === 'done' ? 0 : .025;
    } catch (e) { eng = null; }
  }
  function stopEngine() { if (eng) { try { eng.o.stop(); } catch (e) {} eng = null; } }

  /* ---------------------------------------------------------------- 3D */
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function kartPose(k) {
    var Tk = T(), p = G.tracks.at(Tk, k.s), pos = G.tracks.world(Tk, k.s, k.d, k.y), H = p.th + k.yaw;
    return { pos: pos, H: H, p: p };
  }
  function draw3D(c) {
    var th = theme(), P = S.karts[S.player], pose = kartPose(P), Tk = T();
    // the camera: behind the kart, looking where the road goes; it swings softly
    var lookH = P.spin > 0 || P.fall > 0 ? pose.p.th : pose.H;
    camH += wrapA(lookH - camH) * Math.min(1, G.dt * 5);
    var fin = S.phase === 'done', orbit = fin ? S.doneT * .5 : 0, back = fin ? 9 : 5.4, ch = camH + orbit;
    var dir = [Math.cos(ch), 0, Math.sin(ch)], tgt = pose.pos;
    if (P.fall > 0) tgt = [tgt[0], tgt[1] - (1.4 - P.fall) * 6, tgt[2]];
    var eye = [tgt[0] - dir[0] * back, tgt[1] + 2.7 + (fin ? 1.5 : 0), tgt[2] - dir[2] * back];
    if (!camP) camP = eye.slice();
    for (var q = 0; q < 3; q++) camP[q] += (eye[q] - camP[q]) * Math.min(1, G.dt * 9);
    var at = [tgt[0] + dir[0] * 7, tgt[1] + 1.4, tgt[2] + dir[2] * 7];
    var w = Math.max(320, Math.min(1280, Math.round(W * G.view.s * G.view.dpr))), h = Math.round(w * 9 / 16);
    var boostFov = P.boost > 0 ? .12 : 0;
    if (!GL.frame({ w: w, h: h, eye: camP, at: at, fov: 1.05 + boostFov, sky: th.fog, fog: th.space ? [140, 420] : [80, 300], far: 600 })) return false;
    GL.draw(mesh[S.ti]);
    var t = G.t, F = G.tracks.features(Tk), models = G.models;
    // boost pads
    F.pads.forEach(function (pd) { var p = G.tracks.at(Tk, pd.s), wpos = G.tracks.world(Tk, pd.s, pd.d, .02); GL.draw(models.pad(), M4.mul(M4.trans(wpos[0], wpos[1], wpos[2]), M4.rotY(Math.PI / 2 - p.th))); });
    // item boxes and fruit
    S.boxes.forEach(function (b) {
      if (b.t > 0) return; var wpos = G.tracks.world(Tk, b.s, b.d, 1.3 + Math.sin(t * 3 + b.d) * .15);
      GL.draw(models.itemBox(), M4.mul(M4.trans(wpos[0], wpos[1], wpos[2]), M4.mul(M4.rotY(t * 1.5 + b.d), M4.rotX(.5))));
    });
    S.fruits.forEach(function (f) {
      if (f.t > 0) return; var wpos = G.tracks.world(Tk, f.s, f.d, 1.1 + Math.sin(t * 4 + f.s) * .12);
      GL.draw(models.fruit(), M4.mul(M4.trans(wpos[0], wpos[1], wpos[2]), M4.rotY(t * 2 + f.s)));
    });
    // bananas and shells
    S.objs.forEach(function (o) {
      var wpos = G.tracks.world(Tk, o.s, o.d, o.k === 'banana' ? 0 : .1), m = o.k === 'banana' ? models.banana() : models.shell(o.k === 'rosso');
      GL.draw(m, M4.mul(M4.trans(wpos[0], wpos[1], wpos[2]), M4.rotY(o.k === 'banana' ? o.s : t * 8)));
    });
    // karts, with a blob shadow each
    S.karts.forEach(function (k) {
      if (k.fall > 0 && k.fall < 1.1) return;
      var ps = kartPose(k), yaw = Math.PI / 2 - ps.H + (k.spin > 0 ? k.spinA : 0) + (k.drift ? -k.drift * .35 : 0);
      var road = G.tracks.world(Tk, k.s, k.d, .04);
      GL.draw(models.blob(), M4.mul(M4.trans(road[0], road[1], road[2]), M4.rotY(Math.PI / 2 - ps.H)), { alpha: .28 });
      var bob = Math.sin(t * 30 + k.id) * .03 * (k.v / 26), tilt = -k.steer * .06 * (k.v / 26) + (k.drift ? k.drift * .08 : 0);
      var m = M4.mul(M4.trans(ps.pos[0], ps.pos[1] + bob, ps.pos[2]), M4.mul(M4.rotY(yaw), M4.rotZ(tilt)));
      if (k.air) m = M4.mul(m, M4.rotX(-.15));
      // a kart right on top of the camera would hide your own: let it be see-through
      var camD = Math.hypot(ps.pos[0] - camP[0], ps.pos[2] - camP[2]), see = k !== P && camD < 5.5 ? .35 : 1;
      GL.draw(models.kart(k.col), m, see < 1 ? { alpha: see } : k.star > 0 ? { tint: [1.2 + Math.sin(t * 20) * .3, 1.1, .6 + Math.sin(t * 15) * .4] } : null);
    });
    c.drawImage(GL.R.canvas, 0, 0, W, H);
    return true;
  }
  function backdrop(c) {
    var th = theme(), g = c.createLinearGradient(0, 0, 0, H * .62);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]); c.fillStyle = g; c.fillRect(0, 0, W, H);
    var off = ((-camH / (Math.PI * 2)) * 2400 % 2400 + 2400) % 2400, i, x;
    if (th.space) {
      c.fillStyle = '#ffffff';
      for (i = 0; i < 120; i++) { x = ((i * 233 + off * .5) % 1400) - 60; var y = (i * 97) % 420, r = (i % 3) + 1; c.globalAlpha = .4 + (i % 5) / 8; c.fillRect(x, y, r, r); }
      c.globalAlpha = 1; return;
    }
    c.fillStyle = 'rgba(255,250,215,.9)'; c.beginPath(); c.arc(((1000 + off * .3) % 1600) - 160, 110, 46, 0, 7); c.fill();
    c.fillStyle = th.hills || '#9cc7b5';
    for (i = -1; i < 7; i++) { x = i * 400 - (off % 400); c.beginPath(); c.moveTo(x - 260, 420); c.quadraticCurveTo(x, 180 + (i % 3) * 40, x + 260, 420); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.75)';
    for (i = 0; i < 6; i++) { x = ((i * 330 + off * .6) % 1700) - 200; c.beginPath(); c.arc(x, 90 + (i % 3) * 36, 30, 0, 7); c.arc(x + 34, 82 + (i % 3) * 36, 26, 0, 7); c.arc(x + 62, 94 + (i % 3) * 36, 22, 0, 7); c.fill(); }
  }
  /* sparks, flames, dust: 2D, glued to projected 3D points */
  function effects(c) {
    var P = S.karts[S.player], Tk = T();
    S.karts.forEach(function (k) {
      if (k.fall > 0) return;
      var ps = kartPose(k), sx = Math.cos(ps.H), sz = Math.sin(ps.H), rx = -sz, rz = sx;
      var rear = [ps.pos[0] - sx * 1.6, ps.pos[1] + .3, ps.pos[2] - sz * 1.6];
      var pr = GL.project(rear, W, H); if (!pr || pr.s < .004) return;
      var sc = Math.min(3, pr.s * 70);
      if (k.drift && k.charge > .2) {
        var lvl = k.charge > 2.2 ? 3 : k.charge > 1.4 ? 2 : k.charge > .7 ? 1 : 0, col = ['#ffffff', '#5ab0ff', '#ffb04a', '#c58cff'][lvl];
        [-1, 1].forEach(function (sd) {
          var wp = GL.project([rear[0] + rx * sd, rear[1] - .2, rear[2] + rz * sd], W, H); if (!wp) return;
          for (var i = 0; i < 3; i++) { c.fillStyle = col; c.beginPath(); c.arc(wp.x + (Math.random() - .5) * 14 * sc, wp.y - Math.random() * 10 * sc, (2 + Math.random() * 3) * sc, 0, 7); c.fill(); }
        });
      }
      if (k.boost > 0) {
        for (var i = 0; i < 4; i++) { c.fillStyle = i % 2 ? '#ffd75e' : '#ff7a1a'; c.beginPath(); c.arc(pr.x + (Math.random() - .5) * 18 * sc, pr.y + (Math.random() - .5) * 8 * sc, (6 + Math.random() * 8) * sc, 0, 7); c.fill(); }
      }
      if (k === P && Math.abs(P.d) > Tk.width / 2 + .8 && P.v > 6 && !theme().space && Math.random() < .5)
        parts.push({ x: pr.x + (Math.random() - .5) * 60, y: pr.y, vx: (Math.random() - .5) * 60, vy: -40 - Math.random() * 40, t: .5, col: 'rgba(160,130,90,.6)', r: 8 });
    });
    parts.forEach(function (p) { c.globalAlpha = Math.max(0, p.t * 2); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, 7); c.fill(); });
    c.globalAlpha = 1;
    // speed lines when boosting
    if (P.boost > 0) { c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 4; for (var j = 0; j < 14; j++) { var a = (j * 2.4 + G.t * 7) % 6.28, r0 = 360 + (j * 37 % 160); c.beginPath(); c.moveTo(640 + Math.cos(a) * r0, 360 + Math.sin(a) * r0 * .6); c.lineTo(640 + Math.cos(a) * (r0 + 160), 360 + Math.sin(a) * (r0 + 160) * .6); c.stroke(); } }
  }

  /* ---------------------------------------------------------------- HUD */
  function itemIcon(c, it, x, y, r) {
    c.save();
    if (it === 'banana') { c.strokeStyle = '#ffd75e'; c.lineWidth = r * .4; c.lineCap = 'round'; c.beginPath(); c.arc(x, y - r * .3, r * .6, .3, Math.PI - .3); c.stroke(); }
    else if (it === 'verde' || it === 'rosso') { c.fillStyle = it === 'verde' ? '#2f9e57' : '#e8362b'; c.beginPath(); c.arc(x, y, r * .62, Math.PI, 0); c.fill(); c.fillStyle = '#fff6e0'; c.fillRect(x - r * .7, y, r * 1.4, r * .2); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(x - r * .2, y - r * .3, r * .15, 0, 7); c.fill(); }
    else if (it === 'turbo') { c.fillStyle = '#e8362b'; c.beginPath(); c.ellipse(x, y + r * .1, r * .3, r * .62, .5, 0, 7); c.fill(); c.fillStyle = C.leaf; c.fillRect(x + r * .1, y - r * .7, r * .2, r * .3); }
    else if (it === 'stella') A.star(c, x, y, r * .7, C.sun);
    else if (it === 'frutti') { A.fruit(c, x - r * .3, y + r * .1, r * .35, 'fragola'); A.fruit(c, x + r * .3, y + r * .1, r * .35, 'mela'); A.fruit(c, x, y - r * .3, r * .35, 'banana'); }
    c.restore();
  }
  function minimap(c, x0, y0, sz) {
    var Ss = G.tracks.sample(T()), mx = Math.min.apply(null, Ss.x), Mx = Math.max.apply(null, Ss.x), mz = Math.min.apply(null, Ss.z), Mz = Math.max.apply(null, Ss.z);
    var k = sz / Math.max(Mx - mx, Mz - mz), ox = x0 + (sz - (Mx - mx) * k) / 2, oz = y0 + (sz - (Mz - mz) * k) / 2;
    c.fillStyle = 'rgba(23,40,55,.5)'; G.roundRect(c, x0 - 12, y0 - 12, sz + 24, sz + 24, 18); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 6; c.lineJoin = 'round'; c.beginPath();
    for (var i = 0; i <= Ss.N; i += 4) { var j = i % Ss.N; if (i) c.lineTo(ox + (Ss.x[j] - mx) * k, oz + (Ss.z[j] - mz) * k); else c.moveTo(ox + (Ss.x[j] - mx) * k, oz + (Ss.z[j] - mz) * k); }
    c.closePath(); c.stroke();
    S.karts.slice().reverse().forEach(function (kt) { var p = G.tracks.at(T(), kt.s); c.fillStyle = kt.col; c.beginPath(); c.arc(ox + (p.x - mx) * k, oz + (p.z - mz) * k, kt.ai ? 6 : 9, 0, 7); c.fill(); if (!kt.ai) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke(); } });
  }
  function fmt(t) { var m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); }
  function hud(c) {
    var P = S.karts[S.player], placeCol = ['#ffd75e', '#e9edf0', '#e0a066'][P.place - 1] || '#ffffff';
    G.text(P.place + '°', 92, 70, { size: 92, color: placeCol, stroke: '#1b2b3a', strokeWidth: 12 });
    G.text('/' + S.karts.length, 162, 92, { size: 28, color: '#fff', stroke: '#1b2b3a', strokeWidth: 6 });
    A.fruit(c, 50, 152, 20, 'fragola'); G.text('×' + P.coins, 74, 153, { size: 30, color: '#fff', align: 'left', stroke: '#1b2b3a', strokeWidth: 6 });
    minimap(c, 24, 200, 150);
    c.fillStyle = 'rgba(23,40,55,.55)'; G.roundRect(c, 470, 10, 340, 74, 22); c.fill();
    G.text('GIRO ' + Math.max(1, Math.min(S.laps, P.lap + 1)) + '/' + S.laps, 560, 47, { size: 30, color: '#fff' });
    G.text(fmt(S.t), 718, 47, { size: 28, color: C.sun });
    // the item slot
    c.fillStyle = 'rgba(23,40,55,.6)'; G.roundRect(c, 1124, 14, 136, 136, 28); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 5; G.roundRect(c, 1132, 22, 120, 120, 22); c.stroke();
    if (P.roul > 0) itemIcon(c, G.race.ITEMS[Math.floor(G.t * 14) % G.race.ITEMS.length], 1192, 82, 50);
    else if (P.item) itemIcon(c, P.item, 1192, 82, 50);
    if (P.item && P.roul <= 0 && S.phase === 'race') {
      var pulse = 1 + Math.sin(G.t * 8) * .05, b = ITEM_BTN;
      c.fillStyle = 'rgba(255,246,224,.9)'; c.beginPath(); c.arc(b.x, b.y, b.r * pulse, 0, 7); c.fill(); c.strokeStyle = C.berry; c.lineWidth = 8; c.stroke();
      itemIcon(c, P.item, b.x, b.y + 4, 46);
    }
    // countdown
    if (S.phase === 'count') {
      var n = Math.ceil(S.count - .4);
      c.fillStyle = 'rgba(23,40,55,.7)'; G.roundRect(c, 470, 120, 340, 110, 30); c.fill();
      for (var i = 0; i < 3; i++) { c.fillStyle = 3 - i > n ? (n <= 0 ? C.leaf : '#e8362b') : '#3b4b5a'; c.beginPath(); c.arc(550 + i * 90, 175, 36, 0, 7); c.fill(); }
      if (n > 0 && n <= 3) G.text(String(n), 640, 330, { size: 130, color: '#fff', stroke: '#1b2b3a', strokeWidth: 14 });
    }
    if (banner) G.text(banner.s, 640, 300 - (1 - Math.min(1, banner.t)) * 30, { size: 70, color: banner.col, stroke: '#1b2b3a', strokeWidth: 12 });
    if (S.phase === 'race' && S.t < 6) {
      c.globalAlpha = Math.max(0, 1 - S.t / 6) * .8;
      [[-1, 110], [1, 1170]].forEach(function (d) { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(d[1], 520, 64, 0, 7); c.fill(); c.fillStyle = '#1b2b3a'; c.beginPath(); c.moveTo(d[1] + d[0] * 30, 520); c.lineTo(d[1] - d[0] * 20, 486); c.lineTo(d[1] - d[0] * 20, 554); c.fill(); });
      c.globalAlpha = 1;
    }
    G.ui.button({ id: 'g-pause', x: 900, y: 14, w: 200, h: 80, r: 22, color: 'rgba(23,40,55,.6)', label: 'Ⅱ', fontSize: 38, onTap: function () { if (S.phase === 'race' || S.phase === 'count') { S.prev = S.phase; S.phase = 'pause'; } } });
  }
  function results(c) {
    c.fillStyle = 'rgba(15,25,40,.72)'; c.fillRect(0, 0, W, H);
    c.fillStyle = C.cream; G.roundRect(c, 270, 40, 740, 640, 34); c.fill();
    var P = S.karts[S.player], me = S.results.filter(function (r) { return r.player; })[0];
    G.text(me.place === 1 ? 'Hai vinto!' : me.place <= 3 ? 'Sul podio!' : me.place + '° posto', 640, 100, { size: 54, color: C.leafDeep });
    S.results.forEach(function (r, i) {
      var y = 160 + i * 52;
      c.fillStyle = r.player ? '#ffe9a8' : (i % 2 ? '#f3ead6' : '#fbf4e4'); G.roundRect(c, 310, y - 22, 660, 46, 14); c.fill();
      G.text(r.place + '°', 350, y, { size: 28, color: C.ink });
      c.fillStyle = r.col; c.beginPath(); c.arc(400, y, 15, 0, 7); c.fill();
      G.text(r.name, 430, y, { size: 26, color: C.ink, align: 'left', maxWidth: 260 });
      G.text(fmt(r.time), 800, y, { size: 24, color: '#5a6a7a' });
      if (gp) G.text('+' + r.points, 920, y, { size: 26, color: C.leaf });
    });
    var bx = gp ? [[350, 'Classifica', C.leaf, function () { G.go('classifica'); }]] : [[290, 'Riprova', C.water, function () { start({ ti: S.ti }); }], [530, 'Altra pista', C.leaf, function () { G.go('piste'); }], [770, 'Menu', C.tangerine, function () { G.go('menu'); }]];
    bx.forEach(function (b) { G.ui.button({ id: 'r-' + b[1], x: gp ? 440 : b[0], y: 592, w: gp ? 400 : 220, h: 76, r: 24, color: b[2], label: b[1], fontSize: 30, onTap: b[3] }); });
  }
  function pauseMenu(c) {
    c.fillStyle = 'rgba(15,25,40,.7)'; c.fillRect(0, 0, W, H);
    c.fillStyle = C.cream; G.roundRect(c, 340, 180, 600, 360, 34); c.fill();
    G.text('Pausa', 640, 250, { size: 56, color: C.leafDeep });
    G.ui.button({ id: 'p-go', x: 380, y: 360, w: 250, h: 100, color: C.leaf, label: 'Continua', onTap: function () { S.phase = S.prev || 'race'; } });
    G.ui.button({ id: 'p-out', x: 650, y: 360, w: 250, h: 100, color: C.tangerine, label: 'Esci', onTap: function () { G.go('menu'); } });
  }
  function draw(c) {
    backdrop(c);
    if (!draw3D(c)) { G.text('Il 3D non è disponibile su questo dispositivo', 640, 360, { size: 30, color: '#fff' }); return; }
    effects(c); hud(c);
    if (S.phase === 'done' && S.doneT > 2.2 && S.results) {
      if (!S.counted) { S.counted = true; if (gp) G.gpRecord(S.results); else G.kartBestSingle(S); }
      results(c);
    }
    if (S.phase === 'pause') pauseMenu(c);
  }

  function ctrlAt(p) {
    if (S.karts[S.player].item && Math.hypot(p.x - ITEM_BTN.x, p.y - ITEM_BTN.y) < ITEM_BTN.r + 12) return 'item';
    if (p.y < 110) return null;
    return p.x < 640 ? 'l' : 'r';
  }
  G.scene('gara', {
    hud: false, back: false,
    enter: function (o) { start(o || { ti: 0 }); },
    exit: function () { stopEngine(); touches = {}; keys = {}; },
    update: update, draw: draw,
    onDown: function (p) {
      if (S.phase === 'done' || S.phase === 'pause') return;
      var k = ctrlAt(p); if (!k) return;
      if (S.karts[S.player].air) S.trickTap = true;
      if (k === 'item') { S.useTap = true; return; }
      touches[p.id] = k;
    },
    onMove: function (p) { if (touches[p.id]) { var k = ctrlAt(p); if (k === 'l' || k === 'r') touches[p.id] = k; } },
    onUp: function (p) { delete touches[p.id]; },
    onCancel: function () { touches = {}; }
  });
  var KEY = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'up', w: 'up', W: 'up', Shift: 'drift' };
  window.addEventListener('keydown', function (e) {
    if (G.current !== 'gara' || !S) return;
    if (e.key === ' ') { e.preventDefault(); S.useTap = true; return; }
    if (e.key === 'Escape') { if (S.phase === 'race') { S.prev = 'race'; S.phase = 'pause'; } else if (S.phase === 'pause') S.phase = S.prev; return; }
    var k = KEY[e.key]; if (k) { e.preventDefault(); keys[k] = true; if (k === 'up' && S.karts[S.player].air) S.trickTap = true; }
  });
  window.addEventListener('keyup', function (e) { var k = KEY[e.key]; if (k) keys[k] = false; });
  window.addEventListener('blur', function () { keys = {}; touches = {}; });
  document.addEventListener('visibilitychange', function () { if (document.hidden && S && G.current === 'gara' && S.phase === 'race') { S.prev = 'race'; S.phase = 'pause'; } });

  G.gara = { state: function () { return S; }, start: start, mesh: mesh, quiet: function (q) { quiet = q; } };
})();
