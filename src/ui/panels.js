/* Toolbar, option tray, toasts, habitat/animal/guest inspector, zoo office panel, top bar. */
/* ---------- UI ---------- */
function setSpeed(s) {
  speed = s;
  [0, 1, 3].forEach((v) => $('#sp' + v).setAttribute('aria-pressed', String(v === s)));
}
[0, 1, 3].forEach((v) => ($('#sp' + v).onclick = () => setSpeed(v)));
$('#snd').onclick = () => setSound(!soundOn);
const DEF = { habitat: 'savanna', animal: 'zebra', plant: 'tree', shop: 'food' };
// R or the Turn button: auto-facing first, then the four facings in turn
let landArm = null; // land purchase waiting for its confirming tap
const LAND_ICON = {
  north: '<path d="M12 20V5M6 11l6-6 6 6"/><path d="M4 20h16"/>',
  east: '<path d="M4 12h15M13 6l6 6-6 6"/><path d="M4 4v16"/>',
  west: '<path d="M20 12H5M11 6l-6 6 6 6"/><path d="M20 4v16"/>',
};
function rotateBuild() {
  buildRot = buildRot == null ? 0 : buildRot === 3 ? null : buildRot + 1;
  renderTray();
}
function setTool(t, s) {
  tool = t;
  landArm = null;
  pendingBuild = null;
  sub = s || (sub && validSub(t, sub) ? sub : DEF[t] || null);
  document
    .querySelectorAll('.tool[data-tool]')
    .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  cv.classList.toggle('build', t !== 'look');
  renderTray();
}
function validSub(t, s) {
  return t === 'habitat'
    ? !!BIOMES[s]
    : t === 'animal'
      ? !!SPECIES[s]
      : t === 'plant'
        ? ITEMS[s] && ['plant', 'toy', 'shelter', 'decor'].includes(ITEMS[s].kind)
        : t === 'shop'
          ? ITEMS[s] && (ITEMS[s].kind === 'shop' || ITEMS[s].kind === 'staff')
          : false;
}
// tapping the active tool again closes its tray and goes back to looking around
document
  .querySelectorAll('.tool[data-tool]')
  .forEach((b) => (b.onclick = () => setTool(tool === b.dataset.tool && tool !== 'look' ? 'look' : b.dataset.tool)));
