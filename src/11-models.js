/* Dino Kart — every model in the game, made of boxes, cylinders, cones and
   balls. Convention: +z is forward, +y is up, the origin is on the ground in
   the middle of the object. A kart is about 3 m long, the road about 16 m wide. */
(function () {
  'use strict';
  var GL = G.GL, M4 = GL.M4;

  function shade(hex, k) { var c = GL.hex(hex); return [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)]; }

  /* ---- the kart, with its dino on board ---- */
  function kart(b, col) {
    var dark = '#2b2b33', body = col, light = shade(col, 1.25), deep = shade(col, .7);
    b.box(0, .55, .1, 1.7, .32, 2.7, deep, body);             // chassis
    b.box(0, .62, 1.45, 1.5, .22, .3, body, light);            // front bumper
    b.box(-.95, .6, .1, .3, .3, 1.5, body, light);             // side pods
    b.box(.95, .6, .1, .3, .3, 1.5, body, light);
    b.box(0, .95, -.35, .9, .45, .9, deep, body);              // seat back / engine cover
    b.box(0, .95, -1.1, 1.1, .4, .55, '#5a5e66', '#7b8188');   // engine
    b.cyl(-.3, .9, -1.4, .1, .35, '#9aa0a6', 6); b.cyl(.3, .9, -1.4, .1, .35, '#9aa0a6', 6);   // exhausts
    b.box(0, 1.0, .75, .08, .45, .08, dark);                   // steering column
    b.push(M4.mul(M4.trans(0, 1.25, .65), M4.rotX(-.9))); b.cyl(0, 0, 0, .26, .06, dark, 10); b.pop();
    b.box(0, .72, -1.55, 1.9, .12, .25, deep, body);           // rear wing
    b.wheel(-1.0, .42, .95, .42, .38, dark); b.wheel(1.0, .42, .95, .42, .38, dark);
    b.wheel(-1.05, .5, -.9, .5, .46, dark); b.wheel(1.05, .5, -.9, .5, .46, dark);
    // the driver
    dino(b, 0, .95, .05, .62, col);
  }
  function dino(b, x, y, z, s, col) {
    var light = shade(col, 1.3), belly = '#f6e7c1';
    b.ball(x, y + .55 * s, z, .55 * s, .6 * s, .5 * s, col, 4, 8);                // body
    b.ball(x, y + .5 * s, z + .32 * s, .36 * s, .42 * s, .2 * s, belly, 3, 7);     // belly
    b.ball(x, y + 1.25 * s, z + .15 * s, .42 * s, .4 * s, .44 * s, col, 4, 8);      // head
    b.box(x, y + 1.17 * s, z + .55 * s, .5 * s, .3 * s, .45 * s, light);           // snout
    [-1, 1].forEach(function (k) {
      b.ball(x + k * .2 * s, y + 1.42 * s, z + .42 * s, .13 * s, .15 * s, .1 * s, '#ffffff', 3, 6);
      b.ball(x + k * .2 * s, y + 1.43 * s, z + .5 * s, .06 * s, .08 * s, .05 * s, '#2b1d12', 2, 5);
      b.box(x + k * .55 * s, y + .75 * s, z + .4 * s, .18 * s, .18 * s, .55 * s, col);   // arms to the wheel
    });
    for (var i = 0; i < 4; i++) b.cone(x, y + (1.62 - i * .28) * s, z - (.2 + i * .14) * s, .13 * s, .25 * s, '#ffd75e', 5);
  }

  /* ---- scenery ---- */
  var SC = {
    tree: function (b, x, y, z, k) { b.cyl(x, y, z, .35 * k, 2.2 * k, '#7a4a26', 6); b.cone(x, y + 1.6 * k, z, 2.1 * k, 3.6 * k, '#2f8f4e', 7); b.cone(x, y + 3.2 * k, z, 1.5 * k, 2.4 * k, '#48a863', 7); },
    round: function (b, x, y, z, k) { b.cyl(x, y, z, .35 * k, 2.4 * k, '#7a4a26', 6); b.ball(x, y + 3.4 * k, z, 2 * k, 1.8 * k, 2 * k, '#3f9a5c', 3, 7); },
    pine: function (b, x, y, z, k, snow) { b.cyl(x, y, z, .3 * k, 1.4 * k, '#6a4222', 6); for (var i = 0; i < 3; i++) b.cone(x, y + (1 + i * 1.5) * k, z, (2 - i * .5) * k, 2.4 * k, snow && i === 2 ? '#f4f8fb' : '#1f6b45', 7); },
    palm: function (b, x, y, z, k) {
      for (var i = 0; i < 6; i++) b.cyl(x + i * .18 * k, y + i * .9 * k, z, (.38 - i * .03) * k, .95 * k, i % 2 ? '#a0703c' : '#8a5a32', 6);
      for (var j = 0; j < 6; j++) { var a = j / 6 * Math.PI * 2, tx = x + 1.1 * k, ty = y + 5.5 * k; b.push(M4.mul(M4.trans(tx, ty, z), M4.rotY(a))); b.quad([0, 0, -.5 * k], [3 * k, -1 * k, -.2 * k], [3 * k, -1 * k, .2 * k], [0, 0, .5 * k], '#2f9e57'); b.quad([0, 0, .5 * k], [3 * k, -1 * k, .2 * k], [3 * k, -1 * k, -.2 * k], [0, 0, -.5 * k], '#2a8a4c'); b.pop(); }
    },
    rock: function (b, x, y, z, k, col) { b.ball(x, y + .4 * k, z, 1.6 * k, 1.1 * k, 1.3 * k, col || '#8e9a8e', 2, 5); },
    bush: function (b, x, y, z, k) { b.ball(x, y + .7 * k, z, 1.4 * k, 1 * k, 1.4 * k, '#3b8f4f', 3, 6); b.ball(x + .6 * k, y + 1.4 * k, z, .25 * k, .25 * k, .25 * k, '#ff6fae', 2, 5); },
    flower: function (b, x, y, z, k) { b.cyl(x, y, z, .08 * k, 1 * k, '#2f8f4e', 4); b.ball(x, y + 1.1 * k, z, .45 * k, .2 * k, .45 * k, ['#ff6fae', '#ffd75e', '#8f5bd6'][Math.floor(Math.abs(x * 7 + z)) % 3], 2, 6); },
    mushroom: function (b, x, y, z, k) { b.cyl(x, y, z, .5 * k, 1.6 * k, '#f6e7c1', 7); b.ball(x, y + 1.8 * k, z, 1.6 * k, .9 * k, 1.6 * k, '#e8536b', 3, 8); b.ball(x + .6 * k, y + 2.4 * k, z + .4 * k, .3 * k, .15 * k, .3 * k, '#ffffff', 2, 5); },
    tower: function (b, x, y, z, k) { b.cyl(x, y, z, 2.2 * k, 9 * k, '#9aa0a6', 8); b.cone(x, y + 9 * k, z, 2.8 * k, 4 * k, '#c0392b', 8); b.box(x, y + 6 * k, z + 2.1 * k, .8 * k, 1.4 * k, .3 * k, '#2b2b33'); },
    lollipop: function (b, x, y, z, k) { b.cyl(x, y, z, .15 * k, 4 * k, '#fff6e0', 5); b.push(M4.mul(M4.trans(x, y + 5 * k, z), M4.rotX(Math.PI / 2))); b.cyl(0, -.3 * k, 0, 1.6 * k, .6 * k, ['#ff6fae', '#38d9a9', '#ffd75e', '#8f5bd6'][Math.floor(Math.abs(x + z)) % 4], 10); b.pop(); },
    candy: function (b, x, y, z, k) { b.box(x, y + 1 * k, z, 2.4 * k, 2 * k, 2.4 * k, ['#ff9fc8', '#9fe3ff', '#fff19a'][Math.floor(Math.abs(x * 3 + z)) % 3], '#ffffff'); },
    lavarock: function (b, x, y, z, k) { b.ball(x, y + .6 * k, z, 1.8 * k, 1.4 * k, 1.6 * k, '#3a2430', 2, 5); b.cone(x, y + 1.4 * k, z, .6 * k, 1 * k, '#ff7a1a', 5); },
    volcano: function (b, x, y, z, k) { b.cyl(x, y, z, 30 * k, 26 * k, '#4a2330', 9, 7 * k, '#ff7a1a'); },
    iceberg: function (b, x, y, z, k) { b.cone(x, y, z, 2.2 * k, 4 * k, '#dff4fb', 5); },
    snowman: function (b, x, y, z, k) { b.ball(x, y + 1 * k, z, 1.1 * k, 1 * k, 1.1 * k, '#ffffff', 3, 7); b.ball(x, y + 2.4 * k, z, .75 * k, .7 * k, .75 * k, '#ffffff', 3, 7); b.cone(x, y + 2.5 * k, z + .7 * k, .12 * k, .6 * k, '#ff9f43', 5); },
    star: function (b, x, y, z, k) {
      var col = ['#ffd75e', '#ff6fae', '#38d9a9', '#4d80e4'][Math.floor(Math.abs(x * 3 + z)) % 4];
      for (var i = 0; i < 5; i++) { var a = i / 5 * Math.PI * 2, a2 = a + Math.PI / 5; b.tri([x, y, z], [x + Math.cos(a) * 2 * k, y + Math.sin(a) * 2 * k, z], [x + Math.cos(a2) * .8 * k, y + Math.sin(a2) * .8 * k, z], col); b.tri([x, y, z], [x + Math.cos(a2) * .8 * k, y + Math.sin(a2) * .8 * k, z], [x + Math.cos(a) * 2 * k, y + Math.sin(a) * 2 * k, z], col); }
    },
    planet: function (b, x, y, z, k) { b.ball(x, y, z, 8 * k, 8 * k, 8 * k, ['#8f5bd6', '#4d80e4', '#ff9f43'][Math.floor(Math.abs(x + z)) % 3], 5, 10); },
    fence: function () {}
  };

  /* ---- race objects ---- */
  function itemBox(b) {
    var cols = ['#ff6fae', '#ffd75e', '#38d9a9', '#4d80e4', '#ff9f43', '#8f5bd6'], s = .8;
    var p = function (i, j, k) { return [i * s, j * s, k * s]; };
    b.quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), cols[0]); b.quad(p(-1, -1, 1), p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), cols[1]);
    b.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), cols[2]); b.quad(p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), cols[3]);
    b.quad(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), cols[4]); b.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), cols[5]);
    b.box(0, 0, 0, .5, .5, .5, '#ffffff');
  }
  function banana(b) { for (var i = 0; i < 5; i++) { var a = (i - 2) * .32; b.box(Math.sin(a) * 1.0, .35 + Math.cos(a) * .5 - .5 + .4, 0, .34, .34, .34, i === 0 || i === 4 ? '#7a5a26' : '#ffd75e'); } }
  function shell(b, col) { b.ball(0, .35, 0, .75, .6, .75, col, 3, 8); b.cyl(0, .1, 0, .8, .25, '#fff6e0', 8); }
  function fruit(b) { b.cone(0, -.5, 0, .55, 1.0, '#e8536b', 6); b.push(M4.rotX(Math.PI)); b.cone(0, -.55, 0, .55, .45, '#e8536b', 6); b.pop(); b.cone(0, .5, 0, .35, .3, '#2f8f4e', 5); }
  function starItem(b) { SC.star(b, 0, 0, 0, .55); b.push(M4.rotY(Math.PI)); SC.star(b, 0, 0, 0, .55); b.pop(); }
  function boostPad(b) { for (var i = 0; i < 3; i++) { var z = i * 1.6 - 1.6; b.quad([-1.8, .05, z - .3], [0, .05, z + .9], [0, .05, z + .3], [-1.8, .05, z - .9], '#ffd75e'); b.quad([0, .05, z + .9], [1.8, .05, z - .3], [1.8, .05, z - .9], [0, .05, z + .3], '#ffd75e'); } b.box(0, .02, 0, 4.4, .04, 5.6, '#ff9f43'); }
  function trophy(b, col) {
    b.box(0, .4, 0, 1.6, .8, 1.6, '#5a3a1c', '#7a4a26');
    b.cyl(0, .8, 0, .3, 1.0, col, 8); b.cyl(0, 1.8, 0, .4, 1.4, col, 10, 1.1);
    b.push(M4.mul(M4.trans(-1.1, 2.6, 0), M4.rotZ(Math.PI / 2))); b.cyl(0, -.1, 0, .35, .2, col, 8); b.pop();
    b.push(M4.mul(M4.trans(1.3, 2.6, 0), M4.rotZ(Math.PI / 2))); b.cyl(0, -.1, 0, .35, .2, col, 8); b.pop();
  }
  function podium(b) {
    b.box(0, 1.5, 0, 4, 3, 4, '#ffd75e', '#fff19a'); b.box(-4, 1, 0, 4, 2, 4, '#c9ced4', '#e9edf0'); b.box(4, .6, 0, 4, 1.2, 4, '#d58a4a', '#eab07a');
  }

  /* build and upload once, lazily */
  var cache = {};
  function get(key, fn) { if (!cache[key]) { var b = new GL.Builder(); fn(b); cache[key] = GL.upload(b); } return cache[key]; }
  G.models = {
    kart: function (col) { return get('kart' + col, function (b) { kart(b, col); }); },
    itemBox: function () { return get('box', itemBox); },
    banana: function () { return get('banana', banana); },
    shell: function (red) { return get('shell' + (red ? 'r' : 'g'), function (b) { shell(b, red ? '#e8362b' : '#2f9e57'); }); },
    fruit: function () { return get('fruit', fruit); },
    star: function () { return get('star', starItem); },
    pad: function () { return get('pad', boostPad); },
    trophy: function (col) { return get('trophy' + col, function (b) { trophy(b, col); }); },
    podium: function () { return get('podium', podium); },
    blob: function () { return get('blob', function (b) { for (var i = 0; i < 10; i++) { var a = i / 10 * Math.PI * 2, a2 = (i + 1) / 10 * Math.PI * 2; b.tri([0, .03, 0], [Math.cos(a2) * 1.4, .03, Math.sin(a2) * 1.8], [Math.cos(a) * 1.4, .03, Math.sin(a) * 1.8], '#000000'); } }); },
    SC: SC, dino: dino, kartBuild: kart, shade: shade
  };
})();
