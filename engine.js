'use strict';
// Pixel environment engine: a tiny software renderer that draws procedurally
// generated scenes into a Uint32Array and animates weather / fire / particles.
(function (global) {

// ---------- utilities ----------
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
const bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function rng32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, s) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const pack = c => ((255 << 24) | (clamp(Math.round(c[2]), 0, 255) << 16) |
  (clamp(Math.round(c[1]), 0, 255) << 8) | clamp(Math.round(c[0]), 0, 255)) >>> 0;
const unpack = p => [p & 255, (p >>> 8) & 255, (p >>> 16) & 255];
const WHITE = [255, 255, 255];

function grad(stops, t) {
  const n = stops.length - 1, f = clamp(t, 0, 1) * n, i = Math.min(Math.floor(f), n - 1);
  return mix(stops[i], stops[i + 1], f - i);
}

function makeNoise(rand) {
  const p = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) p[i] = rand();
  const n = x => {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return p[i & 1023] * (1 - u) + p[(i + 1) & 1023] * u;
  };
  return (x, oct = 3) => {
    let s = 0, a = 0.5, fq = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += n(x * fq + o * 37.1) * a; norm += a; a *= 0.5; fq *= 2; }
    return s / norm;
  };
}

// ---------- palettes ----------
const SEASONS = {
  summer: {
    label: 'Summer', grass: '#5cb43e', grassDark: '#3f8a35', grassLight: '#8fd45e',
    hill: '#4c9c46', hillDark: '#37793d', mountain: '#6476a0', mountainDark: '#4a587e',
    snow: null, tree: ['#86cc55', '#4e9c3c', '#2f6a31'], pine: ['#4f8f4a', '#356b3c', '#22492d'],
    trunk: '#5c3b24', flowers: ['#ffe066', '#ff7aa8', '#ffffff', '#9ad0ff'],
    leaves: ['#7cc850', '#5aa83e', '#a8d860'], petals: ['#ffffff', '#ffe9a0'],
  },
  spring: {
    label: 'Spring', grass: '#7fcd5a', grassDark: '#58a845', grassLight: '#aee47e',
    hill: '#6cbd58', hillDark: '#4d9a4a', mountain: '#6f7fae', mountainDark: '#525f8c',
    snow: '#eef3ff', snowLevel: 0.62, tree: ['#ffd3e2', '#f29abd', '#c36a95'],
    pine: ['#5a9a50', '#3e7845', '#2a5434'], trunk: '#6a4530',
    flowers: ['#ffffff', '#ffd84d', '#ff8fc0', '#b48cff'],
    leaves: ['#ffd3e2', '#f7a8c8'], petals: ['#ffd6e6', '#ffffff', '#f7a8c8'],
  },
  autumn: {
    label: 'Autumn', grass: '#a49a45', grassDark: '#7d7535', grassLight: '#c8b860',
    hill: '#9c8a3e', hillDark: '#7a6a32', mountain: '#7a6e94', mountainDark: '#5a5074',
    snow: null, tree: ['#f6b13e', '#de6a2c', '#9e3b22'], pine: ['#4f7a48', '#3a5c3a', '#26402b'],
    trunk: '#4e3122', flowers: ['#e8c040', '#c4402a'],
    leaves: ['#f6b13e', '#de6a2c', '#c4402a', '#e8c040', '#9e3b22'], petals: ['#f6b13e', '#de6a2c'],
  },
  winter: {
    label: 'Winter', grass: '#eef3fa', grassDark: '#bfcde2', grassLight: '#ffffff',
    hill: '#dce6f3', hillDark: '#b3c3db', mountain: '#8796bb', mountainDark: '#65739a',
    snow: '#f6f9ff', snowLevel: 0.12, treeSnow: '#f4f8ff',
    tree: ['#c9d3df', '#8c97a6', '#5f6a78'], pine: ['#3f7a62', '#2b5a4a', '#1b3b33'],
    trunk: '#4a3328', flowers: [], leaves: ['#ffffff'], petals: ['#ffffff'],
  },
  desert: {
    label: 'Desert', grass: '#ebc77e', grassDark: '#c99a52', grassLight: '#f7dea4',
    hill: '#e0ad64', hillDark: '#bd8744', mountain: '#bf6a40', mountainDark: '#8f4a2c',
    snow: null, mesa: true, tree: ['#8fbf5a', '#5f9a44', '#3d7232'], pine: ['#6a9a50', '#4a7a40', '#30562e'],
    trunk: '#7a5232', flowers: ['#ff6a8a', '#ffd84d'], leaves: ['#e8c27a', '#c99a52'], petals: ['#ff8aa8'],
  },
  scorched: {
    label: 'Scorched', grass: '#3c2e29', grassDark: '#251c19', grassLight: '#5c3e2c',
    hill: '#30251f', hillDark: '#201815', mountain: '#3e2c2a', mountainDark: '#2a1d1c',
    snow: null, tree: ['#2a1e1b', '#1c1412', '#120c0b'], pine: ['#2a1e1b', '#1c1412', '#120c0b'],
    trunk: '#1a1210', flowers: ['#ff6a20', '#ffa040'], leaves: ['#5a3a2a', '#2a1e1b'], petals: ['#ff8a30'],
  },
};

const TIMES = {
  dawn: {
    label: 'Dawn', sky: ['#4d5fa8', '#a88bb8', '#f2b9a6', '#ffdcb0'], tint: '#ffb49a', amt: 0.15, bright: 0.9,
    cel: { type: 'sun', x: 0.78, y: 0.62, r: 0.07, color: '#fff0c8', glow: '#ffd9a0' },
    cloud: ['#ffe4d6', '#e8b0b8', '#a88aa8'],
  },
  day: {
    label: 'Day', sky: ['#3a7bd5', '#6eaeea', '#bfe3f7'], tint: '#ffffff', amt: 0, bright: 1,
    cel: { type: 'sun', x: 0.8, y: 0.28, r: 0.055, color: '#fffbe0', glow: '#fff2a8' },
    cloud: ['#ffffff', '#dde8f6', '#b2c6e0'],
  },
  sunset: {
    label: 'Sunset', sky: ['#28245e', '#8a3f7a', '#e8664f', '#ffbe6a'], tint: '#ff7a45', amt: 0.22, bright: 0.82,
    cel: { type: 'sun', x: 0.3, y: 0.66, r: 0.09, color: '#ffe9a8', glow: '#ffb060' },
    cloud: ['#ffcf9e', '#e47d6e', '#8a4a72'],
  },
  night: {
    label: 'Night', sky: ['#050818', '#0f1840', '#26366a'], tint: '#2c3c8c', amt: 0.38, bright: 0.42,
    cel: { type: 'moon', x: 0.74, y: 0.3, r: 0.05, color: '#eef0ff', glow: '#8a9ad8' },
    cloud: ['#4b5785', '#343e66', '#222a4a'],
  },
};

