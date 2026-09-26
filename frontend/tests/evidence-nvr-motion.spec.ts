import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for B2 (0.1.65) against the running developer backend and the lab NVR, WITHOUT writing to the NVR:
// the motion grid is read-only without the permission, editable with it (paint cells, sensitivity, enabled), the
// confirmation shows the diff, and cancelling writes nothing. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-nvr-write-live');

test.describe('NVR motion grid editor (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('edit mode behind the permission, diff in the confirmation, cancelled without a write', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[]).filter((c) => c.enabled && c.status === 'online');
    const cam = cams[0];
    expect(cam, 'an online camera').toBeTruthy();
    const zones = await (await request.get(`/api/v1/cameras/${cam.id}/zones`)).json();
    expect(zones.motion?.rows, 'a motion grid on the NVR').toBeGreaterThan(0);
    expect(zones.can_edit_motion).toBe(true); // the system administrator (0.1.74)
    // without the permission: no edit button, PUT refused
    await page.goto(`/?design=a#/live/cameras/${cam.id}`);
    const screen = page.locator('live-camera');
    // round 4 (2.6) collapsed everything below the video into "הגדרות מצלמה", each setting its own collapsed row
    // (round 10, 2026-09-26: this test predates that and looked for data-zones-loaded still visible on arrival)
    const openZones = async () => {
      await screen.locator('[data-camera-settings] summary').first().click();
      await screen.locator('[data-acc-zones] summary').first().click();
    };
    await openZones();
    await expect(screen.locator('[data-zones-loaded]')).toBeVisible({ timeout: 90000 });
    await expect(screen.locator('[data-motion-edit]')).toBeVisible({ timeout: 60000 });
    // (the 403 for users without the permission is covered by the backend tests; the dev identity is the system administrator)

    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR זיהוי ${Date.now()}`, description: 'ראיה', permissions: ['map.read', 'video.live'], sensitive: ['nvr.config.detection'] } })).json();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    try {
      await page.reload();
      await openZones(); // a reload is a fresh page load: the accordion is collapsed again
      await expect(screen.locator('[data-motion-edit]')).toBeVisible({ timeout: 90000 });
      await screen.locator('[data-motion-edit]').click();
      const editor = screen.locator('[data-motion-editor]');
      await expect(editor).toBeVisible();
      await expect(screen.locator('[data-motion-save]')).toHaveAttribute('disabled', '');
      // paint: toggle the first cell, move the sensitivity
      const cell = screen.locator('[data-motion-cell="0-0"]');
      await cell.dispatchEvent('pointerdown', { button: 0 });
      await cell.dispatchEvent('pointerup');
      // the range input only accepts the device's steps: move by one step through the DOM
      await screen.locator('[data-motion-sensitivity]').evaluate((el, cur) => { const i = el as HTMLInputElement; const step = Number(i.step || 20); i.value = String(cur >= 100 ? cur - step : cur + step); i.dispatchEvent(new Event('input', { bubbles: true })); }, zones.motion.sensitivity ?? 60);
      await expect(screen.locator('[data-motion-save]')).not.toHaveAttribute('disabled', '');
      await screen.locator('[data-motion-save]').click();
      const dlg = screen.locator('[data-motion-confirm]');
      await expect(dlg.locator('[data-motion-confirm-run]')).toBeVisible();
      await expect(dlg).toContainText('רגישות');
      await page.screenshot({ path: path.join(OUT, `motion-confirm-${testInfo.project.name}.png`), fullPage: true });
      await dlg.locator('sw-button', { hasText: 'ביטול' }).click();
      await screen.locator('[data-motion-cancel]').click();
      await expect(editor).toHaveCount(0);
      const changes = await (await request.get('/api/v1/nvr/changes?limit=5')).json();
      expect((changes.changes as { created_at: string; kind: string }[]).filter((c) => c.kind === 'detection' && Date.now() - new Date(c.created_at).getTime() < 120000)).toHaveLength(0);
    } finally {
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });
});
