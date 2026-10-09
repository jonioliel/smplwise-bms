/**
 * CC0 texture processing (LOOK_SPEC §2 / ASSET_DOWNLOAD_LIST §A), with Chromium's canvas - no image library installed:
 *   1K ambientCG set -> assets/textures/<id>/color.webp (per material id) + assets/textures/sets/<Set>/{normal.jpg, rough_ao.jpg}
 *   (shared by every id that uses the set) at 512 px
 *   - color: converted to a HUE-FREE detail map (luminance only, mean pulled to `mid`, amplitude scaled to `amp`) so the
 *     style palette supplies the colour, exactly like the procedural sets
 *   - normal: NormalGL resized (PNG, lossless)
 *   - rough_ao: AmbientOcclusion in R (255 when the set has none), Roughness in G, 255 in B (three.js reads aoMap.r,
 *     roughnessMap.g) - one file for two maps
 * Usage: SW_NODE_MODULES=... node tools/process-textures.mjs <downloads dir with x/<Set>_1K-JPG/> <manifest.json>
 * The manifest maps material id -> { set, mid, amp }. Writes assets/textures/MANIFEST.json with sizes.
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync } from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const nm = process.env.SW_NODE_MODULES || path.resolve(root, '../../../../frontend/node_modules');
const require = createRequire(path.join(nm, 'x.js'));
const { chromium } = require('playwright');
const [dl, manifestPath] = process.argv.slice(2);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const SIZE = 512;
const out = path.join(root, 'assets', 'textures');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
// a file:// document so file:// images are loadable (about:blank cannot read them); ?noboot keeps the app idle
await page.goto(pathToFileURL(path.join(root, 'index.html')).href + '?noboot');
const toBuf = (dataUrl) => Buffer.from(dataUrl.split(',')[1], 'base64');
const result = {};
for (const [id, spec] of Object.entries(manifest)) {
  const dir = path.join(dl, 'x', `${spec.set}_1K-JPG`);
  // data: URLs keep the canvas untainted (file:// images taint it and getImageData throws)
  const f = (k) => { const p = path.join(dir, `${spec.set}_1K-JPG_${k}.jpg`); return existsSync(p) ? `data:image/jpeg;base64,${readFileSync(p).toString('base64')}` : null; };
  const srcs = { color: f('Color'), normal: f('NormalGL'), rough: f('Roughness'), ao: f('AmbientOcclusion') };
  if (!srcs.color || !srcs.normal || !srcs.rough) { console.error('missing maps for', id, spec.set); continue; }
  const r = await page.evaluate(async ({ srcs, SIZE, mid, amp }) => {
    const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const draw = (img) => { const c = document.createElement('canvas'); c.width = c.height = SIZE; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, SIZE, SIZE); return c; };
    const [ci, ni, ri, ai] = await Promise.all([load(srcs.color), load(srcs.normal), load(srcs.rough), srcs.ao ? load(srcs.ao) : null]);
    // colour -> hue-free detail map
    const cc = draw(ci); const cx = cc.getContext('2d'); const cd = cx.getImageData(0, 0, SIZE, SIZE); const d = cd.data;
    const n = SIZE * SIZE; const lum = new Float32Array(n); let mean = 0;
    for (let i = 0; i < n; i++) { const v = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2]; lum[i] = v; mean += v; }
    mean /= n;
    let sd = 0; for (let i = 0; i < n; i++) sd += (lum[i] - mean) ** 2; sd = Math.sqrt(sd / n) || 1;
    // amplitude: map ~2 sigma of the source variation onto `amp` (the procedural sets' convention: mid +- amp)
    for (let i = 0; i < n; i++) { const v = Math.max(0, Math.min(255, mid + ((lum[i] - mean) / (2 * sd)) * amp)); d[i * 4] = v; d[i * 4 + 1] = v; d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    cx.putImageData(cd, 0, 0);
    const color = cc.toDataURL('image/webp', 0.85);
    const normal = draw(ni).toDataURL('image/jpeg', 0.92);
    // rough_ao: R = ao, G = roughness, B = 255
    const rc = draw(ri); const rd = rc.getContext('2d').getImageData(0, 0, SIZE, SIZE);
    const ad = ai ? draw(ai).getContext('2d').getImageData(0, 0, SIZE, SIZE) : null;
    const pc = document.createElement('canvas'); pc.width = pc.height = SIZE; const px = pc.getContext('2d'); const pd = px.createImageData(SIZE, SIZE);
    for (let i = 0; i < n; i++) { pd.data[i * 4] = ad ? ad.data[i * 4] : 255; pd.data[i * 4 + 1] = rd.data[i * 4]; pd.data[i * 4 + 2] = 255; pd.data[i * 4 + 3] = 255; }
    px.putImageData(pd, 0, 0);
    return { color, normal, rough_ao: pc.toDataURL('image/jpeg', 0.9), srcMean: +mean.toFixed(1), srcSd: +sd.toFixed(1), hasAo: !!ai };
  }, { srcs, SIZE, mid: spec.mid, amp: spec.amp });
  const d = path.join(out, id), sd = path.join(out, 'sets', spec.set);
  mkdirSync(d, { recursive: true }); mkdirSync(sd, { recursive: true });
  writeFileSync(path.join(d, 'color.webp'), toBuf(r.color));
  if (!existsSync(path.join(sd, 'normal.jpg'))) { writeFileSync(path.join(sd, 'normal.jpg'), toBuf(r.normal)); writeFileSync(path.join(sd, 'rough_ao.jpg'), toBuf(r.rough_ao)); }
  const sz = (p) => statSync(p).size;
  result[id] = { set: spec.set, size_px: SIZE, mid: spec.mid, amp: spec.amp, source_mean: r.srcMean, source_sd: r.srcSd, has_ao: r.hasAo, bytes: { color: sz(path.join(d, 'color.webp')), normal: sz(path.join(sd, 'normal.jpg')), rough_ao: sz(path.join(sd, 'rough_ao.jpg')) } };
  console.log(id.padEnd(18), spec.set.padEnd(14), 'color', sz(path.join(d, 'color.webp')), 'set normal', sz(path.join(sd, 'normal.jpg')), 'rough_ao', sz(path.join(sd, 'rough_ao.jpg')), 'ao', r.hasAo);
}
writeFileSync(path.join(out, 'MANIFEST.json'), JSON.stringify(result, null, 2));
await browser.close();
