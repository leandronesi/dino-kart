/* A software canvas-2d, enough of it to draw Dino Kart, writing out a PNG.

   Why this exists: every check on this game so far has been numeric. It can
   pass forty assertions about speed, position and lap count and still be
   unplayable, because nothing was ever looking at the screen. This rasterises
   the real draw calls so a frame can actually be looked at.

   Supersamples 2x and box-filters down, so edges are not a staircase. */
'use strict';
const zlib = require('zlib');

const SS = 2;

/* ------------------------------------------------------------------ colour */
const NAMED = { white: [255, 255, 255, 1], black: [0, 0, 0, 1], transparent: [0, 0, 0, 0] };
const colCache = new Map();
function parseColor(s) {
  if (typeof s !== 'string') return [255, 0, 255, 1];
  if (colCache.has(s)) return colCache.get(s);
  let out = [255, 0, 255, 1];
  const t = s.trim().toLowerCase();
  if (NAMED[t]) out = NAMED[t].slice();
  else if (t[0] === '#') {
    const h = t.slice(1);
    if (h.length === 3) out = [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    else if (h.length === 6) out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    else if (h.length === 8) out = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16) / 255];
  } else {
    const m = /^rgba?\(([^)]+)\)$/.exec(t);
    if (m) {
      const p = m[1].split(',').map((v) => parseFloat(v));
      out = [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? p[3] : 1];
    }
  }
  colCache.set(s, out);
  return out;
}

/* ------------------------------------------------------------------- font */
/* A 5x7 bitmap, scaled to whatever size is asked for. Not pretty, but it means
   the HUD can be READ in the dump instead of guessed at from grey boxes. */
const GLYPHS = {
  '0': '01110 10001 10011 10101 11001 10001 01110',
  '1': '00100 01100 00100 00100 00100 00100 01110',
  '2': '01110 10001 00001 00010 00100 01000 11111',
  '3': '11111 00010 00100 00010 00001 10001 01110',
  '4': '00010 00110 01010 10010 11111 00010 00010',
  '5': '11111 10000 11110 00001 00001 10001 01110',
  '6': '00110 01000 10000 11110 10001 10001 01110',
  '7': '11111 00001 00010 00100 01000 01000 01000',
  '8': '01110 10001 10001 01110 10001 10001 01110',
  '9': '01110 10001 10001 01111 00001 00010 01100',
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01110 10001 10000 10000 10000 10001 01110',
  D: '11100 10010 10001 10001 10001 10010 11100',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01110 10001 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '01110 00100 00100 00100 00100 00100 01110',
  J: '00111 00010 00010 00010 00010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 11011 10001',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  '/': '00001 00010 00010 00100 01000 01000 10000',
  ':': '00000 00100 00100 00000 00100 00100 00000',
  '.': '00000 00000 00000 00000 00000 00110 00110',
  ',': '00000 00000 00000 00000 00110 00110 01100',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '!': '00100 00100 00100 00100 00100 00000 00100',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  "'": '00100 00100 01000 00000 00000 00000 00000',
  '"': '01010 01010 00000 00000 00000 00000 00000',
  'º': '01100 10010 01100 00000 00000 00000 00000',
  '°': '01100 10010 01100 00000 00000 00000 00000',
  '+': '00000 00100 00100 11111 00100 00100 00000',
  '(': '00010 00100 01000 01000 01000 00100 00010',
  ')': '01000 00100 00010 00010 00010 00100 01000',
  ' ': '00000 00000 00000 00000 00000 00000 00000'
};
const GLYPH_ROWS = {};
Object.keys(GLYPHS).forEach((k) => { GLYPH_ROWS[k] = GLYPHS[k].split(' '); });
const CH_W = 5, CH_H = 7, CH_GAP = 1;

/* ------------------------------------------------------------------ canvas */
function makeSurface(w, h) {
  const W = w * SS, H = h * SS;
  const buf = new Float32Array(W * H * 3);
  return { W, H, w, h, buf };
}

function mul(m, n) {                       // m then n  (n applied after)
  return [
    m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]
  ];
}
function apply(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }

