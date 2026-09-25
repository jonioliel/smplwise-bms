import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DetectResult } from '../src/api/geometry';
import { buildPrimitives, type GeometryDoc } from '../src/map/geometry';
import { allIds, byConfidence, byKind, candidatesDoc, defaultStates, fromResult, moveVertex, rescale, withParents } from '../src/map/candidates';

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
