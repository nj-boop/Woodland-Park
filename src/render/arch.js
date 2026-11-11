/* Architecture kit: textured walls and roofs, windows, doors and the small details (awnings, vents,
   planters, crates) that the building models in render/buildings.js are assembled from.
   Everything is built from the shared GEO primitives with cached materials, so a whole building
   still batches into a handful of draws. Parts that sit on a wall take a facing `ry`
   (0 = facing +z, the front; Math.PI = the back; ±Math.PI / 2 = the sides). */

const ARCH_TEX = {};
// a 128 px detail tile, drawn in greys and multiplied by the material's colour
function archTex(kind) {
  if (ARCH_TEX[kind]) return ARCH_TEX[kind];
  const n = 128,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d'),
    grey = (v) => {
      const k = Math.round(clamp(v, 0, 1) * 255);
      return `rgb(${k},${k},${k})`;
    },
    r = (a, b) => a + Math.random() * (b - a);
  x.fillStyle = '#fff';
  x.fillRect(0, 0, n, n);
  const speckle = (count, lo) => {
    for (let k = 0; k < count; k++) {
      x.fillStyle = grey(r(lo, 1));
      x.fillRect(r(0, n), r(0, n), r(1, 3), r(1, 3));
    }
  };
  if (kind === 'plank' || kind === 'vplank') {
    for (let k = 0; k < 8; k++) {
      x.fillStyle = grey(r(0.86, 1));
      if (kind === 'plank') x.fillRect(0, k * 16, n, 16);
      else x.fillRect(k * 16, 0, 16, n);
      x.fillStyle = grey(0.62);
      if (kind === 'plank') x.fillRect(0, k * 16 + 14, n, 2);
      else x.fillRect(k * 16 + 14, 0, 2, n);
    }
    speckle(160, 0.86);
  } else if (kind === 'brick') {
    x.fillStyle = grey(0.7);
    x.fillRect(0, 0, n, n);
    for (let j = 0; j < 8; j++)
      for (let i = -1; i < 4; i++) {
        x.fillStyle = grey(r(0.84, 1));
        x.fillRect(i * 32 + (j % 2) * 16 + 1, j * 16 + 1, 30, 14);
      }
  } else if (kind === 'stone') {
    x.fillStyle = grey(0.62);
    x.fillRect(0, 0, n, n);
    for (let j = 0; j < 4; j++) {
      let px = -r(0, 20);
      while (px < n) {
        const w = r(22, 46);
        x.fillStyle = grey(r(0.8, 1));
        x.fillRect(px + 1.5, j * 32 + 1.5, w - 3, 29);
        px += w;
      }
    }
    speckle(200, 0.8);
  } else if (kind === 'metal') {
    for (let k = 0; k < 8; k++) {
      const g = x.createLinearGradient(k * 16, 0, k * 16 + 16, 0);
      g.addColorStop(0, grey(0.8));
      g.addColorStop(0.5, grey(1));
      g.addColorStop(1, grey(0.74));
      x.fillStyle = g;
      x.fillRect(k * 16, 0, 16, n);
    }
  } else if (kind === 'shingle' || kind === 'tile') {
    for (let j = 0; j < 8; j++)
      for (let i = -1; i < 9; i++) {
        const px = i * 16 + (j % 2) * 8;
        x.fillStyle = grey(r(0.8, 1));
        x.fillRect(px, j * 16, 16, 16);
        x.fillStyle = grey(0.56);
        x.fillRect(px, j * 16, 1.5, 16);
        x.fillRect(px, j * 16 + 13, 16, 3);
        if (kind === 'tile') {
          x.fillStyle = 'rgba(255,255,255,.35)';
          x.fillRect(px + 5, j * 16 + 1, 5, 11);
        }
      }
  } else if (kind === 'thatch') {
    x.fillStyle = grey(0.86);
    x.fillRect(0, 0, n, n);
    for (let k = 0; k < 900; k++) {
      x.strokeStyle = grey(r(0.6, 1));
      x.lineWidth = r(0.6, 1.6);
      const px = r(0, n),
        py = r(0, n);
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + r(-2, 2), py + r(8, 22));
      x.stroke();
    }
    for (let j = 0; j < 4; j++) {
      x.fillStyle = 'rgba(0,0,0,.22)';
      x.fillRect(0, j * 32 + 28, n, 4);
    }
  } else speckle(700, 0.9); // stucco
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return (ARCH_TEX[kind] = t);
}
const ARCH_MATS = {};
// a textured material: `kind` detail in colour `col`, repeated rx × ry across the face
function TM(kind, col, rx, ry) {
  const key = kind + col + rx + 'x' + ry;
  if (ARCH_MATS[key]) return ARCH_MATS[key];
  const t = archTex(kind).clone();
  t.needsUpdate = true;
  t.repeat.set(rx, ry);
  return (ARCH_MATS[key] = new THREE.MeshLambertMaterial({ color: LIN(col), map: t }));
}
const shadeHex = (col, k) => '#' + new THREE.Color(col).multiplyScalar(k).getHexString();
const archRep = (v) => Math.max(1, Math.round(v * 2));
const ARCH_SETS = {};
// a wall block: textured on its four sides (one detail tile is half a game tile), plain on top
function aBlock(g, kind, col, x, y, z, w, h, d, shadow) {
  const key = ['b', kind, col, archRep(w), archRep(h), archRep(d)].join('|');
  const mats =
    ARCH_SETS[key] ||
    (ARCH_SETS[key] = (() => {
      const side = TM(kind, col, archRep(d), archRep(h)),
        front = TM(kind, col, archRep(w), archRep(h)),
        top = M(shadeHex(col, 0.85));
      return [side, side, top, top, front, front];
    })());
  const m = P(g, 'box', mats, x, y + h / 2, z, w, h, d, shadow);
  m.receiveShadow = true;
  return m;
}
// a roof slab: textured on top, rows running across its width
function aSlabRoof(par, kind, col, w, len) {
  const key = ['r', kind, col, archRep(w), archRep(len)].join('|');
  const mats =
    ARCH_SETS[key] ||
    (ARCH_SETS[key] = (() => {
      const edge = M(shadeHex(col, 0.7));
      return [edge, edge, TM(kind, col, archRep(w), archRep(len)), edge, edge, edge];
    })());
  return P(par, 'box', mats, 0, 0, 0, w, 0.05, len);
}
/* A pitched roof sitting on walls w wide (along the ridge) and d deep, with its eaves at height y.
   o.axis 'z' turns the ridge to run front-to-back; o.over is the overhang; o.end the gable colour. */
