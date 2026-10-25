import { test, expect, type Page, type Route } from '@playwright/test';
import { installGeneratorMock, url } from './generator-mocks';
import { tree } from './bubble-mocks';

// NOTICEDEL-295 evidence: real deletion of a notice (row action, the confirmation that names the notice, the extra tick for a notice on air),
// the setting that hides the places tree, and the empty-filter row. Real build, fake data.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/evidence-noticedel-295.spec.ts
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const NOW = '2026-10-24T06:12:00Z';
const mk = (id: string, title: string, o: Record<string, unknown> = {}) => ({
  id, title, body: 'שורה ראשונה של ' + title, severity: 'info', starts_at: '2026-10-24T05:30:00Z', ends_at: '2026-10-27T09:00:00Z', pinned: false, state: 'active', dwell_s: null,
  when_text: null, published_at: '2026-10-24T05:40:00Z', updated_at: NOW, boards: [], read: true, audience: { everyone: true }, status: 'published', reads: 3, ...o,
});
const FLOORS = [{ id: 'f1', name: 'קומה 1', building: 'מבנה א' }, { id: 'f2', name: 'קומה 2', building: 'מבנה א' }];
const SETTINGS = {
  enabled: true, default_days: 7, default_severity: 'info', push_default: 'by_severity', reads_names: true, retention_days: 365, home_empty: 'hide', show_places_tree: true, boards_remote: false,
  boards_max: 10, weather_entity: '', weather_fallback: false, news_custom: false, building_name: '', boards_origin: '', news_sources: [],
};

