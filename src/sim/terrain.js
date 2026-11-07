/* Terrain height lookups and habitat shape helpers (tile sets, barrier split, random points inside a habitat). */
/* ---------- building ---------- */
const adjPath = (x, y) => nbr4(idx(x, y)).some(isPath);
/* ---------- terrain heights (tile corners) ---------- */
const HW = W + 1;
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
const isGate = (x, y) => x === GATE.x && y === GATE.y;
