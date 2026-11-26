import { test, expect, type Locator, type Page, type Route } from '@playwright/test';
import { installAccessMock, NOW, url as accessUrl } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock } from './schedule-writes-mocks';
import { installExecMock, newExecMock } from './schedule-exec-mocks';
import { INSTALLATION, installTicketsMock, url as ticketsUrl } from './tickets-mocks';

// CONTROLLED-TOGGLES-2540 (deep review FC-01 follow-up, owner rule "one row per screen family with its own tests"): the switches that save
// at once are `controlled` (HONEST-STATES-2540's opt-in sw-toggle mode). A press only asks; the switch moves when the screen has the saved
// answer. Each family below proves the same two things against a MOCKED backend (invented data, nothing is sent anywhere):
//   - a refused save leaves the switch exactly where it was (before this row it stayed on the state the server had refused);
//   - an accepted save moves it (the controlled switch is not stuck).
// The behaviour runs on the desktop project only (the switch is the same component on every width).

/** The drawn state of a sw-toggle: its button's aria-checked and the element's own property agree. */
async function expectSwitch(sw: Locator, on: boolean): Promise<void> {
  await expect(sw.locator('button[role="switch"]')).toHaveAttribute('aria-checked', String(on));
  await expect(sw).toHaveJSProperty('checked', on);
}

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const refusal = (status: number) => ({ code: status === 409 ? 'revision_conflict' : 'internal', user_message: 'השרת לא שמר את השינוי (דוגמה).', retryable: false, correlation_id: 'mock', details: {} });

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'one project is enough for the behaviour');
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
});

// ------------------------------------------------------------------------------------------------ schedules

test.describe('schedules: the WisKey schedule "status in WisKey" switch', () => {
  const BLOCK = 'sw-app wiskey-schedules wk-schedule-library wk-schedule-exec';

  async function boot(page: Page) {
    await installAccessMock(page, { settings: { 'access.ui.schedules': 'smplwise' } });
    await installSchedWritesMock(page, newSchedMock());
    const m = newExecMock({ refuseSwitch: true });
    await installExecMock(page, m);
    await page.clock.setFixedTime(NOW);
    await page.goto('about:blank');
    await page.goto(accessUrl('/wiskey/schedules?manage=1'));
    await page.waitForSelector('sw-app');
    await expect(page.locator(`${BLOCK} [data-sx-switch]`)).toBeVisible({ timeout: 30_000 });
    return m;
  }

  test('a refused save leaves the switch off; an accepted one turns it on', async ({ page }) => {
    const m = await boot(page);
    const sw = page.locator(`${BLOCK} [data-sx-switch]`);
    await expectSwitch(sw, false);
    await sw.locator('button').click();
    await expect.poll(() => m.calls.filter((c) => c.method === 'PUT').length).toBe(1);
    await expect(page.locator(`${BLOCK} [data-sx-note]`)).toContainText('לא שמר');
    await expectSwitch(sw, false);
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveAttribute('data-sx-state', 'off');

    m.refuseSwitch = false;
    await sw.locator('button').click();
    await expect(page.locator(`${BLOCK} [data-sx]`)).toHaveAttribute('data-sx-state', 'supported');
    await expectSwitch(sw, true);
    expect(m.calls.filter((c) => c.method === 'PUT').map((c) => c.body)).toEqual([{ enabled: true }, { enabled: true }]);
  });
});

// ------------------------------------------------------------------------------------------------ tickets settings

test.describe('tickets settings: the installation and department switches', () => {
  const S = 'sw-app system-tickets';
  const UI = { detail: 'drawer_fullscreen', new_ticket: 'sheet', detail_tab: 'overview', drawer_size: 'wide', phone_sheet: 'full' };

  /** tickets-mocks answers the reads; this layer (registered after it, so it answers first) refuses or keeps the writes under test. */
  async function boot(page: Page, hash: string) {
    await installTicketsMock(page, { persona: 'admin' });
    const st = { refuse: true, puts: [] as Record<string, unknown>[], patches: [] as Record<string, unknown>[] };
    await page.route('**/api/v1/tickets/settings', async (route) => {
      const req = route.request();
      if (req.method() !== 'PUT') return route.fallback();
      const body = req.postDataJSON() as Record<string, unknown>;
      st.puts.push(body);
      if (st.refuse) return json(route, refusal(500), 500);
      const { revision: _r, ...patch } = body;
      return json(route, { revision: 2, ui: UI, ...INSTALLATION, ...patch });
    });
    await page.route('**/api/v1/tickets/admin/departments/dept-maintenance', async (route) => {
      const req = route.request();
      if (req.method() !== 'PATCH') return route.fallback();
      st.patches.push(req.postDataJSON() as Record<string, unknown>);
      return json(route, refusal(409), 409); // a conflict: the editor re-reads the department, which still shares the history
    });
    await page.goto('about:blank');
    await page.goto(ticketsUrl(hash));
    return st;
  }

  test('"urgent is critical": a refused save leaves it on; an accepted one turns it off', async ({ page }) => {
    const st = await boot(page, '/system/tickets');
    const sw = page.locator(`${S} [data-inst-urgent]`);
    await expect(sw).toBeVisible({ timeout: 30_000 });
    await expectSwitch(sw, true);
    await sw.locator('button').click();
    await expect.poll(() => st.puts.length).toBe(1);
    expect(st.puts[0]).toEqual({ revision: 1, urgent_is_critical: false });
    await expect(sw).not.toHaveAttribute('disabled', '');
    await expectSwitch(sw, true);

    st.refuse = false;
    await sw.locator('button').click();
    await expect.poll(() => st.puts.length).toBe(2);
    await expectSwitch(sw, false);
  });

  test('a department: "share the history" - a refused save (conflict, re-read) leaves it on', async ({ page }) => {
    const st = await boot(page, '/system/tickets?tab=departments');
    const sw = page.locator(`${S} tickets-dept-editor [data-dept-history]`);
    await expect(sw).toBeVisible({ timeout: 30_000 });
    await expectSwitch(sw, true);
    await sw.locator('button').click();
    await expect.poll(() => st.patches.length).toBe(1);
    expect(st.patches[0]).toEqual({ share_history_external: false, revision: 2 });
    await expect(sw).not.toHaveAttribute('disabled', '');
    await expectSwitch(sw, true);
  });
});
