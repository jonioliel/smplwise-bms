import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for 0.1.74 (owner round 3) against the running developer backend: the system administrator writes to the
// NVR without a custom role, a new custom role is assigned to its creator, "מבנה" button on a site, floor quick
// buttons, jump without zoom, wall column override, coverage sliders. Runs only with SW_LIVE=1.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'owner-round-live');

test.describe('owner round 11: round-3 notes (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1800);
  }

  test('admin holds the NVR permissions; a new role is assigned to its creator', async ({ page, request }) => {
    const sys = await (await request.get('/api/v1/nvr/system')).json();
    expect(sys.can).toEqual({ time: true, storage: true, alarm: true, reboot: true, osd: true, connection: true });
    expect((await (await request.get('/api/v1/nvr/notify')).json()).can_write).toBe(true);
    await open(page, '/system/setup');
    await expect(page.locator('system-setup [data-nvr-sync-clock]')).toBeVisible({ timeout: 40000 });
    await expect(page.locator('system-setup [data-nvr-reboot]')).toBeVisible();
    // custom role: created with "assign to me" → a binding for the creator exists
    const name = `תפקיד בדיקה ${Date.now() % 100000}`;
    await open(page, '/system/access');
    const screen = page.locator('system-access');
    await screen.locator('sw-tabs').getByText('תפקידים').first().click();
    await screen.locator('[data-role-new]').click();
    await screen.locator('[data-role-name]').fill(name);
    await screen.locator('[data-role-perm="map.read"]').check();
    await expect(screen.locator('[data-role-assign-me]')).toBeChecked();
    await screen.locator('[data-role-save]').click();
    await expect(screen).toContainText('שויך אליך', { timeout: 15000 });
    const roles = (await (await request.get('/api/v1/access/roles')).json()).roles as { id: string; name: string }[];
    const role = roles.find((r) => r.name === name)!;
    expect(role).toBeTruthy();
    const me = await (await request.get('/api/v1/me')).json();
    const mine = (me.bindings as { id: string; role_id: string }[]).find((b) => b.role_id === role.id);
    try {
      expect(mine, 'the creator holds the new role').toBeTruthy();
    } finally {
      if (mine) await request.delete(`/api/v1/access/bindings/${mine.id}`);
      await request.delete(`/api/v1/access/roles/${role.id}`);
    }
  });

  test('sites: a visible "building" button; map: floor buttons and jump without zoom', async ({ page, request }, testInfo) => {
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const site = tree.sites[0];
    await open(page, '/explore/sites');
    const sites = page.locator('explore-sites');
    await expect(sites.locator(`[data-add-building="${site.id}"]`)).toBeVisible({ timeout: 30000 });
    await sites.locator(`[data-add-building="${site.id}"]`).click();
    await expect(sites.locator('[data-form-name]')).toBeVisible();
    await sites.locator('sw-button', { hasText: 'ביטול' }).first().click();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors)) as { id: string; has_plan: boolean }[];
    const start = floors.find((f) => f.has_plan)!;
    await open(page, `/explore/floors/${start.id}`);
    const viewer = page.locator('explore-floor-map');
    const building = tree.sites.flatMap((s: { buildings: { floors: { id: string }[] }[] }) => s.buildings).find((b: { floors: { id: string }[] }) => b.floors.some((f) => f.id === start.id));
    await expect(viewer.locator('[data-floor-buttons] button')).toHaveCount(building.floors.length, { timeout: 30000 }); // the floors of this building
    await expect(viewer.locator(`[data-floor-button="${start.id}"]`)).toHaveClass(/on/);
    await page.screenshot({ path: path.join(OUT, `floor-buttons-${testInfo.project.name}.png`) });
    // jump without zoom (default): the scale stays, the pin is centred
    await expect(viewer.locator('[data-floorchip]')).toBeVisible();
    await page.waitForTimeout(800);
    if (!(await viewer.locator('[data-sidelist]').isVisible())) await viewer.locator('[data-sidelist-toggle]').click();
    await expect(viewer.locator('[data-jump-zoom]')).not.toBeChecked();
    const canvas = viewer.locator('sw-plan-canvas');
    const scale0 = await canvas.evaluate((el) => (el as unknown as { scale: number }).scale);
    await viewer.locator('[data-side-camera]').first().click();
    await page.waitForTimeout(600);
    expect(await canvas.evaluate((el) => (el as unknown as { scale: number }).scale)).toBeCloseTo(scale0, 5);
    await page.waitForTimeout(1000);
    await viewer.locator('[data-jump-zoom]').check();
    await viewer.locator('[data-side-camera]').first().click();
    await page.waitForTimeout(600);
    expect(await canvas.evaluate((el) => (el as unknown as { scale: number }).scale)).toBeGreaterThan(scale0);
    await viewer.locator('[data-jump-zoom]').uncheck();
    const other = (building.floors as { id: string }[]).find((f) => f.id !== start.id);
    if (other) {
      await viewer.locator(`[data-floor-button="${other.id}"]`).click();
      await expect.poll(() => page.evaluate(() => location.hash)).toContain(other.id);
    }
  });

  test('wall: the viewer chooses the columns; editor: coverage width and distance sliders', async ({ page, request }) => {
    const cams = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean }[]).filter((c) => c.enabled);
    await page.setViewportSize({ width: 1600, height: 800 });
    await open(page, `/live/wall?cameras=${cams.slice(0, 2).map((c) => c.id).join(',')}`);
    const wall = page.locator('live-wall');
    await expect(wall.locator('sw-camera-tile')).toHaveCount(2, { timeout: 30000 });
    await wall.locator('[data-wall-cols-set="1"]').click();
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '1');
    await wall.locator('[data-wall-cols-set="0"]').click();
    await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '2');
    // coverage sliders in the editor
    const tree = await (await request.get('/api/v1/sites?tree=true')).json();
    const floors = tree.sites.flatMap((s: { buildings: { floors: { id: string; has_plan: boolean }[] }[] }) => s.buildings.flatMap((b) => b.floors));
    const floor = floors.find((f: { has_plan: boolean }) => f.has_plan);
    const map = await (await request.get(`/api/v1/floors/${floor.id}/map?draft=true`)).json();
    const anchor = map.anchors.find((a: { resource_type: string; field_of_view_degrees: number | null }) => a.resource_type === 'camera' && a.field_of_view_degrees);
    await page.setViewportSize({ width: 1440, height: 900 });
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
    await expect(editor.locator('[data-coverage-width] input')).toBeVisible({ timeout: 15000 });
    // the slider has an exact-percent number field next to it since 0.1.7x: address the range input
    await editor.locator('[data-coverage-distance] input[type="range"]').evaluate((el) => { (el as HTMLInputElement).value = '40'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const radius = await editor.evaluate((el, id) => (el as unknown as { anchors: { id: string; coverage_radius?: number | null }[] }).anchors.find((a) => a.id === id)!.coverage_radius, anchor.id);
    expect(radius).toBeCloseTo(0.4, 3); // not saved: the editor is left without saving
  });

  test('camera screen: rename from the header, restored afterwards', async ({ page, request }) => {
    const cam = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; enabled: boolean; alias: string | null; name: string }[]).filter((c) => c.enabled)[0];
    const before = cam.alias ?? '';
    const name = `בדיקת שם ${Date.now() % 1000}`;
    try {
      await open(page, `/live/cameras/${cam.id}`);
      const screen = page.locator('live-camera');
      await screen.locator('[data-camera-rename]').click();
      await screen.locator('[data-rename-input]').fill(name);
      await screen.locator('[data-rename-save]').click();
      await expect(page.locator('live-camera sw-page')).toHaveAttribute('heading', new RegExp(name), { timeout: 15000 });
      const saved = ((await (await request.get('/api/v1/cameras')).json()).cameras as { id: string; name: string }[]).find((c) => c.id === cam.id)!;
      expect(saved.name).toBe(name);
    } finally {
      await request.patch(`/api/v1/cameras/${cam.id}`, { data: { alias: before } });
    }
  });
});

