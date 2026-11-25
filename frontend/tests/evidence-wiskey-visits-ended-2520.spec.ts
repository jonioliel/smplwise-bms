import { test, expect, type Page, type Route, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { url } from './access-control-mocks';
import { installExternalMock, XNOW } from './access-external-mocks';
import { settlePage } from './pixel-settle';

// WISKEY-VISITS-ENDED-FILTER-2520 against a mocked backend (invented sample data; nothing reaches a WisKey, a station or a door).
// The external-access settings dialog's visits block (wiskey-visits-panel):
//   - rc.10 (the lab: the record command is not offered, `capabilities.visits.statuses` has no `ended`): no status filter, the list is
//     read without a status - the block is exactly as before;
//   - rc.19+ (`statuses` lists `ended`): a status filter above the list; "הסתיים" reads `status=ended` and shows only the ended rows.
// Screenshots of the block (desktop and phone, light and dark) into EVIDENCE_DIR when it is set (the row's compare page).
// SW_BEFORE=1: run against the base build for the "before" shots - the filter assertions are skipped there.
// Needs the Vite dev server or a built preview (SW_BASE_URL). Runner only.
const SCREEN = 'sw-app access-external-screen';
const PANEL = `${SCREEN} wiskey-visits-panel`;
const BEFORE = process.env.SW_BEFORE === '1';
const SIX = ['all', 'pending', 'approved', 'rejected', 'cancelled', 'superseded'];

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

const row = (id: string, name: string, status: string, origin: 'arx' | 'wiskey') => ({
  id, status, reason_code: null, requested_at: '2026-10-19T08:00:00+00:00', decided_at: '2026-10-19T08:05:00+00:00', display_name: name,
  access_category: 'visitor', valid_from: '2026-10-20T06:00:00+00:00', valid_until: '2026-10-20T16:00:00+00:00', doors: { 'st-a': [1] },
  weekly_hours: false, stale: false, user_deleted: false, source: origin, external_ref: origin === 'arx' ? `inv-${id}` : null, revision: 2,
  origin, arx_invite_id: origin === 'arx' ? `inv-${id}` : null, read_only: true,
});
const ROWS = [
  row('v1', 'נועה לוי', 'pending', 'wiskey'),
  row('v2', 'יוסי כהן', 'approved', 'wiskey'),
  row('v3', 'דנה בדיקה', 'ended', 'arx'),
  row('v4', 'אבי מזרחי', 'ended', 'arx'),
];

async function boot(page: Page, offered: boolean, scheme: 'light' | 'dark') {
  await installExternalMock(page, {});
  const reads: (string | null)[] = [];
  const cap = (over: Record<string, unknown> = {}) => ({ available: true, reason: null, message: null, ...over });
  await page.route('**/api/v1/access/wiskey-visits**', (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname.replace(/^.*\/api\/v1\/access\/wiskey-visits/, '');
    if (p === '') {
      return json(route, {
        capabilities: {
          visits: cap({ statuses: offered ? [...SIX, 'ended'] : SIX }),
          templates: cap(),
          push: offered ? cap({ switch: 'on', offered: true })
            : cap({ available: false, reason: 'push_not_offered', message: 'מערכת בקרת הכניסה המותקנת עדיין אינה מציעה רישום של ביקור שנוצר ב-Arx.', switch: 'off', offered: false }),
        },
        can: { list: true, settings: true },
      });
    }
    if (p === '/visits') {
      const status = u.searchParams.get('status');
      reads.push(status);
      const items = ROWS.filter((r) => (offered || r.status !== 'ended') && (!status || r.status === status));
      return json(route, { state: 'ready', last_error: null, fetched_at: XNOW.toISOString(), visits: { items, total: items.length, offset: 0, next_offset: null, revision: 4 } });
    }
    if (p === '/templates') return json(route, { state: 'ready', last_error: null, templates: { items: [], revision: 1 } });
    if (p === '/links') return json(route, { links: [] });
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  await page.clock.setFixedTime(XNOW);
  await page.goto('about:blank');
  await page.goto(url('/wiskey/external', 'classic', scheme));
  await page.locator(`${SCREEN} [data-open-settings]`).first().click();
  await expect(page.locator(`${PANEL} [data-visits]`)).toBeVisible({ timeout: 30_000 });
  return reads;
}

async function shot(page: Page, info: TestInfo, name: string) {
  const dir = process.env.EVIDENCE_DIR;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.locator(PANEL).scrollIntoViewIfNeeded();
  await settlePage(page);
  await page.locator(`${SCREEN} [data-visits-section]`).screenshot({ path: path.join(dir, `${name}-${info.project.name}.png`) });
}

for (const scheme of ['light', 'dark'] as const) {
  test(`rc.10: no status filter, the list is read without a status (${scheme})`, async ({ page }, info) => {
    const reads = await boot(page, false, scheme);
    await expect(page.locator(`${PANEL} [data-visit-status-filter]`)).toHaveCount(0);
    expect(reads).toEqual([null]);
    await shot(page, info, `${BEFORE ? 'before' : 'after'}-rc10-${scheme}`);
  });

  test(`rc.19+: the filter with "ended" reads only the ended visits (${scheme})`, async ({ page }, info) => {
    const reads = await boot(page, true, scheme);
    await shot(page, info, `${BEFORE ? 'before' : 'after'}-rc19-${scheme}`);
    if (BEFORE) return;
    const filter = page.locator(`${PANEL} [data-visit-status-filter]`);
    await expect(filter).toBeVisible();
    await expect(filter.locator('button')).toHaveCount(7);
    await filter.locator('[data-visit-status="ended"]').click();
    await expect(page.locator(`${PANEL} [data-visits] tr`)).toHaveCount(2);
    await expect(filter.locator('[data-visit-status="ended"]')).toHaveAttribute('aria-pressed', 'true');
    expect(reads).toEqual([null, 'ended']);
    await shot(page, info, `after-rc19-ended-${scheme}`);
  });
}