const FIRE = ['#000000', '#2a0b08', '#5c1408', '#9a2008', '#d23a0c', '#ee6414',
  '#f89226', '#fcbe3c', '#fde26a', '#fff8d0'].map(c => pack(hex(c)));

function makePalette(cfg) {
  const S = SEASONS[cfg.season] || SEASONS.summer, T = TIMES[cfg.time] || TIMES.day;
  let sky = T.sky.map(hex), cloud = T.cloud.map(hex), tint = hex(T.tint), amt = T.amt, bright = T.bright;
  let cel = { ...T.cel, color: hex(T.cel.color), glow: hex(T.cel.glow) };
  if (cfg.sky === 'overcast') {
    const k = 0.3 + bright * 0.7;
    sky = ['#555c68', '#767e8a', '#9aa2ad'].map((c, i) =>
      mix(mul(hex(c), k), sky[Math.round(i / 2 * (sky.length - 1))], 0.18));
    cloud = ['#a9b0ba', '#838a95', '#5c626c'].map(c => mul(hex(c), k));
    cel = null; bright *= 0.85;
  } else if (cfg.sky === 'smoke') {
    sky = ['#1a0705', '#4e160c', '#a8361a', '#ec7430'].map(hex);
    cloud = ['#6a443a', '#4a302a', '#2e1e1b'].map(hex);
    cel = { type: 'sun', x: 0.68, y: 0.55, r: 0.06, color: hex('#ffb07a'), glow: null };
    tint = hex('#ff4a1a'); amt = 0.28; bright *= 0.72;
  }
  const L = c => mix(mul(hex(c), bright), tint, amt);
  const skyLow = sky[sky.length - 1];
  return {
    sky, cloud, cel, skyLow, bright, night: bright < 0.6, light: c => mix(mul(c, bright), tint, amt),
    grass: L(S.grass), grassDark: L(S.grassDark), grassLight: L(S.grassLight),
    hill: L(S.hill), hillDark: L(S.hillDark), mountain: L(S.mountain), mountainDark: L(S.mountainDark),
    snow: S.snow ? L(S.snow) : null, snowLevel: S.snowLevel ?? 0.6, treeSnow: S.treeSnow ? L(S.treeSnow) : null,
    tree: S.tree.map(L), pine: S.pine.map(L), cactus: ['#6fae52', '#4b8c3c', '#2f6629'].map(L),
    trunk: L(S.trunk), flowers: S.flowers.map(L), leaves: S.leaves.map(L), petals: S.petals.map(L),
    stone: [L('#8a8a92'), L('#5a5a62')], mesa: !!S.mesa,
    water: mix(mul(skyLow, 0.55), mul(hex('#1e3d66'), bright), 0.5),
    rain: mix(skyLow, WHITE, 0.45), rainFar: mix(skyLow, WHITE, 0.18),
    snowFlake: mix(WHITE, skyLow, 0.08), snowFar: mix(WHITE, skyLow, 0.45),
    fog: mix(skyLow, WHITE, 0.22), smoke: mix(mul(hex('#77706c'), bright), tint, amt),
    bird: birdColor(grad(sky, 0.4)),
  };
}

// Dark silhouettes on bright skies, pale ones on dark skies, so birds always read.
function birdColor(sky) {
  const lum = 0.299 * sky[0] + 0.587 * sky[1] + 0.114 * sky[2];
  return lum < 110 ? mix(sky, [215, 222, 240], 0.55) : mix(sky, [18, 16, 28], 0.8);
}

// ---------- scene ----------
class Scene {
  build(cfg) {
    this.cfg = cfg;
    const W = this.W = cfg.width | 0, H = this.H = cfg.height | 0;
    this.S = Math.sqrt((W * H) / (192 * 108));
    this.t = 0;
    this.P = makePalette(cfg);
    this.hz = Math.round(H * 0.62);
    this.gy = Math.round(H * (cfg.water ? 0.8 : 0.76));
    this.frame = new Uint32Array(W * H);
    this.image = new ImageData(new Uint8ClampedArray(this.frame.buffer), W, H);
    this.sky = new Uint32Array(W * H);
    this.far = new Uint32Array(W * H);
    this.near = new Uint32Array(W * H);
    this.fires = [];
    this.buildSky();
    this.buildFar();
    this.buildNear();
    this.initDynamic();
    for (let i = 0; i < 60; i++) this.step(1 / 30);
  }

  u(x) { return x * 192 / this.W; }

