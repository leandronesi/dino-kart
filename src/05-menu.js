/* Dino Kart — the front of the game (scene: menu).

   This exists because without it there is no game, only a driving demo: you
   opened the thing and were already mid-race, with no start, no laps and no way
   to finish. A race needs a before and an after, and this is the before.

   Owns G.save.kart = { best: {trackId: seconds}, wins, races }. */
(function () {
  'use strict';

  var C = G.C, W = G.W, H = G.H;

  function br() {
    var g = G.save.kart;
    if (!g || typeof g !== 'object' || Array.isArray(g)) g = G.save.kart = {};
    if (!g.best || typeof g.best !== 'object') g.best = {};
    if (typeof g.wins !== 'number' || !isFinite(g.wins) || g.wins < 0) g.wins = 0;
    if (typeof g.races !== 'number' || !isFinite(g.races) || g.races < 0) g.races = 0;
    if (g.diff !== 0 && g.diff !== 1) g.diff = 0;
    if (typeof g.track !== 'number' || !isFinite(g.track) || g.track < 0) g.track = 0;
    return g;
  }
  G.kartSave = br;

  /* Difficulty is the "levels" this game was missing: same track, a slower or
     faster field and a shorter or longer race. Not a separate mode — the same
     race, dialled. */
  var DIFF = [
    { id: 0, name: 'Facile', sub: '2 giri', laps: 2, rivalScale: 0.86, color: '#38d9a9' },
    { id: 1, name: 'Corsa', sub: '3 giri', laps: 3, rivalScale: 1.0, color: '#e8536b' }
  ];
  G.kartDiff = function () { return DIFF[br().diff] || DIFF[0]; };

  function fmt(t) {
    if (!t || !isFinite(t)) return '--';
    var m = Math.floor(t / 60), s = t - m * 60;
    return (m > 0 ? m + "'" : '') + (s < 10 && m > 0 ? '0' : '') + s.toFixed(2) + '"';
  }

  G.scene('menu', {
    hud: false, back: false,

    enter: function () {
      br();
      setTimeout(function () {
        if (G.current !== 'menu') return;
        G.say(G.pick(['Pronti a correre?', 'Si va in pista!', 'Che gara facciamo?']));
      }, 400);
    },

    draw: function (c) {
      var g = br(), i;

      var sky = c.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#1b2740');
      sky.addColorStop(0.55, '#3d5b86');
      sky.addColorStop(1, '#7a9ec4');
      c.fillStyle = sky; c.fillRect(0, 0, W, H);

      // a strip of tarmac across the bottom, so the title sits on a track
      c.fillStyle = '#5d6169'; c.fillRect(0, H - 168, W, 168);
      c.fillStyle = '#494d55'; c.fillRect(0, H - 168, W, 10);
      c.fillStyle = 'rgba(255,246,224,.75)';
      for (i = 0; i < 9; i++) c.fillRect(40 + i * 150, H - 74, 84, 12);

      G.text('DINO KART', W / 2, 132, {
        ctx: c, size: 96, color: C.sun, stroke: 'rgba(12,20,40,.85)', strokeWidth: 16
      });

      if (A.kartBack) {
        A.kartBack(c, W / 2, H - 96, 260, {
          color: (G.account && G.account.color) || C.dino,
          lean: Math.sin(G.t * 1.4) * 0.35,
          bob: Math.sin(G.t * 3) * 0.6,
          hat: typeof G.save.hat === 'string' ? G.save.hat : null
        });
      }

      /* Track picker. One track today, and the row is built from the list so the
         second one needs no new layout. */
      var tracks = G.kartTracks ? G.kartTracks() : [{ name: 'La Collina' }];
      if (g.track >= tracks.length) g.track = 0;
      var tw = 300, tg = 26;
      var tx0 = (W - (tracks.length * tw + (tracks.length - 1) * tg)) / 2;
      for (i = 0; i < tracks.length; i++) {
        (function (idx) {
          var t = tracks[idx];
          var bx = tx0 + idx * (tw + tg), on = g.track === idx;
          G.ui.button({
            id: 'trk' + idx, x: bx, y: 226, w: tw, h: 118, r: 26,
            color: on ? C.leaf : 'rgba(255,246,224,.22)',
            label: t.name, fontSize: 34,
            /* The best lap once you have one, the track's character until then:
               a row of "--" tells a child nothing about which one to pick. */
            sub: g.best[t.id] ? fmt(g.best[t.id]) + ' il giro' : (t.sub || ''),
            onTap: function () { g.track = idx; G.saveNow(); G.sfx('pop'); }
          });
        })(i);
      }

      // difficulty
      for (i = 0; i < DIFF.length; i++) {
        (function (idx) {
          var d = DIFF[idx], bx = W / 2 - 316 + idx * 332, on = g.diff === idx;
          G.ui.button({
            id: 'dif' + idx, x: bx, y: 368, w: 300, h: 112, r: 26,
            color: on ? d.color : 'rgba(255,246,224,.22)',
            label: d.name, sub: d.sub, fontSize: 36,
            onTap: function () { g.diff = idx; G.saveNow(); G.sfx('pop'); }
          });
        })(i);
      }

      G.ui.button({
        id: 'via', x: W / 2 - 190, y: 500, w: 380, h: 118, r: 30,
        color: C.sun, textColor: C.ink, label: 'VIA!', fontSize: 54,
        onTap: function () { G.go('pista'); }
      });

      if (g.races > 0) {
        G.text(g.wins + ' vittorie su ' + g.races + ' gare', W / 2, H - 26, {
          ctx: c, size: 24, color: 'rgba(255,246,224,.8)', weight: 800
        });
      }
    }
  });
})();
