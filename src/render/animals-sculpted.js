/* Fallback animal models sculpted in code (signed distance shapes to meshes), used until a rigged model loads. */
/* animals: sculpted organic meshes (signed-distance shapes → surface nets) */
function E(c, r, tag, rz) {
  return { t: 0, c, r, tag, rz: rz || 0 };
}
function C(a, b, r1, r2, tag) {
  return { t: 1, a, b, r1, r2, tag };
}
function dPart(p, x, y, z) {
  if (p.t === 0) {
    let px = x - p.c[0],
      py = y - p.c[1];
    const pz = z - p.c[2];
    if (p.rz) {
      const c = Math.cos(-p.rz),
        s = Math.sin(-p.rz),
        qx = px * c - py * s;
      py = px * s + py * c;
      px = qx;
    }
    const ax = px / p.r[0],
      ay = py / p.r[1],
      az = pz / p.r[2],
      k0 = Math.sqrt(ax * ax + ay * ay + az * az);
    const bx = ax / p.r[0],
      by = ay / p.r[1],
      bz = az / p.r[2],
      k1 = Math.sqrt(bx * bx + by * by + bz * bz);
    return k1 < 1e-9 ? -Math.min(p.r[0], p.r[1], p.r[2]) : (k0 * (k0 - 1)) / k1;
  }
  const pax = x - p.a[0],
    pay = y - p.a[1],
    paz = z - p.a[2],
    bax = p.b[0] - p.a[0],
    bay = p.b[1] - p.a[1],
    baz = p.b[2] - p.a[2];
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1),
    dx = pax - bax * h,
    dy = pay - bay * h,
    dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.r1 + (p.r2 - p.r1) * h);
}
function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b + (a - b) * h - k * h * (1 - h);
}
function sdfOf(parts, k) {
  return (x, y, z) => {
    let d = dPart(parts[0], x, y, z);
    for (let i = 1; i < parts.length; i++) d = smin(d, dPart(parts[i], x, y, z), parts[i].k || k);
    return d;
  };
}
function pbounds(parts) {
  const mn = [1e9, 1e9, 1e9],
    mx = [-1e9, -1e9, -1e9];
  const ext = (c, r) => {
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i], c[i] - r);
      mx[i] = Math.max(mx[i], c[i] + r);
    }
  };
  for (const p of parts) {
    if (p.t === 0) ext(p.c, Math.max(...p.r));
    else {
      ext(p.a, Math.max(p.r1, p.r2));
      ext(p.b, Math.max(p.r1, p.r2));
    }
  }
  for (let i = 0; i < 3; i++) {
    mn[i] -= 0.04;
    mx[i] += 0.04;
  }
  return [mn, mx];
}
function n3(x, y, z) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z),
    fx = x - xi,
    fy = y - yi,
    fz = z - zi,
    u = fx * fx * (3 - 2 * fx),
    v = fy * fy * (3 - 2 * fy),
    w = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => hsh(i + k * 131, j - k * 71);
  const l = (a, b, t) => a + (b - a) * t;
  return l(
    l(l(h(xi, yi, zi), h(xi + 1, yi, zi), u), l(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), u), v),
    l(l(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), u), l(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), u), v),
    w
  );
}
const CORN = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 1, 0],
  [1, 1, 0],
  [0, 0, 1],
  [1, 0, 1],
  [0, 1, 1],
  [1, 1, 1],
];
const EDG = [];
for (let a = 0; a < 8; a++) for (const b of [1, 2, 4]) if (!(a & b)) EDG.push([a, a | b]);
function sculpt(parts, k, res, colorFn, off) {
  off = off || [0, 0, 0];
  const f = sdfOf(parts, k),
    [mn, mx] = pbounds(parts),
    s = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / res;
  const nx = Math.ceil((mx[0] - mn[0]) / s),
    ny = Math.ceil((mx[1] - mn[1]) / s),
    nz = Math.ceil((mx[2] - mn[2]) / s),
    gx = nx + 1,
    gy = ny + 1,
    gz = nz + 1;
  const fld = new Float32Array(gx * gy * gz),
    gi = (i, j, k) => i + gx * (j + gy * k),
    ci = (i, j, k) => i + nx * (j + ny * k);
  for (let kk = 0; kk < gz; kk++)
    for (let j = 0; j < gy; j++)
      for (let i = 0; i < gx; i++) fld[gi(i, j, kk)] = f(mn[0] + i * s, mn[1] + j * s, mn[2] + kk * s);
  const vid = new Int32Array(nx * ny * nz).fill(-1),
    pos = [],
    val = new Float32Array(8);
  for (let kk = 0; kk < nz; kk++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        let m = 0;
        for (let c = 0; c < 8; c++) {
          const o = CORN[c];
          val[c] = fld[gi(i + o[0], j + o[1], kk + o[2])];
          if (val[c] < 0) m |= 1 << c;
        }
        if (m === 0 || m === 255) continue;
        let sx = 0,
          sy = 0,
          sz = 0,
          n = 0;
        for (const [a, b] of EDG) {
          if (val[a] < 0 === val[b] < 0) continue;
          const t = val[a] / (val[a] - val[b]),
            A = CORN[a],
            B = CORN[b];
          sx += A[0] + (B[0] - A[0]) * t;
          sy += A[1] + (B[1] - A[1]) * t;
          sz += A[2] + (B[2] - A[2]) * t;
          n++;
        }
        vid[ci(i, j, kk)] = pos.length / 3;
        pos.push(mn[0] + (i + sx / n) * s, mn[1] + (j + sy / n) * s, mn[2] + (kk + sz / n) * s);
      }
  const idx = [];
  const quad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    idx.push(a, b, c, a, c, d);
  };
  for (let kk = 0; kk < gz; kk++)
    for (let j = 0; j < gy; j++)
      for (let i = 0; i < gx; i++) {
        const v0 = fld[gi(i, j, kk)] < 0;
        if (i < nx && j > 0 && j < ny && kk > 0 && kk < nz && v0 !== fld[gi(i + 1, j, kk)] < 0)
          quad(vid[ci(i, j - 1, kk - 1)], vid[ci(i, j, kk - 1)], vid[ci(i, j, kk)], vid[ci(i, j - 1, kk)]);
        if (j < ny && i > 0 && i < nx && kk > 0 && kk < nz && v0 !== fld[gi(i, j + 1, kk)] < 0)
          quad(vid[ci(i - 1, j, kk - 1)], vid[ci(i, j, kk - 1)], vid[ci(i, j, kk)], vid[ci(i - 1, j, kk)]);
        if (kk < nz && i > 0 && i < nx && j > 0 && j < ny && v0 !== fld[gi(i, j, kk + 1)] < 0)
          quad(vid[ci(i - 1, j - 1, kk)], vid[ci(i, j - 1, kk)], vid[ci(i, j, kk)], vid[ci(i - 1, j, kk)]);
      }
  const nv = pos.length / 3,
    nor = new Float32Array(nv * 3),
    col = new Float32Array(nv * 3),
    e = s * 0.5;
  for (let v = 0; v < nv; v++) {
    const x = pos[v * 3],
      y = pos[v * 3 + 1],
      z = pos[v * 3 + 2];
    let a = f(x + e, y, z) - f(x - e, y, z),
      b = f(x, y + e, z) - f(x, y - e, z),
      c = f(x, y, z + e) - f(x, y, z - e);
    const l = Math.hypot(a, b, c) || 1;
    a /= l;
    b /= l;
    c /= l;
    nor[v * 3] = a;
    nor[v * 3 + 1] = b;
    nor[v * 3 + 2] = c;
    let best = 1e9,
      tag = '';
    for (const p of parts) {
      const d = dPart(p, x, y, z);
      if (d < best) {
        best = d;
        tag = p.tag;
      }
    }
    const cc = colorFn(tag, x + off[0], y + off[1], z + off[2], [a, b, c]);
    col[v * 3] = Math.pow(cc[0], 2.2);
    col[v * 3 + 1] = Math.pow(cc[1], 2.2);
    col[v * 3 + 2] = Math.pow(cc[2], 2.2);
  }
  for (let t = 0; t < idx.length; t += 3) {
    const A = idx[t] * 3,
      B = idx[t + 1] * 3,
      Cc = idx[t + 2] * 3;
    const ux = pos[B] - pos[A],
      uy = pos[B + 1] - pos[A + 1],
      uz = pos[B + 2] - pos[A + 2],
      wx = pos[Cc] - pos[A],
      wy = pos[Cc + 1] - pos[A + 1],
      wz = pos[Cc + 2] - pos[A + 2];
    const fx = uy * wz - uz * wy,
      fy = uz * wx - ux * wz,
      fz = ux * wy - uy * wx;
    if (fx * nor[A] + fy * nor[A + 1] + fz * nor[A + 2] < 0) {
      const tmp = idx[t + 1];
      idx[t + 1] = idx[t + 2];
      idx[t + 2] = tmp;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
const hexA = (h) => {
  const c = new THREE.Color(h);
  return [c.r, c.g, c.b];
};
const mixA = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
function vor(x, y, z, sz) {
  const X = x / sz,
    Y = y / sz,
    Z = z / sz,
    xi = Math.floor(X),
    yi = Math.floor(Y),
    zi = Math.floor(Z);
  let d1 = 9,
    d2 = 9,
    id = 0;
  for (let k = -1; k <= 1; k++)
    for (let j = -1; j <= 1; j++)
      for (let i = -1; i <= 1; i++) {
        const a = xi + i,
          b = yi + j,
          c = zi + k;
        const px = a + hsh(a + c * 17, b),
          py = b + hsh(b + c * 31, a + 7),
          pz = c + hsh(a * 3 + b, c * 5 + 1),
          d = Math.hypot(px - X, py - Y, pz - Z);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          id = hsh(a * 7 + c, b * 13);
        } else if (d < d2) d2 = d;
      }
  return { edge: d2 - d1, id };
}
function quadSpec(o) {
  const L = o.len,
    Hh = o.h,
    Wd = o.w,
    by = o.leg + Hh * 0.42,
    P = [];
  P.push(
    E([0, by, 0], [L * 0.42, Hh * 0.46, Wd * 0.46], 'body'),
    E([L * 0.25, by + Hh * 0.05, 0], [L * 0.27, Hh * 0.52, Wd * 0.5], 'body'),
    E([-L * 0.26, by + Hh * 0.02, 0], [L * 0.26, Hh * 0.5, Wd * 0.48], 'body')
  );
  const nb = [L * 0.36, by + Hh * 0.18, 0],
    ne = [nb[0] + Math.cos(o.na) * o.neck, nb[1] + Math.sin(o.na) * o.neck, 0];
  P.push(C(nb, ne, o.nr * 1.25, o.nr * 0.85, 'neck'));
  const hr = o.hr,
    hc = [ne[0] + hr * 0.35, ne[1] + hr * 0.12, 0];
  P.push(E(hc, [hr * 1.1, hr * 0.88, hr * 0.76], 'head'));
  if (!o.noMuzzle)
    P.push(
      C(
        [hc[0] + hr * 0.45, hc[1] - hr * 0.12, 0],
        [hc[0] + hr * 1.5, hc[1] - hr * (o.drop || 0.45), 0],
        hr * 0.58,
        hr * (o.mr || 0.42),
        'muzzle'
      )
    );
  if (!o.noEars)
    for (const s of [1, -1])
      P.push(
        E([hc[0] - hr * 0.3, hc[1] + hr * 0.82, s * hr * 0.48], [hr * 0.16, hr * (o.earL || 0.36), hr * 0.1], 'ear')
      );
  if (!o.noTail) P.push(C([-L * 0.5, by + Hh * 0.18, 0], [-L * 0.64, by - Hh * 0.5, 0], 0.022, 0.012, 'tail'));
  const ctx = { L, Hh, Wd, by, hc, hr, nb, ne };
  if (o.extra) o.extra(P, ctx);
  const top = by - Hh * 0.12,
    ll = top,
    lr = o.lr;
  const leg = [
    C([0, 0, 0], [0, -ll * 0.52, 0], lr * 1.8, lr * 1.05, 'leg'),
    C([0, -ll * 0.52, 0], [0, -ll + 0.035, 0], lr * 1.02, lr * 0.82, 'leg'),
    E([0.008, -ll + 0.025, 0], [lr * 1.05, 0.028, lr * 0.98], 'hoof'),
  ];
  const legOff = [L * 0.3, top, Wd * 0.25];
  return {
    parts: P,
    k: o.k || 0.05,
    res: o.res || 58,
    col: o.col,
    limbTypes: { leg },
    limbs: [
      { type: 'leg', at: [L * 0.3, top, Wd * 0.25] },
      { type: 'leg', at: [L * 0.3, top, -Wd * 0.25] },
      { type: 'leg', at: [-L * 0.29, top, Wd * 0.25] },
      { type: 'leg', at: [-L * 0.29, top, -Wd * 0.25] },
    ],
    legOff,
    eyes: [[hc[0] + hr * 0.5, hc[1] + hr * 0.28, hr * 0.6], hr * 0.12],
    top: hc[1] + hr * 1.3,
  };
}
const Z_W = hexA('#eeebe3'),
  Z_B = hexA('#1a1a1a');
const SPEC = {
  zebra: () =>
    quadSpec({
      len: 0.62,
      h: 0.34,
      w: 0.26,
      leg: 0.34,
      lr: 0.034,
      neck: 0.3,
      na: 1.0,
      nr: 0.075,
      hr: 0.095,
      extra: (P, c) =>
        P.push(C([c.nb[0] - 0.02, c.nb[1] + 0.06, 0], [c.ne[0] - 0.02, c.ne[1] + 0.05, 0], 0.028, 0.03, 'mane')),
      col: (t, x, y, z, n) => {
        if (t === 'muzzle' && x > 0.5) return Z_B;
        if (t === 'mane' || t === 'hoof') return Z_B;
        if (t === 'tail') return y < 0.3 ? Z_B : Z_W;
        if (t === 'body' && n[1] < -0.65) return Z_W;
        const v =
          t === 'leg'
            ? Math.sin(y * 60)
            : Math.sin(x * 32 + Math.sin(y * 13 + z * 4) * 1.3 + y * 7 + n3(x * 9, y * 9, z * 9) * 1.4);
        return v > 0.18 ? Z_B : shade(Z_W, 0.94 + n3(x * 20, y * 20, z * 20) * 0.08);
      },
    }),
  giraffe: () =>
    quadSpec({
      len: 0.6,
      h: 0.34,
      w: 0.26,
      leg: 0.62,
      lr: 0.038,
      neck: 0.86,
      na: 1.3,
      nr: 0.07,
      hr: 0.085,
      drop: 0.35,
      extra: (P, c) => {
        for (const s of [1, -1])
          P.push(
            C(
              [c.hc[0] - 0.02, c.hc[1] + c.hr * 0.7, s * 0.025],
              [c.hc[0] - 0.03, c.hc[1] + c.hr * 1.5, s * 0.03],
              0.012,
              0.014,
              'horn'
            )
          );
        P.push(C([c.nb[0] - 0.03, c.nb[1] + 0.05, 0], [c.ne[0] - 0.03, c.ne[1], 0], 0.018, 0.016, 'mane'));
      },
      col: (t, x, y, z, n) => {
        if (t === 'horn' || t === 'hoof') return hexA('#3f2c1c');
        if (t === 'mane') return hexA('#7a4a22');
        if (t === 'muzzle') return hexA('#d8c09a');
        if (t === 'leg' && y < 0.28) return mixA(hexA('#e9d8b2'), hexA('#b88a4f'), clamp((y - 0.08) / 0.2, 0, 1));
        const v = vor(x, y, z, 0.07);
        if (v.edge < 0.14) return hexA('#efdcb2');
        return shade(mixA(hexA('#a95e22'), hexA('#7f4518'), v.id), 0.95 + v.id * 0.1);
      },
    }),
  lion: () =>
    quadSpec({
      len: 0.62,
      h: 0.32,
      w: 0.28,
      leg: 0.3,
      lr: 0.05,
      neck: 0.12,
      na: 0.7,
      nr: 0.11,
      hr: 0.12,
      drop: 0.3,
      mr: 0.48,
      extra: (P, c) => {
        P.push(E([c.hc[0] - c.hr * 0.35, c.hc[1] - c.hr * 0.05, 0], [c.hr * 1.25, c.hr * 1.5, c.hr * 1.35], 'mane'));
        P.push(E([-c.L * 0.65, c.by - c.Hh * 0.52, 0], [0.035, 0.035, 0.035], 'tuft'));
      },
      col: (t, x, y, z, n) => {
        const nz = n3(x * 14, y * 14, z * 14);
        if (t === 'mane') return shade(mixA(hexA('#7a4719'), hexA('#4e2b0e'), nz), 1);
        if (t === 'tuft' || t === 'hoof') return hexA('#3d2410');
        if (t === 'muzzle') return hexA('#ead1a4');
        const b = hexA('#c7944b');
        if (n[1] < -0.4) return hexA('#e4c48e');
        return shade(b, 0.9 + nz * 0.18);
      },
    }),
  elephant: () =>
    quadSpec({
      len: 0.95,
      h: 0.62,
      w: 0.6,
      leg: 0.44,
      lr: 0.11,
      neck: 0.06,
      na: 0.4,
      nr: 0.2,
      hr: 0.22,
      noMuzzle: 1,
      noEars: 1,
      k: 0.07,
      extra: (P, c) => {
        const h = c.hc,
          r = c.hr;
        for (const s of [1, -1]) {
          P.push(E([h[0] - r * 0.35, h[1] - r * 0.05, s * r * 0.95], [r * 0.75, r * 1.05, 0.035], 'ear'));
          P.push(
            C(
              [h[0] + r * 0.75, h[1] - r * 0.5, s * r * 0.38],
              [h[0] + r * 1.5, h[1] - r * 0.45, s * r * 0.45],
              0.025,
              0.012,
              'tusk'
            )
          );
        }
        P.push(
          C([h[0] + r * 0.85, h[1] - r * 0.1, 0], [h[0] + r * 1.25, h[1] - r * 0.8, 0], r * 0.38, r * 0.26, 'trunk'),
          C([h[0] + r * 1.25, h[1] - r * 0.8, 0], [h[0] + r * 1.35, h[1] - r * 1.75, 0], r * 0.26, r * 0.16, 'trunk')
        );
      },
      col: (t, x, y, z, n) => {
        if (t === 'tusk') return hexA('#f2ead6');
        if (t === 'hoof') return hexA('#6e6b66');
        const w = n3(x * 24, y * 30, z * 24),
          g = hexA('#8a8c8d');
        return shade(t === 'ear' ? mixA(g, hexA('#9b8f8e'), 0.3) : g, 0.82 + w * 0.22);
      },
    }),
  tiger: () =>
    quadSpec({
      len: 0.72,
      h: 0.3,
      w: 0.27,
      leg: 0.28,
      lr: 0.05,
      neck: 0.1,
      na: 0.5,
      nr: 0.11,
      hr: 0.12,
      drop: 0.25,
      mr: 0.5,
      col: (t, x, y, z, n) => {
        const W2 = hexA('#f1e8d8'),
          O = hexA('#d8702a'),
          K = hexA('#1d1510');
        if (t === 'hoof') return W2;
        if (t === 'muzzle') return W2;
        if (t === 'body' && n[1] < -0.35) return W2;
        if (t === 'tail') {
          return Math.sin(y * 60) > 0.4 ? K : O;
        }
        const v =
          t === 'leg'
            ? Math.sin(y * 44 + n3(x * 9, y * 9, z * 9) * 2)
            : Math.sin(x * 26 + n3(x * 7, y * 7, z * 7) * 3.5 + y * 3);
        return v > 0.72 ? K : shade(O, 0.92 + n3(x * 18, y * 18, z * 18) * 0.12);
      },
    }),
  polar: () =>
    quadSpec({
      len: 0.78,
      h: 0.42,
      w: 0.4,
      leg: 0.3,
      lr: 0.085,
      neck: 0.15,
      na: 0.35,
      nr: 0.14,
      hr: 0.14,
      drop: 0.25,
      mr: 0.5,
      earL: 0.25,
      noTail: 1,
      k: 0.07,
      col: (t, x, y, z, n) => {
        if (t === 'muzzle' && x > 0.62) return hexA('#222');
        if (t === 'hoof') return hexA('#3a3632');
        return shade(hexA('#efe8d6'), 0.93 + n3(x * 16, y * 16, z * 16) * 0.09);
      },
    }),
  camel: () =>
    quadSpec({
      len: 0.7,
      h: 0.34,
      w: 0.3,
      leg: 0.58,
      lr: 0.04,
      neck: 0.5,
      na: 0.75,
      nr: 0.075,
      hr: 0.09,
      drop: 0.35,
      extra: (P, c) => P.push(E([-0.04, c.by + c.Hh * 0.5, 0], [0.17, 0.16, 0.13], 'body')),
      col: (t, x, y, z, n) => {
        if (t === 'hoof') return hexA('#5a4632');
        return shade(hexA(t === 'muzzle' ? '#b68c55' : '#c39a5e'), 0.9 + n3(x * 12, y * 12, z * 12) * 0.16);
      },
    }),
  fox: () =>
    quadSpec({
      len: 0.36,
      h: 0.17,
      w: 0.15,
      leg: 0.15,
      lr: 0.022,
      neck: 0.07,
      na: 0.6,
      nr: 0.05,
      hr: 0.072,
      earL: 1.05,
      drop: 0.3,
      mr: 0.3,
      noTail: 1,
      res: 52,
      extra: (P, c) => {
        P.push(C([-c.L * 0.45, c.by, 0], [-c.L * 0.85, c.by - 0.02, 0], 0.05, 0.06, 'tail'));
        P.push(E([-c.L * 0.98, c.by - 0.02, 0], [0.045, 0.045, 0.045], 'tip'));
      },
      col: (t, x, y, z, n) => {
        if (t === 'tip') return hexA('#f7f1e4');
        if (t === 'hoof' || (t === 'leg' && y < 0.07)) return hexA('#5a3c24');
        if (t === 'muzzle' || n[1] < -0.45) return hexA('#f4ecdc');
        if (t === 'ear' && n[0] > 0.3) return hexA('#f0d6c0');
        return shade(hexA('#e0b074'), 0.92 + n3(x * 20, y * 20, z * 20) * 0.12);
      },
    }),
  bison: () =>
    quadSpec({
      len: 0.85,
      h: 0.5,
      w: 0.44,
      leg: 0.3,
      lr: 0.07,
      neck: 0.05,
      na: 0.2,
      nr: 0.2,
      hr: 0.16,
      drop: 0.2,
      mr: 0.5,
      earL: 0.2,
      k: 0.07,
      extra: (P, c) => {
        P.push(E([c.L * 0.2, c.by + c.Hh * 0.3, 0], [c.L * 0.36, c.Hh * 0.5, c.Wd * 0.5], 'shag'));
        P.push(E([c.hc[0] - 0.02, c.hc[1] + 0.02, 0], [c.hr * 1.1, c.hr * 1.05, c.hr * 0.95], 'shag'));
        for (const s of [1, -1])
          P.push(
            C(
              [c.hc[0], c.hc[1] + c.hr * 0.55, s * c.hr * 0.75],
              [c.hc[0] + 0.03, c.hc[1] + c.hr * 1.05, s * c.hr * 1.05],
              0.026,
              0.01,
              'horn'
            )
          );
      },
      col: (t, x, y, z, n) => {
        const nz = n3(x * 16, y * 16, z * 16);
        if (t === 'horn') return hexA('#2a2826');
        if (t === 'hoof') return hexA('#24201c');
        if (t === 'shag' || t === 'head' || t === 'muzzle') return shade(mixA(hexA('#3c2817'), hexA('#5a3d24'), nz), 1);
        return shade(hexA('#6a4a2f'), 0.88 + nz * 0.2);
      },
    }),
  penguin: () => ({
    parts: [
      E([0, 0.27, 0], [0.15, 0.25, 0.14], 'body'),
      E([0.01, 0.52, 0], [0.1, 0.1, 0.095], 'head'),
      C([0.09, 0.51, 0], [0.17, 0.495, 0], 0.025, 0.008, 'beak'),
      E([0.06, 0.015, 0.055], [0.06, 0.015, 0.04], 'feet'),
      E([0.06, 0.015, -0.055], [0.06, 0.015, 0.04], 'feet'),
      E([-0.01, 0.3, 0.14], [0.035, 0.13, 0.022], 'flip', 0.15),
      E([-0.01, 0.3, -0.14], [0.035, 0.13, 0.022], 'flip', 0.15),
    ],
    k: 0.035,
    res: 52,
    col: (t, x, y, z, n) => {
      const K = hexA('#1b1f24');
      if (t === 'beak' || t === 'feet') return hexA('#e68f2a');
      if (t === 'flip') return K;
      if (t === 'head') return n[0] > 0.55 && y < 0.5 ? hexA('#f5f3ee') : K;
      return n[0] > 0.1 ? shade(hexA('#f3f1ea'), 0.96 + n3(x * 20, y * 20, z * 20) * 0.05) : K;
    },
    limbs: [],
    limbTypes: {},
    eyes: [[0.075, 0.55, 0.05], 0.013],
    top: 0.66,
    waddle: true,
  }),
  monkey: () => ({
    parts: [
      E([0, 0.32, 0], [0.12, 0.16, 0.11], 'body'),
      E([0.04, 0.55, 0], [0.1, 0.095, 0.095], 'head'),
      E([0.11, 0.54, 0], [0.05, 0.065, 0.07], 'face'),
      E([0.03, 0.58, 0.095], [0.03, 0.035, 0.02], 'face'),
      E([0.03, 0.58, -0.095], [0.03, 0.035, 0.02], 'face'),
      C([-0.1, 0.26, 0], [-0.22, 0.46, 0], 0.02, 0.015, 'body'),
    ],
    k: 0.04,
    res: 50,
    col: (t, x, y, z, n) =>
      t === 'face' || t === 'hand' ? hexA('#ddb287') : shade(hexA('#7a5132'), 0.88 + n3(x * 20, y * 20, z * 20) * 0.2),
    limbTypes: {
      leg: [C([0, 0, 0], [0, -0.19, 0], 0.036, 0.028, 'body'), E([0.03, -0.2, 0], [0.05, 0.02, 0.03], 'hand')],
      arm: [C([0, 0, 0], [0, -0.22, 0], 0.03, 0.024, 'body'), E([0, -0.24, 0], [0.03, 0.03, 0.025], 'hand')],
    },
    limbs: [
      { type: 'leg', at: [0, 0.2, 0.06] },
      { type: 'leg', at: [0, 0.2, -0.06] },
      { type: 'arm', at: [0.02, 0.42, 0.12] },
      { type: 'arm', at: [0.02, 0.42, -0.12] },
    ],
    legOff: [0, 0.2, 0],
    eyes: [[0.135, 0.57, 0.03], 0.012],
    top: 0.72,
  }),
  gorilla: () => ({
    parts: [
      E([0, 0.46, 0], [0.22, 0.27, 0.21], 'body'),
      E([0.06, 0.58, 0], [0.18, 0.14, 0.25], 'body'),
      E([0.13, 0.45, 0], [0.1, 0.17, 0.15], 'chest'),
      E([0.17, 0.73, 0], [0.13, 0.12, 0.12], 'head'),
      E([0.26, 0.7, 0], [0.06, 0.08, 0.09], 'face'),
      E([0.24, 0.79, 0], [0.05, 0.03, 0.1], 'head'),
    ],
    k: 0.05,
    res: 56,
    col: (t, x, y, z, n) => {
      if (t === 'chest' || t === 'face' || t === 'hand') return hexA('#3f3a3c');
      return shade(hexA('#2a2829'), 0.85 + n3(x * 22, y * 22, z * 22) * 0.3);
    },
    limbTypes: {
      arm: [C([0, 0, 0], [0.06, -0.5, 0], 0.075, 0.06, 'body'), E([0.07, -0.53, 0], [0.06, 0.035, 0.05], 'hand')],
      leg: [C([0, 0, 0], [0, -0.24, 0], 0.08, 0.065, 'body'), E([0.04, -0.255, 0], [0.08, 0.025, 0.05], 'hand')],
    },
    limbs: [
      { type: 'arm', at: [0.08, 0.6, 0.25] },
      { type: 'leg', at: [-0.08, 0.26, 0.12] },
      { type: 'arm', at: [0.08, 0.6, -0.25] },
      { type: 'leg', at: [-0.08, 0.26, -0.12] },
    ],
    legOff: [0, 0.4, 0],
    eyes: [[0.3, 0.75, 0.04], 0.014],
    top: 0.95,
  }),
  kangaroo: () => ({
    parts: [
      E([0, 0.4, 0], [0.14, 0.28, 0.13], 'body', -0.35),
      E([0.06, 0.36, 0], [0.09, 0.2, 0.1], 'belly', -0.3),
      E([0.14, 0.68, 0], [0.09, 0.075, 0.065], 'head'),
      C([0.18, 0.67, 0], [0.26, 0.64, 0], 0.05, 0.03, 'head'),
      E([0.1, 0.79, 0.04], [0.025, 0.07, 0.018], 'ear'),
      E([0.1, 0.79, -0.04], [0.025, 0.07, 0.018], 'ear'),
      C([-0.12, 0.22, 0], [-0.42, 0.03, 0], 0.06, 0.025, 'body'),
      E([-0.02, 0.24, 0.09], [0.13, 0.11, 0.06], 'body'),
      E([-0.02, 0.24, -0.09], [0.13, 0.11, 0.06], 'body'),
      E([0.07, 0.025, 0.07], [0.13, 0.025, 0.04], 'feet'),
      E([0.07, 0.025, -0.07], [0.13, 0.025, 0.04], 'feet'),
      C([0.12, 0.5, 0.07], [0.18, 0.4, 0.07], 0.022, 0.018, 'body'),
      C([0.12, 0.5, -0.07], [0.18, 0.4, -0.07], 0.022, 0.018, 'body'),
    ],
    k: 0.04,
    res: 56,
    col: (t, x, y, z, n) => {
      if (t === 'belly') return hexA('#e4cba8');
      if (t === 'feet') return hexA('#8a5e3e');
      return shade(hexA('#b07a52'), 0.9 + n3(x * 18, y * 18, z * 18) * 0.16);
    },
    limbs: [],
    limbTypes: {},
    eyes: [[0.2, 0.7, 0.045], 0.011],
    top: 0.88,
    hop: true,
  }),
};
for (const [k, cfg] of Object.entries({
  dolphin: ['#6f7d8a', '#e4e9ec', 0.36, 0.09],
  sealion: ['#6a4a32', '#7d5a3e', 0.3, 0.09],
  turtle: ['#5f5531', '#7a7a4e', 0.28, 0.06],
  shark: ['#6b7a84', '#eef0ed', 0.45, 0.1],
  orca: ['#121417', '#f1f2ef', 0.6, 0.17],
  beluga: ['#e9ece4', '#f4f5f0', 0.48, 0.14],
  manatee: ['#7d7b72', '#8e8b80', 0.42, 0.14],
})) {
  const [c1, c2, L, R] = cfg;
  SPEC[k] = () => ({
    parts: [
      E([0, 0, 0], [L, R, R], 'b'),
      C([L * 0.7, 0, 0], [L * 1.05, 0, 0], R * 0.5, R * 0.2, 'b'),
      C([-L * 0.7, 0, 0], [-L * 1.1, 0, 0], R * 0.5, R * 0.25, 'b'),
      E([-L * 1.12, 0, 0], [R * 0.4, 0.02, R * 1.2], 'b'),
      E([0, R * 0.95, 0], [R * 0.6, R * 0.7, 0.02], 'b'),
    ],
    k: 0.04,
    res: 44,
    col: (t, x, y, z, n) => hexA(y < -R * 0.2 ? c2 : c1),
    limbs: [],
    limbTypes: {},
    eyes: [[L * 0.75, R * 0.25, R * 0.45], 0.012],
    top: R * 2,
  });
}
// stand-in shapes while a model loads: the closest living relative
SPEC.mammoth = SPEC.elephant;
SPEC.sabre = SPEC.lion;
const AMAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, metalness: 0 });
const EYEMAT = new THREE.MeshStandardMaterial({ color: '#050505', roughness: 0.15, metalness: 0 });
const EYEGEO = new THREE.SphereGeometry(1, 10, 8);
const GCACHE = {};
function geoFor(sp) {
  if (GCACHE[sp]) return GCACHE[sp];
  const sc = SPEC[sp](),
    out = { spec: sc, body: sculpt(sc.parts, sc.k, sc.res, sc.col), limbs: {} };
  for (const [k, parts] of Object.entries(sc.limbTypes))
    out.limbs[k] = sculpt(parts, 0.04, 24, sc.col, sc.legOff || [0, 0, 0]);
  return (GCACHE[sp] = out);
}
