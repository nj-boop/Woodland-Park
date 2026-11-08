/* Seeded randomness for stable scenery, grass tuft placement, and the paving patterns the ground shader repeats. */
/* seeded randomness so scenery looks the same every time it's rebuilt */
const _origRand = Math.random;
let _rs = 1;
function seedRand(n) {
  _rs = (Math.imul((n | 0) + 1, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
}
function srand() {
  _rs ^= _rs << 13;
  _rs >>>= 0;
  _rs ^= _rs >>> 17;
  _rs ^= _rs << 5;
  _rs >>>= 0;
  return _rs / 4294967296;
}
function seeded(fn) {
  Math.random = srand;
  try {
    return fn();
  } finally {
    Math.random = _origRand;
  }
}
// grass tufts and wild flowers. Inside the map they belong to each scenery chunk (rebuilt with it);
// outside the map there is one set, built when the map size changes.
function tuftWriter(tm, fm) {
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  const w = { n: 0, f: 0 };
  w.put = (x, z, y, sc, col) => {
    if (w.n >= tm.instanceMatrix.count) return;
    if (x >= 0 && x <= W && z >= 0 && z <= H) {
      if (tileAt(Math.floor(clamp(x, 0, W - 0.01)), Math.floor(clamp(z, 0, H - 0.01))).w) return;
      y = heightAt(x, z);
    }
    o.position.set(x, y, z);
    o.rotation.set(rnd(-0.25, 0.25), rnd(0, 6.28), rnd(-0.25, 0.25));
    o.scale.set(sc, sc * rnd(0.8, 1.4), sc);
    o.updateMatrix();
    tm.setMatrixAt(w.n, o.matrix);
    tm.setColorAt(w.n, c.set(col).convertSRGBToLinear());
    w.n++;
  };
  w.flower = (x, z, y) => {
    if (w.f >= fm.instanceMatrix.count) return;
    if (x >= 0 && x <= W && z >= 0 && z <= H) y = heightAt(x, z);
    o.position.set(x, y, z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(1);
    o.updateMatrix();
    fm.setMatrixAt(w.f, o.matrix);
    fm.setColorAt(w.f, c.set(pick(FLC)).convertSRGBToLinear());
    w.f++;
  };
  w.done = () => {
    tm.count = w.n;
    fm.count = w.f;
    for (const m of [tm, fm]) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  };
  return w;
}
function tuftsForTile(w, x, y) {
  seedRand(idx(x, y) * 31 + 7);
  const t = tileAt(x, y);
  if (t.t === 'p' || t.o) return;
  if (t.e) {
    const b = F.emap[t.e].biome;
    if (b === 'savanna' || b === 'prairie')
      for (let k = 0; k < 4; k++)
        w.put(
          x + rnd(0.15, 0.85),
          y + rnd(0.15, 0.85),
          0,
          rnd(1.2, 1.8),
          b === 'savanna' ? pick(['#e8c878', '#d8b464', '#f0d488']) : pick(['#c8d890', '#d8e0a0'])
        );
    else if (b === 'jungle')
      for (let k = 0; k < 3; k++)
        w.put(x + rnd(0.15, 0.85), y + rnd(0.15, 0.85), 0, rnd(1.4, 2.2), pick(['#8fb080', '#a0c090']));
    return;
  }
  for (let k = 0; k < 2; k++)
    w.put(x + rnd(0.05, 0.95), y + rnd(0.05, 0.95), 0, rnd(0.55, 0.9), pick(['#d8e6c8', '#c8dcb4', '#e6eed6']));
  if (Math.random() < 0.08) w.flower(x + rnd(0.1, 0.9), y + rnd(0.1, 0.9), 0);
}
function buildChunkTufts(grp, cx, cy) {
  const tm = new THREE.InstancedMesh(tuftGeo, tufts.material, CHUNK * CHUNK * 4),
    fm = new THREE.InstancedMesh(flGeo, flowers.material, CHUNK * CHUNK);
  // give every instance mesh a colour buffer, even an empty one: meshes sharing a material must
  // agree on having per-instance colour, or three.js reuses a shader that expects it
  const white = new THREE.Color(1, 1, 1);
  tm.setColorAt(0, white);
  fm.setColorAt(0, white);
  const w = tuftWriter(tm, fm);
  seeded(() => {
    for (let y = cy * CHUNK; y < Math.min(H, (cy + 1) * CHUNK); y++)
      for (let x = cx * CHUNK; x < Math.min(W, (cx + 1) * CHUNK); x++) tuftsForTile(w, x, y);
  });
  w.done();
  for (const m of [tm, fm]) {
    m.receiveShadow = true;
    m.frustumCulled = false;
    grp.add(m);
  }
}
// the countryside outside the fence
function buildTufts() {
  const w = tuftWriter(tufts, flowers);
  seedRand(424242);
  const n = Math.round((2600 * (W + H)) / 62);
  for (let k = 0; k < n; k++) {
    let x, z;
    do {
      x = rnd(-22, W + 22);
      z = rnd(-22, H + 22);
    } while (
      (x > -1 && x < W + 1 && z > -1 && z < H + 1) ||
      (z >= H && z < H + 3.2) || // the highway
      Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.2
    );
    const y = hillH(x, z);
    w.put(x, z, y, rnd(1, 1.7), pick(['#c8d8b0', '#b8cca0', '#d0dcbc']));
    if (Math.random() < 0.12) w.flower(x, z, y);
  }
  w.done();
}
let groundDirty = true,
  staticDirty = true;
const PAVE = {
  stone: ['#a7a39c', '#9b968f', '#b3afa7', '#8f8b84'],
  brick: ['#a8553a', '#9a4b33', '#b5603f', '#8e4630'],
  asphalt: ['#55575a', '#4e5053', '#5b5d60'],
  dirt: ['#8a6c47', '#7d613f', '#977a52'],
  sand: ['#d9c08a', '#cfb57c', '#e2cb98'],
};
// one tile of paving pattern (the ground shader repeats these and adds curbs)
function drawPaving(c, x, y, px, py, m) {
  const pal = PAVE[m] || PAVE.stone;
  if (m === 'stone') {
    c.fillStyle = '#6f6b65';
    c.fillRect(px, py, T, T);
    for (let j = 0; j < 4; j++) {
      const off = (j % 2) * 4;
      for (let i = -1; i < 4; i++) {
        const q = hsh(x * 5 + i, y * 4 + j),
          bx = px + i * 9 + off;
        c.fillStyle = pal[Math.floor(q * 4)];
        c.fillRect(Math.max(px, bx) + 0.6, py + j * 8 + 0.6, Math.min(bx + 9, px + T) - Math.max(px, bx) - 1.2, 6.8);
      }
    }
  } else if (m === 'brick') {
    c.fillStyle = '#6e3a28';
    c.fillRect(px, py, T, T);
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 4; i++) {
        const q = hsh(x * 4 + i, y * 8 + j);
        c.fillStyle = pal[Math.floor(q * 4)];
        if ((i + j) % 2) c.fillRect(px + i * 8 + 0.5, py + j * 4 + 0.5, 7, 3);
        else c.fillRect(px + i * 8 + 0.5, py + j * 4 + 0.5, 3, 3), c.fillRect(px + i * 8 + 4.5, py + j * 4 + 0.5, 3, 3);
      }
  } else {
    c.fillStyle = pal[0];
    c.fillRect(px, py, T, T);
    for (let k = 0; k < 26; k++) {
      c.fillStyle = pick(pal.concat(['rgba(0,0,0,.12)', 'rgba(255,255,255,.12)']));
      c.fillRect(px + hsh(x + k, y * 3) * T, py + hsh(y + k, x * 3) * T, rnd(1, 3), rnd(1, 2));
    }
  }
}
