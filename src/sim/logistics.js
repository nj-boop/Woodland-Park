/* Deliveries. Once the zoo has a loading dock and a feed store, animal feed is bought in bulk:
   a truck drives in along the paths to the dock and unloads crates, haulers carry the crates into
   the feed store, and keepers collect feed there before heading to a habitat. Without both
   buildings, feed is couriered straight to the keepers at the full price, as before.

   Feed is counted in "meal units": one animal's meal costs DIET[diet].cost / 3 units.
   Bulk feed costs FEED_UNIT per unit, 60% of the courier price. */

const FEED_UNIT = 1.8,
  CRATE_UNITS = 25,
  STORE_UNITS = 300, // per feed store
  TRUCK_CRATES = 8,
  TRUCK_SPEED = 0.11; // tiles per tick
const mealUnits = (sp) => DIET[care(sp).diet].cost / 3;
const feedByTruck = () => !!(F.cnt && F.cnt.dock && F.cnt.feedstore);
const feedCapacity = () => STORE_UNITS * ((F.cnt && F.cnt.feedstore) || 0);
function feedInbound() {
  let n = 0;
  for (const c of S.crates) n += c.n;
  for (const t of S.trucks) for (const c of t.cargo) n += c;
  for (const s of S.staff) if (s.carry) n += s.carry;
  return n;
}

// trucks drive on any path outside habitats (service roads included)
const truckStep = (a, b) => S.tiles[b].t === 'p' && !S.tiles[b].e;
const truckCost = () => 1;
function dockTiles() {
  const out = [];
  for (let i = 0; i < W * H; i++) if (S.tiles[i].o === 'dock' && isAnchor(i)) out.push(i);
  return out;
}
// the path tiles in front of a dock, where trucks pull up
function dockBay(a) {
  const p = planOf(a);
  return new Set(frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).filter((i) => S.tiles[i].t === 'p'));
}

let feedWarnAt = -1e9;
function orderFeed() {
  if (!feedByTruck() || S.trucks.length) return;
  const room = feedCapacity() - S.feed - feedInbound();
  if (S.feed + feedInbound() > feedCapacity() * 0.5 || room < CRATE_UNITS) return;
  const docks = dockTiles();
  const a = docks.find((d) => dockBay(d).size);
  if (a == null) return;
  const crates = Math.min(TRUCK_CRATES, Math.floor(room / CRATE_UNITS)),
    cost = Math.round(crates * CRATE_UNITS * FEED_UNIT);
  if (S.money < cost) {
    if (S.clock - feedWarnAt > DAY) {
      feedWarnAt = S.clock;
      toast(`Not enough money to order feed (${money(cost)}).`, 'bad');
    }
    return;
  }
  const gi = idx(GATE.x, GATE.y);
  const route = staffRoute(gi, dockBay(a), truckStep, truckCost);
  if (!route) {
    if (S.clock - feedWarnAt > DAY) {
      feedWarnAt = S.clock;
      toast(
        'A feed truck could not reach the loading dock. Connect it to the entrance with a path or service road.',
        'bad'
      );
    }
    return;
  }
  S.money -= cost;
  S.today.run += cost;
  S.trucks.push({
    id: S.nextId++,
    x: GATE.x + 0.5,
    y: GATE.y + 0.5,
    ox: GATE.x + 0.5,
    oy: GATE.y + 0.5,
    dir: Math.PI,
    path: route,
    st: 'in',
    wt: 0,
    dock: a,
    cargo: Array(crates).fill(CRATE_UNITS),
  });
}
function tickTrucks() {
  for (const t of S.trucks) {
    t.ox = t.x;
    t.oy = t.y;
    if (t.st === 'unload') {
      if (--t.wt <= 0) {
        for (const n of t.cargo) S.crates.push({ id: S.nextId++, dock: t.dock, n });
        t.cargo = [];
        t.st = 'out';
        t.path =
          staffRoute(idx(Math.floor(t.x), Math.floor(t.y)), new Set([idx(GATE.x, GATE.y)]), truckStep, truckCost) || [];
      }
      continue;
    }
    if (!t.path.length) {
      if (t.st === 'in') {
        t.st = 'unload';
        t.wt = 80;
      } else t.gone = true;
      continue;
    }
    const n = t.path[0],
      cx = (n % W) + 0.5,
      cy = ((n / W) | 0) + 0.5,
      dx = cx - t.x,
      dy = cy - t.y,
      d = Math.hypot(dx, dy);
    if (d <= TRUCK_SPEED) {
      t.x = cx;
      t.y = cy;
      t.path.shift();
    } else {
      t.x += (dx / d) * TRUCK_SPEED;
      t.y += (dy / d) * TRUCK_SPEED;
      t.dir = Math.atan2(dx, dy);
    }
  }
  S.trucks = S.trucks.filter((t) => !t.gone);
}
function tickLogistics() {
  if (S.clock % 40 === 0) orderFeed();
  tickTrucks();
}
