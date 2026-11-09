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
const frontOnPath = (x0, y0, fw, fh, r) => frontTiles(x0, y0, fw, fh, r).some((i) => isPath(i));
/* A crossing is a bridge where a road and a footpath meet: one passes over the other, so guests and
   vehicles never share the ground. t.br says which is on top: 'foot' (a footbridge over the road,
   the default) or 'road' (a road bridge over the footpath). Both kinds of traffic can use the tile. */
const BRIDGE_COST = 300;
const BRIDGE_H = 0.9; // deck height above the ground
const bridgeTop = (i) => S.tiles[i].br || 'foot';
const isRoad = (i) => S.tiles[i].t === 'p' && (S.tiles[i].pm === 'service' || S.tiles[i].pm === 'crossing');
const isFootpath = (i) => S.tiles[i].t === 'p' && S.tiles[i].pm !== 'service' && S.tiles[i].pm !== 'track';
const isTrack = (i) => S.tiles[i].t === 'p' && S.tiles[i].pm === 'track';
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
  if (ITEMS[kind].access === 'road') return front.some(isRoad);
  // staff walk on roads as well as footpaths, so other staff buildings can open onto either
  return ITEMS[kind].kind === 'staff' ? front.some(isPath) : front.some(isFootpath);
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
            : it.kind === 'staff'
              ? `The ${nm}'s door side has to open onto a road or footpath.`
              : `Move closer to a footpath: the ${nm}'s door side has to open onto one.`
    );
  if (kind === 'stage' && !p.tiles.some((i) => nbr4(i).some((n) => S.tiles[n].t === 'p')))
    return fail('Guests need a path to reach the stadium.');
  if (kind === 'station' && !p.tiles.some((i) => nbr4(i).some((n) => isTrack(n))))
    return fail('Lay a safari track beside the station first (behind or at the side).');
  if (kind === 'animalhouse' && houseHabitat(p) == null)
    return fail('The animal house’s back wall has to sit against a land habitat’s fence, with its door onto a road.');
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

/* Benches, lights, carts and the like can stand on a wide footpath or plaza, as long as guests can
   still get round them. */
function checkOnPath(x, y, it) {
  const no = (msg) => ({ ok: false, msg }),
    t = tileAt(x, y),
    i = idx(x, y);
  if (!((it.kind === 'decor' && !it.line) || it.kind === 'shop')) return no('Build beside the path, not on it.');
  if (t.pm === 'service' || t.pm === 'crossing' || t.pm === 'track' || t.pm === 'tunnel' || t.e)
    return no('That can only go on a footpath, not a road, bridge or track.');
  if (isGate(x, y) || isBridgeRamp(i)) return no('That spot has to stay clear.');
  if (t.o) return no('That tile is already taken.');
  for (const n of nbr4(i)) {
    const o = S.tiles[n].o;
    if (!o || !ITEMS[o].size) continue;
    const p = planOf(anchorOf(n));
    if (frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).includes(i)) return no('That would block a doorway.');
  }
  // would it cut the path? Look at the walkable tiles around this one, going round the ring
  const open = (dx, dy) => inB(x + dx, y + dy) && guestPath(idx(x + dx, y + dy));
  const ring = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ].map(([dx, dy]) => open(dx, dy));
  let sides = 0,
    joined = 0;
  for (let k = 0; k < 8; k += 2) {
    if (!ring[k]) continue;
    sides++;
    if (ring[(k + 1) % 8] && ring[(k + 2) % 8]) joined++;
  }
  const blocked = no('That would block the path. Leave guests a way round it.');
  if (sides >= 2 && !joined) return blocked; // a path one tile wide
  if (sides - joined <= 1 || joined === 4) return { ok: true };
  // cut locally, so see whether the sides still meet the long way round
  const goals = new Set(nbr4(i).filter(guestPath)),
    seen = new Set([i]),
    q = [[...goals][0]];
  seen.add(q[0]);
  goals.delete(q[0]);
  for (let k = 0; k < q.length && goals.size && k < 3000; k++)
    for (const n of nbr4(q[k]))
      if (!seen.has(n) && guestPath(n)) {
        seen.add(n);
        goals.delete(n);
        q.push(n);
      }
  return goals.size ? blocked : { ok: true };
}

/* Every bridge is at least 3 tiles long: a deck over the lower path with a full-tile ramp each end.
   Crossing tiles in a line (over a wide path, or with one tile between them) share one level deck. */
