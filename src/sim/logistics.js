/* Deliveries. Once the zoo has a loading dock and a feed store, animal feed is bought in bulk:
   a truck drives in along the paths to the dock and unloads crates, haulers carry the crates into
   the feed store, and keepers collect feed there before heading to a habitat. Without both
   buildings, feed is couriered straight to the keepers at the full price, as before.

   Feed is counted in "meal units": one animal's meal costs DIET[diet].cost / 3 units.
   Bulk feed costs FEED_UNIT per unit, 60% of the courier price. */

/* Shop stock. Each stocked shop holds `max` sales; `unit` is what one sale's stock costs by courier.
   Without a loading dock, shops are topped up by courier when they drop below a quarter. With one,
   goods crates (40 sales each, at 60% of the courier price) come on the delivery truck and haulers
   carry them to whichever shop is lowest. */
const STOCK = {
  food: { max: 80, unit: 1.2 },
  drink: { max: 80, unit: 0.8 },
  gift: { max: 40, unit: 4 },
  restaurant: { max: 60, unit: 3 },
};
const GOODS_CRATE = 40;
const stockOf = (a) => S.stock[a] ?? (STOCK[S.tiles[a] && S.tiles[a].o] || { max: 0 }).max;
function stockedShops() {
  const out = [];
  for (let i = 0; i < W * H; i++) {
    const o = S.tiles[i].o;
    if (o && STOCK[o] && isAnchor(i)) out.push(i);
  }
  return out;
}
const stockShare = (a) => stockOf(a) / STOCK[S.tiles[a].o].max;
// goods already on their way to a shop (in crates, trucks or haulers' arms)
function goodsInbound() {
  let n = 0;
  for (const c of S.crates) if (c.kind === 'goods') n += c.n;
  for (const t of S.trucks) for (const c of t.goods || []) n += c;
  for (const s of S.staff) if (s.carryKind === 'goods') n += s.carry || 0;
  return n;
}
function courierRestock() {
  for (const a of stockedShops()) {
    const k = STOCK[S.tiles[a].o];
    if (stockOf(a) >= k.max * 0.25) continue;
    const cost = Math.round((k.max - stockOf(a)) * k.unit);
    if (S.money < cost) continue;
    S.money -= cost;
    S.today.run += cost;
    S.stock[a] = k.max;
  }
}
// with a dock: how many goods crates the next truck should bring
function goodsToOrder() {
  let deficit = 0;
  for (const a of stockedShops()) if (stockShare(a) < 0.4) deficit += STOCK[S.tiles[a].o].max - stockOf(a);
  deficit -= goodsInbound();
  return deficit >= GOODS_CRATE / 2 ? Math.min(TRUCK_CRATES, Math.ceil(deficit / GOODS_CRATE)) : 0;
}

/* Waste. Janitors bag the litter they sweep and drop the bags at a recycling yard; when the yards
   fill up, a garbage truck collects. Full yards stop janitors from emptying their bags. */
const WASTE_PER_YARD = 150,
  BAG_SIZE = 6, // sweeps per bag
  PICKUP_COST = 60;
const wasteCapacity = () => WASTE_PER_YARD * ((F.cnt && F.cnt.recycle) || 0);
function yardBay() {
  const out = new Set();
  for (let i = 0; i < W * H; i++)
    if (S.tiles[i].o === 'recycle' && isAnchor(i)) {
      const p = planOf(i);
      for (const k of frontTiles(p.x0, p.y0, p.fw, p.fh, p.r)) if (S.tiles[k].t === 'p') out.add(k);
    }
  return out;
}

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
  for (const c of S.crates) if (c.kind !== 'goods') n += c.n;
  for (const t of S.trucks) for (const c of t.cargo) n += c;
  for (const s of S.staff) if (s.carry && s.carryKind !== 'goods') n += s.carry;
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
function warnOnce(msg) {
  if (S.clock - feedWarnAt > DAY) {
    feedWarnAt = S.clock;
    toast(msg, 'bad');
  }
}
function sendTruck(type, goals, cargo, goods, dock) {
  const route = staffRoute(idx(GATE.x, GATE.y), goals, truckStep, truckCost);
  if (!route) return false;
  S.trucks.push({
    id: S.nextId++,
    type,
    x: GATE.x + 0.5,
    y: GATE.y + 0.5,
    ox: GATE.x + 0.5,
    oy: GATE.y + 0.5,
    dir: Math.PI,
    path: route,
    st: 'in',
    wt: 0,
    dock,
    cargo,
    goods,
  });
  return true;
}
function orderDeliveries() {
  if (!F.cnt || !F.cnt.dock || S.trucks.some((t) => t.type === 'delivery')) return;
  let feedCrates = 0;
  if (feedByTruck()) {
    const room = feedCapacity() - S.feed - feedInbound();
    if (S.feed + feedInbound() <= feedCapacity() * 0.5 && room >= CRATE_UNITS)
      feedCrates = Math.min(TRUCK_CRATES, Math.floor(room / CRATE_UNITS));
  }
  const goodsCrates = Math.min(TRUCK_CRATES - feedCrates, goodsToOrder());
  if (!feedCrates && !goodsCrates) return;
  const a = dockTiles().find((d) => dockBay(d).size);
  if (a == null) return;
  const cost = Math.round(feedCrates * CRATE_UNITS * FEED_UNIT + goodsCrates * GOODS_CRATE * 1.5 * 0.6);
  if (S.money < cost) return warnOnce(`Not enough money for the next delivery (${money(cost)}).`);
  if (!sendTruck('delivery', dockBay(a), Array(feedCrates).fill(CRATE_UNITS), Array(goodsCrates).fill(GOODS_CRATE), a))
    return warnOnce(
      'A delivery truck could not reach the loading dock. Connect it to the entrance with a path or service road.'
    );
  S.money -= cost;
  S.today.run += cost;
}
function orderPickup() {
  if (S.trucks.some((t) => t.type === 'garbage') || S.waste < Math.max(40, wasteCapacity() * 0.4)) return;
  const bay = yardBay();
  if (!bay.size || !sendTruck('garbage', bay, [], [], -1))
    return warnOnce(
      'The garbage truck could not reach a recycling yard. Connect it to the entrance with a path or service road.'
    );
  S.money -= PICKUP_COST;
  S.today.run += PICKUP_COST;
}
function tickTrucks() {
  for (const t of S.trucks) {
    t.ox = t.x;
    t.oy = t.y;
    if (t.st === 'unload') {
      if (--t.wt <= 0) {
        if (t.type === 'garbage') S.waste = 0;
        for (const n of t.cargo) S.crates.push({ id: S.nextId++, dock: t.dock, n, kind: 'feed' });
        for (const n of t.goods || []) S.crates.push({ id: S.nextId++, dock: t.dock, n, kind: 'goods' });
        t.cargo = [];
        t.goods = [];
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
  if (S.clock % 40 === 0) {
    if (F.cnt && F.cnt.dock) orderDeliveries();
    else courierRestock();
    orderPickup();
  }
  tickTrucks();
}
