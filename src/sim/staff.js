/* Individual staff: the hiring board, wages and morale, skill growth, and each worker walking the zoo
   (paths, open ground and habitat gates) to do one job at a time. */

const STAFF_ROLES = {
  keeper: {
    name: 'Zookeeper',
    pl: 'Zookeepers',
    base: 60,
    home: 'lodge',
    cap: 'keepers',
    does: 'Feeds animals, cleans habitats and catches escaped animals.',
    uniform: '#7d6b3c',
    hat: '#cdb67c',
  },
  vet: {
    name: 'Veterinarian',
    pl: 'Vets',
    base: 80,
    home: 'vetclinic',
    cap: 'vets',
    does: 'Treats sick animals.',
    uniform: '#eeeee8',
    hat: null,
  },
  hauler: {
    name: 'Hauler',
    pl: 'Haulers',
    base: 50,
    home: 'dock',
    cap: 'haulers',
    does: 'Harvests farms, and carries feed and goods from the loading dock to the feed store and shops.',
    uniform: '#c9771f',
    hat: '#f2c94c',
  },
  janitor: {
    name: 'Janitor',
    pl: 'Janitors',
    base: 45,
    home: 'recycle',
    cap: 'janitors',
    does: 'Sweeps litter off paths and repairs worn fences.',
    uniform: '#3d6d99',
    hat: '#294d70',
  },
};
const STAFF_TRAITS = {
  hard: { name: 'Hard worker', speed: 1.2, wage: 1.05, mood: 0, tip: 'Works 20% faster.' },
  slow: { name: 'Slow starter', speed: 0.8, wage: 0.88, mood: 0, tip: 'Works 20% slower, but asks for less pay.' },
  gentle: {
    name: 'Gentle with animals',
    speed: 1,
    wage: 1,
    mood: 0,
    tip: 'Animals they care for get a happiness boost.',
  },
  learner: { name: 'Quick learner', speed: 1, wage: 1, mood: 0, tip: 'Gains skill twice as fast.' },
  grumpy: { name: 'Grumpy', speed: 1, wage: 0.92, mood: -6, tip: 'Morale slides a little every month.' },
  cheerful: { name: 'Cheerful', speed: 1, wage: 1, mood: 5, tip: 'Morale rises a little every month.' },
};
const STAFF_FIRST = [
  'Ada',
  'Ben',
  'Carmen',
  'Dev',
  'Elena',
  'Femi',
  'Grace',
  'Hugo',
  'Iris',
  'Jonah',
  'Keiko',
  'Luis',
  'Maya',
  'Nils',
  'Olu',
  'Priya',
  'Quinn',
  'Rosa',
  'Sam',
  'Tariq',
  'Uma',
  'Vic',
  'Wren',
  'Yusuf',
  'Zoe',
  'Marta',
  'Owen',
  'Leah',
];
const STAFF_LAST = [
  'Abbott',
  'Baker',
  'Castillo',
  'Dunn',
  'Ellis',
  'Fischer',
  'Garcia',
  'Hale',
  'Ibarra',
  'Jensen',
  'Kowalski',
  'Lam',
  'Moreno',
  'Nakamura',
  'Okafor',
  'Park',
  'Reyes',
  'Sato',
  'Turner',
  'Varga',
  'Walsh',
  'Young',
  'Zhou',
  'Ortiz',
];
const STAFF_SPEED = 0.055; // tiles per tick at normal pace
const FEED_AT = 30; // keepers come by when an animal's hunger passes this
const DIRTY_AT = 35; // ...or when habitat dirt passes this
const FENCE_AT = 70; // janitors repair fences worn below this condition

const fairWage = (role, skill) => Math.round(STAFF_ROLES[role].base * (0.7 + 0.15 * skill));
const staffOf = (role) => (S.staff || []).filter((s) => s.role === role);
const staffCount = (role) => staffOf(role).length;
const staffRoom = (role) => (F.cap ? F.cap[STAFF_ROLES[role].cap] : 0);
const xpToNext = (s) => (s.trait === 'learner' ? 10 : 20) * s.skill;

function makeCandidate(role) {
  const r = Math.random(),
    skill = r < 0.35 ? 1 : r < 0.68 ? 2 : r < 0.88 ? 3 : r < 0.97 ? 4 : 5,
    trait = pick(Object.keys(STAFF_TRAITS));
  return {
    id: S.nextId++,
    role,
    name: pick(STAFF_FIRST) + ' ' + pick(STAFF_LAST),
    skill,
    trait,
    wage: Math.round(fairWage(role, skill) * STAFF_TRAITS[trait].wage * rnd(0.93, 1.07)),
  };
}
function refreshCandidates() {
  S.cands = ['keeper', 'keeper', 'janitor', 'janitor', 'vet', 'vet', 'hauler', 'hauler'].map(makeCandidate);
}

