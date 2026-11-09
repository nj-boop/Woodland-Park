/* The ground: instead of painting one huge picture of the map (which stops working past ~100 tiles),
   the ground shader looks up each tile's kind in a small data texture (one texel per tile) and draws
   it from a shared set of repeating textures: lawn, six habitat floors, five path pavings and a water
   bed. Curbs, fence shadows, litter and dung are drawn in the shader from per-tile flags. The ground
   mesh is split into chunks so the camera only draws the parts it can see.

   Data texture channels per tile:
     R  layer (see GROUND_LAYERS) + 16 × which sides join another road (1,2,4,8 = N,S,W,E)
     G  edge bits: 1,2,4,8 = path curb on N,S,W,E; 16,32,64,128 = habitat fence on N,S,W,E
     B  litter on paths (0-5 → ×40) or dirt in habitats (0-100 → ×2.55)
     A  how much the grass-blade detail texture shows (0-255) */

const GROUND_LAYERS = [
  'grass',
  'savanna',
  'jungle',
  'ice',
  'desert',
  'prairie',
  'pool',
  'stone',
  'brick',
  'asphalt',
  'dirt',
  'sand',
  'tunnel',
  'waterbed',
  'service',
  'track',
];
const LAYER = Object.fromEntries(GROUND_LAYERS.map((k, i) => [k, i]));
const ATLAS_CELL = 256,
  ATLAS_PAD = 16,
  ATLAS_STRIDE = ATLAS_CELL + ATLAS_PAD * 2,
  ATLAS_COLS = 4,
  ATLAS_SIZE = ATLAS_STRIDE * ATLAS_COLS;
// tiles covered by one repeat of each layer
const LAYER_REPEAT = GROUND_LAYERS.map((k) => (k === 'grass' ? 8 : 4));

