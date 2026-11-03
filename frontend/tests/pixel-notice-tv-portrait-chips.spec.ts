import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

// TV-FIT-2380: the portrait footer keeps every building chip under the DEFAULT "updated" wording ("עודכן · <place> 09:12", longer than the
// old "עודכן 09:12 · <board>" that pixel-notice-tv-mock / pixel-bustimes-295 used to pin) - in every classic template, V2 (no chips: the
// status line and "powered by" stay apart), the six lobby styles and Ink / Sign. Two parts:
//   - geometry (always runs): every chip drawn and not cut by any clipping box, the time of the "updated" line drawn in full, no chip over
//     the status line, no page scroll - with the fixture's place and with a worst-case long place name;
//   - pixels (evidence): one screenshot per case; THE BASELINES ARE GENERATED ON THE RUNNER ONLY (fonts and anti-aliasing differ):
//       npx playwright test tests/pixel-notice-tv-portrait-chips.spec.ts --project=desktop --update-snapshots
//     until they exist the pixel step skips itself (as pixel-bustimes-295 does), the geometry still runs.
// Plus the rest of TV-FIT-2380 on the page: landscape turns to two rows only when a chip would be cut, the priority drop on request, the
// safe-area margin, the company logo sized by area (H7) and the Hebrew date on a browser without the Hebrew calendar.
// TV-CHIPS-2381 (owner 03.11, Q3 = B): the product default is now the priority drop (one row). The per-design cases below are the
// two-rows mode and pin `portrait_chips: 'rows'` (the same pictures as before); the drop default has its own geometry tests at the end.
//   npx playwright test tests/pixel-notice-tv-portrait-chips.spec.ts --project=desktop

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SNAPS = path.resolve(HERE, 'pixel-notice-tv-portrait-chips.spec.ts-snapshots');
const OUT = path.resolve(HERE, '../test-results/tv-fit-2380');
const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'one set, desktop Chromium'));

const LONG_PLACE = 'הכניסה הראשית לבניין המגורים הצפוני ליד חדר הדואר והמעליות';
// no critical notice: an urgent notice may take the whole screen in a lobby style, and this spec is about the footer
const CALM: FeedNotice[] = LOBBY_NOTICES.filter((n) => n.severity !== 'critical');
const CO_TALL = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="480" viewBox="0 0 120 480"><rect width="120" height="480" fill="#1e2e47"/></svg>';
const CO_BOX = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100" viewBox="0 0 300 100"><rect width="300" height="100" fill="#1e2e47"/></svg>';

interface Case { name: string; display: Partial<Display>; chips: number }
const ROWS = { portrait_chips: 'rows' } as const; // TV-CHIPS-2381: two rows is a choice now, no longer the default
const CLASSIC = (tpl: 1 | 2 | 3, extra: Partial<Display> = {}): Partial<Display> => ({ template: tpl, ...ROWS, ...extra });
const STYLE = (design: Display['design'], extra: Partial<Display> = {}): Partial<Display> => ({ design, systems_status: 'always', ...ROWS, ...extra });
const CASES: Case[] = [
  { name: 'classic-t1', display: CLASSIC(1), chips: 4 },
  { name: 'classic-t1-header-a', display: CLASSIC(1, { header: 'a' }), chips: 4 },
  { name: 'classic-t2', display: CLASSIC(2), chips: 4 },
  { name: 'classic-t3', display: CLASSIC(3), chips: 4 },
  { name: 'v2', display: { design: 'v2', ...ROWS }, chips: 0 },
  { name: 'lumen', display: STYLE('lumen'), chips: 4 },
  { name: 'axis', display: STYLE('axis'), chips: 4 },
  { name: 'prism', display: STYLE('prism'), chips: 4 },
  { name: 'gallery', display: STYLE('gallery'), chips: 4 },
  { name: 'concierge', display: STYLE('concierge'), chips: 4 },
  { name: 'stone', display: STYLE('stone'), chips: 4 },
  { name: 'ink', display: STYLE('ink'), chips: 4 },
  { name: 'sign', display: STYLE('sign'), chips: 4 },
];

let opened = 0;

