/* Veterinary care in two levels.
   - Minor illness: a vet walks to the animal and treats it in its habitat (staff.js, 'treat').
   - Serious illness (a.serious): the vet examines the animal, then calls the animal ambulance. It
     drives from the vet clinic along roads to the door of the habitat's animal house, loads the
     animal (which then isn't in the habitat at all), and drives back. The animal has surgery at the
     clinic, which guests can watch from the viewing gallery, then the ambulance takes it home.
   If there is no clinic, or no road from it to the habitat's animal house, the vet does what they can on the spot:
   it costs more and the animal recovers less.

   Animal fields: a.transport ('called' while an ambulance is involved), a.away ('transit' on the
   ambulance, 'clinic' in surgery), a.clinic (clinic anchor), a.surg (surgery ticks left). */
const SURGERY_TICKS = 600,
  SURGERY_COST = 400,
  AMB_LOAD = 60; // ticks to load or unload an animal
const seriousChance = () => (researched('vet') ? 0.25 : 0.35);
// road tiles in front of each clinic, where the ambulance is based
function clinicBays() {
  const out = [];
  for (const a of anchorsOf('vetclinic')) {
    const p = planOf(a),
      bay = frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).filter(isRoad);
    if (bay.length) out.push({ a, bay });
  }
  return out;
}
// the shortest drive from any clinic to one of the goal tiles
function ambulanceRoute(goals) {
  let best = null;
  for (const c of clinicBays())
    for (const b of c.bay) {
      const r = goals.has(b) ? [] : staffRoute(b, goals, truckStep, truckCost);
      if (r && (!best || r.length < best.r.length)) best = { a: c.a, from: b, r };
    }
  return best;
}
const clinicBusy = (a) => S.animals.some((k) => k.away === 'clinic' && k.clinic === a);
function newAmbulance(from, path, extra) {
  const x = (from % W) + 0.5,
    y = ((from / W) | 0) + 0.5;
  const t = {
    id: S.nextId++,
    type: 'ambulance',
    x,
    y,
    ox: x,
    oy: y,
    dir: 0,
    path,
    st: 'in',
    wt: 0,
    cargo: [],
    goods: [],
  };
  S.trucks.push(Object.assign(t, extra));
  return t;
}
// the vet has examined a seriously ill animal: send the ambulance if it can get there
function callAmbulance(a) {
  const pick = F.encRoad && F.encRoad[a.e];
  if (!pick || !pick.size) return false;
  const rt = ambulanceRoute(pick);
  if (!rt) return false;
  a.transport = 'called';
  newAmbulance(rt.from, rt.r, { animal: a.id, clinic: rt.a, bay: rt.from, phase: 'fetch' });
  return true;
}
// put an animal back into its habitat, next to a tile outside the fence if one is given
function releaseAnimal(a, near) {
  a.away = null;
  a.transport = null;
  a.clinic = null;
  const e = F.emap[a.e];
  if (!e) {
    // the habitat was removed while it was away: find another one that suits it
    const alt = S.encl.find((k) => k.biome === SPECIES[a.sp].biome);
    if (!alt) {
      S.animals = S.animals.filter((k) => k !== a);
      toast(`${a.name}'s habitat is gone, so they went to another zoo.`, 'bad');
      return;
    }
    a.e = alt.id;
    return releaseAnimal(a, null);
  }
  let spot = null;
  // dropped at an animal house's door: out through its hatch into the habitat
  for (const h of (F.houseOf[a.e] || []).map((k) => F.houses[k]))
    if (near != null && h.front.includes(near)) spot = h.hatch[(Math.random() * h.hatch.length) | 0];
  if (near != null && spot == null)
    for (const n of nbr4(near)) if (S.tiles[n].e === a.e && !S.tiles[n].w && !S.tiles[n].o) spot = n;
  if (spot != null) {
    a.x = a.tx = (spot % W) + 0.5;
    a.y = a.ty = ((spot / W) | 0) + 0.5;
  } else [a.x, a.y] = [a.tx, a.ty] = randPointIn(e, a);
  a.ox = a.x;
  a.oy = a.y;
  a.wait = 40;
}
// an ambulance reached the end of its route
function ambulanceArrive(t) {
  const a = S.animals.find((k) => k.id === t.animal);
  const here = idx(Math.floor(t.x), Math.floor(t.y));
  if (t.wt > 0 && --t.wt > 0) return;
  if (t.phase === 'fetch') {
    if (t.st === 'in') {
      t.st = 'load';
      t.wt = AMB_LOAD;
      return;
    }
    if (!a || !a.sick) {
      if (a) a.transport = null;
      return driveHome(t, here);
    }
    a.away = 'transit';
    a.inside = null;
    a.pickup = here;
    t.phase = 'toClinic';
    t.st = 'in';
    t.path = truckRoute(here, new Set([t.bay])) || [];
    if (!t.path.length && here !== t.bay) {
      // the road was cut behind it: treat as if it arrived
      t.x = (t.bay % W) + 0.5;
      t.y = ((t.bay / W) | 0) + 0.5;
    }
    return;
  }
  if (t.phase === 'toClinic') {
    if (a) {
      a.away = 'clinic';
      a.clinic = t.clinic;
      a.surg = SURGERY_TICKS;
      toast(
        `${a.name} the ${SPECIES[a.sp].name.toLowerCase()} is in surgery at the vet clinic. Guests can watch from the gallery.`
      );
    }
    t.gone = true;
    return;
  }
  if (t.phase === 'return') {
    if (t.st === 'in') {
      t.st = 'load';
      t.wt = AMB_LOAD;
      return;
    }
    if (a) releaseAnimal(a, here);
    return driveHome(t, here);
  }
  t.gone = true; // 'home'
}
function driveHome(t, here) {
  t.phase = 'home';
  t.st = 'in';
  t.animal = null;
  t.path = truckRoute(here, new Set([t.bay])) || [];
  if (!t.path.length) t.gone = true;
}
function tickVetCare() {
  for (const a of S.animals) {
    if (a.away !== 'clinic') continue;
    if (!S.tiles[a.clinic] || S.tiles[a.clinic].o !== 'vetclinic') {
      // the clinic was demolished mid-operation: patch them up and send them straight home
      a.sick = a.serious = false;
      releaseAnimal(a, a.pickup);
      continue;
    }
    a.surg -= staffCount('vet') ? 1 : 0.3; // slow without a vet on staff
    if (a.surg > 0) continue;
    a.sick = a.serious = false;
    a.health = Math.min(100, a.health + 60);
    S.money -= SURGERY_COST;
    S.today.run += SURGERY_COST;
    a.away = 'transit';
    const pick = F.encRoad && F.encRoad[a.e],
      bay = clinicBays().find((c) => c.a === a.clinic);
    const r = pick && pick.size && bay ? staffRoute(bay.bay[0], pick, truckStep, truckCost) : null;
    toast(`${a.name}'s surgery went well. The ambulance is taking them home.`, 'good');
    if (r) newAmbulance(bay.bay[0], r, { animal: a.id, clinic: a.clinic, bay: bay.bay[0], phase: 'return' });
    else releaseAnimal(a, a.pickup);
  }
}
// a keeper or vet inside an animal house, or working in the habitat behind it
function keeperAtHouse(a) {
  const h = F.houses && F.houses[a];
  if (!h) return false;
  return S.staff.some((s) => {
    if (s.role !== 'keeper' && s.role !== 'vet') return false;
    const t = S.tiles[sTile(s)];
    return (t.o === 'animalhouse' && anchorOf(sTile(s)) === a) || t.e === h.e;
  });
}
// guests on a footpath within 2 tiles of a clinic can watch from the viewing gallery
function galleryTiles() {
  const m = new Map();
  for (const a of anchorsOf('vetclinic')) {
    const p = planOf(a);
    for (let y = p.y0 - 2; y < p.y0 + p.fh + 2; y++)
      for (let x = p.x0 - 2; x < p.x0 + p.fw + 2; x++) if (inB(x, y) && isFootpath(idx(x, y))) m.set(idx(x, y), a);
  }
  return m;
}
