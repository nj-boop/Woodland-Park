/* Little animated scenes that show up when the camera is close: cooks, cashiers, vets at work.
   Nothing here touches the simulation. The static shell of each shop is part of the batched scenery
   (below: makeStand, openShop and friends); the moving people are built only for the few buildings
   near the camera, and their roofs turn see-through as you zoom in, so you can look inside. */

/* roofs and walls that fade when the camera comes in close */
const FADE_ROOFS = new Map();
function fadeRoof(col) {
  if (!FADE_ROOFS.has(col)) {
    const m = new THREE.MeshLambertMaterial({ color: LIN(col), transparent: true, opacity: 1 });
    FADE_ROOFS.set(col, m);
  }
  return FADE_ROOFS.get(col);
}
function setRoofFade() {
  const f = clamp((CAM.dist - VIG_ZOOM * 0.55) / (VIG_ZOOM * 0.45), 0, 1),
    op = 0.16 + 0.84 * f;
  for (const m of FADE_ROOFS.values()) {
    m.opacity = op;
    m.depthWrite = op > 0.95;
  }
}
const GLASS = new THREE.MeshStandardMaterial({
  color: LIN('#d8eef5'),
  transparent: true,
  opacity: 0.18,
  roughness: 0.1,
  depthWrite: false,
});

