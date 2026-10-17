'use strict';
(() => {
const { Scene, SEASONS, TIMES } = window.PixelEngine;
const Char = window.PixelCharacter;
const $ = id => document.getElementById(id);

const FX = [
  ['clouds', 'Clouds'], ['stars', 'Stars'], ['birds', 'Birds'], ['rain', 'Rain'], ['snow', 'Snow'],
  ['leaves', 'Leaves'], ['petals', 'Petals'], ['fireflies', 'Fireflies'], ['campfire', 'Campfire'],
  ['wildfire', 'Wildfire'], ['embers', 'Embers'], ['smoke', 'Smoke'], ['lightning', 'Lightning'],
  ['fog', 'Fog'], ['heat', 'Heat haze'],
];

const PRESETS = {
  summer:   { label: 'Summer',  season: 'summer', time: 'day', sky: 'clear', trees: 'round', density: 0.6, mountains: true, water: true, wind: 0.15, intensity: 0.5, fx: { clouds: 1, birds: 1 } },
  spring:   { label: 'Spring',  season: 'spring', time: 'day', sky: 'clear', trees: 'round', density: 0.55, mountains: true, water: false, wind: 0.3, intensity: 0.55, fx: { clouds: 1, petals: 1, birds: 1 } },
  autumn:   { label: 'Autumn',  season: 'autumn', time: 'sunset', sky: 'clear', trees: 'round', density: 0.7, mountains: true, water: true, wind: 0.45, intensity: 0.6, fx: { clouds: 1, leaves: 1 } },
  winter:   { label: 'Winter',  season: 'winter', time: 'day', sky: 'clear', trees: 'pine', density: 0.7, mountains: true, water: false, wind: 0.2, intensity: 0.6, fx: { snow: 1, clouds: 1 } },
  rain:     { label: 'Rain',    season: 'summer', time: 'day', sky: 'overcast', trees: 'mixed', density: 0.6, mountains: true, water: true, wind: -0.2, intensity: 0.65, fx: { rain: 1, fog: 1, clouds: 1 } },
  storm:    { label: 'Storm',   season: 'autumn', time: 'night', sky: 'overcast', trees: 'pine', density: 0.55, mountains: true, water: true, wind: 0.7, intensity: 0.9, fx: { rain: 1, lightning: 1, clouds: 1 } },
  campfire: { label: 'Campfire', season: 'summer', time: 'night', sky: 'clear', trees: 'pine', density: 0.6, mountains: true, water: true, wind: 0.1, intensity: 0.5, fx: { stars: 1, campfire: 1, embers: 1, smoke: 1, fireflies: 1 } },
  inferno:  { label: 'Flames',  season: 'scorched', time: 'sunset', sky: 'smoke', trees: 'bare', density: 0.5, mountains: true, water: false, wind: 0.35, intensity: 0.75, fx: { wildfire: 1, embers: 1, smoke: 1, clouds: 1 } },
  desert:   { label: 'Desert',  season: 'desert', time: 'day', sky: 'clear', trees: 'cactus', density: 0.35, mountains: true, water: false, wind: 0.1, intensity: 0.6, fx: { heat: 1, birds: 1 } },
  snownight:{ label: 'Winter night', season: 'winter', time: 'night', sky: 'clear', trees: 'pine', density: 0.65, mountains: true, water: true, wind: 0.15, intensity: 0.5, fx: { snow: 1, stars: 1, campfire: 1, embers: 1 } },
};

let presetName = 'campfire';
let cfg = fromPreset(presetName, { seed: 1337, width: 192, height: 108, speed: 1, fps: 12 });
let ch = { ...Char.DEFAULT };
const scene = new Scene();
scene.actor = s => Char.render(s, ch);
const canvas = $('screen'), ctx = canvas.getContext('2d');
let playing = true;

function fromPreset(name, keep) {
  const p = PRESETS[name];
  return { ...p, fx: { ...p.fx }, seed: keep.seed, width: keep.width, height: keep.height, speed: keep.speed, fps: keep.fps };
}

// ---------- rendering ----------
function rebuild() {
  scene.build(cfg);
  if (canvas.width !== cfg.width || canvas.height !== cfg.height) {
    canvas.width = cfg.width; canvas.height = cfg.height;
    fit();
  }
  render();
  syncChar();
  saveState();
  $('meta').textContent = `${cfg.width}×${cfg.height} · seed ${cfg.seed}`;
}

function render() { ctx.putImageData(scene.draw(), 0, 0); drawPreview(); }

function fit() {
  const vp = $('viewport'), z = $('zoom').value;
  let s;
  if (z === 'fit') {
    const k = Math.min((vp.clientWidth - 24) / cfg.width, (vp.clientHeight - 24) / cfg.height);
    s = k >= 1 ? Math.floor(k) : Math.max(0.25, k);
  } else s = +z;
  canvas.style.width = cfg.width * s + 'px';
  canvas.style.height = cfg.height * s + 'px';
}
new ResizeObserver(fit).observe($('viewport'));

let last = performance.now(), acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const el = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!playing) return;
  acc += el;
  const stepT = 1 / cfg.fps;
  let drew = false;
  while (acc >= stepT) { acc -= stepT; scene.step(cfg.speed / cfg.fps); drew = true; }
  if (drew) render();
}

