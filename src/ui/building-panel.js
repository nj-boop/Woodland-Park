/* The building inspector: tap a shop, service building or farm to see how it is doing. */
const BUILDING_KINDS = new Set(['shop', 'staff', 'farm']);
let bldArm = false; // demolish needs a second tap

// what the building is doing right now, as label/value rows and an optional note
function buildingFacts(a) {
  const o = S.tiles[a].o,
    rows = [];
  let note = '';
  if (STOCK[o]) {
    const k = STOCK[o],
      n = Math.max(0, Math.round(stockOf(a)));
    rows.push(['Stock', `${meter((n / k.max) * 100)}<small>${n} of ${k.max} sales</small>`]);
    rows.push(['Restocked by', F.cnt.dock ? 'delivery truck and haulers' : 'courier, when below a quarter']);
    if (n <= 0) note = 'Sold out. Guests who wanted something here are leaving unhappy.';
  }
  if (S.sold[a] || ITEMS[o].price || STOCK[o] || o === 'donation') {
    const r = S.sold[a] || { m: 0, l: 0 };
    rows.push(['Takings', `${money(r.m)} this month · ${money(r.l)} last month`]);
  }
  if (o === 'station') {
    const t = F.tours[a];
    if (t) {
      rows.push([
        'Tour',
        `${t.walk.length} tiles of track · ${t.habitats} habitat${t.habitats === 1 ? '' : 's'} on the route`,
      ]);
      rows.push(['Tour rating', `${meter(Math.min(100, t.value * 2))}<small>${t.value}</small>`]);
      if (!t.habitats)
        note = 'The track doesn’t pass any habitats yet, so the ride is dull. Run it through or beside a habitat.';
    } else note = 'No safari track is connected. Lay one beside the station.';
  }
  if (o === 'parking') {
    rows.push(['Zoo parking', `${carsParked()} of ${parkingSpaces()} spaces used`]);
    rows.push(['Footpath to the gate', F.lotWalk && F.lotWalk.has(a) ? 'Yes' : 'None yet']);
  }
  if (o === 'recycle') {
    rows.push(['Trash bags', `${S.waste} of ${wasteCapacity()} (the garbage truck comes when it fills up)`]);
    rows.push(['Janitors', `${staffCount('janitor')} of ${staffRoom('janitor')} places filled`]);
  }
  if (o === 'animalhouse') {
    const h = F.houses && F.houses[a];
    if (!h) note = 'This house isn’t against a habitat’s fence any more.';
    else {
      const e = F.emap[h.e];
      rows.push(['Habitat', `${BIOMES[e.biome].name} habitat`]);
      rows.push([
        'Asleep inside',
        String(S.animals.filter((k) => k.inside != null && h.hatch.includes(k.inside)).length),
      ]);
      rows.push(['Keeper access', 'Staff go in and out through here']);
      rows.push([
        'Ambulance bay',
        h.front.length
          ? ambulanceRoute(new Set(h.front))
            ? 'Connected to the vet clinic'
            : 'No road to a vet clinic yet'
          : 'No road at the door',
      ]);
    }
  }
  if (o === 'lodge') rows.push(['Keepers', `${staffCount('keeper')} of ${staffRoom('keeper')} places filled`]);
  if (o === 'vetclinic') {
    rows.push(['Vets', `${staffCount('vet')} of ${staffRoom('vet')} places filled`]);
    const pts = S.animals.filter((k) => k.away === 'clinic' && k.clinic === a);
    rows.push([
      'In surgery',
      pts.length ? pts.map((k) => `${k.name} the ${SPECIES[k.sp].name.toLowerCase()}`).join(', ') : 'Nobody right now',
    ]);
    rows.push(['Gallery watchers', String(S.guests.filter((g) => g.mode === 'watch' && g.watchAt === a).length)]);
    const bay = clinicBays().some((c) => c.a === a);
    if (!bay) note = 'The ambulance needs a road in front of the clinic.';
    else {
      const cut = S.encl.filter(
        (e) => S.animals.some((k) => k.e === e.id) && !(F.encRoad[e.id] && F.encRoad[e.id].size)
      );
      if (cut.length)
        note = `${cut.length} habitat${cut.length > 1 ? 's have' : ' has'} no road beside the fence, so the ambulance can’t collect from ${cut.length > 1 ? 'them' : 'it'}.`;
    }
    if (![...F.gallery.values()].includes(a))
      note = (note ? note + ' ' : '') + 'Guests can’t watch: run a footpath within 2 tiles of it.';
  }
  if (o === 'dock') {
    rows.push(['Crates waiting', String(S.crates.length)]);
    rows.push(['Haulers', `${staffCount('hauler')} of ${staffRoom('hauler')} places filled`]);
    if (!F.cnt.feedstore) note = 'Build a feed store too, so feed can come in bulk.';
  }
  if (o === 'feedstore') rows.push(['Feed in store', `${Math.floor(S.feed)} of ${feedCapacity()} meals`]);
  if (o === 'entrance') {
    rows.push(['Ticket price', money(S.admission)]);
    rows.push(['Visitors this month', String(S.today.vis)]);
    const linked = F.lotWalk ? F.lotWalk.size : 0;
    rows.push(['Parking lots joined by footpath', String(linked)]);
    if (GATE.ox >= 0 && !linked)
      note =
        'No parking lot is joined to the outside of this gate by a footpath, so visitors are walking in from off-site.';
    else if (F.gateBypass) note = 'A footpath runs around this gate, so guests can wander out past it to the car park.';
  }
  if (FARMS[o]) {
    const f = farmOf(a),
      fm = FARMS[o];
    rows.push(['Crop', `${fm.crop} · ${fm.yield} feed units a harvest`]);
    rows.push([
      'Growth',
      `${meter(f.g * 100, 'var(--good)')}<small>${f.g >= 1 ? 'Ready to harvest' : Math.round(f.g * 100) + '%'}</small>`,
    ]);
    rows.push(['Upkeep', `${money(fm.upkeep)} a month`]);
    if (f.g >= 1 && !staffCount('hauler'))
      note = 'Ripe, but there is no hauler to harvest it. Hire one at the loading dock.';
    if (!F.cnt.feedstore) note = 'Harvests are sold at half value until you build a feed store.';
  }
  const off = F.offline && F.offline.get(a);
  if (off) {
    const need = off
      .map((m) =>
        m === 'road'
          ? 'a road to the highway'
          : m === 'footpath'
            ? 'a footpath joined to the front gate'
            : 'a road or footpath'
      )
      .join(' and ');
    note = `Not working yet: it needs ${need}.` + (note ? ' ' + note : '');
    rows.unshift(['Status', 'Not connected']);
  }
  return { rows, note };
}

