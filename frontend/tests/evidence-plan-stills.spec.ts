import { test, expect } from '@playwright/test';

// Plan Studio 6, slice S3 (docs/changes/CR-029-ST7-S3-NOTES.md) in a real browser - a DEV-SERVER spec (it imports /src modules:
// `run_smart.py spec <branch> tests/evidence-plan-stills.spec.ts`). (1) The level-2 still renderer draws the demo floor off-screen
// at the still's size: the camera that drew it projects exactly like the pure iso projection the masks use (<= 0.5 px), the
// same request gives the same bytes (one GPU / SwiftShader), the variants differ, and nothing is left in the DOM afterwards.
// (2) `sw-plan-stills` composes a bake: a lit room revealed through its mask, an open door and presence drawn, stale / unknown
// states light nothing, and the view holds no canvas (zero WebGL).

test.describe('stills in the browser', () => {
  test('the still renderer: camera, determinism, variants, cleanup', async ({ page }) => {
    await page.goto('/');
    const out = await page.evaluate(async () => {
      const sb = await import('/src/map/still-bake.ts' as string);
      const rs = await import('/src/map/still-render-scene.ts' as string);
      const d3 = await import('/src/fixtures/demo-3d.ts' as string);
      const demo = await import('/src/fixtures/demo.ts' as string);
      const builder = await import('/src/map/scene-builder.ts' as string);
      const sc = await import('/src/map/skin-control.ts' as string);
      const input = d3.demoSceneInput('f0');
      const zones = demo.demoRooms('f0').map((r: { x: number; y: number; w: number; h: number }, i: number) => ({ id: `z${i}`, name: '', polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }], level_id: 'L0' }));
      const base = { ...input, zones };
      const describe = (v: 'off' | 'on') => builder.buildScene(sc.controlSceneInput(base, v === 'on' ? 'all_on' : 'all_off'));
      const req = { levelId: 'L0', preset: 'iso', style: 'light', band: 'day', variant: 'off', width: 1280, height: 800 };
      const hash = async (b: Blob) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await b.arrayBuffer()))).map((x) => x.toString(16).padStart(2, '0')).join('');
      const r = new rs.SceneStillRenderer();
      const a = await r.render(describe, req);
      const pure = sb.isoProject(sb.isoCamera(sb.stillDescription(describe('off'), 'L0', 'off'), 1280, 800));
      const mask = sb.buildMask(describe('off'), 'L0', { preset: 'iso', width: 1280, height: 800 }, pure, null);
      let maxDiff = 0;
      for (const p of describe('off').parts.filter((x: { kind: string }) => x.kind === 'wall' || x.kind === 'object')) {
        const u = a.project(p.position);
        const v = pure(p.position);
        if (u && v) maxDiff = Math.max(maxDiff, Math.abs(u[0] - v[0]), Math.abs(u[1] - v[1]));
      }
      const h1 = await hash(a.blob);
      const b = await r.render(describe, req);
      const h2 = await hash(b.blob);
      const lit = await hash((await r.render(describe, { ...req, variant: 'on' })).blob);
      const night = await hash((await r.render(describe, { ...req, band: 'night' })).blob);
      const sunset = await hash((await r.render(describe, { ...req, band: 'sunset' })).blob);
      const dark = await hash((await r.render(describe, { ...req, style: 'dark' })).blob);
      r.dispose();
      return { maxDiff, same: h1 === h2, distinct: new Set([h1, lit, night, sunset, dark]).size, type: a.blob.type, bytes: a.blob.size, rooms: mask.rooms.length,
        left: document.querySelectorAll('[data-still-bake]').length, renderer: a.renderer };
    });
    test.info().annotations.push({ type: 'renderer', description: out.renderer });
    expect(out.maxDiff).toBeLessThanOrEqual(0.5);
    expect(out.same).toBe(true);
    expect(out.distinct).toBe(5);
    expect(['image/webp', 'image/jpeg']).toContain(out.type);
    expect(out.bytes).toBeGreaterThan(1000);
    expect(out.bytes).toBeLessThan(2 * 1024 * 1024);
    expect(out.rooms).toBeGreaterThan(0);
    expect(out.left).toBe(0);
  });

  test('sw-plan-stills composes lit rooms, an open door and presence without WebGL', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(async () => {
      await import('/src/map/sw-plan-stills.ts' as string);
      const pic = (color: string) => {
        const c = document.createElement('canvas');
        c.width = 800;
        c.height = 500;
        const x = c.getContext('2d')!;
        x.fillStyle = color;
        x.fillRect(0, 0, 800, 500);
        return new Promise<string>((res) => c.toBlob((b) => res(URL.createObjectURL(b!)), 'image/png'));
      };
      const mask = { version: 1, preset: 'iso', width: 800, height: 500,
        rooms: [{ id: 'z0', floor: [[100, 300], [300, 300], [300, 420]], top: [[100, 200], [300, 200], [300, 320]], centre: [220, 300] },
          { id: 'z1', floor: [[400, 300], [600, 300], [600, 420]], top: [[400, 200], [600, 200], [600, 320]], centre: [520, 300] }],
        doors: [{ id: 'do0', points: [[310, 300], [330, 300], [330, 340]] }], cameras: [{ id: 'cam1', p: [700, 100] }] };
      const maskUrl = URL.createObjectURL(new Blob([JSON.stringify(mask)], { type: 'application/json' }));
      const bakes = { bake_key: 'k', complete: true, stale_count: 0, recipes: ['still-q2.1'], levels: { L0: {
        stills: { 'iso/light/day/off': { url: await pic('#dde3ea'), width: 800, height: 500, recipe: 'still-q2.1' }, 'iso/light/day/on': { url: await pic('#ffd27a'), width: 800, height: 500, recipe: 'still-q2.1' } },
        masks: { iso: { url: maskUrl } }, lightmap: null } } };
      const el = document.createElement('sw-plan-stills') as HTMLElement & Record<string, unknown>;
      el.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99999';
      Object.assign(el, { bakes, level: 'L0', styleId: 'light', band: 'day', rooms: { z0: { lit: true }, z1: { lit: null, presence: true } }, openOpenings: ['do0'] });
      el.id = 'stills-under-test';
      document.body.appendChild(el);
    });
    const host = page.locator('#stills-under-test');
    await expect(host.locator('[data-lit-room="z0"]')).toHaveCount(1);
    await expect(host.locator('[data-lit-room]')).toHaveCount(1); // z1's lit state is unknown: it never lights
    await expect(host.locator('[data-open-door="do0"]')).toHaveCount(1);
    await expect(host.locator('[data-presence="z1"]')).toHaveCount(1);
    await expect(host.locator('[data-still-camera="cam1"]')).toHaveCount(1);
    expect(await host.evaluate((n) => n.shadowRoot!.querySelectorAll('canvas').length)).toBe(0);
    await page.screenshot({ path: test.info().outputPath('stills.png') });
    // the room goes dark and the door closes: the picture follows on the next state push
    await host.evaluate((n) => Object.assign(n, { rooms: { z0: { lit: false } }, openOpenings: [] }));
    await expect(host.locator('[data-lit-room]')).toHaveCount(0);
    await expect(host.locator('[data-open-door]')).toHaveCount(0);
  });
});
