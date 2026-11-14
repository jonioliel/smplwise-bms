import { test, expect, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLOOR, installPerfMock } from './perf-3d-mocks';

// PLAN3D-POLISH-2430: the 3D map polish round on the live floor map (mocked backend: perf-3d-mocks.ts, two levels of 4 x 3 named
// rooms with door sensors, thermometers, power meters, lamps and furniture - a dense floor).
//   1. the entity pills say what the rest of the UI says (a door sensor "פתוחה" / "סגורה", a thermometer its reading with the unit)
//   2. the overview presets frame the floor: the drawn building fills the stage (not ~half of it) at iso / perspective / top, also
//      after a resize and a level change; a zoom the person made stays across a resize
//   3. the room names are readable DOM plates (RTL, at least 13 px, the body ink) that never cover one another, a pill or a chip
//   5. the perspective preset has no sky arc across the top of the frame (the top rows of the canvas are one flat colour)
//   7. a lost WebGL context (WEBGL_lose_context) comes back and the view draws again (frames advance, pixels are not blank)
// SW_SHOTS=<tag> also writes the before / after pictures to evidence/PLAN3D-POLISH-2430/<tag>/ (day iso, night iso, perspective,
// schematic, dense lite); without it the shots test is skipped.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = process.env.SW_SHOTS ?? '';
const OUT = path.resolve(HERE, '..', '..', 'evidence', 'PLAN3D-POLISH-2430', SHOTS || 'none');

test.use({ viewport: { width: 1440, height: 900 } });

interface ViewProbe {
  view: {
    renderer: { domElement: HTMLCanvasElement; getContext: () => WebGLRenderingContext; info: { render: { calls: number } } };
    camera: { zoom?: number };
    benchFrames: (n?: number) => number;
    frameInsetFractions: () => { top: number; right: number; bottom: number; left: number };
  };
  selectedId: string | null;
  minFps: number;
  setNight(on: boolean): void;
}

async function open3d(page: Page, rung: string): Promise<Locator> {
  // PLAN3D-R28-UI-2433: this spec proves the POLISH entity pills and room-name plates, so it pins the display they belong to - one
  // pill per device (map.room_pills = device) and the levels as built (sw.plan3d.stack = closed). The round 28 defaults (one pill
  // per room, spread levels) take the plates and the device pills over by design; pixel-plan3d-r28-ui.spec.ts covers those.
  await page.addInitScript((r) => { try { localStorage.setItem('sw.plan3d.quality', r); localStorage.removeItem('sw.plan3d.night'); localStorage.setItem('sw.plan3d.stack', 'closed'); } catch { /* storage */ } }, rung);
  const mock = await installPerfMock(page, { install: 'auto', own: rung, settings: { 'map.room_pills': 'device' } });
  await page.goto(`/?design=a#/explore/floors/${FLOOR}`);
  const host = page.locator('explore-floor-map');
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 120_000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 120_000 });
  await expect.poll(() => mock.sockets, { timeout: 30_000 }).toBeGreaterThan(0);
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-floor-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 120_000 });
  await expect(el).toHaveAttribute('data-frames', /\d+/, { timeout: 120_000 });
  await el.evaluate((n) => { (n as unknown as ViewProbe).minFps = 0; });
  if (rung === 'lite' || rung === 'realistic') await expect.poll(() => el.evaluate((n) => (n as unknown as { view: { realPending: number } }).view.realPending), { timeout: 240_000 }).toBe(0);
  return el;
}

/** A few drawn frames after the last change (damping, labels). */
async function settle(el: Locator): Promise<void> {
  const f0 = Number(await el.getAttribute('data-frames'));
  await el.evaluate((n) => (n as unknown as { view: { invalidate: () => void } }).view.invalidate());
  await expect.poll(async () => Number(await el.getAttribute('data-frames')), { timeout: 30_000 }).toBeGreaterThan(f0);
  await el.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 400)))));
}

