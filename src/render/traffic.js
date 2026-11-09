/* Traffic, for show only (nothing here changes the simulation):
   - through traffic on the highway along the south edge, both directions
   - when a parking lot gains cars, some drive in from the highway along the roads to it, and when
     it loses cars, some drive back out. The bays themselves are filled by syncParkedCars.
   Time runs with the game speed, so pausing freezes the cars too. */
const MOVE_MAX = 80; // through traffic plus cars on their way in or out
const movBody = new THREE.InstancedMesh(carBody.geometry, new THREE.MeshLambertMaterial({ color: 0xffffff }), MOVE_MAX),
  movCab = new THREE.InstancedMesh(carCab.geometry, new THREE.MeshLambertMaterial({ color: LIN('#2a3a44') }), MOVE_MAX);
movBody.castShadow = true;
movBody.setColorAt(0, new THREE.Color(1, 1, 1)); // sized from count, so before count is zeroed
for (const m of [movBody, movCab]) {
  m.frustumCulled = false;
  m.count = 0;
  scene.add(m);
}
const CAR_SPEED = 4; // tiles per second at 1× game speed
let trafficT = 0,
  lastLotCars = -1,
  routeFor = null; // F.paths the cached routes were made for
const lotRoutes = new Map(), // lot anchor -> polyline from the highway into the lot, or null
  movers = []; // { pts, len, d, col }

const laneZ = (east) => H + (east ? 1.1 : 2.1);
// polyline from off-screen on the highway, up the road to the lot's front, into the middle of the lot
function lotRoute(a) {
  if (routeFor !== F.paths) {
    lotRoutes.clear();
    routeFor = F.paths;
  }
  if (lotRoutes.has(a)) return lotRoutes.get(a);
  const p = planOf(a),
    goals = new Set(frontTiles(p.x0, p.y0, p.fw, p.fh, p.r).filter((i) => F.roadLinked.has(i)));
  let pts = null;
  const e = goals.size ? truckEntry(goals) : null;
  if (e) {
    const hx = (e.h % W) + 0.5,
      fromWest = hx > W / 2,
      sx = hx + (fromWest ? -12 : 12); // join from just along the highway
    pts = [
      [sx, laneZ(fromWest)],
      [hx, laneZ(fromWest)],
      [hx, H - 0.5],
    ];
    for (const t of e.r) pts.push([(t % W) + 0.5, ((t / W) | 0) + 0.5]);
    pts.push([p.x0 + p.fw / 2, p.y0 + p.fh / 2]);
  }
  lotRoutes.set(a, pts);
  return pts;
}
function polyLen(pts) {
  let l = 0;
  for (let k = 1; k < pts.length; k++) l += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
  return l;
}
// position and heading at distance d along a polyline
function polyAt(pts, d) {
  for (let k = 1; k < pts.length; k++) {
    const dx = pts[k][0] - pts[k - 1][0],
      dz = pts[k][1] - pts[k - 1][1],
      l = Math.hypot(dx, dz);
    if (d <= l || k === pts.length - 1) {
      const f = l ? Math.min(1, d / l) : 1;
      return [pts[k - 1][0] + dx * f, pts[k - 1][1] + dz * f, Math.atan2(dx, dz)];
    }
    d -= l;
  }
  return [pts[0][0], pts[0][1], 0];
}
function lotsInOrder() {
  return anchorsOf('parking');
}
// start cars driving in (n > 0) or out (n < 0) of the lot that is filling or emptying
function spawnMovers(n) {
  const lots = lotsInOrder();
  if (!lots.length) return;
  const lotCars = carsInLots(),
    a = lots[Math.min(lots.length - 1, Math.floor(Math.max(0, lotCars - (n < 0 ? 0 : 1)) / LOT_CARS))],
    pts = lotRoute(a);
  if (!pts) return;
  for (let k = 0; k < Math.min(3, Math.abs(n)) && movers.length < MOVE_MAX - 30; k++) {
    let path = pts;
    if (n < 0) {
      // drive out: reverse the route, and leave along the far lane in the other direction
      path = pts.slice().reverse();
      const last = path.length - 1,
        west = path[last][0] < path[last - 1][0]; // came in from the west, so leave heading east
      path[last - 1] = [path[last - 1][0], laneZ(!west)];
      path[last] = [path[last - 1][0] + (west ? 12 : -12), laneZ(!west)];
    }
    movers.push({
      pts: path,
      len: polyLen(path),
      d: -k * 1.6,
      col: CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0],
    });
  }
}
function syncTraffic(dt) {
  trafficT += (dt / 1000) * speed;
  const lotCars = carsInLots();
  if (lastLotCars < 0 || Math.abs(lotCars - lastLotCars) > 40) lastLotCars = lotCars; // a load, not traffic
  if (lotCars !== lastLotCars) {
    spawnMovers(lotCars - lastLotCars);
    lastLotCars = lotCars;
  }
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  let n = 0;
  const put = (x, z, rot, col) => {
    const y = heightAt(clamp(x, 0, W - 0.01), clamp(z, 0, H - 0.01));
    o.position.set(x, (z > H ? 0 : y + bridgeLift(x, z, 'road')) + 0.16, z);
    o.rotation.set(0, rot, 0);
    o.updateMatrix();
    movBody.setMatrixAt(n, o.matrix);
    movBody.setColorAt(n, c.set(col).convertSRGBToLinear());
    o.position.y += 0.19;
    o.position.x -= Math.sin(rot) * 0.08;
    o.position.z -= Math.cos(rot) * 0.08;
    o.updateMatrix();
    movCab.setMatrixAt(n, o.matrix);
    n++;
  };
  // through traffic: evenly spaced, more on a bigger map, wrapping along a stretch wider than the map
  const span = W + 60,
    per = clamp(Math.round(W / 10), 3, 24);
  for (let lane = 0; lane < 2; lane++)
    for (let k = 0; k < per; k++) {
      const east = lane === 0,
        off = (k / per) * span + hsh(k, lane + 3) * 4,
        s = (((trafficT * (CAR_SPEED + lane) + off) % span) + span) % span;
      put(
        east ? s - 30 : W + 30 - s,
        laneZ(east),
        east ? Math.PI / 2 : -Math.PI / 2,
        CAR_COLORS[(k * 3 + lane) % CAR_COLORS.length]
      );
    }
  // cars driving in or out
  for (let k = movers.length - 1; k >= 0; k--) {
    const m = movers[k];
    m.d += (dt / 1000) * speed * CAR_SPEED * 0.8;
    if (m.d >= m.len) {
      movers.splice(k, 1);
      continue;
    }
    if (m.d < 0 || n >= MOVE_MAX) continue;
    const [x, z, rot] = polyAt(m.pts, m.d);
    put(x, z, rot, m.col);
  }
  movBody.count = movCab.count = n;
  movBody.instanceMatrix.needsUpdate = movCab.instanceMatrix.needsUpdate = true;
  if (movBody.instanceColor) movBody.instanceColor.needsUpdate = true;
}
// a new or loaded zoo: forget cars from the old one
function resetTraffic() {
  movers.length = 0;
  lastLotCars = -1;
  routeFor = null;
}
