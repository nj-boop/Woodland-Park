/* The staff and guest buildings, assembled from the architecture kit (render/arch.js). Each is built
   in local space, front (door side) facing +z, centred on its footprint. These replace the plain
   boxes that used to stand in for them; the scenes in render/vignettes.js still line up with the
   restaurant terrace, the gift shop till and the hospital's operating theatre. */

// tools leaning on a wall: rake, shovel, broom
function aTools(g, x, z) {
  for (const [dx, head, hc] of [
    [0, [0.14, 0.02, 0.03], '#8d9599'],
    [0.09, [0.08, 0.1, 0.015], '#8d9599'],
    [0.18, [0.12, 0.05, 0.04], '#c9a85c'],
  ]) {
    const s = P(g, 'cyl', '#8a6440', x + dx, 0.36, z, 0.012, 0.72, 0.012, false);
    s.rotation.x = -0.14;
    P(g, 'box', hc, x + dx, 0.05 + (head[1] > 0.05 ? 0.02 : 0), z + 0.055, head[0] * 0.6, head[1], head[2], false);
  }
}
function aWheelbarrow(g, x, z, ry) {
  const f = aFace(g, x, 0, z, ry);
  P(f, 'box', '#3f7a5a', 0, 0.2, 0, 0.26, 0.12, 0.36);
  P(f, 'sph', '#d8bf6a', 0, 0.27, 0, 0.11, 0.05, 0.15, false);
  P(f, 'cyl', '#1d1f21', 0, 0.08, 0.22, 0.08, 0.04, 0.08, false).rotation.z = Math.PI / 2;
  for (const sx of [-1, 1]) P(f, 'box', '#8a6440', sx * 0.11, 0.2, -0.3, 0.02, 0.02, 0.3, false);
}
// a short run of yard fencing between two points (posts and two rails)
function aYardFence(g, x0, z0, x1, z1, col, h = 0.5) {
  const len = Math.hypot(x1 - x0, z1 - z0),
    f = aFace(g, (x0 + x1) / 2, 0, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2);
  for (const y of [h * 0.45, h * 0.9]) P(f, 'box', col, 0, y, 0, len, 0.035, 0.03, false);
  const n = Math.max(2, Math.round(len / 0.45) + 1);
  for (let k = 0; k < n; k++)
    P(f, 'box', shadeHex(col, 0.8), -len / 2 + (k / (n - 1)) * len, h / 2, 0, 0.045, h, 0.045);
  return f;
}
function aWheelieBins(g, x, z, n, ry) {
  const f = aFace(g, x, 0, z, ry);
  for (let k = 0; k < n; k++) {
    const c = ['#2f7a46', '#2c6fa8', '#f2c94c', '#6b6b6b'][k % 4];
    P(f, 'box', c, k * 0.27, 0.2, 0, 0.22, 0.38, 0.24);
    P(f, 'box', shadeHex(c, 0.7), k * 0.27, 0.4, 0.01, 0.24, 0.03, 0.27, false);
  }
}

