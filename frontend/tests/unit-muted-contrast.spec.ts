import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';
import { DEVICE_PALETTES } from '../src/styles/devices-palettes';

/**
 * UXFIX-A11Y-295 (UX audit 2026-10-20, finding 5): muted text measured 2.7-3.0:1 on almost every screen (classic light: --sw-text-3
 * #8a97ae on the page background, the phone bottom bar's labels, the `.sub` subtitles). The fix is in the token table, so the guard is
 * computed from the tokens, for every skin x scheme, on every bed muted text is drawn on:
 *   - the opaque beds: the page background and the two solid surfaces;
 *   - the translucent surfaces and the nav glass composited over the page background;
 *   - the chip / hover fill (--sw-surface-3) over the solid surface (not in bubble: there it is the slider track / pressed fill,
 *     never a text bed; the bubble palettes carry their own contrast rows in design/palette.ts);
 *   - a skin whose canvas carries colour blooms (domus): the glass card over each bloom, and the bare canvas at each bloom's centre (a
 *     page title or an empty state drawn straight on it), at the bloom's FULL alpha on each canvas stop.
 * The glass device screens (--dv-text-2 / --dv-text-3 of every device palette, light and dark) are checked on their own beds.
 * Threshold: WCAG 2.x 4.5:1 for small text (the muted tiers are 10.5-12.5 px).
 */

const MIN = 4.5;
const MUTED = ['--sw-text-2', '--sw-text-3', '--sw-offline-text', '--sw-unknown-text', '--sw-success-text', '--sw-accent-text'];

const colours = (s: string): RGBA[] => (s.match(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b|rgba?\([^)]*\)/gi) ?? []).map((c) => parseColor(c)).filter((c): c is RGBA => !!c);

function skinBeds(id: string, mode: 'light' | 'dark'): { v: (n: string) => string; beds: Record<string, RGBA> } {
  const t = skinTable(id as (typeof SKIN_IDS)[number]);
  const v = (n: string) => t[n][mode];
  const P = (n: string) => {
    const c = parseColor(v(n));
    if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${v(n)}`);
    return c;
  };
  const bg = P('--sw-bg');
  const solid = P('--sw-surface-solid');
  const beds: Record<string, RGBA> = { bg, 'surface-solid': solid, 'surface-2-solid': P('--sw-surface-2-solid') };
  for (const n of ['--sw-surface', '--sw-surface-2', '--sw-nav-glass']) beds[`${n.slice(5)} over bg`] = over(P(n), bg);
  if (id !== 'bubble') beds['surface-3 over surface-solid'] = over(P('--sw-surface-3'), solid);
  const canvas = colours(v('--sw-canvas'));
  const stops = canvas.filter((c) => c[3] >= 1);
  const blooms = canvas.filter((c) => c[3] < 1 && !(c[0] === 255 && c[1] === 255 && c[2] === 255)); // a white bloom only lightens
  stops.forEach((s, i) =>
    blooms.forEach((b, j) => {
      beds[`surface over bloom ${j + 1} on stop ${i + 1}`] = over(P('--sw-surface'), over(b, s));
      // owner 2026-10-20 (option A): text drawn straight on the canvas (a page title, an empty state) at a bloom's centre, full alpha
      beds[`canvas: bloom ${j + 1} on stop ${i + 1}`] = over(b, s);
    }),
  );
  return { v, beds };
}

test('muted text tokens read at >= 4.5:1 on every bed, every skin, both schemes (classic light was 2.75:1)', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      const { v, beds } = skinBeds(id, mode);
      for (const n of MUTED) {
        const fg = parseColor(v(n))!;
        let worst = Infinity;
        let where = '';
        for (const [bed, b] of Object.entries(beds)) {
          const r = contrastRatio(over(fg, b), b);
          if (r < worst) [worst, where] = [r, bed];
        }
        rows.push(`${id}/${mode} ${n} ${v(n)}: ${worst.toFixed(2)} (${where})`);
        if (worst < MIN) fails.push(rows[rows.length - 1]);
      }
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('glass device palettes: --dv-text-2 and --dv-text-3 read at >= 4.5:1 on the glass surfaces, the solids and the backdrop, light and dark', () => {
  const themes = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'devices-themes.ts'), 'utf8');
  // the "default" palette lives as CSS in devices-themes.ts: the light base block and the explicit dark block
  const block = (marker: string): Record<string, string> => {
    const at = themes.indexOf(marker);
    expect(at, marker).toBeGreaterThan(-1);
    const body = themes.slice(themes.indexOf('{', at) + 1, themes.indexOf('\n  }', at));
    return Object.fromEntries([...body.matchAll(/(--dv-[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  };
  const defLight = block(`palette "default" (the approved mockup)`);
  const defDark = { ...defLight, ...block(`[data-devices-theme='default'][data-devices-scheme='dark']`) };
  const sets: [string, Record<string, string>][] = [
    ['default/light', defLight],
    ['default/dark', defDark],
  ];
  for (const p of DEVICE_PALETTES) {
    if (p.light.knobs) sets.push([`${p.id}/light`, p.light.knobs]);
    if (p.dark.knobs) sets.push([`${p.id}/dark`, p.dark.knobs]);
  }
  expect(sets.length).toBeGreaterThanOrEqual(8);
  const rows: string[] = [];
  const fails: string[] = [];
  for (const [label, k] of sets) {
    const back = colours(k['--dv-backdrop']);
    const stops = back.filter((c) => c[3] >= 1);
    const blooms = back.filter((c) => c[3] < 1);
    const surf = parseColor(k['--dv-surface'])!;
    const surf2 = parseColor(k['--dv-surface-2'])!;
    const beds: Record<string, RGBA> = { 'surface-solid': parseColor(k['--dv-surface-solid'])!, 'surface-2-solid': parseColor(k['--dv-surface-2-solid'])! };
    stops.forEach((s, i) => {
      beds[`backdrop stop ${i + 1}`] = s;
      beds[`surface on stop ${i + 1}`] = over(surf, s);
      beds[`surface-2 on stop ${i + 1}`] = over(surf2, s);
      blooms.forEach((b, j) => (beds[`surface on bloom ${j + 1} / stop ${i + 1}`] = over(surf, over(b, s))));
    });
    for (const n of ['--dv-text-2', '--dv-text-3']) {
      const fg = parseColor(k[n])!;
      let worst = Infinity;
      let where = '';
      for (const [bed, b] of Object.entries(beds)) {
        const r = contrastRatio(over(fg, b), b);
        if (r < worst) [worst, where] = [r, bed];
      }
      rows.push(`${label} ${n} ${k[n]}: ${worst.toFixed(2)} (${where})`);
      if (worst < MIN) fails.push(rows[rows.length - 1]);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});