/* ---------- the static shells ---------- */
const STANDS = {
  food: { wall: '#b5492f', roof: ['#f4ebd4', '#d84a33'], sign: 'SNACKS', sbg: '#e6aa3e', sfg: '#3a2405' },
  drink: { wall: '#2c6fa8', roof: ['#f4ebd4', '#2c6fa8'], sign: 'DRINKS', sbg: '#f2c94c', sfg: '#123a5a' },
  icecream: { wall: '#e9a4b8', roof: ['#fdf1f4', '#d9708f'], sign: 'ICE CREAM', sbg: '#fdf1f4', sfg: '#b5416a' },
  popcorn: { wall: '#d84a33', roof: ['#fbe9a6', '#d84a33'], sign: 'POPCORN', sbg: '#fbe9a6', sfg: '#a62f1f' },
  coffee: { wall: '#6b4a32', roof: ['#ead9bd', '#6b4a32'], sign: 'COFFEE', sbg: '#ead9bd', sfg: '#3a2412' },
  souvenir: { wall: '#5f7fa8', roof: ['#f4ebd4', '#7a5fa8'], sign: 'SOUVENIRS', sbg: '#7a5fa8', sfg: '#f4ebd4' },
};
function stripedRoof(g, cols, y, z, w, d, n) {
  for (let k = 0; k < n; k++) {
    const s = P(g, 'box', fadeRoof(cols[k % 2]), -w / 2 + (w * (k + 0.5)) / n, y, z, w / n, 0.03, d);
    s.rotation.x = 0.14;
  }
}
function makeStand(g, o) {
  const c = STANDS[o];
  P(g, 'box', '#c9c4b8', 0, 0.015, -0.03, 0.9, 0.03, 0.74, false).receiveShadow = true;
  P(g, 'box', fadeRoof(c.wall), 0, 0.36, -0.36, 0.84, 0.7, 0.05); // back wall
  for (const s of [-1, 1]) P(g, 'box', fadeRoof(c.wall), s * 0.4, 0.2, -0.1, 0.04, 0.38, 0.5); // side walls
  P(g, 'box', c.wall, 0, 0.13, 0.17, 0.84, 0.24, 0.12); // counter front
  P(g, 'box', '#f4ebd4', 0, 0.26, 0.17, 0.88, 0.025, 0.2);
  for (const s of [-1, 1]) P(g, 'cyl', '#dcdcdc', s * 0.41, 0.53, 0.26, 0.016, 0.54);
  stripedRoof(g, c.roof, 0.82, -0.03, 0.96, 0.82, 6);
  signBoard(g, c.sign, c.sbg, c.sfg, 0, 0.8, -0.33, 0.62);
  if (o === 'drink') P(g, 'box', '#d0d4d8', 0.26, 0.37, 0.15, 0.18, 0.2, 0.14);
  if (o === 'icecream')
    for (const [x, col] of [
      [-0.28, '#f5e0a8'],
      [-0.1, '#e9a4b8'],
      [0.08, '#7a4a2e'],
    ])
      P(g, 'cyl', col, x, 0.29, 0.17, 0.075, 0.03);
  if (o === 'popcorn') {
    P(g, 'box', GLASS, 0, 0.45, 0.14, 0.44, 0.36, 0.2, false);
    P(g, 'box', '#c9463a', 0, 0.28, 0.14, 0.46, 0.04, 0.22);
    P(g, 'box', '#c9463a', 0, 0.63, 0.14, 0.46, 0.03, 0.22);
  }
  if (o === 'coffee') P(g, 'box', '#c9c4bd', -0.22, 0.37, 0.15, 0.28, 0.19, 0.16);
  if (o === 'souvenir')
    for (const [x, col] of [
      [-0.3, '#c98f5a'],
      [0.3, '#7fb7cf'],
    ]) {
      P(g, 'sph', col, x, 0.34, 0.17, 0.065);
      P(g, 'sph', col, x, 0.44, 0.17, 0.045);
    }
}
// a walk-up shop: back wall, side walls, long counter, see-through-when-close roof
function openShop(g, w, d, c) {
  const hw = w / 2 - 0.08,
    backZ = -d / 2 + 0.1,
    counterZ = 0.3;
  P(g, 'box', '#c9c4b8', 0, 0.03, 0, w - 0.1, 0.06, d - 0.1, false).receiveShadow = true;
  P(g, 'box', fadeRoof(c.wall), 0, 0.55, backZ, w - 0.16, 1.0, 0.08);
  for (const s of [-1, 1])
    P(g, 'box', fadeRoof(c.wall), s * hw, 0.55, (backZ + counterZ) / 2, 0.06, 1.0, counterZ - backZ);
  P(g, 'box', c.wall, 0, 0.17, counterZ, w - 0.18, 0.26, 0.14);
  P(g, 'box', c.trim, 0, 0.3, counterZ, w - 0.12, 0.03, 0.2);
  for (const s of [-1, 1]) P(g, 'cyl', '#dcdcdc', s * hw, 0.56, counterZ + 0.14, 0.02, 1.0);
  const roofD = counterZ + 0.3 - backZ;
  stripedRoof(g, c.roof, 1.08, (backZ + counterZ + 0.3) / 2, w - 0.02, roofD, Math.round(w * 4));
  signBoard(g, c.sign, c.sbg, c.sfg, 0, 1.28, backZ + 0.07, Math.min(1.5, w * 0.6));
}
// the restaurant's open-air grill on its terrace
function grillStation(g, x, z) {
  P(g, 'box', '#6d6f73', x, 0.2, z, 0.74, 0.3, 0.3);
  P(g, 'box', '#2d2d2d', x, 0.36, z, 0.7, 0.02, 0.26);
  P(g, 'box', '#c9c4bd', x - 0.26, 0.5, z - 0.1, 0.05, 0.3, 0.05);
}
// the vet clinic's operating theatre: a glass room on the front, so you can watch
function theatreBay(g, x, z) {
  const W2 = 0.62,
    D2 = 0.32;
  P(g, 'box', '#eef1ef', x, 0.07, z, W2 * 2, 0.02, D2 * 2, false);
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) P(g, 'box', '#d8d4cc', x + sx * W2, 0.48, z + sz * D2, 0.04, 0.84, 0.04);
  P(g, 'box', GLASS, x, 0.48, z + D2, W2 * 2, 0.84, 0.012, false);
  for (const s of [-1, 1]) P(g, 'box', GLASS, x + s * W2, 0.48, z, 0.012, 0.84, D2 * 2, false);
  P(g, 'box', fadeRoof('#9fb0b8'), x, 0.92, z, W2 * 2 + 0.1, 0.04, D2 * 2 + 0.1);
  P(g, 'box', '#8b949a', x, 0.2, z - 0.02, 0.6, 0.06, 0.24); // operating table
  P(g, 'box', '#6d757b', x, 0.12, z - 0.02, 0.1, 0.14, 0.1);
}

