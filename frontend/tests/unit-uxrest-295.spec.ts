import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// UXREST-295 (UX audit leftovers): the contrast pairs the dark / light audit found below 4.5:1, kept honest at the token level.

test('count badge: the text on the badge fill reads at >= 4.5:1 in every skin and both schemes', () => {
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const mode of ['light', 'dark'] as const) {
      const bg = parseColor(t['--sw-badge-bg'][mode]) as RGBA;
      const fg = parseColor(t['--sw-badge-fg'][mode]) as RGBA;
      const r = contrastRatio(over(fg, bg), bg);
      if (r < 4.5) fails.push(`${id}/${mode} badge ${r.toFixed(2)}`);
    }
  }
  expect(fails).toEqual([]);
});

test('glass dark: the tertiary text keeps >= 4.5:1 on the dark glass surfaces the audit measured', () => {
  const css = readFileSync('src/styles/devices-themes.ts', 'utf8');
  const m = /--dv-text-3: rgba\(235, 235, 245, ([0-9.]+)\);/.exec(css);
  expect(m, 'the dark --dv-text-3 value').toBeTruthy();
  const a = Number(m![1]);
  for (const solid of ['#1c1c1e', '#2c2c2e', '#35373d']) {
    const back = parseColor(solid) as RGBA;
    const r = contrastRatio(over([235, 235, 245, a], back), back);
    expect(r, `dv-text-3 on ${solid}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('the area summary menu draws the brand focus ring (a fill change alone is not a focus indicator)', () => {
  const src = readFileSync('src/screens/devices-bulk.ts', 'utf8');
  for (const sel of ['.more:focus-visible', 'button.item:focus-visible', 'a.open:focus-visible']) expect(src, sel).toContain(sel);
  expect(src).toMatch(/\.more:focus-visible,\s*button\.item:focus-visible,\s*a\.open:focus-visible \{\s*outline: var\(--sw-focus-w, 2px\) solid var\(--sw-focus\);/);
  expect(src).not.toMatch(/:focus-visible \{[^}]*outline: none/);
});

test('selected chip count and the state panel: no 80 % mix on the accent fill, no machine code as a hint', () => {
  expect(readFileSync('src/components/sw-chip.ts', 'utf8')).not.toMatch(/selected\] \.count \{\s*color: color-mix/);
  const panel = readFileSync('src/components/sw-state-panel.ts', 'utf8');
  expect(panel).toContain('rawCode');
});
