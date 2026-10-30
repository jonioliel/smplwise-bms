import { test, expect, type Page } from '@playwright/test';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

// LOBBY-STYLES-2300: the hi-tech lobby notice-board styles (Lumen, Axis, Prism) on the product TV page, from the owner-approved mock-up
// (private/design-system-2026-10-27/round7/noticeboard-hitech) and the owner decisions of 2026-10-30: four canvases, light / dark, no scroll,
// no text under 20 px, an urgent notice mid-transition, reduced motion = fades, the long body shrinks, both logos (SmplWise and the developer's),
// the live-background setting, he / en.  Needs the built UI (npm run build; preview).
//   npx playwright test tests/layout-noticeboard-hitech-2300.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));
test.describe.configure({ timeout: 90_000 });

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const SKINS = ['lumen', 'axis', 'prism'] as const;
type Skin = (typeof SKINS)[number];
const CO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 48"><rect width="120" height="48" rx="6" fill="#1d56c9"/><text x="60" y="31" font-size="20" text-anchor="middle" fill="#fff" font-family="Arial">DEV</text></svg>';

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
}

async function open(page: Page, o: Open): Promise<Feed> {
  await page.setViewportSize({ width: o.w ?? 1920, height: o.h ?? 1080 });
  const feed = lobbyFeed({ theme: o.theme ?? 'day', design: o.skin, ...(o.display ?? {}) }, o.notices ?? LOBBY_NOTICES, o.extra ?? {});
  if (o.logo) {
    feed.board.logos = { company: 'assets/co-test.svg' };
    await page.route('**/assets/co-test.svg', (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: CO_SVG }));
  }
  await serveFeed(page, feed);
  await page.goto(new URL(tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&')), base()).toString());
  await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(o.logo ? 900 : 500);
  return feed;
}

const cmd = (page: Page, c: string) => page.evaluate((x) => window.postMessage({ smplwise: 'tv', cmd: x }, location.origin), c);
const NORMAL = [LOBBY_NOTICES.find((n) => n.severity !== 'critical') as FeedNotice, ...LOBBY_NOTICES.filter((n) => n.severity !== 'critical').slice(1, 4)];
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
      if (el.scrollHeight > el.clientHeight + 2) bad.push('overflow ' + el.className + ' ' + el.scrollHeight + '/' + el.clientHeight + ' long=' + nb.dataset.long + ' cols=' + (el.closest('.nb-msg') as HTMLElement | null)?.dataset.cols + ' fit=' + (el.closest('.nb-msg') as HTMLElement | null)?.dataset.fit + ' ' + innerWidth + 'x' + innerHeight);
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
  .filter((a) => (a.effect as KeyframeEffect).target?.closest?.('#nbk') && !(a.effect as KeyframeEffect).target?.closest?.('.nb-cove, .nb-amb, .nb-tbg'))
  .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))))]
  .filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)));

