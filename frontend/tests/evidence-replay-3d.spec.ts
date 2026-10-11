import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import { sunPosition } from '../src/map/sun';
import { buildScene, type SceneDescription } from '../src/map/scene-builder';
import { he } from '../src/i18n/he';
import { CAMERA, CAM_ANCHOR, DOC, EVENT_ID, FLOOR, SITE, T_BEFORE, T_DAY, T_NIGHT, installReplayMock, type ReplayMockOptions } from './replay-3d-mocks';

// ST7HIST (CR-029 section 14): the history map and the event page draw their 3D through the live map's element and quality
// ladder, on a mocked backend (replay-3d-mocks.ts), at desktop / tablet / mobile:
// - the 2D loads no 3D chunk; levels 1-2 load no post-chain chunk and no texture (the realistic level's assets come only with
//   level 3), and their description carries no realistic part (additive);
// - the installation's plan.quality and the person's own /me/prefs override pick the level; `auto` falls back by the probe;
// - level 3 replays the instant: the device states of the instant (known only - never the live value), the sun of the
//   instant (no clock, no time pill), no walk; the history cursor moves both; the same instant gives the same description
//   and the same scene graph after a rebuild;
// - pixel baselines of the NEW level-3 states only (`--update-snapshots` on the platform that compares them; the Linux
//   runner's are committed; another platform without its own baseline skips the comparison, saying so). The level 1-2
//   baselines of docs/evidence/T087/visual are not touched (unit-plan-3d-determinism.spec.ts guards them).

const HIST = 'investigate-history-map';
const EVT = 'investigate-event-detail';
type Node = Record<string, unknown>;
interface Probe {
  description: SceneDescription;
  minFps: number;
  capture: () => string | null;
  view: {
    scene: { traverse: (f: (o: Node) => void) => void };
    realPending: number;
    buildCount: number;
    sunState: () => { elevation: number; azimuth: number } | null;
    rendererInfo: () => { vendor: string; renderer: string };
  };
}

