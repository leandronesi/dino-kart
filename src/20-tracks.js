/* Dino Kart — the eight tracks.
   A track is a closed loop of control points [x, z, y] (metres, y = height).
   It becomes a Catmull-Rom curve sampled every STEP metres; everything — the
   physics, the AI's racing line, the road mesh, where trees grow — is built
   from those samples. Directions: heading `a` points along (cos a, sin a) in
   the x-z plane, and the right-hand side of the road is (-sin a, cos a). */
(function () {
  'use strict';
  var STEP = 2;

  var THEMES = {
    prato: { sky: ['#6fc0e8', '#d6f0fb'], fog: '#cfe9f5', ground: ['#6db35a', '#64aa52'], road: ['#7b8088', '#737880'], line: '#fff6e0', curb: ['#e8536b', '#fff6e0'], wall: ['#e8536b', '#fff6e0'], far: '#79bb64', hills: '#9cc7b5', sc: { tree: 3, round: 2, flower: 3, bush: 2, mushroom: 1 } },
    spiaggia: { sky: ['#4fc4ef', '#e6f8f4'], fog: '#d9f2f6', ground: ['#f2d9a8', '#ead09a'], road: ['#8a8f96', '#828790'], line: '#fff6e0', curb: ['#4d80e4', '#fff6e0'], wall: ['#4d80e4', '#fff6e0'], far: '#3fb6c9', water: '#3fb6c9', hills: '#8fd3e0', sc: { palm: 5, rock: 1, bush: 1 } },
    giungla: { sky: ['#8fd3b6', '#e3f6ec'], fog: '#cfe9dc', ground: ['#3f8f4a', '#388445'], road: ['#8a6a4a', '#82634a'], line: '#f6e7c1', curb: ['#ffd75e', '#2b1d12'], wall: ['#7a4a26', '#a0703c'], far: '#2f7a40', hills: '#5c9a74', sc: { round: 3, tree: 2, palm: 1, bush: 3, flower: 2, mushroom: 1 } },
    castello: { sky: ['#3d3a66', '#a596cf'], fog: '#8f86b8', ground: ['#5c7a4a', '#557245'], road: ['#8e8a86', '#86827e'], line: '#e9e2d0', curb: ['#c0392b', '#e9e2d0'], wall: ['#9aa0a6', '#7b8188'], far: '#4a6a3e', hills: '#5a5488', sc: { tower: 2, pine: 2, rock: 2 } },
    neve: { sky: ['#9fd0f2', '#f2f8fd'], fog: '#e6f0f7', ground: ['#f4f8fb', '#e8f0f5'], road: ['#7f8b96', '#77838e'], line: '#ffffff', curb: ['#4d80e4', '#ffffff'], wall: ['#4d80e4', '#ffffff'], far: '#eef4f8', hills: '#c7dceb', sc: { snowpine: 4, snowman: 1, iceberg: 1, rock: 1 } },
    vulcano: { sky: ['#2a1018', '#8a3a2a'], fog: '#5c2626', ground: ['#4a3a3f', '#403238'], road: ['#5a5357', '#524b4f'], line: '#ffb04a', curb: ['#ff7a1a', '#2b1d12'], wall: ['#3a2430', '#ff7a1a'], far: '#ff7a1a', water: '#ff7a1a', hills: '#3a1622', sc: { lavarock: 3, rock: 2 } },
    dolci: { sky: ['#ffbfe3', '#fff1f8'], fog: '#ffe6f3', ground: ['#ffe0ef', '#ffd3e8'], road: ['#8a5a3c', '#7e5136'], line: '#fff6e0', curb: ['#ff6fae', '#ffffff'], wall: ['#38d9a9', '#ffffff'], far: '#ffd3e8', hills: '#ffb3d6', sc: { lollipop: 3, candy: 3, mushroom: 1 } },
    arcobaleno: { sky: ['#07071f', '#24184f'], fog: '#1a1440', ground: null, road: null, line: '#ffffff', curb: ['#ffffff', '#ffd75e'], wall: null, far: null, hills: null, space: true, sc: { star: 5, planet: 1 } }
  };
  var RAINBOW = ['#ff5c6c', '#ff9f43', '#ffd75e', '#38d9a9', '#4d80e4', '#8f5bd6'];

  var TRACKS = [
    { id: 'prato', name: 'Prato Fiorito', theme: 'prato', cup: 0, width: 17,
      pts: [[0, 0, 0], [150, 0, 0], [240, 40, 3], [270, 130, 8], [220, 210, 10], [120, 230, 6], [30, 200, 2], [-20, 130, 0], [-60, 60, 2], [-50, 10, 0]],
      feats: [['fruits', .06, 0], ['boxes', .2], ['pad', .36, 0], ['fruits', .45, -4], ['boxes', .58], ['fruits', .75, 4], ['boxes', .86]] },
    { id: 'spiaggia', name: 'Spiaggia Cocco', theme: 'spiaggia', cup: 0, width: 17,
      pts: [[0, 0, 0], [200, 0, 0], [300, 60, 0], [320, 160, 2], [250, 230, 4], [150, 200, 2], [80, 250, 0], [-20, 240, 0], [-80, 170, 2], [-60, 60, 0]],
      feats: [['fruits', .05, 0], ['boxes', .16], ['ramp', .1], ['fruits', .3, 3], ['pad', .42, -3], ['boxes', .5], ['fruits', .66, -3], ['boxes', .8], ['pad', .9, 0]] },
    { id: 'giungla', name: 'Giungla Liane', theme: 'giungla', cup: 0, width: 16,
      pts: [[0, 0, 0], [120, -20, 4], [200, 30, 8], [180, 110, 6], [100, 130, 2], [60, 200, 0], [130, 270, 4], [240, 260, 8], [300, 180, 10], [330, 60, 6], [280, -60, 2], [150, -110, 0], [30, -90, 0], [-40, -40, 0]],
      feats: [['fruits', .04, 0], ['boxes', .14], ['fruits', .3, 3], ['boxes', .42], ['pad', .55, 0], ['boxes', .7], ['fruits', .82, -3], ['pad', .93, 0]] },
    { id: 'castello', name: 'Castello di Dino', theme: 'castello', cup: 0, width: 16,
      pts: [[0, 0, 0], [160, 0, 0], [200, 40, 2], [200, 160, 6], [160, 200, 6], [60, 200, 4], [20, 240, 2], [-80, 240, 0], [-120, 180, 0], [-120, 60, 0], [-80, 10, 0]],
      feats: [['fruits', .05, 0], ['boxes', .18], ['pad', .3, 0], ['fruits', .4, 3], ['boxes', .5], ['fruits', .62, -3], ['boxes', .78], ['pad', .9, 0]] },
    { id: 'neve', name: 'Monte Neve', theme: 'neve', cup: 1, width: 17,
      pts: [[0, 0, 0], [140, 20, 10], [240, 100, 22], [250, 220, 30], [160, 300, 24], [40, 280, 14], [-30, 200, 8], [20, 120, 6], [-40, 60, 2], [-60, 0, 0]],
      feats: [['fruits', .05, 0], ['boxes', .15], ['fruits', .32, -3], ['boxes', .45], ['ramp', .56], ['fruits', .66, 3], ['boxes', .76], ['pad', .88, 0]] },
    { id: 'vulcano', name: 'Vulcano Ruggente', theme: 'vulcano', cup: 1, width: 16,
      pts: [[0, 0, 0], [100, -40, 2], [220, -20, 6], [280, 80, 10], [220, 170, 8], [130, 150, 4], [90, 230, 6], [160, 310, 10], [40, 360, 6], [-80, 300, 2], [-100, 180, 0], [-60, 80, 0]],
      feats: [['fruits', .04, 0], ['boxes', .12], ['pad', .25, 0], ['boxes', .4], ['fruits', .5, 3], ['boxes', .64], ['ramp', .74], ['fruits', .84, -3], ['boxes', .92]] },
    { id: 'dolci', name: 'Fabbrica di Dolci', theme: 'dolci', cup: 1, width: 16,
      pts: [[0, 0, 0], [80, -60, 0], [200, -60, 4], [260, 20, 8], [200, 90, 8], [260, 160, 6], [200, 240, 4], [80, 230, 2], [20, 160, 0], [-60, 140, 0], [-80, 60, 0]],
      feats: [['fruits', .05, 0], ['boxes', .16], ['pad', .3, 0], ['boxes', .44], ['fruits', .55, 3], ['boxes', .68], ['pad', .8, 0], ['fruits', .9, -3]] },
    { id: 'arcobaleno', name: 'Pista Arcobaleno', theme: 'arcobaleno', cup: 1, width: 15,
      pts: [[0, 0, 0], [180, -20, 8], [300, 60, 20], [320, 200, 30], [220, 300, 26], [80, 280, 16], [-20, 200, 12], [-80, 100, 6], [-60, 20, 2]],
      feats: [['fruits', .05, 0], ['boxes', .14], ['ramp', .3], ['boxes', .42], ['pad', .52, 0], ['fruits', .6, 3], ['boxes', .7], ['ramp', .8], ['pad', .92, 0]] }
  ];
  var CUPS = [{ name: 'Coppa Frutta', tracks: [0, 1, 2, 3] }, { name: 'Coppa Stella', tracks: [4, 5, 6, 7] }];

  /* ------------------------------------------------------------ geometry */
  function cr(p0, p1, p2, p3, t) {
    var t2 = t * t, t3 = t2 * t;
    return p1.map(function (_, k) { return .5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3); });
  }
  function sample(T) {
    if (T.S) return T.S;
    var P = T.pts, n = P.length, dense = [], i, k;
    for (i = 0; i < n; i++) for (k = 0; k < 40; k++) dense.push(cr(P[(i - 1 + n) % n], P[i], P[(i + 1) % n], P[(i + 2) % n], k / 40));
    dense.push(dense[0]);
    // resample by arc length
    var xs = [], zs = [], ys = [], left = 0;
    xs.push(dense[0][0]); zs.push(dense[0][1]); ys.push(dense[0][2]);
    for (i = 0; i < dense.length - 1; i++) {
      var a = dense[i], b = dense[i + 1], seg = Math.hypot(b[0] - a[0], b[1] - a[1]), t = 0;
      while (seg - t >= STEP - left) { t += STEP - left; left = 0; var f = t / seg; xs.push(a[0] + (b[0] - a[0]) * f); zs.push(a[1] + (b[1] - a[1]) * f); ys.push(a[2] + (b[2] - a[2]) * f); }
      left += seg - t;
    }
    if (Math.hypot(xs[xs.length - 1] - xs[0], zs[zs.length - 1] - zs[0]) < STEP * .6) { xs.pop(); zs.pop(); ys.pop(); }
    var N = xs.length, th = [], cv = [], bank = [];
    for (i = 0; i < N; i++) { var j = (i + 1) % N; th.push(Math.atan2(zs[j] - zs[i], xs[j] - xs[i])); }
    for (i = 0; i < N; i++) { var d = th[(i + 1) % N] - th[i]; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; cv.push(d / STEP); }
    // smooth curvature, then the racing line hugs the inside of each bend a little before it
    var sc = cv.map(function (_, i) { var s = 0; for (var k = -12; k <= 12; k++) s += cv[(i + k + N) % N]; return s / 25; });
    var line = sc.map(function (_, i) { var s = 0; for (var k = 0; k <= 16; k++) s += sc[(i + k) % N]; return G.clamp(s / 17 * 260, -1, 1); });
    for (i = 0; i < N; i++) bank.push(G.clamp(sc[i] * 6, -.12, .12));
    T.S = { N: N, L: N * STEP, x: xs, z: zs, y: ys, th: th, cv: sc, line: line, bank: bank };
    return T.S;
  }
  /* the state of the track at arc length s (wraps) */
  function at(T, s) {
    var S = sample(T), f = ((s % S.L) + S.L) % S.L / STEP, i = Math.floor(f), j = (i + 1) % S.N, u = f - i;
    var dth = S.th[j] - S.th[i]; while (dth > Math.PI) dth -= 2 * Math.PI; while (dth < -Math.PI) dth += 2 * Math.PI;
    return { x: S.x[i] + (S.x[j] - S.x[i]) * u, z: S.z[i] + (S.z[j] - S.z[i]) * u, y: S.y[i] + (S.y[j] - S.y[i]) * u, th: S.th[i] + dth * u, cv: S.cv[i], line: S.line[i], bank: S.bank[i], i: i };
  }
  function world(T, s, d, lift) {
    var p = at(T, s), rx = -Math.sin(p.th), rz = Math.cos(p.th);
    return [p.x + rx * d, p.y + p.bank * d + (lift || 0), p.z + rz * d];
  }
  /* closest distance between two parts of the track that are far apart along it:
     a track must never cross or touch itself */
  function selfGap(T) {
    var S = sample(T), best = 1e9, stride = 3;
    for (var i = 0; i < S.N; i += stride) for (var j = i + 40; j < S.N; j += stride) {
      var along = Math.min(j - i, S.N - (j - i)) * STEP; if (along < 90) continue;
      var dd = Math.hypot(S.x[i] - S.x[j], S.z[i] - S.z[j]); if (dd < best) best = dd;
    }
    return best;
  }

  /* ------------------------------------------------------------ features */
  function hash(n) { n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); n ^= n >>> 15; return ((n >>> 0) % 10000) / 10000; }
  function features(T) {
    if (T.F) return T.F;
    var S = sample(T), F = { boxes: [], fruits: [], pads: [], ramps: [] }, half = T.width / 2;
    T.feats.forEach(function (f) {
      var s = f[1] * S.L;
      if (f[0] === 'boxes') [-.6, -.2, .2, .6].forEach(function (u) { F.boxes.push({ s: s, d: u * half }); });
      if (f[0] === 'fruits') for (var k = 0; k < 6; k++) F.fruits.push({ s: s + k * 5, d: f[2] || 0 });
      if (f[0] === 'pad') F.pads.push({ s: s, d: f[2] || 0 });
      if (f[0] === 'ramp') F.ramps.push({ s: s, len: 7 });
    });
    T.F = F; return F;
  }

  /* ------------------------------------------------------------ the mesh */
  function build(T) {
    var GL = G.GL, S = sample(T), th = THEMES[T.theme], half = T.width / 2, b = new GL.Builder(), i, k, N = S.N;
    var P = function (i, d, lift) { var x = S.x[i % N], z = S.z[i % N], a = S.th[i % N], bk = S.bank[i % N]; return [x - Math.sin(a) * d, S.y[i % N] + bk * d + (lift || 0), z + Math.cos(a) * d]; };
    var minY = Math.min.apply(null, S.y);
    for (i = 0; i < N; i++) {
      var j = i + 1, band = Math.floor(i / 4) % 2;
      // road
      if (th.space) {
        var lanes = 6;
        for (k = 0; k < lanes; k++) { var d0 = -half + k * T.width / lanes, d1 = d0 + T.width / lanes; b.quad(P(i, d0), P(i, d1), P(j, d1), P(j, d0), RAINBOW[k]); b.quad(P(i, d1, -.4), P(i, d0, -.4), P(j, d0, -.4), P(j, d1, -.4), RAINBOW[k]); }
      } else {
        b.quad(P(i, -half), P(i, half), P(j, half), P(j, -half), th.road[band]);
        if (Math.floor(i / 3) % 2 === 0) b.quad(P(i, -.25, .02), P(i, .25, .02), P(j, .25, .02), P(j, -.25, .02), th.line);
      }
      // curbs
      var cb = th.curb[Math.floor(i / 2) % 2];
      b.quad(P(i, half, .04), P(i, half + 1.3, .04), P(j, half + 1.3, .04), P(j, half, .04), cb);
      b.quad(P(i, -half - 1.3, .04), P(i, -half, .04), P(j, -half, .04), P(j, -half - 1.3, .04), cb);
      if (!th.space) {
        // shoulders that roll gently down into the landscape
        var g = th.ground[Math.floor(i / 6) % 2];
        b.quad(P(i, half + 1.3), P(i, half + 14, -.6), P(j, half + 14, -.6), P(j, half + 1.3), g);
        b.quad(P(i, -half - 14, -.6), P(i, -half - 1.3), P(j, -half - 1.3), P(j, -half - 14, -.6), g);
        b.quad(P(i, half + 14, -.6), P(i, half + 32, -2.5), P(j, half + 32, -2.5), P(j, half + 14, -.6), g);
        b.quad(P(i, -half - 32, -2.5), P(i, -half - 14, -.6), P(j, -half - 14, -.6), P(j, -half - 32, -2.5), g);
        // low barriers, two-sided
        var wc = th.wall[Math.floor(i / 2) % 2], wd = half + 4;
        b.quad(P(i, wd), P(j, wd), P(j, wd, 1.1), P(i, wd, 1.1), wc); b.quad(P(j, wd), P(i, wd), P(i, wd, 1.1), P(j, wd, 1.1), wc);
        b.quad(P(j, -wd), P(i, -wd), P(i, -wd, 1.1), P(j, -wd, 1.1), wc); b.quad(P(i, -wd), P(j, -wd), P(j, -wd, 1.1), P(i, -wd, 1.1), wc);
      }
    }
    // the world beyond: ground, sea or lava
    if (!th.space) {
      var cx = S.x.reduce(function (a, v) { return a + v; }, 0) / N, cz = S.z.reduce(function (a, v) { return a + v; }, 0) / N, R = 1400, fy = minY - (th.water ? 1.8 : 2.6);
      b.quad([cx - R, fy, cz - R], [cx - R, fy, cz + R], [cx + R, fy, cz + R], [cx + R, fy, cz - R], th.far);
    }
    // start line and gantry
    for (k = 0; k < 8; k++) for (var r = 0; r < 2; r++) { var dA = -half + k * T.width / 8; b.quad(P(r, dA, .05), P(r, dA + T.width / 8, .05), P(r + 1, dA + T.width / 8, .05), P(r + 1, dA, .05), (k + r) % 2 ? '#ffffff' : '#2b2b33'); }
    var g0 = P(0, -half - 2), g1 = P(0, half + 2);
    // the start gate: two posts in the track's colours and a checkered banner, high enough to see the road under it
    var postCol = th.curb[0];
    b.cyl(g0[0], g0[1], g0[2], .45, 9, postCol, 8); b.cyl(g1[0], g1[1], g1[2], .45, 9, postCol, 8);
    b.push(GL.M4.mul(GL.M4.trans((g0[0] + g1[0]) / 2, g0[1] + 7, (g0[2] + g1[2]) / 2), GL.M4.rotY(-S.th[0] - Math.PI / 2)));
    for (var cq = 0; cq < 12; cq++) for (var rq = 0; rq < 2; rq++) b.box(-(T.width + 5) / 2 + (cq + .5) * (T.width + 5) / 12, 1.8 + rq * .7 - .35, 0, (T.width + 5) / 12, .7, .5, (cq + rq) % 2 ? '#ffffff' : '#2b2b33');
    b.pop();
    // ramps
    features(T).ramps.forEach(function (rp) {
      var i0 = Math.round(rp.s / STEP), n = Math.round(rp.len / STEP);
      for (var q = 0; q < n; q++) { var h0 = q / n * 1.6, h1 = (q + 1) / n * 1.6; b.quad(P(i0 + q, -half * .7, h0), P(i0 + q, half * .7, h0), P(i0 + q + 1, half * .7, h1), P(i0 + q + 1, -half * .7, h1), q % 2 ? '#ff9f43' : '#ffd75e'); }
      b.quad(P(i0 + n, -half * .7, 1.6), P(i0 + n, half * .7, 1.6), P(i0 + n, half * .7, 0), P(i0 + n, -half * .7, 0), '#c97a2a');
    });
    // scenery: deterministic, never on the road, never on another bit of track
    var sc = th.sc, kinds = [], grid = {};
    Object.keys(sc).forEach(function (key) { for (var q = 0; q < sc[key]; q++) kinds.push(key); });
    for (i = 0; i < N; i++) { var gk = Math.floor(S.x[i] / 20) + ',' + Math.floor(S.z[i] / 20); (grid[gk] = grid[gk] || []).push(i); }
    function clear(x, z, need) {
      var gx = Math.floor(x / 20), gz = Math.floor(z / 20);
      for (var a = -2; a <= 2; a++) for (var c = -2; c <= 2; c++) { var L = grid[(gx + a) + ',' + (gz + c)]; if (L) for (var q = 0; q < L.length; q++) if (Math.hypot(S.x[L[q]] - x, S.z[L[q]] - z) < need) return false; }
      return true;
    }
    var SC = G.models.SC;
    for (i = 0; i < N; i += 3) for (var side = -1; side <= 1; side += 2) {
      var hsh = hash(i * 2 + (side > 0 ? 1 : 0) + T.id.length * 977);
      if (hsh < (th.space ? .55 : .25)) continue;
      var dist = half + 9 + hash(i * 7 + side) * (th.space ? 70 : 20), p = P(i, side * dist), kind = kinds[Math.floor(hash(i * 13 + side * 5) * kinds.length)];
      if (!clear(p[0], p[2], half + 6)) continue;
      var kk = .8 + hash(i * 31 + side) * .7, dd2 = dist - half, slope = dd2 < 14 ? -.6 * (dd2 - 1.3) / 12.7 : -.6 - 1.9 * (dd2 - 14) / 18;
      var y = th.space ? p[1] + 4 + hash(i * 17) * 26 : p[1] + slope - .1;
      if (kind === 'snowpine') SC.pine(b, p[0], y, p[2], kk, true);
      else if (kind === 'rock') SC.rock(b, p[0], y, p[2], kk, T.theme === 'vulcano' ? '#2a1a20' : null);
      else if (SC[kind]) SC[kind](b, p[0], y, p[2], kind === 'planet' ? kk : kk);
    }
    if (T.theme === 'vulcano') SC.volcano(b, (S.x[0] + S.x[Math.floor(N / 2)]) / 2 + 260, minY - 3, (S.z[0] + S.z[Math.floor(N / 2)]) / 2 + 200, 1);
    return GL.upload(b);
  }

  G.tracks = { TRACKS: TRACKS, CUPS: CUPS, THEMES: THEMES, STEP: STEP, sample: sample, at: at, world: world, features: features, build: build, selfGap: selfGap, hash: hash };
})();
