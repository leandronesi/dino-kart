/* Dino Kart — "La Pista" (scene: pista). The road, seen from behind the kart.

   PSEUDO-3D BY SEGMENTS, the Out Run / Super Mario Kart technique, and the whole
   reason this project is a separate game: it gives the view from behind the
   wheel, which is what makes a kart game a kart game.

   How it works, because it is worth writing down once:
     - The track is a list of SEGMENTS, each SEG_LEN long, each with a curve
       amount and a hill amount. There is no 3D geometry anywhere.
     - Each segment has a world point (x, y, z). Projecting it is one divide:
       scale = CAM_D / (z - cameraZ), and screen x/y/width fall out of that.
     - Drawing is back-to-front, one trapezium per segment between the current
       projected point and the previous one. Far segments are a few pixels tall,
       near ones fill the bottom of the screen.
     - Curves are FAKE, and that is the trick: the road never actually bends in
       world space. Each segment carries a horizontal offset that accumulates
       towards the horizon, so the ribbon leans across the screen. The kart's own
       x drifts by the same accumulated curve, which is what makes a bend feel
       like it pushes you outwards.

   The camera sits a fixed distance behind the kart and looks down the z axis, so
   there is no camera maths beyond one subtraction.

   Coordinates: the engine gives us a logical 1280x720. Road half-width is in the
   same arbitrary world units as z; only their RATIO matters, because everything
   goes through the same projection. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  var SEG_LEN = 200;             // world length of one segment
  var ROAD_W = 2000;             // half-width of the road, world units
  var DRAW_N = 300;              // how many segments ahead we draw
  var CAM_H = 1000;              // camera height above the road
  var CAM_D = 0.84;              // depth-of-field: bigger = narrower lens
  var HORIZON = 300;             // screen y of the vanishing point at rest

  var COL = {
    grassLight: '#4f9e3f', grassDark: '#458c37',
    roadLight: '#6b6f76', roadDark: '#63676e',
    rumbleLight: '#e8536b', rumbleDark: '#fff6e0',
    laneMark: '#fff6e0'
  };

  /* --------------------------------------------------------------- track */
  /* A track is built from a handful of instructions; the segment list is
     expanded once at entry. `curve` is how hard it bends, `hill` how steep. */
  var TRACKS = [
    {
      id: 'collina',
      name: 'La Collina',
      sky: ['#7fc6e8', '#cfeafc'],
      plan: [
        ['dritto', 60, 0, 0],
        ['curva dolce dx', 50, 2.2, 0],
        ['salita', 40, 0, 22],
        ['curva secca sx', 45, -4.4, 0],
        ['discesa', 40, 0, -22],
        ['dritto', 35, 0, 0],
        ['curva dx', 55, 3.4, 14],
        ['esse sx', 40, -3.0, 0],
        ['esse dx', 40, 3.0, 0],
        ['dritto lungo', 70, 0, 0],
        ['curva sx larga', 60, -2.0, -10],
        ['dritto', 45, 0, 0]
      ]
    }
  ];

  var segs = [];
  var trackLen = 0;

  function buildTrack(t) {
    segs.length = 0;
    var i, j, p, n;
    for (i = 0; i < t.plan.length; i++) {
      p = t.plan[i];
      n = p[1];
      for (j = 0; j < n; j++) {
        /* Ease the curve in and out over the piece, so a bend arrives instead of
           snapping on: a hard step in `curve` reads as the road teleporting. */
        var k = j / n;
        var ease = Math.sin(k * Math.PI);
        segs.push({
          i: segs.length,
          curve: p[2] * ease,
          y: 0,
          hill: p[3] * ease
        });
      }
    }
    // integrate the hills into absolute heights
    var y = 0;
    for (i = 0; i < segs.length; i++) {
      y += segs[i].hill;
      segs[i].y = y;
    }
    /* Close the loop in height: a track whose end is 400 units above its start
       shows a cliff at the finish line. Spread the error backwards. */
    var drift = segs[segs.length - 1].y;
    for (i = 0; i < segs.length; i++) segs[i].y -= drift * (i / (segs.length - 1));
    trackLen = segs.length * SEG_LEN;
    for (i = 0; i < segs.length; i++) {
      segs[i].dark = Math.floor(i / 3) % 2 === 0;
    }
  }

  function segAt(z) {
    return segs[Math.floor(wrapZ(z) / SEG_LEN) % segs.length];
  }
  function wrapZ(z) {
    z %= trackLen;
    return z < 0 ? z + trackLen : z;
  }

  /* ---------------------------------------------------------------- state */
  var S = {
    z: 0,            // how far along the track, world units
    x: 0,            // sideways position: -1 = left edge, +1 = right edge
    spd: 0,
    steer: 0,        // -1..1, what the finger is asking for
    track: 0,
    off: 0,          // 0..1, how long we have been off the road
    leanShown: 0,    // the lean actually drawn, eased behind the input
    boost: 0
  };

  var MAX_SPD = 12000;           // world units per second
  var OFF_SPD = MAX_SPD * 0.38;  // top speed on the grass
  var ACCEL = MAX_SPD * 0.62;    // per second
  var BRAKE = MAX_SPD * 1.30;    // per second when off the road

  /* Roadside objects. They do almost nothing mechanically and they are the whole
     reason a corner feels fast: with an empty verge, a road that scrolls at
     12000 units a second and one that scrolls at 4000 look nearly identical.
     Placed once per track, at a fixed side offset. */
  var props = [];
  function buildProps() {
    props.length = 0;
    var i, n = Math.floor(segs.length / 4);
    for (i = 0; i < n; i++) {
      var si = i * 4 + (i % 3);
      if (si >= segs.length) break;
      var side = (i % 2 ? 1 : -1);
      props.push({
        seg: si,
        x: side * (1.35 + ((i * 37) % 11) / 11 * 1.5),
        kind: (i % 5 === 0) ? 'cartello' : 'albero',
        h: 900 + ((i * 53) % 7) * 130
      });
    }
  }

  /* -------------------------------------------------------------- project */
  /* One divide per point. `cx` is the accumulated fake curve at that segment,
     `cy` its world height. */
  var pr = { x: 0, y: 0, w: 0, s: 0 };
  function project(cx, cy, cz, camX, camY, camZ) {
    var d = cz - camZ;
    if (d < 1) d = 1;
    pr.s = CAM_D / d;
    pr.x = Math.round(W / 2 + pr.s * (cx - camX) * W / 2);
    pr.y = Math.round(HORIZON - pr.s * (cy - camY) * H / 2);
    pr.w = Math.round(pr.s * ROAD_W * W / 2);
    return pr;
  }

  /* ================================================================ SCENE */
  G.scene('pista', {
    hud: true, back: false,

    enter: function () {
      buildTrack(TRACKS[S.track]);
      buildProps();
      S.z = 0; S.x = 0; S.spd = 0; S.steer = 0; S.off = 0;
      S.leanShown = 0; S.boost = 0;
    },

    update: function (dt) {
      var here = segAt(S.z);
      var onRoad = Math.abs(S.x) < 1;

      /* The throttle is automatic — a child who has to hold a pedal AND steer
         has two jobs, and steering is the one that matters. What the road takes
         away is speed when you leave it, and that is the whole punishment
         model: no crash, no spin, no reset, just a slower kart and the pack
         pulling away. Losing here is a thing you watch happen, not a screen. */
      var top = onRoad ? MAX_SPD : OFF_SPD;
      if (S.spd < top) S.spd += ACCEL * dt;
      else S.spd -= BRAKE * dt;
      S.spd = G.clamp(S.spd, 0, MAX_SPD);
      S.off = onRoad ? Math.max(0, S.off - dt * 3) : Math.min(1, S.off + dt * 3);

      S.z = wrapZ(S.z + S.spd * dt);

      /* Steering scales with speed: standing still you cannot turn, which is
         both true and what keeps the kart from pirouetting at the start line. */
      var grip = S.spd / MAX_SPD;
      S.x += S.steer * dt * 2.1 * grip;
      /* The outward push of the bend — the thing that makes a corner something
         you fight rather than something you watch go by. */
      S.x -= here.curve * dt * grip * 0.55;
      S.x = G.clamp(S.x, -2.4, 2.4);

      /* The drawn lean lags the finger. Snapping it makes the kart look like a
         cardboard cut-out being flicked; a tenth of a second of lag reads as
         weight. */
      S.leanShown += (S.steer * grip - S.leanShown) * Math.min(1, dt * 9);
      S.boost = Math.max(0, S.boost - dt * 1.6);
    },

    onDown: function (p) { S.steer = p.x < W / 2 ? -1 : 1; },
    onMove: function (p) { S.steer = p.x < W / 2 ? -1 : 1; },
    onUp: function () { S.steer = 0; },

    draw: function (c) { drawAll(c); }
  });

  /* ----------------------------------------------------------------- draw */
  function drawAll(c) {
    var t = TRACKS[S.track];
    var base = segAt(S.z);
    var camY = base.y + CAM_H;
    var camZ = S.z;

    drawSky(c, t);

    /* Walk forward accumulating the fake curve. `dx` is how much the road
       shifts per segment; `cx` the running total. */
    /* Two passes. First the ribbon back-to-front, remembering where each
       segment landed; then the roadside objects painted over it in the same
       order, so a tree can never be swallowed by the tarmac drawn after it. */
    var base0 = Math.floor(wrapZ(S.z) / SEG_LEN);
    var cx = 0, dx = 0, i, s, prev = null, maxy = H, drawn = 0;
    shots.length = 0;
    for (i = 0; i < DRAW_N; i++) {
      s = segs[(base0 + i) % segs.length];
      var segZ = base0 * SEG_LEN + i * SEG_LEN;
      dx += s.curve * 0.00018;
      cx += dx;

      var p = project(cx - S.x * 0.9, s.y, segZ, 0, camY, camZ);
      var cur = { x: p.x, y: p.y, w: p.w, sc: p.s, idx: (base0 + i) % segs.length };

      if (prev && cur.y < maxy && cur.y < prev.y) {
        drawSeg(c, prev, cur, s.dark);
        maxy = cur.y;
        drawn++;
      }
      shots.push(cur);
      prev = cur;
      if (cur.y < HORIZON - 40) break;
    }

    drawProps(c);
    drawKart(c);
    void drawn;
  }

  function drawSky(c, t) {
    var g = c.createLinearGradient(0, 0, 0, HORIZON + 60);
    g.addColorStop(0, t.sky[0]);
    g.addColorStop(1, t.sky[1]);
    c.fillStyle = g;
    c.fillRect(0, 0, W, HORIZON + 60);
    c.fillStyle = COL.grassDark;
    c.fillRect(0, HORIZON, W, H - HORIZON);
  }

  /* One trapezium of road, its two rumble strips and the grass either side. */
  function drawSeg(c, a, b, dark) {
    var grass = dark ? COL.grassDark : COL.grassLight;
    var road = dark ? COL.roadDark : COL.roadLight;
    var rumble = dark ? COL.rumbleLight : COL.rumbleDark;

    c.fillStyle = grass;
    c.fillRect(0, b.y, W, a.y - b.y + 1);

    quad(c, a.x, a.y, a.w * 1.16, b.x, b.y, b.w * 1.16, rumble);
    quad(c, a.x, a.y, a.w, b.x, b.y, b.w, road);

    if (!dark) {                            // centre line, only on light strips
      quad(c, a.x, a.y, a.w * 0.03, b.x, b.y, b.w * 0.03, COL.laneMark);
    }
  }

  /* Where every drawn segment landed this frame, so anything standing beside
     the road can be placed without projecting it a second time. */
  var shots = [];

  function drawProps(c) {
    var i, p, sh, x, h, w;
    for (i = shots.length - 1; i >= 0; i--) {
      sh = shots[i];
      if (sh.w < 2) continue;
      for (var j = 0; j < props.length; j++) {
        p = props[j];
        if (p.seg !== sh.idx) continue;
        x = sh.x + sh.w * p.x;
        h = sh.sc * p.h * H / 2;
        if (h < 3 || x < -200 || x > W + 200) continue;
        w = h * 0.62;
        if (p.kind === 'albero') {
          c.fillStyle = '#5a4326';
          c.fillRect(x - w * 0.08, sh.y - h * 0.34, w * 0.16, h * 0.34);
          c.fillStyle = '#2f7a3a';
          c.beginPath();
          c.moveTo(x, sh.y - h);
          c.lineTo(x + w * 0.5, sh.y - h * 0.30);
          c.lineTo(x - w * 0.5, sh.y - h * 0.30);
          c.closePath(); c.fill();
        } else {
          c.fillStyle = '#7a4a26';
          c.fillRect(x - w * 0.05, sh.y - h * 0.5, w * 0.10, h * 0.5);
          c.fillStyle = C.sun;
          G.roundRect(c, x - w * 0.42, sh.y - h, w * 0.84, h * 0.52, h * 0.08);
          c.fill();
          c.strokeStyle = C.ink; c.lineWidth = Math.max(1, h * 0.03); c.stroke();
        }
      }
    }
  }

  function quad(c, x1, y1, w1, x2, y2, w2, col) {
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(x1 - w1, y1);
    c.lineTo(x2 - w2, y2);
    c.lineTo(x2 + w2, y2);
    c.lineTo(x1 + w1, y1);
    c.closePath();
    c.fill();
  }

  /* The player's kart sits at a fixed place on screen and only leans; the world
     moves under it. Its sideways drift on screen is small on purpose — a kart
     that slides across the whole screen makes the road look like it is sliding
     instead. */
  function drawKart(c) {
    var lean = S.leanShown;
    var bump = Math.sin(S.z * 0.004) * (S.spd / MAX_SPD) * (S.off > 0.4 ? 2.6 : 0.6);
    A.kartBack(c, W / 2 + S.x * 64, H - 74, 210, {
      color: (G.account && G.account.color) || C.dino,
      lean: lean,
      bob: bump,
      hat: typeof G.save.hat === 'string' ? G.save.hat : null,
      boost: S.boost || 0
    });
  }
})();
