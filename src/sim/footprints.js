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
/* A crossing is a bridge where a road and a footpath meet: one passes over the other, so guests and
   vehicles never share the ground. t.br says which is on top: 'foot' (a footbridge over the road,
   the default) or 'road' (a road bridge over the footpath). Both kinds of traffic can use the tile. */
const BRIDGE_COST = 300;
const bridgeTop = (i) => S.tiles[i].br || 'foot';
const isRoad = (i) => S.tiles[i].t === 'p' && (S.tiles[i].pm === 'service' || S.tiles[i].pm === 'crossing');
const isFootpath = (i) => S.tiles[i].t === 'p' && S.tiles[i].pm !== 'service' && S.tiles[i].pm !== 'track';
const isTrack = (i) => S.tiles[i].t === 'p' && S.tiles[i].pm === 'track';
// a footpath within 3 tiles, for staff on foot (buildings that need both a road and a footpath)
function footpathBeside(p) {
  for (let y = p.y0 - 3; y < p.y0 + p.fh + 3; y++)
    for (let x = p.x0 - 3; x < p.x0 + p.fw + 3; x++) if (inB(x, y) && isFootpath(idx(x, y))) return true;
  return false;
}
// does this facing work? Guest and staff buildings open onto a path; a show stadium faces its tank
function frontOK(kind, p) {
  if (kind === 'stage')
    return frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).some((i) => {
      const e = S.tiles[i].e;
      return e && F.emap[e] && F.emap[e].biome === 'pool';
    });
  if (ITEMS[kind].kind === 'decor') return true;
  if (ITEMS[kind].kind === 'farm') return frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).some((i) => S.tiles[i].t === 'p');
  const front = frontTiles(p.x0, p.y0, p.fw, p.fh, p.r);
  // service buildings and parking open onto a road; guest buildings onto a footpath
  return ITEMS[kind].access === 'road' ? front.some(isRoad) : front.some(isFootpath);
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
/* every building of a kind, by anchor tile. Gathered by rebuild(); between an edit and the next
   rebuild the list can be a step behind, so each entry is checked against the map. */
const anchorsOf = (kind) =>
  F.anchors && F.anchors[kind] ? F.anchors[kind].filter((a) => S.tiles[a].o === kind && isAnchor(a)) : [];
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
  if (kind === 'entrance') return checkEntrance(x, y);
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
          : ITEMS[kind].access === 'road'
            ? `The ${nm}'s door side has to open onto a road (vehicles only), connected to the highway on the south edge.`
            : `Move closer to a footpath: the ${nm}'s door side has to open onto one.`
    );
  if (kind === 'stage' && !p.tiles.some((i) => nbr4(i).some((n) => S.tiles[n].t === 'p')))
    return fail('Guests need a path to reach the stadium.');
  if (kind === 'station' && !p.tiles.some((i) => nbr4(i).some((n) => isTrack(n))))
    return fail('Lay a safari track beside the station first (behind or at the side).');
  if (kind === 'animalhouse' && houseHabitat(p) == null)
    return fail('The animal house’s back wall has to sit against a land habitat’s fence, with its door onto a road.');
  if (ITEMS[kind].needsFootpath && !footpathBeside(p))
    return fail(`The ${nm} also needs a footpath within 3 tiles, for staff on foot.`);
  const clears = p.tiles.filter((i) => S.tiles[i].o).length;
  return { ok: true, cost: it.cost, plan: p, clears };
}
// the land habitat behind an animal house (the side opposite its door), or null
function houseHabitat(p) {
  const back = frontTiles(p.x0, p.y0, p.fw, p.fh, (p.r + 2) % 4);
  const counts = {};
  for (const i of back) {
    const e = S.tiles[i].e;
    if (e && F.emap[e] && F.emap[e].biome !== 'pool') counts[e] = (counts[e] || 0) + 1;
  }
  const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  return best == null ? null : +best;
}
// trees, shrubs and rocks outside habitats are cleared to make room for a building
const clearable = (o) => ITEMS[o] && ITEMS[o].kind === 'plant' && o !== 'pond';

/* The park entrance: 3 tiles wide, anywhere outside habitats, usually across a footpath. Guests walk
   from parking to the footpath tile outside its middle, pay, and step through to the tile inside
   (GATE.x, GATE.y). On the south edge the outside tile is the highway verge, off the map. Its front
   (the facing `r`) is the zoo side. Placing a new entrance moves the old one. */
