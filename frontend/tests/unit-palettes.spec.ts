import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { LOOK_DIALS, lookOf, normalizeDial, normalizeLook, saveOwnLook, setInstallationLook } from '../src/design/look';
import { TOKENS } from '../src/design/tokens';
import {
  BUILTIN_IDS, BUILTIN_PALETTES, DARK_ACCENT_MIN_RATIO, DEFAULTS_FOR_OPEN_QUESTIONS, MAX_CUSTOM, WASH_DEFAULT, autoFixPalette, checkScheme, customPalettes, describeFailures, effectiveScheme, failingPairs,
  mixOklab, normalizeCustoms, paletteById, paletteTokens, recommendedColors, resolvePalette, schemaErrors, setCustomPalettes, surface3Of, syncPalette, validatePalette, washRows, washShares, activePaletteTokens,
  type Palette,
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
  // the backend reads its ids from its own copy of the file (adding a palette is a data-only change)
  expect(JSON.parse(readFileSync(resolve(ROOT, 'smplwise_vms', 'backend', 'smplwise', 'palettes.json'), 'utf8'))).toEqual(JSON.parse(readFileSync(docFile, 'utf8')));
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

test('a custom palette that fails the contrast checks only WARNS (Hebrew, worst pairs): it is valid, listed and saveable (owner 2026-10-02)', () => {
  const bad = custom();
  bad.schemes.light.textMuted = '#c8cfdc';
  const v = validatePalette(bad, { custom: true });
  expect(v.ok).toBe(true); // no refusal
  if (!v.ok) return;
  expect(v.rows.length).toBeGreaterThan(0);
  expect(v.warning.startsWith('אזהרה: ניגודיות נמוכה מדי')).toBe(true);
  expect(v.warning).toContain('בהיר');
  expect(v.warning).toContain('טקסט משני');
  expect(v.warning).toContain(':1 (נדרש 4.5:1)');
  expect(v.rows.every((r) => r.ratio < r.min)).toBe(true);
  expect(describeFailures(v.rows)).toBe(v.warning);
  const darkBad = custom();
  darkBad.schemes.dark.text = '#4a4f5c';
  expect(validatePalette(darkBad, { custom: true })).toMatchObject({ ok: true, warning: expect.stringContaining('כהה') });
  const nonText = custom();
  nonText.schemes.light.state.danger = nonText.schemes.light.bg;
  expect(validatePalette(nonText, { custom: true })).toMatchObject({ ok: true, warning: expect.stringContaining('נדרש 3:1') });
  // a passing palette has no warning
  expect(validatePalette(custom(), { custom: true })).toMatchObject({ ok: true, rows: [], warning: '' });
  // a low-contrast palette IS registered (and so can be applied); a structurally broken one is not
  setCustomPalettes([bad]);
  expect(customPalettes().map((p) => p.id)).toEqual(['custom-mine']);
  const broken = custom('custom-broken');
  delete (broken.schemes.dark as unknown as Record<string, unknown>).accent;
  setCustomPalettes([custom('custom-ok'), bad, broken, custom('custom-ok')]);
  expect(customPalettes().map((p) => p.id)).toEqual(['custom-ok', 'custom-mine']);
  setCustomPalettes(null);
});

test('auto-fix: the failing foreground colours move to the nearest passing values, backgrounds stay; the result passes', () => {
  const bad = custom();
  bad.schemes.light.textMuted = '#c8cfdc';
  bad.schemes.dark.text = '#4a4f5c';
  bad.schemes.light.state.danger = bad.schemes.light.bg;
  const before = failingPairs(bad);
  expect(before.length).toBeGreaterThan(3);
  const r = autoFixPalette(bad);
  expect(r.remaining).toEqual([]);
  expect(failingPairs(r.palette)).toEqual([]);
  expect(r.changed).toEqual(expect.arrayContaining(['dark.text', 'light.state.danger', 'light.textMuted']));
  expect(r.changed.every((c) => /\.(text|textMuted|accent\w*|state\.\w+|gradient\.text|slider\.\w+|entity\.\w+)$/.test(c)), r.changed.join()).toBe(true); // only foreground colours
  for (const sc of ['light', 'dark'] as const) for (const k of ['bg', 'surface', 'surface2', 'surfaceElevated'] as const) expect(r.palette.schemes[sc][k], `${sc} ${k}`).toBe(bad.schemes[sc][k]); // backgrounds untouched
  expect(bad.schemes.light.textMuted).toBe('#c8cfdc'); // the input is not mutated
  // the nearest passing value: barely moved, not slammed to black
  const dist = (a: string, b: string) => [1, 3, 5].reduce((s, i) => s + Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)), 0);
  expect(dist(r.palette.schemes.light.textMuted, bad.schemes.light.textMuted)).toBeLessThan(400);
  expect(r.palette.schemes.light.textMuted).not.toBe('#000000');
  // a palette that already passes is returned unchanged
  const ok = autoFixPalette(custom());
  expect(ok.changed).toEqual([]);
  expect(ok.palette).toEqual(custom());
  // it also repairs a palette whose accent pair is broken in both schemes
  const worse = custom();
  worse.schemes.light.accentContrast = worse.schemes.light.accent;
  worse.schemes.dark.accentText = worse.schemes.dark.bg;
  const fixed = autoFixPalette(worse);
  expect(failingPairs(fixed.palette)).toEqual([]);
});

