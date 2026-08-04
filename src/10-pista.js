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
    track: 0
  };

  var MAX_SPD = 12000;           // world units per second

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
      S.z = 0; S.x = 0; S.spd = MAX_SPD * 0.55; S.steer = 0;
    },

    update: function (dt) {
      S.spd = G.clamp(S.spd, 0, MAX_SPD);
      S.z = wrapZ(S.z + S.spd * dt);

      var here = segAt(S.z);
      /* Steering, plus the outward push of the bend — the thing that makes a
         corner something you fight rather than something you watch. */
      S.x += S.steer * dt * 2.4;
      S.x -= here.curve * dt * (S.spd / MAX_SPD) * 0.55;
      S.x = G.clamp(S.x, -2.4, 2.4);
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
    var cx = 0, dx = 0, i, s, prev = null, py = H, maxy = H;
    for (i = 0; i < DRAW_N; i++) {
      s = segs[(Math.floor(wrapZ(S.z) / SEG_LEN) + i) % segs.length];
      var segZ = Math.floor(wrapZ(S.z) / SEG_LEN) * SEG_LEN + i * SEG_LEN;
      dx += s.curve * 0.00018;
      cx += dx;

      var p = project(cx - S.x * 0.9, s.y, segZ, 0, camY, camZ);
      var cur = { x: p.x, y: p.y, w: p.w, s: s };

      if (prev && cur.y < maxy && cur.y < prev.y) {
        drawSeg(c, prev, cur, s.dark);
        maxy = cur.y;
      }
      prev = cur;
      py = cur.y;
      if (cur.y < HORIZON - 40) break;    // past the vanishing point
    }
    void py;

    drawKartPlaceholder(c);
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

  /* Stands in for the kart until the dino seen from behind exists. */
  function drawKartPlaceholder(c) {
    var x = W / 2 + S.x * 90, y = H - 90;
    c.save();
    c.globalAlpha = 0.25; c.fillStyle = '#000';
    c.beginPath(); c.ellipse(x, y + 44, 96, 20, 0, 0, 7); c.fill();
    c.restore();
    c.fillStyle = (G.account && G.account.color) || C.dino;
    G.roundRect(c, x - 78, y - 40, 156, 84, 18); c.fill();
    c.strokeStyle = C.ink; c.lineWidth = 6; c.stroke();
    c.fillStyle = C.barkDark;
    G.roundRect(c, x - 96, y + 10, 34, 46, 10); c.fill();
    G.roundRect(c, x + 62, y + 10, 34, 46, 10); c.fill();
  }
})();