function chip(label, key, extra) {
  return `<button class="chip" data-sub="${key}" aria-pressed="${sub === key}">${extra || ''}${label}</button>`;
}
const TREE_KEYS = Object.keys(ITEMS).filter((k) => ITEMS[k].form === 'tree');
const IT_ICON = {
  tree: '<path d="M12 21v-6"/><path d="M12 15c-4.5 0-7-2.6-7-5.8C5 6 8 3 12 3s7 3 7 6.2C19 12.4 16.5 15 12 15z"/>',
  bush: '<path d="M4 18c-1.5-3 .5-6 3.5-6 0-3 3-4.5 5-3.5 2-2 6-.5 6 2.5 2.5.5 3 4 1.5 7z"/><path d="M3 18h18"/>',
  rock: '<path d="M3 19l3-7 4-3 5 1 3 4 3 5z"/><path d="M10 9l1 5 4-4"/>',
  pond: '<path d="M3 15c2-4 6-6 9-6s7 2 9 6c-2 3-6 4-9 4s-7-1-9-4z"/><path d="M8 15c1.3-.8 2.6-.8 4 0s2.7.8 4 0"/>',
  food: '<path d="M4 10v10h16V10"/><path d="M3 10l2-6h14l2 6z"/><path d="M8 14h8"/>',
  drink: '<path d="M7 4h10l-1.5 16h-7z"/><path d="M7.5 9h9"/><path d="M14 4l2-2"/>',
  bench: '<path d="M3 11h18M3 15h18"/><path d="M5 15v5M19 15v5M5 11V8M19 11V8"/>',
  bin: '<path d="M5 7h14l-1.2 13H6.2z"/><path d="M3 7h18M9 7V4h6v3"/><path d="M10 11v6M14 11v6"/>',
  stage: '<path d="M3 20h18"/><path d="M4 20v-4h16v4M6 16v-4h12v4M8 12V8h8v4"/><path d="M12 8V3l4 1.5L12 6"/>',
};
Object.assign(IT_ICON, {
  lodge: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-5h4v5"/>',
  recycle: '<path d="M7 19H4l3-5M17 19h3l-3-5M9 6l3-3 3 3"/><path d="M12 3v6M7 14l2 3M17 14l-2 3M9 17h6"/>',
  vetclinic: '<rect x="4" y="6" width="16" height="14" rx="2"/><path d="M12 9v8M8 13h8"/>',
});
Object.assign(IT_ICON, {
  station:
    '<path d="M3 17h14l3-4V9H3z"/><path d="M3 9l2-4h12l3 4"/><circle cx="7" cy="18" r="2"/><circle cx="16" cy="18" r="2"/>',
  hayfield: '<path d="M3 20h18M5 20c0-5 1-9 2-12M9 20c0-6 1-10 3-14M13 20c0-5 1-8 3-11M17 20c0-4 1-7 2-9"/>',
  banana: '<path d="M5 15c4 5 11 4 14-4"/><path d="M5 15c3 2 8 2 11-3M19 11l1-2"/>',
  browse: '<path d="M12 21v-8M4 10c2-3 5-4 8-4s6 1 8 4z"/>',
  veg: '<path d="M12 20V10M12 10c-3 0-5-2-5-5 3 0 5 2 5 5zM12 13c3 0 5-2 5-5-3 0-5 2-5 5z"/><path d="M4 20h16"/>',
  fishpond: '<ellipse cx="12" cy="14" rx="9" ry="5"/><path d="M9 14c2-2 4-2 6 0-2 2-4 2-6 0zM15 14l2-1v2z"/>',
  entrance: '<path d="M4 21V8M20 21V8M3 8h18M7 5h10"/><path d="M9 21v-6h6v6"/>',
  dock: '<path d="M2 20h20M4 20V9l8-5 8 5v11"/><path d="M8 20v-6h8v6"/>',
  feedstore: '<path d="M3 21V10l9-6 9 6v11z"/><path d="M9 21v-5h6v5M8 12h8"/>',
  parking: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
  redwood: '<path d="M12 22V9"/><path d="M12 2l-3 5h6zM12 6l-4 5h8zM12 10l-5 6h10z"/>',
  oak: '<path d="M11 21l1-7 1 7"/><path d="M12 14c-6 0-9-2.4-9-5.3S6.5 3.5 12 3.5s9 2.3 9 5.2S18 14 12 14z"/>',
  birch:
    '<path d="M10 21V7M15 21V9"/><path d="M10 11h1M10 15h1M15 13h1"/><circle cx="10" cy="6" r="3"/><circle cx="15" cy="8" r="2.5"/>',
  maple: '<path d="M12 21v-5"/><path d="M12 3l1.5 3.5L17 5l-1 4 4 1-3 3 1 3-6-1-6 1 1-3-3-3 4-1-1-4 3.5 1.5z"/>',
  pine: '<path d="M12 22v-4"/><path d="M12 2l-6 9h3l-4 7h14l-4-7h3z"/>',
  fir: '<path d="M12 22v-4"/><path d="M12 2l-6 9h3l-4 7h14l-4-7h3z"/><path d="M10 6h4"/>',
  cypress: '<path d="M12 22v-3"/><path d="M12 2c-2.5 4-3 9-2 17h4c1-8 .5-13-2-17z"/>',
  willow: '<path d="M12 21V9"/><path d="M4 18c0-7 3.5-11 8-11s8 4 8 11"/><path d="M7 11v6M10 9v7M14 9v7M17 11v6"/>',
  acacia: '<path d="M12 21v-8l-3-3M12 13l3-3"/><path d="M3 9c2-2.5 5.5-3.5 9-3.5S19 6.5 21 9z"/>',
  baobab: '<path d="M8 21c.5-4 .5-8 1-11h6c.5 3 .5 7 1 11z"/><path d="M9 10l-3-4M12 10V5M15 10l3-4"/>',
  palm: '<path d="M12 21c0-5 .5-9 1-12"/><path d="M13 9c-2-3-6-3-8-1M13 9c2-3 6-3 8-1M13 9c-1-3-1-5 0-6"/>',
  bamboo: '<path d="M8 21V4M12 21V2M16 21V5"/><path d="M8 9h1M8 15h1M12 7h1M12 13h1M16 10h1M16 16h1"/>',
  cactus: '<path d="M12 21V4"/><path d="M12 13H8V8M12 11h4V7"/>',
  rockpile: '<path d="M2 20l3-4 3 1 2-4 4 1 2 3 3-1 3 4z"/>',
  spire: '<path d="M9 21l1.5-17L14 6l1 15z"/><path d="M5 21l2-4 2 4"/>',
  slab: '<path d="M2 17l4-4h14l2 4z"/><path d="M2 17h20"/>',
  fern: '<path d="M12 21C12 14 8 9 3 8M12 21c0-7 4-12 9-13M12 21V8"/>',
  tallgrass: '<path d="M6 21c0-6 1-10 3-15M10 21c0-6 0-11 1-17M14 21c0-6 1-11 4-15M18 21c-1-5-2-8-4-11"/>',
});
Object.assign(IT_ICON, {
  pond: IT_ICON.pond,
  ball: '<circle cx="12" cy="12" r="8"/><path d="M4 12h16"/>',
  post: '<path d="M12 3v18M8 21h8"/>',
  climber: '<path d="M5 21V5M19 21V5M5 9h14M5 14h14M5 5h14"/>',
  log: '<circle cx="7" cy="16" r="3"/><circle cx="17" cy="16" r="3"/><circle cx="12" cy="9" r="3"/>',
  ice: '<path d="M6 8l6-4 6 4v8l-6 4-6-4z"/><path d="M6 8l6 4 6-4M12 12v8"/>',
  floater: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="3"/>',
  shade: '<path d="M3 9l9-5 9 5"/><path d="M5 9v12M19 9v12"/>',
  cave: '<path d="M3 20c0-9 4-14 9-14s9 5 9 14z"/><path d="M9 20c0-4 1.3-6 3-6s3 2 3 6"/>',
  stable: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6M9 14l6 6M15 14l-6 6"/>',
  lamp: '<path d="M12 21V8M9 21h6"/><circle cx="12" cy="6" r="3"/>',
  flowers:
    '<circle cx="8" cy="9" r="2.5"/><circle cx="16" cy="9" r="2.5"/><circle cx="12" cy="6" r="2.5"/><path d="M4 18h16M8 12v6M16 12v6M12 9v9"/>',
  statue: '<path d="M7 21h10M8 21v-4h8v4"/><circle cx="12" cy="7" r="3"/><path d="M9 17l1-7h4l1 7"/>',
  fountain: '<path d="M4 18c0 2 3.6 3 8 3s8-1 8-3v-2H4z"/><path d="M12 16V8M9 6c1-2 2-3 3-3s2 1 3 3"/>',
  gazebo: '<path d="M3 9l9-6 9 6z"/><path d="M5 9v11M19 9v11M12 9v11M3 20h18"/>',
  canopy: '<path d="M3 8h18l-2 3H5z"/><path d="M5 11v10M19 11v10"/>',
  restroom:
    '<circle cx="8" cy="6" r="2"/><circle cx="16" cy="6" r="2"/><path d="M6 21v-6l-1-5h6l-1 5v6M16 9v12M14 13h4"/>',
  gift: '<rect x="4" y="9" width="16" height="11"/><path d="M3 9h18v-3H3zM12 6v14"/><path d="M12 6c-2-3-6-2-5 0M12 6c2-3 6-2 5 0"/>',
  restaurant: '<path d="M7 3v8a2 2 0 0 0 4 0V3M9 11v10M16 3c-2 2-2 6 0 8v10"/>',
  atm: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8v4H8zM9 15h6"/>',
  map: '<path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  donation: '<rect x="5" y="9" width="14" height="11" rx="1"/><path d="M10 9V6h4v3M12 13v4M10 15h4"/>',
  playground: '<path d="M4 21V9h7v12M4 9l3.5-5L11 9M11 13l8 8"/>',
  picnic: '<path d="M3 11h18M6 11l-2 8M18 11l2 8M3 15h18"/>',
});
const iconOf = (k) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IT_ICON[k] || ''}</svg>`;
function renderTray() {
  const tr = $('#tray');
  let h = '';
  if (tool === 'look')
    h =
      '<span class="note">Drag to move. Pinch or scroll to zoom. Twist two fingers, right-drag, or use ⟲ ⟳ to rotate. Tap an animal, guest, habitat or building to inspect it.</span>';
  else if (tool === 'path')
    h =
      '<span class="note">Drag to lay path. Footpaths are for guests and staff; roads are for trucks and cars (and staff). Service buildings and parking lots open onto a road that runs to the highway on the south edge. Roads and footpaths never meet: lay one over the other to build a bridge ($300).</span>' +
      Object.entries(PATHS)
        .map(
          ([k, p]) =>
            `<button class="chip" data-path="${k}" aria-pressed="${pathSub === k}"><span class="sw" style="background:${p.sw}"></span><span class="nm2">${p.name}</span><small>${money(p.cost)}</small></button>`
        )
        .join('');
  else if (tool === 'terrain') {
    h =
      '<span class="group">Landscape</span>' +
      [
        ['raise', 'Raise', '<path d="M12 19V5M6 11l6-6 6 6"/>'],
        ['lower', 'Lower', '<path d="M12 5v14M6 13l6 6 6-6"/>'],
        ['smooth', 'Smooth', '<path d="M3 15c3-5 6-5 9 0s6 5 9 0"/>'],
        ['flatten', 'Flatten', '<path d="M3 14h18M7 10h10"/>'],
        ['water', 'Water', '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/>'],
        ['drain', 'Drain', '<path d="M5 19L19 5M12 3c4 5 6 8 6 11"/>'],
      ]
        .map(
          ([k, n, ic]) =>
            `<button class="chip" data-terr="${k}" aria-pressed="${terrSub === k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ic}</svg><span class="nm2">${n}</span></button>`
        )
        .join('') +
      '<span class="group">Brush</span>' +
      [1, 2, 3]
        .map(
          (n) =>
            `<button class="chip" data-brush="${n}" aria-pressed="${brushSize === n}"><span class="nm2">${['Small', 'Medium', 'Large'][n - 1]}</span></button>`
        )
        .join('') +
      '<span class="note">Drag to sculpt. Lower the ground around a habitat for a moat, or paint water for lakes and ponds. Water inside a habitat gives animals a place to drink. Tanks stay level.</span>' +
      '<span class="group">Buy more land</span>' +
      Object.keys(LAND_SIDES)
        .map((k) => {
          const can = canBuyLand(k);
          return `<button class="chip" data-land="${k}" ${can ? '' : 'disabled'} aria-pressed="${landArm === k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${LAND_ICON[k]}</svg><span class="nm2">${landArm === k ? 'Tap to buy' : LAND_SIDES[k].name}</span><small>${can ? money(landPrice(k)) : 'Max size'}</small></button>`;
        })
        .join('') +
      `<span class="note">Your zoo is ${W} × ${H} tiles (about ${Math.round(W * 3)} × ${Math.round(H * 3)} m). Each purchase adds a 16-tile strip of woodland; the entrance road stays on the south side. Land costs more as the zoo grows. Up to 512 × 512.</span>`;
  } else if (tool === 'habitat') {
    h =
      '<span class="group">Shape</span>' +
      [
        ['rect', 'Rectangle'],
        ['paint', 'Paint'],
        ['erase', 'Erase'],
      ]
        .map(
          ([k, n]) =>
            `<button class="chip" data-hm="${k}" aria-pressed="${habMode === k}"><span class="nm2">${n}</span></button>`
        )
        .join('') +
      '<span class="group">Biome</span>' +
      Object.entries(BIOMES)
        .map(([k, b]) =>
          chip(`<span class="nm2">${b.name}</span>`, k, `<span class="sw" style="background:${b.c1}"></span>`)
        )
        .join('') +
      '<span class="sep"></span><span class="group">Fence</span>' +
      Object.entries(FENCES)
        .filter(([k, f]) => !f.hidden)
        .map(
          ([k, f]) =>
            `<button class="chip" data-fence="${k}" aria-pressed="${fenceSub === k}"><span class="sw" style="background:${f.sw}"></span><span class="nm2">${f.name}</span><small>${money(f.cost)}/tile</small></button>`
        )
        .join('') +
      '<span class="note">' +
      {
        rect: 'Drag a rectangle, 3×3 or larger.',
        paint: 'Drag to paint any shape. Painting next to a habitat of the same biome grows it.',
        erase: 'Drag across habitat tiles to remove them.',
      }[habMode] +
      ' Staff get in through an animal house on the fence (Shops → Staff).' +
      (sub === 'pool' ? ' Aquatic habitats are glass tanks.' : '') +
      (fenceSub === 'moat' ? ' A dry moat is a sunken wall: nothing gets out and guests get a clear view.' : '') +
      '</span>';
  } else if (tool === 'animal') {
    for (const [bk, b] of Object.entries(BIOMES)) {
      h += `<span class="group">${b.name}</span>`;
      for (const [k, s] of Object.entries(SPECIES))
        if (s.biome === bk) {
          const ul = unlocked(k);
          h += ul
            ? chip(
                `<span class="nm2">${s.name}</span><small>${money(s.cost)}</small>`,
                k,
                `<span class="em">${s.e}</span>`
              )
            : `<button class="chip locked" data-sub="${k}" aria-pressed="${sub === k}" title="Unlocks at tier ${tierOf(k)}"><span class="em">${s.e}</span><span class="nm2">${s.name}</span><small>Tier ${tierOf(k)}</small></button>`;
        }
    }
  } else if (tool === 'plant') {
    h =
      '<span class="group">Animal care</span>' +
      ['pond', 'ball', 'post', 'climber', 'log', 'ice', 'floater', 'shade', 'cave', 'stable']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="group">Trees</span>' +
      TREE_KEYS.map((k) =>
        chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
      ).join('') +
      '<span class="group">Rocks &amp; shrubs</span>' +
      ['rock', 'rockpile', 'spire', 'slab', 'bush', 'fern', 'tallgrass']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="group">Decorations</span>' +
      ['flowers', 'lamp', 'statue', 'fountain', 'gazebo', 'canopy']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="note">Toys, shelters and water holes go inside habitats. Each species has a favourite toy and shelter: tap a habitat to see what is missing. Decorations make paths more pleasant.</span>';
  } else if (false) {
    h =
      '<span class="note">New habitats start bare. Plants and water holes make them comfortable, and plants along paths please guests.</span>' +
      ['tree', 'bush', 'rock', 'pond']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('');
  } else if (tool === 'shop') {
    h =
      '<span class="group">Food and rest</span>' +
      ['food', 'drink', 'restaurant', 'bench', 'picnic', 'bin']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="group">Guest services</span>' +
      ['restroom', 'parking', 'gift', 'atm', 'map', 'donation', 'playground', 'stage', 'station']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="group">For staff</span>' +
      ['entrance', 'animalhouse', 'recycle', 'lodge', 'vetclinic', 'dock', 'feedstore']
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      '<span class="group">Farms</span>' +
      Object.keys(FARMS)
        .map((k) =>
          chip(`<span class="nm2">${ITEMS[k].name}</span><small>${money(ITEMS[k].cost)}</small>`, k, iconOf(k))
        )
        .join('') +
      `<span class="note">${ITEMS[sub] && ITEMS[sub].help ? ITEMS[sub].help + ' ' : ''}Everything here has to touch a path.</span>`;
  } else if (tool === 'bulldoze')
    h = '<span class="note">Tap something to remove it. You get half the cost back.</span>';
  // buildings bigger than a tile: show the size and a rotate button
  if ((tool === 'shop' || tool === 'plant') && ITEMS[sub] && ITEMS[sub].size)
    h +=
      `<span class="note fp">${ITEMS[sub].name}: ${ITEMS[sub].size[0]}×${ITEMS[sub].size[1]} tiles (about ${ITEMS[sub].size[0] * 3}×${ITEMS[sub].size[1] * 3} m). ` +
      `<button class="btn small" id="rotB">⟳ Turn${buildRot == null ? ' (auto)' : ''}</button></span>`;
  if (tool !== 'look')
    h = '<button class="tray-close" id="trayClose" title="Close (Esc)" aria-label="Close this menu">✕</button>' + h;
  tr.innerHTML = h;
  if ($('#trayClose')) $('#trayClose').onclick = () => setTool('look');
  if ($('#rotB')) $('#rotB').onclick = rotateBuild;
  tr.querySelectorAll('.chip').forEach(
    (c) =>
      (c.onclick = () => {
        const d = c.dataset;
        if (d.path) pathSub = d.path;
        else if (d.fence) fenceSub = d.fence;
        else if (d.hm) habMode = d.hm;
        else if (d.terr) terrSub = d.terr;
        else if (d.land) {
          // two taps: the first shows "Tap to buy", the second buys
          if (landArm === d.land) {
            landArm = null;
            buyLand(d.land);
          } else landArm = d.land;
        } else if (d.brush) brushSize = +d.brush;
        else sub = d.sub;
        renderTray();
      })
  );
  const on = tr.querySelector('[aria-pressed="true"]');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