Object.assign(BUILDINGS, {
  /* ------------------------------------------------------------ keepers ---------- */
  // 3 × 2: a log cabin with a full-width porch, a stone chimney and a feed lean-to
  lodge(g) {
    aSlab(g, 3, 2, '#b9ad92');
    const cx = -0.3,
      cz = -0.25,
      w = 2.1,
      d = 1.2;
    aBlock(g, 'stone', '#9a9488', cx, 0.06, cz, w + 0.04, 0.2, d + 0.04);
    aBlock(g, 'plank', '#8f6842', cx, 0.26, cz, w, 1.02, d);
    aTrim(g, cx, cz, w, d, 0.26, 1.28, '#6b4a2e');
    aGable(g, 'shingle', '#3f6a3a', cx, 1.28, cz, w, d, 0.56, { end: '#7d5a38', trim: '#e8dcc0', over: 0.14 });
    aChimney(g, 'stone', '#9a9488', cx + 0.72, cz - 0.2, 0.06, 2.0, 0.24);
    // porch
    P(g, 'box', '#9a7550', cx, 0.1, 0.57, w, 0.08, 0.46);
    aVeranda(g, cx - w / 2, cx + w / 2, 0.35, 0.46, 1.22, 'shingle', '#3f6a3a', '#6b4a2e', 4);
    for (const px of [-1.0, 0.4]) P(g, 'box', '#6b4a2e', px, 0.36, 0.77, 0.6, 0.03, 0.03, false);
    aDoor(g, cx - 0.3, 0.35, 0, 0.36, 0.72, '#5b3c22', { y: 0.14, step: false, lamp: true });
    aWin(g, cx + 0.4, 0.74, 0.35, 0, 0.5, 0.36, { shutters: '#3f6a3a', box: true });
    aWin(g, cx - 0.82, 0.74, 0.35, 0, 0.26, 0.36, { shutters: '#3f6a3a' });
    aWin(g, cx - w / 2, 0.74, cz, -Math.PI / 2, 0.42, 0.36, { shutters: '#3f6a3a' });
    for (const px of [-0.55, 0.3]) aWin(g, cx + px, 0.74, cz - d / 2, Math.PI, 0.4, 0.36, {});
    aSign(g, 'KEEPERS', '#3a2a1e', '#f2e2b6', cx, 1.3, 0.86, 0, 0.9);
    // feed lean-to, hay and firewood
    aBlock(g, 'vplank', '#a8865a', 1.08, 0.06, -0.35, 0.62, 0.8, 0.9);
    const lr = aSlabRoof(g, 'metal', '#7d8a86', 0.76, 1.06);
    lr.position.set(1.08, 0.94, -0.35);
    lr.rotation.z = -0.2;
    aRollDoor(g, 1.08, 0.06, 0.1, 0, 0.44, 0.6, '#c9b27c', 0.5);
    aHay(g, 1.0, 0.06, 0.5, 0.2);
    aHay(g, 1.22, 0.06, 0.62, -0.3);
    aHay(g, 1.1, 0.26, 0.55, 0.1);
    for (let k = 0; k < 6; k++)
      P(g, 'cyl', '#7a5230', -1.38, 0.1 + Math.floor(k / 2) * 0.1, cz - 0.25 + (k % 2) * 0.11, 0.05, 0.5).rotation.z =
        Math.PI / 2;
    aBarrel(g, cx + 0.85, 0.62, '#4a6a7a');
  },
  // 2 × 2: a keepers' hut for the far corners of the zoo
  keeperhut(g) {
    aSlab(g, 2, 2, '#b9ad92');
    aBlock(g, 'stone', '#9a9488', -0.2, 0.06, -0.25, 1.34, 0.14, 1.14);
    aBlock(g, 'vplank', '#6f8a5e', -0.2, 0.2, -0.25, 1.3, 0.95, 1.1);
    aTrim(g, -0.2, -0.25, 1.3, 1.1, 0.2, 1.15, '#e8dcc0');
    const r = aSlabRoof(g, 'metal', '#5d6e68', 1.56, 1.42);
    r.position.set(-0.2, 1.3, -0.25);
    r.rotation.x = 0.2;
    P(g, 'box', '#6f8a5e', -0.2, 1.22, -0.72, 1.3, 0.22, 0.04, false);
    aDoor(g, -0.5, 0.3, 0, 0.34, 0.7, '#3d4f36', { y: 0.14, lamp: true });
    aWin(g, 0.08, 0.72, 0.3, 0, 0.36, 0.32, { box: true });
    aWin(g, 0.45, 0.72, -0.25, Math.PI / 2, 0.36, 0.32, {});
    aSign(g, 'KEEPERS', '#3a2a1e', '#f2e2b6', -0.2, 1.06, 0.33, 0, 0.6);
    aTools(g, -0.78, -0.86);
    aWheelbarrow(g, 0.62, 0.55, 0.6);
    aHay(g, 0.65, 0.06, -0.55, 0.2);
    aHay(g, 0.68, 0.26, -0.55, -0.1);
    aBarrel(g, -0.78, 0.5, '#4a6a7a');
    P(g, 'cyl', '#8d9599', 0.3, 0.14, 0.62, 0.07, 0.16); // bucket
  },
  // 5 × 3: keeper headquarters, two storeys of stone and timber with a cart garage
  keeperhq(g) {
    aSlab(g, 5, 3, '#b9ad92');
    const cx = -0.9,
      cz = -0.4,
      w = 2.8,
      d = 1.8;
    aBlock(g, 'stone', '#9a9488', cx, 0.06, cz, w, 1.06, d);
    aBlock(g, 'plank', '#8f6842', cx, 1.12, cz, w + 0.1, 0.98, d + 0.1);
    P(g, 'box', '#6b4a2e', cx, 1.12, cz, w + 0.14, 0.06, d + 0.14, false);
    aTrim(g, cx, cz, w + 0.1, d + 0.1, 1.12, 2.1, '#6b4a2e');
    aGable(g, 'shingle', '#35603a', cx, 2.1, cz, w + 0.1, d + 0.1, 0.78, {
      end: '#7d5a38',
      trim: '#e8dcc0',
      over: 0.16,
    });
    aChimney(g, 'stone', '#9a9488', cx - 0.95, cz - 0.3, 2.1, 3.0, 0.26);
    aVent(g, cx + 0.6, 2.6, cz - 0.35);
    // ground floor: glass double door under a balcony, windows either side
    aDoor(g, cx, cz + d / 2, 0, 0.62, 0.8, '#3d4f36', { double: true, glass: true, y: 0.06, lamp: false });
    for (const px of [-0.95, 0.95]) aWin(g, cx + px, 0.66, cz + d / 2, 0, 0.52, 0.42, { box: true });
    P(g, 'box', '#8a6a48', cx, 1.14, cz + d / 2 + 0.2, 1.3, 0.05, 0.4);
    for (const px of [-0.6, 0.6]) P(g, 'cyl', '#6b4a2e', cx + px, 0.6, cz + d / 2 + 0.36, 0.04, 1.08);
    aYardFence(g, cx - 0.64, cz + d / 2 + 0.39, cx + 0.64, cz + d / 2 + 0.39, '#6b4a2e', 0.26).position.y = 1.16;
    aDoor(g, cx, cz + d / 2 + 0.05, 0, 0.34, 0.62, '#5b3c22', { y: 1.16, step: false });
    for (const px of [-1.0, -0.5, 0.5, 1.0])
      aWin(g, cx + px, 1.6, cz + d / 2 + 0.05, 0, 0.32, 0.4, { shutters: '#35603a' });
    for (const sx of [-1, 1])
      for (const pz of [-0.45, 0.45]) {
        if (sx > 0 && pz < 0) continue; // the garage wing covers this stretch
        aWin(g, cx + sx * (w / 2), 0.66, cz + pz, (sx * Math.PI) / 2, 0.42, 0.42, {});
        aWin(g, cx + sx * (w / 2 + 0.05), 1.6, cz + pz, (sx * Math.PI) / 2, 0.36, 0.4, { shutters: '#35603a' });
      }
    for (const px of [-0.9, 0, 0.9]) {
      aWin(g, cx + px, 0.66, cz - d / 2, Math.PI, 0.42, 0.42, {});
      aWin(g, cx + px, 1.6, cz - d / 2 - 0.05, Math.PI, 0.36, 0.4, {});
    }
    aSign(g, 'KEEPER HQ', '#3a2a1e', '#f2e2b6', cx, 2.32, cz + d / 2 + 0.07, 0, 1.2);
    aPipe(g, cx - w / 2 - 0.03, cz + d / 2 - 0.05, 2.1);
    // cart garage wing
    const gx = 1.45,
      gz = -0.55;
    aBlock(g, 'vplank', '#7a6a52', gx, 0.06, gz, 1.7, 1.12, 1.5);
    aGable(g, 'metal', '#5d6e68', gx, 1.18, gz, 1.5, 1.7, 0.4, { axis: 'z', end: '#7a6a52', over: 0.1 });
    aRollDoor(g, gx - 0.4, 0.06, gz + 0.75, 0, 0.66, 0.86, '#c9cdc6', 0.7);
    aRollDoor(g, gx + 0.4, 0.06, gz + 0.75, 0, 0.66, 0.86, '#c9cdc6', 0);
    aWin(g, gx + 0.85, 0.7, gz, Math.PI / 2, 0.5, 0.36, {});
    aCart(g, gx - 0.4, 0.75, 0.15, '#3f7a5a');
    // the yard: notice board, planters, bench, flag
    aPlanter(g, cx - 0.95, cz + d / 2 + 0.3, 0.7, 0, true);
    aPlanter(g, cx + 0.95, cz + d / 2 + 0.3, 0.7, 0, true);
    P(g, 'cyl', '#c9c4b8', -2.25, 1.2, 1.2, 0.02, 2.4);
    P(g, 'box', '#35603a', -2.07, 2.2, 1.2, 0.34, 0.22, 0.012, false);
    for (const px of [1.55, 2.05]) P(g, 'cyl', '#6b4a2e', px, 0.3, 1.25, 0.025, 0.6);
    aSign(g, 'ROTA', '#f1ece2', '#3a2a1e', 1.8, 0.48, 1.25, 0, 0.56);
    aHay(g, 2.1, 0.06, 0.5, 0.3);
    aHay(g, 2.12, 0.26, 0.5, 0);
    aTools(g, 2.2, -1.32);
  },

  /* ------------------------------------------------------------ janitors ---------- */
  // 3 × 3: an open sorting shed with colour-coded skips, a baler, compost and a chain-link yard
  recycle(g) {
    aSlab(g, 3, 3, '#a9aba4');
    for (const px of [-1.3, -0.43, 0.43, 1.3]) {
      P(g, 'box', '#5a6066', px, 0.68, -1.12, 0.07, 1.36, 0.07);
      P(g, 'box', '#5a6066', px, 0.58, -0.3, 0.07, 1.16, 0.07);
    }
    const roof = aSlabRoof(g, 'metal', '#7d8a86', 2.9, 1.16);
    roof.position.set(0, 1.3, -0.72);
    roof.rotation.x = 0.2;
    aBlock(g, 'metal', '#8f9590', 0, 0.06, -1.34, 2.72, 1.0, 0.06);
    for (const [bx, c] of [
      [-0.9, '#2f7a46'],
      [0, '#2c6fa8'],
      [0.9, '#6b6b6b'],
    ]) {
      P(g, 'box', c, bx, 0.3, -0.8, 0.72, 0.46, 0.56);
      P(g, 'box', shadeHex(c, 0.8), bx, 0.31, -0.8, 0.74, 0.05, 0.58, false);
      const lid = P(g, 'box', '#1f2a26', bx, 0.58, -0.86, 0.74, 0.03, 0.5);
      lid.rotation.x = -0.3;
      P(g, 'box', '#f4efe2', bx, 0.36, -0.515, 0.26, 0.12, 0.01, false);
    }
    // baler and bales of card
    P(g, 'box', '#c9771f', 1.0, 0.36, 0.15, 0.5, 0.6, 0.4);
    P(g, 'box', '#3d4347', 1.0, 0.72, 0.15, 0.3, 0.14, 0.26);
    for (const [bx, by, bz] of [
      [0.4, 0.06, 0.2],
      [0.4, 0.3, 0.2],
      [0.12, 0.06, 0.24],
    ])
      aCrate(g, bx, by, bz, 0.24, '#b89a6a');
    const heap = P(g, 'sph', '#5a4128', -0.8, 0.06, 0.55, 0.62, 0.36, 0.5);
    heap.receiveShadow = true;
    P(g, 'sph', '#6f5433', -0.62, 0.1, 0.72, 0.3, 0.2, 0.26);
    P(g, 'cyl', '#8a6440', -0.6, 0.42, 0.45, 0.012, 0.6).rotation.z = 0.4; // fork stuck in the heap
    aWheelieBins(g, 0.3, 0.98, 4, 0);
    aSign(g, 'RECYCLING', '#2f7a46', '#ffffff', -0.55, 0.72, 1.33, 0, 1.0);
    for (const px of [-0.98, -0.12]) P(g, 'cyl', '#5a6066', px, 0.36, 1.33, 0.025, 0.72);
    for (const sx of [-1.42, 1.42]) {
      for (const pz of [-0.9, 0, 0.9]) fenceRun(g, 'chain', sx, pz, 1, 0, 0);
      for (const pz of [-1.4, -0.45, 0.45, 1.4]) fencePost(g, 'chain', sx, pz, false);
    }
  },
  // 4 × 3: the maintenance depot, a ribbed-metal workshop with a sweeper and a fenced store
  depot(g) {
    aSlab(g, 4, 3, '#9a9c96');
    const cx = -0.45,
      cz = -0.6,
      w = 2.8,
      d = 1.5;
    aBlock(g, 'stucco', '#b9b7ae', cx, 0.06, cz, w + 0.04, 0.24, d + 0.04);
    aBlock(g, 'metal', '#7f9aa6', cx, 0.3, cz, w, 1.2, d);
    const r = aSlabRoof(g, 'metal', '#5a6a72', w + 0.3, d + 0.5);
    r.position.set(cx, 1.62, cz + 0.08);
    r.rotation.x = 0.13;
    P(g, 'box', '#7f9aa6', cx, 1.56, cz - d / 2 + 0.02, w, 0.14, 0.04, false);
    aRollDoor(g, cx - 0.8, 0.06, cz + d / 2, 0, 0.9, 1.0, '#d8dcd6', 0.75);
    aRollDoor(g, cx + 0.25, 0.06, cz + d / 2, 0, 0.9, 1.0, '#d8dcd6', 0);
    aDoor(g, cx + 1.08, cz + d / 2, 0, 0.3, 0.72, '#c9771f', { y: 0.06, lamp: true });
    aSign(g, 'MAINTENANCE', '#c9771f', '#ffffff', cx - 0.25, 1.3, cz + d / 2 + 0.03, 0, 1.3);
    for (const pz of [-0.35, 0.35]) aWin(g, cx - w / 2, 0.95, cz + pz, -Math.PI / 2, 0.42, 0.3, {});
    for (const px of [-0.9, 0, 0.9]) aWin(g, cx + px, 1.05, cz - d / 2, Math.PI, 0.5, 0.26, { bars: false });
    aAC(g, cx + 0.8, 1.58, cz - 0.2);
    aVent(g, cx - 0.9, 1.6, cz - 0.1);
    // inside the open bay: shelving
    P(g, 'box', '#5a6066', cx - 0.8, 0.5, cz + 0.3, 0.8, 0.8, 0.12);
    for (const y of [0.3, 0.55, 0.8]) P(g, 'box', '#c9771f', cx - 0.8, y, cz + 0.37, 0.7, 0.1, 0.06, false);
    // the yard: sweeper, ladder, cones, paint, bins, and a fenced corner of mulch sacks
    const sw = aFace(g, cx - 0.75, 0, 0.95, 0.3);
    P(sw, 'box', '#f2c94c', 0, 0.26, 0, 0.42, 0.32, 0.66);
    P(sw, 'box', '#2a3a44', 0, 0.42, 0.2, 0.36, 0.16, 0.02, false);
    P(sw, 'cyl', '#3d4347', 0, 0.09, 0.36, 0.09, 0.44).rotation.z = Math.PI / 2;
    for (const sx of [-1, 1])
      P(sw, 'cyl', '#1d1f21', sx * 0.2, 0.08, -0.18, 0.08, 0.05, 0.08, false).rotation.z = Math.PI / 2;
    const lad = aFace(g, cx + w / 2 + 0.06, 0, cz - 0.2, Math.PI / 2);
    for (const sx of [-0.1, 0.1]) P(lad, 'box', '#c9c4b8', sx, 0.6, 0.08, 0.02, 1.2, 0.02, false).rotation.x = -0.12;
    for (let k = 0; k < 6; k++)
      P(lad, 'box', '#c9c4b8', 0, 0.15 + k * 0.18, 0.14 - k * 0.022, 0.2, 0.018, 0.018, false);
    for (let k = 0; k < 3; k++) P(g, 'cone', '#e8762a', cx + 0.2 + k * 0.03, 0.14 + k * 0.05, 0.6, 0.07, 0.2);
    for (const [px, c] of [
      [0.5, '#f4efe2'],
      [0.64, '#2c6fa8'],
      [0.57, '#b5492f'],
    ])
      P(g, 'cyl', c, cx + px, px === 0.57 ? 0.2 : 0.11, 0.42 + (px === 0.57 ? 0 : 0), 0.055, 0.1);
    aWheelieBins(g, cx + 0.95, 0.3, 2, 0);
    aYardFence(g, 1.15, -1.38, 1.88, -1.38, '#8c9399', 0.6);
    aYardFence(g, 1.88, -1.38, 1.88, 0.3, '#8c9399', 0.6);
    aYardFence(g, 1.15, 0.3, 1.88, 0.3, '#8c9399', 0.6);
    for (let k = 0; k < 5; k++)
      aSack(g, 1.4 + (k % 2) * 0.24, 0.06 + Math.floor(k / 2) * 0.13, -1.0 + (k % 2) * 0.05, '#7a8f5a');
    for (let k = 0; k < 3; k++) aCrate(g, 1.5, 0.06 + k * 0.22, -0.3, 0.22, '#9a7a4a');
    aTools(g, 1.3, 0.2);
  },

  /* ------------------------------------------------------------ animal care ---------- */
  // 3 × 2: the animal house. Back wall (−z) on the habitat fence with the animals' slatted hatch;
  // the front (+z) has the staff door, a viewing window and a sign, and opens onto the road
  animalhouse(g) {
    aSlab(g, 3, 2, '#b8b2a4');
    aBlock(g, 'stone', '#948a78', 0, 0.06, 0, 2.7, 0.46, 1.6);
    aBlock(g, 'vplank', '#7a5536', 0, 0.52, 0, 2.66, 0.66, 1.56);
    aTrim(g, 0, 0, 2.66, 1.56, 0.52, 1.18, '#5a4030');
    aGable(g, 'shingle', '#4b5a4a', 0, 1.18, 0, 2.66, 1.56, 0.56, { end: '#7a5536', trim: '#e8dcc0', over: 0.12 });
    // roof vent cupola
    P(g, 'box', '#7a5536', 0, 1.82, 0, 0.36, 0.2, 0.3);
    aHip(g, '#4b5a4a', 0, 1.92, 0, 0.36, 0.3, 0.16, 0.06);
    for (const px of [-0.8, 0.8]) P(g, 'box', WINGLASS, px, 1.5, 0.42, 0.4, 0.02, 0.3, false).rotation.x = 0.62; // skylights
    // back: the animals' hatch, a wide slatted door against the fence
    P(g, 'box', '#2a1e14', 0, 0.52, -0.79, 1.24, 0.92, 0.02, false);
    for (let k = 0; k < 5; k++) P(g, 'box', '#9a7a52', 0, 0.14 + k * 0.2, -0.8, 1.28, 0.07, 0.03, false);
    for (const sx of [-1, 1]) P(g, 'box', '#5a4030', sx * 0.66, 0.52, -0.8, 0.07, 0.96, 0.05, false);
    // front: staff door, viewing window, sign, lamp
    aDoor(g, -0.85, 0.8, 0, 0.4, 0.8, '#2f4f3e', { y: 0.06, lamp: true });
    aWin(g, 0.45, 0.72, 0.8, 0, 1.1, 0.44, { frame: '#5a4030', bars: false });
    aSign(g, 'ANIMAL HOUSE', '#f1ece2', '#5a3a22', 0.45, 1.08, 0.82, 0, 1.1);
    for (const sx of [-1, 1]) aWin(g, sx * 1.33, 0.82, 0, (sx * Math.PI) / 2, 0.5, 0.3, { frame: '#5a4030' });
    aPipe(g, 1.3, 0.76, 1.18);
    aHay(g, 1.15, 0.06, -0.92, 0);
    aHay(g, 1.15, 0.26, -0.92, 0.2);
    P(g, 'box', '#6d757b', -1.1, 0.14, -0.9, 0.44, 0.16, 0.2); // water trough
    P(g, 'box', '#6fb5c4', -1.1, 0.2, -0.9, 0.4, 0.05, 0.16, false);
  },
  // 4 × 3: the veterinary hospital. Guests watch surgery through the glass theatre at the front.
  vetclinic(g) {
    aSlab(g, 4, 3, '#c9c4b8');
    const bx = -0.55,
      cz = -0.35,
      w = 2.7,
      d = 2.0,
      top = 1.62;
    aBlock(g, 'stucco', '#dcd8cf', bx, 0.06, cz, w + 0.04, 0.2, d + 0.04);
    aBlock(g, 'stucco', '#f4f2ec', bx, 0.26, cz, w, top - 0.26, d);
    P(g, 'box', '#2f8f5a', bx, 1.36, cz, w + 0.02, 0.1, d + 0.02, false); // green band
    const deck = aFlat(g, '#e6e2d8', bx, top, cz, w + 0.08, d + 0.08, '#9fb0b8');
    aAC(g, bx - 0.8, deck, cz - 0.4);
    aAC(g, bx - 0.3, deck, cz - 0.4);
    aVent(g, bx + 0.9, deck, cz - 0.5);
    // rooftop sign: a green cross you can see from across the zoo
    P(g, 'box', '#f4f2ec', bx + 0.55, deck + 0.42, cz + 0.55, 0.62, 0.62, 0.1);
    for (const sz of [-1, 1]) aCross(g, bx + 0.55, deck + 0.42, cz + 0.55 + sz * 0.052, sz > 0 ? 0 : Math.PI, 0.38);
    for (const px of [0.38, 0.72]) P(g, 'box', '#8d9599', bx + px, deck + 0.06, cz + 0.55, 0.04, 0.12, 0.04);
    // glass entrance porch
    P(g, 'box', GLASS, bx - 0.55, 0.5, 0.78, 0.96, 0.9, 0.3, false);
    for (const sx of [-1, 1]) P(g, 'box', '#9fb0b8', bx - 0.55 + sx * 0.48, 0.5, 0.92, 0.04, 0.94, 0.04);
    P(g, 'box', '#9fb0b8', bx - 0.55, 0.98, 0.8, 1.1, 0.06, 0.38);
    aDoor(g, bx - 0.55, 0.65, 0, 0.5, 0.78, '#5a6a72', { double: true, glass: true, y: 0.06, frame: '#9fb0b8' });
    aSign(g, 'ANIMAL HOSPITAL', '#ffffff', '#2f8f5a', bx - 0.55, 1.14, 0.96, 0, 1.0);
    for (const px of [0.1, 0.65, 1.2]) aWin(g, bx + px, 1.02, 0.65, 0, 0.4, 0.34, { frame: '#d8d4cc', bars: false });
    theatreBay(g, bx + 0.65, 1.0);
    for (const pz of [-0.6, 0.2]) aWin(g, bx - w / 2, 0.82, cz + pz, -Math.PI / 2, 0.5, 0.5, { frame: '#d8d4cc' });
    for (const px of [-0.9, 0, 0.9]) aWin(g, bx + px, 0.82, cz - d / 2, Math.PI, 0.5, 0.5, { frame: '#d8d4cc' });
    aWin(g, bx + w / 2, 0.82, cz - 0.7, Math.PI / 2, 0.4, 0.5, { frame: '#d8d4cc' });
    aDoor(g, bx + w / 2, cz - 0.1, Math.PI / 2, 0.36, 0.74, '#2f8f5a', { y: 0.06 });
    aPipe(g, bx - w / 2 - 0.03, cz - d / 2 + 0.08, top);
    // holding pen with a shade roof and hay
    aYardFence(g, 0.95, -1.3, 1.85, -1.3, '#9a7550');
    aYardFence(g, 1.85, -1.3, 1.85, 0.55, '#9a7550');
    aYardFence(g, 0.95, 0.55, 1.85, 0.55, '#9a7550');
    for (const [px, pz] of [
      [1.05, -1.2],
      [1.75, -1.2],
      [1.05, -0.35],
      [1.75, -0.35],
    ])
      P(g, 'cyl', '#6b4a2e', px, 0.52, pz, 0.035, 1.0);
    const pr = aSlabRoof(g, 'metal', '#6f7570', 0.9, 1.05);
    pr.position.set(1.4, 1.04, -0.78);
    pr.rotation.z = -0.1;
    aHay(g, 1.55, 0.07, -1.0, 0.2);
    P(g, 'box', '#d8c48a', 1.4, 0.065, -0.4, 0.86, 0.01, 1.85, false);
    P(g, 'box', '#efeadc', 1.4, 0.065, 1.05, 0.9, 0.01, 0.06, false); // ambulance bay line
    aPlanter(g, bx - 1.2, 0.95, 0.3, 0, true);
  },
  // 3 × 2: a vet station for behind the scenes: a small surgery cottage with a kennel run
  vetstation(g) {
    aSlab(g, 3, 2, '#c9c4b8');
    const cx = -0.42,
      cz = -0.2,
      w = 1.8,
      d = 1.2;
    aBlock(g, 'brick', '#8fa79a', cx, 0.06, cz, w + 0.04, 0.34, d + 0.04);
    aBlock(g, 'stucco', '#f1f0ea', cx, 0.4, cz, w, 0.78, d);
    aGable(g, 'tile', '#5d8f7c', cx, 1.18, cz, w, d, 0.5, { end: '#f1f0ea', trim: '#2f8f5a', over: 0.12 });
    aDoor(g, cx - 0.4, cz + d / 2, 0, 0.36, 0.74, '#2f8f5a', { glass: true, y: 0.06, lamp: true });
    aWin(g, cx + 0.38, 0.76, cz + d / 2, 0, 0.56, 0.38, { frame: '#d8d4cc', awn: ['#2f8f5a', '#f4f2ec'] });
    aCross(g, cx, 1.4, cz + d / 2 + 0.02, 0, 0.22);
    aSign(g, 'VET STATION', '#ffffff', '#2f8f5a', cx + 0.38, 0.36, cz + d / 2 + 0.03, 0, 0.6);
    aWin(g, cx - w / 2, 0.78, cz, -Math.PI / 2, 0.42, 0.36, { frame: '#d8d4cc' });
    for (const px of [-0.45, 0.45]) aWin(g, cx + px, 0.78, cz - d / 2, Math.PI, 0.4, 0.36, { frame: '#d8d4cc' });
    aAC(g, cx + 0.5, 0.06, cz - d / 2 - 0.18);
    // kennel run down the side
    aYardFence(g, 0.6, -0.8, 1.36, -0.8, '#8c9399', 0.62);
    aYardFence(g, 1.36, -0.8, 1.36, 0.42, '#8c9399', 0.62);
    aYardFence(g, 0.6, 0.42, 1.36, 0.42, '#8c9399', 0.62);
    P(g, 'box', '#d8c48a', 0.98, 0.065, -0.19, 0.72, 0.01, 1.18, false);
    aBlock(g, 'vplank', '#9a7a52', 1.0, 0.06, -0.55, 0.46, 0.34, 0.36);
    aHip(g, '#5d8f7c', 1.0, 0.4, -0.55, 0.46, 0.36, 0.16, 0.04);
    P(g, 'box', '#2a1e14', 1.0, 0.2, -0.365, 0.2, 0.22, 0.01, false);
    P(g, 'cyl', '#8d9599', 1.1, 0.1, 0.15, 0.08, 0.06); // water bowl
    // supplies waiting to go in
    aCrate(g, cx - 0.82, 0.06, 0.62, 0.22, '#f4f2ec');
    aCrate(g, cx - 0.56, 0.06, 0.66, 0.2, '#f4f2ec');
    aCrate(g, cx - 0.78, 0.28, 0.62, 0.18, '#cfe0d6');
  },

  /* ------------------------------------------------------------ deliveries ---------- */
  // 4 × 3: a raised concrete dock under a canopy, with roll-up doors into the warehouse
  dock(g) {
    aSlab(g, 4, 3, '#8f9590');
    aBlock(g, 'stucco', '#b9b7ae', 0, 0.03, 0.45, 3.8, 0.34, 1.9); // platform (crates stack on it)
    for (let k = 0; k < 4; k++) P(g, 'box', '#2d2f31', -1.4 + k * 0.93, 0.2, 1.41, 0.22, 0.2, 0.08);
    for (let k = 0; k < 9; k++)
      P(g, 'box', k % 2 ? '#e6b422' : '#2d2f31', -1.7 + k * 0.425, 0.365, 1.36, 0.425, 0.012, 0.07, false);
    aBlock(g, 'metal', '#c9cdc6', 0, 0.06, -0.95, 3.8, 1.6, 0.95);
    P(g, 'box', '#c9771f', 0, 1.5, -0.95, 3.82, 0.12, 0.97, false);
    const rf = aSlabRoof(g, 'metal', '#6f7570', 3.95, 1.1);
    rf.position.set(0, 1.72, -0.93);
    rf.rotation.x = -0.1;
    for (const [x, open] of [
      [-1.2, 0.6],
      [0, 0],
      [1.2, 0.25],
    ])
      aRollDoor(g, x, 0.37, -0.47, 0, 0.92, 0.84, '#9aa3a8', open);
    // canopy over the platform
    const cn = aSlabRoof(g, 'metal', '#7d868b', 3.9, 1.2);
    cn.position.set(0, 1.42, 0.1);
    cn.rotation.x = 0.08;
    for (const px of [-1.8, 0, 1.8]) P(g, 'box', '#5a6066', px, 0.89, 0.62, 0.07, 1.04, 0.07);
    aSign(g, 'DELIVERIES', '#c9771f', '#ffffff', 0, 1.32, 0.72, 0, 1.2);
    // steps, a forklift and a stack of pallets on the yard side
    for (let k = 0; k < 3; k++) P(g, 'box', '#a9a79e', 1.78, 0.06 + k * 0.1, 1.2 - k * 0.14, 0.26, 0.1, 0.14);
    const fl = aFace(g, 1.45, 0.37, 0.1, -0.5);
    P(fl, 'box', '#e6b422', 0, 0.16, 0, 0.3, 0.2, 0.44);
    P(fl, 'box', '#2d2f31', 0, 0.36, -0.06, 0.26, 0.22, 0.24);
    for (const sx of [-0.1, 0.1]) P(fl, 'box', '#3d4347', sx, 0.34, 0.24, 0.025, 0.66, 0.025);
    for (const sx of [-0.09, 0.09]) P(fl, 'box', '#8d9599', sx, 0.05, 0.42, 0.04, 0.015, 0.34, false);
    for (const sx of [-1, 1])
      for (const sz of [-0.14, 0.16])
        P(fl, 'cyl', '#1d1f21', sx * 0.16, 0.07, sz, 0.07, 0.05, 0.07, false).rotation.z = Math.PI / 2;
    for (let k = 0; k < 4; k++) P(g, 'box', '#b08a55', -1.62, 0.39 + k * 0.045, -0.2, 0.44, 0.03, 0.4);
  },
  // 3 × 2: a red barn with white trim, a hay loft and a grain silo
  feedstore(g) {
    aSlab(g, 3, 2, '#b9ad92');
    const cx = -0.36,
      cz = -0.2,
      w = 1.95,
      d = 1.3;
    aBlock(g, 'stone', '#9a9488', cx, 0.06, cz, w + 0.04, 0.16, d + 0.04);
    aBlock(g, 'vplank', '#a3392a', cx, 0.22, cz, w, 1.0, d);
    aTrim(g, cx, cz, w, d, 0.22, 1.22, '#f2ead8');
    aGable(g, 'metal', '#5b5f63', cx, 1.22, cz, w, d, 0.7, { end: '#a3392a', trim: '#f2ead8', over: 0.13 });
    // big double doors with white cross-bracing
    for (const sx of [-1, 1]) {
      const f = aFace(g, cx + sx * 0.27, 0.06, cz + d / 2, 0);
      P(f, 'box', '#f2ead8', 0, 0.42, 0.012, 0.52, 0.84, 0.02, false);
      P(f, 'box', '#8a2e22', 0, 0.42, 0.022, 0.44, 0.76, 0.02, false);
      for (const s of [-1, 1]) P(f, 'box', '#f2ead8', 0, 0.42, 0.034, 0.04, 0.86, 0.012, false).rotation.z = s * 0.52;
    }
    aWin(g, cx - 0.72, 0.8, cz + d / 2, 0, 0.26, 0.3, {});
    aWin(g, cx + 0.72, 0.8, cz + d / 2, 0, 0.26, 0.3, {});
    aSign(g, 'FEED STORE', '#f2ead8', '#7d2c20', cx, 1.12, cz + d / 2 + 0.03, 0, 0.8);
    // hay loft door and hoist on the gable end
    P(g, 'box', '#f2ead8', cx - w / 2 - 0.012, 1.38, cz, 0.02, 0.36, 0.34, false);
    P(g, 'box', '#8a2e22', cx - w / 2 - 0.022, 1.38, cz, 0.02, 0.28, 0.26, false);
    P(g, 'box', '#5a4030', cx - w / 2 - 0.16, 1.72, cz, 0.36, 0.04, 0.04);
    for (const px of [-0.5, 0.5]) aWin(g, cx + px, 0.8, cz - d / 2, Math.PI, 0.36, 0.3, {});
    // silo
    P(g, 'cyl', '#c9cdc6', 1.02, 0.86, -0.42, 0.34, 1.6);
    for (const y of [0.4, 0.8, 1.2, 1.6]) P(g, 'cyl', '#9aa3a8', 1.02, y, -0.42, 0.345, 0.03, 0.345, false);
    P(g, 'cone', '#9aa3a8', 1.02, 1.8, -0.42, 0.37, 0.3);
    P(g, 'box', '#8d9599', 1.02, 0.86, -0.07, 0.03, 1.6, 0.02, false);
    P(g, 'cyl', '#8d9599', 0.74, 0.3, -0.1, 0.03, 0.6).rotation.z = 0.5;
    // sacks and hay out front
    for (let k = 0; k < 5; k++)
      aSack(g, cx - 0.8 + (k % 3) * 0.26, 0.06 + Math.floor(k / 3) * 0.12, 0.7 + (k % 2) * 0.03);
    aHay(g, 0.9, 0.06, 0.55, 0.3);
    aHay(g, 1.2, 0.06, 0.5, -0.2);
    aHay(g, 1.05, 0.26, 0.52, 0.1);
    aWheelbarrow(g, 0.35, 0.72, -0.6);
  },

  /* ------------------------------------------------------------ guest services ---------- */
  // 2 × 2: tiled restrooms with two doors, a privacy screen and high windows
  restroom(g) {
    aSlab(g, 2, 2, '#c9c4b8');
    const cz = -0.18,
      w = 1.62,
      d = 1.2;
    aBlock(g, 'brick', '#7fa7b0', 0, 0.06, cz, w + 0.02, 0.42, d + 0.02);
    aBlock(g, 'stucco', '#ece6d6', 0, 0.48, cz, w, 0.66, d);
    aHip(g, '#5f7780', 0, 1.14, cz, w, d, 0.42, 0.14);
    aVent(g, 0.3, 1.36, cz - 0.1);
    aDoor(g, -0.42, cz + d / 2, 0, 0.34, 0.74, '#2c6fa8', { y: 0.06, step: false });
    aDoor(g, 0.42, cz + d / 2, 0, 0.34, 0.74, '#b5492f', { y: 0.06, step: false });
    for (const [px, c] of [
      [-0.42, '#2c6fa8'],
      [0.42, '#b5492f'],
    ]) {
      P(g, 'box', '#ffffff', px, 0.98, cz + d / 2 + 0.012, 0.18, 0.18, 0.02, false);
      P(g, 'sph', c, px, 1.02, cz + d / 2 + 0.03, 0.025, 0.025, 0.012, false);
      P(g, 'box', c, px, 0.95, cz + d / 2 + 0.03, 0.05, 0.08, 0.012, false);
    }
    aBlock(g, 'brick', '#7fa7b0', 0, 0.06, cz + d / 2 + 0.3, 0.5, 0.6, 0.07); // privacy screen
    P(g, 'sph', LAMP_MAT, 0, 1.0, cz + d / 2 + 0.05, 0.04, 0.04, 0.04, false);
    for (const sx of [-1, 1]) aWin(g, (sx * w) / 2, 0.92, cz, (sx * Math.PI) / 2, 0.5, 0.2, { bars: false });
    aWin(g, 0, 0.92, cz - d / 2, Math.PI, 0.7, 0.2, { bars: false });
    aPlanter(g, -0.72, 0.72, 0.38, 0, true);
    aPlanter(g, 0.72, 0.72, 0.38, 0, true);
    aSign(g, 'RESTROOMS', '#2c5f7a', '#ffffff', 0, 1.28, cz + d / 2 + 0.16, 0, 0.7);
  },
  // 2 × 2: a gift shop with toy-filled display windows, a striped awning and balloons
  gift(g) {
    aSlab(g, 2, 2, '#c9c4b8');
    const cz = -0.2,
      w = 1.72,
      d = 1.3,
      fz = cz + d / 2;
    aBlock(g, 'brick', '#b5492f', 0, 0.06, cz, w + 0.02, 0.2, d + 0.02);
    aBlock(g, 'stucco', '#eedfae', 0, 0.26, cz, w, 0.98, d);
    const deck = aFlat(g, '#b5492f', 0, 1.24, cz, w + 0.08, d + 0.08, '#f4ebd4');
    // rooftop sign with a giant gift box
    aSign(g, 'GIFT SHOP', '#f2c94c', '#3a2405', -0.2, deck + 0.3, fz - 0.1, 0, 1.1);
    P(g, 'box', '#e85d9e', 0.62, deck + 0.2, cz, 0.34, 0.34, 0.34);
    P(g, 'box', '#f2c94c', 0.62, deck + 0.2, cz, 0.36, 0.36, 0.08, false);
    P(g, 'box', '#f2c94c', 0.62, deck + 0.2, cz, 0.08, 0.36, 0.36, false);
    P(g, 'sph', '#f2c94c', 0.62, deck + 0.42, cz, 0.07, 0.05, 0.07, false);
    for (const sx of [-1, 1]) {
      aWin(g, sx * 0.52, 0.62, fz, 0, 0.56, 0.56, { bars: false, frame: '#7a4326' });
      // toys in the window
      P(g, 'sph', sx > 0 ? '#c98f5a' : '#7fb7cf', sx * 0.62, 0.46, fz + 0.045, 0.07, 0.07, 0.02, false);
      P(g, 'sph', sx > 0 ? '#c98f5a' : '#7fb7cf', sx * 0.62, 0.57, fz + 0.045, 0.05, 0.05, 0.02, false);
      P(g, 'box', sx > 0 ? '#2fb37f' : '#e4573d', sx * 0.42, 0.44, fz + 0.045, 0.1, 0.1, 0.02, false);
    }
    aDoor(g, 0, fz, 0, 0.34, 0.76, '#7a4326', { glass: true, y: 0.06 });
    aAwning(g, 0, 1.08, fz + 0.01, 0, w, 0.4, ['#f4ebd4', '#b5492f']);
    for (const sx of [-1, 1]) aWin(g, (sx * w) / 2, 0.7, cz, (sx * Math.PI) / 2, 0.6, 0.44, { frame: '#7a4326' });
    aWin(g, 0, 0.7, cz - d / 2, Math.PI, 0.6, 0.44, { frame: '#7a4326' });
    // balloons and a barrel of toys out front
    for (const [k, c] of [
      [0, '#e4573d'],
      [1, '#3d86e4'],
      [2, '#f2c94c'],
    ]) {
      P(g, 'cyl', '#c9c4b8', 0.72 + k * 0.04, 0.4 + k * 0.05, 0.86, 0.004, 0.6 + k * 0.1, 0.004, false);
      P(g, 'sph', c, 0.72 + k * 0.06 - 0.03, 0.76 + k * 0.1, 0.86 + (k - 1) * 0.04, 0.075, 0.09, 0.075, false);
    }
    aBarrel(g, 0.72, 0.84, '#2c6fa8');
  },
  // 3 × 3: a dining hall at the back and a terrace of tables with umbrellas
  restaurant(g) {
    aSlab(g, 3, 3, '#c9c4b8');
    const cz = -0.78,
      w = 2.62,
      d = 1.3,
      fz = cz + d / 2;
    aBlock(g, 'brick', '#9a5a40', 0, 0.06, cz, w + 0.02, 0.3, d + 0.02);
    aBlock(g, 'stucco', '#f4ecd6', 0, 0.36, cz, w, 0.9, d);
    aGable(g, 'tile', '#2f6a48', 0, 1.26, cz, w, d, 0.56, { end: '#f4ecd6', trim: '#2f6a48', over: 0.14 });
    aChimney(g, 'brick', '#9a5a40', 0.9, cz - 0.25, 1.26, 2.0, 0.22);
    for (const px of [-0.85, 0.85]) aWin(g, px, 0.74, fz, 0, 0.56, 0.44, { shutters: '#2f6a48', box: true });
    aDoor(g, 0, fz, 0, 0.5, 0.8, '#5b3c22', { double: true, glass: true, y: 0.06, step: false });
    aSign(g, 'RESTAURANT', '#2f6a48', '#f4ebd4', 0, 1.14, fz + 0.03, 0, 1.0);
    for (const sx of [-1, 1]) aWin(g, (sx * w) / 2, 0.74, cz, (sx * Math.PI) / 2, 0.56, 0.44, { shutters: '#2f6a48' });
    for (const px of [-0.8, 0, 0.8]) aWin(g, px, 0.74, cz - d / 2, Math.PI, 0.44, 0.44, {});
    aPipe(g, -w / 2 - 0.03, fz - 0.06, 1.26);
    // terrace: the grill and the two tables are where the diners and the cook are drawn
    aBlock(g, 'plank', '#b98b5c', 0, 0.05, 0.72, 2.74, 0.04, 1.36, false);
    grillStation(g, -0.85, 0.5);
    for (const [tx, tz, c] of [
      [0, 0.95, '#f2c94c'],
      [0.85, 0.55, '#2c6fa8'],
    ]) {
      P(g, 'cyl', '#f4efe2', tx, 0.3, tz, 0.2, 0.03);
      P(g, 'cyl', '#5b3c22', tx, 0.18, tz, 0.02, 0.24);
      P(g, 'cyl', '#c9c4b8', tx, 0.5, tz, 0.012, 0.9);
      P(g, 'cone', fadeRoof(c), tx, 0.95, tz, 0.42, 0.18);
      for (const a of [0.5, 2.6, 4.2])
        P(g, 'box', '#7a5230', tx + Math.cos(a) * 0.3, 0.13, tz + Math.sin(a) * 0.3, 0.12, 0.2, 0.12);
    }
    aYardFence(g, -1.38, 0.1, -1.38, 1.38, '#7a5230', 0.3);
    aYardFence(g, 1.38, 0.1, 1.38, 1.38, '#7a5230', 0.3);
    for (const px of [-1.12, 1.12]) aPlanter(g, px, 1.3, 0.44, 0, true);
    // a menu board by the way in
    P(g, 'box', '#3a2a1e', -0.52, 0.3, 1.34, 0.26, 0.4, 0.03);
    P(g, 'box', '#f4efe2', -0.52, 0.32, 1.357, 0.2, 0.3, 0.01, false);
  },
  // 5 × 4: the Savanna Grill, a thatched lodge with a wide veranda, a fire-pit grill and a big terrace
  grill(g) {
    aSlab(g, 5, 4, '#b9ad92');
    const cz = -1.12,
      w = 4.3,
      d = 1.5,
      fz = cz + d / 2;
    aBlock(g, 'stone', '#9a9488', 0, 0.06, cz, w + 0.04, 0.36, d + 0.04);
    aBlock(g, 'vplank', '#8f6842', 0, 0.42, cz, w, 1.0, d);
    aTrim(g, 0, cz, w, d, 0.42, 1.42, '#5a4030');
    aGable(g, 'thatch', '#c9a85c', 0, 1.42, cz, w, d, 1.0, { end: '#8f6842', trim: '#8a6a3a', over: 0.26 });
    aChimney(g, 'stone', '#9a9488', -1.5, cz - 0.3, 1.42, 2.7, 0.3);
    // veranda on log posts under a thatch skirt
    P(g, 'box', '#9a7550', 0, 0.09, fz + 0.36, w, 0.06, 0.72);
    aVeranda(g, -w / 2, w / 2, fz, 0.72, 1.4, 'thatch', '#c9a85c', '#6b4a2e', 6);
    aDoor(g, 0, fz, 0, 0.7, 0.86, '#5b3c22', { double: true, glass: true, y: 0.12, step: false });
    for (const px of [-1.55, -0.8, 0.8, 1.55])
      aWin(g, px, 0.86, fz, 0, 0.5, 0.5, { frame: '#5a4030', box: px < -1 || px > 1 });
    for (const sx of [-1, 1])
      for (const pz of [-0.35, 0.35])
        aWin(g, (sx * w) / 2, 0.86, cz + pz, (sx * Math.PI) / 2, 0.44, 0.5, { frame: '#5a4030' });
    for (const px of [-1.6, -0.55, 0.55, 1.6]) aWin(g, px, 0.86, cz - d / 2, Math.PI, 0.5, 0.44, { frame: '#5a4030' });
    aAC(g, 1.2, 0.06, cz - d / 2 - 0.2);
    aWheelieBins(g, 1.65, cz - d / 2 - 0.16, 2, 0);
    // the terrace
    aBlock(g, 'plank', '#b98b5c', 0, 0.05, 1.02, 4.7, 0.04, 1.7, false);
    for (const [tx, tz] of [
      [-1.75, 0.75],
      [-0.6, 0.62],
      [0.6, 0.62],
      [1.75, 0.75],
      [-1.2, 1.42],
      [1.2, 1.42],
    ])
      aTable(g, tx, tz, '#c9a85c', 4);
    // fire-pit grill in the middle of it all
    P(g, 'cyl', '#8a8478', 0, 0.16, 1.3, 0.3, 0.2);
    P(g, 'cyl', '#2a2420', 0, 0.265, 1.3, 0.25, 0.02, 0.25, false);
    P(g, 'cone', LAMP_MAT, 0, 0.34, 1.3, 0.08, 0.14, 0.08, false);
    for (const a of [0.4, 2.5, 4.6])
      P(g, 'cyl', '#5a4030', Math.cos(a) * 0.12, 0.29, 1.3 + Math.sin(a) * 0.12, 0.03, 0.2).rotation.z = 1.2;
    // rail, torches and the entrance arch
    for (const sx of [-1, 1]) {
      aYardFence(g, sx * 2.36, 0.2, sx * 2.36, 1.86, '#6b4a2e', 0.32);
      aYardFence(g, sx * 2.36, 1.86, sx * 0.6, 1.86, '#6b4a2e', 0.32);
      P(g, 'cyl', '#6b4a2e', sx * 0.52, 0.7, 1.86, 0.05, 1.4);
      P(g, 'cyl', '#5a4030', sx * 2.36, 0.5, 1.86, 0.02, 1.0);
      P(g, 'cone', LAMP_MAT, sx * 2.36, 1.06, 1.86, 0.04, 0.12, 0.04, false);
    }
    P(g, 'cyl', '#6b4a2e', 0, 1.38, 1.86, 0.045, 1.16).rotation.z = Math.PI / 2;
    aSign(g, 'SAVANNA GRILL', '#3a2a1e', '#f2c94c', 0, 1.14, 1.87, 0, 1.0);
    for (const px of [-2.05, 2.05]) aPlanter(g, px, 0.3, 0.4, 0, false);
  },
  // 6 × 4: the food court, three kitchens under one roof and a plaza of tables
  foodcourt(g) {
    aSlab(g, 6, 4, '#cfcabd');
    const cz = -1.1,
      w = 5.6,
      d = 1.55,
      fz = cz + d / 2,
      top = 1.5;
    // back and side walls; the front is open over the counters
    aBlock(g, 'stucco', '#ece6d6', 0, 0.06, cz - d / 2 + 0.06, w, top - 0.06, 0.12);
    for (const sx of [-1, 1]) aBlock(g, 'stucco', '#ece6d6', sx * (w / 2 - 0.06), 0.06, cz, 0.12, top - 0.06, d);
    for (const px of [-0.93, 0.93]) aBlock(g, 'brick', '#8a8f96', px, 0.06, cz + 0.1, 0.14, top - 0.06, d - 0.3);
    // a deep flat roof that shades the queue
    P(g, 'box', '#f4f2ec', 0, top + 0.06, cz + 0.3, w + 0.3, 0.12, d + 0.9);
    P(g, 'box', '#3d4347', 0, top + 0.02, cz + 0.3, w + 0.34, 0.05, d + 0.94, false);
    for (const px of [-2.7, -0.93, 0.93, 2.7]) P(g, 'cyl', '#c9c4b8', px, top / 2, fz + 0.62, 0.04, top);
    for (const px of [-1.83, 0, 1.83]) {
      aDoor(g, px + 0.45, cz - d / 2, Math.PI, 0.32, 0.74, '#5a6a72', { y: 0.06 });
      aWin(g, px - 0.3, 1.0, cz - d / 2, Math.PI, 0.6, 0.26, { bars: false });
      aCrate(g, px - 0.4, 0.06, cz - d / 2 - 0.2, 0.22);
    }
    aWheelieBins(g, -2.6, cz - d / 2 - 0.16, 3, 0);
    P(g, 'box', '#3f8a5d', 0, 1.3, cz - d / 2 - 0.005, w, 0.08, 0.02, false);
    aAC(g, -1.8, top + 0.12, cz - 0.2);
    aAC(g, 1.8, top + 0.12, cz - 0.2);
    for (const px of [-0.9, 0, 0.9]) aVent(g, px, top + 0.12, cz - 0.3);
    aSign(g, 'FOOD COURT', '#2c3e50', '#ffffff', 0, top + 0.42, fz + 0.5, 0, 1.9);
    for (const px of [-0.7, 0.7]) P(g, 'box', '#8d9599', px, top + 0.18, fz + 0.5, 0.04, 0.14, 0.04);
    // three kitchens, each its own colour: counter, fascia, menu board, a little kit
    for (const [px, name, c, c2] of [
      [-1.83, 'NOODLES', '#c7482c', '#f2c94c'],
      [0, 'TACOS', '#e6a01e', '#3a2405'],
      [1.83, 'SALADS', '#3f8a5d', '#f4ebd4'],
    ]) {
      P(g, 'box', c, px, 0.2, fz - 0.05, 1.6, 0.28, 0.16);
      P(g, 'box', '#f4efe2', px, 0.355, fz - 0.05, 1.66, 0.03, 0.24);
      P(g, 'box', c, px, top - 0.16, fz + 0.02, 1.7, 0.3, 0.06);
      aSign(g, name, c, c2, px, top - 0.16, fz + 0.055, 0, 1.0);
      aSign(g, 'MENU', '#2a2420', '#f4efe2', px, 0.95, cz - d / 2 + 0.13, 0, 0.7);
      P(g, 'box', '#c9c4bd', px - 0.5, 0.2, cz - 0.3, 0.5, 0.34, 0.3); // range
      P(g, 'box', '#8d9599', px + 0.4, 0.42, cz - 0.42, 0.4, 0.78, 0.26); // fridge
      P(g, 'box', '#5a5f63', px + 0.55, 0.42, fz - 0.05, 0.16, 0.1, 0.12); // till
      P(g, 'cyl', c2, px - 0.4, 0.4, fz - 0.05, 0.06, 0.06, 0.06, false);
    }
    // the plaza
    const shades = ['#c7482c', '#f4ebd4', '#3f8a5d', '#e6a01e'];
    let k = 0;
    for (const tz of [0.75, 1.45])
      for (const tx of [-2.2, -1.1, 0, 1.1, 2.2]) aTable(g, tx + (tz > 1 ? 0.0 : 0), tz, shades[k++ % 4], 4);
    for (const px of [-2.75, 2.75]) {
      aPlanter(g, px, 1.1, 1.2, Math.PI / 2, true);
      P(g, 'cyl', '#3d4347', px, 0.7, 0.35, 0.025, 1.4);
      P(g, 'sph', LAMP_MAT, px, 1.44, 0.35, 0.07, 0.07, 0.07, false);
    }
    for (const px of [-0.55, 0.55]) {
      P(g, 'cyl', '#2f6a48', px, 0.2, 1.85, 0.09, 0.3);
      P(g, 'cyl', '#173826', px, 0.36, 1.85, 0.095, 0.03, 0.095, false);
    }
  },
});
