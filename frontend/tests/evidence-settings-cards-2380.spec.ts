import { test, expect, type Page, type Route } from '@playwright/test';

// release/2380-train, Settings rows 3 and 4 (docs/changes/RELEASE-2380-TRAIN.md section 3): the two new cards as an API session -
//   <system-quiet-windows>  הגדרות › התראות › "חלון שקט לקומה או לאזור" (quiet.windows.*, incl. channels; GET / PUT quiet/settings)
//   <system-app-signin>     הגדרות › גישה מרחוק › "כניסה מהאפליקציה לנייד" (GET / PUT auth/app/settings, system administrators only)
// Both cards draw nothing editable in demo mode, so the app runs on the vite dev server with /me answered as a system administrator
// (page.route), each card is mounted alone in a stage, and its two routes are answered by an in-spec fake that keeps the server's rules
// and records every request body. Checks: the rows and their defaults, the save through the confirmation, the body sent, the channel rule
// of the sign-in switches (remote: "פעיל" closed while off), the 403 = no card, and on a phone the `.foot.sticky` save row stays in view
// at the bottom of a short scroller while the top of the card is shown. Mocked data only; no backend, no device.
//   npx vite --host 127.0.0.1 --port 5205   then   SW_BASE_URL=http://127.0.0.1:5205/ npx playwright test evidence-settings-cards-2380 --project=desktop --project=mobile --workers=1

const QW_URL = '/src/screens/system-quiet-windows.ts';
const AS_URL = '/src/screens/system-app-signin.ts';
const SESSION_URL = '/src/api/session.ts';
const PERMS = ['system.configure', 'map.read', 'devices.read', 'notices.view'];

interface Fake {
  channel: 'local' | 'remote';
  quiet: Record<string, string>;
  app: Record<string, unknown>;
  appStatus: number;
  puts: { path: string; body: unknown }[];
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const apiError = (route: Route, status: number, code: string) => json(route, { code, user_message: code, retryable: false, correlation_id: 'mock', details: {} }, status);

function fake(over: Partial<Fake> = {}): Fake {
  return {
    channel: 'local',
    quiet: { 'quiet.windows.enabled': 'off', 'quiet.windows.default_minutes': '120', 'quiet.windows.max_minutes': '240', 'quiet.windows.mute_alerts': 'off', 'quiet.windows.channels': 'push' },
    app: { 'security.app_refresh': 'off', 'security.app_session_exchange': 'off', 'security.app_refresh_access_minutes': 10 },
    appStatus: 200,
    puts: [],
    ...over,
  };
}

async function serve(page: Page, f: Fake) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const p = new URL(req.url()).pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    if (p === 'me') {
      return json(route, { user: { id: 'u-admin', username: 'admin', display_name: 'מנהלת', source: 'ingress' }, channel: f.channel, remote: null, bindings: [],
        permissions_installation: PERMS, permissions_any: PERMS, has_access: true, permission_revision: 1, bootstrap_state: 'done' });
    }
    if (p === 'quiet/settings' && method === 'GET') return json(route, { settings: f.quiet });
    if (p === 'quiet/settings' && method === 'PUT') {
      const body = req.postDataJSON() as { changes: Record<string, string>; confirmed?: boolean };
      f.puts.push({ path: p, body });
      if (body.confirmed !== true) return apiError(route, 422, 'confirmation_required');
      f.quiet = { ...f.quiet, ...body.changes };
      return json(route, { settings: f.quiet, changed: Object.keys(body.changes) });
    }
    if (p === 'auth/app/settings' && method === 'GET') return f.appStatus === 200 ? json(route, { settings: f.app }) : apiError(route, f.appStatus, 'forbidden');
    if (p === 'auth/app/settings' && method === 'PUT') {
      const body = req.postDataJSON() as Record<string, 'on' | 'off'>;
      f.puts.push({ path: p, body });
      if (f.channel === 'remote' && Object.values(body).includes('on')) return apiError(route, 403, 'local_channel_only');
      const ended = f.app['security.app_refresh'] === 'on' && body['security.app_refresh'] === 'off' ? 3 : 0;
      f.app = { ...f.app, ...body };
      return json(route, { settings: f.app, families_ended: ended });
    }
    return apiError(route, 404, 'not_found');
  });
}

