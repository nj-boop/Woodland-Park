/* World setup (new zoo, tiles, habitats, animals) and derived data rebuilt after any change: path distance fields, viewing maps, habitat tile sets and edges, staff capacity. */

/* ---------- world setup ---------- */
function blankTiles() {
  return Array.from({ length: W * H }, () => ({ t: 'g', o: null, e: 0, l: 0 }));
}
function tileAt(x, y) {
  return S.tiles[idx(x, y)];
}
function setPath(x, y, m) {
  const t = tileAt(x, y);
  t.t = 'p';
  t.o = null;
  t.pm = m || t.pm || 'stone';
}
function makeEncl(x, y, w, h, biome) {
  const e = { id: S.nextId++, x, y, w, h, biome, dirt: 0, fence: biome === 'pool' ? 'glass' : fenceSub };
  S.encl.push(e);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) tileAt(i, j).e = e.id;
  return e;
}
function addAnimal(sp, e, x, y) {
  const a = {
    id: S.nextId++,
    sp,
    e: e.id,
    x,
    y,
    ox: x,
    oy: y,
    tx: x,
    ty: y,
    wait: rnd(0, 60),
    hunger: rnd(5, 25),
    happy: 70,
    target: 70,
    why: [],
    dir: 1,
    name: pick(ANAMES),
    health: 100,
    sick: false,
    born: S.day,
  };
  S.animals.push(a);
  return a;
}
function setMapSize(w, h) {
  W = w;
  H = h;
  HW = w + 1;
}
// move the whole zoo into a w × h map, shifted by (ox, oy) tiles
function resizeMap(w, h, ox, oy) {
  const oldW = W,
    oldH = H,
    oldT = S.tiles,
    oldH8 = S.hgt;
  setMapSize(w, h);
  const ni = (x, y) => (y + oy) * w + (x + ox);
  S.tiles = blankTiles();
  for (let y = 0; y < oldH; y++)
    for (let x = 0; x < oldW; x++) {
      const t = oldT[y * oldW + x];
      if (t.a != null) t.a = ni(t.a % oldW, (t.a / oldW) | 0);
      S.tiles[ni(x, y)] = t;
    }
  S.hgt = new Float32Array((w + 1) * (h + 1));
  for (let j = 0; j <= oldH; j++)
    for (let i = 0; i <= oldW; i++) S.hgt[(j + oy) * (w + 1) + i + ox] = oldH8[j * (oldW + 1) + i];
  for (const e of S.encl) {
    e.gates = (e.gates || []).map(([gi, gd]) => [ni(gi % oldW, (gi / oldW) | 0), gd]);
    e.x += ox;
    e.y += oy;
  }
  for (const a of S.animals) for (const k of ['x', 'tx', 'ox']) a[k] += ox;
  for (const a of S.animals) for (const k of ['y', 'ty', 'oy']) a[k] += oy;
  for (const s of S.staff) {
    s.x += ox;
    s.ox += ox;
    s.y += oy;
    s.oy += oy;
    s.path = [];
    s.job = null;
    s.st = 'idle';
  }
  S.guests = [];
  GATE.x += ox;
  GATE.y += oy;
  S.mapW = w;
  S.mapH = h;
  S.gate = { ...GATE };
  dirty = true;
  mapResized = true;
}
let mapResized = true; // tells the renderer to rebuild everything sized to the map
// a new zoo; on a bigger map the starting layout sits at the bottom middle, by the entrance
function newZoo(w, h) {
  setMapSize(36, 26);
  GATE.x = 18;
  GATE.y = 25;
  S = {
    v: 1,
    hgt: new Float32Array((W + 1) * (H + 1)),
    tier: 1,
    totalVis: 0,
    money: 25000,
    day: 1,
    clock: 0,
    admission: 15,
    staff: [],
    cands: [],
    prices: { ...BASE_PRICE },
    ledger: [],
    tiles: blankTiles(),
    encl: [],
    animals: [],
    guests: [],
    rating: 62,
    exits: [],
    nextId: 1,
    today: { inc: 0, run: 0, vis: 0, adm: 0, shop: 0 },
  };
  for (let y = 14; y < H; y++) setPath(GATE.x, y);
  for (let x = 9; x <= 27; x++) {
    setPath(x, 14);
    setPath(x, 6);
  }
  for (let y = 6; y <= 14; y++) {
    setPath(9, y);
    setPath(27, y);
  }
  const e = makeEncl(11, 7, 7, 7, 'savanna');
  e.gates = [[idx(14, 13), 1]]; // a keeper gate onto the path below
  [
    [12, 8, 'tree'],
    [16, 9, 'tree'],
    [13, 12, 'bush'],
    [16, 12, 'rock'],
    [13, 10, 'pond'],
  ].forEach(([x, y, o]) => (tileAt(x, y).o = o));
  addAnimal('zebra', e, 13.5, 10.5);
  addAnimal('zebra', e, 15.2, 11);
  tileAt(19, 17).o = 'food';
  tileAt(17, 18).o = 'bench';
  tileAt(19, 20).o = 'bin';
  tileAt(17, 21).o = 'bench';
  [
    [7, 9, 'tree'],
    [6, 15, 'tree'],
    [30, 9, 'tree'],
    [31, 16, 'tree'],
    [14, 18, 'tree'],
    [23, 19, 'tree'],
    [25, 16, 'bush'],
    [12, 21, 'tree'],
    [21, 22, 'bush'],
    [8, 19, 'tree'],
    [29, 21, 'tree'],
    [4, 4, 'tree'],
    [32, 4, 'bush'],
    [15, 3, 'tree'],
    [22, 2, 'tree'],
    [20, 4, 'rock'],
  ].forEach(([x, y, o]) => {
    const t = tileAt(x, y);
    if (t.t === 'g' && !t.e) t.o = o;
  });
  refreshCandidates();
  S.mapW = 36;
  S.mapH = 26;
  S.gate = { ...GATE };
  if ((w && w !== 36) || (h && h !== 26)) resizeMap(w || 36, h || 26, Math.floor(((w || 36) - 36) / 2), (h || 26) - 26);
  dirty = true;
  mapResized = true;
}