// ---------- preset thumbnails ----------
const thumbScene = new Scene();
function buildPresets() {
  const box = $('presets');
  box.innerHTML = '';
  for (const [name, p] of Object.entries(PRESETS)) {
    const btn = document.createElement('button');
    btn.className = 'preset' + (name === presetName ? ' active' : '');
    btn.dataset.name = name;
    const c = document.createElement('canvas');
    c.width = 128; c.height = 72;
    btn.append(c, Object.assign(document.createElement('span'), { textContent: p.label }));
    btn.onclick = () => { presetName = name; cfg = fromPreset(name, cfg); syncUI(); rebuild(); };
    box.append(btn);
  }
  drawThumbs();
}
let thumbTimer;
function drawThumbs() {
  clearTimeout(thumbTimer);
  thumbTimer = setTimeout(() => {
    for (const btn of $('presets').children) {
      thumbScene.build(fromPreset(btn.dataset.name, { seed: cfg.seed, width: 128, height: 72, speed: 1, fps: 12 }));
      btn.querySelector('canvas').getContext('2d').putImageData(thumbScene.draw(), 0, 0);
    }
  }, 150);
}

// ---------- controls ----------
function custom() {
  presetName = null;
  for (const b of $('presets').children) b.classList.remove('active');
}

function setupControls() {
  $('season').innerHTML = Object.entries(SEASONS).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('');
  document.querySelector('.seg[data-key=time]').innerHTML =
    Object.entries(TIMES).map(([k, t]) => `<button data-v="${k}">${t.label}</button>`).join('');

  for (const seg of document.querySelectorAll('.seg[data-key]')) {
    seg.onclick = e => {
      const v = e.target.dataset.v;
      if (!v) return;
      cfg[seg.dataset.key] = v;
      cfg.fx.stars = cfg.time === 'night' && cfg.sky === 'clear' ? 1 : 0;
      if (seg.dataset.key === 'sky' && v !== 'clear') cfg.fx.clouds = 1;
      custom(); syncUI(); rebuild();
    };
  }

  for (const id of ['season', 'trees']) $(id).onchange = e => { cfg[id] = e.target.value; custom(); rebuild(); };
  for (const id of ['mountains', 'water']) $(id).onchange = e => { cfg[id] = e.target.checked; custom(); rebuild(); };

  $('fx').innerHTML = FX.map(([k, l]) => `<button class="chip" data-k="${k}">${l}</button>`).join('');
  $('fx').onclick = e => {
    const k = e.target.dataset.k;
    if (!k) return;
    cfg.fx[k] = cfg.fx[k] ? 0 : 1;
    custom(); syncUI(); rebuild();
  };

  const range = (id, toCfg, label, live) => {
    $(id).oninput = e => {
      cfg[id] = toCfg(+e.target.value);
      $(id + 'Out').textContent = label(cfg[id]);
      if (live) return;
      custom(); rebuildSoon();
    };
  };
  range('density', v => v / 100, v => Math.round(v * 100) + '%');
  range('intensity', v => v / 100, v => Math.round(v * 100) + '%');
  range('wind', v => v / 100, v => (v > 0 ? '→ ' : v < 0 ? '← ' : '') + Math.abs(Math.round(v * 100)) + '%', true);
  range('speed', v => v / 100, v => v.toFixed(2) + '×', true);
  range('fps', v => v, v => v + ' fps', true);

  $('res').onchange = e => { [cfg.width, cfg.height] = e.target.value.split('x').map(Number); rebuild(); };
  $('seed').onchange = e => { cfg.seed = Math.max(1, +e.target.value | 0); rebuild(); drawThumbs(); };
  $('dice').onclick = $('reseed').onclick = reseed;
  $('zoom').onchange = fit;
  $('play').onclick = togglePlay;
  $('stepBtn').onclick = () => { scene.step(cfg.speed / cfg.fps); render(); };

  $('exPng').onclick = exportPng;
  $('exSheet').onclick = exportSheet;
  $('exGif').onclick = exportGif;
  $('exChar').onclick = exportCharSheet;
  $('shareLink').onclick = copyShareLink;

  for (const b of $('tabs').children) b.onclick = () => {
    for (const x of $('tabs').children) x.classList.toggle('on', x === b);
    for (const t of document.querySelectorAll('.tab')) t.hidden = t.dataset.tab !== b.dataset.tab;
  };

  // Stop Space from also "clicking" a focused button (which would toggle twice).
  addEventListener('keyup', e => { if (e.code === 'Space' && e.target.matches('button')) e.preventDefault(); });
  addEventListener('keydown', e => {
    if (e.target.matches('input, select')) return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === 'r' || e.key === 'R') reseed();
    else if (e.key === 'ArrowRight' && !playing) { scene.step(cfg.speed / cfg.fps); render(); }
  });
}

