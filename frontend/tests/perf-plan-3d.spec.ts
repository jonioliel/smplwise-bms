import { test, expect, type CDPSession, type Locator, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { FLOOR, HOUSE, installPerfMock, powerMeters } from './perf-3d-mocks';

// PERF3D-295: the repeatable performance harness of the live floor map's 3D view on a phone-sized screen. One run opens the
// generated house (perf-3d-mocks.ts: 2 levels x 12 rooms, ~170 objects, ~110 HA entities) at a fixed rung, under CPU throttling
// (Chrome DevTools protocol, 4x by default), at 390 x 844 CSS px and device pixel ratio 3, and measures:
//   load      - toggle click to the element ready, to the first drawn frame, to every level thumbnail; long tasks meanwhile
//   rotate    - a one-finger drag (CDP touch events) for ~2 s: frame intervals the page saw (rAF), the scene frames drawn and their
//               main-thread cost (SceneView.frame wrapped), layout / style recalcs (CDP Performance metrics), long tasks
//   zoom      - a two-finger pinch out and in for ~2 s: the same numbers
//   idle      - 5 s untouched: frames, Lit updates, layouts (should all be ~0)
//   live      - 12 power-meter pushes over the mocked HA socket, 400 ms apart (a home's meters tick): full scene rebuilds,
//               main-thread time, long tasks, Lit updates of the 3D element, the host and the hidden 2D canvas
//   static    - draw calls / triangles of one frame, geometries / textures / programs, the drawing buffer, the shadow map, the
//               thumbnail bytes, DOM elements (the whole page, the 3D element's shadow root), the JS heap
// Every number is RELATIVE: the machine is shared and the GPU is a software one (SwiftShader) in headless Chromium, so GPU cost
// is not a phone's - compare a before and an after from the same harness, in the same conditions, three runs each.
//
//   SW_BASE_URL=http://127.0.0.1:<vite>/ PERF_RUNG=full PERF_OUT=<dir> npx playwright test tests/perf-plan-3d.spec.ts --project=mobile --workers=1
// PERF_RUNG: schematic | full | lite | realistic (default full). PERF_CPU: the throttling rate (default 4). PERF_RUNS: runs in one
// invocation (default 1). PERF_TRACE=1 also records a DevTools trace of the zoom phase into PERF_OUT (a summary goes into the JSON).

const RUNG = (process.env.PERF_RUNG ?? 'full') as 'schematic' | 'full' | 'lite' | 'realistic';
const CPU = Number(process.env.PERF_CPU ?? 4);
const RUNS = Number(process.env.PERF_RUNS ?? 1);
const OUT = process.env.PERF_OUT ?? '';
const TRACE = process.env.PERF_TRACE === '1';
const LABEL = process.env.PERF_LABEL ?? 'run';
/** Touch moves per gesture (each waits for the page: a slow frame stretches the gesture, the count stays). */
const STEPS = Number(process.env.PERF_STEPS ?? 60);

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

interface Win {
  __perf: {
    long: { start: number; dur: number }[];
    raf: number[];
    rafOn: boolean;
    sceneFrames: number[];
    updates: Record<string, number>;
    overlayMs: number[];
  };
}
type Metrics = Record<string, number>;

const PICK = ['LayoutCount', 'RecalcStyleCount', 'LayoutDuration', 'RecalcStyleDuration', 'ScriptDuration', 'TaskDuration', 'JSHeapUsedSize', 'Nodes'];
async function metrics(cdp: CDPSession): Promise<Metrics> {
  const { metrics: m } = (await cdp.send('Performance.getMetrics')) as { metrics: { name: string; value: number }[] };
  const out: Metrics = {};
  for (const { name, value } of m) if (PICK.includes(name)) out[name] = value;
  return out;
}
const delta = (a: Metrics, b: Metrics): Metrics => {
  const out: Metrics = {};
  for (const k of PICK) if (k !== 'JSHeapUsedSize' && k !== 'Nodes') out[k] = Math.round(((b[k] ?? 0) - (a[k] ?? 0)) * (k.endsWith('Duration') ? 1000 : 1) * 10) / 10; // durations in ms
  return out;
};

const pct = (xs: number[], p: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] * 10) / 10;
};
const sum = (xs: number[]): number => Math.round(xs.reduce((a, b) => a + b, 0) * 10) / 10;

