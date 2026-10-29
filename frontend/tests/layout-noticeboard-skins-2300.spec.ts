import { test, expect, type Page } from '@playwright/test';
import { LOBBY_NOTICES, lobbyFeed, serveFeed, tvUrl } from './notice-tv-fixtures';
import type { Display, Feed, FeedNotice } from '../src/notice-tv/tv-logic';

// NOTICEBOARD-STYLES-2300 (release 2.30.0): the Ink (e-paper station display) and Sign (wayfinding signage) notice-board styles on the product TV page,
// from the owner-approved mock-up (private/design-system-2026-10-27/round7/noticeboard-styles) and the owner decisions of 2026-10-30:
// rotation (Ink: the refresh bar and a 1 s 7 % ghost; Sign: rotating strips), the urgent take-over (also arriving in the middle of a transition),
// reduced motion (fades only), a long body that SHRINKS to a readable floor, 1920x1080 / 1280x800 / portrait canvases, composite-only motion, no
// scrolling, he / en, light / dark, the announcement, the idle board, the promo slide with ink dots, the stale network line.
// Needs the built UI (npm run build; preview).
//   npx playwright test tests/layout-noticeboard-skins-2300.spec.ts --project=desktop

test.beforeEach(() => test.skip(test.info().project.name !== 'desktop', 'desktop Chromium only'));
test.describe.configure({ timeout: 90_000 });

const base = () => (test.info().project.use.baseURL as string | undefined) || process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';
const SKINS = ['ink', 'sign'] as const;
type Skin = (typeof SKINS)[number];

let opened = 0;
interface Open {
  skin: Skin;
  display?: Partial<Display>;
  notices?: FeedNotice[];
  extra?: Partial<Feed>;
  w?: number;
  h?: number;
  theme?: 'day' | 'night';
  /** extra query (test hooks) */
  q?: string;
  /** false: the real clock (timers run: rotation, drift); default: `clock=fixed` (09:12 on 23.10.2026, no timers) */
  fixed?: boolean;
  /** wait for the classic / V2 canvas instead of the style's */
  waitFor?: string;
}

async function open(page: Page, o: Open): Promise<Feed> {
  await page.setViewportSize({ width: o.w ?? 1920, height: o.h ?? 1080 });
  const feed = lobbyFeed({ theme: o.theme ?? 'day', design: o.skin, ...(o.display ?? {}) }, o.notices ?? LOBBY_NOTICES, o.extra ?? {});
  await serveFeed(page, feed);
  let url = tvUrl([o.q ?? '', 'n=' + ++opened].filter(Boolean).join('&'));
  if (o.fixed === false) url = url.replace('&clock=fixed', '');
  await page.goto(new URL(url, base()).toString());
  await page.waitForSelector(o.waitFor ?? '#nbk[data-ready="1"] .nb-st .nb-msg', { state: 'attached' });
  await page.evaluate(async () => { await document.fonts.ready; });
  await page.waitForTimeout(500);
  return feed;
}

const cmd = (page: Page, c: string) => page.evaluate((x) => window.postMessage({ smplwise: 'tv', cmd: x }, location.origin), c);
const title = (page: Page) => page.locator('#nbk .nb-st > .nb-msg:not(.nb-prep):not(.nb-ghost) .nb-ttl').first().innerText();
const FX = '#nbk .nb-sweep, #nbk .nb-fx:not(.nb-prepfx), #nbk .nb-wipe';

/** Everything the screen must never do: scroll the page, let a message or the list run past its box, draw text under 20 canvas px. */
async function expectClean(page: Page) {
  const r = await page.evaluate(() => {
    const nb = document.getElementById('nbk') as HTMLElement;
    const bad: string[] = [];
    for (const el of nb.querySelectorAll<HTMLElement>('.nb-msg, .nb-msg .nb-panel, .nb-msg .nb-txt, .nb-q ol, .nb-take .nb-tm, .nb-ann .nb-al > div')) {
      if (el.offsetParent === null) continue;
      if (el.scrollHeight > el.clientHeight + 2) bad.push('overflow ' + el.className);
    }
    const small: string[] = [];
    const walker = document.createTreeWalker(nb, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent || '').trim();
      const el = n.parentElement as HTMLElement | null;
      if (!t || !el || el.offsetParent === null) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs < 20) small.push(t.slice(0, 20) + ':' + fs);
    }
    const de = document.documentElement;
    return { bad, small, scroll: de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1 };
  });
  expect(r.bad, 'nothing runs past its box').toEqual([]);
  expect(r.small, 'no text under 20 px').toEqual([]);
  expect(r.scroll, 'the page does not scroll').toBe(false);
}

