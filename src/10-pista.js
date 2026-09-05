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
  /* HALF-WIDTH OF THE ROAD, and it is the number that made this unplayable.
     At 2000 the road came out 2688px wide where the kart sits — more than twice
     the screen — so in the bottom half of the picture you could see NEITHER
     edge. Nothing told you where on the road you were until you were already
     off it. Crash Team Racing is the opposite: a road you can see the width of,
     with both sides in frame. At 1150 the road is about 1.2 screens wide at the
     kart, so the two edges are always there to steer between. */
  var ROAD_W = 1150;
  /* Plan curve values were written when ROAD_W was 2000 and the accumulated
     bend was in raw world units, which quietly tied "how bent the road looks"
     to "how wide the road is". Dividing by that old width makes the bend a
     fraction of the ROAD instead, so ROAD_W is now a purely visual knob and
     changing it cannot silently restyle every corner on both tracks. */
  var CURVE_SCALE = 1 / 2000;
  var DRAW_N = 300;              // how many segments ahead we draw
  var CAM_H = 1000;              // camera height above the road
  var CAM_D = 0.84;              // depth-of-field: bigger = narrower lens
  var HORIZON = 300;             // screen y of the vanishing point at rest
  var CAM_BACK = 800;            // how far behind the kart the camera sits
  var KART_W = 420;              // a kart, in world units — see drawRivals
  /* HOW FAR OFF THE ROAD YOU CAN GET. CTR has walls; you can put a wheel on the
     dirt, you cannot emigrate. At 2.4 road-widths the tarmac left the screen
     entirely and you were alone in a field with a tree, with no way to tell
     which way the track had gone — the single worst thing in the game. */
  var OFF_MAX = 1.30;
  var FIRE_Y = 618;              // sotto questa riga, ad arma carica, si spara

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
        grassLight: '#78af59', grassDark: '#6ba451',
        roadLight: '#787d86', roadDark: '#5a5e66',
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
         being unholdable. Nothing here exceeds a curve of 3.0 for that reason.

         E UN ANELLO DEVE GIRARE. Disegnare la mappa ha scoperto una cosa che
         in prima persona non si vedeva affatto: queste non erano piste, erano
         strade. Curve destre e sinistre si bilanciavano quasi esattamente, giro
         netto quasi zero, quindi il percorso se ne andava in diagonale e non
         tornava mai a casa - e nessuna scala di disegno poteva farne un anello,
         perche un anello non c'era. Ora La Collina gira in senso orario (una
         sola sinistra, di respiro) e La Spiaggia in senso antiorario, ognuna
         con un giro netto di circa 360 gradi. La mappa esce da se. */
      plan: [
        ['rettilineo di partenza', 90, 0, 0],
        ['curvone dx', 160, 2.6, 0],
        ['respiro', 45, 0, 0],
        ['salita', 40, 0, 20],
        ['tornante dx', 120, 2.9, 0],
        ['discesa', 40, 0, -20],
        ['esse sx', 55, -2.2, 0],
        ['esse dx', 55, 2.2, 0],
        ['dritto', 50, 0, 0],
        ['curvone dx in salita', 150, 2.4, 12],
        ['dosso', 30, 0, 24],
        ['contro-dosso', 30, 0, -24],
        ['la sola sinistra', 70, -2.0, -12],
        ['dritto', 45, 0, 0],
        ['curvone dx lungo', 160, 2.5, 0],
        ['respiro', 40, 0, 0],
        ['ultima dx', 120, 2.6, 0],
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
        grassLight: '#f0d79b', grassDark: '#cfae72',
        roadLight: '#868b95', roadDark: '#666b74',
        rumbleLight: '#3aa7d6', rumbleDark: '#fff6e0',
        laneMark: '#fff6e0'
      },
      plan: [
        ['rettilineo di partenza', 70, 0, 0],
        ['curva sx sul mare', 120, -2.8, 0],
        ['respiro', 35, 0, 0],
        ['salitella', 30, 0, 18],
        ['curvone sx sulle dune', 140, -2.5, 0],
        ['discesa', 30, 0, -18],
        ['esse dx', 50, 2.4, 0],
        ['esse sx', 50, -2.4, 0],
        ['dritto', 40, 0, 0],
        ['tornante sx del molo', 130, -3.0, 0],
        ['dossetto', 26, 0, 20],
        ['contro-dossetto', 26, 0, -20],
        ['la sola destra', 60, 2.2, 0],
        ['dritto', 40, 0, 0],
        ['curvone sx', 150, -2.6, 0],
        ['respiro', 35, 0, 0],
        ['ultima sx', 95, -2.9, 0],
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

  /* ------------------------------------------------------------- the map */
  /* THE TRACK HAS NO SHAPE. That is the whole trick of a segment renderer: the
     road never bends in world space, each segment just carries a sideways
     offset. So to draw a map there is nothing to copy — the shape has to be
     INVENTED from the curve list, by walking a heading.

     Two cheats make it close into a loop. The heading step is scaled so the
     total turning around the lap comes to exactly one full circle; and whatever
     position error is left at the end is spread backwards over every point, the
     same trick already used to stop the hills from ending on a cliff. The
     result is not the track — there is no track — but it is the same shape the
     driver feels, which is what a map is for. */
  var mapPts = [];
  function buildMap() {
    mapPts.length = 0;
    var i, total = 0;
    for (i = 0; i < segs.length; i++) total += segs[i].curve;
    var k = Math.abs(total) > 1e-6 ? (Math.PI * 2) / total : 0;
    var h = 0, x = 0, y = 0;
    for (i = 0; i < segs.length; i++) {
      h += segs[i].curve * k;
      x += Math.sin(h);
      y += Math.cos(h);
      mapPts.push([x, y]);
    }
    var n = mapPts.length;
    var ex = mapPts[n - 1][0], ey = mapPts[n - 1][1];
    for (i = 0; i < n; i++) {
      mapPts[i][0] -= ex * (i / (n - 1));
      mapPts[i][1] -= ey * (i / (n - 1));
    }
    // normalise into 0..1 with the aspect kept, so a long thin track stays long and thin
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (i = 0; i < n; i++) {
      if (mapPts[i][0] < x0) x0 = mapPts[i][0];
      if (mapPts[i][0] > x1) x1 = mapPts[i][0];
      if (mapPts[i][1] < y0) y0 = mapPts[i][1];
      if (mapPts[i][1] > y1) y1 = mapPts[i][1];
    }
    var span = Math.max(x1 - x0, y1 - y0) || 1;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    for (i = 0; i < n; i++) {
      mapPts[i][0] = 0.5 + (mapPts[i][0] - cx) / span;
      mapPts[i][1] = 0.5 + (mapPts[i][1] - cy) / span;
    }
  }

  /* Where on the map somebody who has covered `d` units of track is. */
  var mapHit = [0, 0];
  function mapAt(d) {
    var n = mapPts.length;
    if (!n) { mapHit[0] = 0.5; mapHit[1] = 0.5; return mapHit; }
    var s = wrapZ(d) / SEG_LEN;
    var i = Math.floor(s) % n, t = s - Math.floor(s);
    var a = mapPts[i], b = mapPts[(i + 1) % n];
    mapHit[0] = a[0] + (b[0] - a[0]) * t;
    mapHit[1] = a[1] + (b[1] - a[1]) * t;
    return mapHit;
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
    place: 6, laps: 3, lap: 1, lit: -1, newBest: false, farX: 640,
    rivalScale: 1,
    ammo: null,      // l arma che porto, una sola
    armaFlash: 0, flash: 0,
    drift: 0,        // seconds held at full lock in a bend
    took: 0,         // boxes collected this race, for the results screen
    shield: 0,       // auto-used bubble: one less thing for small hands to press
    bump: 0,         // short visual wobble after a soft contact
    impacts: 0, shieldBlocks: 0,
    order: null,
    raceT: 0,        // race clock, used to freeze an exact finish order
    finishAt: null
  };

  /* SLOWER ON PURPOSE. "Per me si può anche muovere più lentamente" — and he is
     right: at 12000 a lap went by in twenty seconds and there was no time to
     look at anything, which is half of why the race felt empty. A slower kart
     also means a corner takes longer to drive THROUGH, so the outward push has
     longer to work on you: the track got harder, not easier, and the balance
     was re-simulated after the change rather than assumed. */
  var MAX_SPD = 9000;            // world units per second
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
  /* SECONDS OF LOCK FOR THE SMALL AND BIG BOOST, and they are DERIVED, not
     chosen. At full lock the kart crosses the road in 2/STEER_RATE seconds and
     the charge dies the moment a wheel touches grass, so that crossing is the
     entire budget — the thresholds have to sit inside it.
     I got this wrong twice. First with 1.2 and 2.4, which made the big boost
     literally unreachable. Then I fixed it to 0.7 and 1.5 by hand, and later
     raised STEER_RATE from 1.0 to 1.35 for a completely unrelated reason, which
     shortened the crossing to 1.48s and quietly broke it again — the smoke test
     caught it charging to 1.42 and stopping. Tying them to STEER_RATE means the
     next person to touch the steering cannot break the drift without noticing. */
  var CROSS = 2 / STEER_RATE;
  var DRIFT_1 = CROSS * 0.34, DRIFT_2 = CROSS * 0.68;

  /* Roadside objects. They do almost nothing mechanically and they are the whole
     reason a corner feels fast: with an empty verge, a road that scrolls at
     12000 units a second and one that scrolls at 4000 look nearly identical.
     Placed once per track, at a fixed side offset. */
  var props = [], propsBySegment = [];
  function buildProps(t) {
    props.length = 0; propsBySegment = [];
    var i, n = Math.floor(segs.length / 4);
    for (i = 0; i < n; i++) {
      var si = i * 4 + (i % 3);
      if (si >= segs.length) break;
      var side = (i % 2 ? 1 : -1);
      props.push({
        seg: si,
        x: side * (1.85 + ((i * 37) % 11) / 11 * 1.6),
        kind: (i % 5 === 0) ? 'cartello' : (t.prop || 'albero'),
        h: 900 + ((i * 53) % 7) * 130
      });
      (propsBySegment[si] || (propsBySegment[si] = [])).push(props[props.length - 1]);
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
  /* ---------------------------------------------------------------- armi */
  /* "La cosa divertente è sparargli roba, non andare più veloce senza nessuno
     da vedere." Quindi: dentro le casse non c'è più solo la spinta, ci sono
     tre cose da tirare addosso a chi ti sta davanti.

     Tutte e tre fanno la stessa cosa in modi diversi — rallentano qualcuno per
     un paio di secondi — e la differenza è COME arrivano, che è quello che un
     bambino guarda. Il cocco lo devi mirare, le api arrivano da sole, il
     fulmine li prende tutti. Se ne porta una alla volta: niente inventario,
     niente scelta, niente da spiegare.

     Non c'è nessun oggetto che ti difende, perché per ora gli avversari non
     tirano niente. Prima deve essere divertente sparare; poi si vedrà se è
     divertente essere colpiti. */
  var ARMI = {
    turbo:   { nome: 'TURBO',   col: '#ffd75e', dice: 'Turbo!' },
    cocco:   { nome: 'COCCO',   col: '#a4703c', dice: 'Cocco!' },
    api:     { nome: 'API',     col: '#ffe066', dice: 'Le api!' },
    fulmine: { nome: 'FULMINE', col: '#7fd7ff', dice: 'Fulmine!' },
    scudo:   { nome: 'BOLLA',   col: '#8de9ff', dice: 'Bolla!' }
  };
  /* Pesato: il turbo esce spesso perché è quello che funziona anche quando sei
     solo in testa, e il fulmine di rado perché prende tutti in una volta. */
  var PESI = ['turbo', 'turbo', 'turbo', 'scudo', 'scudo', 'cocco', 'cocco', 'cocco', 'api', 'api', 'fulmine'];
  var bullets = [];

  var boxes = [];
  function buildBoxes() {
    boxes.length = 0;
    var i, k;
    for (i = 80; i < segs.length - 30; i += 120) {
      for (k = -1; k <= 1; k++) boxes.push({ seg: i, x: k * 0.55, cool: 0 });
    }
  }

  /* Puddles are the first Crash-Kart obstacle: big, slow and placed where a
     child can see and avoid them. Piccolo gets them near the edge; Grande gets
     a few closer to the racing line. They nudge and slow, never spin or reset. */
  var obstacles = [];
  function buildObstacles() {
    obstacles.length = 0;
    var grand = !G.account || G.account.level === 2;
    var i, side;
    for (i = 170; i < segs.length - 45; i += 210) {
      side = (Math.floor(i / 210) % 2 ? 1 : -1);
      obstacles.push({ seg: i, x: side * 0.68, cool: 0, kind: 'pozza' });
      if (grand && (Math.floor(i / 210) % 3 === 1)) {
        obstacles.push({ seg: i + 34, x: side * 0.34, cool: 0, kind: 'pozza' });
      }
    }
  }

  /* --------------------------------------------------------------- rivals */
  /* Five of them, and they are meant to WIN if you drive badly. This is the one
     place Dino Kart parts company with Dino Giungla: there the friends stopped
     to eat blackberries so nobody could ever be last. Here they race.

     What keeps it fair rather than cruel is the racing line: they hug the inside
     of a bend, which is genuinely faster, and if you learn to do the same you
     beat them. Nothing about their speed is secretly tied to yours. */
  /* THREE OF THEM ARE FASTER THAN YOU, and that reverses a rule I had written
     down twice and defended: "nessun avversario e piu veloce di te a tavoletta".
     It was the right rule for a race decided on pace and the wrong rule for
     this game, and one number settled it — with the whole field slower than a
     clean driver, the fraction of the race spent with SOMEBODY IN FRONT OF YOU
     was three percent. The catch-up band could not fix it either: it pulls a
     rival towards your pace, so if his pace is below yours it parks him just
     BEHIND your bumper, forever. To have someone ahead, someone has to be
     quicker.
     What stops that being unfair is the ceiling on the other side: a rival who
     is AHEAD of you never exceeds flat out. So the quick ones sit in front, in
     view, a few seconds up the road — and cannot drive away from you. Passing
     them is not a matter of pace, it is a matter of the drift boost, the crates
     and, from now on, of what you throw at them. Which is the game. */
  var RIVALS = [
    { name: 'Pippi', color: '#ff6fae', skill: 0.94 },
    { name: 'Bubu', color: '#4d80e4', skill: 0.98 },
    { name: 'Momo', color: '#ffd75e', skill: 1.02 },
    { name: 'Nina', color: '#38d9a9', skill: 1.06 },
    { name: 'Rufo', color: '#ff9f43', skill: 1.10 }
  ];
  var rivals = [];
  var steerPointer = null, touchSteer = 0, keys = {left:false,right:false};
  function applySteering(){S.steer=keys.left||keys.right?(Number(keys.right)-Number(keys.left)):touchSteer;}
  function clearSteering(){keys.left=keys.right=false;touchSteer=0;steerPointer=null;S.steer=0;}
  window.addEventListener('keydown',function(e){
    if(G.current!=='pista'||S.phase==='fine'||(G.overlayOpen&&G.overlayOpen()))return;
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();keys[e.key==='ArrowLeft'?'left':'right']=true;applySteering();}
    if(e.code==='Space'||e.key===' '){e.preventDefault();if(!e.repeat&&S.phase==='gara')shoot();}
  });
  window.addEventListener('keyup',function(e){
    if(e.key==='ArrowLeft'||e.key==='ArrowRight'){keys[e.key==='ArrowLeft'?'left':'right']=false;if(G.current==='pista'){e.preventDefault();applySteering();}}
    if(G.current==='pista'&&(e.code==='Space'||e.key===' '))e.preventDefault();
  });
  window.addEventListener('blur',clearSteering);
  document.addEventListener('visibilitychange',function(){if(document.hidden)clearSteering();});

  /* THE STARTING GRID, and it is the fix for the biggest complaint this game
     has had: "la cosa divertente è sparargli roba, non andare più veloce senza
     nessuno da vedere". There was nobody to see, and it was not bad luck — the
     rivals were placed BEHIND the player at the start, and the segment renderer
     only ever draws what is in front of the camera. So the field was literally
     invisible until it overtook you, and after that it was a row of dots on the
     horizon. You spent a whole race alone.
     Now they line up ahead in three staggered rows, you start at the back, and
     the moment the lights come on there are five karts filling the screen. */
  var GRID = [
    { z: 5.4, x: -0.42 }, { z: 5.4, x: 0.42 },
    { z: 3.6, x: -0.42 }, { z: 3.6, x: 0.42 },
    { z: 1.8, x: -0.42 }
  ];

  function buildRivals() {
    rivals.length = 0;
    for (var i = 0; i < RIVALS.length; i++) {
      var r = RIVALS[i];
      var g = GRID[i] || { z: 2, x: 0 };
      rivals.push({
        name: r.name, color: r.color, skill: r.skill, style: i,
        /* dist counts as raced from the very start line, grid slot included, so
           the board reads 6/6 on the lights — you ARE last, you are at the back
           of the grid — and it goes on telling the truth from there. The head
           start it hands them is a tenth of a second in a race of sixty. */
        z: wrapZ(g.z * SEG_LEN),
        dist: g.z * SEG_LEN,
        x: g.x,
        spd: 0,
        boost: 0, bcool: 0, hit: 0, finishAt: null,
        wob: i * 1.7
      });
    }
  }

  function updateRivals(dt, frameStart) {
    var i, r, here, want, top, dxp, goal = S.laps * trackLen;
    for (i = 0; i < rivals.length; i++) {
      r = rivals[i];
      // A crossed finish line is a snapshot, not a place to keep accumulating.
      if (r.finishAt !== null) continue;
      here = segAt(r.z);

      /* THEY TAKE THE BOXES TOO. Without this the power-ups are not a mechanic,
         they are a handicap handed to the player once a lap: a 30% boost half
         the time against a field that tops out at flat out is a race nobody else
         can be in. They are opponents, so they get the same road. */
      r.boost = Math.max(0, r.boost - dt);
      r.bcool = Math.max(0, r.bcool - dt);
      r.hit = Math.max(0, r.hit - dt);
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

      /* IL GRUPPO RESTA IN VISTA, and yes, this is rubber-banding, which I had
         explicitly refused to do — "nothing about their speed is secretly tied
         to yours". That principle was right about fairness and wrong about the
         game: a field that spreads out over a lap leaves a five-year-old alone
         on an empty road with nothing to chase and nothing to shoot at, which
         is a driving exercise, not a race.
         So: whoever is a long way AHEAD eases off noticeably, whoever is a long
         way behind pushes on a little. The two halves are deliberately
         lopsided, and there is a hard ceiling underneath — nobody exceeds flat
         out without a power-up. Drive perfectly and you still cannot be passed
         on pace; the pack simply stays close enough to be a race. */
      var gap = r.dist - S.dist;
      var reach = trackLen * 0.075;
      if (gap > 0) top *= 1 - Math.min(1, gap / reach) * 0.24;
      else top *= 1 + Math.min(1, -gap / reach) * 0.24;

      /* AND A RIVAL BEHIND IS ALLOWED TO GO FASTER THAN FLAT OUT. That was the
         last cap standing between this and a race, and it took a number to see
         it: with the ceiling on, the fraction of the race with SOMEBODY IN
         FRONT OF YOU was three percent. Ninety-seven percent of a lap alone on
         an empty road, which is precisely the complaint — "non andare più
         veloce senza nessuno da vedere". Nothing could catch a clean driver, so
         the moment you took the lead the game ended and kept playing.
         Driving badly still loses, and by a mile: the band tops out at +24%,
         and a kart on the grass runs at 38%. It cannot rescue anybody. What it
         does is keep five karts within sight, which is the difference between a
         race and a time trial. */
      if (gap > 0) top = Math.min(top, MAX_SPD * (r.boost > 0 ? BOOST_MUL : 1));

      /* E se l'ho colpito, arranca — DOPO la banda di recupero, non prima.
         Applicarlo prima l'avrebbe fatto rientrare fra le braccia della banda,
         che avrebbe restituito quasi tutto quello che il colpo aveva tolto:
         tirargli il cocco sarebbe stato uno spettacolo senza conseguenze. */
      if (r.hit > 0) top *= 0.34;
      r.spd += G.clamp(top - r.spd, -BRAKE * dt, ACCEL * dt);
      r.spd = G.clamp(r.spd, 0, MAX_SPD * BOOST_MUL);

      /* Aim for the inside of the bend: on a right-hander the fast line is to
         the right. Wander a little so five karts are not one kart drawn five
         times. */
      want = here.curve * [0.16, 0.08, 0.12, 0.05, 0.20][r.style]
        + Math.sin(G.t * [0.45, 0.7, 0.35, 0.9, 0.55][r.style] + r.wob) * [0.12, 0.24, 0.10, 0.30, 0.16][r.style];
      want = G.clamp(want, -0.82, 0.82);

      // give the player room rather than shunting him: they are opponents, not obstacles
      dxp = wrapDelta(r.z, S.z);
      if (Math.abs(dxp) < SEG_LEN * 2 && Math.abs(r.x - S.x) < 0.42) {
        want += (r.x >= S.x ? 1 : -1) * 0.5;
      }
      r.x += G.clamp(want - r.x, -dt * 1.6, dt * 1.6);
      r.x = G.clamp(r.x, -OFF_MAX, OFF_MAX);

      var rStep = r.spd * dt;
      if (r.dist + rStep >= goal) {
        var part = rStep > 0 ? (goal - r.dist) / rStep : 0;
        r.z = wrapZ(r.z + rStep * part);
        r.dist = goal;
        r.finishAt = frameStart + dt * G.clamp(part, 0, 1);
        r.spd = 0;
      } else {
        r.z = wrapZ(r.z + rStep);
        r.dist += rStep;
      }
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
        S.took++;
        G.sfx('coin');
        /* Una cassa presa mentre ne hai gia una in mano non si spreca: diventa
           spinta. Cosi la cassa e SEMPRE una buona notizia, che a tre anni e
           l unica regola che serve sapere. */
        var got = S.ammo ? 'turbo' : PESI[Math.floor(G.rnd(0, PESI.length)) % PESI.length];
        if (got === 'turbo') {
          S.boost = Math.max(S.boost, 1.1);
        } else if (got === 'scudo') {
          /* The defensive bonus is automatic. It is a bright bubble around the
             kart, not another button that can steal the steering thumb. */
          S.shield = Math.max(S.shield, 3.4);
          S.armaFlash = 1.1;
          G.sfx('chime');
          G.fx.text(W / 2, 280, 'BOLLA!', ARMI.scudo.col, 56);
        } else {
          S.ammo = got;
          S.armaFlash = 1.1;
        }
        G.fx.burst(W / 2, H - 210, { color: ARMI[got].col, count: 12, speed: 300, lift: 160, size: 14 });
      }
    }
  }

  function softImpact(push, label) {
    S.bump = Math.max(S.bump, 0.34);
    S.impacts++;
    S.x = G.clamp(S.x + push * 0.13, -OFF_MAX, OFF_MAX);
    if (S.shield > 0) {
      S.shield = Math.max(0, S.shield - 0.65);
      S.shieldBlocks++;
      G.sfx('pop');
      G.fx.text(W / 2, 330, 'BOLLA!', ARMI.scudo.col, 42);
      return true;
    }
    /* A bump costs a little momentum, never the steering or a whole race. */
    S.spd = Math.max(OFF_SPD, S.spd * 0.88);
    G.sfx('hatch');
    G.fx.text(W / 2, 330, label || 'PLOF!', C.sun, 42);
    return false;
  }

  function updateObstacles(dt) {
    var i, o, d;
    for (i = 0; i < obstacles.length; i++) {
      o = obstacles[i];
      o.cool = Math.max(0, o.cool - dt);
      if (o.cool > 0) continue;
      d = wrapDelta(S.z, o.seg * SEG_LEN);
      if (d > -SEG_LEN * 0.62 && d < SEG_LEN * 0.62 && Math.abs(S.x - o.x) < 0.30) {
        o.cool = 1.2;
        softImpact(S.x <= o.x ? -1 : 1, 'POZZA!');
      }
    }
  }

  function resolveRivalContacts(dt) {
    var i, r, dz, push;
    for (i = 0; i < rivals.length; i++) {
      r = rivals[i];
      r.impact = Math.max(0, (r.impact || 0) - dt);
      if (r.impact > 0 || r.finishAt !== null) continue;
      dz = wrapDelta(S.z, r.z);
      if (Math.abs(dz) >= SEG_LEN * 0.52 || Math.abs(S.x - r.x) >= 0.36) continue;
      r.impact = 0.65;
      push = S.x <= r.x ? -1 : 1;
      /* The other kart pays too: nobody gets to ram a child for free. */
      r.spd *= S.shield > 0 ? 0.78 : 0.90;
      r.x = G.clamp(r.x - push * 0.12, -OFF_MAX, OFF_MAX);
      softImpact(push, 'BUM!');
    }
  }

  /* SPARARE. Un solo colpo, quello che hai in mano, e parte sempre in avanti —
     non si mira, non si sceglie, non si tiene premuto. Il bersaglio interessante
     e sempre davanti, perche chi e dietro non ti da fastidio. */
  function shoot() {
    if (!S.ammo) return;
    var kind = S.ammo;
    S.ammo = null;

    if (kind === 'fulmine') {
      /* Nessun proiettile: prende in una volta tutti quelli davanti a te. E
         l arma dei disperati, quella che ti rimette in gioco quando sei ultimo,
         ed e apposta la piu rara. */
      var i, colpiti = 0;
      for (i = 0; i < rivals.length; i++) {
        if (rivals[i].dist > S.dist) { rivals[i].hit = Math.max(rivals[i].hit, 1.6); colpiti++; }
      }
      S.flash = 0.45;
      G.sfx(colpiti ? 'win' : 'bad');
      G.fx.text(W / 2, 300, colpiti ? 'FULMINE!' : 'sei in testa!', C.sun, 56);
      return;
    }

    bullets.push({
      kind: kind,
      z: wrapZ(S.z + SEG_LEN * 0.5),
      x: S.x,
      // le api inseguono chi ho davanti, il cocco vola dritto e lo devi mirare
      target: kind === 'api' ? nearestAhead() : -1,
      spd: MAX_SPD * (kind === 'api' ? 1.45 : 1.9),
      life: 4.5,
      wob: 0
    });
    // Speech synthesis can hitch lower-end Android devices. The flying object,
    // sound and hit feedback already say exactly what happened.
    G.sfx('whoosh');
  }

  function nearestAhead() {
    var i, best = -1, bd = 1e9, d;
    for (i = 0; i < rivals.length; i++) {
      d = wrapDelta(S.z, rivals[i].z);
      if (d > 0 && d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function updateBullets(dt) {
    var i, j, b, r, d, tx;
    for (i = bullets.length - 1; i >= 0; i--) {
      b = bullets[i];
      b.life -= dt;
      b.wob += dt;
      b.z = wrapZ(b.z + b.spd * dt);

      if (b.target >= 0 && rivals[b.target]) {
        // le api curvano verso il bersaglio invece di sperare
        tx = rivals[b.target].x;
        b.x += G.clamp(tx - b.x, -dt * 2.2, dt * 2.2);
      }

      var colpito = false;
      for (j = 0; j < rivals.length; j++) {
        r = rivals[j];
        d = wrapDelta(b.z, r.z);
        if (d > -SEG_LEN * 1.3 && d < SEG_LEN * 1.3 && Math.abs(b.x - r.x) < 0.34) {
          r.hit = Math.max(r.hit, 2.0);
          colpito = true;
          G.sfx('hatch');
          G.fx.text(W / 2, 330, 'PRESO!', C.sun, 60);
          break;
        }
      }
      if (colpito || b.life <= 0) bullets.splice(i, 1);
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
  /* Chi ho davanti e quanto lontano: serve al collaudo per rispondere alla sola
     domanda che conta davvero, cioe se c'e qualcuno da vedere. */
  G.kartAhead = function () {
    var i, n = 0, near = 1e9, d;
    for (i = 0; i < rivals.length; i++) {
      d = wrapDelta(S.z, rivals[i].z);
      if (d > 0 && d < DRAW_N * SEG_LEN) { n++; if (d < near) near = d; }
    }
    return { n: n, near: near };
  };
  G.kartSkills = function (a) {
    for (var i = 0; i < RIVALS.length && i < a.length; i++) RIVALS[i].skill = a[i];
  };
  /* Read-only balance data for the smoke test and for tuning. Nominal speed is
     deliberately monotonic: the fifth rival is never secretly weaker than the
     first before track position, boxes and hits enter the race. */
  G.kartRivalProfiles = function (diff) {
    var scales = [0.97, 1.00, 1.04];
    var scale = scales[diff] || scales[0];
    return RIVALS.map(function (r) {
      return { name: r.name, skill: r.skill, nominal: r.skill * scale };
    });
  };

  G.kartState = function () {
    return {
      x: S.x, spd: S.spd, z: S.z, steer: S.steer, off: S.off, dist: S.dist,
      phase: S.phase, lap: S.lap, laps: S.laps, place: S.place,
      field: rivals.length + 1, order: S.order ? S.order.length : 0,
      orderNames: S.order ? S.order.map(function (o) { return o.name; }) : [],
      orderTimes: S.order ? S.order.map(function (o) { return o.finishAt; }) : [],
      lapT: S.lapT, best: S.lapShown, trackLen: trackLen,
      steerRate: STEER_RATE, centrif: CENTRIF, maxCurve: maxCurve(),
      drift: S.drift, boost: S.boost, took: S.took, boxes: boxes.length,
      shield: S.shield, bump: S.bump, impacts: S.impacts,
      shieldBlocks: S.shieldBlocks, obstacles: obstacles.length,
      ammo: S.ammo, bullets: bullets.length, fireY: FIRE_Y,
      hitSpd: (function () { for (var i = 0; i < rivals.length; i++) if (rivals[i].hit > 0) return rivals[i].spd; return -1; })(),
      hits: rivals.reduce(function (a, r) { return a + (r.hit > 0 ? 1 : 0); }, 0),
      farX: S.farX, raceT: S.raceT, finishAt: S.finishAt,
      rivalDists: rivals.map(function (r) { return r.dist; }),
      rivalFinishAt: rivals.map(function (r) { return r.finishAt; }),
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
    hud: false, back: true,

    enter: function () {
      var g = G.kartSave ? G.kartSave() : { track: 0 };
      var d = G.kartDiff ? G.kartDiff() : { laps: 3, rivalScale: 1 };
      S.track = Math.min(TRACKS.length - 1, g.track || 0);
      S.laps = d.laps;
      S.rivalScale = d.rivalScale;

      buildTrack(TRACKS[S.track]);
      buildMap();
      buildProps(TRACKS[S.track]);
      buildBoxes();
      buildObstacles();
      buildRivals();
      S.z = 0; S.x = 0; S.spd = 0; S.steer = 0; S.off = 0;
      S.leanShown = 0; S.boost = 0; S.dist = 0;
      S.drift = 0; S.took = 0; S.shield = 0; S.bump = 0;
      S.impacts = 0; S.shieldBlocks = 0;
      S.ammo = null; S.armaFlash = 0; S.flash = 0;
      bullets.length = 0;
      S.phase = 'via'; S.t = 0; S.lit = -1; S.raceT = 0; S.finishAt = null;
      S.lapT = 0; S.lapShown = 0; S.lap = 1; S.place = RIVALS.length + 1;
      S.order = null; S.newBest = false; clearSteering();
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

      var frameStart = S.raceT;
      S.raceT += dt;

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

      var distBefore = S.dist;
      var travel = S.spd * dt;
      S.z = wrapZ(S.z + travel);

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
      S.x = G.clamp(S.x, -OFF_MAX, OFF_MAX);

      /* The drawn lean lags the finger. Snapping it makes the kart look like a
         cardboard cut-out being flicked; a tenth of a second of lag reads as
         weight. */
      S.leanShown += (S.steer * grip - S.leanShown) * Math.min(1, dt * 9);
      S.boost = Math.max(0, S.boost - dt);
      S.shield = Math.max(0, S.shield - dt);
      S.bump = Math.max(0, S.bump - dt * 2.6);

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
      updateObstacles(dt);
      updateBullets(dt);
      S.armaFlash = Math.max(0, S.armaFlash - dt);
      S.flash = Math.max(0, S.flash - dt);
      updateRivals(dt, frameStart);
      resolveRivalContacts(dt);
      S.dist += travel;
      S.lapT += dt;

      var finishDist = S.laps * trackLen;
      if (S.dist >= finishDist) {
        var cross = travel > 0 ? (finishDist - distBefore) / travel : 0;
        S.z = wrapZ(S.z - (S.dist - finishDist));
        S.dist = finishDist;
        S.finishAt = frameStart + dt * G.clamp(cross, 0, 1);
      }

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

      if (S.finishAt !== null) finish();
    },

    /* IL TASTO DI FUOCO NON PUO' RUBARE LO STERZO. Sterzare occupa gia tutte e
       due le meta dello schermo, quindi un'arma avrebbe bisogno di un posto suo
       — ma un bambino che tiene il tablet appoggia i pollici in basso, ed e' li
       che va messo. Quindi la fascia in fondo diventa il tasto di fuoco SOLO
       quando hai qualcosa in mano: a mani vuote sterza come tutto il resto, e
       non esiste nessuna zona morta da imparare. */
    onDown: function (p) {
      if (S.phase !== 'gara') return;
      // A second thumb can fire without cancelling the thumb already steering.
      if (S.ammo && p.y >= FIRE_Y) { shoot(); return; }
      steerPointer = p.id;
      touchSteer = p.x < W / 2 ? -1 : 1; applySteering();
    },
    onMove: function (p) {
      if (S.phase !== 'gara') return;
      if (p.id !== steerPointer) return;
      touchSteer = p.x < W / 2 ? -1 : 1; applySteering();
    },
    onUp: function (p) {
      if (p.id !== steerPointer) return;
      steerPointer = null;
      touchSteer = 0; applySteering();
    },

    exit: clearSteering,
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
    /* Everyone's placing is worked out once and frozen. Crossings are timed
       inside the frame, so a rival cannot gain an invisible extra frame after
       the line and turn a displayed first place into a second-place podium. */
    var all = [{ me: true, name: 'Tu', color: (G.account && G.account.color) || C.dino,
      dist: S.dist, finishAt: S.finishAt, seq: 0 }];
    for (i = 0; i < rivals.length; i++) {
      all.push({ me: false, name: rivals[i].name, color: rivals[i].color,
        dist: rivals[i].dist, finishAt: rivals[i].finishAt, seq: i + 1 });
    }
    all.sort(function (a, b) {
      var af = a.finishAt !== null, bf = b.finishAt !== null;
      if (af && bf) return a.finishAt - b.finishAt || a.seq - b.seq;
      if (af) return -1;
      if (bf) return 1;
      return b.dist - a.dist || a.seq - b.seq;
    });
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
    var fraction = wrapZ(S.z) / SEG_LEN % 1;
    var camY = G.lerp(base.y, segAt(S.z + SEG_LEN).y, fraction) + CAM_H;
    var camZ = S.z;

    drawSky(c, t);

    /* Walk forward accumulating the fake curve. `dx` is how much the road
       shifts per segment; `cx` the running total. */
    /* Two passes. First the ribbon back-to-front, remembering where each
       segment landed; then the roadside objects painted over it in the same
       order, so a tree can never be swallowed by the tarmac drawn after it. */
    var base0 = Math.floor(wrapZ(S.z) / SEG_LEN);
    var cx = 0, dx = -base.curve * fraction, i, s, prev = null, maxy = H, drawn = 0;
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

      var p = project((cx * CURVE_SCALE - S.x) * ROAD_W, s.y, segZ, 0, camY, camZ);
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
    drawObstacles(c);
    drawBullets(c);
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
    c.fillStyle = t.id==='collina'?'#76a779':'#d4bb87';
    c.beginPath();c.moveTo(0,HORIZON);c.bezierCurveTo(150,165,280,182,450,HORIZON);c.bezierCurveTo(760,155,1010,190,W,HORIZON);c.closePath();c.fill();
    c.fillStyle='rgba(255,250,228,.65)';for(var cloud=0;cloud<3;cloud++){c.beginPath();c.ellipse(260+cloud*350,180-cloud%2*60,70,18,0,0,7);c.fill();}
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
      if (i < 3 || sh.w < 2) continue;      // see drawBoxes: nothing nearer than the kart
      var localProps = propsBySegment[sh.idx] || [];
      for (var j = 0; j < localProps.length; j++) {
        p = localProps[j];
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
          c.ellipse(x,sh.y-h*.62,w*.48,h*.38,0,0,7);c.fill();
          c.fillStyle='#4b9957';c.beginPath();c.ellipse(x-w*.14,sh.y-h*.76,w*.26,h*.21,-.2,0,7);c.fill();
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
      /* NOTHING IS DRAWN NEARER THAN THE KART. The camera sits CAM_BACK behind
         it, which is four segments, so segments 0..3 are the strip of road
         BETWEEN the lens and the player: anything painted there comes out
         nearer than the kart, and therefore bigger. Two crates the size of the
         dino used to flank him on every straight. Same mistake the rivals made
         once, same cure — one distance rule for everything standing on a road. */
      if (i < 4 || sh.w < 2) continue;
      for (j = 0; j < boxes.length; j++) {
        b = boxes[j];
        if (b.seg !== sh.idx || b.cool > 0) continue;
        sz = sh.sc * 300 * H / 2;
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

  /* Blue puddles read as something to skirt around even before one is touched.
     They use the same projected slice as crates and rivals, so they never pop
     in front of the kart or become larger than it. */
  function drawObstacles(c) {
    var i, j, o, sh, x, y, rx, ry;
    for (i = shots.length - 1; i >= 0; i--) {
      sh = shots[i];
      if (i < 4 || sh.w < 2) continue;
      for (j = 0; j < obstacles.length; j++) {
        o = obstacles[j];
        if (o.seg !== sh.idx) continue;
        rx = sh.sc * 220 * H / 2;
        ry = rx * 0.34;
        if (rx < 4) continue;
        x = sh.x + sh.w * o.x;
        y = sh.y - ry * 0.14;
        c.save();
        c.globalAlpha = o.cool > 0 ? 0.35 : 0.92;
        c.fillStyle = '#4da7d8';
        c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 6.2832); c.fill();
        c.strokeStyle = '#d6f5ff'; c.lineWidth = Math.max(1, rx * 0.12); c.stroke();
        c.restore();
      }
    }
  }

  /* I proiettili in volo, con la stessa identica regola di distanza dei kart:
     e' l'unico modo perche' un cocco a mezza pista non venga grande come una
     casa. Disegnati prima degli avversari, cosi' quando il colpo arriva sparisce
     DIETRO il kart che sta colpendo invece che davanti. */
  function drawBullets(c) {
    var i, j, b, sh, di, dd, sz, x, y;
    for (i = shots.length - 1; i >= 0; i--) {
      sh = shots[i];
      if (i < 3) continue;
      for (j = 0; j < bullets.length; j++) {
        b = bullets[j];
        di = Math.round(wrapDelta(S.z, b.z) / SEG_LEN);
        if (di !== i || di < 1) continue;
        dd = di * SEG_LEN;
        sz = (CAM_D / (CAM_BACK + dd)) * 260 * W / 2;
        if (sz < 4) continue;
        x = sh.x + sh.w * b.x;
        y = sh.y - sz * 0.7 - Math.abs(Math.sin(b.wob * 9)) * sz * 0.35;
        if (A.arma) A.arma(c, x, y, sz, b.kind, b.wob);
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
        di = Math.floor((wrapZ(S.z) % SEG_LEN + CAM_BACK + wrapDelta(S.z, r.z)) / SEG_LEN);
        if (di !== i || di < 1) continue;         // behind us, or not this slice
        /* ONE rule for every kart on screen, mine included. The player is drawn
           at a fixed 210px because the camera sits a fixed CAM_BACK behind him;
           a rival dd further up the road is therefore at CAM_BACK + dd, and the
           same world width gives its size. Before this, the two were sized by
           different rules that never agreed — a rival ten segments ahead came out
           462px against my 210, so the thing in the distance was twice the size
           of the thing in my hands. */
        var dd = wrapDelta(S.z, r.z);
        var blend = (wrapZ(S.z) % SEG_LEN + CAM_BACK + dd) / SEG_LEN - di;
        var nextShot = shots[i + 1] || sh;
        var roadX = G.lerp(sh.x, nextShot.x, blend);
        var roadY = G.lerp(sh.y, nextShot.y, blend);
        var roadW = G.lerp(sh.w, nextShot.w, blend);
        sz = (CAM_D / (CAM_BACK + dd)) * KART_W * W / 2;
        if (sz < 5) continue;
        x = roadX + roadW * r.x;
        A.kartBack(c, x, roadY, sz, {
          color: r.color, style: r.style,
          lean: r.hit > 0 ? Math.sin(G.t * 22 + j) * 0.95 : G.clamp(segAt(r.z).curve * 0.12, -1, 1),
          bob: r.hit > 0 ? Math.sin(G.t * 30 + j) * 3 : 0,
          boost: r.boost > 0 ? Math.min(0.85, r.boost) : 0
        });
      }
    }
  }

  /* Four readouts, and no more: which lap, what place, this lap's time, and how
     fast. A racing HUD that says more than that is a dashboard, and a six-year
     old reads none of it. */
  /* THE MAP, and six dots that are the point of it. Watching your dot crawl up
     on somebody else's is a whole game on its own, and it is the only place
     where the five rivals exist all at once: on the road you see whoever is in
     front of you and nothing else. */
  var MAP = { x: 34, y: 34, w: 210, h: 210 };
  function drawMap(c) {
    var i, p, n = mapPts.length;
    if (!n) return;
    var pad = 26;
    var bx = MAP.x, by = MAP.y, bw = MAP.w, bh = MAP.h;
    var mx = function (u) { return bx + pad + u * (bw - pad * 2); };
    var my = function (v) { return by + pad + v * (bh - pad * 2); };

    c.save();
    c.fillStyle = 'rgba(14,20,34,.60)';
    G.roundRect(c, bx, by, bw, bh, 24); c.fill();
    c.strokeStyle = 'rgba(255,246,224,.20)'; c.lineWidth = 2;
    G.roundRect(c, bx, by, bw, bh, 24); c.stroke();

    // the ribbon: a fat pale line, drawn once round
    c.beginPath();
    for (i = 0; i <= n; i += 4) {
      p = mapPts[i % n];
      if (i === 0) c.moveTo(mx(p[0]), my(p[1])); else c.lineTo(mx(p[0]), my(p[1]));
    }
    c.closePath();
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.strokeStyle = 'rgba(255,246,224,.30)'; c.lineWidth = 15; c.stroke();
    c.strokeStyle = 'rgba(255,246,224,.75)'; c.lineWidth = 5; c.stroke();

    // the start line
    p = mapAt(0);
    c.fillStyle = C.sun;
    c.beginPath(); c.arc(mx(p[0]), my(p[1]), 4, 0, 6.2832); c.fill();

    // the field, then me on top so I am never hidden by somebody else
    for (i = 0; i < rivals.length; i++) {
      p = mapAt(rivals[i].dist);
      c.fillStyle = rivals[i].color;
      c.beginPath(); c.arc(mx(p[0]), my(p[1]), 7, 0, 6.2832); c.fill();
      c.strokeStyle = 'rgba(12,20,34,.75)'; c.lineWidth = 2; c.stroke();
    }
    p = mapAt(S.dist);
    c.fillStyle = (G.account && G.account.color) || C.dino;
    c.beginPath(); c.arc(mx(p[0]), my(p[1]), 10, 0, 6.2832); c.fill();
    c.strokeStyle = '#fff6e0'; c.lineWidth = 3.5; c.stroke();
    c.restore();
  }

  /* IL TASTO DI FUOCO ESISTE SOLO QUANDO SERVE. Compare in fondo allo schermo
     nel momento in cui prendi qualcosa, largo quanto tutto lo schermo, con
     dentro la cosa che stai per tirare, e sparisce appena l'hai tirata. Non c'e
     niente da imparare a memoria: c'e un tasto, o non c'e. */
  function drawFireBar(c) {
    if (!S.ammo) return;
    var a = ARMI[S.ammo];
    var pulse = 0.72 + 0.28 * Math.sin(G.t * 6);
    var bh = H - FIRE_Y;
    c.save();
    var g = c.createLinearGradient(0, FIRE_Y, 0, H);
    g.addColorStop(0, 'rgba(14,20,34,0)');
    g.addColorStop(1, 'rgba(14,20,34,.34)');
    c.fillStyle = g; c.fillRect(0, FIRE_Y, W, bh);
    c.globalAlpha = pulse;
    c.strokeStyle = a.col; c.lineWidth = 5;
    G.roundRect(c, 16, FIRE_Y + 10, W - 32, bh - 22, 26); c.stroke();
    c.restore();

    // l'oggetto due volte, ai lati del kart, cosi cade sotto tutte e due le mani
    if (A.arma) {
      A.arma(c, 150, FIRE_Y + bh * 0.5, 66, S.ammo, G.t);
      A.arma(c, W - 150, FIRE_Y + bh * 0.5, 66, S.ammo, G.t);
    }
    G.text('TIRA!', W / 2, FIRE_Y + bh * 0.5, {
      ctx: c, size: 38, color: a.col, stroke: 'rgba(12,20,34,.85)', strokeWidth: 10
    });

    if (S.armaFlash > 0) {
      c.save();
      c.globalAlpha = Math.min(1, S.armaFlash * 1.4);
      G.text(a.nome, W / 2, 250, {
        ctx: c, size: 76, color: a.col, stroke: 'rgba(12,20,34,.85)', strokeWidth: 14
      });
      c.restore();
    }
  }

  function drawRaceHud(c) {
    if (S.phase === 'fine') return;
    drawMap(c);
    drawFireBar(c);
    if (S.flash > 0) {
      c.save();
      c.globalAlpha = Math.min(0.75, S.flash * 1.7);
      c.fillStyle = '#dff4ff'; c.fillRect(0, 0, W, H);
      c.restore();
    }
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
    var bump = Math.sin(S.z * 0.004) * (S.spd / MAX_SPD) * (S.off > 0.4 ? 2.6 : 0.6)
      + Math.sin(G.t * 48) * S.bump * 8;
    var kx = W / 2;

    if (S.shield > 0) {
      var glow = 0.50 + 0.28 * Math.sin(G.t * 9);
      c.save();
      c.globalAlpha = glow;
      c.strokeStyle = ARMI.scudo.col; c.lineWidth = 7;
      c.fillStyle = 'rgba(95,214,255,.12)';
      c.beginPath(); c.ellipse(kx, H - 164, 142, 150, 0, 0, 6.2832); c.fill(); c.stroke();
      c.restore();
    }

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