async function open(page: Page, display: Partial<Display>, o: { w?: number; h?: number; q?: string; logo?: string; info?: Feed['info'] } = {}) {
  await page.setViewportSize({ width: o.w ?? 1080, height: o.h ?? 1920 });
  const feed = lobbyFeed({ theme: 'day', ...display }, CALM);
  if (o.info) feed.info = o.info;
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (o.logo) {
    feed.board.logos = { company: 'api/v1/notices/display/lobby/logo/company?variant=light&v=aaaaaaaaaaaaaaaa' };
    feed.board.brand = { size: 'm', dark_mode: 'plate', name: feed.board.building };
    await page.route('**/api/v1/notices/display/lobby/logo/company**', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: o.logo as string }));
  }
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&')), base()).toString());
  await page.waitForFunction(() => document.querySelector('#nbk[data-ready="1"]') || document.querySelector('#cv[data-tpl] .pg > *'), null, { timeout: 15_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(1300); // the item fade (classic) / the first turn (styles)
}

interface Geo { problems: string[]; chips: number; time: string }

/** Every chip and the time of the "updated" line: drawn, and inside every clipping box up to the page; no chip over the status line. */
async function geometry(page: Page): Promise<Geo> {
  return page.evaluate(() => {
    const nb = document.getElementById('nbk') as HTMLElement;
    const skin = !!nb && !nb.hidden;
    const scope = skin ? nb : (document.getElementById('cv') as HTMLElement);
    const problems: string[] = [];
    const cut = (el: Element, what: string): void => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) { problems.push(what + ': not drawn'); return; }
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const cs = getComputedStyle(a);
        if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
        const b = a.getBoundingClientRect();
        if (r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1) {
          problems.push(what + ': cut by ' + a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0]);
          return;
        }
      }
      if (r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1) problems.push(what + ': off the screen');
    };
    const chips = [...scope.querySelectorAll(skin ? '.nb-ft .nb-info li' : '.chips .ch')];
    chips.forEach((c, k) => cut(c, 'chip ' + (k + 1) + ' (' + (c.textContent || '').trim() + ')'));
    const t = scope.querySelector(skin ? '[data-nb-updated]' : '[data-updated]');
    if (t) cut(t, 'the time of the updated line');
    else problems.push('no updated line');
    // nothing sits on the status line: the chips and (V2) "powered by" keep clear of it
    const live = t?.closest(skin ? '.nb-st8' : '.live');
    const lr = live?.getBoundingClientRect();
    const over = (a: DOMRect, b: DOMRect): boolean => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    if (lr) {
      for (const c of chips) if (over(c.getBoundingClientRect(), lr)) problems.push('a chip covers the updated line: ' + (c.textContent || '').trim());
      const pw = scope.querySelector('.b2pw');
      if (pw && over(pw.getBoundingClientRect(), lr)) problems.push('"powered by" covers the updated line');
    }
    const de = document.documentElement;
    if (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) problems.push('the page scrolls');
    return { problems, chips: chips.length, time: (t?.textContent || '').trim() };
  });
}

for (const c of CASES) {
  test(`portrait footer keeps every chip under the default wording: ${c.name}`, async ({ page }) => {
    await open(page, c.display);
    const g = await geometry(page);
    expect(g.problems, c.name).toEqual([]);
    expect(g.chips).toBe(c.chips);
    expect(g.time).toBe('09:12');
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, `portrait-chips-${c.name}.png`), await page.screenshot());
  });

  // GATE2380-B: the picture is its own test, with "pixel-stable" in the title. The release gate runs every file that calls
  // toHaveScreenshot( in its pixel step with `-g pixel-stable` (and leaves those titles out of the preview groups with --grep-invert):
  // a pixel file without such a title ran zero tests there ("No tests found", gate 2.38.0 pixel_5). The geometry above stays in the
  // preview groups.
  test(`portrait footer is pixel-stable under the default wording: ${c.name}`, async ({ page }) => {
    await open(page, c.display);
    // once the runner generated the baselines (an explicit --update-snapshots), never from a missing file on a gate
    if (fs.existsSync(SNAPS) || ['all', 'changed'].includes(test.info().config.updateSnapshots)) {
      await expect(page).toHaveScreenshot(`portrait-chips-${c.name}.png`, { maxDiffPixelRatio: 0.005, animations: 'disabled' });
    }
  });

  test(`portrait footer keeps every chip with a worst-case place name: ${c.name}`, async ({ page }) => {
    await open(page, { ...c.display, place: LONG_PLACE });
    const g = await geometry(page);
    expect(g.problems, c.name).toEqual([]);
    expect(g.chips).toBe(c.chips);
    expect(g.time).toBe('09:12'); // the place gives way (an ellipsis), the time never does
  });
}

