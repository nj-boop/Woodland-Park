/* Garden fences, extra lights and small scenery. Garden fences beside a path run along the path's
   edge and turn its corners; elsewhere they link to neighbouring pieces of the same kind. */

// the pool of light a lamp throws on the ground after dark (opacity is set each frame from darkness())
const LIGHT_POOL = new THREE.MeshBasicMaterial({
  map: (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d'),
      g = x.createRadialGradient(64, 64, 2, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,225,160,1)');
    g.addColorStop(0.35, 'rgba(255,205,130,.42)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  })(),
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  fog: false,
  toneMapped: false,
  polygonOffset: true,
  polygonOffsetFactor: -2,
  polygonOffsetUnits: -2,
  opacity: 0,
});
const POOL_GEO = new THREE.PlaneGeometry(1, 1);
POOL_GEO.rotateX(-Math.PI / 2);
function lightPool(g, x, z, size) {
  const m = new THREE.Mesh(POOL_GEO, LIGHT_POOL);
  m.position.set(x, 0.05, z);
  m.scale.set(3.4 * size, 1, 3.4 * size);
  m.castShadow = false;
  m.renderOrder = 2;
  g.add(m);
  return m;
}
// a box from point a to point b (local coordinates)
function beam(g, col, ax, ay, az, bx, by, bz, w, h, shadow) {
  const dx = bx - ax,
    dy = by - ay,
    dz = bz - az,
    len = Math.hypot(dx, dy, dz);
  const m = P(g, 'box', col, (ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, len, h, w, shadow);
  m.rotation.order = 'YZX';
  m.rotation.y = -Math.atan2(dz, dx);
  m.rotation.z = Math.atan2(dy, Math.hypot(dx, dz));
  return m;
}

const FENCE_SIDES = [
  [0, 1],
  [0, -1],
  [1, 0],
  [-1, 0],
];
const FENCE_IN = 0.44; // how far from the tile centre a path-side fence runs
const isPathTile = (x, y) => inB(x, y) && tileAt(x, y).t === 'p' && !tileAt(x, y).e;
const sameFence = (x, y, o) => inB(x, y) && tileAt(x, y).o === o;
// the straight runs of fence on a tile, as [ax, az, bx, bz] from the tile centre
function fenceRuns(x, y, o) {
  const runs = [],
    sides = FENCE_SIDES.filter(([dx, dy]) => isPathTile(x + dx, y + dy));
  if (sides.length) {
    for (const [dx, dy] of sides) {
      const ux = dy ? 1 : 0,
        uy = dx ? 1 : 0;
      const end = (s) => {
        if (isPathTile(x + ux * s, y + uy * s)) return FENCE_IN; // the inside of a bend
        if (sameFence(x + dx + ux * s, y + dy + uy * s, o)) return 1 - FENCE_IN; // meets the fence round the corner
        return 0.5;
      };
      const a = -end(-1),
        b = end(1),
        px = dx * FENCE_IN,
        pz = dy * FENCE_IN;
      runs.push([px + ux * a, pz + uy * a, px + ux * b, pz + uy * b]);
    }
    return runs;
  }
  for (const [dx, dy] of FENCE_SIDES) {
    if (!sameFence(x + dx, y + dy, o)) continue;
    // reach across a neighbour whose fence runs along its far side
    const r = isPathTile(x + dx * 2, y + dy * 2) ? 1 + FENCE_IN : 0.5;
    runs.push([0, 0, dx * r, dy * r]);
  }
  if (!runs.length) runs.push([-0.36, 0, 0.36, 0]);
  return runs;
}
function makeFenceRun(g, o, ax, ay, az, bx, by, bz) {
  const len = Math.hypot(bx - ax, bz - az);
  const at = (f) => [ax + (bx - ax) * f, ay + (by - ay) * f, az + (bz - az) * f];
  const line = (col, h0, w, h, shadow) => beam(g, col, ax, ay + h0, az, bx, by + h0, bz, w, h, shadow);
  if (o === 'picket') {
    line('#ece7da', 0.13, 0.015, 0.03);
    line('#ece7da', 0.26, 0.015, 0.03);
    const n = Math.max(2, Math.round(len / 0.1));
    for (let k = 0; k < n; k++) {
      const [px, py, pz] = at((k + 0.5) / n);
      P(g, 'box', '#f4f0e6', px, py + 0.17, pz, 0.05, 0.34, 0.05, false);
      P(g, 'cone', '#f4f0e6', px, py + 0.37, pz, 0.038, 0.06, 0.038, false);
    }
    return;
  }
  if (o === 'hedge') {
    line('#3c6a35', 0.17, 0.2, 0.34);
    const n = Math.max(1, Math.round(len / 0.22));
    for (let k = 0; k < n; k++) {
      const [px, py, pz] = at((k + 0.5) / n);
      P(
        g,
        'icoD',
        pick(['#4b7f3e', '#44763a', '#558c45']),
        px + rnd(-0.03, 0.03),
        py + rnd(0.3, 0.35),
        pz + rnd(-0.03, 0.03),
        rnd(0.11, 0.14),
        rnd(0.07, 0.1),
        rnd(0.11, 0.14),
        false
      );
    }
    return;
  }
  if (o === 'railing') {
    line('#23262a', 0.3, 0.025, 0.025);
    line('#23262a', 0.09, 0.02, 0.02);
    const n = Math.max(2, Math.round(len / 0.1));
    for (let k = 0; k < n; k++) {
      const [px, py, pz] = at((k + 0.5) / n);
      P(g, 'box', '#23262a', px, py + 0.17, pz, 0.014, 0.34, 0.014, false);
    }
    for (const f of [0, 1]) {
      const [px, py, pz] = at(f);
      P(g, 'box', '#23262a', px, py + 0.19, pz, 0.04, 0.38, 0.04, false);
      P(g, 'sph', '#c9a24a', px, py + 0.4, pz, 0.03, 0.03, 0.03, false);
    }
    return;
  }
  if (o === 'rope') {
    for (const f of [0, 1]) {
      const [px, py, pz] = at(f);
      P(g, 'cyl', '#c9a24a', px, py + 0.16, pz, 0.02, 0.32);
      P(g, 'cyl', '#8a6c2e', px, py + 0.01, pz, 0.06, 0.03);
      P(g, 'sph', '#e0bd63', px, py + 0.34, pz, 0.032, 0.032, 0.032, false);
    }
    const N = 6;
    let prev = at(0);
    prev[1] += 0.28;
    for (let k = 1; k <= N; k++) {
      const f = k / N,
        p = at(f);
      p[1] += 0.28 - Math.sin(f * Math.PI) * 0.085;
      beam(g, '#a12f3a', prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.024, 0.024, false);
      prev = p;
    }
    return;
  }
  if (o === 'stonewall') {
    for (let lv = 0; lv < 3; lv++) {
      let f = lv % 2 ? -0.08 : 0;
      while (f < 1) {
        const fl = rnd(0.16, 0.3) / Math.max(0.1, len),
          f0 = Math.max(0, f),
          f1 = Math.min(1, f + fl);
        const p0 = at(f0),
          p1 = at(f1);
        beam(
          g,
          pick(['#a6a196', '#928d82', '#b5b0a4', '#878379']),
          p0[0] + 0.004,
          p0[1] + 0.05 + lv * 0.095,
          p0[2] + 0.004,
          p1[0] - 0.004,
          p1[1] + 0.05 + lv * 0.095,
          p1[2] - 0.004,
          0.15 - lv * 0.012,
          0.088,
          lv === 2
        );
        f += fl;
      }
    }
    line('#c2bdb1', 0.31, 0.17, 0.03);
  }
}
function makeLineFence(g, o, x, y) {
  const cy = heightAt(x + 0.5, y + 0.5);
  const yAt = (ax, az) => heightAt(clamp(x + 0.5 + ax, 0, W - 0.01), clamp(y + 0.5 + az, 0, H - 0.01)) - cy;
  for (const [ax, az, bx, bz] of fenceRuns(x, y, o)) makeFenceRun(g, o, ax, yAt(ax, az), az, bx, yAt(bx, bz), bz);
}

const STRING_REACH = 6;
// the next string-light pole in a straight line, or 0
function stringSpan(x, y, dx, dy) {
  for (let d = 1; d <= STRING_REACH; d++) {
    const tx = x + dx * d,
      ty = y + dy * d;
    if (!inB(tx, ty)) return 0;
    if (tileAt(tx, ty).o === 'stringlights') return d;
  }
  return 0;
}
function makeStringLights(g, x, y) {
  const POLE = 1.02;
  P(g, 'cyl', '#4d3a28', 0, POLE / 2, 0, 0.022, POLE);
  P(g, 'ico', LAMP_MAT, 0, POLE + 0.02, 0, 0.035, 0.035, 0.035, false);
  for (const [dx, dy] of [
    [1, 0],
    [0, 1],
  ]) {
    const d = stringSpan(x, y, dx, dy);
    if (!d) continue;
    const y1 = heightAt(x + dx * d + 0.5, y + dy * d + 0.5) - heightAt(x + 0.5, y + 0.5),
      N = d * 8,
      sag = 0.1 + d * 0.05;
    const pt = (k) => {
      const f = k / N;
      return [dx * d * f, POLE + y1 * f - Math.sin(f * Math.PI) * sag, dy * d * f];
    };
    let p0 = pt(0);
    for (let k = 1; k <= N; k++) {
      const p1 = pt(k);
      beam(g, '#2b2b2b', p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], 0.008, 0.008, false);
      if (k < N && k % 2 === 0) P(g, 'ico', LAMP_MAT, p1[0], p1[1] - 0.03, p1[2], 0.022, 0.03, 0.022, false);
      p0 = p1;
    }
    for (let s = 0.5; s < d; s += 1) lightPool(g, dx * s, dy * s, ITEMS.stringlights.light);
  }
}
// what a garden fence or string light depends on outside its own tile, for rebuilding the right chunks
function decorSig(x, y, o) {
  if (o === 'stringlights') return stringSpan(x, y, 1, 0) * 7 + stringSpan(x, y, 0, 1) + 1;
  let b = 1;
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++)
      b = (b * 3 + (isPathTile(x + dx, y + dy) ? 1 : sameFence(x + dx, y + dy, o) ? 2 : 0)) | 0;
  return b;
}
function makeDecor(g, o, x, y) {
  const it = ITEMS[o];
  if (it && it.line) {
    g.rotation.y = 0; // fence runs are worked out in map directions, not the way the item faces
    makeLineFence(g, o, x, y);
    return true;
  }
  if (o === 'stringlights') {
    g.rotation.y = 0;
    makeStringLights(g, x, y);
    return true;
  }
  if (o === 'lantern') {
    // a shepherd's crook with a lantern hanging from it
    const face = faceDir(x, y);
    g.rotation.y = face;
    P(g, 'cyl', '#2a2a2a', 0, 0.5, 0, 0.02, 1);
    beam(g, '#2a2a2a', 0, 1, 0, 0, 1.06, 0.1, 0.03, 0.03);
    beam(g, '#2a2a2a', 0, 1.06, 0.1, 0, 1.02, 0.2, 0.03, 0.03);
    P(g, 'cyl', '#2a2a2a', 0, 0.97, 0.2, 0.006, 0.1, 0.006, false);
    P(g, 'box', '#2a2a2a', 0, 0.91, 0.2, 0.1, 0.018, 0.1);
    P(g, 'box', LAMP_MAT, 0, 0.84, 0.2, 0.075, 0.12, 0.075, false);
    P(g, 'box', '#2a2a2a', 0, 0.775, 0.2, 0.1, 0.014, 0.1);
    lightPool(g, 0, 0.2, it.light);
    return true;
  }
  if (o === 'bollard') {
    P(g, 'cyl', '#30343a', 0, 0.13, 0, 0.05, 0.26);
    P(g, 'cyl', LAMP_MAT, 0, 0.29, 0, 0.042, 0.06, 0.042, false);
    P(g, 'cyl', '#30343a', 0, 0.335, 0, 0.056, 0.03, 0.056);
    lightPool(g, 0, 0, it.light);
    return true;
  }
  if (o === 'globes') {
    P(g, 'cyl', '#22342c', 0, 0.55, 0, 0.03, 1.1);
    P(g, 'cyl', '#22342c', 0, 0.04, 0, 0.08, 0.08);
    P(g, 'box', '#22342c', 0, 1.04, 0, 0.42, 0.024, 0.024);
    P(g, 'sph', LAMP_MAT, 0, 1.2, 0, 0.09, 0.09, 0.09, false);
    for (const s of [-1, 1]) {
      P(g, 'sph', LAMP_MAT, s * 0.2, 1.12, 0, 0.075, 0.075, 0.075, false);
      P(g, 'cyl', '#c9a24a', s * 0.2, 1.05, 0, 0.03, 0.02);
    }
    lightPool(g, 0, 0, it.light);
    return true;
  }
  if (o === 'torch') {
    P(g, 'cyl', '#6e4b2a', 0, 0.36, 0, 0.018, 0.72);
    P(g, 'cyl', '#3a2a1c', 0, 0.74, 0, 0.05, 0.08, 0.05);
    P(g, 'cone', LAMP_MAT, 0, 0.86, 0, 0.042, 0.17, 0.042, false);
    lightPool(g, 0, 0, it.light);
    return true;
  }
  if (o === 'planter') {
    P(g, 'cyl', '#9a958b', 0, 0.03, 0, 0.11, 0.06);
    P(g, 'cyl', '#b5b0a5', 0, 0.12, 0, 0.05, 0.14);
    P(g, 'cone', '#b5b0a5', 0, 0.26, 0, 0.14, 0.14).rotation.x = Math.PI;
    P(g, 'cyl', '#c2bdb1', 0, 0.335, 0, 0.16, 0.02);
    P(g, 'icoD', '#4b7f3e', 0, 0.42, 0, 0.14, 0.09, 0.14, false);
    for (let k = 0; k < 7; k++) {
      const a = rnd(0, 6.28),
        r = rnd(0.02, 0.13);
      P(
        g,
        'ico',
        pick(['#e07a9b', '#f2e26b', '#ffffff', '#b48ae0']),
        Math.cos(a) * r,
        rnd(0.47, 0.52),
        Math.sin(a) * r,
        0.032,
        0.032,
        0.032,
        false
      );
    }
    return true;
  }
  if (o === 'topiary') {
    P(g, 'box', '#8a5a36', 0, 0.09, 0, 0.26, 0.18, 0.26);
    P(g, 'box', '#6f4629', 0, 0.185, 0, 0.29, 0.02, 0.29);
    P(g, 'cyl', '#5a3e27', 0, 0.3, 0, 0.018, 0.25);
    P(g, 'icoD', '#3f7038', 0, 0.45, 0, 0.17);
    P(g, 'icoD', '#477c3e', 0, 0.71, 0, 0.11);
    P(g, 'icoD', '#4f8845', 0, 0.87, 0, 0.065);
    return true;
  }
  if (o === 'birdbath') {
    P(g, 'cyl', '#9a958b', 0, 0.03, 0, 0.14, 0.06);
    P(g, 'cyl', '#b5b0a5', 0, 0.2, 0, 0.045, 0.3);
    P(g, 'cyl', '#c2bdb1', 0, 0.37, 0, 0.21, 0.05);
    P(g, 'cyl', '#7fb7cf', 0, 0.397, 0, 0.175, 0.006, 0.175, false);
    P(g, 'sph', '#5b6f86', 0.1, 0.43, 0.02, 0.03, 0.028, 0.045, false);
    P(g, 'sph', '#5b6f86', 0.1, 0.47, 0.05, 0.02, 0.02, 0.02, false);
    return true;
  }
  if (o === 'arch') {
    g.rotation.y = faceDir(x, y);
    const N = 10,
      R = 0.34,
      H0 = 0.62;
    for (const s of [-1, 1]) {
      P(g, 'box', '#efe9dc', s * R, H0 / 2, 0, 0.03, H0, 0.05);
      for (let k = 0; k < 5; k++)
        P(
          g,
          'ico',
          pick(['#3f7038', '#4b7f3e']),
          s * R + rnd(-0.03, 0.03),
          rnd(0.1, H0),
          rnd(-0.05, 0.05),
          0.05,
          0.05,
          0.05,
          false
        );
    }
    const pt = (k) => {
      const a = (k / N) * Math.PI;
      return [Math.cos(a) * R, H0 + Math.sin(a) * R];
    };
    for (let k = 0; k < N; k++) {
      const [ax, ay] = pt(k),
        [bx, by] = pt(k + 1);
      beam(g, '#efe9dc', ax, ay, 0, bx, by, 0, 0.05, 0.03);
      P(g, 'ico', '#47783d', ax, ay + 0.02, rnd(-0.04, 0.04), 0.06, 0.05, 0.06, false);
      P(
        g,
        'ico',
        pick(['#d9607e', '#ef8fa8', '#f4c3cf']),
        ax + rnd(-0.03, 0.03),
        ay + rnd(0.02, 0.06),
        rnd(-0.06, 0.06),
        0.028,
        0.028,
        0.028,
        false
      );
    }
    return true;
  }
  if (o === 'flagpole') {
    P(g, 'cyl', '#d5d8dc', 0, 0.75, 0, 0.014, 1.5);
    P(g, 'cyl', '#8b8f93', 0, 0.03, 0, 0.09, 0.06);
    P(g, 'sph', '#e6c35a', 0, 1.51, 0, 0.026);
    const col = pick(['#2f6a48', '#e6aa3e', '#3a6ea5']);
    P(g, 'box', col, 0.17, 1.36, 0, 0.32, 0.2, 0.008, false);
    return true;
  }
  return false;
}
