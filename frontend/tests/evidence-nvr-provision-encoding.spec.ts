import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { install, newMock, stream, type Mock } from './nvr-cameras-write-mock';

// CR-025 NN2B evidence: a Provision-ISR recorder's cameras in הגדרות › אבטחה › מצלמות - the same table, the same editor drawer, the same
// confirmation as the Hikvision recorder, with the vendor-specific part carried as DATA: no SVC switch (the stream has no SVC element), no B-frame
// field, the 1..5 quality scale, the bit-rate / GOP bounds the device published, and a stream the NVR does not pass writes to (R2) disabled with
// its reason while the camera's other stream stays editable. API mode against the stateful mocked backend (tests/nvr-cameras-write-mock.ts,
// `provision: true`): no device. The server's own checks are tests/test_provision_encoding_write.py (fake Provision device).
// Run on the runner: `~/run_remote.sh spec <branch> tests/evidence-nvr-provision-encoding.spec.ts` (desktop / tablet / mobile projects).
// Screenshots: SW_SHOTS=../docs/design/evidence/cr025.
const SHOTS = process.env.SW_SHOTS ?? '';
const PAGE = 'sw-app system-security system-security-cameras';
const CONFIRM = 'sw-dialog[open][data-nvr-confirm-dialog]';

const phone = (page: Page) => (page.viewportSize()?.width ?? 1440) < 768;
const scope = (page: Page) => `${PAGE} ${phone(page) ? '[data-nvr-cards]' : '[data-nvr-table]'}`;
const rowOf = (page: Page, ch: number, ref: string): Locator => page.locator(`${scope(page)} ${phone(page) ? '[data-stream-card]' : 'tr[data-stream-row]'}[data-camera="nvr-1:${ch}"][data-stream="${ref}"]`);

async function shot(page: Page, name: string) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: path.join(SHOTS, `${name}-${test.info().project.name}.png`) });
}

const PROV = { codec: 'H.265', codec_raw: 'h265', profile: 'main', quality: 4, gop: 50, bitrate_kbps: 3072, webrtc: 'unknown', webrtc_reason: 'h265' };

function provisionCameras(): Record<string, unknown>[] {
  const cam = (ch: number, name: string, streams: Record<string, unknown>[]) => ({
    camera_id: `cam-${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: true, enabled_in_arx: true, streams, error: null,
  });
  return [
    cam(1, 'כניסה', [
      stream('101', 'main', { ...PROV, resolution: '2592x1520', fps: 25 }),
      stream('102', 'sub', { ...PROV, codec: 'H.264', codec_raw: 'h264', profile: 'baseline', resolution: '704x576', fps: 6, bitrate_mode: 'CBR', bitrate_kbps: 512, quality: null, gop: 12, webrtc_reason: 'b_frames_unknown' }),
    ]),
    cam(2, 'חניה', [
      stream('201', 'main', { ...PROV, resolution: '1920x1080', fps: 25 }),
      stream('202', 'sub', { ...PROV, codec: 'H.264', codec_raw: 'h264', profile: 'baseline', resolution: '704x576', fps: 6, bitrate_mode: 'CBR', bitrate_kbps: 512, quality: null, gop: 12 }),
    ]),
  ];
}

async function open(page: Page) {
  await page.goto('about:blank');
  await page.goto('/?design=a#/system/security/cameras');
  await page.waitForSelector('sw-app');
  await expect(page.locator(`${PAGE} [data-nvr-cameras]`)).toHaveAttribute('data-state', 'ready');
}

test.describe('CR-025 NN2B Provision encoding editor (mocked backend)', () => {
  let st: Mock;

  test.beforeEach(async ({ page }) => {
    st = newMock();
    st.provision = true;
    st.cameras = provisionCameras();
    st.refused = ['201']; // R2: the NVR does not pass writes to camera 2's main stream
    await install(page, st);
  });

  test('no SVC switch anywhere; the pencil is enabled on a writable stream and disabled, with the reason, on a refused one', async ({ page }) => {
    await open(page);
    await expect(page.locator(`${PAGE} sw-toggle[data-svc-toggle]`)).toHaveCount(0);
    const ok = rowOf(page, 1, '101').locator('button[data-edit-stream]');
    await expect(ok).toBeEnabled();
    const refused = rowOf(page, 2, '201').locator('button[data-edit-stream]');
    await expect(refused).toBeDisabled();
    await expect(refused).toHaveAttribute('title', 'ה־NVR אינו מעביר שינויים למצלמה הזו');
    await expect(rowOf(page, 2, '202').locator('button[data-edit-stream]')).toBeEnabled();
    await shot(page, 'provision-enc-01-table');
  });

  test('the editor offers the Provision fields only - no SVC, no B-frames - with the device bounds and the 1..5 quality scale', async ({ page }) => {
    await open(page);
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const drawer = page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`);
    await expect(drawer).toBeVisible();
    const field = (f: string) => drawer.locator(`[data-field="${f}"]`);
    for (const f of ['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'smart_codec']) await expect(field(f)).toHaveCount(1);
    for (const f of ['svc', 'b_frames']) await expect(field(f)).toHaveCount(0);
    await expect(field('quality').locator('select option')).toHaveCount(6); // "leave as is" + 1..5
    await shot(page, 'provision-enc-02-editor');
    // layout guard (this screen's own box): inside the viewport, no horizontal scroll, controls inside the panel
    const bad = await drawer.evaluate((el) => {
      const out: string[] = [];
      const r = el.shadowRoot!.querySelector('dialog')!.getBoundingClientRect();
      if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.bottom > innerHeight + 0.5) out.push('panel outside the viewport');
      const body = el.shadowRoot!.querySelector('.body') as HTMLElement;
      if (body.scrollWidth > body.clientWidth + 1) out.push('body scrolls horizontally');
      return out;
    });
    expect(bad).toEqual([]);
  });

  test('a change: ONE confirmation with the count, then the request carries only the changed fields', async ({ page }) => {
    await open(page);
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const drawer = page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`);
    await drawer.locator('[data-field="gop"] input').fill('60');
    await drawer.locator('[data-field="quality"] select').selectOption('5');
    await drawer.locator('[data-nvr-editor-save]').click();
    const dlg = page.locator(CONFIRM);
    await expect(dlg.locator('[data-nvr-confirm-count]')).toHaveText('2 שינויים');
    expect(st.writes).toEqual([]);
    await shot(page, 'provision-enc-03-confirm');
    await dlg.locator('[data-nvr-confirm]').click();
    await expect(drawer).toHaveCount(0);
    expect(st.writes).toHaveLength(1);
    expect(st.writes[0].body).toEqual({ if_match: '101e1', confirm: true, changes: { gop: 60, quality: 5 } });
  });

  test('a GOP below the device minimum is refused on the screen before any request', async ({ page }) => {
    await open(page);
    await rowOf(page, 1, '101').locator('button[data-edit-stream]').click();
    const drawer = page.locator(`${PAGE} nvr-camera-editor sw-drawer[open]`);
    await drawer.locator('[data-field="gop"] input').fill('5');
    await expect(drawer.locator('[data-nvr-editor-save]')).toHaveAttribute('disabled', '');
    expect(st.writes).toEqual([]);
  });
});
