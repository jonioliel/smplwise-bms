import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for 0.1.73 (R4 label positions, S2 HA recorder as a secondary source, S4 realign, S5 HA notify rule action
// + templates) against the running developer backend. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

test.describe('owner round 10: labels, secondary source, realign, HA notify (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('label position from the editor shows on the map; realign accept', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map?draft=true`)).json();
    const anchor = map.anchors.find((a: { resource_type: string }) => a.resource_type === 'camera');
    const before = anchor.label_pos ?? 'auto';
    try {
      await open(page, `/explore/floors/${floor.id}/edit`);
      const editor = page.locator('explore-plan-editor');
      const canvas = editor.locator('sw-plan-canvas');
      const box = (await canvas.boundingBox())!;
      const centre = await canvas.evaluate((el, id) => {
        const c = el as unknown as { markers: { id: string; x: number; y: number }[]; toScreen: (x: number, y: number) => { x: number; y: number } };
        const m = c.markers.find((x) => x.id === id)!;
        return c.toScreen(m.x, m.y);
      }, anchor.id);
      await page.mouse.click(box.x + centre.x, box.y + centre.y);
      await expect(editor.locator('select[data-label-pos]')).toBeVisible({ timeout: 15000 });
      await editor.locator('select[data-label-pos]').selectOption('top');
      await expect(canvas.locator(`g.marker[data-id="${anchor.id}"] [data-label-pos]`)).toHaveAttribute('data-label-pos', 'top');
      await editor.locator('sw-button', { hasText: 'שמירת מיקום' }).first().click();
      await page.waitForTimeout(1500);
      const saved = (await (await request.get(`/api/v1/floors/${floor.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor.id);
      expect(saved.label_pos).toBe('top');
      await open(page, `/explore/floors/${floor.id}`);
      const viewer = page.locator('explore-floor-map sw-plan-canvas');
      await expect(viewer.locator(`g.marker[data-id="${anchor.id}"]`)).toBeVisible({ timeout: 30000 });
      await viewer.locator(`g.marker[data-id="${anchor.id}"]`).hover();
      await expect(viewer.locator(`g.marker[data-id="${anchor.id}"] [data-label-pos]`)).toHaveAttribute('data-label-pos', 'top');
      await page.screenshot({ path: path.join(OUT, `label-pos-${testInfo.project.name}.png`) });
      // S4: accept is a no-op when nothing needs alignment, and answers honestly
      const r = await (await request.post(`/api/v1/floors/${floor.id}/anchors/realign`, { data: { mode: 'accept' } })).json();
      expect(r.moved + r.skipped).toBe(0);
      expect(r.needs_alignment).toBe(false);
    } finally {
      const cur = (await (await request.get(`/api/v1/floors/${floor.id}/anchors`)).json()).anchors.find((a: { id: string }) => a.id === anchor.id);
      if (cur) await request.patch(`/api/v1/map-anchors/${anchor.id}`, { data: { revision: cur.revision, label_pos: before } });
    }
  });

  test('settings: HA recorder as a secondary source; rules: template + HA notify gate', async ({ page, request }) => {
    const before = (await (await request.get('/api/v1/settings')).json()).settings as Record<string, string>;
    const created: string[] = [];
    try {
      await open(page, '/system/diagnostics');
      const screen = page.locator('system-diagnostics');
      await screen.locator('sw-tabs').getByText('וידאו ומדיה', { exact: true }).click(); // the settings rows live on the media tab
      await expect(screen.locator('[data-set-ha-secondary]')).toBeVisible({ timeout: 30000 });
      await screen.locator('[data-set-ha-secondary]').selectOption('true');
      await screen.locator('sw-button', { hasText: 'שמור' }).last().click(); // the media tab saves its draft with the button
      await expect.poll(async () => (await (await request.get('/api/v1/settings')).json()).settings['history.ha_secondary'], { timeout: 15000 }).toBe('true');
      // rules: a template fills the form; an HA notify action needs the sensitive permission
      await open(page, '/investigate/rules');
      const rules = page.locator('investigate-rules');
      await rules.locator('[data-rule-new]').click();
      await expect(rules.locator('[data-rule-template="person-night"]')).toBeVisible({ timeout: 15000 });
      await rules.locator('[data-rule-template="person-night"]').click();
      await expect(rules.locator('[data-rule-name]')).toHaveValue('אדם בלילה');
      await rules.locator('[data-rule-action-kind]').selectOption('ha_notify');
      await expect(rules.locator('[data-rule-service]')).toBeVisible();
      const body = { name: `אדם בלילה ${Date.now() % 1000}`, trigger: { types: ['person'], sources: [], severity_min: 'info' }, actions: [{ kind: 'ha_notify', service: 'mobile_app_test', message: 'אדם' }] };
      expect((await request.post('/api/v1/rules', { data: body })).status()).toBe(403);
      const me = await (await request.get('/api/v1/me')).json();
      const role = await (await request.post('/api/v1/access/roles', { data: { name: `HA notify ${Date.now()}`, description: 'ראיה', permissions: ['map.read'], sensitive: ['rules.ha_notify'] } })).json();
      const b = await (await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: role.id, scope_type: 'installation', scope_id: '*' } })).json();
      try {
        const r = await request.post('/api/v1/rules', { data: body });
        expect(r.status()).toBe(201);
        created.push((await r.json()).id);
      } finally {
        if (b?.id) await request.delete(`/api/v1/access/bindings/${b.id}`);
        await request.delete(`/api/v1/access/roles/${role.id}`);
      }
    } finally {
      for (const id of created) await request.delete(`/api/v1/rules/${id}`).catch(() => undefined);
      await request.patch('/api/v1/settings', { data: { 'history.ha_secondary': before['history.ha_secondary'] ?? 'false' } });
    }
  });
});
