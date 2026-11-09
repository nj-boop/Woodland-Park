/* Global constants: map size, tile size, ticks per second, month length, save key. */
const T = 32,
  TPS = 20,
  DAY = 1200;
// the map size changes when land is bought (see resizeMap in sim/world.js); tile (x, y) is S.tiles[y * W + x]
let W = 36,
  H = 26;
// the park entrance; it moves with the rest of the zoo when the map grows on the left or top
const GATE = { x: 18, y: 25, mx: 18, my: 25, ox: -1, oy: -1 }; // inside tile; the gate's middle tile; outside tile (-1: off the map)
const SAVE_KEY = 'wildgrove-zoo-v1';
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
