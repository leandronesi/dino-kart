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
  var CAM_BACK = 800;            // how far behind the kart the camera sits
  var KART_W = 313;              // a kart, in world units — see drawRivals

  /* Palette of whatever track is loaded. Swapped wholesale in buildTrack, so
     nothing downstream has to know which track it is drawing. */
  var COL = {};

  /* --------------------------------------------------------------- track */
  /* A track is built from a handful of instructions; the segment list is
     expanded once at entry. `curve` is how hard it bends, `hill` how steep. */
  var TRACKS = [
    {
      id: 'collina',
      name: 'La Collina',
      sub: 'prati e saliscendi',
      sky: ['#7fc6e8', '#cfeafc'],
      prop: 'albero',
      col: {
        grassLight: '#4f9e3f', grassDark: '#458c37',
        roadLight: '#6b6f76', roadDark: '#63676e',
        rumbleLight: '#e8536b', rumbleDark: '#fff6e0',
        laneMark: '#fff6e0'
      },
      /* A LAP IS TWENTY SECONDS. The first version of this plan came to 580
         segments, which at full speed is a lap every ten — so an easy race was
         over in nineteen seconds, before a child had finished working out which
         side of the screen turns which way. Length is the cheapest thing in a
         segment renderer: the ribbon costs the same to draw whether the loop is
         short or long, only the list is bigger.

         LONG CORNERS, NOT SHARP ONES, and this is the difference between a
         track and a corridor. Simulating a driver who never touches the screen
         showed the second version of this plan was a corridor: he finished
         first, on the tarmac the whole way, having done nothing — the exact
         complaint that got Il Girotondo demoted to a roundabout. Short bends
         that alternate cancel each other out before they can push you anywhere.
         What pushes you into the grass is a bend that goes ON: a moderate curve
         held for two and a half seconds drifts you a whole road-width, while
         full lock still out-pulls it instantly, so it is demanding without ever
         being unholdable. Nothing here exceeds a curve of 3.0 for that reason. */
      plan: [
        ['rettilineo di partenza', 90, 0, 0],
        ['curvone dx', 150, 2.6, 0],
        ['respiro', 50, 0, 0],
        ['salita', 40, 0, 20],
        ['curvone sx interminabile', 170, -2.4, 0],
        ['discesa', 40, 0, -20],
        ['dritto', 50, 0, 0],
        ['esse dx', 60, 2.8, 0],
        ['esse sx', 60, -2.8, 0],
        ['dritto', 40, 0, 0],
        ['curvone dx in salita', 150, 2.2, 12],
        ['dosso', 30, 0, 24],
        ['contro-dosso', 30, 0, -24],
        ['curvone sx in discesa', 140, -2.6, -12],
        ['dritto', 50, 0, 0],
        ['ultima curva dx', 90, 3.0, 0],
        ['rettilineo finale', 100, 0, 0]
      ]
    },

    /* THE SECOND TRACK, and its job is to be a different drive, not the same
       drive repainted. La Collina is long open bends you lean on; La Spiaggia is
       shorter, tighter and busier — more corners per minute, less road between
       them, and a sting in the tail. It went through the same simulation as the
       first: a driver who never touches the screen has to finish last here too,
       and the sharpest bend has to stay inside full lock. Different feel, same
       two rules. */
    {
      id: 'spiaggia',
      name: 'La Spiaggia',
      sub: 'stretta e nervosa',
      sky: ['#ffb066', '#ffe6b8'],
      prop: 'palma',
      col: {
        grassLight: '#e8cf94', grassDark: '#dcc084',
        roadLight: '#7a7f88', roadDark: '#70757e',
        rumbleLight: '#3aa7d6', rumbleDark: '#fff6e0',
        laneMark: '#fff6e0'
      },
      plan: [
        ['rettilineo di partenza', 70, 0, 0],
        ['curva sx sul mare', 110, -2.8, 0],
        ['contro-curva dx', 100, 2.8, 0],
        ['dritto corto', 35, 0, 0],
        ['salitella', 30, 0, 18],
        ['curvone dx sulle dune', 130, 2.4, 0],
        ['discesa', 30, 0, -18],
        ['esse sx', 55, -3.0, 0],
        ['esse dx', 55, 3.0, 0],
        ['esse sx di nuovo', 55, -3.0, 0],
        ['dritto', 45, 0, 0],
        ['curvone sx lungo il molo', 140, -2.6, 0],
        ['dossetto', 26, 0, 20],
        ['contro-dossetto', 26, 0, -20],
        ['curva dx stretta', 85, 3.0, 0],
        ['respiro', 40, 0, 0],
        ['ultima sx', 100, -2.9, 0],
        ['rettilineo del traguardo', 80, 0, 0]
      ]
    }
  ];

  G.kartTracks = function () { return TRACKS; };

  var segs = [];
  var trackLen = 0;

  function buildTrack(t) {
    segs.length = 0;
    COL = t.col;
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
    boost: 0,
    dist: 0,         // total distance covered, for lap and placing
    phase: 'via',    // 'via' = countdown | 'gara' | 'fine'
    t: 0,            // seconds in the current phase
    lapT: 0, best: 0, lapShown: 0,
    place: 1, laps: 3, lap: 1, lit: -1, newBest: false, farX: 640,
    rivalScale: 1,
    drift: 0,        // seconds held at full lock in a bend
    took: 0,         // boxes collected this race, for the results screen
    order: null
  };

  var MAX_SPD = 12000;           // world units per second
  var OFF_SPD = MAX_SPD * 0.38;  // top speed on the grass
  var ACCEL = MAX_SPD * 0.62;    // per second
  var BRAKE = MAX_SPD * 1.30;    // per second when off the road
  /* THESE TWO NUMBERS ARE THE GAME, and they were found by simulation, not by
     taste. Three drivers were raced on the real code: one who corrects early,
     one who corrects only at the last moment, and one who NEVER TOUCHES THE
     SCREEN. At 1.0 and 0.125 the passive one finished first, on the tarmac the
     whole way, having done precisely nothing — which is not a racing game, it
     is a screensaver, and it is the same fault that got Il Girotondo demoted.
     At 1.35 and 0.30 he spends 39% of the race in the grass and finishes last,
     while both drivers who steer stay clean and win. That is the gradient a
     racing game needs: doing nothing has to cost you.
     The ceiling on CENTRIF is the other half — see the assertion in the smoke
     test. Full lock must out-pull the sharpest bend, or the road cannot be held
     at all and no amount of skill answers that. */
  var STEER_RATE = 1.35;         // road-widths per second at full lock, full speed
  var CENTRIF = 0.30;            // outward push per unit of curve
  var BOOST_MUL = 1.30;          // how much faster than flat out a boost makes you
  /* SECONDS OF LOCK FOR THE SMALL AND BIG BOOST, and these two numbers are not
     free. At full lock the kart crosses from one edge of the road to the other
     in about two seconds, and the charge dies the moment a wheel touches grass.
     So two seconds is the whole budget, and the big boost has to sit inside it:
     the first pair I tried, 1.2 and 2.4, made the big one literally unreachable
     — you were on the grass before it armed. Set up wide, hold through the
     bend, let go: that is the six-year-old's extra game, and it has to be
     possible. */
  var DRIFT_1 = 0.7, DRIFT_2 = 1.5;

  /* Roadside objects. They do almost nothing mechanically and they are the whole
     reason a corner feels fast: with an empty verge, a road that scrolls at
     12000 units a second and one that scrolls at 4000 look nearly identical.
     Placed once per track, at a fixed side offset. */
  var props = [];
  function buildProps(t) {
    props.length = 0;
    var i, n = Math.floor(segs.length / 4);
    for (i = 0; i < n; i++) {
      var si = i * 4 + (i % 3);
      if (si >= segs.length) break;
      var side = (i % 2 ? 1 : -1);
      props.push({
        seg: si,
        x: side * (1.35 + ((i * 37) % 11) / 11 * 1.5),
        kind: (i % 5 === 0) ? 'cartello' : (t.prop || 'albero'),
        h: 900 + ((i * 53) % 7) * 130
      });
    }
  }

  /* ----------------------------------------------------------- item boxes */
  /* Three across the road, so grabbing one is nearly free — which is the point
     at three years old. What is inside is always the same thing, a shove of
     speed, and that is deliberate: an inventory needs a button, a button needs
     a finger, and both fingers are already busy steering. The reward is
     immediate and needs no explaining, which is the only kind that works here.

     SPACING IS A BALANCE NUMBER, not a decoration. The first pass put a row
     every 62 segments — one about every second at racing speed, against a boost
     that lasts 1,1s. That is not a power-up, that is a permanent 30% pay rise:
     the rivals top out at flat out and would never see you again. Every 120
     segments means roughly one row every two seconds, so you are boosting about
     half the time — and the rivals take them too, so the sums still add up. */
  var boxes = [];
  function buildBoxes() {
    boxes.length = 0;
    var i, k;
    for (i = 80; i < segs.length - 30; i += 120) {
      for (k = -1; k <= 1; k++) boxes.push({ seg: i, x: k * 0.55, cool: 0 });
    }
  }

  /* --------------------------------------------------------------- rivals */
  /* Five of them, and they are meant to WIN if you drive badly. This is the one
     place Dino Kart parts company with Dino Giungla: there the friends stopped
     to eat blackberries so nobody could ever be last. Here they race.

     What keeps it fair rather than cruel is the racing line: they hug the inside
     of a bend, which is genuinely faster, and if you learn to do the same you
     beat them. Nothing about their speed is secretly tied to yours. */
  /* NO RIVAL IS FASTER THAN YOU FLAT OUT. The first spread I tried topped out at
     1.02, and simulating ninety seconds of racing showed what that really meant:
     driving perfectly still only got second, and driving well got fifth. A race
     you cannot win by driving well is not difficult, it is rigged. With this
     spread, perfect driving wins, good driving is a fight for the podium, and
     spending a quarter of the lap on the grass puts you last — which is exactly
     the shape it should have. */
  var RIVALS = [
    { name: 'Pippi', color: '#ff6fae', skill: 0.88 },
    { name: 'Bubu', color: '#4d80e4', skill: 0.91 },
    { name: 'Momo', color: '#ffd75e', skill: 0.94 },
    { name: 'Nina', color: '#38d9a9', skill: 0.965 },
    { name: 'Rufo', color: '#ff9f43', skill: 0.99 }
  ];
  var rivals = [];

  function buildRivals() {
    rivals.length = 0;
    for (var i = 0; i < RIVALS.length; i++) {
      var r = RIVALS[i];
      rivals.push({
        name: r.name, color: r.color, skill: r.skill,
        z: wrapZ(-(i + 1) * SEG_LEN * 2.2),
        dist: -(i + 1) * SEG_LEN * 2.2,
        x: (i % 2 ? 1 : -1) * (0.28 + (i * 0.14)),
        spd: 0,
        boost: 0, bcool: 0,
        wob: i * 1.7
      });
    }
  }

  function updateRivals(dt) {
    var i, r, here, want, top, dxp;
    for (i = 0; i < rivals.length; i++) {
      r = rivals[i];
      here = segAt(r.z);

      /* THEY TAKE THE BOXES TOO. Without this the power-ups are not a mechanic,
         they are a handicap handed to the player once a lap: a 30% boost half
         the time against a field that tops out at flat out is a race nobody else
         can be in. They are opponents, so they get the same road. */
      r.boost = Math.max(0, r.boost - dt);
      r.bcool = Math.max(0, r.bcool - dt);
      if (r.bcool <= 0 && Math.abs(r.x) < 1) {
        for (var b = 0; b < boxes.length; b++) {
          var bd = wrapDelta(r.z, boxes[b].seg * SEG_LEN);
          if (bd > -SEG_LEN * 1.5 && bd < SEG_LEN * 1.5 && Math.abs(boxes[b].x - r.x) < 0.32) {
            r.boost = 1.1; r.bcool = 2.2; break;
          }
        }
      }

      top = MAX_SPD * r.skill * (S.rivalScale || 1)
        * (Math.abs(r.x) < 1 ? 1 : 0.38) * (r.boost > 0 ? BOOST_MUL : 1);
      r.spd += G.clamp(top - r.spd, -BRAKE * dt, ACCEL * dt);
      r.spd = G.clamp(r.spd, 0, MAX_SPD * BOOST_MUL);

      /* Aim for the inside of the bend: on a right-hander the fast line is to
         the right. Wander a little so five karts are not one kart drawn five
         times. */
      want = here.curve * 0.11 + Math.sin(G.t * 0.6 + r.wob) * 0.18;
      want = G.clamp(want, -0.82, 0.82);

      // give the player room rather than shunting him: they are opponents, not obstacles
      dxp = wrapDelta(r.z, S.z);
      if (Math.abs(dxp) < SEG_LEN * 2 && Math.abs(r.x - S.x) < 0.42) {
        want += (r.x >= S.x ? 1 : -1) * 0.5;
      }
      r.x += G.clamp(want - r.x, -dt * 1.6, dt * 1.6);
      r.x = G.clamp(r.x, -1.6, 1.6);

      r.z = wrapZ(r.z + r.spd * dt);
      r.dist += r.spd * dt;
    }
  }

  /* Collecting is by DISTANCE, not by segment index, and that matters: flat out
     a frame covers a whole segment, so "am I standing on the box's segment?"
     would miss it about as often as it hit. A window three segments wide cannot
     be jumped. */
  function takeBoxes(dt) {
    var i, b, d;
    for (i = 0; i < boxes.length; i++) {
      b = boxes[i];
      if (b.cool > 0) { b.cool -= dt; continue; }
      d = wrapDelta(S.z, b.seg * SEG_LEN);
      if (d > -SEG_LEN * 1.5 && d < SEG_LEN * 1.5 && Math.abs(b.x - S.x) < 0.32) {
        b.cool = 6;
        S.boost = Math.max(S.boost, 1.1);
        S.took++;
        G.sfx('coin');
        G.fx.burst(W / 2 + S.x * 64, H - 210, { color: C.sun, count: 12, speed: 300, lift: 160, size: 14 });
      }
    }
  }

  /* Signed shortest distance from a to b around the loop. */
  function wrapDelta(a, b) {
    var d = wrapZ(b - a);
    return d > trackLen / 2 ? d - trackLen : d;
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

  /* Read-only window on the driving state, so the headless test can assert that
     steering actually moves the kart. Nothing in the game reads it. */
  G.kartState = function () {
    return {
      x: S.x, spd: S.spd, z: S.z, steer: S.steer, off: S.off, dist: S.dist,
      phase: S.phase, lap: S.lap, laps: S.laps, place: S.place,
      field: rivals.length + 1, order: S.order ? S.order.length : 0,
      lapT: S.lapT, best: S.lapShown, trackLen: trackLen,
      steerRate: STEER_RATE, centrif: CENTRIF, maxCurve: maxCurve(),
      drift: S.drift, boost: S.boost, took: S.took, boxes: boxes.length,
      farX: S.farX,
      maxSpd: MAX_SPD, boostMul: BOOST_MUL, drift2: DRIFT_2
    };
  };

  /* The sharpest bend on the loaded track. The test compares it against the
     steering to prove the road can be held at all — the bug that made the game
     unplayable was a corner pushing outwards harder than full lock pulled in,
     and no amount of driving skill answers that. */
  function maxCurve() {
    var i, m = 0;
    for (i = 0; i < segs.length; i++) if (Math.abs(segs[i].curve) > m) m = Math.abs(segs[i].curve);
    return m;
  }

  /* ================================================================ SCENE */
  G.scene('pista', {
    hud: true, back: true,

    enter: function () {
      var g = G.kartSave ? G.kartSave() : { track: 0 };
      var d = G.kartDiff ? G.kartDiff() : { laps: 3, rivalScale: 1 };
      S.track = Math.min(TRACKS.length - 1, g.track || 0);
      S.laps = d.laps;
      S.rivalScale = d.rivalScale;

      buildTrack(TRACKS[S.track]);
      buildProps(TRACKS[S.track]);
      buildBoxes();
      buildRivals();
      S.z = 0; S.x = 0; S.spd = 0; S.steer = 0; S.off = 0;
      S.leanShown = 0; S.boost = 0; S.dist = 0;
      S.drift = 0; S.took = 0;
      S.phase = 'via'; S.t = 0; S.lit = -1;
      S.lapT = 0; S.lapShown = 0; S.lap = 1; S.place = 1;
      S.order = null; S.newBest = false;
    },

    update: function (dt) {
      S.t += dt;

      /* THE COUNTDOWN, and it is not decoration. Without it you were dropped
         into a race already moving, which is the single thing that made this
         read as a demo rather than a game: there was no moment at which it
         began. */
      if (S.phase === 'via') {
        var lit = Math.min(3, Math.floor(S.t));
        if (lit !== S.lit) {
          S.lit = lit;
          if (lit >= 3) { G.sfx('win'); G.say('Via!'); }
          else if (lit >= 0) G.sfx('pop');
        }
        if (S.t >= 3.3) { S.phase = 'gara'; S.t = 0; }
        S.spd = 0;
        return;
      }
      if (S.phase === 'fine') return;

      var here = segAt(S.z);
      var onRoad = Math.abs(S.x) < 1;

      /* The throttle is automatic — a child who has to hold a pedal AND steer
         has two jobs, and steering is the one that matters. What the road takes
         away is speed when you leave it, and that is the whole punishment
         model: no crash, no spin, no reset, just a slower kart and the pack
         pulling away. Losing here is a thing you watch happen, not a screen. */
      /* A boost lifts the ceiling AND the pull towards it, or it reads as a
         flame with nothing behind it. It does not rescue you from the grass:
         off the road the ceiling is still the grass ceiling, just raised. */
      var kick = S.boost > 0 ? BOOST_MUL : 1;
      var top = (onRoad ? MAX_SPD : OFF_SPD) * kick;
      if (S.spd < top) S.spd += ACCEL * (S.boost > 0 ? 2.4 : 1) * dt;
      else S.spd -= BRAKE * dt;
      S.spd = G.clamp(S.spd, 0, MAX_SPD * BOOST_MUL);
      S.off = onRoad ? Math.max(0, S.off - dt * 3) : Math.min(1, S.off + dt * 3);

      S.z = wrapZ(S.z + S.spd * dt);

      /* Steering scales with speed: standing still you cannot turn, which is
         both true and what keeps the kart from pirouetting at the start line. */
      var grip = Math.min(1, S.spd / MAX_SPD);
      /* Crossing from the middle of the road to its edge takes about three
         quarters of a second at full speed. An early version took half of one,
         which meant a single touch put you on the grass before you saw anything
         move. */
      S.x += S.steer * dt * STEER_RATE * grip;
      /* The outward push of the bend — the thing that makes a corner something
         you fight rather than something you watch go by. It must stay weaker
         than full lock, or the bend is not a corner, it is a wall; but it must
         be strong enough that a long bend carries you off if you ignore it. */
      S.x -= here.curve * dt * grip * CENTRIF;
      S.x = G.clamp(S.x, -2.4, 2.4);

      /* The drawn lean lags the finger. Snapping it makes the kart look like a
         cardboard cut-out being flicked; a tenth of a second of lag reads as
         weight. */
      S.leanShown += (S.steer * grip - S.leanShown) * Math.min(1, dt * 9);
      S.boost = Math.max(0, S.boost - dt);

      /* LA DERAPATA. Mario Kart's mini-turbo, and the reason it belongs in a
         game aimed this young: charging it costs nothing a child was not doing
         anyway. Holding your finger down through a bend IS how a three-year-old
         steers — so they get the boost by accident, over and over, and it feels
         like the kart rewarding them. The six-year-old will work out that the
         long hold pays double, and that is her whole extra game. */
      if (Math.abs(S.steer) > 0.9 && onRoad && S.spd > MAX_SPD * 0.55) {
        S.drift += dt;
      } else if (S.drift > 0) {
        if (S.drift >= DRIFT_2) { S.boost = Math.max(S.boost, 1.4); G.sfx('win'); G.fx.ring(W / 2, H - 120, C.sun, 190); }
        else if (S.drift >= DRIFT_1) { S.boost = Math.max(S.boost, 0.8); G.sfx('whoosh'); }
        S.drift = 0;
      }

      takeBoxes(dt);
      updateRivals(dt);
      S.dist += S.spd * dt;
      S.lapT += dt;

      /* A lap is a distance, not a line you have to be told you crossed. */
      var lapNow = Math.floor(S.dist / trackLen) + 1;
      if (lapNow > S.lap) {
        /* Clamped, or the last crossing reads "GIRO 3/2" for the frame between
           the line and the finish. The lap still closes: the time is banked. */
        S.lap = Math.min(lapNow, S.laps);
        closeLap();
      }

      /* Position: who has covered more ground. No fudging, no hidden ordering —
         if a rival is ahead of you it is because it drove further. */
      var ahead = 0, i;
      for (i = 0; i < rivals.length; i++) if (rivals[i].dist > S.dist) ahead++;
      S.place = ahead + 1;

      if (S.dist >= S.laps * trackLen) finish();
    },

    onDown: function (p) { if (S.phase === "gara") S.steer = p.x < W / 2 ? -1 : 1; },
    onMove: function (p) { if (S.phase === "gara") S.steer = p.x < W / 2 ? -1 : 1; },
    onUp: function () { S.steer = 0; },

    draw: function (c) { drawAll(c); }
  });

  /* ------------------------------------------------------------ lap & end */
  function closeLap() {
    var g = G.kartSave ? G.kartSave() : null;
    var id = TRACKS[S.track].id;
    S.lapShown = S.lapT;
    if (g && (!g.best[id] || S.lapT < g.best[id])) {
      g.best[id] = S.lapT;
      S.newBest = true;
      G.saveNow();
    }
    S.lapT = 0;
    G.sfx('chime');
  }

  function finish() {
    var g = G.kartSave ? G.kartSave() : null, i;
    S.phase = 'fine'; S.t = 0;
    /* Everyone's placing, worked out once and frozen, so the results screen
       cannot quietly reshuffle while you read it. */
    var all = [{ me: true, name: 'Tu', color: (G.account && G.account.color) || C.dino, dist: S.dist }];
    for (i = 0; i < rivals.length; i++) {
      all.push({ me: false, name: rivals[i].name, color: rivals[i].color, dist: rivals[i].dist });
    }
    all.sort(function (a, b) { return b.dist - a.dist; });
    S.order = all;
    for (i = 0; i < all.length; i++) if (all[i].me) S.place = i + 1;

    if (g) {
      g.races++;
      if (S.place === 1) g.wins++;
      G.saveNow();
    }
    G.sfx(S.place === 1 ? 'win' : 'chime');
    if (S.place === 1) G.fx.confetti();
    G.say(S.place === 1 ? 'Hai vinto!' : 'Sei arrivato ' + S.place + 'esimo!');
  }

  function fmtT(t) {
    if (!t || !isFinite(t)) return '--';
    var m = Math.floor(t / 60), s = t - m * 60;
    return (m > 0 ? m + "'" : '') + (s < 10 && m > 0 ? '0' : '') + s.toFixed(2) + '"';
  }

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
      /* Both terms are in WORLD units, the same units as ROAD_W. This is the
         bug that made the whole track look straight: the accumulated curve used
         to be scaled by 0.00018, which moved the road by a tenth of a pixel at a
         hundred segments while the physics happily pushed the kart off a bend it
         could not see. */
      dx += s.curve;
      cx += dx;

      var p = project(cx - S.x * ROAD_W, s.y, segZ, 0, camY, camZ);
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
    /* How far off centre the road has swept by the time it reaches the horizon.
       In a long bend this is SUPPOSED to be large — that sweep is the whole look
       of the technique — but if it runs to thousands of pixels the road just
       stops in mid-air at the side of the screen instead of vanishing into it,
       and there is nothing on screen to drive towards. The smoke test watches
       it, because nothing else would. */
    S.farX = shots.length ? shots[shots.length - 1].x : W / 2;

    drawProps(c);
    drawBoxes(c);
    drawRivals(c);
    drawKart(c);
    drawRaceHud(c);
    if (S.phase === "via") drawLights(c);
    if (S.phase === "fine") drawResults(c);
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
        } else if (p.kind === 'palma') {
          /* A bare trunk with a crown of fronds. Drawn with the same two
             primitives as the pine, so the beach costs nothing extra. */
          c.fillStyle = '#8a6a3a';
          c.fillRect(x - w * 0.055, sh.y - h * 0.78, w * 0.11, h * 0.78);
          c.fillStyle = '#2f8f57';
          for (var f = 0; f < 5; f++) {
            var ang = -2.6 + f * 0.78;
            c.beginPath();
            c.moveTo(x, sh.y - h * 0.80);
            c.lineTo(x + Math.cos(ang) * w * 0.62, sh.y - h * 0.80 + Math.sin(ang) * h * 0.24);
            c.lineTo(x + Math.cos(ang) * w * 0.50, sh.y - h * 0.66 + Math.sin(ang) * h * 0.24);
            c.closePath(); c.fill();
          }
          c.fillStyle = '#c98a3a';
          c.beginPath(); c.arc(x, sh.y - h * 0.76, Math.max(1, w * 0.07), 0, 6.2832); c.fill();
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

  /* A floating leaf-cube, bobbing above the tarmac. Sized off the segment it
     stands on, exactly like the trees and the rivals — one projection, reused. */
  function drawBoxes(c) {
    var i, j, b, sh, x, y, sz, ph;
    for (i = shots.length - 1; i >= 0; i--) {
      sh = shots[i];
      if (sh.w < 2) continue;
      for (j = 0; j < boxes.length; j++) {
        b = boxes[j];
        if (b.seg !== sh.idx || b.cool > 0) continue;
        sz = sh.sc * 460 * H / 2;
        if (sz < 4) continue;
        ph = G.t * 2.6 + j;
        x = sh.x + sh.w * b.x;
        y = sh.y - sz * 0.72 - Math.sin(ph) * sz * 0.16;
        c.save();
        c.translate(x, y);
        c.rotate(Math.sin(ph * 0.5) * 0.28);
        c.fillStyle = C.leaf;
        G.roundRect(c, -sz / 2, -sz / 2, sz, sz, sz * 0.22); c.fill();
        c.strokeStyle = 'rgba(20,32,18,.75)'; c.lineWidth = Math.max(1, sz * 0.07);
        G.roundRect(c, -sz / 2, -sz / 2, sz, sz, sz * 0.22); c.stroke();
        c.fillStyle = C.sun;
        c.beginPath();
        c.moveTo(0, -sz * 0.26);
        c.lineTo(sz * 0.24, sz * 0.06);
        c.lineTo(0, sz * 0.30);
        c.lineTo(-sz * 0.24, sz * 0.06);
        c.closePath(); c.fill();
        c.restore();
      }
    }
  }

  /* Rivals, painted from the back of the draw list forwards so a nearer kart
     covers a farther one, and so a hill hides whoever is behind it — the same
     ordering the road itself uses. Their size comes from the segment they stand
     on, which is why nothing here needs a second projection. */
  function drawRivals(c) {
    var i, j, r, di, sh, x, sz;
    for (i = shots.length - 1; i >= 0; i--) {
      sh = shots[i];
      for (j = 0; j < rivals.length; j++) {
        r = rivals[j];
        di = Math.round(wrapDelta(S.z, r.z) / SEG_LEN);
        if (di !== i || di < 1) continue;         // behind us, or not this slice
        /* ONE rule for every kart on screen, mine included. The player is drawn
           at a fixed 210px because the camera sits a fixed CAM_BACK behind him;
           a rival dd further up the road is therefore at CAM_BACK + dd, and the
           same world width gives its size. Before this, the two were sized by
           different rules that never agreed — a rival ten segments ahead came out
           462px against my 210, so the thing in the distance was twice the size
           of the thing in my hands. */
        var dd = di * SEG_LEN;
        sz = (CAM_D / (CAM_BACK + dd)) * KART_W * W / 2;
        if (sz < 5) continue;
        x = sh.x + sh.w * r.x;
        A.kartBack(c, x, sh.y, sz, {
          color: r.color,
          lean: G.clamp(segAt(r.z).curve * 0.12, -1, 1),
          bob: 0,
          boost: r.boost > 0 ? Math.min(0.85, r.boost) : 0
        });
      }
    }
  }

  /* Four readouts, and no more: which lap, what place, this lap's time, and how
     fast. A racing HUD that says more than that is a dashboard, and a six-year
     old reads none of it. */
  function drawRaceHud(c) {
    if (S.phase === 'fine') return;
    A.pill(c, 500, 104, 130, 74, 'GIRO', S.lap + '/' + S.laps);
    A.pill(c, 646, 104, 130, 74, 'POSTO', S.place + '/' + (rivals.length + 1),
      S.place === 1 ? '#7ee787' : (S.place > 4 ? '#ff8f8f' : null));
    A.pill(c, 792, 104, 190, 74, 'TEMPO', fmtT(S.lapT));
    var kmh = Math.round(S.spd / MAX_SPD * 120);
    A.pill(c, 1090, H - 104, 150, 74, null, kmh,
      S.off > 0.4 ? '#ff8f8f' : (S.boost > 0 ? '#7ee787' : null));

    if (S.lapShown > 0 && S.t < 3.2 && S.lap > 1) {
      G.text((S.newBest ? 'GIRO RECORD  ' : 'giro  ') + fmtT(S.lapShown), W / 2, 232, {
        ctx: c, size: 40, color: S.newBest ? C.sun : '#e8eef7',
        stroke: 'rgba(12,20,34,.8)', strokeWidth: 9
      });
    }
  }

  /* Three lights and a word. The moment the race begins has to exist. */
  function drawLights(c) {
    var i, on;
    for (i = 0; i < 3; i++) {
      on = S.lit > i;
      c.save();
      c.fillStyle = on ? (i === 2 ? '#7ee787' : C.sun) : 'rgba(255,246,224,.22)';
      c.beginPath(); c.arc(W / 2 - 110 + i * 110, 250, 40, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(14,20,34,.7)'; c.lineWidth = 6; c.stroke();
      c.restore();
    }
    G.text(S.lit >= 3 ? 'VIA!' : 'Pronti...', W / 2, 358, {
      ctx: c, size: S.lit >= 3 ? 74 : 52, color: S.lit >= 3 ? '#7ee787' : '#fff6e0',
      stroke: 'rgba(12,20,34,.8)', strokeWidth: 12
    });
  }

  /* The end of the race, which the game did not have at all: the full order,
     your place, and the two things you can do next. */
  function drawResults(c) {
    var i, o, y;
    c.save(); c.fillStyle = 'rgba(9,16,30,.72)'; c.fillRect(0, 0, W, H); c.restore();

    G.text(S.place === 1 ? 'HAI VINTO!' : S.place + 'º POSTO', W / 2, 96, {
      ctx: c, size: 66, color: S.place === 1 ? C.sun : '#e8eef7',
      stroke: 'rgba(12,20,34,.8)', strokeWidth: 12
    });

    for (i = 0; i < (S.order || []).length; i++) {
      o = S.order[i];
      y = 156 + i * 66;
      c.save();
      c.fillStyle = o.me ? 'rgba(255,215,94,.20)' : 'rgba(255,246,224,.08)';
      G.roundRect(c, 400, y, 480, 56, 14); c.fill();
      c.restore();
      G.text(String(i + 1), 436, y + 30, { ctx: c, size: 30, color: '#e8eef7' });
      c.save();
      c.fillStyle = o.color;
      c.beginPath(); c.arc(486, y + 28, 17, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(12,20,34,.7)'; c.lineWidth = 3; c.stroke();
      c.restore();
      G.text(o.name, 530, y + 30, {
        ctx: c, size: 30, color: o.me ? C.sun : '#e8eef7', align: 'left'
      });
    }

    var g = G.kartSave ? G.kartSave() : null;
    if (g) {
      G.text('giro migliore ' + fmtT(g.best[TRACKS[S.track].id]) + '   ·   premi presi ' + S.took,
        W / 2, 156 + 6 * 66 + 6, {
          ctx: c, size: 26, color: 'rgba(255,246,224,.75)', weight: 800
        });
    }

    G.ui.button({
      id: 'kagain', x: 330, y: H - 116, w: 280, h: 92, r: 26, color: C.leaf,
      label: 'Ancora!', fontSize: 36, onTap: function () { G.go('pista'); }
    });
    G.ui.button({
      id: 'kmenu', x: 670, y: H - 116, w: 280, h: 92, r: 26, color: C.tangerine,
      label: 'Menu', fontSize: 36, onTap: function () { G.go('menu'); }
    });
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
    var kx = W / 2 + S.x * 64;

    /* The drift charge, said in colour and nothing else. There is no gauge and
       no number: white sparks, then blue, then orange, and letting go while the
       sparks are coloured is the whole mechanic. A six-year-old learns that in
       two corners; a three-year-old never has to. */
    if (S.drift > 0.35 && S.phase === 'gara') {
      var stage = S.drift >= DRIFT_2 ? 2 : (S.drift >= DRIFT_1 ? 1 : 0);
      var col = ['rgba(255,246,224,.85)', '#7fd7ff', '#ffb545'][stage];
      var sd = S.steer > 0 ? -1 : 1;            // sparks fly off the outside wheel
      c.save();
      for (var i = 0; i < 7; i++) {
        var ph = G.t * 22 + i * 1.7;
        var sx = kx + sd * (104 + (i % 3) * 12) + Math.sin(ph) * 12;
        var sy = H - 78 + Math.cos(ph * 1.3) * 16;
        var r = (3 + (i % 3) * 2.4) * (0.7 + stage * 0.35);
        c.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(ph * 0.8));
        c.fillStyle = col;
        c.beginPath(); c.arc(sx, sy, r, 0, 6.2832); c.fill();
      }
      c.restore();
    }

    A.kartBack(c, kx, H - 74, (CAM_D / CAM_BACK) * KART_W * W / 2, {
      color: (G.account && G.account.color) || C.dino,
      lean: lean,
      bob: bump,
      hat: typeof G.save.hat === 'string' ? G.save.hat : null,
      boost: S.boost || 0
    });
  }
})();
