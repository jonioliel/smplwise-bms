import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BANNER, GATE_CALL, LOBBY_CALL, installCallsMock, openApp } from './incoming-call-mocks';
import { installMulti } from './multi-nvr-mock';
import { appReady } from './helpers/app-ready';
import { settlePage } from './pixel-settle';

// PHYSICAL-CONFIRM-2540 (deep review 2520: SCR-11, SCR-12, SCR-14, SCR-15, SCR-18) against MOCKED backends - nothing physical exists here:
// invented stations (tests/incoming-call-mocks.ts), invented recorders (tests/multi-nvr-mock.ts), an invented device-test plan. It pins:
//   - the incoming-call banner: an unknown door outcome is amber "unknown", the door's button waits (held), ONE release; a refused one is
//     "the door was not opened"; a newer station ringing never swaps the sheet (the open door question stays with its call);
//   - the NVR system card: the alarm-output pulse runs only from its confirmation, which names the output and the recorder and opens on
//     cancel (Enter there sends nothing); ONE pulse to the confirmed recorder; an unanswered pulse is amber "unknown", a refusal red;
//   - the automation device test: a record that ends unknown is not "done", a failed one is an error with its reason; a sensitive step
//     runs only from its own confirmation (focus on cancel).
// Evidence screenshots (SW_SHOTS=1): docs/design/evidence/PHYSICAL-CONFIRM-2540/.
//   run_smart.py spec <branch> tests/evidence-physical-confirm-2540.spec.ts --project=desktop --project=mobile

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'PHYSICAL-CONFIRM-2540');