function hire(cid) {
  const c = (S.cands || []).find((k) => k.id === cid);
  if (!c) return false;
  const R = STAFF_ROLES[c.role];
  if (staffCount(c.role) >= staffRoom(c.role)) {
    toast(`No room for another ${R.name.toLowerCase()}. ${capHint(c.role)}`, 'bad');
    return false;
  }
  S.cands = S.cands.filter((k) => k !== c);
  const s = addStaff(c);
  toast(`${s.name} joined as a ${R.name.toLowerCase()}.`, 'good');
  return s;
}
function addStaff(c) {
  const s = {
    ...c,
    morale: 70,
    energy: 100,
    xp: 0,
    hired: S.day,
    assign: [],
    x: GATE.x + 0.5,
    y: GATE.y + 0.5,
    ox: GATE.x + 0.5,
    oy: GATE.y + 0.5,
    path: [],
    job: null,
    st: 'idle',
    wt: 0,
    tired: 0,
    done: 0,
  };
  S.staff.push(s);
  return s;
}
function fire(sid) {
  const s = S.staff.find((k) => k.id === sid);
  if (!s) return;
  const pay = Math.round(s.wage / 2);
  S.money -= pay;
  S.today.run += pay;
  S.staff = S.staff.filter((k) => k !== s);
  if (sel && sel.type === 'staff' && sel.id === sid) closeInspector();
  toast(`${s.name} was let go with ${money(pay)} severance.`);
}
function giveRaise(sid) {
  const s = S.staff.find((k) => k.id === sid);
  if (!s) return;
  if (s.raised === S.day) {
    toast(`${s.name} already got a raise this month.`, 'bad');
    return;
  }
  s.wage = Math.round(s.wage * 1.1);
  s.morale = Math.min(100, s.morale + 12);
  s.raised = S.day;
  toast(`${s.name} now earns ${money(s.wage)} a month.`, 'good');
}
function capHint(role) {
  const n = F.cnt || {};
  const housed = (r) =>
    Object.keys(F.anchors || {}).some((o) => ITEMS[o].staff && ITEMS[o].staff[0] === r && F.anchors[o].length);
  if (role === 'keeper')
    return !housed('keeper')
      ? 'Build a keeper hut, lodge or headquarters (and a recycling yard).'
      : !n.recycle
        ? 'Keepers can start once you build a recycling yard.'
        : 'Build more room: a hut holds 2, a lodge 4, headquarters 10.';
  if (role === 'vet') return 'A vet station has room for 1, the veterinary hospital for 2.';
  if (role === 'hauler') return 'Each loading dock has room for 3.';
  return 'A recycling yard has room for 3, a maintenance depot for 6.';
}