/* ---------- the people ---------- */
const SKINS = ['#e8bd96', '#c98f5a', '#8a5a36', '#f0cdaa'];
function vigActor(par, shirt, x, z, ry, seed) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = ry || 0;
  par.add(g);
  const skin = SKINS[(seed || 0) % SKINS.length];
  P(g, 'cyl', '#333a46', 0, 0.12, 0, 0.055, 0.24, 0.055, false);
  P(g, 'cyl', shirt, 0, 0.32, 0, 0.078, 0.2, 0.066, false);
  const head = P(g, 'sph', skin, 0, 0.48, 0, 0.06, 0.066, 0.06, false);
  const arm = (sx) => {
    const a = new THREE.Group();
    a.position.set(sx * 0.1, 0.4, 0);
    P(a, 'cyl', shirt, 0, -0.09, 0, 0.02, 0.18, 0.02, false);
    P(a, 'sph', skin, 0, -0.19, 0, 0.026, 0.026, 0.026, false);
    g.add(a);
    return a;
  };
  return { g, head, armL: arm(-1), armR: arm(1) };
}
const chefHat = (a) => {
  P(a.g, 'cyl', '#ffffff', 0, 0.56, 0, 0.055, 0.07, 0.055, false);
  P(a.g, 'sph', '#ffffff', 0, 0.6, 0, 0.07, 0.04, 0.07, false);
};
const scrubCap = (a, col) => P(a.g, 'sph', col, 0, 0.51, 0, 0.066, 0.05, 0.066, false);
const wave = (t, s) => Math.sin(t * (s || 3));
const phase = (t, period) => (((t % period) + period) % period) / period;
// an arm reaching out in front of the actor, by this much (0 at the side, 1 straight forward)
const reach = (arm, amt) => (arm.rotation.x = -amt * (Math.PI / 2));

/* each scene builds its props and returns a function that poses them for time t (seconds).
   Local space matches the building: front is +z. */