/** Counters installed before the app: long tasks, and (after the element is defined) Lit updates per tag. */
async function instrument(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as Win;
    w.__perf = { long: [], raf: [], rafOn: false, sceneFrames: [], updates: {}, overlayMs: [] };
    try {
      new PerformanceObserver((list) => { for (const e of list.getEntries()) w.__perf.long.push({ start: e.startTime, dur: e.duration }); }).observe({ type: 'longtask', buffered: true });
    } catch { /* no longtask support */ }
    const count = (tag: string) => {
      void customElements.whenDefined(tag).then(() => {
        const C = customElements.get(tag) as unknown as { prototype: { update: (c: unknown) => void } };
        const orig = C.prototype.update;
        C.prototype.update = function (this: unknown, c: unknown) {
          w.__perf.updates[tag] = (w.__perf.updates[tag] ?? 0) + 1;
          return orig.call(this, c);
        };
      });
    };
    for (const t of ['sw-plan-3d', 'explore-floor-map', 'sw-plan-canvas']) count(t);
    // the frame intervals the page sees, only while a phase records them
    let last = 0;
    const loop = (t: number) => {
      if (w.__perf.rafOn && last) w.__perf.raf.push(t - last);
      last = t;
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}

/** Wrap the view's frame (every drawn scene frame: its main-thread cost) and the element's overlay layout. */
async function wrapView(el: Locator): Promise<void> {
  await el.evaluate((n) => {
    const w = window as unknown as Win;
    const e = n as unknown as { view: { frame: () => void }; layoutOverlays: () => void };
    const v = e.view;
    const frame = v.frame;
    v.frame = () => {
      const t = performance.now();
      frame();
      w.__perf.sceneFrames.push(performance.now() - t);
    };
    const proto = Object.getPrototypeOf(e) as { layoutOverlays: () => void };
    const lay = proto.layoutOverlays;
    e.layoutOverlays = function (this: unknown) {
      const t = performance.now();
      lay.call(this);
      w.__perf.overlayMs.push(performance.now() - t);
    };
  });
}

async function phaseStart(page: Page): Promise<{ t: number; updates: Record<string, number>; long: number }> {
  return page.evaluate(() => {
    const p = (window as unknown as Win).__perf;
    p.raf = [];
    p.sceneFrames = [];
    p.overlayMs = [];
    p.rafOn = true;
    return { t: performance.now(), updates: { ...p.updates }, long: p.long.length };
  });
}

async function phaseEnd(page: Page, start: { t: number; updates: Record<string, number>; long: number }) {
  const r = await page.evaluate((s) => {
    const p = (window as unknown as Win).__perf;
    p.rafOn = false;
    const long = p.long.filter((l) => l.start >= s.t);
    const updates: Record<string, number> = {};
    for (const [k, v] of Object.entries(p.updates)) updates[k] = v - (s.updates[k] ?? 0);
    return { raf: p.raf, scene: p.sceneFrames, overlay: p.overlayMs, long: long.map((l) => l.dur), updates, ms: performance.now() - s.t };
  }, start);
  return {
    ms: Math.round(r.ms),
    rafFrames: r.raf.length,
    frameP50: pct(r.raf, 50),
    frameP95: pct(r.raf, 95),
    frameMax: pct(r.raf, 100),
    jank33: r.raf.filter((x) => x > 33.4).length,
    sceneFrames: r.scene.length,
    sceneJsP50: pct(r.scene, 50),
    sceneJsP95: pct(r.scene, 95),
    sceneJsTotal: sum(r.scene),
    overlayP50: pct(r.overlay, 50),
    overlayTotal: sum(r.overlay),
    longTasks: r.long.length,
    longTotal: sum(r.long),
    longMax: pct(r.long, 100),
    updates: r.updates,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The camera position (the rotate phase checks that the drag did orbit). */
const camera = (el: Locator): Promise<number[]> => el.evaluate((n) => { const p = (n as unknown as { view: { camera: { position: { x: number; y: number; z: number } } } }).view.camera.position; return [p.x, p.y, p.z]; });

/** Wait until the view draws no more frames (the orbit damping settled) - at most `max` ms. */
async function settle(el: Locator, max = 180_000): Promise<void> {
  const frames = () => el.evaluate((n) => Number((n as unknown as { view: { frames: number } }).view.frames));
  const end = Date.now() + max;
  let last = await frames();
  while (Date.now() < end) {
    await wait(2000);
    const now = await frames();
    if (now === last) return;
    last = now;
  }
}

/** A row of the 3D element where both ends of a drag land on the canvas itself (not on a label, the strip or the bar). */
async function canvasRow(el: Locator): Promise<{ y: number; x0: number; x1: number; found: boolean }> {
  return el.evaluate((n) => {
    const host = n as HTMLElement;
    const canvas = host.shadowRoot!.querySelector('.stage canvas')!;
    const r = host.getBoundingClientRect();
    const onCanvas = (x: number, y: number) => {
      let e: Element | null = document.elementFromPoint(x, y);
      while (e?.shadowRoot) {
        const inner = e.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === e) break;
        e = inner;
      }
      return e === canvas;
    };
    // the drag starts on bare canvas away from the entity pills (a touch near a pill is adjusted onto it by the browser) and the
    // floor map's circuit buttons (stacked along the inline-start edge: the left on a phone); the pointer is captured from there
    for (const fy of [0.6, 0.65, 0.55, 0.7]) {
      const y = r.top + r.height * fy;
      for (const [a, b] of [[0.75, 0.3], [0.8, 0.35], [0.7, 0.3]]) {
        const x0 = r.left + r.width * a;
        const x1 = r.left + r.width * b;
        if (onCanvas(x0, y) && onCanvas(x0 - 12, y) && onCanvas(x0 + 12, y) && onCanvas(x0, y - 12) && onCanvas(x0, y + 12)) return { y, x0, x1, found: true };
      }
    }
    return { y: r.top + r.height * 0.45, x0: r.left + r.width * 0.25, x1: r.left + r.width * 0.75, found: false };
  });
}

/** One finger across the canvas (an orbit), `steps` moves ~16 ms apart. */
async function drag(cdp: CDPSession, row: { y: number; x0: number; x1: number }, steps: number): Promise<void> {
  const { y, x0, x1 } = row;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = t < 0.5 ? x0 + (x1 - x0) * t * 2 : x1 - (x1 - x0) * (t - 0.5) * 2; // there and back
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + Math.sin(t * Math.PI) * 40, id: 1 }] });
    await wait(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** Two fingers apart and back together (a pinch zoom in and out). */
async function pinch(cdp: CDPSession, box: { x: number; y: number; width: number; height: number }, steps: number): Promise<void> {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height * 0.45;
  const at = (d: number) => [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: at(40) });
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const d = 40 + 110 * Math.sin(t * Math.PI);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: at(d) });
    await wait(16);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

