import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { GAP_PERMS, mockGaps, type GapOpts } from './home-v3-gaps-mocks';

// HOME-V3-GAPS-2436: the home interface v3 mockup's remaining gaps (docs/changes/HOME-V3-GAPS-2436.md) -
// * "התראות": "מה מגיע אליי" and "יומן הבית" in the head; the personal menu's "ההתראות שלי";
// * "ההתראות שלי": the personal alarm code row (owner, round 29 answer 7) - the alarm screen's own sheet;
// * "מים": "פתח פנייה לאינסטלטור" on a suspected leak; "מערכות הבית": "דווח על תקלה" - the tickets module's new-ticket sheet;
// * the home diary's "אזעקה" filter (GET /home/alarm-log).
// Mocked backend (tests/home-v3-gaps-mocks.ts); stamps relative to the clock, never to an hour of the day. Screenshots: test-results/home-v3-gaps/.

const SHOTS = 'test-results/home-v3-gaps';
const SIZES = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'tablet', width: 1024, height: 768 }, { id: 'phone', width: 390, height: 844 }];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'WebRTC', 'entity', 'ישות', 'undefined', 'NaN', 'alarm_control_panel'];
const home = (page: Page) => page.locator('sw-home');

async function open(page: Page, route: string, o: GapOpts = {}) {
  await page.goto('about:blank'); // a fresh app each time (a hash-only change keeps the previous app and its loaded data)
  const mock = await mockGaps(page, o);
  await page.goto(`/#/home/${route}`);
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return mock;
}

