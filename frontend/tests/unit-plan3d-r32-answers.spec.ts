import { test, expect } from '@playwright/test';
import { CHOICES, DEFAULT_VIEW, DIAL_HE, PERSONAL_DIALS } from '../src/api/plan-view';
import { HINT_HE, MAP3D_ROWS, PLAN_VIEW_CARD_DIALS, PLAN_VIEW_FLAGS } from '../src/screens/plan-view-dials';
import { stackPrefsOf } from '../src/map/stack-layout';
import { moodInstant, siteLocal, sunPosition } from '../src/map/sun';
import { DEFAULT_MARKS, alarmPulse, barHeight, markLayers, markState, planGlow, MARK_BAR_M } from '../src/map/room-glow';
import { LOW_CUT_M, sectionCutY, DEFAULT_REAL } from '../src/map/scene-real';
import { FINISH_TRAVERTINE, FLOOR_FINISHES, finishMaterial, finishPixels, finishSurfacePixels } from '../src/map/floor-finish';
import { floorReflectivity } from '../src/map/floor-reflect';
import { autoItemCount, removeAutoItems } from '../src/map/candidates';
import type { ScenePart } from '../src/map/scene-builder';
import type { GeometryDoc } from '../src/map/geometry';

// PLAN3D-R32-ANSWERS-2438 (owner round 32, the 3D map): the pure side of the answers - the settings and their defaults, the locked
// light, the room state marks, the low cut, the travertine floor and the editor's "remove the automatic items".
//   npx playwright test -c playwright.unit.config.ts tests/unit-plan3d-r32-answers.spec.ts

test.describe('settings: one 3D map section, the owner\'s answers as defaults', () => {
  test('the look dials of round 32 default to the answers and are personal', () => {
    expect(DEFAULT_VIEW).toMatchObject({ floor_finish: 'marble', wall_cut: 'low', light_mood: 'auto', room_marks: 'bar_edge', light_mark: 'bar', alarm_motion: 'pulse', reflections_auto: true, backdrop: 'sky', furniture: 'models', floor_reflections: true });
    expect(CHOICES.floor_finish).toEqual(['wood', 'marble', 'ceramic', 'travertine']);
    expect(CHOICES.alarm_motion).toEqual(['pulse', 'steady']); // a fast flash is never offered (photosensitivity)
    for (const d of ['wall_cut', 'light_mood', 'room_marks', 'light_mark', 'alarm_motion', 'reflections_auto'] as const) {
      expect(PERSONAL_DIALS).toContain(d);
      expect(PLAN_VIEW_CARD_DIALS).toContain(d);
      expect(DIAL_HE[d].length, d).toBeGreaterThan(0);
      expect(HINT_HE[d].length, d).toBeGreaterThan(0);
    }
    expect(PLAN_VIEW_FLAGS).toContain('reflections_auto');
  });

  test('the round 28 rows live in the same card; the first option of each is the server default', () => {
    const first = Object.fromEntries(MAP3D_ROWS.map((r) => [r.key, r.options[0][0]]));
    expect(first).toEqual({
      'map.room_pills': 'room', 'map.room_pill_tap': 'popover', 'map.room_pill_quiet': 'name', 'map.room_card_place': 'side', 'map.room_card_confirm': 'system',
      'map.room_card_camera': 'live', 'map.stack_backdrop': 'theme', 'map.stack_pick': 'two_tap',
    });
    expect(MAP3D_ROWS.find((r) => r.key === 'map.stack_backdrop')!.options.map((o) => o[0])).toEqual(['theme', 'light', 'dark']);
    expect(MAP3D_ROWS.find((r) => r.key === 'map.room_card_confirm')!.options.map((o) => o[0])).not.toContain('none');
    expect(stackPrefsOf({ 'map.stack_backdrop': 'light' }).backdrop).toBe('light');
    expect(stackPrefsOf({ 'map.stack_backdrop': 'x' }).backdrop).toBe('theme');
  });
});

