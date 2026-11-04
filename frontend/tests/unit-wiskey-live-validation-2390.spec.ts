import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { confirmMatches, detailLine, runFinished, statusKind, validationHref, VALIDATION_HREF, type CheckResult } from '../src/api/wiskey-validation';

// WISKEY-LIVE-VALIDATION-2390: the pure helpers of הגדרות › בדיקת קבלה לעמדות (src/api/wiskey-validation.ts) and the wiring of the screen
// (its route, its lazy chunk, the settings card, the station drawer's one line). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-live-validation-2390.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (p: string) => readFileSync(path.join(SRC, p), 'utf8');

const check = (over: Partial<CheckResult>): CheckResult => ({
  check: 'identity', label: 'זהות העמדה', status: 'pass', status_text: 'עבר', reason: null, reason_text: null, detail: {}, started_at: null, finished_at: null, ...over,
});

test('the typed confirmation is exactly the station name (outer spaces ignored), else its id', () => {
  const st = { id: 'st-a', name: 'לובי ראשי' };
  expect(confirmMatches(st, 'לובי ראשי')).toBe(true);
  expect(confirmMatches(st, '  לובי ראשי ')).toBe(true);
  for (const typed of ['לובי', 'לובי  ראשי', 'st-a', '', 'לובי ראשי!']) expect(confirmMatches(st, typed)).toBe(false);
  expect(confirmMatches({ id: 'st-b', name: '' }, 'st-b')).toBe(true);
  expect(confirmMatches({ id: '', name: '' }, '')).toBe(false);
});

test('every status has its own badge kind, and only a finished run stops the polling', () => {
  const kinds = (['pass', 'fail', 'unsupported', 'not_run', 'running', 'pending'] as const).map(statusKind);
  expect(new Set(kinds).size).toBe(6);
  expect(statusKind('pass')).toBe('live');
  expect(statusKind('fail')).toBe('error');
  expect(runFinished({ state: 'running' })).toBe(false);
  for (const s of ['done', 'cancelled', 'interrupted'] as const) expect(runFinished({ state: s })).toBe(true);
});

test('the detail line says only what the server kept', () => {
  expect(detailLine(check({ check: 'clock', detail: { skew_seconds: 0.43, source: 'wiskey' } }))).toBe('סטייה 0.4 שנ׳ · קריאה עדכנית');
  expect(detailLine(check({ check: 'events', detail: { stream: 'connected', source: 'feed' } }))).toBe('זרם: connected · מהעותק השמור');
  expect(detailLine(check({ check: 'media_arx', detail: { source: 'arx', bytes: 40960 } }))).toBe('תמונה 40 KB');
  expect(detailLine(check({ check: 'door_read', detail: { doors: [{ door: 1, result: 'pass' }, { door: 2, result: 'fail' }] } }))).toBe('דלת 1: עבר, דלת 2: נכשל');
  expect(detailLine(check({ check: 'pulse', detail: { door: 1, witness_name: 'דנה כהן', witness: 'opened' } }))).toBe('דלת 1 · עד: דנה כהן');
  expect(detailLine(check({ check: 'talk', detail: { transport: 'pcmu_frames', busy: true } }))).toBe('pcmu_frames · תפוס כרגע');
  expect(detailLine(check({ detail: {} }))).toBe('');
});

test('the route, the station link and the wiring', () => {
  expect(VALIDATION_HREF).toBe('#/system/wiskey-validation');
  expect(validationHref('st a/1')).toBe('#/system/wiskey-validation?station=st%20a%2F1');
  expect(read('shell/sw-app.ts')).toContain("if (s[1] === 'wiskey-validation') return html`<system-wiskey-validation></system-wiskey-validation>`;");
  expect(read('shell/lazy-screens.ts')).toContain("'system-wiskey-validation': () => import('../screens/system-wiskey-validation')");
  const diag = read('screens/system-diagnostics.ts');
  expect(diag).toContain("import './system-wiskey-validation-card';");
  expect(diag).toContain('<system-wiskey-validation-card></system-wiskey-validation-card>');
  const views = read('screens/wiskey-stations-views.ts');
  expect(views.split('\n').filter((l) => l.includes('liveValidationRow(')).length).toBe(1);
  const tech = views.slice(views.indexOf('function technical('), views.indexOf('function fetchNote('));
  expect(tech).toContain('${liveValidationRow(s.id)}');
});

test('the physical action is marked, separate and never in "run all"', () => {
  const src = read('screens/system-wiskey-validation.ts');
  expect(src).toContain("const PHYSICAL = 'פעולה פיזית - דלת תיפתח';");
  expect(src).toContain('variant="danger" icon="doorOpen"');
  const runAll = src.slice(src.indexOf('data-lv-run-all'), src.indexOf('data-lv-run-all') + 200);
  expect(runAll).not.toContain('Pulse');
  expect(src).not.toMatch(/setInterval|setTimeout\(\(\) => void this\.start/);
  for (const f of ['screens/system-wiskey-validation.ts', 'screens/system-wiskey-validation-card.ts', 'api/wiskey-validation.ts', 'wiskey/live-validation-link.ts']) {
    expect(read(f)).not.toContain('Home Assistant');
  }
});
