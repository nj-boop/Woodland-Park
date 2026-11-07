/* Mouse, touch, pinch, wheel and keyboard input; picking tiles and animals in 3D. */
/* ---------- input ---------- */
const ptrs = new Map();
let pinch = null;
const ray = new THREE.Raycaster(),
  ndc = new THREE.Vector2(),
  gplane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
  hitV = new THREE.Vector3();
function setRay(sx, sy) {
  ndc.set((sx / view.w) * 2 - 1, -(sy / view.h) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function toTile(sx, sy) {
  setRay(sx, sy);
  const gh = ray.intersectObjects(groundRoot.children, false);
  const p = gh.length ? gh[0].point : ray.ray.intersectPlane(gplane, hitV);
  if (!p) return { x: -99, y: -99, wx: -1e9, wy: -1e9 };
  return { x: Math.floor(p.x), y: Math.floor(p.z), wx: p.x * T, wy: p.z * T };
}
function pickAnimal(sx, sy) {
  setRay(sx, sy);
  const hits = ray.intersectObjects(animalRoot.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && o.userData.aid == null) o = o.parent;
    if (o) {
      sel = { type: 'animal', id: o.userData.aid };
      renderInspector();
      return true;
    }
  }
  return false;
}
function local(e) {
  const r = cv.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function zoomBy(f) {
  CAM.dist *= f;
  clampCam();
}
cv.addEventListener('pointerdown', (e) => {
  cv.setPointerCapture(e.pointerId);
  const p = local(e);
  ptrs.set(e.pointerId, p);
  if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()];
    pinch = {
      d: Math.hypot(a.x - b.x, a.y - b.y),
      ang: Math.atan2(b.y - a.y, b.x - a.x),
      mx: (a.x + b.x) / 2,
      my: (a.y + b.y) / 2,
    };
    drag = null;
    return;
  }
  const tt = toTile(p.x, p.y);
  const orbit = e.button === 2 || (e.button === 0 && e.altKey);
  const pan = !orbit && (tool === 'look' || e.button === 1 || spaceDown);
  drag = { sx: p.x, sy: p.y, lx: p.x, ly: p.y, moved: false, pan, orbit, start: tt, last: null, rect: null };
  if (!pan && !orbit && tool === 'path') {
    act(tt.x, tt.y);
    drag.last = tt;
  }
  if (!pan && !orbit && tool === 'habitat' && inB(tt.x, tt.y)) {
    if (habMode === 'rect') drag.rect = rectOf(tt, tt);
    else {
      paintE = null;
      paintHabitat(tt.x, tt.y, true);
      drag.last = tt;
    }
  }
  if (!pan && !orbit && tool === 'terrain' && inB(tt.x, tt.y)) {
    drag.h0 = heightAt(tt.wx / T, tt.wy / T);
    terraform(tt.wx / T, tt.wy / T);
    drag.last = tt;
    drag.lastT = performance.now();
  }
});
cv.addEventListener('pointermove', (e) => {
  const p = local(e);
  if (!ptrs.has(e.pointerId)) {
    hover = toTile(p.x, p.y);
    return;
  }
  ptrs.set(e.pointerId, p);
  if (pinch && ptrs.size >= 2) {
    const [a, b] = [...ptrs.values()],
      d = Math.hypot(a.x - b.x, a.y - b.y),
      ang = Math.atan2(b.y - a.y, b.x - a.x),
      mx = (a.x + b.x) / 2,
      my = (a.y + b.y) / 2;
    zoomBy(pinch.d / Math.max(1, d));
    let da = ang - pinch.ang;
    da = Math.atan2(Math.sin(da), Math.cos(da));
    rotateBy(-da);
    panBy(mx - pinch.mx, my - pinch.my);
    Object.assign(pinch, { d, ang, mx, my });
    return;
  }
  if (!drag) return;
  if (Math.hypot(p.x - drag.sx, p.y - drag.sy) > 6) drag.moved = true;
  const ddx = p.x - drag.lx,
    ddy = p.y - drag.ly;
  drag.lx = p.x;
  drag.ly = p.y;
  if (drag.orbit) {
    rotateBy(-ddx * 0.008);
    CAM.pitch += ddy * 0.005;
    clampCam();
    return;
  }
  if (drag.pan) {
    if (drag.moved) panBy(ddx, ddy);
    return;
  }
  const tt = toTile(p.x, p.y);
  hover = tt;
  if (tool === 'path' && drag.last && (tt.x !== drag.last.x || tt.y !== drag.last.y)) {
    let cx = drag.last.x,
      cy = drag.last.y,
      guard = 0;
    while ((cx !== tt.x || cy !== tt.y) && guard++ < 80) {
      if (Math.abs(tt.x - cx) >= Math.abs(tt.y - cy)) cx += Math.sign(tt.x - cx);
      else cy += Math.sign(tt.y - cy);
      act(cx, cy);
    }
    drag.last = tt;
  }
  if (tool === 'habitat' && drag.rect)
    drag.rect = rectOf(drag.start, { x: clamp(tt.x, 0, W - 1), y: clamp(tt.y, 0, H - 1) });
  if (
    tool === 'habitat' &&
    !drag.rect &&
    drag.last &&
    (tt.x !== drag.last.x || tt.y !== drag.last.y) &&
    habMode !== 'gate'
  ) {
    paintHabitat(tt.x, tt.y, false);
    drag.last = tt;
  }
  if (tool === 'terrain' && drag.last) {
    const now = performance.now();
    if (
      terrSub === 'water' || terrSub === 'drain' ? tt.x !== drag.last.x || tt.y !== drag.last.y : now - drag.lastT > 60
    ) {
      terraform(tt.wx / T, tt.wy / T);
      drag.last = tt;
      drag.lastT = now;
    }
  }
});
function endPtr(e) {
  ptrs.delete(e.pointerId);
  if (pinch) {
    if (ptrs.size < 2) pinch = null;
    drag = null;
    return;
  }
  if (!drag) return;
  const d = drag;
  drag = null;
  if (d.orbit) return;
  if (d.pan) {
    if (!d.moved && tool === 'look' && !pickAnimal(d.sx, d.sy)) inspectAt(d.start);
    return;
  }
  if (tool === 'habitat' && d.rect) {
    buildHabitat(d.rect);
    return;
  }
  if (tool === 'habitat') {
    paintE = null;
    dirty = true;
    return;
  }
  if (tool === 'terrain') {
    staticDirty = true;
    groundDirty = true;
    dirty = true;
    return;
  }
  if (['animal', 'plant', 'shop', 'bulldoze'].includes(tool) && !d.moved) act(d.start.x, d.start.y);
}
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('pointerleave', () => {
  if (!ptrs.size) hover = null;
});
cv.addEventListener('contextmenu', (e) => e.preventDefault());
cv.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    const mouseWheel = e.deltaMode === 1 || (Number.isInteger(e.deltaY) && Math.abs(e.deltaY) >= 40 && e.deltaX === 0);
    if (e.ctrlKey || mouseWheel) zoomBy(Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
    else if (e.shiftKey) rotateBy(e.deltaY * 0.004);
    else panBy(-e.deltaX, -e.deltaY);
  },
  { passive: false }
);
// Safari trackpad pinch
let gsScale = 1;
cv.addEventListener('gesturestart', (e) => {
  e.preventDefault();
  gsScale = 1;
});
cv.addEventListener('gesturechange', (e) => {
  e.preventDefault();
  zoomBy(gsScale / e.scale);
  gsScale = e.scale;
  if (e.rotation) rotateBy(0);
});
let spaceDown = false;
window.addEventListener('keyup', (e) => {
  if (e.key === ' ') spaceDown = false;
});
window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  const map = { 1: 'look', 2: 'path', 3: 'habitat', 4: 'animal', 5: 'plant', 6: 'shop', 7: 'bulldoze', 8: 'terrain' };
  if (map[k]) {
    setTool(map[k]);
    return;
  }
  if (k === ' ') {
    e.preventDefault();
    setSpeed(speed ? 0 : 1);
    return;
  }
  if (k === 'z') {
    toggleZoo();
    return;
  }
  if (k === 'escape') {
    setTool('look');
    closeInspector();
    $('#zooPanel').hidden = true;
    syncZooBtn();
    return;
  }
  if (k === 'q') {
    CAM.yawG += Math.PI / 4;
    return;
  }
  if (k === 'e') {
    CAM.yawG -= Math.PI / 4;
    return;
  }
  if (k === 'r' && (tool === 'shop' || tool === 'plant') && ITEMS[sub] && ITEMS[sub].size) {
    rotateBuild();
    return;
  }
  if (k === 'r') {
    CAM.pitch += 0.12;
    clampCam();
    return;
  }
  if (k === 'f') {
    CAM.pitch -= 0.12;
    clampCam();
    return;
  }
  const s = 60;
  if (k === 'arrowleft' || k === 'a') panBy(s, 0);
  else if (k === 'arrowright' || k === 'd') panBy(-s, 0);
  else if (k === 'arrowup' || k === 'w') panBy(0, s);
  else if (k === 'arrowdown' || k === 's') panBy(0, -s);
  else if (k === '=' || k === '+') zoomBy(1 / 1.2);
  else if (k === '-') zoomBy(1.2);
  else if (k === 't') toggleCanopy();
});
function toggleCanopy() {
  setCanopy(!CANOPY_ON);
  $('#canopy').setAttribute('aria-pressed', String(!CANOPY_ON));
  $('#canopy').title = CANOPY_ON ? 'Hide tree tops (T)' : 'Show tree tops (T)';
}
$('#canopy').onclick = toggleCanopy;
$('#rotL').onclick = () => (CAM.yawG += Math.PI / 4);
$('#rotR').onclick = () => (CAM.yawG -= Math.PI / 4);
$('#zIn').onclick = () => zoomBy(1 / 1.25);
$('#zOut').onclick = () => zoomBy(1.25);
$('#tilt').onclick = () => {
  CAM.pitch = CAM.pitch > 1 ? 0.55 : 1.2;
  clampCam();
};
