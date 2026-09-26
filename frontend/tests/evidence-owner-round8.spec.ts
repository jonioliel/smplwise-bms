import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for 0.1.71 (D2 clock / NTP, D1 OSD + channel name, A3 alarm output, C3 S.M.A.R.T. test, D3 reboot gate,
// D4 connection edit) against the running developer backend and the lab NVR. Writes are the owner-approved ones:
// clock sync, NTP re-write of the same server, OSD week flag toggled and restored, channel name written and rolled
// back, one white-light pulse, one short S.M.A.R.T. test. The reboot is never sent (only the typed-word gate is
// checked). Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-nvr-write-live');

test.describe('NVR system writes (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('system card, clock sync, NTP, outputs, SMART, reboot gate, connection', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR מערכת ${Date.now()}`, description: 'ראיה', permissions: ['map.read', 'video.live'], sensitive: ['nvr.config.time', 'nvr.config.osd', 'nvr.alarm_output', 'nvr.storage.test', 'nvr.system.reboot'] } })).json();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    try {
      await page.goto('/?design=a#/system/setup');
      const screen = page.locator('system-setup');
      const card = screen.locator('[data-nvr-system]');
      await expect(card).toBeVisible({ timeout: 30000 });
      await expect(card.locator('[data-nvr-sync-clock]')).toBeVisible({ timeout: 30000 });
      const sys0 = await (await request.get('/api/v1/nvr/system')).json();
      expect(sys0.time.mode).toBeTruthy();
      expect(sys0.disks.length).toBeGreaterThan(0);
      expect(sys0.outputs.length).toBeGreaterThan(0);
      await page.screenshot({ path: path.join(OUT, `system-card-${testInfo.project.name}.png`), fullPage: true });
      // D2: clock sync - the drift after the write is small, the mode is back to what it was
      await card.locator('[data-nvr-sync-clock]').click();
      await expect(card.locator('[data-nvr-system-msg]')).toContainText('בוצע', { timeout: 30000 });
      const sys1 = await (await request.get('/api/v1/nvr/system')).json();
      expect(Math.abs(sys1.time.drift_s)).toBeLessThanOrEqual(5);
      expect(sys1.time.mode).toBe(sys0.time.mode);
      // D2: NTP - the same server again is "unchanged" (nothing written)
      const ntp = await (await request.put('/api/v1/nvr/ntp', { data: { host: sys0.time.ntp.host, port: sys0.time.ntp.port, interval_min: sys0.time.ntp.interval_min } })).json();
      expect(ntp.status).toBe('unchanged');
      // A3: one pulse on an enabled output (the camera's white light when present, else the NVR relay)
      const out = sys0.outputs.find((o: { enabled: boolean; pulse_supported: boolean }) => o.enabled && o.pulse_supported);
      expect(out, 'an output the NVR can trigger itself').toBeTruthy();
      await expect(card.locator(`[data-nvr-pulse="${out.id}"]`)).not.toHaveAttribute('disabled', '', { timeout: 30000 });
      await card.locator(`[data-nvr-pulse="${out.id}"]`).click();
      await expect(card.locator('[data-nvr-system-msg]')).toContainText(`הפעלת יציאה ${out.id}: בוצע`, { timeout: 30000 });
      // C3: short S.M.A.R.T. test on the first disk (quiet hours)
      const disk = sys0.disks[0];
      await expect(card.locator(`[data-nvr-smart-test="${disk.id}"]`)).not.toHaveAttribute('disabled', '', { timeout: 30000 });
      await card.locator(`[data-nvr-smart-test="${disk.id}"]`).click();
      await expect(card.locator('[data-nvr-system-msg]')).toContainText('S.M.A.R.T.', { timeout: 30000 });
      const smartMsg = await card.locator('[data-nvr-system-msg]').textContent();
      testInfo.annotations.push({ type: 'smart', description: smartMsg ?? '' });
      // D3: the reboot dialog refuses without the typed word (nothing is sent)
      await expect(card.locator('[data-nvr-reboot]')).not.toHaveAttribute('disabled', '', { timeout: 30000 });
      await card.locator('[data-nvr-reboot]').click();
      const dlg = screen.locator('[data-nvr-reboot-dialog]');
      await expect(dlg.locator('[data-nvr-reboot-word]')).toBeVisible();
      await expect(dlg.locator('[data-nvr-reboot-run]')).toHaveAttribute('disabled', '');
      await dlg.locator('[data-nvr-reboot-word]').fill('restar');
      await expect(dlg.locator('[data-nvr-reboot-run]')).toHaveAttribute('disabled', '');
      await dlg.locator('sw-button', { hasText: 'ביטול' }).click();
      expect((await request.post('/api/v1/nvr/reboot', { data: { confirm: 'no' } })).status()).toBe(422);
      // D4: the connection card re-saves the current details (deviceInfo checked first)
      const conn = screen.locator('[data-nvr-connection]');
      await expect(conn).toBeVisible();
      await conn.locator('[data-conn-edit]').click();
      await conn.locator('[data-conn-save]').click();
      await expect(conn.locator('[data-conn-msg]')).toContainText('נבדק', { timeout: 30000 });
      // the change log carries the new kinds
      const kinds = (await (await request.get('/api/v1/nvr/changes?limit=20')).json()).changes.map((c: { kind: string }) => c.kind);
      expect(kinds).toContain('time');
      expect(kinds).toContain('alarm_output');
    } finally {
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });

  test('OSD: week flag toggled and restored, channel name written and rolled back', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[]).filter((c) => c.enabled && c.status === 'online');
    const cam = cams[0];
    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR OSD ${Date.now()}`, description: 'ראיה', permissions: ['map.read', 'video.live'], sensitive: ['nvr.config.osd'] } })).json();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    try {
      const o0 = await (await request.get(`/api/v1/cameras/${cam.id}/osd`)).json();
      expect(o0.can_write).toBe(true);
      await page.goto(`/?design=a#/live/cameras/${cam.id}`);
      const screen = page.locator('live-camera');
      // round 4 (2.6) moved OSD under the collapsed "הגדרות מצלמה" accordion, its own "OSD" row (round 10, 2026-09-26)
      await screen.locator('[data-camera-settings] summary').first().click();
      await screen.locator('[data-acc-osd] summary').first().click();
      await expect(screen.locator('[data-osd]')).toBeVisible({ timeout: 60000 });
      await expect(screen.locator('[data-osd-nvr-name]')).toHaveText(o0.nvr_name ?? '—');
      await page.screenshot({ path: path.join(OUT, `osd-${testInfo.project.name}.png`), fullPage: true });
      if (o0.datetime) {
        const r1 = await (await request.put(`/api/v1/cameras/${cam.id}/osd`, { data: { display_week: !o0.datetime.display_week } })).json();
        expect(r1.status).toBe('applied');
        const o1 = await (await request.get(`/api/v1/cameras/${cam.id}/osd`)).json();
        expect(o1.datetime.display_week).toBe(!o0.datetime.display_week);
        const rb = await request.post(`/api/v1/nvr/changes/${r1.id}/rollback`);
        expect(rb.status()).toBe(201);
        expect((await (await request.get(`/api/v1/cameras/${cam.id}/osd`)).json()).datetime.display_week).toBe(o0.datetime.display_week);
      }
      // channel name: write a marked name, verify, roll back to the owner's name
      const r2 = await (await request.post(`/api/v1/cameras/${cam.id}/osd/name`, { data: { name: `${(o0.nvr_name ?? 'cam').slice(0, 26)} VMS` } })).json();
      expect(r2.status).toBe('applied');
      expect((await (await request.get(`/api/v1/cameras/${cam.id}/osd`)).json()).nvr_name).toBe(r2.name);
      expect((await request.post(`/api/v1/nvr/changes/${r2.id}/rollback`)).status()).toBe(201);
      expect((await (await request.get(`/api/v1/cameras/${cam.id}/osd`)).json()).nvr_name).toBe(o0.nvr_name);
    } finally {
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });
});
