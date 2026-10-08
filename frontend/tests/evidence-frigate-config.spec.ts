import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN, installFrigate, newControlMock, newFrigateMock, openApp, type FrigateControlMock, type FrigateMock } from './frigate-mocks';

// FRGS (CR-029 section 13): Settings > the Frigate recorder > "שינויים ב־Frigate" > "אזורים והגדרות" - the zone editor on the camera's still
// (draw, drag, keyboard, never mirrored in RTL) and the schema-driven settings, each save asked first with the supervision box on the first
// write of its kind. Against the MOCKED backend of frigate-mocks.ts (the routes of routers/frigate_config.py); the server's rules are
// test_frigate_config.py. SW_SHOTS=1 writes screenshots to docs/design/evidence/frgs. Every name is made up.
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/frgs');
const ON = { analytics: false, record: false, profile: false, review: false, events: false, ptz: false, exports: false, cases: false, config: true };
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
const writes = (m: FrigateMock, needle: string) => m.ctl.writes.filter((w) => w.includes(needle));
const bodyOf = (w: string) => JSON.parse(w.slice(w.indexOf('{')));

async function shot(page: Page, name: string, scheme = '') {
  if (!process.env.SW_SHOTS) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(OUT, `${name}${scheme ? `-${scheme}` : ''}-${test.info().project.name}.png`), fullPage: true });
}

async function start(page: Page, ctl: Partial<FrigateControlMock> = {}, over: Partial<FrigateMock> = {}, query = '') {
  const m = newFrigateMock({ perms: ADMIN, ctl: newControlMock({ classes: { ...ON }, ...ctl }), ...over });
  await installFrigate(page, m);
  await openApp(page, '/system/setup', query);
  await page.locator('nvr-recorders-card [data-recorder="nvr-2"] [data-recorder-connection]').click();
  const box = page.locator('nvr-recorders-card [data-frigate-control-settings]');
  await expect(box).toBeVisible();
  await box.locator('[data-fcs-tabs]').getByRole('button', { name: 'אזורים והגדרות' }).click();
  const panel = box.locator('[data-frigate-config-panel]');
  await expect(panel).toBeVisible();
  await expect(panel.locator('[data-zone-stage]')).toBeVisible();
  return { m, box, panel };
}

async function confirm(panel: ReturnType<Page['locator']>, supervise: boolean) {
  const dlg = panel.locator('[data-fcp-confirm]');
  await expect(dlg.locator('[data-fcp-ok]')).toBeVisible();
  if (supervise) {
    await expect(dlg.locator('[data-fcp-ok]')).toHaveAttribute('disabled', '');
    await dlg.locator('[data-supervised-box] input').check();
  }
  await dlg.locator('[data-fcp-ok]').click();
  await expect(panel.locator('[data-fcp-confirm]')).toHaveCount(0);
}

