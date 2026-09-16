import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for the read-only half of T045 / T012 against the running developer backend and the lab NVR: the camera
// page shows PTZ / presets / two-way audio as the device reports them (supported, unsupported with the device's
// reason, disabled, unknown) and offers no fake control; the API has no write route for any of them. SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T045-capabilities-live');

test.describe('camera capability facts (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('PTZ, presets and audio states come from the NVR and nothing is simulated', async ({ page, request }, testInfo) => {
    test.setTimeout(120_000);
    const cams = (await (await request.get('/api/v1/cameras')).json()).cameras.filter((c: { status: string }) => c.status === 'online');
    test.skip(cams.length < 1, 'need an online camera');
    const cam = cams[0];
    const caps = await (await request.get(`/api/v1/cameras/${cam.id}/capabilities?refresh=true`)).json();
    testInfo.annotations.push({ type: 'capabilities', description: JSON.stringify({ ptz: caps.ptz, audio: caps.audio, writes: caps.writes }) });
    expect(caps.read_only).toBe(true);
    expect(['supported', 'unsupported', 'unknown']).toContain(caps.ptz.state);
    expect(['available', 'disabled', 'unsupported', 'unknown']).toContain(caps.audio.state);
    expect(caps.writes.ptz_move).toBe('not_offered');
    expect((await (await request.get(`/api/v1/cameras/${cam.id}/capabilities`)).json()).cached).toBe(true);
    await page.goto(`/#/live/cameras/${cam.id}`);
    await page.waitForSelector('sw-app');
    const strip = page.locator('live-camera [data-caps]');
    await expect(strip).toHaveAttribute('data-ptz', caps.ptz.state, { timeout: 30_000 });
    await expect(strip).toHaveAttribute('data-audio', caps.audio.state);
    await expect(strip).toContainText('אין פקד מדומה');
    await page.screenshot({ path: path.join(OUT, `capabilities-${testInfo.project.name}.png`) });
    // no write path exists
    for (const p of [`/api/v1/cameras/${cam.id}/ptz`, `/api/v1/cameras/${cam.id}/presets/1/recall`, `/api/v1/cameras/${cam.id}/talk`]) {
      expect([404, 405]).toContain((await request.post(p, { data: {} })).status());
    }
  });
});