// T091 (owner request 2026-09-27): grid layout settings on the all-cameras wall - reorder cameras and let a
// panoramic camera span more than one column. Runs only with SW_LIVE=1.
test.describe('T091: camera grid layout settings on the all-cameras wall (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  async function open(page: Page, hash: string) {
    await page.goto(`/?design=a#${hash}`);
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
  }

  type ApiCamera = { id: string; enabled: boolean; channel: number; sort_order: number; grid_col_span: number };
  type Req = import('@playwright/test').APIRequestContext;

  /** At least two enabled cameras to reorder; this repo has no existing fixture/seed for cameras (they are
   * normally discovered from a real NVR by autosync). Fixed test channels (101/102) are reused across runs
   * instead of creating fresh rows every time: cameras.py has no DELETE endpoint, so a previous run's cleanup
   * can only have disabled them (S4 review) - re-enable that same row rather than register a duplicate.
   * `seededIds` is only non-empty when this function actually touched something, so a real backend that
   * already had >=2 enabled cameras is never written to. */
  async function ensureTwoCameras(request: Req): Promise<{ cams: ApiCamera[]; seededIds: string[] }> {
    const all = ((await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[]);
    const enabled = all.filter((c) => c.enabled);
    if (enabled.length >= 2) return { cams: enabled, seededIds: [] };
    const wanted: [number, string][] = [
      [101, 'מצלמה בדיקה A · T091'],
      [102, 'מצלמה בדיקה B · T091'],
    ];
    const seededIds: string[] = [];
    for (const [channel, alias] of wanted) {
      const existing = all.find((c) => c.channel === channel);
      if (existing) {
        await request.patch(`/api/v1/cameras/${existing.id}`, { data: { enabled: true, grid_col_span: 1 } });
        seededIds.push(existing.id);
      } else {
        const created = (await (await request.post('/api/v1/cameras', { data: { channel, alias } })).json()) as ApiCamera;
        seededIds.push(created.id);
      }
    }
    const after = ((await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[]);
    const cams = after.filter((c) => c.enabled);
    expect(cams.length).toBeGreaterThan(1);
    return { cams, seededIds };
  }

  /** S4 review: no DELETE /cameras endpoint exists in this codebase (checked) - disabling a self-seeded row is
   * the closest available cleanup, and ensureTwoCameras() above knows to re-enable that same row on a later run
   * rather than create a duplicate. */
  async function cleanupSeeded(request: Req, seededIds: string[]) {
    for (const id of seededIds) await request.patch(`/api/v1/cameras/${id}`, { data: { enabled: false } }).catch(() => {});
  }

  test('the settings entry point is gated on sources.configure (can_sync)', async ({ page, browser, request }) => {
    const { seededIds } = await ensureTwoCameras(request);
    let bindingId: string | undefined;
    try {
      // a plain viewer (map.read only, no sources.configure) bound by the admin - same convention as the
      // kiosk-only-user evidence above (dev identity header + a direct binding through the access API).
      const me = await (await request.get('/api/v1/me', { headers: { 'X-SW-Dev-User': 'wallviewer091' } })).json();
      const existing = (await (await request.get('/api/v1/access/bindings')).json()) as { bindings?: { id: string; role_id: string; subject_id: string }[] };
      const already = (existing.bindings ?? []).find((b) => b.role_id === 'viewer' && b.subject_id === me.user.id);
      if (already) {
        bindingId = already.id; // left over from an earlier interrupted run - clean it up too
      } else {
        const r = await request.post('/api/v1/access/bindings', { data: { subject_kind: 'user', subject_id: me.user.id, role_id: 'viewer', scope_type: 'installation', scope_id: '*' } });
        expect(r.status()).toBeLessThan(300);
        bindingId = ((await r.json()) as { id: string }).id;
      }
      const ctx = await browser.newContext({ extraHTTPHeaders: { 'X-SW-Dev-User': 'wallviewer091' } });
      const restricted = await ctx.newPage();
      await open(restricted, '/live/wall');
      await expect(restricted.locator('live-wall sw-camera-tile').first()).toBeVisible({ timeout: 30000 });
      await expect(restricted.locator('[data-wall-settings-open]')).toHaveCount(0);
      await ctx.close();

      // the admin (dev-mode default identity) holds sources.configure and sees the button
      await open(page, '/live/wall');
      await expect(page.locator('[data-wall-settings-open]')).toBeVisible({ timeout: 30000 });
    } finally {
      if (bindingId) await request.delete(`/api/v1/access/bindings/${bindingId}`).catch(() => {});
      await cleanupSeeded(request, seededIds);
    }
  });

  test('reordering persists and a spanned camera renders correctly (grid-column and real geometry)', async ({ page, request }) => {
    const { cams, seededIds } = await ensureTwoCameras(request);
    const cam1 = cams[0];
    const cam2 = cams[1];
    // S2 review: saving the dialog renumbers every OTHER camera the caller can see too (not just these two),
    // so the whole list is snapshotted here and restored in the finally - a real lab backend must come back
    // exactly as it was, not just the two cameras this test directly touches.
    const snapshot = (await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[];
    try {
      await page.setViewportSize({ width: 1600, height: 900 });
      await open(page, '/live/wall');
      const wall = page.locator('live-wall');
      // S4 review: do not assume the default layout count covers every camera on a real backend - cover all of
      // them explicitly, and locate tiles by their own camera id rather than by position/total count.
      await wall.locator('.layouts button', { hasText: /^32$/ }).click();
      await expect(wall.locator(`sw-camera-tile[cameraid="${cam1.id}"]`)).toBeVisible({ timeout: 30000 });
      await expect(wall.locator(`sw-camera-tile[cameraid="${cam2.id}"]`)).toBeVisible({ timeout: 30000 });
      // a fixed 2-column layout makes the span geometry check below deterministic
      await wall.locator('[data-wall-cols-set="2"]').click();
      await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '2');

      await wall.locator('[data-wall-settings-open]').click();
      const dialog = page.locator('[data-wall-settings-dialog]');
      await expect(dialog.locator('[data-wall-settings-rows]')).toBeVisible(); // the sw-dialog host itself has no box of its own
      // move cam1 down past cam2, and set cam1 to span 2 columns
      await dialog.locator(`[data-wall-move-down="${cam1.id}"]`).click();
      await dialog.locator(`[data-wall-span="${cam1.id}"]`).selectOption('2');
      await dialog.locator('[data-wall-settings-save]').click();
      await expect(dialog).toHaveCount(0, { timeout: 20000 });

      await page.reload();
      await wall.locator('.layouts button', { hasText: /^32$/ }).click();
      await wall.locator('[data-wall-cols-set="2"]').click();
      const orderedIds = await wall.locator('sw-camera-tile').evaluateAll((els) => els.map((el) => el.getAttribute('cameraid')));
      expect(orderedIds.indexOf(cam2.id)).toBeLessThan(orderedIds.indexOf(cam1.id));

      const saved = ((await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[]).find((c) => c.id === cam1.id);
      expect(saved?.grid_col_span).toBe(2);

      // T018 re-review (owner report 2026-09-27): real rendered geometry, not just the style string. A spanned
      // tile no longer widens its OWN aspect ratio to match its neighbors' height (that is what let a real
      // camera's video get letterboxed - see the fix comment on live-wall.ts's bestFit()). It now keeps the
      // real 16:9 ratio at its own (roughly 2x-wider) width, so it comes out noticeably TALLER than a normal
      // tile instead of the same height - the opposite of the old (now-wrong) assertion here. The grid itself
      // must still not overflow the window (bestFit()/maxTileForHeight() account for the taller spanned row).
      const spannedTile = wall.locator(`sw-camera-tile[cameraid="${cam1.id}"]`);
      const normalTile = wall.locator(`sw-camera-tile[cameraid="${cam2.id}"]`);
      const spannedBox = (await spannedTile.boundingBox())!;
      const normalBox = (await normalTile.boundingBox())!;
      expect(spannedBox.width).toBeGreaterThan(normalBox.width * 1.7);
      expect(spannedBox.width).toBeLessThan(normalBox.width * 2.3);
      expect(spannedBox.height).toBeGreaterThan(normalBox.height * 1.5); // taller now, not equal
      expect(Math.abs(spannedBox.width / spannedBox.height - 16 / 9)).toBeLessThan(0.15); // its own box stays ~16:9
      const gridBox = (await wall.locator('[data-wall-cols]').boundingBox())!;
      expect(gridBox.height).toBeLessThan(900);

      // T018: the old version of this test never actually exercised the buggy code path - these fixture
      // cameras (registered manually, channel 101/102, no real NVR behind them) keep status "unknown" forever
      // (migrations/0001_init.sql's default; nothing here ever marks them "online"), so `sw-camera-tile` always
      // rendered its grey "off" placeholder, never `sw-live-player`'s `<video>` - the exact element whose
      // `object-fit: contain` produced the reported letterboxing. A throwaway/no-NVR backend (as used for this
      // fix's own verification) can never make a fixture camera genuinely "online" either, so the LIVE code path
      // is forced open directly on the element (bypassing the backend's own status), then fed a synthetic,
      // KNOWN-16:9 video frame (the same ratio a real, non-panoramic security camera reports) through
      // `canvas.captureStream()` - no real camera or network stream needed. From the ACTUAL rendered host box
      // and the ACTUAL decoded video resolution this reproduces the browser's own (spec-defined) `object-fit:
      // contain` placement and checks the letterbox margin it would paint - this is what the owner's screenshot
      // showed as a black band down one side, and it is what the old assertion (container box vs. container box
      // only) could never have caught.
      await spannedTile.evaluate((el) => {
        (el as unknown as { live: boolean; state: string }).live = true;
        (el as unknown as { live: boolean; state: string }).state = 'live';
      });
      const player = spannedTile.locator('sw-live-player');
      await expect(player).toHaveCount(1, { timeout: 10000 });
      const geometry = await player.evaluate(async (el) => {
        const live = el as unknown as { disconnect: () => void; status: string };
        live.disconnect(); // this throwaway backend has no go2rtc/NVR behind it - a real connect attempt can only error
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720; // native 16:9, like a real (non-panoramic) camera sensor - not the tile's widened box
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#39ff14';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const stream = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(5);
        const video = el.shadowRoot!.querySelector('video')!;
        video.srcObject = stream;
        live.status = 'playing'; // skip the connect/negotiate machinery - only the rendered geometry matters here
        await new Promise<void>((resolve) => {
          if (video.readyState >= 1 && video.videoWidth) return resolve();
          video.onloadedmetadata = () => resolve();
        });
        const hostBox = el.getBoundingClientRect();
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        // The browser's own object-fit: contain algorithm (CSS spec, deterministic): scale the frame to the
        // largest size that fits inside the host box while keeping its aspect ratio, then center it - any
        // leftover width or height is the letterbox band actually painted.
        const scale = Math.min(hostBox.width / vw, hostBox.height / vh);
        return { hostW: hostBox.width, hostH: hostBox.height, marginX: hostBox.width - vw * scale, marginY: hostBox.height - vh * scale };
      });
      // no visible letterbox: the picture fills the tile in both axes (small rounding only) - this would have
      // FAILED before the fix (a span-2 tile's box was 32:9 against a 16:9 frame: ~50% of the width unfilled).
      expect(geometry.marginX).toBeLessThan(Math.max(4, geometry.hostW * 0.02));
      expect(geometry.marginY).toBeLessThan(Math.max(4, geometry.hostH * 0.02));
    } finally {
      for (const c of snapshot) {
        await request.patch(`/api/v1/cameras/${c.id}`, { data: { sort_order: c.sort_order, grid_col_span: c.grid_col_span } }).catch(() => {});
      }
      await cleanupSeeded(request, seededIds);
    }
  });
});