test.describe('settings: zones and camera settings', () => {
  test('the zone list and the stage: stored zones drawn over the still, a read-only shape listed but not editable, the stage never mirrored', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const { panel } = await start(page);
    await expect(panel.locator('[data-fcp-zone-list] [data-zone]')).toHaveCount(3);
    await expect(panel.locator('[data-zone="old_line"]')).toBeDisabled();
    await expect(panel.locator('[data-zone-shape]')).toHaveCount(2);
    await expect(panel.locator('[data-zone-stage]')).toHaveAttribute('dir', 'ltr');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
    const text = await panel.innerText();
    expect(text).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
    await noOverflow(page);
    await shot(page, 'config-zones', 'light');
    expect(errors).toEqual([]);
  });

  test('a new zone: tap to add points (left stays left in RTL), the name is checked, the first save asks for supervision and sends the polygon', async ({ page }) => {
    const { m, panel } = await start(page);
    await panel.locator('[data-fcp-new-zone]').click();
    const stage = panel.locator('[data-zone-stage]');
    const box = (await stage.boundingBox())!;
    await panel.locator('[data-fcp-zone-name]').fill('Gate');
    await expect(panel.locator('[data-fcp-name-error]')).toHaveText('אותיות לטיניות קטנות, ספרות וקו תחתון');
    await panel.locator('[data-fcp-zone-name]').fill('gate');
    await expect(panel.locator('[data-fcp-name-error]')).toHaveCount(0);
    await expect(panel.locator('[data-fcp-save]')).toHaveAttribute('disabled', '');
    // three taps on the left part of the frame (x < 0.4): a mirrored stage would put them on the right
    for (const [fx, fy] of [[0.1, 0.1], [0.35, 0.1], [0.3, 0.4]]) await stage.click({ position: { x: box.width * fx, y: box.height * fy } });
    await expect(panel.locator('[data-zone-handle]')).toHaveCount(3);
    await expect(panel.locator('[data-fcp-points]')).toContainText('3');
    await panel.locator('[data-fcp-zone-objects] [data-label="car"]').click();
    await shot(page, 'config-zone-new');
    await panel.locator('[data-fcp-save]').click();
    await confirm(panel, true);
    const w = writes(m, 'config/zones/gate');
    expect(w).toHaveLength(1);
    const b = bodyOf(w[0]);
    expect(b.confirm).toBe(true);
    expect(b.supervised).toBe(true);
    expect(b.objects).toEqual(['car']);
    expect(b.points).toHaveLength(3);
    for (const [x, y] of b.points as [number, number][]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(0.4);
      expect(y).toBeLessThan(0.45);
    }
    await expect(panel.locator('[data-fcp-msg]')).toHaveText('נשמר');
    await expect(panel.locator('[data-zone="gate"]')).toBeVisible();
    expect(m.ctl.firstWrites.config_zone).toBe(true);
  });

  test('editing a zone: drag a handle, move one with the keyboard, remove one; the second save needs no supervision; delete asks', async ({ page }) => {
    const { m, panel } = await start(page, { firstWrites: { config_zone: true } as FrigateControlMock['firstWrites'] });
    await panel.locator('[data-zone="driveway"]').click();
    await expect(panel.locator('[data-zone-handle]')).toHaveCount(4);
    const h0 = panel.locator('[data-zone-handle="0"]');
    const hb = (await h0.boundingBox())!;
    const stage = (await panel.locator('[data-zone-stage]').boundingBox())!;
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(stage.x + stage.width * 0.6, stage.y + stage.height * 0.3, { steps: 5 });
    await page.mouse.up();
    await panel.locator('[data-zone-handle="1"]').focus();
    await page.keyboard.press('ArrowDown');
    await expect(panel.locator('[data-zone-handle]')).toHaveCount(4);
    await panel.locator('[data-fcp-save]').click();
    await confirm(panel, false);
    const b = bodyOf(writes(m, 'config/zones/driveway')[0]);
    expect(b.supervised).toBeUndefined();
    expect(b.points[0][0]).toBeCloseTo(0.6, 1);
    expect(b.points[0][1]).toBeCloseTo(0.3, 1);
    expect(b.points[1][1]).toBeCloseTo(0.405, 3);
    // delete
    await panel.locator('[data-zone="porch"]').click();
    await panel.locator('[data-fcp-delete]').click();
    await expect(panel.locator('[data-fcp-confirm="delete"]')).toHaveCount(1); // the sw-dialog host has no box of its own
    await confirm(panel, false);
    expect(writes(m, 'config/zones/porch/delete')).toHaveLength(1);
    await expect(panel.locator('[data-zone="porch"]')).toHaveCount(0);
  });

  test('settings follow the schema: one section per save, out of range refused before the call, back to default sends null', async ({ page }) => {
    const { m, panel, box } = await start(page);
    await panel.locator('[data-fcp-mode="settings"]').click();
    await expect(panel.locator('[data-fcp-section]')).toHaveCount(6);
    const motion = panel.locator('[data-fcp-section="motion"]');
    await expect(motion.locator('[data-fcp-save-section]')).toHaveAttribute('disabled', '');
    const thr = motion.locator('[data-fcp-field="motion.threshold"] input');
    await expect(thr).toHaveAttribute('placeholder', 'ברירת מחדל: 30');
    await thr.fill('300');
    await expect(motion.locator('[data-fcp-field="motion.threshold"] .err')).toHaveText('ערך מחוץ לטווח');
    await expect(motion.locator('[data-fcp-save-section]')).toHaveAttribute('disabled', '');
    await thr.fill('45');
    await shot(page, 'config-settings');
    await motion.locator('[data-fcp-save-section]').click();
    await confirm(panel, true);
    const b = bodyOf(writes(m, 'config/settings/motion')[0]);
    expect(b.values).toEqual({ 'motion.threshold': 45 });
    // back to the default (the first settings write is done: no supervision box now)
    await expect(thr).toHaveValue('45');
    await motion.locator('[data-fcp-field="motion.threshold"] [data-fcp-default]').click();
    await motion.locator('[data-fcp-save-section]').click();
    await confirm(panel, false);
    expect(bodyOf(writes(m, 'config/settings/motion')[1]).values).toEqual({ 'motion.threshold': null });
    // a value equal to the default of an unset key is no change: nothing to save
    const det = panel.locator('[data-fcp-section="detect"]');
    await det.locator('[data-fcp-field="detect.fps"] [data-fcp-default]').click();
    await expect(det.locator('[data-fcp-save-section]')).toHaveAttribute('disabled', '');
    // labels
    const obj = panel.locator('[data-fcp-section="objects"]');
    await obj.locator('[data-label="dog"]').click();
    await obj.locator('[data-fcp-save-section]').click();
    await confirm(panel, false);
    expect(bodyOf(writes(m, 'config/settings/objects')[0]).values).toEqual({ 'objects.track': ['car', 'dog', 'person'] });
    // the change log names the section
    await box.locator('[data-fcs-tabs]').getByRole('button', { name: 'יומן שינויים' }).click();
    await expect(box.locator('[data-change]').first()).toContainText('הגדרות מצלמה: עצמים למעקב');
  });

  test('class off: a short chip, nothing to save, no new zone; the server is not asked to write', async ({ page }) => {
    const { m, panel } = await start(page, { classes: { ...ON, config: false } });
    await expect(panel.locator('[data-fcp-class-off]')).toHaveText('סוג הפעולה כבוי');
    await expect(panel.locator('[data-fcp-new-zone]')).toHaveCount(0);
    await panel.locator('[data-zone="porch"]').click();
    await expect(panel.locator('[data-fcp-save]')).toHaveCount(0);
    await expect(panel.locator('[data-zone-handle="0"]')).toBeDisabled();
    await panel.locator('[data-fcp-mode="settings"]').click();
    await expect(panel.locator('[data-fcp-save-section]')).toHaveCount(0);
    expect(m.ctl.writes).toEqual([]);
  });

  test('dark: zones and settings', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'two projects are enough');
    const { panel } = await start(page, {}, {}, '&scheme=dark');
    await panel.locator('[data-zone="driveway"]').click();
    await noOverflow(page);
    await shot(page, 'config-zone-edit', 'dark');
    await panel.locator('[data-fcp-cancel]').click();
    await panel.locator('[data-fcp-mode="settings"]').click();
    await noOverflow(page);
    await shot(page, 'config-settings', 'dark');
  });
});