function renderBuildingInspector(box, a) {
  const t = S.tiles[a];
  if (!t || !t.o || !isAnchor(a)) {
    closeInspector();
    return;
  }
  const it = ITEMS[t.o],
    [fw, fh] = fpDims(t.o, t.r || 0),
    { rows, note } = buildingFacts(a),
    refund = Math.round(it.cost / 2),
    k = STOCK[t.o],
    restock = k ? Math.round((k.max - Math.max(0, stockOf(a))) * k.unit * supplyRate()) : 0;
  const kindName = { shop: 'Guest building', staff: 'Service building', farm: 'Farm' }[it.kind];
  box.innerHTML = `<button class="x" aria-label="Close" id="ix">×</button>
    <h2>${it.name}</h2>
    <div class="sub">${kindName} · ${fw}×${fh} tiles</div>
    ${note ? `<div class="thought">${note}</div>` : ''}
    ${rows.length ? `<div class="kv bkv">${rows.map(([l, v]) => `<span>${l}</span><span>${v}</span>`).join('')}</div>` : ''}
    ${it.help ? `<p class="help">${it.help}</p>` : ''}
    <div class="btns">${k ? `<button class="btn" id="bRestock" ${restock > 0 ? '' : 'disabled'}>Restock now · ${money(restock)}</button>` : ''}${
      t.o === 'entrance'
        ? ''
        : `<button class="btn danger" id="bDemo">${bldArm ? 'Tap again to demolish' : 'Demolish · refund ' + money(refund)}</button>`
    }</div>`;
  $('#ix').onclick = closeInspector;
  const rs = $('#bRestock');
  if (rs)
    rs.onclick = () => {
      if (spend(restock, 'restocking')) {
        S.today.run += restock;
        S.stock[a] = k.max;
        toast(`${it.name} restocked.`, 'good');
        renderInspector();
      }
    };
  const dm = $('#bDemo');
  if (dm)
    dm.onclick = () => {
      if (!bldArm) {
        bldArm = true;
        return renderInspector();
      }
      bldArm = false;
      S.money += refund;
      clearBuilding(a);
      delete S.stock[a];
      delete S.sold[a];
      dirty = true;
      closeInspector();
      toast(`${it.name} demolished. ${money(refund)} refunded.`);
    };
}
