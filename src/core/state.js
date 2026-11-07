/* Small helpers (clamp, random, money format, hashing) and the shared mutable game state. */

const $ = (s) => document.querySelector(s);
const cv = $('#cv');
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const idx = (x, y) => y * W + x;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function hsh(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

let S,
  tool = 'look',
  sub = null,
  speed = 1,
  sel = null;
let view = { w: 1, h: 1 };
let sellArm = null,
  F = {},
  dirty = true,
  hover = null,
  drag = null,
  demolishArm = null;
