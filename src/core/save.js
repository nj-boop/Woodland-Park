/* Saving and loading the zoo (browser storage), legacy save compatibility, initial camera. */
/* ---------- save / load ---------- */
function serialize() {
  return JSON.stringify({
    v: 1,
    mapW: W,
    mapH: H,
    gate: { x: GATE.x, y: GATE.y },
    hg: Array.from(S.hgt || [], (v) => Math.round(v * 100)).join(','),
    wt: S.tiles.map((t) => (t.w ? 1 : 0)).join(''),
    ee: S.tiles.map((t) => t.e || 0),
    tier: S.tier,
    totalVis: S.totalVis,
    money: S.money,
    day: S.day,
    clock: S.clock,
    admission: S.admission,
    staff: S.staff.map((s) => ({
      id: s.id,
      role: s.role,
      name: s.name,
      skill: s.skill,
      trait: s.trait,
      wage: s.wage,
      morale: Math.round(s.morale),
      energy: Math.round(s.energy),
      xp: s.xp,
      hired: s.hired,
      assign: s.assign,
      raised: s.raised,
      mood: s.mood,
      carry: s.carry || 0,
      carryFeed: s.carryFeed || 0,
      x: s.x,
      y: s.y,
    })),
    cands: S.cands,
    feed: Math.round(S.feed * 10) / 10,
    crates: S.crates,
    // trucks on the road are saved as already unloaded
    trucks: [],
    prices: S.prices,
    ledger: S.ledger,
    rating: S.rating,
    exits: S.exits,
    nextId: S.nextId,
    today: S.today,
    t: S.tiles.map((t) => t.t).join(''),
    pm: S.tiles
      .map((t) =>
        t.t === 'p'
          ? { stone: 's', brick: 'b', asphalt: 'a', dirt: 'd', sand: 'n', tunnel: 't', service: 'v' }[t.pm || 'stone']
          : '-'
      )
      .join(''),
    // items are stored on their anchor tile only, with the facing; footprints are re-stamped on load
    fp: 1,
    o: S.tiles.map((t, i) => (t.o && isAnchor(i) ? t.o : 0)),
    ro: S.tiles.map((t, i) => (t.o && isAnchor(i) ? t.r || 0 : 0)).join(''),
    l: S.tiles.map((t) => t.l).join(''),
    encl: S.encl,
    animals: S.animals.map((a) => ({
      id: a.id,
      sp: a.sp,
      e: a.e,
      x: a.x,
      y: a.y,
      hunger: a.hunger,
      happy: a.happy,
      name: a.name,
      health: a.health,
      sick: a.sick,
      born: a.born,
      parents: a.parents,
      escaped: a.escaped,
    })),
  });
}
// older saves had no gates (keepers used to reach animals without walking); give each land habitat one onto a path
function addMissingGates() {
  for (const e of S.encl) {
    if (e.biome === 'pool' || (e.gates && e.gates.length)) continue;
    const found = [];
    S.tiles.forEach((t, i) => {
      if (t.e !== e.id || found.length) return;
      const x = i % W,
        y = (i / W) | 0;
      [
        [0, -1, 0],
        [0, 1, 1],
        [-1, 0, 2],
        [1, 0, 3],
      ].forEach(([dx, dy, dr]) => {
        if (
          !found.length &&
          inB(x + dx, y + dy) &&
          S.tiles[idx(x + dx, y + dy)].t === 'p' &&
          !S.tiles[idx(x + dx, y + dy)].e
        )
          found.push([i, dr]);
      });
    });
    e.gates = found;
  }
}
// grow each building back to its footprint. Saves from before buildings had real sizes stored every
// building on one tile; those get the best-fitting footprint that covers their old tile, or a refund
function restampBuildings(d) {
  const anchors = [];
  S.tiles.forEach((t, i) => {
    if (t.o) anchors.push([i, t.o, d.ro ? +d.ro[i] || 0 : null]);
  });
  for (const [i] of anchors) S.tiles[i].o = null;
  let refunds = 0,
    lost = [];
  const free = (k) => k >= 0 && !S.tiles[k].o && S.tiles[k].t !== 'p' && !S.tiles[k].w && !S.tiles[k].e;
  // small things first, so they keep their spots
  anchors.sort((a, b) => sizeOf(a[1])[0] * sizeOf(a[1])[1] - sizeOf(b[1])[0] * sizeOf(b[1])[1]);
  for (const [i, kind, r] of anchors) {
    const x = i % W,
      y = (i / W) | 0;
    if (d.fp) {
      const [fw, fh] = fpDims(kind, r);
      stampBuilding(kind, { r, x0: x, y0: y, fw, fh, tiles: fpTiles(x, y, fw, fh).filter((k) => k >= 0) });
      continue;
    }
    const [w, dd] = sizeOf(kind);
    if (w * dd === 1) {
      stampBuilding(kind, { r: 0, x0: x, y0: y, fw: 1, fh: 1, tiles: [i] });
      continue;
    }
    // try every facing and offset whose footprint covers the old tile; prefer one with its front on a path
    let best = null;
    for (let rr = 0; rr < 4 && !(best && best.good); rr++) {
      const [fw, fh] = fpDims(kind, rr);
      for (let oy = 0; oy < fh; oy++)
        for (let ox = 0; ox < fw; ox++) {
          const p = { r: rr, x0: x - ox, y0: y - oy, fw, fh };
          p.tiles = fpTiles(p.x0, p.y0, fw, fh);
          if (!p.tiles.every((k) => k === i || free(k))) continue;
          const good = frontOK(kind, p);
          if (!best || (good && !best.good)) best = { ...p, good };
        }
    }
    if (best) stampBuilding(kind, best);
    else {
      refunds += ITEMS[kind].cost;
      lost.push(ITEMS[kind].name.toLowerCase());
    }
  }
  if (refunds) {
    S.money += refunds;
    setTimeout(
      () =>
        toast(
          `Buildings now have real sizes. No room for: ${[...new Set(lost)].join(', ')}. Refunded ${money(refunds)}.`,
          'bad'
        ),
      1500
    );
  }
}
const LEGACY_ITEMS = [
  'tree',
  'bush',
  'rock',
  'pond',
  'food',
  'drink',
  'bench',
  'stage',
  'lodge',
  'recycle',
  'vetclinic',
  'bin',
];
function load(str) {
  const d = JSON.parse(str);
  if (!d || d.v !== 1) throw 0;
  const keys = Object.keys(ITEMS);
  setMapSize(d.mapW || 36, d.mapH || 26);
  GATE.x = d.gate ? d.gate.x : 18;
  GATE.y = d.gate ? d.gate.y : 25;
  mapResized = true;
  S = { ...d, tiles: blankTiles(), guests: [] };
  S.prices = S.prices || { ...BASE_PRICE };
  S.ledger = S.ledger || [];
  S.totalVis = S.totalVis || 0;
  if (!S.tier) {
    S.tier = 1;
    for (const a of S.animals) S.tier = Math.max(S.tier, tierOf(a.sp));
  }
  S.tiles.forEach((t, i) => {
    t.t = d.t[i] === 'p' ? 'p' : 'g';
    if (t.t === 'p')
      t.pm =
        (d.pm && { s: 'stone', b: 'brick', a: 'asphalt', d: 'dirt', n: 'sand', t: 'tunnel', v: 'service' }[d.pm[i]]) ||
        'stone';
    t.o =
      typeof d.o[i] === 'string' ? (ITEMS[d.o[i]] ? d.o[i] : null) : d.o[i] ? LEGACY_ITEMS[d.o[i] - 1] || null : null;
    t.l = +d.l[i] || 0;
  });
  S.encl = d.encl;
  if (d.ee) S.tiles.forEach((t, i) => (t.e = d.ee[i] || 0));
  else
    S.encl.forEach((e) => {
      for (let j = e.y; j < e.y + e.h; j++) for (let i = e.x; i < e.x + e.w; i++) tileAt(i, j).e = e.id;
    });
  S.hgt = new Float32Array((W + 1) * (H + 1));
  if (d.hg) {
    const a = d.hg.split(',');
    for (let i = 0; i < S.hgt.length; i++) S.hgt[i] = (+a[i] || 0) / 100;
  }
  if (d.wt) S.tiles.forEach((t, i) => (t.w = d.wt[i] === '1' ? 1 : 0));
  restampBuildings(d); // after paths, habitats and water are known
  delete S.hg;
  delete S.wt;
  delete S.ee;
  S.animals = d.animals
    .filter((a) => SPECIES[a.sp])
    .map((a) => ({
      ...a,
      ox: a.x,
      oy: a.y,
      tx: a.x,
      ty: a.y,
      wait: rnd(0, 60),
      target: a.happy,
      why: [],
      dir: 1,
      name: a.name || pick(ANAMES),
      health: a.health ?? 100,
      sick: !!a.sick,
      born: a.born ?? S.day,
    }));
  delete S.t;
  delete S.o;
  delete S.l;
  // staff: saves from before individual hiring only stored head counts
  if (d.staff) {
    S.staff = d.staff
      .filter((s) => STAFF_ROLES[s.role])
      .map((s) => ({
        ...s,
        assign: s.assign || [],
        ox: s.x,
        oy: s.y,
        path: [],
        job: null,
        st: 'idle',
        wt: 0,
        tired: 0,
        done: 0,
      }));
  } else {
    staffFromCounts(d);
    addMissingGates();
  }
  delete S.keepers;
  delete S.janitors;
  delete S.vets;
  if (!S.cands || !S.cands.length) refreshCandidates();
  S.feed = d.feed || 0;
  S.crates = d.crates || [];
  S.trucks = [];
  dirty = true;
}
/* Saves live in the browser's IndexedDB (no practical size limit, unlike localStorage's ~5 MB).
   A copy also goes to localStorage while it is small, as a fallback for browsers that block IndexedDB. */
