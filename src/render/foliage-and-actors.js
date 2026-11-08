/* Trees, shrubs and rocks; status badges; syncing animal and guest visuals with the simulation each frame. */
/* foliage: leaf-card crowns, bark, sculpted rocks */
function cardTex(draw, n) {
  n = n || 512;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d'), n);
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = 4;
  return t;
}
function leafShape(x, l, w) {
  x.beginPath();
  x.moveTo(-l, 0);
  x.quadraticCurveTo(-l * 0.2, -w * 1.2, l, 0);
  x.quadraticCurveTo(-l * 0.2, w * 1.2, -l, 0);
  x.fill();
}
// pal: four leaf colours dark→light; len: leaf length range; wr: width/length; dens: leaf count multiplier
function leafClusterTex(pal, len, wr, dens) {
  return cardTex((x, n) => {
    // a dense, shaded cluster of leaves on twigs, darker toward the middle
    const cx = n / 2,
      cy = n / 2;
    for (let pass = 0; pass < 3; pass++)
      for (let k = 0; k < (pass === 0 ? 60 : pass === 1 ? 120 : 90) * dens; k++) {
        const a = Math.random() * 6.28,
          r = Math.pow(Math.random(), 0.7) * n * 0.42,
          px = cx + Math.cos(a) * r,
          py = cy + Math.sin(a) * r,
          l = rnd(len[0], len[1]),
          ang = a + rnd(-1, 1);
        const light = (pass / 2) * 0.6 + (1 - r / (n * 0.42)) * -0.25 + rnd(-0.1, 0.15);
        const base = pal[Math.max(0, Math.min(3, Math.round(light * 3 + 1)))];
        x.save();
        x.translate(px, py);
        x.rotate(ang);
        const g = x.createLinearGradient(0, -l * 0.4, 0, l * 0.4);
        g.addColorStop(0, `rgb(${base[0] + 28},${base[1] + 30},${base[2] + 14})`);
        g.addColorStop(1, `rgb(${base[0] - 10},${base[1] - 14},${base[2] - 8})`);
        x.fillStyle = g;
        leafShape(x, l, l * wr);
        x.strokeStyle = 'rgba(25,45,18,.45)';
        x.lineWidth = 1;
        x.beginPath();
        x.moveTo(-l, 0);
        x.lineTo(l * 0.9, 0);
        x.stroke();
        x.restore();
      }
    x.strokeStyle = 'rgba(60,42,25,.7)';
    x.lineWidth = 3;
    for (let k = 0; k < 5; k++) {
      const a = k * 1.25;
      x.beginPath();
      x.moveTo(cx, cy);
      x.lineTo(cx + Math.cos(a) * n * 0.3, cy + Math.sin(a) * n * 0.3);
      x.stroke();
    }
  });
}
const GREEN_PAL = [
  [44, 78, 32],
  [58, 100, 40],
  [76, 124, 50],
  [96, 146, 62],
];
const LEAF_T = leafClusterTex(GREEN_PAL, [16, 30], 0.38, 1);

const NEEDLE_T = cardTex((x, n) => {
  for (let k = 0; k < 40; k++) {
    const px = rnd(60, n - 60),
      py = rnd(60, n - 60),
      a = rnd(0, 6.28);
    x.save();
    x.translate(px, py);
    x.rotate(a);
    x.strokeStyle = '#4a3826';
    x.lineWidth = 2.5;
    x.beginPath();
    x.moveTo(-70, 0);
    x.lineTo(70, 0);
    x.stroke();
    for (let i = -66; i < 66; i += 3) {
      const c = pick(['#22432a', '#2c5530', '#1c3a22', '#36633c', '#41704a']);
      x.strokeStyle = c;
      x.lineWidth = 1.6;
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 9, -18 - rnd(0, 6));
      x.moveTo(i, 0);
      x.lineTo(i + 9, 18 + rnd(0, 6));
      x.stroke();
    }
    x.restore();
  }
});
// bark: vertical furrows with a matching normal map
const BARK_H = (() => {
  const n = 256,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = '#7a7a7a';
  x.fillRect(0, 0, n, n);
  for (let k = 0; k < 70; k++) {
    const px = rnd(0, n),
      w = rnd(3, 9);
    const g = x.createLinearGradient(px - w, 0, px + w, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,0,.6)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.beginPath();
    let y = 0;
    x.moveTo(px - w, 0);
    while (y < n) {
      y += rnd(10, 30);
      x.lineTo(px - w + rnd(-3, 3), y);
    }
    x.lineTo(px + w, n);
    x.lineTo(px + w, 0);
    x.fill();
    x.fillRect(px - w, 0, w * 2, 0);
  }
  for (let k = 0; k < 160; k++) {
    x.fillStyle = `rgba(255,255,255,${rnd(0.05, 0.18)})`;
    x.fillRect(rnd(0, n), rnd(0, n), rnd(4, 14), rnd(2, 4));
  }
  for (let ox of [-n, n]) x.drawImage(c, ox, 0);
  return c;
})();
const BARK_T = (() => {
  const n = 256,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = '#5a4532';
  x.fillRect(0, 0, n, n);
  x.globalCompositeOperation = 'multiply';
  x.drawImage(BARK_H, 0, 0);
  x.globalCompositeOperation = 'source-over';
  for (let k = 0; k < 120; k++) {
    x.fillStyle = pick(['rgba(110,120,80,.18)', 'rgba(40,30,20,.25)', 'rgba(140,120,95,.15)']);
    x.fillRect(rnd(0, n), rnd(0, n), rnd(6, 20), rnd(4, 12));
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
})();
const BARK_N = (() => {
  const n = 256,
    src = BARK_H.getContext('2d').getImageData(0, 0, n, n).data,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d'),
    out = x.createImageData(n, n);
  const h = (i, j) => src[(((j + n) % n) * n + ((i + n) % n)) * 4] / 255;
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const dx = (h(i + 1, j) - h(i - 1, j)) * 3,
        dy = (h(i, j + 1) - h(i, j - 1)) * 3,
        l = Math.hypot(dx, dy, 1),
        o = (j * n + i) * 4;
      out.data[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      out.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      out.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      out.data[o + 3] = 255;
    }
  x.putImageData(out, 0, 0);
  return new THREE.CanvasTexture(c);
})();
for (const t of [BARK_T, BARK_N]) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
}
const leafMat = (t, tint) =>
  new THREE.MeshStandardMaterial({
    map: t,
    color: LIN(tint),
    vertexColors: true,
    alphaTest: 0.42,
    side: THREE.FrontSide,
    roughness: 0.8,
  });
const LEAFMATS = ['#ffffff', '#e6f0d0', '#d8e6c8', '#f4f0c8'].map((c) => leafMat(LEAF_T, c));
const PINEMAT = leafMat(NEEDLE_T, '#ffffff'),
  SNOWMAT = leafMat(NEEDLE_T, '#e8f2f6');
