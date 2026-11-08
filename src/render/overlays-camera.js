/* Selection rings, build previews, the orbit camera, resizing, and the per-frame render. */
/* overlays */
const brassMat = new THREE.MeshBasicMaterial({
  color: LIN('#e6aa3e'),
  depthTest: false,
  transparent: true,
  opacity: 0.95,
  toneMapped: false,
});
const selRing = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 36), brassMat);
selRing.rotation.x = -Math.PI / 2;
selRing.renderOrder = 4;
selRing.visible = false;
scene.add(selRing);
const selRect = new THREE.Group();
for (let k = 0; k < 4; k++) {
  const m = new THREE.Mesh(GEO.box, brassMat);
  m.renderOrder = 4;
  selRect.add(m);
}
selRect.visible = false;
scene.add(selRect);
const prevMat = new THREE.MeshBasicMaterial({
  color: '#e6aa3e',
  transparent: true,
  opacity: 0.38,
  depthWrite: false,
  toneMapped: false,
});
// an arrow on the build preview pointing out of a building's front door
const doorMark = new THREE.Mesh(
  (() => {
    const sh = new THREE.Shape();
    sh.moveTo(-0.28, 0);
    sh.lineTo(0.28, 0);
    sh.lineTo(0, 0.34);
    sh.closePath();
    const gm = new THREE.ShapeGeometry(sh);
    gm.rotateX(Math.PI / 2);
    return gm;
  })(),
  brassMat
);
doorMark.renderOrder = 5;
doorMark.visible = false;
scene.add(doorMark);
const setPrev = (c) => prevMat.color.set(c).convertSRGBToLinear();
const prev = new THREE.Mesh(GEO.box, prevMat);
prev.visible = false;
prev.renderOrder = 3;
scene.add(prev);
function setRect(grp, x, z, w, h, y) {
  const t = 0.07,
    c = grp.children;
  c[0].position.set(x + w / 2, y, z);
  c[0].scale.set(w + t, 0.02, t);
  c[1].position.set(x + w / 2, y, z + h);
  c[1].scale.set(w + t, 0.02, t);
  c[2].position.set(x, y, z + h / 2);
  c[2].scale.set(t, 0.02, h);
  c[3].position.set(x + w, y, z + h / 2);
  c[3].scale.set(t, 0.02, h);
}
function overlays(alpha) {
  selRing.visible = false;
  doorMark.visible = false;
  selRect.visible = false;
  if (sel && sel.type === 'encl' && F.emap[sel.id]) {
    const e = F.emap[sel.id];
    setRect(selRect, e.x - 0.04, e.y - 0.04, e.w + 0.08, e.h + 0.08, 0.03);
    selRect.visible = true;
  }
  if (sel && sel.type === 'guest') {
    const g = S.guests.find((o) => o.id === sel.id);
    if (g) {
      const q = guestPos(g, alpha);
      selRing.position.set(q.x, 0.03, q.z);
      selRing.scale.setScalar(0.6);
      selRing.visible = true;
    }
  }
  if (sel && sel.type === 'staff') {
    const st = S.staff.find((o) => o.id === sel.id);
    if (st && st.st !== 'rest') {
      const x = st.ox + (st.x - st.ox) * alpha,
        z = st.oy + (st.y - st.oy) * alpha;
      selRing.position.set(x, heightAt(x, z) + 0.03, z);
      selRing.scale.setScalar(0.6);
      selRing.visible = true;
    }
  }
  if (sel && sel.type === 'animal') {
    const m = amesh.get(sel.id);
    if (m) {
      selRing.position.set(m.position.x, 0.03, m.position.z);
      selRing.scale.setScalar(1.25);
      selRing.visible = true;
    }
  }
  const info = $('#dragInfo');
  info.classList.remove('bad');
  if (drag && drag.rect) {
    const r = drag.rect,
      c = rectCheck(r);
    setPrev(c.ok ? '#58e04a' : '#e5674f');
    prev.position.set(r.x + r.w / 2, 0.04, r.y + r.h / 2);
    prev.scale.set(r.w, 0.08, r.h);
    prev.visible = true;
    info.textContent = c.ok ? `${r.w}×${r.h} habitat · ${money(c.cost)}` : `${r.w}×${r.h} · ${c.msg}`;
    info.hidden = false;
  } else {
    info.hidden = true;
    if (hover && tool !== 'look' && inB(hover.x, hover.y)) {
      const c =
        tool === 'habitat'
          ? { ok: !tileAt(hover.x, hover.y).e && tileAt(hover.x, hover.y).t !== 'p' }
          : check(hover.x, hover.y);
      setPrev(c.ok ? (tool === 'bulldoze' ? '#e5674f' : '#58e04a') : '#e5674f');
      prev.position.set(hover.x + 0.5, 0.04 + heightAt(hover.x + 0.5, hover.y + 0.5), hover.y + 0.5);
      prev.scale.set(0.96, 0.08, 0.96);
      prev.visible = true;
      doorMark.visible = false;
      // buildings bigger than a tile: show the whole footprint and which side the door is on
      let plan = c.plan;
      if (
        !plan &&
        tool === 'bulldoze' &&
        tileAt(hover.x, hover.y).o &&
        sizeOf(tileAt(hover.x, hover.y).o)[0] * sizeOf(tileAt(hover.x, hover.y).o)[1] > 1
      )
        plan = planOf(anchorOf(idx(hover.x, hover.y)));
      // say what's being built, what it costs, and why not if it can't go here
      if (plan && tool !== 'bulldoze' && ITEMS[sub]) {
        const it = ITEMS[sub];
        info.textContent = c.ok
          ? `${it.name} · ${money(it.cost)}${c.clears ? ` · clears ${c.clears} plant${c.clears > 1 ? 's' : ''}` : ''}${pendingBuild ? ' · tap it again to build' : ''}`
          : c.msg;
        info.classList.toggle('bad', !c.ok);
        info.hidden = false;
      }
      if (plan) {
        const cx = plan.x0 + plan.fw / 2,
          cz = plan.y0 + plan.fh / 2;
        prev.position.set(cx, 0.04 + heightAt(cx, cz), cz);
        prev.scale.set(plan.fw - 0.04, 0.08, plan.fh - 0.04);
        if (tool !== 'bulldoze') {
          const [dx, dz] = [
            [0, 1],
            [1, 0],
            [0, -1],
            [-1, 0],
          ][plan.r];
          doorMark.position.set(cx + (dx * plan.fw) / 2, 0.08 + heightAt(cx, cz), cz + (dz * plan.fh) / 2);
          doorMark.rotation.y = (plan.r * Math.PI) / 2;
          doorMark.visible = true;
        }
      }
      if (tool === 'terrain' && terrSub !== 'water' && terrSub !== 'drain') {
        const r = brushR();
        prev.scale.set(r * 2, 0.08, r * 2);
        prev.position.set(hover.wx / T, 0.06 + heightAt(hover.wx / T, hover.wy / T), hover.wy / T);
      }
      if (c.ok && c.cost && !c.plan) {
        info.textContent = `(${money(c.cost)})`;
        info.hidden = false;
      }
    } else prev.visible = false;
  }
}