/** The properties every running animation inside the board animates. */
const animatedProps = (page: Page) => page.evaluate(() => [...new Set(document.getAnimations()
  .filter((a) => (a.effect as KeyframeEffect).target?.closest?.('#nbk'))
  .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes().flatMap((k) => Object.keys(k))))]
  .filter((p) => !['offset', 'easing', 'composite', 'computedOffset'].includes(p)));

for (const skin of SKINS) {
  test.describe(skin, () => {
    for (const [name, w, h] of [['1920x1080', 1920, 1080], ['16:10 tablet 1280x800', 1280, 800], ['portrait 1080x1920', 1080, 1920], ['portrait tablet 800x1280', 800, 1280]] as const) {
      test(`${name}: the style replaces the classic canvas, every notice type fits, nothing scrolls`, async ({ page }) => {
        await open(page, { skin, w, h });
        await expect(page.locator('#nbk')).toHaveAttribute('data-skin', skin);
        await expect(page.locator('#nbk')).toBeVisible();
        await expect(page.locator('#cv')).toBeHidden();
        await expect(page.locator('#nbk')).toHaveAttribute('data-orient', h > w ? 'p' : 'l');
        // the urgent notice is first in the rotation; step through all seven (info, important, urgent, window) and check each one
        const seen = new Set<string>();
        for (let i = 0; i < LOBBY_NOTICES.length; i++) {
          seen.add(await title(page));
          await expectClean(page);
          await cmd(page, 'next');
          await page.waitForTimeout(1500);
        }
        expect(seen.size).toBe(LOBBY_NOTICES.length);
        await expect(page.locator('#nbk .nb-st > .nb-msg')).toHaveCount(1);
      });
    }

    test('the "Up next" list: up to 4 rows and "and N more" on 16:9, up to 5 on a 16:10 tablet, fewer in portrait; never scrolls', async ({ page }) => {
      const rows = async () => {
        const n = await page.locator('#nbk .nb-q ol li:not(.nb-more)').count();
        const more = await page.locator('#nbk .nb-q ol li.nb-more').innerText();
        return { n, more: Number(/\d+/.exec(more)?.[0]) };
      };
      await open(page, { skin });
      let r = await rows();
      expect(r.n).toBeGreaterThanOrEqual(3);
      expect(r.n).toBeLessThanOrEqual(4);
      expect(r.n + r.more).toBe(LOBBY_NOTICES.length - 1); // every other notice is a row or counted
      await expect(page.locator('#nbk .nb-q h2')).toContainText('בהמשך');
      await open(page, { skin, w: 1280, h: 800 });
      r = await rows();
      expect(r.n).toBeGreaterThanOrEqual(4);
      expect(r.n).toBeLessThanOrEqual(5);
      expect(r.n + r.more).toBe(LOBBY_NOTICES.length - 1);
      await open(page, { skin, w: 1080, h: 1920 });
      r = await rows();
      expect(r.n).toBeGreaterThanOrEqual(2);
      expect(r.n).toBeLessThanOrEqual(3);
      expect(r.n + r.more).toBe(LOBBY_NOTICES.length - 1);
      await open(page, { skin, notices: [LOBBY_NOTICES[2]] });
      await expect(page.locator('#nbk .nb-q')).toBeHidden(); // one notice: no list
    });

    test('light and dark, Hebrew and English (the English board is left to right)', async ({ page }) => {
      await open(page, { skin, theme: 'night' });
      await expect(page.locator('#nbk')).toHaveAttribute('data-theme', 'dark');
      await expect(page.locator('#nbk')).toHaveAttribute('dir', 'rtl');
      await open(page, { skin, display: { lang: 'en' } });
      await expect(page.locator('#nbk')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('#nbk')).toHaveAttribute('data-theme', 'light');
      await expect(page.locator('#nbk .nb-q h2')).toContainText('Up next');
      await expect(page.locator('#nbk .nb-ft .nb-lb')).toContainText('News');
      await expectClean(page);
    });

    test('a long body SHRINKS to fit (not pages, not cut) down to a readable floor; beyond it the body is cut by whole lines', async ({ page }) => {
      const sentence = 'בהמשך להחלטת האסיפה הכללית יתחילו עבודות שיפוץ בלובי ובחדרי המדרגות, ויידרשו הדיירים לפנות את הציוד האישי מהמסדרונות. ';
      const mk = (id: string, n: number, ttl = 'עבודות שיפוץ בלובי ובחדרי המדרגות'): FeedNotice => ({
        id, severity: 'info', title: ttl, body: sentence.repeat(n).trim(), when: 'קבוע', starts_at: '2026-10-20T06:00:00Z', ends_at: null, published_at: null,
      });
      const fs = () => page.evaluate(() => {
        const m = document.querySelector('#nbk .nb-st > .nb-msg:not(.nb-prep):not(.nb-ghost)') as HTMLElement;
        const bd = m.querySelector('.nb-bd') as HTMLElement;
        return { s: parseFloat(m.style.getPropertyValue('--fs') || '1'), px: parseFloat(getComputedStyle(bd).fontSize), clamp: m.dataset.clamp === '1', over: m.scrollHeight > m.clientHeight + 1 };
      });
      const floor = skin === 'ink' ? 46 * 0.64 : 44 * 0.64;
      // a short body: full size
      await open(page, { skin, notices: [mk('a', 1, 'שיפוץ בלובי')], display: { hold: 'a' } });
      expect((await fs()).s).toBe(1);
      // a long body: smaller than 1, at least the floor, shown whole (no cut)
      await open(page, { skin, notices: [mk('a', 5)], display: { hold: 'a' } });
      let r = await fs();
      expect(r.s).toBeLessThan(1);
      expect(r.s).toBeGreaterThanOrEqual(0.64);
      expect(r.clamp).toBe(false);
      expect(r.over).toBe(false);
      expect(r.px).toBeGreaterThanOrEqual(floor - 0.2);
      await expectClean(page);
      // an extreme body (the 2000-character limit): at the floor, cut by whole lines
      await open(page, { skin, notices: [mk('a', 17)], display: { hold: 'a' } });
      r = await fs();
      expect(r.s).toBe(0.64);
      expect(r.clamp).toBe(true);
      expect(r.over).toBe(false);
      expect(r.px).toBeGreaterThanOrEqual(floor - 0.2);
      await expectClean(page);
      // the same in portrait
      await open(page, { skin, notices: [mk('a', 9)], display: { hold: 'a' }, w: 1080, h: 1920 });
      r = await fs();
      expect(r.s).toBeGreaterThanOrEqual(0.64);
      expect(r.over).toBe(false);
      await expectClean(page);
    });

    test('reduced motion: the turn is a fade only (no bar, no strips, no wipe frame)', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, { skin });
      const first = await title(page);
      await cmd(page, 'next');
      await page.waitForTimeout(60);
      expect(await page.evaluate((sel) => document.querySelectorAll(sel).length, FX)).toBe(0);
      const props = await animatedProps(page);
      expect(props.length).toBeGreaterThan(0);
      expect(props.every((p) => p === 'opacity')).toBe(true);
      await page.waitForTimeout(500);
      expect(await title(page)).not.toBe(first);
      await expect(page.locator('#nbk .nb-st > .nb-msg')).toHaveCount(1);
    });

    test('motion is composite only (transform and opacity) and a turn leaves nothing behind', async ({ page }) => {
      await open(page, { skin });
      const first = await title(page);
      await cmd(page, 'next');
      const props = new Set<string>();
      for (let t = 0; t < 14; t++) {
        (await animatedProps(page)).forEach((x) => props.add(x));
        await page.waitForTimeout(80);
      }
      expect([...props].filter((p) => p !== 'transform' && p !== 'opacity')).toEqual([]);
      expect(props.has('transform')).toBe(true);
      await page.waitForTimeout(1800);
      expect(await title(page)).not.toBe(first);
      expect(await page.evaluate((sel) => document.querySelectorAll(sel).length, FX)).toBe(0);
      await expect(page.locator('#nbk .nb-st > .nb-msg')).toHaveCount(1);
    });

    test('the urgent take-over (first minute after publishing) covers the screen, in the style, on one screen', async ({ page }) => {
      const notices = LOBBY_NOTICES.map((n) => (n.severity === 'critical' ? { ...n, published_at: '2026-10-23T06:11:30Z' } : n));
      await open(page, { skin, notices });
      await expect(page.locator('#nbk')).toHaveAttribute('data-take', '1');
      const a = (await page.locator('#nbk .nb-take').boundingBox())!;
      const b = (await page.locator('#nbk').boundingBox())!;
      expect(Math.abs(a.width - b.width)).toBeLessThan(2);
      expect(Math.abs(a.height - b.height)).toBeLessThan(2);
      await expect(page.locator('#nbk .nb-take .nb-ttl')).toContainText('הפסקת מים');
      await expect(page.locator('#nbk .nb-take')).toContainText('הודעה דחופה');
      await expectClean(page);
      // the rotation stands still while it is up
      const before = await title(page);
      await cmd(page, 'next');
      await page.waitForTimeout(800);
      expect(await title(page)).toBe(before);
    });

    test('an urgent notice arriving in the MIDDLE of a transition: the transition ends at once, the take-over is up, nothing is left over', async ({ page }) => {
      const feed = lobbyFeed({ theme: 'day', design: skin });
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.route('**/api/v1/notices/boards/b1/preview', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) }));
      await page.goto(new URL(`notice-tv.html?board=lobby&clock=fixed&embed=1&preview=b1&n=${++opened}`, base()).toString());
      await page.waitForSelector('#nbk[data-ready="1"] .nb-st .nb-msg', { state: 'attached' });
      await page.evaluate(async () => { await document.fonts.ready; });
      await page.waitForTimeout(400);
      await cmd(page, 'next');
      await page.waitForTimeout(120); // inside the 560 ms refresh / the strips' turn
      expect(await page.evaluate((sel) => document.querySelectorAll(sel).length, FX)).toBeGreaterThan(0);
      // the board is told about a new urgent notice (the preview route re-reads the feed)
      feed.board.version += 1;
      feed.notices = feed.notices.map((n) => (n.severity === 'critical' ? { ...n, published_at: '2026-10-23T06:11:50Z' } : n));
      await page.evaluate(() => window.postMessage({ smplwise: 'tv', display: {} }, location.origin));
      await page.waitForTimeout(1600);
      await expect(page.locator('#nbk')).toHaveAttribute('data-take', '1');
      await expect(page.locator('#nbk .nb-take .nb-ttl')).toContainText('הפסקת מים');
      expect(await page.evaluate((sel) => document.querySelectorAll(sel + ', #nbk .nb-ghost').length, FX)).toBe(0);
      // nothing of the interrupted turn keeps moving on the stage (the symbol of the take-over beats on its own layer)
      expect(await page.evaluate(() => document.getAnimations().filter((a) => (a.effect as KeyframeEffect).target?.closest?.('#nbk .nb-st')).length)).toBe(0);
      await expectClean(page);
    });

    test('a voice announcement as text: every language its own block, the machine-translation mark, one screen', async ({ page }) => {
      await open(page, {
        skin,
        extra: {
          announcement: {
            id: 'a1', critical: false, until: '2026-10-23T06:40:00Z',
            texts: [
              { language: 'he', text: 'נא לפנות את החניון עד השעה עשר.' },
              { language: 'en', text: 'Please clear the car park by ten o\'clock.', machine: true },
              { language: 'ru', text: 'Пожалуйста, освободите парковку до десяти часов.', machine: true },
              { language: 'ar', text: 'يرجى إخلاء موقف السيارات قبل الساعة العاشرة.', machine: true },
            ],
          },
        },
      });
      await expect(page.locator('#nbk')).toHaveAttribute('data-ann', '1');
      await expect(page.locator('#nbk .nb-ann .nb-al > div')).toHaveCount(4);
      await expect(page.locator('#nbk .nb-ann')).toContainText('Machine translation');
      await expect(page.locator('#nbk .nb-ann')).toContainText('Машинный перевод');
      await expect(page.locator('#nbk .nb-ann')).toContainText('ترجمة آلية');
      await expect(page.locator('#nbk .nb-ann .nb-al > div[lang="he"] small')).not.toContainText('אוטומטי'); // the source language carries no mark
      await expect(page.locator('#nbk .nb-ann .nb-lock')).toContainText('09:40');
      await expect(page.locator('#nbk .nb-ann .nb-al > div[lang="en"]')).toHaveAttribute('dir', 'ltr');
      await expectClean(page);
    });

    test('no notices: the idle board; the list is gone', async ({ page }) => {
      await open(page, { skin, notices: [] });
      await expect(page.locator('#nbk .nb-msg.nb-idle')).toHaveCount(1);
      await expect(page.locator('#nbk .nb-msg.nb-idle')).toContainText('אין הודעות כרגע');
      await expect(page.locator('#nbk .nb-q')).toBeHidden();
      await expectClean(page);
    });

    test('a promo slide with a picture: Ink dithers it to black and white ink dots; Sign shows it in colour', async ({ page }) => {
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAGCAIAAABfS1c1AAAAEklEQVR4nGNgGAWjYBSMglEwCgAAAAoAAbc5OloAAAAASUVORK5CYII=', 'base64');
      await page.route('**/api/v1/notices/display/lobby/slide/s1', (r) => r.fulfill({ status: 200, contentType: 'image/png', body: png }));
      await open(page, {
        skin,
        display: { hold: 'slide:s1', blocks: { promo: true } as Display['blocks'] },
        extra: { slides: [{ id: 's1', title: 'הגינה החדשה בלובי', text: 'שתלנו עצי זית וספסלים בכניסה.', image: 'api/v1/notices/display/lobby/slide/s1' }] },
      });
      const pic = page.locator('#nbk .nb-st > .nb-msg.nb-slide .nb-pic img');
      await expect(pic).toHaveCount(1);
      const filter = await pic.evaluate((el) => getComputedStyle(el).filter);
      if (skin === 'ink') expect(filter).toContain('grayscale');
      else expect(filter).toBe('none');
      await expectClean(page);
    });

    test('the network line: live, then "not updated since" after three missed polls', async ({ page }) => {
      const feed = lobbyFeed({ theme: 'day', design: skin });
      let ok = true;
      await page.route('**/api/v1/notices/boards/b1/preview', (r) => (ok
        ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) })
        : r.fulfill({ status: 503, body: '' })));
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(new URL(`notice-tv.html?board=lobby&clock=fixed&embed=1&preview=b1&n=${++opened}`, base()).toString());
      await page.waitForSelector('#nbk[data-ready="1"] .nb-st .nb-msg', { state: 'attached' });
      await expect(page.locator('#nbk .nb-live')).toHaveAttribute('data-net', 'live');
      await expect(page.locator('#nbk .nb-live .nb-st8')).toContainText('עודכן');
      ok = false;
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.postMessage({ smplwise: 'tv', display: {} }, location.origin));
        await page.waitForTimeout(400);
      }
      await expect(page.locator('#nbk .nb-live')).toHaveAttribute('data-net', 'stale');
      await expect(page.locator('#nbk .nb-live .nb-st8')).toContainText('לא מעודכן מ-');
      await expectClean(page);
    });
  });
}

