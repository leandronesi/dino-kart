#!/usr/bin/env node
/* Generates the PWA icons as real PNGs — no dependencies, no image editor.
   A tiny shape rasterizer (3x3 supersampled) plus a minimal PNG encoder.
   `node make-icons.js` */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

/* ------------------------------------------------------------------ PNG */
let CRC_T = null;
function crcTable() {
  if (CRC_T) return CRC_T;
  CRC_T = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    CRC_T[n] = c;
  }
  return CRC_T;
}
function crc32(buf) {
  const t = crcTable();
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = t[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const stride = w * 4;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;                       // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* -------------------------------------------------------------- shapes */
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];

const ell = (cx, cy, rx, ry, c) => ({ c, hit: (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, grow: (k) => ell(cx, cy, rx + k, ry + k, c) });
const circ = (cx, cy, r, c) => ell(cx, cy, r, r, c);
const rrect = (x, y, w, h, r, c) => ({
  c,
  hit: (px, py) => {
    if (px < x || px > x + w || py < y || py > y + h) return false;
    const qx = Math.max(x + r - px, 0, px - (x + w - r));
    const qy = Math.max(y + r - py, 0, py - (y + h - r));
    return qx * qx + qy * qy <= r * r;
  },
  grow: (k) => rrect(x - k, y - k, w + 2 * k, h + 2 * k, r + k, c)
});
function tri(p, c) {
  const sign = (ax, ay, bx, by, cx, cy) => (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  return {
    c,
    hit: (x, y) => {
      const d1 = sign(x, y, p[0][0], p[0][1], p[1][0], p[1][1]);
      const d2 = sign(x, y, p[1][0], p[1][1], p[2][0], p[2][1]);
      const d3 = sign(x, y, p[2][0], p[2][1], p[0][0], p[0][1]);
      const neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
      return !(neg && pos);
    },
    grow: (k) => {
      const gx = (p[0][0] + p[1][0] + p[2][0]) / 3, gy = (p[0][1] + p[1][1] + p[2][1]) / 3;
      const f = 1 + k / 22;
      return tri(p.map(([px, py]) => [gx + (px - gx) * f, gy + (py - gy) * f]), c);
    }
  };
}
function starShape(cx, cy, r, c) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * 0.46 : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const inside = (x, y) => {
    let ins = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
    }
    return ins;
  };
  return { c, hit: inside, grow: (k) => starShape(cx, cy, r + k, c) };
}

const OUTLINE = '#173d24';

/* the dino, in a 512x512 design space (mirrors icon.svg) */
const BODY = [
  tri([[150, 330], [88, 264], [154, 254]], '#3fae76'),        // tail
  tri([[262, 152], [286, 106], [308, 154]], '#2f8f4e'),       // back spike
  tri([[312, 134], [338, 90], [356, 140]], '#2f8f4e'),        // head spike
  rrect(194, 362, 50, 76, 24, '#3aa06e'),                     // back leg
  rrect(278, 362, 50, 76, 24, '#3aa06e'),                     // front leg
  ell(250, 314, 114, 82, '#4fc086'),                          // body
  circ(330, 210, 90, '#5fd093')                               // head
];
const DETAIL = [
  ell(252, 342, 76, 48, '#f6e7c1'),                           // belly
  ell(374, 238, 46, 34, '#f6e7c1'),                           // snout
  circ(352, 186, 31, OUTLINE),
  circ(352, 186, 25, '#fffdf6'),
  circ(358, 189, 12, '#22331f'),
  circ(363, 183, 5, '#ffffff'),
  circ(393, 235, 7, OUTLINE),
  starShape(106, 132, 48, '#c8901c'),
  starShape(106, 132, 42, '#ffd75e'),
  circ(432, 122, 30, OUTLINE),
  circ(432, 122, 24, '#e8536b'),
  circ(424, 114, 8, '#ff93a5')
];

function render(size, maskable) {
  const S = 3;                                                 // supersampling
  const out = Buffer.alloc(size * size * 4);
  const scale = (maskable ? 0.74 : 0.92) * size / 512;
  const off = (size - 512 * scale) / 2;
  const outlined = BODY.map((s) => s.grow(10));
  const bgTop = hex('#4bb872'), bgBot = hex('#164d2b');

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const fx = px + (sx + 0.5) / S, fy = py + (sy + 0.5) / S;
          const t = fy / size;
          let col = [
            Math.round(bgTop[0] + (bgBot[0] - bgTop[0]) * t),
            Math.round(bgTop[1] + (bgBot[1] - bgTop[1]) * t),
            Math.round(bgTop[2] + (bgBot[2] - bgTop[2]) * t)
          ];
          const x = (fx - off) / scale, y = (fy - off) / scale;
          for (const s of outlined) if (s.hit(x, y)) { col = hex(OUTLINE); break; }
          for (const s of BODY) if (s.hit(x, y)) col = hex(s.c);
          for (const s of DETAIL) if (s.hit(x, y)) col = hex(s.c);
          r += col[0]; g += col[1]; b += col[2];
        }
      }
      const n = S * S, i = (py * size + px) * 4;
      out[i] = Math.round(r / n); out[i + 1] = Math.round(g / n); out[i + 2] = Math.round(b / n); out[i + 3] = 255;
    }
  }
  return encodePNG(size, size, out);
}

const jobs = [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true]
];
for (const [name, size, mask] of jobs) {
  const buf = render(size, mask);
  fs.writeFileSync(path.join(__dirname, name), buf);
  console.log('wrote ' + name + '  ' + size + 'x' + size + '  ' + (buf.length / 1024).toFixed(1) + ' kB');
}