function Ctx(surf) {
  this.s = surf;
  this.m = [SS, 0, 0, SS, 0, 0];
  this.stack = [];
  this.path = [];                          // list of subpaths, each list of [x,y] in device space
  this.cur = null;
  this.fillStyle = '#000';
  this.strokeStyle = '#000';
  this.lineWidth = 1;
  this.globalAlpha = 1;
  this.lineJoin = 'miter';
  this.lineCap = 'butt';
  this.font = '32px sans';
  this.textAlign = 'center';
  this.textBaseline = 'middle';
  this.shadowBlur = 0; this.shadowColor = 'transparent';
  this.shadowOffsetX = 0; this.shadowOffsetY = 0;
  this.canvas = { width: surf.W, height: surf.H };
  this.ops = 0;
}

Ctx.prototype.save = function () {
  this.stack.push({
    m: this.m.slice(), fillStyle: this.fillStyle, strokeStyle: this.strokeStyle,
    lineWidth: this.lineWidth, globalAlpha: this.globalAlpha, font: this.font,
    textAlign: this.textAlign, textBaseline: this.textBaseline,
    lineJoin: this.lineJoin, lineCap: this.lineCap
  });
};
Ctx.prototype.restore = function () {
  const s = this.stack.pop();
  if (!s) return;
  Object.keys(s).forEach((k) => { this[k] = s[k]; });
};
Ctx.prototype.translate = function (x, y) { this.m = mul([1, 0, 0, 1, x, y], this.m); };
Ctx.prototype.scale = function (x, y) { this.m = mul([x, 0, 0, y, 0, 0], this.m); };
Ctx.prototype.rotate = function (a) {
  const c = Math.cos(a), s = Math.sin(a);
  this.m = mul([c, s, -s, c, 0, 0], this.m);
};
Ctx.prototype.setTransform = function (a, b, c, d, e, f) { this.m = mul([a, b, c, d, e, f], [SS, 0, 0, SS, 0, 0]); };
Ctx.prototype.getTransform = function () { return { a: this.m[0], b: this.m[1], c: this.m[2], d: this.m[3], e: this.m[4], f: this.m[5] }; };
Ctx.prototype.resetTransform = function () { this.m = [SS, 0, 0, SS, 0, 0]; };

Ctx.prototype.beginPath = function () { this.path = []; this.cur = null; };
Ctx.prototype.moveTo = function (x, y) { this.cur = [apply(this.m, x, y)]; this.path.push(this.cur); this._ux = x; this._uy = y; };
Ctx.prototype.lineTo = function (x, y) {
  if (!this.cur) return this.moveTo(x, y);
  this.cur.push(apply(this.m, x, y)); this._ux = x; this._uy = y;
};
Ctx.prototype.closePath = function () { if (this.cur && this.cur.length) this.cur.closed = true; };