/** Every request URL of the page, for the chunk / asset checks (dev server: /src/... modules; build: assets/<name>-<hash>.js). */
function watch(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (r) => urls.push(r.url()));
  return urls;
}
const chunk3d = (urls: string[]) => urls.filter((u) => /sw-plan-3d[.-]/.test(u));
const postChunk = (urls: string[]) => urls.filter((u) => /three-post|post-chain/.test(u));
const textures = (urls: string[]) => urls.filter((u) => /\/plan3d\//.test(u));

async function openHistory(page: Page, at: string): Promise<Locator> {
  await page.goto(`/?design=a#/investigate/floors/${FLOOR}/history?t=${encodeURIComponent(at)}&camera=${CAMERA}`);
  const host = page.locator(HIST);
  await expect(host.locator('sw-plan-canvas [data-structure] [data-wall]').first()).toBeAttached({ timeout: 30000 });
  return host;
}

async function historyTo3d(host: Locator): Promise<Locator> {
  const toggle = host.locator('[data-view-3d]');
  await expect(toggle).toBeAttached({ timeout: 30000 });
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-history-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  return el;
}

async function openEvent3d(page: Page): Promise<{ host: Locator; el: Locator }> {
  await page.goto(`/?design=a#/investigate/events/${EVENT_ID}`);
  const host = page.locator(EVT);
  await expect(host.locator('sw-plan-canvas')).toBeAttached({ timeout: 30000 });
  const toggle = host.locator('sw-button[data-event-3d-toggle]');
  await expect(toggle).not.toHaveAttribute('disabled', '', { timeout: 30000 });
  await toggle.click();
  const el = host.locator('sw-plan-3d[data-event-3d]');
  await expect(el).toHaveAttribute('data-ready', '', { timeout: 60000 });
  return { host, el };
}

const desc = (el: Locator) => el.evaluate((n) => (n as unknown as Probe).description);
/** Level 3 drawn with its realistic part and every asset (textures, models, the post chunk) loaded. */
async function level3Ready(el: Locator, rung: 'lite' | 'realistic'): Promise<void> {
  await expect(el).toHaveAttribute('data-quality', '3', { timeout: 30000 });
  await expect(el).toHaveAttribute('data-rung', rung);
  await expect.poll(() => el.evaluate((n) => !!(n as unknown as Probe).description?.real), { timeout: 30000 }).toBe(true);
  await expect.poll(() => el.evaluate((n) => (n as unknown as Probe).view.realPending), { timeout: 120000 }).toBe(0);
}
const graph = (el: Locator): Promise<Node[]> =>
  el.evaluate((n) => {
    const out: Node[] = [];
    (n as unknown as Probe).view.scene.traverse((o) => {
      const mat = o.material as { type?: string; color?: { getHex: () => number }; opacity?: number; roughness?: number; emissiveIntensity?: number } | undefined;
      const im = o.instanceMatrix as { array: ArrayLike<number> } | undefined;
      const light = o as { intensity?: number };
      out.push({ name: String(o.name ?? ''), type: String(o.type), count: Number(o.count ?? 0), visible: o.visible !== false,
        position: (o.position as { toArray: () => number[] }).toArray().map((v) => Math.round(v * 1e5) / 1e5), quaternion: (o.quaternion as { toArray: () => number[] }).toArray().map((v) => Math.round(v * 1e5) / 1e5),
        matrices: im ? Array.from(im.array).map((v) => Math.round(v * 1e5) / 1e5) : null, cast: !!o.castShadow,
        material: mat ? { type: mat.type, color: mat.color?.getHex(), opacity: mat.opacity, roughness: mat.roughness, emissive: mat.emissiveIntensity } : null,
        light: light.intensity !== undefined ? Math.round(light.intensity * 1e4) / 1e4 : null });
    });
    return out;
  });
const part = (d: SceneDescription, id: string) => d.parts.find((p) => p.id === id);
/** The sensed door's leaf drawn closed (every state unknown: a door is closed then), from the same document in node. */
const CLOSED_LEAF = part(buildScene({ doc: DOC, width: 1200, height: 800, anchors: [], entityStates: {}, circuitStates: {} }), 'door:door-mid')!.rotation[1];
/** Whether the sensed door's leaf is swung open in a description (null: no leaf). */
const doorOpen = (d: SceneDescription): boolean | null => {
  const p = part(d, 'door:door-mid');
  return p ? Math.abs(p.rotation[1] - CLOSED_LEAF) > 0.5 : null;
};
/** Hand the element a JSON copy of `d` (an equal description, another object) and let it settle: true when the view
 * realised it again (its build count moved) and still holds the copy. */
const rebuildFrom = (el: Locator, d: SceneDescription): Promise<boolean> =>
  el.evaluate((n, copy) => {
    const e = n as unknown as Probe;
    const before = e.view.buildCount;
    e.description = copy;
    return new Promise<boolean>((res) => setTimeout(() => res(e.view.buildCount > before && e.description === copy), 1200));
  }, JSON.parse(JSON.stringify(d)) as SceneDescription);
/** The sun's elevation the element must draw for an instant, rounded as `data-sun-elevation`. */
const elevationAt = (iso: string) => String(Math.round(sunPosition(Date.parse(iso), SITE.latitude, SITE.longitude).elevation));

/** The 3D sits inside its screen's box and the page never scrolls sideways (every project). */
async function layoutOk(page: Page, el: Locator, box: Locator): Promise<void> {
  const a = (await el.boundingBox())!;
  const b = (await box.boundingBox())!;
  expect(a.width).toBeGreaterThan(100);
  expect(a.x).toBeGreaterThanOrEqual(b.x - 1);
  expect(a.x + a.width).toBeLessThanOrEqual(b.x + b.width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
}

test.describe('history map: the 3D of the chosen instant on the quality ladder', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('2D loads no 3D chunk; the installation default (schematic) draws level 1 without the realistic part, the post chunk or a texture', async ({ page }) => {
    test.setTimeout(120_000);
    const urls = watch(page);
    const mock = await installReplayMock(page, { install: '1' });
    const host = await openHistory(page, T_DAY);
    await page.waitForTimeout(1500); // the cursor's frame timer settles
    expect(chunk3d(urls), 'the 2D history map never fetches the 3D view').toEqual([]);
    expect(mock.mapAts.filter((a) => a === null), 'the history never reads the live map').toEqual([]);
    const el = await historyTo3d(host);
    expect(chunk3d(urls).length, 'the 3D chunk arrives with the toggle').toBeGreaterThan(0);
    await expect(el).toHaveAttribute('data-quality', '1');
    await expect(el).toHaveAttribute('data-quality-mode', 'schematic');
    await expect(el).toHaveAttribute('data-preset', 'camera'); // opened from ?camera=
    await page.waitForTimeout(1200);
    const d = await desc(el);
    expect('real' in d, 'levels 1-2: no realistic part').toBe(false);
    expect('walk' in d).toBe(false);
    expect(postChunk(urls), 'level 1 loads no post chain').toEqual([]);
    expect(textures(urls), 'level 1 loads no texture').toEqual([]);
    // the walk is not offered on a replay screen, and the sun is the instant's (no time pill at any level)
    await expect(el.locator('[data-walk-btn]')).toHaveCount(0);
    await expect(el.locator('[data-3d-time]')).toHaveCount(0);
    await expect(el).toHaveAttribute('data-sun-fixed', '');
    // the states of the instant (after the switch): the door open, both lamps lit - the lamp of the light and the circuit's
    expect(doorOpen(d)).toBe(true);
    expect(part(d, 'obj:lamp-a#glow')).toBeTruthy();
    expect(part(d, 'obj:lamp-b#glow')).toBeTruthy();
    await layoutOk(page, el, host.locator('div.layout > div.stage'));
  });

  test('the person\'s own "full" over the installation\'s schematic: level 2, still no post chunk', async ({ page }) => {
    test.setTimeout(120_000);
    const urls = watch(page);
    await installReplayMock(page, { install: '1', own: '2' });
    const el = await historyTo3d(await openHistory(page, T_DAY));
    await expect(el).toHaveAttribute('data-quality', '2', { timeout: 20000 });
    await expect(el).toHaveAttribute('data-quality-mode', 'full');
    await page.waitForTimeout(1500);
    expect('real' in (await desc(el))).toBe(false);
    expect(postChunk(urls), 'level 2 loads no post chain').toEqual([]);
    expect(textures(urls), 'level 2 loads no texture').toEqual([]);
  });

  test('the installation\'s own "full" with no personal choice: level 2', async ({ page }) => {
    test.setTimeout(120_000);
    await installReplayMock(page, { install: '2' });
    const el = await historyTo3d(await openHistory(page, T_DAY));
    await expect(el).toHaveAttribute('data-quality', '2', { timeout: 20000 });
    await expect(el).toHaveAttribute('data-quality-mode', 'full');
  });

  test('level 3 (own "lite"): the realistic part, the sun and the states of the instant; the cursor moves both; deterministic', async ({ page }) => {
    test.setTimeout(300_000);
    const urls = watch(page);
    await installReplayMock(page, { install: '1', own: 'lite' });
    const host = await openHistory(page, T_DAY);
    const el = await historyTo3d(host);
    await level3Ready(el, 'lite');
    await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
    expect(postChunk(urls).length, 'level 3 loads the post chain').toBeGreaterThan(0);
    await expect(el).toHaveAttribute('data-sun-elevation', elevationAt(T_DAY));
    await expect(el.locator('[data-3d-time]'), 'a fixed instant: no time pill').toHaveCount(0);
    await expect(el.locator('[data-walk-btn]'), 'no walk on the history').toHaveCount(0);
    let d = await desc(el);
    expect(doorOpen(d)).toBe(true);
    expect(part(d, 'obj:lamp-a#glow')).toBeTruthy();
    expect(part(d, 'obj:lamp-b#glow')).toBeTruthy();
    // determinism: an equal description (a JSON copy) rebuilds into the same scene graph
    await el.locator('[data-preset-iso]').click();
    await page.waitForTimeout(500);
    // (the lamp pool's slots follow the camera's path, so both graphs are taken from a cold build at the same preset)
    expect(await rebuildFrom(el, d), 'an equal description is realised again').toBe(true);
    const a = await graph(el);
    expect(await rebuildFrom(el, d)).toBe(true);
    expect(await graph(el)).toEqual(a);
    // one hour back: before the switch - the sun of 11:30 and every state off (the bundle of that instant)
    await host.locator('sw-chip', { hasText: '-1 שעה' }).click();
    await expect(el).toHaveAttribute('data-sun-elevation', elevationAt(T_BEFORE), { timeout: 10000 });
    await expect.poll(async () => { const x = await desc(el); return [doorOpen(x), !!part(x, 'obj:lamp-a#glow'), !!part(x, 'obj:lamp-b#glow')]; }, { timeout: 20000 }).toEqual([false, false, false]);
    d = await desc(el);
    expect(d.real, 'still level 3').toBeTruthy();
    await layoutOk(page, el, host.locator('div.layout > div.stage'));
  });

  test('auto with a realistic default view: the probe lowers the rung for the session and says so', async ({ page }) => {
    test.setTimeout(300_000);
    await installReplayMock(page, { install: 'auto', defaultView: 'realistic' });
    const el = await historyTo3d(await openHistory(page, T_DAY));
    await expect(el).toHaveAttribute('data-quality-mode', 'auto');
    await el.evaluate((n) => { (n as unknown as Probe).minFps = 100000; }); // no device draws 100000 fps: the next probe always misses
    await el.locator('[data-quality-auto]').click(); // a fresh choice measures afresh
    await expect(el.locator('[data-3d-fallback]')).toBeAttached({ timeout: 120000 });
    expect(await el.getAttribute('data-rung')).not.toBe('realistic');
    await expect(el).toHaveAttribute('data-quality-mode', 'auto');
  });

  test('pixel baselines of the new level-3 states: day (lite, realistic) and night (lite)', async ({ page }, info) => {
    test.setTimeout(600_000);
    const names = ['history-l3-lite-day.png', 'history-l3-realistic-day.png', 'history-l3-lite-night.png'];
    skipWithoutBaseline(info, names);
    await installReplayMock(page, { install: '1', own: 'lite' });
    let el = await historyTo3d(await openHistory(page, T_DAY));
    await level3Ready(el, 'lite');
    await shoot(el, page, info, names[0]);
    await el.locator('[data-quality-3]').click();
    await level3Ready(el, 'realistic');
    await shoot(el, page, info, names[1]);
    await el.locator('[data-quality-3-lite]').click();
    await expect(el).toHaveAttribute('data-rung', 'lite');
    await page.goto('about:blank'); // a fresh screen at the night instant (the 2D first, as an operator opens it)
    el = await historyTo3d(await openHistory(page, T_NIGHT));
    await level3Ready(el, 'lite');
    await expect(el).toHaveAttribute('data-sun-elevation', elevationAt(T_NIGHT));
    await shoot(el, page, info, names[2]);
  });
});

test.describe('event page: the 3D of the event time on the quality ladder', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');

  test('level 1 by the installation: no post chunk; the states of the event time, never the live ones', async ({ page }) => {
    test.setTimeout(120_000);
    const urls = watch(page);
    const mock = await installReplayMock(page, { install: '1' });
    const { host, el } = await openEvent3d(page);
    await expect(el).toHaveAttribute('data-quality', '1');
    await expect(el).toHaveAttribute('data-preset', 'camera');
    await expect(el).toHaveAttribute('data-selected', CAM_ANCHOR);
    // the live map (the card) says closed / off; the event time says open / on - the 3D replays the event time
    await expect.poll(async () => { const d = await desc(el); return [doorOpen(d), !!part(d, 'obj:lamp-a#glow'), !!part(d, 'obj:lamp-b#glow')]; }, { timeout: 20000 }).toEqual([true, true, true]);
    expect(mock.mapAts).toContain(T_DAY);
    expect('real' in (await desc(el))).toBe(false);
    await page.waitForTimeout(1000);
    expect(postChunk(urls)).toEqual([]);
    expect(textures(urls)).toEqual([]);
    await expect(el.locator('[data-walk-btn]')).toHaveCount(0);
    await expect(el.locator('[data-3d-time]')).toHaveCount(0);
    await expect(host.locator('[data-event-3d-note]')).toHaveText(he.replay3d.eventNote); // through i18n (he.ts)
    await layoutOk(page, el, host.locator('div.map').first());
  });

  test('level 3 (own "realistic"): the realistic part and the sun of the event time; deterministic', async ({ page }) => {
    test.setTimeout(300_000);
    const urls = watch(page);
    await installReplayMock(page, { install: '1', own: 'realistic' });
    const { el } = await openEvent3d(page);
    await level3Ready(el, 'realistic');
    await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
    expect(postChunk(urls).length).toBeGreaterThan(0);
    await expect(el).toHaveAttribute('data-sun-elevation', elevationAt(T_DAY));
    await expect(el.locator('[data-3d-time]')).toHaveCount(0);
    await expect(el.locator('[data-walk-btn]')).toHaveCount(0);
    const d = await desc(el);
    expect(d.real).toBeTruthy();
    expect(part(d, 'obj:lamp-a#glow')).toBeTruthy();
    // (the lamp pool's slots follow the camera's path, so both graphs are taken from a cold build at the same preset)
    expect(await rebuildFrom(el, d), 'an equal description is realised again').toBe(true);
    const a = await graph(el);
    expect(await rebuildFrom(el, d)).toBe(true);
    expect(await graph(el)).toEqual(a);
  });

  test('pixel baseline of the new level-3 state: the event card at the event time (lite)', async ({ page }, info) => {
    test.setTimeout(600_000);
    const names = ['event-l3-lite.png'];
    skipWithoutBaseline(info, names);
    await installReplayMock(page, { install: '1', own: 'lite' } satisfies ReplayMockOptions);
    const { el } = await openEvent3d(page);
    await level3Ready(el, 'lite');
    await expect.poll(async () => !!part(await desc(el), 'obj:lamp-a#glow'), { timeout: 20000 }).toBe(true);
    await shoot(el, page, info, names[0]);
  });
});

