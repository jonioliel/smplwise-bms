import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectResult } from '../src/api/geometry';
import { buildPrimitives, type GeometryDoc } from '../src/map/geometry';
import { OUTSIDE_MAIN_HE, allIds, byConfidence, byKind, candidatesDoc, defaultStates, fromResult, isOutsideMain, moveVertex, objectCandidateLabel, objectsSummary, outsideMainSummary, rescale, withParents, type CandidateSet } from '../src/map/candidates';

// Plan Studio phase 3 (T086): the pure candidate-set operations the editor's detect tool runs on. Node only.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sample = () => JSON.parse(fs.readFileSync(path.resolve(HERE, '..', '..', 'contracts', 'fixtures', 'plan_geometry', 'sample-v2.json'), 'utf8')) as GeometryDoc;

const wall = (id: string, polyline: [number, number][], confidence: number) => ({ id, level_id: 'L0', polyline, thickness_m: 0.16, height_m: null, base_z_m: 0, kind: 'interior' as const,
  confidence, source: 'auto' as const, locked: false, external_ids: {} });
const opening = (id: string, wall_id: string, kind: 'door' | 'window' | 'passage', confidence: number) => ({ id, wall_id, t: 0.5, kind, width_m: 0.9, height_m: 2.1, sill_m: 0,
  swing: kind === 'door' ? ('left' as const) : ('none' as const), hinge: 'start' as const, anchor_ref: null, confidence, source: 'auto' as const, external_ids: {} });

function result(): DetectResult {
  return {
    walls: [wall('auto-r-w001', [[0.1, 0.1], [0.9, 0.1]], 0.95), wall('auto-r-w002', [[0.1, 0.1], [0.1, 0.9]], 0.7), wall('auto-r-w003', [[0.5, 0.1], [0.5, 0.9]], 0.4)],
    openings: [opening('auto-r-o001', 'auto-r-w001', 'door', 0.9), opening('auto-r-o002', 'auto-r-w003', 'window', 0.6), opening('auto-r-o003', 'auto-r-w002', 'passage', 0.45)],
    detector: { name: 'plan_detect', version: '1.0', params: {} }, calibration_hint: null,
    pixels: { 'auto-r-w001': { thickness_px: 16 }, 'auto-r-w002': { thickness_px: 16 }, 'auto-r-w003': { thickness_px: 10 }, 'auto-r-o001': { width_px: 90 }, 'auto-r-o002': { width_px: 120 }, 'auto-r-o003': { width_px: 100 } },
    scale: { m_per_px: 0.01, status: 'measured' }, stats: {}, version_id: 'v1', level_id: 'L0', existing_auto: { walls: 0, openings: 0 },
  };
}

test('a candidate set draws through the same primitives as the structure', () => {
  const set = fromResult(result());
  expect(set.scaleMPerPx).toBe(0.01);
  const doc = candidatesDoc(sample(), set);
  expect(doc.labels).toEqual([]);
  expect(doc.connectors).toEqual([]); // live connectors never leak into the candidate overlay (Task 8 review)
  const prims = buildPrimitives(doc, 1000, 800);
  expect(prims.filter((p) => p.kind === 'wall').length).toBe(6); // three walls, each cut once by its opening
  expect(prims.filter((p) => p.kind === 'door').length).toBe(1);
  expect(prims.filter((p) => p.kind === 'window').length).toBe(1);
  expect(prims.filter((p) => p.kind === 'passage').length).toBe(1);
  expect(defaultStates(set)).toEqual(Object.fromEntries(allIds(set).map((id) => [id, 'accepted'])));
});

test('rescale recomputes the metres from the pixels', () => {
  const set = fromResult(result());
  const two = rescale(set, 0.02);
  expect(two.walls[0].thickness_m).toBeCloseTo(0.32, 6);
  expect(two.openings[0].width_m).toBeCloseTo(1.8, 6);
  expect(two.scaleMPerPx).toBe(0.02);
  expect(set.walls[0].thickness_m).toBe(0.16); // the input is untouched
  const tiny = rescale(set, 0.0001);
  expect(tiny.walls[0].thickness_m).toBe(0.02); // never under the validator's floor
});

test('selection rules: everything, above a confidence, by kind, always with the parent wall', () => {
  const set = fromResult(result());
  expect(allIds(set)).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003', 'auto-r-o001', 'auto-r-o002', 'auto-r-o003']);
  expect(byConfidence(set, 0.8)).toEqual(['auto-r-w001', 'auto-r-o001']);
  expect(byConfidence(set, 0.6)).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003', 'auto-r-o001', 'auto-r-o002']); // the window (0.6) brings its 0.4 wall along
  expect(byKind(set, ['door'])).toEqual(['auto-r-w001', 'auto-r-o001']);
  expect(byKind(set, ['wall'])).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003']);
  expect(withParents(set, ['auto-r-o003', 'auto-r-o003'])).toEqual(['auto-r-w002', 'auto-r-o003']);
});

