import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

// CR-NOSCROLL-LISTS-2443 (code review 06:SCROLL-1, 06:PLAY-2, 08:F23; owner decision O12 = a; docs/changes/CR-NOSCROLL-LISTS-2443.md).
// Node only: (1) the comparison grid's height budget computed from the screen's own CSS at the reference viewports (the row's "2x2 at
// 1080p"); (2) the maintenance reminder log is paged with the shared measured-pages helper and honours the long-lists setting; (3) the
// candidates the measurement kept as inner scrollers are still the ones documented (a new scroller there is a decision, not a drift).
const code = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ---------------------------------------------------------------- 06:PLAY-2 the comparison grid

const pb = code('screens/investigate-playback.ts');
/** The budget, the gap and the padding as the stylesheet writes them. */
function gridCss() {
  // RELEASE-2440-TRAIN: both budgets also subtract the measured diagnostics row (`--pb-diag-h`, 0 when the row is hidden); the numbers
  // below are the budget without the row, as the 0.1.68 budget defines it
  const budget = pb.match(/--pb-stage-h:\s*max\((\d+)px,\s*calc\(100dvh - (\d+)px - var\(--pb-diag-h, 0px\)\)\)/);
  expect(pb, 'the single video subtracts the diagnostics row too').toMatch(/max-block-size:\s*max\(\d+px,\s*calc\(100dvh - \d+px - var\(--pb-diag-h, 0px\)\)\)/);
  const rows2 = pb.match(/\.grid\.rows2\s*\{\s*max-inline-size:\s*calc\(\(var\(--pb-stage-h\) - (\d+)px\) \* 16 \/ 9 \+ (\d+)px\);/);
  const base = pb.match(/\.grid\s*\{\s*display: grid;\s*gap: (\d+)px;\s*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*?padding: (\d+)px;/);
  expect(budget, 'the stage budget').not.toBeNull();
  expect(rows2, 'the 2x2 width cap').not.toBeNull();
  expect(base, 'the grid gap and padding').not.toBeNull();
  return { floor: +budget![1], chrome: +budget![2], capSub: +rows2![1], capAdd: +rows2![2], gap: +base![1], pad: +base![2] };
}

test('06:PLAY-2: at 2x2 the grid ends within the single video\'s budget at 1920x1080, 1440x900 and 1366x768', () => {
  const c = gridCss();
  for (const [w, h] of [[1920, 1080], [1440, 900], [1366, 768]]) {
    const budget = Math.max(c.floor, h - c.chrome);
    const cap = ((budget - c.capSub) * 16) / 9 + c.capAdd;
    // the content column is narrower than the window (the side navigation); the grid takes the smaller of the two widths
    for (const avail of [w - 240, w - 72]) {
      const width = Math.min(avail, cap);
      const tile = (width - 2 * c.pad - c.gap) / 2;
      const height = 2 * ((tile * 9) / 16) + c.gap + 2 * c.pad;
      expect(height, `${w}x${h}, ${avail} px wide: grid ${height.toFixed(1)} px, budget ${budget} px`).toBeLessThanOrEqual(budget + 0.5);
    }
  }
  // 1080p in numbers: a 520 px budget, a grid at most ~910 px wide and 520 px tall
  const b1080 = Math.max(c.floor, 1080 - c.chrome);
  expect(b1080).toBe(520);
  expect(Math.round(((b1080 - c.capSub) * 16) / 9 + c.capAdd)).toBe(910);
});

// ---------------------------------------------------------------- 08:F23 the maintenance reminder log

test('08:F23: the reminder log is paged on a desktop with the shared helper, and scrolls inside its panel only when the lists scroll', () => {
  const log = code('maintenance/log-page.ts');
  expect(log).toContain("import { PageFit } from '../components/page-fit';");
  expect(log).toMatch(/private fit = new PageFit\(this, \(\) => this\.renderRoot\.querySelector<HTMLElement>\('\.scroller'\), \(\) => !!this\.log\?\.items\.length\);/);
  expect(log).toMatch(/:host\(\[data-fit\]\[data-long-lists='paged'\]\) \.scroller \{ overflow: hidden; \}/);
  expect(log).toMatch(/protected willUpdate\(\) \{\s*this\.toggleAttribute\('data-fit', this\.fit\.fits\);/);
  expect(log).toContain('<tr data-fit-item data-maint-log-row=');
  expect(log).toContain('this.fit.shows(i) ? this.row(r) : nothing');
  expect(log).toMatch(/this\.fit\.sync\(l\.items\.length, `\$\{this\.event\}\|/);
  expect(log).toContain('<sw-pager data-maint-log-pager');
  // the table sits in a <section> so that a later page draws the table head again (PageFit counts the head)
  expect(log).toMatch(/<section class="fitsec"><table class="t" data-maint-log-table>/);
});

// ---------------------------------------------------------------- the candidates kept as inner scrollers (measured, documented)

test('the kept inner scrollers are the documented ones (settings, a manager\'s print page, two capped pickers); the paged screens use the shared helper', () => {
  // emergency contacts / thresholds: a settings panel
  expect(code('maintenance/emergency-config.ts')).toMatch(/\.scroller \{ flex: 1; min-block-size: 0; overflow: auto;/);
  // the stickers page: managers only, prints every sticker
  expect(code('maintenance/tags-page.ts')).toMatch(/\.tagscroll \{ flex: 1; min-block-size: 0; overflow: auto;/);
  // the generator pickers are capped boxes inside settings cards (no inline style any more, 08:F23)
  const gen = code('generator/gen-styles.ts');
  expect(gen).toMatch(/\.chooser\.users \{\s*max-block-size: 220px;/);
  expect(gen).toMatch(/\.list\.picklist \{[^}]*max-block-size: 300px;/);
  for (const f of ['generator/gen-routing.ts', 'generator/gen-settings.ts']) expect(code(f), f).not.toMatch(/style="max-block-size:\s*220px;\s*overflow:\s*auto"/);
  // the multimedia trio and the emergency checklist page with the shared helper (NOSCROLL-1366, PAGING-SETTING-2439)
  for (const f of ['screens/multimedia-screens.ts', 'screens/multimedia-players.ts', 'maintenance/emergency-page.ts', 'maintenance/list-page.ts']) expect(code(f), f).toContain('new PageFit(this,');
});
