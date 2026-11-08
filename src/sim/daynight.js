/* Day and night. Each month of game time is one day: the month's clock (S.clock, 0..DAY) starts at
   dawn, the sun sets about three quarters of the way through, and night runs across the turn of the
   month. In the evening, land animals walk to the hatch of their habitat's animal house (a building
   on the fence) and sleep inside until morning; with no animal house they sleep in the open and
   are less happy. Fewer visitors arrive after dark. The Office can switch the cycle off (S.nightOff). */
const NIGHT = { dusk: 0.74, dark: 0.8, dawn: 0.05 };
const tod = () => S.clock / DAY; // 0 = dawn, 1 = the next dawn
const dayNightOn = () => S.nightOff !== true;
// animals head in from dusk until dawn
const bedtime = () => dayNightOn() && (tod() >= NIGHT.dusk || tod() < NIGHT.dawn);
const isNight = () => dayNightOn() && (tod() >= NIGHT.dark || tod() < NIGHT.dawn);
// 0 by day, 1 at full night, ramping through dusk and dawn (for lighting)
function darkness() {
  if (!dayNightOn()) return 0;
  const t = tod();
  if (t >= 0.7) return clamp((t - 0.7) / 0.1, 0, 1);
  if (t < 0.08) return clamp(1 - t / 0.08, 0, 1);
  return 0;
}
// the animal-house hatch nearest an animal, as a tile index, or null
function nightShelterFor(a) {
  const list = F.nightIn && F.nightIn[a.e];
  if (!list || !list.length) return null;
  let best = null,
    bd = 1e9;
  for (const i of list) {
    const d = Math.hypot((i % W) + 0.5 - a.x, ((i / W) | 0) + 0.5 - a.y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
const sleepsInside = (sp) => !SWIM_Y[sp]; // swimmers rest in the water instead
/* Called for each animal every tick before it moves. Returns true when the animal is busy with
   bedtime (asleep, or inside) and shouldn't do anything else this tick. */
function nightStep(a, e) {
  if (!sleepsInside(a.sp)) {
    a.sleep = isNight();
    return false;
  }
  if (bedtime()) {
    if (a.inside != null) return true;
    const sh = nightShelterFor(a);
    if (sh == null) {
      // nowhere to go: lie down where they are once it is properly dark
      a.sleep = isNight();
      return a.sleep;
    }
    const sx = (sh % W) + 0.5,
      sy = ((sh / W) | 0) + 0.5;
    if (Math.hypot(sx - a.x, sy - a.y) < 0.95) {
      a.inside = sh;
      a.sleep = false;
      return true;
    }
    a.tx = sx;
    a.ty = sy;
    a.wait = 0;
    return false;
  }
  a.sleep = false;
  if (a.inside != null) {
    // morning: come out one by one, through the hatch they went in by
    if (Math.random() > 0.015) return true;
    const sh = a.inside;
    a.inside = null;
    if (S.tiles[sh] && S.tiles[sh].e === a.e) {
      a.x = a.ox = a.tx = (sh % W) + 0.5;
      a.y = a.oy = a.ty = ((sh / W) | 0) + 0.5;
    } else if (e) [a.x, a.y] = [a.tx, a.ty] = randPointIn(e, a);
  }
  return false;
}