/* ---------- getting around ---------- */
const sTile = (s) => idx(clamp(Math.floor(s.x), 0, W - 1), clamp(Math.floor(s.y), 0, H - 1));
// gate directions match the habitat edge code: 0 up, 1 down, 2 left, 3 right
const DIRS = [
  [0, -1],
  [0, 1],
  [-1, 0],
  [1, 0],
];
function hasGate(e, ti, dr) {
  return (e.gates || []).some(([gi, gd]) => gi === ti && gd === dr);
}
// can a worker step from tile a to the neighbouring tile b (moving in direction dr)?
function staffStep(a, b, dr) {
  const ta = S.tiles[a],
    tb = S.tiles[b];
  if (tb.e !== ta.e) {
    // crossing a habitat fence: through its animal house (or an old-style keeper gate)
    const viaHouse =
      (ta.o === 'animalhouse' && F.hatch && F.hatch.get(b) === anchorOf(a)) ||
      (tb.o === 'animalhouse' && F.hatch && F.hatch.get(a) === anchorOf(b));
    if (!viaHouse) {
      if (tb.e && !hasGate(F.emap[tb.e], b, dr ^ 1)) return false;
      if (ta.e && !hasGate(F.emap[ta.e], a, dr)) return false;
    }
  }
  if (tb.o === 'animalhouse') return true; // staff walk through the animal house
  if (tb.e) {
    if (F.emap[tb.e] && F.emap[tb.e].biome === 'pool') return false;
    if (tb.w || tb.o === 'pond') return false;
    const it = tb.o && ITEMS[tb.o];
    if (it && (it.form === 'rock' || it.kind === 'shelter')) return false;
    return true;
  }
  if (tb.t === 'p' && !tb.o) return true;
  if (tb.w) return false;
  if (tb.o) {
    const it = ITEMS[tb.o];
    if (!it || !(it.kind === 'plant' && it.form !== 'rock' && it.form !== 'tree')) return false;
  }
  return true;
}
// service roads are the quickest way round for staff
const stepCost = (b) => (S.tiles[b].t === 'p' ? (S.tiles[b].pm === 'service' ? 0.8 : 1) : S.tiles[b].e ? 1.6 : 2.4);
// cheapest route from tile `from` to the nearest tile in `goals` (a Set of tile indices); null if none can be reached
function staffRoute(from, goals, step = staffStep, cost = stepCost) {
  if (goals.has(from)) return [];
  // A*: the heuristic is the distance to the box around all goal tiles, so the search heads
  // toward the goals instead of flooding the whole map
  let gx0 = W,
    gy0 = H,
    gx1 = 0,
    gy1 = 0;
  for (const g of goals) {
    const x = g % W,
      y = (g / W) | 0;
    if (x < gx0) gx0 = x;
    if (x > gx1) gx1 = x;
    if (y < gy0) gy0 = y;
    if (y > gy1) gy1 = y;
  }
  const hOf = (i) => {
    const x = i % W,
      y = (i / W) | 0;
    // weighted ×1.5: routes may come out slightly longer than the very best, but the search
    // explores far fewer tiles on a big map
    return (Math.max(0, gx0 - x, x - gx1) + Math.max(0, gy0 - y, y - gy1)) * 1.5;
  };
  const N = W * H;
  if (!routeBuf || routeBuf.n !== N)
    routeBuf = { n: N, dist: new Float64Array(N), prev: new Int32Array(N), seen: new Uint32Array(N), stamp: 0 };
  const R = routeBuf,
    dist = R.dist,
    prev = R.prev,
    seen = R.seen,
    st = ++R.stamp;
  // binary heap of [f, node] kept in two parallel arrays
  const hf = [],
    hn = [];
  const push = (n, f) => {
    let k = hf.length;
    hf.push(f);
    hn.push(n);
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (hf[p] <= f) break;
      hf[k] = hf[p];
      hn[k] = hn[p];
      k = p;
    }
    hf[k] = f;
    hn[k] = n;
  };
  const pop = () => {
    const top = hn[0],
      lf = hf.pop(),
      ln = hn.pop();
    if (hf.length) {
      let k = 0;
      for (;;) {
        const l = k * 2 + 1,
          r = l + 1;
        let m = -1;
        if (l < hf.length) m = l;
        if (r < hf.length && hf[r] < hf[l]) m = r;
        if (m < 0 || hf[m] >= lf) break;
        hf[k] = hf[m];
        hn[k] = hn[m];
        k = m;
      }
      hf[k] = lf;
      hn[k] = ln;
    }
    return top;
  };
  seen[from] = st;
  dist[from] = 0;
  push(from, hOf(from));
  while (hf.length) {
    const c = pop();
    if (goals.has(c)) {
      const out = [];
      for (let k = c; k !== from; k = prev[k]) out.push(k);
      return out.reverse();
    }
    const d = dist[c],
      x = c % W,
      y = (c / W) | 0;
    for (let dr = 0; dr < 4; dr++) {
      const nx = x + DIRS[dr][0],
        ny = y + DIRS[dr][1];
      if (!inB(nx, ny)) continue;
      const n = ny * W + nx;
      if (!step(c, n, dr)) continue;
      const nd = d + cost(n);
      if (seen[n] !== st || nd < dist[n]) {
        seen[n] = st;
        dist[n] = nd;
        prev[n] = c;
        push(n, nd + hOf(n));
      }
    }
  }
  return null;
}
let routeBuf = null; // reused between searches so a big map doesn't allocate per route

