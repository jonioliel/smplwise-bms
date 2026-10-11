import { test, expect } from '@playwright/test';
import { compassAngle, newPositionName, positionArrow, positionMetres, sunOnPlan, swatchMaterials, windName } from '../src/screens/plan-studio6-panel';
import { CHOICES, DEFAULT_VIEW, DIAL_HE, PERSONAL_DIALS, RANGES } from '../src/api/plan-view';
import { HINT_HE, PLAN_VIEW_CARD_DIALS, PLAN_VIEW_FLAGS, PLAN_VIEW_SITE_ONLY } from '../src/screens/plan-view-dials';
import { MATERIALS } from '../src/map/material-resolve';

// CR-029 ST7 UI: the pure helpers of the editor's Studio 6 cards and the settings card's dial lists. Runs in node.

test('the compass bearing is clockwise from up, 0..360, and the winds name the eight directions', () => {
  expect(compassAngle(50, 50, 50, 0)).toBe(0);
  expect(compassAngle(50, 50, 100, 50)).toBe(90);
  expect(compassAngle(50, 50, 50, 100)).toBe(180);
  expect(compassAngle(50, 50, 0, 50)).toBe(270);
  expect(compassAngle(50, 50, 100, 0)).toBe(45);
  expect(windName(0)).toBe('צפון');
  expect(windName(44)).toBe('צפון-מזרח');
  expect(windName(180)).toBe('דרום');
  expect(windName(359)).toBe('צפון');
  expect(windName(-90)).toBe('מערב');
});

test('the sun on the plan turns with the north: a plan whose up faces east sees the noon sun 90 degrees further left', () => {
  const noon = Date.UTC(2026, 5, 21, 9, 40); // ~ solar noon in Israel
  const site = { latitude: 32, longitude: 34.8 };
  const a = sunOnPlan(noon, site, 0);
  const b = sunOnPlan(noon, site, 90);
  expect(a.elevation).toBeGreaterThan(70);
  expect(Math.abs(a.azimuth - 180)).toBeLessThan(15);
  expect(b.azimuth).toBeCloseTo(a.azimuth, 5); // true azimuth does not depend on the plan
  expect((((b.planDeg - a.planDeg) % 360) + 360) % 360).toBeCloseTo(270, 5);
  expect(sunOnPlan(Date.UTC(2026, 5, 21, 22, 0), site, 0).elevation).toBeLessThan(0); // night
});

test('walk positions: the next free name, metres from the plan corner, the heading arrow', () => {
  expect(newPositionName([])).toBe('עמדה 1');
  expect(newPositionName([{ name: 'עמדה 1' }, { name: 'כניסה' }, { name: 'עמדה 3' }])).toBe('עמדה 2');
  expect(positionMetres({ x: 0.5, y: 0.25 }, 1200, 800, 0.01)).toEqual({ x: 6, y: 2 });
  const up = positionArrow({ x: 0.5, y: 0.5, heading_deg: 0 }, 1000, 500);
  expect(up.a).toEqual([0.5, 0.5]);
  expect(up.b[0]).toBeCloseTo(0.5, 6);
  expect(up.b[1]).toBeLessThan(0.5); // heading 0 = plan up
  const east = positionArrow({ x: 0.5, y: 0.5, heading_deg: 90 }, 1000, 500);
  expect(east.b[0]).toBeGreaterThan(0.5);
  expect(east.b[1]).toBeCloseTo(0.5, 6);
});

test('the material swatches come from the library, the relevant groups first, every id known', () => {
  const ids = new Set(MATERIALS.map((m) => m.id));
  for (const host of ['wall', 'floor', 'ceiling', 'object'] as const) {
    const sw = swatchMaterials(host);
    expect(sw.length).toBeGreaterThan(2);
    for (const m of sw) expect(ids.has(m.id)).toBe(true);
  }
  expect(swatchMaterials('wall')[0].group).toBe('wall');
  expect(swatchMaterials('floor').map((m) => m.id)).toContain('oak');
  expect(swatchMaterials('object').map((m) => m.id)).toContain('leather');
});

test('the settings card lists every dial of plan.view once, with a Hebrew name, and knows which are installation-only', () => {
  const all = Object.keys(DEFAULT_VIEW) as (keyof typeof DEFAULT_VIEW)[];
  expect([...PLAN_VIEW_CARD_DIALS].sort()).toEqual([...all].sort());
  expect(new Set(PLAN_VIEW_CARD_DIALS).size).toBe(PLAN_VIEW_CARD_DIALS.length);
  for (const d of all) {
    expect(DIAL_HE[d].length, d).toBeGreaterThan(0);
    expect(HINT_HE[d].length, d).toBeGreaterThan(0);
  }
  for (const d of PLAN_VIEW_SITE_ONLY) expect((PERSONAL_DIALS as readonly string[]).includes(d), d).toBe(false);
  for (const d of PLAN_VIEW_FLAGS) expect(typeof DEFAULT_VIEW[d]).toBe('boolean');
  // every personal dial is either a choice, a flag or a range
  for (const d of PERSONAL_DIALS) expect(d in CHOICES || (PLAN_VIEW_FLAGS as readonly string[]).includes(d) || d in RANGES, d).toBe(true);
  expect(RANGES.eye_m).toEqual([1.2, 2.0, 0.05]);
  expect(DEFAULT_VIEW.eye_m).toBe(1.65);
});
