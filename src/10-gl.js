/* Dino Kart — a tiny WebGL renderer, written for this game and nothing else.

   One shader: flat-shaded triangles with a colour per vertex, a sun, some
   ambient light and distance fog that melts into the sky. That is the whole
   low-poly look. Every model is built from boxes, cylinders, cones and
   spheres by the mesh builder below and uploaded once.

   The 3D picture is rendered into its own canvas and copied into the game's
   2D canvas with drawImage, so the engine, the menus and the HUD stay exactly
   as they are in every other Dino game. */
(function () {
  'use strict';

  /* ------------------------------------------------------------ mat4 */
  var M4 = {
    ident: function () { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    mul: function (a, b) {
      var o = new Array(16);
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++)
        o[j * 4 + i] = a[i] * b[j * 4] + a[4 + i] * b[j * 4 + 1] + a[8 + i] * b[j * 4 + 2] + a[12 + i] * b[j * 4 + 3];
      return o;
    },
    persp: function (fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2);
      return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0];
    },
    look: function (e, c, u) {
      var z = norm([e[0] - c[0], e[1] - c[1], e[2] - c[2]]), x = norm(cross(u, z)), y = cross(z, x);
      return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1];
    },
    trans: function (x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; },
    scale: function (x, y, z) { return [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; },
    rotY: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; },
    rotX: function (a) { var c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; },
    rotZ: function (a) { var c = Math.cos(a), s = Math.sin(a); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; },
    apply: function (m, p) {
      var x = p[0], y = p[1], z = p[2];
      return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
    }
  };
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function hex(c) { var v = parseInt(c.slice(1), 16); return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]; }

  /* ------------------------------------------------------------ mesh builder
     Every triangle gets its own face normal: that is what gives the crisp,
     faceted low-poly look, and it is free. Parts are placed with a matrix
     stack, so a kart is written as "a box here, a wheel there". */
  function Builder() { this.v = []; this.m = M4.ident(); this.stack = []; }
  var B = Builder.prototype;
  B.push = function (m) { this.stack.push(this.m); this.m = M4.mul(this.m, m); return this; };
  B.pop = function () { this.m = this.stack.pop(); return this; };
  B.tri = function (a, b, c, col) {
    a = M4.apply(this.m, a); b = M4.apply(this.m, b); c = M4.apply(this.m, c);
    var n = norm(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]));
    var k = typeof col === 'string' ? hex(col) : col;
    this.v.push(a[0], a[1], a[2], n[0], n[1], n[2], k[0], k[1], k[2], b[0], b[1], b[2], n[0], n[1], n[2], k[0], k[1], k[2], c[0], c[1], c[2], n[0], n[1], n[2], k[0], k[1], k[2]);
    return this;
  };
  B.quad = function (a, b, c, d, col) { return this.tri(a, b, c, col).tri(a, c, d, col); };
  /* box centred at (x,y,z) with full sizes (w,h,l); top and sides may differ in colour */
  B.box = function (x, y, z, w, h, l, col, top) {
    var a = w / 2, b = h / 2, c = l / 2, t = top || col;
    var p = function (i, j, k) { return [x + i * a, y + j * b, z + k * c]; };
    this.quad(p(-1, 1, -1), p(-1, 1, 1), p(1, 1, 1), p(1, 1, -1), t);       // top
    this.quad(p(-1, -1, 1), p(-1, -1, -1), p(1, -1, -1), p(1, -1, 1), col); // bottom
    this.quad(p(-1, -1, 1), p(1, -1, 1), p(1, 1, 1), p(-1, 1, 1), col);     // +z
    this.quad(p(1, -1, -1), p(-1, -1, -1), p(-1, 1, -1), p(1, 1, -1), col); // -z
    this.quad(p(1, -1, 1), p(1, -1, -1), p(1, 1, -1), p(1, 1, 1), col);     // +x
    this.quad(p(-1, -1, -1), p(-1, -1, 1), p(-1, 1, 1), p(-1, 1, -1), col); // -x
    return this;
  };
  /* cylinder along Y, radius r, height h, base at y */
  B.cyl = function (x, y, z, r, h, col, n, r2, top) {
    n = n || 8; r2 = r2 === undefined ? r : r2;
    for (var i = 0; i < n; i++) {
      var a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      var p0 = [x + Math.cos(a0) * r, y, z + Math.sin(a0) * r], p1 = [x + Math.cos(a1) * r, y, z + Math.sin(a1) * r];
      var q0 = [x + Math.cos(a0) * r2, y + h, z + Math.sin(a0) * r2], q1 = [x + Math.cos(a1) * r2, y + h, z + Math.sin(a1) * r2];
      this.quad(p0, q0, q1, p1, col);
      if (r2 > 0) this.tri([x, y + h, z], q1, q0, top || col);
      this.tri([x, y, z], p0, p1, col);
    }
    return this;
  };
  B.cone = function (x, y, z, r, h, col, n) { return this.cyl(x, y, z, r, h, col, n || 7, 0); };
  /* a low-poly ball: lat-long with few bands */
  B.ball = function (x, y, z, rx, ry, rz, col, bands, segs) {
    bands = bands || 4; segs = segs || 7;
    for (var i = 0; i < bands; i++) for (var j = 0; j < segs; j++) {
      var t0 = i / bands * Math.PI, t1 = (i + 1) / bands * Math.PI, p0 = j / segs * Math.PI * 2, p1 = (j + 1) / segs * Math.PI * 2;
      var P = function (t, p) { return [x + Math.sin(t) * Math.cos(p) * rx, y + Math.cos(t) * ry, z + Math.sin(t) * Math.sin(p) * rz]; };
      if (i === 0) this.tri(P(t0, p0), P(t1, p1), P(t1, p0), col);
      else if (i === bands - 1) this.tri(P(t0, p0), P(t0, p1), P(t1, p0), col);
      else this.quad(P(t0, p0), P(t0, p1), P(t1, p1), P(t1, p0), col);
    }
    return this;
  };
  /* a wheel: a cylinder lying along X */
  B.wheel = function (x, y, z, r, w, col, hub) {
    this.push(M4.mul(M4.trans(x, y, z), M4.rotZ(Math.PI / 2)));
    this.cyl(0, -w / 2, 0, r, w, col, 10);
    this.cyl(0, w / 2, 0, r * .45, .02, hub || '#c9ced4', 10);
    this.cyl(0, -w / 2 - .02, 0, r * .45, .02, hub || '#c9ced4', 10);
    return this.pop();
  };
  B.count = function () { return this.v.length / 9; };

  /* ------------------------------------------------------------ renderer */
  var VS = 'attribute vec3 p;attribute vec3 n;attribute vec3 c;uniform mat4 M;uniform mat4 VP;uniform vec3 L;uniform vec3 E;varying vec3 vc;varying float vd;' +
    'void main(){vec4 w=M*vec4(p,1.0);gl_Position=VP*w;vec3 nn=normalize(mat3(M)*n);float d=max(dot(nn,L),0.0);' +
    'vc=c*(0.74+0.36*d);vd=distance(w.xyz,E);}';
  var FS = 'precision mediump float;varying vec3 vc;varying float vd;uniform vec3 F;uniform vec2 FR;uniform float A;uniform vec3 T;' +
    'void main(){float f=smoothstep(FR.x,FR.y,vd);vec3 col=vc*T;gl_FragColor=vec4(mix(col,F,f),A);}';

  var R = { gl: null, canvas: null, prog: null, loc: {}, VP: null, eye: [0, 0, 0], ok: false };
  function init() {
    if (R.canvas) return R.ok;
    try {
      R.canvas = document.createElement('canvas');
      var gl = R.gl = R.canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
      if (!gl) return (R.ok = false);
      var sh = function (t, s) { var o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
      var p = R.prog = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(p); gl.useProgram(p);
      ['p', 'n', 'c'].forEach(function (k) { R.loc[k] = gl.getAttribLocation(p, k); gl.enableVertexAttribArray(R.loc[k]); });
      ['M', 'VP', 'L', 'E', 'F', 'FR', 'A', 'T'].forEach(function (k) { R.loc[k] = gl.getUniformLocation(p, k); });
      gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      R.ok = true;
    } catch (e) { R.ok = false; }
    return R.ok;
  }
  function upload(b) {
    if (!init()) return { n: b.count(), buf: null };
    var gl = R.gl, buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(b.v), gl.STATIC_DRAW);
    return { n: b.count(), buf: buf };
  }
  function free(m) { if (m && m.buf && R.gl) R.gl.deleteBuffer(m.buf); }
  /* begin a frame: o = {w, h, eye, at, fov, sky, fog:[near, far], sun} */
  function frame(o) {
    if (!init()) return false;
    var gl = R.gl;
    if (R.canvas.width !== o.w || R.canvas.height !== o.h) { R.canvas.width = o.w; R.canvas.height = o.h; }
    gl.viewport(0, 0, o.w, o.h);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var V = M4.look(o.eye, o.at, [0, 1, 0]), P = M4.persp(o.fov || 1.05, o.w / o.h, .5, o.far || 700);
    R.VP = M4.mul(P, V); R.eye = o.eye; R.w = o.w; R.h = o.h;
    gl.uniformMatrix4fv(R.loc.VP, false, R.VP);
    var L = norm(o.sun || [.4, .8, .3]);
    gl.uniform3fv(R.loc.L, L); gl.uniform3fv(R.loc.E, o.eye);
    gl.uniform3fv(R.loc.F, hex(o.sky || '#bfe6f5')); gl.uniform2fv(R.loc.FR, o.fog || [90, 320]);
    gl.uniform1f(R.loc.A, 1); gl.uniform3fv(R.loc.T, [1, 1, 1]);
    return true;
  }
  function draw(m, M, o) {
    if (!m || !m.buf || !R.ok) return;
    var gl = R.gl;
    gl.uniformMatrix4fv(R.loc.M, false, M || M4.ident());
    var a = o && o.alpha !== undefined ? o.alpha : 1;
    gl.uniform1f(R.loc.A, a); gl.uniform3fv(R.loc.T, o && o.tint ? o.tint : [1, 1, 1]);
    if (a < 1) { gl.enable(gl.BLEND); gl.depthMask(false); }
    gl.bindBuffer(gl.ARRAY_BUFFER, m.buf);
    gl.vertexAttribPointer(R.loc.p, 3, gl.FLOAT, false, 36, 0);
    gl.vertexAttribPointer(R.loc.n, 3, gl.FLOAT, false, 36, 12);
    gl.vertexAttribPointer(R.loc.c, 3, gl.FLOAT, false, 36, 24);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
    if (a < 1) { gl.disable(gl.BLEND); gl.depthMask(true); }
  }
  /* world point -> logical screen point (for the 2D overlay: sparks, labels) */
  function project(p, W, H) {
    if (!R.VP) return null;
    var m = R.VP, x = p[0], y = p[1], z = p[2];
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if (cw <= .1) return null;
    return { x: (cx / cw * .5 + .5) * W, y: (1 - (cy / cw * .5 + .5)) * H, s: 1 / cw };
  }

  G.GL = { M4: M4, Builder: Builder, upload: upload, free: free, frame: frame, draw: draw, project: project, init: init, R: R, hex: hex };
})();
