import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOOK_DIALS, normalizeDial, normalizeLook, setInstallationLook } from '../src/design/look';
import { TOKENS } from '../src/design/tokens';
import {
  BUILTIN_IDS, BUILTIN_PALETTES, DEFAULTS_FOR_OPEN_QUESTIONS, MAX_CUSTOM, checkScheme, customPalettes, describeFailures, failingPairs, normalizeCustoms, paletteById, paletteTokens, resolvePalette,
  schemaErrors, setCustomPalettes, surface3Of, syncPalette, validatePalette, activePaletteTokens, type Palette,
} from '../src/design/palette';
import { contrastRatio, parseColor } from '../src/design/contrast';

// Release 0.1.156: the palette loader and validator. Node only: the palettes are data, the checks are pure functions.
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const docFile = resolve(ROOT, 'docs', 'design', 'palettes', 'palettes.json');
const DOC = JSON.parse(readFileSync(docFile, 'utf8')) as { palettes: Palette[] };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const custom = (id = 'custom-mine', base = 'calm-blue'): Palette => ({ ...clone(DOC.palettes.find((p) => p.id === base)!), id, name: { he: 'שלי', en: 'Mine' } });

test('the app copy of the ten palettes is the design asset; the ids are the dial values the backend also lists', () => {
  expect(JSON.parse(readFileSync(resolve(ROOT, 'frontend', 'src', 'design', 'palettes.json'), 'utf8'))).toEqual(JSON.parse(readFileSync(docFile, 'utf8')));
  expect(BUILTIN_IDS).toEqual(DOC.palettes.map((p) => p.id));
  expect(BUILTIN_IDS).toHaveLength(10);
  expect([...LOOK_DIALS.palette.values]).toEqual(['default', ...BUILTIN_IDS]);
  for (const p of BUILTIN_PALETTES) expect(LOOK_DIALS.palette.labelHe[p.id as keyof typeof LOOK_DIALS.palette.labelHe], p.id).toBe(p.name.he);
  const py = readFileSync(resolve(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'services', 'palettes.py'), 'utf8');
  expect([...py.match(/BUILTIN_IDS[^=]*= \(([^)]*)\)/)![1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1])).toEqual(BUILTIN_IDS);
});

test('the palette dial accepts default, the ten ids and custom-<slug>; anything else is refused', () => {
  for (const v of ['default', ...BUILTIN_IDS, 'custom-mine', 'custom-a1-b2']) expect(normalizeDial('palette', v), v).toBe(v);
  for (const v of ['', 'Default', 'ocean', 'custom', 'custom-', 'custom--a', 'custom-a-', 'custom-A', 'custom-a_b', `custom-${'a'.repeat(40)}`, 3, null, true, ['default']]) expect(normalizeDial('palette', v), String(v)).toBeNull();
  expect(normalizeLook({ palette: 'forest', density: 'row' })).toEqual({ density: 'row', palette: 'forest' });
  expect(normalizeLook({ palette: 'neon' })).toEqual({});
});

test('every ready palette is well-formed and every contrast pair passes in both schemes (1,900 pairs; 97 light + 93 dark for calm-blue)', () => {
  let total = 0;
  for (const p of BUILTIN_PALETTES) {
    expect(schemaErrors(p), p.id).toEqual([]);
    expect(validatePalette(p).ok, p.id).toBe(true);
    for (const sc of ['light', 'dark'] as const) {
      const rows = checkScheme(p.schemes[sc]);
      total += rows.length;
      expect(rows.filter((r) => !r.ok), `${p.id} ${sc}`).toEqual([]);
    }
  }
  expect(total).toBe(1900);
  expect(checkScheme(BUILTIN_PALETTES[0].schemes.light)).toHaveLength(97);
  expect(checkScheme(BUILTIN_PALETTES[0].schemes.dark)).toHaveLength(93);
});

