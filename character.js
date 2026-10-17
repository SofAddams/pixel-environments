'use strict';
// Customizable pixel character: builds a small front-facing sprite from options
// and draws it into a scene (lit by the scene's time of day).
(function (global) {

const hex = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const c8 = v => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const pack = c => ((255 << 24) | (c8(c[2]) << 16) | (c8(c[1]) << 8) | c8(c[0])) >>> 0;
const unpack = p => [p & 255, (p >>> 8) & 255, (p >>> 16) & 255];
const WHITE = [255, 255, 255];
const tone = h => {
  const c = hex(h);
  return { c, b: pack(c), l: pack(mix(c, WHITE, 0.28)), d: pack(mul(c, 0.72)), dd: pack(mul(c, 0.5)) };
};
const hash = (x, y) => { let h = Math.imul(x, 374761393) + Math.imul(y, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const OPTIONS = {
  body: [['feminine', 'Feminine'], ['neutral', 'Neutral'], ['masculine', 'Masculine']],
  frame: [['slim', 'Slim'], ['average', 'Average'], ['broad', 'Broad']],
  height: [['short', 'Short'], ['average', 'Average'], ['tall', 'Tall']],
  hair: [['bald', 'Bald'], ['buzz', 'Buzz cut'], ['short', 'Short'], ['spiky', 'Spiky'], ['sidepart', 'Side part'],
    ['pixie', 'Pixie'], ['mohawk', 'Mohawk'], ['bob', 'Bob'], ['long', 'Long'], ['ponytail', 'Ponytail'],
    ['bun', 'Bun'], ['curly', 'Curly'], ['afro', 'Afro'], ['braids', 'Braids'], ['locs', 'Locs']],
  facial: [['none', 'None'], ['stubble', 'Stubble'], ['mustache', 'Mustache'], ['goatee', 'Goatee'], ['beard', 'Beard']],
  glasses: [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['sunglasses', 'Sunglasses']],
  face: [['none', 'None'], ['blush', 'Blush'], ['freckles', 'Freckles']],
  top: [['tshirt', 'T-shirt'], ['longsleeve', 'Long sleeve'], ['hoodie', 'Hoodie'], ['sweater', 'Sweater'],
    ['jacket', 'Jacket'], ['tank', 'Tank top'], ['dress', 'Dress']],
  bottom: [['pants', 'Pants'], ['shorts', 'Shorts'], ['skirt', 'Skirt']],
  shoes: [['sneakers', 'Sneakers'], ['boots', 'Boots'], ['sandals', 'Sandals']],
  headwear: [['none', 'None'], ['cap', 'Cap'], ['beanie', 'Beanie'], ['sunhat', 'Sun hat'], ['headband', 'Headband'],
    ['hijab', 'Hijab'], ['turban', 'Turban'], ['headphones', 'Headphones'], ['flower', 'Flower']],
  mobility: [['none', 'None'], ['wheelchair', 'Wheelchair'], ['cane', 'Cane']],
  pose: [['idle', 'Stand'], ['wave', 'Wave'], ['walk', 'Walk'], ['cheer', 'Cheer'], ['jump', 'Jump'], ['dance', 'Dance'],
    ['sit', 'Sit'], ['log', 'Sit on log'], ['warm', 'Warm hands'], ['roast', 'Marshmallow'], ['guitar', 'Guitar'],
    ['read', 'Read'], ['sleep', 'Sleep']],
};

const PALETTES = {
  skin: ['#ffe3cc', '#f6cfae', '#eebb8f', '#e0a877', '#c98a55', '#ad6f40', '#8e5530', '#6e3f22', '#523018', '#3b2213'],
  hair: ['#17120f', '#3a2517', '#61402a', '#8e5a32', '#b8602a', '#d9a350', '#efdca2', '#8f8f96', '#eeeeee',
    '#ff7ab8', '#5a8cff', '#3fbf8a', '#9b6bff'],
  eyes: ['#3a2517', '#6b4428', '#3a78b8', '#4b8a48', '#7f8794', '#9a6a2e', '#17120f'],
  cloth: ['#f0f0f2', '#2b2d36', '#d6463a', '#f2a33a', '#f2d64a', '#4caf50', '#2f7fd1', '#5a3fa8',
    '#e57fb0', '#7a5232', '#3d5a80', '#8fb8a8', '#c8b49a'],
};

const DEFAULT = {
  show: true, pose: 'idle', x: 0.32, depth: 0.45,
  body: 'neutral', frame: 'average', height: 'average', skin: '#e0a877',
  hair: 'short', hairColor: '#3a2517', eyes: '#3a2517', facial: 'none', glasses: 'none', face: 'none',
  top: 'hoodie', topColor: '#d6463a', accent: '#f0f0f2', bottom: 'pants', bottomColor: '#3d5a80',
  shoes: 'sneakers', shoeColor: '#f0f0f2', headwear: 'none', headwearColor: '#f2a33a', mobility: 'none',
};

// Sprite canvas; x coordinates below are written for a 26-wide body and shifted by OX
// so props (guitar neck, roasting stick) have room on both sides.
const W = 34, H = 44, OX = 4;

function sprite(ch, t, opts = {}) {
  const d = new Uint32Array(W * H);
  const set = (x, y, c) => { x += OX; if (x >= 0 && y >= 0 && x < W && y < H) d[y * W + x] = c; };
  const get = (x, y) => { x += OX; return x >= 0 && y >= 0 && x < W && y < H ? d[y * W + x] : 0; };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) set(Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n), c);
  };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };

  const skin = tone(ch.skin), hair = tone(ch.hairColor), top = tone(ch.topColor), acc = tone(ch.accent);
  const bot = tone(ch.bottomColor), shoe = tone(ch.shoeColor), hw = tone(ch.headwearColor), eye = tone(ch.eyes);
  const metal = tone('#6a6e7a'), tire = tone('#2a2a32'), dark = pack([26, 20, 32]);
  const wood = tone('#8a5a32'), woodLt = tone('#c08850');
  const pose = ch.pose, chair = ch.mobility === 'wheelchair', dir = opts.dir || 1;
  const onLog = !chair && ['log', 'warm', 'roast', 'guitar'].includes(pose);
  const onGround = !chair && ['sit', 'read'].includes(pose);
  const sleeping = pose === 'sleep', lying = sleeping && !chair;
  const seated = chair || onLog || onGround || lying;
  const walking = pose === 'walk', waving = pose === 'wave', dancing = pose === 'dance' && !lying;
  const dress = ch.top === 'dress';

  const wf = Math.floor(t * 6) % 4, df = Math.floor(t * 4) % 4;
  // jump: airborne for part of each cycle, crouch just after landing
  const jp = (t * 1.4) % 1;
  const hop = pose === 'jump' && !chair && jp < 0.45 ? Math.round(Math.sin(jp / 0.45 * Math.PI) * 6) : 0;
  const crouch = pose === 'jump' && !chair && jp >= 0.45 && jp < 0.6;
  const cheering = pose === 'cheer' || (pose === 'jump' && (hop > 0 || chair));
  const ub = walking && !chair ? (wf % 2 ? -1 : 0) : dancing ? (df % 2 ? 1 : 0) : crouch ? 1
    : hop || lying ? 0 : (Math.floor(t * 1.5) % 2 ? 1 : 0);
  const legLen = chair || onLog ? 4 : onGround ? 2 : ({ short: 5, average: 7, tall: 9 })[ch.height] || 7;
  const torsoN = ch.height === 'short' ? 7 : 8;
  const feetY = H - 4, legTop = feetY - 1 - legLen, torsoTop = legTop - torsoN + ub;
  const neckY = torsoTop - 1, hy0 = neckY - 9, hy1 = hy0 + 8, hx0 = 9, hx1 = 16, ey = hy0 + 4;

  const PROF = { masculine: [10, 10, 10, 10, 8, 8, 8, 8], neutral: [8, 8, 8, 8, 8, 8, 8, 8], feminine: [8, 8, 8, 6, 6, 8, 8, 10] };
  const fAdj = ch.frame === 'slim' ? -2 : ch.frame === 'broad' ? 2 : 0;
  const rowsT = legTop - torsoTop;
  const widthAt = i => Math.max(6, (PROF[ch.body] || PROF.neutral)[Math.min(7, Math.round(i * 7 / Math.max(1, rowsT - 1)))] + fAdj);
  const span = w => [13 - w / 2, 12 + w / 2];
  const [sx0, sx1] = span(widthAt(0));
  const lw = ch.frame === 'slim' ? 2 : ch.frame === 'broad' ? 4 : 3;
  const lx0 = 12 - lw, rx1 = 13 + lw;
  const sleeve = { tshirt: 3, dress: 2, tank: 0 }[ch.top] ?? 99;
  const covered = ['cap', 'beanie', 'sunhat', 'turban'].includes(ch.headwear);
  const hijab = ch.headwear === 'hijab';

  // --- wheelchair back ---
  if (chair) {
    rect(sx0 - 1, torsoTop + 1, sx1 + 1, legTop + 1, metal.d);
    for (const x of [sx0 - 1, sx1 + 1]) { set(x, torsoTop - 1, metal.b); set(x, torsoTop, metal.b); }
  }

  if (onLog) {
    const y0 = legTop + 1;
    rect(4, y0, 21, y0 + 2, wood.b); rect(4, y0 + 2, 21, y0 + 2, wood.d);
    for (let x = 6; x < 20; x += 5) set(x, y0 + 1, wood.d);
    rect(3, y0, 3, y0 + 2, woodLt.b); rect(22, y0, 22, y0 + 2, woodLt.b);
  }

  // --- hair (back layer) ---
  const hp = (x, y, sh, front) => {
    if (front && covered && y < hy0 + 2) return;
    set(x, y, sh === 'l' ? hair.l : sh === 'd' ? hair.d : hair.b);
  };
  const blob = (cx, cy, rx, ry, front) => {
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 > 1) continue;
      if (front && y > hy0 + 1 && x >= hx0 && x <= hx1) continue;
      const h = hash(x, y);
      hp(x, y, h < 0.2 ? 'l' : h > 0.78 || x > cx + rx - 2 ? 'd' : 'b', front);
    }
  };
  if (!hijab) {
    const s = ch.hair;
    if (s === 'long') {
      for (let y = hy0 + 2; y <= torsoTop + 5; y++) for (let x = hx0 - 1; x <= hx1 + 1; x++) {
        if (y === torsoTop + 5 && (x & 1)) continue;
        hp(x, y, x >= hx1 ? 'd' : 'b');
      }
    } else if (s === 'ponytail') {
      set(hx1 + 1, hy0 + 1, acc.b);
      for (let y = hy0 + 2; y <= hy0 + 10; y++) { hp(hx1 + 1, y, 'b'); if (y < hy0 + 8) hp(hx1 + 2, y, 'd'); }
    } else if (s === 'afro') blob(12.5 + 0.5, hy0 + 3.5, 7, 6.5, false);
    else if (s === 'curly') blob(13, hy0 + 2.5, 5.8, 5, false);
    else if (s === 'braids') {
      for (const x of [hx0 - 1, hx1 + 1]) {
        for (let y = hy0 + 2; y <= torsoTop + 5; y++) hp(x, y, (y & 1) ? 'l' : 'd');
        set(x, torsoTop + 6, acc.b);
      }
    } else if (s === 'locs') {
      [[hx0 - 2, 4], [hx0 - 1, 6], [hx1 + 1, 5], [hx1 + 2, 3]].forEach(([x, len]) => {
        for (let y = hy0 + 2; y <= torsoTop + len; y++) hp(x, y, (y + x) % 3 ? 'b' : 'd');
      });
    }
  } else {
    // hijab drape behind the head and over the shoulders
    for (let y = hy0; y <= torsoTop + 2; y++) for (let x = hx0 - 2; x <= hx1 + 2; x++) {
      if ((y === hy0) && (x < hx0 || x > hx1)) continue;
      set(x, y, x <= hx0 - 1 ? hw.l : x >= hx1 + 1 ? hw.d : hw.b);
    }
  }

  // --- legs, bottoms, shoes ---
  const lifts = walking && !chair ? [wf === 1 ? 1 : 0, wf === 3 ? 1 : 0]
    : dancing && !chair ? [df === 1 ? 1 : 0, df === 3 ? 1 : 0] : [0, 0];
  const legs = onGround ? [] : [[lx0, 11], [14, rx1]];
  if (onGround) {
    // cross-legged: knees out to the sides, feet tucked in the middle
    const lap = dress ? top : ch.bottom === 'shorts' ? skin : bot;
    const thigh = dress || ch.bottom !== 'shorts' ? lap : bot;
    rect(lx0 - 1, legTop, rx1 + 1, legTop, dress || ch.bottom === 'skirt' ? lap.b : thigh.b);
    for (let y = legTop + 1; y <= feetY - 1; y++) for (let x = lx0 - 3; x <= rx1 + 3; x++)
      set(x, y, x === lx0 - 3 ? lap.l : x === rx1 + 3 ? lap.d : lap.b);
    rect(lx0 - 2, feetY, rx1 + 2, feetY, lap.d);
    rect(11, feetY - 1, 14, feetY - 1, shoe.b); set(11, feetY - 1, shoe.l);
    if (ch.bottom === 'skirt' && !dress) rect(lx0 - 2, legTop, rx1 + 2, legTop + 1, bot.b);
  }
  legs.forEach(([a, b], li) => {
    for (let y = legTop; y <= feetY - 2 - lifts[li]; y++) for (let x = a; x <= b; x++) set(x, y, x === rx1 ? skin.d : skin.b);
  });
  const pantsRows = ch.bottom === 'pants' ? 99 : ch.bottom === 'shorts' ? 3 : 0;
  if (!dress && pantsRows && !onGround) {
    rect(lx0, legTop, rx1, legTop + 1, bot.b);
    legs.forEach(([a, b], li) => {
      for (let y = legTop; y <= Math.min(feetY - 2 - lifts[li], legTop + pantsRows - 1); y++)
        for (let x = a; x <= b; x++) set(x, y, x === 11 || x === rx1 ? bot.d : x === a && li === 0 ? bot.l : bot.b);
    });
  }
  if ((dress || ch.bottom === 'skirt') && !onGround) {
    const t2 = dress ? top : bot, len = dress ? Math.max(3, legLen - 2) : Math.min(4, Math.max(3, legLen - 2));
    for (let r = 0; r < len; r++) {
      const grow = 1 + (r >> 1);
      for (let x = lx0 - grow; x <= rx1 + grow; x++)
        set(x, legTop + r, r === len - 1 ? t2.d : x === lx0 - grow ? t2.l : x >= rx1 + grow - 1 ? t2.d : t2.b);
    }
  }
  legs.forEach(([a, b], li) => {
    const y1 = feetY - lifts[li], x0 = li === 0 ? a - 1 : a, x1 = li === 0 ? b : b + 1;
    const sole = pack(mix(shoe.c, WHITE, 0.55));
    if (ch.shoes === 'boots') { rect(x0, y1 - 2, x1, y1 - 1, shoe.b); rect(x0, y1, x1, y1, shoe.d); }
    else if (ch.shoes === 'sandals') { rect(x0, y1 - 1, x1, y1 - 1, skin.b); rect(x0, y1, x1, y1, shoe.b); }
    else { rect(x0, y1 - 1, x1, y1 - 1, shoe.b); set(x0, y1 - 1, shoe.l); rect(x0, y1, x1, y1, sole); }
  });

  // --- torso & top ---
  if (ch.top === 'hoodie') { rect(10, neckY, 15, neckY, top.d); set(10, neckY - 1, top.d); set(15, neckY - 1, top.d); }
  for (let y = torsoTop; y < legTop; y++) {
    const [a, b] = span(widthAt(y - torsoTop));
    for (let x = a; x <= b; x++) set(x, y, x === b ? top.d : x === a ? top.l : top.b);
  }
  const lastT = legTop - 1;
  switch (ch.top) {
    case 'tshirt': case 'longsleeve': case 'dress':
      set(12, torsoTop, skin.d); set(13, torsoTop, skin.d);
      if (dress) { const [a, b] = span(widthAt(4)); rect(a, torsoTop + 4, b, torsoTop + 4, acc.b); }
      break;
    case 'tank': {
      const [a, b] = span(widthAt(0));
      for (let x = a; x <= b; x++) if (x !== a + 1 && x !== b - 1) set(x, torsoTop, skin.b);
      rect(11, torsoTop + 1, 14, torsoTop + 1, skin.b);
      break;
    }
    case 'hoodie':
      set(11, torsoTop + 1, acc.b); set(11, torsoTop + 2, acc.b); set(14, torsoTop + 1, acc.b); set(14, torsoTop + 2, acc.b);
      if (torsoTop + 6 < legTop) rect(10, torsoTop + 5, 15, torsoTop + 6, top.d);
      break;
    case 'sweater': {
      rect(11, torsoTop, 14, torsoTop, acc.b);
      const [a, b] = span(widthAt(rowsT - 1));
      for (let x = a; x <= b; x++) set(x, lastT, (x & 1) ? top.d : top.dd);
      break;
    }
    case 'jacket':
      rect(11, torsoTop, 14, torsoTop + 1, acc.b);
      rect(12, torsoTop + 2, 13, lastT, acc.b);
      set(11, torsoTop + 2, top.d); set(14, torsoTop + 2, top.d);
      break;
  }

  // --- arms ---
  const arm = (side, len) => {
    const xs = side < 0 ? [sx0 - 2, sx0 - 1] : [sx1 + 1, sx1 + 2], outer = side < 0 ? xs[0] : xs[1];
    for (let r = 0; r < len; r++) for (const x of xs) {
      if (r === 0 && x === outer) continue;
      const tt = r < sleeve && r < len - 2 ? top : skin;
      set(x, torsoTop + r, x === outer ? (side < 0 ? tt.l : tt.d) : tt.b);
    }
  };
  const raisedArm = (side, wiggle) => {
    const xs = side > 0 ? [sx1 + 1, sx1 + 2] : [sx0 - 2, sx0 - 1], wig = wiggle ? (Math.floor(t * 5) % 2) * side : 0;
    for (let r = 0; r < 7; r++) for (const x of xs) {
      const hand = r >= 5, tt = !hand && r < Math.min(sleeve, 5) ? top : skin;
      set(x + (hand ? wig : 0), torsoTop - r, x === (side > 0 ? xs[1] : xs[0]) ? (side > 0 ? tt.d : tt.l) : tt.b);
    }
  };
  // upper arm hanging, forearm bent inwards to (hx, hy)
  const bentArm = (side, hx, hy) => {
    const xs = side < 0 ? [sx0 - 2, sx0 - 1] : [sx1 + 1, sx1 + 2], outer = side < 0 ? xs[0] : xs[1];
    for (let r = 0; r < 4; r++) for (const x of xs) if (r || x !== outer) set(x, torsoTop + r, r < sleeve ? (x === outer ? top.d : top.b) : skin.b);
    const sx = side < 0 ? xs[1] : xs[0], fore = sleeve > 4 ? top.b : skin.b;
    line(sx, torsoTop + 4, hx - side, hy, fore); line(sx, torsoTop + 3, hx - side, hy - 1, fore);
    set(hx, hy, skin.b); set(hx, hy - 1, skin.b);
  };
  const strum = Math.floor(t * 8) % 2, rub = Math.floor(t * 3) % 2;
  if (cheering) { raisedArm(-1, true); raisedArm(1, true); }
  else if (dancing) { if (df < 2) { raisedArm(1, false); arm(-1, torsoN); } else { raisedArm(-1, false); arm(1, torsoN); } }
  else if (pose === 'warm') { bentArm(-1, 12, torsoTop + 5 + rub); bentArm(1, 13, torsoTop + 6 - rub); }
  else if (pose === 'read') { bentArm(-1, 9, torsoTop + 6); bentArm(1, 16, torsoTop + 6); }
  else if (pose === 'guitar') { bentArm(-1, 6, torsoTop + 3); bentArm(1, 14, legTop - 1 + strum); }
  else if (pose === 'roast') { if (dir > 0) { arm(-1, torsoN); bentArm(1, sx1 + 3, torsoTop + 5); } else { arm(1, torsoN); bentArm(-1, sx0 - 4, torsoTop + 5); } }
  else {
    arm(-1, torsoN - (walking && !chair && wf === 1 ? 1 : 0));
    if (waving) raisedArm(1, true); else arm(1, torsoN - (walking && !chair && wf === 3 ? 1 : 0));
  }

  // --- head & face ---
  set(12, neckY, skin.d); set(13, neckY, skin.d);
  const fem = ch.body === 'feminine';
  for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
    const edge = x === hx0 || x === hx1, near = x === hx0 + 1 || x === hx1 - 1;
    if ((y === hy0 || y === hy1) && edge) continue;
    if (fem && y === hy1 && near) continue;
    set(x, y, x === hx1 ? skin.d : skin.b);
  }
  set(hx0 - 1, ey, skin.b); set(hx0 - 1, ey + 1, skin.d); set(hx1 + 1, ey, skin.d); set(hx1 + 1, ey + 1, skin.d);
  rect(10, ey - 1, 11, ey - 1, hair.d); rect(14, ey - 1, 15, ey - 1, hair.d);
  if (sleeping || (t % 3.3) < 0.14) { set(11, ey + 1, skin.dd); set(14, ey + 1, skin.dd); }
  else if (pose === 'read') { set(11, ey + 1, dark); set(14, ey + 1, dark); }
  else {
    set(11, ey, dark); set(11, ey + 1, eye.b); set(14, ey, dark); set(14, ey + 1, eye.b);
    if (fem) { set(10, ey, dark); set(15, ey, dark); }
  }
  const mouth = pack(mix(mul(skin.c, 0.62), [170, 60, 70], fem ? 0.45 : 0.25));
  const open = cheering || dancing || (pose === 'guitar' && Math.floor(t * 2) % 2);
  set(12, hy0 + 7, open ? pack([90, 30, 40]) : mouth); set(13, hy0 + 7, open ? pack([90, 30, 40]) : mouth);
  if (ch.face === 'blush') { const b = pack(mix(skin.c, [255, 110, 125], 0.4)); set(hx0 + 1, hy0 + 6, b); set(hx1 - 1, hy0 + 6, b); }
  if (ch.face === 'freckles') for (const x of [hx0 + 1, hx0 + 3, hx1 - 1, hx1 - 3]) set(x, hy0 + 6, skin.dd);

  // --- facial hair ---
  const hairOnSkin = pack(mix(skin.c, hair.c, 0.4));
  if (ch.facial === 'stubble') {
    for (let y = hy0 + 6; y <= hy1; y++) for (let x = hx0; x <= hx1; x++)
      if ((x + y) & 1 && !(y === hy0 + 7 && (x === 12 || x === 13)) && !((y === hy1) && (x === hx0 || x === hx1))) set(x, y, hairOnSkin);
  } else if (ch.facial === 'mustache') rect(11, hy0 + 6, 14, hy0 + 6, hair.b);
  else if (ch.facial === 'goatee') { rect(11, hy0 + 6, 14, hy0 + 6, hair.b); rect(11, hy1, 14, hy1, hair.b); rect(12, hy1 + 1, 13, hy1 + 1, hair.d); }
  else if (ch.facial === 'beard') {
    set(hx0, hy0 + 5, hair.b); set(hx1, hy0 + 5, hair.d);
    for (const x of [hx0, hx0 + 1, 11, 12, 13, 14, hx1 - 1, hx1]) set(x, hy0 + 6, x === hx1 ? hair.d : hair.b);
    for (let x = hx0; x <= hx1; x++) if (x !== 12 && x !== 13) set(x, hy0 + 7, x === hx1 ? hair.d : hair.b);
    rect(hx0, hy1, hx1, hy1, hair.b); set(hx1, hy1, hair.d);
    rect(hx0 + 1, hy1 + 1, hx1 - 1, hy1 + 1, hair.d);
  }

  // --- glasses ---
  if (ch.glasses === 'sunglasses') {
    rect(10, ey, 15, ey + 1, pack([26, 26, 36])); set(10, ey, pack([110, 110, 140])); set(14, ey, pack([110, 110, 140]));
  } else if (ch.glasses !== 'none') {
    const fr = pack([30, 26, 36]), lens = pack(mix(skin.c, [190, 220, 255], 0.3)), round = ch.glasses === 'round';
    for (const [a, b] of [[10, 12], [13, 15]]) {
      for (let x = a; x <= b; x++) {
        if (!round || x === a + 1) set(x, ey - 1, fr);
        if (x !== a + 1) { set(x, ey, round ? fr : lens); set(x, ey + 1, lens); }
      }
      set(a + 1, ey + 1, eye.b);
      if (a === 10) set(a - 1, ey, fr); else set(b + 1, ey, fr);
    }
  }

  // --- hair (front layer) ---
  if (!hijab) {
    const s = ch.hair, F = true;
    const cap = () => {
      for (let x = hx0 + 1; x <= hx1 - 1; x++) hp(x, hy0 - 1, x <= hx0 + 3 ? 'l' : 'b', F);
      for (let x = hx0; x <= hx1; x++) { hp(x, hy0, x === hx0 + 2 || x === hx0 + 3 ? 'l' : x === hx1 ? 'd' : 'b', F); hp(x, hy0 + 1, x === hx1 ? 'd' : 'b', F); }
      hp(hx0, hy0 + 2, 'b', F); hp(hx1, hy0 + 2, 'd', F);
    };
    switch (s) {
      case 'buzz': case 'mohawk': {
        const fuzz = pack(mix(skin.c, hair.c, 0.55));
        for (let x = hx0; x <= hx1; x++) { if (!(covered)) set(x, hy0, fuzz); if (x & 1) set(x, hy0 + 1, fuzz); }
        if (s === 'mohawk' && !covered) for (let y = hy0 - 3; y <= hy0 + 1; y++) { hp(12, y, 'l'); hp(13, y, 'b'); }
        break;
      }
      case 'short': cap(); for (let x = hx0; x <= hx0 + 2; x++) hp(x, hy0 + 2, 'b', F); hp(hx0, hy0 + 3, 'b', F); hp(hx1, hy0 + 3, 'd', F); break;
      case 'spiky':
        cap();
        for (const x of [hx0, hx0 + 2, hx0 + 4, hx1 - 1]) hp(x, hy0 + 2, 'b', F);
        for (const [x, y] of [[hx0 + 1, -2], [hx0 + 3, -2], [hx0 + 3, -3], [hx0 + 5, -2], [hx1 - 1, -2], [hx0 + 6, -3]]) hp(x, hy0 + y, 'b', F);
        break;
      case 'sidepart':
        cap();
        for (let x = hx0 + 2; x <= hx1 - 1; x++) hp(x, hy0 - 2, x < hx0 + 5 ? 'l' : 'b', F);
        for (let x = hx0 + 3; x <= hx1; x++) hp(x, hy0 + 2, x === hx1 ? 'd' : 'b', F);
        break;
      case 'pixie':
        cap();
        for (let x = hx0; x <= hx0 + 4; x++) hp(x, hy0 + 2, 'b', F);
        hp(hx0, hy0 + 3, 'b', F); hp(hx1, hy0 + 3, 'd', F);
        break;
      case 'bob':
        cap();
        for (let x = hx0; x <= hx1; x++) hp(x, hy0 + 2, x === hx1 ? 'd' : 'b', F);
        for (let y = hy0 + 1; y <= hy0 + 7; y++) { hp(hx0 - 1, y, 'b', F); hp(hx0, y, 'b', F); hp(hx1, y, 'd', F); hp(hx1 + 1, y, 'd', F); }
        break;
      case 'long':
        cap();
        for (let x = hx0; x <= hx0 + 2; x++) hp(x, hy0 + 2, 'b', F);
        hp(hx1 - 1, hy0 + 2, 'b', F);
        for (let y = hy0 + 1; y <= hy1 + 1; y++) { hp(hx0 - 1, y, 'b', F); hp(hx1 + 1, y, 'd', F); }
        for (let y = hy0 + 2; y <= hy0 + 5; y++) { hp(hx0, y, 'b', F); hp(hx1, y, 'd', F); }
        break;
      case 'ponytail': case 'bun': case 'braids':
        cap();
        if (s === 'braids') set(12, hy0 - 1, skin.d);
        if (s === 'bun') {
          for (let y = hy0 - 4; y <= hy0 - 2; y++) for (let x = 11; x <= 14; x++) {
            if (y === hy0 - 4 && (x === 11 || x === 14)) continue;
            hp(x, y, x === 14 ? 'd' : x === 12 ? 'l' : 'b', F);
          }
          hp(12, hy0 - 5, 'b', F); hp(13, hy0 - 5, 'b', F);
        }
        break;
      case 'curly': blob(13, hy0 + 2.5, 5.8, 5, true); break;
      case 'afro': blob(13, hy0 + 3.5, 7, 6.5, true); break;
      case 'locs':
        cap();
        for (const x of [hx0 - 1, hx1 + 1]) for (let y = hy0 + 1; y <= hy0 + 6; y++) hp(x, y, (x + y) % 3 ? 'b' : 'd', F);
        break;
    }
  }

  // --- headwear ---
  switch (ch.headwear) {
    case 'cap':
      for (let x = hx0 + 1; x <= hx1 - 1; x++) set(x, hy0 - 1, hw.b);
      for (let x = hx0; x <= hx1; x++) { set(x, hy0, x === hx1 ? hw.d : x < hx0 + 3 ? hw.l : hw.b); set(x, hy0 + 1, x === hx1 ? hw.d : hw.b); }
      for (let x = hx0 - 1; x <= hx1 + 2; x++) set(x, hy0 + 2, hw.dd);
      set(12, hy0 - 2, hw.d); set(13, hy0 - 2, hw.d);
      break;
    case 'beanie':
      for (let x = hx0 + 1; x <= hx1 - 1; x++) set(x, hy0 - 2, hw.b);
      for (let y = hy0 - 1; y <= hy0 + 1; y++) for (let x = hx0; x <= hx1; x++) set(x, y, x === hx1 ? hw.d : x < hx0 + 2 ? hw.l : hw.b);
      for (let x = hx0 - 1; x <= hx1 + 1; x++) set(x, hy0 + 2, (x & 1) ? hw.d : hw.dd);
      set(12, hy0 - 3, acc.b); set(13, hy0 - 3, acc.b); set(12, hy0 - 4, acc.l);
      break;
    case 'sunhat':
      for (let x = hx0 + 1; x <= hx1 - 1; x++) set(x, hy0 - 3, hw.b);
      for (let y = hy0 - 2; y <= hy0 - 1; y++) for (let x = hx0; x <= hx1; x++) set(x, y, x === hx1 ? hw.d : hw.b);
      for (let x = hx0; x <= hx1; x++) set(x, hy0, acc.b);
      for (let x = hx0 - 3; x <= hx1 + 3; x++) set(x, hy0 + 1, x < hx0 ? hw.l : hw.b);
      for (let x = hx0 - 2; x <= hx1 + 2; x++) set(x, hy0 + 2, hw.d);
      break;
    case 'headband':
      for (let x = hx0; x <= hx1; x++) set(x, hy0 + 1, x === hx1 ? hw.d : hw.b);
      break;
    case 'hijab':
      for (let x = hx0; x <= hx1; x++) set(x, hy0 - 1, hw.b);
      for (let y = hy0; y <= hy0 + 1; y++) for (let x = hx0 - 1; x <= hx1 + 1; x++) set(x, y, x <= hx0 ? hw.l : x >= hx1 ? hw.d : hw.b);
      for (let y = hy0 + 2; y <= hy1; y++) { set(hx0 - 1, y, hw.l); set(hx0, y, hw.b); set(hx1, y, hw.d); set(hx1 + 1, y, hw.d); }
      rect(hx0, hy1 + 1, hx1, torsoTop, hw.b);
      rect(hx0 + 1, hy1 + 1, hx1 - 1, hy1 + 1, hw.d);
      // fabric edge around the face and a drape over the chest, so it reads as cloth
      for (let y = hy0 + 2; y <= hy1; y++) { set(hx0, y, hw.d); set(hx1, y, hw.dd); }
      for (let x = hx0 + 1; x <= hx1 - 1; x++) set(x, hy0 + 1, hw.d);
      for (let r = 0; r < 4; r++) for (let x = sx0 + r; x <= sx1 - r; x++) set(x, torsoTop + 1 + r, r === 3 || x === sx1 - r ? hw.d : hw.b);
      break;
    case 'turban':
      for (let x = 11; x <= 14; x++) set(x, hy0 - 3, hw.b);
      for (let x = hx0 + 1; x <= hx1 - 1; x++) set(x, hy0 - 2, hw.b);
      for (let y = hy0 - 1; y <= hy0 + 1; y++) for (let x = hx0 - 1; x <= hx1 + 1; x++) set(x, y, x >= hx1 ? hw.d : hw.b);
      for (let x = hx0; x <= hx1; x++) set(x, hy0 + 2, hw.d);
      for (let y = hy0 - 3; y <= hy0 + 1; y++) for (let x = hx0 - 1; x <= hx1 + 1; x++) if ((x + y) % 4 === 0 && get(x, y)) set(x, y, hw.l);
      break;
    case 'headphones':
      for (let x = hx0; x <= hx1; x++) set(x, hy0 - 2, dark);
      set(hx0 - 1, hy0 - 1, dark); set(hx1 + 1, hy0 - 1, dark); set(hx0 - 1, hy0, dark); set(hx1 + 1, hy0, dark);
      rect(hx0 - 2, hy0 + 3, hx0 - 1, hy0 + 5, hw.b); rect(hx1 + 1, hy0 + 3, hx1 + 2, hy0 + 5, hw.d);
      break;
    case 'flower': {
      const p = hw.b;
      set(hx1, hy0, p); set(hx1 - 1, hy0 + 1, p); set(hx1 + 1, hy0 + 1, p); set(hx1, hy0 + 2, p);
      set(hx1, hy0 + 1, pack([255, 220, 80]));
      break;
    }
  }

  // --- mobility aids (in front) ---
  if (chair) {
    const cy = legTop + 2, glint = walking ? Math.floor(t * 8) % 9 : -1;
    for (const cx of [sx0 - 3, sx1 + 3]) {
      for (let y = cy - 5; y <= cy + 5; y++) for (let x = cx - 1; x <= cx + 1; x++) {
        if (Math.abs(x - cx) === 1 && Math.abs(y - cy) > 3) continue;
        set(x, y, x === cx ? (y - cy + 4 === glint ? metal.l : metal.b) : tire.b);
      }
    }
    rect(lx0 - 1, feetY + 1, rx1 + 1, feetY + 1, metal.b);
  } else if (ch.mobility === 'cane' && !seated && ['idle', 'walk', 'wave'].includes(pose)) {
    const x = waving ? sx0 - 3 : sx1 + 3, y0 = torsoTop + torsoN - 2;
    for (let y = y0; y <= feetY; y++) set(x, y, pack([110, 72, 40]));
    set(x + (waving ? 1 : -1), y0, pack([110, 72, 40]));
  }

  // --- props held in front of the body ---
  if (pose === 'read') {
    rect(9, torsoTop + 3, 16, torsoTop + 7, acc.b); rect(9, torsoTop + 7, 16, torsoTop + 7, acc.d);
    rect(12, torsoTop + 3, 13, torsoTop + 7, acc.dd); rect(10, torsoTop + 4, 11, torsoTop + 4, acc.l);
    if ((t % 4) < 0.3) rect(13, torsoTop + 2, 15, torsoTop + 2, pack([240, 236, 220]));
    set(9, torsoTop + 6, skin.b); set(16, torsoTop + 6, skin.b);
  } else if (pose === 'guitar') {
    const gy = legTop - 1;
    line(11, gy - 1, 5, torsoTop + 2, wood.dd); line(11, gy, 5, torsoTop + 3, wood.d);
    rect(3, torsoTop + 1, 4, torsoTop + 2, wood.dd);
    for (let y = gy - 3; y <= gy + 3; y++) for (let x = 9; x <= 17; x++) {
      if (((x - 13) / 4.6) ** 2 + ((y - gy) / 3.4) ** 2 > 1) continue;
      set(x, y, x >= 16 || y === gy + 3 ? woodLt.d : woodLt.b);
    }
    set(12, gy, wood.dd); set(13, gy, wood.dd);
    bentArm(1, 14, legTop - 1 + strum);
    set(6, torsoTop + 3, skin.b); set(6, torsoTop + 2, skin.b);
    // music notes drifting up
    const np = (t * 0.8) % 1, nx = 20 + Math.round(Math.sin(t * 2) * 1.5), ny = hy0 + 2 - Math.round(np * 9);
    if (np < 0.85) { const nc = pack([255, 240, 170]); set(nx, ny, nc); set(nx, ny - 1, nc); set(nx, ny - 2, nc); set(nx - 1, ny, nc); set(nx + 1, ny - 2, nc); }
  } else if (pose === 'roast') {
    const hx = dir > 0 ? sx1 + 3 : sx0 - 4, hy = torsoTop + 5, ex = hx + dir * 9, eyy = hy - 4;
    line(hx + dir, hy, ex, eyy, wood.d);
    const ph = (t * 0.12) % 1, mc = ph < 0.5 ? [245, 242, 232] : ph < 0.8 ? [236, 190, 110] : [150, 90, 45];
    rect(Math.min(ex, ex + dir), eyy - 1, Math.max(ex, ex + dir), eyy, pack(mc));
  }

  let outW = W, outH = H, src = d, foot = chair ? feetY + 1 : feetY;
  if (sleeping) {
    if (lying) {
      // tuck in under a blanket, then lie the sprite down (head to the left)
      const quilt = tone(ch.bottomColor);
      for (let y = torsoTop + 2; y <= feetY; y++) for (let x = sx0 - 2; x <= sx1 + 2; x++) {
        if (y === feetY && (x === sx0 - 2 || x === sx1 + 2)) continue;
        const plaid = (x - sx0) % 4 === 0 ? top.b : (y - torsoTop) % 4 === 0 ? top.d : quilt.b;
        set(x, y, y === torsoTop + 2 ? quilt.l : x >= sx1 + 1 ? quilt.d : plaid);
      }
      outW = H; outH = W; src = new Uint32Array(outW * outH);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) src[(W - 1 - x) * outW + y] = d[y * W + x];
      foot = 0;
      for (let i = 0; i < src.length; i++) if (src[i]) foot = Math.max(foot, (i / outW) | 0);
      foot = Math.min(outH - 1, foot + 1);
    }
    // floating Zzz
    const zc = pack([230, 236, 255]), zp = (t * 0.6) % 1;
    const zx = lying ? 6 + Math.round(zp * 4) : 19 + OX, zy = (lying ? foot - 12 : hy0) - Math.round(zp * 6);
    for (const [ddx, ddy, s] of [[0, 0, 3], [4, -4, 2]]) {
      const bx = zx + ddx + (lying ? 0 : 0), by = zy + ddy;
      for (let i = 0; i < s; i++) {
        const put = (x, y) => { if (x >= 0 && y >= 0 && x < outW && y < outH) src[y * outW + x] = zc; };
        put(bx + i, by); put(bx + i, by + s - 1); put(bx + s - 1 - i, by + i);
      }
    }
  }

  // --- outline ---
  const out = new Uint32Array(src);
  const ink = [18, 12, 26];
  for (let y = 0; y < outH; y++) for (let x = 0; x < outW; x++) {
    const i = y * outW + x;
    if (src[i]) continue;
    const n = (x > 0 && src[i - 1]) || (x < outW - 1 && src[i + 1]) || (y > 0 && src[i - outW]) || (y < outH - 1 && src[i + outW]);
    if (n) out[i] = pack(mix(unpack(n), ink, 0.72));
  }
  const dx = dancing ? [0, 1, 0, -1][df] : 0;
  return { w: outW, h: outH, d: out, footY: foot, cx: lying ? 22 : 13 + OX - dx, hop };
}