/* ---------- where each job is done ---------- */
// tiles from which a habitat can be serviced: inside it (through a gate) for land habitats, beside it for tanks
function serviceTiles(e) {
  const out = new Set(),
    ts = F.etiles[e.id] || [];
  if (e.biome === 'pool') {
    for (const i of ts) for (const n of nbr4(i)) if (!S.tiles[n].e && isPath(n)) out.add(n);
    return out;
  }
  for (const i of ts) {
    const t = S.tiles[i];
    if (!t.w && t.o !== 'pond' && !(t.o && (ITEMS[t.o].form === 'rock' || ITEMS[t.o].kind === 'shelter'))) out.add(i);
  }
  return out;
}
function fenceSideTiles(e) {
  const out = new Set();
  for (const [x, y, dr] of F.eedges[e.id] || []) {
    const nx = x + DIRS[dr][0],
      ny = y + DIRS[dr][1];
    if (inB(nx, ny) && !S.tiles[idx(nx, ny)].e && !S.tiles[idx(nx, ny)].w) out.add(idx(nx, ny));
  }
  return out;
}
function homeTiles(role) {
  return new Set(F.roleHomes ? F.roleHomes[role] : []);
}
// an animal's tile and the tiles around it (it may be standing by a pond or a rock that people cannot stand on)
// (only tiles on the same side of the fence as the animal count)
function around(x, y) {
  const out = new Set(),
    cx = Math.floor(x),
    cy = Math.floor(y),
    side = inB(cx, cy) ? S.tiles[idx(cx, cy)].e : 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (inB(cx + dx, cy + dy) && S.tiles[idx(cx + dx, cy + dy)].e === side) out.add(idx(cx + dx, cy + dy));
  return out;
}
const near = (s, ti) => Math.max(Math.abs(s.x - ((ti % W) + 0.5)), Math.abs(s.y - (((ti / W) | 0) + 0.5))) < 1.6;
const servesHabitat = (s, e) => !s.assign.length || s.assign.includes(e.id);
// habitats keepers cannot reach (no animal house, and no old keeper gate); the habitat panel warns about these
function unreachable(e) {
  return e.biome !== 'pool' && !(e.gates || []).length && !(F.houseOf && F.houseOf[e.id]);
}