function aGable(g, kind, col, x, y, z, w, d, rise, o = {}) {
  const r = new THREE.Group();
  r.position.set(x, y, z);
  if (o.axis === 'z') r.rotation.y = Math.PI / 2;
  g.add(r);
  const over = o.over ?? 0.12,
    ang = Math.atan2(rise, d / 2),
    slope = (d / 2 + over) / Math.cos(ang);
  for (const sd of [1, -1]) {
    const s = aSlabRoof(r, kind, col, w + over * 2, slope);
    s.position.set(0, rise - (slope / 2) * Math.sin(ang) + 0.02, sd * (slope / 2) * Math.cos(ang));
    s.rotation.x = sd * ang;
  }
  P(r, 'box', shadeHex(col, 0.72), 0, rise + 0.035, 0, w + over * 2 + 0.02, 0.05, 0.1);
  for (const sx of [-1, 1]) {
    const tri = new THREE.Shape();
    tri.moveTo(-d / 2, 0);
    tri.lineTo(d / 2, 0);
    tri.lineTo(0, rise);
    tri.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(tri), aGableMat(o.end || '#e9dfc6'));
    m.rotation.y = (sx * Math.PI) / 2;
    m.position.set((sx * w) / 2 - sx * 0.01, 0, 0);
    r.add(m);
    // barge boards along the gable edge
    for (const sd of [1, -1]) {
      const b = P(r, 'box', o.trim || '#f4efe2', sx * (w / 2 + over), 0, 0, 0.03, 0.06, slope);
      b.position.set(sx * (w / 2 + over), rise - (slope / 2) * Math.sin(ang), sd * (slope / 2) * Math.cos(ang));
      b.rotation.x = sd * ang;
    }
  }
  return r;
}
const GABLE_MATS = {};
const aGableMat = (col) =>
  GABLE_MATS[col] || (GABLE_MATS[col] = new THREE.MeshLambertMaterial({ color: LIN(col), side: THREE.DoubleSide }));