/** The shell boots on the dev server against the fake /me (an API session); the card's module is loaded and mounted alone in a stage. */
async function mount(page: Page, f: Fake, url: string, tag: string, stageHeight?: number) {
  await serve(page, f);
  await page.goto('./');
  await page.evaluate(async ([sessionUrl, moduleUrl]) => {
    const s = (await import(/* @vite-ignore */ sessionUrl)) as { loadSession: () => Promise<{ mode: string }> };
    const r = await s.loadSession();
    if (r.mode !== 'api') throw new Error(`session mode ${r.mode}`);
    await import(/* @vite-ignore */ moduleUrl);
  }, [SESSION_URL, url]);
  await page.waitForFunction((t) => !!customElements.get(t), tag);
  await page.evaluate(([t, h]) => {
    document.querySelectorAll('#cards-stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'cards-stage';
    st.style.cssText = `position:fixed;inset-inline:0;inset-block-start:0;${h ? `block-size:${h}px;` : 'inset-block-end:0;'}z-index:50;overflow:auto;padding:16px;background:var(--sw-bg, #f5f6f8);direction:rtl`;
    st.innerHTML = `<${t}></${t}>`;
    document.body.appendChild(st);
  }, [tag, stageHeight ?? 0] as const);
}

const noSideways = async (page: Page) => {
  const over = await page.evaluate(() => {
    const st = document.getElementById('cards-stage')!;
    return st.scrollWidth - st.clientWidth;
  });
  expect(over, 'no sideways scroll in the stage').toBeLessThanOrEqual(1);
};

test.describe('quiet-window card (CR-QUIET103 + APP-SERVER-LEFTOVERS-2380)', () => {
  test('five rows at the factory values; channels push only; a change saves through the confirmation with confirmed: true', async ({ page }) => {
    const f = fake();
    await mount(page, f, QW_URL, 'system-quiet-windows');
    const card = page.locator('system-quiet-windows [data-quiet-windows-card]');
    await expect(card).toBeVisible();
    for (const row of ['enabled', 'default', 'max', 'mute-alerts', 'channels']) await expect(card.locator(`[data-qw-row="${row}"]`)).toBeVisible();
    await expect(card.locator('[data-qw-seg="enabled"] button[data-v="false"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-qw-seg="channels"] button[data-v="push"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-qw-seg="channels"] button[data-v="push"]')).toHaveText('פוש בלבד');
    await expect(card.locator('[data-qw-seg="channels"] button[data-v="all"]')).toHaveText('כל הערוצים');
    await expect(card.locator('[data-qw-minutes="default_minutes"]')).toHaveValue('120');
    await expect(card.locator('[data-qw-minutes="max_minutes"]')).toHaveValue('240');
    const save = card.locator('[data-qw-save]');
    await expect(save.locator('button')).toBeDisabled();
    await noSideways(page);

    await card.locator('[data-qw-seg="channels"] button[data-v="all"]').click();
    await card.locator('[data-qw-seg="enabled"] button[data-v="true"]').click();
    await expect(save.locator('button')).toBeEnabled();
    await save.click();
    const dlg = card.locator('[data-qw-confirm]');
    await expect(dlg).toHaveAttribute('open', '');
    await expect(card.locator('[data-qw-confirm-ends]')).toHaveCount(0); // switching ON ends nothing
    await card.locator('[data-qw-confirm-go]').click();
    await expect(card.locator('[data-qw-message]')).toHaveText('ההגדרות נשמרו');
    expect(f.puts).toEqual([{ path: 'quiet/settings', body: { changes: { 'quiet.windows.enabled': 'on', 'quiet.windows.channels': 'all' }, confirmed: true } }]);
    await expect(save.locator('button')).toBeDisabled();
  });

  test('switching off says that every open window ends; a default longer than the maximum is refused before the save', async ({ page }) => {
    const f = fake({ quiet: { ...fake().quiet, 'quiet.windows.enabled': 'on' } });
    await mount(page, f, QW_URL, 'system-quiet-windows');
    const card = page.locator('system-quiet-windows [data-quiet-windows-card]');
    await expect(card.locator('[data-qw-seg="enabled"] button[data-v="true"]')).toHaveAttribute('aria-pressed', 'true');
    await card.locator('[data-qw-minutes="default_minutes"]').fill('300');
    await card.locator('[data-qw-minutes="default_minutes"]').dispatchEvent('change');
    await expect(card.locator('[data-qw-problem]')).toBeVisible();
    await expect(card.locator('[data-qw-save] button')).toBeDisabled();
    await card.locator('[data-qw-minutes="default_minutes"]').fill('60');
    await card.locator('[data-qw-minutes="default_minutes"]').dispatchEvent('change');
    await expect(card.locator('[data-qw-problem]')).toHaveCount(0);
    await card.locator('[data-qw-seg="enabled"] button[data-v="false"]').click();
    await card.locator('[data-qw-save]').click();
    await expect(card.locator('[data-qw-confirm-ends]')).toBeVisible();
    await card.locator('[data-qw-confirm-go]').click();
    await expect(card.locator('[data-qw-message]')).toBeVisible();
    expect(f.puts[0].body).toEqual({ changes: { 'quiet.windows.enabled': 'off', 'quiet.windows.default_minutes': '60' }, confirmed: true });
  });

  test('phone: the save row stays in view at the bottom of a short scroller', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the sticky save row is a phone behaviour');
    const f = fake();
    await mount(page, f, QW_URL, 'system-quiet-windows', 420);
    const card = page.locator('system-quiet-windows [data-quiet-windows-card]');
    await expect(card).toBeVisible();
    const foot = card.locator('[data-qw-foot]');
    expect(await foot.evaluate((e) => getComputedStyle(e).position)).toBe('sticky');
    await page.evaluate(() => document.getElementById('cards-stage')!.scrollTo(0, 0));
    const stage = (await page.locator('#cards-stage').boundingBox())!;
    const box = (await foot.boundingBox())!;
    expect(box.y + box.height, 'the save row is inside the visible scroller').toBeLessThanOrEqual(stage.y + stage.height + 1);
    expect(box.y, 'the save row is pinned to the lower part of the scroller').toBeGreaterThan(stage.y + stage.height / 2);
    // the first row is not under the pinned row
    const first = (await card.locator('[data-qw-row="enabled"]').boundingBox())!;
    expect(first.y + first.height).toBeLessThanOrEqual(box.y + 1);
  });
});

