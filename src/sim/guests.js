/* Money in and out, guest arrival, pathfinding choices, shop and service interactions, mood and thoughts. */
/* ---------- simulation ---------- */
function spend(n, what) {
  if (S.money < n) {
    toast(`Not enough cash for ${what}. You need ${money(n)}.`, 'bad');
    return false;
  }
  S.money -= n;
  return true;
}
function earn(n, k) {
  S.money += n;
  S.today.inc += n;
  S.today[k || 'adm'] = (S.today[k || 'adm'] || 0) + n;
}
function willing(k) {
  return clamp(1.15 - (S.prices[k] - BASE_PRICE[k]) / (BASE_PRICE[k] * 1.4), 0.05, 1);
}
function attraction() {
  let a = 0;
  for (const an of S.animals) a += SPECIES[an.sp].appeal * (0.35 + (0.65 * an.happy) / 100);
  return a;
}
function spawnRate() {
  const A = attraction();
  const base = S.animals.length ? 0.12 + A * 0.02 : 0.04;
  const rf = 0.35 + S.rating / 100;
  const pf = S.admission === 0 ? 1.7 : clamp(1.55 - S.admission / 30, 0.12, 1.6);
  return base * rf * pf * (1 + AWARD_FAME * (S.fame || 0)) * (researched('market') ? 1.15 : 1);
}
function spawnGuest() {
  const gi = idx(GATE.x, GATE.y);
  if (!nbr4(gi).some(guestPath)) return;
  const g = {
    id: S.nextId++,
    name: pick(NAMES),
    fx: GATE.x,
    fy: GATE.y,
    x: GATE.x,
    y: GATE.y,
    p: 1,
    hunger: rnd(5, 35),
    thirst: rnd(5, 35),
    bath: rnd(0, 30),
    energy: rnd(80, 100),
    exc: 0,
    seen: [],
    mem: [],
    t: 0,
    stay: rnd(600, 1400) | 0,
    mode: 'walk',
    rest: 0,
    trash: 0,
    h: 60,
    spent: S.admission,
    best: null,
    bestA: 0,
    litter: 0,
    shirt: pick(SHIRTS),
    skin: pick(SKIN),
    thought: 'Excited to see some animals!',
  };
  S.guests.push(g);
  earn(S.admission);
  S.today.vis++;
  S.totalVis = (S.totalVis || 0) + 1;
  return g;
}
/* A guest whose path was removed from under them walks across open ground to the nearest
   footpath: a breadth-first search around habitats, water and buildings. Returns the first step. */
