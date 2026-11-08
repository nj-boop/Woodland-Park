/* Habitat contents and care checks, animal happiness, movement, hunting and fleeing, feeding, cleaning, vets. */
function enclStats(e) {
  const ts = encTiles(e),
    area = ts.length || 1;
  let pl = 0;
  const has = {};
  let wet = 0;
  for (const ti of ts) {
    const tl = S.tiles[ti];
    if (tl.w) wet++;
    const o = tl.o;
    if (!o) continue;
    has[o] = (has[o] || 0) + 1;
    if (ITEMS[o].kind === 'plant') pl++;
  }
  if (wet) has.pond = (has.pond || 0) + wet;
  const toys = Object.keys(has).filter((k) => ITEMS[k].kind === 'toy'),
    shelters = Object.keys(has).filter((k) => ITEMS[k].kind === 'shelter');
  return { area, dens: pl / area, plants: pl, has, toys, shelters, water: e.biome === 'pool' || !!has.pond };
}
function careList(e) {
  const st = enclStats(e),
    list = S.animals.filter((a) => a.e === e.id),
    items = [];
  if (!list.length) return items;
  if (e.biome !== 'pool') items.push({ ok: st.water, txt: 'Water hole for drinking' });
  for (const k of new Set(list.map((a) => a.sp))) {
    const c = care(k),
      sp = SPECIES[k];
    if (c.toy)
      items.push({ ok: !!st.has[c.toy], txt: `${ITEMS[c.toy].name} for the ${sp.pl.toLowerCase()}`, item: c.toy });
    if (c.shelter)
      items.push({
        ok: !!st.has[c.shelter],
        txt: `${ITEMS[c.shelter].name} for the ${sp.pl.toLowerCase()}`,
        item: c.shelter,
      });
  }
  const need = Math.max(...list.map((a) => care(a.sp).str));
  const fs = fenceStrength(e);
  if (need > fs)
    items.push({
      ok: false,
      txt: `Stronger fence: ${list.find((a) => care(a.sp).str === need) && SPECIES[list.find((a) => care(a.sp).str === need).sp].pl} can break ${FENCES[e.fence || 'wood'].name.toLowerCase()} fences`,
    });
  return items;
}
function evalEncl(e) {
  const list = animalsByE.size ? animalsIn(e.id) : S.animals.filter((a) => a.e === e.id);
  if (!list.length) return;
  const st = enclStats(e),
    { area, dens } = st;
  const watchers = e.watch || 0;
  const need = list.reduce((s, a) => s + SPECIES[a.sp].space, 0),
    ratio = area / need;
  const preds = list.filter((a) => SPECIES[a.sp].pred);
  for (const a of list) {
    const sp = SPECIES[a.sp],
      why = [];
    let t = 100;
    if (ratio < 1) {
      t -= (1 - ratio) * 60;
      why.push('cramped');
    }
    if (dens < sp.fol) {
      t -= Math.min(25, (sp.fol - dens) * 220);
      why.push('wants more plants');
    }
    if (a.hunger > 50) {
      t -= (a.hunger - 50) * 0.9;
      why.push('hungry');
    }
    const same = list.filter((o) => o.sp === a.sp).length;
    if (sp.social && same === 1) {
      t -= 15;
      why.push('lonely');
    }
    if (!sp.social && same > 2) {
      t -= 12;
      why.push('too many of its own kind');
    }
    if (preds.length && !sp.pred && !e.barrier) {
      t -= 45;
      why.push('frightened by predators');
    }
    if (sp.pred && preds.some((o) => o.sp !== a.sp)) {
      t -= 20;
      why.push('rival predator nearby');
    }
    if (a.sick) {
      t -= 25;
      why.push('sick');
    }
    if (e.dirt > 50) {
      t -= (e.dirt - 50) * 0.5;
      why.push('dirty habitat');
    }
    const c = care(a.sp);
    if (!st.water) {
      t -= 18;
      why.push('thirsty, needs a water hole');
    }
    if (c.toy) {
      if (!st.has[c.toy]) {
        t -= st.toys.length ? 5 : 11;
        why.push(`bored, wants a ${ITEMS[c.toy].name.toLowerCase()}`);
      } else t += 3;
    }
    if (c.shelter) {
      if (!st.has[c.shelter]) {
        t -= st.shelters.length ? 5 : 12;
        why.push(`needs a ${ITEMS[c.shelter].name.toLowerCase()}`);
      }
    }
    if (c.privacy && !st.shelters.length && watchers > 8) {
      t -= 8;
      why.push('wants privacy from crowds');
    }
    if ((e.cond ?? 100) < 40) {
      t -= 6;
      why.push('fence in poor repair');
    }
    a.target = clamp(t, 0, 100);
    a.why = why;
  }
}
// animals grouped by habitat, rebuilt once per tick (looping over every animal for every animal
// was the slowest thing in a big zoo)
let animalsByE = new Map();
function groupAnimals() {
  animalsByE = new Map();
  for (const a of S.animals) {
    let l = animalsByE.get(a.e);
    if (!l) animalsByE.set(a.e, (l = []));
    l.push(a);
  }
}
const animalsIn = (eid) => animalsByE.get(eid) || [];
function tickAnimals() {
  groupAnimals();
  for (const a of S.animals) {
    a.ox = a.x;
    a.oy = a.y;
    if (a.show > 0) {
      if (a.showDelay > 0) a.showDelay--;
      else a.show--;
    }
    a.hunger = Math.min(100, a.hunger + 0.04);
    if (a.sick) a.health -= 0.015;
    else a.health = Math.min(100, a.health + 0.004);
    a.happy += (a.target - a.happy) * 0.004;
    const e = F.emap[a.e];
    if (!e || a.killed) continue;
    const sp = SPECIES[a.sp];
    a.chase = 0;
    if (a.escaped) {
      a.escT++;
      const dx = a.tx - a.x,
        dy = a.ty - a.y,
        d = Math.hypot(dx, dy);
      if (d < 0.05) {
        for (let k = 0; k < 10; k++) {
          const nx = clamp(a.x + rnd(-3, 3), 0.5, W - 0.5),
            ny = clamp(a.y + rnd(-3, 3), 0.5, H - 0.5),
            tl = tileAt(Math.floor(nx), Math.floor(ny));
          if (!tl.e) {
            a.tx = nx;
            a.ty = ny;
            break;
          }
        }
      } else {
        const st = Math.min(0.03, d);
        a.x += (dx / d) * st;
        a.y += (dy / d) * st;
        if (Math.abs(dx) > 0.02) a.dir = dx > 0 ? -1 : 1;
      }
      if (S.clock % 20 === 0)
        for (const g of S.guests)
          if (Math.abs(g.x - a.x) + Math.abs(g.y - a.y) < 4) {
            g.exc = Math.max(0, g.exc - 4);
            g.scared = g.t;
            if (sp.pred || care(a.sp).str >= 3) g.mode = 'leave';
          }
      continue;
    }
    // predators and prey sharing an open pen: hunt and flee
    if (!e.barrier && !a.show) {
      let near = null,
        nd = 1e9;
      for (const o of animalsIn(a.e)) {
        if (o === a || o.e !== a.e || o.killed || !!SPECIES[o.sp].pred === !!sp.pred) continue;
        const dd = Math.hypot(o.x - a.x, o.y - a.y);
        if (dd < nd) {
          nd = dd;
          near = o;
        }
      }
      if (near && sp.pred && (a.hunger > 25 || nd < 2.5)) {
        a.wait = 0;
        a.tx = near.x;
        a.ty = near.y;
        a.chase = 1;
        if (nd < 0.38) {
          near.killed = true;
          yearRec().deaths++;
          a.hunger = 0;
          a.wait = 160;
          toast(
            `${a.name} the ${sp.name.toLowerCase()} attacked ${near.name} the ${SPECIES[near.sp].name.toLowerCase()}! Predators need a barrier between them and prey.`,
            'bad'
          );
          S.rating = Math.max(0, S.rating - 6);
          for (const g of S.guests)
            if (Math.abs(g.x - a.x) + Math.abs(g.y - a.y) < 8) {
              g.exc = Math.max(0, g.exc - 10);
              g.thought = 'I just watched an animal get killed. That was awful.';
            }
          continue;
        }
      } else if (near && !sp.pred && nd < 3) {
        a.wait = 0;
        a.chase = 1;
        const fx = a.x - near.x,
          fy = a.y - near.y,
          fl = Math.hypot(fx, fy) || 1;
        a.tx = a.x + (fx / fl) * 2;
        a.ty = a.y + (fy / fl) * 2;
        if (!inEnc(e, Math.floor(a.tx), Math.floor(a.ty)) || Math.hypot(a.tx - a.x, a.ty - a.y) < 0.3) {
          [a.tx, a.ty] = randPointIn(e, a);
        }
      }
    }
    if (a.wait > 0) {
      a.wait--;
      continue;
    }
    const dx = a.tx - a.x,
      dy = a.ty - a.y,
      d = Math.hypot(dx, dy),
      spd = a.chase ? (sp.pred ? 0.05 : 0.045) : a.happy < 35 ? 0.012 : 0.022;
    const blocked = (x, y) => {
      const fx = Math.floor(x),
        fy = Math.floor(y);
      if (!inB(fx, fy)) return true;
      const t = tileAt(fx, fy);
      if (t.e !== a.e) return true;
      if (e.barrier && !sideOK(e, a, x, y)) return true;
      return (
        (t.o === 'pond' ||
          (ITEMS[t.o] && ITEMS[t.o].form === 'rock') ||
          t.w ||
          (ITEMS[t.o] && ITEMS[t.o].kind === 'shelter')) &&
        !SWIM_Y[a.sp]
      );
    };
    if (d < 0.05) {
      [a.tx, a.ty] = randPointIn(e, a, blocked);
      a.wait = rnd(30, 160) | 0;
    } else {
      const st = Math.min(spd, d),
        nx = a.x + (dx / d) * st,
        ny = a.y + (dy / d) * st;
      if (blocked(nx, ny) && !blocked(a.x, a.y)) {
        // Step around the obstacle (water, rocks, shelters, fences). Each animal prefers one side so
        // a chasing predator slides around a pond instead of freezing in front of it.
        const side = a.id % 2 ? 1 : -1,
          sx = (-dy / d) * st * side,
          sy = (dx / d) * st * side;
        if (!blocked(a.x + sx, a.y + sy)) {
          a.x += sx;
          a.y += sy;
        } else if (!blocked(a.x - sx, a.y - sy)) {
          a.x -= sx;
          a.y -= sy;
        } else if (!a.chase) {
          a.tx = a.x;
          a.ty = a.y;
        }
      } else {
        a.x = nx;
        a.y = ny;
      }
      if (Math.abs(dx) > 0.02) a.dir = dx > 0 ? -1 : 1;
    }
  }
  if (S.animals.some((a) => a.killed)) {
    const gone = S.animals.filter((a) => a.killed);
    S.animals = S.animals.filter((a) => !a.killed);
    for (const a of gone) if (sel && sel.type === 'animal' && sel.id === a.id) closeInspector();
  }
  const dead = S.animals.filter((a) => a.health <= 0);
  if (dead.length) {
    for (const a of dead) {
      toast(
        `${a.name} the ${SPECIES[a.sp].name.toLowerCase()} died of illness. Guests and staff are heartbroken.`,
        'bad'
      );
      S.rating = Math.max(0, S.rating - 5);
      yearRec().deaths++;
      if (sel && sel.type === 'animal' && sel.id === a.id) closeInspector();
    }
    S.animals = S.animals.filter((a) => a.health > 0);
  }
  if (S.clock % 20 === 0) {
    for (const e of S.encl) {
      const n = animalsIn(e.id).length;
      e.dirt = Math.min(100, (e.dirt || 0) + n * 0.13);
    }
    S.encl.forEach(evalEncl);
  }
}