test('the dark accent is a LIGHTER shade than the light accent: the ready palettes already are, a darker custom one is lifted in code', () => {
  const lum = (h: string) => {
    const c = parseColor(h)!;
    return [c[0], c[1], c[2]].reduce((s, v, i) => s + ((v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i]), 0);
  };
  for (const p of BUILTIN_PALETTES) {
    const eff = effectiveScheme(p, 'dark');
    expect(eff, `${p.id} keeps its own dark scheme`).toBe(p.schemes.dark);
    expect(contrastRatio(parseColor(eff.accent)!, parseColor(p.schemes.light.accent)!), p.id).toBeGreaterThanOrEqual(DARK_ACCENT_MIN_RATIO);
    expect(lum(eff.accent)).toBeGreaterThan(lum(p.schemes.light.accent));
  }
  expect(effectiveScheme(BUILTIN_PALETTES[0], 'light')).toBe(BUILTIN_PALETTES[0].schemes.light);
  for (const bad of ['#10204a', '#2767ed', '#0b57d0', '#000000', '#1a1a1a']) {
    const p = custom();
    p.schemes.dark.accent = bad;
    p.schemes.dark.state.on = bad;
    const eff = effectiveScheme(p, 'dark');
    expect(eff.accent, bad).not.toBe(bad);
    expect(lum(eff.accent), bad).toBeGreaterThan(lum(p.schemes.light.accent));
    expect(contrastRatio(parseColor(eff.accent)!, parseColor(p.schemes.light.accent)!), bad).toBeGreaterThanOrEqual(DARK_ACCENT_MIN_RATIO);
    // non-text contrast against the dark backgrounds and the text on it
    expect(contrastRatio(parseColor(eff.accent)!, parseColor(p.schemes.dark.bg)!), `${bad} vs bg`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseColor(eff.accent)!, parseColor(p.schemes.dark.surface)!), `${bad} vs surface`).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(parseColor(eff.accentContrast)!, parseColor(eff.accent)!), `${bad} text on accent`).toBeGreaterThanOrEqual(4.5);
    expect(eff.state.on, `${bad} the toggle follows the accent`).toBe(eff.accent);
    // the tokens use it; the stored palette is not mutated
    expect(paletteTokens(p, 'dark')['--sw-accent']).toBe(eff.accent);
    expect(paletteTokens(p, 'dark')['--sw-text-inverse']).toBe(eff.accentContrast);
    expect(paletteTokens(p, 'light')['--sw-accent']).toBe(p.schemes.light.accent);
    expect(p.schemes.dark.accent).toBe(bad);
    // the checks look at what is applied: the lifted accent passes its own pairs
    expect(checkScheme(eff).filter((r) => r.group === 'accent' && !r.ok)).toEqual([]);
  }
});