  put(b, x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < this.W && y < this.H) b[y * this.W + x] = c;
  }

  line(b, x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.put(b, x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  // ----- static layers -----
  buildSky() {
    const { W, H, P, hz } = this, b = this.sky;
    const bands = 14, cols = [];
    for (let i = 0; i <= bands; i++) cols.push(pack(grad(P.sky, i / bands)));
    for (let y = 0; y < H; y++) {
      const t = clamp(y / hz, 0, 1) * bands, base = Math.floor(t), fr = t - base;
      for (let x = 0; x < W; x++) b[y * W + x] = cols[Math.min(bands, fr > bayer(x, y) ? base + 1 : base)];
    }
    this.celPos = null;
    const cel = P.cel;
    if (!cel) return;
    const r = Math.max(3, Math.round(cel.r * H)), cx = cel.x * W, cy = cel.y * hz;
    this.celPos = { cx, cy, r };
    const gr = cel.glow ? r * 2.6 : r + 1;
    const R = rng32(this.cfg.seed + 101);
    const craters = [];
    for (let i = 0; i < 4; i++) craters.push([(R() - 0.5) * r * 1.1, (R() - 0.5) * r * 1.1, Math.max(0.8, r * (0.15 + R() * 0.2))]);
    const core = mix(cel.color, WHITE, 0.6), crater = mix(cel.color, P.skyLow, 0.3), rim = mix(cel.color, P.skyLow, 0.18);
    for (let y = Math.floor(cy - gr); y <= cy + gr; y++) {
      if (y < 0 || y >= H) continue;
      for (let x = Math.floor(cx - gr); x <= cx + gr; x++) {
        if (x < 0 || x >= W) continue;
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy), i = y * W + x;
        if (d <= r) {
          let c = cel.color;
          if (cel.type === 'sun') { if (d < r * 0.55) c = core; }
          else {
            if (craters.some(([ox, oy, cr]) => Math.hypot(dx - ox, dy - oy) < cr)) c = crater;
            if (dx > r * 0.45 && bayer(x, y) < (dx / r - 0.45) * 2) c = rim;
          }
          b[i] = pack(c);
        } else if (cel.glow) {
          const g = 1 - (d - r) / (gr - r);
          if (g * g * 0.9 > bayer(x, y)) b[i] = pack(mix(unpack(b[i]), cel.glow, 0.22 + 0.25 * g));
        }
      }
    }
  }

  treeCols(type, depth) {
    const P = this.P;
    const base = type === 'pine' ? P.pine : type === 'cactus' ? P.cactus : P.tree;
    const f = c => pack(mix(c, P.skyLow, depth));
    return { l: f(base[0]), m: f(base[1]), d: f(base[2]), trunk: f(P.trunk), snow: P.treeSnow ? f(P.treeSnow) : 0 };
  }

  tree(b, type, x, by, h, depth, R) {
    if (type === 'mixed') type = R() < 0.5 ? 'pine' : 'round';
    const c = this.treeCols(type, depth);
    if (type === 'pine') this.drawPine(b, x, by, h, c);
    else if (type === 'round') this.drawRound(b, x, by, h, c, R);
    else if (type === 'bare') this.drawBare(b, x, by, h, c, R);
    else if (type === 'cactus') this.drawCactus(b, x, by, h, c, R);
  }

  drawPine(b, x, by, h, c) {
    h = Math.max(5, Math.round(h));
    const trunkH = Math.max(1, Math.round(h * 0.14)), tw = h > 22 ? 2 : 1;
    for (let y = by - trunkH; y <= by; y++) for (let i = 0; i < tw; i++) this.put(b, x + i - (tw >> 1), y, c.trunk);
    const top = by - h, bottom = by - trunkH, ch = bottom - top;
    const tiers = Math.max(2, Math.round(h / 7)), tierH = ch / tiers, maxW = Math.max(2, h * 0.3);
    for (let y = top; y < bottom; y++) {
      const i = y - top, ti = Math.min(tiers - 1, Math.floor(i / tierH)), within = (i - ti * tierH) / tierH;
      const w = Math.round(((ti + 0.6 + within * 0.9) / (tiers + 0.5)) * maxW);
      for (let dx = -w; dx <= w; dx++) {
        const s = (dx / (w + 0.5)) * 0.55 + 0.5 + (within - 0.5) * 0.25 + (bayer(x + dx, y) - 0.5) * 0.3;
        let col = s < 0.33 ? c.l : s > 0.66 ? c.d : c.m;
        if (c.snow && within < 0.4 && dx < w * 0.5 && (within < 0.2 || bayer(x + dx, y) > 0.4)) col = c.snow;
        this.put(b, x + dx, y, col);
      }
    }
  }

  drawRound(b, x, by, h, c, R) {
    h = Math.max(6, Math.round(h));
    const r = h * 0.3, trunkH = Math.round(h * 0.42), tw = h > 18 ? 2 : 1;
    for (let y = by - trunkH; y <= by; y++) for (let i = 0; i < tw; i++) this.put(b, x + i - (tw >> 1), y, c.trunk);
    const cx = x + 0.5, cy = by - trunkH - r * 0.55;
    const blobs = [[0, 0, r], [-r * 0.65, r * 0.3, r * 0.72], [r * 0.65, r * 0.35, r * 0.7], [r * 0.15, -r * 0.55, r * 0.7]]
      .map(([bx, bY, br]) => [bx + (R() - 0.5) * r * 0.3, bY + (R() - 0.5) * r * 0.3, br]);
    const seed = (R() * 1e6) | 0;
    for (let Y = Math.floor(cy - r * 1.5); Y <= cy + r * 1.3; Y++) {
      for (let X = Math.floor(cx - r * 1.7); X <= cx + r * 1.7; X++) {
        const px = X + 0.5, py = Y + 0.5, jit = (hash2(X, Y, seed) - 0.5) * 1.4;
        let inside = false;
        for (const [bx, bY, br] of blobs) {
          const dx = px - (cx + bx), dy = py - (cy + bY), rr = br + jit;
          if (dx * dx + dy * dy < rr * rr) { inside = true; break; }
        }
        if (!inside) continue;
        const nx = (px - cx) / (r * 1.5), ny = (py - cy) / (r * 1.4);
        const s = 0.5 + nx * 0.45 + ny * 0.55 + (bayer(X, Y) - 0.5) * 0.35 + (hash2(X, Y, seed + 1) - 0.5) * 0.2;
        this.put(b, X, Y, s < 0.36 ? c.l : s > 0.68 ? c.d : c.m);
      }
    }
  }

  drawBare(b, x, by, h, c, R) {
    const branch = (x0, y0, ang, len, depth) => {
      const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len;
      this.line(b, x0, y0, x1, y1, c.trunk);
      if (depth > 3 && len > 4) this.line(b, x0 + 1, y0, x1 + 1, y1, c.trunk);
      if (depth <= 0 || len < 1.5) return;
      const spread = 0.35 + R() * 0.35;
      branch(x1, y1, ang + spread, len * (0.62 + R() * 0.15), depth - 1);
      branch(x1, y1, ang - spread, len * (0.62 + R() * 0.15), depth - 1);
    };
    branch(x, by, Math.PI / 2 + (R() - 0.5) * 0.2, h * 0.34, h > 20 ? 5 : 4);
  }

  drawCactus(b, x, by, h, c, R) {
    h = Math.max(5, Math.round(h * 0.75));
    const w = h > 14 ? 3 : 2, x0 = x - (w >> 1);
    const column = (X, Y0, Y1, cw) => {
      for (let y = Y0; y <= Y1; y++) for (let i = 0; i < cw; i++) {
        if (y === Y0 && cw === 3 && i !== 1) continue;
        this.put(b, X + i, y, i === 0 ? c.l : i === cw - 1 ? c.d : c.m);
      }
    };
    column(x0, by - h + 1, by, w);
    const arms = h > 8 ? 1 + (R() < 0.6 ? 1 : 0) : 0;
    let side = R() < 0.5 ? -1 : 1;
    for (let k = 0; k < arms; k++, side = -side) {
      const ay = by - Math.round(h * (0.3 + R() * 0.25)), alen = 2 + ((R() * 2) | 0);
      const aw = w > 2 ? 2 : 1, ah = Math.max(2, Math.round(h * (0.22 + R() * 0.15)));
      const startX = side < 0 ? x0 - 1 : x0 + w;
      for (let j = 0; j < alen; j++) for (let t = 0; t < aw; t++) this.put(b, startX + side * j, ay - t, t === 0 ? c.d : c.m);
      const endX = startX + side * (alen - 1) - (side < 0 ? 0 : aw - 1);
      column(endX, ay - ah, ay, aw);
    }
  }

  buildFar() {
    const { W, H, P, hz, cfg, S } = this, b = this.far, R = rng32(cfg.seed + 202);
    if (cfg.mountains) {
      const ranges = [{ amp: 0.34, freq: 0.011, depth: 0.55, oct: 5 }, { amp: 0.22, freq: 0.02, depth: 0.28, oct: 4 }];
      for (const rg of ranges) {
        const n = makeNoise(R), off = R() * 500, amp = rg.amp * H;
        const col = pack(mix(P.mountain, P.skyLow, rg.depth)), dk = pack(mix(P.mountainDark, P.skyLow, rg.depth));
        const snow = P.snow && pack(mix(P.snow, P.skyLow, rg.depth * 0.5));
        const snowDk = P.snow && pack(mix(mix(P.snow, P.mountainDark, 0.35), P.skyLow, rg.depth * 0.5));
        const mist = mix(P.mountain, P.skyLow, Math.min(1, rg.depth + 0.35));
        const plateau = amp * 0.62;
        const hs = new Float32Array(W + 2);
        for (let x = -1; x <= W; x++) {
          const v = clamp((n(this.u(x) * rg.freq + off, rg.oct) - 0.25) / 0.5, 0, 1);
          let ht = amp * (0.2 + 0.8 * Math.pow(v, 1.3));
          if (P.mesa) ht = Math.min(ht, plateau);
          hs[x + 1] = hz - ht;
        }
        for (let x = 0; x < W; x++) {
          const top = Math.round(hs[x + 1]), slope = (hs[x + 2] - hs[x]) * 0.5;
          const s = clamp(0.25 + slope * 0.7, 0, 1);
          const snowy = snow && (hz - top) > amp * P.snowLevel;
          const snowDepth = (cfg.season === 'winter' ? 4 + n(x * 0.3) * 10 : 2 + n(x * 0.3) * 6) * S;
          for (let y = Math.max(0, top); y < hz; y++) {
            const shadow = s > bayer(x, y);
            let c = shadow ? dk : col;
            if (snowy && y - top < snowDepth) c = shadow ? snowDk : snow;
            if (P.mesa && (y - Math.round(hz - plateau)) % 5 === 0 && y > top) c = dk;
            if (hz - y < 6 * S && bayer(x, y) < (1 - (hz - y) / (6 * S)) * 0.6) c = pack(mist);
            b[y * W + x] = c;
          }
        }
      }
    }
    // hills
    const hn = makeNoise(R), hoff = R() * 500;
    const baseY = hz - Math.round(H * 0.035), bottom = cfg.water ? hz : this.gy + 6;
    const hill = pack(P.hill), hillDk = pack(P.hillDark), hillLt = pack(mix(P.hill, P.grassLight, 0.5));
    const hh = new Float32Array(W + 2);
    for (let x = -1; x <= W; x++) hh[x + 1] = baseY - H * 0.1 * clamp((hn(this.u(x) * 0.035 + hoff, 3) - 0.3) / 0.4, 0, 1);
    for (let x = 0; x < W; x++) {
      const top = Math.round(hh[x + 1]), slope = (hh[x + 2] - hh[x]) * 0.5;
      for (let y = top; y < bottom; y++) {
        const depth = (y - top) / (bottom - top + 1);
        const s = clamp(slope * 0.9 + depth * 0.9 - 0.05, 0, 1);
        b[y * W + x] = y === top ? hillLt : s > bayer(x, y) ? hillDk : hill;
      }
    }
    // small trees on the hills
    if (cfg.trees !== 'none') {
      const count = Math.round(W * 0.22 * cfg.density), list = [];
      for (let i = 0; i < count; i++) {
        const x = (R() * W) | 0, top = Math.round(hh[x + 1]);
        const by = Math.min(bottom - 1, top + 1 + ((R() * Math.max(1, (bottom - top) * 0.4)) | 0));
        list.push([x, by, (3 + R() * 4) * S]);
      }
      list.sort((a, c) => a[1] - c[1]).forEach(([x, by, h]) => this.tree(b, cfg.trees, x, by, h, 0.3, R));
    }
  }

  buildNear() {
    const { W, H, P, cfg, S } = this, b = this.near, R = rng32(cfg.seed + 303);
    const n = makeNoise(R), off = R() * 500;
    const g = this.groundTop = new Int16Array(W);
    for (let x = 0; x < W; x++) g[x] = this.gy + Math.round((n(this.u(x) * 0.05 + off, 2) - 0.5) * 6 * S);
    const gr = pack(P.grass), dk = pack(P.grassDark), lt = pack(P.grassLight);
    const desert = cfg.season === 'desert';
    for (let x = 0; x < W; x++) {
      for (let y = g[x]; y < H; y++) {
        const depth = (y - g[x]) / (H - g[x]);
        let c = y === g[x] ? lt : depth * 1.1 > bayer(x, y) + 0.35 ? dk : gr;
        if (desert && Math.sin(y * 1.4 + n(x * 0.12) * 5) > 0.82 && bayer(x, y) < 0.6) c = dk;
        b[y * W + x] = c;
      }
      if (R() < 0.3 && !desert) this.put(b, x, g[x] - 1, lt);
    }
    // ground texture
    const tex = Math.round(W * (H - this.gy) * 0.04);
    const flowers = P.flowers.map(pack);
    for (let i = 0; i < tex; i++) {
      const x = (R() * W) | 0, y = g[x] + 1 + ((R() * (H - g[x])) | 0), r = R();
      if (flowers.length && r < 0.22) { this.put(b, x, y, flowers[(R() * flowers.length) | 0]); this.put(b, x, y + 1, dk); }
      else if (r < 0.6) { this.put(b, x, y, lt); if (!desert) this.put(b, x, y - 1, lt); }
      else this.put(b, x, y, dk);
    }
    // campfire site
    let fireX = -999;
    if (cfg.fx.campfire) {
      fireX = Math.round(W * (0.42 + R() * 0.16));
      const fy = g[fireX] + Math.round((H - g[fireX]) * 0.5);
      const trunk = pack(P.trunk), trunkDk = pack(mul(P.trunk, 0.6)), st = P.stone.map(pack);
      const lw = Math.round(4 * S);
      this.line(b, fireX - lw, fy, fireX + lw, fy - 1, trunk);
      this.line(b, fireX - lw, fy - 1, fireX + lw, fy, trunkDk);
      for (let dx = -lw - 2; dx <= lw + 2; dx++) if (Math.abs(dx) > lw - 1 || (dx & 1)) this.put(b, fireX + dx, fy + 1, st[(dx & 1)]);
      const fw = Math.round(9 * S) | 1, fh = Math.round(15 * S);
      this.fires.push({ kind: 'camp', x: fireX, y: fy - 1, w: fw, h: fh, decay: clamp(9 / (10 * S), 0.3, 1) });
    }
    // foreground trees
    if (cfg.trees !== 'none') {
      const count = Math.round((W / 16) * cfg.density * 1.6), list = [];
      for (let i = 0; i < count; i++) {
        const x = (R() * W) | 0;
        if (Math.abs(x - fireX) < 14 * S) continue;
        const span = H - g[x], by = g[x] + Math.round(R() * span * 0.35);
        const base = Math.min(H, W);
        const h = (base * 0.18 + R() * base * 0.2) *(1 + ((by - g[x]) / span) * 0.6);
        list.push([x, by, h]);
      }
      list.sort((a, c) => a[1] - c[1]).forEach(([x, by, h]) => this.tree(b, cfg.trees, x, by, h, 0, R));
    }
  }

  // ----- dynamic state -----
  makeCloud(R, w, h) {
    const P = this.P, d = new Uint32Array(w * h), cols = P.cloud.map(pack);
    const k = 3 + Math.floor(w / 8), blobs = [];
    for (let i = 0; i < k; i++) {
      const f = i / (k - 1), br = h * (0.35 + R() * 0.4) * (1 - Math.abs(f - 0.5) * 0.8);
      blobs.push([w * (0.12 + 0.76 * f) + (R() - 0.5) * 3, h - 1 - br * 0.55, br]);
    }
    const inside = (x, y) => y >= 0 && y < h && blobs.some(([bx, by, br]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 < br * br);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const t = y / h + (bayer(x, y) - 0.5) * 0.25;
      d[y * w + x] = !inside(x, y - 1) || t < 0.45 ? cols[0] : t < 0.78 ? cols[1] : cols[2];
    }
    return { w, h, d };
  }

  initDynamic() {
    const { W, H, S, P, cfg, hz } = this, fx = cfg.fx, I = cfg.intensity;
    const R = this.R = rng32(cfg.seed + 404);
    this.fogN = makeNoise(R); this.fogN2 = makeNoise(R); this.fireN = makeNoise(R);

    this.stars = [];
    if (fx.stars) {
      const count = Math.round(W * hz / 70), cp = this.celPos;
      for (let i = 0; i < count; i++) {
        const x = (R() * W) | 0, y = (R() * hz * 0.92) | 0;
        if (cp && Math.hypot(x - cp.cx, y - cp.cy) < cp.r * 2.8) continue;
        this.stars.push({ x, y, b: 0.4 + R() * 0.6, ph: R() * 6.28, sp: 1 + R() * 3, big: R() < 0.06 });
      }
    }

    this.clouds = [];
    const heavy = cfg.sky !== 'clear';
    if (fx.clouds) {
      const count = heavy ? Math.round(W / 9) : Math.max(2, Math.round(W / 50 + I * W / 70));
      for (let i = 0; i < count; i++) {
        const w = Math.round((heavy ? 26 + R() * 40 : 14 + R() * 22) * S), h = Math.round(w * (0.32 + R() * 0.12));
        const c = this.makeCloud(R, w, h);
        c.x = R() * (W + w) - w;
        c.y = heavy ? -h * 0.4 + R() * hz * 0.45 : R() * hz * 0.5;
        c.z = 0.35 + R() * 0.65;
        this.clouds.push(c);
      }
      this.clouds.sort((a, c) => a.z - c.z);
    }

    this.flocks = [];
    if (fx.birds) {
      const n = 1 + (R() < 0.5 ? 1 : 0);
      for (let i = 0; i < n; i++) this.flocks.push(this.newFlock(R, true));
    }

    const area = W * H;
    this.rain = []; this.snow = []; this.leaves = []; this.petals = []; this.fireflies = [];
    if (fx.rain) for (let i = 0, n = Math.round(area / 120 * (0.3 + I * 1.2)); i < n; i++) this.rain.push(this.spawnRain({}, true));
    if (fx.snow) for (let i = 0, n = Math.round(area / 170 * (0.3 + I * 1.4)); i < n; i++) this.snow.push(this.spawnFall({}, true, 'snow'));
    if (fx.leaves) for (let i = 0, n = Math.round(area / 900 * (0.4 + I * 1.6)); i < n; i++) this.leaves.push(this.spawnFall({}, true, 'leaf'));
    if (fx.petals) for (let i = 0, n = Math.round(area / 700 * (0.4 + I * 1.6)); i < n; i++) this.petals.push(this.spawnFall({}, true, 'petal'));
    if (fx.fireflies) for (let i = 0, n = Math.round((4 + I * 16) * W / 192); i < n; i++) {
      this.fireflies.push({ x: R() * W, y: hz + R() * (H - hz), a: R() * 6.28, sp: (3 + R() * 4) * S, ph: R() * 6.28, f: 1 + R() * 1.5 });
    }
    this.splashes = []; this.ripples = []; this.embers = []; this.puffs = [];

    this.fires = this.fires.filter(f => f.kind === 'camp');
    if (fx.wildfire) {
      const h = Math.round(H * 0.55);
      this.fires.push({ kind: 'wild', x: W >> 1, y: Math.round(this.gy + (H - this.gy) * 0.55), w: W, h, decay: clamp(9 / (H * 0.3), 0.05, 1) });
    }
    for (const f of this.fires) { f.heat = new Uint8Array(f.w * f.h); f.emberAcc = 0; f.smokeAcc = 0; }
    this.fireAcc = 0;
    this.bolt = null;
    this.boltTimer = 1 + R() * 2;
  }

  newFlock(R, init) {
    const { W, S, hz } = this, dir = this.cfg.wind < 0 ? -1 : 1, n = 3 + ((R() * 3) | 0);
    const members = [];
    for (let i = 0; i < n; i++) members.push({ dx: -i * 4 * S * dir + (R() - 0.5) * 2, dy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 2.5 * S + (R() - 0.5) * 2, ph: R() * 2 });
    return {
      x: init ? R() * W : dir > 0 ? -10 - R() * W * 0.15 : W + 10 + R() * W * 0.15,
      y: hz * (0.12 + R() * 0.3), vx: (7 + R() * 6) * S * dir, members,
    };
  }

  spawnRain(p, init) {
    const { W, H, S, R, hz } = this, z = 0.35 + R() * 0.65;
    p.y = init ? R() * H : -R() * 30;
    p.floor = hz + R() * (H - hz) * (0.3 + z * 0.7);
    // start upwind so slanted rain still covers the whole width
    p.z = z; p.x = R() * (W + 20) - 10 - this.cfg.wind * 0.3 * (p.floor - p.y);
    p.vy = (110 + z * 170) * S; p.len = Math.max(1, Math.round((2 + z * 4) * S));
    return p;
  }

  spawnFall(p, init, kind) {
    const { W, H, S, R, P, hz } = this, z = 0.35 + R() * 0.65;
    p.z = z; p.x = R() * W; p.y = init ? R() * H : -2 - R() * 10; p.ph = R() * 6.28;
    p.floor = hz + R() * (H - hz);
    if (kind === 'snow') { p.vy = (7 + z * 14) * S; p.big = z > 0.85; }
    else {
      const cols = kind === 'leaf' ? P.leaves : P.petals;
      p.vy = (kind === 'leaf' ? 10 + z * 12 : 7 + z * 9) * S;
      p.c = pack(cols[(R() * cols.length) | 0]);
      p.big = kind === 'leaf' ? z > 0.5 : z > 0.85;
    }
    return p;
  }

  step(dt) {
    const { W, H, S, cfg, R, hz } = this, wind = cfg.wind, fx = cfg.fx, I = cfg.intensity;
    const t = (this.t += dt);

    for (const c of this.clouds) {
      c.x += (2 + wind * 14) * c.z * S * dt;
      if (c.x > W + 2) c.x = -c.w - R() * 10;
      else if (c.x < -c.w - 12) c.x = W + R() * 5;
    }
    for (let i = 0; i < this.flocks.length; i++) {
      const f = this.flocks[i];
      f.x += f.vx * dt;
      if ((f.vx > 0 && f.x > W + 40 * S) || (f.vx < 0 && f.x < -40 * S)) this.flocks[i] = this.newFlock(R, false);
    }

    const g = this.groundTop;
    for (const p of this.rain) {
      p.y += p.vy * dt; p.x += wind * p.vy * 0.3 * dt;
      if (p.y >= p.floor) {
        const xi = clamp(Math.round(p.x), 0, W - 1);
        if (p.x >= 0 && p.x < W) {
          if (cfg.water && p.floor < g[xi]) this.ripples.push({ x: p.x, y: p.floor, life: 0.5, max: 0.5 });
          else this.splashes.push({ x: p.x, y: p.floor, life: 0.14 });
        }
        this.spawnRain(p, false);
      }
    }
    for (const s of this.splashes) s.life -= dt;
    for (const r of this.ripples) r.life -= dt;
    this.splashes = this.splashes.filter(s => s.life > 0);
    this.ripples = this.ripples.filter(r => r.life > 0);

    const fall = (arr, kind, sway, drift) => {
      for (const p of arr) {
        p.y += p.vy * dt;
        p.x += (wind * drift + Math.sin(t * sway + p.ph) * (kind === 'snow' ? 5 : 10)) * (kind === 'snow' ? p.z : 1) * S * dt;
        if (p.x < -3) p.x += W + 6; else if (p.x > W + 3) p.x -= W + 6;
        if (p.y > p.floor) this.spawnFall(p, false, kind);
      }
    };
    fall(this.snow, 'snow', 1.3, 14);
    fall(this.leaves, 'leaf', 2.2, 24);
    fall(this.petals, 'petal', 1.8, 18);

    for (const f of this.fireflies) {
      f.a += (R() - 0.5) * 5 * dt;
      f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * 0.6 * dt;
      if (f.y < hz - 6 * S) { f.y = hz - 6 * S; f.a = Math.PI / 2; }
      if (f.y > H - 2) { f.y = H - 2; f.a = -Math.PI / 2; }
      if (f.x < 0) f.x += W; else if (f.x >= W) f.x -= W;
    }

    // fires: cellular sim at a fixed rate, plus embers and smoke
    this.fireAcc += dt;
    while (this.fireAcc >= 1 / 24) { this.fireAcc -= 1 / 24; for (const f of this.fires) this.updateFire(f); }
    for (const f of this.fires) {
      const wild = f.kind === 'wild';
      if (fx.embers) {
        f.emberAcc += dt * (wild ? W * 0.25 : 6) * (0.5 + I);
        while (f.emberAcc >= 1) {
          f.emberAcc--;
          const life = 1 + R() * 2;
          this.embers.push({
            x: wild ? R() * W : f.x + (R() - 0.5) * f.w * 0.6, y: f.y - (wild ? f.h * (0.2 + R() * 0.3) : f.h * 0.5),
            vx: (R() - 0.5) * 6 * S, vy: -(10 + R() * 18) * S, life, max: life, id: (R() * 1e6) | 0,
          });
        }
      }
      if (fx.smoke) {
        f.smokeAcc += dt * (wild ? W * 0.05 : 2.5);
        while (f.smokeAcc >= 1) {
          f.smokeAcc--;
          const life = 2.5 + R() * 2.5;
          this.puffs.push({
            x: wild ? R() * W : f.x + (R() - 0.5) * 3, y: f.y - f.h * (wild ? 0.6 : 0.85),
            r: (wild ? 3 : 1.5) * S, vx: (R() - 0.5) * 3 * S, vy: -(5 + R() * 6) * S, life, max: life, wild,
          });
        }
      }
    }
    for (const e of this.embers) { e.x += (e.vx + wind * 14 * S) * dt; e.y += e.vy * dt; e.life -= dt; }
    this.embers = this.embers.filter(e => e.life > 0 && e.y > -2);
    for (const p of this.puffs) { p.x += (p.vx + wind * 10 * S) * dt; p.y += p.vy * dt; p.r += dt * 2.2 * S; p.life -= dt; }
    this.puffs = this.puffs.filter(p => p.life > 0);

    if (fx.lightning) {
      this.boltTimer -= dt;
      if (this.boltTimer <= 0) { this.strike(); this.boltTimer = 1.5 + R() * (7 - 5 * I); }
    }
    if (this.bolt && (this.bolt.age += dt) > 0.5) this.bolt = null;
  }

  updateFire(f) {
    const { w, h, heat } = f, R = this.R, wind = this.cfg.wind, bottom = (h - 1) * w;
    for (let x = 0; x < w; x++) {
      let v;
      if (f.kind === 'camp') {
        const dx = Math.abs(x - (w - 1) / 2) / (w / 2);
        v = Math.round(9 * Math.max(0, 1 - dx * dx) * (0.75 + R() * 0.25));
      } else {
        const n = this.fireN(this.u(x) * 0.07 + this.t * 0.6, 2);
        v = (n > 0.45 ? 9 : n > 0.33 ? 7 : 4) - (R() < 0.2 ? 1 : 0);
      }
      heat[bottom + x] = v;
    }
    for (let y = 1; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = heat[y * w + x];
        if (!v) { heat[(y - 1) * w + x] = 0; continue; }
        let shift = ((R() * 3) | 0) - 1;
        if (wind && R() < Math.abs(wind) * 0.6) shift += wind > 0 ? 1 : -1;
        heat[(y - 1) * w + clamp(x + shift, 0, w - 1)] = Math.max(0, v - (R() < f.decay ? 1 : 0));
      }
    }
  }

  strike() {
    const { W, H, S, R, hz } = this;
    const walk = (x, y, endY, spread) => {
      const pts = [[x, y]];
      while (y < endY) { y += 1 + ((R() * 3) | 0); x += (R() - 0.5) * spread * S; pts.push([x, y]); }
      return pts;
    };
    const main = walk(W * (0.1 + R() * 0.8), 0, hz + R() * (H - hz) * 0.5, 5);
    const segs = [main];
    for (const [x, y] of main) if (R() < 0.12) segs.push(walk(x, y, y + (6 + R() * 14) * S, 6));
    this.bolt = { segs, age: 0 };
  }

  // ----- drawing -----
  draw() {
    const { cfg } = this, f = this.frame, fx = cfg.fx;
    f.set(this.sky);
    this.drawStars();
    this.drawClouds();
    over(f, this.far);
    this.drawBirds();
    if (cfg.water) this.drawWater();
    over(f, this.near);
    if (fx.heat) this.heatHaze();
    this.drawGlow();
    this.drawFires();
    this.drawSmoke();
    this.drawEmbers();
    this.drawFireflies();
    this.drawFalling();
    this.drawRain();
    if (fx.fog) this.drawFog();
    // the character is always the top layer (it lights itself from nearby fires);
    // only the lightning flash goes over it
    if (this.actor) this.actor(this);
    this.drawLightning();
    return this.image;
  }

  drawStars() {
    const { W, t } = this, f = this.frame, sc = [255, 250, 235];
    for (const s of this.stars) {
      const b = s.b * (0.6 + 0.4 * Math.sin(t * s.sp + s.ph));
      if (b < 0.35) continue;
      const i = s.y * W + s.x;
      f[i] = pack(mix(unpack(f[i]), sc, b));
      if (s.big && b > 0.75) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = s.x + dx, y = s.y + dy;
        if (x >= 0 && x < W && y >= 0) f[y * W + x] = pack(mix(unpack(f[y * W + x]), sc, 0.4));
      }
    }
  }

  drawClouds() {
    const { W, H } = this, f = this.frame;
    for (const c of this.clouds) {
      const ox = Math.round(c.x), oy = Math.round(c.y);
      for (let y = 0; y < c.h; y++) {
        const Y = oy + y;
        if (Y < 0 || Y >= H) continue;
        for (let x = 0; x < c.w; x++) {
          const v = c.d[y * c.w + x], X = ox + x;
          if (v && X >= 0 && X < W) f[Y * W + X] = v;
        }
      }
    }
  }

  drawBirds() {
    const f = this.frame, c = pack(this.P.bird);
    for (const fl of this.flocks) for (const m of fl.members) {
      const x = Math.round(fl.x + m.dx), y = Math.round(fl.y + m.dy), up = ((this.t * 7 + m.ph * 3) | 0) & 1;
      this.put(f, x, y, c);
      if (up) { this.put(f, x - 1, y - 1, c); this.put(f, x + 1, y - 1, c); this.put(f, x - 2, y - 1, c); this.put(f, x + 2, y - 1, c); }
      else { this.put(f, x - 1, y, c); this.put(f, x + 1, y, c); this.put(f, x - 2, y + 1, c); this.put(f, x + 2, y + 1, c); }
    }
  }

  drawWater() {
    const { W, H, hz, t, P, S } = this, f = this.frame, g = this.groundTop;
    let maxG = 0;
    for (let x = 0; x < W; x++) if (g[x] > maxG) maxG = g[x];
    const span = Math.max(1, maxG - hz);
    for (let y = hz; y < Math.min(H, maxG); y++) {
      const d = y - hz, src = Math.max(0, hz - 1 - d);
      const amp = (0.4 + d * 0.07) * (0.7 + this.cfg.intensity * 0.6);
      const wave = Math.round(Math.sin(d * 0.8 - t * 2.4) * amp + Math.sin(d * 2.3 + t * 1.7) * 0.5);
      const k = 0.28 + (d / span) * 0.3;
      for (let x = 0; x < W; x++) {
        if (y >= g[x]) continue;
        let c = mix(mul(unpack(f[src * W + clamp(x + wave, 0, W - 1)]), 0.9), P.water, k);
        if (Math.sin(this.u(x) * 0.31 + d * 1.7 - t * 1.9) * Math.sin(this.u(x) * 0.07 + t * 0.8 + d * 0.5) > 0.82) c = mix(c, WHITE, 0.25 * P.bright);
        f[y * W + x] = pack(c);
      }
    }
    const rc = pack(mix(P.water, WHITE, 0.2 + 0.25 * P.bright));
    for (const r of this.ripples) {
      const rad = (1 - r.life / r.max) * 4 * S + 1;
      for (let a = 0; a < 6.28; a += 0.5) {
        const px = Math.round(r.x + Math.cos(a) * rad), py = Math.round(r.y + Math.sin(a) * rad * 0.3);
        if (px >= 0 && px < W && py >= hz && py < g[px]) f[py * W + px] = rc;
      }
    }
  }

  heatHaze() {
    const { W, H, hz, t, cfg } = this, f = this.frame, row = new Uint32Array(W);
    for (let y = Math.max(0, Math.round(hz - H * 0.3)); y < H; y++) {
      const off = Math.round(Math.sin(y * 0.55 + t * 7) * Math.sin(y * 0.13 - t * 2) * 1.4 * (0.5 + cfg.intensity));
      if (!off) continue;
      row.set(f.subarray(y * W, y * W + W));
      for (let x = 0; x < W; x++) f[y * W + x] = row[clamp(x - off, 0, W - 1)];
    }
  }

  drawGlow() {
    if (!this.fires.length) return;
    const { W, H, S, P, t } = this, f = this.frame;
    const flick = 0.85 + 0.15 * Math.sin(t * 13) * Math.sin(t * 7.3);
    const strength = 0.15 + (1 - P.bright) * 0.8;
    const add = (i, q) => {
      const c = unpack(f[i]);
      f[i] = pack([c[0] + 230 * q, c[1] + 110 * q, c[2] + 25 * q]);
    };
    for (const fr of this.fires) {
      if (fr.kind === 'wild') {
        for (let y = 0; y < H; y++) {
          const k = Math.pow(clamp((y - H * 0.15) / (H * 0.85), 0, 1), 1.5) * (0.12 + (1 - P.bright) * 0.4) * flick;
          for (let x = 0; x < W; x++) { const q = Math.floor(k * 4 + bayer(x, y)) / 4; if (q > 0) add(y * W + x, q * 0.6); }
        }
      } else {
        const gr = 28 * S * flick, cy = fr.y - 3;
        for (let y = Math.max(0, Math.floor(cy - gr)); y < Math.min(H, cy + gr * 0.7); y++) {
          for (let x = Math.max(0, Math.floor(fr.x - gr)); x < Math.min(W, fr.x + gr); x++) {
            const d = Math.hypot(x - fr.x, (y - cy) * 1.2) / gr;
            if (d >= 1) continue;
            const q = Math.floor((1 - d) * (1 - d) * strength * 5 + bayer(x, y)) / 5;
            if (q > 0) add(y * W + x, q * 0.7);
          }
        }
      }
    }
  }

  drawFires() {
    const { W, H } = this, f = this.frame;
    for (const fr of this.fires) {
      const sx = fr.kind === 'wild' ? 0 : fr.x - (fr.w >> 1), sy = fr.y - fr.h + 1;
      for (let y = 0; y < fr.h; y++) {
        const Y = sy + y;
        if (Y < 0 || Y >= H) continue;
        for (let x = 0; x < fr.w; x++) {
          const v = fr.heat[y * fr.w + x], X = sx + x;
          if (!v || X < 0 || X >= W) continue;
          if (v === 1 && bayer(X, Y) > 0.5) continue;
          f[Y * W + X] = FIRE[v];
        }
      }
    }
  }

  drawSmoke() {
    const { W, H, P } = this, f = this.frame;
    for (const p of this.puffs) {
      const a = (p.life / p.max) * (p.wild ? 0.65 : 0.5), r = p.r, col = p.wild ? mul(P.smoke, 0.6) : P.smoke;
      for (let y = Math.floor(p.y - r); y <= p.y + r; y++) {
        if (y < 0 || y >= H) continue;
        for (let x = Math.floor(p.x - r); x <= p.x + r; x++) {
          if (x < 0 || x >= W) continue;
          const d = Math.hypot(x - p.x, y - p.y) / r;
          if (d < 1 && bayer(x, y) < a * (1 - d * 0.6)) f[y * W + x] = pack(mix(unpack(f[y * W + x]), col, 0.6));
        }
      }
    }
  }

  drawEmbers() {
    const f = this.frame, cols = ['#fff2a0', '#ff9a30', '#d0401a'].map(c => pack(hex(c)));
    const tick = (this.t * 20) | 0;
    for (const e of this.embers) {
      if (hash2(e.id, tick, 3) < 0.15) continue;
      const lr = e.life / e.max;
      this.put(f, e.x, e.y, cols[lr > 0.6 ? 0 : lr > 0.3 ? 1 : 2]);
    }
  }

  drawFireflies() {
    const f = this.frame, core = pack(hex('#f8ff9a')), glow = hex('#b8e84a'), { W, H } = this;
    for (const ff of this.fireflies) {
      const b = Math.sin(this.t * ff.f * 2 + ff.ph);
      if (b < 0) continue;
      const x = Math.round(ff.x), y = Math.round(ff.y);
      this.put(f, x, y, core);
      if (b > 0.5) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx, Y = y + dy;
        if (X >= 0 && X < W && Y >= 0 && Y < H) f[Y * W + X] = pack(mix(unpack(f[Y * W + X]), glow, 0.45));
      }
    }
  }

  drawFalling() {
    const f = this.frame, P = this.P, near = pack(P.snowFlake), far = pack(P.snowFar);
    for (const p of this.snow) {
      const c = p.z > 0.6 ? near : far;
      this.put(f, p.x, p.y, c);
      if (p.big) { this.put(f, p.x + 1, p.y, c); this.put(f, p.x, p.y + 1, c); this.put(f, p.x + 1, p.y + 1, c); }
    }
    for (const arr of [this.leaves, this.petals]) for (const p of arr) {
      const flip = ((this.t * 6 + p.ph * 3) | 0) & 1;
      this.put(f, p.x, p.y, p.c);
      if (p.big) this.put(f, p.x + (flip ? 1 : 0), p.y + (flip ? 0 : 1), p.c);
    }
  }

  drawRain() {
    const f = this.frame, P = this.P, near = pack(P.rain), far = pack(P.rainFar), slant = this.cfg.wind * 0.3;
    for (const p of this.rain) {
      const c = p.z > 0.7 ? near : far;
      for (let i = 0; i < p.len; i++) this.put(f, p.x - i * slant, p.y - i, c);
    }
    for (const s of this.splashes) {
      if (s.life > 0.07) this.put(f, s.x, s.y - 1, near);
      else { this.put(f, s.x - 1, s.y - 1, near); this.put(f, s.x + 1, s.y - 1, near); }
    }
  }

  drawFog() {
    const { W, H, hz, t, P, cfg } = this, f = this.frame;
    const amt = 0.35 + cfg.intensity * 0.5, mid = hz + H * 0.06;
    for (let y = Math.round(hz - H * 0.14); y < H; y++) {
      const band = 1 - Math.abs(y - mid) / (H * 0.35);
      if (band <= 0) continue;
      const n2 = this.fogN2(y * 0.18 - t * 0.1, 2);
      for (let x = 0; x < W; x++) {
        const n = this.fogN(this.u(x) * 0.045 + t * (0.08 + cfg.wind * 0.25) + y * 0.21, 3);
        if (band * n * n2 * amt * 3 > bayer(x, y)) f[y * W + x] = pack(mix(unpack(f[y * W + x]), P.fog, 0.55));
      }
    }
  }

  drawLightning() {
    if (!this.bolt) return;
    const a = this.bolt.age, f = this.frame;
    const flash = a < 0.06 ? 1 : a < 0.12 ? 0.2 : a < 0.2 ? 0.8 : Math.max(0, 0.8 - (a - 0.2) * 3.2);
    if (flash <= 0) return;
    const fc = [225, 232, 255], k = flash * 0.45;
    for (let i = 0; i < f.length; i++) f[i] = pack(mix(unpack(f[i]), fc, k));
    if (flash > 0.15) {
      const white = pack(WHITE), glow = pack([170, 190, 255]);
      for (const seg of this.bolt.segs) for (let i = 1; i < seg.length; i++) {
        const [x0, y0] = seg[i - 1], [x1, y1] = seg[i];
        this.line(f, x0 + 1, y0, x1 + 1, y1, glow);
        this.line(f, x0, y0, x1, y1, white);
      }
    }
  }
}

function over(dst, src) {
  for (let i = 0; i < src.length; i++) { const v = src[i]; if (v) dst[i] = v; }
}

global.PixelEngine = { Scene, SEASONS, TIMES };
})(window);
