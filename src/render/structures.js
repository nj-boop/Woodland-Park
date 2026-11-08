/* 3D models for items and buildings, fences (all styles, gates, moats), glass tanks and tunnels, entrance gate, park edge, and the static scene rebuild. */
/* scenery */
function treeKindFor(t, x, y) {
  const r = hsh(x, y);
  if (t.e) {
    const b = F.emap[t.e].biome;
    if (b === 'ice') return 'fir';
    if (b === 'desert') return 'cactus';
    if (b === 'jungle') return r < 0.4 ? 'palm' : r < 0.6 ? 'bamboo' : 'leafy';
    if (b === 'savanna') return r < 0.6 ? 'acacia' : r < 0.7 ? 'baobab' : 'leafy';
    return 'leafy';
  }
  return hsh(x + 3, y) < 0.35 ? 'pine' : 'leafy';
}
function faceDir(x, y) {
  for (const [dx, dy] of [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ])
    if (inB(x + dx, y + dy) && tileAt(x + dx, y + dy).t === 'p') return Math.atan2(dx, dy);
  return 0;
}
// one shared material for every lamp, so they can all glow brighter at night
const LAMP_MAT = new THREE.MeshStandardMaterial({
  color: LIN('#fff6d0'),
  emissive: LIN('#ffe9a0'),
  emissiveIntensity: 0.6,
});
function makeItem(par, o, x, y) {
  const t = tileAt(x, y),
    g = new THREE.Group();
  par.add(g);
  if (ITEMS[o] && ITEMS[o].size) {
    // multi-tile building: centred on its footprint, turned to face its door side
    const p = planOf(idx(x, y)),
      cx = p.x0 + p.fw / 2,
      cz = p.y0 + p.fh / 2;
    let hy = 0;
    for (const k of fpTiles(p.x0, p.y0, p.fw, p.fh)) hy += heightAt((k % W) + 0.5, ((k / W) | 0) + 0.5);
    g.position.set(cx, hy / (p.fw * p.fh), cz);
    g.rotation.y = (p.r * Math.PI) / 2;
    const [w, d] = sizeOf(o);
    makeBuilding(g, o, w, d);
    return;
  }
  g.position.set(x + 0.5, heightAt(x + 0.5, y + 0.5), y + 0.5);
  const form = ITEMS[o] && ITEMS[o].form;
  if (form === 'tree') {
    makeTree(g, o === 'tree' ? treeKindFor(t, x, y) : o, 0.9 + hsh(x, y) * 0.3);
    return;
  }
  if (o === 'fern' || o === 'tallgrass') {
    makeGroundPlant(g, o);
    return;
  }
  if (form === 'rock' && o !== 'rock') {
    makeRock(g, o, x, y);
    return;
  }
  if (o === 'bush') {
    g.add(leafMesh(BUSH, LEAFMATS[hsh(x, y) < 0.5 ? 0 : 2], LEAF_DEPTH, 0, 0.2, 0, 1));
    for (let k = 0; k < 6; k++)
      P(
        g,
        'sph',
        pick(['#e07a9b', '#f2e26b', '#ffffff']),
        rnd(-0.2, 0.2),
        rnd(0.18, 0.36),
        rnd(-0.2, 0.2),
        0.025,
        0.025,
        0.025,
        false
      );
    return;
  }
  if (o === 'pond') {
    const blobs = [
      [0, 0, 0.34, 0.3],
      [0.16, 0.1, 0.24, 0.2],
      [-0.15, -0.07, 0.22, 0.24],
      [0.05, -0.17, 0.2, 0.17],
    ];
    for (const [ox, oz, a, b] of blobs)
      P(g, 'disc', '#5a452c', ox, 0.012, oz, a + 0.08, 0.02, b + 0.08, false).receiveShadow = true;
    for (const [ox, oz, a, b] of blobs) {
      const w = P(g, 'disc', waterMat, ox, 0.03, oz, a, 0.02, b, false);
      w.receiveShadow = true;
    }
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6 + hsh(x, y) * 3;
      P(g, 'cone', '#4f7a30', Math.cos(a) * 0.4, 0.1, Math.sin(a) * 0.36, 0.022, 0.2, 0.022, false);
    }
    return;
  }
  if (o === 'rock') {
    const m = new THREE.Mesh(ROCKS[Math.floor(hsh(x, y) * 4)], ROCKMAT);
    m.scale.set(0.42, 0.34, 0.38);
    m.position.y = 0.06;
    m.rotation.y = hsh(y, x) * 6.28;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const m2 = new THREE.Mesh(ROCKS[(Math.floor(hsh(x, y) * 4) + 1) % 4], ROCKMAT);
    m2.scale.set(0.18, 0.15, 0.17);
    m2.position.set(0.3, 0.03, 0.2);
    m2.castShadow = true;
    g.add(m2);
    return;
  }
  g.rotation.y = faceDir(x, y);
  if (o === 'food') {
    P(g, 'box', '#b5492f', 0, 0.25, 0, 0.72, 0.5, 0.5);
    P(g, 'box', '#f4ebd4', 0, 0.46, 0.27, 0.74, 0.05, 0.12);
    P(g, 'box', '#3a2a1e', 0, 0.33, 0.252, 0.5, 0.16, 0.01, false);
    for (const sx of [-0.34, 0.34]) P(g, 'cyl', '#ddd', sx, 0.6, 0.3, 0.018, 0.3);
    for (let k = 0; k < 6; k++) {
      const s = P(g, 'box', k % 2 ? '#f4ebd4' : '#d84a33', -0.35 + k * 0.14, 0.76, 0.06, 0.14, 0.04, 0.7);
      s.rotation.x = 0.18;
    }
    P(g, 'box', '#e6aa3e', 0, 0.92, -0.16, 0.5, 0.16, 0.04);
    return;
  }
  if (o === 'drink') {
    P(g, 'box', '#2c6fa8', 0, 0.27, 0, 0.52, 0.32, 0.36);
    P(g, 'box', '#f4ebd4', 0, 0.45, 0, 0.54, 0.04, 0.38);
    for (const sx of [-0.18, 0.18]) {
      const w = P(g, 'cyl', '#222', sx, 0.1, 0.19, 0.09, 0.04);
      w.rotation.x = Math.PI / 2;
    }
    P(g, 'cyl', '#ddd', 0, 0.65, 0, 0.015, 0.45);
    P(g, 'cone', '#f2c94c', 0, 0.93, 0, 0.46, 0.16);
    P(g, 'sph', '#e4573d', 0, 1.02, 0, 0.035);
    return;
  }
  if (o === 'bench') {
    P(g, 'box', '#9a6a3c', 0, 0.22, 0, 0.74, 0.05, 0.22);
    P(g, 'box', '#9a6a3c', 0, 0.36, -0.1, 0.74, 0.14, 0.04);
    for (const sx of [-0.3, 0.3]) {
      P(g, 'box', '#4a3220', sx, 0.11, 0, 0.05, 0.22, 0.2);
      P(g, 'box', '#4a3220', sx, 0.3, -0.1, 0.05, 0.18, 0.04);
    }
    return;
  }
  if (o === 'ball') {
    P(g, 'sph', '#d8382a', 0, 0.11, 0, 0.11);
    P(g, 'box', '#f2e9d0', 0, 0.11, 0, 0.225, 0.03, 0.03, false);
    return;
  }
  if (o === 'post') {
    P(g, 'cyl', '#7a5230', 0, 0.3, 0, 0.06, 0.6);
    P(g, 'cyl', '#5b3c22', 0, 0.02, 0, 0.12, 0.04);
    return;
  }
  if (o === 'climber') {
    for (const [x2, z2] of [
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3],
    ])
      P(g, 'cyl', '#7a5230', x2, 0.45, z2, 0.035, 0.9);
    for (const h of [0.35, 0.6, 0.85]) {
      P(g, 'box', '#8a6440', 0, h, -0.3, 0.62, 0.03, 0.03);
      P(g, 'box', '#8a6440', 0, h, 0.3, 0.62, 0.03, 0.03);
    }
    for (const z2 of [-0.15, 0, 0.15]) P(g, 'cyl', '#c9b27a', 0, 0.6, z2, 0.012, 0.5).rotation.x = Math.PI / 2;
    P(g, 'box', '#9a7a50', 0, 0.9, 0, 0.66, 0.04, 0.66);
    return;
  }
  if (o === 'log') {
    for (const [y2, z2, r] of [
      [0.07, -0.08, 0.07],
      [0.07, 0.08, 0.07],
      [0.19, 0, 0.065],
    ]) {
      const l = P(g, 'cyl', '#6b4a2e', 0, y2, z2, r, 0.7);
      l.rotation.z = Math.PI / 2;
    }
    return;
  }
  if (o === 'ice') {
    const b = P(
      g,
      'box',
      new THREE.MeshStandardMaterial({ color: LIN('#d8f0fa'), transparent: true, opacity: 0.8, roughness: 0.1 }),
      0,
      0.14,
      0,
      0.35,
      0.28,
      0.3
    );
    b.rotation.y = 0.4;
    return;
  }
  if (o === 'floater') {
    P(g, 'disc', '#f2c94c', 0, 0.45, 0, 0.18, 0.06, 0.18);
    P(g, 'disc', '#e4573d', 0, 0.47, 0, 0.1, 0.04, 0.1);
    return;
  }
  if (o === 'shade') {
    for (const [x2, z2] of [
      [-0.35, -0.35],
      [0.35, -0.35],
      [-0.35, 0.35],
      [0.35, 0.35],
    ])
      P(g, 'cyl', '#7a5230', x2, 0.35, z2, 0.03, 0.7);
    const r = P(g, 'box', '#c8a86a', 0, 0.74, 0, 0.9, 0.04, 0.9);
    r.rotation.x = 0.12;
    return;
  }
  if (o === 'cave') {
    const m = new THREE.Mesh(ROCKS[(x + y) % 4], ROCKMAT);
    m.scale.set(0.5, 0.45, 0.48);
    m.position.y = 0.1;
    m.castShadow = true;
    g.add(m);
    P(g, 'sph', '#1a1714', 0.2, 0.12, 0.2, 0.16, 0.14, 0.12, false);
    return;
  }
  if (o === 'stable') {
    P(g, 'box', '#8a6440', 0, 0.25, 0, 0.8, 0.5, 0.6);
    const r1 = P(g, 'box', '#6b3d22', 0, 0.56, -0.16, 0.86, 0.04, 0.38);
    r1.rotation.x = 0.5;
    const r2 = P(g, 'box', '#6b3d22', 0, 0.56, 0.16, 0.86, 0.04, 0.38);
    r2.rotation.x = -0.5;
    P(g, 'box', '#2a1d14', 0, 0.18, 0.305, 0.32, 0.36, 0.02);
    return;
  }
  if (o === 'nighthouse') {
    // a small red barn with white trim and a half-open door
    P(g, 'box', '#9c3b2e', 0, 0.32, 0, 0.86, 0.64, 0.72);
    for (const s of [-1, 1]) {
      const r = P(g, 'box', '#4a4440', 0, 0.74, s * 0.2, 0.94, 0.05, 0.48);
      r.rotation.x = s * 0.62;
    }
    P(g, 'box', '#9c3b2e', 0, 0.66, 0, 0.84, 0.22, 0.36, false);
    P(g, 'box', '#f1ece2', 0, 0.22, 0.362, 0.36, 0.44, 0.02, false);
    P(g, 'box', '#2a1d14', 0.06, 0.2, 0.37, 0.22, 0.38, 0.02, false);
    P(g, 'box', '#f1ece2', 0, 0.55, 0.362, 0.86, 0.04, 0.02, false);
    P(g, 'box', '#d8c48a', 0.3, 0.06, 0.42, 0.2, 0.12, 0.14);
    return;
  }
  if (o === 'lamp') {
    P(g, 'cyl', '#2a2a2a', 0, 0.45, 0, 0.025, 0.9);
    P(g, 'sph', LAMP_MAT, 0, 0.92, 0, 0.07);
    return;
  }
  if (o === 'flowers') {
    P(g, 'box', '#6b4a2e', 0, 0.04, 0, 0.7, 0.08, 0.7);
    for (let k = 0; k < 14; k++)
      P(
        g,
        'sph',
        pick(['#e07a9b', '#f2e26b', '#ffffff', '#b48ae0', '#f59a5b']),
        rnd(-0.3, 0.3),
        0.1,
        rnd(-0.3, 0.3),
        0.04,
        0.04,
        0.04,
        false
      );
    return;
  }
  if (o === 'statue') {
    P(g, 'box', '#b5b0a5', 0, 0.15, 0, 0.36, 0.3, 0.36);
    P(g, 'sph', '#9a958b', 0, 0.45, 0, 0.16, 0.12, 0.1);
    P(g, 'sph', '#9a958b', 0.12, 0.55, 0, 0.07);
    P(g, 'cyl', '#9a958b', 0.18, 0.38, 0, 0.02, 0.2);
    return;
  }
  if (o === 'canopy') {
    for (const x2 of [-0.4, 0.4]) P(g, 'cyl', '#7a5230', x2, 0.45, -0.2, 0.03, 0.9);
    const r = P(g, 'box', '#2f6a48', 0, 0.92, 0, 0.95, 0.04, 0.6);
    r.rotation.x = -0.15;
    return;
  }
  if (o === 'atm') {
    P(g, 'box', '#4a5a66', 0, 0.3, 0, 0.3, 0.6, 0.22);
    P(g, 'box', '#7fe0a0', 0, 0.44, 0.115, 0.18, 0.1, 0.01);
    P(g, 'box', '#222', 0, 0.3, 0.115, 0.16, 0.03, 0.01);
    return;
  }
  if (o === 'map') {
    P(g, 'cyl', '#5b3c22', -0.2, 0.3, 0, 0.025, 0.6);
    P(g, 'cyl', '#5b3c22', 0.2, 0.3, 0, 0.025, 0.6);
    P(g, 'box', '#e8d8a8', 0, 0.5, 0.02, 0.5, 0.34, 0.03);
    P(g, 'box', '#5a9a50', 0, 0.5, 0.04, 0.4, 0.24, 0.01);
    return;
  }
  if (o === 'donation') {
    P(g, 'cyl', '#5b3c22', 0, 0.2, 0, 0.03, 0.4);
    P(g, 'box', '#7fb7cf', 0, 0.48, 0, 0.22, 0.18, 0.22);
    P(g, 'box', '#f2c94c', 0, 0.6, 0, 0.24, 0.04, 0.24);
    return;
  }
  if (o === 'picnic') {
    P(g, 'box', '#9a6a3c', 0, 0.3, 0, 0.7, 0.04, 0.3);
    for (const z2 of [-0.25, 0.25]) P(g, 'box', '#9a6a3c', 0, 0.18, z2, 0.7, 0.03, 0.1);
    for (const x2 of [-0.28, 0.28]) P(g, 'box', '#4a3220', x2, 0.15, 0, 0.04, 0.3, 0.5);
    return;
  }
  if (o === 'bin') {
    P(g, 'cyl', '#2f6a48', 0, 0.16, 0, 0.12, 0.32);
    P(g, 'cyl', '#3f8a5d', 0, 0.33, 0, 0.135, 0.04);
    P(g, 'cyl', '#173826', 0, 0.36, 0, 0.05, 0.03);
    return;
  }
}
const fenceTex = {};
function fTex(kind) {
  if (fenceTex[kind]) return fenceTex[kind];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  if (kind === 'iron') {
    x.fillStyle = '#262626';
    x.fillRect(0, 2, 64, 4);
    x.fillRect(0, 54, 64, 4);
    for (let i = 0; i < 4; i++) {
      x.fillRect(i * 16 + 6, 0, 4, 64);
      x.beginPath();
      x.moveTo(i * 16 + 4, 4);
      x.lineTo(i * 16 + 8, -3);
      x.lineTo(i * 16 + 12, 4);
      x.fill();
    }
  } else if (kind === 'chain') {
    x.strokeStyle = '#a9b2b7';
    x.lineWidth = 1.6;
    for (let i = -64; i < 128; i += 8) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 64, 64);
      x.stroke();
      x.beginPath();
      x.moveTo(i + 64, 0);
      x.lineTo(i, 64);
      x.stroke();
    }
    x.fillStyle = '#7d868b';
    x.fillRect(0, 0, 64, 4);
    x.fillRect(0, 60, 64, 4);
  } else if (kind === 'stone') {
    x.fillStyle = '#6f6a62';
    x.fillRect(0, 0, 64, 64);
    for (let j = 0; j < 6; j++)
      for (let i = -1; i < 5; i++) {
        x.fillStyle = pick(['#9a958b', '#8b867c', '#a7a297', '#837e74']);
        x.fillRect(i * 16 + (j % 2) * 8 + 1, j * 11 + 1, 14, 9);
      }
    x.fillStyle = '#b5b0a5';
    x.fillRect(0, 0, 64, 5);
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 4;
  fenceTex[kind] = t;
  return t;
}
function fencePanel(par, kind, cx, cz, len, rot, h) {
  const base = fTex(kind),
    t = base.clone();
  t.needsUpdate = true;
  t.repeat.set(Math.max(1, Math.round(len * 2)), 1);
  const solid = kind === 'stone';
  const mat = new THREE.MeshLambertMaterial({
    map: t,
    transparent: !solid,
    alphaTest: solid ? 0 : 0.5,
    side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(solid ? new THREE.BoxGeometry(len, h, 0.16) : new THREE.PlaneGeometry(len, h), mat);
  if (solid) {
    const mats = [M('#7e796f'), M('#7e796f'), M('#b5b0a5'), M('#7e796f'), mat, mat];
    m.material = mats;
  }
  m.position.set(cx, h / 2, cz);
  m.rotation.y = rot;
  m.castShadow = solid;
  m.receiveShadow = true;
  par.add(m);
}
const GLASSMAT = new THREE.MeshStandardMaterial({
  color: LIN('#cfeef6'),
  transparent: true,
  opacity: 0.22,
  roughness: 0.05,
  metalness: 0.1,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const TANKWATER = new THREE.MeshPhongMaterial({
  color: LIN('#3e9fc2'),
  specular: LIN('#ffffff'),
  shininess: 140,
  bumpMap: ripT,
  bumpScale: 0.03,
  transparent: true,
  opacity: 0.42,
  depthWrite: false,
});
const TANKSIDE = new THREE.MeshPhongMaterial({
  color: LIN('#2f8fb5'),
  transparent: true,
  opacity: 0.28,
  depthWrite: false,
  side: THREE.DoubleSide,
});
const TUNNELGEO = new THREE.CylinderGeometry(0.46, 0.46, 1, 18, 1, true, 0, Math.PI);
const edgeEnds = (x, y, dr) =>
  dr === 0
    ? [
        [x, y],
        [x + 1, y],
      ]
    : dr === 1
      ? [
          [x, y + 1],
          [x + 1, y + 1],
        ]
      : dr === 2
        ? [
            [x, y],
            [x, y + 1],
          ]
        : [
            [x + 1, y],
            [x + 1, y + 1],
          ];
function makeTank(par, e) {
  const h = TANK_H,
    g0 = new THREE.Group();
  g0.position.y = e.base || 0;
  par.add(g0);
  par = g0;
  const isT = (x, y) => inB(x, y) && tileAt(x, y).t === 'p' && tileAt(x, y).e === e.id;
  // water surface over every tile
  {
    const pos = [],
      idx2 = [];
    for (const ti of encTiles(e)) {
      const x = ti % W,
        y = (ti / W) | 0,
        b = pos.length / 3;
      pos.push(x, h - 0.06, y, x + 1, h - 0.06, y, x + 1, h - 0.06, y + 1, x, h - 0.06, y + 1);
      idx2.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    gg.setIndex(idx2);
    gg.computeVertexNormals();
    const uv = [];
    for (let k = 0; k < pos.length / 3; k++) uv.push(pos[k * 3] * 0.5, pos[k * 3 + 2] * 0.5);
    gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const top = new THREE.Mesh(gg, TANKWATER);
    top.renderOrder = 6;
    par.add(top);
  }
  const posts = new Set();
  for (const [x, y, dr] of F.eedges[e.id] || []) {
    const [[ax, az], [bx, bz]] = edgeEnds(x, y, dr),
      cx = (ax + bx) / 2,
      cz = (az + bz) / 2,
      rot = dr < 2 ? 0 : Math.PI / 2;
    const sd = new THREE.Mesh(new THREE.PlaneGeometry(1, h - 0.08), TANKSIDE);
    sd.position.set(cx, (h - 0.08) / 2, cz);
    sd.rotation.y = rot;
    sd.renderOrder = 5;
    par.add(sd);
    if (!isT(x, y)) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, h), GLASSMAT);
      m.position.set(cx, h / 2, cz);
      m.rotation.y = rot;
      m.renderOrder = 7;
      par.add(m);
    }
    P(par, 'box', '#d8d4cc', cx, h + 0.03, cz, rot ? 0.1 : 1.06, 0.06, rot ? 1.06 : 0.1);
    for (const [px, pz] of [
      [ax, az],
      [bx, bz],
    ]) {
      const k = px + ',' + pz;
      if (!posts.has(k)) {
        posts.add(k);
        P(par, 'box', '#bdb8ae', px, h / 2, pz, 0.07, h, 0.07);
      }
    }
  }
  for (const ti of encTiles(e)) {
    const x = ti % W,
      y = (ti / W) | 0;
    if (!isT(x, y)) continue;
    const alongX = isT(x - 1, y) || isT(x + 1, y) || !inEnc(e, x - 1, y) || !inEnc(e, x + 1, y);
    const m = new THREE.Mesh(TUNNELGEO, GLASSMAT);
    m.rotation.order = 'YXZ';
    m.rotation.set(0, alongX ? 0 : Math.PI / 2, Math.PI / 2);
    m.position.set(x + 0.5, 0, y + 0.5);
    m.renderOrder = 8;
    par.add(m);
    for (const off of [-0.5, 0.5]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.025, 6, 18, Math.PI), M('#9aa3a8'));
      ring.position.set(x + 0.5 + (alongX ? off : 0), 0, y + 0.5 + (alongX ? 0 : off));
      ring.rotation.y = alongX ? Math.PI / 2 : 0;
      par.add(ring);
    }
  }
  if (e.barrier)
    for (const [cx, cz, rot] of barrierSegs(e)) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, h), GLASSMAT);
      m.position.set(cx, h / 2, cz);
      m.rotation.y = rot;
      m.renderOrder = 7;
      par.add(m);
    }
}
function barrierSegs(e) {
  const mm = encMid(e),
    out = [];
  if (mm.ax === 'x') {
    for (let y = e.y; y < e.y + e.h; y++)
      if (inEnc(e, mm.m - 1, y) && inEnc(e, mm.m, y)) out.push([mm.m, y + 0.5, Math.PI / 2]);
  } else {
    for (let x = e.x; x < e.x + e.w; x++) if (inEnc(e, x, mm.m - 1) && inEnc(e, x, mm.m)) out.push([x + 0.5, mm.m, 0]);
  }
  return out;
}
function makeFence(par, e) {
  if (e.biome === 'pool') return makeTank(par, e);
  const wood = '#7a5230',
    post = '#5b3c22',
    kind = e.fence || 'wood';
  const edges = F.eedges[e.id] || [],
    corner = {};
  for (const [x, y, dr] of edges)
    for (const [px, pz] of edgeEnds(x, y, dr)) {
      const k = px + ',' + pz;
      corner[k] = corner[k] || { h: 0, v: 0, x: px, z: pz };
      corner[k][dr < 2 ? 'h' : 'v']++;
    }
  const gates = new Set((e.gates || []).map(([gi, gd]) => gi + ':' + gd));
  const hAt = (x, z) => heightAt(x, z);
  for (const [x, y, dr] of edges) {
    const [[ax, az], [bx, bz]] = edgeEnds(x, y, dr),
      cx = (ax + bx) / 2,
      cz = (az + bz) / 2,
      rot = dr < 2 ? 0 : Math.PI / 2,
      yb = (hC(ax, az) + hC(bx, bz)) / 2;
    const seg = new THREE.Group();
    seg.position.y = yb;
    par.add(seg);
    // a safari track crossing the fence: a heavy vehicle gate over a cattle grid
    const ox = x + [0, 0, -1, 1][dr],
      oy = y + [-1, 1, 0, 0][dr];
    if (isTrack(idx(x, y)) && inB(ox, oy) && isTrack(idx(ox, oy))) {
      for (const [px, pz] of [
        [ax, az],
        [bx, bz],
      ]) {
        P(seg, 'box', '#4a4f54', px, 0.55, pz, 0.14, 1.1, 0.14);
        P(seg, 'box', '#c9a227', px, 1.12, pz, 0.18, 0.06, 0.18);
      }
      // the gate stands open; its two leaves fold back along the fence line
      for (const sd of [-1, 1]) {
        const lx = rot ? cx : cx + sd * 0.45,
          lz = rot ? cz + sd * 0.45 : cz;
        P(seg, 'box', '#6b7177', lx, 0.45, lz, rot ? 0.05 : 0.08, 0.7, rot ? 0.08 : 0.05);
      }
      for (let k = -2; k <= 2; k++)
        P(
          seg,
          'box',
          '#2d2f31',
          rot ? cx + k * 0.08 : cx,
          0.02,
          rot ? cz : cz + k * 0.08,
          rot ? 0.03 : 0.9,
          0.02,
          rot ? 0.9 : 0.03,
          false
        );
      continue;
    }
    if (gates.has(idx(x, y) + ':' + dr)) {
      for (const [px, pz] of [
        [ax, az],
        [bx, bz],
      ])
        P(seg, 'box', '#5b3c22', px, 0.35, pz, 0.1, 0.7, 0.1);
      const gp = P(seg, 'box', '#8a6440', cx, 0.3, cz, rot ? 0.04 : 0.82, 0.5, rot ? 0.82 : 0.04);
      P(seg, 'box', '#5b3c22', cx, 0.58, cz, rot ? 0.05 : 0.86, 0.05, rot ? 0.86 : 0.05);
      continue;
    }
    if (kind === 'moat') {
      P(seg, 'box', '#9a958b', cx, 0.1, cz, rot ? 0.12 : 1.02, 0.2, rot ? 1.02 : 0.12);
      P(seg, 'box', '#b5b0a5', cx, 0.21, cz, rot ? 0.16 : 1.04, 0.03, rot ? 1.04 : 0.16);
      continue;
    }
    if (kind === 'wood') {
      for (const hh of [0.18, 0.38]) P(seg, 'box', wood, cx, hh, cz, rot ? 0.035 : 1, 0.04, rot ? 1 : 0.035);
      continue;
    }
    const hh = kind === 'stone' ? 0.55 : kind === 'iron' ? 0.62 : 0.58;
    fencePanel(seg, kind, cx, cz, 1, rot, hh);
  }
  for (const k in corner) {
    const c = corner[k],
      turn = c.h && c.v,
      yb = hC(c.x, c.z);
    const g = new THREE.Group();
    g.position.y = yb;
    par.add(g);
    if (kind === 'wood') P(g, 'cyl', post, c.x, 0.24, c.z, 0.04, 0.48);
    else if (kind === 'chain') P(g, 'cyl', '#7d868b', c.x, 0.32, c.z, 0.035, 0.64);
    else if (kind === 'moat') {
    } else if (turn || (c.x + c.z) % 3 === 0) {
      const hh = kind === 'stone' ? 0.55 : 0.62;
      P(g, 'box', '#8e8a82', c.x, (hh + 0.12) / 2, c.z, 0.2, hh + 0.12, 0.2);
      P(g, 'box', '#b5b0a5', c.x, hh + 0.14, c.z, 0.25, 0.05, 0.25);
    }
  }
  if (e.barrier)
    for (const [cx, cz, rot] of barrierSegs(e)) {
      const g = new THREE.Group();
      g.position.y = hAt(cx, cz);
      par.add(g);
      fencePanel(g, 'iron', cx, cz, 1, rot, 0.6);
      P(g, 'box', '#8e8a82', cx, 0.35, cz, 0.14, 0.7, 0.14);
    }
}
let signTex = null;
function makeSign() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#6b4527';
  x.fillRect(0, 0, 512, 128);
  x.strokeStyle = '#e6aa3e';
  x.lineWidth = 8;
  x.strokeRect(8, 8, 496, 112);
  x.fillStyle = '#e6aa3e';
  x.font = '64px ' + getComputedStyle(document.body).getPropertyValue('--font-display');
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('Wildgrove Zoo', 256, 68);
  signTex = new THREE.CanvasTexture(c);
  signTex.encoding = THREE.sRGBEncoding;
}
const staticRoot = new THREE.Group();
scene.add(staticRoot);
const worldEdge = new THREE.Group();
scene.add(worldEdge);
function buildEdge() {
  const hedge = '#3f6f34';
  P(worldEdge, 'box', hedge, W / 2, 0.2, -0.15, W + 0.6, 0.4, 0.3);
  P(worldEdge, 'box', hedge, -0.15, 0.2, H / 2, 0.3, 0.4, H);
  P(worldEdge, 'box', hedge, W + 0.15, 0.2, H / 2, 0.3, 0.4, H);
  // the highway along the south edge: vehicles join it from road tiles on the bottom row
  const hw = P(worldEdge, 'box', '#3b3d40', W / 2, 0.01, H + 1.6, W + 80, 0.02, 2.4, false);
  hw.receiveShadow = true;
  for (let x = -38; x < W + 38; x += 2) P(worldEdge, 'box', '#d9b43a', x, 0.025, H + 1.6, 0.9, 0.005, 0.08, false);
  P(worldEdge, 'box', '#b9b7ae', W / 2, 0.03, H + 0.2, W + 80, 0.04, 0.4, false); // kerb and verge
  const trees = Math.round((300 * (W + H)) / 62);
  for (let k = 0; k < trees; k++) {
    let x, z;
    do {
      x = rnd(-26, W + 26);
      z = rnd(-26, H + 26);
    } while (
      (x > -1.2 && x < W + 1.2 && z > -1.2 && z < H + 1.2) ||
      (z > H - 0.5 && z < H + 3.5) ||
      Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 2
    );
    const t = makeTree(worldEdge, Math.random() < 0.45 ? 'pine' : 'leafy', rnd(1.1, 2.1));
    t.position.set(x, hillH(x, z) - 0.05, z);
  }
}
/* The static scene is split into chunks of CHUNK × CHUNK tiles plus one group per habitat fence.
   After a change, each chunk and fence is fingerprinted and only the ones whose fingerprint changed
   are rebuilt, so placing one bench no longer rebuilds every tree in the zoo. */
