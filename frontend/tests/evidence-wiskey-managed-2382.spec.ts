import { test, expect, type Page, type Route } from '@playwright/test';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';

// WISKEY-MANAGED-INSTALL-2382 against a mocked backend: Settings > Security > access-control, the "installation and updates" card
// (GET /wiskey/managed, PUT /wiskey/managed/switch, POST /wiskey/managed/{check,adopt,upgrade,rollback}).
//   - current and shipped versions, ownership and plan in plain language; no platform name, no internal key on the face;
//   - the owner switch: ON only after the exact typed phrase (the button stays disabled until then), OFF with a plain confirmation;
//   - the one-time adoption (typed phrase), the dry-run checklist, the run with its step-by-step progress (polled), the rollback;
//   - a refused run is worded from its closed code; a 403 hides the card.
// Desktop and phone (--project=desktop / --project=mobile). Needs the Vite dev server or a built preview (SW_BASE_URL). Runner only.
const SCREEN = 'sw-app system-security-wiskey';
const CARD = `${SCREEN} system-security-wiskey-managed`;
const PHRASES = { enabled: 'מאשר ניהול התקנה', core_risk: 'מאשר סיכון סביבה', adopt: 'מאשר העברה לניהול' };
const SWITCH_KEYS = ['wiskey.acr5_access_state', 'wiskey.acr5_normalize_user', 'wiskey.acr5_presence', 'wiskey.acr5_feature_plans', 'wiskey.auto_install'];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const problem = (code: string, details: Record<string, unknown> = {}) => ({ code, user_message: '', retryable: false, correlation_id: 'mock', details });

type Step = { name: string; state: string; code: string | null };
const STEPS = ['preflight', 'core_gate', 'backup_check', 'snapshot_before', 'stop_core', 'backup_local', 'swap', 'start_core', 'verify'];

interface Opts {
  enabled?: boolean;
  ownership?: 'manual' | 'adopted' | 'arx_managed';
  get?: 'ok' | 'forbidden';
  upgrade?: 'ok' | 'plan_refused' | 'rolled_back';
}

