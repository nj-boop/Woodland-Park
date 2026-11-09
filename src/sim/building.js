/* Placement rules and actions for every tool: paths, habitats (rectangle, paint, erase, gates), animals, items, terraforming, bulldozing. */
/* Roads are two tiles wide: the road tool lays a 2 × 2 block at each step of a drag, all or nothing. */
function checkRoadStamp(x, y) {
  const stamp = { x0: clamp(x, 0, W - 2), y0: clamp(y, 0, H - 2) },
    plain = [],
    deck = new Set(),
    ramps = new Set();
  let br = 'road';
  for (let ty = stamp.y0; ty < stamp.y0 + 2; ty++)
    for (let tx = stamp.x0; tx < stamp.x0 + 2; tx++) {
      const t = tileAt(tx, ty);
      if (t.t === 'p' && (t.pm === 'service' || t.pm === 'crossing')) continue;
      const c = checkPathTile(tx, ty);
      if (!c.ok) return { ok: false, msg: c.msg, loud: !!c.msg, quiet: c.quiet, stamp };
      if (c.crossing) {
        br = c.br;
        c.bridge.deck.forEach((i) => deck.add(i));
        c.bridge.ramps.forEach((i) => ramps.add(i));
      } else plain.push(idx(tx, ty));
    }
  const lay = new Set([...plain, ...ramps].filter((i) => !deck.has(i)));
  if (!lay.size && !deck.size) return { ok: false, quiet: true, stamp };
  return {
    ok: true,
    cost: BRIDGE_COST * deck.size + PATHS.service.cost * lay.size,
    crossing: deck.size > 0,
    br,
    bridge: { deck: [...deck], ramps: [...lay] },
    stamp,
  };
}
function checkPathTile(x, y) {
  const t = tileAt(x, y);
  // roads and footpaths never meet at grade: laying one over the other builds a bridge, with
  // whichever is laid second on top (a footbridge over a road, or a road bridge over a footpath)
  if (t.t === 'p' && t.o) return { ok: false, msg: 'Something is in the way. Bulldoze it first.', loud: true };
  if (t.t === 'p' && !t.e && t.pm !== 'crossing' && t.pm !== 'track' && pathSub !== 'track' && pathSub !== 'tunnel')
    if ((pathSub === 'service') !== (t.pm === 'service')) {
      const br = pathSub === 'service' ? 'road' : 'foot',
        plan = bridgePlan(x, y, br);
      if (!plan.ok) return { ok: false, msg: plan.msg, loud: true };
      return {
        ok: true,
        cost: BRIDGE_COST * plan.deck.length + PATHS[pathSub].cost * plan.ramps.length,
        crossing: true,
        br,
        bridge: plan,
      };
    }
  if (t.t === 'p') return { ok: false, quiet: true };
  if (t.w) return { ok: false, msg: "You can't build a path over water." };
  if (t.e && pathSub === 'track' && F.emap[t.e].biome !== 'pool') {
    if (t.o) return { ok: false, msg: 'Something is in the way. Remove it first.' };
    return { ok: true, cost: PATHS.track.cost };
  }
  if (t.e && !(pathSub === 'tunnel' && F.emap[t.e].biome === 'pool'))
    return {
      ok: false,
      msg:
        pathSub === 'tunnel'
          ? 'Glass tunnels only run through aquatic habitats.'
          : "Paths can't run through a habitat. Use a safari track, or a glass tunnel for aquatic ones.",
    };
  if (!t.e && pathSub === 'tunnel') return { ok: false, msg: 'Glass tunnels only run through aquatic habitats.' };
  if (t.o) return { ok: false, msg: 'Something is in the way. Bulldoze it first.' };
  if (joinsBridgeSide(x, y, pathSub === 'service'))
    return { ok: false, msg: 'Paths can only join a bridge at its ends.', loud: true };
  return { ok: true, cost: PATHS[pathSub].cost };
}
function check(x, y) {
  if (!inB(x, y)) return { ok: false, quiet: true };
  const t = tileAt(x, y);
  if (tool === 'path') return pathSub === 'service' ? checkRoadStamp(x, y) : checkPathTile(x, y);
  if (tool === 'animal') {
    const sp = SPECIES[sub];
    if (!t.e) return { ok: false, msg: `Place the ${sp.name.toLowerCase()} inside a habitat.` };
    if (!unlocked(sub))
      return {
        ok: false,
        msg: `${sp.pl} unlock when your zoo becomes a ${TIERS[tierOf(sub) - 1].name.toLowerCase()}. See the Office for what's needed.`,
      };
    const e = F.emap[t.e];
    if (e.biome !== sp.biome)
      return { ok: false, msg: `${sp.pl} need a ${BIOMES[sp.biome].name.toLowerCase()} habitat.` };
    if (!e.barrier) {
      const here = S.animals.filter((a) => a.e === e.id);
      const clash = here.find((a) => !!SPECIES[a.sp].pred !== !!sp.pred);
      if (clash) {
        const pr = sp.pred ? sp : SPECIES[clash.sp],
          py = sp.pred ? SPECIES[clash.sp] : sp;
        return {
          ok: false,
          msg: `${pr.pl} would hunt the ${py.pl.toLowerCase()}. Add a predator barrier to this habitat first (tap the habitat).`,
        };
      }
    }
    return { ok: true, cost: sp.cost };
  }
  if (tool === 'plant' || tool === 'shop') {
    const it = ITEMS[sub];
    if (it.size) return checkBuilding(sub, x, y);
    if (t.t === 'p') {
      const c = checkOnPath(x, y, it);
      if (!c.ok) return c;
    }
    if (t.w) return { ok: false, msg: 'That spot is under water.' };
    if (t.o) return { ok: false, msg: 'That tile is already taken.' };
    if (it.kind === 'toy' || it.kind === 'shelter') {
      if (!t.e) return { ok: false, msg: `The ${it.name.toLowerCase()} goes inside a habitat.` };
      const pool = F.emap[t.e].biome === 'pool';
      if (pool && sub !== 'floater') return { ok: false, msg: 'Only floating toys work in a tank.' };
      if (!pool && sub === 'floater') return { ok: false, msg: 'Floating toys go in aquatic habitats.' };
      return { ok: true, cost: it.cost };
    }
    if (it.kind === 'decor') {
      if (t.e) return { ok: false, msg: 'Decorations go outside habitats.' };
      if (sub === 'canopy' && !adjPath(x, y)) return { ok: false, msg: 'A viewing canopy has to touch a path.' };
      return { ok: true, cost: it.cost };
    }
    if (it.kind === 'plant') {
      if (t.e && F.emap[t.e].biome === 'pool' && it.form !== 'rock')
        return { ok: false, msg: 'Only rocks fit inside a tank.' };
      return { ok: true, cost: it.cost };
    }
    if (sub === 'stage') {
      if (t.e) return { ok: false, msg: 'Build the stadium beside the tank, not in it.' };
      if (!poolNear(x, y)) return { ok: false, msg: 'A show stadium has to sit right next to an aquatic habitat.' };
      if (!adjPath(x, y)) return { ok: false, msg: 'The show stadium has to touch a path.' };
      return { ok: true, cost: it.cost };
    }
    if (t.e)
      return {
        ok: false,
        msg: it.kind === 'staff' ? 'Staff buildings go outside habitats.' : 'Guest facilities go outside habitats.',
      };
    if (!adjPath(x, y)) return { ok: false, msg: `The ${it.name.toLowerCase()} has to touch a path.` };
    return { ok: true, cost: it.cost };
  }
  if (tool === 'bulldoze') {
    if (isBridgeRamp(idx(x, y))) return { ok: false, msg: 'That’s a bridge ramp. Remove the bridge first.' };
    if (t.o || (t.t === 'p' && !isGate(x, y)) || t.e) return { ok: true };
    if (isGate(x, y)) return { ok: false, msg: 'The entrance stays.' };
    return { ok: false, quiet: true };
  }
  return { ok: false, quiet: true };
}
function rectOf(a, b) {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}
function rectCheck(r) {
  if (r.w < 3 || r.h < 3) return { ok: false, msg: 'Habitats need to be at least 3×3 tiles.' };
  for (let j = r.y; j < r.y + r.h; j++)
    for (let i = r.x; i < r.x + r.w; i++) {
      if (!inB(i, j)) return { ok: false, msg: 'That runs off the edge of the map.' };
      const t = tileAt(i, j);
      if (t.t === 'p') return { ok: false, msg: "Habitats can't cover paths." };
      if (t.e) return { ok: false, msg: 'That overlaps another habitat.' };
      if (t.o && ITEMS[t.o].kind !== 'plant')
        return { ok: false, msg: 'Move the guest facilities out of the way first.' };
    }
  return {
    ok: true,
    cost: 2 * (r.w + r.h) * FENCES[sub === 'pool' ? 'glass' : fenceSub].cost + r.w * r.h * (sub === 'pool' ? 20 : 6),
  };
}
function act(x, y) {
  const c = check(x, y);
  if (!c.ok) {
    if (c.msg && (tool !== 'path' || c.loud) && !(drag && drag.lineDrag && drag.moved)) toast(c.msg, 'bad');
    return false;
  }
  const t = tileAt(x, y);
  if (tool === 'path') {
    if (!spend(c.cost, c.crossing ? 'a bridge' : 'a path')) return false;
    if (c.crossing || (c.stamp && c.bridge)) {
      for (const i of c.bridge.deck) {
        setPath(i % W, (i / W) | 0, 'crossing');
        S.tiles[i].pm = 'crossing';
        S.tiles[i].br = c.br;
      }
      for (const i of c.bridge.ramps) setPath(i % W, (i / W) | 0, pathSub); // also a road's plain tiles
    } else setPath(x, y, pathSub);
    dirty = true;
    return true;
  }
  if (tool === 'animal') {
    const sp = SPECIES[sub];
    if (!spend(sp.cost, `a ${sp.name.toLowerCase()}`)) return false;
    const e = F.emap[t.e];
    const a = addAnimal(sub, e, x + 0.5, y + 0.55);
    evalEncl(e);
    a.happy = Math.max(55, a.target);
    toast(`${sp.name} added to the ${BIOMES[e.biome].name.toLowerCase()} habitat.`);
    if (sel && sel.type === 'encl' && sel.id === e.id) renderInspector();
    return true;
  }
  if ((tool === 'plant' || tool === 'shop') && t.t === 'p' && t.l) {
    t.l = 0; // the litter gets tidied away under it
    F.litter.delete(idx(x, y));
  }
  if (tool === 'plant' || tool === 'shop') {
    const it = ITEMS[sub];
    if (!spend(it.cost, `a ${it.name.toLowerCase()}`)) return false;
    if (sub === 'entrance') placeEntrance(c.plan);
    else stampBuilding(sub, c.plan || { r: 0, x0: x, y0: y, fw: 1, fh: 1, tiles: [idx(x, y)] });
    if (c.stubs) {
      for (const i of c.stubs.road) setPath(i % W, (i / W) | 0, 'service');
      for (const i of c.stubs.foot) setPath(i % W, (i / W) | 0, 'stone');
      const need = [c.stubs.road.length && 'road', c.stubs.foot.length && 'footpath'].filter(Boolean).join(' and ');
      toast(
        `${it.name} placed. It starts working once its ${need} stub${need.includes(' and ') ? 's are' : ' is'} joined up.`
      );
    }
    dirty = true;
    return true;
  }
  if (tool === 'bulldoze') {
    if (t.o === 'entrance') {
      toast('The zoo needs an entrance. Place a new one to move it.', 'bad');
      return false;
    }
    if (t.o) {
      S.money += Math.round(ITEMS[t.o].cost / 2);
      clearBuilding(idx(x, y));
      dirty = true;
      return true;
    }
    if (t.pm === 'crossing' && t.t === 'p') {
      // the bridge comes down; the path it crossed stays
      t.pm = t.br === 'road' ? 'stone' : 'service';
      delete t.br;
      S.money += Math.round(BRIDGE_COST / 2);
      dirty = true;
      return true;
    }
    if (t.t === 'p') {
      t.t = 'g';
      t.l = 0;
      F.litter.delete(idx(x, y));
      S.money += 5;
      dirty = true;
      return true;
    }
    if (t.e) {
      const e = F.emap[t.e],
        list = S.animals.filter((a) => a.e === e.id);
      if (list.length && !(demolishArm && demolishArm.id === e.id && performance.now() - demolishArm.t < 3500)) {
        demolishArm = { id: e.id, t: performance.now() };
        toast(
          `Tap again to demolish this habitat and sell its ${list.length} animal${list.length > 1 ? 's' : ''} at half price.`,
          'bad'
        );
        return false;
      }
      demolishArm = null;
      let refund = Math.round(
        ((F.eedges[e.id] || []).length * FENCES[e.fence || 'wood'].cost + encTiles(e).length * 6) / 2
      );
      for (const a of list) refund += Math.round(SPECIES[a.sp].cost / 2);
      S.animals = S.animals.filter((a) => a.e !== e.id);
      for (const ti of encTiles(e)) S.tiles[ti].e = 0;
      S.encl = S.encl.filter((o) => o.id !== e.id);
      S.money += refund;
      dirty = true;
      if (sel && sel.type === 'encl' && sel.id === e.id) closeInspector();
      toast(`Habitat demolished. ${money(refund)} refunded.`);
      return true;
    }
  }
  return false;
}
function terraform(wx, wz) {
  if (terrSub === 'water' || terrSub === 'drain') {
    const r = brushSize - 1,
      cx = Math.floor(wx),
      cz = Math.floor(wz);
    let n = 0;
    for (let y = cz - r; y <= cz + r; y++)
      for (let x = cx - r; x <= cx + r; x++) {
        if (!inB(x, y) || x === 0 || y === 0 || x === W - 1 || y === H - 1) continue;
        const t = tileAt(x, y);
        if (terrSub === 'water') {
          if (
            t.w ||
            t.t === 'p' ||
            (t.o && ITEMS[t.o].kind !== 'plant') ||
            (t.e && F.emap[t.e].biome === 'pool') ||
            isGate(x, y)
          )
            continue;
          if (!spend(25, 'water')) return;
          t.w = 1;
          t.o = null;
          n++;
          for (const [ci, cj] of [
            [x, y],
            [x + 1, y],
            [x, y + 1],
            [x + 1, y + 1],
          ])
            S.hgt[cIdx(ci, cj)] = Math.min(S.hgt[cIdx(ci, cj)], -0.38);
        } else if (t.w) {
          t.w = 0;
          n++;
          for (const [ci, cj] of [
            [x, y],
            [x + 1, y],
            [x, y + 1],
            [x + 1, y + 1],
          ])
            S.hgt[cIdx(ci, cj)] = Math.max(S.hgt[cIdx(ci, cj)], -0.05);
        }
      }
    if (n) {
      dirty = true;
    }
    return;
  }
  const r = brushR();
  let n = 0;
  for (let j = Math.max(1, Math.floor(wz - r)); j <= Math.min(H - 1, Math.ceil(wz + r)); j++)
    for (let i = Math.max(1, Math.floor(wx - r)); i <= Math.min(W - 1, Math.ceil(wx + r)); i++) {
      const d = Math.hypot(i - wx, j - wz);
      if (d > r) continue;
      let poolC = false;
      for (const [tx, ty] of [
        [i - 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i, j],
      ])
        if (inB(tx, ty) && tileAt(tx, ty).e && F.emap[tileAt(tx, ty).e] && F.emap[tileAt(tx, ty).e].biome === 'pool')
          poolC = true;
      if (poolC) continue;
      const w = 1 - d / r,
        k = cIdx(i, j),
        h0 = S.hgt[k];
      if (terrSub === 'raise') S.hgt[k] = Math.min(2.5, h0 + 0.08 * w);
      else if (terrSub === 'lower') S.hgt[k] = Math.max(-1, h0 - 0.08 * w);
      else if (terrSub === 'smooth') {
        const avg = (hC(i - 1, j) + hC(i + 1, j) + hC(i, j - 1) + hC(i, j + 1)) / 4;
        S.hgt[k] = h0 + (avg - h0) * 0.5 * w;
      } else if (terrSub === 'flatten') {
        S.hgt[k] = h0 + ((drag && drag.h0 != null ? drag.h0 : 0) - h0) * 0.5 * w;
      }
      n++;
    }
  if (n) {
    applyHeights();
    S.money -= 2;
    S.today.run += 2;
  }
}
function paintHabitat(x, y, first) {
  if (!inB(x, y)) return;
  const t = tileAt(x, y);
  if (habMode === 'erase') {
    if (!t.e) return;
    const e = F.emap[t.e];
    if (!e) return;
    t.e = 0;
    S.money += Math.round((FENCES[e.fence || 'wood'].cost + 6) / 2);
    dirty = true;
    rebuild();
    for (const a of S.animals)
      if (a.e === e.id && Math.floor(a.x) === x && Math.floor(a.y) === y && F.emap[e.id]) {
        [a.x, a.y] = randPointIn(e, a);
        a.tx = a.x;
        a.ty = a.y;
        a.ox = a.x;
        a.oy = a.y;
      }
    return;
  }
  if (habMode === 'gate') {
    if (!t.e || !first) return;
    const e = F.emap[t.e];
    if (e.biome === 'pool') {
      toast('Tanks do not need gates.', 'bad');
      return;
    }
    for (const [dx, dy, dr] of [
      [0, -1, 0],
      [0, 1, 1],
      [-1, 0, 2],
      [1, 0, 3],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (inB(nx, ny) && tileAt(nx, ny).e !== e.id && tileAt(nx, ny).t === 'p') {
        e.gates = e.gates || [];
        const k = e.gates.findIndex(([gi, gd]) => gi === idx(x, y) && gd === dr);
        if (k >= 0) {
          e.gates.splice(k, 1);
          toast('Gate removed.');
        } else {
          if (!spend(150, 'a gate')) return;
          e.gates.push([idx(x, y), dr]);
          toast('Gate added. Keepers will use it to get in.', 'good');
        }
        dirty = true;
        return;
      }
    }
    toast('Gates go on a habitat edge that touches a path.', 'bad');
    return;
  }
  // paint
  if (t.t === 'p' || (t.e && (!paintE || t.e !== paintE) && !first)) return;
  if (first && t.e) {
    const e = F.emap[t.e];
    if (e.biome === sub) {
      paintE = e.id;
      return;
    }
    toast('That tile already belongs to another habitat.', 'bad');
    return;
  }
  if (t.e) return;
  if (t.o && ITEMS[t.o].kind !== 'plant') {
    if (first) toast('Clear the facilities out of the way first.', 'bad');
    return;
  }
  const cost = Math.round(FENCES[sub === 'pool' ? 'glass' : fenceSub].cost * 1.5 + (sub === 'pool' ? 20 : 6));
  if (!paintE) {
    const nb = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]
      .map(([dx, dy]) => inB(x + dx, y + dy) && tileAt(x + dx, y + dy).e)
      .find((id) => id && F.emap[id] && F.emap[id].biome === sub);
    if (nb) paintE = nb;
    else {
      if (!spend(cost, 'a habitat tile')) return;
      const e = makeEncl(x, y, 1, 1, sub);
      paintE = e.id;
      dirty = true;
      rebuild();
      return;
    }
  }
  const adj = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ].some(([dx, dy]) => inB(x + dx, y + dy) && tileAt(x + dx, y + dy).e === paintE);
  if (!adj) return;
  if (!spend(cost, 'a habitat tile')) return;
  t.e = paintE;
  dirty = true;
}
function buildHabitat(r) {
  const c = rectCheck(r);
  if (!c.ok) {
    toast(c.msg, 'bad');
    return;
  }
  if (!spend(c.cost, 'that habitat')) return;
  const e = makeEncl(r.x, r.y, r.w, r.h, sub);
  dirty = true;
  toast(`${BIOMES[sub].name} habitat built for ${money(c.cost)}. Add animals next.`, 'good');
  if (!adjacentToPath(e)) toast('Guests can only see this habitat from a path that runs alongside it.', 'bad');
}
function adjacentToPath(e) {
  for (const ti of encTiles(e)) {
    const x = ti % W,
      y = (ti / W) | 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        if (inB(x + dx, y + dy) && tileAt(x + dx, y + dy).t === 'p' && tileAt(x + dx, y + dy).e !== e.id) return true;
  }
  return false;
}