function wayBackToPath(i) {
  const prev = new Map([[i, -1]]),
    q = [i];
  for (let h = 0; h < q.length && h < 6000; h++) {
    const c = q[h];
    if (c !== i && guestPath(c)) {
      let s = c;
      while (prev.get(s) !== i) s = prev.get(s);
      return s;
    }
    for (const n of nbr4(c)) {
      if (prev.has(n)) continue;
      const t = S.tiles[n];
      const open =
        guestPath(n) ||
        (!t.e && !t.w && t.t !== 'p' && !(t.o && ITEMS[t.o].kind !== 'plant' && ITEMS[t.o].kind !== 'decor'));
      if (!open) continue;
      prev.set(n, c);
      q.push(n);
    }
  }
  return null;
}
function chooseNext(g) {
  const i = idx(g.x, g.y),
    ns = nbr4(i).filter(guestPath);
  if (!ns.length) return guestPath(i) ? null : wayBackToPath(i); // stranded off the paths: head back
  let fld = null;
  if (g.mode === 'leave') fld = F.gate;
  else if (g.hunger > 65 && F.food2[i] > 0) fld = F.food2;
  else if (g.thirst > 65 && F.drink[i] > 0) fld = F.drink;
  else if (g.bath > 70 && F.restroom[i] > 0) fld = F.restroom;
  else if (g.energy < 30 && F.bench[i] > 0) fld = F.bench;
  if (fld && Math.random() < 0.88) {
    const c = ns.filter((n) => fld[n] >= 0 && fld[n] < fld[i]);
    if (c.length) return pick(c);
  }
  const prev = idx(g.fx, g.fy);
  const w = ns.map((n) => (n === prev && ns.length > 1 ? 0.15 : g.mem.includes(n) ? 1 : 4));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let k = 0; k < ns.length; k++) {
    r -= w[k];
    if (r <= 0) return ns[k];
  }
  return ns[ns.length - 1];
}
function arrive(g) {
  const i = idx(g.x, g.y);
  g.mem.push(i);
  if (g.mem.length > 24) g.mem.shift();
  for (const eid of F.view[i] || []) {
    if (g.seen.includes(eid)) continue;
    const list = S.animals.filter((a) => a.e === eid && !a.away && a.inside == null); // out where guests can see them
    if (!list.length) continue;
    g.seen.push(eid);
    const kinds = [...new Set(list.map((a) => a.sp))];
    let v = 0;
    for (const k of kinds) {
      const sp = SPECIES[k];
      const avg =
        list.filter((a) => a.sp === k).reduce((s, a) => s + a.happy, 0) / list.filter((a) => a.sp === k).length;
      v += sp.appeal * (0.3 + (0.7 * avg) / 100);
      if (sp.appeal > g.bestA) {
        g.bestA = sp.appeal;
        g.best = sp.pl;
      }
    }
    v += (list.length - kinds.length) * 0.6;
    if (F.emap[eid] && F.emap[eid].fence === 'moat') v *= 1.2;
    // a keeper or vet at work in the habitat is part of the show
    if (S.staff.some((s) => (s.role === 'keeper' || s.role === 'vet') && S.tiles[sTile(s)].e === eid)) {
      v += 4;
      g.keeper = g.t;
    }
    g.exc += v;
  }
  // the vet clinic's viewing gallery: stop and watch while an operation is going on
  const gal = F.gallery && F.gallery.get(i);
  if (gal != null && g.mode === 'walk' && !g.vet && clinicBusy(gal) && Math.random() < 0.6) {
    g.vet = g.t;
    g.mode = 'watch';
    g.rest = 140;
    g.exc += 9;
    g.watchAt = gal;
    if (Math.random() < 0.35) {
      earn(2, 'shop');
      const r = S.sold[gal] || (S.sold[gal] = { m: 0, l: 0 });
      r.m += 2; // donations at the gallery
    }
    return;
  }
  // keepers at work at an animal house: guests nearby stop for a look
  const hv = F.houseView && F.houseView.get(i);
  if (hv != null && !(g.kt || []).includes(hv) && keeperAtHouse(hv)) {
    (g.kt ||= []).push(hv);
    g.exc += 5;
    g.keeper = g.t;
  }
  const atmB = F.atm && F.atm[i] ? 1.18 : 1;
  const at = F.shopAt[i];
  // stocked shops can sell out; `sell` uses one unit and says whether there was any
  const sell = (s) => {
    if (!at || at[s] == null || !STOCK[s]) return true;
    if (stockOf(at[s]) <= 0) {
      g.gripe = 'soldout';
      return false;
    }
    S.stock[at[s]] = stockOf(at[s]) - 1;
    return true;
  };
  // takings, also counted per building for the building inspector
  const took = (s, n, a = at && at[s]) => {
    earn(n, 'shop');
    g.spent += n;
    if (a == null) return;
    const r = S.sold[a] || (S.sold[a] = { m: 0, l: 0 });
    r.m += n;
  };
  for (const s of F.shops[i] || []) {
    if (s === 'restroom' && g.bath > 45) {
      g.bath = 0;
      continue;
    }
    if (
      s === 'restaurant' &&
      g.hunger > 40 &&
      g.mode !== 'leave' &&
      Math.random() < willing('food') * atmB &&
      sell(s)
    ) {
      g.hunger = 0;
      g.thirst = Math.max(0, g.thirst - 40);
      took(s, ITEMS.restaurant.price);
      g.mode = 'rest';
      g.rest = 60;
      g.trash = 0;
      continue;
    }
    if (
      s === 'gift' &&
      (g.mode === 'leave' || g.t > g.stay * 0.6) &&
      !g.gift &&
      Math.random() < (0.15 + g.h / 150) * atmB &&
      sell(s)
    ) {
      g.gift = 1;
      took(s, ITEMS.gift.price);
      continue;
    }
    if (s === 'station' && !g.rode && g.mode === 'walk' && g.t > 120 && Math.random() < 0.3 * atmB) {
      // find the station this path tile serves
      let st = null;
      for (const n of nbr4(i)) if (S.tiles[n].o === 'station' && F.tours[anchorOf(n)]) st = anchorOf(n);
      if (st != null) {
        const tour = F.tours[st];
        g.rode = 1;
        g.mode = 'ride';
        g.rideT = Math.min(1500, tour.walk.length * RIDE_TICKS_PER_TILE);
        g.rideVal = tour.value;
        took(s, ITEMS.station.price, st);
        continue;
      }
    }
    if (s === 'map' && !g.map) {
      g.map = 1;
      g.stay += 200;
      g.exc += 1;
      continue;
    }
    if (s === 'donation' && !g.don && g.exc > 10 && Math.random() < 0.5) {
      g.don = 1;
      const amt = Math.round(1 + g.exc / 8);
      earn(amt, 'shop');
      if (at && at.donation != null) {
        const r = S.sold[at.donation] || (S.sold[at.donation] = { m: 0, l: 0 });
        r.m += amt;
      }
      continue;
    }
    if (s === 'playground' && !g.play) {
      g.play = 1;
      g.exc += 4;
      g.energy = Math.max(10, g.energy - 10);
      continue;
    }
    if (s === 'picnic' && g.energy < 55 && g.mode === 'walk') {
      g.mode = 'rest';
      g.rest = 60;
      continue;
    }
    if (s === 'food' && g.hunger > 45 && g.mode !== 'leave') {
      if (Math.random() < willing('food') * atmB && sell(s)) {
        g.hunger = Math.max(0, g.hunger - 75);
        took(s, S.prices.food);
        g.trash = rnd(160, 320) | 0;
        g.gripe = 0;
      } else if (g.gripe !== 'soldout') g.gripe = 'food';
    } else if (s === 'drink' && g.thirst > 40 && g.mode !== 'leave') {
      if (Math.random() < willing('drink') * atmB && sell(s)) {
        g.thirst = 0;
        took(s, S.prices.drink);
        g.trash = rnd(140, 260) | 0;
        g.gripe = 0;
      } else if (g.gripe !== 'soldout') g.gripe = 'drink';
    } else if (s === 'bench' && g.energy < 55 && g.mode === 'walk') {
      g.mode = 'rest';
      g.rest = 70;
    }
  }
  if (g.trash > 0 && F.bin[i]) g.trash = 0;
  if (S.tiles[i].e && S.tiles[i].t === 'p' && !g.mem.slice(0, -1).includes(i)) {
    g.exc += 1.2;
    g.tunnel = 1;
  }
  let l = S.tiles[i].l;
  for (const n of nbr4(i)) l += S.tiles[n].l * 0.5;
  g.litter = l;
}
function guestMood(g) {
  let h = 50 + Math.min(38, g.exc * 1.4) + F.scen[idx(g.x, g.y)] * 0 + Math.min(8, (g.scenSum || 0) / 20);
  h -= Math.max(0, (g.bath || 0) - 70) * 0.6 + (g.scared && g.t - g.scared < 300 ? 12 : 0);
  h -= Math.max(0, g.hunger - 60) * 0.55 + Math.max(0, g.thirst - 60) * 0.55 + Math.max(0, 35 - g.energy) * 0.6;
  h -= Math.min(18, g.litter * 4);
  if (S.admission > 30) h -= (S.admission - 30) * 0.7;
  g.h = clamp(h, 0, 100);
  let th;
  if (g.mode === 'leave' && g.h < 35)
    th = S.admission > 30 ? `That was not worth ${money(S.admission)}.` : 'Heading home. That was a letdown.';
  else if (g.mode === 'leave')
    th = g.best ? `Heading home. The ${g.best.toLowerCase()} made my day.` : 'Heading home now.';
  else if (g.gripe && (g.hunger > 60 || g.thirst > 60))
    th =
      g.gripe === 'soldout'
        ? 'The stand was sold out. Restock your shops!'
        : g.gripe === 'food'
          ? `${money(S.prices.food)} for a snack? No thanks.`
          : `${money(S.prices.drink)} for a drink? That's a rip-off.`;
  else if (g.scared && g.t - g.scared < 300) th = "There's a loose animal! I'm getting out of here.";
  else if (g.bath > 85)
    th =
      F.restroom[idx(g.x, g.y)] >= 0
        ? 'I really need to find a restroom.'
        : "There isn't a single restroom in this zoo!";
  else if (g.play && g.t < g.stay * 0.5 && Math.random() < 0.02) th = 'The kids loved the playground.';
  else if (g.hunger > 75)
    th =
      F.food[idx(g.x, g.y)] >= 0 ? "I'm starving. Where's the snack stand?" : "I'm starving and there's no food here.";
  else if (g.thirst > 75) th = 'I really need a drink.';
  else if (g.energy < 25) th = 'My feet hurt. I need somewhere to sit.';
  else if (g.litter >= 2) th = 'This path is covered in trash.';
  else if (g.trash > 0 && g.trash < 80) th = "I can't find a trash bin anywhere.";
  else if (g.mode === 'ride') th = 'On the safari! Look at them all!';
  else if (g.safari && g.t - g.safari < 600) th = 'That safari drive was the best thing here!';
  else if (g.show && g.t - g.show < 500) th = 'That show was incredible!';
  else if (g.mode === 'watch') th = 'Watching the vets operate. Fascinating!';
  else if (g.keeper && g.t - g.keeper < 400) th = 'We got to watch a keeper working with the animals!';
  else if (g.vet && g.t - g.vet < 500) th = 'I saw a real animal operation at the vet clinic!';
  else if (g.tunnel && g.exc > 8) th = 'Walking under the water was the best part!';
  else if (g.exc > 18 && g.best) th = `The ${g.best.toLowerCase()} were amazing!`;
  else if (g.exc > 0 && g.best) th = `I liked the ${g.best.toLowerCase()}. What else is here?`;
  else if (g.t > 300) th = 'Where are all the animals?';
  else th = 'What a lovely day for the zoo.';
  g.thought = th;
}
// shop-kind items guests don't buy anything from
const NOT_SOLD = new Set(['stage', 'bin', 'atm', 'parking']);
/* Parking: guests come by car, about 3 to a car. The roadside fits 15 cars and each lot 30 more.
   When the lots are full, people park off-site and far fewer bother to come. */
