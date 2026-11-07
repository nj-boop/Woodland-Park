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
  S.cands = ['keeper', 'keeper', 'janitor', 'janitor', 'vet', 'vet'].map(makeCandidate);
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
  if (role === 'keeper')
    return !n.lodge
      ? 'Build a keeper lodge (and a recycling yard).'
      : !n.recycle
        ? 'The lodge opens once you build a recycling yard.'
        : 'Build another keeper lodge for 4 more.';
  if (role === 'vet') return 'Each vet clinic has room for 2.';
  return 'Each recycling yard has room for 3.';
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
    // crossing a habitat fence: only through a gate
    if (tb.e && !hasGate(F.emap[tb.e], b, dr ^ 1)) return false;
    if (ta.e && !hasGate(F.emap[ta.e], a, dr)) return false;
  }
  if (tb.e) {
    if (F.emap[tb.e] && F.emap[tb.e].biome === 'pool') return false;
    if (tb.w || tb.o === 'pond') return false;
    const it = tb.o && ITEMS[tb.o];
    if (it && (it.form === 'rock' || it.kind === 'shelter')) return false;
    return true;
  }
  if (tb.t === 'p') return true;
  if (tb.w) return false;
  if (tb.o) {
    const it = ITEMS[tb.o];
    if (!it || !(it.kind === 'plant' && it.form !== 'rock' && it.form !== 'tree')) return false;
  }
  return true;
}
const stepCost = (b) => (S.tiles[b].t === 'p' ? 1 : S.tiles[b].e ? 1.6 : 2.4);
// cheapest route from tile `from` to the nearest tile in `goals` (a Set of tile indices); null if none can be reached
function staffRoute(from, goals) {
  if (goals.has(from)) return [];
  const N = W * H,
    dist = new Float64Array(N).fill(Infinity), // 64-bit: rounding to 32 bits would make the pop check skip nodes
    prev = new Int32Array(N).fill(-1),
    heap = [];
  const push = (i, d) => {
    heap.push([d, i]);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heap[p][0] <= heap[k][0]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0],
      last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1,
          r = l + 1;
        let m = k;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        k = m;
      }
    }
    return top;
  };
  dist[from] = 0;
  push(from, 0);
  while (heap.length) {
    const [d, c] = pop();
    if (d > dist[c]) continue;
    if (goals.has(c)) {
      const out = [];
      for (let k = c; k !== from; k = prev[k]) out.push(k);
      return out.reverse();
    }
    const x = c % W,
      y = (c / W) | 0;
    for (let dr = 0; dr < 4; dr++) {
      const nx = x + DIRS[dr][0],
        ny = y + DIRS[dr][1];
      if (!inB(nx, ny)) continue;
      const n = idx(nx, ny);
      if (!staffStep(c, n, dr)) continue;
      const nd = d + stepCost(n);
      if (nd < dist[n]) {
        dist[n] = nd;
        prev[n] = c;
        push(n, nd);
      }
    }
  }
  return null;
}