let rebuildTimer;
function rebuildSoon() { clearTimeout(rebuildTimer); rebuildTimer = setTimeout(rebuild, 60); }

function reseed() {
  cfg.seed = 1 + Math.floor(Math.random() * 99999);
  syncUI(); rebuild(); drawThumbs();
}

function togglePlay() {
  playing = !playing;
  $('play').textContent = playing ? 'Pause' : 'Play';
}

function syncUI() {
  $('season').value = cfg.season;
  $('trees').value = cfg.trees;
  $('mountains').checked = cfg.mountains;
  $('water').checked = cfg.water;
  for (const seg of document.querySelectorAll('.seg[data-key]'))
    for (const b of seg.children) b.classList.toggle('on', b.dataset.v === cfg[seg.dataset.key]);
  const hasFire = cfg.fx.campfire || cfg.fx.wildfire;
  for (const c of $('fx').children) {
    const needsFire = c.dataset.k === 'embers' || c.dataset.k === 'smoke';
    c.classList.toggle('on', !!cfg.fx[c.dataset.k]);
    c.classList.toggle('na', needsFire && !hasFire);
    c.title = needsFire && !hasFire ? 'Needs Campfire or Wildfire' : '';
  }
  $('density').value = Math.round(cfg.density * 100);
  $('intensity').value = Math.round(cfg.intensity * 100);
  $('wind').value = Math.round(cfg.wind * 100);
  $('speed').value = Math.round(cfg.speed * 100);
  $('fps').value = cfg.fps;
  $('densityOut').textContent = Math.round(cfg.density * 100) + '%';
  $('intensityOut').textContent = Math.round(cfg.intensity * 100) + '%';
  $('windOut').textContent = (cfg.wind > 0 ? '→ ' : cfg.wind < 0 ? '← ' : '') + Math.abs(Math.round(cfg.wind * 100)) + '%';
  $('speedOut').textContent = cfg.speed.toFixed(2) + '×';
  $('fpsOut').textContent = cfg.fps + ' fps';
  $('res').value = `${cfg.width}x${cfg.height}`;
  $('seed').value = cfg.seed;
  for (const b of $('presets').children) b.classList.toggle('active', b.dataset.name === presetName);
}