const VIGS = {
  food(g) {
    const a = vigActor(g, '#d84a33', 0, -0.1, 0, 1);
    chefHat(a);
    const dogs = [-0.16, 0, 0.16].map((x) => {
      const d = P(g, 'cyl', '#b5522f', x, 0.3, 0.14, 0.022, 0.14, 0.022, false);
      d.rotation.z = Math.PI / 2;
      return d;
    });
    const wrap = P(g, 'box', '#f4ebd4', 0.05, 0.34, 0.2, 0.09, 0.04, 0.05, false);
    return (t) => {
      dogs.forEach((d, k) => (d.rotation.x = t * 2 + k));
      const p = phase(t, 3);
      reach(a.armR, 0.6 + 0.25 * Math.sin(p * Math.PI * 4));
      reach(a.armL, p > 0.7 ? 1.1 : 0.15);
      wrap.visible = p > 0.65;
      wrap.position.z = 0.17 + (p > 0.65 ? (p - 0.65) * 0.3 : 0);
      a.head.rotation.y = wave(t, 0.8) * 0.3;
    };
  },
  drink(g) {
    const a = vigActor(g, '#2c6fa8', -0.1, -0.1, 0, 2);
    const cup = P(g, 'cyl', '#fff6e0', 0.26, 0.31, 0.2, 0.03, 0.08, 0.03, false);
    const fill = P(g, 'cyl', '#c1461f', 0.26, 0.28, 0.2, 0.026, 0.01, 0.026, false);
    return (t) => {
      const p = phase(t, 2.6);
      const fl = Math.min(1, p / 0.7);
      fill.scale.y = 0.01 + fl * 0.07;
      fill.position.y = 0.272 + fl * 0.035;
      cup.position.z = fill.position.z = 0.2 + (p > 0.75 ? (p - 0.75) * 0.3 : 0);
      reach(a.armR, p < 0.7 ? 1.1 : 0.4);
      reach(a.armL, wave(t, 1.5) * 0.1 + 0.2);
    };
  },
  icecream(g) {
    const a = vigActor(g, '#d9708f', 0, -0.1, 0, 3);
    const cone = P(g, 'cone', '#d9a55f', 0.14, 0.37, 0.2, 0.03, 0.09, 0.03, false);
    cone.rotation.x = Math.PI;
    const scoop = P(g, 'sph', '#f5e0a8', 0.14, 0.44, 0.2, 0.034, 0.034, 0.034, false);
    return (t) => {
      const p = phase(t, 3.2);
      reach(a.armL, p < 0.5 ? 0.5 + 0.2 * Math.sin(p * 30) : 0.2);
      reach(a.armR, 0.85);
      const s = Math.min(1, p / 0.5);
      scoop.scale.setScalar(0.034 * s);
      scoop.visible = p > 0.05;
      const out = p > 0.75 ? (p - 0.75) * 0.5 : 0;
      cone.position.z = scoop.position.z = 0.2 + out;
    };
  },
  popcorn(g) {
    const a = vigActor(g, '#c9463a', 0.26, -0.1, 0, 0);
    const kernels = [];
    for (let k = 0; k < 14; k++)
      kernels.push(P(g, 'ico', '#fbeeb0', rnd(-0.17, 0.17), 0.33, 0.14 + rnd(-0.06, 0.06), 0.02, 0.02, 0.02, false));
    return (t) => {
      kernels.forEach((n, k) => (n.position.y = 0.32 + Math.abs(Math.sin(t * 5 + k * 1.7)) * (0.1 + (k % 4) * 0.05)));
      reach(a.armR, 0.4 + 0.3 * wave(t, 2));
      reach(a.armL, 0.3);
    };
  },
  coffee(g) {
    const a = vigActor(g, '#6b4a32', 0.05, -0.1, 0, 2);
    const steam = [0, 1, 2].map(() => P(g, 'sph', '#f4f4f4', -0.22, 0.5, 0.15, 0.02, 0.02, 0.02, false));
    const cup = P(g, 'cyl', '#fff6e0', 0.15, 0.3, 0.2, 0.028, 0.05, 0.028, false);
    return (t) => {
      steam.forEach((s, k) => {
        const f = phase(t + k * 0.6, 1.8);
        s.position.y = 0.48 + f * 0.26;
        s.position.x = -0.22 + Math.sin(f * 6 + k) * 0.03;
        s.scale.setScalar(0.015 + f * 0.035);
      });
      const p = phase(t, 3);
      reach(a.armL, p < 0.5 ? 1.2 : 0.3);
      reach(a.armR, p > 0.6 ? 1 : 0.3);
      cup.position.z = 0.2 + (p > 0.8 ? (p - 0.8) * 0.3 : 0);
    };
  },
  souvenir(g) {
    const a = vigActor(g, '#7a5fa8', 0, -0.1, 0, 1);
    const plush = new THREE.Group();
    P(plush, 'sph', '#c98f5a', 0, 0, 0, 0.05, 0.05, 0.05, false);
    P(plush, 'sph', '#c98f5a', 0, 0.07, 0, 0.038, 0.038, 0.038, false);
    for (const s of [-1, 1]) P(plush, 'sph', '#b47a48', s * 0.03, 0.105, 0, 0.014, 0.014, 0.014, false);
    plush.position.set(0.12, 0.42, 0.04);
    a.g.add(plush);
    return (t) => {
      reach(a.armR, 1.1 + wave(t, 2.2) * 0.2);
      reach(a.armL, 0.2);
      plush.rotation.z = wave(t, 3) * 0.3;
      plush.position.y = 0.42 + wave(t, 2.2) * 0.03;
      a.head.rotation.y = wave(t, 0.7) * 0.4;
    };
  },
  burger(g) {
    const cook = vigActor(g, '#f4f4f4', -0.42, 0.02, 0, 0);
    chefHat(cook);
    const clerk = vigActor(g, '#d84a33', 0.45, 0.02, 0, 3);
    const spat = P(cook.armR, 'box', '#c9c4bd', 0, -0.25, 0.04, 0.05, 0.008, 0.09, false);
    spat.rotation.x = 0.2;
    const flips = [-0.56, -0.42, -0.28].map((x, k) => ({
      m: P(g, 'cyl', '#6b3a22', x, 0.3, 0.3, 0.05, 0.016, 0.05, false),
      x,
      k,
    }));
    const flame = [-0.56, -0.28].map((x) => P(g, 'cone', '#ff9a3a', x, 0.29, 0.34, 0.025, 0.04, 0.025, false));
    const tray = P(g, 'box', '#d84a33', 0.3, 0.33, 0.32, 0.14, 0.02, 0.1, false);
    return (t) => {
      for (const f of flips) {
        const p = phase(t + f.k * 0.7, 2.1);
        const h = p < 0.28 ? Math.sin((p / 0.28) * Math.PI) * 0.17 : 0;
        f.m.position.y = 0.3 + h;
        f.m.rotation.x = p < 0.28 ? (p / 0.28) * Math.PI * 2 : 0;
      }
      const p0 = phase(t, 2.1 / 3);
      reach(cook.armR, 0.7 + (p0 < 0.28 ? Math.sin((p0 / 0.28) * Math.PI) * 0.55 : 0));
      cook.armL.rotation.x = -0.4;
      flame.forEach((m, k) => {
        const s = 0.8 + Math.sin(t * 14 + k) * 0.3;
        m.scale.set(0.025 * s, 0.04 * s, 0.025 * s);
      });
      // the cashier rings it up
      const c = phase(t, 3.4);
      reach(clerk.armR, c < 0.45 ? 0.8 + Math.sin(c * 40) * 0.1 : 0.3);
      reach(clerk.armL, c > 0.6 ? 1 : 0.2);
      tray.visible = c > 0.55;
      tray.position.z = 0.32 + (c > 0.55 ? (c - 0.55) * 0.25 : 0);
    };
  },
  cafe(g) {
    const b = vigActor(g, '#4f7f70', -0.05, 0.02, 0, 1);
    const puff = P(g, 'sph', '#f4f4f4', -0.4, 0.5, 0.3, 0.03, 0.03, 0.03, false);
    const sit = vigActor(g, '#c9734a', 0.77, 0.75, -Math.PI / 2, 2);
    sit.g.position.y = -0.1;
    const cup = P(sit.armR, 'cyl', '#fff6e0', 0, -0.21, 0.05, 0.03, 0.05, 0.03, false);
    return (t) => {
      const p = phase(t, 2.6);
      reach(b.armL, p < 0.5 ? 1 : 0.2);
      reach(b.armR, p > 0.55 ? 1.1 : 0.3);
      puff.position.y = 0.46 + phase(t, 1.4) * 0.3;
      puff.scale.setScalar(0.02 + phase(t, 1.4) * 0.05);
      const s = phase(t, 5);
      reach(sit.armR, s < 0.25 ? 1.45 : 0.75);
      sit.head.rotation.x = s < 0.25 ? -0.25 : 0.05;
      reach(sit.armL, 0.6);
      cup.visible = true;
    };
  },
  pizzeria(g) {
    const chef = vigActor(g, '#f4f4f4', 0, -0.05, 0, 0);
    chefHat(chef);
    const dough = P(g, 'cyl', '#f1dfae', 0.0, 0.55, 0.12, 0.13, 0.012, 0.13, false);
    const fire = P(g, 'sph', '#ff7a2a', 0, 0.32, -0.66, 0.16, 0.09, 0.02, false);
    const help = vigActor(g, '#2f6a48', -0.8, -0.2, Math.PI / 2, 2);
    const pie = P(g, 'cyl', '#d9a84e', -0.55, 0.32, 0.3, 0.12, 0.01, 0.12, false);
    P(g, 'cyl', '#c1461f', -0.55, 0.326, 0.3, 0.1, 0.006, 0.1, false);
    return (t) => {
      const p = phase(t, 1.5);
      dough.position.y = 0.52 + Math.sin(p * Math.PI) * 0.32;
      dough.rotation.y = t * 9;
      const up = Math.sin(p * Math.PI);
      reach(chef.armL, 1.1 + up * 0.6);
      reach(chef.armR, 1.1 + up * 0.6);
      fire.scale.y = 0.08 + Math.sin(t * 11) * 0.02;
      const q = phase(t, 6);
      help.g.position.x = -0.8 + Math.sin(q * Math.PI * 2) * 0.22;
      reach(help.armR, 0.8);
      reach(help.armL, 0.8);
      pie.position.x = help.g.position.x + 0.2;
      pie.position.z = 0.1 + Math.abs(Math.sin(q * Math.PI)) * 0.2;
    };
  },
  restaurant(g) {
    const cook = vigActor(g, '#f4f4f4', -0.85, 0.26, 0, 0);
    chefHat(cook);
    const pats = [-1.05, -0.85, -0.65].map((x, k) => ({
      m: P(g, 'cyl', '#7a4326', x, 0.385, 0.5, 0.05, 0.016, 0.05, false),
      k,
    }));
    const flame = P(g, 'cone', '#ff9a3a', -0.85, 0.385, 0.42, 0.04, 0.07, 0.04, false);
    // diners at the two tables
    const seats = [
      [-0.3, 0.95, Math.PI / 2],
      [0.3, 0.95, -Math.PI / 2],
      [0.55, 0.55, Math.PI / 2],
      [1.15, 0.55, -Math.PI / 2],
    ].map(([x, z, ry], k) => {
      const a = vigActor(g, ['#2c6fa8', '#c9734a', '#7a5fa8', '#3f8a5d'][k], x, z, ry, k);
      a.g.position.y = -0.1;
      return a;
    });
    const waiter = vigActor(g, '#1f2326', 0, 0.4, 0, 1);
    const tray = P(waiter.armR, 'box', '#c9c4bd', 0, -0.22, 0.09, 0.15, 0.012, 0.11, false);
    return (t) => {
      for (const f of pats) {
        const p = phase(t + f.k * 0.65, 2);
        f.m.position.y = 0.385 + (p < 0.3 ? Math.sin((p / 0.3) * Math.PI) * 0.15 : 0);
        f.m.rotation.x = p < 0.3 ? (p / 0.3) * Math.PI * 2 : 0;
      }
      const p0 = phase(t, 2 / 3);
      reach(cook.armR, 0.8 + (p0 < 0.3 ? 0.5 : 0));
      cook.armL.rotation.x = -0.4;
      flame.scale.y = 0.06 + Math.sin(t * 13) * 0.025;
      seats.forEach((a, k) => {
        const p = phase(t + k * 1.1, 3.2);
        reach(a.armR, 0.6 + (p < 0.35 ? Math.sin((p / 0.35) * Math.PI) * 0.9 : 0));
        reach(a.armL, 0.5);
        a.head.rotation.x = p < 0.35 ? 0.15 : 0;
      });
      const w = phase(t, 7),
        // out to the far table and back
        u = w < 0.5 ? w * 2 : 2 - w * 2,
        x = -0.3 + u * 0.75,
        z = 0.42 + u * 0.32;
      waiter.g.position.set(x, 0, z);
      waiter.g.rotation.y = w < 0.5 ? 1.05 : -2.1;
      waiter.g.position.y = Math.abs(Math.sin(t * 7)) * 0.012;
      waiter.armR.rotation.x = -1.35;
      waiter.armL.rotation.x = Math.sin(t * 7) * 0.4;
      tray.visible = w < 0.5;
    };
  },
  gift(g) {
    const a = vigActor(g, '#b5492f', -0.55, 0.7, 0, 3);
    P(g, 'box', '#8a6440', -0.55, 0.15, 0.85, 0.5, 0.3, 0.18);
    const item = P(g, 'box', '#2c6fa8', -0.7, 0.33, 0.85, 0.08, 0.06, 0.08, false);
    const beep = P(g, 'box', LAMP_MAT, -0.4, 0.31, 0.85, 0.04, 0.02, 0.08, false);
    return (t) => {
      const p = phase(t, 2.4);
      item.position.x = -0.7 + Math.min(1, p * 2) * 0.3;
      item.visible = p < 0.8;
      beep.visible = p > 0.4 && p < 0.55;
      reach(a.armR, 0.75 + Math.sin(p * Math.PI * 2) * 0.15);
      reach(a.armL, 0.6);
      a.head.rotation.y = wave(t, 0.6) * 0.3;
    };
  },
  vetclinic(g, a) {
    // inside the glass theatre, centred on the operating table
    const X = 0.1,
      Z = 0.98;
    const lamp = P(g, 'cyl', '#e4e8ea', X, 0.72, Z - 0.02, 0.1, 0.03, 0.1, false);
    const vet = vigActor(g, '#2f8f5a', X - 0.42, Z, Math.PI / 2, 0);
    scrubCap(vet, '#2f8f5a');
    const nurse = vigActor(g, '#3f7fb0', X + 0.42, Z - 0.02, -Math.PI / 2, 2);
    scrubCap(nurse, '#3f7fb0');
    const tool = P(vet.armR, 'box', '#d8dde0', 0, -0.23, 0.05, 0.012, 0.012, 0.09, false);
    const patient = new THREE.Group();
    patient.position.set(X, 0.27, Z - 0.02);
    P(patient, 'sph', '#c9a877', 0, 0.03, 0, 0.22, 0.075, 0.1, false);
    P(patient, 'sph', '#c9a877', 0.25, 0.05, 0, 0.07, 0.055, 0.055, false);
    P(patient, 'box', '#3f7fb0', -0.07, 0.09, 0, 0.13, 0.02, 0.12, false); // surgical drape
    g.add(patient);
    const monitor = new THREE.Group();
    monitor.position.set(X + 0.52, 0.5, Z - 0.3);
    P(monitor, 'box', '#2b2f33', 0, 0, 0, 0.26, 0.2, 0.03, false);
    const blip = P(monitor, 'box', '#7dffb0', 0, 0, 0.02, 0.02, 0.1, 0.005, false);
    g.add(monitor);
    return (t) => {
      const busy = clinicBusy(a);
      patient.visible = busy;
      if (busy) {
        reach(vet.armR, 0.85 + Math.sin(t * 6) * 0.1);
        reach(vet.armL, 0.7);
        vet.head.rotation.x = 0.3;
        reach(nurse.armR, 0.65 + wave(t, 2) * 0.2);
        nurse.armL.rotation.x = -0.5;
        patient.scale.y = 1 + Math.sin(t * 2.2) * 0.04; // breathing
        lamp.visible = true;
      } else {
        // between cases: wiping down the table and writing up notes
        reach(vet.armR, 0.7 + Math.sin(t * 3) * 0.15);
        vet.armR.rotation.z = Math.sin(t * 3) * 0.3;
        reach(vet.armL, 0.2);
        vet.head.rotation.x = 0;
        reach(nurse.armR, 0.9);
        reach(nurse.armL, 0.9);
        nurse.head.rotation.x = 0.25;
      }
      tool.visible = busy;
      const q = phase(t, busy ? 0.9 : 2.6);
      blip.position.x = -0.11 + q * 0.22;
      blip.scale.y = q > 0.45 && q < 0.55 ? 1.8 : 0.3;
    };
  },
};

