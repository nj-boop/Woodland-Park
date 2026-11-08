/* Farms: grow your own animal feed. Each farm grows a crop over a season; when it's ripe, a hauler
   harvests it and carries the feed to the feed store, so fewer delivery trucks are needed. If the
   feed store is full, the harvest is sold at half its value. Farms cost a little upkeep each month.

   Yields are in feed units (the feed store's measure; one meal is DIET cost / 3 units). */
const FARMS = {
  hayfield: { crop: 'Hay', grow: 2400, yield: 260, upkeep: 30, col: ['#7fa64a', '#d8c070'] },
  banana: { crop: 'Bananas', grow: 3000, yield: 320, upkeep: 40, col: ['#4f8a3a', '#e8d24a'] },
  browse: { crop: 'Acacia browse', grow: 3600, yield: 380, upkeep: 40, col: ['#5a7d34', '#7c9a3e'] },
  veg: { crop: 'Greens', grow: 1800, yield: 150, upkeep: 25, col: ['#5aa04a', '#8fcf5a'] },
  fishpond: { crop: 'Fish', grow: 3000, yield: 340, upkeep: 50, col: ['#3d7f99', '#c8d8de'] },
};
const farmOf = (a) => S.farms[a] || (S.farms[a] = { g: 0 });
function farmTiles() {
  const out = [];
  for (let i = 0; i < W * H; i++) if (FARMS[S.tiles[i].o] && isAnchor(i)) out.push(i);
  return out;
}
// ripe farms waiting for a hauler
const ripeFarms = () => farmTiles().filter((a) => farmOf(a).g >= 1);
function tickFarms() {
  if (S.clock % 20) return;
  for (const a of farmTiles()) {
    const f = farmOf(a);
    if (f.g < 1) f.g = Math.min(1, f.g + 20 / FARMS[S.tiles[a].o].grow);
  }
  // forget farms that were removed
  if (S.clock % 400 === 0) for (const k of Object.keys(S.farms)) if (!FARMS[(S.tiles[k] || {}).o]) delete S.farms[k];
}
// harvest: returns the feed units picked
function harvestFarm(a) {
  const F2 = FARMS[S.tiles[a] && S.tiles[a].o];
  if (!F2 || farmOf(a).g < 1) return 0;
  S.farms[a].g = 0;
  return F2.yield;
}
function farmUpkeep() {
  let t = 0;
  for (const a of farmTiles()) t += FARMS[S.tiles[a].o].upkeep;
  return t;
}