test('landscape template 1 (two rows chosen): one row while everything fits, two rows the moment a chip would be cut', async ({ page }) => {
  await open(page, { template: 1, ...ROWS }, { w: 1920, h: 1080 });
  expect((await geometry(page)).problems).toEqual([]);
  await open(page, { template: 1, place: LONG_PLACE, ...ROWS }, { w: 1920, h: 1080 });
  await expect(page.locator('#cv .pg > .ft')).toHaveClass(/\btwo\b/);
  const g = await geometry(page);
  expect(g.problems).toEqual([]);
  expect(g.chips).toBe(4);
});

test('drop (on request): one row; what leaves is a healthy chip, the warning stays', async ({ page }) => {
  await open(page, { template: 1, place: LONG_PLACE, portrait_chips: 'drop' });
  await expect(page.locator('#cv')).toHaveAttribute('data-chips', 'drop');
  await expect(page.locator('#cv .pg > .ft')).not.toHaveClass(/\btwo\b/);
  const r = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#cv .pg > .ft .ch')].map((c) => ({ look: c.dataset.look, hidden: c.hidden, text: (c.textContent || '').trim() })));
  expect(r.find((c) => c.look === 'warn')?.hidden).toBe(false);
  for (const c of r.filter((x) => x.hidden)) expect(c.look).toBe('ok');
  // whatever stays is drawn whole
  const g = await geometry(page);
  expect(g.problems.filter((p) => !p.endsWith('not drawn'))).toEqual([]);
});

test('safe-area margin: the device address (?safe=5) and the board setting keep every design inside the inset', async ({ page }) => {
  for (const [display, q, pct] of [[{ template: 1 }, 'safe=5', 5], [{ template: 1, safe_margin: 3 }, '', 3], [{ design: 'v2' }, 'safe=4', 4], [STYLE('lumen'), 'safe=5', 5], [STYLE('sign'), 'safe=2.5', 2.5]] as const) {
    await open(page, display as Partial<Display>, { w: 1920, h: 1080, q });
    const r = await page.evaluate(() => {
      const nb = document.getElementById('nbk') as HTMLElement;
      const el = nb && !nb.hidden ? nb : (document.getElementById('cv') as HTMLElement);
      const b = el.getBoundingClientRect();
      return { l: b.left, t: b.top, r: b.right, b: b.bottom, safe: document.body.dataset.safe ?? '' };
    });
    const x = (1920 * pct) / 100;
    const y = (1080 * pct) / 100;
    expect(r.safe, JSON.stringify(display)).toBe(String(pct));
    expect(r.l).toBeGreaterThanOrEqual(x - 1);
    expect(r.t).toBeGreaterThanOrEqual(y - 1);
    expect(r.r).toBeLessThanOrEqual(1920 - x + 1);
    expect(r.b).toBeLessThanOrEqual(1080 - y + 1);
    expect(r.r - r.l).toBeGreaterThan(1920 - 2 * x - 4); // the canvas still fills the inset's width
  }
  await open(page, { template: 1, safe_margin: 3 }, { w: 1920, h: 1080, q: 'safe=0' }); // a TV without overscan turns the board's margin off
  expect(await page.evaluate(() => document.body.dataset.safe ?? '')).toBe('');
});

test('H7: a tall crest gets more height (capped), an ordinary logo keeps its box', async ({ page }) => {
  const h = () => page.evaluate(() => {
    const el = document.querySelector('#cv .pg .hd .lg.company') as HTMLElement;
    const z = Number(getComputedStyle(document.getElementById('cv') as HTMLElement).zoom) || 1;
    return { h: el.getBoundingClientRect().height / z, shape: document.documentElement.dataset.coShape };
  });
  await open(page, { template: 1 }, { w: 1920, h: 1080, logo: CO_BOX });
  const box = await h();
  expect(box.shape).toBe('box');
  expect(Math.round(box.h)).toBe(72);
  await open(page, { template: 1 }, { w: 1920, h: 1080, logo: CO_TALL });
  const tall = await h();
  expect(tall.shape).toBe('tall');
  expect(tall.h).toBeGreaterThan(95); // 72 x 1.4
  expect(tall.h).toBeLessThanOrEqual(128.5);
});

