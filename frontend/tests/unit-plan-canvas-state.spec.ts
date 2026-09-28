import { test, expect } from '@playwright/test';
import { demoRooms } from '../src/fixtures/demo';
import { demoSceneInput } from '../src/fixtures/demo-3d';
import { roomStates, type RoomStateLayer, type StateEntity } from '../src/map/room-state';

// CR-006 slice 1b, the 2D canvas on the demo floor map (no backend): the state layer handed to the canvas draws the lit
// and presence tints on the zone (the presence one with the fade's weight), the temperature chip under the room's name,
// the red marker on an open door of the structure; without a layer nothing of it is drawn; the floor map's layers panel
// carries the "מצבי חדרים" toggle (on by default, stored like the other late layers).
const NOW = Date.parse('2026-09-28T12:00:00Z');
type Canvas = HTMLElement & { zones: unknown[]; geometry: unknown; roomStates: RoomStateLayer | null; updateComplete: Promise<boolean> };
const input = demoSceneInput('f0')!;
const rooms = demoRooms('f0');
const zones = rooms.map((r, i) => ({ id: `z${i}`, name: i === 1 ? '' : `חדר ${i}`, color: '#2f6bff', polygon: [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }] }));
const ent = (id: string, x: number, y: number, extra: Partial<StateEntity> = {}): StateEntity => ({ id, domain: id.split('.')[0], device_class: null, state: null, last_changed: null, attributes: null, x, y, level_id: 'L0', layer_id: null, ...extra });
const c = (i: number) => ({ x: rooms[i].x + rooms[i].w / 2, y: rooms[i].y + rooms[i].h / 2 });
const layer = roomStates({
  rooms: zones.map((z) => ({ id: z.id, polygon: z.polygon, level_id: 'L0' })),
  entities: [ent('light.z0', c(0).x, c(0).y, { state: 'on' }), ent('climate.z0', c(0).x + 0.01, c(0).y, { state: 'heat', attributes: { current_temperature: 22 } }), ent('binary_sensor.m1', c(1).x, c(1).y, { device_class: 'motion', state: 'off', last_changed: new Date(NOW - 60_000).toISOString() }), ent('binary_sensor.d0', 0, 0, { device_class: 'door', state: 'on' })],
  openings: [{ id: 'do0', kind: 'door', x: 0, y: 0, level_id: 'L0', entity_id: 'binary_sensor.d0' }],
  size: [input.width, input.height],
  now: NOW,
  fade: 3,
});

test('the 2D state layer: lit and presence tints, the temperature chip, the open-door marker; nothing without the layer', async ({ page }) => {
  await page.goto('/#/explore/floors/f0');
  const canvas = page.locator('explore-floor-map sw-plan-canvas');
  await expect(canvas).toBeVisible({ timeout: 20000 });
  await canvas.evaluate(async (n, a) => {
    const cv = n as Canvas;
    cv.zones = a.zones;
    cv.geometry = a.doc;
    cv.roomStates = a.layer;
    await cv.updateComplete;
  }, { zones, doc: input.doc, layer });
  await expect(canvas.locator('[data-structure] [data-opening="do0"]')).toHaveCount(1);
  const lit = canvas.locator('[data-room-tint="lit"]');
  await expect(lit).toHaveCount(1);
  await expect(lit).toHaveAttribute('data-zone-id', 'z0');
  await expect(lit).toHaveAttribute('points', await canvas.locator('[data-zone="z0"] [data-zone-body]').getAttribute('points') ?? ''); // the tint is the zone's own outline
  const presence = canvas.locator('[data-room-tint="presence"]');
  await expect(presence).toHaveCount(1);
  await expect(presence).toHaveAttribute('data-zone-id', 'z1');
  await expect(presence).toHaveAttribute('data-fade', '0.667'); // 60 s into a 3 min window
  expect(await presence.evaluate((n) => getComputedStyle(n).fillOpacity)).toMatch(/^0\.2$|^0\.20/); // 0.3 * 2/3
  expect(await lit.evaluate((n) => getComputedStyle(n).fill)).toBe(await canvas.evaluate((n) => { const v = getComputedStyle(n).getPropertyValue('--sw-map-lit').trim(); const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
  const chip = canvas.locator('[data-room-temp="z0"]');
  await expect(chip).toHaveCount(1);
  await expect(chip.locator('text')).toHaveText('22°');
  await expect(canvas.locator('[data-room-temp="z1"]')).toHaveCount(0);
  const mark = canvas.locator('[data-open-mark="do0"]');
  await expect(mark).toHaveCount(1);
  expect(await mark.evaluate((n) => getComputedStyle(n).stroke)).toBe(await canvas.evaluate((n) => { const v = getComputedStyle(n).getPropertyValue('--sw-danger').trim(); const d = document.createElement('i'); d.style.color = v; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }));
  await expect(canvas.locator('[data-open-mark]')).toHaveCount(1); // do1, do2 are closed
  // the marker lies on the door's gap: the opening group holds it
  await expect(canvas.locator('[data-opening="do0"] [data-open-mark]')).toHaveCount(1);
  // no layer: the zones and the door stay, the state layer is gone
  await canvas.evaluate(async (n) => { const cv = n as Canvas; cv.roomStates = null; await cv.updateComplete; });
  await expect(canvas.locator('[data-zone="z0"]')).toHaveCount(1);
  await expect(canvas.locator('[data-room-tint], [data-room-temp], [data-open-mark]')).toHaveCount(0);
  // the same layer twice draws the same SVG (determinism)
  const draw = async () => {
    await canvas.evaluate(async (n, l) => { const cv = n as Canvas; cv.roomStates = l; await cv.updateComplete; }, layer);
    return canvas.evaluate((n) => Array.from(n.shadowRoot!.querySelectorAll('[data-room-tint], [data-room-temp], [data-open-mark]')).map((e) => e.outerHTML).join(''));
  };
  const a = await draw();
  await canvas.evaluate(async (n) => { const cv = n as Canvas; cv.roomStates = null; await cv.updateComplete; });
  expect(await draw()).toBe(a);
  expect(a.length).toBeGreaterThan(100);
});

test('the layers panel: "מצבי חדרים" is on by default and its off state is stored like the other late layers', async ({ page }) => {
  await page.goto('/#/explore/floors/f0');
  const host = page.locator('explore-floor-map');
  await expect(host.locator('sw-plan-canvas')).toBeVisible({ timeout: 20000 });
  await host.getByRole('button', { name: 'שכבות' }).click();
  const toggle = host.locator('[data-layers-panel] sw-toggle[data-layer="states"]');
  await expect(toggle).toHaveCount(1);
  await expect(toggle).toHaveAttribute('checked', '');
  await expect(host.locator('[data-layers-panel] .prow', { has: page.locator('sw-toggle[data-layer="states"]') })).toContainText('מצבי חדרים');
  await toggle.click();
  await expect(toggle).not.toHaveAttribute('checked', '');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sw.floor.layers.f0') ?? '[]') as string[]);
  expect(stored).toContain('-states');
  expect(stored).not.toContain('states');
  // a stored list from before the layer existed keeps it on
  await page.evaluate(() => localStorage.setItem('sw.floor.layers.f0', JSON.stringify(['cameras', 'doors', 'lights', 'sensors', 'zones'])));
  await page.reload();
  await expect(host.locator('sw-plan-canvas')).toBeVisible({ timeout: 20000 });
  await host.getByRole('button', { name: 'שכבות' }).click();
  await expect(host.locator('[data-layers-panel] sw-toggle[data-layer="states"]')).toHaveAttribute('checked', '');
});