for (const skin of SKINS) {
  test.describe(skin, () => {
    for (const [name, w, h] of [['1920x1080', 1920, 1080], ['16:10 tablet 1280x800', 1280, 800], ['portrait 1080x1920', 1080, 1920], ['portrait tablet 800x1280', 800, 1280]] as const) {
      for (const theme of ['day', 'night'] as const) {
        test(`${name} ${theme}: the style replaces the classic canvas, every notice fits, nothing scrolls, the lobby font is used`, async ({ page }) => {
          await open(page, { skin, w, h, theme });
          await expect(page.locator('#nbk')).toHaveAttribute('data-skin', skin);
          await expect(page.locator('#nbk')).toHaveAttribute('data-fam', 'hitech');
          await expect(page.locator('#nbk')).toHaveAttribute('data-theme', theme === 'night' ? 'dark' : 'light');
          await expect(page.locator('#cv')).toBeHidden();
          const seen = new Set<string>();
          for (let i = 0; i < LOBBY_NOTICES.length; i++) {
            seen.add(await shownTitle(page));
            await expectClean(page);
            await cmd(page, 'next');
            await page.waitForTimeout(1700);
          }
          expect(seen.size).toBe(LOBBY_NOTICES.length);
          const fam = await page.evaluate(() => getComputedStyle(document.querySelector('#nbk .nb-ft') as HTMLElement).fontFamily);
          expect(fam).toContain('LobbySans');
          expect(await page.evaluate(() => document.fonts.check('400 40px LobbySans', 'שלום'))).toBe(true);
        });
      }
    }

    test('an urgent notice in the rotation takes the whole screen (deep red); an urgent one arriving mid-transition leaves a single clean state', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      await cmd(page, 'next');
      await page.waitForTimeout(120); // mid-transition
      const urgent: FeedNotice = { ...LOBBY_NOTICES.find((n) => n.severity === 'critical') as FeedNotice, id: 'u-now' };
      const feed = lobbyFeed({ theme: 'day', design: skin }, [urgent, ...NORMAL]);
      await page.unroute('**/api/v1/notices/display/lobby');
      await serveFeed(page, { ...feed, board: { ...feed.board, version: 99 } });
      await page.reload();
      await page.waitForSelector('#nbk[data-ready="1"]', { state: 'attached' });
      await page.waitForTimeout(1800);
      await expect(page.locator('#nbk')).toHaveAttribute('data-take', '1');
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#nbk .nb-take') as HTMLElement).backgroundColor)).toMatch(/^rgb\((9\d|1[0-9]\d), \d{1,2}, \d{1,2}\)$/); // a deep red: strong red, almost no green or blue
      await expectClean(page);
      await expect(page.locator('#nbk .nb-take .nb-sw svg')).toBeVisible(); // the SmplWise logo stays; the developer logo is intentionally not drawn on the urgent screen
    });

    test('reduced motion: every turn is a fade (opacity only), the ambient layers are frozen', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, { skin, notices: NORMAL });
      const first = await shownTitle(page);
      await cmd(page, 'next');
      await page.waitForTimeout(60);
      const props = await animatedProps(page);
      expect(props.length).toBeGreaterThan(0);
      expect(props.filter((p) => p !== 'opacity')).toEqual([]);
      await page.waitForTimeout(700);
      expect(await shownTitle(page)).not.toBe(first);
      expect(await page.locator('#nbk .nb-st > .nb-msg').count()).toBe(1);
      expect(await page.evaluate(() => getComputedStyle(document.querySelector('#nbk .nb-amb i') as HTMLElement).animationPlayState)).toBe('paused');
    });

    test('motion is composite-only', async ({ page }) => {
      await open(page, { skin, notices: NORMAL });
      await cmd(page, 'next');
      await page.waitForTimeout(250);
      const props = await animatedProps(page);
      expect(props.filter((p) => !['opacity', 'transform', 'clipPath'].includes(p)), props.join(',')).toEqual([]);
    });

    test('a long body shrinks to fit (22 px floor), never cut, never scrolls; the list steps aside', async ({ page }) => {
      const sentence = 'בהמשך להחלטת האסיפה הכללית יתחילו עבודות שיפוץ בלובי ובחדרי המדרגות, ויידרשו הדיירים לפנות את הציוד האישי מהמסדרונות. ';
      const mk = (n: number): FeedNotice => ({ id: 'a', severity: 'info', title: 'עבודות שיפוץ בלובי ובחדרי המדרגות', body: sentence.repeat(n).trim(), when: 'קבוע', starts_at: '2026-10-20T06:00:00Z', ends_at: null, published_at: null });
      const st = () => page.evaluate(() => {
        const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep)') as HTMLElement;
        const bd = m.querySelector('.nb-bd') as HTMLElement;
        return { s: parseFloat(m.style.getPropertyValue('--fs') || '1'), px: parseFloat(getComputedStyle(bd).fontSize), cols: m.dataset.cols ?? '1' };
      });
      for (const n of [1, 5, 12]) {
        await open(page, { skin, notices: [mk(n)], display: { hold: 'a' } });
        const r = await st();
        expect(r.px, 'body >= 20 px').toBeGreaterThanOrEqual(20);
        if (n === 1) expect(r.s).toBe(1);
        if (skin === 'axis') {
          const dbg = await page.evaluate(() => {
            const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep)') as HTMLElement;
            const t = m.querySelector('.nb-txt') as HTMLElement;
            const bd = m.querySelector('.nb-bd') as HTMLElement;
            const ttl = m.querySelector('.nb-ttl') as HTMLElement;
            const st = (document.querySelector('#nbk .nb-st') as HTMLElement).getBoundingClientRect();
            return [m.className, m.style.cssText, t.scrollHeight, t.clientHeight, bd.getBoundingClientRect().height, ttl.getBoundingClientRect().height, bd.getBoundingClientRect().width, st.height, getComputedStyle(bd).fontSize, getComputedStyle(t).display, getComputedStyle(m).position].join(' | ');
          });
          console.log('DBG n=' + n + ' ' + dbg);
          const sweep = await page.evaluate(() => {
            const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep)') as HTMLElement;
            const t = m.querySelector('.nb-txt') as HTMLElement;
            const root = document.getElementById('nbk') as HTMLElement;
            const out: string[] = [];
            for (const f of [1, 0.84, 0.7, 0.55]) {
              m.style.setProperty('--fs', String(f));
              out.push(f + ':' + t.scrollHeight + '/' + t.clientHeight);
            }
            m.dataset.cols = '2';
            for (const f of [1, 0.7, 0.55]) { m.style.setProperty('--fs', String(f)); out.push('c2 ' + f + ':' + t.scrollHeight + '/' + t.clientHeight); }
            root.dataset.long = '1';
            for (const f of [1, 0.7, 0.55]) { m.style.setProperty('--fs', String(f)); out.push('L ' + f + ':' + t.scrollHeight + '/' + t.clientHeight); }
            return out.join(' ');
          });
          console.log('SWEEP n=' + n + ' ' + sweep);
        }
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
      await open(page, { skin, logo: true, notices: NORMAL });
      for (const theme of ['day', 'night'] as const) {
        if (theme === 'night') await open(page, { skin, logo: true, notices: NORMAL, theme });
        const dev = page.locator('#nbk .nb-brand .nb-co img');
        const sw = page.locator('#nbk .nb-ft .nb-sw svg');
        await expect(dev).toBeVisible();
        await expect(sw).toBeVisible();
        const sizes = await page.evaluate(() => ['#nbk .nb-brand .nb-co img', '#nbk .nb-ft .nb-sw svg'].map((s) => { const r = (document.querySelector(s) as HTMLElement).getBoundingClientRect(); return [r.width, r.height]; }));
        for (const [w, h] of sizes) { expect(w).toBeGreaterThan(40); expect(h).toBeGreaterThan(18); }
      }
      await open(page, { skin, logo: true, notices: NORMAL, display: { blocks: { ...lobbyFeed().board.display.blocks, company_logo: false } } });
      await expect(page.locator('#nbk .nb-brand .nb-co')).toHaveCount(0);
      await expect(page.locator('#nbk .nb-ft .nb-sw svg')).toBeVisible();
    });

    test('live background: the setting is carried (frozen / off / full) and off removes the ambient layers', async ({ page }) => {
      await open(page, { skin, notices: NORMAL, display: { live_bg: 'off' } as Partial<Display> });
      await expect(page.locator('#nbk')).toHaveAttribute('data-fx', 'off');
      await open(page, { skin, notices: NORMAL, display: { live_bg: 'frozen' } as Partial<Display> });
      await expect(page.locator('#nbk')).toHaveAttribute('data-fx', 'low');
      await open(page, { skin, notices: NORMAL, display: { live_bg: 'full' } as Partial<Display> });
      await expect(page.locator('#nbk')).toHaveAttribute('data-fx', 'high');
    });

    test('Lumen: the light bar measures the notice time on the wall', async ({ page }) => {
      test.skip(skin !== 'lumen');
      await open(page, { skin, notices: NORMAL, q: 'nbrot=8' });
      await expect(page.locator('#nbk .nb-cove')).toBeVisible();
    });
  });
}