test.describe('app sign-in card (Settings › Remote access, release/2380-train row 4)', () => {
  test('local channel: both switches off; the exchange waits for the saved sign-in; ON saves without a confirmation', async ({ page }) => {
    const f = fake();
    await mount(page, f, AS_URL, 'system-app-signin');
    const card = page.locator('system-app-signin [data-app-signin-card]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-app-signin="refresh"] button[data-v="off"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-app-signin="exchange"] button[data-v="off"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(card.locator('[data-app-signin="exchange"] button[data-v="on"]')).toBeDisabled(); // needs the saved sign-in
    await expect(card.locator('[data-app-signin-note="exchange"]')).toBeVisible();
    await card.locator('[data-app-signin="refresh"] button[data-v="on"]').click();
    await expect(card.locator('[data-app-signin="exchange"] button[data-v="on"]')).toBeEnabled();
    await card.locator('[data-app-signin="exchange"] button[data-v="on"]').click();
    await card.locator('[data-app-signin-save]').click();
    await expect(card.locator('[data-app-signin-message]')).toHaveText('ההגדרות נשמרו');
    await expect(card.locator('[data-app-signin-confirm]')).not.toHaveAttribute('open', '');
    expect(f.puts).toEqual([{ path: 'auth/app/settings', body: { 'security.app_refresh': 'on', 'security.app_session_exchange': 'on' } }]);
    await noSideways(page);
  });

  test('turning the saved sign-in off turns the exchange off and the confirmation names both', async ({ page }) => {
    const f = fake({ app: { 'security.app_refresh': 'on', 'security.app_session_exchange': 'on', 'security.app_refresh_access_minutes': 10 } });
    await mount(page, f, AS_URL, 'system-app-signin');
    const card = page.locator('system-app-signin [data-app-signin-card]');
    await card.locator('[data-app-signin="refresh"] button[data-v="off"]').click();
    await expect(card.locator('[data-app-signin="exchange"] button[data-v="off"]')).toHaveAttribute('aria-pressed', 'true');
    await card.locator('[data-app-signin-save]').click();
    await expect(card.locator('[data-app-signin-confirm]')).toHaveAttribute('open', '');
    await expect(card.locator('[data-app-signin-ends="refresh"]')).toBeVisible();
    await expect(card.locator('[data-app-signin-ends="exchange"]')).toBeVisible();
    await card.locator('[data-app-signin-confirm-go]').click();
    await expect(card.locator('[data-app-signin-message]')).toContainText('3');
    expect(f.puts[0].body).toEqual({ 'security.app_refresh': 'off', 'security.app_session_exchange': 'off' });
  });

  test('remote channel: "פעיל" of a switch that is off is closed with the local-network note; "כבוי" still works', async ({ page }) => {
    const f = fake({ channel: 'remote', app: { 'security.app_refresh': 'on', 'security.app_session_exchange': 'off', 'security.app_refresh_access_minutes': 10 } });
    await mount(page, f, AS_URL, 'system-app-signin');
    const card = page.locator('system-app-signin [data-app-signin-card]');
    await expect(card).toBeVisible();
    await expect(card.locator('[data-app-signin="exchange"] button[data-v="on"]')).toBeDisabled();
    await expect(card.locator('[data-app-signin-note="exchange"]')).toHaveText('את ההפעלה עושים רק מתוך הרשת המקומית');
    await expect(card.locator('[data-app-signin="refresh"] button[data-v="off"]')).toBeEnabled();
    await card.locator('[data-app-signin="refresh"] button[data-v="off"]').click();
    await card.locator('[data-app-signin-save]').click();
    await card.locator('[data-app-signin-confirm-go]').click();
    await expect(card.locator('[data-app-signin-message]')).toBeVisible();
    expect(f.puts[0].body).toEqual({ 'security.app_refresh': 'off' });
  });

  test('not a system administrator (403): the card draws nothing', async ({ page }) => {
    const f = fake({ appStatus: 403 });
    await mount(page, f, AS_URL, 'system-app-signin');
    await page.waitForTimeout(500);
    await expect(page.locator('system-app-signin [data-app-signin-card]')).toHaveCount(0);
  });

  test('phone: the save row stays in view at the bottom of a short scroller', async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'the sticky save row is a phone behaviour');
    const f = fake();
    await mount(page, f, AS_URL, 'system-app-signin', 360);
    const card = page.locator('system-app-signin [data-app-signin-card]');
    await expect(card).toBeVisible();
    const foot = card.locator('[data-app-signin-foot]');
    expect(await foot.evaluate((e) => getComputedStyle(e).position)).toBe('sticky');
    await page.evaluate(() => document.getElementById('cards-stage')!.scrollTo(0, 0));
    const stage = (await page.locator('#cards-stage').boundingBox())!;
    const box = (await foot.boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
    await noSideways(page);
  });
});