GEO.pyr = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); // a square-based pyramid, 1 × 1 × 1
// a hipped (pyramid) roof with a flat eave board
function aHip(g, col, x, y, z, w, d, rise, over = 0.12) {
  P(g, 'box', shadeHex(col, 0.7), x, y + 0.025, z, w + over * 2, 0.05, d + over * 2);
  P(g, 'pyr', col, x, y + 0.05 + rise / 2, z, w + over * 2 - 0.04, rise, d + over * 2 - 0.04);
}
// a flat roof with a parapet; returns the deck height for rooftop kit
function aFlat(g, col, x, y, z, w, d, cope) {
  P(g, 'box', shadeHex(col, 0.8), x, y + 0.02, z, w, 0.04, d);
  for (const [px, pz, sw, sd] of [
    [0, d / 2 - 0.03, w, 0.06],
    [0, -d / 2 + 0.03, w, 0.06],
    [w / 2 - 0.03, 0, 0.06, d],
    [-w / 2 + 0.03, 0, 0.06, d],
  ]) {
    P(g, 'box', col, x + px, y + 0.08, z + pz, sw, 0.16, sd);
    P(g, 'box', cope || '#f1ece2', x + px, y + 0.17, z + pz, sw + 0.03, 0.025, sd + 0.03, false);
  }
  return y + 0.04;
}
// a group standing on a wall face: build its children facing +z
function aFace(g, x, y, z, ry) {
  const f = new THREE.Group();
  f.position.set(x, y, z);
  f.rotation.y = ry || 0;
  g.add(f);
  return f;
}
const WINGLASS = new THREE.MeshPhongMaterial({ color: LIN('#6f9db8'), specular: LIN('#cfe6f2'), shininess: 60 });
/* a window, centred at (x, y, z). o: frame colour, shutters colour, box (flower box), bars (false for
   one sheet of glass), awn ([c1, c2] for a striped awning) */
function aWin(g, x, y, z, ry, w, h, o = {}) {
  const f = aFace(g, x, y, z, ry),
    fr = o.frame || '#f4efe2';
  P(f, 'box', fr, 0, 0, 0.012, w + 0.07, h + 0.07, 0.03, false);
  P(f, 'box', WINGLASS, 0, 0, 0.022, w, h, 0.03, false);
  if (o.bars !== false) {
    P(f, 'box', fr, 0, 0, 0.034, 0.02, h, 0.012, false);
    P(f, 'box', fr, 0, 0, 0.034, w, 0.02, 0.012, false);
  }
  P(f, 'box', fr, 0, -h / 2 - 0.045, 0.04, w + 0.12, 0.03, 0.08, false);
  if (o.shutters)
    for (const s of [-1, 1]) P(f, 'box', o.shutters, s * (w / 2 + 0.085), 0, 0.012, 0.1, h + 0.04, 0.02, false);
  if (o.box) {
    P(f, 'box', '#7a5230', 0, -h / 2 - 0.1, 0.08, w + 0.04, 0.07, 0.09, false);
    for (let k = 0; k < 4; k++) {
      const px = -w / 2 + ((k + 0.5) / 4) * w;
      P(f, 'sph', '#3f7a3a', px, -h / 2 - 0.05, 0.09, 0.05, 0.04, 0.05, false);
      P(f, 'sph', ['#e4573d', '#f2c94c', '#e85d9e', '#ffffff'][k], px, -h / 2 - 0.02, 0.1, 0.022, 0.022, 0.022, false);
    }
  }
  if (o.awn) aAwning(f, 0, h / 2 + 0.06, 0.02, 0, w + 0.16, 0.24, o.awn);
  return f;
}
/* a door standing on the ground at (x, z). o: glass (upper light), double, step (false to leave out),
   lamp (a light above), frame colour */