/** What one frame of the view costs to draw and what it holds in memory (renderer counters after a forced frame). */
async function staticNumbers(el: Locator) {
  return el.evaluate((n) => {
    type Tex = { image?: { width?: number; height?: number } | null; source?: { data?: { width?: number; height?: number } | null } };
    const e = n as unknown as {
      view: {
        renderer: { info: { render: { calls: number; triangles: number }; memory: { geometries: number; textures: number }; programs: unknown[] | null }; domElement: HTMLCanvasElement; getPixelRatio(): number; shadowMap: { enabled: boolean } };
        redrawNow(): void;
        lastFrameInfo: { calls: number; triangles: number };
        scene: { traverse(f: (o: Record<string, unknown>) => void): void };
        getQuality(): number;
        buildCount: number;
      };
      renderRoot: ShadowRoot;
      thumbnailCount: number;
    };
    const v = e.view;
    v.redrawNow();
    const info = v.renderer.info;
    const q = v.getQuality();
    const calls = q === 3 ? v.lastFrameInfo.calls : info.render.calls;
    const triangles = q === 3 ? v.lastFrameInfo.triangles : info.render.triangles;
    // texture bytes: every distinct texture the scene's materials hold (RGBA8 estimate), the shadow maps (depth + colour)
    const seen = new Set<unknown>();
    let texBytes = 0;
    let shadowBytes = 0;
    let meshes = 0;
    let instanced = 0;
    let instances = 0;
    v.scene.traverse((o) => {
      if (o.isMesh) meshes++;
      if (o.isInstancedMesh) {
        instanced++;
        instances += Number(o.count ?? 0);
      }
      const shadow = (o as { shadow?: { map?: { width: number; height: number } | null } }).shadow;
      if (o.isLight && o.castShadow && shadow?.map) shadowBytes += shadow.map.width * shadow.map.height * 8;
      const mats = ([] as unknown[]).concat((o.material as unknown) ?? []);
      for (const m of mats as Record<string, unknown>[]) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap', 'emissiveMap', 'metalnessMap']) {
          const t = m?.[k] as Tex | undefined;
          if (!t || seen.has(t)) continue;
          seen.add(t);
          const img = t.image ?? t.source?.data;
          if (img?.width && img?.height) texBytes += img.width * img.height * 4;
        }
      }
    });
    const cv = v.renderer.domElement;
    const deep = (root: Document | ShadowRoot): number => {
      let k = 0;
      for (const el of root.querySelectorAll('*')) {
        k++;
        if ((el as HTMLElement).shadowRoot) k += deep((el as HTMLElement).shadowRoot!);
      }
      return k;
    };
    const thumbs = [...e.renderRoot.querySelectorAll<HTMLImageElement>('[data-3d-thumb] img')].map((i) => i.src.length);
    return {
      quality: q,
      drawCalls: calls,
      triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      meshes,
      instancedMeshes: instanced,
      instances,
      pixelRatio: v.renderer.getPixelRatio(),
      bufferPx: `${cv.width}x${cv.height}`,
      bufferMB: Math.round((cv.width * cv.height * 4 * 3) / 1e5) / 10, // colour (front + back) + depth/stencil, RGBA8 / D24S8 estimate
      shadowMB: Math.round(shadowBytes / 1e5) / 10,
      textureMB: Math.round(texBytes / 1e5) / 10,
      thumbnails: thumbs.length,
      thumbnailKB: Math.round(thumbs.reduce((a, b) => a + b, 0) / 102.4) / 10,
      overlayEls: e.renderRoot.querySelectorAll('[data-3d-part]').length,
      shadowRootEls: deep(e.renderRoot),
      pageEls: deep(document),
      builds: v.buildCount,
      heapMB: Math.round(((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? 0) / 1e5) / 10,
    };
  });
}