// draw a tileable layer: `paint(ctx, n)` draws on an n×n canvas and must wrap its own strokes
function wrapDraw(x, n, fn) {
  for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) fn(ox, oy);
}
function grassLayer(x, n) {
  x.fillStyle = '#5f9a3a';
  x.fillRect(0, 0, n, n);
  const blot = (count, r0, r1, cols) => {
    for (let k = 0; k < count; k++) {
      const px = Math.random() * n,
        py = Math.random() * n,
        r = rnd(r0, r1),
        col = pick(cols);
      wrapDraw(x, n, (ox, oy) => {
        const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        gr.addColorStop(0, col);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr;
        x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      });
    }
  };
  // one repeat covers 8 tiles, so sizes are scaled from the old 32 px-per-tile painting
  const s = n / (8 * 32);
  blot(110, 18 * s, 80 * s, ['rgba(120,170,70,.40)', 'rgba(45,95,30,.40)', 'rgba(85,130,45,.35)']);
  blot(9, 10 * s, 34 * s, ['rgba(120,95,55,.45)', 'rgba(140,115,70,.40)']);
  for (let k = 0; k < 9000; k++) {
    x.fillStyle = pick(['rgba(30,70,22,.45)', 'rgba(150,195,95,.35)', 'rgba(70,120,40,.4)']);
    x.fillRect(Math.random() * n, Math.random() * n, 1, rnd(2, 5) * s);
  }
}
function biomeLayer(x, n, b) {
  x.fillStyle = b.c1;
  x.fillRect(0, 0, n, n);
  const s = n / (4 * 32);
  for (let k = 0; k < 70; k++) {
    const px = Math.random() * n,
      py = Math.random() * n,
      rr = (14 + Math.random() * 22) * s,
      col = pick(b.patch);
    wrapDraw(x, n, (ox, oy) => {
      const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, rr);
      gr.addColorStop(0, col);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.globalAlpha = 0.4;
      x.fillStyle = gr;
      x.fillRect(px + ox - rr, py + oy - rr, rr * 2, rr * 2);
      x.globalAlpha = 1;
    });
  }
  x.fillStyle = b.tex;
  x.globalAlpha = 0.5;
  for (let k = 0; k < 900; k++) x.fillRect(Math.random() * n, Math.random() * n, 1, rnd(2, 4) * s);
  x.globalAlpha = 1;
  // faint grass-like grain, as the old floor painting blended the lawn texture in
  for (let k = 0; k < 2500; k++) {
    x.fillStyle = pick(['rgba(0,0,0,.08)', 'rgba(255,255,255,.07)']);
    x.fillRect(Math.random() * n, Math.random() * n, 1, rnd(1, 3) * s);
  }
  if (b === BIOMES.pool) {
    x.strokeStyle = 'rgba(235,250,255,.5)';
    x.lineWidth = 1.2 * s;
    for (let k = 0; k < 70; k++) {
      const sx = Math.random() * (n - 20 * s),
        sy = Math.random() * n;
      x.beginPath();
      x.moveTo(sx, sy);
      x.bezierCurveTo(sx + 6 * s, sy - 4 * s, sx + 10 * s, sy + 5 * s, sx + 16 * s, sy + 1 * s);
      x.stroke();
    }
  }
}
// paving: draw 4×4 tiles with the old per-tile pattern code (no curbs; the shader adds those)
function pathLayer(x, n, m) {
  const tile = n / 4;
  x.save();
  x.scale(tile / T, tile / T);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) drawPaving(x, i + 40, j + 40, i * T, j * T, m);
  x.restore();
}
// service road: plain asphalt (the shader paints the centre line, following each tile's road)
function serviceLayer(x, n) {
  pathLayer(x, n, 'asphalt');
  x.fillStyle = 'rgba(70,72,76,.35)';
  x.fillRect(0, 0, n, n);
}
// safari track: packed dirt with two worn wheel ruts per tile
function trackLayer(x, n) {
  pathLayer(x, n, 'dirt');
  const tile = n / 4;
  x.fillStyle = 'rgba(70,50,30,.35)';
  for (let k = 0; k < 4; k++) for (const o of [0.3, 0.62]) x.fillRect(k * tile + tile * o, 0, tile * 0.1, n);
}
function waterbedLayer(x, n) {
  x.fillStyle = '#55705a';
  x.fillRect(0, 0, n, n);
  for (let k = 0; k < 400; k++) {
    x.fillStyle = pick(['rgba(30,50,40,.25)', 'rgba(110,130,100,.18)']);
    x.beginPath();
    x.arc(Math.random() * n, Math.random() * n, rnd(2, 9), 0, 7);
    x.fill();
  }
}
const GROUND_ATLAS = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = ATLAS_SIZE;
  const ctx = c.getContext('2d'),
    cell = document.createElement('canvas');
  cell.width = cell.height = ATLAS_CELL;
  const cx = cell.getContext('2d');
  seeded(() => {
    seedRand(9091);
    GROUND_LAYERS.forEach((k, li) => {
      cx.clearRect(0, 0, ATLAS_CELL, ATLAS_CELL);
      if (k === 'grass') grassLayer(cx, ATLAS_CELL);
      else if (BIOMES[k]) biomeLayer(cx, ATLAS_CELL, BIOMES[k]);
      else if (k === 'waterbed') waterbedLayer(cx, ATLAS_CELL);
      else if (k === 'service') serviceLayer(cx, ATLAS_CELL);
      else if (k === 'track') trackLayer(cx, ATLAS_CELL);
      else pathLayer(cx, ATLAS_CELL, k === 'tunnel' ? 'stone' : k);
      // copy into the atlas with a wrapped gutter so filtering never bleeds in a neighbour
      const ox = (li % ATLAS_COLS) * ATLAS_STRIDE + ATLAS_PAD,
        oy = Math.floor(li / ATLAS_COLS) * ATLAS_STRIDE + ATLAS_PAD;
      for (const dx of [-ATLAS_CELL, 0, ATLAS_CELL])
        for (const dy of [-ATLAS_CELL, 0, ATLAS_CELL]) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(ox - ATLAS_PAD, oy - ATLAS_PAD, ATLAS_STRIDE, ATLAS_STRIDE);
          ctx.clip();
          ctx.drawImage(cell, ox + dx, oy + dy);
          ctx.restore();
        }
    });
  });
  const t = new THREE.CanvasTexture(c);
  t.encoding = THREE.sRGBEncoding;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
})();
// large, soft brightness variation so the repeating lawn doesn't look tiled from far away
const GROUND_VARY = (() => {
  const n = 128,
    c = document.createElement('canvas');
  c.width = c.height = n;
  const x = c.getContext('2d');
  x.fillStyle = 'rgb(128,128,128)';
  x.fillRect(0, 0, n, n);
  seeded(() => {
    seedRand(77);
    for (let k = 0; k < 60; k++) {
      const px = Math.random() * n,
        py = Math.random() * n,
        r = rnd(8, 30),
        v = Math.random() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.18)';
      wrapDraw(x, n, (ox, oy) => {
        const gr = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r);
        gr.addColorStop(0, v);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = gr;
        x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2);
      });
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
})();

