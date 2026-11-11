import { test, expect, type Page, type Route } from '@playwright/test';

// HEALTH-GO2RTC-FOLLOWUP-2431 (docs/changes/HEALTH-GO2RTC-FOLLOWUP-2431.md), demo mode with a mocked /api/v1/system/video-services:
// the "video service" picker lists the services found with their state, offers "use this" on the others, asks before switching, sends
// only the slug, and shows the new one in use; the compact form (inside a tile's "video service unavailable" notice) shows at most two
// rows and nothing at all when the list is refused. What it does not prove: the real Supervisor listing or a real switch (lab check).

const CAND = (slug: string, name: string, over: Record<string, unknown> = {}) => ({
  slug, name, state: 'started', version: '1.9.9', image_go2rtc: true, address: `${slug.replace(/_/g, '-')}:1984`, probe: 'ok', go2rtc_version: '1.9.9', current: false, ...over,
});

function viewOf(currentSlug: string | null) {
  const cands = [
    CAND('a1_go2rtc', 'go2rtc'),
    CAND('b2_go2rtc_door', 'go2rtc (door stations)', { state: 'stopped', probe: 'not_probed', go2rtc_version: null, version: '1.9.4' }),
    CAND('c3_go2rtc_old', 'go2rtc old', { probe: 'unreachable', go2rtc_version: null }),
  ].map((c) => ({ ...c, current: c.slug === currentSlug }));
  return {
    supported: true, reason: null, checked_at: '2026-11-11T10:00:00Z',
    current: { source: currentSlug ? 'selection' : 'option', address: currentSlug ? `${currentSlug.replace(/_/g, '-')}:1984` : 'old-host:1984', state: 'reachable', slug: currentSlug },
    option_address: 'old-host:1984',
    selection: currentSlug ? { slug: currentSlug, name: 'go2rtc', at: '2026-11-11T10:00:00Z', by: 'joni', address: `${currentSlug.replace(/_/g, '-')}:1984` } : null,
    candidates: cands,
    restart_recommended: !!currentSlug,
  };
}

async function mock(page: Page, calls: { put: unknown[]; get: number }, refuse = false) {
  await page.route('**/api/v1/system/video-services**', (route: Route) => {
    const req = route.request();
    if (refuse) calls.get += 1;
    if (refuse) return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 'forbidden', user_message: 'אין הרשאה' }) });
    if (req.method() === 'PUT') {
      const body = req.postDataJSON() as { slug: string };
      calls.put.push(body);
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(viewOf(body.slug)) });
    }
    calls.get += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(viewOf(null)) });
  });
}

async function mount(page: Page, compact: boolean) {
  await page.goto('/#/live/wall');
  await page.locator('sw-app[data-shell-ready]').waitFor();
  await page.evaluate(async (c) => {
    await customElements.whenDefined('sw-video-service-picker'); // defined by sw-live-player, which the wall route loads
    const el = document.createElement('sw-video-service-picker') as HTMLElement & { compact: boolean };
    el.id = 'picker';
    el.compact = c;
    el.dir = 'rtl';
    el.style.cssText = 'position:fixed;inset:20px auto auto 20px;width:520px;z-index:99999;background:#fff;color:#111;padding:12px';
    document.body.append(el);
  }, compact);
}

test('the picker lists the services, asks before switching, sends only the slug and shows the new one in use', async ({ page }) => {
  const calls = { put: [] as unknown[], get: 0 };
  await mock(page, calls);
  await mount(page, false);
  const picker = page.locator('#picker');
  await expect(picker.locator('[data-video-candidate]')).toHaveCount(3, { timeout: 10_000 });
  await expect(picker.locator('[data-video-current]')).toContainText('old-host:1984');
  await expect(picker.locator('[data-video-candidate="a1_go2rtc"] [data-candidate-line]')).toContainText('פועל · עונה');
  await expect(picker.locator('[data-video-candidate="b2_go2rtc_door"] [data-candidate-line]')).toContainText('כבוי');
  // order: running and answering first, the stopped one last
  await expect(picker.locator('[data-video-candidate]').first()).toHaveAttribute('data-video-candidate', 'a1_go2rtc');
  await expect(picker.locator('[data-video-candidate]').last()).toHaveAttribute('data-video-candidate', 'b2_go2rtc_door');
  await expect(picker).not.toContainText(/home assistant|supervisor/i);
  await page.screenshot({ path: test.info().outputPath('video-services-list.png') });
  await picker.locator('[data-use-service="a1_go2rtc"]').click();
  await expect(picker.locator('[data-use-confirm="a1_go2rtc"]')).toBeVisible();
  expect(calls.put, 'nothing is sent before the confirmation').toEqual([]);
  await picker.locator('[data-use-confirm-yes]').click();
  await expect(picker.locator('[data-use-done]')).toContainText('נבחר');
  expect(calls.put).toEqual([{ slug: 'a1_go2rtc' }]);
  await expect(picker.locator('[data-video-candidate="a1_go2rtc"]')).toHaveAttribute('data-current', '');
  await expect(picker.locator('[data-use-service="a1_go2rtc"]')).toHaveCount(0);
  await expect(picker.locator('[data-video-restart]')).toBeVisible();
  await expect(picker.locator('[data-video-back-to-option]')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('video-services-chosen.png') });
});

test('the compact form shows at most two rows, and nothing when the list is refused', async ({ page }) => {
  const calls = { put: [] as unknown[], get: 0 };
  await mock(page, calls);
  await mount(page, true);
  await expect(page.locator('#picker [data-video-candidate]')).toHaveCount(2, { timeout: 10_000 });
  await expect(page.locator('#picker [data-video-candidate]').first()).toHaveAttribute('data-video-candidate', 'a1_go2rtc');
});

test('a refused list renders nothing in the compact form', async ({ page }) => {
  const calls = { put: [] as unknown[], get: 0 };
  await mock(page, calls, true);
  await mount(page, true);
  await expect.poll(() => calls.get, { timeout: 10_000 }).toBeGreaterThan(0);
  await expect(page.locator('#picker [data-video-services-compact]')).toHaveCount(0);
  await expect(page.locator('#picker [data-video-candidate]')).toHaveCount(0);
});
