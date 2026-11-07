/* Seeded randomness for stable scenery, grass tuft placement, and painting the ground texture (lawn, paths, habitat floors, water, edges). */
/* seeded randomness so scenery looks the same every time it's rebuilt */
const _origRand = Math.random;
let _rs = 1;
function seedRand(n) {
  _rs = (Math.imul((n | 0) + 1, 2654435761) ^ 0x9e3779b9) >>> 0 || 1;
}
function srand() {
  _rs ^= _rs << 13;
  _rs >>>= 0;
  _rs ^= _rs >>> 17;
  _rs ^= _rs << 5;
  _rs >>>= 0;
  return _rs / 4294967296;
}
function seeded(fn) {
  Math.random = srand;
  try {
    return fn();
  } finally {
    Math.random = _origRand;
  }
}
function buildTufts() {
  const o = new THREE.Object3D(),
    c = new THREE.Color();
  let n = 0,
    f = 0;
  const put = (x, z, y, sc, col) => {
    if (n >= TUFT_MAX) return;
    if (x >= 0 && x <= W && z >= 0 && z <= H) {
      if (tileAt(Math.floor(clamp(x, 0, W - 0.01)), Math.floor(clamp(z, 0, H - 0.01))).w) return;
      y = heightAt(x, z);
    }
    o.position.set(x, y, z);
    o.rotation.set(rnd(-0.25, 0.25), rnd(0, 6.28), rnd(-0.25, 0.25));
    o.scale.set(sc, sc * rnd(0.8, 1.4), sc);
    o.updateMatrix();
    tufts.setMatrixAt(n, o.matrix);
    tufts.setColorAt(n, c.set(col).convertSRGBToLinear());
    n++;
  };
  const flower = (x, z, y) => {
    if (f >= FL_MAX) return;
    if (x >= 0 && x <= W && z >= 0 && z <= H) y = heightAt(x, z);
    o.position.set(x, y, z);
    o.rotation.set(0, 0, 0);
    o.scale.setScalar(1);
    o.updateMatrix();
    flowers.setMatrixAt(f, o.matrix);
    flowers.setColorAt(f, c.set(pick(FLC)).convertSRGBToLinear());
    f++;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      seedRand(idx(x, y) * 31 + 7);
      const t = tileAt(x, y);
      if (t.t === 'p' || t.o) continue;
      if (t.e) {
        const b = F.emap[t.e].biome;
        if (b === 'savanna' || b === 'prairie')
          for (let k = 0; k < 4; k++)
            put(
              x + rnd(0.15, 0.85),
              y + rnd(0.15, 0.85),
              0,
              rnd(1.2, 1.8),
              b === 'savanna' ? pick(['#e8c878', '#d8b464', '#f0d488']) : pick(['#c8d890', '#d8e0a0'])
            );
        else if (b === 'jungle')
          for (let k = 0; k < 3; k++)
            put(x + rnd(0.15, 0.85), y + rnd(0.15, 0.85), 0, rnd(1.4, 2.2), pick(['#8fb080', '#a0c090']));
        continue;
      }
      for (let k = 0; k < 2; k++)
        put(x + rnd(0.05, 0.95), y + rnd(0.05, 0.95), 0, rnd(0.55, 0.9), pick(['#d8e6c8', '#c8dcb4', '#e6eed6']));
      if (Math.random() < 0.08) flower(x + rnd(0.1, 0.9), y + rnd(0.1, 0.9), 0);
    }
  seedRand(424242);
  for (let k = 0; k < 2600 && n < TUFT_MAX; k++) {
    let x, z;
    do {
      x = rnd(-22, W + 22);
      z = rnd(-22, H + 22);
    } while ((x > -1 && x < W + 1 && z > -1 && z < H + 1) || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.2);
    const y = hillH(x, z);
    put(x, z, y, rnd(1, 1.7), pick(['#c8d8b0', '#b8cca0', '#d0dcbc']));
    if (Math.random() < 0.12) flower(x, z, y);
  }
  tufts.count = n;
  flowers.count = f;
  tufts.instanceMatrix.needsUpdate = true;
  flowers.instanceMatrix.needsUpdate = true;
  if (tufts.instanceColor) tufts.instanceColor.needsUpdate = true;
  if (flowers.instanceColor) flowers.instanceColor.needsUpdate = true;
}
let groundDirty = true,
  staticDirty = true,
  groundSig = '';