/** A DevTools trace of `fn`, summarised: per event name the count and the total ms (main-thread events of interest), and the
 * tasks over 50 ms. The raw trace is saved next to the results. */
async function traced(cdp: CDPSession, file: string, fn: () => Promise<void>) {
  type Ev = { name: string; dur?: number; ph: string; tid: number };
  const events: Ev[] = [];
  const onData = (d: { value: unknown[] }): void => {
    events.push(...(d.value as Ev[]));
  };
  cdp.on('Tracing.dataCollected', onData);
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: ['devtools.timeline', 'disabled-by-default-devtools.timeline.frame', 'toplevel', 'blink.user_timing'], recordMode: 'recordAsMuchAsPossible' }, transferMode: 'ReportEvents' });
  await fn();
  const done = new Promise<void>((r) => cdp.once('Tracing.tracingComplete', () => r()));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', onData);
  if (file) fs.writeFileSync(file, JSON.stringify({ traceEvents: events }));
  const names = ['RunTask', 'FunctionCall', 'FireAnimationFrame', 'UpdateLayoutTree', 'Layout', 'Paint', 'PrePaint', 'Layerize', 'Commit', 'ParseHTML', 'GCEvent', 'MinorGC', 'MajorGC', 'EventDispatch'];
  const sum: Record<string, { n: number; ms: number }> = {};
  let long = 0;
  for (const e of events) {
    if (e.ph !== 'X' || !names.includes(e.name)) continue;
    const s = (sum[e.name] ??= { n: 0, ms: 0 });
    s.n++;
    s.ms += (e.dur ?? 0) / 1000;
    if (e.name === 'RunTask' && (e.dur ?? 0) > 50_000) long++;
  }
  for (const k of Object.keys(sum)) sum[k].ms = Math.round(sum[k].ms);
  return { events: sum, longTasks: long };
}

