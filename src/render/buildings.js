/* Full-size models for buildings that cover several tiles. Each is built in local space with its front
   (door side) facing +z, centred on its footprint: w tiles wide (x) and d tiles deep (z).
   Scale: one tile is about 3 m, a guest is about 0.55 tall, so a single-storey wall is about 1.1. */

// a pitched roof with its ridge along x
function gableRoof(g, col, x, y, z, w, d, rise) {
  const half = d / 2,
    slope = Math.hypot(half, rise),
    ang = Math.atan2(rise, half);
  for (const sd of [1, -1]) {
    const r = P(g, 'box', col, x, y + rise / 2, z + (sd * half) / 2, w, 0.05, slope + 0.08);
    r.rotation.x = sd * ang;
  }
  // gable ends
  for (const sx of [-1, 1]) {
    const tri = new THREE.Shape();
    tri.moveTo(-half, 0);
    tri.lineTo(half, 0);
    tri.lineTo(0, rise);
    tri.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), M('#e9dfc6'));
    m.rotation.y = Math.PI / 2;
    m.position.set(x + (sx * w) / 2 - sx * 0.02, y, z);
    if (sx < 0) m.rotation.y = -Math.PI / 2;
    m.material.side = THREE.DoubleSide;
    g.add(m);
  }
}
// a row of windows on a wall facing +z (or -z with face = -1)
function windowRow(g, x0, x1, y, z, n, face, frame) {
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) / n) * (x1 - x0);
    P(g, 'box', frame || '#f4efe2', x, y, z + face * 0.012, 0.36, 0.34, 0.02, false);
    P(g, 'box', '#6f9fb6', x, y, z + face * 0.024, 0.3, 0.28, 0.02, false);
  }
}
function door(g, x, z, col, w) {
  P(g, 'box', '#f4efe2', x, 0.38, z + 0.012, (w || 0.42) + 0.08, 0.78, 0.02, false);
  P(g, 'box', col, x, 0.36, z + 0.026, w || 0.42, 0.72, 0.02, false);
}
function signBoard(g, text, bg, fg, x, y, z, w) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const k = c.getContext('2d');
  k.fillStyle = bg;
  k.fillRect(0, 0, 256, 64);
  k.fillStyle = fg;
  let fs = 30;
  do k.font = `bold ${fs--}px Georgia, serif`;
  while (k.measureText(text).width > 236 && fs > 10);
  k.textAlign = 'center';
  k.textBaseline = 'middle';
  k.fillText(text, 128, 34);
  const tx = new THREE.CanvasTexture(c);
  tx.encoding = THREE.sRGBEncoding;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w / 4), new THREE.MeshLambertMaterial({ map: tx }));
  m.position.set(x, y, z);
  g.add(m);
  return m;
}
function fencePanel(g, x0, z0, x1, z1, col) {
  const L = Math.hypot(x1 - x0, z1 - z0),
    a = Math.atan2(x1 - x0, z1 - z0),
    n = Math.max(1, Math.round(L / 0.5));
  for (let k = 0; k <= n; k++) {
    const f = k / n;
    P(g, 'box', col, x0 + (x1 - x0) * f, 0.24, z0 + (z1 - z0) * f, 0.05, 0.48, 0.05);
  }
  for (const y of [0.18, 0.4]) {
    const r = P(g, 'box', col, (x0 + x1) / 2, y, (z0 + z1) / 2, 0.03, 0.04, L);
    r.rotation.y = a;
  }
}
const bush3 = (g, x, z, s) => g.add(leafMesh(BUSH, LEAFMATS[1], LEAF_DEPTH, x, 0.16 * s, z, s));