/* ---------- derived fields ---------- */
const isPath = (i) => S.tiles[i].t === 'p';
function nbr4(i) {
  const x = i % W,
    y = (i / W) | 0,
    o = [];
  if (x > 0) o.push(i - 1);
  if (x < W - 1) o.push(i + 1);
  if (y > 0) o.push(i - W);
  if (y < H - 1) o.push(i + W);
  return o;
}
function bfs(src) {
  const d = new Int16Array(W * H).fill(-1),
    q = [];
  for (const s of src)
    if (d[s] < 0 && isPath(s)) {
      d[s] = 0;
      q.push(s);
    }
  for (let k = 0; k < q.length; k++) {
    const c = q[k];
    for (const n of nbr4(c))
      if (d[n] < 0 && isPath(n)) {
        d[n] = d[c] + 1;
        q.push(n);
      }
  }
  return d;
}
function rebuild() {
  const N = W * H;
  F.emap = {};
  S.encl.forEach((e) => (F.emap[e.id] = e));
  F.etiles = {};
  F.eedges = {};
  for (let i = 0; i < N; i++) {
    const id = S.tiles[i].e;
    if (id && F.emap[id]) (F.etiles[id] = F.etiles[id] || []).push(i);
    else if (id) S.tiles[i].e = 0;
  }
  for (const e of [...S.encl]) {
    const ts = F.etiles[e.id];
    if (!ts || !ts.length) {
      S.encl = S.encl.filter((o) => o !== e);
      S.animals = S.animals.filter((a) => a.e !== e.id);
      delete F.emap[e.id];
      continue;
    }
    let x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0;
    const ed = [];
    for (const i of ts) {
      const x = i % W,
        y = (i / W) | 0;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      if (!inEnc(e, x, y - 1)) ed.push([x, y, 0]);
      if (!inEnc(e, x, y + 1)) ed.push([x, y, 1]);
      if (!inEnc(e, x - 1, y)) ed.push([x, y, 2]);
      if (!inEnc(e, x + 1, y)) ed.push([x, y, 3]);
    }
    e.x = x0;
    e.y = y0;
    e.w = x1 - x0 + 1;
    e.h = y1 - y0 + 1;
    F.eedges[e.id] = ed;
    e.area = ts.length;
    e.gates = (e.gates || []).filter(([gi, gd]) =>
      ed.some((q) => q[0] === gi % W && q[1] === ((gi / W) | 0) && q[2] === gd)
    );
    if (e.biome === 'pool') {
      let sm = 0,
        n = 0;
      for (const i of ts) {
        const x = i % W,
          y = (i / W) | 0;
        for (const [ci, cj] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ]) {
          sm += hC(ci, cj);
          n++;
        }
      }
      e.base = sm / n;
      for (const i of ts) {
        const x = i % W,
          y = (i / W) | 0;
        for (const [ci, cj] of [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ])
          if (S.hgt) S.hgt[cIdx(ci, cj)] = e.base;
      }
    }
  }
  const src = (type) => {
    const o = [];
    for (let i = 0; i < N; i++) if (S.tiles[i].o === type) for (const n of nbr4(i)) if (isPath(n)) o.push(n);
    return o;
  };
  F.restroom = bfs(src('restroom'));
  F.food2 = bfs([...src('food'), ...src('restaurant')]);
  F.gate = bfs([idx(GATE.x, GATE.y)]);
  F.food = bfs(src('food'));
  F.drink = bfs(src('drink'));
  F.bench = bfs(src('bench'));
  F.view = new Array(N);
  F.shops = new Array(N);
  F.bin = new Uint8Array(N);
  F.scen = new Uint8Array(N);
  // things that affect nearby path tiles are "stamped" onto a grid around themselves, which costs
  // (number of things × area) instead of (path tiles × things)
  const scen = new Float32Array(N);
  F.atm = new Uint8Array(N);
  F.bin = new Uint8Array(N);
  const stamp = (i, r, diamond, fn) => {
    const cx = i % W,
      cy = (i / W) | 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(H - 1, cy + r); y++)
      for (let x = Math.max(0, cx - r); x <= Math.min(W - 1, cx + r); x++)
        if (!diamond || Math.abs(x - cx) + Math.abs(y - cy) <= r) fn(y * W + x);
  };
  F.paths = [];
  F.litter = new Set();
  F.homes = { lodge: new Set(), recycle: new Set(), vetclinic: new Set() };
  for (let i = 0; i < N; i++) {
    const t = S.tiles[i],
      o = t.o;
    if (t.t === 'p') {
      F.paths.push(i);
      if (t.l > 0) F.litter.add(i);
    }
    if (t.w) stamp(i, 2, false, (k) => (scen[k] += 0.3));
    if (!o) continue;
    if (o in F.homes) for (const n of nbr4(i)) if (!S.tiles[n].e && S.tiles[n].o !== o) F.homes[o].add(n);
    if (ITEMS[o].kind === 'plant') stamp(i, 2, false, (k) => scen[k]++);
    if (!isAnchor(i)) continue; // count each building once, at its anchor tile
    if (ITEMS[o].kind === 'decor') stamp(i, 2, false, (k) => (scen[k] += ITEMS[o].scen));
    if (o === 'playground') stamp(i, 2, false, (k) => (scen[k] += 3));
    if (o === 'atm') stamp(i, 6, true, (k) => (F.atm[k] = 1));
    if (o === 'bin') stamp(i, 3, true, (k) => (F.bin[k] = 1));
  }
  for (const i of F.paths) {
    const x = i % W,
      y = (i / W) | 0,
      v = new Set(),
      sh = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (inB(x + dx, y + dy)) {
          const e = tileAt(x + dx, y + dy).e;
          if (e) v.add(e);
        }
      }
    for (const n of nbr4(i)) {
      const o = S.tiles[n].o;
      if (o && ITEMS[o].kind === 'shop' && o !== 'stage' && o !== 'bin' && o !== 'atm' && !sh.includes(o)) sh.push(o);
    }
    F.view[i] = [...v];
    F.shops[i] = sh;
    F.scen[i] = Math.min(8, scen[i]);
  }
  const cnt = { lodge: 0, recycle: 0, vetclinic: 0, stage: 0 };
  for (let i = 0; i < N; i++) {
    const o = S.tiles[i].o;
    if (o in cnt && isAnchor(i)) cnt[o]++;
  }
  F.cnt = cnt;
  F.cap = { keepers: cnt.recycle ? cnt.lodge * 4 : 0, janitors: cnt.recycle * 3, vets: cnt.vetclinic * 2 };
  dirty = false;
  groundDirty = true;
  staticDirty = true;
}