let groundData = null,
  groundTex = null;
function makeGroundData() {
  groundData = new Uint8Array(W * H * 4);
  groundTex = new THREE.DataTexture(groundData, W, H, THREE.RGBAFormat);
  groundTex.magFilter = groundTex.minFilter = THREE.NearestFilter;
  groundTex.needsUpdate = true;
  if (groundU.tileData) {
    groundU.tileData.value = groundTex;
    groundU.mapSize.value.set(W, H);
  }
}
const groundU = {};
const groundMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
groundMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, {
    tileData: { value: groundTex },
    mapSize: { value: new THREE.Vector2(W, H) },
    atlas: { value: GROUND_ATLAS },
    detailMap: { value: DETAIL },
    varyMap: { value: GROUND_VARY },
    layerRep: { value: LAYER_REPEAT },
  });
  Object.assign(groundU, sh.uniforms);
  sh.vertexShader = sh.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vWXZ;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWXZ = (modelMatrix * vec4(position, 1.0)).xz;');
  sh.fragmentShader = sh.fragmentShader
    .replace(
      '#include <common>',
      `#include <common>
varying vec2 vWXZ;
uniform sampler2D tileData, atlas, detailMap, varyMap;
uniform vec2 mapSize;
uniform float layerRep[${GROUND_LAYERS.length}];
float gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 atlasAt(float layer, vec2 wp) {
  vec2 lu = wp / layerRep[int(layer)];
  vec2 cell = vec2(mod(layer, ${ATLAS_COLS}.0), floor(layer / ${ATLAS_COLS}.0));
  float sc = ${ATLAS_CELL}.0 / ${ATLAS_SIZE}.0;
  vec2 uv = (cell * ${ATLAS_STRIDE}.0 + ${ATLAS_PAD}.0) / ${ATLAS_SIZE}.0 + fract(lu) * sc;
  // gradients from the unwrapped coordinates, so mip selection doesn't jump at repeat seams
  return textureGrad(atlas, vec2(uv.x, 1.0 - uv.y), dFdx(lu) * sc * vec2(1.0, -1.0), dFdy(lu) * sc * vec2(1.0, -1.0)).rgb;
}
float bit(float v, float b) { return mod(floor(v / b), 2.0); }
// the dashed yellow line on a road tile: it runs the way the road does, and curves round bends
float roadBand(float d, float fw) { return 1.0 - smoothstep(-fw, fw, d); }
float roadLine(vec2 f, float arms, float fw) {
  bool n = bit(arms, 1.0) > 0.5, s = bit(arms, 2.0) > 0.5, w = bit(arms, 4.0) > 0.5, e = bit(arms, 8.0) > 0.5;
  float cnt = float(n) + float(s) + float(w) + float(e);
  if (cnt < 1.0 || cnt > 2.0) return 0.0; // junctions and big paved areas are left plain
  vec2 p = f - 0.5;
  float a = 0.0;
  if (cnt == 2.0 && (n || s) && (w || e)) {
    vec2 d = p - vec2(e ? 0.5 : -0.5, s ? 0.5 : -0.5);
    float ang = atan(abs(d.y), abs(d.x));
    a = roadBand(abs(length(d) - 0.5) - 0.03, fw) * roadBand(abs(ang - 0.7854) - 0.32, fw * 2.0);
  } else if (n || s) a = roadBand(abs(p.x) - 0.03, fw) * roadBand(abs(p.y) - 0.16, fw);
  else a = roadBand(abs(p.y) - 0.03, fw) * roadBand(abs(p.x) - 0.16, fw);
  return a * clamp(0.09 / fw, 0.0, 1.0);
}`
    )
    .replace(
      '#include <map_fragment>',
      `{
  vec2 wp = vWXZ;
  vec2 tc = clamp(floor(wp), vec2(0.0), mapSize - 1.0);
  vec4 td = texture2D(tileData, (tc + 0.5) / mapSize) * 255.0;
  float code = floor(td.r + 0.5), layer = mod(code, 16.0), arms = floor(code / 16.0);
  float edges = floor(td.g + 0.5), amt = td.b, gmk = td.a / 255.0;
  vec3 col = pow(atlasAt(layer, wp), vec3(2.2)); // the atlas is sRGB; light in linear space
  vec2 f = wp - tc;
  if (layer == 14.0 && arms > 0.0) col = mix(col, vec3(0.70, 0.46, 0.05), roadLine(f, arms, max(length(fwidth(wp)) * 0.7, 0.002)));
  // soft large-scale variation on lawn and floors
  if (layer < 7.0) col *= 0.88 + texture2D(varyMap, wp / 34.0).r * 0.24;
  // curbs on paved paths
  if (layer >= 7.0 && layer <= 9.0 || layer == 12.0 || layer == 14.0) {
    vec3 curb = layer == 8.0 ? vec3(0.090, 0.025, 0.014) : vec3(0.113, 0.106, 0.095);
    float cw = 0.078;
    if ((bit(edges, 1.0) > 0.5 && f.y < cw) || (bit(edges, 2.0) > 0.5 && f.y > 1.0 - cw) ||
        (bit(edges, 4.0) > 0.5 && f.x < cw) || (bit(edges, 8.0) > 0.5 && f.x > 1.0 - cw)) col = curb;
  }
  // litter on paths: small scraps scattered on a 6×6 grid
  if (layer >= 7.0 && layer <= 12.0 && amt > 1.0) {
    vec2 cid = floor(wp * 6.0), cf = fract(wp * 6.0);
    float h = gh(cid);
    if (h < amt / 255.0 * 0.5 && length(cf - vec2(0.5)) < 0.22) {
      float k = gh(cid + 7.1);
      col = k < 0.3 ? vec3(0.91) : k < 0.55 ? vec3(0.78, 0.12, 0.05) : k < 0.8 ? vec3(0.05, 0.24, 0.78) : vec3(0.89, 0.58, 0.07);
    }
  }
  // dung in dirty habitats
  if (layer >= 1.0 && layer <= 6.0 && amt > 1.0) {
    vec2 cid = floor(wp * 3.0), cf = fract(wp * 3.0) - vec2(0.5);
    if (gh(cid + 3.3) < amt / 255.0 * 0.35 && length(cf * vec2(1.0, 1.5)) < 0.12)
      col = layer == 6.0 ? vec3(0.08, 0.20, 0.04) : vec3(0.14, 0.07, 0.025);
  }
  // shadow just inside habitat fences
  float fe = 1.0;
  if (bit(edges, 16.0) > 0.5) fe = min(fe, smoothstep(0.0, 0.1, f.y));
  if (bit(edges, 32.0) > 0.5) fe = min(fe, smoothstep(0.0, 0.1, 1.0 - f.y));
  if (bit(edges, 64.0) > 0.5) fe = min(fe, smoothstep(0.0, 0.1, f.x));
  if (bit(edges, 128.0) > 0.5) fe = min(fe, smoothstep(0.0, 0.1, 1.0 - f.x));
  col *= 0.75 + 0.25 * fe;
  // grass blades
  vec2 du = wp * 1.6;
  vec3 dtl = texture2D(detailMap, du).rgb * 2.0, dtl2 = texture2D(detailMap, du * 0.27 + 0.31).rgb * 2.0;
  col *= mix(vec3(1.0), mix(dtl, dtl2, 0.35), gmk * 0.85 + 0.15);
  diffuseColor.rgb *= col;
}`
    );
};

