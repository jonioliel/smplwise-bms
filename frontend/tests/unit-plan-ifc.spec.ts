import { test, expect } from '@playwright/test';
import type { DetectResult, IfcImportReport } from '../src/api/geometry';
import { fromResult, objectsSummary } from '../src/map/candidates';
import { ifcReason, ifcSkippedLines, ifcSummary, ifcT } from '../src/i18n/plan-ifc';

// Plan Studio 8 (CR-037): the pure parts of the IFC import's UI - the report lines and the candidate source. Node only.

function report(over: Partial<IfcImportReport> = {}): IfcImportReport {
  return {
    schema: 'IFC4', entities: 120, metres_per_unit: 1, ms: 12,
    storeys: [{ index: 0, name: 'קרקע', elevation_m: 0, chosen: true }],
    counts: { walls: 3, openings: 2, objects: 0, rooms: 1 },
    skipped: [], skipped_total: 0, skipped_by_reason: {}, warnings: [],
    alignment: { dx_m: 0, dy_m: 0, fits: true, needed_m: null, plan_m: [10, 8] },
    ...over,
  };
}

test('the summary line names what was read, what was skipped and the storey chosen', () => {
  expect(ifcSummary(report(), 'he')).toBe('נקראו 3 קירות, 2 פתחים, 1 חדרים');
  expect(ifcSummary(report(), 'en')).toBe('Read 3 walls, 2 openings, 1 rooms');
  const two = report({
    storeys: [{ index: 0, name: 'קרקע', elevation_m: 0, chosen: false }, { index: 1, name: 'ראשונה', elevation_m: 3, chosen: true }],
    skipped_total: 4, skipped_by_reason: { other_storey: 3, unsupported_class: 1 },
    alignment: { dx_m: -10, dy_m: -5, fits: true, needed_m: [6, 4], plan_m: [6.4, 4] },
  });
  expect(ifcSummary(two, 'he')).toBe('נקראו 3 קירות, 2 פתחים, 1 חדרים · דולגו 4 · ראשונה (2 קומות בקובץ) · המודל הוזז לראשית התוכנית');
  const big = report({ counts: { walls: 0, openings: 0, objects: 0, rooms: 0 }, alignment: { dx_m: -10, dy_m: -5, fits: false, needed_m: [12, 9], plan_m: [6.4, 4] } });
  expect(ifcSummary(big, 'en')).toBe('Read 0 · the model is larger than the plan (12 × 9 מ׳)');
});

test('the skipped lines are grouped by reason, most frequent first, with a short label per reason', () => {
  const r = report({ skipped_total: 9, skipped_by_reason: { unsupported_class: 2, other_storey: 5, live_device: 1, zzz_unknown: 1 } });
  expect(ifcSkippedLines(r, 8, 'he')).toEqual(['קומה אחרת בקובץ: 5', 'סוג לא נתמך: 2', 'מצלמה / ישות (לא מיובאות): 1', 'zzz_unknown: 1']);
  expect(ifcSkippedLines(r, 2, 'en')).toEqual(['another storey of the file: 5', 'unsupported class: 2', 'and 2']);
  expect(ifcReason('outside_plan', 'he')).toBe('מחוץ לתוכנית');
  expect(ifcReason('made_up', 'he')).toBe('made_up');
  expect(ifcT('importIfc', 'he')).toBe('ייבוא IFC');
});

test('an IFC candidate set reads like a DXF one: objects "from the file", the report carried along', () => {
  const r: DetectResult = {
    walls: [], openings: [],
    objects: [{ id: 'imp-a-x001', item_id: 'chair.basic', level_id: 'L0', position: [0.2, 0.2], rotation_deg: 0, size: { w_m: 0.45, d_m: 0.45, h_m: 0.85 }, z_m: 0, params: {}, label: null,
      anchor_ref: null, group_id: null, confidence: 0.9, source: 'imported', locked: false, external_ids: { ifc_guid: '0000000000000000000000' } }],
    detector: { name: 'plan_ifc_read', version: '1.0', params: {} }, calibration_hint: null, pixels: {}, scale: { m_per_px: 0.01, status: 'measured' }, stats: {},
    version_id: 'v1', level_id: 'L0', existing_auto: { walls: 0, openings: 0, objects: 0 },
    ifc: report(),
  };
  const set = fromResult(r);
  expect(objectsSummary(set, 'ifc')).toBe('עצם אחד מהקובץ');
  expect(objectsSummary(set, 'dxf')).toBe('עצם אחד מהקובץ');
  expect(objectsSummary(set, 'detect')).not.toContain('מהקובץ');
  expect(r.ifc?.counts.walls).toBe(3);
});