async function install(page: Page, o: { canDelete?: boolean; tree?: boolean } = {}): Promise<{ calls: string[]; patches: unknown[] }> {
  const canDelete = o.canDelete ?? true;
  const showTree = o.tree ?? true;
  let notices = [
    mk('n1', 'הפסקת מים מחר', { severity: 'critical' }),
    mk('n2', 'טיפול במעלית', { severity: 'alert', audience: { floors: ['f1'] } }),
    mk('n3', 'תוכנית ישנה', { state: 'expired', ends_at: '2026-10-20T09:00:00Z' }),
    mk('n4', 'טיוטה לבדיקה', { state: 'draft', status: 'draft', reads: 0 }),
  ];
  const can = { view: true, manage: true, manage_all: true, push: true, boards: true, configure: true, delete: canDelete };
  const perms = ['devices.read', 'notices.view', 'notices.manage', 'notices.boards', 'system.configure', ...(canDelete ? ['notices.delete'] : [])];
  await installGeneratorMock(page, { perms, count: 0, modules: { tickets: false, notices: true } as { tickets: boolean } });
  const calls: string[] = [];
  const patches: unknown[] = [];
  await page.route('**/api/v1/notices**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname.replace(/^.*\/api\/v1\//, '');
    calls.push(`${req.method()} ${p}${u.search}`);
    if (p === 'notices/module') return json(route, { enabled: true, can });
    if (p === 'notices' && req.method() === 'GET') return json(route, { notices, can, now: NOW, defaults: { default_days: 7, default_severity: 'info', home_empty: 'hide', show_places_tree: showTree } });
    if (p === 'notices/settings') {
      if (req.method() === 'PATCH') patches.push(req.postDataJSON());
      return json(route, { settings: { ...SETTINGS, show_places_tree: showTree }, can, weather_entities: [], company_logo: false, listener: false, building_fallback: '' });
    }
    if (p === 'notices/boards' && req.method() === 'GET') return json(route, { boards: [], full: true, max: 10, remote: false });
    if (p === 'notices/audience/options') return json(route, { floors: FLOORS, areas: [], groups: [], roles: [] });
    const del = /^notices\/(n\d)$/.exec(p);
    if (del && req.method() === 'DELETE') {
      const n = notices.find((x) => x.id === del[1]);
      if (n?.state === 'active' && u.searchParams.get('confirm_live') !== 'true') return json(route, { code: 'confirm_live_required', user_message: 'נדרש אישור נוסף', retryable: false, correlation_id: 'mock', details: {} }, 409);
      notices = notices.filter((x) => x.id !== del[1]);
      return json(route, { deleted: true });
    }
    return json(route, { code: 'not_found', user_message: 'לא נמצא', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
  await page.route('**/api/v1/devices/tree', (route) => json(route, tree()));
  return { calls, patches };
}

const phone = () => test.info().project.name === 'mobile';
const titles = (page: Page) => page.locator('sw-app devices-notices').locator(phone() ? '.card .t1' : 'table.t tbody .t1').allTextContents();
const rowDelete = (page: Page, title: string) =>
  page.locator('sw-app devices-notices').locator(phone() ? '.card' : 'table.t tbody tr').filter({ hasText: title }).locator('[data-delete]');

test('delete: a notice on air needs the tick, then goes with confirm_live; the list drops it', async ({ page }) => {
  const { calls } = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  await expect(rowDelete(page, 'הפסקת מים מחר')).toBeVisible();
  await rowDelete(page, 'הפסקת מים מחר').click();
  const dlg = page.locator('sw-app devices-notices notice-delete');
  await expect(dlg.locator('[data-delete-line]')).toContainText('"הפסקת מים מחר"');
  await expect(dlg.locator('[data-delete-line]')).toContainText('אי אפשר לשחזר');
  await expect(dlg.locator('[data-delete-confirm]')).toHaveAttribute('disabled', '');
  await dlg.locator('[data-delete-live]').check();
  await expect(dlg.locator('[data-delete-confirm]')).not.toHaveAttribute('disabled', '');
  await dlg.locator('[data-delete-confirm]').click();
  await expect(page.locator('sw-app devices-notices .toast')).toContainText('נמחקה');
  expect(calls).toContain('DELETE notices/n1?confirm_live=true');
  expect(await titles(page)).not.toContain('הפסקת מים מחר');
});

test('delete: an expired notice and a draft need no tick and send no confirm_live', async ({ page }) => {
  const { calls } = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  await rowDelete(page, 'תוכנית ישנה').click();
  const dlg = page.locator('sw-app devices-notices notice-delete');
  await expect(dlg.locator('[data-delete-live]')).toHaveCount(0);
  await expect(dlg.locator('[data-delete-confirm]')).not.toHaveAttribute('disabled', '');
  await dlg.locator('[data-delete-confirm]').click();
  await expect.poll(() => calls.includes('DELETE notices/n3')).toBe(true);
  await rowDelete(page, 'טיוטה לבדיקה').click();
  await dlg.locator('[data-delete-confirm]').click();
  await expect.poll(() => calls.includes('DELETE notices/n4')).toBe(true);
});

test('delete: without notices.delete only the draft offers it', async ({ page }) => {
  await install(page, { canDelete: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  await expect(page.locator('sw-app devices-notices [data-kpis]')).toBeVisible();
  await expect(rowDelete(page, 'הפסקת מים מחר')).toHaveCount(0);
  await expect(rowDelete(page, 'טיוטה לבדיקה')).toHaveCount(1);
});

test('setting: the places tree off gives a full-width list with no place filter', async ({ page }) => {
  await install(page, { tree: false });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  await expect(root.locator('[data-kpis]')).toBeVisible();
  await expect(root.locator('notice-places')).toHaveCount(0);
  await expect(root.locator('[data-place-select]')).toHaveCount(0);
  await expect(root.locator('.with-tree')).toHaveCount(0);
  expect(await titles(page)).toHaveLength(4);
});

test('setting: the tree on offers the place filter, and an empty filter says so with a way back', async ({ page }) => {
  await install(page, { tree: true });
  await page.goto('about:blank');
  await page.goto(url('/devices/notices'));
  const root = page.locator('sw-app devices-notices');
  if (phone()) await root.locator('[data-place-select]').selectOption('f:f2');
  else await root.locator('notice-places [data-place="f:f2"]').click();
  await expect(root.locator('[data-no-rows]:visible')).toBeVisible();
  await expect(root.locator('[data-no-rows]:visible')).toContainText('אין הודעות בסינון הזה');
  await root.locator('[data-clear-filters]:visible').click();
  await expect(root.locator('[data-no-rows]')).toHaveCount(0);
  expect(await titles(page)).toHaveLength(4);
});

test('settings screen: the places-tree switch saves show_places_tree', async ({ page }) => {
  const { patches } = await install(page);
  await page.goto('about:blank');
  await page.goto(url('/system/notices'));
  const sw = page.locator('sw-app [data-places-tree-setting] input');
  await expect(sw).toBeChecked();
  await sw.uncheck();
  await expect.poll(() => patches.length).toBeGreaterThan(0);
  expect(patches[0]).toEqual({ show_places_tree: false });
});