test.describe('light by the hour, or locked (Q-MAP-14)', () => {
  const site = { zone: 'Asia/Jerusalem', lat: 32.08, lon: 34.78 };
  for (const ymd of [[2026, 6, 21], [2026, 12, 21]] as [number, number, number][]) {
    test(`day / evening / night moments of ${ymd.join('-')}`, () => {
      const day = moodInstant('day', ymd, site.zone, site.lat, site.lon);
      const eve = moodInstant('evening', ymd, site.zone, site.lat, site.lon);
      const night = moodInstant('night', ymd, site.zone, site.lat, site.lon);
      const e = (t: number) => sunPosition(t, site.lat, site.lon).elevation;
      expect(e(day)).toBeGreaterThan(30);
      expect(e(eve)).toBeLessThanOrEqual(6.5);
      expect(e(eve)).toBeGreaterThan(0);
      expect(e(night)).toBeLessThan(-11);
      expect(day).toBeLessThan(eve);
      expect(eve).toBeLessThan(night);
      const l = siteLocal(eve, site.zone);
      expect([l.year, l.month, l.day]).toEqual(ymd); // the same local date
      expect(moodInstant('evening', ymd, site.zone, site.lat, site.lon)).toBe(eve); // deterministic
    });
  }
});

test.describe('room state marks (Q-MAP-16..18)', () => {
  test('the strongest state wins: alarm over presence over a light on', () => {
    expect(markState({ alarm: 1, presence: 1, lit: 1 })).toBe('alarm');
    expect(markState({ presence: 0.4, lit: 1 })).toBe('presence');
    expect(markState({ presence: 0, lit: 1 })).toBe('light');
    expect(markState({ presence: 0, lit: 0 })).toBeNull();
  });

  test('the layers follow the settings', () => {
    expect(DEFAULT_MARKS).toEqual({ marks: 'bar_edge', light: 'bar', alarm: 'pulse' });
    expect(markLayers('presence', DEFAULT_MARKS)).toEqual({ bar: true, line: true, floor: true });
    expect(markLayers('light', DEFAULT_MARKS)).toEqual({ bar: true, line: false, floor: false }); // a thin amber bar only
    expect(markLayers('light', { ...DEFAULT_MARKS, light: 'none' })).toEqual({ bar: false, line: false, floor: false });
    expect(markLayers('light', { ...DEFAULT_MARKS, light: 'bar_floor' })).toEqual({ bar: true, line: true, floor: false });
    expect(markLayers('alarm', { ...DEFAULT_MARKS, marks: 'floor' })).toEqual({ bar: false, line: false, floor: true });
    expect(markLayers('presence', { ...DEFAULT_MARKS, marks: 'bar' })).toEqual({ bar: true, line: false, floor: false });
    expect(markLayers(null, DEFAULT_MARKS)).toEqual({ bar: false, line: false, floor: false });
  });

  test('the alarm pulses slowly (1.4 s) between 0.44 and 1, and is steady without motion', () => {
    const vals = Array.from({ length: 29 }, (_, i) => alarmPulse(i * 50, true));
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(0.44 - 1e-9);
    expect(Math.max(...vals)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.4);
    expect(alarmPulse(350, false)).toBe(1);
  });

  test('an alarm tint becomes a glow room with its outline and the bar on the wall tops at the cut', () => {
    const poly: [number, number][] = [[0, 0], [4, 0], [4, 3], [0, 3]];
    const part = (tag: string): ScenePart => ({ id: `room:z1#${tag}`, kind: 'tint', shape: 'prism', position: [0, 0.03, 0], size: [0, 0.01, 0], rotation: [0, 0, 0], color: 'danger', opacity: 0.4, group: null, level_id: 'L0', polygon: poly, userData: { id: 'z1', kind: 'zone' } });
    const rooms = planGlow([part('alarm')], [{ id: 'L0', elevation_m: 0, ceiling_height_m: 2.7 }], []);
    expect(rooms).toHaveLength(1);
    const r = rooms[0];
    expect(r).toMatchObject({ zone: 'z1', alarm: 1, lit: 0, presence: 0, ceiling: 2.7 });
    expect(r.outline).toHaveLength(4);
    expect(r.barInner).toHaveLength(4);
    expect(Math.min(...r.barInner.map((p) => p[0]))).toBeCloseTo(MARK_BAR_M, 4);
    expect(barHeight(r, null, null)).toBeCloseTo(2.7, 6); // nothing cut: the top of the walls
    expect(barHeight(r, 1.25, 'L0')).toBeCloseTo(1.25, 6); // the cut of its level
    expect(barHeight(r, 1.25, 'L1')).toBeCloseTo(2.7, 6); // another level's cut
  });
});

