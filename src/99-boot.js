/* Boot: tablet niceties, then straight onto the track.

   Dino Kart shares the engine with Dino Giungla but not its contract. There is
   no "who is playing" screen yet — one profile is created silently so the save,
   the HUD and the audio have something to hang off, and the race starts. The
   profile picker can be lifted from the other project the day two children want
   separate lap records. */
(function () {
  'use strict';

  G.toggleFullscreen = function () {
    var el = document.documentElement;
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el, { navigationUI: 'hide' });
      }
    } catch (e) { /* desktop browsers may refuse; harmless */ }
  };

  var askedFullscreen = false;
  function firstTouch() {
    G.resumeAudio();
    if (!askedFullscreen) {
      askedFullscreen = true;
      if (matchMedia('(pointer: coarse)').matches && !document.fullscreenElement) G.toggleFullscreen();
    }
    keepAwake();
  }
  window.addEventListener('pointerdown', firstTouch, { once: false, passive: true });

  var lock = null;
  function keepAwake() {
    if (lock || !navigator.wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      lock = l;
      l.addEventListener('release', function () { lock = null; });
    }).catch(function () { lock = null; });
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) keepAwake();
  });

  if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) {} }

  var last = G.accounts.last(), a = last && G.accounts.byId(last);
  if (!a) a = G.accounts.create({ name: 'Pilota', color: '#57c98a', level: 2, secret: null });
  G.accounts.login(a.id);
  G.start('pista');
})();
