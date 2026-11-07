/* Surroundings: rolling hills, outer lake, mountains, clouds, birds, grass and flower instancing. */
/* rolling hills, lake, mountains */
const LAKE = { x: 46, z: 7, r: 5.5 }; // moved beside the map by onMapResized()
const sm = (t) => t * t * (3 - 2 * t);
function hillH(x, z) {
  const dx = Math.max(0, -x - 1, x - (W + 1)),
    dz = Math.max(0, -z - 1, z - (H + 1)),
    d = Math.hypot(dx, dz);
  let m = sm(clamp((d - 3) / 16, 0, 1));
  m *= sm(clamp((Math.hypot(x - LAKE.x, z - LAKE.z) - LAKE.r - 2.5) / 7, 0, 1));
  if (z > H - 1) m *= sm(clamp((Math.abs(x - GATE.x - 0.5) - 5) / 7, 0, 1));
  const n =
    Math.sin(x * 0.11) * Math.cos(z * 0.09) * 3 +
    Math.sin(x * 0.05 + z * 0.07) * 5 +
    Math.sin(x * 0.23 + 1) * Math.sin(z * 0.19) * 1.2;
  return m * (n + 9.4) * (0.45 + 0.55 * clamp(d / 45, 0, 1));
}
// the distant mountain ring, centred on the map and pushed out as it grows (see onMapResized)
const mountains = new THREE.Group();
// the hills around the park; rebuilt when the map grows
let hills = null;
function buildHills() {
  const size = Math.max(420, Math.max(W, H) + 320),
    g = new THREE.PlaneGeometry(size, size, 170, 170);
  g.rotateX(-Math.PI / 2);
  g.translate(W / 2, 0, H / 2);
  const pos = g.attributes.position,
    col = new Float32Array(pos.count * 3),
    c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i),
      z = pos.getZ(i),
      h = hillH(x, z);
    pos.setY(i, x > 2.6 && x < W - 2.6 && z > 2.6 && z < H - 2.6 ? -2.5 : h - 0.03);
    const n = hsh(Math.floor(x * 0.7), Math.floor(z * 0.7));
    c.set(h > 9 ? '#5f7d40' : h > 4 ? '#527f37' : '#4f8636').lerp(new THREE.Color('#6b9441'), n * 0.4);
    c.convertSRGBToLinear();
    col.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  if (hills) {
    scene.remove(hills);
    hills.geometry.dispose();
  }
  hills = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
  hills.receiveShadow = true;
  scene.add(hills);
}
const rip = document.createElement('canvas');
rip.width = rip.height = 128;
{
  const x = rip.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 128, 128);
  for (let k = 0; k < 260; k++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.35)';
    x.beginPath();
    x.ellipse(Math.random() * 128, Math.random() * 128, rnd(3, 10), rnd(1, 2.5), 0, 0, 7);
    x.fill();
  }
}
const ripT = new THREE.CanvasTexture(rip);
ripT.wrapS = ripT.wrapT = THREE.RepeatWrapping;
ripT.repeat.set(5, 5);
const waterMat = new THREE.MeshPhongMaterial({
  color: LIN('#4f8a78'),
  specular: LIN('#e8f4ff'),
  shininess: 120,
  bumpMap: ripT,
  bumpScale: 0.04,
  transparent: true,
  opacity: 0.92,
});
{
  const shore = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r + 1.1, 40), M('#6a553a'));
  shore.rotation.x = -Math.PI / 2;
  shore.position.set(LAKE.x, 0.005, LAKE.z);
  shore.receiveShadow = true;
  scene.add(shore);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r, 40), waterMat);
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(LAKE.x, 0.02, LAKE.z);
  scene.add(lake);
  for (let k = 0; k < 4; k++) {
    const lp = P(
      scene,
      'cyl',
      '#4f9a46',
      LAKE.x + Math.cos(k * 1.7) * LAKE.r * 0.6,
      0.03,
      LAKE.z + Math.sin(k * 1.7) * LAKE.r * 0.55,
      0.28,
      0.01,
      0.28,
      false
    );
  }
  scene.add(mountains);
  const mm = new THREE.MeshPhongMaterial({ color: LIN('#7b8f86'), flatShading: true, shininess: 0 }),
    snow = new THREE.MeshPhongMaterial({ color: LIN('#f4f8fb'), flatShading: true, shininess: 0 });
  for (let k = 0; k < 22; k++) {
    const a = (k / 22) * 6.283 + rnd(-0.1, 0.1),
      r = rnd(150, 185),
      h = rnd(28, 60),
      w = rnd(22, 40);
    const mt = new THREE.Mesh(new THREE.ConeGeometry(w, h, 6 + (k % 3)), mm);
    mt.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    mt.rotation.y = rnd(0, 6);
    mountains.add(mt);
    if (h > 40) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(w * 0.3, h * 0.3, 6 + (k % 3)), snow);
      cap.position.set(mt.position.x, h - 2 - h * 0.15 + 0.5, mt.position.z);
      cap.rotation.y = mt.rotation.y;
      mountains.add(cap);
    }
  }
}
/* clouds and birds */
const clouds = [];
{
  const cm = new THREE.MeshLambertMaterial({
    color: LIN('#ffffff'),
    emissive: LIN('#c9d6e0'),
    emissiveIntensity: 0.35,
  });
  for (let k = 0; k < 14; k++) {
    const g = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const b = new THREE.Mesh(GEO.sph, cm);
      b.position.set(rnd(-3, 3), rnd(0, 1), rnd(-1.5, 1.5));
      b.scale.set(rnd(1.6, 2.8), rnd(1, 1.6), rnd(1.3, 2));
      g.add(b);
    }
    g.position.set(rnd(-60, W + 60), rnd(24, 34), rnd(-60, H + 60));
    g.userData.v = rnd(0.6, 1.2);
    scene.add(g);
    clouds.push(g);
  }
}
const birds = [];
{
  for (let k = 0; k < 6; k++) {
    const g = new THREE.Group(),
      wl = P(g, 'box', '#2b2b2b', 0, 0, 0.12, 0.05, 0.01, 0.24, false),
      wr = P(g, 'box', '#2b2b2b', 0, 0, -0.12, 0.05, 0.01, 0.24, false);
    P(g, 'sph', '#2b2b2b', 0, 0, 0, 0.08, 0.03, 0.03, false);
    g.userData = { wl, wr, r: rnd(10, 18), h: rnd(7, 11), s: rnd(0.15, 0.25) * (k % 2 ? 1 : -1), o: rnd(0, 6) };
    scene.add(g);
    birds.push(g);
  }
}
/* grass and flowers */
const CLUMP_T = (() => {
  const n = 256,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  for (let k = 0; k < 110; k++) {
    const bx = n / 2 + rnd(-70, 70),
      h = rnd(90, 240),
      lean = rnd(-55, 55),
      w = rnd(3, 7);
    const g = x.createLinearGradient(0, n, 0, n - h);
    const v = rnd(0.75, 1.15);
    g.addColorStop(0, `rgb(${(78 * v) | 0},${(112 * v) | 0},${(48 * v) | 0})`);
    g.addColorStop(0.6, `rgb(${(120 * v) | 0},${(160 * v) | 0},${(80 * v) | 0})`);
    g.addColorStop(1, `rgb(${(185 * v) | 0},${(205 * v) | 0},${(130 * v) | 0})`);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(bx - w, n);
    x.quadraticCurveTo(bx + lean * 0.3, n - h * 0.6, bx + lean, n - h);
    x.quadraticCurveTo(bx + lean * 0.3 + w * 0.3, n - h * 0.6, bx + w, n);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  return t;
})();
const tuftGeo = (() => {
  const pos = [],
    nor = [],
    uv = [],
    idx = [];
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI) / 3,
      cx = Math.cos(a) * 0.13,
      cz = Math.sin(a) * 0.13,
      b = pos.length / 3;
    pos.push(-cx, 0, -cz, cx, 0, cz, cx, 0.2, cz, -cx, 0.2, -cz);
    for (let i = 0; i < 4; i++) nor.push(0, 1, 0);
    uv.push(0, 0, 1, 0, 1, 1, 0, 1);
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
})();
const TUFT_MAX = 30000, // countryside outside the map only; each scenery chunk has its own
  tufts = new THREE.InstancedMesh(
    tuftGeo,
    new THREE.MeshLambertMaterial({ color: '#ffffff', map: CLUMP_T, alphaTest: 0.45 }),
    TUFT_MAX
  );
tufts.receiveShadow = true;
tufts.frustumCulled = false;
scene.add(tufts);
const flGeo = new THREE.SphereGeometry(0.03, 6, 4);
flGeo.translate(0, 0.12, 0);
const FL_MAX = 1500,
  flowers = new THREE.InstancedMesh(flGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), FL_MAX);
flowers.frustumCulled = false;
scene.add(flowers);
const FLC = ['#f2e26b', '#ffffff', '#e07a9b', '#b48ae0', '#f59a5b'];
