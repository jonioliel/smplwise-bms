import { test, expect, type APIRequestContext } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

// Evidence for camera scope (T055, docs/security/HA_IDENTITY_RBAC_HE.md §15). Against a THROWAWAY developer backend
// (SW_API_PORT) whose database file is SW_DB_PATH - the spec writes two events into it directly, since a throwaway
// instance has no NVR: the system administrator binds "מפעיל" to ONE camera through the bindings editor (scope kind
// "מצלמה", camera picker), and the bound user then sees exactly that camera on the camera wall, in the events centre
// and on the floor map; when the binding is revoked the open shell says "ההרשאות שלך עודכנו" and re-reads /me.
// Runs only with SW_LIVE=1 and SW_DB_PATH set. Desktop only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T055-camera-scope');
const USER = { 'X-SW-Dev-User': 't055cam' };
const USER_ID = 'dev-t055cam';
const CAM_A = 'מצלמת T055 כניסה';
const CAM_B = 'מצלמת T055 מחסן';
// a 480x300 synthetic plan (two rooms), so the throwaway floor has a published map
const PLAN_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAeAAAAEsCAIAAACUnPcNAAADhElEQVR42u3asQmAMBBA0VMyatqskMIVbJ1TwcrWKo0RI7zXa3GEzxGd9uMMAMYzGwGAQAMg0AACDYBAAwg0AAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAAAg2AQAPQlp48nEs1QYC2bV1s0ADhigMAgQYQaAAEGoB49y+O6PexEp67/1bkKDLCObRBA4QrDgAEGkCgjQBAoAEQaACBBkCgAQQaAIEGQKABBBoAgQYQaAAEGgCBBhBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGQKABBBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEQaACBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAAQaQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAIEGQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBoAgQYQaAAEGkCgARBoAIEGQKABEGgAgQZAoAEEGgCBBkCgAQQaAIEGEGgABBpAoAEQaAAEGkCgARBoAIEGQKABEGiAf0h9X5dLNVMAGzSAQAMg0ADEG3fQ27qYKV/xCQQbNAACDSDQAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADCLQRAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADINAAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AAINIBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0AAININAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg2AQAMINAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAACDSDQAAg0gEADINAACDTA6FLf1+VSzZQROIrYoAEQaACBBkCgARBogL+Z9uM0BQAbNAACDSDQAAg0gEADINAACDSAQAMg0AACDYBAAyDQAAINgEADCDQAAg0g0AAINAANF7ysGBzW5CXVAAAAAElFTkSuQmCC',
  'base64',
);

interface Seed {
  floor: string;
  camA: string;
  camB: string;
}