test('the frontend checks agree with the design validator (validate_palettes.mjs): same pairs, same ratios, same verdicts', async () => {
  const mjs = await import(/* @vite-ignore */ pathToFileURL(resolve(ROOT, 'docs', 'design', 'palettes', 'validate_palettes.mjs')).href);
  const broken = custom('custom-broken');
  broken.schemes.light.textMuted = '#c8cfdc';
  broken.schemes.dark.accent = '#222222';
  for (const p of [...BUILTIN_PALETTES, broken]) {
    for (const sc of ['light', 'dark'] as const) {
      const ours = checkScheme(p.schemes[sc]);
      const ref = mjs.checkScheme(p.schemes[sc]) as { what: string; ratio: number; ok: boolean; min: number }[];
      expect(ours.map((r) => [r.what, r.ok, r.min]), `${p.id} ${sc}`).toEqual(ref.map((r) => [r.what, r.ok, r.min]));
      for (let i = 0; i < ref.length; i++) expect(Math.abs(ours[i].ratio - ref[i].ratio), `${p.id} ${sc} ${ref[i].what}`).toBeLessThanOrEqual(0.011);
    }
  }
  expect(failingPairs(broken).length).toBeGreaterThan(2);
});

test('a custom palette that fails the contrast checks is refused with a Hebrew message, never accepted into the registry', () => {
  const bad = custom();
  bad.schemes.light.textMuted = '#c8cfdc';
  const v = validatePalette(bad, { custom: true });
  expect(v.ok).toBe(false);
  if (v.ok) return;
  expect(v.message.startsWith('ערכת הצבעים נדחתה: ניגודיות נמוכה מדי')).toBe(true);
  expect(v.message).toContain('בהיר');
  expect(v.message).toContain('טקסט משני');
  expect(v.message).toContain(':1 (נדרש 4.5:1)');
  expect(v.rows.every((r) => r.ratio < r.min)).toBe(true);
  expect(describeFailures(v.rows)).toBe(v.message);
  const darkBad = custom();
  darkBad.schemes.dark.text = '#4a4f5c';
  expect(validatePalette(darkBad, { custom: true })).toMatchObject({ ok: false, message: expect.stringContaining('כהה') });
  const nonText = custom();
  nonText.schemes.light.state.danger = nonText.schemes.light.bg;
  expect(validatePalette(nonText, { custom: true })).toMatchObject({ ok: false, message: expect.stringContaining('נדרש 3:1') });
  // a failing palette is not registered (never applied); a good one is
  setCustomPalettes([bad]);
  expect(customPalettes()).toHaveLength(0);
  setCustomPalettes([custom('custom-ok'), bad, custom('custom-ok')]);
  expect(customPalettes().map((p) => p.id)).toEqual(['custom-ok']);
  setCustomPalettes(null);
});

test('malformed palettes are refused: shape, closed set, formats, ids', () => {
  const noKey = custom();
  delete (noKey.schemes.dark as unknown as Record<string, unknown>).accent;
  const extra = custom();
  (extra.schemes.light as unknown as Record<string, unknown>).unknownToken = '#000000';
  const badHex = custom();
  badHex.schemes.light.bg = 'red';
  const badOpacity = custom();
  badOpacity.schemes.dark.glass.opacity.min = 0;
  for (const p of ['x', [], {}, noKey, extra, badHex, badOpacity, { ...custom(), id: 'mine' }, { ...custom(), name: { he: 'x' } }, { ...custom(), extra: 1 }]) {
    expect(validatePalette(p, { custom: true }).ok, JSON.stringify(p)?.slice(0, 60)).toBe(false);
  }
  expect(schemaErrors(noKey).some((e) => e.includes('accent missing'))).toBe(true);
  expect(schemaErrors(extra).some((e) => e.includes('unknown token'))).toBe(true);
  expect(validatePalette(custom('calm-blue'), { custom: true }).ok).toBe(false); // a ready id is not a custom id
});

test('the list rules: unique ids, at most 12, a stored list that no longer passes is dropped', () => {
  expect(normalizeCustoms('not json')).toEqual([]);
  expect(normalizeCustoms({})).toEqual([]);
  const many = Array.from({ length: MAX_CUSTOM + 3 }, (_, i) => custom(`custom-p${i}`));
  expect(normalizeCustoms(many)).toHaveLength(MAX_CUSTOM);
  const broken = custom('custom-b');
  broken.schemes.light.text = '#dddddd';
  expect(normalizeCustoms(JSON.stringify([custom('custom-a'), broken])).map((p) => p.id)).toEqual(['custom-a']);
});