Ctx.prototype.quadraticCurveTo = function (cx, cy, x, y) {
  const x0 = this._ux, y0 = this._uy;
  for (let i = 1; i <= 12; i++) {
    const t = i / 12, u = 1 - t;
    this.lineTo(u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y);
  }
};
Ctx.prototype.bezierCurveTo = function (c1x, c1y, c2x, c2y, x, y) {
  const x0 = this._ux, y0 = this._uy;
  for (let i = 1; i <= 16; i++) {
    const t = i / 16, u = 1 - t;
    this.lineTo(u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
      u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y);
  }
};
Ctx.prototype.arc = function (x, y, r, a0, a1, ccw) {
  let span = a1 - a0;
  if (!ccw && span < 0) span += Math.PI * 2;
  if (ccw && span > 0) span -= Math.PI * 2;
  const n = Math.max(6, Math.min(96, Math.ceil(Math.abs(span) / 0.12)));
  for (let i = 0; i <= n; i++) {
    const a = a0 + span * (i / n);
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
    if (i === 0 && !this.cur) this.moveTo(px, py); else this.lineTo(px, py);
  }
};
Ctx.prototype.ellipse = function (x, y, rx, ry, rot, a0, a1, ccw) {
  let span = a1 - a0;
  if (!ccw && span < 0) span += Math.PI * 2;
  if (ccw && span > 0) span -= Math.PI * 2;
  const n = Math.max(8, Math.min(96, Math.ceil(Math.abs(span) / 0.12)));
  const cr = Math.cos(rot || 0), sr = Math.sin(rot || 0);
  for (let i = 0; i <= n; i++) {
    const a = a0 + span * (i / n);
    const ex = Math.cos(a) * rx, ey = Math.sin(a) * ry;
    const px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
    if (i === 0 && !this.cur) this.moveTo(px, py); else this.lineTo(px, py);
  }
};
Ctx.prototype.arcTo = function (x1, y1, x2, y2, r) {
  /* Good enough for rounded rectangles, which is all the game uses it for. */
  const x0 = this._ux, y0 = this._uy;
  const a = Math.atan2(y0 - y1, x0 - x1), b = Math.atan2(y2 - y1, x2 - x1);
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  const half = Math.abs(d) / 2;
  const tan = r / Math.tan(half === 0 ? 1e-6 : half);
  const l0 = Math.hypot(x0 - x1, y0 - y1), l1 = Math.hypot(x2 - x1, y2 - y1);
  const t = Math.min(tan, l0, l1);
  const ax = x1 + (x0 - x1) / (l0 || 1) * t, ay = y1 + (y0 - y1) / (l0 || 1) * t;
  const bx = x1 + (x2 - x1) / (l1 || 1) * t, by = y1 + (y2 - y1) / (l1 || 1) * t;
  this.lineTo(ax, ay);
  for (let i = 1; i <= 6; i++) {
    const u = i / 6, v = 1 - u;
    this.lineTo(v * v * ax + 2 * v * u * x1 + u * u * bx, v * v * ay + 2 * v * u * y1 + u * u * by);
  }
};
Ctx.prototype.rect = function (x, y, w, h) {
  this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h); this.closePath();
};
Ctx.prototype.roundRect = function (x, y, w, h, r) { this.rect(x, y, w, h); void r; };

/* ------------------------------------------------------------- gradients */
function Gradient(kind, coords, m) { this.kind = kind; this.coords = coords; this.m = m.slice(); this.stops = []; }
Gradient.prototype.addColorStop = function (o, c) { this.stops.push([o, parseColor(c)]); this.stops.sort((a, b) => a[0] - b[0]); };
Gradient.prototype.at = function (t) {
  const s = this.stops;
  if (!s.length) return [255, 0, 255, 1];
  if (t <= s[0][0]) return s[0][1];
  if (t >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 1; i < s.length; i++) {
    if (t <= s[i][0]) {
      const a = s[i - 1], b = s[i];
      const u = (t - a[0]) / ((b[0] - a[0]) || 1);
      return [a[1][0] + (b[1][0] - a[1][0]) * u, a[1][1] + (b[1][1] - a[1][1]) * u,
        a[1][2] + (b[1][2] - a[1][2]) * u, a[1][3] + (b[1][3] - a[1][3]) * u];
    }
  }
  return s[s.length - 1][1];
};
Ctx.prototype.createLinearGradient = function (x0, y0, x1, y1) { return new Gradient('linear', [x0, y0, x1, y1], this.m); };
Ctx.prototype.createRadialGradient = function (x0, y0, r0, x1, y1, r1) { return new Gradient('radial', [x0, y0, r0, x1, y1, r1], this.m); };
Ctx.prototype.createPattern = function () { return { setTransform: () => {} }; };
Ctx.prototype.createConicGradient = function () { return new Gradient('linear', [0, 0, 0, 1], this.m); };

/* ------------------------------------------------------------------ paint */
Ctx.prototype._blend = function (x, y, col, a) {
  if (a <= 0) return;
  if (a > 1) a = 1;
  const i = (y * this.s.W + x) * 3;
  const b = this.s.buf;
  b[i] += (col[0] - b[i]) * a;
  b[i + 1] += (col[1] - b[i + 1]) * a;
  b[i + 2] += (col[2] - b[i + 2]) * a;
};