test('Ink: rotation with the refresh bar, and the title of the old page stays as a faint ghost (7 %) for about a second', async ({ page }) => {
  await open(page, { skin: 'ink', fixed: false, q: 'nbrot=1', display: { burn_in: { shift: false } } });
  const first = await title(page);
  await page.waitForSelector('#nbk .nb-sweep', { state: 'attached', timeout: 8000 });
  const ghost = page.locator('#nbk .nb-ghost');
  await ghost.waitFor({ state: 'attached', timeout: 4000 });
  const op = await ghost.evaluate((el) => parseFloat(getComputedStyle(el).opacity));
  expect(op).toBeLessThanOrEqual(0.075);
  expect(op).toBeGreaterThan(0.02);
  await expect(ghost).toHaveCount(0, { timeout: 3000 }); // gone after about 1.1 s
  expect(await title(page)).not.toBe(first);
});

test('Sign: rotation by rotating strips - 8 prisms on the landscape canvas, 6 in portrait - and nothing is left behind', async ({ page }) => {
  await open(page, { skin: 'sign', fixed: false, q: 'nbrot=1', display: { burn_in: { shift: false } } });
  const first = await title(page);
  await page.waitForSelector('#nbk .nb-fx:not(.nb-prepfx)', { state: 'attached', timeout: 8000 });
  expect(await page.locator('#nbk .nb-fx .nb-slat').count()).toBe(8);
  await expect(page.locator('#nbk .nb-fx:not(.nb-prepfx)')).toHaveCount(0, { timeout: 4000 });
  expect(await title(page)).not.toBe(first);
  await expect(page.locator('#nbk .nb-st > .nb-msg:not(.nb-prep)')).toHaveCount(1);
  await open(page, { skin: 'sign', fixed: false, q: 'nbrot=1', w: 1080, h: 1920, display: { burn_in: { shift: false } } });
  await page.waitForSelector('#nbk .nb-fx:not(.nb-prepfx)', { state: 'attached', timeout: 8000 });
  expect(await page.locator('#nbk .nb-fx .nb-slat').count()).toBe(6);
});

