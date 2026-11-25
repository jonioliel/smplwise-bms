import { expect, test, type Page, type Route, type WebSocketRoute } from '@playwright/test';
import { settle } from './helpers/settle';
import { mockHome } from './home-simple-mocks';

// SCREENS-FIX-A-2520 (SCR-06, deep screens review): the home interface's alarm screen against the mocked backend
// (tests/home-simple-mocks.ts + the routes below; nothing is sent anywhere, no panel is armed).
// - a pushed alarm-panel change re-reads the panels on a phone too (before: only a wall panel did, the screen stayed stale);
// - arm / disarm says "sent, waiting for the panel" and success only once the action record is confirmed; failed / unknown honestly;
// - a failed read of the panels is "unavailable", never "no alarm system connected".

const inHome = (page: Page) => page.locator('sw-home');
const json = (r: Route, body: unknown, status = 200) => r.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

function panel(state: string) {
  return {
    entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', platform: null, integration: '', integration_note: '', config_entry_id: null, state, available: true, fresh: true,
    last_changed: null, changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: false, needs_code_arm: false,
    needs_code_disarm: true, area_name: null, open_sensors: [], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
    can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: 'none', disarm: 'pin', bypass: 'none' },
  };
}

type Panels = { state: string; fail: boolean; reads: number };

async function open(page: Page, o: { fail?: boolean; actions?: string[] } = {}) {
  await page.setViewportSize({ width: 390, height: 844 }); // a phone: no wall-panel machine
  await page.goto('about:blank');
  const mock = await mockHome(page);
  const panels: Panels = { state: 'disarmed', fail: !!o.fail, reads: 0 };
  await page.route('**/api/v1/alarm/panels', (r) => {
    panels.reads++;
    if (panels.fail) return json(r, { code: 'unavailable', user_message: 'unavailable (sample)', retryable: true, correlation_id: 'mock', details: {} }, 503);
    return json(r, { panels: [panel(panels.state)], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false },
      code_mode: 'personal_pin', me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false });
  });
  await page.route('**/api/v1/alarm/me', (r) => json(r, { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true, pin_set_at: null, code_mode: 'personal_pin' }));
  // the action record's answers, one per read (the last one repeats)
  const answers = o.actions ?? ['confirmed'];
  let n = 0;
  await page.route('**/api/v1/ha/actions/al1', (r) => { const status = answers[Math.min(n++, answers.length - 1)]; return json(r, { id: 'al1', entity_id: 'alarm_control_panel.house', action_id: 'alarm_control_panel.alarm_arm_away', status, error: status === 'failed' ? 'refused' : null, requested_at: '', confirmed_at: null }); });
  const sockets: WebSocketRoute[] = [];
  await page.routeWebSocket('**/ha/ws', (ws) => { sockets.push(ws); });
  await page.goto('/#/home/security');
  await page.locator('sw-home').waitFor();
  await settle(page);
  const push = (state: string) => {
    for (const ws of sockets) ws.send(JSON.stringify({ type: 'entity_state_changed', payload: { entity: { entity_id: 'alarm_control_panel.house', state, attributes: {}, last_changed: '', last_updated: '' } } }));
  };
  return { mock, panels, push, sockets };
}

test.describe('SCREENS-FIX-A-2520 home alarm (SCR-06)', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
  });

  test('a phone on the alarm screen follows a pushed panel change (armed at the keypad)', async ({ page }) => {
    const { panels, push, sockets } = await open(page);
    await expect(inHome(page).locator('[data-home-alarm]')).toHaveAttribute('data-home-alarm', 'disarmed');
    await expect.poll(() => sockets.length).toBeGreaterThan(0);
    panels.state = 'armed_away';
    push('armed_away');
    await expect(inHome(page).locator('[data-home-alarm]')).toHaveAttribute('data-home-alarm', 'armed_away', { timeout: 5000 });
    await expect(inHome(page).locator('[data-home-alarm] .alm-w')).toHaveText('דרוכה: מלאה');
  });

  test('arm: "sent, waiting for the panel" first; a refusal is said as such, never "armed"', async ({ page }) => {
    const { mock } = await open(page, { actions: ['pending', 'failed'] });
    const toasts: string[] = [];
    await page.exposeFunction('__noteToast', (t: string) => { toasts.push(t); });
    await page.evaluate(() => {
      const root = document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home')!.shadowRoot!;
      new MutationObserver(() => { const t = root.querySelector('.toast2'); if (t?.textContent) (window as unknown as { __noteToast: (s: string) => void }).__noteToast(t.textContent.trim()); })
        .observe(root, { subtree: true, childList: true, characterData: true });
    });
    await inHome(page).locator('[data-act="almArm"][data-v="arm_away"]').click();
    await inHome(page).locator('[data-act="askYes"]').click();
    await expect.poll(() => mock.calls.filter((c) => c.path === 'alarm/actions').length).toBe(1);
    await expect(inHome(page).locator('.toast2')).toContainText('בקשת הדריכה נשלחה');
    await expect(inHome(page).locator('.toast2')).toContainText('הלוח לא דרך את האזעקה', { timeout: 8000 });
    expect(toasts.some((t) => t.includes('האזעקה נדרכת'))).toBe(false);
  });

  test('arm: success only once the panel confirmed it', async ({ page }) => {
    await open(page, { actions: ['pending', 'confirmed'] });
    await inHome(page).locator('[data-act="almArm"][data-v="arm_away"]').click();
    await inHome(page).locator('[data-act="askYes"]').click();
    await expect(inHome(page).locator('.toast2')).toContainText('בקשת הדריכה נשלחה');
    await expect(inHome(page).locator('.toast2')).toContainText('האזעקה נדרכת', { timeout: 8000 });
  });

  test('a failed read is "unavailable", never "no alarm system"; the last state read stays with a note', async ({ page }) => {
    const { panels } = await open(page, { fail: true });
    await expect(inHome(page).locator('#main')).toContainText('מצב האזעקה לא זמין כרגע');
    await expect(inHome(page).locator('#main')).not.toContainText('אין מערכת אזעקה מחוברת');
    // the read comes back, then fails again: the last panels stay, marked as the last state read
    panels.fail = false;
    await page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { loadPanels(): Promise<void> }).loadPanels());
    await expect(inHome(page).locator('[data-home-alarm]')).toHaveAttribute('data-home-alarm-read', 'ok');
    panels.fail = true;
    await page.evaluate(() => (document.querySelector('sw-app')!.shadowRoot!.querySelector('sw-home') as unknown as { loadPanels(): Promise<void> }).loadPanels());
    await expect(inHome(page).locator('[data-home-alarm]')).toHaveAttribute('data-home-alarm-read', 'error');
    await expect(inHome(page).locator('[data-home-alarm]')).toContainText('מוצג המצב האחרון שנקרא');
    await expect(inHome(page).locator('#main')).not.toContainText('אין מערכת אזעקה מחוברת');
  });
});