test('the token mapping: only declared tokens, the palette colours where the README says, third surface readable, ring mode', () => {
  for (const p of BUILTIN_PALETTES) {
    for (const sc of ['light', 'dark'] as const) {
      const t = paletteTokens(p, sc);
      const s = p.schemes[sc];
      for (const [n, v] of Object.entries(t)) {
        expect(TOKENS[n], `${p.id} ${sc}: ${n} is not a declared token`).toBeTruthy();
        expect(v.trim(), `${p.id} ${sc} ${n}`).not.toBe('');
      }
      expect(t['--sw-bg']).toBe(s.bg);
      expect(t['--sw-accent']).toBe(s.accent); // open question 1: dark accent keeps the palette accent
      expect(t['--sw-text-inverse']).toBe(s.accentContrast);
      expect(t['--sw-surface-solid']).toBe(s.surfaceElevated);
      expect(t['--sw-sheet-rgb']).toMatch(/^\d{1,3}, \d{1,3}, \d{1,3}$/);
      expect(t['--sw-canvas']).toBe(`linear-gradient(${s.wallpaper.angle}deg, ${s.wallpaper.stops.join(', ')})`);
      // open question 2: the ring follows the accent (every hue is the accent, the glyph is its contrast colour)
      for (let i = 1; i <= 8; i++) expect(t[`--sw-hue-${i}`]).toBe(s.accent);
      expect(contrastRatio(parseColor(t['--sw-ring-on-hue'])!, parseColor(s.accent)!), `${p.id} ${sc} ring glyph`).toBeGreaterThanOrEqual(4.5);
      // the derived third surface keeps the primary text readable
      expect(contrastRatio(parseColor(s.text)!, parseColor(surface3Of(s))!), `${p.id} ${sc} text on surface-3`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseColor(s.textMuted)!, parseColor(surface3Of(s))!), `${p.id} ${sc} muted on surface-3`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE).toBe('accent');
  expect(DEFAULTS_FOR_OPEN_QUESTIONS.OFFERED).toBeNull(); // open question 3: all ten
});

test('the resolver: default and unknown ids are the skin; a ready or registered custom id is that palette; non-bubble skins get nothing', () => {
  setCustomPalettes(null);
  setInstallationLook({ palette: 'default' });
  expect(resolvePalette()).toBeNull();
  setInstallationLook({ palette: 'forest' });
  expect(resolvePalette()?.id).toBe('forest');
  expect(activePaletteTokens('bubble', 'dark').tokens?.['--sw-bg']).toBe(paletteById('forest')!.schemes.dark.bg);
  expect(activePaletteTokens('classic', 'dark')).toEqual({ palette: null, tokens: null });
  expect(activePaletteTokens('domus', 'light').tokens).toBeNull();
  setInstallationLook({ palette: 'custom-gone' });
  expect(resolvePalette()).toBeNull(); // a deleted palette reads as default
  setCustomPalettes([custom('custom-gone')]);
  expect(resolvePalette()?.id).toBe('custom-gone');
  setInstallationLook({ palette: 'default' });
  setCustomPalettes(null);
});

test('syncPalette replaces and removes the inline custom properties it set, nothing else', () => {
  const style = new Map<string, string>([['--other', 'keep']]);
  const root = { style: { getPropertyValue: (n: string) => style.get(n) ?? '', setProperty: (n: string, v: string) => void style.set(n, v), removeProperty: (n: string) => void style.delete(n) } } as unknown as HTMLElement;
  syncPalette(root, { '--sw-bg': '#111111', '--sw-accent': '#222222' });
  expect([...style.keys()].sort()).toEqual(['--other', '--sw-accent', '--sw-bg']);
  syncPalette(root, { '--sw-bg': '#333333' });
  expect([...style.entries()].sort()).toEqual([['--other', 'keep'], ['--sw-bg', '#333333']]);
  syncPalette(root, null);
  expect([...style.keys()]).toEqual(['--other']);
});
