import { expect, test, type Page } from '@playwright/test';
import { settle } from './helpers/settle';
import { STEP_UP_CODE, mockAccount, type AccountOpts } from './home-account-mocks';
import { GAP_PERMS } from './home-v3-gaps-mocks';

// HOME-T120-REST-2530 (task T120): "החשבון שלי" inside the home interface - a home-only person reaches their own account (security,
// my sign-ins, language) without the full interface. The sheet holds the full interface's own blocks (sw-account-security,
// sw-remote-sessions, sw-lang-prefs) in the home theme's colours; the long security section scrolls inside the sheet, never the screen;
// not on a wall panel. Mocked backend (tests/home-account-mocks.ts). Screenshots: test-results/home-account-2530/.

const SHOTS = 'test-results/home-account-2530';
const SIZES = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'tablet', width: 1024, height: 768 }, { id: 'phone', width: 390, height: 844 }];
const FORBIDDEN = ['Home Assistant', 'go2rtc', 'NVR', 'undefined', 'NaN'];
const home = (page: Page) => page.locator('sw-home');
const sheet = (page: Page) => home(page).locator('[data-sheet="account"]');

async function open(page: Page, o: AccountOpts = {}) {
  await page.goto('about:blank'); // a fresh app each time
  const mock = await mockAccount(page, o);
  await page.goto('/#/home/r/home');
  await home(page).waitFor();
  await expect.poll(() => page.evaluate(() => !!document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.shadowRoot?.querySelector('.hs.v2'))).toBe(true);
  await settle(page);
  return mock;
}

async function openAccount(page: Page) {
  await home(page).locator('[data-act="menu"]').click();
  await home(page).locator('[data-home-account]').click();
  await expect(sheet(page)).toBeVisible();
}

/** No scroll of the page, the home shell or the sheet itself (the account body may scroll inside), the targets of the sheet's own keys. */
async function audit(page: Page, min: number) {
  return page.evaluate((m) => {
    const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
    const doc = document.scrollingElement!;
    const out: string[] = [];
    if (doc.scrollHeight - doc.clientHeight > 1) out.push('document');
    for (const sel of ['.hs', '#main', '[data-sheet="account"]']) {
      const el = root.querySelector(sel) as HTMLElement | null;
      if (el && el.scrollHeight - el.clientHeight > 1) out.push(`${sel} ${el.scrollHeight}>${el.clientHeight}`);
    }
    const sh = root.querySelector('[data-sheet="account"]') as HTMLElement;
    const r = sh.getBoundingClientRect();
    if (r.top < -0.5 || r.bottom > innerHeight + 0.5 || r.left < -0.5 || r.right > innerWidth + 0.5) out.push(`sheet off screen ${Math.round(r.top)}..${Math.round(r.bottom)}`);
    const seg = sh.querySelector('sw-segmented');
    const keys = [...Array.from(sh.querySelectorAll<HTMLElement>('header button')), ...Array.from(seg?.shadowRoot?.querySelectorAll<HTMLElement>('button') ?? [])];
    // a segmented key's hit area reaches 4 px above and below it (the home's phone rule, home-v3-gaps-2436.spec.ts audit)
    const small = keys.map((el) => ({ b: el.getBoundingClientRect(), extra: el.closest('.seg') ? 8 : 0 })).filter(({ b, extra }) => b.width && Math.min(b.width, b.height + extra) < m - 0.5).map(({ b }) => `${Math.round(b.width)}x${Math.round(b.height)}`);
    const text = (root as unknown as { textContent: string }).textContent + ' ' + (seg?.shadowRoot?.textContent ?? '');
    return { out, small, text, dir: getComputedStyle(sh).direction };
  }, min);
}