// choose the next job for an idle worker; returns { kind, goals, ...target } or null
function pickJob(s) {
  const taken = (kind, id) => S.staff.some((o) => o !== s && o.job && o.job.kind === kind && o.job.id === id);
  if (s.role === 'keeper') {
    const loose = S.animals.filter((a) => a.escaped && !taken('catch', a.id));
    if (loose.length) {
      const a = loose[0];
      return { kind: 'catch', id: a.id, goals: around(a.x, a.y) };
    }
    let best = null,
      bestScore = 0;
    for (const e of S.encl) {
      if (!servesHabitat(s, e) || taken('tend', e.id) || unreachable(e)) continue;
      const list = S.animals.filter((a) => a.e === e.id && !a.escaped);
      const hungry = list.reduce((m, a) => Math.max(m, a.hunger), 0),
        score = Math.max(hungry > FEED_AT ? hungry : 0, (e.dirt || 0) > DIRTY_AT ? e.dirt : 0);
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    if (best) {
      // with a feed store, collect the habitat's feed there first
      if (feedByTruck() && !s.carryFeed && F.homes.feedstore.size)
        return { kind: 'fetch', id: best.id, goals: new Set(F.homes.feedstore) };
      return { kind: 'tend', id: best.id, goals: serviceTiles(best) };
    }
  }
  if (s.role === 'vet') {
    const sick = S.animals
      .filter((a) => a.sick && !a.transport && !a.away && !taken('treat', a.id))
      .sort((a, b) => a.health - b.health)
      .find((a) => a.escaped || !unreachable(F.emap[a.e]));
    if (sick) {
      const e = F.emap[sick.e];
      const goals = sick.escaped || e.biome !== 'pool' ? around(sick.x, sick.y) : serviceTiles(e);
      return { kind: 'treat', id: sick.id, goals };
    }
  }
  if (s.role === 'hauler') {
    // already carrying: take it where it's going
    if (s.carry && s.carryKind === 'goods') {
      const shop = neediestShop(s);
      if (shop != null) return { kind: 'drop', id: shop, goals: shopDoor(shop) };
    } else if (s.carry && F.homes.feedstore.size) return { kind: 'drop', id: -1, goals: new Set(F.homes.feedstore) };
    // ripe crops come first: they don't keep
    const ripe = ripeFarms().find((a) => !taken('harvest', a));
    if (ripe != null) {
      const goals = new Set();
      for (const i of buildingTiles(ripe)) for (const n of nbr4(i)) if (S.tiles[n].o !== S.tiles[ripe].o) goals.add(n);
      return { kind: 'harvest', id: ripe, goals };
    }
    const room =
      feedCapacity() - S.feed - S.staff.reduce((t, o) => t + (o.carryKind !== 'goods' ? o.carry || 0 : 0), 0);
    const crate = S.crates.find(
      (c) =>
        !taken('haul', c.id) && (c.kind === 'goods' ? neediestShop(s) != null : F.homes.feedstore.size && c.n <= room)
    );
    if (crate) {
      const p = planOf(crate.dock),
        goals = new Set();
      for (const i of fpTiles(p.x0 - 1, p.y0 - 1, p.fw + 2, p.fh + 2))
        if (i >= 0 && S.tiles[i].o !== 'dock') goals.add(i);
      return { kind: 'haul', id: crate.id, goals };
    }
  }
  if (s.role === 'janitor') {
    if ((s.bag || 0) >= BAG_SIZE) {
      if (S.waste + s.bag <= wasteCapacity() && F.homes.recycle.size)
        return { kind: 'dump', id: -1, goals: new Set(F.homes.recycle) };
      if (S.clock - (S.yardFullAt || -1e9) > DAY / 2) {
        S.yardFullAt = S.clock;
        toast('The recycling yard is full. Janitors can’t empty their bags until the garbage truck comes.', 'bad');
      }
      return null;
    }
    const worn = S.encl
      .filter((e) => e.biome !== 'pool' && (e.cond ?? 100) < FENCE_AT && !taken('fence', e.id))
      .sort((a, b) => (a.cond ?? 100) - (b.cond ?? 100))[0];
    if (worn) return { kind: 'fence', id: worn.id, goals: fenceSideTiles(worn) };
    // the dozen closest pieces of litter (aiming at all of them would search the whole map)
    const sx = Math.floor(s.x),
      sy = Math.floor(s.y),
      near = [];
    for (const i of F.litter) near.push([Math.abs((i % W) - sx) + Math.abs(((i / W) | 0) - sy), i]);
    near.sort((a, b) => a[0] - b[0]);
    const litter = new Set();
    for (const [, i] of near) {
      if (litter.size >= 12) break;
      if (!taken('sweep', i)) litter.add(i);
    }
    if (litter.size) return { kind: 'sweep', id: -1, goals: litter };
  }
  return null;
}

/* ---------- each tick ---------- */
const workRate = (s) =>
  STAFF_TRAITS[s.trait].speed * (0.75 + 0.1 * s.skill) * (0.6 + 0.6 * (s.morale / 100)) * (s.energy > 0 ? 1 : 0.6);
const JOB_TIME = {
  harvest: 90,
  tend: 70,
  treat: 90,
  catch: 50,
  fence: 110,
  sweep: 14,
  fetch: 30,
  haul: 25,
  drop: 25,
  dump: 20,
};
const JOB_TEXT = {
  harvest: 'Harvesting',
  fetch: 'Collecting feed for',
  haul: 'Picking up a crate',
  drop: 'Delivering a crate',
  dump: 'Emptying a trash bag at the recycling yard',
  tend: 'Tending',
  treat: 'Treating',
  catch: 'Catching',
  fence: 'Repairing the fence of',
  sweep: 'Sweeping litter',
};

function goTo(s, goals) {
  const r = staffRoute(sTile(s), goals);
  if (!r) return false;
  s.path = r;
  s.st = 'walk';
  return true;
}
function startJob(s, job) {
  if (!goTo(s, job.goals)) return false;
  s.job = { kind: job.kind, id: job.id };
  return true;
}
function finishJob(s) {
  const j = s.job,
    gentle = s.trait === 'gentle';
  let ok = false;
  if (j.kind === 'tend') {
    const e = F.emap[j.id];
    if (e) {
      let cost = 0;
      const bulk = feedByTruck();
      for (const a of animalsIn(e.id))
        if (!a.escaped && a.hunger > 15) {
          if (bulk) {
            // feed carried from the feed store; animals left over stay hungry
            const u = mealUnits(a.sp);
            if ((s.carryFeed || 0) < u - 1e-6) continue;
            s.carryFeed -= u;
          } else cost += DIET[care(a.sp).diet].cost; // couriered at the full price
          a.hunger = 0;
          if (gentle) a.happy = Math.min(100, a.happy + 6);
        }
      if (s.carryFeed) {
        S.feed += s.carryFeed; // bring back what's left
        s.carryFeed = 0;
      }
      e.dirt = Math.max(0, (e.dirt || 0) - 60);
      S.money -= cost + 5;
      S.today.run += cost + 5;
      ok = true;
    }
  } else if (j.kind === 'treat') {
    const a = S.animals.find((k) => k.id === j.id);
    if (a && a.sick && !a.transport && !a.away) {
      const nm = `${a.name} the ${SPECIES[a.sp].name.toLowerCase()}`;
      if (a.serious && callAmbulance(a)) {
        toast(`${s.name} examined ${nm}: they need surgery. The animal ambulance is on its way.`);
      } else if (a.serious) {
        // no clinic, or no road to this habitat: the best the vet can do on the spot
        a.sick = a.serious = false;
        a.health = Math.min(100, a.health + 15);
        S.money -= TREAT_COST * 2;
        S.today.run += TREAT_COST * 2;
        warnOnce(
          F.cnt.vetclinic
            ? `${s.name} patched up ${nm} in the habitat, but serious cases recover far better after surgery. The ambulance loads at the habitat’s animal house: connect its door to the veterinary hospital by road.`
            : `${s.name} patched up ${nm} in the habitat, but serious cases need surgery. Build a veterinary hospital, with a road to your habitats.`
        );
      } else {
        a.sick = false;
        a.health = Math.min(100, a.health + (gentle ? 40 : 30));
        S.money -= TREAT_COST;
        S.today.run += TREAT_COST;
        toast(`${s.name} treated ${nm}.`, 'good');
      }
      ok = true;
    }
  } else if (j.kind === 'catch') {
    const a = S.animals.find((k) => k.id === j.id);
    if (a && a.escaped) {
      recapture(a);
      toast(`${s.name} caught ${a.name} and walked them back to their habitat.`, 'good');
      ok = true;
    }
  } else if (j.kind === 'fence') {
    const e = F.emap[j.id];
    if (e) {
      e.cond = 100;
      ok = true;
    }
  } else if (j.kind === 'fetch') {
    const e = F.emap[j.id];
    if (e) {
      let need = 0;
      for (const a of animalsIn(e.id)) if (!a.escaped && a.hunger > 15) need += mealUnits(a.sp);
      const take = Math.min(need, S.feed);
      S.feed -= take;
      s.carryFeed = take;
      if (take < need - 1e-6 && S.clock - (S.feedLowAt || -1e9) > DAY / 2) {
        S.feedLowAt = S.clock;
        toast('The feed store is running out. Feed trucks need a loading dock reachable from the entrance.', 'bad');
      }
      s.job = null;
      s.st = 'idle';
      // straight on to the habitat
      if (startJob(s, { kind: 'tend', id: e.id, goals: serviceTiles(e) })) return;
      if (s.carryFeed) S.feed += s.carryFeed;
      s.carryFeed = 0;
      return;
    }
  } else if (j.kind === 'haul') {
    const c = S.crates.find((k) => k.id === j.id);
    if (c) {
      S.crates = S.crates.filter((k) => k !== c);
      s.carry = c.n;
      s.carryKind = c.kind || 'feed';
      s.job = null;
      s.st = 'idle';
      const next = pickJob(s); // the drop-off for what's now in hand
      if (next) startJob(s, next);
      return;
    }
  } else if (j.kind === 'harvest') {
    const units = harvestFarm(j.id);
    if (units) {
      s.job = null;
      s.st = 'idle';
      s.done++;
      s.xp++;
      // carry it to the feed store if there's room; otherwise sell it at half price
      const room = feedCapacity() - S.feed;
      if (F.homes.feedstore.size && room >= units) {
        s.carry = units;
        s.carryKind = 'feed';
        startJob(s, { kind: 'drop', id: -1, goals: new Set(F.homes.feedstore) });
      } else {
        const v = Math.round(units * FEED_UNIT * 0.5);
        earn(v, 'shop');
        toast(
          `No room in the feed store: sold a ${FARMS[S.tiles[j.id].o].crop.toLowerCase()} harvest for ${money(v)}.`
        );
      }
      return;
    }
  } else if (j.kind === 'drop') {
    if (s.carry && s.carryKind === 'goods') {
      const k = S.tiles[j.id] && STOCK[S.tiles[j.id].o];
      if (k) {
        S.stock[j.id] = Math.min(k.max, stockOf(j.id) + s.carry);
        s.carry = 0;
        s.carryKind = null;
        ok = true;
      }
    } else if (s.carry) {
      S.feed = Math.min(feedCapacity(), S.feed + s.carry);
      s.carry = 0;
      s.carryKind = null;
      ok = true;
    }
  } else if (j.kind === 'dump') {
    if (s.bag && S.waste + s.bag <= wasteCapacity()) {
      S.waste += s.bag;
      s.bag = 0;
      ok = true;
    }
  } else if (j.kind === 'sweep') {
    const t = S.tiles[sTile(s)];
    if (t.l > 0) {
      if (--t.l === 0) F.litter.delete(sTile(s));
      if (F.cnt && F.cnt.recycle) s.bag = (s.bag || 0) + 1; // swept litter goes in the bag
      ok = true;
    }
  }
  s.job = null;
  s.st = 'idle';
  if (!ok) return;
  s.done++;
  s.xp++;
  if (s.skill < 5 && s.xp >= xpToNext(s)) {
    s.xp = 0;
    s.skill++;
    toast(
      `${s.name} is now a skill ${s.skill} ${STAFF_ROLES[s.role].name.toLowerCase()}, and may want a raise.`,
      'good'
    );
  }
}
// is the job still worth doing? (someone else may have fixed it, or the animal moved)
function jobStillValid(s) {
  const j = s.job;
  if (j.kind === 'tend') return !!F.emap[j.id];
  if (j.kind === 'treat') {
    const a = S.animals.find((k) => k.id === j.id);
    return !!(a && a.sick);
  }
  if (j.kind === 'catch') {
    const a = S.animals.find((k) => k.id === j.id);
    return !!(a && a.escaped);
  }
  if (j.kind === 'fence' || j.kind === 'fetch') return !!F.emap[j.id];
  if (j.kind === 'haul') return S.crates.some((c) => c.id === j.id);
  if (j.kind === 'harvest') return !!S.tiles[j.id] && !!FARMS[S.tiles[j.id].o] && farmOf(j.id).g >= 1;
  return true;
}
// moving animals: re-aim at them when they wander off
function jobTarget(s) {
  const j = s.job;
  if (j.kind === 'treat' || j.kind === 'catch') {
    const a = S.animals.find((k) => k.id === j.id);
    if (a && (a.escaped || F.emap[a.e].biome !== 'pool')) return idx(Math.floor(a.x), Math.floor(a.y));
  }
  return -1;
}

function tickStaff() {
  if (!S.staff) return;
  for (const s of S.staff) {
    s.ox = s.x;
    s.oy = s.y;
    if (s.st === 'rest') {
      s.energy = Math.min(100, s.energy + 0.45);
      if (s.energy >= 100) s.st = 'idle';
      continue;
    }
    s.energy = Math.max(0, s.energy - (s.st === 'idle' ? 0.006 : 0.035));
    if (s.energy <= 0) s.tired++;
    if (s.st === 'idle') {
      if (s.energy < 15 && !s.job) {
        const h = homeTiles(s.role);
        if (h.size && goTo(s, h)) s.going = 'home';
        else s.st = 'idle';
        continue;
      }
      s.wt = (s.wt || 0) - 1;
      if (s.wt > 0) continue;
      const job = pickJob(s);
      if (job && startJob(s, job)) continue;
      s.wt = 20; // nothing to do: look again in a second
      continue;
    }
    if (s.st === 'walk') {
      if (s.job && !jobStillValid(s)) {
        s.job = null;
        s.st = 'idle';
        s.path = [];
        continue;
      }
      const tgt = s.job ? jobTarget(s) : -1;
      if (tgt >= 0 && near(s, tgt)) {
        s.path = [];
      }
      if (!s.path.length) {
        if (s.going === 'home') {
          s.going = null;
          s.st = 'rest';
          continue;
        }
        if (s.job) {
          if (tgt >= 0 && !near(s, tgt)) {
            if (!goTo(s, around((tgt % W) + 0.5, ((tgt / W) | 0) + 0.5))) {
              s.job = null;
              s.st = 'idle';
            }
            continue;
          }
          s.st = 'work';
          s.wt = JOB_TIME[s.job.kind];
        } else s.st = 'idle';
        continue;
      }
      const n = s.path[0],
        cx = (n % W) + 0.5,
        cy = ((n / W) | 0) + 0.5,
        dx = cx - s.x,
        dy = cy - s.y,
        d = Math.hypot(dx, dy),
        v = STAFF_SPEED * Math.sqrt(STAFF_TRAITS[s.trait].speed) * (s.energy > 0 ? 1 : 0.6);
      if (d <= v) {
        s.x = cx;
        s.y = cy;
        s.path.shift();
        // the route may have been cut (a fence, a building): find a new one at each tile
        if (s.path.length && !staffStep(n, s.path[0], dirOf(n, s.path[0]))) {
          s.path = [];
          if (s.going === 'home') {
            if (!goTo(s, homeTiles(s.role))) {
              s.going = null;
              s.st = 'idle';
            }
          } else if (s.job) {
            const job = pickJobFor(s);
            if (!job || !goTo(s, job)) {
              s.job = null;
              s.st = 'idle';
            }
          }
        }
      } else {
        s.x += (dx / d) * v;
        s.y += (dy / d) * v;
        s.dir = Math.atan2(dx, dy);
      }
      continue;
    }
    if (s.st === 'work') {
      if (!jobStillValid(s)) {
        s.job = null;
        s.st = 'idle';
        continue;
      }
      s.wt -= workRate(s);
      if (s.wt <= 0) finishJob(s);
    }
  }
}
const dirOf = (a, b) => (b === a - W ? 0 : b === a + W ? 1 : b === a - 1 ? 2 : 3);
// goal tiles for a worker's current job (used when re-routing)
function pickJobFor(s) {
  const j = s.job;
  if (j.kind === 'tend' && F.emap[j.id]) return serviceTiles(F.emap[j.id]);
  if (j.kind === 'drop' && s.carryKind === 'goods' && S.tiles[j.id] && STOCK[S.tiles[j.id].o]) return shopDoor(j.id);
  if ((j.kind === 'fetch' || j.kind === 'drop') && F.homes.feedstore.size) return new Set(F.homes.feedstore);
  if (j.kind === 'dump' && F.homes.recycle.size) return new Set(F.homes.recycle);
  if (j.kind === 'fence' && F.emap[j.id]) return fenceSideTiles(F.emap[j.id]);
  const t = jobTarget(s);
  if (t >= 0) return around((t % W) + 0.5, ((t / W) | 0) + 0.5);
  if (j.kind === 'sweep') {
    const g = new Set();
    for (const i of F.litter) g.add(i);
    return g.size ? g : null;
  }
  return null;
}

/* ---------- month end: wages, morale, quitting, a fresh hiring board ---------- */
function staffMonth() {
  let wages = 0;
  for (const s of [...S.staff]) {
    wages += s.wage;
    const fair = fairWage(s.role, s.skill),
      pay = clamp((s.wage / fair - 1) * 50, -15, 12),
      over = s.tired > 200 ? -6 : 0,
      idle = s.done === 0 ? 0 : 2; // a quiet month is no reason to quit
    s.mood = { pay: Math.round(pay), over, idle, trait: STAFF_TRAITS[s.trait].mood };
    s.morale = clamp(s.morale + pay + over + idle + STAFF_TRAITS[s.trait].mood, 0, 100);
    // fairly paid people who are not run ragged stay, however grumpy
    if (pay >= -2 && !over) s.morale = Math.max(s.morale, 35);
    s.tired = 0;
    s.done = 0;
    if (s.morale < 20 && Math.random() < 0.5) {
      S.staff = S.staff.filter((k) => k !== s);
      if (sel && sel.type === 'staff' && sel.id === s.id) closeInspector();
      toast(`${s.name} quit. Morale was too low: check their pay and workload.`, 'bad');
    }
  }
  S.money -= wages;
  S.today.run += wages;
  refreshCandidates();
}
function staffMoodText(s) {
  const m = s.mood;
  if (!m) return 'Settling in.';
  const bits = [];
  if (m.pay <= -4) bits.push('feels underpaid');
  else if (m.pay >= 4) bits.push('is happy with their pay');
  if (m.over) bits.push('was worn out last month');
  if (m.idle < 0) bits.push('had nothing to do');
  if (m.trait < 0) bits.push('is grumpy by nature');
  return bits.length ? cap(bits.join(', ')) + '.' : 'Content.';
}
function staffDoing(s) {
  if (s.st === 'rest') return 'Taking a break at base';
  if (s.going === 'home') return 'Heading off for a break';
  const j = s.job;
  if (!j) return s.energy <= 0 ? 'Exhausted' : 'Waiting for work';
  const verb = (s.st === 'walk' ? 'On the way: ' : '') + JOB_TEXT[j.kind];
  if (j.kind === 'harvest') return `${verb} the ${ITEMS[S.tiles[j.id].o].name.toLowerCase()}`;
  if (j.kind === 'tend' || j.kind === 'fence' || j.kind === 'fetch') {
    const e = F.emap[j.id];
    return `${verb} ${e ? BIOMES[e.biome].name.toLowerCase() + ' habitat #' + e.id : ''}`;
  }
  if (j.kind === 'treat' || j.kind === 'catch') {
    const a = S.animals.find((k) => k.id === j.id);
    return `${verb} ${a ? a.name : ''}`;
  }
  return verb;
}

// staff for an older save that only stored head counts
function staffFromCounts(d) {
  S.staff = [];
  for (const [role, n] of [
    ['keeper', d.keepers || 0],
    ['janitor', d.janitors || 0],
    ['vet', d.vets || 0],
  ])
    for (let k = 0; k < n; k++) {
      const c = makeCandidate(role);
      c.skill = 2;
      c.wage = fairWage(role, 2);
      addStaff(c);
    }
}

// the shop most in need of goods that no other hauler is already bringing some to
function neediestShop(s) {
  let best = null,
    bestShare = 0.6;
  for (const a of stockedShops()) {
    if (S.staff.some((o) => o !== s && o.job && o.job.kind === 'drop' && o.job.id === a)) continue;
    const sh = stockShare(a);
    if (sh < bestShare) {
      bestShare = sh;
      best = a;
    }
  }
  return best;
}
// the path tiles beside a shop's front
function shopDoor(a) {
  const out = new Set();
  for (const i of buildingTiles(a)) for (const n of nbr4(i)) if (isPath(n)) out.add(n);
  return out;
}