const gbase = document.createElement('canvas');
gbase.width = W * T;
gbase.height = H * T;
{
  const x = gbase.getContext('2d');
  x.fillStyle = '#5f9a3a';
  x.fillRect(0, 0, W * T, H * T);
  const blot = (n, r0, r1, cols) => {
    for (let k = 0; k < n; k++) {
      const px = Math.random() * W * T,
        py = Math.random() * H * T,
        r = rnd(r0, r1),
        gr = x.createRadialGradient(px, py, 0, px, py, r);
      gr.addColorStop(0, pick(cols));
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
  };
  blot(700, 18, 80, ['rgba(120,170,70,.40)', 'rgba(45,95,30,.40)', 'rgba(85,130,45,.35)']);
  blot(60, 10, 34, ['rgba(120,95,55,.45)', 'rgba(140,115,70,.40)']);
  for (let k = 0; k < 22000; k++) {
    x.fillStyle = pick(['rgba(30,70,22,.45)', 'rgba(150,195,95,.35)', 'rgba(70,120,40,.4)']);
    x.fillRect(Math.random() * W * T, Math.random() * H * T, 1, rnd(2, 5));
  }
}
const PAVE = {
  stone: ['#a7a39c', '#9b968f', '#b3afa7', '#8f8b84'],
  brick: ['#a8553a', '#9a4b33', '#b5603f', '#8e4630'],
  asphalt: ['#55575a', '#4e5053', '#5b5d60'],
  dirt: ['#8a6c47', '#7d613f', '#977a52'],
  sand: ['#d9c08a', '#cfb57c', '#e2cb98'],
};
function drawPathTile(c, x, y, px, py, m) {
  const pal = PAVE[m] || PAVE.stone;
  if (m === 'stone') {
    c.fillStyle = '#6f6b65';
    c.fillRect(px, py, T, T);
    for (let j = 0; j < 4; j++) {
      const off = (j % 2) * 4;
      for (let i = -1; i < 4; i++) {
        const q = hsh(x * 5 + i, y * 4 + j),
          bx = px + i * 9 + off;
        c.fillStyle = pal[Math.floor(q * 4)];
        c.fillRect(Math.max(px, bx) + 0.6, py + j * 8 + 0.6, Math.min(bx + 9, px + T) - Math.max(px, bx) - 1.2, 6.8);
      }
    }
  } else if (m === 'brick') {
    c.fillStyle = '#6e3a28';
    c.fillRect(px, py, T, T);
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 4; i++) {
        const q = hsh(x * 4 + i, y * 8 + j);
        c.fillStyle = pal[Math.floor(q * 4)];
        if ((i + j) % 2) c.fillRect(px + i * 8 + 0.5, py + j * 4 + 0.5, 7, 3);
        else c.fillRect(px + i * 8 + 0.5, py + j * 4 + 0.5, 3, 3), c.fillRect(px + i * 8 + 4.5, py + j * 4 + 0.5, 3, 3);
      }
  } else {
    c.fillStyle = pal[0];
    c.fillRect(px, py, T, T);
    for (let k = 0; k < 26; k++) {
      c.fillStyle = pick(pal.concat(['rgba(0,0,0,.12)', 'rgba(255,255,255,.12)']));
      c.fillRect(px + hsh(x + k, y * 3) * T, py + hsh(y + k, x * 3) * T, rnd(1, 3), rnd(1, 2));
    }
  }
  if (m === 'dirt' || m === 'sand') return;
  c.fillStyle = m === 'brick' ? '#5a2e20' : '#5f5c57';
  if (!(y > 0 && tileAt(x, y - 1).t === 'p')) c.fillRect(px, py, T, 2.5);
  if (!(y < H - 1 && tileAt(x, y + 1).t === 'p')) c.fillRect(px, py + T - 2.5, T, 2.5);
  if (!(x > 0 && tileAt(x - 1, y).t === 'p')) c.fillRect(px, py, 2.5, T);
  if (!(x < W - 1 && tileAt(x + 1, y).t === 'p')) c.fillRect(px + T - 2.5, py, 2.5, T);
}
function drawGround() {
  const c = g2;
  c.setTransform(GS, 0, 0, GS, 0, 0);
  c.drawImage(gbase, 0, 0);
  const floorPass = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const t = tileAt(x, y),
        px = x * T,
        py = y * T,
        r = hsh(x, y);
      if (t.w) {
        c.fillStyle = '#55705a';
        c.fillRect(px, py, T, T);
        c.fillStyle = 'rgba(30,50,40,.35)';
        c.fillRect(px + 3, py + 3, T - 6, T - 6);
        if (t.e) floorPass.push([x, y, px, py, F.emap[t.e], BIOMES[F.emap[t.e].biome]]);
        continue;
      }
      if (t.t === 'p' && t.e) {
        c.fillStyle = BIOMES.pool.c1;
        c.fillRect(px, py, T, T);
        drawPathTile(c, x, y, px, py, 'stone');
      } else if (t.e) {
        const e = F.emap[t.e],
          b = BIOMES[e.biome];
        c.fillStyle = b.c1;
        c.fillRect(px, py, T, T);
        c.globalAlpha = 0.28;
        c.globalCompositeOperation = 'multiply';
        c.drawImage(gbase, px, py, T, T, px, py, T, T);
        c.globalCompositeOperation = 'source-over';
        c.globalAlpha = 1;
        floorPass.push([x, y, px, py, e, b]);
      } else if (t.t === 'p') {
        drawPathTile(c, x, y, px, py, t.pm || 'stone');
        if (t.l) {
          const cols = ['#f4f4f4', '#e4573d', '#3d86e4', '#f2c94c'];
          for (let k = 0; k < t.l * 2; k++) {
            c.fillStyle = cols[k % 4];
            c.fillRect(px + 5 + hsh(x + k, y) * 20, py + 5 + hsh(y, x + k) * 20, 3, 2);
          }
        }
      }
    }
  // second pass: soft patches and texture that blend across tile edges
  for (const [x, y, px, py, e, b] of floorPass) {
    const t = tileAt(x, y);
    if (t.w) continue;
    c.save();
    c.beginPath();
    for (const ti of encTiles(e)) c.rect((ti % W) * T, ((ti / W) | 0) * T, T, T);
    c.clip();
    {
      for (let k = 0; k < 3; k++) {
        const q = hsh(x * 3 + k, y * 7),
          cx = px + q * T,
          cy = py + hsh(y * 3 + k, x * 7) * T,
          rr = 14 + q * 22,
          gr = c.createRadialGradient(cx, cy, 0, cx, cy, rr);
        gr.addColorStop(0, b.patch[(x * 7 + y * 3 + k) % 3]);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        c.globalAlpha = 0.4;
        c.fillStyle = gr;
        c.fillRect(cx - rr, cy - rr, rr * 2, rr * 2);
        c.globalAlpha = 1;
      }
      c.fillStyle = b.tex;
      for (let k = 0; k < 14; k++) {
        c.globalAlpha = 0.5;
        c.fillRect(px + hsh(x + k, y * 9) * T, py + hsh(y + k, x * 9) * T, 1, rnd(2, 4));
      }
      c.globalAlpha = 1;
      if (e.biome === 'pool') {
        c.strokeStyle = 'rgba(235,250,255,.5)';
        c.lineWidth = 1.2;
        for (let k = 0; k < 5; k++) {
          c.beginPath();
          const sx = px + hsh(x + k, y * 5) * T,
            sy = py + hsh(y + k, x * 5) * T;
          c.moveTo(sx, sy);
          c.bezierCurveTo(sx + 6, sy - 4, sx + 10, sy + 5, sx + 16, sy + 1);
          c.stroke();
        }
      }
      const dt = e.dirt || 0;
      for (let k = 0; k < 2; k++)
        if (hsh(x + 7 + k * 13, y + 3) * 100 < dt * 0.55) {
          c.fillStyle = e.biome === 'pool' ? '#4f7a3a' : '#6a4a2a';
          c.beginPath();
          c.ellipse(px + 7 + hsh(x + k, y + 9) * 18, py + 7 + hsh(x + 9, y + k) * 18, 3, 2, 0, 0, 7);
          c.fill();
        }
    }
    c.restore();
  }
  // soft shadow lines inside fences
  for (const e of S.encl) {
    for (const [x, y, dr] of F.eedges[e.id] || []) {
      const x0 = x * T,
        y0 = y * T;
      if (e.fence === 'moat') {
        c.fillStyle = 'rgba(40,30,20,.55)';
        const o = 8;
        if (dr === 0) c.fillRect(x0, y0 - o, T, o);
        if (dr === 1) c.fillRect(x0, y0 + T, T, o);
        if (dr === 2) c.fillRect(x0 - o, y0, o, T);
        if (dr === 3) c.fillRect(x0 + T, y0, o, T);
      }
      c.strokeStyle = 'rgba(60,40,20,.25)';
      c.lineWidth = 4;
      c.beginPath();
      if (dr === 0) {
        c.moveTo(x0, y0 + 2);
        c.lineTo(x0 + T, y0 + 2);
      }
      if (dr === 1) {
        c.moveTo(x0, y0 + T - 2);
        c.lineTo(x0 + T, y0 + T - 2);
      }
      if (dr === 2) {
        c.moveTo(x0 + 2, y0);
        c.lineTo(x0 + 2, y0 + T);
      }
      if (dr === 3) {
        c.moveTo(x0 + T - 2, y0);
        c.lineTo(x0 + T - 2, y0 + T);
      }
      c.stroke();
    }
  }
  {
    const m = gmaskC.getContext('2d');
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const t = tileAt(x, y),
          v = t.t === 'p' ? 0 : t.e ? (['savanna', 'prairie', 'jungle'].includes(F.emap[t.e].biome) ? 170 : 60) : 255;
        m.fillStyle = `rgb(${v},${v},${v})`;
        m.fillRect(x, y, 1, 1);
      }
    GMASK.needsUpdate = true;
  }
  gtex.needsUpdate = true;
  groundDirty = false;
}
function groundSignature() {
  let s = '';
  for (const e of S.encl) s += Math.floor((e.dirt || 0) / 6) + ',';
  let l = 0;
  for (let i = 0; i < W * H; i++) if (S.tiles[i].l) l += S.tiles[i].l * (i + 1);
  return s + l;
}
