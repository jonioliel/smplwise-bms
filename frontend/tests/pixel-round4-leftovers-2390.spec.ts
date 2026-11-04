import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { settlePage } from './pixel-settle';
import { PIXEL_SKINS, pixelTitle, skinCheck } from './helpers/pixel-skins';

// ROUND4-LEFTOVERS-2390 (polish round 4 leftovers): pixel baselines and layout checks of the screens this package changed, in demo mode
// (invented data, a fixed clock, performance:full):
//   - WisKey › מרכז הכניסה (#/wiskey/overview, the demo stations: one ringing, one offline) - WP9: tokens, the ringing pill's ink;
//   - יומנים › חדרים לפי שעות at 10:40 (calendars D22: the now pill and the hour labels), desktop 1440, 1024 and the phone;
//   - יומנים › ניהול יומנים at 1024 x 768 (calendars D22: the rows a page).
// Baselines are per OS; the Linux ones are taken on the runner with `--update-snapshots`, an OS without a baseline skips the compare.
//   run_smart.py preview <branch> tests/pixel-round4-leftovers-2390.spec.ts --project=desktop --project=mobile [--update-snapshots=changed]
// The layout checks (titles without "pixel-stable") run in the gate's preview group.

const FIXED = new Date('2026-10-29T08:40:00Z'); // Thursday 29.10.2026, 10:40 in the installation's zone (the calendars demo's "now")
const CAL = 'sw-app calendars-page';
const OV = 'sw-app wiskey-overview';