// slot positions in a parking lot, local to its footprint (front = +z): two rows of 7 bays
const LOT_SLOTS = [];
for (const z of [-1.15, 1.15]) for (let k = 0; k < 7; k++) LOT_SLOTS.push([-2.55 + k * 0.85, z]);
const BUILDINGS = {
  // 3 × 2: a timber cabin with a porch, a feed shed and a woodpile
  lodge(g) {
    P(g, 'box', '#b9ad92', 0, 0.03, 0, 2.9, 0.06, 1.9, false).receiveShadow = true;
    const cx = -0.35;
    P(g, 'box', '#8a6440', cx, 0.56, -0.2, 2.0, 1.06, 1.3);
    for (let k = 0; k < 7; k++) P(g, 'box', '#74522f', cx, 0.1 + k * 0.15, 0.452, 2.01, 0.03, 0.01, false);
    gableRoof(g, '#3f6a3a', cx, 1.09, -0.2, 2.2, 1.5, 0.5);
    // porch
    P(g, 'box', '#9a7550', cx, 0.1, 0.62, 2.0, 0.08, 0.5);
    for (const px of [-1.25, -0.35, 0.55]) P(g, 'cyl', '#6b4a2e', px, 0.55, 0.82, 0.04, 0.92);
    const pr = P(g, 'box', '#3f6a3a', cx, 1.05, 0.66, 2.1, 0.05, 0.56);
    pr.rotation.x = 0.22;
    door(g, cx - 0.25, 0.45, '#5b3c22');
    windowRow(g, cx + 0.15, cx + 0.95, 0.62, 0.45, 2, 1);
    windowRow(g, cx - 0.95, cx - 0.55, 0.62, 0.45, 1, 1);
    P(g, 'box', '#a47c4c', cx + 0.6, 1.35, -0.35, 0.16, 0.5, 0.16); // chimney
    signBoard(g, 'KEEPERS', '#3a2a1e', '#f2e2b6', cx, 1.18, 0.95, 0.9);
    // feed shed and hay
    P(g, 'box', '#a8865a', 1.05, 0.38, -0.3, 0.7, 0.76, 0.9);
    const sr = P(g, 'box', '#6f7570', 1.05, 0.8, -0.3, 0.82, 0.04, 1.0);
    sr.rotation.z = 0.18;
    for (const [hx, hz] of [
      [0.95, 0.45],
      [1.2, 0.5],
      [1.08, 0.48],
    ])
      P(g, 'box', '#d8bf6a', hx, hz === 0.48 ? 0.36 : 0.14, hz, 0.3, 0.2, 0.22);
    for (let k = 0; k < 4; k++)
      P(g, 'cyl', '#7a5230', -1.38, 0.08 + k * 0.1, -0.2 + (k % 2) * 0.05, 0.05, 0.6).rotation.x = Math.PI / 2;
  },
  // 3 × 3: an open shed, colour-coded skips, a compost heap and a chain-link fence
  recycle(g) {
    P(g, 'box', '#a9aba4', 0, 0.03, 0, 2.9, 0.06, 2.9, false).receiveShadow = true;
    // shed along the back
    for (const px of [-1.3, -0.45, 0.45, 1.3]) P(g, 'cyl', '#5a6066', px, 0.6, -1.05, 0.04, 1.2);
    for (const px of [-1.3, 1.3]) P(g, 'cyl', '#5a6066', px, 0.55, -0.35, 0.04, 1.1);
    const roof = P(g, 'box', '#7d8a86', 0, 1.15, -0.72, 2.85, 0.05, 1.0);
    roof.rotation.x = -0.12;
    P(g, 'box', '#8f9590', 0, 0.45, -1.32, 2.7, 0.9, 0.08);
    // big skips
    for (const [bx, c] of [
      [-0.95, '#2f7a46'],
      [0, '#2c6fa8'],
      [0.95, '#6b6b6b'],
    ]) {
      P(g, 'box', c, bx, 0.28, -0.75, 0.75, 0.5, 0.55);
      const lid = P(g, 'box', '#1f2a26', bx, 0.56, -0.8, 0.77, 0.03, 0.5);
      lid.rotation.x = -0.25;
    }
    // compost heap and wheelie bins
    const heap = P(g, 'sph', '#5a4128', -0.75, 0.0, 0.75, 0.6, 0.38, 0.5);
    heap.scale.set(0.6, 0.38, 0.5);
    for (let k = 0; k < 4; k++)
      P(g, 'box', ['#2f7a46', '#2c6fa8', '#f2c94c', '#6b6b6b'][k], 0.35 + k * 0.28, 0.22, 0.95, 0.22, 0.42, 0.24);
    signBoard(g, 'RECYCLING', '#2f7a46', '#ffffff', 0.55, 0.65, 1.32, 1.0);
    for (const px of [0.15, 0.95]) P(g, 'cyl', '#5a6066', px, 0.4, 1.3, 0.03, 0.8);
    // chain-link sides
    fencePanel(g, -1.42, -1.4, -1.42, 1.4, '#8c9399');
    fencePanel(g, 1.42, -1.4, 1.42, 1.4, '#8c9399');
  },
  // 4 × 3: a white clinic with a glass entrance, a red-cross sign and a shaded holding pen
  vetclinic(g) {
    P(g, 'box', '#c9c4b8', 0, 0.03, 0, 3.9, 0.06, 2.9, false).receiveShadow = true;
    const bx = -0.55;
    P(g, 'box', '#f1efe8', bx, 0.6, -0.35, 2.7, 1.14, 2.0);
    P(g, 'box', '#9fb0b8', bx, 1.2, -0.35, 2.8, 0.08, 2.1);
    P(g, 'box', '#dcd8cf', bx, 1.27, -0.35, 2.6, 0.06, 1.9);
    // glass entrance porch
    P(g, 'box', '#bfe0ea', bx - 0.55, 0.42, 0.72, 0.9, 0.82, 0.16);
    P(g, 'box', '#9fb0b8', bx - 0.55, 0.88, 0.76, 1.05, 0.06, 0.32);
    P(g, 'box', '#5a6a72', bx - 0.55, 0.36, 0.81, 0.36, 0.7, 0.02, false);
    windowRow(g, bx + 0.05, bx + 1.25, 0.66, 0.65, 3, 1, '#d8d4cc');
    // red cross
    P(g, 'box', '#ffffff', bx + 0.3, 1.0, 0.66, 0.42, 0.24, 0.02, false);
    P(g, 'box', '#d8382a', bx + 0.3, 1.0, 0.68, 0.24, 0.07, 0.02, false);
    P(g, 'box', '#d8382a', bx + 0.3, 1.0, 0.68, 0.07, 0.2, 0.02, false);
    signBoard(g, 'ANIMAL HOSPITAL', '#ffffff', '#b2281c', bx - 0.55, 1.05, 0.93, 0.95);
    // holding pen with a shade roof and hay
    fencePanel(g, 0.95, -1.3, 1.85, -1.3, '#9a7550');
    fencePanel(g, 1.85, -1.3, 1.85, 0.55, '#9a7550');
    fencePanel(g, 0.95, 0.55, 1.85, 0.55, '#9a7550');
    for (const [px, pz] of [
      [1.05, -1.2],
      [1.75, -1.2],
      [1.05, -0.35],
      [1.75, -0.35],
    ])
      P(g, 'cyl', '#6b4a2e', px, 0.5, pz, 0.035, 1.0);
    P(g, 'box', '#6f7570', 1.4, 1.0, -0.78, 0.86, 0.04, 1.0);
    P(g, 'box', '#d8bf6a', 1.55, 0.12, -1.0, 0.36, 0.2, 0.26);
    P(g, 'box', '#d8c48a', 1.4, 0.065, -0.4, 0.86, 0.01, 1.85, false);
    // ambulance-van parking bay
    P(g, 'box', '#efeadc', 1.4, 0.065, 1.05, 0.9, 0.01, 0.06, false);
  },
  // 4 × 3: a raised concrete dock with roll-up doors into a small warehouse
  dock(g) {
    P(g, 'box', '#8f9590', 0, 0.03, 0, 3.9, 0.06, 2.9, false).receiveShadow = true;
    P(g, 'box', '#b9b7ae', 0, 0.2, 0.45, 3.8, 0.34, 1.9);
    for (let k = 0; k < 4; k++) P(g, 'box', '#2d2f31', -1.4 + k * 0.93, 0.2, 1.41, 0.22, 0.2, 0.08); // bumpers
    P(g, 'box', '#d8d2c0', 0, 0.75, -0.95, 3.8, 1.3, 0.95);
    for (const x of [-1.0, 0.3]) {
      P(g, 'box', '#9aa3a8', x, 0.72, -0.465, 0.95, 0.8, 0.02, false);
      for (let k = 0; k < 6; k++) P(g, 'box', '#7f888d', x, 0.4 + k * 0.13, -0.45, 0.95, 0.015, 0.012, false);
    }
    const rf = P(g, 'box', '#6f7570', 0, 1.45, -0.7, 3.95, 0.05, 1.5);
    rf.rotation.x = -0.08;
    signBoard(g, 'DELIVERIES', '#c9771f', '#ffffff', 1.3, 1.15, -0.46, 0.95);
    // a pallet jack
    P(g, 'box', '#c9771f', 1.4, 0.43, 0.9, 0.3, 0.06, 0.45);
    P(g, 'cyl', '#2d2f31', 1.4, 0.62, 0.68, 0.015, 0.4);
  },
  // 3 × 2: a barn-like store with sacks and hay
  feedstore(g) {
    P(g, 'box', '#b9ad92', 0, 0.03, 0, 2.9, 0.06, 1.9, false).receiveShadow = true;
    P(g, 'box', '#9b3b2c', 0, 0.55, -0.2, 2.4, 1.0, 1.25);
    gableRoof(g, '#5b5f63', 0, 1.05, -0.2, 2.6, 1.45, 0.55);
    for (const x of [-0.6, 0.6]) {
      P(g, 'box', '#f2ead8', x, 0.42, 0.43, 0.6, 0.78, 0.02, false);
      P(g, 'box', '#7d2c20', x, 0.42, 0.445, 0.5, 0.7, 0.02, false);
    }
    signBoard(g, 'FEED', '#f2ead8', '#7d2c20', 0, 0.95, 0.44, 0.6);
    for (let k = 0; k < 3; k++) P(g, 'box', '#d8c48a', -1.05 + k * 0.32, 0.12, 0.72, 0.26, 0.2, 0.32);
    P(g, 'box', '#d8bf6a', 1.1, 0.16, 0.7, 0.4, 0.26, 0.3);
  },
  // 6 × 4: asphalt with two rows of marked bays; the cars themselves are drawn by syncParkedCars()
  parking(g) {
    P(g, 'box', '#3b3d40', 0, 0.035, 0, 5.94, 0.05, 3.94, false).receiveShadow = true;
    for (const z of [-1.15, 1.15]) {
      for (let k = 0; k <= 7; k++) P(g, 'box', '#e8e6df', -2.975 + k * 0.85, 0.064, z, 0.03, 0.005, 1.3, false);
      P(g, 'box', '#e8e6df', 0, 0.064, z + (z < 0 ? -0.66 : 0.66), 5.95, 0.005, 0.03, false);
    }
    // arrows down the aisle
    for (const x of [-1.6, 1.6]) {
      const a = P(g, 'cone', '#e8e6df', x, 0.066, 0, 0.12, 0.004);
      a.rotation.z = Math.PI / 2;
    }
    for (const x of [-2.9, 2.9]) {
      P(g, 'cyl', '#5a6066', x, 0.75, 0, 0.03, 1.5);
      P(g, 'box', '#e9e4d0', x, 1.5, 0, 0.3, 0.05, 0.12);
    }
    signBoard(g, 'P', '#2c6fa8', '#ffffff', -2.6, 1.0, 1.95, 0.5);
    P(g, 'cyl', '#5a6066', -2.6, 0.45, 1.93, 0.025, 0.9);
  },
  // 2 × 2: a small block with two doors and a hedge
  restroom(g) {
    P(g, 'box', '#c9c4b8', 0, 0.03, 0, 1.9, 0.06, 1.9, false).receiveShadow = true;
    P(g, 'box', '#d8d4cc', 0, 0.52, -0.15, 1.6, 0.98, 1.2);
    P(g, 'box', '#7a8a92', 0, 1.04, -0.08, 1.8, 0.07, 1.45);
    door(g, -0.4, 0.45, '#2c6fa8', 0.36);
    door(g, 0.4, 0.45, '#b5492f', 0.36);
    P(g, 'box', '#2c6fa8', -0.4, 0.86, 0.48, 0.16, 0.16, 0.02, false);
    P(g, 'box', '#b5492f', 0.4, 0.86, 0.48, 0.16, 0.16, 0.02, false);
    P(g, 'box', '#9aa3a8', 0, 0.5, 0.47, 0.18, 0.4, 0.04);
    bush3(g, -0.75, 0.75, 0.8);
    bush3(g, 0.75, 0.75, 0.8);
  },
  // 2 × 2: a shop with display windows and a striped awning
  gift(g) {
    P(g, 'box', '#c9c4b8', 0, 0.03, 0, 1.9, 0.06, 1.9, false).receiveShadow = true;
    P(g, 'box', '#e8d8a8', 0, 0.58, -0.15, 1.7, 1.1, 1.3);
    P(g, 'box', '#b5492f', 0, 1.16, -0.15, 1.8, 0.1, 1.4);
    P(g, 'box', '#7fb7cf', -0.48, 0.48, 0.505, 0.62, 0.55, 0.02, false);
    P(g, 'box', '#7fb7cf', 0.48, 0.48, 0.505, 0.62, 0.55, 0.02, false);
    door(g, 0, 0.5, '#5b3c22', 0.34);
    for (let k = 0; k < 6; k++) {
      const s = P(g, 'box', k % 2 ? '#f4ebd4' : '#b5492f', -0.71 + k * 0.284, 0.92, 0.72, 0.284, 0.03, 0.45);
      s.rotation.x = 0.35;
    }
    signBoard(g, 'GIFTS', '#f2c94c', '#3a2405', 0, 1.0, 0.51, 0.8);
    // a few souvenirs out front
    P(g, 'cyl', '#2c6fa8', -0.65, 0.18, 0.85, 0.12, 0.3);
    P(g, 'cyl', '#e4573d', 0.65, 0.18, 0.85, 0.12, 0.3);
  },
  // 3 × 3: a dining hall at the back and a terrace of tables with umbrellas
  restaurant(g) {
    P(g, 'box', '#c9c4b8', 0, 0.03, 0, 2.9, 0.06, 2.9, false).receiveShadow = true;
    P(g, 'box', '#f2e9d0', 0, 0.6, -0.75, 2.6, 1.14, 1.3);
    gableRoof(g, '#2f6a48', 0, 1.17, -0.75, 2.8, 1.5, 0.45);
    windowRow(g, -1.2, -0.25, 0.62, -0.1, 2, 1);
    windowRow(g, 0.25, 1.2, 0.62, -0.1, 2, 1);
    door(g, 0, -0.1, '#5b3c22', 0.4);
    signBoard(g, 'RESTAURANT', '#2f6a48', '#f4ebd4', 0, 1.06, -0.08, 1.0);
    // terrace
    P(g, 'box', '#b98b5c', 0, 0.07, 0.75, 2.7, 0.04, 1.3);
    for (const [tx, tz, c] of [
      [-0.85, 0.55, '#e4573d'],
      [0, 0.95, '#f2c94c'],
      [0.85, 0.55, '#2c6fa8'],
    ]) {
      P(g, 'cyl', '#f4efe2', tx, 0.3, tz, 0.2, 0.03);
      P(g, 'cyl', '#5b3c22', tx, 0.18, tz, 0.02, 0.24);
      P(g, 'cyl', '#c9c4b8', tx, 0.5, tz, 0.012, 0.9);
      P(g, 'cone', c, tx, 0.95, tz, 0.42, 0.18);
      for (const a of [0.5, 2.6, 4.2])
        P(g, 'box', '#7a5230', tx + Math.cos(a) * 0.3, 0.13, tz + Math.sin(a) * 0.3, 0.12, 0.2, 0.12);
    }
    for (const px of [-1.3, 1.3]) bush3(g, px, 1.25, 0.7);
  },
  // 3 × 3: sandpit, climbing tower and slide, swings and a seesaw
  playground(g) {
    P(g, 'box', '#d8c48a', 0, 0.03, 0, 2.8, 0.06, 2.8, false).receiveShadow = true;
    for (const [px, pz] of [
      [-1.4, -1.4],
      [1.4, -1.4],
      [-1.4, 1.4],
      [1.4, 1.4],
    ])
      P(g, 'cyl', '#7a5230', px, 0.15, pz, 0.04, 0.3);
    // tower
    for (const [px, pz] of [
      [-0.95, -0.95],
      [-0.35, -0.95],
      [-0.95, -0.35],
      [-0.35, -0.35],
    ])
      P(g, 'cyl', '#2c6fa8', px, 0.55, pz, 0.035, 1.1);
    P(g, 'box', '#e4573d', -0.65, 0.6, -0.65, 0.7, 0.05, 0.7);
    P(g, 'cone', '#f2c94c', -0.65, 1.3, -0.65, 0.55, 0.4);
    const sl = P(g, 'box', '#f2c94c', 0.05, 0.32, -0.65, 0.95, 0.04, 0.3);
    sl.rotation.z = -0.6;
    // swings
    for (const px of [0.55, 1.25]) {
      const a1 = P(g, 'cyl', '#2f6a48', px, 0.55, 0.15, 0.035, 1.15);
      a1.rotation.x = 0.3;
      const a2 = P(g, 'cyl', '#2f6a48', px, 0.55, 0.75, 0.035, 1.15);
      a2.rotation.x = -0.3;
    }
    const bar = P(g, 'cyl', '#2f6a48', 0.9, 1.08, 0.45, 0.03, 0.75);
    bar.rotation.z = Math.PI / 2;
    for (const sx of [0.75, 1.05]) {
      P(g, 'cyl', '#9aa3a8', sx, 0.73, 0.45, 0.008, 0.7);
      P(g, 'box', '#e4573d', sx, 0.38, 0.45, 0.18, 0.03, 0.1);
    }
    // seesaw
    P(g, 'box', '#7a5230', -0.6, 0.12, 0.85, 0.1, 0.2, 0.1);
    const ss = P(g, 'box', '#e4573d', -0.6, 0.22, 0.85, 1.1, 0.04, 0.14);
    ss.rotation.z = 0.15;
  },
  // 4 × 3: tiered seating that rises away from the tank, under a canopy
  stage(g) {
    P(g, 'box', '#d6d1c6', 0, 0.03, 0, 3.9, 0.06, 2.9, false);
    for (let k = 0; k < 5; k++) {
      const z = 1.05 - k * 0.48,
        h = 0.18 + k * 0.22;
      P(g, 'box', '#d6d1c6', 0, h / 2, z, 3.7, h, 0.48);
      P(g, 'box', '#2c6fa8', 0, h + 0.03, z + 0.06, 3.6, 0.06, 0.26);
    }
    // railing along the tank side
    P(g, 'box', '#9aa3a8', 0, 0.35, 1.38, 3.8, 0.04, 0.04);
    for (let k = 0; k < 9; k++) P(g, 'cyl', '#9aa3a8', -1.8 + k * 0.45, 0.18, 1.38, 0.015, 0.36);
    // canopy
    for (const px of [-1.8, 1.8]) P(g, 'cyl', '#9aa3a8', px, 1.15, -1.3, 0.05, 2.3);
    const cn = P(g, 'box', '#e4573d', 0, 2.25, -0.55, 3.9, 0.05, 1.8);
    cn.rotation.x = -0.18;
    for (let k = 0; k < 5; k++)
      P(g, 'box', '#f4ebd4', -1.6 + k * 0.8, 2.25, -0.55, 0.36, 0.055, 1.82).rotation.x = -0.18;
    signBoard(g, 'SHOW STADIUM', '#2c6fa8', '#ffffff', 0, 1.75, -1.42, 1.4).rotation.y = Math.PI;
  },
  // 2 × 2: a tiered fountain
  fountain(g) {
    P(g, 'disc', '#c9c4b8', 0, 0.12, 0, 0.9, 0.24, 0.9);
    P(g, 'disc', waterMat, 0, 0.245, 0, 0.82, 0.02, 0.82, false);
    P(g, 'cyl', '#c9c4b8', 0, 0.5, 0, 0.1, 0.6);
    P(g, 'disc', '#c9c4b8', 0, 0.78, 0, 0.36, 0.07, 0.36);
    P(g, 'disc', waterMat, 0, 0.82, 0, 0.32, 0.02, 0.32, false);
    P(g, 'cyl', '#c9c4b8', 0, 1.0, 0, 0.05, 0.4);
    P(g, 'sph', '#c9c4b8', 0, 1.22, 0, 0.08);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.28;
      P(g, 'box', '#d8d4cc', Math.cos(a) * 0.95, 0.04, Math.sin(a) * 0.95, 0.3, 0.06, 0.3, false).rotation.y = a;
    }
  },
  // 2 × 2: an octagonal gazebo with a bench ring
  gazebo(g) {
    P(g, 'disc', '#d8d4cc', 0, 0.06, 0, 0.92, 0.12, 0.92);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.28 + 0.39;
      P(g, 'cyl', '#f2efe8', Math.cos(a) * 0.8, 0.62, Math.sin(a) * 0.8, 0.035, 1.0);
      if (k !== 0)
        P(g, 'box', '#f2efe8', Math.cos(a - 0.39) * 0.8, 0.35, Math.sin(a - 0.39) * 0.8, 0.6, 0.04, 0.04).rotation.y =
          -(a - 0.39) + Math.PI / 2;
    }
    P(g, 'cyl', '#f2efe8', 0, 1.14, 0, 0.92, 0.06);
    P(g, 'cone', '#6b3d22', 0, 1.45, 0, 1.0, 0.56);
    P(g, 'sph', '#c9a227', 0, 1.76, 0, 0.05);
  },
};
function makeBuilding(g, kind, w, d) {
  BUILDINGS[kind](g, w, d);
}

