/* Buildings that cover more than one tile. Every tile under a building stores the building's kind in `o`
   and the index of its anchor (top-left) tile in `a`; the anchor also stores the facing `r`
   (0 = front faces down the map, 1 = right, 2 = up, 3 = left). One tile is about 3 m across. */

let buildRot = null; // null = face the nearest path automatically; 0–3 after the player rotates

const sizeOf = (kind) => (ITEMS[kind] && ITEMS[kind].size) || [1, 1];
// footprint width and height on the map for a facing
function fpDims(kind, r) {
  const [w, d] = sizeOf(kind);
  return r % 2 ? [d, w] : [w, d];
}
// the footprint is centred on the tile under the cursor
function fpOrigin(kind, x, y, r) {
  const [fw, fh] = fpDims(kind, r);
  return [x - Math.floor((fw - 1) / 2), y - Math.floor((fh - 1) / 2)];
}
function fpTiles(x0, y0, fw, fh) {
  const out = [];
  for (let j = y0; j < y0 + fh; j++) for (let i = x0; i < x0 + fw; i++) out.push(inB(i, j) ? idx(i, j) : -1);
  return out;
}
// tiles just outside the front of a footprint (where the door is)
function frontTiles(x0, y0, fw, fh, r) {
  const out = [];
  if (r === 0) for (let i = x0; i < x0 + fw; i++) out.push([i, y0 + fh]);
  if (r === 2) for (let i = x0; i < x0 + fw; i++) out.push([i, y0 - 1]);
  if (r === 1) for (let j = y0; j < y0 + fh; j++) out.push([x0 + fw, j]);
  if (r === 3) for (let j = y0; j < y0 + fh; j++) out.push([x0 - 1, j]);
  return out.filter(([i, j]) => inB(i, j)).map(([i, j]) => idx(i, j));
}
const frontOnPath = (x0, y0, fw, fh, r) => frontTiles(x0, y0, fw, fh, r).some((i) => S.tiles[i].t === 'p');
// does this facing work? Guest and staff buildings open onto a path; a show stadium faces its tank
function frontOK(kind, p) {
  if (kind === 'stage')
    return frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).some((i) => {
      const e = S.tiles[i].e;
      return e && F.emap[e] && F.emap[e].biome === 'pool';
    });
  if (ITEMS[kind].kind === 'decor') return true;
  return frontOnPath(p.x0, p.y0, p.fw, p.fh, p.r);
}

// candidate placements for a building at the cursor: just the player's rotation if they set one,
// otherwise every facing (checkBuilding picks the first that fits)
function fpPlans(kind, x, y) {
  return (buildRot != null ? [buildRot] : [0, 1, 2, 3]).map((r) => {
    const [x0, y0] = fpOrigin(kind, x, y, r),
      [fw, fh] = fpDims(kind, r);
    return { r, x0, y0, fw, fh, tiles: fpTiles(x0, y0, fw, fh) };
  });
}
function stampBuilding(kind, p) {
  const a = idx(p.x0, p.y0);
  for (const i of p.tiles) {
    S.tiles[i].o = kind;
    S.tiles[i].a = a;
  }
  S.tiles[a].r = p.r;
}
const anchorOf = (i) => (S.tiles[i].a != null ? S.tiles[i].a : i);
const isAnchor = (i) => !!S.tiles[i].o && anchorOf(i) === i;
// all tiles of the building covering tile i
function buildingTiles(i) {
  const a = anchorOf(i),
    kind = S.tiles[a].o,
    [fw, fh] = fpDims(kind, S.tiles[a].r || 0);
  return fpTiles(a % W, (a / W) | 0, fw, fh).filter((k) => k >= 0 && S.tiles[k].o === kind && anchorOf(k) === a);
}
function clearBuilding(i) {
  for (const k of buildingTiles(i)) {
    S.tiles[k].o = null;
    delete S.tiles[k].a;
    delete S.tiles[k].r;
  }
}
// the anchor plan of an existing building, for drawing it
function planOf(a) {
  const t = S.tiles[a],
    r = t.r || 0,
    [fw, fh] = fpDims(t.o, r);
  return { r, x0: a % W, y0: (a / W) | 0, fw, fh };
}

// placement check for a building bigger than one tile; returns a check() result with the plan attached
function checkBuilding(kind, x, y) {
  let firstFail = null;
  for (const p of fpPlans(kind, x, y)) {
    const c = checkPlan(kind, p);
    if (c.ok) return c;
    // report the most useful problem: one from a facing that would have opened the right way
    if (!firstFail || (firstFail.facing === false && c.facing !== false)) firstFail = c;
  }
  return firstFail;
}
function checkPlan(kind, p) {
  const it = ITEMS[kind],
    nm = it.name.toLowerCase(),
    facing = frontOK(kind, p);
  const fail = (msg) => ({ ok: false, msg, plan: p, facing });
  for (const i of p.tiles) {
    if (i < 0) return fail('That runs off the edge of the map.');
    const t = S.tiles[i];
    if (t.t === 'p') return fail(`The ${nm} needs ${p.fw}×${p.fh} tiles of open ground, off the path.`);
    if (t.w) return fail('Part of that spot is under water.');
    if (t.e)
      return fail(
        kind === 'stage' ? 'Build the stadium beside the tank, not in it.' : `The ${nm} has to go outside habitats.`
      );
    if (t.o) return fail(`Something is in the way. The ${nm} needs ${p.fw}×${p.fh} clear tiles.`);
  }
  if (!facing)
    return fail(
      kind === 'stage'
        ? 'The stadium seats have to face an aquatic habitat.'
        : buildRot != null
          ? `The ${nm}'s door has to open onto a path. Press R (or ⟳ in the menu) to turn it.`
          : `The ${nm} has to sit with one side along a path.`
    );
  if (kind === 'stage' && !p.tiles.some((i) => nbr4(i).some((n) => S.tiles[n].t === 'p')))
    return fail('Guests need a path to reach the stadium.');
  return { ok: true, cost: it.cost, plan: p };
}