async function shot(page: Page, info: TestInfo, name: string) {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

const inBanner = (page: Page, sel: string) => page.locator(`${BANNER} ${sel}`);

/** Whether the focus (through the shadow roots) is inside the element matching `sel`. */
async function focusIn(page: Page, sel: string): Promise<boolean> {
  return page.evaluate((sel) => {
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    for (let n: Node | null = a; n; n = (n as Element).parentNode ?? ((n as ShadowRoot).host ?? null)) {
      if (n instanceof Element && n.matches(sel)) return true;
    }
    return false;
  }, sel);
}

test.describe('incoming call banner: honest door outcome, no swap under the finger', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('an unknown door outcome is amber "unknown", holds the door, and sends ONE release', async ({ page }, info) => {
    const m = await installCallsMock(page, {}, { release: 'unknown' });
    await openApp(page, '#/explore/floors/f0');
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-door="1"]').click();
    await inBanner(page, '[data-call-door-yes]').click();
    await expect(inBanner(page, '[data-call-note="warn"]')).toContainText('לא ידוע אם הפתיחה בוצעה');
    await expect(inBanner(page, '[data-call-note]')).not.toContainText('לא נפתחה');
    const door = inBanner(page, '[data-call-door="1"]');
    await expect(door).toHaveAttribute('data-call-door-held', 'true');
    await expect(door).toHaveAttribute('disabled', '');
    await expect(door).toContainText('ממתין לבירור');
    await door.click({ force: true }); // a held door takes no tap
    await expect(inBanner(page, '[data-call-door-ask]')).toHaveCount(0);
    expect(m.stations.released.length).toBe(1);
    await shot(page, info, 'banner-door-unknown');
  });

  test('a release the backend did not send is red "the door was not opened" and the door is offered again', async ({ page }) => {
    const m = await installCallsMock(page, {}, { release: 'not_sent' });
    await openApp(page, '#/explore/floors/f0');
    await expect(page.locator(BANNER)).toBeVisible({ timeout: 30_000 });
    await inBanner(page, '[data-call-door="1"]').click();
    await inBanner(page, '[data-call-door-yes]').click();
    await expect(inBanner(page, '[data-call-note="error"]')).toContainText('הדלת לא נפתחה');
    await expect(inBanner(page, '[data-call-door="1"]')).toHaveAttribute('data-call-door-held', 'false');
    await expect(inBanner(page, '[data-call-door="1"]')).not.toHaveAttribute('disabled', '');
    expect(m.stations.released.length).toBe(1);
  });

  test('a newer station ringing waits one tap away: the sheet and its open door question stay with the first call', async ({ page }, info) => {
    const m = await installCallsMock(page);
    await openApp(page, '#/explore/floors/f0');
    await expect(page.locator(BANNER)).toHaveAttribute('data-station', 'gate', { timeout: 30_000 });
    await inBanner(page, '[data-call-door="1"]').click();
    await expect(inBanner(page, '[data-call-door-ask="1"]')).toBeVisible();
    m.active.calls = [{ ...GATE_CALL }, { ...LOBBY_CALL }];
    m.stations.push();
    await expect(inBanner(page, '[data-call-next]')).toHaveText('עוד 1', { timeout: 15_000 });
    await expect(page.locator(BANNER)).toHaveAttribute('data-station', 'gate');
    await expect(inBanner(page, '[data-call-door-ask="1"]')).toBeVisible();
    await shot(page, info, 'banner-two-kept');
    // the operator moves on by himself: the question of the first call does not follow him
    await inBanner(page, '[data-call-door-no]').click();
    await inBanner(page, '[data-call-next]').click();
    await expect(page.locator(BANNER)).toHaveAttribute('data-station', 'lobby');
    await expect(inBanner(page, '[data-call-door-ask]')).toHaveCount(0);
    await expect(inBanner(page, '[data-call-door="1"]')).not.toHaveAttribute('disabled', '');
    expect(m.stations.released.length).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------ the NVR system card

interface PulseState { mode: 'ok' | 'unknown' | 'refused'; pulses: string[] }

async function installPulse(page: Page): Promise<PulseState> {
  const st: PulseState = { mode: 'ok', pulses: [] };
  await page.route('**/api/v1/nvr/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'nvr/system') {
      const rid = url.searchParams.get('recorder_id') ?? 'nvr-1';
      return json({ time: { local_time: '2026-10-04T10:00:00', mode: 'NTP', drift_s: 0, ntp: null }, disks: [],
        outputs: [{ id: 1, name: 'צופר חניון', use_type: 'normal', enabled: true, io_type: 'local', pulse_ms: 5000, default_state: 'low', pulse_supported: true }],
        errors: {}, can: { time: false, storage: false, alarm: true, reboot: false, osd: false, connection: true }, writes_enabled: true, recorder_id: rid });
    }
    const m = /^nvr\/outputs\/(\d+)\/pulse$/.exec(p);
    if (m && req.method() === 'POST') {
      st.pulses.push(`${m[1]}${url.search}`);
      if (st.mode === 'unknown') return json({ code: 'http_504', user_message: 'השרת לא ענה בזמן.', retryable: true, correlation_id: '', details: {} }, 504);
      if (st.mode === 'refused') return json({ code: 'nvr_rejected', user_message: 'ה־NVR דחה את המסמך.', retryable: false, correlation_id: '', details: {} }, 409);
      return json({ id: 'ch-1', kind: 'alarm_output', permission: 'nvr.alarm_output', target: 'output-1', path: 'x', status: 'applied', error: null, rollback_of: null, note: 'הפעלת יציאה (pulse)', actor_username: 'joni', created_at: '2026-10-04T10:00:00Z', has_before: false, has_after: true }, 201);
    }
    return route.fallback();
  });
  return st;
}

test.describe('NVR system card: the alarm-output pulse', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('the pulse runs only from its confirmation (names the output and the recorder, opens on cancel); ONE pulse; unknown is amber', async ({ page }, info) => {
    await installMulti(page);
    const st = await installPulse(page);
    await page.goto('about:blank');
    await page.goto('/?design=a#/system/setup');
    await appReady(page);
    const card = page.locator('sw-app system-setup [data-nvr-system]');
    const pulse = card.locator('[data-nvr-pulse="1"]');
    await expect(pulse).toBeVisible({ timeout: 30_000 });
    await pulse.click();
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('יציאה 1 · צופר חניון');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('NVR ראשי');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('ממסר פיזי');
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    await shot(page, info, 'nvr-pulse-confirm');
    await page.keyboard.press('Enter'); // the focus is on cancel: nothing is sent
    await expect(dlg).toHaveCount(0);
    expect(st.pulses).toEqual([]);
    // the second recorder: the confirmation names it, and the pulse goes there
    await card.locator('select[data-nvr-system-recorder]').selectOption('nvr-2');
    await expect(pulse).toBeVisible({ timeout: 15_000 });
    await pulse.click();
    await expect(dlg.locator('[data-confirm-text]')).toContainText('NVR מחסן');
    await dlg.locator('[data-confirm-ok]').click();
    await expect(card.locator('[data-nvr-system-msg="ok"]')).toContainText('ה־NVR אישר את הפקודה');
    expect(st.pulses).toEqual(['1?recorder_id=nvr-2']);
    // no answer from the recorder: unknown (amber), never "failed"
    st.mode = 'unknown';
    await pulse.click();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(card.locator('[data-nvr-system-msg="warn"]')).toContainText('לא ידוע אם הפעולה בוצעה');
    await shot(page, info, 'nvr-pulse-unknown');
    // a refusal is a failure (red), with the reason
    st.mode = 'refused';
    await pulse.click();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(card.locator('[data-nvr-system-msg="err"]')).toContainText('דחה');
    expect(st.pulses.length).toBe(3);
  });
});

// ------------------------------------------------------------------------------------------------ the automation device test

interface DevState { calls: { method: string; path: string; body: Record<string, unknown> | null }[]; lockResult: 'failed' | 'confirmed' }

