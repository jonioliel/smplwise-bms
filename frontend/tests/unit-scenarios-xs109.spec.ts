import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cmpsFor, draftProblems, leafPaths, newLeaf, stateTone, type Definition, type SignalDef } from '../src/api/scenarios';
import { SCT_KEYS, SCT_TABLES, sct } from '../src/i18n/scenarios';

// XSCENARIO109-295: the pure helpers of the scenarios editor and its strings. No browser.

const LIMITS = { depth: 4, leaves: 12, actions: 3 };
const sig = (over: Partial<SignalDef>): SignalDef => ({
  id: 'temperature.value', module: 'temperature', module_label: 'טמפרטורות', kind: 'number', label: 'טמפרטורה', label_en: 'Temperature', unit: '°C', max_age_s: 900,
  subject: 'temperature_unit', range: [-80, 150], default_margin: 0.5, default_debounce_s: 0, subjects: [{ id: 'u1', name: 'חדר קירור' }], ...over,
});

test('leaf paths match the server paths (when.items[i] / when.item)', () => {
  const d: Definition = { when: { op: 'and', items: [{ signal: 'a', cmp: 'is_true' }, { op: 'not', item: { signal: 'b', cmp: 'is_true' } }, { op: 'or', items: [{ signal: 'c', cmp: 'is_true' }] }] }, actions: [] };
  expect(leafPaths(d.when).map((x) => x.path)).toEqual(['when.items[0]', 'when.items[1].item', 'when.items[2].items[0]']);
});

test('a new leaf takes the first subject, a threshold inside the range, a window for time windows', () => {
  expect(newLeaf(sig({}))).toEqual({ signal: 'temperature.value', cmp: 'gt', subject: 'u1', value: 8 });
  const w = newLeaf(sig({ id: 'time.in_window', kind: 'bool', subject: 'window', range: null, subjects: [] }));
  expect(w.window).toEqual({ days: [0, 1, 2, 3, 4, 5, 6], from: '18:00', to: '07:00' });
  expect(w.subject).toBeUndefined();
  expect(newLeaf(sig({ id: 'presence.count', kind: 'count', subject: 'area', range: [0, 1000] })).value).toBe(1);
});

test('comparisons per kind', () => {
  expect(cmpsFor('bool')).toEqual(['is_true', 'is_false']);
  expect(cmpsFor('count')).not.toContain('between');
  expect(cmpsFor('number')).toContain('between');
});

test('client bounds mirror the server: empty group, depth, leaves, actions', () => {
  const leaf = { signal: 'time.after_hours', cmp: 'is_true' as const };
  expect(draftProblems({ when: { op: 'and', items: [] }, actions: [] }, LIMITS)).toEqual(['empty_group', 'no_actions']);
  const many: Definition = { when: { op: 'or', items: Array.from({ length: 13 }, () => leaf) }, actions: [{ type: 'set_flag', flag: 'x1', value: true }] };
  expect(draftProblems(many, LIMITS)).toEqual(['too_many_leaves']);
  let deep: Definition['when'] = leaf;
  for (let i = 0; i < 5; i += 1) deep = { op: 'not', item: deep };
  expect(draftProblems({ when: deep, actions: [{ type: 'set_flag', flag: 'x1', value: true }] }, LIMITS)).toEqual(['too_deep']);
  const acts = Array.from({ length: 4 }, () => ({ type: 'set_flag' as const, flag: 'x1', value: true }));
  expect(draftProblems({ when: leaf, actions: acts }, LIMITS)).toEqual(['too_many_actions']);
});

test('state tones', () => {
  expect([stateTone('ok'), stateTone('active'), stateTone('degraded'), stateTone('suppressed'), stateTone('off')]).toEqual(['ok', 'warn', 'bad', 'bad', 'off']);
});

test('every Hebrew key has an English column; placeholders fill; the platform is never named', () => {
  for (const k of SCT_KEYS) expect(SCT_TABLES.en[k], k).toBeTruthy();
  expect(sct('firesToday', { n: 3 }, 'he')).toBe('3 הפעלות היום');
  expect(sct('dayNames', undefined, 'he').split(',')).toHaveLength(7);
  for (const k of SCT_KEYS) expect(/Home Assistant|\bHA\b|YAML|engine|מנוע/i.test(SCT_TABLES.he[k] ?? ''), k).toBe(false);
});

test('the editor offers no operating action (closed set: notification, service request, flag)', () => {
  const here = fileURLToPath(new URL('.', import.meta.url));
  const src = readFileSync(join(here, '../src/screens/scenarios-panel.ts'), 'utf8');
  const types = [...src.matchAll(/type: '([a-z_]+)'/g)].map((m) => m[1]);
  expect(new Set(types)).toEqual(new Set(['notify', 'set_flag', 'create_service_request']));
});