// fill the data texture from the tiles
function paintGround() {
  if (!groundData || groundTex.image.width !== W || groundTex.image.height !== H) makeGroundData();
  const d = groundData;
  const isP = (x, y) => inB(x, y) && S.tiles[idx(x, y)].t === 'p';
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = idx(x, y),
        t = S.tiles[i],
        o = i * 4;
      let layer,
        edges = 0,
        amt = 0,
        gm = 255;
      const e = t.e && F.emap[t.e];
      if (t.w) {
        layer = LAYER.waterbed;
        gm = 0;
      } else if (t.t === 'p') {
        layer =
          e && e.biome === 'pool'
            ? LAYER.tunnel
            : (LAYER[t.pm === 'crossing' ? (t.br === 'road' ? 'stone' : 'service') : t.pm || 'stone'] ?? LAYER.stone); // under a bridge: the lower path
        if (t.pm !== 'dirt' && t.pm !== 'sand') {
          if (!isP(x, y - 1)) edges |= 1;
          if (!isP(x, y + 1)) edges |= 2;
          if (!isP(x - 1, y)) edges |= 4;
          if (!isP(x + 1, y)) edges |= 8;
        }
        amt = Math.min(255, (t.l || 0) * 40);
        gm = 0;
      } else if (e) {
        layer = LAYER[e.biome];
        amt = Math.round((e.dirt || 0) * 2.55);
        gm = ['savanna', 'prairie', 'jungle'].includes(e.biome) ? 170 : 60;
      } else layer = LAYER.grass;
      if (e && e.biome !== 'pool') {
        const other = (xx, yy) => !inB(xx, yy) || S.tiles[idx(xx, yy)].e !== t.e;
        if (other(x, y - 1)) edges |= 16;
        if (other(x, y + 1)) edges |= 32;
        if (other(x - 1, y)) edges |= 64;
        if (other(x + 1, y)) edges |= 128;
      }
      let arms = 0;
      if (layer === LAYER.service) {
        const rd = (xx, yy) => inB(xx, yy) && isRoad(idx(xx, yy));
        arms = (rd(x, y - 1) ? 1 : 0) | (rd(x, y + 1) ? 2 : 0) | (rd(x - 1, y) ? 4 : 0) | (rd(x + 1, y) ? 8 : 0);
      }
      d[o] = layer + arms * 16;
      d[o + 1] = edges;
      d[o + 2] = amt;
      d[o + 3] = gm;
    }
  groundTex.needsUpdate = true;
  groundDirty = false;
}