/* Scanline nonzero fill of the current path (already in device space). */
Ctx.prototype._fillPolys = function (polys, style) {
  if (this.off) return;                    // frames we are not capturing cost nothing
  const S = this.s;
  const grad = style instanceof Gradient ? style : null;
  const flat = grad ? null : parseColor(style);
  const ga = this.globalAlpha;
  if (!grad && flat[3] * ga <= 0.002) return;

  const edges = [];
  let ymin = Infinity, ymax = -Infinity, xmin = Infinity, xmax = -Infinity;
  polys.forEach((p) => {
    const n = p.length;
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const a = p[i], b = p[(i + 1) % n];
      if (i === n - 1 && !p.closed && n > 2) { /* implicit close for fill */ }
      if (a[1] === b[1]) continue;
      edges.push([a[0], a[1], b[0], b[1]]);
      if (a[1] < ymin) ymin = a[1]; if (a[1] > ymax) ymax = a[1];
      if (a[0] < xmin) xmin = a[0]; if (a[0] > xmax) xmax = a[0];
      if (b[1] < ymin) ymin = b[1]; if (b[1] > ymax) ymax = b[1];
      if (b[0] < xmin) xmin = b[0]; if (b[0] > xmax) xmax = b[0];
    }
  });
  if (!edges.length) return;
  let y0 = Math.max(0, Math.floor(ymin)), y1 = Math.min(S.H - 1, Math.ceil(ymax));
  if (y1 < y0 || xmax < 0 || xmin > S.W) return;
  this.ops++;

  let gm = null, gc = null;
  if (grad) {
    gm = grad.m;
    if (grad.kind === 'linear') {
      const p0 = apply(gm, grad.coords[0], grad.coords[1]);
      const p1 = apply(gm, grad.coords[2], grad.coords[3]);
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1];
      const len2 = dx * dx + dy * dy || 1;
      gc = { p0, dx, dy, len2 };
    } else {
      const p1 = apply(gm, grad.coords[3], grad.coords[4]);
      const r1 = grad.coords[5] * Math.hypot(gm[0], gm[1]);
      gc = { cx: p1[0], cy: p1[1], r: r1 || 1 };
    }
  }

  const xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5;
    xs.length = 0;
    for (let e = 0; e < edges.length; e++) {
      const [ax, ay, bx, by] = edges[e];
      if ((sy >= ay && sy < by) || (sy >= by && sy < ay)) {
        const t = (sy - ay) / (by - ay);
        xs.push([ax + (bx - ax) * t, by > ay ? 1 : -1]);
      }
    }
    if (xs.length < 2) continue;
    xs.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      wind += xs[i][1];
      if (wind === 0) continue;
      let sx = Math.max(0, Math.ceil(xs[i][0] - 0.5));
      let ex = Math.min(S.W - 1, Math.floor(xs[i + 1][0] - 0.5));
      for (let x = sx; x <= ex; x++) {
        if (grad) {
          let t;
          if (grad.kind === 'linear') {
            t = ((x + 0.5 - gc.p0[0]) * gc.dx + (y + 0.5 - gc.p0[1]) * gc.dy) / gc.len2;
          } else {
            t = Math.hypot(x + 0.5 - gc.cx, y + 0.5 - gc.cy) / gc.r;
          }
          const c = grad.at(Math.max(0, Math.min(1, t)));
          this._blend(x, y, c, c[3] * ga);
        } else {
          this._blend(x, y, flat, flat[3] * ga);
        }
      }
    }
  }
};

Ctx.prototype.fill = function () { this._fillPolys(this.path, this.fillStyle); };

Ctx.prototype.stroke = function () {
  const lw = Math.max(0.6, this.lineWidth * Math.hypot(this.m[0], this.m[1]));
  const half = lw / 2;
  const quads = [];
  this.path.forEach((p) => {
    const n = p.length;
    const last = p.closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = p[i], b = p[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const nx = -dy / len * half, ny = dx / len * half;
      quads.push([[a[0] + nx, a[1] + ny], [b[0] + nx, b[1] + ny], [b[0] - nx, b[1] - ny], [a[0] - nx, a[1] - ny]]);
    }
    // round joins so corners are not chipped
    if (lw > 2.5) {
      for (let i = 0; i < n; i++) {
        const c = [];
        for (let k = 0; k < 10; k++) {
          const a = k / 10 * Math.PI * 2;
          c.push([p[i][0] + Math.cos(a) * half, p[i][1] + Math.sin(a) * half]);
        }
        quads.push(c);
      }
    }
  });
  quads.forEach((q) => this._fillPolys([q], this.strokeStyle));
};

