import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Evidence for T066 against the running developer backend and the lab NVR: slow motion really slows the source time
// (the position advances at ~0.5× wall time at ×0.5 and at ~1× at 1×), frame stepping while paused moves the
// position by one frame inside the buffered media, and the speeds the source cannot deliver (2×, 4×) stay
// disabled with the reason. Real Chrome (SW_CHROME=1), SW_LIVE=1 only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, '..', '..', 'private-evidence', 'T066-speeds-live');

const DEEP = `const deep = (root, sel) => { const r = root.querySelector(sel); if (r) return r; for (const el of root.querySelectorAll('*')) { if (el.shadowRoot) { const f = deep(el.shadowRoot, sel); if (f) return f; } } return null; };`;

interface View {
  status: string;
  position: number | null;
  paused: boolean;
  rate: number | null;
  mediaTime: number | null;
  bufferAhead: number | null;
  speeds: { speed: string; disabled: boolean; title: string; on: boolean }[];
}

const view = (page: Page): Promise<View> =>
  page.evaluate(`(() => { ${DEEP} const s = deep(document, 'investigate-playback'); const p = deep(s.shadowRoot, 'sw-live-player');
    return { status: s.tileStatus[s.cameraId] ?? '', position: s.position ? s.position.getTime() : null, paused: s.paused, rate: p ? p.rate : null, mediaTime: p ? p.mediaTime : null, bufferAhead: p ? p.bufferAhead : null,
      speeds: Array.from(s.shadowRoot.querySelectorAll('[data-speed]')).map((b) => ({ speed: b.dataset.speed, disabled: b.disabled, title: b.title, on: b.classList.contains('on') })) }; })()`);

const click = (page: Page, sel: string) => page.evaluate(`(() => { ${DEEP} const s = deep(document, 'investigate-playback'); const b = s.shadowRoot.querySelector('${sel}'); if (!b) return false; b.click(); return true; })()`);

test.describe('playback speeds and frame stepping (SW A)', () => {
  test.skip(process.env.SW_LIVE !== '1', 'set SW_LIVE=1 with the backend running');

  test('slow motion keeps the source time honest, frame step moves one frame, faster speeds stay disabled', async ({ page, request }, testInfo) => {
    test.setTimeout(240_000);
    // release this user's playback sessions first (quota)
    const mine = (await (await request.get('/api/v1/playback/sessions')).json()).sessions as { id: string }[];
    for (const s of mine) await request.delete(`/api/v1/playback/sessions/${s.id}`).catch(() => undefined);
    // a moment that certainly has a recording: a motion event derived from today's recordings
    const ev = ((await (await request.get('/api/v1/events?type=motion&limit=5')).json()).events as { camera_id: string; occurred_at: string }[]).find((e) => e.camera_id);
    expect(ev, 'a motion event with a camera').toBeTruthy();
    const at = new Date(new Date(ev!.occurred_at).getTime() - 20_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    await page.goto(`/?design=a#/investigate/playback?camera=${ev!.camera_id}&t=${at}`);
    await page.waitForSelector('investigate-playback');
    await expect.poll(async () => (await view(page)).status, { timeout: 60_000 }).toBe('playing');
    await page.waitForTimeout(4000); // let the buffer fill a little
    const v0 = await view(page);
    expect(v0.speeds.map((s) => s.speed)).toEqual(['0.25', '0.5', '1', '2', '4']);
    const fast = v0.speeds.filter((s) => Number(s.speed) > 1);
    expect(fast.every((s) => s.disabled && /זמן אמת/.test(s.title))).toBe(true);
    expect(v0.speeds.find((s) => s.speed === '0.5')?.disabled).toBe(false);

    // ×0.5: the position advances at about half the wall time
    expect(await click(page, '[data-speed="0.5"]')).toBe(true);
    await page.waitForTimeout(500);
    const a = await view(page);
    expect(a.rate).toBeCloseTo(0.5, 2);
    const t0 = Date.now();
    await page.waitForTimeout(6000);
    const b = await view(page);
    const slowRatio = (b.position! - a.position!) / (Date.now() - t0);
    testInfo.annotations.push({ type: 'slow-motion', description: `×0.5 for 6 s: source advanced ${((b.position! - a.position!) / 1000).toFixed(2)} s (ratio ${slowRatio.toFixed(2)}), buffer ahead ${b.bufferAhead?.toFixed(1)} s` });
    expect(slowRatio).toBeGreaterThan(0.3);
    expect(slowRatio).toBeLessThan(0.7);
    await page.screenshot({ path: path.join(OUT, `slow-motion-${testInfo.project.name}.png`) });

    // back to 1×: about real time
    expect(await click(page, '[data-speed="1"]')).toBe(true);
    await page.waitForTimeout(500);
    const c = await view(page);
    expect(c.rate).toBeCloseTo(1, 2);
    const t1 = Date.now();
    await page.waitForTimeout(5000);
    const d = await view(page);
    const realRatio = (d.position! - c.position!) / (Date.now() - t1);
    testInfo.annotations.push({ type: 'real-time', description: `1× for 5 s: ratio ${realRatio.toFixed(2)}` });
    expect(realRatio).toBeGreaterThan(0.75);
    expect(realRatio).toBeLessThan(1.3);

    // pause, then step five frames forward and five back inside the buffer
    expect(await click(page, '[data-pause]')).toBe(true);
    await page.waitForTimeout(1500); // paused: the relay keeps sending, the buffer ahead grows
    const p0 = await view(page);
    expect(p0.paused).toBe(true);
    for (let i = 0; i < 5; i++) {
      expect(await click(page, '[data-frame-step="1"]')).toBe(true);
      await page.waitForTimeout(250);
    }
    const p1 = await view(page);
    const stepped = (p1.mediaTime! - p0.mediaTime!) * 1000;
    testInfo.annotations.push({ type: 'frame-step', description: `5 frames forward moved the media time by ${stepped.toFixed(0)} ms; position by ${(p1.position! - p0.position!).toFixed(0)} ms` });
    expect(stepped).toBeGreaterThan(100);
    expect(stepped).toBeLessThan(600);
    expect(p1.position! - p0.position!).toBeGreaterThan(100);
    for (let i = 0; i < 5; i++) {
      expect(await click(page, '[data-frame-step="-1"]')).toBe(true);
      await page.waitForTimeout(250);
    }
    const p2 = await view(page);
    expect(Math.abs(p2.mediaTime! - p0.mediaTime!) * 1000).toBeLessThan(60);
    expect(p2.paused).toBe(true);
    await page.screenshot({ path: path.join(OUT, `frame-step-${testInfo.project.name}.png`) });
    // release
    const left = (await (await request.get('/api/v1/playback/sessions')).json()).sessions as { id: string }[];
    for (const s of left) await request.delete(`/api/v1/playback/sessions/${s.id}`).catch(() => undefined);
  });
});