test('the Hebrew date shows on a browser without the Hebrew calendar (computed, same text as the browser would print)', async ({ page }) => {
  await page.addInitScript(() => {
    const Real = Intl.DateTimeFormat;
    const Fake = function (this: unknown, loc?: string | string[], opt?: Intl.DateTimeFormatOptions) {
      if (String(loc).includes('ca-hebrew')) throw new RangeError('Incorrect locale information provided');
      return new Real(loc, opt);
    } as unknown as typeof Intl.DateTimeFormat;
    Object.assign(Fake, Real);
    (Intl as { DateTimeFormat: typeof Intl.DateTimeFormat }).DateTimeFormat = Fake;
  });
  await open(page, { template: 1, blocks: { hebdate: true } as Display['blocks'] }, { w: 1920, h: 1080 });
  await expect(page.locator('#cv [data-heb]')).toContainText('12 בחשוון 5787');
});

// ---------------------------------------------------------------- TV-CHIPS-2381: the priority drop is the default

type Chip = { look: string; hidden: boolean; text: string };
const footerChips = (page: Page): Promise<Chip[]> => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#cv .pg > .ft .ch')]
  .map((c) => ({ look: c.dataset.look || 'ok', hidden: c.hidden, text: (c.textContent || '').trim() })));

/** The chips that left are exactly the first ones of the priority order: healthy first, within one state the one lower in the list. */
function leftInPriorityOrder(chips: Chip[]): void {
  const rank: Record<string, number> = { ok: 0, off: 1, warn: 2, alarm: 3 };
  const order = chips.map((c, i) => ({ i, r: rank[c.look] ?? 0 })).sort((a, b) => a.r - b.r || b.i - a.i).map((x) => x.i);
  const gone = chips.filter((c) => c.hidden).length;
  expect(order.slice(0, gone).sort(), JSON.stringify(chips)).toEqual(chips.map((c, i) => (c.hidden ? i : -1)).filter((i) => i >= 0).sort());
}

test('TV-CHIPS-2381: a board with nothing set hides by priority in one row (portrait, worst-case place)', async ({ page }) => {
  await open(page, { template: 1, place: LONG_PLACE });
  await expect(page.locator('#cv')).toHaveAttribute('data-chips', 'drop');
  await expect(page.locator('#cv .pg > .ft')).not.toHaveClass(/two/);
  const chips = await footerChips(page);
  expect(chips.length).toBe(4);
  expect(chips.some((c) => c.hidden), 'the worst-case place leaves no room for every chip').toBe(true);
  expect(chips.find((c) => c.look === 'warn')?.hidden).toBe(false); // a problem stays
  leftInPriorityOrder(chips);
  const g = await geometry(page);
  expect(g.problems.filter((p) => !p.endsWith('not drawn'))).toEqual([]); // what stays is whole
  expect(g.time).toBe('09:12');
});

test('TV-CHIPS-2381: the board order is the priority - the chip listed last leaves first', async ({ page }) => {
  // the same four chips, parking listed first: now the generator (the last healthy one) leaves before parking
  const info: Feed['info'] = [{ kind: 'parking', label: 'חניה', text: '42 פנויות', state: 'ok' }, { kind: 'elevator', label: 'מעלית צפונית', text: 'פועלת', state: 'ok' },
    { kind: 'elevator', label: 'מעלית דרומית', text: 'בטיפול', state: 'warn' }, { kind: 'generator', label: 'גנרטור', text: 'מוכן', state: 'ok' }];
  await open(page, { template: 1, place: LONG_PLACE }, { info });
  const chips = await footerChips(page);
  expect(chips[0].text).toContain('חניה');
  expect(chips[3].hidden).toBe(true); // the generator, last in the list
  leftInPriorityOrder(chips);
  if (chips.filter((c) => c.hidden).length < 3) expect(chips[0].hidden).toBe(false); // parking, first in the list, stays longest among the healthy
});

test('TV-CHIPS-2381: two rows stay a choice (portrait_chips: rows keeps every chip)', async ({ page }) => {
  await open(page, { template: 1, place: LONG_PLACE, portrait_chips: 'rows' });
  await expect(page.locator('#cv')).toHaveAttribute('data-chips', 'rows');
  const chips = await footerChips(page);
  expect(chips.filter((c) => c.hidden)).toEqual([]);
  expect((await geometry(page)).problems).toEqual([]);
});