/** The share of the stage the drawn building covers: the bounding box of every canvas pixel that differs from the corner colour. */
const coverage = (el: Locator) =>
  el.evaluate((n) => {
    const v = (n as unknown as ViewProbe).view;
    v.benchFrames(0); // one frame drawn and finished now: the copy below reads it (the drawing buffer is not preserved)
    const canvas = v.renderer.domElement;
    const w = canvas.width;
    const h = canvas.height;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.drawImage(canvas, 0, 0);
    const d = g.getImageData(0, 0, w, h).data;
    const at = (x: number, y: number) => (y * w + x) * 4;
    const bg = [d[at(2, 2)], d[at(2, 2) + 1], d[at(2, 2) + 2], d[at(2, 2) + 3]];
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y += 2)
      for (let x = 0; x < w; x += 2) {
        const i = at(x, y);
        if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) + Math.abs(d[i + 3] - bg[3]) > 24) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    return x1 < 0 ? { fw: 0, fh: 0, area: 0, x0: 0, x1: 0, y0: 0, y1: 0 } : { fw: (x1 - x0) / w, fh: (y1 - y0) / h, area: ((x1 - x0) * (y1 - y0)) / (w * h), x0: x0 / w, x1: x1 / w, y0: y0 / h, y1: y1 / h };
  });

/** The drawn building against the free part of the stage (the stage less the overlay insets the view frames around): it stays
 * inside it (a few per cent of slack: the floor plate is drawn a little past the framed walls) and fills it on its limiting axis. */
async function expectFills(el: Locator, what: string): Promise<void> {
  const c = await coverage(el);
  const ins = await el.evaluate((n) => (n as unknown as ViewProbe).view.frameInsetFractions());
  const freeW = 1 - ins.left - ins.right;
  const freeH = 1 - ins.top - ins.bottom;
  const fill = Math.max(c.fw / freeW, c.fh / freeH);
  console.log(`fit ${what}: ${JSON.stringify({ ...c, insets: ins, fill })}`);
  const slack = 0.04;
  expect(c.x0, `${what}: left`).toBeGreaterThanOrEqual(ins.left - slack);
  expect(c.x1, `${what}: right`).toBeLessThanOrEqual(1 - ins.right + slack);
  expect(c.y0, `${what}: top`).toBeGreaterThanOrEqual(ins.top - slack);
  expect(c.y1, `${what}: bottom`).toBeLessThanOrEqual(1 - ins.bottom + slack);
  expect(fill, `${what}: fills the free part`).toBeGreaterThan(0.88);
}

