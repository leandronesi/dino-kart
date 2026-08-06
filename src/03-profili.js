/* Chi sta guidando: profili, segreto a figure, colore del kart.

   Portato da Dino Giungla e non reinventato, perché i due giochi stanno sullo
   stesso tablet e nelle stesse mani: se il modo di dire "sono io" cambia fra un
   gioco e l'altro, il bambino deve impararlo due volte.

   Tre differenze, tutte dovute al fatto che questo è un gioco di corse:
     - l'anteprima è il KART, non il dino di profilo. Qui il dino esiste solo di
       spalle, e mostrarlo di lato sarebbe promettere un disegno che non c'è.
     - la domanda sull'età non apre giochi diversi, sceglie la DIFFICOLTÀ di
       partenza: Piccolo parte da Facile, Grande da Corsa. Poi si cambia dal
       menu quando si vuole.
     - niente `A.jungle` da cui pescare uno sfondo, quindi lo sfondo è lo stesso
       cielo notturno e la stessa striscia d'asfalto del menu.

   Il segreto è tre figure, non una password: un bambino di tre anni non sa
   scrivere ma ricorda benissimo "cuore, stella, luna". Non è sicurezza, è una
   serratura di famiglia — tiene due fratelli fuori dai progressi l'uno
   dell'altro, e nient'altro. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;
  var TAU = 6.2831853;

  var COLORS = [C.dino, C.blueberry, C.pinkPop, C.tangerine, C.plum, C.water];

  /* Le nove figure del segreto. Disegnate qui perché Dino Kart non porta con sé
     la libreria di forme di Dino Giungla, e nove forme sono più economiche di
     una dipendenza. Forma E colore insieme: un bambino che non distingue ancora
     un rombo da un quadrato distingue benissimo l'azzurro dal blu. */
  var KEYS = [
    { k: 'cerchio', col: C.berry },
    { k: 'quadrato', col: C.blueberry },
    { k: 'triangolo', col: C.mint },
    { k: 'cuore', col: C.pinkPop },
    { k: 'stella', col: C.sun },
    { k: 'fiore', col: C.plum },
    { k: 'luna', col: C.tangerine },
    { k: 'rombo', col: C.water },
    { k: 'quadrato', col: C.leafLight }
  ];

  function icon(c, x, y, r, i) {
    var s = KEYS[i % KEYS.length];
    var j;
    c.save();
    c.translate(x, y);
    c.beginPath();
    if (s.k === 'cerchio') {
      c.arc(0, 0, r, 0, TAU);
    } else if (s.k === 'quadrato') {
      G.roundRect(c, -r * 0.86, -r * 0.86, r * 1.72, r * 1.72, r * 0.24);
    } else if (s.k === 'triangolo') {
      c.moveTo(0, -r); c.lineTo(r * 0.92, r * 0.72); c.lineTo(-r * 0.92, r * 0.72); c.closePath();
    } else if (s.k === 'rombo') {
      c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath();
    } else if (s.k === 'cuore') {
      c.moveTo(0, r * 0.9);
      c.bezierCurveTo(-r * 1.5, -r * 0.15, -r * 0.55, -r * 1.15, 0, -r * 0.34);
      c.bezierCurveTo(r * 0.55, -r * 1.15, r * 1.5, -r * 0.15, 0, r * 0.9);
      c.closePath();
    } else if (s.k === 'stella') {
      for (j = 0; j < 10; j++) {
        var a = -Math.PI / 2 + j * Math.PI / 5;
        var rr = j % 2 ? r * 0.46 : r;
        if (j === 0) c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      c.closePath();
    } else if (s.k === 'luna') {
      c.arc(0, 0, r, Math.PI * 0.42, Math.PI * 1.58);
      c.arc(-r * 0.42, 0, r * 0.92, Math.PI * 1.52, Math.PI * 0.48, true);
      c.closePath();
    } else {                                   // fiore
      for (j = 0; j < 5; j++) {
        var b = -Math.PI / 2 + j * TAU / 5;
        c.moveTo(0, 0);
        c.arc(Math.cos(b) * r * 0.52, Math.sin(b) * r * 0.52, r * 0.48, 0, TAU);
      }
    }
    c.fillStyle = s.col; c.fill();
    c.strokeStyle = 'rgba(20,14,8,.55)'; c.lineWidth = Math.max(2, r * 0.12); c.stroke();
    c.restore();
  }

  /* Lo sfondo: lo stesso del menu, così passare dal profilo alla gara non
     sembra passare da un gioco a un altro. */
  function backdrop(c, title) {
    var sky = c.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1b2740');
    sky.addColorStop(0.55, '#3d5b86');
    sky.addColorStop(1, '#7a9ec4');
    c.fillStyle = sky; c.fillRect(0, 0, W, H);
    c.fillStyle = '#5d6169'; c.fillRect(0, H - 92, W, 92);
    c.fillStyle = '#494d55'; c.fillRect(0, H - 92, W, 8);
    c.fillStyle = 'rgba(255,246,224,.6)';
    for (var i = 0; i < 9; i++) c.fillRect(40 + i * 150, H - 52, 84, 10);
    if (title) {
      G.text(title, W / 2, 66, {
        ctx: c, size: 54, color: C.sun, stroke: 'rgba(12,20,40,.85)', strokeWidth: 12
      });
    }
  }

  function kartPreview(c, x, y, s, color, wob) {
    if (A.kartBack) {
      A.kartBack(c, x, y, s, { color: color, lean: Math.sin(G.t * 1.5 + (wob || 0)) * 0.3, bob: Math.sin(G.t * 3) * 0.5 });
      return;
    }
    c.fillStyle = color; c.fillRect(x - s / 2, y - s * 0.4, s, s * 0.4);
  }

  /* ------------------------------------------------------- scena: accesso */
  G.scene('accesso', {
    hud: false, back: false,

    enter: function () {
      var n = G.accounts.list().length;
      setTimeout(function () {
        if (G.current !== 'accesso') return;
        G.say(n ? 'Chi guida oggi?' : 'Benvenuto! Facciamo il tuo pilota.');
      }, 460);
    },

    draw: function (c) {
      backdrop(c, 'Chi guida?');

      var items = G.accounts.list().slice(0, 5);
      var n = items.length + 1;
      var cw = 210, gap = 22;
      var x0 = (W - (n * cw + (n - 1) * gap)) / 2, y = 150, ch = 340;

      items.forEach(function (a, i) {
        var x = x0 + i * (cw + gap);
        var wob = Math.sin(G.t * 1.6 + i) * 4;
        c.save();
        c.fillStyle = 'rgba(14,20,34,.55)';
        G.roundRect(c, x, y + wob, cw, ch, 26); c.fill();
        c.strokeStyle = 'rgba(255,246,224,.22)'; c.lineWidth = 2;
        G.roundRect(c, x, y + wob, cw, ch, 26); c.stroke();
        c.restore();

        kartPreview(c, x + cw / 2, y + wob + 210, 148, a.color, i);
        G.text(a.name, x + cw / 2, y + wob + 258, {
          ctx: c, size: 32, color: C.cream, maxWidth: cw - 24
        });

        c.save();
        c.fillStyle = a.level === 2 ? C.berry : C.mint;
        G.roundRect(c, x + cw / 2 - 58, y + wob + 282, 116, 32, 16); c.fill();
        c.restore();
        G.text(a.level === 2 ? 'Corsa' : 'Facile', x + cw / 2, y + wob + 299, {
          ctx: c, size: 21, color: '#fff'
        });

        // il lucchetto: un puntino, non una spiegazione
        if (a.secret) {
          c.save(); c.globalAlpha = 0.9;
          icon(c, x + cw - 28, y + wob + 28, 13, 4);
          c.restore();
        }

        G.ui.button({
          id: 'acct' + a.id, x: x, y: y + wob, w: cw, h: ch, r: 26, ghost: true,
          onTap: function () {
            if (a.secret) G.go('segreto', { id: a.id });
            else { G.accounts.login(a.id); G.go('menu'); }
          }
        });
      });

      var xn = x0 + items.length * (cw + gap);
      var wn = Math.sin(G.t * 1.6 + items.length) * 4;
      G.ui.button({
        id: 'nuovo', x: xn, y: y + wn, w: cw, h: ch, r: 26, color: C.leaf,
        icon: function (cc, cx, cy) {
          cc.save();
          cc.strokeStyle = '#fff'; cc.lineWidth = 15; cc.lineCap = 'round';
          cc.beginPath();
          cc.moveTo(cx, cy - 92); cc.lineTo(cx, cy - 20);
          cc.moveTo(cx - 36, cy - 56); cc.lineTo(cx + 36, cy - 56);
          cc.stroke(); cc.restore();
        },
        onTap: function () { G.go('nuovo'); }
      });
      G.text('Nuovo', xn + cw / 2, y + wn + ch - 88, { ctx: c, size: 32, color: '#fff' });
      G.text('pilota', xn + cw / 2, y + wn + ch - 52, { ctx: c, size: 28, color: '#fff' });

      if (items.length) {
        G.ui.round({
          id: 'gestisci', x: W - 54, y: H - 50, r: 28, color: 'rgba(255,246,224,.5)',
          icon: function (cc, x, yy, r) {
            cc.save(); cc.fillStyle = C.ink;
            for (var i = 0; i < 8; i++) {
              var a = i * Math.PI / 4 + G.t * 0.4;
              cc.save();
              cc.translate(x + Math.cos(a) * r * 0.5, yy + Math.sin(a) * r * 0.5);
              cc.rotate(a); cc.fillRect(-3, -5, 10, 10); cc.restore();
            }
            cc.beginPath(); cc.arc(x, yy, r * 0.32, 0, TAU); cc.fill();
            cc.fillStyle = 'rgba(255,246,224,.9)';
            cc.beginPath(); cc.arc(x, yy, r * 0.13, 0, TAU); cc.fill();
            cc.restore();
          },
          onTap: function () { G.go('gate'); }
        });
      }
    }
  });

  /* ------------------------------------------------------- scena: segreto */
  var sg = { id: null, taps: [], shake: 0, fails: 0 };

  G.scene('segreto', {
    hud: false, back: false,
    enter: function (p) {
      sg.id = p && p.id; sg.taps = []; sg.shake = 0; sg.fails = 0;
      var a = G.accounts.byId(sg.id);
      setTimeout(function () {
        if (G.current !== 'segreto') return;
        G.say('Ciao ' + (a ? a.name : '') + '! Tocca il tuo segreto.');
      }, 400);
    },
    update: function (dt) { if (sg.shake > 0) sg.shake = Math.max(0, sg.shake - dt * 4); },
    draw: function (c) {
      var a = G.accounts.byId(sg.id);
      if (!a) { G.go('accesso'); return; }
      backdrop(c, null);

      kartPreview(c, 250, 520, 200, a.color, 0);
      G.text('Ciao ' + a.name + '!', 250, 178, {
        ctx: c, size: 48, color: C.sun, stroke: 'rgba(12,20,40,.8)', strokeWidth: 11
      });
      G.text('Tocca il tuo segreto', 250, 232, {
        ctx: c, size: 27, color: C.cream, weight: 700
      });

      var i;
      for (i = 0; i < 3; i++) {
        var sx = 250 + (i - 1) * 74, sy = 290;
        c.save();
        c.fillStyle = 'rgba(255,246,224,.24)';
        c.beginPath(); c.arc(sx, sy, 27, 0, TAU); c.fill();
        c.restore();
        if (sg.taps[i] !== undefined) icon(c, sx, sy, 21, sg.taps[i]);
      }

      var px = 690, py = 132, cell = 148, gap = 14;
      var jitter = sg.shake > 0 ? Math.sin(G.t * 50) * sg.shake * 10 : 0;
      for (i = 0; i < 9; i++) {
        (function (idx) {
          var bx = px + (idx % 3) * (cell + gap) + jitter;
          var by = py + Math.floor(idx / 3) * (cell + gap);
          G.ui.button({
            id: 'sk' + idx, x: bx, y: by, w: cell, h: cell, r: 24, color: C.cream,
            icon: function (cc, cx, cy) { icon(cc, cx, cy, cell * 0.29, idx); },
            onTap: function () {
              sg.taps.push(idx);
              G.sfx('pop');
              if (sg.taps.length < 3) return;
              var ok = a.secret && a.secret.length === 3 &&
                a.secret.every(function (v, k) { return v === sg.taps[k]; });
              if (ok) {
                G.sfx('good');
                G.accounts.login(a.id);
                G.go('menu');
              } else {
                sg.fails++; sg.shake = 1; sg.taps = [];
                G.sfx('bad'); G.shake(6);
                G.say(G.pick(['Ops! Riprova.', 'Non e questo, riprova!', 'Ancora una volta.']));
              }
            }
          });
        })(i);
      }

      G.ui.button({
        x: 40, y: H - 104, w: 240, h: 82, r: 24, color: C.bark, label: 'Indietro',
        onTap: function () { G.go('accesso'); }
      });
      /* Dopo tre tentativi appare la via d'uscita, dietro al cancello dei
         grandi: un bambino che ha dimenticato il segreto non deve restare
         chiuso fuori dal proprio gioco. */
      if (sg.fails >= 3) {
        G.ui.button({
          x: 300, y: H - 104, w: 320, h: 82, r: 24, color: C.tangerine,
          label: 'Chiedi a un grande', fontSize: 26,
          onTap: function () { G.go('gate', { then: '@login', arg: a.id, back: 'segreto', backArg: { id: a.id } }); }
        });
      }
    }
  });

  /* --------------------------------------------------------- scena: nuovo */
  var nu = { step: 0, name: '', color: COLORS[0], level: 1, secret: [] };

  G.scene('nuovo', {
    hud: false, back: false,
    enter: function () {
      nu = { step: 0, name: '', color: COLORS[0], level: 1, secret: [] };
      G.prompt('Come ti chiami?', '', function (v) {
        if (!v) { G.go('accesso'); return; }
        nu.name = v.slice(0, 14);
        nu.step = 1;
        G.say('Ciao ' + nu.name + '! Di che colore e il tuo kart?');
      });
    },
    draw: function (c) {
      var titles = ['', 'Di che colore e il kart?', 'Quanti anni hai?', 'Scegli il tuo segreto'];
      backdrop(c, titles[nu.step] || '');
      var i;

      if (nu.step === 1) {
        kartPreview(c, W / 2, 470, 250, nu.color, 0);
        G.text(nu.name, W / 2, 520, { ctx: c, size: 38, color: C.cream });
        var bw = 128, bg = 18;
        var x0 = (W - (COLORS.length * bw + (COLORS.length - 1) * bg)) / 2;
        COLORS.forEach(function (col, k) {
          G.ui.button({
            id: 'col' + k, x: x0 + k * (bw + bg), y: 140, w: bw, h: 116, r: 24, color: col,
            icon: function (cc, cx, cy) {
              if (nu.color !== col) return;
              cc.save();
              cc.strokeStyle = '#fff'; cc.lineWidth = 8; cc.lineCap = 'round'; cc.lineJoin = 'round';
              cc.beginPath();
              cc.moveTo(cx - 22, cy); cc.lineTo(cx - 6, cy + 18); cc.lineTo(cx + 24, cy - 18);
              cc.stroke(); cc.restore();
            },
            onTap: function () { nu.color = col; G.sfx('pop'); }
          });
        });
        G.ui.button({
          x: W / 2 - 180, y: H - 112, w: 360, h: 88, r: 26, color: C.leaf, label: 'Avanti',
          onTap: function () { nu.step = 2; G.say('Quanti anni hai?'); }
        });
      }

      if (nu.step === 2) {
        /* L'eta non apre giochi diversi: sceglie da quale difficolta si parte.
           Piu onesto che inventare due modalita che poi non esistono. */
        [{ lv: 1, t: 'Piccolo', s: '3 - 4 anni', col: C.mint, d: 'Si parte da Facile: 2 giri' },
         { lv: 2, t: 'Grande', s: '5 - 7 anni', col: C.berry, d: 'Si parte da Corsa: 3 giri' }]
          .forEach(function (o, k) {
            var x = W / 2 - 340 + k * 360;
            G.ui.button({
              id: 'lv' + o.lv, x: x, y: 160, w: 320, h: 280, r: 30,
              color: nu.level === o.lv ? o.col : G.shade(o.col, -60),
              label: o.t, sub: o.s, fontSize: 50,
              onTap: function () { nu.level = o.lv; G.sfx('pop'); }
            });
            G.text(o.d, x + 160, 476, { ctx: c, size: 22, color: C.cream, weight: 700 });
          });
        G.ui.button({
          x: W / 2 - 180, y: H - 112, w: 360, h: 88, r: 26, color: C.leaf, label: 'Avanti',
          onTap: function () { nu.step = 3; G.say('Scegli tre figure: sara il tuo segreto.'); }
        });
      }

      if (nu.step === 3) {
        G.text('Tocca 3 figure e ricordale bene', W / 2, 118, {
          ctx: c, size: 26, color: C.cream, weight: 700
        });
        for (i = 0; i < 3; i++) {
          var sx = W / 2 + (i - 1) * 88, sy = 176;
          c.save(); c.fillStyle = 'rgba(255,246,224,.24)';
          c.beginPath(); c.arc(sx, sy, 31, 0, TAU); c.fill(); c.restore();
          if (nu.secret[i] !== undefined) icon(c, sx, sy, 24, nu.secret[i]);
        }
        var px = W / 2 - 232, py = 228, cell = 138, gap = 16;
        for (i = 0; i < 9; i++) {
          (function (idx) {
            var bx = px + (idx % 3) * (cell + gap), by = py + Math.floor(idx / 3) * (cell + gap);
            G.ui.button({
              id: 'nk' + idx, x: bx, y: by, w: cell, h: cell, r: 24, color: C.cream,
              disabled: nu.secret.length >= 3,
              icon: function (cc, cx, cy) { icon(cc, cx, cy, cell * 0.28, idx); },
              onTap: function () { nu.secret.push(idx); G.sfx('pop'); }
            });
          })(i);
        }
        G.ui.button({
          x: 34, y: H - 112, w: 240, h: 88, r: 26, color: C.bark, label: 'Rifai', fontSize: 32,
          onTap: function () { nu.secret = []; }
        });
        G.ui.button({
          x: W - 274, y: H - 112, w: 240, h: 88, r: 26, color: '#5a6472',
          label: 'Senza segreto', fontSize: 22,
          onTap: function () { nu.secret = []; finish(); }
        });
        if (nu.secret.length === 3) {
          G.ui.button({
            x: W / 2 - 160, y: H - 112, w: 320, h: 88, r: 26, color: C.leaf, label: 'Fatto!',
            onTap: finish
          });
        }
      }
    }
  });

  function finish() {
    var a = G.accounts.create({
      name: nu.name, color: nu.color, level: nu.level,
      secret: nu.secret.length === 3 ? nu.secret : null
    });
    G.accounts.login(a.id);
    /* L'eta scelta diventa la difficolta di partenza, una volta sola: da qui in
       poi comanda il menu, perche un bambino cresce piu in fretta di quanto si
       rifaccia un profilo. */
    if (G.kartSave) { G.kartSave().diff = nu.level === 2 ? 1 : 0; G.saveNow(); }
    G.fx.confetti(); G.sfx('win');
    G.go('menu');
    setTimeout(function () { G.say('In pista, ' + a.name + '!'); }, 900);
  }

  /* ---------------------------------------------------------- scena: gate */
  /* Il cancello dei grandi: una moltiplicazione a due cifre. Non e sicurezza,
     e un attrito che un bambino di sei anni non supera per sbaglio. */
  var gt = { a: 0, b: 0, typed: '', then: 'gestione', arg: null, back: 'accesso', backArg: null, shake: 0 };

  G.scene('gate', {
    hud: false, back: false,
    enter: function (p) {
      p = p || {};
      gt.a = G.rndi(6, 9); gt.b = G.rndi(6, 9);
      gt.typed = ''; gt.shake = 0;
      gt.then = p.then || 'gestione'; gt.arg = p.arg || null;
      gt.back = p.back || 'accesso'; gt.backArg = p.backArg || null;
    },
    update: function (dt) { if (gt.shake > 0) gt.shake = Math.max(0, gt.shake - dt * 4); },
    draw: function (c) {
      backdrop(c, null);
      G.text('Solo per i grandi', W / 2, 74, {
        ctx: c, size: 46, color: C.cream, stroke: 'rgba(12,20,40,.8)', strokeWidth: 10
      });

      var j = gt.shake > 0 ? Math.sin(G.t * 48) * gt.shake * 12 : 0;
      c.save();
      c.fillStyle = 'rgba(14,20,34,.6)';
      G.roundRect(c, 150 + j, 160, 440, 290, 26); c.fill();
      c.restore();
      G.text(gt.a + ' x ' + gt.b + ' = ?', 370 + j, 246, { ctx: c, size: 66, color: C.sun });
      c.save();
      c.fillStyle = 'rgba(255,246,224,.9)';
      G.roundRect(c, 210 + j, 312, 320, 92, 20); c.fill(); c.restore();
      G.text(gt.typed || '-', 370 + j, 358, { ctx: c, size: 54, color: C.ink });

      var keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'];
      var kx = 690, ky = 150, kw = 148, kh = 112, kg = 14;
      keys.forEach(function (k, i) {
        G.ui.button({
          id: 'g' + k, x: kx + (i % 3) * (kw + kg), y: ky + Math.floor(i / 3) * (kh + kg),
          w: kw, h: kh, r: 22,
          color: k === 'OK' ? C.leaf : k === 'C' ? C.berry : C.cream,
          textColor: (k === 'OK' || k === 'C') ? '#fff' : C.ink,
          label: k, fontSize: 42,
          onTap: function () {
            if (k === 'C') { gt.typed = ''; return; }
            if (k === 'OK') {
              if (parseInt(gt.typed, 10) === gt.a * gt.b) {
                G.sfx('good');
                if (gt.then === '@login') { G.accounts.login(gt.arg); G.go('menu'); }
                else G.go(gt.then, gt.arg);
              } else { gt.shake = 1; gt.typed = ''; G.sfx('bad'); }
              return;
            }
            if (gt.typed.length < 3) gt.typed += k;
          }
        });
      });

      G.ui.button({
        x: 150, y: H - 100, w: 280, h: 80, r: 24, color: C.bark, label: 'Annulla',
        onTap: function () { G.go(gt.back, gt.backArg); }
      });
    }
  });

  /* ------------------------------------------------------ scena: gestione */
  var gs = { sel: 0, confirm: 0 };

  G.scene('gestione', {
    hud: false, back: false,
    enter: function () { gs.sel = 0; gs.confirm = 0; },
    update: function (dt) { if (gs.confirm > 0) gs.confirm = Math.max(0, gs.confirm - dt); },
    draw: function (c) {
      backdrop(c, 'Piloti');
      var list = G.accounts.list();
      if (!list.length) { G.go('accesso'); return; }
      if (gs.sel >= list.length) gs.sel = 0;
      var a = list[gs.sel];

      // la fila dei piloti, per scegliere su chi si sta lavorando
      var cw = 128, gap = 14;
      var x0 = (W - (list.length * cw + (list.length - 1) * gap)) / 2;
      list.forEach(function (p, i) {
        G.ui.button({
          id: 'sel' + p.id, x: x0 + i * (cw + gap), y: 116, w: cw, h: 116, r: 22,
          color: i === gs.sel ? p.color : G.shade(p.color, -70),
          label: p.name, fontSize: 22,
          onTap: function () { gs.sel = i; gs.confirm = 0; G.sfx('pop'); }
        });
      });

      kartPreview(c, 300, 470, 200, a.color, 0);
      G.text(a.name, 300, 520, { ctx: c, size: 36, color: C.cream });

      var bx = 620, bw = 420, bh = 76, bg = 14, y = 262;
      function row(label, color, onTap, sub) {
        G.ui.button({ x: bx, y: y, w: bw, h: bh, r: 22, color: color, label: label, sub: sub, fontSize: 28, onTap: onTap });
        y += bh + bg;
      }
      row('Cambia nome', C.bark, function () {
        G.prompt('Nome del pilota', a.name, function (v) {
          if (v) G.accounts.update(a.id, { name: v.slice(0, 14) });
        });
      });
      row('Cambia colore', C.plum, function () {
        var i = COLORS.indexOf(a.color);
        G.accounts.update(a.id, { color: COLORS[(i + 1) % COLORS.length] });
        G.sfx('pop');
      });
      row(gs.confirm > 0 ? 'Sicuro? Tocca ancora' : 'Elimina pilota',
        gs.confirm > 0 ? C.berry : '#5a6472',
        function () {
          if (gs.confirm > 0) {
            if (G.account && G.account.id === a.id) G.accounts.logout();
            G.accounts.remove(a.id);
            gs.confirm = 0; gs.sel = 0;
            G.sfx('bad');
            if (!G.accounts.list().length) G.go('accesso');
          } else { gs.confirm = 4; }
        },
        gs.confirm > 0 ? 'annulla fra ' + Math.ceil(gs.confirm) + 's' : null);

      G.ui.button({
        x: W / 2 - 170, y: H - 100, w: 340, h: 80, r: 24, color: C.leaf, label: 'Fatto',
        onTap: function () { G.go('accesso'); }
      });
    }
  });
})();
