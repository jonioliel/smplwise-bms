import { test, expect, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// EVIDENCE-CAMERAS-2412: the screenshots 2.41.0 (CAMERA-STREAM-SOURCES-2410) and 2.41.1 (NVRLESS-CAMERAS-2411) left NOT_RUN.
// Against the REAL backend with fake devices only - no camera, NVR, go2rtc or Home Assistant is reachable; every camera address is a
// placeholder under the reserved `camera.example` name. Three installations, one backend each (SW_EVID2412 picks the block):
//
//   b  no recorder, WebRTC server configured (fake go2rtc), two cameras without a recorder - the camera screens, recorder-only areas
//      hidden, the floor map's camera layer and the plan editor placing such a camera. Seeds the data (idempotent).
//        backend: SW_WEBRTC=1 tests/fixtures/nvrless_cameras_backend.py
//   a  the SAME data dir restarted without the WebRTC server: the notice + link on the camera screens, add / test disabled.
//        backend: SW_WEBRTC=0 tests/fixtures/nvrless_cameras_backend.py
//   d  a recorder installation (tests/fixtures/multi_nvr_backend.py): the per-camera video source dialog - recorder vs manual RTSP
//      main / sub, the stream test result, the masked credentials after saving.
//
//   SW_LIVE=1 SW_EVID2412=b SW_API_PORT=8411 SW_BASE_URL=http://127.0.0.1:4412/ \
//     npx playwright test tests/evidence-nvrless-cameras-2412.spec.ts --project=desktop --project=tablet --project=mobile --workers=1
//   SW_DARK=1 adds the dark scheme (run it with --project=desktop: 1440 dark).
//
// Shots: docs/changes/evidence/EVIDENCE-CAMERAS-2412/<install>-<screen>-<width>[-dark].png

const MODE = process.env.SW_EVID2412 ?? '';
const DARK = process.env.SW_DARK === '1';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/changes/evidence/EVIDENCE-CAMERAS-2412');
const WIDTH: Record<string, string> = { desktop: '1440', tablet: '1024', mobile: '390' };
const SITE = 'אתר הדגמה 2412';
const CAMS = [
  { name: 'כניסה ראשית', main_url: 'rtsp://viewer:fixture-pass@camera.example/stream1', sub_url: 'rtsp://viewer:fixture-pass@camera.example/stream2', area: 'evid_lobby' },
  { name: 'חניון', main_url: 'rtsp://viewer:fixture-pass@parking.camera.example/main', sub_url: null, area: 'evid_parking' },
];
const FLOORS = [{ floor_id: 'evid_ground', name: 'קרקע', level: 0 }];
const AREAS = [
  { area_id: 'evid_lobby', name: 'לובי', floor_id: 'evid_ground', icon: 'mdi:sofa' },
  { area_id: 'evid_parking', name: 'חניון', floor_id: 'evid_ground', icon: 'mdi:car' },
];

let api: APIRequestContext;

async function open(page: Page, hash: string) {
  if (DARK) await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('about:blank');
  await page.goto(`/?design=a${DARK ? '&scheme=dark' : ''}#${hash}`);
  await page.waitForSelector('sw-app');
  if (DARK) await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await page.waitForTimeout(1800);
}

async function shot(page: Page, name: string, info: TestInfo) {
  fs.mkdirSync(OUT, { recursive: true });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, `${MODE}-${name}-${WIDTH[info.project.name] ?? info.project.name}${DARK ? '-dark' : ''}.png`) });
}

