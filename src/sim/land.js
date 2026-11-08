/* Buying land. The zoo grows in 16-tile strips to the north, east or west (the entrance road runs
   along the south edge, so that side stays put), up to 512 × 512 tiles. Each strip costs more as
   the zoo gets bigger. New land arrives as open woodland that can be cleared. */
const LAND_STRIP = 16,
  MAP_MAX = 512;
const LAND_SIDES = {
  north: { name: 'North', dw: 0, dh: 1, ox: 0, oy: 1 },
  east: { name: 'East', dw: 1, dh: 0, ox: 0, oy: 0 },
  west: { name: 'West', dw: 1, dh: 0, ox: 1, oy: 0 },
};
// price per tile rises with the zoo's area: ~$37 a tile at the start, ~$150 at 128 × 128
const landPerTile = () => 30 * (1 + (W * H) / 4000);
function landPrice(side) {
  const L = LAND_SIDES[side],
    tiles = L.dh ? W * LAND_STRIP : H * LAND_STRIP;
  return Math.round((tiles * landPerTile()) / 100) * 100;
}
function canBuyLand(side) {
  const L = LAND_SIDES[side];
  return L.dh ? H + LAND_STRIP <= MAP_MAX : W + LAND_STRIP <= MAP_MAX;
}
function buyLand(side) {
  const L = LAND_SIDES[side];
  if (!canBuyLand(side)) {
    toast('The zoo is as big as it can get in that direction.', 'bad');
    return false;
  }
  const cost = landPrice(side);
  if (!spend(cost, 'land')) return false;
  S.today.run += cost;
  const ox = L.ox * LAND_STRIP,
    oy = L.oy * LAND_STRIP,
    oldW = W,
    oldH = H;
  resizeMap(W + L.dw * LAND_STRIP, H + L.dh * LAND_STRIP, ox, oy);
  // the new strip is open woodland
  const x0 = side === 'east' ? oldW : 0,
    x1 = side === 'east' ? W : side === 'west' ? LAND_STRIP : W,
    y0 = 0,
    y1 = side === 'north' ? LAND_STRIP : H;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (y >= H - 1) continue; // keep the boundary row along the road clear
      const r = hsh(x * 3 + 11, y * 5 + 7),
        t = tileAt(x, y);
      if (t.o || t.t === 'p') continue;
      if (r < 0.12) t.o = ['pine', 'oak', 'birch', 'maple', 'pine'][Math.floor(hsh(x, y + 3) * 5)];
      else if (r < 0.15) t.o = 'rock';
      else if (r < 0.2) t.o = hsh(y, x) < 0.5 ? 'tallgrass' : 'fern';
    }
  // keep the camera looking at the same spot
  CAM.tx += ox;
  CAM.tz += oy;
  toast(
    `Bought ${LAND_STRIP} more ${L.dh ? 'rows' : 'columns'} of land to the ${L.name.toLowerCase()} for ${money(cost)}. The zoo is now ${W} × ${H} tiles (${oldW}×${oldH} before).`,
    'good'
  );
  return true;
}
