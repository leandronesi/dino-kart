/* Dino Kart — the race, as data. No drawing here.

   Every kart lives in track coordinates: s (metres along the centre line,
   wrapping each lap) and d (metres to the right of it), plus its heading
   relative to the track. That makes walls, the racing line, item boxes and
   "who is ahead" one-line questions, and it cannot fall off a curve.

   Steering, auto-drift with mini-turbos, ramps, boost pads, fruit (each one
   adds a little top speed, up to ten), item boxes and six items, eight karts
   with a racing line, rubber band and items of their own. S is plain data
   with its own seeded dice, so test/smoke.js can run whole races in a blink. */
(function () {
  'use strict';
  var DT = 1 / 60, TR = function () { return G.tracks; };
  var RIVALS = [
    { name: 'Rex', col: '#e8536b' }, { name: 'Trici', col: '#ff9f43' }, { name: 'Stego', col: '#ffd75e' }, { name: 'Ptero', col: '#8f5bd6' },
    { name: 'Brachi', col: '#4d80e4' }, { name: 'Anchi', col: '#38d9a9' }, { name: 'Spino', col: '#ff6fae' }, { name: 'Pachi', col: '#9aa0a6' }
  ];
  var ITEMS = ['banana', 'verde', 'rosso', 'turbo', 'stella', 'frutti'];
  var POINTS = [15, 12, 10, 8, 6, 4, 2, 1];

  function rnd(S) {
    S.seed = (S.seed + 0x6D2B79F5) | 0;
    var t = S.seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function wrapA(a) { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; }
  function track(S) { return TR().TRACKS[S.ti]; }

  /* o = { ti, level (1|2), player: {name, color}, seed, laps } */
  function create(o) {
    var T = TR().TRACKS[o.ti], L = TR().sample(T).L, F = TR().features(T);
    var S = { ti: o.ti, level: o.level, laps: o.laps || (o.level === 1 ? 2 : 3), t: 0, phase: 'count', count: 3.4, seed: o.seed || 7, karts: [], objs: [], events: [],
      boxes: F.boxes.map(function (b) { return { s: b.s, d: b.d, t: 0 }; }), fruits: F.fruits.map(function (f) { return { s: f.s, d: f.d, t: 0 }; }), doneT: 0, results: null };
    var rivals = RIVALS.filter(function (r) { return r.col.toLowerCase() !== String(o.player.color).toLowerCase(); }).slice(0, 7);
    var skills = o.level === 1 ? [.8, .81, .82, .83, .84, .85, .86] : [.86, .875, .89, .9, .91, .92, .935];
    var order = [0, 1, 2, 3, 4, 'P', 5, 6];      // the child starts fifth: there are karts to chase from the first second
    var ri = 0;
    order.forEach(function (who, slot) {
      var row = Math.floor(slot / 2), side = slot % 2 ? 3.6 : -3.6, isP = who === 'P', r = isP ? null : rivals[ri++];
      S.karts.push({ id: slot, name: isP ? o.player.name : r.name, col: isP ? o.player.color : r.col, ai: !isP, skill: isP ? 1 : skills[who],
        s: L - 8 - row * 7.5, d: side, yaw: 0, v: 0, y: 0, vy: 0, air: false, drift: 0, hold: 0, charge: 0, boost: 0, spin: 0, spinA: 0, star: 0,
        item: null, roul: 0, coins: 0, lap: -1, lapT: 0, laps: [], finished: false, ftime: 0, place: slot + 1, fall: 0, trick: false, aiOff: (rnd(S) - .5) * 3, aiHold: 0, steer: 0 });
    });
    S.player = 5;
    return S;
  }
  function progress(S, k) { return k.lap * TR().sample(track(S)).L + k.s; }

  function vmax(S, k) {
    var v = (S.level === 1 ? 21 : 26) * (1 + .012 * k.coins);
    if (k.ai) {
      var P = S.karts[S.player], gap = progress(S, k) - progress(S, P);
      // rubber band: nobody escapes for good, nobody is left behind for good
      v *= k.skill * (1 - G.clamp(gap / 300, -.12, .05));   // behind the child: hurry; ahead: barely wait
    }
    if (k.boost > 0) v *= 1.38; if (k.star > 0) v *= 1.2;
    return v;
  }

  function step(S, input) {
    S.events.length = 0;
    if (S.phase === 'count') { S.count -= DT; if (S.count <= 0) { S.phase = 'race'; S.events.push({ k: 'go' }); } return; }
    S.t += DT;
    var T = track(S);
    S.karts.forEach(function (k) {
      if (k.finished && !k.ai && S.phase === 'race') { /* the player's kart keeps rolling on autopilot after the line */ }
      var c = (k.ai || k.finished) ? aiControl(S, k) : (input || {});
      drive(S, T, k, c);
    });
    collide(S);
    objects(S, T);
    places(S);
    S.boxes.forEach(function (b) { b.t = Math.max(0, b.t - DT); }); S.fruits.forEach(function (f) { f.t = Math.max(0, f.t - DT); });
    var P = S.karts[S.player];
    if (P.finished && S.phase === 'race') { S.phase = 'done'; S.doneT = 0; finishAll(S); }
    if (S.phase === 'done') S.doneT += DT;
  }

  function drive(S, T, k, c) {
    var Ts = TR(), p = Ts.at(T, k.s), half = T.width / 2, space = Ts.THEMES[T.theme].space, L = Ts.sample(T).L;
    if (k.fall > 0) { k.fall -= DT; if (k.fall <= 0) { k.d = 0; k.yaw = 0; k.v = 8; k.y = 0; k.vy = 0; k.air = false; } return; }
    var target = vmax(S, k), off = !space && Math.abs(k.d) > half + .8;
    if (off) target *= k.boost > 0 || k.star > 0 ? .85 : .55;
    if (space && Math.abs(k.d) > half - 1) target *= .7;          // the rainbow's edge is slow, not a wall
    var steer = G.clamp(c.steer || 0, -1, 1);
    // Piccolo: a hand on the wheel keeps him off the barriers, never steers the bends for him
    if (!k.ai && S.level === 1 && Math.abs(k.d) > half + (space ? 0 : 1.5) && steer * k.d >= 0) steer = G.clamp(steer - Math.sign(k.d) * .45, -1, 1);
    k.steer = steer;
    var H = p.th + k.yaw;
    if (k.spin > 0) {
      k.spin -= DT; k.spinA += 14 * DT; k.v = Math.max(0, k.v - 30 * DT); k.drift = 0; k.charge = 0;
    } else {
      var rate = 1.75 * G.clamp(k.v / 12, .3, 1);
      // auto-drift: hold the wheel all the way and the kart slides; let go for the mini-turbo
      if (!k.drift && !k.air && !c.bot && k.v > 15 && Math.abs(steer) > .85) { k.hold += DT; if (k.hold > .2 || c.drift) { k.drift = Math.sign(steer); k.charge = 0; S.events.push({ k: 'drift', id: k.id }); } }
      else if (!k.drift) k.hold = 0;
      if (k.drift) {
        if (Math.abs(steer) < .25 || k.v < 9 || off) {
          var lvl = k.charge > 2.2 ? 3 : k.charge > 1.4 ? 2 : k.charge > .7 ? 1 : 0;
          if (lvl) { k.boost = Math.max(k.boost, [0, .55, .9, 1.3][lvl]); S.events.push({ k: 'turbo', id: k.id, lvl: lvl }); }
          k.drift = 0; k.hold = 0; k.charge = 0;
        } else {
          H += k.drift * (.9 + .6 * steer * k.drift) * DT;     // inward: tight, neutral: medium, outward: wide
          k.charge += DT * (steer * k.drift > .5 ? 1.3 : .8);
        }
      } else H += steer * rate * DT;
      if (k.v < target) k.v = Math.min(target, k.v + (k.boost > 0 ? 30 : 13) * DT); else k.v = Math.max(target, k.v - 18 * DT);
    }
    k.boost = Math.max(0, k.boost - DT); k.star = Math.max(0, k.star - DT); k.roul = Math.max(0, k.roul - DT);
    if (k.roul === 0 && k.pending) { k.item = k.pending; k.pending = null; }
    var slip = k.drift ? -k.drift * .45 : 0, mA = H + slip, oldS = k.s;
    var ds = k.v * Math.cos(mA - p.th) * DT / Math.max(.4, 1 - k.d * p.cv), dd = k.v * Math.sin(mA - p.th) * DT;
    k.s += ds; k.d += dd;
    if (k.s >= L) { k.s -= L; k.lap++; if (k.lap > 0) { k.laps.push(S.t - k.lapT); } k.lapT = S.t; if (k.lap >= S.laps && !k.finished) { k.finished = true; k.ftime = S.t; S.events.push({ k: 'finish', id: k.id }); } else if (k.lap > 0 && !k.ai) S.events.push({ k: 'lap', lap: k.lap + 1 }); }
    else if (k.s < 0) { k.s += L; k.lap--; }
    var p2 = Ts.at(T, k.s);
    k.yaw = wrapA(H - p2.th);
    // walls, or the void on the rainbow road
    var wall = half + 3.3;
    if (space) { if (Math.abs(k.d) > half + 1.3 && !k.air) { k.fall = 1.4; k.v = 0; k.coins = Math.max(0, k.coins - 2); S.events.push({ k: 'fall', id: k.id }); } }
    else if (Math.abs(k.d) > wall) {
      k.d = Math.sign(k.d) * wall; if (k.star <= 0) k.v *= .5; k.yaw = -k.yaw * .35; k.drift = 0;   // a barrier stops you: driving by bouncing must not pay
      S.events.push({ k: 'bump', id: k.id });
    }
    // ramps and air
    var F = Ts.features(T), onRamp = null;
    F.ramps.forEach(function (r) { if (k.s >= r.s && k.s < r.s + r.len && Math.abs(k.d) < half * .7) onRamp = r; });
    if (k.air) {
      k.y += k.vy * DT; k.vy -= 22 * DT;
      if (!k.ai && c.trick) k.trick = true;
      if (k.y <= 0) { k.y = 0; k.air = false; if (k.trick || k.ai) { k.boost = Math.max(k.boost, .7); S.events.push({ k: 'trick', id: k.id }); } k.trick = false; }
    } else if (onRamp) { k.y = (k.s - onRamp.s) / onRamp.len * 1.6; k.rampV = k.v; }
    else if (k.y > 0) { k.air = true; k.vy = 6 + (k.rampV || k.v) * .16; }
    // boost pads, item boxes, fruit
    if (!k.air) F.pads.forEach(function (pd) { if (Math.abs(k.s - pd.s) < 2.6 && Math.abs(k.d - pd.d) < 2.4) { if (k.boost < .3) S.events.push({ k: 'pad', id: k.id }); k.boost = Math.max(k.boost, 1.0); } });
    S.boxes.forEach(function (b) {
      if (b.t > 0 || Math.abs(k.s - b.s) > 1.8 || Math.abs(k.d - b.d) > 1.9) return;
      b.t = 3; S.events.push({ k: 'box', id: k.id });
      if (!k.item && !k.pending) { k.pending = pick(S, k); k.roul = k.ai ? .6 : 1.3; }
    });
    S.fruits.forEach(function (f) { if (f.t <= 0 && Math.abs(k.s - f.s) < 1.5 && Math.abs(k.d - f.d) < 1.7) { f.t = 14; if (k.coins < 10) k.coins++; S.events.push({ k: 'fruit', id: k.id }); } });
    if (c.use && k.item && k.spin <= 0) useItem(S, k);
  }

  function pick(S, k) {
    var q = (k.place - 1) / 7, w = { banana: 1.6 - q * 1.2, verde: 1.3 - q * .6, rosso: .2 + q * 1.3, turbo: .3 + q * 1.4, stella: q > .45 ? q * 1.1 : .02, frutti: .7 };
    var tot = 0, key; for (key in w) tot += Math.max(.01, w[key]);
    var r = rnd(S) * tot; for (key in w) { r -= Math.max(.01, w[key]); if (r <= 0) return key; }
    return 'banana';
  }
  function useItem(S, k) {
    var it = k.item; k.item = null;
    S.events.push({ k: 'use', id: k.id, item: it });
    if (it === 'banana') S.objs.push({ k: 'banana', s: k.s - 3.5, d: k.d, owner: k.id, life: 60 });
    else if (it === 'verde') S.objs.push({ k: 'verde', s: k.s + 3, d: k.d, yaw: k.yaw, v: 44, bounce: 3, owner: k.id, life: 7 });
    else if (it === 'rosso') { var tg = S.karts.filter(function (o) { return o.place === k.place - 1; })[0]; S.objs.push({ k: 'rosso', s: k.s + 3, d: k.d, v: 41, target: tg ? tg.id : -1, owner: k.id, life: 9 }); }
    else if (it === 'turbo') k.boost = Math.max(k.boost, 1.6);
    else if (it === 'stella') k.star = 6;
    else if (it === 'frutti') k.coins = Math.min(10, k.coins + 3);
  }
  function hit(S, k, why) {
    if (k.star > 0 || k.fall > 0) return false;
    k.spin = 1.1; k.v *= .35; k.coins = Math.max(0, k.coins - 2); k.drift = 0; k.boost = 0;
    S.events.push({ k: 'hit', id: k.id, why: why }); return true;
  }
  function near(S, a, b, ds, dd) { var L = TR().sample(track(S)).L, x = Math.abs(a.s - b.s); x = Math.min(x, L - x); return x < ds && Math.abs(a.d - b.d) < dd; }

  function collide(S) {
    var K = S.karts;
    for (var i = 0; i < K.length; i++) for (var j = i + 1; j < K.length; j++) {
      var a = K[i], b = K[j]; if (a.fall > 0 || b.fall > 0 || a.air !== b.air) continue;
      if (!near(S, a, b, 2.8, 1.9)) continue;
      if (a.star > 0 && b.star <= 0) { hit(S, b, 'star'); continue; }
      if (b.star > 0 && a.star <= 0) { hit(S, a, 'star'); continue; }
      var push = (1.9 - Math.abs(a.d - b.d)) / 2 + .05, sg = a.d < b.d ? -1 : 1;
      a.d += sg * push; b.d -= sg * push;
    }
  }
  function objects(S, T) {
    var Ts = TR(), half = T.width / 2, wall = half + 3.3, L = Ts.sample(T).L;
    for (var i = S.objs.length - 1; i >= 0; i--) {
      var o = S.objs[i], dead = false;
      o.life -= DT;
      if (o.k === 'verde') {
        o.s += o.v * Math.cos(o.yaw) * DT; o.d += o.v * Math.sin(o.yaw) * DT;
        if (Math.abs(o.d) > wall - .5) { o.d = Math.sign(o.d) * (wall - .5); o.yaw = -o.yaw; if (--o.bounce < 0) dead = true; }
        if (Math.abs(o.d) < 1 && Math.abs(o.yaw) < .05) o.yaw += .001;
      } else if (o.k === 'rosso') {
        var tg = S.karts[o.target]; o.s += o.v * DT;
        if (tg && !tg.finished) { var gap = ((tg.s - o.s) % L + L) % L; if (gap < 40) o.d += G.clamp(tg.d - o.d, -16 * DT, 16 * DT); }
        else o.d += G.clamp(Ts.at(T, o.s).line * (half - 2) - o.d, -6 * DT, 6 * DT);
      }
      o.s = ((o.s % L) + L) % L;
      if (o.life <= 0) dead = true;
      if (!dead) for (var k = 0; k < S.karts.length; k++) {
        var kt = S.karts[k]; if (kt.air || kt.fall > 0) continue;
        if (o.k !== 'banana' && kt.id === o.owner && o.life > (o.k === 'verde' ? 6.6 : 8.6)) continue;   // your own shell needs a moment to leave
        if (near(S, o, kt, o.k === 'banana' ? 1.5 : 2.0, o.k === 'banana' ? 1.5 : 1.8)) { hit(S, kt, o.k); dead = true; break; }
      }
      if (!dead && o.k !== 'banana') for (var b = 0; b < S.objs.length; b++) { var ob = S.objs[b]; if (ob !== o && ob.k === 'banana' && near(S, o, ob, 1.5, 1.5)) { S.objs.splice(b, 1); if (b < i) i--; dead = true; break; } }
      if (dead) S.objs.splice(i, 1);
    }
  }
  function places(S) {
    var sorted = S.karts.slice().sort(function (a, b) {
      if (a.finished && b.finished) return a.ftime - b.ftime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return progress(S, b) - progress(S, a);
    });
    sorted.forEach(function (k, i) { k.place = i + 1; });
  }
  /* when the child crosses the line, everyone still racing gets a fair finish time from their pace */
  function finishAll(S) {
    var L = TR().sample(track(S)).L;
    S.karts.forEach(function (k) {
      if (k.finished) return;
      var left = S.laps * L - progress(S, k), pace = Math.max(12, vmax(S, k) * .92);
      k.ftime = S.t + left / pace; k.estimated = true;
    });
    S.results = S.karts.slice().sort(function (a, b) { return a.ftime - b.ftime; }).map(function (k, i) { return { id: k.id, name: k.name, col: k.col, time: k.ftime, place: i + 1, points: POINTS[i], player: !k.ai }; });
  }

  /* the AI: follow the racing line, dodge bananas, use items with some sense */
  function aiControl(S, k) {
    var T = track(S), Ts = TR(), half = T.width / 2, look = 10 + k.v * .6, p = Ts.at(T, k.s), p2 = Ts.at(T, k.s + look);
    var want = G.clamp(p2.line * (half - 2.2) + k.aiOff, -half + 1.6, half - 1.6);
    S.objs.forEach(function (o) { if (o.k === 'banana') { var gap = o.s - k.s; if (gap > 0 && gap < 28 && Math.abs(o.d - want) < 2.2) want += o.d > want ? -3 : 3; } });
    // pure pursuit in world space: aim at the real point ahead on the racing line
    var me = Ts.world(T, k.s, k.d), aim = Ts.world(T, k.s + look, want), H = p.th + k.yaw;
    var steer = G.clamp(wrapA(Math.atan2(aim[2] - me[2], aim[0] - me[0]) - H) * 3.2, -1, 1), use = false;
    if (k.item) {
      k.aiHold += DT;
      var ahead = S.karts.filter(function (o) { return o !== k && o.place === k.place - 1; })[0], behind = S.karts.filter(function (o) { return o !== k && o.place === k.place + 1; })[0];
      var gapA = ahead ? progress(S, ahead) - progress(S, k) : 1e9, gapB = behind ? progress(S, k) - progress(S, behind) : 1e9;
      if (k.item === 'banana') use = gapB < 14 || k.aiHold > 5;
      else if (k.item === 'verde') use = (gapA < 30 && Math.abs(ahead.d - k.d) < 2.5) || k.aiHold > 7;
      else if (k.item === 'rosso') use = gapA < 70 || k.aiHold > 6;
      else if (k.item === 'turbo') use = Math.abs(p.cv) < .006 || k.aiHold > 4;
      else use = true;
      if (k.finished) use = false;
      if (use) k.aiHold = 0;
    }
    return { steer: steer, use: use, bot: true };
  }

  G.race = { create: create, step: step, aiControl: aiControl, progress: progress, ITEMS: ITEMS, POINTS: POINTS, RIVALS: RIVALS, DT: DT, snap: function (S) { return JSON.stringify(S); } };
})();
