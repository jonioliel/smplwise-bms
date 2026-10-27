import { test, expect } from '@playwright/test';

// Evidence for the owner's test-round batch 2 (0.1.62) against the running developer backend: the history map
// linked from the navigation lands on a real floor instead of "floor not found", and review windows can span all
// cameras, a room or a floor with a chosen gap. Runs only with SW_LIVE=1.

test.describe('owner round 2 (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('history map: the generic navigation link lands on the first real floor', async ({ page, request }) => {
    test.setTimeout(120000);
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const first = tree.sites.flatMap((s: { buildings: { floors: { id: string }[] }[] }) => s.buildings.flatMap((b) => b.floors))[0];
    expect(first, 'a floor').toBeTruthy();
    await page.goto('/?design=a#/investigate/floors/f0/history');
    await expect.poll(() => page.evaluate(() => location.hash), { timeout: 20000 }).toContain(`/investigate/floors/${first.id}/history`);
    const screen = page.locator('investigate-history-map');
    await expect(screen).toContainText('המפה בזמן שנבחר', { timeout: 30000 });
    await expect(screen.locator('sw-state-panel[state="error"]')).toHaveCount(0);
  });

  test('review windows: grouping by all cameras / room / floor and a wider gap', async ({ page, request }) => {
    test.setTimeout(120000);
    const all = await (await request.get('/api/v1/events/windows?by=all&gap=1800')).json();
    expect(all.group).toBe('all');
    // system windows (sensor transitions without a camera) stay one per event; camera windows carry the group label
    const grouped = (all.windows as { id: string; camera_id: string | null; camera_name: string; camera_ids: string[] }[]).filter((w) => !w.id.startsWith('system:'));
    for (const w of grouped) {
      expect(w.camera_id).toBeNull();
      expect(w.camera_name).toBe('כל המצלמות');
      expect(w.camera_ids.length).toBeGreaterThan(0);
    }
    const perCam = await (await request.get('/api/v1/events/windows?by=camera&gap=180')).json();
    expect((all.windows as unknown[]).length).toBeLessThanOrEqual((perCam.windows as unknown[]).length);
    const byFloor = await (await request.get('/api/v1/events/windows?by=floor')).json();
    expect(byFloor.group).toBe('floor');
    // the UI: the selects exist in windows mode and switching to "כל המצלמות יחד" reloads the list
    await page.goto('/?design=a#/investigate/events');
    const screen = page.locator('investigate-events');
    await screen.locator('[data-mode-windows]').click();
    await expect(screen.locator('[data-window-by]')).toBeVisible({ timeout: 30000 });
    await screen.locator('[data-window-by]').selectOption('all');
    await screen.locator('[data-window-gap]').selectOption('1800');
    if (grouped.length) {
      await expect(screen.locator('sw-table')).toContainText('כל המצלמות', { timeout: 20000 });
    }
  });
});
