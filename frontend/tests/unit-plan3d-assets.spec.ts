import { test, expect } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATERIALS } from '../src/map/material-resolve';
import { MODEL_FILES, MODEL_MAP, textureUrls } from '../src/map/plan3d-assets';
import { boxUv, creaseNormals, faceNormals, fitModel, jitter, readGlb } from '../src/map/mesh-utils';
import { asMode, autoStart, drawnRung, nextDown, probeVerdict, rungLevel } from '../src/map/quality-ladder';
import { LOOK_STYLES, bloomFor, daylightFactor, styleFor } from '../src/map/look-style';

// CR-029 S1 (section 6.1 / 8): the asset manifest against the files on disk (every file has a row, every row a file,
// the hashes match, only CC0), the material library's file sets, the model map, the pure geometry helpers (box UVs,
// creased normals, the GLB reader on the real kit files, the model fit) and the quality ladder's rules - including the
// owner's 2026-10-10 rule that a chosen mode is never lowered by the probe. Node only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, '..', 'public');
const DIR = path.join(PUB, 'plan3d');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'MANIFEST.json'), 'utf8')) as { allowed_licences: string[]; files: { path: string; bytes: number; sha256: string; licence: string; kind: string; source_url: string; author: string; source_sha256: string; processing: string }[] };
const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const ab = (file: string): ArrayBuffer => { const b = fs.readFileSync(file); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

test('every asset file has a manifest row with an allowed licence, a source and a matching sha256 - and every row has its file', () => {
  expect(manifest.allowed_licences).toEqual(['CC0-1.0']);
  const files = walk(DIR).map((f) => path.relative(DIR, f).split(path.sep).join('/')).filter((f) => f !== 'MANIFEST.json').sort();
  const rows = new Map(manifest.files.map((r) => [r.path, r]));
  expect(files.filter((f) => !rows.has(f)), 'files without a row').toEqual([]);
  expect([...rows.keys()].filter((p) => !files.includes(p)), 'rows without a file').toEqual([]);
  let total = 0;
  for (const f of files) {
    const r = rows.get(f)!;
    const buf = fs.readFileSync(path.join(DIR, f));
    total += buf.length;
    expect(r.licence, f).toBe('CC0-1.0');
    expect(r.bytes, f).toBe(buf.length);
    expect(r.sha256, f).toBe(crypto.createHash('sha256').update(buf).digest('hex'));
    expect(r.source_url, f).toMatch(/^https:\/\/(ambientcg\.com|kenney\.nl)\//);
    expect(r.author, f).toBeTruthy();
    expect(r.source_sha256, f).toMatch(/^[0-9a-f]{64}$/);
    expect(r.processing, f).toBeTruthy();
  }
  console.log(`plan3d assets: ${files.length} files, ${total} bytes`);
  expect(total).toBeLessThan(4 * 1024 * 1024); // the CR budget: ~3 MB of textures + ~0.4 MB of models
});

test('every library material with a source set resolves to files that exist; the plain ceiling has none', () => {
  for (const m of MATERIALS) {
    const urls = textureUrls(m.id);
    if (!m.set) {
      expect(urls, m.id).toBeNull();
      continue;
    }
    for (const u of Object.values(urls!)) expect(fs.existsSync(path.join(PUB, u)), `${m.id}: ${u}`).toBe(true);
  }
  expect(textureUrls('plaster_ceiling')).toBeNull();
  expect(textureUrls('no_such_id')).toBeNull();
});

test('the model map names shipped files and library materials only; every shipped model reads, sits on the floor and fits', () => {
  const ids = new Set(MATERIALS.map((m) => m.id));
  for (const [item, e] of Object.entries(MODEL_MAP)) {
    expect(MODEL_FILES, item).toContain(e.file);
    for (const mid of [...Object.values(e.slots), e.fallback]) expect(ids.has(mid), `${item}: ${mid}`).toBe(true);
  }
  for (const f of MODEL_FILES) {
    const file = path.join(DIR, 'models', f);
    expect(fs.existsSync(file), f).toBe(true);
    const m = readGlb(ab(file));
    const tris = m.primitives.reduce((n, p) => n + p.positions.length / 9, 0);
    expect(tris, f).toBeGreaterThan(20);
    expect(tris, f).toBeLessThan(2000); // CR-029 section 6.3: <= 2,000 triangles per item
    expect(m.primitives.every((p) => typeof p.material === 'string'), f).toBe(true);
    const fit = fitModel(m.min, m.max, 1, 1, 1);
    expect(fit.scale.every((s) => s > 0), f).toBe(true);
  }
  // the same file read twice gives the same soup
  const a = readGlb(ab(path.join(DIR, 'models', 'chair.glb')));
  const b = readGlb(ab(path.join(DIR, 'models', 'chair.glb')));
  expect(Array.from(a.primitives[0].positions)).toEqual(Array.from(b.primitives[0].positions));
});

test('box UVs are in metres over the tile, by the dominant normal axis, deterministic', () => {
  // a wall face at x = 3 (normal along x): u = z, v = y
  const wall = [3, 0, 0, 3, 0, 2, 3, 2.4, 2];
  expect(Array.from(boxUv(wall, 2)).map((v) => Math.round(v * 1e5) / 1e5)).toEqual([0, 0, 1, 0, 1, 1.2]);
  // a floor triangle (normal along y): u = x, v = z
  const floor = [0, 0, 0, 0, 0, 1.2, 1.2, 0, 0];
  expect(Array.from(boxUv(floor, 1.2))).toEqual([0, 0, 0, 1, 1, 0]);
  expect(Array.from(boxUv(wall, 2))).toEqual(Array.from(boxUv(wall, 2)));
});

test('creased normals: a cube keeps its crisp faces, a shallow fold is smoothed', () => {
  // two triangles meeting at 10 deg share a smoothed normal; at 90 deg they stay flat
  const fold = (deg: number) => { const r = (deg * Math.PI) / 180; return [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, -Math.cos(r), Math.sin(r), 0]; };
  const flat = faceNormals(fold(90));
  const creased90 = creaseNormals(fold(90), (35 * Math.PI) / 180);
  expect(Array.from(creased90)).toEqual(Array.from(flat));
  const creased10 = creaseNormals(fold(10), (35 * Math.PI) / 180);
  expect(Array.from(creased10.slice(0, 3))).not.toEqual(Array.from(faceNormals(fold(10)).slice(0, 3)));
  expect(jitter(1, 2)).toBe(jitter(1, 2));
  expect(Math.abs(jitter(3.3, 7.1) - 1)).toBeLessThanOrEqual(0.05);
});

test('the quality ladder: a chosen mode sticks (the probe only hints), auto falls one rung at a time and never rises above its start', () => {
  expect(rungLevel('realistic')).toBe(3);
  expect(rungLevel('lite')).toBe(3);
  expect(rungLevel('full')).toBe(2);
  expect(rungLevel('schematic')).toBe(1);
  expect([nextDown('realistic'), nextDown('lite'), nextDown('full'), nextDown('schematic')]).toEqual(['lite', 'full', 'schematic', null]);
  expect([asMode('1'), asMode('2'), asMode('auto'), asMode('lite'), asMode('x')]).toEqual(['schematic', 'full', 'auto', 'lite', null]);
  // owner 2026-10-10: "מלא" chosen and slow -> stays "מלא", the hint offers schematic
  expect(probeVerdict('full', 'full', 12)).toEqual({ fallback: null, hint: 'schematic' });
  expect(drawnRung('full', 'full', 'schematic')).toBe('full');
  // auto: falls one rung
  expect(probeVerdict('auto', 'realistic', 12)).toEqual({ fallback: 'lite', hint: null });
  expect(drawnRung('auto', 'realistic', 'lite')).toBe('lite');
  expect(drawnRung('auto', 'full', 'lite')).toBe('full'); // a stored fallback above the start is ignored
  expect(probeVerdict('auto', 'full', 45)).toEqual({ fallback: null, hint: null });
  expect(probeVerdict('auto', 'schematic', 3)).toEqual({ fallback: null, hint: null });
  expect(autoStart('realistic', 1)).toBe('realistic');
  expect(autoStart('schematic', 2)).toBe('full');
  expect(autoStart('schematic', null)).toBe('schematic');
});

test('the two styles: auto follows the theme, bloom moves with the night, the daylight factor is clamped', () => {
  expect(styleFor('auto', 'dark')).toBe('dark');
  expect(styleFor('light', 'dark')).toBe('light');
  expect(bloomFor(LOOK_STYLES.light, 0).threshold).toBe(2.0);
  expect(bloomFor(LOOK_STYLES.light, 1).threshold).toBeCloseTo(1.6, 9);
  expect(bloomFor(LOOK_STYLES.dark, 0.5).strength).toBeCloseTo(0.41, 9);
  expect(daylightFactor(4, 20)).toBe(1);
  expect(daylightFactor(1, 20)).toBe(0.25);
  expect(daylightFactor(0, 0)).toBe(0);
});