// ---------- character ----------
const CH_UI = [
  ['Placement', [['seg', 'pose', 'Pose'], ['range', 'x', 'Position'], ['range', 'depth', 'Distance']]],
  ['Body', [['seg', 'body', 'Body'], ['seg', 'frame', 'Build'], ['seg', 'height', 'Height'], ['swatch', 'skin', 'Skin tone', 'skin']]],
  ['Hair', [['select', 'hair', 'Style'], ['swatch', 'hairColor', 'Color', 'hair']]],
  ['Face', [['swatch', 'eyes', 'Eyes', 'eyes'], ['select', 'facial', 'Facial hair'], ['select', 'glasses', 'Glasses'], ['seg', 'face', 'Details']]],
  ['Outfit', [['select', 'top', 'Top'], ['swatch', 'topColor', 'Top color', 'cloth'], ['swatch', 'accent', 'Accent color', 'cloth'],
    ['select', 'bottom', 'Bottom'], ['swatch', 'bottomColor', 'Bottom color', 'cloth'],
    ['select', 'shoes', 'Shoes'], ['swatch', 'shoeColor', 'Shoe color', 'cloth']]],
  ['Accessories', [['select', 'headwear', 'Headwear'], ['swatch', 'headwearColor', 'Headwear color', 'cloth'], ['select', 'mobility', 'Mobility aid']]],
];

function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
}

function charChanged() {
  syncChar();
  render();
  saveState();
}

function buildCharUI() {
  const root = $('charControls');
  for (const [title, fields] of CH_UI) {
    const sec = el('section', {}, el('h2', { textContent: title }));
    for (const [kind, key, label, pal] of fields) {
      const field = el('div', { className: 'field' }, el('label', { textContent: label }));
      let input;
      if (kind === 'seg') {
        input = el('div', { className: key === 'pose' ? 'seg grid' : 'seg' });
        input.dataset.ch = key;
        for (const [v, l] of Char.OPTIONS[key]) { const b = el('button', { textContent: l }); b.dataset.v = v; input.append(b); }
        input.onclick = e => { if (e.target.dataset.v) { ch[key] = e.target.dataset.v; charChanged(); } };
      } else if (kind === 'select') {
        input = el('select');
        for (const [v, l] of Char.OPTIONS[key]) input.append(el('option', { value: v, textContent: l }));
        input.onchange = () => { ch[key] = input.value; charChanged(); };
      } else if (kind === 'range') {
        input = el('input', { type: 'range', min: 0, max: 100 });
        input.oninput = () => { ch[key] = input.value / 100; charChanged(); };
      } else {
        input = el('div', { className: 'swatches' });
        for (const c of Char.PALETTES[pal]) {
          const b = el('button', { className: 'swatch', title: c });
          b.style.background = c; b.dataset.v = c;
          b.onclick = () => { ch[key] = c; charChanged(); };
          input.append(b);
        }
        const custom = el('input', { type: 'color', title: 'Custom color' });
        custom.oninput = () => { ch[key] = custom.value; charChanged(); };
        input.append(custom);
      }
      input.dataset.key2 = key;
      input.dataset.kind = kind;
      field.append(input);
      sec.append(field);
      if (key === 'depth') {
        const b = el('button', { className: 'btn', id: 'chFire', textContent: 'Sit by the campfire' });
        b.onclick = placeByFire;
        sec.append(b);
      }
    }
    root.append(sec);
  }
  $('chShow').onchange = e => { ch.show = e.target.checked; charChanged(); };
  $('chRandom').onclick = () => { ch = { ...Char.random(), show: true, pose: ch.pose, x: ch.x, depth: ch.depth }; charChanged(); };
  $('chReset').onclick = () => { ch = { ...Char.DEFAULT }; charChanged(); };
  $('chAvatar').onclick = exportAvatar;
  $('chSave').onclick = () => { addSaved(ch); renderSaved(); };
}

