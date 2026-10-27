import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { measure } from './breakui-worst';

// WIDGETBREAK-297: the home widgets (all but the elevators card, ELEVFIX-297) in cards 240 / 280 / 320 / 360 px wide, sizes s / m / l, light and dark,
// fed NORMAL, WORST-CASE (long Hebrew, unbreakable Latin, mixed RTL/LTR, emoji, huge numbers, many items) and EMPTY invented data through the harness
// tests/widget-break-harness (the Vite DEV server: the harness imports /src/). Geometry assertions only, no pixel baseline: nothing may leave its card,
// no text may be cut without an ellipsis, the card may not scroll sideways. Fake data only; no backend.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-widgets-break-297.spec.ts --project=desktop
// WB_SHOTS=<dir> also writes a screenshot per case; WB_ALL=1 widens the widget list to the ones still open (see docs/design/system/WIDGET_BREAK_2026-10-27.md).
const WIDTHS = [240, 280, 320, 360];
const SIZES = ['s', 'm', 'l'] as const;
const DATASETS = ['normal', 'worst', 'empty'] as const;
const FIXED = ['clock', 'weather', 'shabbat', 'alarm', 'quick', 'agenda', 'temperature', 'generators', 'doors', 'notices', 'launcher'];
const WIDGETS = FIXED;
const SHOTS = process.env.WB_SHOTS;

async function open(page: Page, scheme: 'light' | 'dark') {
  await page.goto('about:blank');
  await page.goto(`/tests/widget-break-harness/index.html?skin=classic&scheme=${scheme}`);
  await page.waitForFunction(() => (window as unknown as { wbReady?: boolean }).wbReady === true, null, { timeout: 30_000 });
}

/** What the shared guard does not see: an element whose box is wider than its card, or wider than itself without an ellipsis. */
async function edge(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const cell = document.getElementById('cell') as HTMLElement;
    const c = cell.getBoundingClientRect();
    const bad: string[] = [];
    const all: Element[] = [];
    const walk = (r: Element | ShadowRoot) => { for (const e of Array.from(r.querySelectorAll('*'))) { all.push(e); if ((e as HTMLElement).shadowRoot) walk((e as HTMLElement).shadowRoot as ShadowRoot); } };
    walk(cell);
    const name = (e: Element) => `${e.tagName.toLowerCase()}${typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''}`;
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) bad.push(`page scrolls sideways ${document.documentElement.scrollWidth}>${document.documentElement.clientWidth}`);
    for (const e of all) {
      if (!(e instanceof HTMLElement) || e.closest('svg') || /^(STYLE|SCRIPT)$/.test(e.tagName)) continue;
      const b = e.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.position === 'fixed') continue;
      if (b.left < c.left - 1.5 || b.right > c.right + 1.5) bad.push(`${name(e)} leaves its card (${Math.round(b.left - c.left)}..${Math.round(b.right - c.left)} of ${Math.round(c.width)})`);
      const hidden = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
      if (hidden && e.scrollWidth > e.clientWidth + 1 && cs.textOverflow !== 'ellipsis' && cs.display !== 'inline' && !(e.textContent ?? '').match(/^\s*$/)) {
        // a line clamp / wrapped text has no sideways overflow; this is text that is cut with no ellipsis
        if (cs.whiteSpace === 'nowrap' || e.scrollWidth - e.clientWidth > 3) bad.push(`${name(e)} cuts its content without an ellipsis (${e.scrollWidth}>${e.clientWidth})`);
      }
    }
    return bad;
  });
}

test.describe('home widgets break test', () => {
  test.beforeAll(() => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
  for (const scheme of ['light', 'dark'] as const) {
    test(`${scheme}: no widget leaves or clips its card at 240-360 px`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await open(page, scheme);
      const problems: string[] = [];
      for (const id of WIDGETS) for (const size of SIZES) for (const ds of DATASETS) for (const w of WIDTHS) {
        const ctx = `${id}/${size}/${ds}/${w}/${scheme}`;
        await page.evaluate(([i, s, d, px]) => (window as unknown as { wbMount: (...a: unknown[]) => Promise<void> }).wbMount(i, s, d, px), [id, size, ds, w] as const);
        const m = await measure(page, ctx, '#cell');
        const e = await edge(page);
        const own = [...m.found.map((f) => `${f.cls} ${f.el} ${f.detail}`), ...e];
        const uniq = Array.from(new Set(own));
        if (uniq.length) problems.push(`${ctx}: ${uniq.slice(0, 4).join(' | ')}`);
        if (SHOTS && ds === 'worst' && w === 240 || SHOTS && ds === 'worst' && w === 360) await page.locator('#cell').screenshot({ path: path.join(SHOTS, `${id}-${size}-${w}-${scheme}.png`) });
      }
      if (process.env.WB_REPORT) fs.writeFileSync(process.env.WB_REPORT.replace('.txt', `-${scheme}.txt`), problems.join('\n'));
      expect(errors, 'page errors').toEqual([]);
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
});
