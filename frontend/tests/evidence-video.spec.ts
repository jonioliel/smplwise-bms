import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T017 (live video through the add-on relay + go2rtc) and T015/T016 settings/snapshots against the
// running developer backend. Runs only when SW_LIVE=1. Real camera frames are customer data: output stays in the
// gitignored private-evidence/. Video decoding needs proprietary codecs, so the run uses the installed Google
// Chrome when SW_CHROME=1 (see playwright.config.ts) — Playwright's bundled Chromium has no H.264.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T017-live');

const DEEP = `const deep = (root, sel) => { const r = root.querySelector(sel); if (r) return r; for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; } } return null; };
const all = (root, sel, out = []) => { out.push(...root.querySelectorAll(sel)); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) all(el.shadowRoot, sel, out); return out; };`;

interface PlayerState {
  cameraId: string;
  profile: string;
  status: string;
  transport: string;
  error: string;
  width: number;
}

async function players(page: Page): Promise<PlayerState[]> {
  return page.evaluate(`(() => { ${DEEP} return all(document, 'sw-live-player').map(p => ({cameraId: p.cameraId, profile: p.profile, status: p.status, transport: p.transport, error: p.error, width: p.shadowRoot.querySelector('video').videoWidth})); })()`);
}

async function waitPlaying(page: Page, count: number, timeoutMs: number): Promise<PlayerState[]> {
  const deadline = Date.now() + timeoutMs;
  let last: PlayerState[] = [];
  while (Date.now() < deadline) {
    last = await players(page);
    if (last.filter((p) => p.status === 'playing' && p.width > 0).length >= count) return last;
    await page.waitForTimeout(1000);
  }
  return last;
}

test.describe('live video evidence', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('snapshots, settings, sessions API', async ({ request }) => {
    const cams = await (await request.get('/api/v1/cameras')).json();
    expect(cams.cameras.length).toBeGreaterThan(0);
    const cam = cams.cameras.find((c: { status: string }) => c.status === 'online') ?? cams.cameras[0];
    const snap = await request.get(`/api/v1/cameras/${cam.id}/snapshot.jpg`);
    expect(snap.ok()).toBeTruthy();
    expect(snap.headers()['content-type']).toBe('image/jpeg');
    const settings = await (await request.get('/api/v1/settings')).json();
    expect(['auto', 'webrtc', 'mse']).toContain(settings.settings['media.transport_default']);
    const info = await (await request.get(`/api/v1/media/live/${cam.id}?profile=sub`)).json();
    expect(info.ws_path).toContain(`/media/live/${cam.id}/ws`);
    expect(info.media_configured).toBeTruthy();
    const streams = await (await request.get('/api/v1/media/streams')).json();
    expect(streams.streams.every((s: { name: string }) => s.name.startsWith('smplwise_'))).toBeTruthy();
  });

  test('camera screen: auto transport plays (WebRTC or MSE fallback)', async ({ page, request }, testInfo) => {
    const cams = await (await request.get('/api/v1/cameras')).json();
    const cam = cams.cameras.find((c: { status: string }) => c.status === 'online') ?? cams.cameras[0];
    await page.goto(`/#/live/cameras/${cam.id}`);
    await page.waitForSelector('sw-app');
    const state = await waitPlaying(page, 1, 45000);
    await page.evaluate(`${DEEP} const g = deep(document, '.controls'); g && g.scrollIntoView({block: 'end'});`);
    await page.screenshot({ path: path.join(OUT, `camera-${testInfo.project.name}.png`) });
    testInfo.annotations.push({ type: 'player', description: JSON.stringify(state) });
    expect(state[0]?.status, JSON.stringify(state)).toBe('playing');
    expect(['webrtc', 'mse']).toContain(state[0].transport);
  });

  test('wall: four sub-profile tiles play', async ({ page }, testInfo) => {
    await page.goto('/#/live/wall');
    await page.waitForSelector('sw-app');
    const state = await waitPlaying(page, 4, 60000);
    await page.screenshot({ path: path.join(OUT, `wall-${testInfo.project.name}.png`) });
    testInfo.annotations.push({ type: 'players', description: JSON.stringify(state) });
    expect(state.filter((p) => p.status === 'playing' && p.width > 0).length, JSON.stringify(state)).toBeGreaterThanOrEqual(Math.min(4, state.length));
  });

  test('settings media tab and kiosk render against the API', async ({ page }, testInfo) => {
    await page.goto('/#/system/settings');
    await page.waitForSelector('sw-app');
    await page.waitForTimeout(1200);
    await page.evaluate(`${DEEP} const t = all(deep(document, 'sw-tabs').shadowRoot, 'button').find(b => b.textContent.includes('וידאו')); t && t.click();`);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(OUT, `settings-media-${testInfo.project.name}.png`) });
    await expect(page.locator('system-diagnostics')).toContainText('go2rtc');

    await page.goto('/#/kiosk/all');
    await page.waitForSelector('kiosk-wall');
    await waitPlaying(page, 2, 45000);
    await page.screenshot({ path: path.join(OUT, `kiosk-${testInfo.project.name}.png`) });
  });
});
