/* Monthly upkeep (fence wear, repairs, escapes), month-end report and births, tier unlocks, shows, and the main tick. */
function monthlyUpkeep() {
  const fu = farmUpkeep();
  S.money -= fu;
  S.today.run += fu;
  // fences wear every month; janitors walk out and repair them (see sim/staff.js)
  for (const e of S.encl) {
    if (e.biome === 'pool') continue;
    e.cond = Math.max(0, (e.cond ?? 100) - rnd(3, 7));
  }
  for (const a of S.animals) {
    if (a.escaped) continue;
    const e = F.emap[a.e];
    if (!e || e.biome === 'pool') continue;
    const c = care(a.sp),
      fs = FSTR[e.fence || 'wood'] * ((e.cond ?? 100) >= 40 ? 1 : 0.6);
    if (c.str > fs && a.happy < 55 && Math.random() < 0.35) {
      escape(a, e);
    }
  }
}
function escape(a, e) {
  a.escaped = true;
  a.escT = 0;
  const sp = SPECIES[a.sp];
  // step outside the fence on the nearest side
  const opts = (F.eedges[e.id] || []).map(([x, y, dr]) =>
    dr === 0 ? [x + 0.5, y - 0.5] : dr === 1 ? [x + 0.5, y + 1.5] : dr === 2 ? [x - 0.5, y + 0.5] : [x + 1.5, y + 0.5]
  );
  if (!opts.length) opts.push([e.x - 0.5, a.y]);
  const pt = opts.sort((p, q) => Math.hypot(p[0] - a.x, p[1] - a.y) - Math.hypot(q[0] - a.x, q[1] - a.y))[0];
  a.x = clamp(pt[0], 0.5, W - 0.5);
  a.y = clamp(pt[1], 0.5, H - 0.5);
  a.tx = a.x;
  a.ty = a.y;
  a.wait = 0;
  e.cond = Math.min(e.cond ?? 100, 20);
  dirty = true;
  toast(`${a.name} the ${sp.name.toLowerCase()} broke out of the habitat! Tap the animal and choose Recapture.`, 'bad');
}
function recapture(a) {
  const e = F.emap[a.e];
  if (!e) return;
  a.escaped = false;
  [a.x, a.y] = randPointIn(e, a);
  a.tx = a.x;
  a.ty = a.y;
  a.ox = a.x;
  a.oy = a.y;
  a.wait = 40;
}
function endDay() {
  monthlyUpkeep();
  staffMonth();
  const t = S.today;
  toast(
    `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][(S.day - 1) % 12]} closed: ${t.vis} visitors, ${money(t.inc)} earned, ${money(t.run)} in running costs.`,
    t.inc >= t.run ? 'good' : 'bad'
  );
  // births
  for (const e of S.encl) {
    const list = S.animals.filter((a) => a.e === e.id),
      area = encTiles(e).length;
    const need = list.reduce((s, a) => s + SPECIES[a.sp].space, 0);
    for (const k of new Set(list.map((a) => a.sp))) {
      const g = list.filter((a) => a.sp === k),
        sp = SPECIES[k];
      const avg = g.reduce((s, a) => s + a.happy, 0) / g.length;
      if (g.length >= 2 && avg > 75 && area >= need + sp.space && Math.random() < 0.3) {
        const b = addAnimal(k, e, g[0].x, g[0].y);
        b.parents = [g[0].name, g[1].name];
        b.happy = avg;
        b.target = avg;
        toast(`A baby ${sp.name.toLowerCase()} was born!`, 'good');
        break;
      }
    }
  }
  for (const a of S.animals) {
    if (a.sick) continue;
    const e = F.emap[a.e];
    const p = 0.02 + (a.happy < 40 ? 0.05 : 0) + (e && e.dirt > 60 ? 0.07 : 0) + (a.hunger > 80 ? 0.04 : 0);
    if (Math.random() < p) {
      a.sick = true;
      toast(
        `${a.name} the ${SPECIES[a.sp].name.toLowerCase()} is sick.${staffCount('vet') ? ' A vet is on the way.' : ' Hire a vet or treat them yourself.'}`,
        'bad'
      );
    }
  }
  S.ledger.push({ day: S.day, vis: t.vis, adm: t.adm || 0, shop: t.shop || 0, run: t.run });
  if (S.ledger.length > 7) S.ledger.shift();
  S.day++;
  S.today = { inc: 0, run: 0, vis: 0, adm: 0, shop: 0 };
  save();
}
function tierReq(t) {
  const r = [];
  if (t.rating) r.push({ ok: S.rating >= t.rating, txt: `Zoo rating ${(t.rating / 20).toFixed(1)} stars` });
  if (t.vis) r.push({ ok: (S.totalVis || 0) >= t.vis, txt: `${t.vis.toLocaleString()} visitors all-time` });
  if (t.need) r.push({ ok: !!(F.cnt && F.cnt[t.need]), txt: `Build a ${ITEMS[t.need].name.toLowerCase()}` });
  return r;
}
function checkTier() {
  const next = TIERS[S.tier || 1];
  if (!next) return;
  if (tierReq(next).every((r) => r.ok)) {
    S.tier = next.n;
    toast(
      `Your zoo is now a ${next.name.toLowerCase()}! New animals: ${next.sp.map((k) => SPECIES[k].pl).join(', ')}.`,
      'good'
    );
    if (tool === 'animal') renderTray();
  }
}
function countWatchers() {
  for (const e of S.encl) e.watch = 0;
  for (const g of S.guests) {
    for (const id of F.view[idx(g.x, g.y)] || []) {
      const e = F.emap[id];
      if (e) e.watch++;
    }
  }
}
function runShows() {
  for (let i = 0; i < W * H; i++) {
    if (S.tiles[i].o !== 'stage' || !isAnchor(i)) continue;
    const parts = buildingTiles(i),
      x = i % W,
      y = (i / W) | 0;
    let e = null;
    for (const k of parts) e = e || poolNear(k % W, (k / W) | 0);
    if (!e) continue;
    const cast = S.animals.filter((a) => a.e === e.id && SPECIES[a.sp].show && a.happy > 50 && !a.sick);
    if (!cast.length) continue;
    const fans = S.guests.filter((g) => Math.abs(g.x - x) + Math.abs(g.y - y) <= 6);
    const take = Math.round(40 + fans.length * 6 + cast.length * 15);
    earn(take, 'shop');
    for (const g of fans) {
      g.exc += 9;
      g.show = g.t;
    }
    cast.forEach((a, k) => {
      a.show = 110;
      a.showDelay = k * 14;
      a.wait = Math.max(a.wait, 130);
    });
    const star = SPECIES[cast[0].sp];
    toast(`${star.name} show! ${fans.length} guests watched · ${money(take)} earned.`, 'good');
  }
}
function tick() {
  if (dirty) rebuild();
  S.clock++;
  tickAnimals();
  tickStaff();
  tickLogistics();
  tickFarms();
  tickGuests();
  if (S.clock % TPS === 0) {
    const ex = S.exits.length ? S.exits.reduce((a, b) => a + b, 0) / S.exits.length : 60;
    const ah = S.animals.length ? S.animals.reduce((s, a) => s + a.happy, 0) / S.animals.length : 25;
    const target = 0.55 * ex + 0.45 * ah;
    S.rating += (target - S.rating) * 0.03;
  }
  if (S.clock % 300 === 150) runShows();
  if (S.clock % 40 === 0) checkTier();
  if (S.clock % 60 === 0) countWatchers();
  if (S.clock >= DAY) {
    S.clock = 0;
    endDay();
  }
}
