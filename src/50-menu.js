/* Dino Kart — menus, the Grand Prix and the podium.
   Gran Premio: four races of a cup, points after every race (15, 12, 10, 8,
   6, 4, 2, 1), and a 3D podium at the end with the trophy. A trophy in the
   Coppa Frutta opens the Coppa Stella. Gara singola: any open track. */
(function () {
  'use strict';
  var C = G.C, W = G.W, H = G.H, GL = G.GL, M4 = GL.M4;
  var GP = null;   // { cup, idx, pts: {name: points}, cols: {name: col}, last: results }

  function save() { var s = G.save.kart3 || (G.save.kart3 = {}); s.cups = s.cups || {}; s.best = s.best || {}; return s; }
  function trophyOf(cup) { var c = save().cups[cup] || {}; return c[G.level] || 0; }   // 1 gold, 2 silver, 3 bronze
  function cupOpen(cup) { return cup === 0 || [1, 2].some(function (lv) { var c = save().cups[cup - 1] || {}; return c[lv] > 0 && c[lv] <= 3; }); }
  G.kartSave = save;

  /* ---------------------------------------------------------------- turntable */
  function turntable(c, col, x, y, w, h, extra) {
    if (!GL.frame({ w: w, h: h, eye: [Math.cos(G.t * .6) * 6.5, 3.4, Math.sin(G.t * .6) * 6.5], at: [0, 1, 0], fov: .8, sky: '#000000', fog: [400, 800] })) return;
    GL.draw(G.models.kart(col), M4.trans(0, 0, 0));
    if (extra) extra();
    c.drawImage(GL.R.canvas, x, y, w, h);
  }
  function bg(c, a, b) { var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a || '#2b5876'); g.addColorStop(1, b || '#4e9fb8'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function trophyIcon(c, place, x, y, s) {
    var col = ['', '#ffd75e', '#d9dee3', '#e0a066'][place] || 'rgba(255,255,255,.25)';
    c.fillStyle = col; c.beginPath(); c.moveTo(x - 24 * s, y - 30 * s); c.lineTo(x + 24 * s, y - 30 * s); c.quadraticCurveTo(x + 22 * s, y + 6 * s, x, y + 8 * s); c.quadraticCurveTo(x - 22 * s, y + 6 * s, x - 24 * s, y - 30 * s); c.fill();
    c.fillRect(x - 5 * s, y + 6 * s, 10 * s, 14 * s); c.fillRect(x - 16 * s, y + 20 * s, 32 * s, 8 * s);
  }
  function miniTrack(c, T, x, y, sz, col) {
    var S = G.tracks.sample(T), mx = Math.min.apply(null, S.x), Mx = Math.max.apply(null, S.x), mz = Math.min.apply(null, S.z), Mz = Math.max.apply(null, S.z);
    var k = sz / Math.max(Mx - mx, Mz - mz), ox = x + (sz - (Mx - mx) * k) / 2, oz = y + (sz - (Mz - mz) * k) / 2;
    c.strokeStyle = col || '#fff'; c.lineWidth = 7; c.lineJoin = 'round'; c.beginPath();
    for (var i = 0; i <= S.N; i += 4) { var j = i % S.N; if (i) c.lineTo(ox + (S.x[j] - mx) * k, oz + (S.z[j] - mz) * k); else c.moveTo(ox + (S.x[j] - mx) * k, oz + (S.z[j] - mz) * k); }
    c.closePath(); c.stroke();
  }
  function themeCard(c, T, x, y, w, h) {
    var th = G.tracks.THEMES[T.theme], g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.ground ? th.ground[0] : th.sky[1]); c.fillStyle = g; G.roundRect(c, x, y, w, h, 18); c.fill();
  }

  G.scene('menu', {
    hud: false, back: false,
    draw: function (c) {
      bg(c);
      G.text('DINO KART', 640, 70, { size: 84, color: '#ffd75e', stroke: '#1b2b3a', strokeWidth: 14 });
      var col = (G.account && G.account.color) || C.dino;
      turntable(c, col, 340, 120, 600, 340);
      G.text(G.account ? G.account.name : '', 640, 470, { size: 34, color: '#fff', stroke: '#1b2b3a', strokeWidth: 7 });
      [0, 1].forEach(function (cup) { trophyIcon(c, trophyOf(cup), 1120 + cup * 70, 170, 1); });
      G.ui.button({ id: 'gp', x: 250, y: 510, w: 380, h: 110, r: 30, color: C.leaf, label: 'GRAN PREMIO', fontSize: 40, onTap: function () { G.go('coppe'); } });
      G.ui.button({ id: 'single', x: 650, y: 510, w: 380, h: 110, r: 30, color: C.water, label: 'Gara singola', fontSize: 38, onTap: function () { G.go('piste'); } });
      G.ui.button({ id: 'pilot', x: 24, y: 620, w: 270, h: 84, color: C.plum, label: 'Cambia pilota', fontSize: 28, onTap: function () { G.accounts.logout(); G.go('accesso'); } });
      G.ui.button({ id: 'parents', x: 986, y: 620, w: 270, h: 84, color: C.bark, label: 'Genitori', fontSize: 28, onTap: function () { G.go('gate'); } });
    }
  });

  G.scene('coppe', {
    hud: false, back: false,
    draw: function (c) {
      bg(c);
      G.text('Gran Premio', 640, 64, { size: 60, color: '#fff', stroke: '#1b2b3a', strokeWidth: 10 });
      G.tracks.CUPS.forEach(function (cup, i) {
        var x = 110 + i * 550, y = 120, open = cupOpen(i);
        c.fillStyle = '#fff6e0'; G.roundRect(c, x, y, 510, 460, 30); c.fill();
        G.text(cup.name, x + 255, y + 50, { size: 40, color: C.leafDeep });
        cup.tracks.forEach(function (ti, j) { var T = G.tracks.TRACKS[ti], cx = x + 30 + (j % 2) * 230, cy = y + 90 + Math.floor(j / 2) * 170; themeCard(c, T, cx, cy, 220, 150); miniTrack(c, T, cx + 55, cy + 12, 110); G.text(T.name, cx + 110, cy + 136, { size: 18, color: '#fff', stroke: '#1b2b3a', strokeWidth: 5, maxWidth: 210 }); });
        trophyIcon(c, trophyOf(i), x + 470, y + 50, .9);
        if (!open) { c.fillStyle = 'rgba(23,40,55,.72)'; G.roundRect(c, x, y, 510, 460, 30); c.fill(); G.text('Vinci una coppa', x + 255, y + 210, { size: 32, color: '#fff' }); G.text('nella Coppa Frutta', x + 255, y + 255, { size: 32, color: '#fff' }); }
        G.ui.button({ id: 'cup' + i, ghost: true, x: x, y: y, w: 510, h: 460, r: 30, onTap: function () {
          if (!open) { G.sfx('bad'); G.say('Prima vinci una coppa nella Coppa Frutta'); return; }
          GP = { cup: i, idx: 0, pts: {}, cols: {} }; G.go('gara', { ti: cup.tracks[0], gp: true });
        } });
      });
      G.ui.button({ id: 'back', x: 24, y: 610, w: 240, h: 90, color: C.tangerine, label: 'Indietro', onTap: function () { G.go('menu'); } });
    }
  });

  G.scene('piste', {
    hud: false, back: false,
    draw: function (c) {
      bg(c);
      G.text('Scegli la pista', 640, 58, { size: 54, color: '#fff', stroke: '#1b2b3a', strokeWidth: 10 });
      G.tracks.TRACKS.forEach(function (T, i) {
        var x = 60 + (i % 4) * 296, y = 110 + Math.floor(i / 4) * 236, open = cupOpen(T.cup), best = save().best[T.id + G.level];
        themeCard(c, T, x, y, 276, 216); miniTrack(c, T, x + 78, y + 14, 120);
        G.text(T.name, x + 138, y + 160, { size: 24, color: '#fff', stroke: '#1b2b3a', strokeWidth: 6, maxWidth: 260 });
        if (best) G.text('Record ' + Math.floor(best / 60) + ':' + ('0' + (best % 60).toFixed(1)).slice(-4), x + 138, y + 194, { size: 18, color: '#fff', stroke: '#1b2b3a', strokeWidth: 4 });
        if (!open) { c.fillStyle = 'rgba(23,40,55,.7)'; G.roundRect(c, x, y, 276, 216, 18); c.fill(); }
        G.ui.button({ id: 'tr' + i, ghost: true, x: x, y: y, w: 276, h: 216, r: 18, onTap: function () { if (open) { GP = null; G.go('gara', { ti: i }); } else { G.sfx('bad'); G.say('Si apre vincendo una coppa nella Coppa Frutta'); } } });
      });
      G.ui.button({ id: 'back', x: 24, y: 610, w: 240, h: 90, color: C.tangerine, label: 'Indietro', onTap: function () { G.go('menu'); } });
    }
  });

  /* called by the race scene when a Grand Prix race ends */
  G.gpRecord = function (results) {
    if (!GP) return;
    results.forEach(function (r) { GP.pts[r.name] = (GP.pts[r.name] || 0) + r.points; GP.cols[r.name] = r.col; });
    GP.last = results;
    var me = results.filter(function (r) { return r.player; })[0], s = save(), T = G.tracks.TRACKS[G.tracks.CUPS[GP.cup].tracks[GP.idx]];
    if (me && (!s.best[T.id + G.level] || me.time < s.best[T.id + G.level])) s.best[T.id + G.level] = Math.round(me.time * 10) / 10;
    G.saveNow();
  };
  G.gpState = function () { return GP; };
  G.gpStart = function (cup) { GP = { cup: cup, idx: 0, pts: {}, cols: {} }; return GP; };
  G.kartCupOpen = cupOpen;
  G.kartBestSingle = function (S) {
    var me = S.results.filter(function (r) { return r.player; })[0], s = save(), T = G.tracks.TRACKS[S.ti], k = T.id + G.level;
    if (me && (!s.best[k] || me.time < s.best[k])) { s.best[k] = Math.round(me.time * 10) / 10; G.saveNow(); }
  };
  function standings() {
    return Object.keys(GP.pts).map(function (n) { return { name: n, pts: GP.pts[n], col: GP.cols[n], player: G.account && n === G.account.name }; }).sort(function (a, b) { return b.pts - a.pts; });
  }

  G.scene('classifica', {
    hud: false, back: false,
    draw: function (c) {
      if (!GP) { G.go('menu'); return; }
      bg(c, '#1b2b3a', '#2b5876');
      var cup = G.tracks.CUPS[GP.cup], last = GP.idx >= cup.tracks.length - 1;
      G.text(cup.name + ' · gara ' + (GP.idx + 1) + ' di ' + cup.tracks.length, 640, 56, { size: 40, color: '#ffd75e' });
      standings().forEach(function (r, i) {
        var y = 120 + i * 58, w = 200 + r.pts * 9;
        c.fillStyle = r.player ? '#ffe9a8' : 'rgba(255,255,255,.12)'; G.roundRect(c, 200, y - 24, 880, 50, 16); c.fill();
        G.text((i + 1) + '°', 240, y, { size: 30, color: r.player ? C.ink : '#fff' });
        c.fillStyle = r.col; G.roundRect(c, 290, y - 14, Math.min(560, w), 28, 14); c.fill();
        G.text(r.name, 304, y, { size: 22, color: '#1b2b3a', align: 'left', maxWidth: 200 });
        G.text(r.pts + ' punti', 1010, y, { size: 26, color: r.player ? C.ink : '#fff' });
      });
      G.ui.button({ id: 'next', x: 440, y: 600, w: 400, h: 100, r: 28, color: C.leaf, label: last ? 'Il podio!' : 'Prossima gara', fontSize: 36, onTap: function () {
        if (last) G.go('podio'); else { GP.idx++; G.go('gara', { ti: cup.tracks[GP.idx], gp: true }); }
      } });
    }
  });

  G.scene('podio', {
    hud: false, back: false,
    enter: function () {
      if (!GP) return;
      var st = standings(), mine = st.findIndex(function (r) { return r.player; }) + 1, s = save();
      GP.final = st; GP.place = mine;
      if (mine <= 3) { s.cups[GP.cup] = s.cups[GP.cup] || {}; var prev = s.cups[GP.cup][G.level]; if (!prev || mine < prev) s.cups[GP.cup][G.level] = mine; G.saveNow(); }
      setTimeout(function () {
        if (G.current !== 'podio') return;
        G.sfx('win'); G.fx.confetti();
        G.say(mine === 1 ? 'Coppa d\'oro! Sei il campione!' : mine === 2 ? 'Coppa d\'argento! Bravissimo!' : mine === 3 ? 'Coppa di bronzo! Che bello!' : 'Che gare! Riprova per salire sul podio.');
      }, 300);
    },
    draw: function (c) {
      if (!GP) { G.go('menu'); return; }
      bg(c, '#2b1d50', '#ff9f43');
      var st = GP.final, a = G.t * .25;
      if (GL.frame({ w: 1280, h: 720, eye: [Math.sin(a) * 4, 7.5, 17], at: [0, 2.6, 0], fov: .85, sky: '#000000', fog: [500, 900] })) {
        GL.draw(G.models.podium(), M4.ident());
        [[0, 3.05, 0], [-4, 2.05, 1], [4, 1.25, 2]].forEach(function (p, i) { if (st[i]) GL.draw(G.models.kart(st[i].col), M4.mul(M4.trans(p[0], p[1], 0), M4.rotY(Math.sin(G.t * 2 + i) * .3))); });
        if (GP.place <= 3) GL.draw(G.models.trophy(['#ffd75e', '#d9dee3', '#e0a066'][GP.place - 1]), M4.mul(M4.trans(7.5, 0, 3), M4.rotY(G.t)));
        c.drawImage(GL.R.canvas, 0, 0, W, H);
      }
      G.text(GP.place <= 3 ? ['Coppa d\'oro!', 'Coppa d\'argento!', 'Coppa di bronzo!'][GP.place - 1] : GP.place + '° in classifica', 640, 70, { size: 66, color: '#ffd75e', stroke: '#1b2b3a', strokeWidth: 12 });
      st.slice(0, 3).forEach(function (r, i) { G.text((i + 1) + '° ' + r.name, [640, 360, 920][i], [600, 640, 660][i], { size: 30, color: '#fff', stroke: '#1b2b3a', strokeWidth: 7 }); });
      G.ui.button({ id: 'done', x: 1000, y: 610, w: 256, h: 90, color: C.leaf, label: 'Menu', onTap: function () { GP = null; G.go('menu'); } });
    }
  });
})();