/* Parked cars: drawn as one instanced set, filled into lot bays in proportion to how many guests
   are in the zoo (about 3 per car), after the 15 roadside spaces. */
const CAR_COLORS = ['#c0392b', '#2c6fa8', '#ecf0f1', '#2d3436', '#7f8c8d', '#27ae60', '#f39c12', '#8e44ad'];
const CAR_MAX = 600;
// own materials, not the shared M() cache: batched scenery uses those without per-instance colour
const carBody = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.62, 0.22, 1.3),
    new THREE.MeshLambertMaterial({ color: 0xffffff }),
    CAR_MAX
  ),
  carCab = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.7),
    new THREE.MeshLambertMaterial({ color: LIN('#2a3a44') }),
    CAR_MAX
  );
carBody.castShadow = true;
carBody.setColorAt(0, new THREE.Color(1, 1, 1)); // sized from count, so before count is zeroed
for (const m of [carBody, carCab]) {
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
}
let carSyncAt = 0;
function syncParkedCars(time) {
  if (time - carSyncAt < 1000) return;
  carSyncAt = time;
  const lots = [];
  for (let i = 0; i < W * H; i++) if (S.tiles[i].o === 'parking' && isAnchor(i)) lots.push(i);
  let cars = Math.max(0, carsParked() - STREET_CARS),
    n = 0;
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  for (const a of lots) {
    const p = planOf(a),
      cx = p.x0 + p.fw / 2,
      cz = p.y0 + p.fh / 2,
      rot = (p.r * Math.PI) / 2,
      cs = Math.cos(rot),
      sn = Math.sin(rot);
    const fill = Math.min(LOT_SLOTS.length, Math.ceil((cars * LOT_SLOTS.length) / LOT_CARS));
    cars -= LOT_CARS;
    for (let k = 0; k < fill && n < CAR_MAX; k++) {
      // spread cars over the bays rather than packing one end
      const [lx, lz] = LOT_SLOTS[(k * 5) % LOT_SLOTS.length],
        wx = cx + lx * cs + lz * sn,
        wz = cz - lx * sn + lz * cs,
        y = heightAt(wx, wz);
      o.position.set(wx, y + 0.16, wz);
      o.rotation.set(0, rot, 0);
      o.updateMatrix();
      carBody.setMatrixAt(n, o.matrix);
      carBody.setColorAt(n, c.set(CAR_COLORS[(a + k * 7) % CAR_COLORS.length]).convertSRGBToLinear());
      o.position.y = y + 0.35;
      o.position.x -= Math.sin(rot) * 0.08;
      o.position.z -= Math.cos(rot) * 0.08;
      o.updateMatrix();
      carCab.setMatrixAt(n, o.matrix);
      n++;
    }
    if (cars <= 0) break;
  }
  carBody.count = carCab.count = n;
  carBody.instanceMatrix.needsUpdate = carCab.instanceMatrix.needsUpdate = true;
  if (carBody.instanceColor) carBody.instanceColor.needsUpdate = true;
}

