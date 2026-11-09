/* Roads and demolition are drawn first, shown as a ghost on the ground, and only happen when the
   player confirms. Roads: every drag or tap adds to the plan. Demolition: drag out an area; a single
   tap picks one thing. Habitats are only ever taken by tapping them on their own. */
let plan = null; // { kind, s (the zoo it belongs to), stamps, targets, live, msg }
let planGhostDirty = false;
const PLAN_GHOSTS = 5000;
const planMesh = new THREE.InstancedMesh(
  (() => {
    const g = new THREE.PlaneGeometry(0.98, 0.98);
    g.rotateX(-Math.PI / 2);
    return g;
  })(),
  new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
  PLAN_GHOSTS
);
planMesh.frustumCulled = false;
planMesh.renderOrder = 3;
planMesh.setColorAt(0, new THREE.Color('#58e04a')); // make the colour buffer before the first draw
planMesh.count = 0;
scene.add(planMesh);

function planCancel() {
  if (!plan) return;
  plan = null;
  planGhostDirty = true;
  planRender();
}
function planStart(kind) {
  if (plan && plan.kind === kind && plan.s === S) return plan;
  plan = { kind, s: S, stamps: new Map(), targets: new Map(), live: null, msg: null };
  return plan;
}

/* ---------- roads ---------- */
function planAddRoad(x, y) {
  if (!inB(x, y)) return;
  const c = check(x, y);
  if (!c.stamp) return;
  const key = idx(c.stamp.x0, c.stamp.y0);
  const p = planStart('road');
  if (p.stamps.has(key)) return;
  if (!c.ok && c.quiet) return; // already road
  const tiles = [];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) tiles.push(idx(c.stamp.x0 + i, c.stamp.y0 + j));
  p.stamps.set(key, {
    x,
    y,
    ok: c.ok,
    msg: c.msg,
    tiles,
    deck: c.ok ? c.bridge.deck : [],
    lay: c.ok ? c.bridge.ramps : [],
  });
  planGhostDirty = true;
  planRender();
}
function roadTotals(p) {
  const deck = new Set(),
    lay = new Set();
  let bad = null;
  for (const st of p.stamps.values()) {
    if (!st.ok) bad = bad || st.msg || 'Part of that can’t be built.';
    st.deck.forEach((i) => deck.add(i));
    st.lay.forEach((i) => lay.add(i));
  }
  for (const i of deck) lay.delete(i);
  return { deck, lay, bad, cost: BRIDGE_COST * deck.size + PATHS.service.cost * lay.size };
}

/* ---------- demolition ---------- */
function demoTargets(r) {
  const m = new Map(),
    single = r.w === 1 && r.h === 1,
    spans = new Set();
  const each = (fn) => {
    for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) fn(x, y, idx(x, y), tileAt(x, y));
  };
  each((x, y, i, t) => {
    if (t.t === 'p' && t.pm === 'crossing' && F.bridgeAt.has(i)) spans.add(F.bridgeAt.get(i));
  });
  each((x, y, i, t) => {
    if (t.o) {
      if (t.o === 'entrance') return;
      const a = anchorOf(i);
      if (m.has(a)) return;
      const p = ITEMS[t.o].size ? planOf(a) : null;
      m.set(a, {
        x: a % W,
        y: (a / W) | 0,
        kind: 'item',
        refund: Math.round(ITEMS[t.o].cost / 2),
        tiles: p ? fpTiles(p.x0, p.y0, p.fw, p.fh) : [a],
      });
      return;
    }
    if (t.t === 'p') {
      if (isGate(x, y)) return;
      if (t.pm === 'crossing') m.set(i, { x, y, kind: 'bridge', refund: Math.round(BRIDGE_COST / 2), tiles: [i] });
      else if (!isBridgeRamp(i) || spans.has(F.bridgeAt.get(i)))
        m.set(i, { x, y, kind: 'path', refund: 5, tiles: [i] });
      return;
    }
    if (t.e && single) {
      const e = F.emap[t.e];
      m.set(i, { x, y, kind: 'habitat', refund: 0, tiles: F.etiles[e.id].slice(), animals: animalsIn(e.id).length, e });
    }
  });
  return m;
}
function planDemoLive(r) {
  const p = planStart('demolish');
  p.live = demoTargets(r);
  p.liveRect = r;
  planGhostDirty = true;
  planRender();
}
function planDemoCommit() {
  if (!plan || plan.kind !== 'demolish' || !plan.live) return;
  const r = plan.liveRect;
  for (const [k, v] of plan.live) plan.targets.set(k, v);
  plan.live = null;
  if (!plan.targets.size) {
    if (r.w === 1 && r.h === 1 && inB(r.x, r.y)) {
      const t = tileAt(r.x, r.y),
        c = check(r.x, r.y);
      if (t.o === 'entrance') toast('The zoo needs an entrance. Place a new one to move it.', 'bad');
      else if (c.msg) toast(c.msg, 'bad');
    }
    plan = null;
  }
  planGhostDirty = true;
  planRender();
}
function demoList(p) {
  return p.live ? [...new Map([...p.targets, ...p.live]).values()] : [...p.targets.values()];
}

