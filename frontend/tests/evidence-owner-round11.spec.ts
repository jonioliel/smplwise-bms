import { test, expect, type Page } from '@playwright/test';
import { simulateStrictPlacement, simulateStrictRows } from '../src/screens/wall-grid';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** UI round 1c (shell/screen-edit.ts): "סידור הקיר" is an item of the user menu, not a button in the wall's header. */
async function openUserMenu(page: Page) {
  await page.locator('sw-app [data-profile-menu]:visible, sw-app [data-nav-me]:visible').first().click();
}
async function enterWallArrange(page: Page) {
  await openUserMenu(page);
  await page.locator('sw-app sw-user-menu [data-menu-screen-edit="wall-arrange"]').click();
}
async function wallArrangeOffered(page: Page): Promise<boolean> {
  await openUserMenu(page);
  await page.waitForTimeout(300);
  const offered = (await page.locator('sw-app sw-user-menu [data-menu-screen-edit="wall-arrange"]').count()) > 0;
  await page.keyboard.press('Escape');
  return offered;
}

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

  /** At least `need` enabled cameras to reorder/span; this repo has no existing fixture/seed for cameras (they
   * are normally discovered from a real NVR by autosync). Fixed test channels (101/102/103/...) are reused
   * across runs instead of creating fresh rows every time: cameras.py has no DELETE endpoint, so a previous
   * run's cleanup can only have disabled them (S4 review) - re-enable that same row rather than register a
   * duplicate. `seededIds` is only non-empty when this function actually touched something: on a real backend
   * that already has >= `need` enabled cameras, THIS function adds or re-enables nothing - but the tests that
   * call it do edit those real cameras' sort_order / grid_col_span through the dialog and the API, and restore
   * them from a full snapshot in their own `finally`. */
  async function ensureCameras(request: Req, need: number): Promise<{ cams: ApiCamera[]; seededIds: string[] }> {
    const all = ((await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[]);
    const enabled = all.filter((c) => c.enabled);
    if (enabled.length >= need) return { cams: enabled, seededIds: [] };
    const letters = 'ABCDEFGHIJKL'.split('');
    const wanted: [number, string][] = Array.from({ length: need }, (_, i) => [101 + i, `מצלמה בדיקה ${letters[i]} · T091`]);
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
    expect(cams.length).toBeGreaterThanOrEqual(need);
    return { cams, seededIds };
  }

  /** Back-compat name for the (still separate) two-camera reorder test below. */
  const ensureTwoCameras = (request: Req) => ensureCameras(request, 2);

  /** Forces a wall tile's LIVE code path open and feeds its `<video>` a synthetic, known-16:9 frame (1280x720)
   * through `canvas.captureStream()` - no real camera or go2rtc needed. The frame carries a distinct marker band
   * on each of its four edges (top red, bottom blue, left magenta, right yellow, green in between), so the
   * screenshot check below can tell whether the WHOLE frame reached the tile's edges: `contain` leaves dark bands
   * beside it, `cover` trims the top and bottom markers away, only `fill` (or a same-shape box) shows all four at
   * the tile's own edges. Fixture cameras (no NVR behind them) never become "online", and a throwaway backend has
   * no go2rtc to connect to, so the player's own connect attempt is dropped first. Returns the video's computed
   * object-fit and its box next to the player's box, once a frame has been painted. */
  async function feedSyntheticFrame(tile: import('@playwright/test').Locator) {
    await tile.evaluate((el) => {
      (el as unknown as { live: boolean; state: string }).live = true;
      (el as unknown as { live: boolean; state: string }).state = 'live';
    });
    const player = tile.locator('sw-live-player');
    await expect(player).toHaveCount(1, { timeout: 10000 });
    return player.evaluate(async (el) => {
      const live = el as unknown as { disconnect: () => void; status: string };
      live.disconnect();
      const canvas = document.createElement('canvas');
      canvas.width = 1280;
      canvas.height = 720; // native 16:9, like a real (non-panoramic) camera's stream
      const ctx = canvas.getContext('2d')!;
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = '#39ff14';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#ff00ff'; // left edge
      ctx.fillRect(0, 0, W * 0.06, H);
      ctx.fillStyle = '#ffff00'; // right edge
      ctx.fillRect(W * 0.94, 0, W * 0.06, H);
      ctx.fillStyle = '#ff0000'; // top edge
      ctx.fillRect(0, 0, W, H * 0.08);
      ctx.fillStyle = '#0000ff'; // bottom edge
      ctx.fillRect(0, H * 0.92, W, H * 0.08);
      const video = el.shadowRoot!.querySelector('video')!;
      video.srcObject = (canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(5);
      live.status = 'playing';
      await new Promise<void>((resolve) => {
        if (video.readyState >= 1 && video.videoWidth) return resolve();
        video.onloadedmetadata = () => resolve();
      });
      await new Promise((r) => setTimeout(r, 400)); // a painted frame, not only metadata
      const vb = video.getBoundingClientRect();
      const hb = el.getBoundingClientRect();
      return { objectFit: getComputedStyle(video).objectFit, video: { w: vb.width, h: vb.height }, host: { w: hb.width, h: hb.height } };
    });
  }

  /** What the browser ACTUALLY painted just inside a tile's four edges: the tile's real screenshot pixels, decoded
   * in the page (no image library needed). Left/right are sampled at 40% height, top at the centre, bottom at 20%
   * of the width from the left - clear of the camera label and status pill (bottom right, the RTL start side) and
   * the mute button (bottom left corner). */
  async function paintedEdges(page: Page, tile: import('@playwright/test').Locator) {
    const png = (await tile.screenshot()).toString('base64');
    return page.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const at = (x: number, y: number) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data.slice(0, 3));
      const w = c.width;
      const h = c.height;
      return { left: at(3, h * 0.4), right: at(w - 4, h * 0.4), top: at(w / 2, 3), bottom: at(w * 0.2, h - 3) };
    }, png);
  }
  // colour classes robust to the tile's own light top / darker bottom shade gradient
  const isMagenta = ([r, g, b]: number[]) => r > 150 && b > 150 && g < 100;
  const isYellow = ([r, g, b]: number[]) => r > 150 && g > 150 && b < 100;
  const isRed = ([r, g, b]: number[]) => r > 150 && g < 80 && b < 80;
  const isBlue = ([r, g, b]: number[]) => b > 100 && r < 60 && g < 60;

  /** The whole synthetic frame reaches all four edges of `tile`: `fit` is the expected object-fit, the video box is
   * the tile's box in both dimensions, and each edge marker is painted at the matching tile edge (none cropped,
   * no band beside the picture). */
  async function expectWholeFrameEdgeToEdge(page: Page, tile: import('@playwright/test').Locator, fit: 'fill' | 'contain') {
    const fed = await feedSyntheticFrame(tile);
    expect(fed.objectFit).toBe(fit);
    expect(Math.abs(fed.video.w - fed.host.w)).toBeLessThan(1);
    expect(Math.abs(fed.video.h - fed.host.h)).toBeLessThan(1);
    const e = await paintedEdges(page, tile);
    const got = JSON.stringify(e);
    expect(isMagenta(e.left), `left edge (frame's left marker) ${got}`).toBe(true);
    expect(isYellow(e.right), `right edge (frame's right marker) ${got}`).toBe(true);
    expect(isRed(e.top), `top edge (frame's top marker) ${got}`).toBe(true);
    expect(isBlue(e.bottom), `bottom edge (frame's bottom marker) ${got}`).toBe(true);
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
      expect(await wallArrangeOffered(restricted)).toBe(false);
      await ctx.close();

      // the admin (dev-mode default identity) holds sources.configure and sees the user menu's item
      await open(page, '/live/wall');
      await expect.poll(() => wallArrangeOffered(page), { timeout: 30000 }).toBe(true);
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

      await enterWallArrange(page);
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

      // Real rendered geometry, not just the style string. Owner decision 2026-09-27 (after 0.1.101): a spanned
      // camera is a wide strip ONE row tall - as wide as the columns it spans, exactly as tall as its neighbours -
      // not a taller 16:9 "hero" tile (0.1.101's shape, which left holes beside it and moved every camera). See
      // live-wall.ts's bestFit() comment for the full history.
      const spannedTile = wall.locator(`sw-camera-tile[cameraid="${cam1.id}"]`);
      const normalTile = wall.locator(`sw-camera-tile[cameraid="${cam2.id}"]`);
      const spannedBox = (await spannedTile.boundingBox())!;
      const normalBox = (await normalTile.boundingBox())!;
      expect(Math.abs(spannedBox.width - (2 * normalBox.width + 12))).toBeLessThan(3); // two columns plus the gap between them
      expect(Math.abs(spannedBox.height - normalBox.height)).toBeLessThan(2); // one row tall, like its neighbour
      const gridBox = (await wall.locator('[data-wall-cols]').boundingBox())!;
      expect(gridBox.height).toBeLessThan(900);

      // The live picture must fill that wide strip edge to edge (owner: "left to right, not only in the
      // middle") and show the WHOLE frame - stretched, not cropped (owner decision 2026-09-27). Fixture cameras
      // never become "online" and this backend has no go2rtc, so the tile's LIVE path is forced open and fed a
      // synthetic 16:9 frame with a marker on each edge; the pixels the browser really painted at the strip's
      // four edges are then read back from a screenshot. `contain` (0.1.100) fails the left/right check (dark
      // bands), `cover` fails the top/bottom check (markers trimmed away); `fill` passes all four.
      await expectWholeFrameEdgeToEdge(page, spannedTile, 'fill');
    } finally {
      for (const c of snapshot) {
        await request.patch(`/api/v1/cameras/${c.id}`, { data: { sort_order: c.sort_order, grid_col_span: c.grid_col_span } }).catch(() => {});
      }
      await cleanupSeeded(request, seededIds);
    }
  });

  test('owner layout (0.1.101 report): 11 cameras, "12" layout, automatic columns - span-only save keeps the stored order, the wall shows exactly that order, rows stay even, the wide picture shows the whole frame edge to edge', async ({ page, request }) => {
    // Reproduces the owner's real setup of 2026-09-27: 11 cameras, the "12" layout button, the automatic ("אוטו")
    // column fit - not a manual column count like the tests above - and two cameras (the 4th and the 6th, the
    // owner's two sports-hall cameras) set to span 2 columns through the settings dialog by changing ONLY their
    // span dropdowns (no move button). The owner reported the cameras came out in the wrong places and the picture
    // not filling the wide tile. What this checks, in order:
    // (1) a span-only save does not change the STORED camera order (sort_order is renumbered 0..N-1 in the same
    //     relative order) - verified clean;
    // (2) the ON-SCREEN order - where each tile really is, read the way a person reads this RTL wall - IS the
    //     saved order (owner decision 2026-09-27: strict order, the grid no longer uses `grid-auto-flow: dense`,
    //     which put the 5th camera ahead of the spanned 4th here); a spanned camera that does not fit at the end
    //     of a row starts the next row and leaves a gap instead;
    // (3) every row is ONE even height - 0.1.101 made a row holding a spanned camera about twice as tall as its
    //     neighbours, leaving holes under the plain tiles and changing the automatic column count;
    // (4) the wall still fits the screen; (5) a real (synthetic) 16:9 video frame reaches all four edges of each
    //     wide tile, whole - stretched, not cropped (owner decision 2026-09-27).
    const { cams, seededIds } = await ensureCameras(request, 11);
    const snapshot = (await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[];
    try {
      for (const c of cams) if (c.grid_col_span !== 1) await request.patch(`/api/v1/cameras/${c.id}`, { data: { grid_col_span: 1 } });
      const shownBefore = cams.slice(0, 12).map((c) => c.id); // the "12" layout shows the first 12 enabled cameras
      const [hallA, hallB] = [shownBefore[3], shownBefore[5]];
      await page.setViewportSize({ width: 1440, height: 900 });
      await open(page, '/live/wall');
      const wall = page.locator('live-wall');
      await wall.locator('.layouts button', { hasText: /^12$/ }).click();
      await wall.locator('[data-wall-cols-set="0"]').click(); // automatic column fit, the owner's mode
      await expect(wall.locator(`sw-camera-tile[cameraid="${hallA}"]`)).toBeVisible({ timeout: 30000 });

      await enterWallArrange(page);
      const dialog = page.locator('[data-wall-settings-dialog]');
      await expect(dialog.locator('[data-wall-settings-rows]')).toBeVisible();
      const listed = await dialog.locator('[data-wall-settings-row]').evaluateAll((els) => els.map((el) => el.getAttribute('data-wall-settings-row')));
      expect(listed.slice(0, shownBefore.length)).toEqual(shownBefore); // the dialog lists the wall's own order
      await dialog.locator(`[data-wall-span="${hallA}"]`).selectOption('2');
      await dialog.locator(`[data-wall-span="${hallB}"]`).selectOption('2');
      await dialog.locator('[data-wall-settings-save]').click();
      await expect(dialog).toHaveCount(0, { timeout: 20000 });

      // (1) stored order unchanged
      const after = ((await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[]).filter((c) => c.enabled);
      expect(after.map((c) => c.id)).toEqual(cams.map((c) => c.id));
      expect(after.find((c) => c.id === hallA)?.grid_col_span).toBe(2);
      expect(after.find((c) => c.id === hallB)?.grid_col_span).toBe(2);

      await page.reload();
      await wall.locator('.layouts button', { hasText: /^12$/ }).click();
      await expect(wall.locator(`sw-camera-tile[cameraid="${hallB}"]`)).toBeVisible({ timeout: 30000 });
      await expect(wall.locator('[data-wall-cols-set="0"]')).toHaveClass(/on/);
      await page.waitForTimeout(500); // the fit re-measures once after the first render

      // (2) on-screen order: where each tile really is, read row by row from the top and within a row from the
      // RIGHT edge (this UI is RTL, so grid column 1 is on the right) - not just the DOM order.
      const domIds = await wall.locator('sw-camera-tile').evaluateAll((els) => els.map((el) => el.getAttribute('cameraid')));
      expect(domIds).toEqual(shownBefore);
      const cols = Number(await wall.locator('[data-wall-cols]').getAttribute('data-wall-cols'));
      const rendered = await wall.locator('sw-camera-tile').evaluateAll((els) => els.map((el) => {
        const b = el.getBoundingClientRect();
        return { id: el.getAttribute('cameraid')!, top: Math.round(b.top), right: b.right };
      }));
      const onScreen = [...rendered].sort((a, b) => a.top - b.top || b.right - a.right).map((t) => shownBefore.indexOf(t.id));
      test.info().annotations.push({ type: 'on-screen order', description: `${cols} columns: ${onScreen.join(',')}` });
      expect(onScreen).toEqual(shownBefore.map((_, i) => i)); // exactly the saved order
      // ...and every tile sits where the strict placement model puts it (same row, same row-reading position)
      const spans = shownBefore.map((id) => (id === hallA || id === hallB ? 2 : 1));
      const model = simulateStrictPlacement(spans, cols);
      const rowTops = [...new Set(rendered.map((t) => t.top))].sort((a, b) => a - b);
      expect(rowTops.length).toBe(simulateStrictRows(spans, cols));
      rendered.forEach((t, i) => expect(rowTops.indexOf(t.top), `row of tile #${i}`).toBe(model[i].row));
      if (shownBefore.length === 11) {
        // the owner's exact case (11 cameras, 1440x900): the automatic fit picks 4 columns; the spanned 4th camera
        // does not fit after the first three, so the first row ends in a one-column gap and the 4th starts row 2
        // (under dense placement the 5th camera used to fill that gap, ahead of the 4th)
        expect(cols).toBe(4);
        expect(model[3]).toEqual({ row: 1, col: 0 });
        expect(rendered[3].top).toBeGreaterThan(rendered[2].top);
      }

      // (3) one even row height everywhere: no tile taller than any other, so no holes under plain tiles
      const boxes = await wall.locator('sw-camera-tile').evaluateAll((els) => els.map((el) => {
        const b = el.getBoundingClientRect();
        return { id: el.getAttribute('cameraid'), w: b.width, h: b.height };
      }));
      const heights = boxes.map((b) => b.h);
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
      const plainW = boxes.find((b) => b.id === shownBefore[0])!.w;
      for (const id of [hallA, hallB]) expect(Math.abs(boxes.find((b) => b.id === id)!.w - (2 * plainW + 12))).toBeLessThan(3);

      // (4) the whole wall still fits the window (no scrollable overflow of sw-app's own <main>)
      const scrollOverflow = await page.evaluate(() => {
        const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
        return main ? main.scrollHeight - main.clientHeight : 0;
      });
      expect(scrollOverflow).toBeLessThan(4);

      // (5) the WHOLE 16:9 frame reaches all four edges of each wide tile - stretched (`fill`), not cropped
      for (const id of [hallA, hallB]) await expectWholeFrameEdgeToEdge(page, wall.locator(`sw-camera-tile[cameraid="${id}"]`), 'fill');
      // a plain (span-1) tile keeps `contain` - a 16:9 frame in its 16:9 box already shows whole, edge to edge
      await expectWholeFrameEdgeToEdge(page, wall.locator(`sw-camera-tile[cameraid="${shownBefore[0]}"]`), 'contain');
    } finally {
      for (const c of snapshot) {
        await request.patch(`/api/v1/cameras/${c.id}`, { data: { sort_order: c.sort_order, grid_col_span: c.grid_col_span } }).catch(() => {});
      }
      await cleanupSeeded(request, seededIds);
    }
  });

  test('a fragmentation-prone span mix (four span-3 tiles at 4 columns, T018 re-review) does not overflow the viewport', async ({ page, request }) => {
    // T018 re-review (blocking finding), now under strict saved-order placement (owner decision 2026-09-27, the
    // grid's default row auto-placement): a tile whose span does not fit in what is left of a row starts the next
    // row and leaves a gap. Four span-3 cameras at 4 columns is the cleanest reproduction: each one fills 3 of the
    // 4 columns, the 4th column of every row stays empty, so each camera gets its OWN row - 4 real rows
    // (simulateStrictRows([3,3,3,3], 4)) - while a naive ideal-packing estimate (`Math.ceil(sum(spans)/cols)` =
    // `Math.ceil(12/4)`) predicts only 3. (This in-browser test uses an all-span-3 mix so 4 distinctly-seeded
    // cameras exactly fill 4 columns without live-wall.ts's own `Math.min(colsOverride, shown.length)` clamp
    // kicking in; tests/unit-wall-grid.spec.ts has more row-count cases.) Feeding the too-low row estimate into
    // the tile-height budget sizes tiles for 3 rows while the browser renders 4 - the "wall overflows the screen"
    // failure this feature has already been fixed for; the wall's tile sizing (bestFit()/fitTile() in
    // live-wall.ts) must use the ACTUAL row count (simulateStrictRows()) or this reproduces that overflow end to
    // end in a real browser.
    const { cams, seededIds } = await ensureCameras(request, 4);
    const [c1, c2, c3, c4] = cams;
    const snapshot = (await (await request.get('/api/v1/cameras')).json()).cameras as ApiCamera[];
    try {
      // 1600x900: HEIGHT must be the binding dimension here, or this test cannot catch a row undercount at all.
      // Every tile is one row tall (a span-3 tile is a 3-column-wide strip of that height), so the height budget
      // is rows x tile*9/16 plus gaps. With roughly 620 px of height for the grid, 4 real rows allow a span-1
      // column of about 258 px, well below the about 350 px the width would allow - height decides. The naive
      // 3-row estimate would instead size about 350 px columns, i.e. four strips of about 197 px = about 826 px
      // of grid in about 620 px: a clear overflow (figures computed from the fit formula, not measured with the
      // naive estimate restored). A much taller viewport (the 2000 px this test used with 0.1.101's taller-tile
      // model) makes WIDTH the binding dimension and the test would pass even with the undercount back.
      await page.setViewportSize({ width: 1600, height: 900 });
      await open(page, '/live/wall');
      const wall = page.locator('live-wall');
      await wall.locator('.layouts button', { hasText: /^32$/ }).click();
      for (const c of [c1, c2, c3, c4]) await expect(wall.locator(`sw-camera-tile[cameraid="${c.id}"]`)).toBeVisible({ timeout: 30000 });
      await wall.locator('[data-wall-cols-set="4"]').click();
      await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '4');

      await enterWallArrange(page);
      const dialog = page.locator('[data-wall-settings-dialog]');
      await expect(dialog.locator('[data-wall-settings-rows]')).toBeVisible();
      for (const c of [c1, c2, c3, c4]) await dialog.locator(`[data-wall-span="${c.id}"]`).selectOption('3');
      await dialog.locator('[data-wall-settings-save]').click();
      await expect(dialog).toHaveCount(0, { timeout: 20000 });

      await page.reload();
      await wall.locator('.layouts button', { hasText: /^32$/ }).click();
      await wall.locator('[data-wall-cols-set="4"]').click();
      await expect(wall.locator(`sw-camera-tile[cameraid="${c1.id}"]`)).toBeVisible({ timeout: 30000 });
      await expect(wall.locator('[data-wall-cols]')).toHaveAttribute('data-wall-cols', '4');

      // the whole wall must stay inside the viewport - no scrolling wall - which is exactly what an
      // under-counted row estimate (3 instead of the real 4) blows past: the tile budget above is sized as
      // if only 3 rows needed to fit, then the browser renders a 4th anyway.
      // Real overflow of the actual scrolling container, not a coordinate relative to whatever the current
      // scroll position happens to be (an earlier click can autoscroll an element into view and shift every
      // boundingBox() by that amount, and this content overflows sw-app's own `<main overflow:auto>` - not
      // the document body - so document.scrollHeight would not show it either).
      const scrollOverflow = await page.evaluate(() => {
        const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
        return main ? main.scrollHeight - main.clientHeight : 0;
      });
      expect(scrollOverflow).toBeLessThan(4); // a few px of rounding slack only - no real scrollable overflow
      // ...and that check only means something while height, not width, sized the tiles (see the viewport note)
      const fitInfo = await wall.locator('[data-wall-cols]').evaluate((el) => ({ tile: parseFloat((el as HTMLElement).style.getPropertyValue('--tile')), w: el.clientWidth }));
      expect(fitInfo.tile, `fitted tile ${fitInfo.tile}px, grid ${fitInfo.w}px wide`).toBeLessThan((fitInfo.w - 3 * 12) / 4 - 20);

      // ...and a naive (ideal-packing, 3-row) estimate would really overflow this height budget: sized for 3
      // rows, the 4 rows the browser renders would need clearly more height than the wall has (the measured box
      // live-wall uses, not a guess).
      const strictRows = simulateStrictRows([3, 3, 3, 3], 4);
      expect(strictRows).toBe(4);
      const box = await wall.evaluate((el) => (el as unknown as { box: { w: number; h: number } }).box);
      const naiveTile = Math.min((box.w - 3 * 12) / 4, ((box.h - 2 * 12) / Math.ceil(12 / 4)) * (16 / 9));
      const naiveGridH = strictRows * ((naiveTile * 9) / 16) + (strictRows - 1) * 12;
      expect(naiveGridH, `naive sizing: ${Math.round(naiveGridH)}px of rows in a ${box.h}px budget`).toBeGreaterThan(box.h + 40);

      // strict placement gives each span-3 tile its own row: 4 tiles, simulateStrictRows() distinct row tops
      const boxes = await Promise.all([c1.id, c2.id, c3.id, c4.id].map((id) => wall.locator(`sw-camera-tile[cameraid="${id}"]`).boundingBox()));
      const tops = new Set(boxes.map((b) => Math.round(b!.y)));
      expect(tops.size).toBe(strictRows);
    } finally {
      for (const c of snapshot) {
        await request.patch(`/api/v1/cameras/${c.id}`, { data: { sort_order: c.sort_order, grid_col_span: c.grid_col_span } }).catch(() => {});
      }
      await cleanupSeeded(request, seededIds);
    }
  });
});
