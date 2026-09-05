/* Dino Kart — the kart seen from behind (namespace `A`).

   THE ONE ANGLE. In Dino Giungla the dino is drawn in profile, and that is fine
   because everything there is seen from the side or from above. A racer looks
   down the road, so we need him from behind — and from behind ONLY. Turning a
   drawn character through 360 degrees means drawing it from eight angles, which
   would be by a distance the most expensive art either project has been asked
   for. Here the whole kart leans and squashes instead: one drawing, plus a lean
   term, reads as a kart that turns. That is the trick that makes this project
   affordable at all.

   (x, y) is where the kart meets the road: the contact point, like everywhere
   else in these two games. `s` is the width of the kart in screen pixels, so
   the caller can scale it by distance for the rivals and never think about it
   again.

   o = { color, lean: -1..1, bob: 0..1, hat: id|null, boost: 0..1 } */
(function () {
  'use strict';

  var G = window.G || {};
  var C = G.C || {};
  var A = window.A || (window.A = {});
  var INK = C.ink || '#2b1d12';
  var TAU = 6.2831853;

  function _shade(col, amt) { return G.shade ? G.shade(col, amt) : col; }
  function _lw(s) { return Math.max(1.4, Math.min(6, s * 0.028)); }
  function _ell(c, x, y, rx, ry, rot) {
    rx = Math.max(0.2, rx); ry = Math.max(0.2, ry); rot = rot || 0;
    c.beginPath();
    c.moveTo(x + rx * Math.cos(rot), y + rx * Math.sin(rot));
    c.ellipse(x, y, rx, ry, rot, 0, TAU);
  }
  function _shape(c, col, lw) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (lw > 0) { c.strokeStyle = INK; c.lineWidth = lw * 2; c.stroke(); }
    c.fillStyle = col; c.fill();
  }

  A.kartBack = function (c, x, y, s, o) {
    o = o || {};
    var col = o.color || C.dino || '#57c98a';
    var lean = Math.max(-1, Math.min(1, o.lean || 0));
    var bob = (o.bob || 0) * s * 0.012;
    var lw = _lw(s);
    var w = s, h = s * 0.56;

    c.save();
    c.translate(x, y + bob);
    /* The lean is doing all the work of a turn: the body rolls, and the whole
       thing shifts a little into the corner. Small numbers on purpose — past
       about eight degrees it reads as falling over rather than cornering. */
    c.rotate(lean * 0.14);
    c.translate(lean * s * 0.05, 0);

    // ground shadow, drawn unrotated-ish so it stays flat on the road
    c.save();
    c.globalAlpha = 0.26; c.fillStyle = '#1a1206';
    _ell(c, 0, 4, w * 0.56, h * 0.16, 0); c.fill();
    c.restore();

    // rear wheels: fat, and the only thing that says "this is behind you"
    var ww = w * 0.24, wh = h * 0.52;
    [-1, 1].forEach(function (sd) {
      c.beginPath();
      G.roundRect(c, sd * w * 0.5 - (sd > 0 ? 0 : ww), -wh, ww, wh, ww * 0.28);
      _shape(c, '#2f2a30', lw);
      c.fillStyle = '#8d8a92';
      c.beginPath();
      c.arc(sd * (w * 0.5 - ww * 0.5) - (sd > 0 ? 0 : 0), -wh * 0.5, ww * 0.20, 0, TAU);
      c.fill();
    });

    // the shell: a rounded box, wider at the bottom
    c.beginPath();
    c.moveTo(-w * 0.40, -h * 0.10);
    c.lineTo(-w * 0.34, -h * 0.86);
    c.lineTo(w * 0.34, -h * 0.86);
    c.lineTo(w * 0.40, -h * 0.10);
    c.closePath();
    _shape(c, col, lw);

    // Each friend has a distinct silhouette and livery, even without reading.
    if (o.style !== undefined) {
      c.fillStyle = '#fff5dc';
      if (o.style === 0) { // twin racing stripes
        c.fillRect(-w*.16,-h*.78,w*.08,h*.55); c.fillRect(w*.08,-h*.78,w*.08,h*.55);
      } else if (o.style === 1) { // broad spoiler
        c.fillStyle = '#253f75'; G.roundRect(c,-w*.48,-h*.93,w*.96,h*.15,h*.05); c.fill();
      } else if (o.style === 2) { // spotted shell
        for(var spot=0;spot<3;spot++){_ell(c,(spot-1)*w*.19,-h*.5,w*.07,w*.07,0);c.fill();}
      } else if (o.style === 3) { // pennant
        c.strokeStyle=INK;c.lineWidth=lw;c.beginPath();c.moveTo(w*.35,-h*.4);c.lineTo(w*.35,-h*1.8);c.stroke();
        c.fillStyle='#ffeb85';c.beginPath();c.moveTo(w*.35,-h*1.8);c.lineTo(w*.65,-h*1.6);c.lineTo(w*.35,-h*1.4);c.fill();
      } else { // rugged rear bumper
        c.fillStyle='#85452c';G.roundRect(c,-w*.46,-h*.35,w*.92,h*.19,h*.06);c.fill();
      }
    }
    // a lighter panel, so the shell is not a flat blob
    c.save();
    c.globalAlpha = 0.35;
    c.beginPath();
    c.moveTo(-w * 0.30, -h * 0.22);
    c.lineTo(-w * 0.25, -h * 0.72);
    c.lineTo(w * 0.02, -h * 0.72);
    c.lineTo(w * 0.02, -h * 0.22);
    c.closePath();
    c.fillStyle = '#ffffff'; c.fill();
    c.restore();

    // exhausts
    c.fillStyle = '#4a4550';
    [-1, 1].forEach(function (sd) {
      c.beginPath();
      c.ellipse(sd * w * 0.22, -h * 0.14, w * 0.05, h * 0.06, 0, 0, TAU);
      c.fill();
    });
    if (o.boost > 0.02) {
      c.save();
      c.globalAlpha = Math.min(0.85, o.boost);
      [-1, 1].forEach(function (sd) {
        var fg = c.createLinearGradient(0, -h * 0.14, 0, h * 0.5);
        fg.addColorStop(0, C.sun || '#ffd75e');
        fg.addColorStop(1, 'rgba(255,120,40,0)');
        c.fillStyle = fg;
        c.beginPath();
        c.moveTo(sd * w * 0.17, -h * 0.14);
        c.lineTo(sd * w * 0.27, -h * 0.14);
        c.lineTo(sd * w * 0.22, h * 0.42 * (0.5 + o.boost));
        c.closePath(); c.fill();
      });
      c.restore();
    }

    /* The dino, from behind. No face — that is the point, and it is why one
       drawing is enough: the back of a head does not need to turn. */
    var hy = -h * 1.02, hr = s * 0.17;

    // shoulders rising out of the seat
    c.beginPath();
    _ell(c, 0, -h * 0.80, s * 0.20, s * 0.13, 0);
    _shape(c, col, lw);

    // arms reaching forward to the wheel: two stubs either side, foreshortened
    [-1, 1].forEach(function (sd) {
      c.beginPath();
      G.roundRect(c, sd * s * 0.20 - (sd > 0 ? 0 : s * 0.09), -h * 0.92, s * 0.09, s * 0.15, s * 0.04);
      _shape(c, _shade(col, -18), lw * 0.8);
    });

    // head
    c.beginPath();
    _ell(c, 0, hy, hr, hr * 0.94, 0);
    _shape(c, col, lw);

    // the crest, seen end-on: three spikes down the middle of the skull
    c.beginPath();
    [0, 1, 2].forEach(function (i) {
      var sx = (i - 1) * hr * 0.52;
      c.moveTo(sx - hr * 0.13, hy - hr * 0.62);
      c.lineTo(sx, hy - hr * (i === 1 ? 1.20 : 1.00));
      c.lineTo(sx + hr * 0.13, hy - hr * 0.62);
      c.closePath();
    });
    _shape(c, _shade(col, -26), lw * 0.8);

    // a sliver of cheek on each side, so the head reads as a head
    c.save();
    c.globalAlpha = 0.30;
    c.fillStyle = C.pinkPop || '#ff6fae';
    _ell(c, -hr * 0.72, hy + hr * 0.16, hr * 0.22, hr * 0.15, 0); c.fill();
    _ell(c, hr * 0.72, hy + hr * 0.16, hr * 0.22, hr * 0.15, 0); c.fill();
    c.restore();

    /* His hat, if he is wearing one — the same eight hats as Dino Giungla when
       that art is present, so the brand carries across. Nothing breaks if it
       is not: the head is simply bare. */
    if (o.hat && A.hat) {
      c.save();
      A.hat(c, 0, hy - hr * 0.86, hr * 1.9, o.hat);
      c.restore();
    }

    c.restore();
  };

  /* A pill of text on a dark slab. Everything the race HUD says goes through
     this, so the four readouts cannot drift apart in style. */
  A.pill = function (c, x, y, w, h, label, value, col) {
    c.save();
    c.fillStyle = 'rgba(14,20,34,.66)';
    G.roundRect(c, x, y, w, h, h * 0.28); c.fill();
    c.strokeStyle = 'rgba(255,246,224,.22)'; c.lineWidth = 2;
    G.roundRect(c, x, y, w, h, h * 0.28); c.stroke();
    c.restore();
    if (label) {
      G.text(label, x + w / 2, y + h * 0.30, {
        ctx: c, size: h * 0.24, color: 'rgba(255,246,224,.7)', weight: 800
      });
    }
    G.text(String(value), x + w / 2, y + h * (label ? 0.70 : 0.52), {
      ctx: c, size: h * (label ? 0.42 : 0.56), color: col || (C.sun || '#ffd75e')
    });
  };

  /* Le tre cose che si tirano. Disegnate una volta e riscalate dalla distanza,
     esattamente come i kart: quello che vola deve rimpicciolire con la strada o
     smette di sembrare che stia sulla strada.

     (x, y) è il centro dell'oggetto in volo, `s` la sua larghezza sullo
     schermo, `ph` una fase che scorre per farlo girare e ronzare. */
  A.arma = function (c, x, y, s, kind, ph) {
    ph = ph || 0;
    var lw = _lw(s * 1.6);
    c.save();
    c.translate(x, y);

    if (kind === 'cocco') {
      c.rotate(ph * 5);
      c.beginPath();
      _ell(c, 0, 0, s * 0.5, s * 0.44, 0);
      _shape(c, '#8a5a2c', lw);
      c.fillStyle = '#5e3a18';
      [[-0.16, -0.10], [0.16, -0.10], [0, 0.16]].forEach(function (p) {
        c.beginPath(); c.arc(p[0] * s, p[1] * s, s * 0.075, 0, TAU); c.fill();
      });
      // tre peli, perché una noce di cocco senza peli è un sasso
      c.strokeStyle = '#6b4420'; c.lineWidth = Math.max(1, s * 0.05);
      [-0.5, 0, 0.5].forEach(function (a) {
        c.beginPath();
        c.moveTo(Math.sin(a) * s * 0.3, -s * 0.38);
        c.lineTo(Math.sin(a) * s * 0.44, -s * 0.62);
        c.stroke();
      });

    } else if (kind === 'api') {
      /* Uno sciame: una nuvoletta e tre api che ci girano dentro. Il movimento
         è tutto nella fase, così lo sciame non è mai fermo. */
      c.save();
      c.globalAlpha = 0.16; c.fillStyle = '#fff6e0';
      _ell(c, 0, 0, s * 0.66, s * 0.52, 0); c.fill();
      c.restore();
      for (var i = 0; i < 3; i++) {
        var a = ph * 7 + i * 2.1;
        var bx = Math.cos(a) * s * 0.34, by = Math.sin(a * 1.3) * s * 0.26;
        c.beginPath();
        _ell(c, bx, by, s * 0.21, s * 0.17, 0);
        _shape(c, '#ffe066', lw * 0.7);
        c.fillStyle = INK;
        c.fillRect(bx - s * 0.07, by - s * 0.16, s * 0.06, s * 0.32);
      }

    } else {
      // fulmine: una saetta, se mai dovesse volare invece di colpire subito
      c.beginPath();
      c.moveTo(-s * 0.18, -s * 0.5);
      c.lineTo(s * 0.22, -s * 0.08);
      c.lineTo(s * 0.02, -s * 0.04);
      c.lineTo(s * 0.2, s * 0.5);
      c.lineTo(-s * 0.22, s * 0.02);
      c.lineTo(-s * 0.02, -s * 0.02);
      c.closePath();
      _shape(c, '#7fd7ff', lw);
    }
    c.restore();
  };

  A._kart_ok = true;
})();