/** Layout facts of the current screen, attached to the report (overflow, inner scrolling, English words). */
async function facts(page: Page, info: TestInfo, name: string) {
  const f = await page.evaluate(() => {
    const deep = (root: Document | ShadowRoot, out: Element[] = []): Element[] => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        out.push(el);
        if ((el as HTMLElement).shadowRoot) deep((el as HTMLElement).shadowRoot!, out);
      }
      return out;
    };
    const all = deep(document);
    const scrollers = all
      .filter((el) => {
        const s = getComputedStyle(el);
        return (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 2) || (/(auto|scroll)/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 2);
      })
      .map((el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}.${(el.getAttribute('class') ?? '').split(' ')[0]} ${el.scrollWidth}x${el.scrollHeight}/${el.clientWidth}x${el.clientHeight}`);
    const text = all
      .filter((el) => !['STYLE', 'SCRIPT', 'SVG', 'PATH'].includes(el.tagName) && (el as HTMLElement).offsetParent !== null)
      .flatMap((el) => Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => (n.textContent ?? '').trim()))
      .filter((t) => /[A-Za-z]{3,}/.test(t) && !/^(rtsp|https?):/.test(t));
    return { pageScrollX: document.documentElement.scrollWidth > window.innerWidth + 1, scrollers, latin: Array.from(new Set(text)).slice(0, 40) };
  });
  await info.attach(`facts-${name}`, { body: JSON.stringify(f, null, 1), contentType: 'application/json' });
  // SW_FACTS_DIR: a folder outside the repository that collects these facts for the write-up (not committed)
  if (process.env.SW_FACTS_DIR) fs.appendFileSync(path.join(process.env.SW_FACTS_DIR, `facts-${MODE}.jsonl`), JSON.stringify({ shot: name, project: info.project.name, dark: DARK, ...f }) + '\n');
  return f;
}

async function standaloneCams(): Promise<{ id: string; name: string }[]> {
  const r = await (await api.get('api/v1/cameras')).json();
  return (r.cameras as { id: string; name: string; standalone?: boolean; recorder_id?: string }[]).filter((c) => c.standalone || c.recorder_id === 'standalone');
}

async function floorId(): Promise<string> {
  const r = await (await api.get('api/v1/sites')).json();
  const site = (r.sites as { name: string; buildings: { floors: { id: string }[] }[] }[]).find((s) => s.name === SITE);
  return site?.buildings[0]?.floors[0]?.id ?? '';
}

test.describe('EVIDENCE-CAMERAS-2412', () => {
  test.skip(process.env.SW_LIVE !== '1' || !['a', 'b', 'd'].includes(MODE), 'needs a fixture backend (SW_LIVE=1 SW_EVID2412=a|b|d), see the header');

  test.beforeAll(async ({ playwright, browser }) => {
    api = await playwright.request.newContext({ baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:4173/' });
    if (MODE !== 'b') return;
    // HA areas (the area names of the cameras and the add dialog's area list)
    expect((await api.post('api/v1/ha/dev/registry', { data: { entities: [], devices: [], areas: AREAS, floors: FLOORS } })).status()).toBe(200);
    // two cameras without a recorder (POST /cameras/standalone; the placeholder names never resolve, nothing is contacted)
    const have = await standaloneCams();
    for (const c of CAMS) {
      if (have.some((h) => h.name === c.name)) continue;
      const r = await api.post('api/v1/cameras/standalone', { data: { name: c.name, area_id: c.area, main_url: c.main_url, sub_url: c.sub_url } });
      expect(r.status(), await r.text()).toBe(201);
    }
    // a site / building / floor with a published plan and the first camera placed on it
    if (!(await floorId())) {
      const site = (await (await api.post('api/v1/sites', { data: { name: SITE, address: '' } })).json()).id;
      const building = (await (await api.post(`api/v1/sites/${site}/buildings`, { data: { name: 'בניין א' } })).json()).id;
      const floor = (await (await api.post(`api/v1/buildings/${building}/floors`, { data: { name: 'קומת קרקע', level: 0 } })).json()).id;
      const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      await page.setContent(`<div style="position:relative;box-sizing:border-box;width:1200px;height:800px;background:#fff;border:12px solid #333">
        <div style="position:absolute;inset:0 auto 0 480px;width:8px;background:#333"></div>
        <div style="position:absolute;top:420px;left:0;width:480px;height:8px;background:#333"></div>
        <div style="position:absolute;top:0;left:840px;width:8px;height:300px;background:#333"></div>
        <div style="position:absolute;top:300px;left:840px;width:350px;height:8px;background:#333"></div></div>`);
      const png = await page.screenshot();
      await page.close();
      const asset = await (await api.post(`api/v1/floors/${floor}/plan-assets`, { multipart: { file: { name: 'plan.png', mimeType: 'image/png', buffer: png } } })).json();
      const version = (await (await api.post(`api/v1/floors/${floor}/plan-versions`, { data: { asset_id: asset.id } })).json()).id;
      expect((await api.post(`api/v1/plan-versions/${version}/publish`)).status()).toBe(200);
    }
    const fl = await floorId();
    const cams = await standaloneCams();
    const anchors = (await (await api.get(`api/v1/floors/${fl}/anchors`)).json()).anchors as { resource_id: string }[];
    const first = cams.find((c) => c.name === CAMS[0].name)!;
    if (!anchors.some((a) => a.resource_id === first.id)) {
      const r = await api.post(`api/v1/floors/${fl}/anchors`, { data: { resource_type: 'camera', resource_id: first.id, x: 0.22, y: 0.3, rotation_degrees: 45, field_of_view_degrees: 90 } });
      expect(r.status(), await r.text()).toBe(201);
    }
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ---------------------------------------------------------------- b: no recorder, WebRTC server configured
  test.describe('b - no recorder, WebRTC server, two cameras without a recorder', () => {
    test.skip(MODE !== 'b');

    test('the capability block', async () => {
      const me = await (await api.get('api/v1/me')).json();
      expect(me.capabilities).toMatchObject({ nvr: false, go2rtc: true, cameras_available: true, webrtc_server_configured: true, playback: false });
    });

    test('live overview, wall and the camera screen; recorder-only areas are not offered', async ({ page }, info) => {
      await open(page, '/live');
      await expect(page.locator('sw-app [data-overview-tile="cameras"]')).toBeVisible({ timeout: 30000 });
      await shot(page, 'overview', info);
      await facts(page, info, 'overview');
      const hrefs = await page.locator('sw-app a').evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''));
      expect(hrefs.filter((h) => h.startsWith('#/investigate/playback') || h.startsWith('#/investigate/health') || h === '#/system/security/cameras')).toEqual([]);

      await open(page, '/live/wall');
      await expect(page.locator('sw-app live-wall sw-camera-tile').first()).toBeVisible({ timeout: 30000 });
      expect(await page.locator('sw-app live-wall sw-camera-tile').count()).toBe(2);
      await shot(page, 'wall', info);
      await facts(page, info, 'wall');

      const cam = (await standaloneCams()).find((c) => c.name === CAMS[0].name)!;
      await open(page, `/live/cameras/${cam.id}`);
      await expect(page.locator('sw-app live-camera')).toBeVisible({ timeout: 30000 });
      await shot(page, 'camera', info);
      await facts(page, info, 'camera');

      await open(page, '/investigate/playback');
      await expect(page.locator('sw-app sw-state-panel[data-nvr-less]')).toBeVisible({ timeout: 30000 });
      await shot(page, 'playback-blocked', info);
    });

    test('settings: the "cameras without a recorder" card, add enabled; the add dialog', async ({ page }, info) => {
      await open(page, '/system/security/nvr');
      const card = page.locator('sw-app standalone-cameras-card');
      await expect(card.locator('[data-standalone-camera]')).toHaveCount(2, { timeout: 30000 });
      await expect(card.locator('[data-standalone-add] button')).toBeEnabled();
      await expect(card.locator('[data-webrtc-required]')).toHaveCount(0);
      // every row action stays on the screen (at 390 px the remove button ran off its left edge before EVIDENCE-CAMERAS-2412)
      for (const btn of await card.locator('[data-standalone-remove]').all()) {
        const r = (await btn.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      await shot(page, 'security-nvr', info);
      await facts(page, info, 'security-nvr');
      await card.locator('[data-standalone-add]').click();
      const dlg = page.locator('sw-app camera-source-dialog[mode="add"] [data-camera-source-dialog="add"]');
      await expect(dlg.locator('.body').first()).toBeVisible({ timeout: 15000 });
      await dlg.locator('[data-source-name]').fill('מחסן');
      await dlg.locator('[data-source-url="main"]').fill('rtsp://viewer:fixture-pass@store.camera.example/main');
      await expect(dlg.locator('[data-source-test] button')).toBeEnabled();
      await shot(page, 'add-dialog', info);
      await facts(page, info, 'add-dialog');
    });

    test('floor map: the camera layer draws the camera without a recorder, no recordings button', async ({ page }, info) => {
      const fl = await floorId();
      await open(page, `/explore/floors/${fl}`);
      const cam = (await standaloneCams()).find((c) => c.name === CAMS[0].name)!;
      const anchors = (await (await api.get(`api/v1/floors/${fl}/anchors`)).json()).anchors as { id: string; resource_id: string }[];
      const anchor = anchors.find((a) => a.resource_id === cam.id)!;
      const marker = page.locator(`sw-app explore-floor-map sw-plan-canvas g.marker[data-id="${anchor.id}"]`);
      await expect(marker).toBeVisible({ timeout: 30000 });
      await shot(page, 'floor-map', info);
      await facts(page, info, 'floor-map');
      await marker.click();
      await page.waitForTimeout(800);
      await expect(page.locator('sw-app explore-floor-map sw-button[icon="history"]')).toHaveCount(0);
      await shot(page, 'floor-map-selected', info);
      await facts(page, info, 'floor-map-selected');
    });

    test('plan editor: the camera tool lists the cameras without a recorder and places one', async ({ page }, info) => {
      const fl = await floorId();
      const second = (await standaloneCams()).find((c) => c.name === CAMS[1].name)!;
      // the run is repeated per width: remove an earlier placement of the second camera first
      for (const a of (await (await api.get(`api/v1/floors/${fl}/anchors`)).json()).anchors as { id: string; resource_id: string }[]) {
        if (a.resource_id === second.id) await api.delete(`api/v1/map-anchors/${a.id}`);
      }
      await open(page, `/explore/floors/${fl}/edit`);
      const ed = page.locator('sw-app explore-plan-editor');
      if (info.project.name === 'mobile') {
        // a phone gets the editor's reduced layout: record what it offers, place nothing when it has no camera tool
        await page.waitForTimeout(2500);
        await shot(page, 'editor-phone', info);
        await facts(page, info, 'editor-phone');
        test.skip((await ed.locator('button[data-tool="camera"]').count()) === 0, 'no camera tool in the plan editor at phone width');
      }
      await expect(ed.locator('button[data-tool="camera"]')).toBeVisible({ timeout: 30000 });
      await ed.locator('button[data-tool="camera"]').click();
      const item = ed.locator('.list button', { hasText: CAMS[1].name });
      await expect(item).toBeVisible({ timeout: 15000 });
      await item.click();
      await shot(page, 'editor-camera-tool', info);
      await facts(page, info, 'editor-camera-tool');
      const canvas = ed.locator('sw-plan-canvas');
      const box = (await canvas.boundingBox())!;
      await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.75);
      await expect.poll(async () => ((await (await api.get(`api/v1/floors/${fl}/anchors`)).json()).anchors as { resource_id: string }[]).some((a) => a.resource_id === second.id), { timeout: 15000 }).toBe(true);
      await page.waitForTimeout(800);
      await shot(page, 'editor-placed', info);
      await facts(page, info, 'editor-placed');
    });
  });

  // ---------------------------------------------------------------- a: no recorder, NO WebRTC server
  test.describe('a - no recorder and no WebRTC server', () => {
    test.skip(MODE !== 'a');

    test('the capability block and the server refusal', async () => {
      const me = await (await api.get('api/v1/me')).json();
      expect(me.capabilities).toMatchObject({ nvr: false, go2rtc: false, cameras_available: true, webrtc_server_configured: false });
      const add = await api.post('api/v1/cameras/standalone', { data: { name: 'x', main_url: 'rtsp://camera.example/x' } });
      expect(add.status()).toBe(409);
      expect((await add.json()).code).toBe('webrtc_server_required');
      const t = await api.post('api/v1/cameras/source/test', { data: { url: 'rtsp://camera.example/x', profile: 'main' } });
      expect(t.status()).toBe(409);
      expect((await t.json()).details?.settings_href).toBe('#/system/setup');
    });

    test('overview tile, wall panel and the camera screen say a WebRTC server is required, with the link', async ({ page }, info) => {
      await open(page, '/live');
      const tile = page.locator('sw-app [data-overview-tile="cameras"]');
      await expect(tile).toBeVisible({ timeout: 30000 });
      await expect(tile).toHaveAttribute('data-webrtc-required', '');
      await expect(tile).toHaveAttribute('href', '#/system/setup');
      await shot(page, 'overview', info);
      await facts(page, info, 'overview');

      await open(page, '/live/wall');
      await expect(page.locator('sw-app live-wall').getByText('נדרש שרת WebRTC', { exact: false }).first()).toBeVisible({ timeout: 30000 });
      await expect(page.locator('sw-app live-wall a[href="#/system/setup"], sw-app live-wall sw-button').first()).toBeVisible();
      await shot(page, 'wall', info);
      await facts(page, info, 'wall');

      const cam = (await standaloneCams()).find((c) => c.name === CAMS[0].name)!;
      await open(page, `/live/cameras/${cam.id}`);
      const notice = page.locator('sw-app live-camera [data-webrtc-required]');
      await expect(notice).toBeVisible({ timeout: 30000 });
      await expect(notice.locator('a[href="#/system/setup"]')).toBeVisible();
      await shot(page, 'camera', info);
      await facts(page, info, 'camera');
    });

    test('settings: add is disabled with the explanation; the source dialog cannot test', async ({ page }, info) => {
      await open(page, '/system/security/nvr');
      const card = page.locator('sw-app standalone-cameras-card');
      await expect(card.locator('[data-standalone-camera]')).toHaveCount(2, { timeout: 30000 });
      await expect(card.locator('[data-standalone-add] button')).toBeDisabled();
      await expect(card.locator('[data-webrtc-required]')).toBeVisible();
      // every row action stays on the screen (at 390 px the remove button ran off its left edge before EVIDENCE-CAMERAS-2412)
      for (const btn of await card.locator('[data-standalone-remove]').all()) {
        const r = (await btn.boundingBox())!;
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      }
      await shot(page, 'security-nvr', info);
      await facts(page, info, 'security-nvr');
      await card.locator('[data-standalone-edit]').first().click();
      const dlg = page.locator('sw-app camera-source-dialog[mode="edit"] [data-camera-source-dialog="edit"]');
      await expect(dlg.locator('.body').first()).toBeVisible({ timeout: 15000 });
      await expect(dlg.locator('[data-source-url="main"]')).toHaveValue(/\*\*\*/, { timeout: 15000 });
      await expect(dlg.locator('[data-source-test] button')).toBeDisabled();
      await expect(dlg.locator('[data-webrtc-required]')).toBeVisible();
      await shot(page, 'source-dialog', info);
      await facts(page, info, 'source-dialog');
    });
  });

  // ---------------------------------------------------------------- d: a recorder installation, the per-camera video source dialog
  test.describe('d - recorder installation: the video source dialog', () => {
    test.skip(MODE !== 'd');

    const PREVIEW = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="#5b6b7a"/><rect x="20" y="40" width="120" height="30" fill="#8fa3b5"/><circle cx="130" cy="22" r="10" fill="#e8d27a"/></svg>').toString('base64');

    async function nvrCamera(): Promise<{ id: string; name: string }> {
      const r = await (await api.get('api/v1/cameras')).json();
      const cams = (r.cameras as { id: string; name: string; recorder_id?: string; standalone?: boolean }[]).filter((c) => !c.standalone && c.recorder_id !== 'standalone');
      expect(cams.length, 'the recorder fixture has cameras').toBeGreaterThan(0);
      return cams[0];
    }

    test('recorder vs manual RTSP, the stream test result, masked credentials after saving', async ({ page }, info) => {
      const cam = await nvrCamera();
      // every width starts from the recorder source
      const cur = await (await api.get(`api/v1/cameras/${cam.id}/source`)).json();
      if (cur.mode !== 'nvr') expect((await api.put(`api/v1/cameras/${cam.id}/source`, { data: { mode: 'nvr', if_revision: cur.revision } })).status()).toBe(200);

      await open(page, `/live/cameras/${cam.id}`);
      const screen = page.locator('sw-app live-camera');
      await expect(screen).toBeVisible({ timeout: 30000 });
      await screen.locator('details[data-camera-settings] > summary').click();
      const acc = screen.locator('details[data-acc-source]');
      await expect(acc).toBeVisible({ timeout: 15000 });
      await acc.locator('summary').click();
      await acc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await shot(page, 'camera-source-row', info);
      await acc.locator('[data-camera-source-open]').click();
      const dlg = page.locator('sw-app camera-source-dialog [data-camera-source-dialog="edit"]');
      await expect(dlg.locator('[data-source-choice="nvr"]')).toBeVisible({ timeout: 15000 });
      await shot(page, 'source-dialog-recorder', info);
      await facts(page, info, 'source-dialog-recorder');

      await dlg.locator('[data-source-mode="manual"]').click();
      await dlg.locator('[data-source-url="main"]').fill('rtsp://viewer:fixture-pass@camera.example:554/Streaming/Channels/101');
      await dlg.locator('[data-source-url="sub"]').fill('rtsp://viewer:fixture-pass@camera.example:554/Streaming/Channels/102');
      await shot(page, 'source-dialog-manual', info);
      await facts(page, info, 'source-dialog-manual');

      // the real backend's answer for the placeholder address (the fake go2rtc has no such camera)
      await dlg.locator('[data-source-test]').click();
      await expect(dlg.locator('[data-source-test-result]')).toBeVisible({ timeout: 30000 });
      await shot(page, 'source-dialog-test-real', info);
      await facts(page, info, 'source-dialog-test-real');

      // a successful test as go2rtc reports it (browser-side answer: no real camera exists here)
      await page.route('**/api/v1/cameras/source/test', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, width: 1920, height: 1080, codec: 'h264', codec_label: 'H.264', preview: PREVIEW }) }));
      await dlg.locator('[data-source-url="main"]').fill('rtsp://viewer:fixture-pass@camera.example:554/Streaming/Channels/101');
      await dlg.locator('[data-source-test]').click();
      await expect(dlg.locator('[data-source-test-result="ok"]')).toBeVisible({ timeout: 15000 });
      await shot(page, 'source-dialog-test-ok', info);
      await facts(page, info, 'source-dialog-test-ok');
      await page.unroute('**/api/v1/cameras/source/test');

      await dlg.locator('[data-source-save]').click();
      await expect(page.locator('sw-app live-camera [data-camera-source-msg]')).toBeVisible({ timeout: 30000 });
      await shot(page, 'camera-source-saved', info);
      await page.locator('sw-app live-camera [data-camera-source-open]').click();
      await expect(dlg.locator('[data-source-url="main"]')).toHaveValue(/viewer:\*\*\*@/, { timeout: 15000 });
      const stored = await (await api.get(`api/v1/cameras/${cam.id}/source`)).json();
      expect(JSON.stringify(stored)).not.toContain('fixture-pass');
      await shot(page, 'source-dialog-masked', info);
      await facts(page, info, 'source-dialog-masked');
    });
  });
});