// the ground mesh, in GROUND_CHUNK × GROUND_CHUNK pieces sharing one material
const GROUND_CHUNK = 32;
const groundRoot = new THREE.Group();
scene.add(groundRoot);
function makeGroundMeshes() {
  for (const m of groundRoot.children) m.geometry.dispose();
  groundRoot.clear();
  for (let cy = 0; cy < H; cy += GROUND_CHUNK)
    for (let cx = 0; cx < W; cx += GROUND_CHUNK) {
      const w = Math.min(GROUND_CHUNK, W - cx),
        h = Math.min(GROUND_CHUNK, H - cy);
      const g = new THREE.PlaneGeometry(w, h, w, h);
      g.rotateX(-Math.PI / 2);
      g.translate(cx + w / 2, 0, cy + h / 2);
      const m = new THREE.Mesh(g, groundMat);
      m.receiveShadow = true;
      m.userData.chunk = [cx, cy, w, h];
      groundRoot.add(m);
    }
}
function applyHeights() {
  if (!groundRoot.children.length) makeGroundMeshes();
  for (const m of groundRoot.children) {
    const [cx, cy, w, h] = m.userData.chunk,
      pos = m.geometry.attributes.position;
    // skip chunks whose heights haven't changed since last time
    let sum = 0;
    for (let j = 0; j <= h; j++)
      for (let i = 0; i <= w; i++) sum = (sum * 31 + Math.round(hC(cx + i, cy + j) * 1000)) | 0;
    if (m.userData.hsum === sum) continue;
    m.userData.hsum = sum;
    for (let j = 0; j <= h; j++) for (let i = 0; i <= w; i++) pos.setY(j * (w + 1) + i, hC(cx + i, cy + j));
    pos.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingSphere();
    m.geometry.computeBoundingBox();
  }
}
// litter and dung change every few seconds; repaint the data texture when they do
let groundSig = '';
function groundSignature() {
  let s = '';
  for (const e of S.encl) s += Math.floor((e.dirt || 0) / 6) + ',';
  let l = 0;
  for (const i of F.paths || []) if (S.tiles[i].l) l += S.tiles[i].l * (i + 1); // litter lies on paths only
  return s + l;
}
