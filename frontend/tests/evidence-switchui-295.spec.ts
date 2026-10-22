import { test, expect, type Page, type Route } from '@playwright/test';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';

// SWITCHUI-295 against a mocked backend: Settings > Security > Access-control reads (GET / PUT /wiskey/switches).
//   - the four switches in plain language, their state, the internal key only in the small details line;
//   - turning one on / off asks for a confirmation and sends exactly that one key;
//   - while the build has no go-live permit an "off" switch cannot be turned on and the row says why; a 409 from a stale screen
//     is worded the same way; a 403 shows the closed forbidden panel.
// Desktop and phone (--project=desktop / --project=mobile). Needs the Vite dev server or a built preview (SW_BASE_URL).
const SCREEN = 'sw-app system-security-wiskey';
const KEYS = ['wiskey.acr5_access_state', 'wiskey.acr5_normalize_user', 'wiskey.acr5_presence', 'wiskey.acr5_feature_plans'];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const problem = (code: string) => ({ code, user_message: '', retryable: false, correlation_id: 'mock', details: {} });

interface Opts {
  permit?: boolean;
  get?: 'ok' | 'forbidden';
  put?: 'ok' | 'conflict';
}

async function boot(page: Page, o: Opts = {}) {
  await installExternalMock(page, {});
  const state: Record<string, string> = Object.fromEntries(KEYS.map((k) => [k, 'off']));
  state['wiskey.acr5_presence'] = 'on';
  const puts: Record<string, unknown>[] = [];
  let permit = o.permit ?? true;
  await page.route('**/api/v1/wiskey/switches', async (route) => {
    const req = route.request();
    if (o.get === 'forbidden') return json(route, problem('not_system_admin'), 403);
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData() ?? '{}') as { switches: Record<string, string> };
      puts.push(body);
      if (o.put === 'conflict') {
        permit = false;
        return json(route, problem('wiskey_not_permitted'), 409);
      }
      Object.assign(state, body.switches);
    }
    return json(route, { switches: state, go_live_permitted: permit });
  });
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/system/security/wiskey'));
  return { puts, errors };
}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('the four switches in plain language, with the internal key only in the details line', async ({ page }) => {
  const { errors } = await boot(page);
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-wiskey-switches]')).toBeVisible({ timeout: 30_000 });
  await expect(s.locator('[data-wiskey-switch]')).toHaveCount(4);
  await expect(s.locator('[data-wiskey-switch="presence"] [data-wiskey-state]')).toHaveAttribute('data-state', 'on');
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-state]')).toHaveAttribute('data-state', 'off');
  await expect(s.locator('[data-wiskey-details]')).toHaveCount(4);
  const face = await s.locator('[data-wiskey-switch] h4, [data-wiskey-switch] .x').allInnerTexts();
  expect(face.join(' ')).not.toMatch(/acr5|wiskey\./i);
  await expect(s.locator('[data-wiskey-permit]')).toHaveCount(0); // the permit is carried: nothing to explain
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('turning one on asks first and sends exactly that one key; turning one off likewise', async ({ page }) => {
  const { puts } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-wiskey-switch="access"] [data-wiskey-toggle]').click();
  const dlg = s.locator('sw-dialog[data-wiskey-dialog="on"]');
  await expect(dlg.locator('[data-wiskey-confirm]')).toBeVisible(); // the host is display: contents; its content is what shows
  expect(puts).toEqual([]); // nothing sent before the confirmation
  await dlg.locator('[data-wiskey-confirm]').click();
  await expect.poll(() => puts).toEqual([{ switches: { 'wiskey.acr5_access_state': 'on' } }]);
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-state]')).toHaveAttribute('data-state', 'on');
  await expect(s.locator('[data-wiskey-saved]')).toBeVisible();
  await s.locator('[data-wiskey-switch="presence"] [data-wiskey-toggle]').click();
  await s.locator('sw-dialog[data-wiskey-dialog="off"] [data-wiskey-confirm]').click();
  await expect.poll(() => puts.length).toBe(2);
  expect(puts[1]).toEqual({ switches: { 'wiskey.acr5_presence': 'off' } });
  await expect(s.locator('[data-wiskey-switch="presence"] [data-wiskey-state]')).toHaveAttribute('data-state', 'off');
});

test('cancelling the confirmation sends nothing', async ({ page }) => {
  const { puts } = await boot(page);
  const s = page.locator(SCREEN);
  await s.locator('[data-wiskey-switch="schedule"] [data-wiskey-toggle]').click();
  await expect(s.locator('sw-dialog[data-wiskey-dialog="on"] [data-wiskey-confirm]')).toBeVisible();
  await s.locator('sw-dialog[data-wiskey-dialog="on"] [data-wiskey-cancel]').click();
  await expect(s.locator('sw-dialog[data-wiskey-dialog]')).toHaveCount(0);
  expect(puts).toEqual([]);
});

test('no go-live permit: an off switch cannot be turned on and says why; one that is on can still be turned off', async ({ page }) => {
  await boot(page, { permit: false });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-wiskey-switches]')).toBeVisible({ timeout: 30_000 });
  await expect(s.locator('[data-wiskey-permit]')).toHaveCount(3); // the three that are off
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-toggle]')).toHaveAttribute('disabled', '');
  await expect(s.locator('[data-wiskey-switch="presence"] [data-wiskey-toggle]')).not.toHaveAttribute('disabled', '');
  await expect(s.locator('[data-wiskey-switch="presence"] [data-wiskey-permit]')).toHaveCount(0);
});

test('a refusal from a stale screen (409) is worded as "no permit", the switch stays off and is blocked afterwards', async ({ page }) => {
  const { puts } = await boot(page, { permit: true, put: 'conflict' });
  const s = page.locator(SCREEN);
  await s.locator('[data-wiskey-switch="access"] [data-wiskey-toggle]').click();
  await s.locator('sw-dialog[data-wiskey-dialog="on"] [data-wiskey-confirm]').click();
  await expect.poll(() => puts.length).toBe(1);
  await expect(s.locator('[data-wiskey-error]')).toContainText('אישור הפעלה');
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-state]')).toHaveAttribute('data-state', 'off');
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-permit]')).toBeVisible();
  await expect(s.locator('[data-wiskey-switch="access"] [data-wiskey-toggle]')).toHaveAttribute('disabled', '');
});

test('a caller the server refuses (403) gets the closed forbidden panel and no switches', async ({ page }) => {
  await boot(page, { get: 'forbidden' });
  const s = page.locator(SCREEN);
  await expect(s.locator('[data-wiskey-forbidden]')).toBeVisible({ timeout: 30_000 });
  await expect(s.locator('[data-wiskey-switch]')).toHaveCount(0);
});