// does the upper path run along x? Older saves don't record it, so it's read from what's around the tile
function bridgeAlongX(x, y) {
  const top = bridgeTop(idx(x, y)),
    score = (i, j, kind) => {
      if (!inB(i, j)) return 0;
      const n = idx(i, j),
        t = S.tiles[n];
      if (t.t !== 'p') return 0;
      if (t.pm === 'crossing') return bridgeTop(n) === top ? 0.5 : 0;
      return (kind === 'road' ? isRoad(n) : guestPath(n)) ? 1 : 0;
    },
    low = top === 'road' ? 'foot' : 'road';
  const ux = score(x - 1, y, top) + score(x + 1, y, top),
    uy = score(x, y - 1, top) + score(x, y + 1, top);
  if (ux !== uy) return ux > uy;
  const lx = score(x - 1, y, low) + score(x + 1, y, low),
    ly = score(x, y - 1, low) + score(x, y + 1, low);
  return lx <= ly;
}
// lay out every bridge on the map: F.bridgeAt maps each deck and ramp tile to its span
function linkBridges() {
  F.bridgeAt = new Map();
  const lines = new Map();
  for (let i = 0; i < S.tiles.length; i++) {
    if (S.tiles[i].pm !== 'crossing' || S.tiles[i].t !== 'p') continue;
    const x = i % W,
      y = (i / W) | 0,
      ax = bridgeAlongX(x, y),
      top = bridgeTop(i),
      key = `${ax ? 'x' : 'y'}${ax ? y : x}${top}`;
    if (!lines.has(key)) lines.set(key, { ax, line: ax ? y : x, top, at: [] });
    lines.get(key).at.push(ax ? x : y);
  }
  const spans = [];
  for (const l of lines.values()) {
    const tileOn = (c) => (l.ax ? idx(c, l.line) : idx(l.line, c)),
      onMap = (c) => (l.ax ? inB(c, l.line) : inB(l.line, c)),
      isUpper = (c) => {
        if (!onMap(c)) return false;
        const n = tileOn(c);
        return S.tiles[n].t === 'p' && S.tiles[n].pm !== 'crossing' && (l.top === 'road' ? isRoad(n) : guestPath(n));
      };
    l.at.sort((p, q) => p - q);
    let a = l.at[0],
      b = a;
    const close = () => {
      let deck = -Infinity;
      for (let c = a; c <= b; c++)
        deck = Math.max(deck, heightAt((l.ax ? c : l.line) + 0.5, (l.ax ? l.line : c) + 0.5));
      spans.push({
        ax: l.ax,
        line: l.line,
        top: l.top,
        a,
        b,
        rampA: isUpper(a - 1) ? 1 : 0.5, // older saves can have a bridge with no room for a full ramp
        rampB: isUpper(b + 1) ? 1 : 0.5,
        deckY: deck + BRIDGE_H,
      });
    };
    for (let k = 1; k < l.at.length; k++) {
      const c = l.at[k];
      if (c - b <= 2 && (c - b === 1 || isUpper(b + 1))) b = c;
      else {
        close();
        a = b = c;
      }
    }
    close();
  }
  // decks claim their tiles first, so a ramp can't overwrite another bridge's deck
  for (const sp of spans)
    for (let c = sp.a; c <= sp.b; c++) F.bridgeAt.set(sp.ax ? idx(c, sp.line) : idx(sp.line, c), sp);
  for (const sp of spans)
    for (const c of [sp.a - 1, sp.b + 1]) {
      if (!(sp.ax ? inB(c, sp.line) : inB(sp.line, c))) continue;
      const n = sp.ax ? idx(c, sp.line) : idx(sp.line, c);
      if (!F.bridgeAt.has(n)) F.bridgeAt.set(n, sp);
    }
}
// 0 on the ground, 1 at deck height, at distance u along a span
function spanLevel(sp, u) {
  const ease = (t) => t * t * (3 - 2 * t);
  if (u < sp.a) return ease(clamp((u - (sp.a - sp.rampA)) / sp.rampA, 0, 1));
  if (u > sp.b + 1) return ease(clamp((sp.b + 1 + sp.rampB - u) / sp.rampB, 0, 1));
  return 1;
}
// is this path tile a ramp (or the level bit between two crossings) of a bridge?
function isBridgeRamp(i) {
  const t = S.tiles[i];
  return t.t === 'p' && t.pm !== 'crossing' && !!(F.bridgeAt && F.bridgeAt.has(i));
}
// would a new path of this type at (x, y) run into the side of a bridge of the same type?
function joinsBridgeSide(x, y, isRoadType) {
  if (!F.bridgeAt) return false;
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (!inB(x + dx, y + dy)) continue;
    const sp = F.bridgeAt.get(idx(x + dx, y + dy));
    if (sp && (sp.top === 'road') === isRoadType && (sp.ax ? dy !== 0 : dx !== 0)) return true;
  }
  return false;
}
// work out a new bridge at (x, y): the tiles it decks over and the ramps it needs
function bridgePlan(x, y, top) {
  const fail = (msg) => ({ ok: false, msg });
  const kindOK = (t) => t.t === 'p' && !t.o && !t.e && t.pm !== 'crossing' && t.pm !== 'track' && t.pm !== 'tunnel';
  const isLower = (i, j) => {
    if (!inB(i, j)) return false;
    const t = S.tiles[idx(i, j)];
    return kindOK(t) && (top === 'road') !== (t.pm === 'service');
  };
  const isUpper = (i, j) => {
    if (!inB(i, j)) return false;
    const t = S.tiles[idx(i, j)];
    return kindOK(t) && (top === 'road') === (t.pm === 'service');
  };
  // bridges over the same lower path count as more of it
  const lowerRun = (i, j) =>
    isLower(i, j) ||
    (inB(i, j) && S.tiles[idx(i, j)].t === 'p' && S.tiles[idx(i, j)].pm === 'crossing' && bridgeTop(idx(i, j)) === top);
  if (isBridgeRamp(idx(x, y))) return fail('That’s a bridge ramp. Cross a little further along.');
  // how far the lower path runs each way through this tile; the bridge crosses the short way
  const run = (dx, dy, i = x, j = y) => {
    let n = 1;
    for (const s of [-1, 1]) for (let k = 1; k < 12 && lowerRun(i + dx * s * k, j + dy * s * k); k++) n++;
    return n;
  };
  const lenX = run(1, 0),
    lenY = run(0, 1),
    short = Math.min(lenX, lenY);
  if (short > 6) return fail('That path is too wide to bridge.');
  if (lenX === lenY && short > 2) return fail('A bridge can’t cross a junction. Move along to a straight stretch.');
  if (short > 1) {
    // a wide path runs on both sides of this strip; a corner or junction doesn't
    const sx = lenX < lenY ? 1 : 0,
      sy = 1 - sx;
    for (const s of [-1, 1])
      for (let k = 1; lowerRun(x + sx * s * k, y + sy * s * k); k++) {
        const i = x + sx * s * k,
          j = y + sy * s * k;
        if (!lowerRun(i + sy, j + sx) && !lowerRun(i - sy, j - sx))
          return fail('A bridge needs a straight stretch of path to cross, not a corner or junction.');
      }
  }
  const alongX =
    lenX !== lenY ? lenX < lenY : isUpper(x - 1, y) || isUpper(x + 1, y) || !(isUpper(x, y - 1) || isUpper(x, y + 1));
  const dx = alongX ? 1 : 0,
    dy = alongX ? 0 : 1,
    deck = [idx(x, y)],
    ramps = [];
  // the approach has to be straight: a two-lane road may be 2 wide there, a footpath 1
  const sideClash = (i, j) => {
    let w = 1;
    for (const t of [-1, 1]) for (let k = 1; k < 4 && isUpper(i + dy * t * k, j + dx * t * k); k++) w++;
    return w > (top === 'road' ? 2 : 1);
  };
  for (const s of [-1, 1]) {
    for (let n = 1; ; n++) {
      const cx = x + dx * s * n,
        cy = y + dy * s * n;
      if (!inB(cx, cy)) return fail('A bridge needs a tile for its ramp on each side, and that runs off the map.');
      const i = idx(cx, cy),
        t = S.tiles[i];
      if (isLower(cx, cy)) {
        deck.push(i); // a wide path: the deck carries on across it
        if (deck.length > 6) return fail('That path is too wide to bridge.');
        continue;
      }
      if (t.t === 'p' && t.pm === 'crossing') {
        const sp = F.bridgeAt && F.bridgeAt.get(i);
        if (sp && sp.ax === alongX && sp.top === top) break; // joins the bridge next door
        return fail('Too close to another bridge: a bridge needs a clear tile on each side for its ramps.');
      }
      if (isUpper(cx, cy)) {
        if (sideClash(cx, cy)) return fail('Bridge ramps need a straight run: move the junction a tile further away.');
        break;
      }
      if (t.t !== 'p' && !t.e && !t.w && (!t.o || clearable(t.o))) {
        if (sideClash(cx, cy)) return fail('Bridge ramps need a straight run: move the junction a tile further away.');
        ramps.push(i);
        break;
      }
      return fail('A bridge needs a clear tile on each side for its ramps.');
    }
  }
  return { ok: true, deck, ramps };
}

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
// an empty new zoo has no entrance until the player places one (older zoos always have one)
const hasEntrance = () => !S.bare || !!(F.cnt && F.cnt.entrance);
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