Ctx.prototype.fillRect = function (x, y, w, h) {
  const save = this.path, sc = this.cur;
  this.beginPath(); this.rect(x, y, w, h);
  this._fillPolys(this.path, this.fillStyle);
  this.path = save; this.cur = sc;
};
Ctx.prototype.strokeRect = function (x, y, w, h) {
  const save = this.path, sc = this.cur;
  this.beginPath(); this.rect(x, y, w, h); this.stroke();
  this.path = save; this.cur = sc;
};
Ctx.prototype.clearRect = function () {};
Ctx.prototype.clip = function () {};
Ctx.prototype.setLineDash = function () {};
Ctx.prototype.getLineDash = function () { return []; };
Ctx.prototype.isPointInPath = function () { return false; };
Ctx.prototype.isPointInStroke = function () { return false; };
Ctx.prototype.drawImage = function () {};
Ctx.prototype.getImageData = function () { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; };
Ctx.prototype.putImageData = function () {};

/* -------------------------------------------------------------------- text */
function fontSize(f) { const m = /(\d+(?:\.\d+)?)px/.exec(f || ''); return m ? parseFloat(m[1]) : 32; }
Ctx.prototype.measureText = function (s) {
  const px = fontSize(this.font);
  const w = String(s).length * (CH_W + CH_GAP) * (px / CH_H) * 0.62;
  return { width: w, actualBoundingBoxAscent: px * 0.5, actualBoundingBoxDescent: px * 0.2 };
};
Ctx.prototype._drawText = function (str, x, y, maxw, style) {
  str = String(str);
  const px = fontSize(this.font);
  let unit = px / CH_H * 0.78;                       // pixel size of one font cell
  let w = str.length * (CH_W + CH_GAP) * unit;
  if (maxw && w > maxw) { unit *= maxw / w; w = maxw; }
  const h = CH_H * unit;
  let ox = x;
  if (this.textAlign === 'center') ox = x - w / 2;
  else if (this.textAlign === 'right' || this.textAlign === 'end') ox = x - w;
  let oy = y;
  if (this.textBaseline === 'middle') oy = y - h / 2;
  else if (this.textBaseline === 'alphabetic' || this.textBaseline === 'bottom') oy = y - h;

  const save = this.path, sc = this.cur, sf = this.fillStyle;
  this.fillStyle = style;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i].toUpperCase();
    const rows = GLYPH_ROWS[ch] || GLYPH_ROWS[str[i]] || null;
    const cx = ox + i * (CH_W + CH_GAP) * unit;
    if (!rows) {                                     // unknown glyph: a solid block
      this.fillRect(cx, oy + unit, CH_W * unit, (CH_H - 2) * unit);
      continue;
    }
    for (let r = 0; r < CH_H; r++) {
      const row = rows[r];
      let c = 0;
      while (c < CH_W) {
        if (row[c] === '1') {
          let run = 1;
          while (c + run < CH_W && row[c + run] === '1') run++;
          this.fillRect(cx + c * unit, oy + r * unit, run * unit, unit);
          c += run;
        } else c++;
      }
    }
  }
  this.fillStyle = sf; this.path = save; this.cur = sc;
};
Ctx.prototype.fillText = function (s, x, y, maxw) { this._drawText(s, x, y, maxw, this.fillStyle); };
Ctx.prototype.strokeText = function () { /* the outline pass: skipped, it only fattens */ };

/* --------------------------------------------------------------------- PNG */
function crc32(buf) {
  let c, t = crc32.t;
  if (!t) {
    t = crc32.t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
  }
  c = -1;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function writePNG(surf, file) {
  const { W, H, w, h, buf } = surf;
  const raw = Buffer.alloc(h * (w * 3 + 1));
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0;
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 3;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
        }
      }
      const n = SS * SS;
      raw[p++] = Math.max(0, Math.min(255, Math.round(r / n)));
      raw[p++] = Math.max(0, Math.min(255, Math.round(g / n)));
      raw[p++] = Math.max(0, Math.min(255, Math.round(b / n)));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  require('fs').writeFileSync(file, png);
  return png.length;
}

module.exports = { makeSurface, Ctx, writePNG, SS };
