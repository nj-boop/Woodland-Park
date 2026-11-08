// Integration tests: load the test build in headless Chrome and check core game rules.
// Run with: npm test
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/npm-tools/node_modules/playwright'));
}

const three = join(root, 'node_modules', 'three');
const browser = await chromium.launch({
  executablePath: process.env.CHROME || '/usr/bin/google-chrome',
  args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'],
});

async function freshPage() {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/three.min.js', (r) =>
    r.fulfill({ path: join(three, 'build/three.min.js'), contentType: 'text/javascript' })
  );
  await page.route('**/GLTFLoader.js', (r) =>
    r.fulfill({ path: join(three, 'examples/js/loaders/GLTFLoader.js'), contentType: 'text/javascript' })
  );
  await page.route('**/SkeletonUtils.js', (r) =>
    r.fulfill({ path: join(three, 'examples/js/utils/SkeletonUtils.js'), contentType: 'text/javascript' })
  );
  await page.route('**/fonts.googleapis.com/**', (r) => r.abort());
  await page.goto('file://' + join(root, 'dist', 'test.html'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    localStorage.clear();
    window.__wg.newZoo();
    window.__wg.setSpeed(0);
  });
  return { page, errors };
}

const tests = {
  'game boots without errors': async ({ errors }) => errors.length === 0 || errors.join('; '),

  'lion hunts zebra without a barrier': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg,
        e = g.S.encl[0];
      const lion = g.addAnimal('lion', e, 13, 9);
      lion.hunger = 80;
      const zebras = () => g.S.animals.filter((a) => a.sp === 'zebra').length,
        before = zebras();
      for (let i = 0; i < 600 && zebras() === before; i++) g.tick();
      return zebras() < before || 'no attack happened';
    }),

  'barrier keeps prey safe': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg,
        e = g.S.encl[0];
      e.barrier = true;
      g.refresh();
      const lion = g.addAnimal('lion', e, 12, 9);
      lion.hunger = 80;
      const before = g.S.animals.filter((a) => a.sp === 'zebra').length;
      for (let i = 0; i < 800; i++) g.tick();
      return g.S.animals.filter((a) => a.sp === 'zebra').length === before || 'zebra was killed behind a barrier';
    }),

  'locked species and predator placement are blocked': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('animal');
      g.set('sub', 'lion');
      const locked = g.check(13, 10).msg || '';
      g.S.tier = 3;
      const mixed = g.check(13, 10).msg || '';
      return (/unlock/.test(locked) && /hunt/.test(mixed)) || `got: ${locked} / ${mixed}`;
    }),

  'keepers need a lodge and a recycling yard': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.build('lodge');
      const lodgeOnly = g.F.cap.keepers;
      g.build('recycle');
      return (lodgeOnly === 0 && g.F.cap.keepers === 4) || `caps ${lodgeOnly} then ${g.F.cap.keepers}`;
    }),

  'buildings take their full footprint, face a path, and come back whole after saving': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      const at = g.build('vetclinic');
      if (!at) return 'no room for a 4×3 clinic';
      const parts = g.S.tiles.filter((t) => t.o === 'vetclinic');
      if (parts.length !== 12) return `clinic covers ${parts.length} tiles`;
      const a = parts[0].a,
        anchor = g.S.tiles[a];
      if (!parts.every((t) => t.a === a)) return 'tiles disagree on the anchor';
      g.load(g.serialize());
      g.refresh();
      const back = g.S.tiles.filter((t) => t.o === 'vetclinic');
      if (back.length !== 12 || g.S.tiles[a].r !== anchor.r) return `after load: ${back.length} tiles`;
      g.setTool('bulldoze');
      g.act(a % 36, Math.floor(a / 36) + 1);
      g.refresh();
      return g.S.tiles.every((t) => t.o !== 'vetclinic') || 'bulldozing left pieces behind';
    }),

  'buildings snap flush to a nearby path and clear plants in the way': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('shop');
      g.set('sub', 'lodge');
      // aim two tiles away from the path: the lodge should slide over to sit against it
      const c0 = g.check(23, 17);
      if (!c0.ok) return 'no placement found: ' + c0.msg;
      const front = c0.plan.tiles.some((i) =>
        [i + 36, i - 36, i + 1, i - 1].some((n) => g.S.tiles[n] && g.S.tiles[n].t === 'p')
      );
      if (!front) return 'lodge did not end up beside a path';
      // put a tree inside that footprint: still allowed, and the tree goes
      const ti = c0.plan.tiles[0];
      g.S.tiles[ti].o = 'oak';
      const c = g.check(23, 17);
      if (!c.ok || !c.clears) return 'tree blocked the lodge: ' + (c.msg || '');
      g.act(23, 17);
      g.refresh();
      return (
        (g.S.tiles.filter((t) => t.o === 'lodge').length === 6 && g.S.tiles[ti].o === 'lodge') || 'lodge not placed'
      );
    }),

  'old saves get full-size buildings or a refund': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      const d = JSON.parse(g.serialize());
      delete d.fp;
      delete d.ro;
      // an old one-tile lodge in open ground beside the path, and one squeezed between paths
      d.o[17 * 36 + 20] = 'lodge';
      d.o[15 * 36 + 18] = 'lodge';
      const m0 = d.money;
      g.load(JSON.stringify(d));
      g.refresh();
      const lodges = new Set(g.S.tiles.filter((t) => t.o === 'lodge').map((t) => t.a)).size;
      const refunded = g.S.money - m0;
      return (lodges + refunded / 2000 === 2 && lodges >= 1) || `lodges ${lodges}, refunded ${refunded}`;
    }),

  'painted habitats can be any shape': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('habitat');
      g.set('habMode', 'paint');
      g.set('sub', 'savanna');
      g.set('paintE', null);
      g.paintHabitat(20, 8, true);
      for (let x = 20; x < 24; x++) for (let y = 8; y < 10; y++) g.paintHabitat(x, y, false);
      for (let y = 10; y < 12; y++) for (let x = 20; x < 22; x++) g.paintHabitat(x, y, false);
      g.refresh();
      const e = g.S.encl.at(-1);
      return (
        (g.F.etiles[e.id].length === 12 && g.F.eedges[e.id].length === 16) ||
        `tiles ${g.F.etiles[e.id].length} edges ${g.F.eedges[e.id].length}`
      );
    }),

  'terrain raises and tanks stay level': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('terrain');
      g.set('terrSub', 'raise');
      g.set('brushSize', 2);
      for (let i = 0; i < 5; i++) g.terraform(6, 10);
      const raised = g.S.hgt[10 * 37 + 6];
      const pool = g.makeEncl(20, 16, 4, 4, 'pool');
      g.refresh();
      for (let i = 0; i < 5; i++) g.terraform(22, 18);
      const level = g.S.hgt[18 * 37 + 22];
      return (raised > 0.2 && Math.abs(level - pool.base) < 1e-6) || `raised ${raised}, tank ${level} vs ${pool.base}`;
    }),

  'weak fences let strong animals escape, and they can be recaptured': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.S.tier = 4;
      const e = g.makeEncl(20, 8, 5, 5, 'savanna');
      e.fence = 'wood';
      g.refresh();
      const el = g.addAnimal('elephant', e, 22, 10);
      el.happy = 20;
      el.target = 20;
      for (let i = 0; i < 30 && !el.escaped; i++) g.monthlyUpkeep();
      if (!el.escaped) return 'elephant never escaped a log fence';
      g.recapture(el);
      return (!el.escaped && g.S.tiles[Math.floor(el.y) * 36 + Math.floor(el.x)].e === e.id) || 'recapture failed';
    }),

  'guests use restrooms': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      if (!g.build('restroom')) return 'could not place restroom';
      for (let i = 0; i < 4000 && !g.S.guests.length; i++) g.tick();
      const guest = g.S.guests[0];
      if (!guest) return 'no guest arrived';
      guest.bath = 95;
      let used = false;
      for (let i = 0; i < 2500 && !used; i++) {
        g.tick();
        if (guest.bath < 20) used = true;
        if (!g.S.guests.includes(guest)) break;
      }
      return used || 'guest never found the restroom';
    }),

  'save and load keep everything': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('terrain');
      g.set('terrSub', 'raise');
      g.terraform(6, 12);
      g.set('terrSub', 'water');
      g.set('brushSize', 1);
      g.terraform(30.5, 20.5);
      g.setTool('habitat');
      g.set('habMode', 'paint');
      g.set('sub', 'jungle');
      g.set('paintE', null);
      g.paintHabitat(21, 17, true);
      g.paintHabitat(22, 17, false);
      g.paintHabitat(22, 18, false);
      g.refresh();
      const before = {
        items: g.S.tiles.filter((t) => t.o).length,
        water: g.S.tiles.filter((t) => t.w).length,
        h: g.S.hgt[12 * 37 + 6].toFixed(2),
        encl: g.S.encl.length,
      };
      g.load(g.serialize());
      g.refresh();
      const after = {
        items: g.S.tiles.filter((t) => t.o).length,
        water: g.S.tiles.filter((t) => t.w).length,
        h: g.S.hgt[12 * 37 + 6].toFixed(2),
        encl: g.S.encl.length,
      };
      return (
        JSON.stringify(before) === JSON.stringify(after) || `${JSON.stringify(before)} -> ${JSON.stringify(after)}`
      );
    }),

  'every tree, rock and shrub builds, and canopies can hide': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.setTool('plant');
      const kinds = [
        'redwood',
        'oak',
        'birch',
        'maple',
        'pine',
        'fir',
        'cypress',
        'willow',
        'acacia',
        'baobab',
        'palm',
        'bamboo',
        'cactus',
        'fern',
        'tallgrass',
        'rockpile',
        'spire',
        'slab',
      ];
      let x = 2,
        placed = 0;
      const fails = [];
      for (const k of kinds) {
        g.set('sub', k);
        g.S.money = 1e6;
        let c = g.check(x, 23);
        for (let n = 0; n < 8 && !c.ok; n++) c = g.check(++x, 23);
        if (c.ok) {
          g.act(x, 23);
          placed++;
        } else fails.push(x + ' ' + k + ': ' + c.msg);
        x += 1;
      }
      g.refresh();
      g.renderScenery();
      const hidden = g.canopy(false),
        shown = g.canopy(true);
      if (placed !== kinds.length) return `placed ${placed}/${kinds.length} ${fails}`;
      return (hidden.n > 0 && hidden.shown === 0 && shown.shown === shown.n) || JSON.stringify({ hidden, shown });
    }),

  'staff are hired from the board only when there is room': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      if (g.hireRole('keeper')) return 'hired a keeper with no lodge';
      g.build('lodge');
      g.build('recycle');
      const k = g.hireRole('keeper');
      return (!!k && g.staffCount('keeper') === 1) || 'could not hire after building a lodge and yard';
    }),

  'a keeper walks in through the gate to feed animals, and cannot without one': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg,
        e = g.S.encl[0];
      g.build('lodge');
      g.build('recycle');
      const k = g.hireRole('keeper');
      const zebras = g.S.animals.filter((a) => a.e === e.id);
      zebras.forEach((a) => (a.hunger = 80));
      let inside = false;
      for (let i = 0; i < 3000 && zebras.some((a) => a.hunger > 20); i++) {
        g.tick();
        if (g.S.tiles[Math.floor(k.y) * 36 + Math.floor(k.x)].e === e.id) inside = true;
      }
      if (zebras.some((a) => a.hunger > 20)) return 'keeper never fed the zebras';
      if (!inside) return 'keeper fed them without going in';
      e.gates = [];
      g.refresh();
      zebras.forEach((a) => (a.hunger = 80));
      for (let i = 0; i < 1500; i++) g.tick();
      return (g.unreachable(e) && zebras.every((a) => a.hunger >= 80)) || 'keeper got in with no gate';
    }),

  'a vet walks to a sick animal and treats it': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      if (!g.build('vetclinic')) return 'no spot for a clinic';
      g.hireRole('vet');
      const z = g.S.animals[0];
      z.sick = true;
      z.health = 60;
      const v = g.S.staff[0];
      if (!v) return 'no vet hired';
      for (let i = 0; i < 3000 && z.sick; i++) g.tick();
      return (
        !z.sick ||
        `vet ${v.st} ${JSON.stringify(v.job)} at ${v.x.toFixed(1)},${v.y.toFixed(1)}; zebra at ${z.x.toFixed(1)},${z.y.toFixed(1)}`
      );
    }),

  'janitors sweep litter and repair worn fences': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg,
        e = g.S.encl[0];
      g.build('recycle');
      g.hireRole('janitor');
      const lit = g.S.tiles.findIndex((t, i) => t.t === 'p' && i > 20 * 36);
      g.S.tiles[lit].l = 2;
      g.refresh(); // litter normally comes from guests, which also log it for janitors
      e.cond = 40;
      for (let i = 0; i < 4000 && (g.S.tiles[lit].l > 0 || e.cond < 100); i++) g.tick();
      return (g.S.tiles[lit].l === 0 && e.cond === 100) || `litter ${g.S.tiles[lit].l}, fence ${e.cond}`;
    }),

  'underpaid, unhappy staff quit; raises help': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.build('recycle');
      const a = g.hireRole('janitor'),
        b = g.hireRole('janitor');
      a.wage = 5;
      a.morale = 15;
      b.morale = 30;
      g.giveRaise(b.id);
      const raised = b.morale;
      for (let i = 0; i < 8 && g.S.staff.includes(a); i++) g.staffMonth();
      return (
        (!g.S.staff.includes(a) && raised > 30) ||
        `a still on staff: ${g.S.staff.includes(a)}, b morale after raise ${raised}`
      );
    }),

  'staff save and load, and old saves get staff and gates': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.build('lodge');
      g.build('recycle');
      const k = g.hireRole('keeper');
      k.skill = 4;
      k.assign = [g.S.encl[0].id];
      g.load(g.serialize());
      g.refresh();
      const k2 = g.S.staff[0];
      if (!k2 || k2.name !== k.name || k2.skill !== 4 || k2.assign[0] !== g.S.encl[0].id)
        return 'staff did not survive save/load';
      const old = JSON.parse(g.serialize());
      delete old.staff;
      old.keepers = 2;
      old.encl.forEach((e) => (e.gates = []));
      g.load(JSON.stringify(old));
      g.refresh();
      return (
        (g.staffCount('keeper') === 2 && g.S.encl[0].gates.length === 1) ||
        `keepers ${g.staffCount('keeper')}, gates ${g.S.encl[0].gates.length}`
      );
    }),

  'placing one thing rebuilds only its chunk': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.refresh();
      g.renderScenery();
      g.refresh();
      g.renderScenery();
      const idle = { ...g.staticStats };
      g.setTool('plant');
      g.set('sub', 'oak');
      if (!g.act(3, 3)) return 'could not plant';
      g.refresh();
      g.renderScenery();
      const one = { ...g.staticStats };
      return (
        (idle.chunks === 0 && idle.fences === 0 && one.chunks === 1 && one.fences === 0) ||
        JSON.stringify({ idle, one })
      );
    }),

  'saves go to IndexedDB and come back': async ({ page }) =>
    page.evaluate(async () => {
      const g = window.__wg;
      g.S.money = 123457;
      g.save();
      await new Promise((r) => setTimeout(r, 400));
      localStorage.clear();
      const back = await g.readSave();
      return (back && JSON.parse(back).money === 123457) || 'save not found in IndexedDB';
    }),

  'the map can grow, keeping the zoo intact': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      const zebra = g.S.animals[0],
        zx = zebra.x,
        gate0 = { ...g.S.gate };
      g.build('lodge');
      const a0 = g.S.tiles.find((t) => t.o === 'lodge').a,
        lodge = [a0 % 36, Math.floor(a0 / 36)];
      g.resizeMap(100, 80, 30, 40);
      g.refresh();
      const ok =
        g.W === 100 &&
        g.H === 80 &&
        zebra.x === zx + 30 &&
        g.S.tiles.filter((t) => t.o === 'lodge').length === 6 &&
        g.S.tiles[(lodge[1] + 40) * 100 + lodge[0] + 30].a === (lodge[1] + 40) * 100 + lodge[0] + 30 &&
        g.S.gate.x === gate0.x + 30 &&
        g.S.encl[0].gates.length === 1;
      if (!ok)
        return JSON.stringify({
          W: g.W,
          H: g.H,
          dz: zebra.x - zx,
          lodges: g.S.tiles.filter((t) => t.o === 'lodge').length,
          at: g.S.tiles[(lodge[1] + 40) * 100 + lodge[0] + 30].o,
          lodge,
          gate: [g.S.gate.x - gate0.x],
          gates: g.S.encl[0].gates,
        });
      g.load(g.serialize());
      g.refresh();
      return (g.W === 100 && g.S.tiles.filter((t) => t.o === 'lodge').length === 6) || 'size lost on save';
    }),

  'buying land grows the zoo north, east and west and keeps the entrance on the road': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.S.money = 1e7;
      for (let i = 0; i < 400 && !g.S.guests.length; i++) g.tick();
      const guests = g.S.guests.length,
        cap0 = g.guestCap(),
        zebra = g.S.animals[0],
        zx = zebra.x,
        zy = zebra.y;
      const price = g.landPrice('north'),
        m0 = g.S.money;
      if (!g.buyLand('north') || !g.buyLand('west') || !g.buyLand('east')) return 'purchase refused';
      g.refresh();
      const ok =
        g.W === 36 + 32 &&
        g.H === 26 + 16 &&
        g.S.gate.y === g.H - 1 &&
        zebra.x === zx + 16 &&
        zebra.y === zy + 16 &&
        g.S.guests.length === guests &&
        m0 - g.S.money >= price &&
        g.guestCap() > cap0 &&
        g.S.tiles.some((t, i) => t.o && i < 16 * g.W); // woodland in the new northern strip
      return (
        ok ||
        JSON.stringify({
          W: g.W,
          H: g.H,
          gate: g.S.gate,
          dz: [zebra.x - zx, zebra.y - zy],
          guests: [guests, g.S.guests.length],
        })
      );
    }),

  'full parking slows arrivals; a lot adds 30 spaces': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      const before = g.parkingSpaces();
      if (!g.build('parking')) return 'no room for a parking lot';
      g.refresh();
      if (g.parkingSpaces() !== before + 30) return `spaces ${before} -> ${g.parkingSpaces()}`;
      // when guests fill every space, new visitors are a quarter as likely to come
      for (let i = 0; i < 400 && !g.S.guests.length; i++) g.tick();
      if (!g.S.guests.length) return 'no guest arrived';
      const open = g.arrivalChance(),
        spaces = g.parkingSpaces();
      while (g.carsParked() < spaces) g.S.guests.push({ ...g.S.guests[0] });
      const full = g.arrivalChance();
      return Math.abs(full / open - 0.25) < 0.05 || `open ${open}, full ${full}`;
    }),

  'feed comes by truck to the dock, haulers store it, keepers feed from it': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.S.money = 1e6;
      for (const b of ['lodge', 'recycle', 'dock', 'feedstore']) if (!g.build(b)) return 'no room for ' + b;
      g.refresh();
      if (!g.feedByTruck()) return 'bulk feed not active';
      g.hireRole('keeper');
      g.hireRole('hauler');
      let sawTruck = false,
        sawCrate = false,
        stored = 0;
      for (let i = 0; i < 6000 && !(stored > 0); i++) {
        g.tick();
        if (g.S.trucks.length) sawTruck = true;
        if (g.S.crates.length) sawCrate = true;
        stored = g.S.feed;
      }
      if (!sawTruck || !sawCrate || !stored) return `truck ${sawTruck}, crates ${sawCrate}, feed ${stored}`;
      const zebras = g.S.animals.filter((a) => a.e === g.S.encl[0].id);
      zebras.forEach((a) => (a.hunger = 80));
      const m0 = g.S.money;
      for (let i = 0; i < 3000 && zebras.some((a) => a.hunger > 20); i++) g.tick();
      return (
        (zebras.every((a) => a.hunger <= 20) && g.S.feed < 300) ||
        `zebras ${zebras.map((a) => a.hunger | 0)}, feed ${g.S.feed}`
      );
    }),

  'guests never walk on service roads': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      for (let x = 20; x < 27; x++) g.setPath(x, 20, 'service');
      g.refresh();
      const t = g.S.tiles[20 * 36 + 22];
      return (t.t === 'p' && t.pm === 'service' && !g.guestPath(20 * 36 + 22)) || 'service road open to guests';
    }),

  'reaching the goals unlocks the next tier': async ({ page }) =>
    page.evaluate(() => {
      const g = window.__wg;
      g.S.rating = 60;
      g.S.totalVis = 150;
      g.checkTier();
      return g.S.tier === 2 || `tier is ${g.S.tier}`;
    }),
};

let failed = 0;
for (const [name, fn] of Object.entries(tests)) {
  const ctx = await freshPage();
  let result;
  try {
    result = await fn(ctx);
  } catch (e) {
    result = e.message;
  }
  if (ctx.errors.length && result === true) result = 'page error: ' + ctx.errors[0];
  const ok = result === true;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + result}`);
  await ctx.page.close();
}
await browser.close();
console.log(failed ? `\n${failed} failed` : '\nall tests passed');
process.exit(failed ? 1 : 0);