/** No scroll (page, shell, main area, an open sheet), small targets, the shown words, the direction. */
async function audit(page: Page, min: number) {
  return page.evaluate((m) => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const doc = document.scrollingElement!;
    const out: string[] = [];
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '.sheet']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    const hs = root.querySelector('.hs') as HTMLElement;
    if (hs.scrollWidth - hs.clientWidth > 1) out.push('hs-x');
    const small: string[] = [];
    for (const el of Array.from(root.querySelectorAll<HTMLElement>('#main button, #main a[href], .sheet button'))) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const extra = el.closest('.seg') ? 8 : 0; // a segment button's hit area reaches 4 px above and below it (::after, home-styles.ts)
      if (Math.min(r.width, r.height + extra) < m - 0.5) small.push(`${el.tagName.toLowerCase()}.${el.className}[${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 16)}] ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const text = (root as unknown as { textContent: string }).textContent + ' ' + Array.from(root.querySelectorAll('[aria-label]')).map((e) => e.getAttribute('aria-label')).join(' ');
    return { out, small, text, dir: getComputedStyle(hs).direction };
  }, min);
}

test.describe('HOME-V3-GAPS-2436', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  test('"התראות" offers what reaches my phone and the home diary; the menu offers "ההתראות שלי"', async ({ page }) => {
    await open(page, 'alerts');
    const notif = home(page).locator('.hs-head [data-gap-notif]');
    await expect(notif).toHaveAttribute('aria-label', 'ההתראות שלי');
    await expect(home(page).locator('.hs-head [data-gap-diary]')).toHaveAttribute('aria-label', 'יומן הבית');
    await notif.click();
    await expect(page).toHaveURL(/#\/home\/notif$/);
    // the personal menu (the strip's person button)
    await page.goto('/#/home/alerts');
    await settle(page);
    await home(page).locator('[data-act="menu"]').first().click();
    const row = home(page).locator('[data-gap-menu-notif]');
    await expect(row).toContainText('ההתראות שלי');
    await row.click();
    await expect(page).toHaveURL(/#\/home\/notif$/);
  });

  test('without the house log category the diary link is not offered', async ({ page }) => {
    await open(page, 'alerts', { modules: ['lights', 'alerts', 'security'] });
    await expect(home(page).locator('.hs-head [data-gap-notif]')).toHaveCount(1);
    await expect(home(page).locator('.hs-head [data-gap-diary]')).toHaveCount(0);
  });

  test('"ההתראות שלי" changes the personal alarm code with the alarm screen\'s own sheet', async ({ page }) => {
    const mock = await open(page, 'notif');
    const row = home(page).locator('[data-gap-pin]');
    await expect(row).toContainText('הקוד האישי שלי לאזעקה');
    await row.locator('[data-act="almPin"]').click();
    const sheet = home(page).locator('[data-home-pin]');
    await expect(sheet).toHaveAttribute('data-home-pin', 'cur');
    const type = async (code: string) => { for (const k of code) await sheet.locator(`[data-act="pinKey"][data-k="${k}"]`).click(); await sheet.locator('[data-act="pinGo"]').click(); };
    await type('1111');
    await expect(sheet).toHaveAttribute('data-home-pin', 'new1');
    await type('2468');
    await expect(sheet).toHaveAttribute('data-home-pin', 'new2');
    await type('2468');
    await expect.poll(() => mock.calls.filter((c) => c.path === 'alarm/me/pin').map((c) => JSON.stringify(c.body))).toEqual([JSON.stringify({ pin: '2468', current_pin: '1111' })]);
    await expect(sheet).toHaveCount(0);
  });

  test('no alarm code row without permission to arm or disarm', async ({ page }) => {
    await open(page, 'notif', { perms: GAP_PERMS.filter((p) => p !== 'alarm.arm' && p !== 'alarm.disarm') });
    await expect(home(page).locator('.nf-body')).toBeVisible();
    await expect(home(page).locator('[data-gap-pin]')).toHaveCount(0);
  });

  test('a suspected leak offers a ticket to the plumber: the new-ticket sheet with the plumbing subject, sent through the tickets route', async ({ page }) => {
    const mock = await open(page, 'water', { water: 'leak' });
    const btn = home(page).locator('[data-p3-leak="yes"] [data-gap-ticket="plumber"]');
    await expect(btn).toHaveText(/פתח פנייה לאינסטלטור/);
    await btn.click();
    const sheet = home(page).locator('[data-sheet="tkNew"]');
    await expect(sheet.locator('[role="radio"][aria-checked="true"]')).toHaveText('אינסטלציה');
    await sheet.locator('textarea').fill('מים זורמים כל הלילה');
    await sheet.locator('[data-act="p2TkSend"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'home/tickets' && c.method === 'POST').map((c) => (c.body as { category_id: string }).category_id)).toEqual(['c1']);
    await expect(page).toHaveURL(/#\/home\/tickets$/);
  });

  test('no plumber button without a leak or while the tickets module is off', async ({ page }) => {
    await open(page, 'water', { water: 'ok' });
    await expect(home(page).locator('[data-p3-leak="no"]')).toBeVisible();
    await expect(home(page).locator('[data-gap-ticket]')).toHaveCount(0);
    await open(page, 'water', { water: 'leak', tickets: false });
    await expect(home(page).locator('[data-p3-leak="yes"]')).toBeVisible();
    await expect(home(page).locator('[data-gap-ticket]')).toHaveCount(0);
  });

  test('"מערכות הבית" offers "דווח על תקלה" (the new-ticket sheet), not while the tickets module is off', async ({ page }) => {
    await open(page, 'systems', { systems: 'bad' });
    await home(page).locator('.hs-head [data-gap-ticket="fault"]').click();
    const sheet = home(page).locator('[data-sheet="tkNew"]');
    await expect(sheet.locator('[role="radio"][aria-checked="true"]')).toHaveText('תחזוקה כללית');
    await open(page, 'systems', { systems: 'bad', tickets: false });
    await expect(home(page).locator('[data-p3-systems]')).toBeVisible();
    await expect(home(page).locator('[data-gap-ticket]')).toHaveCount(0);
  });

  test('the home diary filters the alarm\'s changes: who and what, newest first', async ({ page }) => {
    const mock = await open(page, 'events');
    await home(page).locator('[data-act="evTab"][data-v="alarm"]').click();
    const rows = home(page).locator('[data-diary="alarm"] b');
    await expect(rows).toHaveText(['האזעקה נדרכה למצב "בבית": אני', 'האזעקה נוטרלה: יונתן', 'האזעקה נדרכה']);
    await expect(home(page).locator('[data-diary="cam"], [data-diary="door"]')).toHaveCount(0);
    await home(page).locator('[data-act="evTab"][data-v="all"]').click();
    await expect(home(page).locator('[data-diary]')).toHaveCount(5);
    expect(mock.calls.filter((c) => c.path === 'home/alarm-log').length).toBeGreaterThan(0);
  });

  test('no alarm filter (and no request) without the alarm category', async ({ page }) => {
    const mock = await open(page, 'events', { modules: ['lights', 'cameras', 'doors', 'log', 'alerts'] });
    await expect(home(page).locator('[data-diary]').first()).toBeVisible();
    await expect(home(page).locator('[data-act="evTab"][data-v="alarm"]')).toHaveCount(0);
    expect(mock.calls.filter((c) => c.path === 'home/alarm-log')).toEqual([]);
  });

  for (const size of SIZES) {
    test(`every changed screen fits without scrolling, RTL, targets, words - ${size.id}`, async ({ page }) => {
      await page.setViewportSize({ width: size.width, height: size.height });
      const min = size.id === 'phone' ? 44 : 48;
      const cases: [string, GapOpts, ((p: Page) => Promise<unknown>) | null][] = [
        ['alerts', {}, null],
        ['notif', {}, null],
        ['water', { water: 'leak' }, null],
        ['systems', { systems: 'bad' }, null],
        ['events', {}, (p) => home(p).locator('[data-act="evTab"][data-v="alarm"]').click()],
        ['water', { water: 'leak' }, (p) => home(p).locator('[data-gap-ticket="plumber"]').click()],
      ];
      for (const [route, o, step] of cases) {
        await open(page, route, o);
        if (step) await step(page);
        await settle(page); // the sheet's opening animation, the loaded rows
        const a = await audit(page, min);
        expect(a.out, `${route} overflow`).toEqual([]);
        expect(a.small, `${route} small targets`).toEqual([]);
        expect(a.dir).toBe('rtl');
        for (const w of FORBIDDEN) expect(a.text.includes(w), `${route} says "${w}"`).toBe(false);
        await page.screenshot({ path: `${SHOTS}/${size.id}-${route}${step ? '-2' : ''}.png` });
      }
    });
  }
});
