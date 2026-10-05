/**
 * PNG frames -> animated GIF with no dependencies (Playwright's ffmpeg build has no GIF encoder and no PNG decoder).
 * Minimal PNG decoder (8-bit RGB/RGBA, non-interlaced, node:zlib), box downscale, fixed 6x7x6 palette with ordered
 * dithering, LZW GIF89a with a NETSCAPE loop.
 *
 *   node tools/make-gif.mjs <out.gif> <delayMs> <width> <frame1.png> [frame2.png ...]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a png');
  let off = 8, w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; if (data[12]) throw new Error('interlaced png'); }
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    off += 12 + len;
  }
  if (depth !== 8 || (ctype !== 6 && ctype !== 2)) throw new Error(`unsupported png (depth ${depth}, type ${ctype})`);
  const bpp = ctype === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const out = new Uint8Array(w * h * 3);
  let prev = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const cur = new Uint8Array(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, b = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      let v = line[i];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[i] = v & 255;
    }
    for (let x = 0; x < w; x++) { out[(y * w + x) * 3] = cur[x * bpp]; out[(y * w + x) * 3 + 1] = cur[x * bpp + 1]; out[(y * w + x) * 3 + 2] = cur[x * bpp + 2]; }
    prev = cur;
  }
  return { w, h, rgb: out };
}

function downscale(img, targetW) {
  const k = Math.max(1, Math.round(img.w / targetW));
  if (k === 1) return img;
  const w = Math.floor(img.w / k), h = Math.floor(img.h / k);
  const rgb = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy < k; dy++) for (let dx = 0; dx < k; dx++) { const i = ((y * k + dy) * img.w + (x * k + dx)) * 3; r += img.rgb[i]; g += img.rgb[i + 1]; b += img.rgb[i + 2]; }
    const n = k * k, o = (y * w + x) * 3;
    rgb[o] = r / n; rgb[o + 1] = g / n; rgb[o + 2] = b / n;
  }
  return { w, h, rgb };
}

// 6 x 7 x 6 = 252 colours + 4 greys
const PAL = [];
for (let r = 0; r < 6; r++) for (let g = 0; g < 7; g++) for (let b = 0; b < 6; b++) PAL.push([Math.round((r * 255) / 5), Math.round((g * 255) / 6), Math.round((b * 255) / 5)]);
PAL.push([24, 24, 24], [72, 72, 72], [160, 160, 160], [232, 232, 232]);
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function quantize(img) {
  const idx = new Uint8Array(img.w * img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const i = (y * img.w + x) * 3;
    const d = (BAYER[y & 3][x & 3] / 16 - 0.5) * 18;
    const r = Math.max(0, Math.min(255, img.rgb[i] + d)), g = Math.max(0, Math.min(255, img.rgb[i + 1] + d)), b = Math.max(0, Math.min(255, img.rgb[i + 2] + d));
    idx[y * img.w + x] = Math.round((r / 255) * 5) * 42 + Math.round((g / 255) * 6) * 6 + Math.round((b / 255) * 5);
  }
  return idx;
}

function lzw(indices, minCode = 8) {
  const clear = 1 << minCode, eoi = clear + 1;
  const out = [];
  let cur = 0, curBits = 0;
  const emit = (code, size) => { cur |= code << curBits; curBits += size; while (curBits >= 8) { out.push(cur & 255); cur >>>= 8; curBits -= 8; } };
  let dict = new Map(), next = eoi + 1, size = minCode + 1;
  const reset = () => { dict = new Map(); next = eoi + 1; size = minCode + 1; };
  emit(clear, size);
  let prefix = indices[0];
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i];
    const key = prefix * 4096 + k;
    const found = dict.get(key);
    if (found !== undefined) { prefix = found; continue; }
    emit(prefix, size);
    if (next < 4096) { dict.set(key, next++); if (next - 1 === 1 << size && size < 12) size++; }
    else { emit(clear, size); reset(); }
    prefix = k;
  }
  emit(prefix, size);
  emit(eoi, size);
  if (curBits > 0) out.push(cur & 255);
  return Uint8Array.from(out);
}

function gif(frames, delayMs, w, h) {
  const parts = [];
  const u16 = (v) => [v & 255, (v >> 8) & 255];
  parts.push(Buffer.from('GIF89a'), Buffer.from([...u16(w), ...u16(h), 0xf7, 0, 0]));
  const pal = Buffer.alloc(256 * 3);
  PAL.forEach((c, i) => { pal[i * 3] = c[0]; pal[i * 3 + 1] = c[1]; pal[i * 3 + 2] = c[2]; });
  parts.push(pal);
  parts.push(Buffer.from([0x21, 0xff, 11, ...Buffer.from('NETSCAPE2.0'), 3, 1, 0, 0, 0]));
  for (const idx of frames) {
    parts.push(Buffer.from([0x21, 0xf9, 4, 0, ...u16(Math.round(delayMs / 10)), 0, 0]));
    parts.push(Buffer.from([0x2c, 0, 0, 0, 0, ...u16(w), ...u16(h), 0, 8]));
    const data = lzw(idx, 8);
    for (let i = 0; i < data.length; i += 255) { const chunk = data.subarray(i, i + 255); parts.push(Buffer.from([chunk.length]), Buffer.from(chunk)); }
    parts.push(Buffer.from([0]));
  }
  parts.push(Buffer.from([0x3b]));
  return Buffer.concat(parts);
}

const [out, delay, width, ...files] = process.argv.slice(2);
if (!out || !files.length) { console.error('usage: make-gif.mjs out.gif delayMs width frames...'); process.exit(1); }
let W = 0, H = 0;
const frames = files.map((f) => { const img = downscale(decodePng(readFileSync(f)), +width); W = img.w; H = img.h; return quantize(img); });
writeFileSync(out, gif(frames, +delay, W, H));
console.log(`${out}: ${frames.length} frames ${W}x${H}, ${(gif.length, readFileSync(out).length / 1024).toFixed(0)} KB`);
