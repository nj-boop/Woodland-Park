/* Three.js renderer, lights, sky dome, shared geometries and materials, painted water. */
/* ---------- 3D rendering ---------- */
const coarse = matchMedia('(pointer:coarse)').matches;
const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(coarse ? 1.75 : 2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
const LIN = (c) => new THREE.Color(c).convertSRGBToLinear();
const scene = new THREE.Scene();
const HOR = new THREE.Color('#cfe6ef'),
  HOR_D = new THREE.Color('#f1b38c'),
  TOP = new THREE.Color('#4f9fd6'),
  TOP_D = new THREE.Color('#6d78b8'),
  HOR_N = new THREE.Color('#2a3656'), // night
  TOP_N = new THREE.Color('#0c1428'),
  SUN_DAY = new THREE.Color(),
  MOON = new THREE.Color('#9fb6ff');
scene.fog = new THREE.Fog(LIN('#cfe6ef'), 55, 190);
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 320);
const hemi = new THREE.HemisphereLight(LIN('#dcecf7'), LIN('#4d6a32'), 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(LIN('#fff0d2'), 1.55);
sun.position.set(W / 2 - 16, 32, H / 2 + 12);
sun.target.position.set(W / 2, 0, H / 2);
scene.add(sun, sun.target);
sun.castShadow = true;
sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 24, bottom: -24, near: 1, far: 90 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;

/* sky dome */
const skyU = {
  top: { value: TOP.clone() },
  hor: { value: HOR.clone() },
  sunC: { value: new THREE.Color('#fff3c4') },
  sunDir: { value: new THREE.Vector3(-16, 32, 12).normalize() },
};
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(280, 32, 16),
  new THREE.ShaderMaterial({
    uniforms: skyU,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    vertexShader:
      'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:
      'uniform vec3 top,hor,sunC,sunDir;varying vec3 vP;void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,top,pow(h,.5));float s=max(dot(vP,sunDir),0.);c+=sunC*(pow(s,400.)*1.4+pow(s,12.)*.18);if(vP.y<0.)c=hor;gl_FragColor=vec4(c,1.);}',
  })
);
sky.renderOrder = -10;
scene.add(sky);

const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sph: new THREE.SphereGeometry(1, 18, 12),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
  cone: new THREE.ConeGeometry(1, 1, 10),
  ico: new THREE.IcosahedronGeometry(1, 0),
  icoD: new THREE.IcosahedronGeometry(1, 1),
  disc: new THREE.CylinderGeometry(1, 1, 1, 36),
  dod: new THREE.DodecahedronGeometry(1, 0),
};
const MC = {};
const M = (c) => MC[c] || (MC[c] = new THREE.MeshLambertMaterial({ color: LIN(c) }));
function P(par, geo, col, x, y, z, sx, sy, sz, shadow) {
  const m = new THREE.Mesh(GEO[geo], typeof col === 'string' ? M(col) : col);
  m.position.set(x, y, z);
  m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  m.castShadow = shadow !== false;
  par.add(m);
  return m;
}

/* grass-blade detail texture, used by the ground shader (render/ground-splat.js) */
const DETAIL = (() => {
  const n = 256,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,128)';
  x.fillRect(0, 0, n, n);
  for (let k = 0; k < 2600; k++) {
    const px = rnd(0, n),
      py = rnd(0, n),
      h = rnd(5, 13),
      lean = rnd(-3, 3),
      v = Math.random() < 0.5 ? rnd(60, 105) : rnd(150, 200),
      gg = Math.min(255, v + rnd(5, 20));
    x.strokeStyle = `rgb(${v - 8},${gg},${v - 20})`;
    x.lineWidth = rnd(0.8, 1.6);
    for (const ox of [0, -n, n])
      for (const oy of [0, -n, n]) {
        x.beginPath();
        x.moveTo(px + ox, py + oy);
        x.lineTo(px + ox + lean, py + oy - h);
        x.stroke();
      }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
})();
const waterRoot = new THREE.Group();
scene.add(waterRoot);
function buildWater() {
  waterRoot.clear();
  const pos = [],
    ix = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      // one tile past the water too: the banks slope, so the shoreline is where the ground dips under
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++)
        for (let dx = -1; dx <= 1; dx++) if (inB(x + dx, y + dy) && tileAt(x + dx, y + dy).w) near = true;
      if (!near) continue;
      const b = pos.length / 3;
      pos.push(x, WATER_Y, y, x + 1, WATER_Y, y, x + 1, WATER_Y, y + 1, x, WATER_Y, y + 1);
      ix.push(b, b + 2, b + 1, b, b + 3, b + 2);
    }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  const uv = [];
  for (let k = 0; k < pos.length / 3; k++) uv.push(pos[k * 3] * 0.35, pos[k * 3 + 2] * 0.35);
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, waterMat);
  m.receiveShadow = true;
  waterRoot.add(m);
}