const IDB_NAME = 'wildgrove',
  IDB_STORE = 'saves';
let idbP = null;
function idb() {
  if (idbP) return idbP;
  idbP = new Promise((res, rej) => {
    try {
      const rq = indexedDB.open(IDB_NAME, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(IDB_STORE);
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    } catch (e) {
      rej(e);
    }
  });
  return idbP;
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const rq = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbPut(key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(val, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
const LS_MAX = 2e6; // characters; bigger zoos are saved to IndexedDB only
function save() {
  let str;
  try {
    str = serialize();
  } catch (e) {
    return;
  }
  idbPut(SAVE_KEY, { t: Date.now(), data: str }).catch(() => {});
  try {
    if (str.length < LS_MAX) localStorage.setItem(SAVE_KEY, str);
    else localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}
// the newest save from either store (IndexedDB normally; localStorage for zoos saved before it existed)
async function readSave() {
  let rec = null;
  try {
    rec = await idbGet(SAVE_KEY);
  } catch (e) {}
  let ls = null;
  try {
    ls = localStorage.getItem(SAVE_KEY);
  } catch (e) {}
  if (rec && rec.data) return rec.data;
  return ls;
}
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
});

function centerCam() {
  resize();
  Object.assign(CAM, { tx: 17, tz: 14, dist: view.w < 600 ? 18 : 14, yaw: 0.45, yawG: 0.45, pitch: 1.0 });
  clampCam();
}
