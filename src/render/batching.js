/* Batching: after a chunk of scenery is built (trees, rocks, buildings, fences — each made of many
   small meshes), every set of meshes that share the same geometry and material is replaced by ONE
   InstancedMesh, which the GPU draws in a single call. A forest of 400 oaks becomes a handful of
   draws instead of thousands. Meshes that are one of a kind stay as they are.

   Chunk visibility is then decided per chunk (instanced meshes can't be culled one by one), and the
   distance to the camera turns shadows off for far-away chunks. */

const _bm = new THREE.Matrix4();
function batchGroup(grp) {
  grp.updateMatrixWorld(true);
  const inv = _bm.copy(grp.matrixWorld).invert();
  const buckets = new Map(),
    singles = [];
  grp.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const key = [
      o.geometry.uuid,
      o.material.uuid,
      o.castShadow ? 1 : 0,
      o.receiveShadow ? 1 : 0,
      o.customDepthMaterial ? o.customDepthMaterial.uuid : '',
      o.userData.crown ? 1 : 0,
      o.renderOrder,
    ].join('|');
    let b = buckets.get(key);
    if (!b) buckets.set(key, (b = { proto: o, mats: [] }));
    b.mats.push(m);
  });
  const out = [];
  for (const b of buckets.values()) {
    const p = b.proto;
    if (b.mats.length === 1) {
      // keep the mesh, flattened to the chunk with its full transform
      const m = new THREE.Mesh(p.geometry, p.material);
      m.matrixAutoUpdate = false;
      m.matrix.copy(b.mats[0]);
      copyMeshFlags(p, m);
      singles.push(m);
      continue;
    }
    const im = new THREE.InstancedMesh(p.geometry, p.material, b.mats.length);
    b.mats.forEach((m, k) => im.setMatrixAt(k, m));
    im.instanceMatrix.needsUpdate = true;
    copyMeshFlags(p, im);
    im.frustumCulled = false; // whole chunks are culled instead
    out.push(im);
  }
  grp.clear();
  for (const o of out) grp.add(o);
  for (const o of singles) grp.add(o);
}
function copyMeshFlags(from, to) {
  to.castShadow = from.castShadow;
  to.receiveShadow = from.receiveShadow;
  to.customDepthMaterial = from.customDepthMaterial;
  to.renderOrder = from.renderOrder;
  if (from.userData.crown) {
    to.userData.crown = true;
    to.visible = CANOPY_ON;
  }
}

// per-frame: hide chunks outside the view, and drop shadows on far ones
const _frustum = new THREE.Frustum(),
  _pv = new THREE.Matrix4();
const SHADOW_FAR = 45; // tiles from the camera target beyond which scenery stops casting shadows
function cullChunks() {
  _pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  _frustum.setFromProjectionMatrix(_pv);
  for (const c of edgeSectors) c.grp.visible = _frustum.intersectsBox(c.box);
  for (const c of chunkRoots.values()) {
    if (!c.box) continue;
    c.grp.visible = _frustum.intersectsBox(c.box);
    if (!c.grp.visible) continue;
    const far = Math.hypot(c.cx - CAM.tx, c.cz - CAM.tz) > SHADOW_FAR;
    if (far !== c.far) {
      c.far = far;
      c.grp.traverse((o) => {
        if (o.isMesh) {
          if (o.userData.shadow === undefined) o.userData.shadow = o.castShadow;
          o.castShadow = far ? false : o.userData.shadow;
        }
      });
    }
  }
}

// the forest around the park: regroup it into 16-tile sectors so off-screen ones can be culled
const edgeSectors = [];
function batchEdge() {
  worldEdge.updateMatrixWorld(true);
  const sectors = new Map();
  for (const o of [...worldEdge.children]) {
    const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld),
      key = Math.floor(p.x / 16) + ',' + Math.floor(p.z / 16);
    let g = sectors.get(key);
    if (!g) sectors.set(key, (g = new THREE.Group()));
    g.attach(o);
  }
  worldEdge.clear();
  edgeSectors.length = 0;
  for (const [key, g] of sectors) {
    worldEdge.add(g);
    const box = new THREE.Box3().setFromObject(g);
    batchGroup(g);
    edgeSectors.push({ grp: g, box });
  }
}
