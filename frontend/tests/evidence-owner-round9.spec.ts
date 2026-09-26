import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for 0.1.72 (B5 arming schedules, C1 recording schedule, B4 smart rules) against the running developer
// backend and the lab NVR. Writes: the motion arming schedule narrowed to weekday nights and rolled back; the
// recording schedule re-written unchanged (nothing written) and then one day changed and rolled back; line 1 of
// line crossing drawn + enabled and rolled back. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-nvr-write-live');

test.describe('NVR schedules and smart rules (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('week grids, arming write + rollback, record schedule, smart line + rollback', async ({ page, request }, testInfo) => {
    test.setTimeout(240000);
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; status: string }[]).filter((c) => c.enabled && c.status === 'online');
    const cam = cams[0];
    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR לוחות ${Date.now()}`, description: 'ראיה', permissions: ['map.read', 'video.live'], sensitive: ['nvr.config.events', 'nvr.config.schedule', 'nvr.config.smart'] } })).json();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    const rollbacks: string[] = [];
    try {
      const s0 = await (await request.get(`/api/v1/cameras/${cam.id}/schedules`)).json();
      expect(s0.can).toEqual({ events: true, schedule: true });
      expect(s0.arming.motion).toHaveLength(7);
      expect(s0.record).toBeTruthy();
      await page.goto(`/?design=a#/live/cameras/${cam.id}`);
      const screen = page.locator('live-camera');
      // round 4 (2.6) moved schedules and smart rules under the collapsed "הגדרות מצלמה" accordion (schedules in its
      // own "לוחות זימון והקלטה" row, smart rules inside "אזורי זיהוי ומסכות" alongside the zones overlay) - this
      // test predates that and looked for a [data-schedules] wrapper that no longer exists (round 10, 2026-09-26)
      const openSchedules = async () => {
        await screen.locator('[data-camera-settings] summary').first().click();
        await screen.locator('[data-acc-schedules] summary').first().click();
      };
      const openZones = async () => {
        await screen.locator('[data-camera-settings] summary').first().click();
        await screen.locator('[data-acc-zones] summary').first().click();
      };
      await openSchedules();
      const card = screen.locator('[data-acc-schedules]');
      await expect(card.locator('[data-schedules-tabs]')).toBeVisible({ timeout: 60000 });
      if (!(await card.locator('[data-week-grid]').isVisible())) {
        await page.waitForTimeout(3000);
        if (!(await card.locator('[data-week-grid]').isVisible())) await page.reload(); // the NVR answered one probe badly: read again
      }
      await expect(card.locator('[data-week-grid]')).toBeVisible({ timeout: 60000 });
      await expect(card.locator('[data-week-grid] [data-cell]')).toHaveCount(168);
      await page.screenshot({ path: path.join(OUT, `schedules-${testInfo.project.name}.png`), fullPage: true });
      // B5: edit in the UI - clear Saturday (data day 5) entirely, save through the dialog, then roll back through the API
      await card.locator('[data-sched-edit]').click();
      await expect(card.locator('[data-sched-editor]')).toBeVisible();
      await page.waitForTimeout(2500); // the sections above (caps, record, OSD) finish loading so the grid stops moving
      const grid = card.locator('[data-week-grid]');
      await grid.scrollIntoViewIfNeeded();
      const first = (await grid.locator('[data-cell="5-0"]').boundingBox())!;
      const last = (await grid.locator('[data-cell="5-23"]').boundingBox())!;
      await page.mouse.move(first.x + first.width / 2, first.y + first.height / 2);
      await page.mouse.down();
      await page.mouse.move(last.x + last.width / 2, last.y + last.height / 2, { steps: 24 });
      await page.mouse.up();
      await expect(grid.locator('[data-cell="5-12"]')).toHaveAttribute('data-mode', '');
      await card.locator('[data-sched-save]').click();
      await card.locator('[data-sched-confirm-run]').click();
      await expect(card.locator('[data-sched-msg]')).toContainText('נכתב', { timeout: 30000 });
      const s1 = await (await request.get(`/api/v1/cameras/${cam.id}/schedules`)).json();
      expect(s1.arming.motion[5]).toEqual([]);
      const changes = (await (await request.get('/api/v1/nvr/changes?limit=5')).json()).changes as { id: string; kind: string; status: string }[];
      const armingChange = changes.find((c) => c.kind === 'schedule' && c.status === 'applied');
      expect(armingChange).toBeTruthy();
      rollbacks.push(armingChange!.id);
      expect((await request.post(`/api/v1/nvr/changes/${armingChange!.id}/rollback`)).status()).toBe(201);
      rollbacks.pop();
      expect((await (await request.get(`/api/v1/cameras/${cam.id}/schedules`)).json()).arming.motion[5]).toEqual(s0.arming.motion[5]);
      // C1: the same schedule again is "unchanged"; one day changed is applied and rolled back
      const same = await (await request.put(`/api/v1/cameras/${cam.id}/record-schedule`, { data: { days: s0.record.days } })).json();
      expect(same.status).toBe('unchanged');
      const days = s0.record.days.map((d: unknown[], i: number) => (i === 6 ? [{ begin: '00:00:00', end: '24:00:00', mode: 'CMR' }] : d));
      const rec = await (await request.put(`/api/v1/cameras/${cam.id}/record-schedule`, { data: { days } })).json();
      expect(rec.status).toBe('applied');
      rollbacks.push(rec.id);
      expect((await (await request.get(`/api/v1/cameras/${cam.id}/schedules`)).json()).record.days[6]).toEqual([{ begin: '00:00:00', end: '24:00:00', mode: 'CMR' }]);
      expect((await request.post(`/api/v1/nvr/changes/${rec.id}/rollback`)).status()).toBe(201);
      rollbacks.pop();
      expect((await (await request.get(`/api/v1/cameras/${cam.id}/schedules`)).json()).record.days[6]).toEqual(s0.record.days[6]);
      // B4: draw line 1 in the UI (two clicks), enable, save; then roll back
      const sm0 = await (await request.get(`/api/v1/cameras/${cam.id}/smart`)).json();
      expect(sm0.can_write).toBe(true);
      await page.reload();
      await openZones(); // a reload collapses the accordion again; smart rules live in the same row as the zones overlay
      await expect(screen.locator('[data-smart-edit]')).toBeVisible({ timeout: 60000 });
      await screen.locator('[data-smart-edit]').click();
      await expect(screen.locator('[data-smart-editor]')).toBeVisible();
      await screen.locator('[data-smart-pick-line="1"]').click();
      const svg = (await screen.locator('[data-zones-svg]').boundingBox())!;
      await page.mouse.click(svg.x + svg.width * 0.2, svg.y + svg.height * 0.8);
      await page.mouse.click(svg.x + svg.width * 0.8, svg.y + svg.height * 0.3);
      await screen.locator('[data-smart-line-enabled]').check();
      await page.screenshot({ path: path.join(OUT, `smart-editor-${testInfo.project.name}.png`), fullPage: true });
      await screen.locator('[data-smart-save]').click();
      await expect(screen.locator('[data-smart-msg]')).toContainText('נכתבו', { timeout: 30000 });
      const refused = (await screen.locator('[data-smart-msg]').textContent())?.includes('סירב') ?? false;
      testInfo.annotations.push({ type: 'smart-enable', description: refused ? 'shapes written, enable refused by the firmware (invalidOperation)' : 'enabled through the NVR' });
      const sm1 = await (await request.get(`/api/v1/cameras/${cam.id}/smart`)).json();
      expect(sm1.line.enabled).toBe(refused ? sm0.line.enabled : true);
      expect(sm1.line.lines[0].enabled).toBe(true);
      expect(Math.abs(sm1.line.lines[0].points[0][0] - 200)).toBeLessThan(40);
      const smartChanges = ((await (await request.get('/api/v1/nvr/changes?limit=5')).json()).changes as { id: string; kind: string; target: string; status: string }[]).filter((c) => c.kind === 'smart' && c.status === 'applied');
      for (const c of smartChanges) rollbacks.push(c.id);
      for (const c of smartChanges) expect((await request.post(`/api/v1/nvr/changes/${c.id}/rollback`)).status()).toBe(201);
      rollbacks.length = 0;
      const sm2 = await (await request.get(`/api/v1/cameras/${cam.id}/smart`)).json();
      expect(sm2.line.enabled).toBe(sm0.line.enabled);
      expect(sm2.line.lines[0].points).toEqual(sm0.line.lines[0].points);
    } finally {
      for (const id of rollbacks) await request.post(`/api/v1/nvr/changes/${id}/rollback`).catch(() => undefined);
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });
});
