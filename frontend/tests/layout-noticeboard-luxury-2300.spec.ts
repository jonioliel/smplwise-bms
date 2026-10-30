import { test, expect, type Page } from '@playwright/test';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

// LOBBY-STYLES-2300: the luxury lobby notice-board styles (Gallery, Concierge, Stone) on the product TV page, from the owner-approved mock-up
// (private/design-system-2026-10-27/round7/noticeboard-luxury) and the owner decisions of 2026-10-30: four canvases, light / dark, no scroll,
// no text under 20 px, the urgent screen only in the first minute (one deep colour per style) and then a regular message marked urgent,
// reduced motion = fades, the long body shrinks, both logos (SmplWise and the developer's), the day / night building photo, the systems row
// only on problems, one news headline at a time.  Needs the built UI (npm run build; preview).
//   npx playwright test tests/layout-noticeboard-luxury-2300.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));
test.describe.configure({ timeout: 90_000 });

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const SKINS = ['gallery', 'concierge', 'stone'] as const;
type Skin = (typeof SKINS)[number];
const URGENT_RGB: Record<Skin, string> = { gallery: 'rgb(94, 31, 29)', concierge: 'rgb(107, 26, 23)', stone: 'rgb(138, 44, 27)' };
const CO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48"><rect width="120" height="48" rx="6" fill="#1d56c9"/><text x="60" y="31" font-size="20" text-anchor="middle" fill="#fff" font-family="Arial">DEV</text></svg>';
const PHOTO = (tag: string, c1: string, c2: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000"><!-- ${tag} --><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="1600" height="1000" fill="url(#g)"/><rect x="520" y="140" width="560" height="860" fill="rgba(255,255,255,.18)"/></svg>`;

let opened = 0;
interface Open {
  skin: Skin;
  display?: Partial<Display>;
  notices?: FeedNotice[];
  extra?: Partial<Feed>;
  w?: number;
  h?: number;
  theme?: 'day' | 'night';
  q?: string;
  /** a developer logo is configured */
  logo?: boolean;
  /** the building photos: day, night, both or none */
  photos?: 'both' | 'day' | 'none';
}

async function open(page: Page, o: Open): Promise<Feed> {
  await page.setViewportSize({ width: o.w ?? 1920, height: o.h ?? 1080 });
  const photos = o.photos ?? 'both';
  const disp: Partial<Display> = { theme: o.theme ?? 'day', design: o.skin, ...(o.display ?? {}) };
  if (photos !== 'none') (disp as Record<string, unknown>).photo = 'assets/photo-day.svg';
  if (photos === 'both') (disp as Record<string, unknown>).photo_night = 'assets/photo-night.svg';
  const feed = lobbyFeed(disp, o.notices ?? LOBBY_NOTICES, o.extra ?? {});
  if (o.logo) {
    feed.board.logos = { company: 'assets/co-test.svg' };
    await page.route('**/assets/co-test.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: CO_SVG }));
  }
  await page.route('**/assets/photo-day.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO('DAYIMG', '#d9cdb8', '#8c7a5b') }));
  await page.route('**/assets/photo-night.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO('NIGHTIMG', '#0c1426', '#3a3350') }));
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&')), base()).toString());
  await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(o.logo || photos !== 'none' ? 900 : 500);
  return feed;
}

const cmd = (page: Page, c: string) => page.evaluate((x) => window.postMessage({ smplwise: 'tv', cmd: x }, location.origin), c);
const NORMAL = [LOBBY_NOTICES.find((n) => n.severity !== 'critical') as FeedNotice, ...LOBBY_NOTICES.filter((n) => n.severity !== 'critical').slice(1, 4)];
const CRIT = LOBBY_NOTICES.find((n) => n.severity === 'critical') as FeedNotice;
const shownTitle = (page: Page) => page.evaluate(() => {
  const tk = document.querySelector('#nbk[data-take="1"] .nb-take .nb-ttl');
  const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep) .nb-ttl');
  return ((tk ?? m) as HTMLElement | null)?.textContent?.trim() ?? '';
});

async function expectClean(page: Page) {
  const r = await page.evaluate(() => {
    const nb = document.getElementById('nbk') as HTMLElement;
    const bad: string[] = [];
    for (const el of nb.querySelectorAll<HTMLElement>('.nb-msg .nb-txt, .nb-q ol, .nb-take .nb-tm, .nb-ann .nb-al > div')) {
      if (el.offsetParent === null) continue;
      if (el.scrollHeight > el.clientHeight + 2) bad.push('overflow ' + el.className + ' ' + el.scrollHeight + '/' + el.clientHeight + ' long=' + nb.dataset.long + ' ' + innerWidth + 'x' + innerHeight);
    }
    // the shown message stays inside the stage (a bottom-anchored text would overflow upwards, which scrollHeight does not report)
    const st = nb.querySelector('.nb-st') as HTMLElement | null;
    const msg = nb.querySelector('.nb-st > .nb-msg:not(.nb-prep)') as HTMLElement | null;
    if (st && msg) {
      const a = st.getBoundingClientRect();
      for (const k of msg.querySelectorAll<HTMLElement>('.nb-txt > *')) {
        const q = k.getBoundingClientRect();
        if (q.height && (q.top < a.top - 2 || q.bottom > a.bottom + 2)) bad.push('outside ' + k.className);
      }
    }
    const small: string[] = [];
    const walker = document.createTreeWalker(nb, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent || '').trim();
      const el = n.parentElement as HTMLElement | null;
      if (!t || !el || el.offsetParent === null) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 20) small.push(t.slice(0, 20) + ':' + getComputedStyle(el).fontSize);
    }
    const de = document.documentElement;
    return { bad, small, scroll: de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1 };
  });
  expect(r.bad, 'nothing runs past its box').toEqual([]);
  expect(r.small, 'no text under 20 px').toEqual([]);
  expect(r.scroll, 'the page does not scroll').toBe(false);
}

const animatedProps = (page: Page) => page.evaluate(() => [...new Set(document.getAnimations()
  .filter((a) => (a.effect as KeyframeEffect).target?.closest?.('#nbk') && !(a.effect as KeyframeEffect).target?.closest?.('.nb-lay'))
  .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))))]
  .filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)));