test.describe('HOME-T120-REST-2530: my account in the home interface', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sizes are set per test'));

  test('a home-only person opens "החשבון שלי" from the personal menu: security first, the full interface\'s own blocks', async ({ page }) => {
    await open(page);
    await openAccount(page);
    await expect(sheet(page).locator('[data-acc-tab="security"]')).toBeVisible();
    const sec = sheet(page).locator('sw-account-security');
    await expect(sec.locator('[data-sec-line="totp"]')).toBeVisible();
    await expect(sec.locator('[data-sec-line="passkeys"]')).toBeVisible();
    await expect(sec.locator('[data-sec-block="passkeys"] sw-passkeys')).toBeAttached();
    await page.screenshot({ path: `${SHOTS}/security-1280.png` });
    // the person stayed inside the home interface
    expect(new URL(page.url()).hash).toBe('#/home/r/home');
  });

  test('my sign-ins and language tabs; choosing English saves the person\'s own preference', async ({ page }) => {
    const mock = await open(page);
    await openAccount(page);
    await sheet(page).locator('sw-segmented button[data-v="sessions"]').click();
    await expect(sheet(page).locator('sw-remote-sessions [data-remote-sessions-empty]')).toBeVisible();
    await sheet(page).locator('sw-segmented button[data-v="lang"]').click();
    const pick = sheet(page).locator('sw-lang-prefs [data-my-ui-lang]');
    await expect(pick).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/lang-1280.png` });
    await pick.selectOption('en');
    await expect.poll(() => mock.calls.filter((c) => c.method === 'PUT' && c.path === 'me/prefs').map((c) => JSON.stringify(c.body))).toContain(JSON.stringify({ 'ui.lang': 'en' }));
  });

  test('the blocks take the home theme\'s colours (a dark home theme never shows a light block)', async ({ page }) => {
    await page.goto('about:blank');
    await mockAccount(page);
    await page.route('**/api/v1/home/prefs', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ favourites: {}, layout: { welcomed: true, theme: 'midnight', scheme: 'dark' }, seed: {} }) }));
    await page.goto('/#/home/r/home');
    await home(page).waitFor();
    await expect.poll(() => page.evaluate(() => document.querySelector('sw-app')?.shadowRoot?.querySelector('sw-home')?.getAttribute('data-hs-scheme'))).toBe('dark');
    await openAccount(page);
    await expect(sheet(page).locator('sw-account-security [data-sec-overview]')).toBeVisible();
    const c = await page.evaluate(() => {
      const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
      const body = root.querySelector('.acc-body') as HTMLElement;
      const ov = body.querySelector('sw-account-security')!.shadowRoot!.querySelector('.ov') as HTMLElement;
      const probe = document.createElement('i');
      probe.style.background = 'var(--hs-surface-2)';
      body.appendChild(probe);
      const want = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return { got: getComputedStyle(ov).backgroundColor, want, text: getComputedStyle(ov).color, hsText: getComputedStyle(body).getPropertyValue('--hs-text').trim() };
    });
    expect(c.got).toBe(c.want);
  });

  for (const s of SIZES) {
    test(`no scroll, targets and words at ${s.width}x${s.height}`, async ({ page }) => {
      await page.setViewportSize({ width: s.width, height: s.height });
      await open(page);
      await openAccount(page);
      await expect(sheet(page).locator('sw-account-security [data-sec-overview]')).toBeVisible();
      for (const tab of ['security', 'sessions', 'lang']) {
        await sheet(page).locator(`sw-segmented button[data-v="${tab}"]`).click();
        await expect(sheet(page).locator(`[data-acc-tab="${tab}"]`)).toBeVisible();
        await settle(page);
        const a = await audit(page, s.id === 'phone' ? 44 : s.id === 'tablet' ? 56 : 44);
        expect(a.out, `${s.id} ${tab}`).toEqual([]);
        expect(a.small, `${s.id} ${tab}`).toEqual([]);
        expect(a.dir).toBe('rtl');
        for (const w of FORBIDDEN) expect(a.text, w).not.toContain(w);
      }
      await page.screenshot({ path: `${SHOTS}/lang-${s.id}.png` });
    });
  }

  test('with step-up switched on (opt-in), opening a door from the home interface asks for the code over the home, then opens once', async ({ page }) => {
    const mock = await open(page, { perms: [...GAP_PERMS, 'access.doors.open'] });
    let proof = false;
    await page.route('**/api/v1/ha/entities/*/actions', (r) => {
      mock.calls.push({ method: 'POST', path: new URL(r.request().url()).pathname.replace(/^.*api\/v1\//, ''), body: r.request().postDataJSON() });
      if (!proof) return r.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'step_up_required', user_message: 'לפני פתיחת דלת צריך לאשר שוב את הזהות.', retryable: false, correlation_id: 'mock', details: { action: 'access.doors.open', methods: ['totp'], minutes: 5, verify_path: 'auth/step-up/verify' } }) });
      return r.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 'act-1', status: 'confirmed', confirmation: 'state' }) });
    });
    await page.route('**/api/v1/auth/step-up/verify', (r) => { proof = true; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ method: 'totp', minutes: 5, valid_until: '2026-11-03T08:05:00+00:00' }) }); });
    await page.goto('/#/home/doors');
    await home(page).locator('.drow', { hasText: 'דלת הכניסה' }).locator('[data-act="doorAsk"]').click();
    await home(page).locator('[data-act="doorOpen"]').click();
    const dialog = page.locator('sw-step-up-dialog');
    await expect(dialog.locator('[data-step-up-code]')).toBeVisible();
    await dialog.locator('[data-step-up-code]').fill(STEP_UP_CODE);
    await dialog.locator('[data-step-up-confirm]').click(); // a click Playwright can deliver = the dialog is on top of the home sheets
    const unlocks = () => mock.calls.filter((c) => c.path.startsWith('ha/entities/') && c.path.endsWith('/actions')).length;
    await expect.poll(unlocks).toBe(2); // refused once, sent once more after the proof - never a third time
    expect(new URL(page.url()).hash).toBe('#/home/doors');
  });

  test('a wall panel has no personal account (no menu, no row)', async ({ page }) => {
    await open(page, { who: 'wall' });
    await expect(home(page).locator('.st-me')).toBeHidden();
    await expect(home(page).locator('[data-home-account]')).toHaveCount(0);
  });
});
