import { test, expect, type Locator, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { installMulti } from './multi-nvr-mock';
import { settlePage } from './pixel-settle';

// PHYSICAL-CONFIRM-2540 pixel baselines: the NVR alarm-output pulse confirmation (the shared confirmation dialog, focus on cancel) and the
// card's amber "unknown" result line, against the mocked backend (tests/multi-nvr-mock.ts: invented recorders; fixed clock, performance:full).
// The ELEMENT is compared (the dialog panel, the card's output block), not the page behind it. Desktop 1440 and phone 390, light and dark.
// "pixel-stable" in every title: the release gate runs its pixel group with --grep pixel-stable.
// Baselines are per OS: the Linux ones are generated on the runner; on an OS without a baseline the check is skipped, not failed:
//   run_smart.py linux-pixel <branch> tests/pixel-physical-confirm-2540.spec.ts --project=desktop --project=mobile --update-snapshots

const wide = (info: TestInfo) => (info.project.name === 'mobile' ? '390' : '1440');
const noBaseline = (info: TestInfo, name: string) => !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function compare(el: Locator, info: TestInfo, name: string) {
  await settlePage(el.page());
  const file = `${name}-${wide(info)}.png`;
  if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
  else await expect(el).toHaveScreenshot(file, { maxDiffPixels: 40, animations: 'disabled' });
}

async function open(page: Page, scheme: 'light' | 'dark'): Promise<{ mode: 'ok' | 'unknown' }> {
  await installMulti(page);
  const st = { mode: 'ok' as 'ok' | 'unknown' };
  await page.route('**/api/v1/nvr/**', async (route: Route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname.replace(/^.*\/api\/v1\//, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (p === 'nvr/system') {
      return json({ time: { local_time: '2026-10-04T10:00:00', mode: 'NTP', drift_s: 0, ntp: null }, disks: [],
        outputs: [{ id: 1, name: 'צופר חניון', use_type: 'normal', enabled: true, io_type: 'local', pulse_ms: 5000, default_state: 'low', pulse_supported: true }],
        errors: {}, can: { time: false, storage: false, alarm: true, reboot: false, osd: false, connection: true }, writes_enabled: true, recorder_id: url.searchParams.get('recorder_id') ?? 'nvr-1' });
    }
    if (/^nvr\/outputs\/\d+\/pulse$/.test(p) && req.method() === 'POST') {
      return json({ code: 'http_504', user_message: 'השרת לא ענה בזמן.', retryable: true, correlation_id: '', details: {} }, 504);
    }
    return route.fallback();
  });
  await page.clock.setFixedTime(new Date('2026-10-04T09:00:00Z'));
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}&look=performance:full#/system/setup`);
  await page.waitForSelector('sw-app');
  await expect(page.locator('sw-app system-setup [data-nvr-system] [data-nvr-pulse="1"]')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  return st;
}

test.describe('physical action confirmation pixels', () => {
  test.beforeEach(({}, info) => {
    test.skip(info.project.name === 'tablet', 'desktop and phone only');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`classic ${scheme} is pixel-stable: the alarm-output pulse confirmation and the unknown result`, async ({ page }, info) => {
      await open(page, scheme);
      const card = page.locator('sw-app system-setup [data-nvr-system]');
      await card.locator('[data-nvr-pulse="1"]').click();
      const box = page.locator('sw-confirm-dialog sw-dialog .box[role="dialog"]');
      await expect(box).toBeVisible();
      await compare(box, info, `pulse-confirm-${scheme}`);
      await page.locator('sw-confirm-dialog [data-confirm-ok]').click();
      const msg = card.locator('[data-nvr-system-msg="warn"]');
      await expect(msg).toBeVisible();
      // the row is photographed at rest: the button enabled again, no focus ring from the dialog's focus return, no hover
      await expect(card.locator('[data-nvr-pulse="1"]')).not.toHaveAttribute('disabled', '');
      await page.mouse.move(0, 0);
      await page.evaluate(() => {
        let a: Element | null = document.activeElement;
        while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
        (a as HTMLElement | null)?.blur?.();
      });
      await page.waitForTimeout(300);
      await compare(card.locator('[data-nvr-output="1"]'), info, `pulse-output-${scheme}`);
      await compare(msg, info, `pulse-unknown-${scheme}`);
    });
  }
});
