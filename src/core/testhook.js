/* Test-only hook (included by `npm run build:test`, never in the published game).
   Exposes internals so tests/run.mjs can drive the simulation directly. */
window.__wg = {
  get S() {
    return S;
  },
  get F() {
    return F;
  },
  tileAt,
  addAnimal,
  makeEncl,
  setPath,
  setTool,
  act,
  check,
  terraform,
  paintHabitat,
  careList,
  evalEncl,
  escape,
  recapture,
  monthlyUpkeep,
  checkTier,
  checkChallenge,
  startResearch,
  researched,
  renderTutorial,
  judgeYear,
  spawnRate,
  tallyMonth,
  yearRec,
  unlocked,
  serialize,
  isAnchor,
  load,
  rebuild,
  tick,
  spawnGuest,
  get audio() {
    return AC ? { state: AC.state, crowd: crowdGain.gain.value } : null;
  },
  get traffic() {
    return { movers: movers.map((m) => [m.d, m.len]), drawn: movBody.count, last: lastLotCars };
  },
  lotRoute,
  lotsInOrder,
  setSpeed,
  set(key, value) {
    const setters = {
      sub: () => (sub = value),
      terrSub: () => (terrSub = value),
      brushSize: () => (brushSize = value),
      habMode: () => (habMode = value),
      fenceSub: () => (fenceSub = value),
      paintE: () => (paintE = value),
      pathSub: () => (pathSub = value),
    };
    setters[key]();
  },
  refresh() {
    dirty = true;
    rebuild();
    staticDirty = true;
    groundDirty = true;
  },
  newZoo(w, h, mode) {
    newZoo(w, h, mode);
    rebuild();
  },
  resizeMap,
  get tours() {
    return F.tours;
  },
  fenceStrength,
  farmOf,
  farmTiles,
  stockOf,
  stockedShops,
  feedByTruck,
  guestPath,
  get carBody() {
    return carBody;
  },
  parkingSpaces,
  arrivalChance,
  carsParked,
  buyLand,
  landPrice,
  guestCap,
  profileTick(n) {
    const parts = {
      animals: tickAnimals,
      staff: tickStaff,
      guests: tickGuests,
      watchers: countWatchers,
      tier: checkTier,
    };
    const out = {};
    for (const [k, f] of Object.entries(parts)) {
      const t0 = performance.now();
      for (let i = 0; i < n; i++) f();
      out[k] = ((performance.now() - t0) / n).toFixed(3);
    }
    return out;
  },
  paintGround,
  timeRoute(from, to) {
    const t0 = performance.now();
    const r = staffRoute(from, new Set([to]));
    return [performance.now() - t0, r ? r.length : null];
  },
  get W() {
    return W;
  },
  get H() {
    return H;
  },
  hire,
  fire,
  giveRaise,
  staffMonth,
  refreshCandidates,
  staffCount,
  unreachable,
  staffRoute,
  staffStep,
  serviceTiles,
  pickJob,
  // place a building of this kind on the first free spot beside a path
  build(kind) {
    tool = 'shop';
    sub = kind;
    for (let y = 15; y < H - 1; y++)
      for (let x = 2; x < W - 2; x++)
        if (check(x, y).ok) {
          act(x, y);
          dirty = true;
          rebuild();
          return [x, y];
        }
    return null;
  },
  hireRole(role) {
    const c = S.cands.find((k) => k.role === role) || (refreshCandidates(), S.cands.find((k) => k.role === role));
    return hire(c.id);
  },
  sceneStats() {
    const count = (root) => {
      let m = 0,
        tri = 0;
      root.traverse((o) => {
        if (o.isMesh && o.visible) {
          m++;
          const g = o.geometry;
          tri += ((g.index ? g.index.count : g.attributes.position.count) / 3) * (o.isInstancedMesh ? o.count : 1);
        }
      });
      return { meshes: m, tris: Math.round(tri) };
    };
    return {
      scenery: count(staticRoot),
      animals: count(animalRoot),
      edge: count(worldEdge),
      all: count(scene),
      ground: groundRoot.children.length,
      maxTex: renderer.capabilities.maxTextureSize,
    };
  },
  get staticStats() {
    return staticStats;
  },
  save,
  serialize,
  isAnchor,
  load,
  readSave,
  saveSlot,
  inspectAt,
  renderInspector,
  get sel() {
    return sel;
  },
  loadSlot,
  slotList,
  get renderer() {
    return renderer;
  },
  get CAM() {
    return CAM;
  },
  renderScenery() {
    rebuildStatic();
  },
  canopy(on) {
    setCanopy(on);
    let n = 0,
      shown = 0;
    staticRoot.traverse((o) => {
      if (o.userData.crown) {
        n++;
        if (o.visible) shown++;
      }
    });
    return { n, shown };
  },
};