test('the low cut (Q-MAP-13): 1.25 m by default, 0.6 of the ceiling as before', () => {
  expect(DEFAULT_REAL.wallCut).toBe('low');
  const lv = { elevation_m: 3, ceiling_height_m: 2.8 };
  expect(sectionCutY(lv, 'low')).toBeCloseTo(3 + LOW_CUT_M, 6);
  expect(sectionCutY(lv, undefined)).toBeCloseTo(3 + LOW_CUT_M, 6);
  expect(sectionCutY(lv, 'mid')).toBeCloseTo(3 + 2.8 * 0.6, 6);
  expect(sectionCutY({ elevation_m: 0, ceiling_height_m: 1.8 }, 'low')).toBeCloseTo(1.8 * 0.6, 6); // never above 0.6 of a low ceiling
});

test('travertine (Q-MAP-11): a fourth finish, honed, deterministic, reflecting little', () => {
  expect(FLOOR_FINISHES).toContain('travertine');
  expect(finishMaterial('travertine')).toBe(FINISH_TRAVERTINE);
  const a = finishPixels(FINISH_TRAVERTINE, 64);
  expect(Buffer.from(finishPixels(FINISH_TRAVERTINE, 64)).equals(Buffer.from(a))).toBe(true);
  // warm beige: red over blue on average
  let r = 0, b = 0;
  for (let i = 0; i < a.length; i += 4) { r += a[i]; b += a[i + 2]; }
  expect(r).toBeGreaterThan(b * 1.1);
  expect(floorReflectivity(FINISH_TRAVERTINE)).toBeGreaterThan(0);
  expect(floorReflectivity(FINISH_TRAVERTINE)).toBeLessThan(floorReflectivity('finish_ceramic'));
  const s = finishSurfacePixels(FINISH_TRAVERTINE, 64);
  let rough = 0;
  for (let i = 1; i < s.rough.length; i += 4) rough += s.rough[i];
  expect(rough / (s.rough.length / 4) / 255).toBeGreaterThan(0.35); // honed, not polished
});

test('the editor removes the automatic items in one edit; manual, imported and locked stay (Q-MAP-9)', () => {
  const wall = (id: string, source: string, locked = false) => ({ id, source, locked }) as unknown as GeometryDoc['walls'][number];
  const doc = {
    walls: [wall('a1', 'auto'), wall('a2', 'auto', true), wall('m1', 'manual'), wall('i1', 'imported')],
    openings: [{ id: 'o1', wall_id: 'a1', source: 'manual' }, { id: 'o2', wall_id: 'm1', source: 'auto' }, { id: 'o3', wall_id: 'm1', source: 'manual' }],
    objects: [{ id: 'b1', source: 'auto', locked: false }, { id: 'b2', source: 'auto', locked: true }],
  } as unknown as GeometryDoc;
  expect(autoItemCount(doc)).toBe(4);
  const r = removeAutoItems(doc);
  expect(r).toMatchObject({ walls: 1, openings: 2, objects: 1 });
  expect(r.doc.walls.map((w) => w.id)).toEqual(['a2', 'm1', 'i1']);
  expect(r.doc.openings.map((o) => o.id)).toEqual(['o3']);
  expect(r.doc.objects.map((o) => o.id)).toEqual(['b2']);
  const clean = removeAutoItems(r.doc);
  expect(clean.doc).toBe(r.doc); // nothing left to remove: the same document (no undo step)
});