function syncChar() {
  $('chShow').checked = ch.show;
  renderSaved();
  const fireBtn = $('chFire');
  if (fireBtn) { fireBtn.disabled = !cfg.fx.campfire; fireBtn.title = cfg.fx.campfire ? '' : 'Turn on Campfire in the Scene tab first'; }
  for (const input of $('charControls').querySelectorAll('[data-key2]')) {
    const key = input.dataset.key2, v = ch[key];
    switch (input.dataset.kind) {
      case 'seg': for (const b of input.children) b.classList.toggle('on', b.dataset.v === v); break;
      case 'select': input.value = v; break;
      case 'range': input.value = Math.round(v * 100); break;
      case 'swatch':
        for (const b of input.querySelectorAll('.swatch')) b.classList.toggle('on', b.dataset.v.toLowerCase() === v.toLowerCase());
        input.querySelector('input').value = v;
        break;
    }
  }
}

// Put the character just beside the campfire, on the side with more room, seated.
function placeByFire() {
  const fire = scene.fires.find(f => f.kind === 'camp');
  if (!fire) return;
  const W = scene.W, H = scene.H, side = fire.x < W / 2 ? 1 : -1;
  const x = Math.max(4, Math.min(W - 4, fire.x + side * 16 * scene.S));
  const g = scene.groundTop[Math.round(x)];
  ch.x = x / W;
  ch.depth = Math.max(0, Math.min(1, (fire.y + 1 - g - 2) / (H - g - 3)));
  if (['idle', 'walk', 'wave', 'jump', 'dance', 'cheer'].includes(ch.pose)) ch.pose = 'roast';
  ch.show = true;
  charChanged();
}

const pcanvas = $('charPreview'), pctx = pcanvas.getContext('2d');
function drawPreview() {
  const spr = Char.sprite(ch, scene.t || 0);
  if (pcanvas.width !== spr.w || pcanvas.height !== spr.h) {
    pcanvas.width = spr.w; pcanvas.height = spr.h;
    // fit any pose (the sleeping one is wide) inside the fixed preview box
    const k = Math.min(104 / spr.w, 176 / spr.h);
    pcanvas.style.width = spr.w * k + 'px'; pcanvas.style.height = spr.h * k + 'px';
  }
  pctx.putImageData(new ImageData(new Uint8ClampedArray(spr.d.buffer), spr.w, spr.h), 0, 0);
}

// ---------- saved characters (kept in this browser) ----------
const SAVED_KEY = 'pixel-env-characters';
// a character's look, ignoring where it stands and what it's doing
const LOOK_SKIP = ['show', 'pose', 'x', 'depth'];
const look = c => JSON.stringify(Object.keys(Char.DEFAULT).filter(k => !LOOK_SKIP.includes(k)).map(k => c[k]));

function readSaved() {
  try { const a = JSON.parse(localStorage.getItem(SAVED_KEY)); return Array.isArray(a) ? a.map(sanitizeChar) : []; }
  catch (e) { return []; }
}
function writeSaved(list) {
  try { localStorage.setItem(SAVED_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
}
function addSaved(c) {
  const list = readSaved();
  if (list.some(x => look(x) === look(c))) return;
  list.unshift({ ...c });
  if (!writeSaved(list.slice(0, 24))) $('savedHint').textContent = 'This browser is blocking storage, so characters can’t be saved.';
}

function renderSaved() {
  const box = $('savedChars'), list = readSaved(), current = look(ch);
  box.innerHTML = '';
  list.forEach((c, i) => {
    const spr = Char.sprite({ ...c, pose: 'idle', mobility: c.mobility === 'cane' ? 'none' : c.mobility }, 0.4);
    const cv = el('canvas', { width: spr.w, height: spr.h });
    cv.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(spr.d.buffer), spr.w, spr.h), 0, 0);
    const pick = el('button', { className: 'saved-pick' + (look(c) === current ? ' on' : ''), title: 'Use this character' }, cv);
    pick.onclick = () => { ch = { ...c, show: true, pose: ch.pose, x: ch.x, depth: ch.depth }; charChanged(); };
    const del = el('button', { className: 'saved-del', textContent: '×', title: 'Remove from saved' });
    del.onclick = () => { list.splice(i, 1); writeSaved(list); renderSaved(); };
    box.append(el('div', { className: 'saved-item' }, pick, del));
  });
  $('savedHint').textContent = list.length ? '' : 'Save characters to switch between them later. They stay in this browser.';
  $('chSave').disabled = list.some(x => look(x) === current);
  $('chSave').textContent = $('chSave').disabled ? 'Saved' : 'Save this character';
}

