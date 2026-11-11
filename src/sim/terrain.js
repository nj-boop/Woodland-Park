/* Terrain height lookups and habitat shape helpers (tile sets, barrier split, random points inside a habitat). */
/* ---------- building ---------- */
const adjPath = (x, y) => nbr4(idx(x, y)).some(isPath);
/* ---------- terrain heights (tile corners) ---------- */
let HW = W + 1; // corners per row of the height grid
const cIdx = (i, j) => j * HW + i;
function hC(i, j) {
  return S.hgt ? S.hgt[cIdx(clamp(i, 0, W), clamp(j, 0, H))] : 0;
}
function heightAt(x, z) {
  const i = Math.floor(clamp(x, 0, W - 0.0001)),
    j = Math.floor(clamp(z, 0, H - 0.0001)),
    fx = clamp(x - i, 0, 1),
    fz = clamp(z - j, 0, 1);
  return (hC(i, j) * (1 - fx) + hC(i + 1, j) * fx) * (1 - fz) + (hC(i, j + 1) * (1 - fx) + hC(i + 1, j + 1) * fx) * fz;
}
const WATER_Y = -0.1;
// Water is a flag on whole tiles, but its banks should not look like a grid. This sets the height
// of every tile corner that touches water (corners i0..i1, j0..j1) so the shoreline, which is where the
// ground dips under WATER_Y, wanders: deep in the middle, corners of a big pond left dry so they
// are cut off, and each bank corner at its own depth, so the edge bulges out here and pulls in there.
function shapeWater(i0, j0, i1, j1) {
  const wet = (x, y) => inB(x, y) && tileAt(x, y).w,
    around = (i, j) => [
      [i - 1, j - 1],
      [i, j - 1],
      [i - 1, j],
      [i, j],
    ],
    count = (i, j) => around(i, j).filter(([x, y]) => wet(x, y)).length,
    rand = (i, j) => {
      const v = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
  for (let j = Math.max(1, j0); j <= Math.min(H - 1, j1); j++)
    for (let i = Math.max(1, i0); i <= Math.min(W - 1, i1); i++) {
      const n = count(i, j);
      if (!n) continue;
      const k = cIdx(i, j),
        r = rand(i, j);
      if (n === 4) S.hgt[k] = Math.min(S.hgt[k], -0.38);
      else if (n === 3) S.hgt[k] = -0.3;
      else {
        // open water behind this bank? (the far corner of a water tile here is surrounded by water)
        const backed = around(i, j).some(([x, y]) => wet(x, y) && count(2 * x + 1 - i, 2 * y + 1 - j) === 4);
        if (n === 2) S.hgt[k] = backed ? -0.3 + 0.27 * r : -0.3 + 0.13 * r;
        else S.hgt[k] = backed ? -0.04 + 0.07 * r : -0.24 + 0.09 * r;
      }
    }
}
/* ---------- habitat shape helpers (habitats are sets of tiles) ---------- */
function encTiles(e) {
  return (F.etiles && F.etiles[e.id]) || [];
}
function inEnc(e, x, y) {
  return inB(x, y) && tileAt(x, y).e === e.id;
}
function encMid(e) {
  return e.w >= e.h ? { ax: 'x', m: e.x + Math.floor(e.w / 2) } : { ax: 'y', m: e.y + Math.floor(e.h / 2) };
}
function sideOK(e, a, x, y) {
  if (!e.barrier) return true;
  const mm = encMid(e),
    v = mm.ax === 'x' ? x : y;
  return SPECIES[a.sp].pred ? v < mm.m : v >= mm.m;
}
function randPointIn(e, a, blockedFn) {
  const ts = encTiles(e);
  for (let k = 0; k < 30; k++) {
    const i = ts[(Math.random() * ts.length) | 0];
    if (i == null) break;
    const tx = i % W,
      ty = (i / W) | 0;
    const px = tx + rnd(inEnc(e, tx - 1, ty) ? 0.08 : 0.35, inEnc(e, tx + 1, ty) ? 0.92 : 0.65),
      py = ty + rnd(inEnc(e, tx, ty - 1) ? 0.08 : 0.4, inEnc(e, tx, ty + 1) ? 0.92 : 0.6);
    if (a && !sideOK(e, a, px, py)) continue;
    if (blockedFn && blockedFn(px, py)) continue;
    return [px, py];
  }
  return [e.x + e.w / 2, e.y + e.h / 2];
}
function poolNear(x, y) {
  for (const n of nbr4(idx(x, y))) {
    const e = S.tiles[n].e;
    if (e && F.emap[e] && F.emap[e].biome === 'pool') return F.emap[e];
  }
  return null;
}
const isGate = (x, y) => hasEntrance() && ((x === GATE.x && y === GATE.y) || (x === GATE.ox && y === GATE.oy));