const BARKMAT = new THREE.MeshStandardMaterial({
  map: BARK_T,
  normalMap: BARK_N,
  normalScale: new THREE.Vector2(1.4, 1.4),
  roughness: 0.95,
});
const depthFor = (t) => new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: t, alphaTest: 0.45 });
const LEAF_DEPTH = depthFor(LEAF_T),
  NEEDLE_DEPTH = depthFor(NEEDLE_T);
LEAF_DEPTH.alphaTest = NEEDLE_DEPTH.alphaTest = 0.42;
function crownGeo(rx, ry, rz, n, size, cone) {
  const pos = [],
    nor = [],
    uv = [],
    idx = [],
    col = [],
    q = new THREE.Quaternion(),
    e = new THREE.Euler(),
    v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    let cx, cy, cz;
    if (cone) {
      const h = Math.random();
      const r = (1 - h) * rx * Math.sqrt(Math.random());
      const a = Math.random() * 6.28;
      cx = Math.cos(a) * r;
      cz = Math.sin(a) * r;
      cy = h * ry * 2 - ry;
    } else {
      do {
        cx = rnd(-1, 1);
        cy = rnd(-1, 1);
        cz = rnd(-1, 1);
      } while (cx * cx + cy * cy + cz * cz > 1);
      const f = Math.pow(Math.hypot(cx, cy, cz), 0.35) / (Math.hypot(cx, cy, cz) || 1);
      cx *= rx * f;
      cy *= ry * f;
      cz *= rz * f;
    }
    e.set(rnd(0, 6.28), rnd(0, 6.28), rnd(0, 6.28));
    q.setFromEuler(e);
    const on = new THREE.Vector3(cx / rx, cone ? 0.4 : cy / ry, cz / rz).normalize();
    on.y = on.y * 0.6 + 0.4;
    on.normalize();
    const b = pos.length / 3,
      sz = size * rnd(0.8, 1.2);
    const rr = Math.min(1, Math.hypot(cx / rx, cy / ry, cz / rz)),
      ao = Math.pow(0.42 + 0.58 * rr, 1.4) * (0.82 + 0.28 * clamp((cy / ry) * 0.5 + 0.5, 0, 1)),
      hue = rnd(0.92, 1.06);
    for (const [u, w] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ]) {
      v.set(u * sz, w * sz, 0).applyQuaternion(q);
      pos.push(cx + v.x, cy + v.y, cz + v.z);
      nor.push(on.x, on.y, on.z);
      uv.push(u + 0.5, w + 0.5);
      col.push(ao * hue, ao, ao * (2 - hue));
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const CROWNS = [
  crownGeo(0.5, 0.42, 0.5, 150, 0.4),
  crownGeo(0.44, 0.48, 0.44, 135, 0.38),
  crownGeo(0.58, 0.38, 0.52, 160, 0.4),
  crownGeo(0.4, 0.34, 0.4, 110, 0.36),
];
const SUBCROWN = crownGeo(0.26, 0.22, 0.26, 40, 0.28);
const PINECROWN = crownGeo(0.42, 0.55, 0.42, 120, 0.34, true);
const BUSH = crownGeo(0.26, 0.18, 0.26, 46, 0.24);
const TRUNK = new THREE.CylinderGeometry(0.045, 0.085, 1, 9, 1);
TRUNK.translate(0, 0.5, 0);
function rockGeo(seed) {
  const g = new THREE.SphereGeometry(1, 40, 28),
    p = g.attributes.position,
    col = new Float32Array(p.count * 3),
    v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = n3(v.x * 1.6 + seed, v.y * 1.6, v.z * 1.6 + seed * 2) * 0.5 + n3(v.x * 4 + seed, v.y * 4, v.z * 4) * 0.18;
    v.multiplyScalar(0.78 + n);
    if (v.y < -0.2) v.y = -0.2 + (v.y + 0.2) * 0.2;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const nr = g.attributes.normal;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const ny = nr.getY(i),
      g0 = 0.42 + n3(v.x * 6 + seed, v.y * 6, v.z * 6) * 0.14;
    let c = [g0, g0 * 0.98, g0 * 0.94];
    if (ny > 0.55 && n3(v.x * 3, v.y * 3 + seed, v.z * 3) > 0.45)
      c = mixA(c, [0.28, 0.38, 0.18], clamp((ny - 0.55) * 2.5, 0, 1));
    col[i * 3] = Math.pow(c[0], 2.2);
    col[i * 3 + 1] = Math.pow(c[1], 2.2);
    col[i * 3 + 2] = Math.pow(c[2], 2.2);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}
const ROCKS = [0, 1, 2, 3].map(rockGeo),
  ROCKMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
function leafMesh(geo, mat, depth, x, y, z, s) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.setScalar(s);
  m.rotation.y = Math.random() * 6.28;
  m.castShadow = true;
  m.receiveShadow = true;
  m.customDepthMaterial = depth;
  return m;
}
/* ---- tree, shrub and rock variety ---- */
// Canopy toggle: when false, crowns (and the upper redwood trunk) are hidden so you can see underneath.
let CANOPY_ON = true;
function setCanopy(on) {
  CANOPY_ON = on;
  for (const root of [staticRoot, worldEdge])
    root.traverse((o) => {
      if (o.userData.crown) o.visible = on;
    });
}

