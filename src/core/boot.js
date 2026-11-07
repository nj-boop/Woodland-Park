/* Game loop (fixed-step simulation + interpolated rendering) and startup. */
/* ---------- boot ---------- */
let last = 0,
  acc = 0,
  uiT = 0;
function frame(now) {
  const dt = Math.min(250, now - (last || now));
  last = now;
  if (speed > 0) {
    acc += dt * speed;
    let n = 0;
    while (acc >= 1000 / TPS && n < 40) {
      tick();
      acc -= 1000 / TPS;
      n++;
    }
  }
  if (dirty) rebuild();
  render3D(speed > 0 ? clamp(acc / (1000 / TPS), 0, 1) : 1, dt);
  uiT += dt;
  if (uiT > 300) {
    uiT = 0;
    hud();
    if (sel) renderInspector();
    if (!$('#zooPanel').hidden) renderZoo();
  }
  requestAnimationFrame(frame);
}
async function start(data) {
  let loaded = false;
  try {
    const s = (data && data.save) || (await readSave());
    if (s) {
      load(s);
      loaded = true;
    }
  } catch (e) {}
  if (!loaded) newZoo();
  rebuild();
  new ResizeObserver(resize).observe(cv);
  centerCam();
  setTool('look');
  hud();
  if (window.claude && window.claude.hot && typeof window.claude.hot.snapshot === 'function')
    window.claude.hot.snapshot(() => ({ save: serialize() }));
  setInterval(save, 15000);
  buildEdge();
  loadModels();
  if (document.fonts && document.fonts.ready)
    document.fonts.ready.then(() => {
      signTex = null;
      staticDirty = true;
    });
  if (!loaded)
    toast(
      'Welcome to Wildgrove. Two zebras are settling in. Build a recycling yard and a keeper lodge so you can hire zookeepers, and check the Office for your next unlocks.',
      'good'
    );
  else toast(`Welcome back. ${money(S.money)} in the bank.`);
  requestAnimationFrame(frame);
}
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
