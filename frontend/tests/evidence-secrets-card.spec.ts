import { test, expect, type Page } from '@playwright/test';
import { openApp } from './frigate-mocks';
import { installSecretsMock, type SecretsMockOptions } from './secrets-setup-mocks';

// TKSPECS (TKSECRETS2): Settings > Connections > Secrets (src/components/sw-secrets-card.ts) against the MOCKED backend of secrets-setup-mocks.ts
// (the routes of system/secrets: list, PUT, DELETE, POST .../test). No live backend. What it proves: the four stored states (configured /
// not set / unreadable / legacy), save (the typed value goes out once and is never shown or echoed again), clear behind a two-step confirm,
// every answer code of the connection test, the forbidden state (list and write), the remote-blocked state and the host hiding the card
// without system.configure. Every name and value is made up.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-secrets-card.spec.ts --project=desktop --workers=1
const CARD = 'system-setup sw-secrets-card';
const row = (page: Page, name: string) => page.locator(`${CARD} [data-secret-row="${name}"]`);
const TYPED = 'Zx9-fake-typed-value-7731';
test.describe.configure({ timeout: 3 * 60_000 });
test.use({ actionTimeout: 20_000, navigationTimeout: 30_000 });

async function open(page: Page, o: SecretsMockOptions = {}, ready = `${CARD} [data-secret-row]`) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const mock = await installSecretsMock(page, o);
  await openApp(page, '/system/setup');
  await page.waitForSelector(ready, { timeout: 20_000 });
  return { mock, errors };
}
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);

