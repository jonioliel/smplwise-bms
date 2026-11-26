import { test, expect, type Locator, type Page } from '@playwright/test';
import { installAccessMock, NOW, url as accessUrl } from './access-control-mocks';
import { installSchedWritesMock, newSchedMock } from './schedule-writes-mocks';
import { installExecMock, newExecMock } from './schedule-exec-mocks';

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