// extra leaf textures (same leaf-cluster painter, different palettes and leaf shapes)
const MAPLE_T = leafClusterTex(
  [
    [116, 30, 18],
    [168, 52, 24],
    [206, 92, 32],
    [232, 142, 54],
  ],
  [16, 28],
  0.5,
  1
);
const GOLD_T = leafClusterTex(
  [
    [130, 86, 20],
    [178, 124, 28],
    [214, 164, 44],
    [236, 196, 80],
  ],
  [16, 28],
  0.5,
  1
);
const BIRCH_LEAF_T = leafClusterTex(
  [
    [70, 104, 36],
    [96, 132, 44],
    [128, 160, 58],
    [162, 186, 82],
  ],
  [18, 28],
  0.6,
  1
);
const ACACIA_T = leafClusterTex(
  [
    [60, 78, 32],
    [80, 102, 40],
    [104, 124, 52],
    [130, 146, 66],
  ],
  [14, 22],
  0.45,
  1.4
);
const BAMBOO_LEAF_T = leafClusterTex(
  [
    [48, 88, 32],
    [66, 112, 40],
    [92, 140, 54],
    [122, 166, 70],
  ],
  [26, 42],
  0.16,
  0.7
);
// hanging strands of narrow leaves (willow)
const WILLOW_T = cardTex((x, n) => {
  for (let k = 0; k < 16; k++) {
    let px = rnd(40, n - 40),
      py = rnd(0, 30);
    const sway = rnd(-0.25, 0.25);
    x.strokeStyle = 'rgba(80,70,40,.7)';
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + sway * n * 0.3, n - rnd(10, 60));
    x.stroke();
    const end = n - rnd(10, 60);
    for (; py < end; py += rnd(5, 9)) {
      const f = py / n,
        cx = px + sway * n * 0.3 * f;
      for (const sd of [-1, 1]) {
        const c = pick(['#5e8a34', '#6f9c3c', '#86ad4a', '#9cbe5c', '#4e7a2c']);
        x.fillStyle = c;
        x.save();
        x.translate(cx, py);
        x.rotate(Math.PI / 2 + sd * rnd(0.25, 0.5));
        leafShape(x, rnd(9, 14), 2.6);
        x.restore();
      }
    }
  }
}, 256);
// a single fern frond lying along +u (base on the left)
const FERN_T = cardTex((x, n) => {
  const cy = n / 2;
  x.strokeStyle = '#3d5a22';
  x.lineWidth = 3;
  x.beginPath();
  x.moveTo(4, cy);
  x.lineTo(n - 6, cy);
  x.stroke();
  for (let px = 14; px < n - 10; px += 7) {
    const f = px / n,
      l = (1 - f) * n * 0.36 * Math.min(1, f * 5) + 4;
    for (const sd of [-1, 1]) {
      x.fillStyle = pick(['#3f6e26', '#4b7d2c', '#578a34', '#62963a']);
      x.save();
      x.translate(px, cy);
      x.rotate(sd * (Math.PI / 2 - 0.35));
      x.beginPath();
      x.moveTo(0, 0);
      x.quadraticCurveTo(l * 0.5, -l * 0.16, l, 0);
      x.quadraticCurveTo(l * 0.5, l * 0.16, 0, 0);
      x.fill();
      x.restore();
    }
  }
}, 256);
// a clump of tall grass blades growing up from the bottom edge
const TALLGRASS_T = cardTex((x, n) => {
  for (let k = 0; k < 70; k++) {
    const bx = rnd(n * 0.15, n * 0.85),
      h = rnd(0.5, 0.95) * n,
      lean = rnd(-0.3, 0.3) * n,
      w = rnd(3, 6);
    x.fillStyle = pick(['#6e8a3a', '#7f9a44', '#94a854', '#a8b464', '#c2b872', '#5a7a30']);
    x.beginPath();
    x.moveTo(bx - w, n);
    x.quadraticCurveTo(bx + lean * 0.3, n - h * 0.6, bx + lean, n - h);
    x.quadraticCurveTo(bx + lean * 0.3 + w * 0.5, n - h * 0.6, bx + w, n);
    x.fill();
  }
  for (let k = 0; k < 14; k++) {
    const bx = rnd(n * 0.2, n * 0.8),
      h = rnd(0.75, 0.98) * n;
    x.strokeStyle = '#b89a5a';
    x.lineWidth = 1.5;
    x.beginPath();
    x.moveTo(bx, n);
    x.lineTo(bx + rnd(-12, 12), n - h);
    x.stroke();
    x.fillStyle = '#d2b878';
    x.save();
    x.translate(bx, n - h);
    x.rotate(-Math.PI / 2);
    leafShape(x, 10, 3);
    x.restore();
  }
}, 256);

const depthOf = (t) => {
  const d = depthFor(t);
  d.alphaTest = 0.42;
  return d;
};
const MAPLE_MAT = leafMat(MAPLE_T, '#ffffff'),
  GOLD_MAT = leafMat(GOLD_T, '#ffffff'),
  BIRCH_LEAF_MAT = leafMat(BIRCH_LEAF_T, '#ffffff'),
  ACACIA_MAT = leafMat(ACACIA_T, '#ffffff'),
  BAMBOO_LEAF_MAT = leafMat(BAMBOO_LEAF_T, '#ffffff'),
  WILLOW_MAT = leafMat(WILLOW_T, '#ffffff'),
  FERN_MAT = leafMat(FERN_T, '#ffffff'),
  TALLGRASS_MAT = leafMat(TALLGRASS_T, '#ffffff'),
  OAK_MAT = leafMat(LEAF_T, '#c4d4ae'),
  CYPRESS_MAT = leafMat(NEEDLE_T, '#c8dcc0'),
  REDWOOD_LEAF_MAT = leafMat(NEEDLE_T, '#d4e4c0');
const MAPLE_DEPTH = depthOf(MAPLE_T),
  BIRCH_DEPTH = depthOf(BIRCH_LEAF_T),
  ACACIA_DEPTH = depthOf(ACACIA_T),
  BAMBOO_DEPTH = depthOf(BAMBOO_LEAF_T),
  WILLOW_DEPTH = depthOf(WILLOW_T),
  FERN_DEPTH = depthOf(FERN_T),
  TALLGRASS_DEPTH = depthOf(TALLGRASS_T);

// bark variants
function barkTexOf(base, marks, depth) {
  const n = 256,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, n, n);
  x.globalAlpha = marks ? 0.35 : depth || 1;
  x.globalCompositeOperation = 'multiply';
  x.drawImage(BARK_H, 0, 0);
  x.globalCompositeOperation = 'source-over';
  x.globalAlpha = 1;
  if (marks)
    for (let k = 0; k < 90; k++) {
      x.fillStyle = pick(['rgba(30,26,22,.85)', 'rgba(60,52,44,.7)', 'rgba(20,18,16,.9)']);
      const w = rnd(8, 40),
        px = rnd(0, n),
        py = rnd(0, n);
      x.fillRect(px, py, w, rnd(2, 5));
      if (px + w > n) x.fillRect(px - n, py, w, 3);
    }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(2, 3);
  return t;
}
const barkMatOf = (map, rough) =>
  new THREE.MeshStandardMaterial({
    map,
    normalMap: BARK_N,
    normalScale: new THREE.Vector2(1.6, 1.6),
    roughness: rough || 0.95,
  });
const REDBARK = barkMatOf(barkTexOf('#b85a38', false, 0.7)),
  BIRCHBARK = barkMatOf(barkTexOf('#ece8de', true), 0.8),
  BAOBARK = barkMatOf(barkTexOf('#cdbba4', false, 0.55)),
  BAMBOO_MAT = (() => {
    const c = document.createElement('canvas');
    c.width = 16;
    c.height = 128;
    const x = c.getContext('2d'),
      g = x.createLinearGradient(0, 0, 16, 0);
    g.addColorStop(0, '#5f8a30');
    g.addColorStop(0.5, '#9cbf55');
    g.addColorStop(1, '#5a8430');
    x.fillStyle = g;
    x.fillRect(0, 0, 16, 128);
    x.fillStyle = '#c9d48a';
    x.fillRect(0, 0, 16, 4);
    x.fillStyle = '#3f6222';
    x.fillRect(0, 4, 16, 2);
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1, 5);
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 });
  })();