async function boot(page: Page, o: Opts = {}) {
  await installExternalMock(page, {});
  await page.route('**/api/v1/wiskey/switches', (route) =>
    json(route, { switches: Object.fromEntries(SWITCH_KEYS.map((k) => [k, 'off'])), go_live_permitted: true, auto_install_permitted: false }));
  const st = {
    enabled: o.enabled ?? false,
    risk: false,
    ownership: o.ownership ?? 'manual',
    job: null as null | Record<string, unknown>,
    polls: 0,
  };
  const sent: { method: string; path: string; body: unknown }[] = [];
  const view = () => {
    const managed = st.ownership === 'arx_managed';
    const plan = managed ? 'up_to_date' : 'convert';
    const running = st.job?.state === 'running';
    return {
      switches: { enabled: st.enabled ? 'on' : 'off', core_risk: st.risk ? 'on' : 'off' },
      phrases: PHRASES,
      bundle: { state: 'ok', code: null, version: '2.0.1-rc.10', digest: '5a3d', product_CODE: '6049', files: 389 },
      installed: { state: 'present', ownership: st.ownership, version: '2.0.1-rc.10', label: '2.0.1-rc.10', digest: managed ? '5a3d' : '9a3f',
        profile: managed ? 'managed_original_authority_flow' : 'owner_manual_existing', markers: managed ? { component: 'absent', config: 'absent' } : { component: 'manual', config: 'manual' } },
      plan,
      runnable: st.ownership === 'adopted' && plan === 'convert',
      adoptable: st.ownership === 'manual',
      adoption: st.ownership === 'manual' ? null : { version: '2.0.1-rc.10', label: '2.0.1-rc.10', digest: '9a3f', at: '2026-11-03T18:00:00+00:00', backup: 'b' },
      job: st.job,
      running,
      rollback_available: managed && !running,
      unattended_permitted: false,
    };
  };
  const advance = () => {
    // the mocked worker: each poll finishes one more step; the last poll settles the job
    const job = st.job as { state: string; steps: Step[]; code: string | null } | null;
    if (!job || job.state !== 'running') return;
    st.polls += 1;
    const n = Math.min(STEPS.length, st.polls * 3);
    job.steps = STEPS.slice(0, n).map((name, i) => ({ name, state: i < n - 1 ? 'done' : 'running', code: null }));
    if (n >= STEPS.length) {
      if (o.upgrade === 'rolled_back') {
        job.steps[STEPS.length - 1] = { name: 'verify', state: 'failed', code: 'entry_not_loaded' };
        job.steps.push({ name: 'stop_core', state: 'done', code: null }, { name: 'rollback', state: 'done', code: null },
          { name: 'start_core_after_rollback', state: 'done', code: null }, { name: 'verify_after_rollback', state: 'done', code: null });
        Object.assign(job, { state: 'rolled_back', code: 'entry_not_loaded' });
      } else {
        job.steps[STEPS.length - 1] = { name: 'verify', state: 'done', code: null };
        Object.assign(job, { state: 'succeeded' });
        st.ownership = 'arx_managed';
      }
    }
  };
  await page.route('**/api/v1/wiskey/managed**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname.replace(/^.*\/api\/v1\/wiskey\/managed/, '') || '/';
    const body = req.postData() ? JSON.parse(req.postData() as string) : null;
    if (o.get === 'forbidden') return json(route, problem('not_system_admin'), 403);
    if (req.method() !== 'GET') sent.push({ method: req.method(), path, body });
    if (req.method() === 'GET') {
      advance();
      return json(route, view());
    }
    if (path === '/switch') {
      const b = body as { switch: 'enabled' | 'core_risk'; value: string; confirm?: string };
      if (b.value === 'on' && b.confirm !== PHRASES[b.switch]) return json(route, problem('confirmation_required'), 422);
      if (b.switch === 'enabled') {
        st.enabled = b.value === 'on';
        if (!st.enabled) st.risk = false;
      } else st.risk = b.value === 'on';
      return json(route, view());
    }
    if (path === '/adopt') {
      if ((body as { confirm?: string }).confirm !== PHRASES.adopt) return json(route, problem('confirmation_required'), 422);
      st.ownership = 'adopted';
      return json(route, view());
    }
    if (path === '/check') {
      return json(route, { plan: 'convert', ready: false, items: [
        { name: 'preflight', state: 'pass', code: null },
        { name: 'core_gate', state: 'fail', code: 'core_gate_unverified' },
        { name: 'backup_check', state: 'pass', code: null },
      ] });
    }
    if (path === '/upgrade' || path === '/rollback') {
      if (o.upgrade === 'plan_refused') return json(route, problem('plan_refused', { plan: 'downgrade_refused' }), 409);
      st.polls = 0;
      st.job = { id: '20261103T190000Z-abcdef', kind: path === '/rollback' ? 'rollback' : 'convert', state: 'running', code: null, plan: 'convert',
        from_version: '2.0.1-rc.10', to_version: '2.0.1-rc.10', steps: [{ name: 'preflight', state: 'running', code: null }], risk_accepted: false };
      return json(route, { job: st.job }, 202);
    }
    return json(route, problem('validation'), 422);
  });
  await page.clock.setFixedTime(XNOW);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url('/system/security/wiskey'));
  return { sent, errors, st };
}

const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