/* ---------- where each job is done ---------- */
// tiles from which a habitat can be serviced: inside it (through a gate) for land habitats, beside it for tanks
function serviceTiles(e) {
  const out = new Set(),
    ts = F.etiles[e.id] || [];
  if (e.biome === 'pool') {
    for (const i of ts) for (const n of nbr4(i)) if (!S.tiles[n].e && S.tiles[n].t === 'p') out.add(n);
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
  const out = new Set(),
    home = STAFF_ROLES[role].home;
  for (let i = 0; i < W * H; i++) if (S.tiles[i].o === home) for (const n of nbr4(i)) if (!S.tiles[n].e) out.add(n);
  return out;
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
// habitats keepers cannot reach (no gate); the habitat panel warns about these
function unreachable(e) {
  return e.biome !== 'pool' && !(e.gates || []).length;
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
    if (best) return { kind: 'tend', id: best.id, goals: serviceTiles(best) };
  }
  if (s.role === 'vet') {
    const sick = S.animals
      .filter((a) => a.sick && !taken('treat', a.id))
      .sort((a, b) => a.health - b.health)
      .find((a) => a.escaped || !unreachable(F.emap[a.e]));
    if (sick) {
      const e = F.emap[sick.e];
      const goals = sick.escaped || e.biome !== 'pool' ? around(sick.x, sick.y) : serviceTiles(e);
      return { kind: 'treat', id: sick.id, goals };
    }
  }
  if (s.role === 'janitor') {
    const worn = S.encl
      .filter((e) => e.biome !== 'pool' && (e.cond ?? 100) < FENCE_AT && !taken('fence', e.id))
      .sort((a, b) => (a.cond ?? 100) - (b.cond ?? 100))[0];
    if (worn) return { kind: 'fence', id: worn.id, goals: fenceSideTiles(worn) };
    const litter = new Set();
    for (let i = 0; i < W * H; i++) if (S.tiles[i].l > 0 && !taken('sweep', i)) litter.add(i);
    if (litter.size) return { kind: 'sweep', id: -1, goals: litter };
  }
  return null;
}

/* ---------- each tick ---------- */
const workRate = (s) =>
  STAFF_TRAITS[s.trait].speed * (0.75 + 0.1 * s.skill) * (0.6 + 0.6 * (s.morale / 100)) * (s.energy > 0 ? 1 : 0.6);
const JOB_TIME = { tend: 70, treat: 90, catch: 50, fence: 110, sweep: 14 };
const JOB_TEXT = {
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
      for (const a of S.animals)
        if (a.e === e.id && !a.escaped && a.hunger > 15) {
          cost += DIET[care(a.sp).diet].cost;
          a.hunger = 0;
          if (gentle) a.happy = Math.min(100, a.happy + 6);
        }
      e.dirt = Math.max(0, (e.dirt || 0) - 60);
      S.money -= cost + 5;
      S.today.run += cost + 5;
      ok = true;
    }
  } else if (j.kind === 'treat') {
    const a = S.animals.find((k) => k.id === j.id);
    if (a && a.sick) {
      a.sick = false;
      a.health = Math.min(100, a.health + (gentle ? 40 : 30));
      S.money -= TREAT_COST;
      S.today.run += TREAT_COST;
      toast(`${s.name} treated ${a.name} the ${SPECIES[a.sp].name.toLowerCase()}.`, 'good');
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
  } else if (j.kind === 'sweep') {
    const t = S.tiles[sTile(s)];
    if (t.l > 0) {
      t.l--;
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
  if (j.kind === 'fence') return !!F.emap[j.id];
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
  if (j.kind === 'fence' && F.emap[j.id]) return fenceSideTiles(F.emap[j.id]);
  const t = jobTarget(s);
  if (t >= 0) return around((t % W) + 0.5, ((t / W) | 0) + 0.5);
  if (j.kind === 'sweep') {
    const g = new Set();
    for (let i = 0; i < W * H; i++) if (S.tiles[i].l > 0) g.add(i);
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
      over = s.tired > 200 ? -8 : 0,
      idle = s.done === 0 ? -3 : 2;
    s.mood = { pay: Math.round(pay), over, idle, trait: STAFF_TRAITS[s.trait].mood };
    s.morale = clamp(s.morale + pay + over + idle + STAFF_TRAITS[s.trait].mood, 0, 100);
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
  if (s.st === 'rest') return 'Resting at the ' + ITEMS[STAFF_ROLES[s.role].home].name.toLowerCase();
  if (s.going === 'home') return 'Heading off for a break';
  const j = s.job;
  if (!j) return s.energy <= 0 ? 'Exhausted' : 'Waiting for work';
  const verb = (s.st === 'walk' ? 'On the way: ' : '') + JOB_TEXT[j.kind];
  if (j.kind === 'tend' || j.kind === 'fence') {
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
