import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for A1 (0.1.66) against the running developer backend and the lab NVR: the manual-record control is
// hidden without the permission, and with it a real manual recording is started on the NVR for a few seconds and
// stopped from the UI (approved by the owner). Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-nvr-write-live');

test.describe('NVR manual recording (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('gate, start with auto-stop, badge with the remaining time, stop', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[]).filter((c) => c.enabled && c.status === 'online');
    const cam = cams[0];
    expect(cam, 'an online camera').toBeTruthy();
    const st0 = await (await request.get(`/api/v1/cameras/${cam.id}/record`)).json();
    expect(st0.can_write).toBe(false);
    expect(st0.track_id, 'main track known from discovery').toBeTruthy();
    await page.goto(`/?design=a#/live/cameras/${cam.id}`);
    const screen = page.locator('live-camera');
    await expect(screen.locator('[data-caps]')).toBeVisible({ timeout: 60000 });
    await expect(screen.locator('[data-manual-record]')).toHaveCount(0);

    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR הקלטה ${Date.now()}`, description: 'ראיה', permissions: ['map.read', 'video.live'], sensitive: ['nvr.record.manual'] } })).json();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    try {
      await page.reload();
      const ctl = screen.locator('[data-manual-record]');
      await expect(ctl).toBeVisible({ timeout: 60000 });
      await expect(ctl).toHaveAttribute('data-active', 'no');
      await ctl.locator('[data-record-minutes]').selectOption('5');
      await ctl.locator('[data-record-start]').click();
      await expect(ctl).toHaveAttribute('data-active', 'yes', { timeout: 20000 });
      await expect(ctl).toContainText('נותרו 4:');
      await page.screenshot({ path: path.join(OUT, `record-active-${testInfo.project.name}.png`), fullPage: true });
      const st1 = await (await request.get(`/api/v1/cameras/${cam.id}/record`)).json();
      expect(st1.active?.track_id).toBe(st0.track_id);
      await page.waitForTimeout(3000);
      await ctl.locator('[data-record-stop]').click();
      await expect(ctl).toHaveAttribute('data-active', 'no', { timeout: 20000 });
      const st2 = await (await request.get(`/api/v1/cameras/${cam.id}/record`)).json();
      expect(st2.active).toBeNull();
    } finally {
      // never leave a manual recording running on the owner's NVR
      await request.post(`/api/v1/cameras/${cam.id}/record/stop`).catch(() => undefined);
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });
});