async function mountDeviceTest(page: Page): Promise<DevState> {
  const st: DevState = { calls: [], lockResult: 'failed' };
  await installMulti(page); // a signed-in administrator (the shell opens the automations screen, whose chunk brings the element)
  await page.route('**/api/v1/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const method = req.method();
    const body = req.postData() ? (req.postDataJSON() as Record<string, unknown>) : null;
    const json = (b: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(b) });
    const rec = (id: string, entity: string, status: string, error: string | null = null) => ({ id, entity_id: entity, action_id: 'x', status, error, requested_at: '2026-10-20T10:00:00Z', confirmed_at: null, confirmation: 'state' });
    if (p === 'automations-ext/automation/a1/device-test') {
      return json({ end: 'ask', triggers: [], snapshot: [], steps: [
        { path: 'actions.0', sentence: 'הדלקת אור בלובי', action: 'light.turn_on', data: {}, entity_ids: ['light.lobby'], sensitive: false, now: [{ entity_id: 'light.lobby', state: 'off' }] },
        { path: 'actions.1', sentence: 'פתיחת מנעול הכניסה', action: 'lock.unlock', data: {}, entity_ids: ['lock.front'], sensitive: true, now: [{ entity_id: 'lock.front', state: 'locked' }] },
      ] });
    }
    const act = /^ha\/entities\/([^/]+)\/actions$/.exec(p);
    if (act && method === 'POST') {
      st.calls.push({ method, path: p, body });
      const id = act[1] === 'light.lobby' ? 'r-light' : 'r-lock';
      return json(rec(id, act[1], 'pending'), 202);
    }
    if (p === 'ha/actions/r-light') return json(rec('r-light', 'light.lobby', 'unknown'));
    if (p === 'ha/actions/r-lock') return json(st.lockResult === 'failed' ? rec('r-lock', 'lock.front', 'failed', 'ha_unauthorized') : rec('r-lock', 'lock.front', 'confirmed'));
    return route.fallback();
  });
  // the element comes with the automations screen's lazy chunk (a built preview serves no /src): open that screen, then mount the
  // element alone on the page (the screen's own data is not needed)
  await page.goto('about:blank');
  await page.goto('/?design=a#/devices/automations');
  await page.waitForFunction(() => !!customElements.get('kav-device-test'), null, { timeout: 30_000 });
  await page.evaluate(async () => {
    document.body.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'max-width:640px;margin:24px auto;padding:0 16px;display:grid;gap:8px;';
    const el = document.createElement('kav-device-test') as unknown as HTMLElement & { itemId: string; mode: string; flags: unknown };
    el.itemId = 'a1';
    el.mode = 'dev';
    el.flags = { device_test_end: 'ask' };
    wrap.append(el);
    document.body.append(wrap);
  });
  return st;
}

test.describe('automation device test: honest outcomes, a sensitive step asks first', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('no state report is "unknown", a refused device is an error, and an unlock step runs only from its confirmation', async ({ page }, info) => {
    const st = await mountDeviceTest(page);
    const light = page.locator('kav-device-test [data-kav-step="actions.0"]');
    const lock = page.locator('kav-device-test [data-kav-step="actions.1"]');
    await expect(light).toBeVisible({ timeout: 30_000 });
    await light.locator('button').click();
    await expect(light).toHaveAttribute('data-kav-step-state', 'unknown', { timeout: 15_000 });
    await expect(light).not.toContainText('הופעל');
    // the sensitive step: a confirmation first, on cancel - Enter sends nothing
    await lock.locator('button').click();
    const dlg = page.locator('sw-confirm-dialog');
    await expect(dlg.locator('[data-confirm-text]')).toContainText('פתיחת מנעול הכניסה');
    await expect.poll(() => focusIn(page, '[data-confirm-cancel]'), { timeout: 5_000 }).toBe(true);
    await shot(page, info, 'device-test-confirm');
    await page.keyboard.press('Enter');
    await expect(dlg).toHaveCount(0);
    expect(st.calls.filter((c) => c.path.includes('lock.front'))).toEqual([]);
    await expect(lock).toHaveAttribute('data-kav-step-state', 'idle');
    // confirmed: ONE action with the confirmation grant; the device refused -> an error with the reason
    await lock.locator('button').click();
    await dlg.locator('[data-confirm-ok]').click();
    await expect(lock).toHaveAttribute('data-kav-step-state', 'error', { timeout: 15_000 });
    await expect(lock).toContainText('אין הרשאה');
    const sent = st.calls.filter((c) => c.path.includes('lock.front'));
    expect(sent.length).toBe(1);
    expect(sent[0].body).toMatchObject({ allowed_action_id: 'lock.unlock', confirmation_grant: 'confirmed' });
    await shot(page, info, 'device-test-states');
  });
});