// card geometry builder: quads given by 4 corners (bl, br, tr, tl), each with a normal and shade
function cardsGeo(cards) {
  const pos = [],
    nor = [],
    uv = [],
    col = [],
    idx = [];
  for (const c of cards) {
    const b = pos.length / 3,
      uvs = c.uv || [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ];
    for (let i = 0; i < 4; i++) {
      pos.push(...c.p[i]);
      nor.push(...c.n);
      uv.push(...uvs[i]);
      const ao = Array.isArray(c.ao) ? c.ao[i] : c.ao;
      col.push(ao, ao, ao);
    }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
// hanging curtain of strands around an ellipsoid crown (willow)
function hangGeo(rx, ry, n, len, w) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 6.28),
      el = rnd(-0.15, 0.85),
      cr = Math.cos(el),
      rr = rnd(0.75, 1.02);
    const top = [Math.cos(a) * rx * cr * rr, Math.sin(el) * ry, Math.sin(a) * rx * cr * rr];
    const L = len * rnd(0.6, 1.15) * (1 - el * 0.4),
      tx = -Math.sin(a) * w * 0.5,
      tz = Math.cos(a) * w * 0.5,
      ox = Math.cos(a) * 0.08,
      oz = Math.sin(a) * 0.08,
      by = top[1] - L;
    cards.push({
      p: [
        [top[0] - tx + ox, by, top[2] - tz + oz],
        [top[0] + tx + ox, by, top[2] + tz + oz],
        [top[0] + tx, top[1], top[2] + tz],
        [top[0] - tx, top[1], top[2] - tz],
      ],
      n: new THREE.Vector3(Math.cos(a), 0.6, Math.sin(a)).normalize().toArray(),
      ao: [0.55, 0.55, 0.9 + el * 0.1, 0.9 + el * 0.1],
    });
  }
  return cardsGeo(cards);
}
// radial arching fronds (ferns)
function frondGeo(n, len, w, lift) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 6.28 + rnd(-0.3, 0.3),
      L = len * rnd(0.7, 1.15),
      up = lift * rnd(0.7, 1.3),
      dx = Math.cos(a),
      dz = Math.sin(a),
      tx = -dz * w * 0.5,
      tz = dx * w * 0.5;
    const mid = [dx * L * 0.5, L * up, dz * L * 0.5],
      tip = [dx * L, L * up * 0.55, dz * L];
    cards.push({
      p: [
        [tx * 0.4, 0.01, tz * 0.4],
        [mid[0] + tx, mid[1], mid[2] + tz],
        [mid[0] - tx, mid[1], mid[2] - tz],
        [-tx * 0.4, 0.01, -tz * 0.4],
      ],
      uv: [
        [0, 1],
        [0.5, 1],
        [0.5, 0],
        [0, 0],
      ],
      n: [0, 1, 0],
      ao: [0.5, 0.9, 0.9, 0.5],
    });
    cards.push({
      p: [
        [mid[0] + tx, mid[1], mid[2] + tz],
        [tip[0] + tx * 0.5, tip[1], tip[2] + tz * 0.5],
        [tip[0] - tx * 0.5, tip[1], tip[2] - tz * 0.5],
        [mid[0] - tx, mid[1], mid[2] - tz],
      ],
      uv: [
        [0.5, 1],
        [1, 1],
        [1, 0],
        [0.5, 0],
      ],
      n: [0, 1, 0],
      ao: [0.9, 1, 1, 0.9],
    });
  }
  return cardsGeo(cards);
}
// crossed upright cards (tall grass)
function clumpGeo(n, r, w, h) {
  const cards = [];
  for (let i = 0; i < n; i++) {
    const a = rnd(0, 3.14),
      cx = rnd(-r, r),
      cz = rnd(-r, r),
      hh = h * rnd(0.75, 1.2),
      tx = Math.cos(a) * w * 0.5,
      tz = Math.sin(a) * w * 0.5,
      lx = cx * 0.5,
      lz = cz * 0.5;
    cards.push({
      p: [
        [cx - tx, 0, cz - tz],
        [cx + tx, 0, cz + tz],
        [cx + tx + lx, hh, cz + tz + lz],
        [cx - tx + lx, hh, cz - tz + lz],
      ],
      n: new THREE.Vector3(cx, 2, cz).normalize().toArray(),
      ao: [0.5, 0.5, 1, 1],
    });
  }
  return cardsGeo(cards);
}

// shared geometry, built once at load (scenery rebuilds reuse it)
const G2 = {
  oak: crownGeo(0.82, 0.5, 0.82, 230, 0.44),
  oakSub: crownGeo(0.42, 0.32, 0.42, 70, 0.38),
  birch: [crownGeo(0.3, 0.42, 0.3, 60, 0.28), crownGeo(0.26, 0.36, 0.26, 50, 0.26)],
  maple: crownGeo(0.6, 0.56, 0.6, 175, 0.42),
  cypress: crownGeo(0.22, 0.95, 0.22, 120, 0.26),
  redwood: crownGeo(0.5, 0.36, 0.5, 80, 0.36, true),
  willowTop: crownGeo(0.62, 0.34, 0.62, 100, 0.38),
  willowHang: hangGeo(0.78, 0.36, 140, 1.0, 0.3),
  acacia: crownGeo(0.85, 0.12, 0.85, 170, 0.38),
  acaciaSub: crownGeo(0.42, 0.1, 0.42, 60, 0.34),
  baobabTuft: crownGeo(0.2, 0.12, 0.2, 22, 0.26),
  palm: crownGeo(0.45, 0.12, 0.45, 50, 0.4),
  bambooLeaf: crownGeo(0.2, 0.3, 0.2, 26, 0.28),
  fern: [frondGeo(9, 0.42, 0.16, 0.55), frondGeo(7, 0.34, 0.14, 0.7)],
  grass: [clumpGeo(9, 0.16, 0.36, 0.55), clumpGeo(7, 0.14, 0.32, 0.45)],
  baobabTrunk: (() => {
    const pts = [
      [0.3, 0],
      [0.34, 0.08],
      [0.335, 0.4],
      [0.31, 0.8],
      [0.26, 1.1],
      [0.18, 1.28],
      [0.02, 1.3],
    ]
      .reverse()
      .map(([r, y]) => new THREE.Vector2(r, y));
    return new THREE.LatheGeometry(pts, 14);
  })(),
  stalk: (() => {
    const c = new THREE.CylinderGeometry(0.026, 0.032, 1, 7, 1);
    c.translate(0, 0.5, 0);
    return c;
  })(),
};