/* Crates waiting on loading docks, and delivery trucks on the road: both drawn from simulation state
   every frame (there are only ever a few). */
const crateMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.3, 0.26, 0.3),
  new THREE.MeshLambertMaterial({ color: LIN('#b4874f') }),
  200
);
crateMesh.castShadow = true;
crateMesh.frustumCulled = false;
crateMesh.count = 0;
scene.add(crateMesh);
const bagMesh = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.12, 8, 6),
  new THREE.MeshLambertMaterial({ color: LIN('#1f2326') }),
  120
);
bagMesh.castShadow = true;
bagMesh.frustumCulled = false;
bagMesh.count = 0;
scene.add(bagMesh);
const truckGroups = new Map();
function makeTruck(type) {
  const g = new THREE.Group(),
    garbage = type === 'garbage';
  P(g, 'box', garbage ? '#2f7a46' : '#f4f1ea', 0, 0.42, -0.25, 0.62, 0.62, 1.3); // body
  P(g, 'box', garbage ? '#e8e6df' : '#c9771f', 0, 0.36, 0.62, 0.6, 0.5, 0.44); // cab
  P(g, 'box', '#2a3a44', 0, 0.48, 0.85, 0.52, 0.2, 0.02, false); // windscreen
  for (const [x, z] of [
    [-0.3, -0.6],
    [0.3, -0.6],
    [-0.3, 0.55],
    [0.3, 0.55],
  ]) {
    const w = P(g, 'cyl', '#1d1f21', x, 0.11, z, 0.11, 0.08);
    w.rotation.z = Math.PI / 2;
  }
  signBoard(
    g,
    garbage ? 'RECYCLING' : 'SUPPLIES',
    garbage ? '#2f7a46' : '#f4f1ea',
    garbage ? '#ffffff' : '#c9771f',
    0.312,
    0.5,
    -0.25,
    0.7
  ).rotation.y = Math.PI / 2;
  scene.add(g);
  return g;
}
function syncDeliveries(alpha) {
  // crates: stacked in rows on the dock platform
  const o = new THREE.Object3D();
  let n = 0;
  const perDock = new Map();
  for (const c of S.crates) {
    if (n >= 200) break;
    const k = perDock.get(c.dock) || 0;
    perDock.set(c.dock, k + 1);
    if (!S.tiles[c.dock] || S.tiles[c.dock].o !== 'dock') continue;
    const p = planOf(c.dock),
      cx = p.x0 + p.fw / 2,
      cz = p.y0 + p.fh / 2,
      rot = (p.r * Math.PI) / 2,
      lx = -1.5 + (k % 8) * 0.36,
      lz = 0.3 + Math.floor(k / 8) * 0.34;
    o.position.set(
      cx + lx * Math.cos(rot) + lz * Math.sin(rot),
      heightAt(cx, cz) + 0.5,
      cz - lx * Math.sin(rot) + lz * Math.cos(rot)
    );
    o.rotation.set(0, rot, 0);
    o.updateMatrix();
    crateMesh.setMatrixAt(n++, o.matrix);
  }
  crateMesh.count = n;
  crateMesh.instanceMatrix.needsUpdate = true;
  // trash bags in front of the skips, one per 10 bags of waste
  let b = 0,
    left = Math.ceil(S.waste / 10);
  for (let i = 0; i < W * H && left > 0; i++) {
    if (S.tiles[i].o !== 'recycle' || !isAnchor(i)) continue;
    const p = planOf(i),
      cx = p.x0 + p.fw / 2,
      cz = p.y0 + p.fh / 2,
      rot = (p.r * Math.PI) / 2;
    for (let k = 0; k < 15 && left > 0 && b < 120; k++, left--) {
      const lx = -1.2 + (k % 5) * 0.28,
        lz = -0.1 + Math.floor(k / 5) * 0.24;
      o.position.set(
        cx + lx * Math.cos(rot) + lz * Math.sin(rot),
        heightAt(cx, cz) + 0.14,
        cz - lx * Math.sin(rot) + lz * Math.cos(rot)
      );
      o.rotation.set(0, k, 0);
      o.updateMatrix();
      bagMesh.setMatrixAt(b++, o.matrix);
    }
  }
  bagMesh.count = b;
  bagMesh.instanceMatrix.needsUpdate = true;
  // trucks
  const live = new Set();
  for (const t of S.trucks) {
    live.add(t.id);
    let g = truckGroups.get(t.id);
    if (!g) truckGroups.set(t.id, (g = makeTruck(t.type)));
    const x = t.ox + (t.x - t.ox) * alpha,
      z = t.oy + (t.y - t.oy) * alpha;
    g.position.set(x, heightAt(x, z), z);
    g.rotation.y = t.dir || 0;
  }
  for (const [id, g] of truckGroups)
    if (!live.has(id)) {
      scene.remove(g);
      truckGroups.delete(id);
    }
}