test('moving a candidate wall end returns a new set and keeps the openings on the wall', () => {
  const set = fromResult(result());
  const moved = moveVertex(set, 'auto-r-w001', 1, [0.95, 0.12]);
  expect(moved.walls[0].polyline[1]).toEqual([0.95, 0.12]);
  expect(set.walls[0].polyline[1]).toEqual([0.9, 0.1]);
  expect(moved.openings[0].wall_id).toBe('auto-r-w001');
  expect(moveVertex(set, 'nope', 0, [0, 0])).toBe(set);
  expect(moveVertex(set, 'auto-r-w001', 1, [1.4, -0.2]).walls[0].polyline[1]).toEqual([1, 0]); // clamped to the plan
});

test('walls outside the main structure (detector 1.2 flags): kept in the set, named, counted in the summary (T087 review)', () => {
  const plain = fromResult(result());
  expect(plain.outsideMain).toEqual([]); // an older detector or the DXF import: no flags
  expect(outsideMainSummary(plain)).toBeNull();
  const one = fromResult({ ...result(), flags: { outside_main: ['auto-r-w003'] } });
  expect(isOutsideMain(one, 'auto-r-w003')).toBe(true);
  expect(isOutsideMain(one, 'auto-r-w001')).toBe(false);
  expect(outsideMainSummary(one)).toBe(`קיר אחד ${OUTSIDE_MAIN_HE} - בדוק לפני קבלה`);
  const two = fromResult({ ...result(), flags: { outside_main: ['auto-r-w002', 'auto-r-w003'] } });
  expect(outsideMainSummary(two)).toBe('2 קירות מחוץ למבנה הראשי - בדוק לפני קבלה');
  // selectable and acceptable like any candidate: every selection rule still offers them
  expect(allIds(two)).toContain('auto-r-w003');
  expect(byKind(two, ['wall'])).toEqual(['auto-r-w001', 'auto-r-w002', 'auto-r-w003']);
  expect(defaultStates(two)['auto-r-w003']).toBe('accepted');
  // the flag follows edits of the set, and only walls still in the set are counted
  expect(isOutsideMain(moveVertex(two, 'auto-r-w003', 1, [0.5, 0.8]), 'auto-r-w003')).toBe(true);
  const fewer: CandidateSet = { ...two, walls: two.walls.filter((w) => w.id !== 'auto-r-w002') };
  expect(outsideMainSummary(fewer)).toBe(`קיר אחד ${OUTSIDE_MAIN_HE} - בדוק לפני קבלה`);
});

test('the candidates layer draws a flagged wall with its own dash, a title and the flag in the pill (T087 review)', async ({ page }) => {
  await page.goto('/#/explore/floors/f0');
  const canvas = page.locator('explore-floor-map sw-plan-canvas');
  await expect(canvas).toBeVisible({ timeout: 20000 });
  const set = fromResult({ ...result(), flags: { outside_main: ['auto-r-w003'] } });
  await canvas.evaluate(async (n, a) => {
    const cv = n as HTMLElement & { geometry: unknown; candidates: unknown; selectedCandidateId: string | null; updateComplete: Promise<boolean> };
    cv.geometry = a.doc;
    cv.candidates = a.set;
    cv.selectedCandidateId = 'auto-r-w003';
    await cv.updateComplete;
  }, { doc: sample(), set });
  // the wall is cut by its window candidate into two drawn parts: both carry the flag
  const parts = canvas.locator('[data-candidates] [data-candidate="auto-r-w003"]');
  await expect(parts).toHaveCount(2);
  await expect(canvas.locator('[data-candidates] [data-candidate="auto-r-w003"][data-outside-main]')).toHaveCount(2);
  const flagged = parts.first();
  await expect(flagged).toHaveClass(/outside/);
  await expect(flagged.locator('title')).toHaveText(OUTSIDE_MAIN_HE);
  const dash = await flagged.locator('.cwall').evaluate((el) => getComputedStyle(el).strokeDasharray);
  const plainDash = await canvas.locator('[data-candidates] [data-candidate="auto-r-w001"] .cwall').first().evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(dash).not.toBe(plainDash);
  expect(dash).not.toBe('none'); // selected, it stays dashed (a selected plain candidate turns solid)
  await expect(canvas.locator('[data-candidates] [data-outside-main]')).toHaveCount(2); // no other candidate is flagged
  await expect(canvas.locator('[data-cand-score-for="auto-r-w003"]')).toContainText(OUTSIDE_MAIN_HE);
});

