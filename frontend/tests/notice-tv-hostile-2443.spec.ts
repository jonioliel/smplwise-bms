import { test, expect, type Page } from '@playwright/test';
import { lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import { screen } from './bustimes-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';
import type { TransitDigest, TransitItem } from '../src/notice-tv/transit-logic';

// CR-TV-FONTS-ESCAPE-2443 (code review 08:F05): the TV page draws the feed with innerHTML, and the feed is cast, never validated. Every text
// and number field of the feed and of the bus-times digest carries a hostile string; in every board design the page must draw it as text:
// no element and no attribute from the data may appear in the document. (The page CSP blocks script, so this is defence in depth.)
// The pure builders are covered in Node by unit-notice-tv-escape-2443.spec.ts. Needs the built UI (npm run build; preview) or a dev server.
//   npx playwright test tests/notice-tv-hostile-2443.spec.ts --project=desktop --workers=1

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));

const P = `"'><x-pwn data-pwn="1" data-pwn2='1'>`;
const H = P as unknown as number; // a hostile string where the type says number

const N = (id: string, severity: string, extra: Partial<FeedNotice> = {}): FeedNotice => ({
  id, severity: severity as FeedNotice['severity'], title: P + ' 10:00–12:00', body: P + '\n' + P, when: P, starts_at: '2026-10-23T06:11:30Z', ends_at: '2026-11-20T06:00:00Z',
  pinned: false, published_at: null, ...extra,
});

function hostileFeed(d: Partial<Display>): Feed {
  const f = lobbyFeed({ place: P, weather_days: 0, ...d } as Partial<Display>, [N('u1', 'critical'), N('a1', 'alert'), N('x1', P), N('i1', 'info', { dwell_s: H })]);
  f.board.name = P;
  f.board.building = P;
  f.board.brand = { name: P } as Feed['board']['brand'];
  f.weather = { now: { t: H, condition: P, text: P }, hours: [{ at: P, t: H, condition: P }, { at: P, t: H, condition: 'sun' }], days: [{ date: P, t: H, lo: H, condition: P }] };
  f.info = [{ kind: P, label: P, state: P as 'ok', text: P }, { kind: 'elevator', label: P, state: 'warn', text: P }];
  f.news = [{ source: P, title: P }, { source: P, title: P, logo: P }];
  f.slides = [{ id: 's1', title: P, text: P, seconds: H }];
  f.announcement = { id: P, critical: false, until: '2026-10-24T00:00:00Z', texts: [{ language: P as 'he', text: P, machine: true }, { language: 'he', text: P }] };
  return f;
}

const it = (over: Partial<TransitItem> = {}): TransitItem => ({
  line: P, dest: P, stop: H, at: '2026-10-23T06:20:00Z', hm: P, mins: 8, quality: 'realtime', more: [{ at: '2026-10-23T06:40:00Z', hm: P, mins: 28 }], ...over,
} as TransitItem);
const DIGEST = {
  state: 'fresh', now: '2026-10-23T06:12:00Z', updated_hm: P, window_min: 60, rows: 5, multi: true, realtime: true, show_distance: true,
  stops: [{ code: H, name: P }], items: [it(), it({ quality: 'scheduled' })], overflow: H, grouped: false, next: it(),
  columns: [{ stop: H, name: P, items: [it()], overflow: H, grouped: false, next: it() }],
} as unknown as TransitDigest;

async function injected(page: Page): Promise<string[]> {
  return page.evaluate(() => [...document.querySelectorAll('x-pwn, [data-pwn], [data-pwn2]')].map((e) => e.outerHTML.slice(0, 160)));
}

async function open(page: Page, q: string, d: Partial<Display> = {}, size: [number, number] = [1920, 1080]): Promise<string[]> {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.route('**/api/v1/notices/display/lobby/transit', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DIGEST) }));
  await serveFeed(page, hostileFeed(d));
  await page.goto(tvUrl(q));
  await page.waitForFunction(() => !!document.querySelector('#cv[data-tpl] .pg .hd, #cv[data-tpl] .pg .b2hd, #nbk .nb-hd *, #nbk .nb-take *'), null, { timeout: 15_000 });
  await page.waitForTimeout(600);
  return errors;
}

const CASES: { name: string; q: string; d?: Partial<Display>; size?: [number, number] }[] = [
  { name: 'classic, template 1, rotation, bus column', q: 'design=classic', d: { template: 1, transit: screen({ layout: 'side' }) } as Partial<Display> },
  { name: 'classic, template 2, all together, band', q: 'design=classic', d: { template: 2, mode: 'all', urgent: 'band' } },
  { name: 'classic, template 3, focus, portrait, bus strip', q: 'design=classic', d: { template: 3, mode: 'focus', layout: 'portrait', transit: screen({ layout: 'strip' }) } as Partial<Display>, size: [1080, 1920] },
  { name: 'classic, forecast days', q: 'design=classic', d: { template: 1, weather_days: 3 } as Partial<Display> },
  { name: 'V2, bus panel', q: 'design=v2', d: { transit: screen({ layout: 'side' }) } as Partial<Display> },
  { name: 'V2, portrait', q: 'design=v2', d: { layout: 'portrait' }, size: [1080, 1920] },
  ...['ink', 'sign', 'lumen', 'axis', 'prism', 'gallery', 'concierge', 'stone'].flatMap((s) => [
    { name: `${s}, urgent take-over`, q: `design=${s}` },
    { name: `${s}, rotation (no take-over)`, q: `design=${s}`, d: { urgent: 'band' } as Partial<Display> },
  ]),
];

for (const c of CASES) {
  test(`hostile feed is drawn as text: ${c.name}`, async ({ page }) => {
    const errors = await open(page, c.q, c.d, c.size);
    expect(await injected(page), c.name).toEqual([]);
    // the rotation's next turns draw other notices and the queue: still nothing from the data
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(400);
    expect(await injected(page), c.name + ' after a turn').toEqual([]);
    expect(errors, c.name + ': page errors').toEqual([]);
  });
}