/* ---------- confirm ---------- */
function planConfirm() {
  if (!plan) return;
  const p = plan;
  if (p.kind === 'road') {
    const t = roadTotals(p);
    if (!t.deck.size && !t.lay.size) return;
    if (S.money < t.cost) return;
    let failed = 0;
    for (const st of p.stamps.values()) if (st.ok && !act(st.x, st.y)) failed++;
    sfx('place');
    if (failed) toast('Part of the road couldn’t be built.', 'bad');
  } else {
    const list = demoList(p),
      order = (k) => list.filter((v) => v.kind === k);
    if (!list.length) return;
    for (const v of order('item')) act(v.x, v.y);
    for (const v of order('bridge')) act(v.x, v.y);
    // with the bridges gone, their ramps can come up
    dirty = true;
    rebuild();
    for (const v of order('path')) act(v.x, v.y);
    for (const v of order('habitat')) {
      demolishArm = { id: v.e.id, t: performance.now() }; // this was the confirmation
      act(v.x, v.y);
    }
    sfx('remove');
  }
  plan = null;
  dirty = true;
  planGhostDirty = true;
  planRender();
}

/* ---------- the bar and the ghost ---------- */
function planRender() {
  const bar = $('#planBar');
  if (!bar) return;
  let txt = '',
    yes = '',
    can = false;
  if (plan && plan.kind === 'road') {
    const t = roadTotals(plan),
      n = t.lay.size;
    can = n + t.deck.size > 0 && S.money >= t.cost;
    yes = 'Build';
    txt = can || n + t.deck.size ? `Road: ${n} tile${n === 1 ? '' : 's'}` : t.bad || 'Nothing to build there.';
    if (t.deck.size) txt += `, ${t.deck.size} bridge tile${t.deck.size === 1 ? '' : 's'}`;
    if (n + t.deck.size) txt += ` · ${money(t.cost)}`;
    if (n + t.deck.size && S.money < t.cost) txt += ' · not enough cash';
    else if (t.bad && n + t.deck.size) txt += ` · the red part can’t be built`;
  } else if (plan) {
    const list = demoList(plan),
      cnt = (k) => list.filter((v) => v.kind === k).length,
      refund = list.reduce((s, v) => s + v.refund, 0),
      parts = [];
    const add = (n, one, many) => n && parts.push(`${n} ${n === 1 ? one : many}`);
    add(cnt('item'), 'item', 'items');
    add(cnt('bridge'), 'bridge tile', 'bridge tiles');
    add(cnt('path'), 'path tile', 'path tiles');
    const hab = list.find((v) => v.kind === 'habitat');
    if (hab)
      parts.push(
        hab.animals ? `this habitat and its ${hab.animals} animal${hab.animals === 1 ? '' : 's'}` : 'this habitat'
      );
    can = list.length > 0;
    yes = 'Demolish';
    txt = can
      ? `Remove ${parts.join(', ')}${refund ? ` · ${money(refund)} back` : ''}`
      : 'Drag over what you want to remove.';
  }
  bar.hidden = !plan;
  if (!plan) return;
  $('#planTxt').textContent = txt;
  const y = $('#planYes');
  y.textContent = yes;
  y.disabled = !can;
  y.onclick = planConfirm;
  $('#planNo').onclick = planCancel;
}
function planFrame() {
  if (plan && plan.s !== S) planCancel(); // a different zoo was loaded
  if (!planGhostDirty) return;
  planGhostDirty = false;
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  let n = 0;
  const put = (i, col) => {
    if (n >= PLAN_GHOSTS) return;
    const x = (i % W) + 0.5,
      z = ((i / W) | 0) + 0.5;
    o.position.set(x, heightAt(x, z) + 0.09, z);
    o.updateMatrix();
    planMesh.setMatrixAt(n, o.matrix);
    planMesh.setColorAt(n, c.set(col));
    n++;
  };
  if (plan && plan.kind === 'road') {
    const seen = new Map();
    for (const st of plan.stamps.values()) if (!st.ok) st.tiles.forEach((i) => seen.set(i, '#e5674f'));
    for (const st of plan.stamps.values()) {
      st.lay.forEach((i) => seen.set(i, '#58e04a'));
      st.deck.forEach((i) => seen.set(i, '#f2c94c'));
    }
    for (const [i, col] of seen) put(i, col);
  } else if (plan) {
    for (const v of demoList(plan)) v.tiles.forEach((i) => put(i, '#e5674f'));
  }
  planMesh.count = n;
  planMesh.instanceMatrix.needsUpdate = true;
  if (planMesh.instanceColor) planMesh.instanceColor.needsUpdate = true;
}