test.describe('PERF3D: the live floor map 3D on a phone (mocked backend, CPU throttled)', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.skip(process.env.PERF_RUN !== '1', 'the performance harness runs on request only (PERF_RUN=1)');

  for (let run = 1; run <= RUNS; run++) {
    test(`${RUNG} rung, CPU x${CPU}, run ${run}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'mobile', 'the phone harness: one project');
      test.setTimeout(600_000);
      await instrument(page);
      // the person's own rung, remembered in this browser and on the server: the view is built at it (a chosen rung is never lowered)
      await page.addInitScript((r) => { try { localStorage.setItem('sw.plan3d.quality', r); } catch { /* storage */ } }, RUNG);
      const mock = await installPerfMock(page, { install: 'auto', own: RUNG });
      const cdp = await page.context().newCDPSession(page);
      await cdp.send('Performance.enable');
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
      await page.goto(`/?design=a#/explore/floors/${FLOOR}`);
      const host = page.locator('explore-floor-map');
      const toggle = host.locator('[data-view-3d]');
      await expect(toggle).toBeAttached({ timeout: 120_000 });
      await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 120_000 });
      await expect.poll(() => mock.sockets, { timeout: 30_000 }).toBeGreaterThan(0);
      await wait(1500); // the 2D settles

      // ---- load: the click to ready, the first frame, every thumbnail
      const m0 = await metrics(cdp);
      const t0 = await page.evaluate(() => performance.now());
      await toggle.click();
      const el = host.locator('sw-plan-3d[data-floor-3d]');
      await expect(el).toHaveAttribute('data-ready', '', { timeout: 120_000 });
      const tReady = await page.evaluate(() => performance.now());
      await expect(el).toHaveAttribute('data-frames', /\d+/, { timeout: 120_000 });
      const tFrame = await page.evaluate(() => performance.now());
      await expect(el).toHaveAttribute('data-3d-thumbs', String(HOUSE.levels), { timeout: 120_000 });
      const tThumbs = await page.evaluate(() => performance.now());
      await expect(el).toHaveAttribute('data-rung', RUNG === 'full' ? 'full' : RUNG);
      if (RUNG === 'realistic' || RUNG === 'lite') await expect.poll(() => el.evaluate((n) => (n as unknown as { view: { realPending: number } }).view.realPending), { timeout: 240_000 }).toBe(0);
      // the frame-budget probe draws continuously for its window: the steady state starts after it
      await expect.poll(() => el.evaluate((n) => (n as unknown as { probe: unknown }).probe === null), { timeout: 60_000 }).toBe(true);
      const tSettled = await page.evaluate(() => performance.now());
      const loadLong = await page.evaluate((t) => (window as unknown as Win).__perf.long.filter((l) => l.start >= t).map((l) => l.dur), t0);
      const m1 = await metrics(cdp);
      await el.evaluate((n) => { (n as unknown as { minFps: number }).minFps = 0; });
      await wait(1000);
      await wrapView(el);
      const box = (await el.boundingBox())!;

      // ---- rotate
      let mA = await metrics(cdp);
      let s = await phaseStart(page);
      let trace: Awaited<ReturnType<typeof traced>> | null = null;
      const row = await canvasRow(el);
      const cam0 = await camera(el);
      await drag(cdp, row, STEPS);
      await settle(el); // damping settles
      const cam1 = await camera(el);
      const rotate = { ...(await phaseEnd(page, s)), cdp: delta(mA, await metrics(cdp)), row: { found: row.found, y: Math.round(row.y), x0: Math.round(row.x0), x1: Math.round(row.x1) }, cameraMoved: Math.round(Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1], cam1[2] - cam0[2]) * 100) / 100 };

      // ---- zoom
      mA = await metrics(cdp);
      s = await phaseStart(page);
      if (TRACE) trace = await traced(cdp, OUT ? path.join(OUT, `trace-${LABEL}-${RUNG}-${run}.json`) : '', () => pinch(cdp, box, STEPS));
      else await pinch(cdp, box, STEPS);
      await settle(el);
      const zoom = { ...(await phaseEnd(page, s)), cdp: delta(mA, await metrics(cdp)) };

      // ---- idle
      mA = await metrics(cdp);
      s = await phaseStart(page);
      await wait(5000);
      const idle = { ...(await phaseEnd(page, s)), cdp: delta(mA, await metrics(cdp)) };

      // ---- live pushes: the power meters tick
      await settle(el);
      const builds0 = await el.evaluate((n) => (n as unknown as { view: { buildCount: number } }).view.buildCount);
      mA = await metrics(cdp);
      s = await phaseStart(page);
      // a home's sensors: power readings (not drawn in 3D) and temperature readings (a room's chip) alternate
      const meters = powerMeters();
      for (let i = 0; i < 12; i++) {
        const m = meters[(i >> 1) % meters.length];
        expect(i % 2 ? mock.push(m.replace('_power', '_temp'), (22 + i / 10).toFixed(1)) : mock.push(m, String(100 + i * 13))).toBe(true);
        await wait(400);
      }
      await wait(1000);
      const live = { ...(await phaseEnd(page, s)), cdp: delta(mA, await metrics(cdp)), builds: (await el.evaluate((n) => (n as unknown as { view: { buildCount: number } }).view.buildCount)) - builds0 };
      // the pushes did reach the 3D: the pill of the last meter shows its last reading (or the meter is among the capped pills)
      const stat = await staticNumbers(el);

      const result = {
        label: LABEL, rung: RUNG, cpu: CPU, run, at: new Date().toISOString(),
        renderer: await el.evaluate((n) => (n as unknown as { view: { rendererInfo(): { renderer: string } } }).view.rendererInfo().renderer),
        load: {
          readyMs: Math.round(tReady - t0), firstFrameMs: Math.round(tFrame - t0), thumbsMs: Math.round(tThumbs - t0), settledMs: Math.round(tSettled - t0),
          longTasks: loadLong.length, longTotal: sum(loadLong), longMax: pct(loadLong, 100), cdp: delta(m0, m1),
        },
        rotate, zoom, idle, live, static: stat, trace,
      };
      console.log(`PERF3D ${JSON.stringify(result)}`);
      if (OUT) {
        fs.mkdirSync(OUT, { recursive: true });
        fs.appendFileSync(path.join(OUT, 'results.jsonl'), `${JSON.stringify(result)}\n`);
      }
      // sanity: the harness measured something
      expect(rotate.sceneFrames).toBeGreaterThan(5);
      expect(stat.drawCalls).toBeGreaterThan(0);
    });
  }
});
