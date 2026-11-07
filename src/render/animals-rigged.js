/* Loading the Blender-built rigged animal models and creating animated instances. */
/* hand-built rigged models (Blender), loaded alongside the page */
const MODELS = {
  zebra: { top: 0.9 },
  giraffe: { top: 1.55 },
  lion: { top: 0.72 },
  tiger: { top: 0.66 },
  elephant: { top: 1.2 },
  polar: { top: 0.8 },
  camel: { top: 1.15 },
  fox: { top: 0.4 },
  bison: { top: 0.9 },
  monkey: { top: 0.5 },
  gorilla: { top: 0.95 },
  penguin: { top: 0.66 },
  kangaroo: { top: 0.9 },
  dolphin: { top: 0.25 },
  sealion: { top: 0.25 },
  turtle: { top: 0.2 },
  shark: { top: 0.3 },
  orca: { top: 0.45 },
};
for (const k in MODELS) MODELS[k].url = 'models/' + k + '.json';
function loadModels() {}
function loadModel(sp) {
  const m = MODELS[sp];
  if (!m || m.loading || !THREE.GLTFLoader || !THREE.SkeletonUtils) return;
  m.loading = true;
  const ld = new THREE.GLTFLoader();
  {
    ld.load(
      m.url,
      (gl) => {
        m.scene = gl.scene;
        m.clips = gl.animations;
        m.ready = true;
        gl.scene.traverse((o) => {
          if (o.isMesh) {
            o.castShadow = true;
            o.receiveShadow = true;
            if (o.material) {
              o.material.roughness = 0.85;
              o.material.metalness = 0;
            }
          }
        });
        for (const [id, mesh] of amesh)
          if (mesh.userData.sp === sp) {
            animalRoot.remove(mesh);
            amesh.delete(id);
          }
      },
      undefined,
      () => {
        m.failed = true;
      }
    );
  }
}
function buildModelAnimal(sp) {
  const m = MODELS[sp],
    g = new THREE.Group(),
    obj = THREE.SkeletonUtils.clone(m.scene);
  g.add(obj);
  const mixer = new THREE.AnimationMixer(obj),
    acts = {};
  for (const c of m.clips) acts[c.name] = mixer.clipAction(c);
  const start = acts.idle || Object.values(acts)[0];
  if (start) {
    start.play();
    start.time = Math.random() * 3;
  }
  g.userData = { legs: [], top: m.top, mixer, acts, cur: 'idle', model: true };
  return g;
}
function buildAnimal(sp) {
  if (MODELS[sp] && MODELS[sp].ready) return buildModelAnimal(sp);
  loadModel(sp);
  const G = geoFor(sp),
    sc = G.spec,
    g = new THREE.Group(),
    legs = [];
  const body = new THREE.Mesh(G.body, AMAT);
  body.castShadow = true;
  g.add(body);
  for (const l of sc.limbs) {
    const pv = new THREE.Group();
    pv.position.set(...l.at);
    const m = new THREE.Mesh(G.limbs[l.type], AMAT);
    m.castShadow = true;
    pv.add(m);
    g.add(pv);
    legs.push(pv);
  }
  const [ep, er] = sc.eyes;
  for (const s of [1, -1]) {
    const e = new THREE.Mesh(EYEGEO, EYEMAT);
    e.position.set(ep[0], ep[1], s * ep[2]);
    e.scale.setScalar(er);
    g.add(e);
  }
  g.userData = { legs, top: sc.top, hop: !!sc.hop, waddle: !!sc.waddle };
  return g;
}
