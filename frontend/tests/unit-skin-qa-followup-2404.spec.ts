import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// SKIN-QA-FOLLOWUP-2404 (owner round 22): the token model of the two shared fixes and source guards of the narrow-tile chip. Node only.
//   Q5 = a: the filled success badge (sw-badge filled kind="live") draws --sw-on-success on --sw-success: >= 4.5:1 in every skin, light and dark.
//   Q6 = a: the classic primary key (and the selected chip) - its top no longer mixes in a fixed white but the skin's highlight; the label
//           (--sw-text-inverse) reads >= 4.5:1 on the top and the bottom of the gradient, light and dark; light is the same colour as before.
//   Q4: the chip of a tile narrower than 160 px (sw-live-player data-subchip) and the room the tile keeps for it.
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const C = (v: string) => parseColor(v) as RGBA;

/** color-mix(in srgb, a p%, b) - premultiplied, as the browser mixes (the result may be translucent). */
function mix(a: RGBA, p: number, b: RGBA): RGBA {
  const wa = a[3] * p;
  const wb = b[3] * (1 - p);
  const al = wa + wb;
  return [0, 1, 2].map((i) => (a[i] * wa + b[i] * wb) / al).concat(al) as RGBA;
}

test('Q5: --sw-on-success reads >= 4.5:1 on --sw-success in every skin, light and dark', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const scheme of ['light', 'dark'] as const) {
      const fill = over(C(t['--sw-success'][scheme]), [255, 255, 255, 1]);
      const r = contrastRatio(over(C(t['--sw-on-success'][scheme]), fill), fill);
      const white = contrastRatio([255, 255, 255, 1], fill);
      rows.push(`${id}/${scheme} ${r.toFixed(2)} (white was ${white.toFixed(2)})`);
      if (!(r >= 4.5)) fails.push(`${id} ${scheme} ${r.toFixed(2)}`);
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('Q5: the filled live badge takes the ink; a device palette picks dark or white by contrast', () => {
  expect(read('components/sw-badge.ts')).toMatch(/:host\(\[filled\]\[kind='live'\]\) \{\s*background: var\(--sw-success\);[^}]*color: var\(--sw-on-success\);/);
  expect(read('design/palette.ts')).toContain("t['--sw-on-success'] = ratio([4, 20, 11, 1], success) >= ratio([255, 255, 255, 1], success) ? '#04140b' : '#ffffff';");
});

test('Q6: the classic primary key - its label reads >= 4.5:1 where it sits (30-70 % of the key), light and dark; dark also at the top edge; light unchanged', () => {
  const rules = read('design/skins/classic.ts');
  expect(rules).toContain("background: linear-gradient(180deg, color-mix(in srgb, var(--sw-accent) 86%, var(--sw-highlight)), var(--sw-accent-hover)) var(--sw-accent-hover);");
  expect(rules).not.toContain('var(--sw-accent) 86%, #ffffff'); // the sign-in key (classic 12) follows too
  const t = skinTable('classic');
  const rows: string[] = [];
  const lerp = (a: RGBA, b: RGBA, f: number): RGBA => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * f).concat(1) as RGBA;
  for (const scheme of ['light', 'dark'] as const) {
    const accent = C(t['--sw-accent'][scheme]);
    const hover = C(t['--sw-accent-hover'][scheme]);
    const ink = C(t['--sw-text-inverse'][scheme]);
    const top = over(mix(accent, 0.86, C(t['--sw-highlight'][scheme])), hover);
    const before = over(mix(accent, 0.86, [255, 255, 255, 1]), hover);
    const at = (topColor: RGBA, f: number) => contrastRatio(ink, lerp(topColor, hover, f));
    const label = Math.min(at(top, 0.3), at(top, 0.5), at(top, 0.7));
    const labelBefore = Math.min(at(before, 0.3), at(before, 0.5), at(before, 0.7));
    rows.push(`classic/${scheme}: label ${label.toFixed(2)} (was ${labelBefore.toFixed(2)}), top edge ${at(top, 0).toFixed(2)} (was ${at(before, 0).toFixed(2)}), bottom ${at(top, 1).toFixed(2)}`);
    expect(label, `${scheme}: under the label`).toBeGreaterThanOrEqual(4.5);
    if (scheme === 'dark') expect(at(top, 0), 'dark: even the top edge').toBeGreaterThanOrEqual(4.5);
    if (scheme === 'light') expect(top.map(Math.round)).toEqual(before.map(Math.round));
  }
  console.log(rows.join('\n'));
});

test('Q4: the chip of a narrow tile - drawn, never hidden; the tile keeps the name clear of it', () => {
  const p = read('components/sw-live-player.ts');
  expect(p).toContain('export const SUB_CHIP_MAX = 160;');
  expect(p).toContain(':host([data-subchip]) .subtag,');
  expect(p).toContain("this.toggleAttribute('data-subchip', this.subChip);");
  expect(p).toContain('<sw-icon class="subico" name="arrowUp"');
  expect(p).toContain('data-sub-fallback-hint');
  // the 2403 rule that hid the tag under 160 px is gone (owner round 22: the fallback stays visible)
  expect(p).not.toMatch(/\.vbadge ~ \.subtag \{\s*display: none;/);
  expect(read('components/sw-camera-tile.ts')).toMatch(/sw-live-player\[data-subchip\] ~ \.foot \{\s*padding-inline-end: 22px;/);
});