async function seed(request: APIRequestContext): Promise<Seed> {
  const ok = async (p: Promise<{ ok(): boolean; json(): Promise<unknown>; status(): number; text(): Promise<string> }>) => {
    const r = await p;
    if (!r.ok()) throw new Error(`${r.status()} ${await r.text()}`);
    return (await r.json()) as Record<string, unknown>;
  };
  const site = await ok(request.post('/api/v1/sites', { data: { name: 'אתר T055' } }));
  const bld = await ok(request.post(`/api/v1/sites/${site.id}/buildings`, { data: { name: 'מבנה T055' } }));
  const floor = await ok(request.post(`/api/v1/buildings/${bld.id}/floors`, { data: { name: 'קומה T055', level: 1 } }));
  const asset = await ok(request.post(`/api/v1/floors/${floor.id}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: PLAN_PNG } } }));
  const version = await ok(request.post(`/api/v1/floors/${floor.id}/plan-versions`, { data: { asset_id: asset.id } }));
  await ok(request.post(`/api/v1/plan-versions/${version.id}/publish`));
  const camA = (await ok(request.post('/api/v1/cameras', { data: { channel: 201, alias: CAM_A } }))).id as string;
  const camB = (await ok(request.post('/api/v1/cameras', { data: { channel: 202, alias: CAM_B } }))).id as string;
  for (const [cam, x] of [[camA, 0.25], [camB, 0.75]] as const) {
    await ok(request.post(`/api/v1/floors/${floor.id}/anchors`, { data: { resource_type: 'camera', resource_id: cam, x, y: 0.4, rotation_degrees: 90, field_of_view_degrees: 70 } }));
  }
  // one motion event per camera, five minutes ago (a throwaway instance has no NVR to produce them)
  const db = new DatabaseSync(process.env.SW_DB_PATH as string);
  const at = new Date(Date.now() - 5 * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const ins = db.prepare(
    "INSERT OR IGNORE INTO events(id, source, raw_type, type, camera_id, channel, occurred_at, ended_at, received_at, state, count, severity, confidence, details_json, dedup_key, created_at) VALUES (?, 'alertstream', 'VMD', 'motion', ?, ?, ?, NULL, ?, 'inactive', 1, 'info', 'measured', '{}', ?, ?)",
  );
  ins.run(`t055-${camA}`, camA, 201, at, at, `t055:${camA}`, at);
  ins.run(`t055-${camB}`, camB, 202, at, at, `t055:${camB}`, at);
  db.close();
  await request.get('/api/v1/me', { headers: USER });
  return { floor: floor.id as string, camA, camB };
}

async function unbind(request: APIRequestContext) {
  const all = (await (await request.get('/api/v1/access/bindings')).json()).bindings as { id: string; subject_id: string }[];
  for (const b of all.filter((x) => x.subject_id === USER_ID)) await request.delete(`/api/v1/access/bindings/${b.id}`);
}

test.describe('camera scope (T055)', () => {
  test.skip(process.env.SW_LIVE !== '1' || !process.env.SW_DB_PATH, 'set SW_LIVE=1 and SW_DB_PATH with a throwaway backend running');

  test('admin binds one camera; the user sees exactly it on live, events and the map; a revoke reaches the open shell', async ({ page, browser, request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'desktop evidence');
    test.setTimeout(180000);
    const s = await seed(request);
    await unbind(request);

    // ---- the administrator: bindings editor, scope kind "מצלמה", camera picker
    await page.goto('/?design=a#/system/access');
    await page.waitForSelector('sw-app');
    const screen = page.locator('system-access');
    await expect(screen.locator('sw-table').getByText('t055cam').first()).toBeVisible({ timeout: 20000 });
    await screen.locator('sw-table').getByText('t055cam').first().click();
    await screen.locator('[data-assign]').click();
    await screen.locator('[data-wizard-role]').selectOption('operator');
    await screen.locator('[data-wizard-scope-kind]').selectOption('camera');
    const offered = await screen.locator('[data-wizard-camera] option').evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
    expect(offered).toContain(`camera:${s.camA}`);
    expect(offered).toContain(`camera:${s.camB}`);
    await screen.locator('[data-wizard-camera]').selectOption(`camera:${s.camA}`);
    await screen.locator('[data-camera-scope-hint]').scrollIntoViewIfNeeded();
    await expect(screen.locator('[data-camera-scope-hint]')).toBeVisible();
    await expect(screen.locator('[data-camera-effect]')).toContainText('ללא השפעה בהיקף מצלמה');
    await page.screenshot({ path: path.join(OUT, 'wizard-camera-scope.png') });
    await screen.locator('[data-wizard-save]').click();
    await expect
      .poll(async () => ((await (await request.get('/api/v1/access/bindings')).json()).bindings as { subject_id: string; scope_type: string; scope_id: string }[]).filter((b) => b.subject_id === USER_ID).map((b) => `${b.scope_type}:${b.scope_id}`), { timeout: 15000 })
      .toEqual([`camera:${s.camA}`]);

    // ---- the bound user
    const ctx = await browser.newContext({ extraHTTPHeaders: USER, viewport: { width: 1440, height: 900 }, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
    const user = await ctx.newPage();
    try {
      // camera wall: exactly camera A
      const camList = user.waitForResponse((r) => r.url().includes('/api/v1/cameras') && !r.url().includes('/cameras/') && r.request().method() === 'GET');
      await user.goto('/?design=a#/live/wall');
      await user.waitForSelector('sw-app');
      const cams = (await (await camList).json()).cameras as { id: string }[];
      expect(cams.map((c) => c.id)).toEqual([s.camA]);
      await expect(user.getByText(CAM_A).first()).toBeVisible({ timeout: 20000 });
      await expect(user.getByText(CAM_B)).toHaveCount(0);
      await user.screenshot({ path: path.join(OUT, 'user-live-wall.png') });

      // events centre: camera A's event only
      const evList = user.waitForResponse((r) => /\/api\/v1\/events(\?|$)/.test(r.url()) && r.request().method() === 'GET');
      await user.goto('/?design=a#/investigate/events');
      const events = (await (await evList).json()).events as { camera_id: string }[];
      expect(events.length).toBeGreaterThan(0);
      expect(new Set(events.map((e) => e.camera_id))).toEqual(new Set([s.camA]));
      // the row names the camera (the camera filter's own <option> is not what we look for)
      await expect(user.getByText(CAM_A).filter({ visible: true }).first()).toBeVisible({ timeout: 20000 });
      await expect(user.getByText(CAM_B)).toHaveCount(0);
      await user.screenshot({ path: path.join(OUT, 'user-events.png') });

      // floor map: the drawing and camera A's anchor, nothing else
      const mapResp = user.waitForResponse((r) => r.url().includes(`/api/v1/floors/${s.floor}/map`));
      await user.goto(`/?design=a#/explore/floors/${s.floor}`);
      const bundle = (await (await mapResp).json()) as { reach: string; anchors: { resource_id: string }[] };
      expect(bundle.reach).toBe('cameras');
      expect(bundle.anchors.map((a) => a.resource_id)).toEqual([s.camA]);
      await user.waitForTimeout(1500);
      await user.screenshot({ path: path.join(OUT, 'user-floor-map.png') });

      // a revoke reaches the open shell: toast, /me re-read
      const meAgain = user.waitForResponse((r) => /\/api\/v1\/me(\?|$)/.test(r.url()));
      await unbind(request);
      await expect(user.locator('[data-perm-toast]')).toContainText('ההרשאות שלך עודכנו', { timeout: 15000 });
      expect(((await (await meAgain).json()) as { has_access: boolean }).has_access).toBe(false);
      await user.screenshot({ path: path.join(OUT, 'user-permissions-changed.png') });
      expect((await request.get(`/api/v1/floors/${s.floor}/map`, { headers: USER })).status()).toBe(403);
    } finally {
      await ctx.close();
      await unbind(request);
    }
  });
});
