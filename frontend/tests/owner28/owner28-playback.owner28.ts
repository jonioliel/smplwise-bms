import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WISKEY-ADOPT-2272: the WisKey owner28 playback spec (delivery frontend/tests/owner28-playback.spec.ts), adopted: same steps and
// assertions, paths inside this folder (the synthetic H.264 clip is the delivered 06_media/synthetic-video.mp4, sha256 08a75da5...).
const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIDEO = fs.readFileSync(path.join(HERE, 'synthetic-video.mp4'));

type Win = Window & { __audio: (AudioContext & { __analyser?: AnalyserNode })[] };

test('MSE video renders beside the listen WebAudio player; mute and the terminal clean up', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const Original = window.AudioContext;
    const w = window as unknown as Win;
    w.__audio = [];
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext = class extends Original {
      constructor() {
        super();
        w.__audio.push(this);
      }
      createGain() {
        const gain = super.createGain();
        const analyser = this.createAnalyser();
        gain.connect(analyser);
        (this as AudioContext & { __analyser?: AnalyserNode }).__analyser = analyser;
        return gain;
      }
    };
  });
  await page.route('**/api/v1/access-control/stations/synthetic-station/listen', async (route) => {
    const reply = route.request().method() === 'GET'
      ? { station_id: 'synthetic-station', available: true, reason: null, codec: 'pcmu', sample_rate: 8000, frame_ms: 20, max_seconds: 30, listeners: 0 }
      : { session: 'synthetic-listen-session', ws_path: 'api/v1/synthetic/listen', expires_at: new Date(Date.now() + 30000).toISOString(), max_seconds: 30,
          attach_within_s: 15, codec: 'pcmu', sample_rate: 8000, frame_ms: 20, request_id: 'synthetic-request' };
    await route.fulfill({ json: reply });
  });
  await page.routeWebSocket('**/api/v1/synthetic/video', (ws) => {
    ws.onMessage((m) => {
      if (typeof m === 'string' && JSON.parse(m).type === 'mse') {
        ws.send(JSON.stringify({ type: 'mse', value: 'video/mp4; codecs="avc1.42c00a"' }));
        ws.send(VIDEO);
      }
    });
  });
  let audioSocket: { send(m: string | Buffer): void } | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  await page.routeWebSocket('**/api/v1/synthetic/listen', (ws) => {
    audioSocket = ws;
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'listen/state', value: 'open' }));
      const tone = Buffer.from(Array.from({ length: 160 }, (_, i) => (i % 16 < 8 ? 0x80 : 0x00)));
      timer = setInterval(() => ws.send(tone), 20);
    }, 50);
    ws.onClose(() => { if (timer) clearInterval(timer); });
    ws.onMessage(() => { if (timer) clearInterval(timer); ws.close(); });
  });
  await page.goto('/tests/owner28/owner28-harness.html');
  const videoElement = page.locator('sw-live-player video');
  await expect.poll(() => videoElement.evaluate((v: HTMLVideoElement) => ({ w: v.videoWidth, t: v.currentTime }))).toMatchObject({ w: 160 });
  await expect.poll(() => videoElement.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.1);
  const listen = page.locator('[data-wk-listen-toggle]');
  await expect(listen).toBeVisible();
  await listen.click();
  const rms = () => page.evaluate(() => {
    const ctx = (window as unknown as Win).__audio[0];
    if (!ctx?.__analyser) return 0;
    const data = new Float32Array(ctx.__analyser.fftSize);
    ctx.__analyser.getFloatTimeDomainData(data);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
  });
  await expect.poll(rms).toBeGreaterThan(0.01);
  await page.locator('[data-wk-listen-mute]').click();
  await expect.poll(rms).toBeLessThan(0.001);
  await page.locator('[data-wk-listen-mute]').click();
  await expect.poll(rms).toBeGreaterThan(0.01);
  await page.screenshot({ path: info.outputPath(`MSE_LISTEN_${info.project.name}.png`) });
  if (timer) clearInterval(timer);
  audioSocket?.send(JSON.stringify({ type: 'listen/closed', value: 'expired' }));
  await expect.poll(() => page.evaluate(() => (window as unknown as Win).__audio[0]?.state)).toBe('closed');
  expect(errors).toEqual([]);
});
