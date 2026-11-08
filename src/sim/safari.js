/* Safari tours. Guests pay at a safari station and ride a truck along the safari track, which can run
   through habitats. A tour is the station's connected track, driven out and back; how good it is
   depends on the animals seen from it. Where a track crosses a habitat fence there is a vehicle gate,
   which is a weak point: dangerous animals escape more easily, unless the fence is a moat. */
const RIDE_TICKS_PER_TILE = 6;
// per station: the drive (tiles in order) and its value; rebuilt with the rest of the map data
function buildTours() {
  F.tours = {}; // F.trackIn (habitats a track runs into) was gathered by rebuild()
  for (const i of anchorsOf('station')) {
    let start = -1;
    for (const k of buildingTiles(i)) for (const n of nbr4(k)) if (start < 0 && isTrack(n)) start = n;
    if (start < 0) continue;
    // depth-first drive: every branch out and back, so the truck covers the whole network
    const walk = [],
      seen = new Set([start]),
      stack = [[start, 0]];
    walk.push(start);
    while (stack.length) {
      const top = stack[stack.length - 1],
        ns = nbr4(top[0]).filter((n) => isTrack(n) && !seen.has(n));
      if (top[1] < 1 && ns.length) {
        const n = ns[0];
        seen.add(n);
        walk.push(n);
        stack.push([n, 0]);
      } else {
        stack.pop();
        if (stack.length) walk.push(stack[stack.length - 1][0]);
      }
      if (walk.length > 4000) break;
    }
    // what riders see: habitats the track is in or next to
    const hab = new Set();
    for (const t of seen) {
      if (S.tiles[t].e) hab.add(S.tiles[t].e);
      for (const n of nbr4(t)) if (S.tiles[n].e) hab.add(S.tiles[n].e);
    }
    let value = 0;
    for (const e of hab) {
      const list = S.animals.filter((a) => a.e === e && !a.escaped);
      value += new Set(list.map((a) => a.sp)).size * 4 + Math.min(10, list.length);
    }
    F.tours[i] = { walk, value: Math.round(value * 1.3), habitats: hab.size };
  }
}
// effective fence strength: a vehicle gate weakens any fence except a moat
const fenceStrength = (e) => FSTR[e.fence || 'wood'] - (F.trackIn && F.trackIn.has(e.id) && e.fence !== 'moat' ? 1 : 0);
