import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the NVR write foundation + B1 (0.1.64) against the running developer backend and the lab NVR,
// WITHOUT writing to the NVR: the connections page shows the notify matrix read from the NVR, the write controls
// appear only with the sensitive permission (custom role), and the confirmation dialog opens and is cancelled.
// Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T075-nvr-write-live');

test.describe('NVR notify matrix (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('matrix from the NVR, permission gate, confirmation dialog (no write)', async ({ page, request }, testInfo) => {
    test.setTimeout(180000);
    const status = await (await request.get('/api/v1/nvr/notify')).json();
    expect(status.channels.length, 'channels probed on the NVR').toBeGreaterThan(0);
    expect(status.can_write, 'the bootstrap admin holds no sensitive permission').toBe(false);
    await page.goto('/?design=a#/system/setup');
    const card = page.locator('[data-nvr-notify]');
    await expect(card.locator('[data-nvr-matrix]')).toBeVisible({ timeout: 90000 });
    await expect(card.locator('[data-nvr-channel]')).toHaveCount(status.channels.length);
    await expect(card.locator('[data-nvr-no-permission]')).toBeVisible();
    await expect(card.locator('[data-nvr-enable-all]')).toHaveCount(0);
    await page.screenshot({ path: path.join(OUT, `matrix-${testInfo.project.name}.png`), fullPage: true });

    // a custom role with the sensitive permission, bound to the current user: the controls appear
    const me = await (await request.get('/api/v1/me')).json();
    const role = await (await request.post('/api/v1/access/roles', { data: { name: `NVR התראות ${Date.now()}`, description: 'ראיה', permissions: ['map.read'], sensitive: ['nvr.config.events'] } })).json();
    expect(role.id, 'custom role created').toBeTruthy();
    const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
    try {
      await page.reload();
      await expect(card.locator('[data-nvr-enable-all]')).toBeVisible({ timeout: 90000 });
      await card.locator('[data-nvr-enable-all]').click();
      const dlg = card.locator('[data-nvr-confirm]');
      await expect(dlg.locator('[data-nvr-confirm-run]')).toBeVisible();
      await expect(dlg).toContainText('Notify Surveillance Center');
      await page.screenshot({ path: path.join(OUT, `confirm-${testInfo.project.name}.png`) });
      // cancelled: nothing is written to the NVR
      await dlg.locator('sw-button', { hasText: 'ביטול' }).click();
      await expect(card.locator('[data-nvr-confirm]')).toHaveCount(0);
      const changes = await (await request.get('/api/v1/nvr/changes?limit=5')).json();
      expect((changes.changes as { created_at: string }[]).filter((c) => Date.now() - new Date(c.created_at).getTime() < 120000)).toHaveLength(0);
    } finally {
      if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });
});
