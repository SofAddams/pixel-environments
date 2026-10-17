'use strict';
// Minimal animated GIF89a encoder for pixel frames (Uint32Array, ABGR).
(function (global) {

class Bytes {
  constructor(n = 1 << 16) { this.buf = new Uint8Array(n); this.len = 0; }
  grow(k) {
    if (this.len + k <= this.buf.length) return;
    let n = this.buf.length * 2;
    while (n < this.len + k) n *= 2;
    const b = new Uint8Array(n);
    b.set(this.buf.subarray(0, this.len));
    this.buf = b;
  }
  byte(v) { this.grow(1); this.buf[this.len++] = v & 255; }
  u16(v) { this.byte(v); this.byte(v >> 8); }
  str(s) { for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i)); }
  bytes(arr, from = 0, to = arr.length) { this.grow(to - from); this.buf.set(arr.subarray(from, to), this.len); this.len += to - from; }
  result() { return this.buf.slice(0, this.len); }
}

const keyOf = (p, mask, half) =>
  ((((p & 255) & mask) | half) << 16) | (((((p >>> 8) & 255) & mask) | half) << 8) | ((((p >>> 16) & 255) & mask) | half);

// Exact colours if there are <= 256, otherwise drop low bits until they fit.
function buildPalette(frames) {
  for (let s = 0; s <= 7; s++) {
    const mask = (0xff << s) & 0xff, half = s ? 1 << (s - 1) : 0, map = new Map();
    let ok = true;
    outer: for (const fr of frames) for (let i = 0; i < fr.length; i++) {
      const k = keyOf(fr[i], mask, half);
      if (!map.has(k)) { if (map.size >= 256) { ok = false; break outer; } map.set(k, map.size); }
    }
    if (ok) return { map, mask, half };
  }
}

const codes = new Int32Array(1 << 20), stamps = new Int32Array(1 << 20);
let gen = 0;

function lzw(out, idx) {
  const minCode = 8, clear = 256, eoi = 257;
  let size = 9, next = 258, cur = 0, nb = 0, bl = 0;
  const block = new Uint8Array(255);
  gen++;
  const flush = b => { block[bl++] = b; if (bl === 255) { out.byte(255); out.bytes(block); bl = 0; } };
  const emit = c => { cur |= c << nb; nb += size; while (nb >= 8) { flush(cur & 255); cur >>>= 8; nb -= 8; } };
  out.byte(minCode);
  emit(clear);
  let prefix = idx[0];
  for (let i = 1, n = idx.length; i < n; i++) {
    const k = idx[i], key = (prefix << 8) | k;
    if (stamps[key] === gen) { prefix = codes[key]; continue; }
    emit(prefix);
    if (next === 4096) { emit(clear); gen++; size = 9; next = 258; }
    else { if (next >= (1 << size)) size++; stamps[key] = gen; codes[key] = next++; }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (nb > 0) flush(cur & 255);
  if (bl) { out.byte(bl); out.bytes(block, 0, bl); }
  out.byte(0);
}

function encode(frames, w, h, scale, delayCs) {
  const { map, mask, half } = buildPalette(frames), W = w * scale, H = h * scale;
  const out = new Bytes(1 << 20);
  out.str('GIF89a'); out.u16(W); out.u16(H); out.byte(0xF7); out.byte(0); out.byte(0);
  const table = new Uint8Array(768);
  for (const [k, i] of map) { table[i * 3] = (k >> 16) & 255; table[i * 3 + 1] = (k >> 8) & 255; table[i * 3 + 2] = k & 255; }
  out.bytes(table);
  out.byte(0x21); out.byte(0xFF); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.u16(0); out.byte(0);
  const idx = new Uint8Array(W * H), row = new Uint8Array(w);
  for (const fr of frames) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) row[x] = map.get(keyOf(fr[y * w + x], mask, half));
      for (let sy = 0; sy < scale; sy++) {
        const base = (y * scale + sy) * W;
        for (let x = 0; x < w; x++) { const v = row[x]; for (let sx = 0; sx < scale; sx++) idx[base + x * scale + sx] = v; }
      }
    }
    out.byte(0x21); out.byte(0xF9); out.byte(4); out.byte(0x04); out.u16(delayCs); out.byte(0); out.byte(0);
    out.byte(0x2C); out.u16(0); out.u16(0); out.u16(W); out.u16(H); out.byte(0);
    lzw(out, idx);
  }
  out.byte(0x3B);
  return out.result();
}

global.GifEncoder = { encode };
})(window);
