import { test, expect } from '@playwright/test';
import {
  KPI_ORDER, THRESHOLD_FIELDS, getReadinessChip, onReadinessChip, setReadinessChip, changedSettings, demoLeft, demoReadiness, filterChecks, gainText, kpiCounts, levelTone, points, validSetting, weightKey,
} from '../src/api/readiness';
import { AREA_TABS, TAB_PERMISSIONS } from '../src/shell/nav';
import { SETTINGS_GROUPS, visibleGroups } from '../src/screens/system-index';

// CR-READY96 slice 1: the pure helpers behind the readiness screen and the demo banner, and where the screen sits in the settings navigation.
// Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-readiness-96.spec.ts

test('the KPI counts add up and filter the checklist', () => {
  const r = demoReadiness();
  const n = kpiCounts(r.checks);
  expect(n.all).toBe(r.checks.length);
  expect(n.blocked + n.attention + n.ok + n.pending + n.not_applicable).toBe(n.all);
  for (const k of KPI_ORDER) expect(filterChecks(r.checks, k).length, k).toBe(n[k]);
  expect(filterChecks(r.checks, 'blocked').map((c) => c.id)).toEqual(['backup']);
});

test('points follow weight x fraction; a not-applicable check contributes nothing', () => {
  const r = demoReadiness();
  const backup = r.checks.find((c) => c.id === 'backup')!;
  expect(points(backup)).toEqual({ got: 6, of: 12 });
  const remote = r.checks.find((c) => c.id === 'remote')!;
  expect(points(remote)).toEqual({ got: 0, of: 8 });
});

test('the level decides the tone; zero gains print nothing', () => {
  expect(levelTone('building')).toBe('danger');
  expect(levelTone('almost')).toBe('warning');
  expect(levelTone('ready')).toBe('success');
  expect(gainText(0)).toBe('');
  expect(gainText(8)).toBe('+8');
});

test('the demo clock prints h:mm and ends at zero', () => {
  const t0 = Date.UTC(2026, 9, 24, 9, 0, 0);
  expect(demoLeft('2026-10-24T12:42:00Z', t0)).toBe('3:42');
  expect(demoLeft('2026-10-24T09:05:30Z', t0)).toBe('0:05');
  expect(demoLeft('2026-10-24T09:00:00Z', t0)).toBeNull();
  expect(demoLeft(undefined, t0)).toBeNull();
});

test('settings drafts: only changed keys are sent; values are whole numbers inside the server range', () => {
  const saved = { 'readiness.advice_score': '90', [weightKey('backup')]: '12' };
  expect(changedSettings(saved, { ...saved, 'readiness.advice_score': '80' })).toEqual({ 'readiness.advice_score': '80' });
  expect(changedSettings(saved, saved)).toEqual({});
  expect(validSetting('readiness.advice_score', '80')).toBe(true);
  expect(validSetting('readiness.advice_score', '0')).toBe(false);
  expect(validSetting('readiness.advice_score', '101')).toBe(false);
  expect(validSetting('readiness.advice_score', '8.5')).toBe(false);
  expect(validSetting('readiness.band_almost_min', '100')).toBe(false);
  expect(validSetting(weightKey('backup'), '0')).toBe(true);
  expect(validSetting(weightKey('backup'), '101')).toBe(false);
  expect(validSetting(weightKey('backup'), '')).toBe(false);
  expect(THRESHOLD_FIELDS.map((f) => f.key)).toContain('readiness.advice_score');
});

test('every threshold the server knows is editable on the screen, and the demo fixture carries them all', () => {
  const r = demoReadiness();
  for (const f of THRESHOLD_FIELDS) expect(Object.keys(r.settings), f.key).toContain(f.key);
  for (const c of r.checks) expect(Object.keys(r.settings), c.id).toContain(weightKey(c.id));
});

test('the settings score chip keeps only a valid recorded score, clamps it, and tells its listeners once per change', () => {
  let calls = 0;
  const off = onReadinessChip(() => { calls += 1; });
  setReadinessChip(null);
  expect(getReadinessChip()).toBeNull();
  expect(calls).toBe(0);
  setReadinessChip({ score: 84.4, level: 'almost' });
  expect(getReadinessChip()).toEqual({ score: 84, level: 'almost' });
  setReadinessChip({ score: 84, level: 'almost' }); // unchanged: no notification
  expect(calls).toBe(1);
  setReadinessChip({ score: 140, level: 'ready' });
  expect(getReadinessChip()).toEqual({ score: 100, level: 'ready' });
  setReadinessChip({ score: 'x', level: 'ready' }); // not a score: the chip goes away
  expect(getReadinessChip()).toBeNull();
  setReadinessChip({ score: 50, level: 'bogus' });
  expect(getReadinessChip()).toBeNull();
  expect(calls).toBe(3);
  off();
  setReadinessChip({ score: 10, level: 'building' });
  expect(calls).toBe(3);
  setReadinessChip(null);
});

test('the screen is a settings tab for system.configure holders only, with a search entry', () => {
  const tab = AREA_TABS.system.find((t) => t.id === 'readiness');
  expect(tab?.href).toBe('#/system/readiness');
  expect(AREA_TABS.system.findIndex((t) => t.id === 'readiness')).toBe(AREA_TABS.system.findIndex((t) => t.id === 'wizard') + 1);
  expect(TAB_PERMISSIONS['#/system/readiness']).toEqual(['system.configure']);
  expect(SETTINGS_GROUPS.flatMap((g) => g.entries).some((e) => e.href === '#/system/readiness')).toBe(true);
  const none = visibleGroups(true, () => false).flatMap((g) => g.entries).map((e) => e.href);
  expect(none).not.toContain('#/system/readiness');
});

// CMP2-POLISH-2480 (owner N49): the success / warning badges keep their fills; the label is the dark ink of that fill (>= 4.5:1, light
// and dark token values), not white (white on #22c55e / #f59e0b is about 2.3:1 / 2.1:1)
test('the readiness badges: dark ink on the success / warning fills', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/screens/system-readiness.ts', import.meta.url), 'utf8');
  expect(src).toMatch(/\.badge\.attention \{\s*background: var\(--sw-warning\);\s*color: var\(--sw-on-warning\);/);
  expect(src).toMatch(/\.badge\.ok \{\s*background: var\(--sw-success\);\s*color: var\(--sw-on-success\);/);
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const tokens = readFileSync(new URL('../src/design/tokens.ts', import.meta.url), 'utf8');
  const pair = (name: string) => tokens.match(new RegExp(`'${name}': lt\\('(#[0-9a-f]{6})', '(#[0-9a-f]{6})'\\)`))!.slice(1, 3);
  const ink = (name: string) => tokens.match(new RegExp(`'${name}': same\\('(#[0-9a-f]{6})'\\)`))![1];
  for (const [fill, on] of [['--sw-success', '--sw-on-success'], ['--sw-warning', '--sw-on-warning']] as const)
    for (const bg of pair(fill)) expect(ratio(ink(on), bg), `${on} on ${fill} ${bg}`).toBeGreaterThanOrEqual(4.5);
});