const photoText = (page: Page) => page.evaluate(async () => {
  const im = document.querySelector('#nbk .nb-ph .nb-lay img, #nbk .nb-msg.nb-idle .nb-arch img') as HTMLImageElement | null;
  return im ? await (await fetch(im.src)).text() : '';
});

for (const skin of SKINS) {
  test.describe(skin, () => {
    for (const [name, w, h] of [['1920x1080', 1920, 1080], ['16:10 tablet 1280x800', 1280, 800], ['portrait 1080x1920', 1080, 1920], ['portrait tablet 800x1280', 800, 1280]] as const) {
      for (const theme of ['day', 'night'] as const) {
        test(`${name} ${theme}: the style replaces the classic canvas, every notice fits, nothing scrolls, the fonts are used`, async ({ page }) => {
          await open(page, { skin, w, h, theme });
          await expect(page.locator('#nbk')).toHaveAttribute('data-skin', skin);
          await expect(page.locator('#nbk')).toHaveAttribute('data-fam', 'luxury');
          await expect(page.locator('#nbk')).toHaveAttribute('data-theme', theme === 'night' ? 'dark' : 'light');
          await expect(page.locator('#cv')).toBeHidden();
          const seen = new Set<string>();
          for (let i = 0; i < LOBBY_NOTICES.length; i++) {
            seen.add(await shownTitle(page));
            await expectClean(page);
            await cmd(page, 'next');
            await page.waitForTimeout(1900);
          }
          expect(seen.size).toBe(LOBBY_NOTICES.length);
          const fam = await page.evaluate(() => getComputedStyle(document.querySelector('#nbk .nb-msg .nb-ttl, #nbk .nb-take .nb-ttl') as HTMLElement).fontFamily);
          if (skin === 'gallery') expect(fam).toContain('LobbyFrank');
          if (skin === 'concierge') expect(fam).toContain('LobbyDavid');
          if (skin === 'stone') expect(fam).toContain('Heebo');
          expect(await page.evaluate(() => document.fonts.check('400 40px LobbyFrank', 'שלום'))).toBe(true);
          expect(await page.evaluate(() => document.fonts.check('400 40px LobbyDavid', 'שלום'))).toBe(true);
        });
      }
    }

    test('urgent: the whole screen in one deep colour only in the first minute, then a regular message marked urgent', async ({ page }) => {
      // the first minute after publishing (the feed clock is 06:12:00Z)
      const fresh: FeedNotice = { ...CRIT, id: 'u-now', published_at: '2026-10-23T06:11:40Z' };
      await open(page, { skin, notices: [fresh, ...NORMAL] });
      await page.waitForTimeout(1200);
      await expect(page.locator('#nbk')).toHaveAttribute('data-take', '1');
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#nbk .nb-take') as HTMLElement).backgroundColor)).toBe(URGENT_RGB[skin]);
      await expectClean(page);
      await expect(page.locator('#nbk .nb-take .nb-sw svg')).toBeVisible(); // the SmplWise logo stays; the developer logo is intentionally not drawn on the urgent screen
      await expect(page.locator('#nbk .nb-take .nb-tl')).toContainText('הודעה דחופה');
      // an hour later: no screen of its own; it is one of the messages, marked
      const old: FeedNotice = { ...CRIT, id: 'u-old', published_at: '2026-10-23T05:00:00Z' };
      await open(page, { skin, notices: [old, ...NORMAL] });
      await expect(page.locator('#nbk')).not.toHaveAttribute('data-take', '1');
      expect(await shownTitle(page)).toBe(old.title);
      await expect(page.locator('#nbk .nb-msg[data-sev="critical"] .nb-sv')).toContainText('הודעה דחופה');
      await expectClean(page);
    });

    test('an urgent notice arriving mid-transition leaves a single clean state', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      await cmd(page, 'next');
      await page.waitForTimeout(120); // mid-transition
      const urgent: FeedNotice = { ...CRIT, id: 'u-now', published_at: '2026-10-23T06:11:50Z' };
      const feed = lobbyFeed({ theme: 'day', design: skin }, [urgent, ...NORMAL]);
      await page.unroute('**/api/v1/notices/display/lobby');
      await serveFeed(page, { ...feed, board: { ...feed.board, version: 99 } });
      await page.reload();
      await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
      await page.waitForTimeout(1800);
      await expect(page.locator('#nbk')).toHaveAttribute('data-take', '1');
      expect(await page.locator('#nbk .nb-st > .nb-msg:not(.nb-prep)').count()).toBeLessThanOrEqual(1);
      await expectClean(page);
    });

    test('reduced motion: every turn is a fade (opacity only), the background drift is off', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, { skin, notices: NORMAL });
      await expect(page.locator('#nbk')).toHaveAttribute('data-kb', '0');
      const first = await shownTitle(page);
      await cmd(page, 'next');
      await page.waitForTimeout(60);
      const props = await animatedProps(page);
      expect(props.length).toBeGreaterThan(0);
      expect(props.filter((p) => p !== 'opacity')).toEqual([]);
      await page.waitForTimeout(900);
      expect(await shownTitle(page)).not.toBe(first);
      expect(await page.locator('#nbk .nb-st > .nb-msg').count()).toBe(1);
      expect(await page.evaluate(() => document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'nb-kb' && a.playState === 'running').length)).toBe(0);
    });

    test('motion is composite-only; the Ken Burns drift is on (always) for the photo styles', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      await expect(page.locator('#nbk')).toHaveAttribute('data-kb', '1');
      await cmd(page, 'next');
      await page.waitForTimeout(250);
      const props = await animatedProps(page);
      expect(props.filter((p) => !['opacity', 'transform', 'clipPath'].includes(p)), props.join(',')).toEqual([]);
      if (skin !== 'concierge') {
        expect(await page.evaluate(() => document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'nb-kb' && a.playState === 'running').length)).toBeGreaterThan(0);
      }
      // an explicit "frozen" stops it; the measurement never does
      await open(page, { skin, notices: NORMAL, display: { live_bg: 'frozen' } as Partial<Display> });
      await expect(page.locator('#nbk')).toHaveAttribute('data-kb', '0');
      await open(page, { skin, notices: NORMAL, display: { live_bg: 'auto' } as Partial<Display> });
      await expect(page.locator('#nbk')).toHaveAttribute('data-kb', '1');
    });

    test('a long body shrinks to fit, never cut, never scrolls; the list steps aside', async ({ page }) => {
      const sentence = 'בהמשך להחלטת האסיפה הכללית יתחילו עבודות שיפוץ בלובי ובחדרי המדרגות, ויידרשו הדיירים לפנות את הציוד האישי מהמסדרונות. ';
      const mk = (n: number): FeedNotice => ({ id: 'a', severity: 'info', title: 'עבודות שיפוץ בלובי ובחדרי המדרגות', body: sentence.repeat(n).trim(), when: 'קבוע', starts_at: '2026-10-20T06:00:00Z', ends_at: null, published_at: null });
      for (const n of [1, 5, 12]) {
        await open(page, { skin, notices: [mk(n)], display: { hold: 'a' } });
        const r = await page.evaluate(() => {
          const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep)') as HTMLElement;
          return { s: parseFloat(m.style.getPropertyValue('--fs') || '1'), px: parseFloat(getComputedStyle(m.querySelector('.nb-bd') as HTMLElement).fontSize) };
        });
        expect(r.px, 'body >= 20 px').toBeGreaterThanOrEqual(20);
        if (n === 1) expect(r.s).toBe(1);
        await expectClean(page);
      }
    });

    test('light, dark, English left to right', async ({ page }) => {
      await open(page, { skin, display: { lang: 'en' }, notices: NORMAL });
      await expect(page.locator('#nbk')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('#nbk .nb-q h2')).toContainText('Up next');
      await expectClean(page);
    });

    test('both logos render when configured: the developer logo (header) and the SmplWise logo (footer); the setting hides the developer logo', async ({ page }) => {
      for (const theme of ['day', 'night'] as const) {
        await open(page, { skin, logo: true, notices: NORMAL, theme });
        const dev = page.locator('#nbk .nb-brand .nb-co img');
        const sw = page.locator('#nbk .nb-ft .nb-sw svg');
        await expect(dev).toBeVisible();
        await expect(sw).toBeVisible();
        const sizes = await page.evaluate(() => ['#nbk .nb-brand .nb-co img', '#nbk .nb-ft .nb-sw svg'].map((s) => { const r = (document.querySelector(s) as HTMLElement).getBoundingClientRect(); return [r.width, r.height]; }));
        for (const [w, h] of sizes) { expect(w).toBeGreaterThan(40); expect(h).toBeGreaterThan(18); }
        await expectClean(page);
      }
      await open(page, { skin, logo: true, notices: NORMAL, display: { blocks: { ...lobbyFeed().board.display.blocks, company_logo: false } } });
      await expect(page.locator('#nbk .nb-brand .nb-co')).toHaveCount(0);
      await expect(page.locator('#nbk .nb-ft .nb-sw svg')).toBeVisible();
    });

    test('the building photo: the day one by day, the night one at night; one photo only is darkened at night; none is a clean page', async ({ page }) => {
      test.skip(skin === 'concierge', 'Concierge draws the building only under its arch (idle, portrait): see the next test');
      await open(page, { skin, notices: NORMAL, theme: 'day' });
      expect(await photoText(page)).toContain('DAYIMG');
      await expect(page.locator('#nbk .nb-ph')).toHaveAttribute('data-dim', '0');
      await open(page, { skin, notices: NORMAL, theme: 'night' });
      expect(await photoText(page)).toContain('NIGHTIMG');
      await expect(page.locator('#nbk .nb-ph')).toHaveAttribute('data-dim', '0');
      await open(page, { skin, notices: NORMAL, theme: 'night', photos: 'day' });
      expect(await photoText(page)).toContain('DAYIMG');
      await expect(page.locator('#nbk .nb-ph')).toHaveAttribute('data-dim', '1');
      await open(page, { skin, notices: NORMAL, theme: 'day', photos: 'none' });
      await expect(page.locator('#nbk')).toHaveAttribute('data-photo', '0');
      await expectClean(page);
    });

    test('the idle face: a quiet page of its own, with the building under the arch (Concierge)', async ({ page }) => {
      for (const theme of ['day', 'night'] as const) {
        await open(page, { skin, notices: [], theme });
        await expect(page.locator('#nbk .nb-msg.nb-idle')).toHaveCount(1);
        await expectClean(page);
        if (skin === 'concierge') expect(await photoText(page)).toContain(theme === 'night' ? 'NIGHTIMG' : 'DAYIMG');
      }
    });

    test('the systems row shows only what is wrong by default; "always" shows everything', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      const states = await page.$$eval('#nbk .nb-ft .nb-info li', (l) => l.map((x) => (x as HTMLElement).dataset.state));
      expect(states.length).toBeGreaterThan(0);
      expect(states.every((s) => s === 'warn' || s === 'alarm')).toBe(true);
      await open(page, { skin, notices: NORMAL, display: { systems_status: 'always' } as Partial<Display> });
      const all = await page.$$eval('#nbk .nb-ft .nb-info li', (l) => l.map((x) => (x as HTMLElement).dataset.state));
      expect(all.length).toBeGreaterThanOrEqual(states.length);
      // with nothing wrong the row is empty, not a row of green
      const healthy = lobbyFeed({ theme: 'day', design: skin }, NORMAL, { info: [{ kind: 'elevator', label: 'מעלית', text: 'פועלת', state: 'ok' }] });
      await page.unroute('**/api/v1/notices/display/lobby');
      await serveFeed(page, healthy);
      await page.reload();
      await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
      await page.waitForTimeout(600);
      expect(await page.locator('#nbk .nb-ft .nb-info li').count()).toBe(0);
    });

    test('the news: one small headline at a time, changing with a fade', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      const on = () => page.$$eval('#nbk .nb-ft .nb-it.nb-on', (l) => l.map((x) => (x.textContent || '').trim()));
      const a = await on();
      expect(a.length).toBe(1);
      await page.waitForTimeout(9800);
      const b = await on();
      expect(b.length).toBe(1);
      expect(b[0]).not.toBe(a[0]);
    });

    test('Stone: the photo moves a little with every turn (parallax)', async ({ page }) => {
      test.skip(skin !== 'stone');
      await open(page, { skin, notices: NORMAL });
      await cmd(page, 'next');
      await page.waitForTimeout(300);
      const moving = await page.evaluate(() => document.querySelector('#nbk .nb-ph')?.getAnimations().some((a) => (a.effect as KeyframeEffect).getKeyframes().some((k) => 'transform' in k)));
      expect(moving).toBe(true);
    });
  });
}