let toastT = [];
function toast(msg, kind) {
  if (kind) sfx(kind);
  const tk = $('#ticker');
  if (tk) tk.textContent = msg;
  const el = document.createElement('div');
  el.className = 't' + (kind ? ' ' + kind : '');
  el.textContent = msg;
  const box = $('#toast');
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => el.remove(), kind === 'bad' ? 3200 : 4200);
}
function meter(v, col) {
  const c = col || (v >= 65 ? 'var(--good)' : v >= 40 ? 'var(--warn)' : 'var(--bad)');
  return `<div class="meter"><i style="width:${clamp(v, 0, 100)}%;background:${c}"></i></div>`;
}
function inspectAt(tt) {
  // staff first, then guests
  let sb = null,
    sd = 0.7 * T;
  for (const st of S.staff) {
    const d = Math.hypot(st.x * T - tt.wx, st.y * T - tt.wy);
    if (d < sd && st.st !== 'rest') {
      sd = d;
      sb = st;
    }
  }
  if (sb) {
    sel = { type: 'staff', id: sb.id };
    renderInspector();
    return;
  }
  let best = null,
    bd = 0.7 * T;
  for (const g of S.guests) {
    const gx = (g.fx + (g.x - g.fx) * Math.min(1, g.p)) * T + T / 2 + (hsh(g.id, 1) - 0.5) * 14,
      gy = (g.fy + (g.y - g.fy) * Math.min(1, g.p)) * T + T / 2 + (hsh(g.id, 2) - 0.5) * 12 - 2;
    const d = Math.hypot(gx - tt.wx, gy - tt.wy);
    if (d < bd) {
      bd = d;
      best = g;
    }
  }
  if (best) {
    sel = { type: 'guest', id: best.id };
    renderInspector();
    return;
  }
  let an = null,
    ad = 0.65 * T;
  for (const a of S.animals) {
    if (a.away || a.inside != null) continue; // not out in the habitat
    const d = Math.hypot(a.x * T - tt.wx, a.y * T - tt.wy);
    if (d < ad) {
      ad = d;
      an = a;
    }
  }
  if (an) {
    sel = { type: 'animal', id: an.id };
    renderInspector();
    return;
  }
  if (inB(tt.x, tt.y) && tileAt(tt.x, tt.y).o && BUILDING_KINDS.has(ITEMS[tileAt(tt.x, tt.y).o].kind)) {
    sel = { type: 'bld', id: anchorOf(idx(tt.x, tt.y)) };
    bldArm = false;
    renderInspector();
    return;
  }
  if (inB(tt.x, tt.y) && tileAt(tt.x, tt.y).e) {
    sel = { type: 'encl', id: tileAt(tt.x, tt.y).e };
    renderInspector();
    return;
  }
  closeInspector();
}
function closeInspector() {
  sel = null;
  $('#inspector').hidden = true;
}
function renderInspector() {
  const box = $('#inspector');
  if (!sel) {
    box.hidden = true;
    return;
  }
  if (sel.type === 'encl') {
    const e = F.emap[sel.id];
    if (!e) {
      closeInspector();
      return;
    }
    const list = S.animals.filter((a) => a.e === e.id),
      st = enclStats(e);
    const need = list.reduce((s, a) => s + SPECIES[a.sp].space, 0);
    let rows = '';
    for (const k of new Set(list.map((a) => a.sp))) {
      const g = list.filter((a) => a.sp === k),
        sp = SPECIES[k],
        avg = g.reduce((s, a) => s + a.happy, 0) / g.length;
      const why = [...new Set(g.flatMap((a) => a.why))];
      rows += `<div class="row"><span class="em">${sp.e}</span><b>${g.length > 1 ? g.length + ' ' + sp.pl : sp.name} · ${Math.round(avg)}% happy</b><div>${meter(avg)}<div class="why ${why.length ? '' : 'ok'}">${why.length ? cap(why.join(', ')) : 'Content'}</div><div class="names">${g.map((a) => `<button class="nm${a.sick ? ' sk' : ''}" data-a="${a.id}">${a.name}</button>`).join('')}</div></div></div>`;
    }
    if (!list.length) rows = '<p class="help">No animals yet. Choose Add animals, then tap inside this habitat.</p>';
    const hungry = list.filter((a) => a.hunger > 20).length;
    box.innerHTML = `<button class="x" aria-label="Close" id="ix">×</button>
      <h2>${BIOMES[e.biome].name} habitat</h2>
      <div class="sub">${e.barrier ? 'Split by a predator barrier · ' : ''}${encTiles(e).length} tiles · space used ${need}/${st.area} · ${st.plants} plant${st.plants === 1 ? '' : 's'}${adjacentToPath(e) ? '' : ' · <span style="color:var(--bad)">no path alongside</span>'}</div>
      ${(() => {
        const cl = careList(e);
        return cl.length
          ? `<ul class="req" style="margin-top:10px">${cl.map((c) => `<li class="${c.ok ? 'ok' : ''}">${c.ok ? '✓' : '○'} ${c.txt}</li>`).join('')}</ul>`
          : '';
      })()}
      ${unreachable(e) ? `<div class="thought" style="border-color:var(--bad)"><b style="color:var(--bad)">No animal house.</b> Keepers and vets cannot get in, and the animals have nowhere to sleep. Build an Animal house (Shops → Staff) with its back wall on this fence, its door on a road and a footpath nearby.</div>` : ''}
      ${keeperLine(e)}
      ${e.biome !== 'pool' ? `<div class="need"><span>Fence</span>${meter(e.cond ?? 100)}</div>` : ''}
      <div class="need"><span>Cleanliness</span>${meter(100 - (e.dirt || 0))}</div>
      <div class="rows">${rows}</div>
      <div class="btns"><button class="btn primary" id="iAdd">Add animals</button><button class="btn" id="iCare">Add care items</button>${e.biome !== 'pool' && (e.cond ?? 100) < 90 ? `<button class="btn" id="iFix">Repair fence · ${money((F.eedges[e.id] || []).length * 4)}</button>` : ''}${e.barrier ? '' : `<button class="btn" id="iBar">Predator barrier · ${money(BARRIER_COST)}</button>`}${(e.dirt || 0) > 10 ? `<button class="btn" id="iClean">Clean · $20</button>` : ''}${list.length ? `<button class="btn" id="iFeed" ${hungry ? '' : 'disabled'}>Feed now · ${money(hungry * FEED_COST)}</button>` : ''}<button class="btn" id="iPlant">Add plants</button></div>`;
    const bb = $('#iBar');
    if (bb)
      bb.onclick = () => {
        if (spend(BARRIER_COST, 'a predator barrier')) {
          e.barrier = true;
          dirty = true;
          evalEncl(e);
          toast('Barrier installed. Predators and prey now live on separate sides.', 'good');
          renderInspector();
        }
      };
    $('#iCare').onclick = () => {
      const miss = careList(e).find((c) => !c.ok && c.item);
      setTool('plant', miss ? miss.item : e.biome === 'pool' ? 'floater' : 'pond');
    };
    const fx = $('#iFix');
    if (fx)
      fx.onclick = () => {
        const cst = (F.eedges[e.id] || []).length * 4;
        if (spend(cst, 'fence repairs')) {
          e.cond = 100;
          S.today.run += cst;
          evalEncl(e);
          renderInspector();
        }
      };
    $('#iAdd').onclick = () => {
      const first = Object.keys(SPECIES).find((k) => SPECIES[k].biome === e.biome);
      setTool('animal', validSub('animal', sub) && SPECIES[sub].biome === e.biome ? sub : first);
    };
    $('#iPlant').onclick = () => setTool('plant', 'tree');
    const cb = $('#iClean');
    if (cb)
      cb.onclick = () => {
        if (spend(20, 'cleaning')) {
          e.dirt = 0;
          S.today.run += 20;
          evalEncl(e);
          renderInspector();
        }
      };
    box.querySelectorAll('.nm').forEach(
      (b) =>
        (b.onclick = () => {
          sel = { type: 'animal', id: +b.dataset.a };
          renderInspector();
        })
    );
    const fb = $('#iFeed');
    if (fb)
      fb.onclick = () => {
        const n = list.filter((a) => a.hunger > 20);
        if (spend(n.length * FEED_COST, 'feeding')) {
          n.forEach((a) => (a.hunger = 0));
          S.today.run += n.length * FEED_COST;
          evalEncl(e);
          toast(`Fed ${n.length} animal${n.length > 1 ? 's' : ''}.`);
          renderInspector();
        }
      };
  } else if (sel.type === 'bld') {
    renderBuildingInspector(box, sel.id);
  } else if (sel.type === 'staff') {
    const st = S.staff.find((o) => o.id === sel.id);
    if (!st) {
      closeInspector();
      return;
    }
    renderStaffInspector(box, st);
  } else if (sel.type === 'animal') {
    const a = S.animals.find((o) => o.id === sel.id);
    if (!a) {
      closeInspector();
      return;
    }
    const sp = SPECIES[a.sp],
      e = F.emap[a.e],
      age = S.day - a.born;
    box.innerHTML = `<button class="x" aria-label="Close" id="ix">×</button>
      <h2>${sp.e} ${a.name}</h2>
      <div class="sub">${sp.name} · ${age < 1 ? 'arrived this month' : age + ' month' + (age > 1 ? 's' : '') + ' at the zoo'} · ${BIOMES[e.biome].name.toLowerCase()} habitat</div>
      <div class="thought">${animalStatus(a)}${a.sick && !a.away && !a.transport ? `<span style="color:var(--bad)">${a.serious ? 'Seriously ill.' : 'Sick.'}</span> ${staffCount('vet') ? (a.serious ? 'A vet will examine them, then call the ambulance.' : 'A vet will treat them soon.') : 'No vet on staff.'} ` : ''}${a.why.length ? cap(a.why.join(', ')) + '.' : 'Healthy and content.'}</div>
      <div class="need"><span>Happiness</span>${meter(a.happy)}<span>Health</span>${meter(a.health)}<span>Fullness</span>${meter(100 - a.hunger)}</div>
      ${a.escaped ? `<div class="thought" style="border-color:var(--bad)"><b style="color:var(--bad)">Escaped!</b> ${a.name} is loose in the park and scaring guests.</div>` : ''}
      <div class="kv"><span>Diet</span><span>${DIET[care(a.sp).diet].name}</span><span>Favourite toy</span><span>${care(a.sp).toy ? ITEMS[care(a.sp).toy].name : 'None'}</span><span>Shelter</span><span>${care(a.sp).shelter ? ITEMS[care(a.sp).shelter].name : 'None needed'}</span>
        <span>In the wild</span><span>${GUIDE[a.sp] ? GUIDE[a.sp][0] : '–'}</span>${a.parents ? `<span>Parents</span><span>${a.parents.join(' & ')}</span>` : ''}</div>
      ${GUIDE[a.sp] ? `<p class="help">${GUIDE[a.sp][1]}</p>` : ''}
      <div class="kv"><span>Needs</span><span>${sp.space} tiles · ${Math.round(sp.fol * 100)}% plants</span><span>Guest appeal</span><span>${sp.appeal}/10</span><span>Temperament</span><span>${sp.pred ? 'Predator' : 'Prey'} · ${sp.social ? 'social' : 'solitary'}</span></div>
      <div class="btns">${a.escaped ? `<button class="btn primary" id="aCatch">Recapture · $250</button>` : ''}<button class="btn" id="aFeed" ${a.hunger > 5 ? '' : 'disabled'}>Feed · ${money(DIET[care(a.sp).diet].cost)}</button>${a.sick && !a.away && !a.transport ? `<button class="btn primary" id="aTreat">Call a vet · ${money(TREAT_COST * 2)}</button>` : ''}<button class="btn" id="aHab">View habitat</button><button class="btn danger" id="aSell">${sellArm === a.id ? 'Tap again to sell' : 'Sell · ' + money(sp.cost / 2)}</button></div>`;
    $('#aFeed').onclick = () => {
      const fc = DIET[care(a.sp).diet].cost;
      if (spend(fc, 'feeding')) {
        a.hunger = 0;
        S.today.run += fc;
        evalEncl(e);
        renderInspector();
      }
    };
    const ac = $('#aCatch');
    if (ac)
      ac.onclick = () => {
        if (spend(250, 'a recapture team')) {
          recapture(a);
          S.today.run += 250;
          toast(`${a.name} is safely back in the habitat.`, 'good');
          renderInspector();
        }
      };
    const tb = $('#aTreat');
    if (tb)
      tb.onclick = () => {
        if (spend(TREAT_COST * 2, 'a vet visit')) {
          a.sick = a.serious = false;
          a.health = Math.min(100, a.health + 30);
          S.today.run += TREAT_COST * 2;
          evalEncl(e);
          toast(`${a.name} is on the mend.`, 'good');
          renderInspector();
        }
      };
    $('#aHab').onclick = () => {
      sel = { type: 'encl', id: e.id };
      renderInspector();
    };
    $('#aSell').onclick = () => {
      if (sellArm !== a.id) {
        sellArm = a.id;
        renderInspector();
        return;
      }
      sellArm = null;
      S.money += Math.round(sp.cost / 2);
      S.animals = S.animals.filter((o) => o.id !== a.id);
      evalEncl(e);
      toast(`${a.name} went to another zoo for ${money(sp.cost / 2)}.`);
      closeInspector();
    };
  } else {
    const g = S.guests.find((o) => o.id === sel.id);
    if (!g) {
      closeInspector();
      return;
    }
    box.innerHTML = `<button class="x" aria-label="Close" id="ix">×</button>
      <h2>${g.name}</h2><div class="sub">${g.mode === 'leave' ? 'Heading for the exit' : g.mode === 'rest' ? 'Resting on a bench' : 'Exploring'} · spent ${money(g.spent)} · seen ${g.seen.length} habitat${g.seen.length === 1 ? '' : 's'}</div>
      <div class="thought">“${g.thought}”</div>
      <div class="need"><span>Happiness</span>${meter(g.h)}<span>Fullness</span>${meter(100 - g.hunger)}<span>Thirst</span>${meter(100 - g.thirst)}<span>Energy</span>${meter(g.energy)}</div>`;
  }
  $('#ix').onclick = closeInspector;
  box.hidden = false;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function toggleZoo() {
  const p = $('#zooPanel');
  p.hidden = !p.hidden;
  if (!p.hidden) renderZoo();
  syncZooBtn();
}
function syncZooBtn() {
  $('#zooBtn').setAttribute('aria-pressed', String(!$('#zooPanel').hidden));
}
$('#zooBtn').onclick = toggleZoo;
let confirmNew = false;
function renderZoo() {
  const p = $('#zooPanel');
  if (p.hidden) return;
  const ah = S.animals.length ? Math.round(S.animals.reduce((s, a) => s + a.happy, 0) / S.animals.length) : 0;
  const gh = S.guests.length ? Math.round(S.guests.reduce((s, g) => s + g.h, 0) / S.guests.length) : 0;
  const focus = document.activeElement && document.activeElement.id;
  if (p.dataset.built) {
    $('#zAdm').textContent = money(S.admission);
    $('#zTier').innerHTML = tierHTML();
    refreshStaffPanel();
    $('#zLed').innerHTML = ledgerHTML();
    $('#zAw').innerHTML = awardsHTML();
    renderResearch();
    $('#zStats').innerHTML = statsHTML(ah, gh);
    // only when it changed: replacing buttons under a finger loses the tap
    const nh = newHTML();
    if ($('#zNew').dataset.html !== nh) {
      $('#zNew').innerHTML = $('#zNew').dataset.html = nh;
      bindNew();
    }
    return;
  }
  p.dataset.built = '1';
  p.innerHTML = `<button class="x" aria-label="Close" id="zx">×</button>
   <h2>Zoo office</h2><div class="sub">Progress saves on this device</div>
   <div class="kv" id="zStats">${statsHTML(ah, gh)}</div>
   <div class="sec"><h3>Admission</h3><div class="adm"><span>Ticket price</span><b id="zAdm">${money(S.admission)}</b></div>
     <input type="range" id="zAdmR" min="0" max="60" step="1" value="${S.admission}" aria-label="Ticket price">
     <p class="help">Cheaper tickets bring more guests. Above $30, guests start to grumble about the price.</p></div>
   <div class="sec"><h3>Zoo progress</h3><div id="zTier">${tierHTML()}</div></div>
   <div class="sec" id="zStaff">${staffPanelHTML()}</div>
   <div class="sec"><h3>Concession prices</h3>
     <div class="adm"><span>Snack</span><b id="zPF">${money(S.prices.food)}</b></div><input type="range" id="zPFR" min="1" max="20" value="${S.prices.food}" aria-label="Snack price">
     <div class="adm" style="margin-top:8px"><span>Drink</span><b id="zPD">${money(S.prices.drink)}</b></div><input type="range" id="zPDR" min="1" max="12" value="${S.prices.drink}" aria-label="Drink price">
     <p class="help">Fair prices are about ${money(BASE_PRICE.food)} and ${money(BASE_PRICE.drink)}. Charge more and fewer hungry guests will buy.</p></div>
   <div class="sec"><h3>Research</h3><div id="zRes"></div></div>
   <div class="sec"><h3>Zoo awards</h3><div id="zAw">${awardsHTML()}</div></div>
   <div class="sec"><h3>Recent months</h3><div id="zLed">${ledgerHTML()}</div></div>
   <div class="sec"><h3>Tips</h3><p class="help">Run paths alongside every habitat so guests can see in. Match plants and space to each species, keep predators away from prey unless the habitat has a predator barrier, and place snack stands, drink carts, benches and bins along busy paths. Staff need somewhere to work: a recycling yard for janitors, a keeper lodge plus a recycling yard for zookeepers, and a vet clinic for vets. Every land habitat needs an animal house on its fence: the animals sleep there at night, keepers and vets go in through it, and the animal ambulance loads at its door, so give it a road. Roads and footpaths never meet at grade: keep guest paths in the middle and service roads around the outside, or lay one over the other to build a bridge (whichever you lay second goes on top). Hire more staff as the zoo grows, and keep their pay fair. Dirty or unhappy habitats breed illness, and untreated sick animals can die. Happy pairs may have babies at the end of a month. For aquatic exhibits, build an Aquatic habitat, run a glass tunnel through it, and put a show stadium beside it so dolphins, sea lions and orcas can perform.</p></div>
   <div class="sec"><h3>Settings</h3><label class="toggle"><input type="checkbox" id="zNight" ${S.nightOff ? '' : 'checked'}> Day and night <span class="help">Animals sleep in their night shelters after dark, and fewer visitors come.</span></label></div>
   <div class="sec"><h3>Saved zoos</h3><p class="help" style="margin-top:0">Your zoo also saves itself every few seconds. Keep extra copies here to try ideas or run more than one zoo.</p><div id="zSlots" class="slots">Loading…</div></div>
   <div class="sec" id="zNew">${newHTML()}</div>`;
  $('#zx').onclick = toggleZoo;
  $('#zAdmR').oninput = (e) => {
    S.admission = +e.target.value;
    $('#zAdm').textContent = money(S.admission);
  };
  $('#zPFR').oninput = (e) => {
    S.prices.food = +e.target.value;
    $('#zPF').textContent = money(S.prices.food);
  };
  $('#zPDR').oninput = (e) => {
    S.prices.drink = +e.target.value;
    $('#zPD').textContent = money(S.prices.drink);
  };
  bindStaffPanel();
  bindNew();
  refreshSlots();
  $('#zNight').onchange = (ev) => {
    S.nightOff = !ev.target.checked;
    if (S.nightOff) for (const a of S.animals) (a.inside = null), (a.sleep = false);
    toast(S.nightOff ? 'Day and night is off: it stays daytime.' : 'Day and night is on.');
  };
  renderResearch();
}
/* save slots: tap Save or Load, then tap again to confirm when it would overwrite something */
let slotArm = null; // 'save1', 'load2', …
async function refreshSlots() {
  const box = $('#zSlots');
  if (!box) return;
  const list = await slotList();
  box.innerHTML = list
    .map(({ n, t, info }) => {
      const desc = info
        ? `<b>${info.date}</b> · ${MODES[info.mode] ? MODES[info.mode].name : 'Standard'} · ${info.mode === 'sandbox' ? 'unlimited money' : money(info.money)} · ${info.animals} animals · ${info.size}<br><span class="help">Saved ${new Date(t).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>`
        : '<span class="help">Empty</span>';
      const sv = slotArm === 'save' + n ? 'Tap again to overwrite' : 'Save here';
      const ld = slotArm === 'load' + n ? 'Tap again · current zoo is replaced' : 'Load';
      return `<div class="slot"><div class="slotN">${n}</div><div class="slotI">${desc}</div><div class="slotB"><button class="btn small" data-save="${n}">${sv}</button>${info ? `<button class="btn small" data-load="${n}">${ld}</button>` : ''}</div></div>`;
    })
    .join('');
  box.querySelectorAll('[data-save]').forEach((b) => {
    b.onclick = async () => {
      const n = +b.dataset.save,
        used = list[n - 1].info;
      if (used && slotArm !== 'save' + n) {
        slotArm = 'save' + n;
        return refreshSlots();
      }
      slotArm = null;
      try {
        await saveSlot(n);
        toast(`Zoo saved to slot ${n}.`, 'good');
      } catch (e) {
        toast('That zoo is too big to save in this browser.', 'bad');
      }
      refreshSlots();
    };
  });
  box.querySelectorAll('[data-load]').forEach((b) => {
    b.onclick = async () => {
      const n = +b.dataset.load;
      if (slotArm !== 'load' + n) {
        slotArm = 'load' + n;
        return refreshSlots();
      }
      slotArm = null;
      if (!(await loadSlot(n))) return toast('That save could not be read.', 'bad');
      closeInspector();
      centerCam();
      delete $('#zooPanel').dataset.built;
      renderZoo();
      toast(`Loaded slot ${n}: ${dateOf(S.day)}, ${money(S.money)} in the bank.`, 'good');
    };
  });
}
function tierHTML() {
  const cur = TIERS[(S.tier || 1) - 1],
    next = TIERS[S.tier || 1];
  let h = `<div class="tierNow">Tier ${cur.n}: <b>${cur.name}</b> · ${MODES[S.mode || 'standard'].name} mode</div>`;
  if (S.mode === 'challenge') {
    const left = challengeLeft();
    h +=
      S.challenge === 'won'
        ? '<div class="help" style="color:var(--good)"><b>Challenge complete.</b></div>'
        : S.challenge === 'lost'
          ? '<div class="help">The 5-year deadline has passed. Play on freely.</div>'
          : `<div class="help"><b>Goal:</b> reach World-class zoo · ${Math.floor(left / 12)} years ${left % 12} months left</div>`;
  }
  if (next) {
    h +=
      `<div class="help" style="margin:6px 0 4px">To reach <b>${next.name}</b> and unlock ${next.sp.map((k) => SPECIES[k].pl.toLowerCase()).join(', ')}:</div><ul class="req">` +
      tierReq(next)
        .map((r) => `<li class="${r.ok ? 'ok' : ''}">${r.ok ? '✓' : '○'} ${r.txt}</li>`)
        .join('') +
      '</ul>';
  } else h += '<div class="help">Every animal is unlocked.</div>';
  return h;
}
function statsHTML(ah, gh) {
  return `<span>Guests in the zoo</span><span>${S.guests.length}</span>
    <span>Visitors this month</span><span>${S.today.vis}</span>
    <span>Animal feed</span><span>${feedByTruck() ? `${Math.floor(S.feed)} / ${feedCapacity()} meals in store${S.trucks.length ? ' · truck on the way' : ''}${S.crates.length ? ` · ${S.crates.length} crates at the dock` : ''}` : 'Couriered (build a loading dock and feed store to buy in bulk)'}</span>
    <span>Shop stock</span><span>${(() => {
      const sh = stockedShops(),
        low = sh.filter((a) => stockShare(a) < 0.25).length,
        out = sh.filter((a) => stockOf(a) <= 0).length;
      return sh.length
        ? `${out ? `<b style="color:var(--bad)">${out} sold out</b> · ` : ''}${low} of ${sh.length} running low · ${F.cnt.dock ? 'restocked by delivery' : 'restocked by courier'}`
        : 'No shops yet';
    })()}</span>
    <span>Farms</span><span>${(() => {
      const f = farmTiles();
      return f.length
        ? `${f.length} farm${f.length > 1 ? 's' : ''} · ${ripeFarms().length} ready to harvest · upkeep ${money(farmUpkeep())}/month`
        : 'None yet (grow your own feed with a feed store and haulers)';
    })()}</span>
    <span>Trash</span><span>${F.cnt.recycle ? `${S.waste} / ${wasteCapacity()} bags at the recycling yard${S.trucks.some((t) => t.type === 'garbage') ? ' · garbage truck on the way' : ''}` : 'No recycling yard'}</span>
    <span>Parking</span><span>${carsParked()} / ${parkingSpaces()} cars${S.today.turned ? ` · <b style="color:var(--bad)">${S.today.turned} turned away</b>` : ''}</span>
    <span>Earned this month</span><span>${money(S.today.inc)}</span>
    <span>Tickets / shops</span><span>${money(S.today.adm || 0)} / ${money(S.today.shop || 0)}</span>
    <span>Running costs this month</span><span>${money(S.today.run)}</span>
    <span>Animals</span><span>${S.animals.length}</span>
    <span>Sick animals</span><span>${S.animals.filter((a) => a.sick).length}</span>
    <span>Dirtiest habitat</span><span>${S.encl.length ? Math.round(Math.max(...S.encl.map((e) => e.dirt || 0))) + '% dirty' : '–'}</span>
    <span>Animal happiness</span><span>${S.animals.length ? ah + '%' : '–'}</span>
    <span>Guest happiness</span><span>${S.guests.length ? gh + '%' : '–'}</span>
    <span>Expected guests/month</span><span>${Math.round((spawnRate() * DAY) / TPS)}</span>`;
}
/* research: the project in progress with its progress bar, then the choices */
let resHTML = '';
function renderResearch() {
  const box = $('#zRes');
  if (!box) return;
  const cur = S.res && RESEARCH[S.res.id];
  const rows = Object.entries(RESEARCH)
    .map(([id, r]) => {
      const done = researched(id),
        running = S.res && S.res.id === id;
      const btn = done
        ? '<span class="resDone">✓ Done</span>'
        : running
          ? ''
          : `<button class="btn small" data-res="${id}" ${S.res ? 'disabled' : ''}>${money(r.cost)} · ${r.months} mo</button>`;
      return `<div class="resRow${done ? ' done' : ''}"><div><b>${r.name}</b><br><small>${r.does}</small></div>${btn}</div>`;
    })
    .join('');
  const h =
    (cur
      ? `<div class="resNow"><div><b>Researching ${cur.name}</b> · ${Math.round(researchShare() * 100)}%</div>${meter(researchShare() * 100, 'var(--good)')}<button class="btn small" id="resStop">Stop</button></div>`
      : '<p class="help" style="margin-top:0">Fund one project at a time. Each takes a few months and lasts for good.</p>') +
    `<div class="resList">${rows}</div>`;
  if (h === resHTML) return; // unchanged: keep buttons steady under the player's finger
  resHTML = h;
  box.innerHTML = h;
  box.querySelectorAll('[data-res]').forEach((b) => {
    b.onclick = () => {
      if (startResearch(b.dataset.res)) toast(`Research started: ${RESEARCH[b.dataset.res].name}.`, 'good');
      renderResearch();
    };
  });
  const st = $('#resStop');
  if (st)
    st.onclick = () => {
      cancelResearch();
      toast('Research stopped. The money already spent is not refunded.');
      renderResearch();
    };
}
// where an animal is when it isn't simply out in its habitat
function animalStatus(a) {
  if (a.away === 'clinic')
    return `<b>In surgery at the vet clinic</b> (${Math.max(0, Math.round((1 - a.surg / SURGERY_TICKS) * 100))}% done). `;
  if (a.away === 'transit') return '<b>On the animal ambulance.</b> ';
  if (a.transport) return '<b>Waiting for the animal ambulance.</b> ';
  if (a.inside != null) return '<b>Asleep in the night shelter.</b> ';
  if (a.sleep) return '<b>Asleep.</b> ';
  return '';
}
// this year's standing against each award, and the trophies won so far
function awardsHTML() {
  const y = { ...yearRec() },
    left = 12 - ((S.day - 1) % 12);
  y.animals = S.animals.length;
  y.species = new Set(S.animals.map((a) => a.sp)).size;
  const won = S.awards || [];
  const shelf = won.length
    ? `<div class="trophies">${won
        .slice()
        .reverse()
        .map((w) => {
          const a = AWARDS.find((k) => k.id === w.id);
          return `<div class="trophy"><span class="cup">🏆</span><div><b>${a ? a.name : w.id}</b><br><small>Year ${w.year} · ${w.why}</small></div></div>`;
        })
        .join('')}</div>`
    : '';
  const track = y.n
    ? `<ul class="req">${AWARDS.map((a) => `<li class="${a.won(y) ? 'ok' : ''}">${a.won(y) ? '✓' : '○'} ${a.name} <small>· ${money(a.prize)}</small></li>`).join('')}</ul>`
    : '<p class="help" style="margin:0">The judges start keeping score when your first month closes.</p>';
  return `<p class="help" style="margin-top:0">Awards are judged when December closes (${left} month${left === 1 ? '' : 's'} to go). Each pays prize money and brings ${Math.round(AWARD_FAME * 100)}% more visitors through the next year.${S.fame ? ` <b>Last year’s ${S.fame} award${S.fame > 1 ? 's are' : ' is'} drawing ${Math.round(AWARD_FAME * 100 * S.fame)}% more visitors.</b>` : ''}</p>
    <div class="help" style="margin-bottom:4px">On track this year:</div>${track}${shelf}`;
}
function ledgerHTML() {
  if (!S.ledger.length)
    return '<p class="help" style="margin:0">Your first monthly report appears when January closes.</p>';
  return `<div class="tbl"><table><thead><tr><th>Month</th><th>Visitors</th><th>Tickets</th><th>Shops</th><th>Costs</th><th>Net</th></tr></thead><tbody>${S.ledger
    .slice()
    .reverse()
    .map((r) => {
      const net = r.adm + r.shop - r.run;
      return `<tr><td>${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][(r.day - 1) % 12]} Y${Math.floor((r.day - 1) / 12) + 1}</td><td>${r.vis}</td><td>${money(r.adm)}</td><td>${money(r.shop)}</td><td>${money(r.run)}</td><td class="${net < 0 ? 'neg' : 'pos'}">${money(net)}</td></tr>`;
    })
    .join('')}</tbody></table></div>`;
}
function newHTML() {
  return confirmNew
    ? `<h3>Start a new zoo</h3><p class="help">This replaces your current zoo. Save it to a slot above first if you want to keep it.</p>
       <div class="modes">${Object.entries(MODES)
         .map(([k, m]) => `<button class="mode" data-mode="${k}"><b>${m.name}</b><span>${m.blurb}</span></button>`)
         .join('')}</div>
       <div class="btns"><button class="btn" id="zNo">Keep my zoo</button></div>`
    : `<div class="btns" style="margin-top:0"><button class="btn danger" id="zReset">Start a new zoo</button></div>`;
}
function bindNew() {
  const r = $('#zReset');
  if (r)
    r.onclick = () => {
      confirmNew = true;
      $('#zNew').innerHTML = $('#zNew').dataset.html = newHTML();
      bindNew();
    };
  document.querySelectorAll('#zNew [data-mode]').forEach((y) => {
    y.onclick = () => {
      const mode = y.dataset.mode;
      confirmNew = false;
      delete $('#zooPanel').dataset.built;
      newZoo(undefined, undefined, mode);
      rebuild();
      closeInspector();
      centerCam();
      save();
      renderZoo();
      toast(
        mode === 'challenge'
          ? 'Challenge accepted: $75,000 and five years to build a world-class zoo. Good luck!'
          : mode === 'sandbox'
            ? 'Sandbox: money is no object, and every animal is available.'
            : 'A fresh plot of land. Good luck!',
        'good'
      );
      if (tool === 'animal') renderTray();
    };
  });
  const n = $('#zNo');
  if (n)
    n.onclick = () => {
      confirmNew = false;
      $('#zNew').innerHTML = $('#zNew').dataset.html = newHTML();
      bindNew();
    };
}
function stars(r) {
  const s = clamp(Math.round((r / 20) * 2) / 2, 0, 5);
  let o = '';
  for (let i = 1; i <= 5; i++) o += s >= i ? '★' : s >= i - 0.5 ? '⯪' : '☆';
  return o.replace(/⯪/g, '★').slice(0, Math.ceil(s)) + '☆'.repeat(5 - Math.ceil(s));
}
function hud() {
  renderTutorial();
  const m = $('#sMoney');
  m.textContent = S.mode === 'sandbox' ? 'Unlimited' : money(S.money);
  m.classList.toggle('neg', S.money < 0);
  const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  $('#sGuests').textContent = S.guests.length;
  $('#sRating').textContent = stars(S.rating);
  $('#sRating').title = `${Math.round(S.rating)} / 100`;
  const wk = Math.floor((S.clock / DAY) * 4) + 1;
  $('#sDay').textContent = `${MO[(S.day - 1) % 12]}, Year ${Math.floor((S.day - 1) / 12) + 1}`;
  $('#sDay').title = `Week ${wk} of the month`;
}