// ---- pixel baselines (Playwright snapshots with the platform suffix; compared only where that platform's file exists)

const writing = (info: TestInfo) => ['all', 'changed'].includes(info.config.updateSnapshots);

function skipWithoutBaseline(info: TestInfo, names: string[]): void {
  const missing = names.filter((n) => !fs.existsSync(info.snapshotPath(n)));
  test.skip(!writing(info) && missing.length > 0, `no ${process.platform} baseline for ${missing.join(', ')} (generate with --update-snapshots on this platform)`);
}

/** The view's own pixels (the canvas, no DOM chrome) at the isometric preset, after the frame settled. */
async function shoot(el: Locator, page: Page, info: TestInfo, name: string): Promise<void> {
  await el.evaluate((n) => { (n as unknown as Probe).minFps = 0; });
  await el.locator('[data-preset-iso]').click();
  await expect(el).toHaveAttribute('data-preset', 'iso');
  await page.waitForTimeout(800); // the damping and a door leaf's 350 ms swing
  const url = await el.evaluate((n) => (n as unknown as Probe).capture());
  expect(url?.startsWith('data:image/png;base64,')).toBe(true);
  const renderer = await el.evaluate((n) => (n as unknown as Probe).view.rendererInfo().renderer);
  info.annotations.push({ type: 'renderer', description: `${name}: ${renderer}` });
  expect(Buffer.from(url!.slice('data:image/png;base64,'.length), 'base64')).toMatchSnapshot(name, { maxDiffPixelRatio: 0.002, threshold: 0.02 });
}
