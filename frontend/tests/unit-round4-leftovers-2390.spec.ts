import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { axisFit } from '../src/calendars/rooms-axis';
import { rowsThatFit } from '../src/calendars/model';
import { SKIN_IDS, FROZEN_SKINS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// ROUND4-LEFTOVERS-2390 (polish round 4 leftovers: the WisKey area WP9 and calendars D22): the pure axis rule of the rooms timeline, the
// manage list's page measure, the contrast of the ringing pill, and source guards for the hover / press / touch rules. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-round4-leftovers-2390.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const flat = (f: string) => read(f).replace(/\s+/g, ' ');

/** The 10:40 of the calendars demo on the desktop window (07:00-23:00, 16 hours). */
const NOW_1040 = ((10 * 60 + 40 - 7 * 60) / (16 * 60)) * 100;

test.describe('D22: the rooms timeline keeps the hour labels clear of the now pill', () => {
  test('before the axis is measured the old share rule applies, and the pill is centred by percent', () => {
    const f = axisFit({ nowPct: NOW_1040, hours: 16, axisPx: 0, pillPx: 0, labelPx: 0, fallbackPct: 3 });
    expect(f.pillLeftPx).toBeNull();
    expect([...f.hidden]).toEqual([4]); // 11:00 only (3 % of the axis is 29 minutes)
  });

  test('a narrow track (1024): both neighbouring hours meet the pill, so both are left out', () => {
    // about 62 px an hour: 10:00 is 42 px and 11:00 21 px from the line; the pill is 46 px wide, a label 34 px
    const f = axisFit({ nowPct: NOW_1040, hours: 16, axisPx: 1000, pillPx: 46, labelPx: 34, fallbackPct: 3 });
    expect([...f.hidden].sort((a, b) => a - b)).toEqual([3, 4]);
    expect(f.pillLeftPx).toBeCloseTo((NOW_1040 / 100) * 1000 - 23, 0);
  });

  test('a wide track: 10:00 has room beside the pill and stays, 11:00 does not', () => {
    const f = axisFit({ nowPct: NOW_1040, hours: 16, axisPx: 2000, pillPx: 46, labelPx: 34, fallbackPct: 3 });
    expect([...f.hidden]).toEqual([4]);
  });

  test('a larger type scale (a wider pill and labels) leaves out more, never draws a label under the pill', () => {
    for (const axisPx of [480, 640, 820, 1000, 1200, 1600]) {
      for (const [pillPx, labelPx] of [[40, 30], [46, 34], [56, 42], [64, 48]]) {
        const f = axisFit({ nowPct: NOW_1040, hours: 16, axisPx, pillPx, labelPx, fallbackPct: 3 });
        const pl = f.pillLeftPx as number;
        for (let k = 0; k <= 16; k++) {
          if (f.hidden.has(k)) continue;
          const x = (k / 16) * axisPx;
          const l = k === 0 ? 0 : k === 16 ? axisPx - labelPx : x - labelPx / 2;
          const clear = l + labelPx + 6 <= pl + 0.1 || l - 6 >= pl + pillPx - 0.1;
          expect(clear, `label ${k} at ${axisPx}px (pill ${pillPx}, label ${labelPx})`).toBe(true);
        }
      }
    }
  });

  test('no two hour labels touch: on a 1024 track the hour beside each edge label is left out, the edges stay', () => {
    // a 640 px track: 40 px an hour, 34 px labels - 08:00 would sit on 07:00 (aligned to the start) and 22:00 on 23:00
    const f = axisFit({ nowPct: NOW_1040, hours: 16, axisPx: 640, pillPx: 46, labelPx: 34, fallbackPct: 3 });
    expect(f.hidden.has(0)).toBe(false);
    expect(f.hidden.has(16)).toBe(false);
    expect(f.hidden.has(1)).toBe(true);
    expect(f.hidden.has(15)).toBe(true);
    for (const axisPx of [480, 640, 820, 1000]) {
      for (const labelPx of [30, 34, 42]) {
        const g = axisFit({ nowPct: NOW_1040, hours: 16, axisPx, pillPx: 46, labelPx, fallbackPct: 3 });
        const boxes = Array.from({ length: 17 }, (_, k) => k).filter((k) => !g.hidden.has(k)).map((k) => {
          const x = (k / 16) * axisPx;
          const l = k === 0 ? 0 : k === 16 ? axisPx - labelPx : x - labelPx / 2;
          return [l, l + labelPx];
        });
        for (let i = 1; i < boxes.length; i++) expect(boxes[i][0] - boxes[i - 1][1], `labels ${i - 1}/${i} at ${axisPx}px, ${labelPx}px labels`).toBeGreaterThanOrEqual(6 - 0.01);
      }
    }
  });

  test('near the start and the end of the window the pill stays inside the axis and takes the edge label', () => {
    const early = axisFit({ nowPct: (5 / (16 * 60)) * 100, hours: 16, axisPx: 1000, pillPx: 46, labelPx: 34, fallbackPct: 3 }); // 07:05
    expect(early.pillLeftPx).toBe(0);
    expect(early.hidden.has(0)).toBe(true);
    const late = axisFit({ nowPct: ((16 * 60 - 5) / (16 * 60)) * 100, hours: 16, axisPx: 1000, pillPx: 46, labelPx: 34, fallbackPct: 3 }); // 22:55
    expect(late.pillLeftPx).toBe(1000 - 46);
    expect(late.hidden.has(16)).toBe(true);
  });

  test('the phone window (6 hours, labels without minutes)', () => {
    // 09:00-15:00 at 10:40 on a 250 px track: 10 and 11 meet a 44 px pill, 09 and 12 do not
    const f = axisFit({ nowPct: ((100 / 360) * 100), hours: 6, axisPx: 250, pillPx: 44, labelPx: 16, fallbackPct: 9 });
    expect([...f.hidden].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  test('no pill outside the window (another day, before or after the hours)', () => {
    for (const nowPct of [-1, 0, 100, 140]) {
      const f = axisFit({ nowPct, hours: 16, axisPx: 1000, pillPx: 46, labelPx: 34, fallbackPct: 3 });
      expect(f.pillLeftPx).toBeNull();
      expect(f.hidden.size).toBe(0);
    }
  });

  test('the pill draws its own ink: its rules out-rank the hour labels\' rule (the time was drawn in the labels\' grey)', () => {
    const s = flat('calendars/view-rooms.ts');
    // ".tl-axis span" is (0,1,1); the pill's rule must be at least (0,2,0) and carry the inverse ink and its own top
    expect(s).toContain('.tl-axis span { position: absolute; transform: translateX(-50%);');
    expect(s).toMatch(/\.tl-axis \.tl-nowlab \{ position: absolute; top: 2px;[^}]*color: var\(--sw-text-inverse\);/);
    expect(s.split('.tl-nowlab {').length).toBe(s.split('.tl-axis .tl-nowlab {').length); // no bare `.tl-nowlab {` rule left
    expect(s).toContain('.tl-axis .tl-nowlab.placed { transform: none; }');
    expect(s).toContain('const fit = axisFit({');
    expect(s).not.toContain('Math.abs(x - nowL) < (phone ? 9 : 3)');
  });
});

test.describe('D22: the calendars management list pages by the measured row', () => {
  test('the measure wins over the estimate (it was a floor), and 1024 x 768 fits eight rows of the tighter row', () => {
    const s = flat('calendars/view-manage.ts');
    expect(s).toContain('rowsThatFit(this.listH + 6, this.rowH || rowH)');
    expect(s).not.toContain('Math.max(rowH, this.rowH)');
    expect(s).toContain('@media (min-width: 700px) { .list > .row { padding-block: 8px; } }');
    // the list of the round-9 capture at 1024 x 768 is about 490 px tall: a 58 px row fits 7, the 54 px row 8
    expect(rowsThatFit(490 + 6, 58 + 6)).toBe(7);
    expect(rowsThatFit(490 + 6, 54 + 6)).toBe(8);
  });
});

/** Every `:hover` of a file's CSS sits inside a `@media (hover: hover) and (pointer: fine)` block. */
function ungatedHovers(src: string): string[] {
  const ranges: [number, number][] = [];
  const re = /@media \(hover: hover\) and \(pointer: fine\) \{/g;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}' && --depth === 0) break;
    }
    ranges.push([m.index, i]);
  }
  const bad: string[] = [];
  for (const m of src.matchAll(/[^\s{};]*:hover[^{]*\{/g)) {
    if (!ranges.some(([a, b]) => m.index! > a && m.index! < b)) bad.push(m[0].trim());
  }
  return bad;
}

test('hover only under a fine hovering pointer in the screens of this package', () => {
  for (const f of ['screens/wiskey-overview.ts', 'screens/security-alarm.ts', 'calendars/view-rooms.ts', 'calendars/view-manage.ts', 'calendars/attendee-picker.ts', 'calendars/styles.ts']) {
    expect(ungatedHovers(flat(f)), f).toEqual([]);
  }
});

test('WP9 overview: tokens only, the search field has a focus ring and a touch height, the error inks are the -text inks', () => {
  const s = flat('screens/wiskey-overview.ts');
  const styles = s.slice(s.indexOf('static styles = css`'));
  expect(styles).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(styles).not.toMatch(/rgba?\(/);
  expect(styles).toContain('.search:focus-within { border-color: var(--sw-accent); box-shadow: 0 0 0 3px var(--sw-accent-soft); }');
  expect(styles).toContain('@media (pointer: coarse) { .search { min-block-size: 44px; } }');
  expect(styles).toContain('.note.err { background: var(--sw-danger-soft); color: var(--sw-danger-text); }');
  expect(styles).toContain('.result.err { background: var(--sw-danger-soft); color: var(--sw-danger-text); }');
  expect(styles).toContain('background: var(--sw-video-scrim); color: var(--sw-on-video);');
});

test('WP9 overview: the ringing pill\'s text reads on its amber fill (4.5:1), light and dark, every live skin', () => {
  const s = flat('screens/wiskey-overview.ts');
  expect(s).toMatch(/\.ring \{[^}]*background: var\(--sw-warning\);[^}]*color: var\(--sw-on-warning\);/);
  const fails: string[] = [];
  for (const id of SKIN_IDS.filter((k) => !FROZEN_SKINS.includes(k))) {
    const t = skinTable(id);
    for (const scheme of ['light', 'dark'] as const) {
      const fill = parseColor(t['--sw-warning'][scheme]) as RGBA;
      const ink = parseColor(t['--sw-on-warning'][scheme]) as RGBA;
      const base = over(fill, [255, 255, 255, 1]);
      const r = contrastRatio(over(ink, base), base);
      if (!(r >= 4.5)) fails.push(`${id} ${scheme} ${r.toFixed(2)}`);
    }
  }
  expect(fails).toEqual([]);
});

test('WP9 alarm: the switcher and the keypad press on pointer-down with the motion tokens; 44 px keys on touch', () => {
  const s = flat('screens/security-alarm.ts');
  expect(s).toContain('.switcher button:active { transform: scale(var(--sw-press-scale)); }');
  expect(s).toContain('.keys button:active { background: var(--sw-accent-soft); transform: scale(var(--sw-press-scale)); }');
  expect(s).not.toContain('scale(0.97)');
  expect(s).toContain('.switcher button { min-block-size: 44px; }');
  expect(s).toContain('@media (pointer: coarse) { details.unpaired summary { min-block-size: 44px; } }');
  expect(s).not.toContain('rgba(255, 255, 255, 0.22)');
});

test('D22 review: the attendees toggle, the overlay close key and the steppers reach 44 px on touch; the sheet grab uses the pill radius', () => {
  expect(flat('calendars/attendees-section.ts')).toContain('@media (pointer: coarse) { .tg { min-block-size: 44px; } }');
  const o = flat('calendars/grid-overlays.ts');
  expect(o).toContain('@media (pointer: coarse) { .x { inline-size: 44px; min-block-size: 44px; } }');
  expect(o).toContain('@media (pointer: coarse) { .step button { inline-size: 44px; block-size: 44px; } }');
  expect(o).toContain('.grab { inline-size: 40px; block-size: 5px; border-radius: var(--sw-r-pill);');
  expect(flat('calendars/view-manage.ts')).toContain('@media (pointer: coarse) { .menu button { min-block-size: 44px; } }');
  expect(flat('calendars/view-rooms.ts')).toContain('@media (pointer: coarse) { .pop label { min-block-size: 44px; } }');
});