function trunkPart(g, mat, sx, sy, x, y, z, rx, rz, geo) {
  const t = new THREE.Mesh(geo || TRUNK, mat);
  t.scale.set(sx, sy, sx);
  t.position.set(x || 0, y || 0, z || 0);
  t.rotation.set(rx || 0, 0, rz || 0);
  t.castShadow = true;
  t.receiveShadow = true;
  g.add(t);
  return t;
}
function crownPart(g, geo, mat, depth, x, y, z, s) {
  const m = leafMesh(geo, mat, depth, x, y, z, s);
  m.userData.crown = true;
  m.visible = CANOPY_ON;
  g.add(m);
  return m;
}
const TREE_BUILDERS = {
  redwood(g) {
    trunkPart(g, REDBARK, 3.6, 0.35); // flared base
    trunkPart(g, REDBARK, 2.6, 1.5);
    const up = trunkPart(g, REDBARK, 1.9, 3.0, 0, 1.4);
    up.userData.crown = true;
    up.visible = CANOPY_ON;
    const tiers = [
      [1.9, 1.15],
      [2.4, 1.05],
      [2.9, 0.92],
      [3.35, 0.78],
      [3.8, 0.62],
      [4.2, 0.44],
    ];
    for (const [y, s] of tiers)
      crownPart(g, G2.redwood, REDWOOD_LEAF_MAT, NEEDLE_DEPTH, rnd(-0.05, 0.05), y, rnd(-0.05, 0.05), s);
  },
  oak(g) {
    trunkPart(g, BARKMAT, 1.7, 0.8);
    for (const a of [0, 1.6, 3.2, 4.7]) {
      const b = trunkPart(g, BARKMAT, 0.75, 0.55, 0, 0.55);
      b.rotation.set(Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0);
    }
    crownPart(g, G2.oak, OAK_MAT, LEAF_DEPTH, 0, 1.1, 0, 1);
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + rnd(0, 1);
      crownPart(g, G2.oakSub, OAK_MAT, LEAF_DEPTH, Math.cos(a) * 0.55, rnd(0.85, 1.0), Math.sin(a) * 0.55, 1);
    }
  },
  birch(g) {
    const n = Math.random() < 0.5 ? 1 : 2;
    for (let k = 0; k < n; k++) {
      const ox = k ? 0.14 : 0,
        lean = k ? 0.12 : rnd(-0.05, 0.05);
      trunkPart(g, BIRCHBARK, 0.5, 1.75, ox, 0, 0, 0, lean);
      crownPart(g, G2.birch[0], BIRCH_LEAF_MAT, BIRCH_DEPTH, ox + lean * 1.4, 1.45, 0, 1);
      crownPart(g, G2.birch[1], BIRCH_LEAF_MAT, BIRCH_DEPTH, ox + lean * 1.1 + 0.12, 1.05, 0.08, 1);
    }
  },
  maple(g) {
    trunkPart(g, BARKMAT, 1.15, 0.85);
    for (const a of [0.4, 2.5, 4.6]) {
      const b = trunkPart(g, BARKMAT, 0.5, 0.45, 0, 0.6);
      b.rotation.set(Math.cos(a) * 0.7, 0, Math.sin(a) * 0.7);
    }
    const mat = Math.random() < 0.6 ? MAPLE_MAT : GOLD_MAT;
    crownPart(g, G2.maple, mat, MAPLE_DEPTH, 0, 1.15, 0, 1);
    crownPart(g, SUBCROWN, mat, MAPLE_DEPTH, rnd(-0.3, 0.3), 0.8, rnd(-0.3, 0.3), 1.1);
  },
  cypress(g) {
    trunkPart(g, BARKMAT, 0.7, 0.5);
    crownPart(g, G2.cypress, CYPRESS_MAT, NEEDLE_DEPTH, 0, 1.25, 0, 1);
  },
  willow(g) {
    const t = trunkPart(g, BARKMAT, 1.4, 1.0, 0, 0, 0, 0, 0.1);
    t.scale.y = 1.05;
    for (const a of [0.5, 2.6, 4.4]) {
      const b = trunkPart(g, BARKMAT, 0.6, 0.5, 0.08, 0.8);
      b.rotation.set(Math.cos(a) * 0.9, 0, Math.sin(a) * 0.9);
    }
    crownPart(g, G2.willowTop, LEAFMATS[1], LEAF_DEPTH, 0.1, 1.35, 0, 1);
    crownPart(g, G2.willowHang, WILLOW_MAT, WILLOW_DEPTH, 0.1, 1.4, 0, 1);
  },
  acacia(g) {
    const lean = rnd(-0.15, 0.15);
    trunkPart(g, BARKMAT, 0.85, 0.85, 0, 0, 0, 0, lean);
    for (const a of [0.3, 2.4, 4.3]) {
      const b = trunkPart(g, BARKMAT, 0.5, 0.65, -lean * 0.8, 0.8);
      b.rotation.set(Math.cos(a) * 0.75, 0, Math.sin(a) * 0.75);
    }
    crownPart(g, G2.acacia, ACACIA_MAT, ACACIA_DEPTH, -lean * 0.9, 1.38, 0, 1);
    for (let k = 0; k < 2; k++) {
      const a = k * 3.1 + rnd(0, 1);
      crownPart(g, G2.acaciaSub, ACACIA_MAT, ACACIA_DEPTH, Math.cos(a) * 0.5, 1.22, Math.sin(a) * 0.5, 1);
    }
  },
  baobab(g) {
    trunkPart(g, BAOBARK, 1, 1, 0, 0, 0, 0, 0, G2.baobabTrunk);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * 6.28 + rnd(-0.3, 0.3),
        tilt = rnd(0.5, 0.9),
        L = rnd(0.35, 0.5);
      const b = trunkPart(g, BAOBARK, 0.8, L, Math.cos(a) * 0.08, 1.22, Math.sin(a) * 0.08);
      b.rotation.set(Math.sin(a) * tilt, 0, -Math.cos(a) * tilt);
      const ex = Math.cos(a) * (0.08 + Math.sin(tilt) * L),
        ez = Math.sin(a) * (0.08 + Math.sin(tilt) * L),
        ey = 1.22 + Math.cos(tilt) * L;
      crownPart(g, G2.baobabTuft, ACACIA_MAT, ACACIA_DEPTH, ex, ey + 0.05, ez, rnd(0.9, 1.3));
    }
  },
  bamboo(g) {
    const n = 9 + Math.floor(Math.random() * 5);
    for (let k = 0; k < n; k++) {
      const a = rnd(0, 6.28),
        r = Math.sqrt(Math.random()) * 0.28,
        x = Math.cos(a) * r,
        z = Math.sin(a) * r,
        h = rnd(1.7, 2.6),
        lx = x * 0.25,
        lz = z * 0.25;
      const s = trunkPart(g, BAMBOO_MAT, rnd(0.8, 1.15), h, x, 0, z, lz, -lx, G2.stalk);
      s.castShadow = true;
      crownPart(g, G2.bambooLeaf, BAMBOO_LEAF_MAT, BAMBOO_DEPTH, x + lx * h, h - 0.15, z + lz * h, rnd(0.9, 1.3));
      if (Math.random() < 0.6)
        crownPart(g, G2.bambooLeaf, BAMBOO_LEAF_MAT, BAMBOO_DEPTH, x + lx * h * 0.7, h * 0.7, z + lz * h * 0.7, 0.8);
    }
  },
};
function makeGroundPlant(g, kind) {
  g.rotation.y = Math.random() * 6.28;
  const fern = kind === 'fern';
  const n = fern ? 3 : 3;
  for (let k = 0; k < n; k++) {
    const a = k * 2.1 + rnd(0, 1),
      r = k ? rnd(0.18, 0.3) : 0,
      s = k ? rnd(0.7, 0.95) : rnd(1, 1.15);
    const m = fern
      ? leafMesh(G2.fern[k % 2], FERN_MAT, FERN_DEPTH, Math.cos(a) * r, 0, Math.sin(a) * r, s)
      : leafMesh(G2.grass[k % 2], TALLGRASS_MAT, TALLGRASS_DEPTH, Math.cos(a) * r, 0, Math.sin(a) * r, s);
    g.add(m);
  }
}
function makeRock(g, kind, x, y) {
  const r0 = Math.floor(hsh(x, y) * 4);
  g.rotation.y = hsh(y, x) * 6.28;
  const rock = (i, sx, sy, sz, px, py, pz, ry) => {
    const m = new THREE.Mesh(ROCKS[(r0 + i) % 4], ROCKMAT);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    m.rotation.y = ry || 0;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'rockpile') {
    rock(0, 0.24, 0.2, 0.22, -0.08, 0.04, 0.02, 0);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + rnd(-0.3, 0.3),
        r = rnd(0.16, 0.34),
        s = rnd(0.08, 0.15);
      rock(k + 1, s, s * rnd(0.7, 1), s * rnd(0.8, 1.1), Math.cos(a) * r, 0.02, Math.sin(a) * r, rnd(0, 6));
    }
    rock(2, 0.12, 0.1, 0.12, 0.02, 0.2, 0.0, 1);
  } else if (kind === 'spire') {
    rock(0, 0.26, 1.15, 0.24, 0, 0.18, 0, 0);
    rock(1, 0.18, 0.62, 0.16, 0.18, 0.1, 0.1, 1.2);
    rock(2, 0.14, 0.12, 0.13, -0.24, 0.03, -0.12, 0.4);
  } else if (kind === 'slab') {
    const m = rock(0, 0.46, 0.11, 0.4, 0, 0.03, 0, 0);
    m.rotation.z = 0.06;
    rock(1, 0.14, 0.1, 0.13, 0.36, 0.02, -0.22, 2);
  }
}
function makeTree(par, kind, s) {
  const g = new THREE.Group();
  par.add(g);
  g.scale.setScalar(s || 1);
  g.rotation.y = Math.random() * 6.28;
  if (TREE_BUILDERS[kind]) {
    TREE_BUILDERS[kind](g);
    return g;
  }
  if (kind === 'pine' || kind === 'snow' || kind === 'fir') {
    const t = new THREE.Mesh(TRUNK, BARKMAT);
    t.scale.set(0.8, 1.2, 0.8);
    t.castShadow = true;
    g.add(t);
    crownPart(g, PINECROWN, kind !== 'pine' ? SNOWMAT : PINEMAT, NEEDLE_DEPTH, 0, 0.78, 0, 1);
    if (kind !== 'pine') {
      const cap = P(g, 'cone', '#f4f8fb', 0, 1.25, 0, 0.12, 0.16, 0.12, false);
      cap.userData.crown = true;
      cap.visible = CANOPY_ON;
    }
  } else if (kind === 'cactus') {
    P(g, 'cyl', '#4f8a3c', 0, 0.3, 0, 0.08, 0.6);
    P(g, 'sph', '#4f8a3c', 0, 0.6, 0, 0.08);
    P(g, 'cyl', '#4f8a3c', 0.13, 0.38, 0, 0.045, 0.22);
    P(g, 'cyl', '#4f8a3c', 0.09, 0.27, 0, 0.045, 0.09).rotation.z = Math.PI / 2;
    P(g, 'cyl', '#4f8a3c', -0.12, 0.32, 0, 0.04, 0.16);
    P(g, 'cyl', '#4f8a3c', -0.08, 0.24, 0, 0.04, 0.08).rotation.z = Math.PI / 2;
    P(g, 'sph', '#f2c94c', 0, 0.68, 0, 0.035);
  } else if (kind === 'palm') {
    const tr = new THREE.Mesh(TRUNK, BARKMAT);
    tr.scale.set(0.6, 0.95, 0.6);
    tr.rotation.z = 0.12;
    tr.castShadow = true;
    g.add(tr);
    crownPart(g, G2.palm, LEAFMATS[1], LEAF_DEPTH, 0.1, 0.95, 0, 1);
  } else {
    const t = new THREE.Mesh(TRUNK, BARKMAT);
    t.scale.set(1, 0.85, 1);
    t.castShadow = true;
    g.add(t);
    for (const a of [0, 2.1, 4.2]) {
      const b = new THREE.Mesh(TRUNK, BARKMAT);
      b.scale.set(0.45, 0.38, 0.45);
      b.position.set(0, 0.55, 0);
      b.rotation.set(Math.cos(a) * 0.8, 0, Math.sin(a) * 0.8);
      b.castShadow = true;
      g.add(b);
    }
    const mi = Math.floor(Math.random() * LEAFMATS.length),
      mat = LEAFMATS[mi];
    crownPart(g, pick(CROWNS), mat, LEAF_DEPTH, 0, 1.0, 0, 1);
    crownPart(g, SUBCROWN, mat, LEAF_DEPTH, rnd(-0.25, 0.25), rnd(0.72, 0.85), rnd(-0.25, 0.25), 1);
    crownPart(g, SUBCROWN, mat, LEAF_DEPTH, rnd(-0.2, 0.2), 1.28, rnd(-0.2, 0.2), 0.9);
  }
  return g;
}