test('Sign: the strips turn right to left in Hebrew and left to right in English', async ({ page }) => {
  const order = async (lang: 'he' | 'en') => {
    await open(page, { skin: 'sign', fixed: false, q: 'nbrot=1', display: { lang, burn_in: { shift: false } } });
    await page.waitForSelector('#nbk .nb-fx:not(.nb-prepfx)', { state: 'attached', timeout: 8000 });
    return page.evaluate(() => {
      const s = [...document.querySelectorAll<HTMLElement>('#nbk .nb-fx:not(.nb-prepfx) .nb-slat')];
      const ds = s.map((e) => (e.getAnimations()[0]?.effect?.getTiming().delay as number) ?? 0);
      const xs = s.map((e) => parseFloat(e.style.left));
      const first = xs[ds.indexOf(Math.min(...ds))];
      return first > xs.reduce((a, b) => a + b, 0) / xs.length ? 'right-first' : 'left-first';
    });
  };
  expect(await order('he')).toBe('right-first');
  expect(await order('en')).toBe('left-first');
});

test('the style is chosen per board: classic and V2 are untouched, and `?design=` is a test hook', async ({ page }) => {
  await open(page, { skin: 'ink', display: { design: 'classic' }, waitFor: '#cv[data-tpl] .pg .hd' });
  await expect(page.locator('#cv')).toBeVisible();
  await expect(page.locator('#nbk')).toBeHidden();
  await expect(page.locator('#cv')).toHaveAttribute('data-design', 'classic');
  await open(page, { skin: 'ink', display: { design: 'v2' }, waitFor: '#cv[data-design="v2"] .pg .b2hd' });
  await expect(page.locator('#cv')).toHaveAttribute('data-design', 'v2');
  await expect(page.locator('#nbk')).toBeHidden();
  await open(page, { skin: 'ink', display: { design: 'classic' }, q: 'design=sign' });
  await expect(page.locator('#nbk')).toHaveAttribute('data-skin', 'sign');
});