/* camera */
const CAM = { tx: 18.5, tz: 15, dist: 19, yaw: 0.55, yawG: 0.55, pitch: 0.88 };
function clampCam() {
  CAM.tx = clamp(CAM.tx, -1, W + 1);
  CAM.tz = clamp(CAM.tz, -1, H + 3);
  CAM.dist = clamp(CAM.dist, 4.5, 46);
  CAM.pitch = clamp(CAM.pitch, 0.32, 1.45);
}
function updateCamera() {
  CAM.yaw += (CAM.yawG - CAM.yaw) * 0.18;
  const cp = Math.cos(CAM.pitch);
  camera.position.set(
    CAM.tx + Math.sin(CAM.yaw) * cp * CAM.dist,
    Math.sin(CAM.pitch) * CAM.dist,
    CAM.tz + Math.cos(CAM.yaw) * cp * CAM.dist
  );
  camera.lookAt(CAM.tx, 0, CAM.tz);
}
function panBy(dx, dy) {
  const k = (2 * CAM.dist * Math.tan((camera.fov * Math.PI) / 360)) / Math.max(1, view.h),
    ky = k / Math.max(0.45, Math.sin(CAM.pitch));
  const rx = Math.cos(CAM.yaw),
    rz = -Math.sin(CAM.yaw),
    fx = -Math.sin(CAM.yaw),
    fz = -Math.cos(CAM.yaw);
  CAM.tx += -rx * dx * k + fx * dy * ky;
  CAM.tz += -rz * dx * k + fz * dy * ky;
  clampCam();
}
function rotateBy(a) {
  CAM.yawG += a;
  CAM.yaw += a;
}
function resize() {
  const r = cv.getBoundingClientRect();
  if (!r.width || !r.height) return;
  view.w = r.width;
  view.h = r.height;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
let groundT = 0;
function render3D(alpha, dt) {
  if (mapResized) onMapResized();
  if (groundDirty) {
    paintGround();
    groundSig = groundSignature();
  }
  groundT += dt;
  if (groundT > 1000) {
    groundT = 0;
    const sg = groundSignature();
    if (sg !== groundSig) {
      groundSig = sg;
      paintGround();
    }
  }
  if (staticDirty) rebuildStatic();
  cullChunks();
  syncParkedCars(performance.now());
  syncDeliveries(alpha);
  const time = performance.now();
  syncAnimals(alpha, time, dt);
  syncGuests(alpha, time);
  overlays(alpha);
  const ev = clamp((S.clock / DAY - 0.72) / 0.28, 0, 1);
  skyU.hor.value.copy(HOR).lerp(HOR_D, ev * 0.8);
  skyU.top.value.copy(TOP).lerp(TOP_D, ev * 0.6);
  scene.fog.color.copy(skyU.hor.value).convertSRGBToLinear();
  sun.intensity = 1.55 - ev * 0.55;
  sun.color.setHSL(0.1, 0.75 + ev * 0.2, 0.9 - ev * 0.1).convertSRGBToLinear();
  hemi.intensity = 0.85 - ev * 0.25;
  const sec = time / 1000;
  ripT.offset.set(sec * 0.02, sec * 0.013);
  for (const c of clouds) {
    c.position.x += (c.userData.v * dt) / 1000;
    if (c.position.x > W + 70) c.position.x = -70;
  }
  for (const b of birds) {
    const u = b.userData,
      a = sec * u.s + u.o;
    b.position.set(W / 2 + Math.cos(a) * u.r, u.h + Math.sin(sec * 0.7 + u.o) * 0.6, H / 2 + Math.sin(a) * u.r);
    b.rotation.y = -a - (u.s > 0 ? 0 : Math.PI);
    const fl = Math.sin(sec * 9 + u.o) * 0.7;
    u.wl.rotation.x = fl;
    u.wr.rotation.x = -fl;
  }
  updateCamera();
  sky.position.copy(camera.position);
  renderer.render(scene, camera);
}