const GUESTS_PER_CAR = 3,
  STREET_CARS = 15,
  LOT_CARS = 30;
const parkingSpaces = () => STREET_CARS + LOT_CARS * ((F.cnt && F.cnt.parking) || 0);
const carsParked = () => Math.ceil(S.guests.length / GUESTS_PER_CAR);
const parkingFull = () => carsParked() >= parkingSpaces();
// chance per tick that a new visitor turns up: a quarter as likely when they'd have to park off-site
const arrivalChance = () => (spawnRate() / TPS) * (parkingFull() ? 0.25 : 1) * (isNight() ? 0.3 : 1);
// how many guests can be in the zoo at once: grows with the land, up to the most we draw
const guestCap = () => Math.min(GMAX, Math.round(220 + (W * H - 936) / 30));
function tickGuests() {
  const sp = spawnRate() / TPS;
  // full car parks turn most visitors away
  const full = parkingFull();
  if (full && !S.parkWarned) {
    S.parkWarned = true;
    toast(
      'The car park is full. Visitors are parking off-site and many are giving up. Build a parking lot by the road.',
      'bad'
    );
  }
  if (!full) S.parkWarned = false;
  if (S.guests.length < guestCap() && Math.random() < arrivalChance()) spawnGuest();
  else if (full && Math.random() < sp * 0.75) S.today.turned = (S.today.turned || 0) + 1;
  const out = [];
  for (const g of S.guests) {
    g.t++;
    if (g.mode === 'ride') {
      // out on a safari; back at the station afterwards, thrilled
      if (--g.rideT <= 0) {
        g.mode = 'walk';
        g.exc += g.rideVal;
        g.safari = g.t;
      }
      out.push(g);
      continue;
    }
    g.hunger = Math.min(100, g.hunger + 0.06);
    g.bath = Math.min(100, (g.bath || 0) + 0.05);
    g.thirst = Math.min(100, g.thirst + 0.08);
    if (g.mode === 'watch') {
      if (--g.rest <= 0 || !clinicBusy(g.watchAt)) g.mode = 'walk';
      out.push(g);
      continue;
    }
    if (g.mode === 'rest') {
      g.energy = Math.min(100, g.energy + 0.9);
      if (--g.rest <= 0) g.mode = 'walk';
      out.push(g);
      continue;
    }
    g.energy = Math.max(0, g.energy - 0.05);
    g.scenSum = (g.scenSum || 0) * 0.995 + F.scen[idx(g.x, g.y)];
    if (g.trash > 0 && --g.trash === 0) {
      const t = tileAt(g.x, g.y);
      if (t.t === 'p') {
        t.l = Math.min(4, t.l + 1);
        F.litter.add(idx(g.x, g.y));
      }
    }
    if (g.t % 20 === g.id % 20) {
      guestMood(g);
      if (g.mode === 'walk' && (g.t > g.stay || g.energy <= 0 || (g.h < 18 && g.t > 240))) g.mode = 'leave';
    }
    g.p += 0.07;
    if (g.p >= 1) {
      g.fx = g.x;
      g.fy = g.y;
      if (g.mode === 'leave' && ((g.x === GATE.x && g.y === GATE.y) || F.gate[idx(g.x, g.y)] < 0) && g.t > 5) {
        S.exits.push(g.h);
        if (S.exits.length > 40) S.exits.shift();
        if (sel && sel.type === 'guest' && sel.id === g.id) closeInspector();
        continue;
      }
      arrive(g);
      const n = chooseNext(g);
      if (n != null) {
        g.x = n % W;
        g.y = (n / W) | 0;
        g.p -= 1;
      } else g.p = 1;
    }
    out.push(g);
  }
  S.guests = out;
}
