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

// candidate placements for a building at the cursor, best first:
//  - facings: the player's choice if they turned it, otherwise facing the nearest path first
//  - positions: centred on the cursor, then nudged up to 3 tiles so the door side sits flush on a path
let lastPlan = null; // keeps the facing steady while the cursor moves a little
function nearestPathDir(x, y) {
  let best = null;
  for (let d = 1; d <= 6 && !best; d++)
    for (let r = 0; r < 4 && !best; r++) {
      const [dx, dy] = [
        [0, 1],
        [1, 0],
        [0, -1],
        [-1, 0],
      ][r];
      if (inB(x + dx * d, y + dy * d) && S.tiles[idx(x + dx * d, y + dy * d)].t === 'p') best = r;
    }
  return best;
}
function fpPlans(kind, x, y) {
  let order;
  if (buildRot != null) order = [buildRot];
  else {
    const near = kind === 'stage' ? null : nearestPathDir(x, y);
    order = [0, 1, 2, 3];
    if (near != null) order = [near, ...order.filter((r) => r !== near)];
    if (lastPlan && lastPlan.kind === kind) order = [lastPlan.r, ...order.filter((r) => r !== lastPlan.r)];
  }
  const shifts = [[0, 0]];
  for (let d = 1; d <= 3; d++)
    for (const [sx, sy] of [
      [0, d],
      [d, 0],
      [0, -d],
      [-d, 0],
      [d, d],
      [-d, d],
      [d, -d],
      [-d, -d],
    ])
      shifts.push([sx, sy]);
  const out = [];
  for (const r of order)
    for (const [sx, sy] of shifts) {
      const [ox, oy] = fpOrigin(kind, x, y, r),
        [fw, fh] = fpDims(kind, r),
        x0 = ox + sx,
        y0 = oy + sy;
      out.push({ r, x0, y0, fw, fh, tiles: fpTiles(x0, y0, fw, fh), shifted: sx || sy });
    }
  return out;
}
function stampBuilding(kind, p) {
  const a = idx(p.x0, p.y0);
  for (const i of p.tiles) if (S.tiles[i].o && clearable(S.tiles[i].o)) S.tiles[i].o = null;
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
    if (c.ok) {
      lastPlan = { kind, r: p.r };
      return c;
    }
    // report the most useful problem: from the unshifted plan, preferring one that faced the right way
    if (!p.shifted && (!firstFail || (firstFail.facing === false && c.facing !== false))) firstFail = c;
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
    if (t.o && !clearable(t.o)) return fail(`Something is in the way. The ${nm} needs ${p.fw}×${p.fh} clear tiles.`);
  }
  if (!facing)
    return fail(
      kind === 'stage'
        ? 'The stadium seats have to face an aquatic habitat.'
        : buildRot != null
          ? `The ${nm}'s door has to open onto a path. Press R (or ⟳ in the menu) to turn it.`
          : `Move closer to a path: the ${nm}'s door side has to open onto one.`
    );
  if (kind === 'stage' && !p.tiles.some((i) => nbr4(i).some((n) => S.tiles[n].t === 'p')))
    return fail('Guests need a path to reach the stadium.');
  const clears = p.tiles.filter((i) => S.tiles[i].o).length;
  return { ok: true, cost: it.cost, plan: p, clears };
}
// trees, shrubs and rocks outside habitats are cleared to make room for a building
const clearable = (o) => ITEMS[o] && ITEMS[o].kind === 'plant' && o !== 'pond';