/* ---------- which scenes are on stage ---------- */
const VIG_ZOOM = 17, // the camera has to be at least this close
  VIG_REACH = 13, // tiles from the point the camera looks at
  VIG_MAX = 10;
const vigRoot = new THREE.Group();
scene.add(vigRoot);
const vigs = new Map(); // anchor tile -> { kind, grp, pose, t0 }
let vigAt = 0;
function vigPlace(grp, a) {
  const t = S.tiles[a],
    x = a % W,
    y = (a / W) | 0;
  if (ITEMS[t.o].size) {
    const p = planOf(a),
      cx = p.x0 + p.fw / 2,
      cz = p.y0 + p.fh / 2;
    let hy = 0;
    for (const k of fpTiles(p.x0, p.y0, p.fw, p.fh)) hy += heightAt((k % W) + 0.5, ((k / W) | 0) + 0.5);
    grp.position.set(cx, hy / (p.fw * p.fh), cz);
    grp.rotation.y = (p.r * Math.PI) / 2;
  } else {
    grp.position.set(x + 0.5, heightAt(x + 0.5, y + 0.5), y + 0.5);
    grp.rotation.y = faceDir(x, y);
  }
}
function vigClear(a) {
  const v = vigs.get(a);
  if (!v) return;
  vigRoot.remove(v.grp);
  vigs.delete(a);
}
function refreshVignettes() {
  const want = [];
  if (CAM.dist < VIG_ZOOM && F.anchors)
    for (const k of Object.keys(VIGS))
      for (const a of F.anchors[k] || []) {
        if (S.tiles[a].o !== k || !isAnchor(a)) continue;
        const d = Math.hypot((a % W) + 0.5 - CAM.tx, ((a / W) | 0) + 0.5 - CAM.tz);
        if (d <= VIG_REACH) want.push({ a, d, k });
      }
  want.sort((p, q) => p.d - q.d);
  const keep = new Set(want.slice(0, VIG_MAX).map((w) => w.a));
  for (const a of [...vigs.keys()]) if (!keep.has(a) || S.tiles[a].o !== vigs.get(a).kind) vigClear(a);
  for (const { a, k } of want.slice(0, VIG_MAX)) {
    if (vigs.has(a)) continue;
    const grp = new THREE.Group();
    vigPlace(grp, a);
    vigRoot.add(grp);
    seeded(() => {
      seedRand(a * 13 + 5);
      vigs.set(a, { kind: k, grp, pose: VIGS[k](grp, a), t0: performance.now() });
    });
  }
}
function syncVignettes(time) {
  setRoofFade();
  if (time - vigAt > 250) {
    vigAt = time;
    refreshVignettes();
  }
  const t = time / 1000;
  for (const [a, v] of vigs) {
    if (!S.tiles[a] || S.tiles[a].o !== v.kind) {
      vigClear(a);
      continue;
    }
    v.pose(t);
    // appear with a little pop, not all at once
    const f = clamp((time - v.t0) / 280, 0, 1);
    v.grp.scale.setScalar(0.85 + 0.15 * f);
  }
}