// ---------- state: share links + local save ----------
const isColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);
function sanitizeChar(c) {
  const out = { ...Char.DEFAULT };
  if (!c || typeof c !== 'object') return out;
  for (const k of Object.keys(out)) {
    const v = c[k], d = out[k];
    if (Char.OPTIONS[k]) { if (Char.OPTIONS[k].some(([o]) => o === v)) out[k] = v; }
    else if (typeof d === 'number') { if (typeof v === 'number' && isFinite(v)) out[k] = Math.min(1, Math.max(0, v)); }
    else if (typeof d === 'boolean') out[k] = !!v;
    else if (isColor(d)) { if (isColor(v)) out[k] = v; }
  }
  return out;
}
function sanitizeScene(s) {
  const base = fromPreset('campfire', cfg);
  if (!s || typeof s !== 'object') return base;
  const out = { ...base, fx: {} };
  const enumOk = (k, list) => { if (list.includes(s[k])) out[k] = s[k]; };
  enumOk('season', Object.keys(SEASONS)); enumOk('time', Object.keys(TIMES)); enumOk('sky', ['clear', 'overcast', 'smoke']);
  enumOk('trees', ['round', 'pine', 'mixed', 'bare', 'cactus', 'none']);
  const num = (k, lo, hi) => { if (typeof s[k] === 'number' && isFinite(s[k])) out[k] = Math.min(hi, Math.max(lo, s[k])); };
  num('density', 0, 1); num('intensity', 0, 1); num('wind', -1, 1); num('speed', 0.1, 2); num('fps', 4, 30); num('seed', 1, 999999);
  out.seed = Math.round(out.seed); out.fps = Math.round(out.fps);
  out.mountains = s.mountains !== false; out.water = !!s.water;
  const res = ['128x72', '160x90', '192x108', '256x144', '320x180', '128x128', '108x192'];
  if (res.includes(`${s.width}x${s.height}`)) { out.width = s.width; out.height = s.height; }
  for (const [k] of FX) out.fx[k] = s.fx && s.fx[k] ? 1 : 0;
  return out;
}
const b64 = { enc: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/')))) };

function loadState() {
  let data = null;
  try {
    const m = location.hash.match(/^#s=([\w-]+)/);
    if (m) data = JSON.parse(b64.dec(m[1]));
  } catch (e) { console.warn('Bad share link', e); }
  let own = null;
  try { own = JSON.parse(localStorage.getItem('pixel-env-state')); } catch (e) { /* storage unavailable */ }
  if (data && own && own.c) addSaved(sanitizeChar(own.c)); // a shared link shouldn't wipe out your own character
  if (!data) data = own;
  if (!data) return;
  cfg = sanitizeScene(data.s);
  ch = sanitizeChar(data.c);
  presetName = typeof data.p === 'string' && PRESETS[data.p] ? data.p : null;
}
function saveState() {
  // once loaded, a share link's hash would go stale as you edit, so drop it
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  try { localStorage.setItem('pixel-env-state', JSON.stringify({ s: cfg, c: ch, p: presetName })); } catch (e) { /* ignore */ }
}
async function copyShareLink() {
  const url = `${location.origin}${location.pathname}#s=${b64.enc(JSON.stringify({ s: cfg, c: ch, p: presetName }))}`;
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); $('shareStatus').textContent = 'Link copied.'; }
  catch (e) { $('shareStatus').textContent = 'Copy failed — the link is in the address bar.'; }
  if (/^(localhost|127\.|file)/.test(location.hostname || 'file'))
    $('shareStatus').textContent += ' Note: it only works for others once the app is hosted online.';
}