// Draw the character into a scene frame, lit like the scene.
function render(scene, ch) {
  if (!ch || !ch.show) return;
  const { W: SW, H: SH, S, t, frame: f, P } = scene;
  const k = Math.max(1, Math.round(S));
  let fx = ch.x * SW;
  if (ch.pose === 'walk') {
    const lane = SW + 30 * k;
    fx = (((ch.x * SW + t * 9 * S + 15 * k) % lane) + lane) % lane - 15 * k;
  }
  const xi = Math.max(0, Math.min(SW - 1, Math.round(fx))), g = scene.groundTop[xi];
  const fy = Math.round(g + 2 + (SH - g - 3) * ch.depth), cx = Math.round(fx);
  // turn towards the nearest campfire (used by the marshmallow stick)
  let dir = 1, best = Infinity;
  for (const fr of scene.fires) if (fr.kind === 'camp' && Math.abs(fr.x - fx) < best) { best = Math.abs(fr.x - fx); dir = fr.x < fx ? -1 : 1; }
  const spr = sprite(ch, t, { dir });
  const hop = spr.hop * k;
  const shw = (spr.w > 34 ? 12 : 6) * k - Math.round(hop / 2);
  for (let dy = -k; dy <= k; dy++) for (let dx = -shw; dx <= shw; dx++) {
    if ((dx / shw) ** 2 + (dy / (1.5 * k)) ** 2 > 1) continue;
    const X = cx + dx, Y = fy + dy;
    if (X >= 0 && X < SW && Y >= 0 && Y < SH) f[Y * SW + X] = pack(mul(unpack(f[Y * SW + X]), 0.7));
  }
  const ox = cx - spr.cx * k, oy = fy - spr.footY * k - hop;
  for (let sy = 0; sy < spr.h; sy++) for (let sx = 0; sx < spr.w; sx++) {
    const p = spr.d[sy * spr.w + sx];
    if (!p) continue;
    // lit like the scene, but kept a little brighter so the character stays readable at night
    const rgb = unpack(p), c = pack(mix(rgb, P.light(rgb), 0.75));
    for (let j = 0; j < k; j++) {
      const Y = oy + sy * k + j;
      if (Y < 0 || Y >= SH) continue;
      for (let i = 0; i < k; i++) { const X = ox + sx * k + i; if (X >= 0 && X < SW) f[Y * SW + X] = c; }
    }
  }
}

function random(rand = Math.random) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const opt = k => pick(OPTIONS[k])[0];
  const body = opt('body');
  return {
    ...DEFAULT,
    body, frame: opt('frame'), height: opt('height'), skin: pick(PALETTES.skin),
    hair: opt('hair'), hairColor: rand() < 0.8 ? pick(PALETTES.hair.slice(0, 9)) : pick(PALETTES.hair),
    eyes: pick(PALETTES.eyes), facial: body !== 'feminine' && rand() < 0.4 ? opt('facial') : 'none',
    glasses: rand() < 0.3 ? opt('glasses') : 'none', face: rand() < 0.4 ? opt('face') : 'none',
    top: opt('top'), topColor: pick(PALETTES.cloth), accent: pick(PALETTES.cloth),
    bottom: opt('bottom'), bottomColor: pick(PALETTES.cloth), shoes: opt('shoes'), shoeColor: pick(PALETTES.cloth),
    headwear: rand() < 0.35 ? opt('headwear') : 'none', headwearColor: pick(PALETTES.cloth),
  };
}

global.PixelCharacter = { OPTIONS, PALETTES, DEFAULT, sprite, render, random };
})(window);