function spriteTex(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = kind === 'sick' ? '#ffffff' : '#e5674f';
  x.beginPath();
  x.arc(32, 32, 28, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.25)';
  x.lineWidth = 3;
  x.stroke();
  if (kind === 'sick') {
    x.fillStyle = '#d8382a';
    x.fillRect(26, 14, 12, 36);
    x.fillRect(14, 26, 36, 12);
  } else {
    x.fillStyle = '#fff';
    x.fillRect(28, 13, 8, 26);
    x.fillRect(28, 44, 8, 8);
  }
  const tx = new THREE.CanvasTexture(c);
  tx.encoding = THREE.sRGBEncoding;
  return new THREE.SpriteMaterial({ map: tx, depthTest: false, toneMapped: false });
}
const SPR = { sick: spriteTex('sick'), sad: spriteTex('sad') };
const animalRoot = new THREE.Group();
scene.add(animalRoot);
const amesh = new Map();
function modelFor(a) {
  const g = buildAnimal(a.sp);
  const sp = new THREE.Sprite(SPR.sad);
  sp.scale.set(0.2, 0.2, 1);
  sp.position.y = g.userData.top + 0.14;
  sp.visible = false;
  sp.renderOrder = 5;
  g.add(sp);
  g.userData.badge = sp;
  g.userData.aid = a.id;
  g.userData.yaw = 0;
  g.userData.sp = a.sp;
  const sc = a.born > S.day - 2 && a.baby ? 0.6 : 1;
  g.scale.setScalar(sc);
  animalRoot.add(g);
  return g;
}
const ANIMAL_FAR = 40; // tiles from the camera target
function syncAnimals(alpha, time, dt) {
  const live = new Set();
  for (const a of S.animals) {
    live.add(a.id);
    let m = amesh.get(a.id);
    if (!m) {
      m = modelFor(a);
      amesh.set(a.id, m);
    }
    const x = a.ox + (a.x - a.ox) * alpha,
      z = a.oy + (a.y - a.oy) * alpha,
      dx = a.x - a.ox,
      dz = a.y - a.oy,
      mv = Math.hypot(dx, dz) > 0.001;
    const u = m.userData;
    // asleep inside a night shelter, or away at the vet: not in the habitat at all
    m.visible = !a.away && a.inside == null;
    if (!m.visible) continue;
    if (mv) {
      const tgt = -Math.atan2(dz, dx);
      let d = tgt - u.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      u.yaw += d * 0.15;
    }
    m.rotation.y = u.yaw;
    const ph = time * 0.012 + a.id;
    let y = 0;
    const swim = SWIM_Y[a.sp];
    if (u.mixer) {
      const want = a.chase
        ? 'walk'
        : a.show > 0 && !a.showDelay
          ? 'jump'
          : a.sick || a.happy < 30 || a.sleep
            ? 'lie'
            : (mv || swim) && !(swim && !mv && hsh(a.id, Math.floor(time / 7000)) < 0.3)
              ? 'walk'
              : hsh(a.id, Math.floor(time / 9000)) < 0.45
                ? 'graze'
                : 'idle';
      const nw = u.acts[want] ? want : 'idle';
      if (nw !== u.cur && u.acts[nw]) {
        u.acts[nw].reset().fadeIn(0.35).play();
        if (u.acts[u.cur]) u.acts[u.cur].fadeOut(0.35);
        u.cur = nw;
      }
      // level of detail: far-away animals stop casting shadows and animate 4× less often
      const far = Math.hypot(m.position.x - CAM.tx, m.position.z - CAM.tz) > ANIMAL_FAR;
      if (far !== u.far) {
        u.far = far;
        m.traverse((o) => {
          if (o.isMesh) o.castShadow = !far;
        });
      }
      u.acc = (u.acc || 0) + ((dt || 16) / 1000) * (speed || 0) * (nw === 'walk' ? (a.chase ? 2.3 : 1.1) : 1);
      u.n = (u.n || 0) + 1;
      if (!far || u.n % 4 === 0) {
        u.mixer.update(u.acc);
        u.acc = 0;
      }
    }
    if (u.hop) y = mv ? Math.abs(Math.sin(ph * 0.8)) * 0.18 : 0;
    else if (mv) y = Math.abs(Math.sin(ph)) * 0.02;
    if (swim != null) {
      y = swim + Math.sin(time * 0.0015 + a.id) * 0.025;
      if (a.show > 0 && !a.showDelay) {
        const t = 1 - a.show / 110;
        y += Math.max(0, Math.sin(t * Math.PI * 2)) * 1.1;
        m.rotation.z = Math.cos(t * Math.PI * 2) * 0.7;
      } else m.rotation.z = 0;
    }
    m.position.set(x, y + (swim != null ? (F.emap[a.e] && F.emap[a.e].base) || 0 : heightAt(x, z)), z);
    m.rotation.x = u.waddle && mv ? Math.sin(ph) * 0.12 : 0;
    u.legs.forEach((l, i) => {
      l.rotation.z = mv ? Math.sin(ph + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI : 0)) * 0.45 : 0;
    });
    const bd = u.badge;
    if (a.sick) {
      bd.material = SPR.sick;
      bd.visible = true;
    } else if (a.happy < 40) {
      bd.material = SPR.sad;
      bd.visible = true;
    } else bd.visible = false;
  }
  for (const [id, m] of amesh)
    if (!live.has(id)) {
      animalRoot.remove(m);
      amesh.delete(id);
    }
}

