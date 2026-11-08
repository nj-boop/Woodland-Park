/* Saving and loading the zoo (browser storage), legacy save compatibility, initial camera. */
/* ---------- save / load ---------- */
/* Compact encodings for the per-tile layers, so a 512×512 zoo saves in a few milliseconds:
   heights as base64 16-bit integers, habitat ids run-length coded, and buildings as a list of
   [anchor tile, kind, facing]. The one-character-per-tile layers are built in a single pass. */
function b64Int16(arr) {
  const u8 = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
  let s = '';
  for (let k = 0; k < u8.length; k += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(k, k + 0x8000));
  return btoa(s);
}
function int16B64(str) {
  const bin = atob(str),
    u8 = new Uint8Array(bin.length);
  for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
  return new Int16Array(u8.buffer);
}
const PM_CODE = { stone: 's', brick: 'b', asphalt: 'a', dirt: 'd', sand: 'n', tunnel: 't', service: 'v', track: 'k' };
function tileLayers() {
  const N = W * H,
    t = new Array(N),
    pm = new Array(N),
    l = new Array(N),
    wt = new Array(N),
    er = [],
    os = [];
  let run = -1,
    cnt = 0;
  for (let i = 0; i < N; i++) {
    const tile = S.tiles[i];
    t[i] = tile.t;
    pm[i] = tile.t === 'p' ? PM_CODE[tile.pm || 'stone'] : '-';
    l[i] = tile.l || 0;
    wt[i] = tile.w ? 1 : 0;
    const e = tile.e || 0;
    if (e === run) cnt++;
    else {
      if (cnt) er.push(run, cnt);
      run = e;
      cnt = 1;
    }
    if (tile.o && isAnchor(i)) os.push([i, tile.o, tile.r || 0]);
  }
  er.push(run, cnt);
  const hg = new Int16Array(S.hgt ? S.hgt.length : 0);
  for (let k = 0; k < hg.length; k++) hg[k] = Math.round(S.hgt[k] * 100);
  return { t: t.join(''), pm: pm.join(''), l: l.join(''), wt: wt.join(''), er, os, hg16: b64Int16(hg) };
}
// turn the compact layers back into the long forms the loader below reads
function unpackLayers(d) {
  const N = (d.mapW || 36) * (d.mapH || 26);
  if (d.er) {
    d.ee = new Array(N);
    let k = 0;
    for (let j = 0; j < d.er.length; j += 2) for (let c = 0; c < d.er[j + 1]; c++) d.ee[k++] = d.er[j];
  }
  if (d.os) {
    d.o = new Array(N).fill(0);
    const ro = new Array(N).fill(0);
    for (const [i, kind, r] of d.os) {
      d.o[i] = kind;
      ro[i] = r;
    }
    d.ro = ro.join('');
  }
}
function serialize() {
  const L = tileLayers();
  return JSON.stringify({
    v: 1,
    mapW: W,
    mapH: H,
    gate: { x: GATE.x, y: GATE.y },
    hg16: L.hg16,
    wt: L.wt,
    er: L.er,
    mode: S.mode,
    challenge: S.challenge,
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
      carryKind: s.carryKind || null,
      bag: s.bag || 0,
      carryFeed: s.carryFeed || 0,
      x: s.x,
      y: s.y,
    })),
    cands: S.cands,
    feed: Math.round(S.feed * 10) / 10,
    crates: S.crates,
    stock: S.stock,
    sold: S.sold,
    farms: S.farms,
    waste: S.waste,
    // trucks on the road are saved as already unloaded
    trucks: [],
    prices: S.prices,
    ledger: S.ledger,
    rating: S.rating,
    exits: S.exits,
    nextId: S.nextId,
    today: S.today,
    t: L.t,
    pm: L.pm,
    // items are stored on their anchor tile only, with the facing; footprints are re-stamped on load
    fp: 1,
    os: L.os,
    l: L.l,
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
  unpackLayers(d);
  const keys = Object.keys(ITEMS);
  setMapSize(d.mapW || 36, d.mapH || 26);
  GATE.x = d.gate ? d.gate.x : 18;
  GATE.y = d.gate ? d.gate.y : 25;
  mapResized = true;
  S = { ...d, tiles: blankTiles(), guests: [] };
  S.prices = S.prices || { ...BASE_PRICE };
  if (!MODES[S.mode]) S.mode = 'standard';
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
        (d.pm &&
          { s: 'stone', b: 'brick', a: 'asphalt', d: 'dirt', n: 'sand', t: 'tunnel', v: 'service', k: 'track' }[
            d.pm[i]
          ]) ||
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
  if (d.hg16) S.hgt.set(Array.from(int16B64(d.hg16), (v) => v / 100));
  else if (d.hg) {
    const a = d.hg.split(',');
    for (let i = 0; i < S.hgt.length; i++) S.hgt[i] = (+a[i] || 0) / 100;
  }
  if (d.wt) S.tiles.forEach((t, i) => (t.w = d.wt[i] === '1' ? 1 : 0));
  restampBuildings(d); // after paths, habitats and water are known
  if (!S.tiles.some((t) => t.o === 'entrance')) {
    // zoos from before the entrance was a building: put one where the gate was
    const ex = GATE.x;
    for (const i of entrancePlan(ex).tiles) if (S.tiles[i].o && S.tiles[i].o !== 'entrance') clearBuilding(i);
    placeEntrance(entrancePlan(ex));
  }
  delete S.hg;
  delete S.hg16;
  delete S.er;
  delete S.os;
  for (const k of ['o', 'ro', 't', 'pm', 'l']) delete S[k]; // per-tile layers now live in S.tiles
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
  S.stock = d.stock || {};
  S.sold = d.sold || {};
  S.farms = d.farms || {};
  S.waste = d.waste || 0;
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
/* Save slots: three named copies of a zoo the player keeps on purpose, beside the autosave above.
   Each slot stores the zoo plus a short summary for the Office list, so the list doesn't have to
   unpack every save. */
const SLOTS = 3;
const slotKey = (n) => `${SAVE_KEY}-slot${n}`;
const MO_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateOf = (day) => `${MO_SHORT[(day - 1) % 12]}, Year ${Math.floor((day - 1) / 12) + 1}`;
function slotSummary() {
  return {
    date: dateOf(S.day),
    mode: S.mode,
    money: S.money,
    animals: S.animals.length,
    guests: S.guests.length,
    size: `${W}×${H}`,
  };
}
async function saveSlot(n) {
  const rec = { t: Date.now(), data: serialize(), info: slotSummary() };
  try {
    await idbPut(slotKey(n), rec);
  } catch (e) {
    localStorage.setItem(slotKey(n), JSON.stringify(rec)); // throws if too big: the caller reports it
  }
  return rec;
}
async function readSlot(n) {
  try {
    const rec = await idbGet(slotKey(n));
    if (rec) return rec;
  } catch (e) {}
  try {
    const s = localStorage.getItem(slotKey(n));
    if (s) return JSON.parse(s);
  } catch (e) {}
  return null;
}
async function slotList() {
  const out = [];
  for (let n = 1; n <= SLOTS; n++) {
    const r = await readSlot(n);
    out.push(r ? { n, t: r.t, info: r.info } : { n, t: 0, info: null });
  }
  return out;
}
// replace the current zoo with a slot's; the autosave then follows the loaded zoo
async function loadSlot(n) {
  const rec = await readSlot(n);
  if (!rec || !rec.data) return false;
  load(rec.data);
  rebuild();
  save();
  return true;
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
