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
function newZoo() {
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
  dirty = true;
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
  const bins = [],
    plants = [];
  const decos = [],
    atms = [];
  for (let i = 0; i < N; i++) {
    const o = S.tiles[i].o;
    if (o && !isAnchor(i)) continue; // count each building once, at its anchor tile
    if (o && ITEMS[o].kind === 'decor') decos.push([i, ITEMS[o].scen]);
    if (o === 'playground') decos.push([i, 3]);
    if (o === 'atm') atms.push(i);
  }
  F.atm = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const x = i % W,
      y = (i / W) | 0;
    if (atms.some((b) => Math.abs((b % W) - x) + Math.abs(((b / W) | 0) - y) <= 6)) F.atm[i] = 1;
  }
  for (let i = 0; i < N; i++) {
    const o = S.tiles[i].o;
    if (o === 'bin') bins.push(i);
    if (o && ITEMS[o].kind === 'plant') plants.push(i);
  }
  for (let i = 0; i < N; i++) {
    if (!isPath(i)) continue;
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
    F.bin[i] = bins.some((b) => Math.abs((b % W) - x) + Math.abs(((b / W) | 0) - y) <= 3) ? 1 : 0;
    let c = 0;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) if (inB(x + dx, y + dy) && tileAt(x + dx, y + dy).w) c += 0.3;
    for (const dco of decos) if (Math.abs((dco[0] % W) - x) <= 2 && Math.abs(((dco[0] / W) | 0) - y) <= 2) c += dco[1];
    for (const p of plants) if (Math.abs((p % W) - x) <= 2 && Math.abs(((p / W) | 0) - y) <= 2) c++;
    F.scen[i] = Math.min(8, c);
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