test('the gradient washes keep the text readable: text and muted text on both ends of the wash, on-fill text on the lit part (every palette, both schemes)', () => {
  expect(WASH_DEFAULT).toEqual({ start: 40, end: 24, lit: 70 }); // what sw-pill draws without a palette
  let checked = 0;
  let reduced = 0;
  for (const p of BUILTIN_PALETTES) {
    for (const sc of ['light', 'dark'] as const) {
      const s = effectiveScheme(p, sc);
      const rows = washRows(s);
      expect(rows, `${p.id} ${sc}`).toHaveLength(5);
      for (const r of rows) {
        expect(r.ok, `${p.id} ${sc} ${r.what} = ${r.ratio}`).toBe(true);
        expect(r.ratio, `${p.id} ${sc} ${r.what}`).toBeGreaterThanOrEqual(4.5);
      }
      // independent computation of one pair from the token the page gets (the CSS mixes in OKLab with the same percentages)
      const t = paletteTokens(p, sc);
      const start = Number.parseInt(t['--sw-wash-start'], 10);
      const lit = Number.parseInt(t['--sw-wash-lit'], 10);
      expect(t['--sw-wash-start']).toMatch(/^\d+%$/);
      expect(start, `${p.id} ${sc}`).toBeLessThanOrEqual(WASH_DEFAULT.start);
      expect(start, `${p.id} ${sc} the wash stays visible`).toBeGreaterThanOrEqual(20);
      expect(lit, `${p.id} ${sc} the lit part keeps its tint`).toBeGreaterThanOrEqual(30);
      const wash = mixOklab(parseColor(s.accent)!, parseColor(s.surface)!, start);
      expect(contrastRatio(parseColor(s.textMuted)!, wash), `${p.id} ${sc} muted on the wash`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseColor(s.text)!, wash), `${p.id} ${sc} text on the wash`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(parseColor(s.slider.onFill)!, mixOklab(parseColor(s.accent)!, [255, 255, 255, 1], lit)), `${p.id} ${sc} on-fill on the lit part`).toBeGreaterThanOrEqual(4.5);
      if (start < WASH_DEFAULT.start || lit < WASH_DEFAULT.lit) reduced++;
      checked += rows.length;
    }
  }
  expect(checked).toBe(10 * 2 * 5);
  expect(reduced).toBeGreaterThan(0); // at the default shares some palettes did NOT pass (muted text on a 40 % accent wash): the shares are what fixes them
  // the defaults alone would have failed somewhere (that is why the tokens exist): muted text on the 40 % wash of some palette
  let defaultsFail = 0;
  for (const p of BUILTIN_PALETTES) {
    for (const sc of ['light', 'dark'] as const) {
      const s = p.schemes[sc];
      const w = mixOklab(parseColor(s.accent)!, parseColor(s.surface)!, WASH_DEFAULT.start);
      if (contrastRatio(parseColor(s.textMuted)!, w) < 4.5) defaultsFail++;
    }
  }
  expect(defaultsFail).toBeGreaterThan(0);
  // a custom palette gets its own shares; a pathological one (muted text equal to the accent) ends at the plain surface
  const p = custom();
  p.schemes.light.accent = '#000000';
  p.schemes.light.textMuted = '#595959';
  const shares = washShares(p.schemes.light);
  expect(shares.start).toBeLessThan(WASH_DEFAULT.start);
  expect(washRows(p.schemes.light).every((r) => r.ok)).toBe(true);
});

test('recommended colours for the editor come from the ready palettes: unique, #rrggbb, the accent offers at least five', () => {
  for (const sc of ['light', 'dark'] as const) {
    const acc = recommendedColors('accent', sc);
    expect(acc.length).toBeGreaterThanOrEqual(5);
    expect(acc.length).toBeLessThanOrEqual(10);
    expect(new Set(acc).size).toBe(acc.length);
    for (const h of acc) expect(h).toMatch(/^#[0-9a-f]{6}$/);
    expect(acc[0]).toBe(BUILTIN_PALETTES[0].schemes[sc].accent.toLowerCase()); // the file's order
    expect(recommendedColors('bg', sc, 3)).toHaveLength(3);
  }
});

test('only the installation chooses the palette: a personal override is never read, the other dials still are', async () => {
  setCustomPalettes(null);
  setInstallationLook({ palette: 'forest', density: 'regular' });
  await saveOwnLook({ palette: 'sunset', density: 'compact' } as never);
  expect(lookOf('palette')).toBe('forest'); // the installation's, not the personal one
  expect(lookOf('density')).toBe('compact'); // personal override of another dial untouched
  expect(resolvePalette()?.id).toBe('forest');
  await saveOwnLook({});
  setInstallationLook({ palette: 'default' });
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

test('the list rules: unique ids, at most 12, a stored low-contrast palette is kept, a structurally broken one is dropped', () => {
  expect(normalizeCustoms('not json')).toEqual([]);
  expect(normalizeCustoms({})).toEqual([]);
  const many = Array.from({ length: MAX_CUSTOM + 3 }, (_, i) => custom(`custom-p${i}`));
  expect(normalizeCustoms(many)).toHaveLength(MAX_CUSTOM);
  const low = custom('custom-b');
  low.schemes.light.text = '#dddddd';
  expect(normalizeCustoms(JSON.stringify([custom('custom-a'), low])).map((p) => p.id)).toEqual(['custom-a', 'custom-b']);
  const broken = custom('custom-c');
  delete (broken.schemes.light as unknown as Record<string, unknown>).accent;
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
      expect(t['--sw-accent']).toBe(effectiveScheme(p, sc).accent); // the dark accent is derived (lighter than the light one); the ready ones already are
      expect(t['--sw-accent']).toBe(s.accent);
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

test("the 'pairs' ring mode (per-entity-type hues) is kept as a documented future option: switching it takes the ring hues from the gradient pairs, and the ring glyph still reads", () => {
  const was = DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE;
  try {
    DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE = 'pairs';
    for (const p of BUILTIN_PALETTES) {
      for (const sc of ['light', 'dark'] as const) {
        const t = paletteTokens(p, sc);
        const s = p.schemes[sc];
        for (let i = 1; i <= 8; i++) expect(t[`--sw-hue-${i}`]).toBe(s.gradient.pairs[(i - 1) % s.gradient.pairs.length][0]);
        expect(t['--sw-ring-on-hue']).toBe(s.gradient.text);
      }
    }
  } finally {
    DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE = was;
  }
  expect(DEFAULTS_FOR_OPEN_QUESTIONS.RING_MODE).toBe('accent');
});