const GATE_DIR = [
  [0, 1],
  [1, 0],
  [0, -1],
  [-1, 0],
];
function entrancePlan(x) {
  const x0 = clamp(x - 1, 0, W - 3);
  return { r: 2, x0, y0: H - 1, fw: 3, fh: 1, tiles: fpTiles(x0, H - 1, 3, 1) };
}
function gateTiles(p) {
  const [dx, dy] = GATE_DIR[p.r],
    mx = p.x0 + (p.fw >> 1),
    my = p.y0 + (p.fh >> 1);
  return { mx, my, ix: mx + dx, iy: my + dy, ox: mx - dx, oy: my - dy };
}
// which way a gate should face at this spot: across the footpath it's on, with the zoo side towards the middle of the map
function gateFacings(x, y) {
  if (buildRot != null) return [buildRot];
  if (y === H - 1) return [2, 1, 3, 0];
  const onPath = inB(x, y) && S.tiles[idx(x, y)].t === 'p',
    run = (dx, dy) => inB(x + dx, y + dy) && S.tiles[idx(x + dx, y + dy)].t === 'p',
    vertical = onPath ? run(0, -1) || run(0, 1) : Math.abs(y - H / 2) > Math.abs(x - W / 2),
    pair = vertical ? (y > H / 2 ? [2, 0] : [0, 2]) : x < W / 2 ? [1, 3] : [3, 1];
  const rest = [0, 1, 2, 3].filter((r) => !pair.includes(r));
  const order = [...pair, ...rest];
  return lastPlan && lastPlan.kind === 'entrance' ? [lastPlan.r, ...order.filter((r) => r !== lastPlan.r)] : order;
}
function checkEntrancePlan(p) {
  const fail = (msg) => ({ ok: false, msg, plan: p }),
    g = gateTiles(p);
  const offSouth = g.oy >= H;
  if (!inB(g.ix, g.iy) || (!inB(g.ox, g.oy) && !offSouth))
    return fail('The entrance needs a tile on both sides: only the south edge can open straight onto the highway.');
  const check = [...p.tiles, idx(g.ix, g.iy)];
  if (!offSouth) check.push(idx(g.ox, g.oy));
  for (const i of check) {
    if (i < 0) return fail('That runs off the edge of the map.');
    const t = S.tiles[i];
    if (t.e) return fail('The entrance can’t go in a habitat.');
    if (t.w) return fail('Part of that spot is under water.');
    if (t.t === 'p' && (t.pm === 'service' || t.pm === 'crossing' || t.pm === 'track'))
      return fail('The entrance can’t go across a road, bridge or safari track.');
    if (t.o && t.o !== 'entrance' && !clearable(t.o)) return fail('Something is in the way of the entrance.');
  }
  return { ok: true, cost: ITEMS.entrance.cost, plan: p };
}
function checkEntrance(x, y) {
  let first = null;
  for (const r of gateFacings(x, y)) {
    const [fw, fh] = fpDims('entrance', r),
      [x0, y0] = fpOrigin('entrance', x, y, r),
      c = checkEntrancePlan({ r, x0, y0, fw, fh, tiles: fpTiles(x0, y0, fw, fh) });
    if (c.ok) {
      lastPlan = { kind: 'entrance', r };
      return c;
    }
    first = first || c;
  }
  return first;
}
// work out GATE from the entrance building on the map
function syncGate() {
  const a = S.tiles.findIndex((t, i) => t.o === 'entrance' && isAnchor(i));
  if (a < 0) return;
  const g = gateTiles(planOf(a));
  Object.assign(GATE, { x: g.ix, y: g.iy, mx: g.mx, my: g.my });
  const out = inB(g.ox, g.oy);
  GATE.ox = out ? g.ox : -1;
  GATE.oy = out ? g.oy : -1;
  S.gate = { ...GATE };
}
function placeEntrance(p) {
  for (let i = 0; i < W * H; i++) if (S.tiles[i].o === 'entrance' && isAnchor(i)) clearBuilding(i); // rare: a full scan is fine
  for (const i of p.tiles) {
    S.tiles[i].t = 'g';
    S.tiles[i].pm = undefined;
  }
  stampBuilding('entrance', p);
  syncGate();
  // guests step in onto a footpath, and queue on one outside
  const lay = (x, y) => {
    const t = S.tiles[idx(x, y)];
    if (t.t !== 'p' || t.pm === 'service') setPath(x, y, 'stone');
    t.o = null;
  };
  lay(GATE.x, GATE.y);
  if (GATE.ox >= 0) lay(GATE.ox, GATE.oy);
}