/* guests (instanced) */
const GMAX = 1500,
  dummy = new THREE.Object3D(),
  tmpC = new THREE.Color();
const WHITE = () => [1, 1, 1];
const torsoGeo = sculpt(
  [
    E([0, 0, 0], [0.068, 0.11, 0.055], 't'),
    E([0, 0.07, 0], [0.06, 0.05, 0.085], 't'),
    C([0, 0.1, 0], [0, 0.14, 0], 0.025, 0.022, 't'),
  ],
  0.03,
  26,
  WHITE
);
const headGeo = sculpt(
  [E([0, 0, 0], [0.058, 0.065, 0.055], 'h'), E([0.05, -0.005, 0], [0.016, 0.02, 0.014], 'h')],
  0.02,
  22,
  WHITE
);
const legsGeo = sculpt(
  [
    C([0, 0.07, 0.03], [0, -0.05, 0.03], 0.03, 0.024, 'p'),
    C([0, 0.07, -0.03], [0, -0.05, -0.03], 0.03, 0.024, 'p'),
    E([0.02, -0.065, 0.03], [0.04, 0.018, 0.025], 's'),
    E([0.02, -0.065, -0.03], [0.04, 0.018, 0.025], 's'),
  ],
  0.02,
  24,
  (t) => (t === 's' ? hexA('#2a2420') : hexA(pick(['#33405a', '#3c3a36', '#5a4a3a'])))
);
const armGeo = sculpt(
  [C([0, 0, 0], [0, -0.16, 0], 0.022, 0.018, 'a'), E([0, -0.175, 0], [0.02, 0.022, 0.018], 'a')],
  0.02,
  18,
  WHITE
);
const GMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
const gBody = new THREE.InstancedMesh(torsoGeo, GMAT, GMAX);
const gHead = new THREE.InstancedMesh(headGeo, GMAT, GMAX);
const gLegs = new THREE.InstancedMesh(legsGeo, GMAT, GMAX);
const gArms = new THREE.InstancedMesh(armGeo, GMAT, GMAX * 2);
const hatGeo = new THREE.CylinderGeometry(0.045, 0.075, 0.06, 10);
const gHats = new THREE.InstancedMesh(hatGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), GMAX);
for (const im of [gBody, gHead, gLegs, gArms, gHats]) {
  im.castShadow = true;
  im.frustumCulled = false;
  scene.add(im);
}
for (let i = 0; i < GMAX; i++) {
  gLegs.setColorAt(i, tmpC.set('#fff'));
  gBody.setColorAt(i, tmpC.set('#fff'));
  gHead.setColorAt(i, tmpC.set('#fff'));
  gHats.setColorAt(i, tmpC.set('#fff'));
  gArms.setColorAt(i * 2, tmpC);
  gArms.setColorAt(i * 2 + 1, tmpC);
}
const HATS = ['#f2e9d0', '#2c6fa8', '#e4573d', '#2f6a48', '#f2c94c'];
dummy.rotation.order = 'YXZ';
function guestPos(g, alpha) {
  const p = Math.min(1, g.p + (g.mode === 'rest' ? 0 : alpha * 0.07));
  return {
    x: g.fx + (g.x - g.fx) * p + 0.5 + (hsh(g.id, 1) - 0.5) * 0.44,
    z: g.fy + (g.y - g.fy) * p + 0.5 + (hsh(g.id, 2) - 0.5) * 0.38,
    p,
  };
}
function syncGuests(alpha, time) {
  const n = Math.min(GMAX, S.guests.length);
  let nh = 0;
  for (let i = 0; i < n; i++) {
    const g = S.guests[i],
      q = g.mode === 'ride' ? { x: -500, z: -500 } : guestPos(g, alpha), // out on a safari: off stage
      moving = g.mode !== 'rest' && g.p < 1;
    const bob = moving ? Math.abs(Math.sin(time * 0.014 + g.id)) * 0.03 : 0,
      sit = g.mode === 'rest' ? -0.08 : 0;
    const ry = Math.atan2(g.x - g.fx, g.y - g.fy);
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1, 1, 1);
    const gy = heightAt(q.x, q.z);
    dummy.position.set(q.x, gy + 0.07 + bob, q.z);
    dummy.updateMatrix();
    gLegs.setMatrixAt(i, dummy.matrix);
    dummy.position.set(q.x, gy + 0.26 + bob + sit, q.z);
    dummy.updateMatrix();
    gBody.setMatrixAt(i, dummy.matrix);
    dummy.position.set(q.x, gy + 0.44 + bob + sit, q.z);
    dummy.updateMatrix();
    gHead.setMatrixAt(i, dummy.matrix);
    tmpC.set(g.shirt).convertSRGBToLinear();
    gBody.setColorAt(i, tmpC);
    const sw = moving ? Math.sin(time * 0.012 + g.id) * 0.6 : g.mode === 'rest' ? -1.1 : 0,
      cr = Math.cos(ry),
      sr = Math.sin(ry);
    for (const sd of [1, -1]) {
      dummy.position.set(q.x + sd * 0.095 * cr, gy + 0.36 + bob + sit, q.z - sd * 0.095 * sr);
      dummy.rotation.set(sd * sw, ry, sd * 0.12);
      dummy.updateMatrix();
      gArms.setMatrixAt(i * 2 + (sd > 0 ? 0 : 1), dummy.matrix);
      gArms.setColorAt(i * 2 + (sd > 0 ? 0 : 1), tmpC);
    }
    dummy.rotation.set(0, ry, 0);
    gHead.setColorAt(i, tmpC.set(g.skin).convertSRGBToLinear());
    if (hsh(g.id, 7) < 0.45) {
      dummy.position.set(q.x, gy + 0.51 + bob + sit, q.z);
      dummy.updateMatrix();
      gHats.setMatrixAt(nh, dummy.matrix);
      gHats.setColorAt(nh, tmpC.set(HATS[g.id % HATS.length]).convertSRGBToLinear());
      nh++;
    }
  }
  // staff share the guest meshes, drawn after the guests in uniform
  const SKIN = ['#f1c9a5', '#d9a77e', '#a8754f', '#7a4f33', '#e8b896'];
  let m = n;
  for (const st of S.staff || []) {
    if (m >= GMAX) break;
    if (st.st === 'rest') continue;
    const x = st.ox + (st.x - st.ox) * alpha,
      z = st.oy + (st.y - st.oy) * alpha,
      moving = st.st === 'walk',
      working = st.st === 'work',
      bob = moving ? Math.abs(Math.sin(time * 0.014 + st.id)) * 0.03 : 0,
      ry = st.dir || 0,
      gy = heightAt(x, z),
      R = STAFF_ROLES[st.role];
    dummy.rotation.set(0, ry, 0);
    dummy.scale.set(1.05, 1.05, 1.05);
    dummy.position.set(x, gy + 0.07 + bob, z);
    dummy.updateMatrix();
    gLegs.setMatrixAt(m, dummy.matrix);
    dummy.position.set(x, gy + 0.27 + bob, z);
    dummy.updateMatrix();
    gBody.setMatrixAt(m, dummy.matrix);
    dummy.position.set(x, gy + 0.46 + bob, z);
    dummy.updateMatrix();
    gHead.setMatrixAt(m, dummy.matrix);
    tmpC.set(R.uniform).convertSRGBToLinear();
    gBody.setColorAt(m, tmpC);
    const sw = moving ? Math.sin(time * 0.012 + st.id) * 0.6 : working ? -0.9 + Math.sin(time * 0.02 + st.id) * 0.5 : 0,
      cr = Math.cos(ry),
      sr = Math.sin(ry);
    for (const sd of [1, -1]) {
      dummy.position.set(x + sd * 0.1 * cr, gy + 0.375 + bob, z - sd * 0.1 * sr);
      dummy.rotation.set(working ? sw : sd * sw, ry, sd * 0.12);
      dummy.updateMatrix();
      gArms.setMatrixAt(m * 2 + (sd > 0 ? 0 : 1), dummy.matrix);
      gArms.setColorAt(m * 2 + (sd > 0 ? 0 : 1), tmpC);
    }
    dummy.rotation.set(0, ry, 0);
    gHead.setColorAt(m, tmpC.set(SKIN[st.id % SKIN.length]).convertSRGBToLinear());
    if (R.hat) {
      dummy.position.set(x, gy + 0.535 + bob, z);
      dummy.scale.set(
        st.role === 'keeper' ? 1.5 : 1.1,
        st.role === 'keeper' ? 0.7 : 0.9,
        st.role === 'keeper' ? 1.5 : 1.1
      );
      dummy.updateMatrix();
      gHats.setMatrixAt(nh, dummy.matrix);
      gHats.setColorAt(nh, tmpC.set(R.hat).convertSRGBToLinear());
      nh++;
    }
    m++;
  }
  for (const im of [gBody, gHead, gLegs, gArms, gHats]) {
    im.count = im === gArms ? m * 2 : im === gHats ? nh : m;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }
}