// Detector 1.4 (T086 tuning): /detect proposes tribunes and columns as object candidates.
const tribune = (id: string) => ({ id, item_id: 'tribune.stepped', level_id: 'L0', position: [0.5, 0.4] as [number, number], rotation_deg: 0, size: { w_m: 12, d_m: 5.4, h_m: 1.8 }, z_m: 0,
  params: { rows: 6, step_height_m: 0.3, step_width_m: 0.9, connects_levels: null } as Record<string, unknown>, label: null, anchor_ref: null, group_id: null, confidence: 0.8, source: 'auto' as const, locked: false, external_ids: {} });
const column = (id: string, x: number) => ({ ...tribune(id), item_id: 'column.square', position: [x, 0.8] as [number, number], size: { w_m: 0.9, d_m: 0.9, h_m: 2.8 }, params: {}, confidence: 0.6 });

function withObjects(): DetectResult {
  const r = result();
  return { ...r, objects: [tribune('auto-r-x001'), column('auto-r-x002', 0.2), column('auto-r-x003', 0.5)],
    pixels: { ...r.pixels, 'auto-r-x001': { w_px: 1200, d_px: 540 }, 'auto-r-x002': { w_px: 90, d_px: 90 }, 'auto-r-x003': { w_px: 90, d_px: 90 } } };
}

test('detected object candidates: drawn with the set, rescaled with it, summarised by kind', () => {
  const set = fromResult(withObjects());
  const catalog = (id: string) => (id === 'tribune.stepped' ? { shape: 'stepped' as const, icon: 'stairs', color_token: 'circulation' } : { shape: 'box' as const, icon: 'box', color_token: 'structure' });
  const prims = buildPrimitives(candidatesDoc(sample(), set), 1000, 800, null, catalog);
  const objects = prims.filter((p) => p.kind === 'object');
  expect(objects.map((p) => p.id)).toEqual(['auto-r-x001', 'auto-r-x002', 'auto-r-x003']);
  const t = objects.find((p) => p.id === 'auto-r-x001');
  expect(t && t.kind === 'object' ? t.steps.length : -1).toBe(5); // six rows: five lines between them
  expect(allIds(set)).not.toContain('auto-r-x001'); // objects go with the accept together, not one by one
  const half = rescale(set, 0.005);
  const tr = half.objects.find((o) => o.id === 'auto-r-x001')!;
  expect(tr.size).toEqual({ w_m: 6, d_m: 2.7, h_m: 1.8 });
  expect(tr.params.step_width_m).toBe(0.45);
  expect(half.objects.find((o) => o.id === 'auto-r-x002')!.size).toEqual({ w_m: 0.45, d_m: 0.45, h_m: 2.8 });
  // a DXF object carries no pixels: its metres are the drawing's and stay
  const dxf = fromResult({ ...result(), objects: [{ ...column('imp-r-x001', 0.3), source: 'imported' as const }] });
  expect(rescale(dxf, 0.005).objects[0].size).toEqual({ w_m: 0.9, d_m: 0.9, h_m: 2.8 });
  expect(objectsSummary(set, 'detect')).toBe('3 עצמים שזוהו (טריבונה, 2 עמודים)');
  expect(objectsSummary(dxf, 'dxf')).toBe('עצם אחד מהקובץ');
  expect(objectCandidateLabel('column.square')).toBe('עמוד');
});

test('the candidates layer draws object candidates dashed, faded while left out', async ({ page }) => {
  await page.goto('/#/explore/floors/f0');
  const canvas = page.locator('explore-floor-map sw-plan-canvas');
  await expect(canvas).toBeVisible({ timeout: 20000 });
  const set = fromResult(withObjects());
  const draw = (states: Record<string, string>) =>
    canvas.evaluate(async (n, a) => {
      const cv = n as HTMLElement & { geometry: unknown; candidates: unknown; candidateStates: unknown; updateComplete: Promise<boolean> };
      cv.geometry = a.doc;
      cv.candidates = a.set;
      cv.candidateStates = a.states;
      await cv.updateComplete;
    }, { doc: sample(), set, states });
  await draw({});
  await expect(canvas.locator('[data-candidates] [data-kind="object"]')).toHaveCount(3);
  await expect(canvas.locator('[data-candidates] [data-candidate="auto-r-x002"] title')).toHaveText('עמוד');
  const dash = await canvas.locator('[data-candidates] [data-candidate="auto-r-x001"] .cobj').evaluate((el) => getComputedStyle(el).strokeDasharray);
  expect(dash).not.toBe('none');
  await draw({ 'auto-r-x001': 'rejected', 'auto-r-x002': 'rejected', 'auto-r-x003': 'rejected' });
  await expect(canvas.locator('[data-candidates] [data-kind="object"].rejected')).toHaveCount(3);
});