const CHUNK = 16;
const chunkRoots = new Map(), // chunk key -> { grp, sig }
  fenceRoots = new Map(); // habitat id -> { grp, sig }
const gateRoot = new THREE.Group();
staticRoot.add(gateRoot);
// FNV-1a style hash over numbers
function hashMix(h, v) {
  h ^= v & 0xffff;
  h = Math.imul(h, 16777619);
  h ^= v >>> 16;
  return Math.imul(h, 16777619);
}
const strCode = (str) => {
  let h = 7;
  for (let k = 0; k < str.length; k++) h = (Math.imul(h, 31) + str.charCodeAt(k)) | 0;
  return h;
};
const BIOME_CODE = {};
function chunkSig(cx, cy) {
  let h = 2166136261;
  for (let y = cy * CHUNK; y < Math.min(H, (cy + 1) * CHUNK); y++)
    for (let x = cx * CHUNK; x < Math.min(W, (cx + 1) * CHUNK); x++) {
      const t = S.tiles[idx(x, y)];
      h = hashMix(h, t.o ? strCode(t.o) : 0);
      h = hashMix(h, (t.a ?? -1) + 1);
      h = hashMix(h, t.r || 0);
      // trees pick their kind from the habitat's biome
      const b = t.e && F.emap[t.e] ? F.emap[t.e].biome : '';
      h = hashMix(h, b ? (BIOME_CODE[b] ??= strCode(b)) : 0);
      h = hashMix(h, (t.w ? 2 : 0) + (t.t === 'p' ? 1 : 0));
      h = hashMix(h, Math.round(hC(x, y) * 100) + 1000);
    }
  return h;
}
function fenceSig(e) {
  let h = 2166136261;
  h = hashMix(
    h,
    strCode(e.biome + '|' + (e.fence || '') + '|' + (e.barrier ? 1 : 0) + '|' + JSON.stringify(e.gates || []))
  );
  for (const i of F.etiles[e.id] || []) {
    h = hashMix(h, i);
    h = hashMix(h, Math.round(hC(i % W, (i / W) | 0) * 100) + 1000);
    h = hashMix(h, S.tiles[i].t === 'p' ? (S.tiles[i].pm === 'track' ? 2 : 1) : 0);
  }
  // track just outside the fence decides where vehicle gates go
  for (const [x, y, dr] of F.eedges[e.id] || []) {
    const ox = x + [0, 0, -1, 1][dr],
      oy = y + [-1, 1, 0, 0][dr];
    if (inB(ox, oy) && isTrack(idx(ox, oy))) h = hashMix(h, idx(ox, oy) + 7);
  }
  return h;
}
function buildChunk(grp, cx, cy) {
  seeded(() => {
    for (let y = cy * CHUNK; y < Math.min(H, (cy + 1) * CHUNK); y++)
      for (let x = cx * CHUNK; x < Math.min(W, (cx + 1) * CHUNK); x++) {
        const o = tileAt(x, y).o;
        if (o && isAnchor(idx(x, y))) {
          seedRand(idx(x, y) * 7 + 3);
          makeItem(grp, o, x, y);
        }
      }
  });
}
let staticStats = { chunks: 0, fences: 0 };
// everything sized to the map: ground mesh, hills, outer forest; all chunks rebuilt
function onMapResized() {
  resetTraffic();
  LAKE.x = W + 10;
  lakeGroup.position.set(LAKE.x, 0, LAKE.z);
  makeGroundMeshes();
  buildHills();
  const ms = Math.max(1, (Math.max(W, H) + 300) / 336);
  mountains.position.set(W / 2, 0, H / 2);
  mountains.scale.set(ms, 1, ms);
  for (const o of worldEdge.children) o.clear();
  worldEdge.clear();
  buildEdge();
  batchEdge();
  for (const c of chunkRoots.values()) staticRoot.remove(c.grp);
  chunkRoots.clear();
  for (const f of fenceRoots.values()) staticRoot.remove(f.grp);
  fenceRoots.clear();
  gateRoot.clear();
  seeded(buildTufts);
  staticDirty = groundDirty = true;
  mapResized = false;
}
function rebuildStatic() {
  applyHeights();
  buildWater();
  staticStats = { chunks: 0, fences: 0 };
  // scenery and buildings, chunk by chunk
  const live = new Set();
  for (let cy = 0; cy * CHUNK < H; cy++)
    for (let cx = 0; cx * CHUNK < W; cx++) {
      const key = cx + ',' + cy,
        sig = chunkSig(cx, cy);
      live.add(key);
      let c = chunkRoots.get(key);
      if (c && c.sig === sig) continue;
      if (!c) {
        c = { grp: new THREE.Group() };
        chunkRoots.set(key, c);
        staticRoot.add(c.grp);
      }
      c.grp.clear();
      buildChunk(c.grp, cx, cy);
      batchGroup(c.grp);
      buildChunkTufts(c.grp, cx, cy);
      c.box = new THREE.Box3(
        new THREE.Vector3(cx * CHUNK - 2, -3, cy * CHUNK - 2),
        new THREE.Vector3((cx + 1) * CHUNK + 2, 9, (cy + 1) * CHUNK + 2)
      );
      c.cx = (cx + 0.5) * CHUNK;
      c.cz = (cy + 0.5) * CHUNK;
      c.far = undefined;
      c.sig = sig;
      staticStats.chunks++;
    }
  for (const [key, c] of chunkRoots)
    if (!live.has(key)) {
      staticRoot.remove(c.grp);
      chunkRoots.delete(key);
    }
  // fences and tanks, one group per habitat
  const alive = new Set();
  for (const e of S.encl) {
    alive.add(e.id);
    const sig = fenceSig(e);
    let f = fenceRoots.get(e.id);
    if (f && f.sig === sig) continue;
    if (!f) {
      f = { grp: new THREE.Group() };
      fenceRoots.set(e.id, f);
      staticRoot.add(f.grp);
    }
    f.grp.clear();
    seeded(() => {
      seedRand(e.id * 7919);
      makeFence(f.grp, e);
    });
    batchGroup(f.grp);
    f.sig = sig;
    staticStats.fences++;
  }
  for (const [id, f] of fenceRoots)
    if (!alive.has(id)) {
      staticRoot.remove(f.grp);
      fenceRoots.delete(id);
    }
  if (!gateRoot.children.length || !signTex) buildGate();
  staticDirty = false;
}
function buildGate() {} // the gate is drawn as the 'entrance' building