// ---------- export ----------
const baseName = () => `pixel-${presetName || 'custom'}-${cfg.seed}`;

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function frameCanvas(frame) {
  const c = document.createElement('canvas');
  c.width = cfg.width; c.height = cfg.height;
  c.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(frame.buffer.slice(0)), cfg.width, cfg.height), 0, 0);
  return c;
}

function captureFrames(n) {
  const frames = [];
  for (let i = 0; i < n; i++) {
    scene.step(cfg.speed / cfg.fps);
    scene.draw();
    frames.push(scene.frame.slice());
  }
  render();
  return frames;
}

function busy(msg, fn) {
  const btns = document.querySelectorAll('.exports .btn');
  btns.forEach(b => (b.disabled = true));
  $('status').textContent = msg;
  setTimeout(() => {
    try { $('status').textContent = fn(); }
    catch (err) { console.error(err); $('status').textContent = 'Export failed: ' + err.message; }
    btns.forEach(b => (b.disabled = false));
  }, 30);
}

function exportPng() {
  const s = +$('scale').value, c = document.createElement('canvas'), src = frameCanvas(scene.frame);
  c.width = cfg.width * s; c.height = cfg.height * s;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  c.toBlob(b => download(b, `${baseName()}.png`));
  $('status').textContent = `Saved PNG (${c.width}×${c.height}).`;
}

function exportSheet() {
  busy('Rendering sprite sheet…', () => {
    const n = +$('frames').value, s = +$('scale').value, frames = captureFrames(n);
    const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), fw = cfg.width * s, fh = cfg.height * s;
    const c = document.createElement('canvas');
    c.width = cols * fw; c.height = rows * fh;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    frames.forEach((f, i) => x.drawImage(frameCanvas(f), (i % cols) * fw, Math.floor(i / cols) * fh, fw, fh));
    c.toBlob(b => download(b, `${baseName()}-sheet-${n}f-${cols}x${rows}.png`));
    return `Saved sprite sheet: ${n} frames, ${cols}×${rows} grid of ${fw}×${fh}, ${cfg.fps} fps.`;
  });
}

function spriteCanvas(spr, s) {
  const src = el('canvas', { width: spr.w, height: spr.h });
  src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(spr.d.buffer.slice(0)), spr.w, spr.h), 0, 0);
  const c = el('canvas', { width: spr.w * s, height: spr.h * s }), x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

function exportAvatar() {
  spriteCanvas(Char.sprite({ ...ch, pose: ch.pose === 'walk' ? 'idle' : ch.pose }, 0.4), 10).toBlob(b => download(b, 'my-pixel-character.png'));
}

function exportCharSheet() {
  const s = +$('scale').value, n = 8, first = Char.sprite(ch, 0), fw = first.w * s, fh = first.h * s;
  const c = el('canvas', { width: fw * n, height: fh }), x = c.getContext('2d');
  for (let i = 0; i < n; i++) x.drawImage(spriteCanvas(Char.sprite(ch, i / 6), s), i * fw, 0);
  c.toBlob(b => download(b, `character-${ch.pose}-${n}f.png`));
  $('status').textContent = `Saved character sheet: ${n} frames of ${fw}×${fh}, 6 fps.`;
}

function exportGif() {
  busy('Encoding GIF…', () => {
    const n = +$('frames').value, s = +$('scale').value, frames = captureFrames(n);
    const delay = Math.max(2, Math.round(100 / cfg.fps));
    const bytes = GifEncoder.encode(frames, cfg.width, cfg.height, s, delay);
    download(new Blob([bytes], { type: 'image/gif' }), `${baseName()}.gif`);
    return `Saved GIF: ${n} frames at ${cfg.width * s}×${cfg.height * s} (${(bytes.length / 1024).toFixed(0)} KB).`;
  });
}

// ---------- start ----------
loadState();
setupControls();
buildCharUI();
buildPresets();
syncUI();
syncChar();
rebuild();
requestAnimationFrame(loop);
})();