test.describe('settings: secrets card', () => {
  test('the list: configured, not set, unreadable and legacy rows, each with its badge, its status line and the right controls; no value is shown', async ({ page }) => {
    const { errors } = await open(page);
    await expect(page.locator(`${CARD} [data-secret-row]`)).toHaveCount(5);
    const states = await page.locator(`${CARD} [data-secret-row]`).evaluateAll((els) => els.map((e) => [e.getAttribute('data-secret-row'), e.querySelector('[data-secret-state]')?.getAttribute('data-secret-state')]));
    expect(states).toEqual([['go2rtc_api_password', 'set'], ['wiskey_password', 'legacy'], ['wiskey_background_token', 'not_set'], ['openai_api_key', 'unreadable'], ['push_relay_key', 'set']]);
    // configured: since when and by whom, replace / test / delete, no input
    const set = row(page, 'go2rtc_api_password');
    await expect(set.locator('[data-secret-status]')).toContainText('הוגדר');
    await expect(set.locator('[data-secret-status]')).toContainText('יוני');
    await expect(set.locator('[data-secret-replace]')).toBeVisible();
    await expect(set.locator('[data-secret-test-stored]')).toBeVisible();
    await expect(set.locator('[data-secret-clear]')).toBeVisible();
    await expect(set.locator('[data-secret-input]')).toHaveCount(0);
    // an imported value says where it came from; push key is not testable
    await expect(row(page, 'push_relay_key').locator('[data-secret-status]')).toContainText('הועבר מהגדרות התוסף');
    await expect(row(page, 'push_relay_key').locator('[data-secret-test-stored]')).toHaveCount(0);
    // legacy: in use from the old add-on option, replaceable, not deletable (no stored row yet)
    const legacy = row(page, 'wiskey_password');
    await expect(legacy.locator('[data-secret-status]')).toContainText('מהגדרת התוסף הישנה');
    await expect(legacy.locator('[data-secret-replace]')).toBeVisible();
    await expect(legacy.locator('[data-secret-clear]')).toHaveCount(0);
    // not set: the input is already there, save and test are disabled until something is typed, no cancel
    const unset = row(page, 'wiskey_background_token');
    await expect(unset.locator('[data-secret-status]')).toContainText('לא הוגדר');
    await expect(unset.locator('[data-secret-input]')).toHaveAttribute('type', 'password');
    await expect(unset.locator('[data-secret-input]')).toHaveValue('');
    await expect(unset.locator('[data-secret-save]')).toHaveAttribute('disabled', '');
    // unreadable: asks to enter it again
    const bad = row(page, 'openai_api_key');
    await expect(bad.locator('[data-secret-status]')).toContainText('אינו ניתן לפענוח');
    await expect(bad.locator('[data-secret-input]')).toBeVisible();
    await expect(bad.locator('[data-secret-clear]')).toHaveCount(0);
    // the card never names the platform behind the system
    expect(await page.locator(CARD).innerText()).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    await noOverflow(page);
    expect(errors).toEqual([]);
  });

  test('save: the value goes out once in the PUT body, the row turns configured, the input is gone and the value is never echoed; the restart note appears', async ({ page }) => {
    const { mock } = await open(page);
    const r = row(page, 'wiskey_background_token');
    await r.locator('[data-secret-input]').fill(TYPED);
    await expect(r.locator('[data-secret-save]')).not.toHaveAttribute('disabled', '');
    await r.locator('[data-secret-save]').click();
    await expect(r.locator('[data-secret-state]')).toHaveAttribute('data-secret-state', 'set');
    await expect(r.locator('[data-secret-input]')).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-secrets-restart]`)).toBeVisible();
    const puts = mock.calls.filter((c) => c.method === 'PUT');
    expect(puts).toHaveLength(1);
    expect(puts[0].path).toBe('system/secrets/wiskey_background_token');
    expect(puts[0].body).toEqual({ value: TYPED });
    // write-only: no response carried it and it is nowhere in the page
    expect(mock.responses.some((x) => x.includes(TYPED.toLowerCase()))).toBe(false);
    expect(await page.locator(CARD).innerText()).not.toContain(TYPED);
    const inputs = await page.locator(`${CARD} [data-secret-input]`).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(inputs.every((v) => v === '')).toBe(true);
  });

  test('replace and cancel: replacing opens an empty input (the stored value is not prefilled), cancel closes it without a write', async ({ page }) => {
    const { mock } = await open(page);
    const r = row(page, 'go2rtc_api_password');
    await r.locator('[data-secret-replace]').click();
    await expect(r.locator('[data-secret-input]')).toHaveValue('');
    await r.locator('[data-secret-input]').fill(TYPED);
    await r.getByRole('button', { name: 'ביטול' }).click();
    await expect(r.locator('[data-secret-input]')).toHaveCount(0);
    await expect(r.locator('[data-secret-replace]')).toBeVisible();
    expect(mock.calls.filter((c) => c.method !== 'GET')).toEqual([]);
  });

  test('clear: two steps - "מחק" only asks, "ביטול" backs out without a write, "מחק סופית" deletes and the row becomes not set', async ({ page }) => {
    const { mock } = await open(page);
    const r = row(page, 'go2rtc_api_password');
    await r.locator('[data-secret-clear]').click();
    await expect(r.locator('[data-secret-clear-confirm]')).toBeVisible();
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await r.getByRole('button', { name: 'ביטול' }).click();
    await expect(r.locator('[data-secret-clear-confirm]')).toHaveCount(0);
    await expect(r.locator('[data-secret-clear]')).toBeVisible();
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    await r.locator('[data-secret-clear]').click();
    await r.locator('[data-secret-clear-confirm]').click();
    await expect(r.locator('[data-secret-state]')).toHaveAttribute('data-secret-state', 'not_set');
    await expect(r.locator('[data-secret-status]')).toContainText('נמחק');
    expect(mock.calls.filter((c) => c.method === 'DELETE').map((c) => c.path)).toEqual(['system/secrets/go2rtc_api_password']);
  });

  test('connection test: the stored value is tested with an empty body, a typed candidate with {value} and is never stored; every answer code has its text', async ({ page }) => {
    const { mock } = await open(page);
    const set = row(page, 'go2rtc_api_password');
    await set.locator('[data-secret-test-stored]').click();
    const res = set.locator('[data-secret-test-result]');
    await expect(res).toHaveAttribute('data-secret-test-result', 'ok');
    await expect(res).toContainText('החיבור תקין');
    expect(mock.calls.find((c) => c.method === 'POST')?.body).toEqual({});
    await set.locator('[data-secret-replace]').click();
    await set.locator('[data-secret-input]').fill(TYPED);
    await set.locator('[data-secret-test]').click();
    await expect.poll(() => mock.calls.filter((c) => c.method === 'POST').length).toBe(2);
    expect(mock.calls.filter((c) => c.method === 'POST')[1].body).toEqual({ value: TYPED });
    expect(mock.calls.some((c) => c.method === 'PUT')).toBe(false);

    const CODES: [string, string, string][] = [
      ['go2rtc_api_password', 'unauthorized', 'go2rtc דחה את הסיסמה'],
      ['go2rtc_api_password', 'unreachable', 'go2rtc לא ענה'],
      ['go2rtc_api_password', 'error', 'go2rtc החזיר שגיאה'],
      ['go2rtc_api_password', 'not_configured', 'כתובת go2rtc לא הוגדרה'],
      ['go2rtc_api_password', 'username_missing', 'שם המשתמש לא הוגדר'],
      ['wiskey_password', 'wiskey_unavailable', 'נתוני WisKey אינם זמינים כרגע'],
      ['wiskey_password', 'no_station', 'אין עמדה מחוברת'],
      ['wiskey_password', 'station_failed', 'לא התקבלה תמונה מהעמדה'],
      ['wiskey_password', 'go2rtc_unauthorized', 'go2rtc דחה את פרטי הגישה שלו'],
    ];
    for (const [name, code, text] of CODES) {
      await page.unrouteAll({ behavior: 'ignoreErrors' });
      await installSecretsMock(page, { testCode: { [name]: code } });
      await openApp(page, '/system/setup');
      await page.waitForSelector(`${CARD} [data-secret-row]`, { timeout: 20_000 });
      await row(page, name).locator('[data-secret-test-stored]').click();
      const out = row(page, name).locator('[data-secret-test-result]');
      await expect(out, `${name} ${code}`).toHaveAttribute('data-secret-test-result', code);
      await expect(out, `${name} ${code}`).toContainText(text);
    }
  });

  test('forbidden: a refused list shows the server message and no rows; a refused write shows it in an alert and keeps the row as it was', async ({ page }) => {
    await open(page, { list: 'forbidden' }, `${CARD} [data-secrets-error]`);
    await expect(page.locator(`${CARD} [data-secrets-error]`)).toContainText('אין הרשאה לנהל סודות');
    await expect(page.locator(`${CARD} [data-secret-row]`)).toHaveCount(0);

    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await installSecretsMock(page, { writeForbidden: true });
    await openApp(page, '/system/setup');
    await page.waitForSelector(`${CARD} [data-secret-row]`, { timeout: 20_000 });
    const r = row(page, 'wiskey_background_token');
    await r.locator('[data-secret-input]').fill(TYPED);
    await r.locator('[data-secret-save]').click();
    await expect(page.locator(`${CARD} [data-secrets-error]`)).toContainText('אין הרשאה לשנות סודות');
    await expect(r.locator('[data-secret-state]')).toHaveAttribute('data-secret-state', 'not_set');
    const del = row(page, 'go2rtc_api_password');
    await del.locator('[data-secret-clear]').click();
    await del.locator('[data-secret-clear-confirm]').click();
    await expect(page.locator(`${CARD} [data-secrets-error]`)).toContainText('אין הרשאה לשנות סודות');
    await expect(del.locator('[data-secret-state]')).toHaveAttribute('data-secret-state', 'set');
    await expect(del.locator('[data-secret-clear-confirm]')).toHaveCount(0); // the confirm closed either way
  });

  test('a failing list (500) shows the error line, not the loading text', async ({ page }) => {
    await open(page, { list: 'error' }, `${CARD} [data-secrets-error]`);
    await expect(page.locator(`${CARD} [data-secrets-error]`)).toContainText('שגיאה בקריאת הסודות');
    await expect(page.locator(CARD)).not.toContainText('טוען…');
  });

  test('remote channel: the card says "זמין רק מהרשת המקומית", offers no control and never calls the secrets routes', async ({ page }) => {
    const { mock } = await open(page, { remote: true }, `${CARD} [data-secrets-local-only]`);
    await expect(page.locator(`${CARD} [data-secrets-local-only]`)).toContainText('זמין רק מהרשת המקומית');
    await expect(page.locator(`${CARD} [data-secret-row]`)).toHaveCount(0);
    await expect(page.locator(`${CARD} [data-secret-input]`)).toHaveCount(0);
    expect(mock.calls).toEqual([]);
  });

  test('without system.configure the connections screen does not draw the card at all', async ({ page }) => {
    const mock = await installSecretsMock(page, { perms: ['video.live', 'map.read', 'devices.read', 'sources.configure'] });
    await openApp(page, '/system/setup');
    await page.waitForSelector('system-setup [data-connections]', { timeout: 20_000 });
    await expect(page.locator('system-setup sw-secrets-card')).toHaveCount(0);
    expect(mock.calls).toEqual([]);
  });
});
