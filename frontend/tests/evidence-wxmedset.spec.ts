import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installAccessMock, url, type AccessMock, type MockOptions } from './access-control-mocks';
import { installParityMock } from './access-parity-mocks';
import { settlePage } from './pixel-settle';

// WXMEDSET (owner 2026-10-13) against the mocked backend (tests/access-control-mocks.ts). Nothing here reaches a WisKey, Home Assistant or a
// station. Settings › כללי › מתגי מסכי כניסה › "תצוגת מסך התחנות": the row "וידאו ודיבור במסך התחנות" (`access.station_media`: off / video /
// video + talk) is a bare control - a label and a choice, no hint line - that saves exactly what changed through PATCH /settings.
// Evidence screenshots: docs/design/evidence/WX-small/. Needs the Vite dev server or a built preview (SW_BASE_URL):
//   SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test tests/evidence-wxmedset.spec.ts --workers=1
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'WX-small');
const SETTINGS = '/system/diagnostics?tab=access-control';
const DISPLAY = 'sw-app system-diagnostics system-access-display';
const MEDIA = `${DISPLAY} select[data-set-access-display="access.station_media"]`;

async function bootSettings(page: Page, opts: MockOptions = {}): Promise<{ mock: AccessMock; errors: string[] }> {
  const mock = await installAccessMock(page, opts);
  await installParityMock(page, mock, 'ready');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('about:blank');
  await page.goto(url(SETTINGS));
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${DISPLAY} sw-card[data-access-display="ready"]`)).toBeVisible({ timeout: 30_000 });
  return { mock, errors };
}

async function shot(page: Page, info: TestInfo, name: string, target: string) {
  fs.mkdirSync(EVIDENCE, { recursive: true });
  await settlePage(page);
  await page.locator(target).first().screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`) });
}

test.describe('WXMEDSET: the live video and talk row in Settings', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'behaviour runs on one project; the widths are the layout guard\'s');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  test('a bare row (label and choice, nothing explained), off by default, three choices in the owner\'s words', async ({ page }, info) => {
    const { errors } = await bootSettings(page);
    const row = page.locator(`${DISPLAY} [data-access-display-media]`);
    await expect(row).toBeVisible();
    await expect(row.locator('.lbl')).toHaveText('וידאו ודיבור במסך התחנות');
    await expect(row.locator('.muted, .hint, p, sw-badge')).toHaveCount(0);
    await expect(page.locator(MEDIA)).toHaveValue('off');
    expect(await page.locator(`${MEDIA} option`).evaluateAll((os) => os.map((o) => [(o as HTMLOptionElement).value, o.textContent?.trim()]))).toEqual([
      ['off', 'כבוי'],
      ['video', 'וידאו'],
      ['video_talk', 'וידאו ודיבור'],
    ]);
    await expect(page.locator(`${DISPLAY} sw-button[data-save-access-display]`)).toHaveAttribute('disabled', '');
    await shot(page, info, 'media-row-default', `${DISPLAY} sw-card`);
    expect(errors).toEqual([]);
  });

  test('saving sends exactly the one key that changed; the choice survives the save; setting it back leaves nothing to save', async ({ page }, info) => {
    const { mock } = await bootSettings(page);
    await page.locator(MEDIA).selectOption('video_talk');
    const save = page.locator(`${DISPLAY} sw-button[data-save-access-display]`);
    await expect(save).not.toHaveAttribute('disabled', '');
    await save.click();
    await expect(page.locator(`${DISPLAY} .msg.ok`)).toHaveText(/נשמר/);
    expect(mock.patches).toEqual([{ 'access.station_media': 'video_talk' }]);
    await expect(page.locator(MEDIA)).toHaveValue('video_talk');
    await expect(save).toHaveAttribute('disabled', '');
    await shot(page, info, 'media-row-saved', `${DISPLAY} sw-card`);
    await page.locator(MEDIA).selectOption('video');
    await page.locator(MEDIA).selectOption('video_talk');
    await expect(save).toHaveAttribute('disabled', '');
  });

  test('the server\'s value is shown; an unreadable one reads as off', async ({ page }) => {
    await bootSettings(page, { settings: { 'access.station_media': 'video' } });
    await expect(page.locator(MEDIA)).toHaveValue('video');
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await bootSettings(page, { settings: { 'access.station_media': 'hls' } });
    await expect(page.locator(MEDIA)).toHaveValue('off');
  });

  test('a failed save keeps the choice and says so; without system.configure the row is read only', async ({ page }) => {
    const { mock } = await bootSettings(page, { settingsPatch: 'fail' });
    await page.locator(MEDIA).selectOption('video');
    await page.locator(`${DISPLAY} sw-button[data-save-access-display]`).click();
    await expect(page.locator(`${DISPLAY} .msg.err`)).toBeVisible();
    await expect(page.locator(MEDIA)).toHaveValue('video');
    expect(mock.patches).toEqual([]);
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await bootSettings(page, { persona: 'siteAdmin' });
    await expect(page.locator(MEDIA)).toBeDisabled();
    await expect(page.locator(`${DISPLAY} sw-button[data-save-access-display]`)).toHaveCount(0);
  });
});