function aDoor(g, x, z, ry, w, h, col, o = {}) {
  const f = aFace(g, x, o.y || 0, z, ry),
    fr = o.frame || '#f4efe2';
  P(f, 'box', fr, 0, h / 2 + 0.03, 0.012, w + 0.09, h + 0.06, 0.03, false);
  P(f, 'box', col, 0, h / 2, 0.024, w, h, 0.03, false);
  const leaves = o.double ? [-w / 4, w / 4] : [0],
    lw = o.double ? w / 2 : w;
  for (const lx of leaves) {
    if (o.glass) P(f, 'box', WINGLASS, lx, h * 0.66, 0.034, lw - 0.1, h * 0.42, 0.02, false);
    else P(f, 'box', shadeHex(col, 0.8), lx, h * 0.66, 0.034, lw - 0.1, h * 0.4, 0.014, false);
    P(f, 'box', shadeHex(col, 0.8), lx, h * 0.22, 0.034, lw - 0.1, h * 0.28, 0.014, false);
  }
  if (o.double) P(f, 'box', shadeHex(col, 0.6), 0, h / 2, 0.036, 0.012, h, 0.014, false);
  P(f, 'sph', '#d8c48a', o.double ? 0.04 : w / 2 - 0.06, h * 0.46, 0.05, 0.018, 0.018, 0.018, false);
  if (o.step !== false) P(f, 'box', '#b9b7ae', 0, 0.02, 0.1, w + 0.22, 0.04, 0.2, false);
  if (o.lamp) {
    P(f, 'box', '#2d2f31', 0, h + 0.16, 0.03, 0.05, 0.04, 0.06, false);
    P(f, 'sph', LAMP_MAT, 0, h + 0.13, 0.07, 0.035, 0.035, 0.035, false);
  }
  return f;
}
// a roll-up door on a wall; `open` (0..1) raises it and shows the dark inside
function aRollDoor(g, x, y, z, ry, w, h, col, open = 0) {
  const f = aFace(g, x, y, z, ry);
  P(f, 'box', '#3d4347', 0, h / 2, 0.01, w + 0.1, h + 0.08, 0.03, false);
  P(f, 'box', '#15171a', 0, h / 2, 0.02, w, h, 0.03, false);
  const closed = h * (1 - open),
    n = Math.max(1, Math.round(closed / 0.09));
  for (let k = 0; k < n; k++)
    P(f, 'box', k % 2 ? col : shadeHex(col, 0.86), 0, h - (k + 0.5) * (closed / n), 0.032, w, closed / n, 0.02, false);
  return f;
}
// a striped awning sloping out from a wall, with a scalloped front edge
function aAwning(g, x, y, z, ry, w, d, cols) {
  const f = aFace(g, x, y, z, ry),
    n = Math.max(2, Math.round(w / 0.16));
  for (let k = 0; k < n; k++) {
    const px = -w / 2 + ((k + 0.5) / n) * w,
      s = P(f, 'box', cols[k % 2], px, -0.045, d / 2, w / n, 0.02, d + 0.02, false);
    s.rotation.x = 0.36;
    P(f, 'box', cols[k % 2], px, -0.13, d - 0.01, w / n, 0.06, 0.015, false);
  }
  return f;
}
// a veranda: floor, posts and a lean-to roof along a wall, from (x0..x1) out to depth dp
function aVeranda(g, x0, x1, z, dp, y, kind, col, post, n) {
  const w = x1 - x0,
    cx = (x0 + x1) / 2,
    r = aSlabRoof(g, kind, col, w + 0.16, dp + 0.16);
  r.position.set(cx, y - 0.07, z + dp / 2);
  r.rotation.x = 0.2;
  for (let k = 0; k < n; k++) {
    const px = x0 + 0.06 + (k / (n - 1)) * (w - 0.12);
    P(g, 'cyl', post, px, (y - 0.16) / 2, z + dp - 0.06, 0.035, y - 0.16);
  }
}
const aChimney = (g, kind, col, x, z, y0, y1, s = 0.2) => {
  aBlock(g, kind, col, x, y0, z, s, y1 - y0, s);
  P(g, 'box', shadeHex(col, 0.7), x, y1 + 0.02, z, s + 0.06, 0.04, s + 0.06);
  P(g, 'cyl', '#2d2f31', x, y1 + 0.08, z, s * 0.28, 0.1);
};
const aAC = (g, x, y, z) => {
  P(g, 'box', '#c5cacc', x, y + 0.11, z, 0.36, 0.22, 0.28);
  P(g, 'cyl', '#5a6066', x, y + 0.225, z, 0.1, 0.012, 0.1, false);
  P(g, 'box', '#8f979b', x, y + 0.11, z + 0.142, 0.3, 0.14, 0.006, false);
};
const aVent = (g, x, y, z) => {
  P(g, 'cyl', '#9aa3a8', x, y + 0.08, z, 0.04, 0.16);
  P(g, 'cone', '#7d868b', x, y + 0.19, z, 0.08, 0.07);
};
const aPipe = (g, x, z, h) => P(g, 'cyl', '#8d9599', x, h / 2, z, 0.022, h);
// a planter box with a row of shrubs (and flowers when `flowers` is set)
function aPlanter(g, x, z, w, ry, flowers) {
  const f = aFace(g, x, 0, z, ry);
  P(f, 'box', '#8a7458', 0, 0.09, 0, w, 0.14, 0.2);
  const n = Math.max(1, Math.round(w / 0.2));
  for (let k = 0; k < n; k++) {
    const px = -w / 2 + ((k + 0.5) / n) * w;
    P(f, 'sph', k % 2 ? '#3f7a3a' : '#4d8a45', px, 0.21, 0, 0.11, 0.1, 0.11);
    if (flowers) P(f, 'sph', ['#e4573d', '#f2c94c', '#e85d9e'][k % 3], px + 0.03, 0.29, 0.04, 0.03, 0.03, 0.03, false);
  }
}
const aCrate = (g, x, y, z, s = 0.24, col = '#b08a55') => {
  P(g, 'box', col, x, y + s / 2, z, s, s, s);
  P(g, 'box', shadeHex(col, 0.75), x, y + s / 2, z, s + 0.012, s * 0.16, s + 0.012, false);
};
const aBarrel = (g, x, z, col = '#7a5230') => {
  P(g, 'cyl', col, x, 0.15, z, 0.1, 0.3);
  for (const y of [0.07, 0.23]) P(g, 'cyl', '#3d4347', x, y, z, 0.104, 0.02, 0.104, false);
};
const aSack = (g, x, y, z, col = '#d8c48a') => P(g, 'sph', col, x, y + 0.07, z, 0.14, 0.075, 0.1);
const aHay = (g, x, y, z, ry) => {
  const m = P(g, 'box', '#d8bf6a', x, y + 0.1, z, 0.34, 0.2, 0.22);
  m.rotation.y = ry || 0;
  P(g, 'box', '#a8873f', x, y + 0.1, z, 0.345, 0.03, 0.225, false).rotation.y = ry || 0;
};
// a café table with stools; `shade` adds an umbrella in that colour
function aTable(g, x, z, shade, seats = 3) {
  P(g, 'cyl', '#f4efe2', x, 0.3, z, 0.2, 0.03);
  P(g, 'cyl', '#5b3c22', x, 0.17, z, 0.025, 0.26);
  for (let k = 0; k < seats; k++) {
    const a = 0.5 + (k / seats) * Math.PI * 2;
    P(g, 'cyl', '#7a5230', x + Math.cos(a) * 0.31, 0.11, z + Math.sin(a) * 0.31, 0.065, 0.2);
  }
  if (shade) {
    P(g, 'cyl', '#c9c4b8', x, 0.62, z, 0.014, 0.94);
    P(g, 'cone', shade, x, 1.08, z, 0.44, 0.2);
    P(g, 'sph', '#f4efe2', x, 1.19, z, 0.025, 0.025, 0.025, false);
  }
}
// a sign board on a wall or standing free, facing ry
function aSign(g, text, bg, fg, x, y, z, ry, w) {
  const f = aFace(g, x, y, z, ry);
  P(f, 'box', shadeHex(bg, 0.6), 0, 0, -0.012, w + 0.05, w / 4 + 0.05, 0.02, false);
  signBoard(f, text, bg, fg, 0, 0, 0.002, w);
  return f;
}
// the green cross of the animal hospital (never a red one: that emblem is protected)
function aCross(g, x, y, z, ry, s) {
  const f = aFace(g, x, y, z, ry);
  P(f, 'box', '#ffffff', 0, 0, 0, s * 1.5, s * 1.5, 0.02, false);
  P(f, 'box', '#2f8f5a', 0, 0, 0.012, s, s * 0.32, 0.02, false);
  P(f, 'box', '#2f8f5a', 0, 0, 0.012, s * 0.32, s, 0.02, false);
}
// corner boards and a base course for a timber building standing at (x, z), w × d
function aTrim(g, x, z, w, d, y0, y1, col) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1])
      P(g, 'box', col, x + (sx * w) / 2, (y0 + y1) / 2, z + (sz * d) / 2, 0.06, y1 - y0, 0.06, false);
}
const aSlab = (g, w, d, col) => (P(g, 'box', col, 0, 0.03, 0, w - 0.1, 0.06, d - 0.1, false).receiveShadow = true);
// a little electric utility cart, the kind staff drive around the back roads
function aCart(g, x, z, ry, col) {
  const f = aFace(g, x, 0, z, ry);
  P(f, 'box', col, 0, 0.17, 0, 0.36, 0.12, 0.72);
  P(f, 'box', shadeHex(col, 0.8), 0, 0.26, -0.18, 0.36, 0.1, 0.34);
  P(f, 'box', '#2a3a44', 0, 0.36, 0.1, 0.32, 0.18, 0.02, false);
  P(f, 'box', '#f1ece2', 0, 0.47, 0.18, 0.36, 0.02, 0.36);
  for (const [px, pz] of [
    [-0.15, 0.34],
    [0.15, 0.34],
    [-0.15, 0.0],
    [0.15, 0.0],
  ])
    P(f, 'cyl', '#c9c4b8', px, 0.36, pz, 0.01, 0.22, 0.01, false);
  for (const sx of [-1, 1])
    for (const sz of [-0.24, 0.24]) {
      const wh = P(f, 'cyl', '#1d1f21', sx * 0.19, 0.08, sz, 0.08, 0.05, 0.08, false);
      wh.rotation.z = Math.PI / 2;
    }
}