test.describe('PLAN3D-POLISH-2430: the live floor map 3D polish (mocked backend)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'one desktop project: the framing and context checks are not per width'));

  test('shots (SW_SHOTS=<tag>): day iso, night iso, perspective, schematic, dense lite', async ({ page }) => {
    test.skip(!SHOTS, 'SW_SHOTS not set');
    test.setTimeout(600_000);
    fs.mkdirSync(OUT, { recursive: true });
    const el = await open3d(page, 'full');
    await el.locator('[data-preset-iso]').click();
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'day-iso.png') });
    await el.evaluate((n) => (n as unknown as ViewProbe).setNight(true));
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'night-iso.png') });
    await el.evaluate((n) => (n as unknown as ViewProbe).setNight(false));
    await el.locator('[data-preset-persp]').click();
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'perspective.png') });
    await el.locator('[data-quality-1]').click();
    await expect(el).toHaveAttribute('data-quality', '1');
    await el.locator('[data-preset-iso]').click();
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'schematic-iso.png') });
    await el.locator('[data-quality-3-lite]').click();
    await expect(el).toHaveAttribute('data-quality', '3');
    await expect.poll(() => el.evaluate((n) => (n as unknown as { view: { realPending: number } }).view.realPending), { timeout: 240_000 }).toBe(0);
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'dense-lite-iso.png') });
    await el.evaluate((n) => (n as unknown as ViewProbe).setNight(true));
    await el.evaluate((n) => (n as unknown as { setTimeHour: (h: number) => void }).setTimeHour(22));
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'night-lite-iso.png') });
    await el.evaluate((n) => (n as unknown as { setTimeHour: (h: number) => void }).setTimeHour(13));
    await el.evaluate((n) => (n as unknown as ViewProbe).setNight(false));
    await el.locator('[data-preset-persp]').click();
    await settle(el);
    await el.screenshot({ path: path.join(OUT, 'lite-perspective.png') });
    const calls = await el.evaluate((n) => (n as unknown as { view: { lastFrameInfo: { calls: number; triangles: number } } }).view.lastFrameInfo);
    fs.writeFileSync(path.join(OUT, 'lite-frame-info.json'), JSON.stringify(calls));
  });

  test('1: the pills read like the rest of the UI - door sensor open / closed, thermometer with its unit', async ({ page }) => {
    test.setTimeout(240_000);
    const el = await open3d(page, 'full');
    const chips = el.locator('[data-3d-label]');
    await expect.poll(() => chips.count(), { timeout: 30_000 }).toBeGreaterThan(0);
    // over the pill cap the overview shows the alerting pills (an open door, motion) and the selected one
    const pill = async (anchor: string, select: boolean) => {
      if (select) await el.evaluate((n, id) => { (n as unknown as ViewProbe).selectedId = id; }, anchor);
      const c = el.locator(`[data-3d-label="${anchor}"]`);
      await expect(c).toHaveCount(1);
      return (await c.textContent())?.trim() ?? '';
    };
    expect(await pill('an-L0-door-v1', false)).toBe('binary_sensor.L0_door_v1 · פתוחה');
    expect(await pill('an-L0-r01-motion', false)).toBe('binary_sensor.L0-r01_motion · תנועה');
    expect(await pill('an-L0-door-v2', true)).toBe('binary_sensor.L0_door_v2 · סגורה');
    expect(await pill('an-L0-r00-temp', true)).toBe('sensor.L0-r00_temp · 21 °C');
    const texts = await chips.allTextContents();
    expect(texts.some((t) => t.includes('דולק') && t.startsWith('binary_sensor.'))).toBe(false);
  });

  test('2: the overview presets fill the stage, after a resize and a level change too; a zoom the person made stays', async ({ page }) => {
    test.setTimeout(300_000);
    const el = await open3d(page, 'full');
    for (const preset of ['iso', 'persp', 'top'] as const) {
      await el.locator(`[data-preset-${preset}]`).click();
      await expect(el).toHaveAttribute('data-preset', preset);
      await settle(el);
      await expectFills(el, preset);
    }
    await el.locator('[data-preset-iso]').click();
    await settle(el);
    await page.setViewportSize({ width: 1100, height: 800 });
    await settle(el);
    await expectFills(el, 'iso after a resize');
    // a level change frames that level
    const chip = el.locator('.strip button').nth(1);
    if (await chip.count()) {
      await chip.click();
      await settle(el);
      await expectFills(el, 'iso after a level change');
    }
    // the person zooms: a resize keeps it (no re-fit over the person's camera)
    const box = (await el.locator('.stage canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await settle(el);
    const zoomed = await el.evaluate((n) => (n as unknown as ViewProbe).view.camera.zoom ?? 1);
    await page.setViewportSize({ width: 1300, height: 860 });
    await settle(el);
    const after = await el.evaluate((n) => (n as unknown as ViewProbe).view.camera.zoom ?? 1);
    expect(after).toBeCloseTo(zoomed, 5);
  });

  test('3: the room names are readable plates that cover neither one another nor a pill or a chip', async ({ page }) => {
    test.setTimeout(240_000);
    const el = await open3d(page, 'full');
    const rooms = el.locator('[data-3d-room]');
    await expect.poll(() => rooms.count(), { timeout: 30_000 }).toBe(12); // the top level's twelve rooms (every level shown)
    await settle(el);
    const boxes = await el.evaluate((n) => [...(n.shadowRoot ?? n).querySelectorAll<HTMLElement>('[data-3d-room], [data-3d-chip], [data-3d-label]')]
      .filter((e) => getComputedStyle(e).display !== 'none')
      .map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { room: e.hasAttribute('data-3d-room'), text: e.textContent ?? '', l: r.left, r: r.right, t: r.top, b: r.bottom, font: parseFloat(cs.fontSize), dir: cs.direction }; }));
    const plates = boxes.filter((b) => b.room);
    expect(plates.length).toBe(12);
    for (const p of plates) {
      expect(p.font, p.text).toBeGreaterThanOrEqual(13);
      expect(p.dir).toBe('rtl');
      expect(p.text).toMatch(/^חדר /);
    }
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a.room && !b.room) continue; // the pills among themselves: pill-layout's own spec
        if (a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1) overlaps.push(`${a.text} / ${b.text}`);
      }
    expect(overlaps).toEqual([]);
  });

  test('5: the perspective preset draws no sky arc across the top of the frame', async ({ page }) => {
    test.setTimeout(300_000);
    for (const rung of ['full', 'lite']) {
      if (rung === 'lite') {
        await page.goto('about:blank');
      }
      const el = await open3d(page, rung);
      await el.locator('[data-preset-persp]').click();
      await expect(el).toHaveAttribute('data-preset', 'persp');
      await settle(el);
      // the top band of the frame: every row is one flat colour (a curved sky / ground edge would show as a row with a step)
      const rows = await el.evaluate((n) => {
        const v = (n as unknown as ViewProbe).view;
        v.benchFrames(0);
        const canvas = v.renderer.domElement;
        const c = document.createElement('canvas');
        c.width = canvas.width;
        c.height = canvas.height;
        const g = c.getContext('2d')!;
        g.drawImage(canvas, 0, 0);
        const band = Math.floor(canvas.height * 0.06);
        const out: number[] = [];
        for (let y = 0; y < band; y += 2) {
          const d = g.getImageData(0, y, canvas.width, 1).data;
          let lo = 255 * 3, hi = 0;
          for (let x = 0; x < canvas.width; x += 4) {
            const s = d[x * 4] + d[x * 4 + 1] + d[x * 4 + 2];
            lo = Math.min(lo, s);
            hi = Math.max(hi, s);
          }
          out.push(hi - lo);
        }
        return out;
      });
      console.log(`sky band ${rung}: max row spread ${Math.max(...rows)}`);
      expect(Math.max(...rows), `${rung}: a flat sky band`).toBeLessThan(40);
    }
  });

  test('6: the glow pool leaves the scene at an unlit schematic level and comes back at the lit levels', async ({ page }) => {
    test.setTimeout(240_000);
    const el = await open3d(page, 'full');
    const pool = () => el.evaluate((n) => (n as unknown as { view: { glowLightsInScene: number } }).view.glowLightsInScene);
    expect(await pool()).toBe(8);
    await el.locator('[data-quality-1]').click();
    await expect(el).toHaveAttribute('data-quality', '1');
    // the mock's lit lamps are object bodies: whether a glow holds a light decides; with none lit the pool is gone
    const lit = await el.evaluate((n) => ((n as unknown as { description: { parts: { kind: string }[] } }).description.parts.filter((p) => p.kind === 'glow').length));
    expect(await pool()).toBe(lit > 0 ? 8 : 0);
    // an unlit schematic floor: every light state off -> no pool lights
    await el.evaluate((n) => {
      const e = n as unknown as { description: { parts: { kind: string }[] } };
      e.description = { ...e.description, parts: e.description.parts.filter((p) => p.kind !== 'glow') } as typeof e.description;
    });
    await expect.poll(pool).toBe(0);
    await el.locator('[data-quality-2]').click();
    await expect(el).toHaveAttribute('data-quality', '2');
    await expect.poll(pool).toBe(8);
  });

  test('7: a lost WebGL context comes back and the view draws again', async ({ page }) => {
    test.setTimeout(300_000);
    for (const rung of ['full', 'lite']) {
      if (rung === 'lite') await page.goto('about:blank');
      const el = await open3d(page, rung);
      await settle(el);
      const lost = await el.evaluate(async (n) => {
        const v = (n as unknown as ViewProbe).view;
        const canvas = v.renderer.domElement;
        const ext = v.renderer.getContext().getExtension('WEBGL_lose_context');
        if (!ext) return 'no-extension';
        const gone = new Promise<void>((r) => canvas.addEventListener('webglcontextlost', () => r(), { once: true }));
        const back = new Promise<void>((r) => canvas.addEventListener('webglcontextrestored', () => r(), { once: true }));
        ext.loseContext();
        await gone;
        await new Promise((r) => setTimeout(r, 300));
        ext.restoreContext();
        await back;
        return 'restored';
      });
      expect(lost).toBe('restored');
      await settle(el);
      await el.locator('[data-preset-persp]').click();
      await settle(el);
      const c = await coverage(el);
      console.log(`context restore ${rung}: ${JSON.stringify(c)}`);
      expect(c.area, `${rung}: the scene is drawn again`).toBeGreaterThan(0.2);
      // a frame drawn after the restore raises no GL error (the restore itself may leave one behind: cleared first)
      const errors = await el.evaluate((n) => {
        const v = (n as unknown as ViewProbe).view;
        const gl = v.renderer.getContext();
        while (gl.getError() !== gl.NO_ERROR) { /* clear the flags the restore left */ }
        v.benchFrames(2);
        return gl.getError();
      });
      expect(errors).toBe(0);
      if (rung === 'lite') {
        // the realistic chain is back: the post chain and the prefiltered environment were built again
        const rebuilt = () => el.evaluate((n) => { const v = (n as unknown as { view: { post: unknown; envTarget: unknown; restoredCount: number } }).view; return { post: !!v.post, env: !!v.envTarget, restored: v.restoredCount }; });
        await expect.poll(rebuilt, { timeout: 30_000 }).toEqual({ post: true, env: true, restored: 1 });
        if (SHOTS) {
          fs.mkdirSync(OUT, { recursive: true });
          await settle(el);
          await el.screenshot({ path: path.join(OUT, 'lite-after-context-restore.png') });
        }
      }
    }
  });
});