const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(page: Page, info: Parameters<typeof noBaseline>[0], file: string) {
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(page).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function open(page: Page, hash: string, skin: string, scheme: 'light' | 'dark', ready: string) {
  await page.clock.setFixedTime(FIXED);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForSelector(ready, { timeout: 30_000 });
  await settlePage(page);
}

const width = (name: string) => (name === 'mobile' ? '390' : '1440');

test.describe('ROUND4-LEFTOVERS-2390', () => {
  test.describe.configure({ timeout: 120_000 });
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop (1440 and 1024 inside it) and the phone');
  });

  for (const skin of PIXEL_SKINS) {
    for (const scheme of ['light', 'dark'] as const) {
      test(pixelTitle(skin, `WisKey entry center, demo stations (${scheme})`), async ({ page }, info) => {
        const check = skinCheck(page, skin);
        await open(page, '/wiskey/overview', skin, scheme, `${OV} [data-wiskey-door="d1"][data-status="ringing"]`);
        await check(() => compare(page, info, `wk-overview-${skin}-${scheme}-${width(info.project.name)}.png`), OV);
      });

      test(pixelTitle(skin, `calendars rooms timeline at 10:40 (${scheme})`), async ({ page }, info) => {
        const check = skinCheck(page, skin);
        await open(page, '/calendars/rooms?date=2026-10-29', skin, scheme, `${CAL} cal-view-rooms [data-cal-now].placed`);
        await check(() => compare(page, info, `cal-rooms-${skin}-${scheme}-${width(info.project.name)}.png`), `${CAL} cal-view-rooms`);
        if (info.project.name === 'desktop') {
          await page.setViewportSize({ width: 1024, height: 768 });
          await settlePage(page);
          await check(() => compare(page, info, `cal-rooms-${skin}-${scheme}-1024.png`), `${CAL} cal-view-rooms`);
        }
      });
    }

    test(pixelTitle(skin, 'calendars management list at 1024 x 768'), async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'a 1024 x 768 window inside the desktop project');
      const check = skinCheck(page, skin);
      await page.setViewportSize({ width: 1024, height: 768 });
      await open(page, '/calendars/manage', skin, 'light', `${CAL} cal-view-manage [data-cal-row]`);
      await check(() => compare(page, info, `cal-manage-${skin}-light-1024.png`), `${CAL} cal-view-manage`);
    });
  }

  // ---- layout checks (no pixels; the gate's preview group) ----

  /** The pill's box, its ink against its fill, the visible hour labels' boxes and the axis box. */
  async function axisGeometry(page: Page) {
    return page.evaluate(() => {
      const deep = (root: Document | ShadowRoot, sel: string): Element | null => {
        const hit = root.querySelector(sel);
        if (hit) return hit;
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; }
        return null;
      };
      const view = deep(document, 'cal-view-rooms')?.shadowRoot;
      const axis = view?.querySelector('.tl-axis') as HTMLElement | null;
      const pill = view?.querySelector('[data-cal-now]') as HTMLElement | null;
      if (!axis || !pill) return null;
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { l: r.left, r: r.right, t: r.top, b: r.bottom };
      };
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
      const lum = (c: number[]) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      const cs = getComputedStyle(pill);
      const a = lum(rgb(cs.color));
      const b = lum(rgb(cs.backgroundColor));
      return {
        axis: box(axis),
        pill: box(pill),
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
        labels: [...view!.querySelectorAll('[data-cal-hour]')].map((el) => ({ h: el.getAttribute('data-cal-hour'), ...box(el) })),
      };
    });
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`calendars D22: the now pill reads (4.5:1), stays inside the axis and covers no hour label (${scheme})`, async ({ page }, info) => {
      await open(page, '/calendars/rooms?date=2026-10-29', 'classic', scheme, `${CAL} cal-view-rooms [data-cal-now].placed`);
      const sizes = info.project.name === 'desktop' ? [[1440, 900], [1180, 820], [1024, 768]] : [[390, 844]];
      for (const [w, h] of sizes) {
        await page.setViewportSize({ width: w, height: h });
        await settlePage(page);
        const g = await axisGeometry(page);
        expect(g, 'the timeline and its now pill are drawn').not.toBeNull();
        expect(g!.ratio, `the time on the pill against its fill at ${w}`).toBeGreaterThanOrEqual(4.5);
        expect(g!.pill.l, `the pill starts inside the axis at ${w}`).toBeGreaterThanOrEqual(g!.axis.l - 0.5);
        expect(g!.pill.r, `the pill ends inside the axis at ${w}`).toBeLessThanOrEqual(g!.axis.r + 0.5);
        const covered = g!.labels.filter((x) => x.r > g!.pill.l - 1 && x.l < g!.pill.r + 1).map((x) => x.h);
        expect(covered, `hour labels under the pill at ${w}`).toEqual([]);
        const xs = [...g!.labels].sort((a, b) => a.l - b.l);
        const touching = xs.slice(1).filter((x, i) => x.l < xs[i].r + 2).map((x) => x.h);
        expect(touching, `hour labels that touch their neighbour at ${w}`).toEqual([]);
        expect(g!.labels.length, `the axis keeps its other hours at ${w}`).toBeGreaterThanOrEqual(w < 700 ? 4 : 13);
      }
    });
  }

  test('calendars D22: the management list at 1024 x 768 leaves no room for another row while there are more pages', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'a 1024 x 768 window inside the desktop project');
    await page.setViewportSize({ width: 1024, height: 768 });
    await open(page, '/calendars/manage', 'classic', 'light', `${CAL} cal-view-manage [data-cal-row]`);
    const m = await page.evaluate(() => {
      const deep = (root: Document | ShadowRoot, sel: string): Element | null => {
        const hit = root.querySelector(sel);
        if (hit) return hit;
        for (const el of root.querySelectorAll('*')) if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; }
        return null;
      };
      const view = deep(document, 'cal-view-manage')?.shadowRoot;
      const list = view?.querySelector('.list') as HTMLElement | null;
      const rows = [...(view?.querySelectorAll('.list > .row') ?? [])] as HTMLElement[];
      const pager = view?.querySelector('[data-pager] [data-page]')?.textContent ?? '';
      if (!list || !rows.length) return null;
      const lb = list.getBoundingClientRect();
      const last = rows[rows.length - 1].getBoundingClientRect();
      return { rows: rows.length, rowH: rows[0].getBoundingClientRect().height, free: lb.bottom - last.bottom, cut: last.bottom - lb.bottom, pager };
    });
    expect(m, 'the list is drawn').not.toBeNull();
    test.info().annotations.push({ type: 'manage-1024', description: JSON.stringify(m) });
    expect(m!.cut, 'the last row is not cut').toBeLessThanOrEqual(0.5);
    expect(m!.rowH, 'a row stays a comfortable target').toBeGreaterThanOrEqual(44);
    if (/\d+\s*\/\s*([2-9]|\d\d)/.test(m!.pager)) expect(m!.free, `room for another row: ${JSON.stringify(m)}`).toBeLessThan(m!.rowH + 6);
  });
});