test('versions, ownership and plan in plain language; switch off by default, nothing else offered', async ({ page }) => {
  const { sent, errors } = await boot(page);
  const c = page.locator(CARD);
  await expect(c.locator('[data-wm-card]')).toBeVisible({ timeout: 30_000 });
  await expect(c.locator('[data-wm-fact="installed"] .v')).toHaveText('2.0.1-rc.10');
  await expect(c.locator('[data-wm-ownership="manual"]')).toHaveText('הותקן ידנית');
  await expect(c.locator('[data-wm-fact="shipped"] .v')).toHaveText('2.0.1-rc.10');
  await expect(c.locator('[data-wm-plan="convert"]')).toBeVisible();
  await expect(c.locator('[data-wm-switch="enabled"]')).toHaveAttribute('data-state', 'off');
  await expect(c.locator('[data-wm-switch="core_risk"]')).toHaveCount(0);
  await expect(c.locator('[data-wm-actions]')).toHaveCount(0);
  await expect(c.locator('[data-wm-unattended]')).toBeVisible();
  const face = (await c.locator('[data-wm-card]').innerText()).toLowerCase();
  expect(face).not.toMatch(/home assistant|supervisor|wiskey\.|hikvision_intercom|auto_install/);
  await expect(page.locator(`${SCREEN} [data-wiskey-switch]`)).toHaveCount(5); // the switches card above is unchanged
  expect(sent).toEqual([]);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('turning on needs the exact typed phrase; the confirm button stays disabled until it matches', async ({ page }) => {
  const { sent } = await boot(page);
  const c = page.locator(CARD);
  await c.locator('[data-wm-switch="enabled"] [data-wm-toggle]').click();
  const dlg = c.locator('sw-dialog[data-wm-dialog="enabled-on"]');
  await expect(dlg.locator('[data-wm-phrase]')).toHaveText(PHRASES.enabled);
  await expect(dlg.locator('[data-wm-confirm]')).toHaveAttribute('disabled', '');
  await dlg.locator('[data-wm-phrase-input]').fill('מאשר');
  await expect(dlg.locator('[data-wm-confirm]')).toHaveAttribute('disabled', '');
  expect(sent).toEqual([]);
  await dlg.locator('[data-wm-phrase-input]').fill(PHRASES.enabled);
  await dlg.locator('[data-wm-confirm]').click();
  await expect.poll(() => sent).toEqual([{ method: 'PUT', path: '/switch', body: { switch: 'enabled', value: 'on', confirm: PHRASES.enabled } }]);
  await expect(c.locator('[data-wm-switch="enabled"]')).toHaveAttribute('data-state', 'on');
  await expect(c.locator('[data-wm-switch="core_risk"]')).toHaveAttribute('data-state', 'off');
  await expect(c.locator('[data-wm-adopt]')).toBeVisible();
  await expect(c.locator('[data-wm-upgrade]')).toHaveCount(0); // a manual install is adopted first
});

test('turning off asks with a plain confirmation and sends no phrase', async ({ page }) => {
  const { sent } = await boot(page, { enabled: true, ownership: 'adopted' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-switch="enabled"] [data-wm-toggle]').click();
  const dlg = c.locator('sw-dialog[data-wm-dialog="enabled-off"]');
  await expect(dlg.locator('[data-wm-phrase-input]')).toHaveCount(0);
  await dlg.locator('[data-wm-confirm]').click();
  await expect.poll(() => sent).toEqual([{ method: 'PUT', path: '/switch', body: { switch: 'enabled', value: 'off' } }]);
  await expect(c.locator('[data-wm-actions]')).toHaveCount(0);
});

test('adoption: typed phrase, then the check and the run are offered', async ({ page }) => {
  const { sent } = await boot(page, { enabled: true });
  const c = page.locator(CARD);
  await c.locator('[data-wm-adopt]').click();
  const dlg = c.locator('sw-dialog[data-wm-dialog="adopt"]');
  await expect(dlg.locator('[data-wm-phrase]')).toHaveText(PHRASES.adopt);
  await dlg.locator('[data-wm-phrase-input]').fill(PHRASES.adopt);
  await dlg.locator('[data-wm-confirm]').click();
  await expect.poll(() => sent).toEqual([{ method: 'POST', path: '/adopt', body: { confirm: PHRASES.adopt } }]);
  await expect(c.locator('[data-wm-notice]')).toBeVisible();
  await expect(c.locator('[data-wm-ownership="adopted"]')).toBeVisible();
  await expect(c.locator('[data-wm-check]')).toBeVisible();
  await expect(c.locator('[data-wm-upgrade]')).toBeVisible();
});

test('the dry-run check lists each verdict with its state', async ({ page }) => {
  await boot(page, { enabled: true, ownership: 'adopted' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-check]').click();
  await expect(c.locator('[data-wm-checks]')).toHaveAttribute('data-ready', 'no');
  await expect(c.locator('[data-wm-check-item="preflight"]')).toHaveAttribute('data-state', 'pass');
  await expect(c.locator('[data-wm-check-item="core_gate"]')).toHaveAttribute('data-state', 'fail');
  await expect(c.locator('[data-wm-check-item="core_gate"]')).toContainText('core_gate_unverified');
  await expect(c.locator('[data-wm-check-item="backup_check"]')).toHaveAttribute('data-state', 'pass');
});

test('the run: confirmation, step-by-step progress (polled), success, then the rollback is offered', async ({ page }) => {
  const { sent, errors } = await boot(page, { enabled: true, ownership: 'adopted' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-upgrade]').click();
  const dlg = c.locator('sw-dialog[data-wm-dialog="upgrade"]');
  await expect(dlg.locator('[data-wm-phrase-input]')).toHaveCount(0);
  await dlg.locator('[data-wm-confirm]').click();
  await expect.poll(() => sent.map((s) => s.path)).toEqual(['/upgrade']);
  await expect(c.locator('[data-wm-job]')).toBeVisible();
  await expect(c.locator('[data-wm-step="verify"]')).toBeVisible(); // the steps still to come are listed too
  await expect(c.locator('[data-wm-job]')).toHaveAttribute('data-state', 'succeeded', { timeout: 20_000 });
  for (const name of STEPS) await expect(c.locator(`[data-wm-step="${name}"]`)).toHaveAttribute('data-state', 'done');
  await expect(c.locator('[data-wm-ownership="arx_managed"]')).toBeVisible();
  await expect(c.locator('[data-wm-plan="up_to_date"]')).toBeVisible();
  await expect(c.locator('[data-wm-rollback]')).toBeVisible();
  await expect(c.locator('[data-wm-upgrade]')).toHaveCount(0);
  await noOverflow(page);
  expect(errors).toEqual([]);
});

test('a failed run that was rolled back says so, with the failed step and its code', async ({ page }) => {
  await boot(page, { enabled: true, ownership: 'adopted', upgrade: 'rolled_back' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-upgrade]').click();
  await c.locator('sw-dialog[data-wm-dialog="upgrade"] [data-wm-confirm]').click();
  await expect(c.locator('[data-wm-job]')).toHaveAttribute('data-state', 'rolled_back', { timeout: 20_000 });
  await expect(c.locator('[data-wm-step="verify"]')).toHaveAttribute('data-state', 'failed');
  await expect(c.locator('[data-wm-step="verify"]')).toContainText('entry_not_loaded');
  await expect(c.locator('[data-wm-step="verify_after_rollback"]')).toHaveAttribute('data-state', 'done');
});

test('a refused run (409) is worded from its code in the dialog and nothing starts', async ({ page }) => {
  const { sent } = await boot(page, { enabled: true, ownership: 'adopted', upgrade: 'plan_refused' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-upgrade]').click();
  await c.locator('sw-dialog[data-wm-dialog="upgrade"] [data-wm-confirm]').click();
  await expect(c.locator('[data-wm-dialog-error]')).toHaveText('אין עדכון שאפשר לבצע');
  expect(sent.map((s) => s.path)).toEqual(['/upgrade']);
  await expect(c.locator('[data-wm-job]')).toHaveCount(0);
});

test('the rollback asks first, then runs with progress', async ({ page }) => {
  const { sent } = await boot(page, { enabled: true, ownership: 'arx_managed' });
  const c = page.locator(CARD);
  await c.locator('[data-wm-rollback]').click();
  await c.locator('sw-dialog[data-wm-dialog="rollback"] [data-wm-confirm]').click();
  await expect.poll(() => sent.map((s) => s.path)).toEqual(['/rollback']);
  await expect(c.locator('[data-wm-job]')).toHaveAttribute('data-kind', 'rollback');
});

test('a caller the server refuses (403) does not see the card', async ({ page }) => {
  await boot(page, { get: 'forbidden' });
  await expect(page.locator(`${SCREEN} [data-wiskey-switches]`)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(`${CARD} [data-wm-card]`)).toHaveCount(0);
});
