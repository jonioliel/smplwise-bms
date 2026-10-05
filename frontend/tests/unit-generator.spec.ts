import { test, expect } from '@playwright/test';
import { Caps, capsOf, customRangeError, engineRows, fill, filterQuery, EMPTY_FILTER, flowPlan, gaugeList, metricsOf, phaseTable, phoneKpis, plotSeries, renderTemplate, routeGroups, routingEmpty, availableVars, viewModeOf, alertCounts, sortOpen, toCsv } from '../src/generator/gen-logic';
import { normalizeViewMode, type GenAlert, type PolicyItem } from '../src/api/generator';
import { INFRA_TABS, applyInfraGenerator, visibleTabs } from '../src/shell/nav';
import { ROLES, deviceFor, valuesFor, typesFor, GROUPS } from './generator-fixtures';

// CR-031 GEN1: the capability logic (what is drawn for which roles), ranges, routing visibility, message templates, the tab gate. Pure functions, no browser.
const th = { fuel_low_pct: 25, battery_min_24v: 23.2, coolant_max_c: 95, oil_min_bar: 1, overload_pct: 100 };

test.describe('generator: capability set', () => {
  test('core = engine state + one generator voltage', () => {
    expect(new Caps(['engine_state', 'gen_v_l2']).core).toBe(true);
    expect(new Caps(['engine_state']).core).toBe(false);
    expect(new Caps(['gen_v_l1']).core).toBe(false);
    expect(capsOf(ROLES.minimal).phases).toEqual([0]);
    expect(capsOf(ROLES.full).phases).toEqual([0, 1, 2]);
  });

  test('flow plan: minimal is compact, no grid, no switch; a running generator feeds its load', () => {
    const p = flowPlan(valuesFor('minimal', 'run'), capsOf(ROLES.minimal), 'online');
    expect(p.layout).toBe('compact');
    expect(p.showMains || p.showAts).toBe(false);
    expect(p.onGen).toBe(true);
    expect(p.kwKnown).toBe(false);
  });
  test('flow plan: typical on generator and on mains', () => {
    const run = flowPlan(valuesFor('typical', 'run'), capsOf(ROLES.typical), 'online');
    expect(run).toMatchObject({ layout: 'full', showMains: true, showAts: true, onGen: true, atsTarget: 'gen', mainsOn: false, kw: 124 });
    const idle = flowPlan(valuesFor('typical', 'standby'), capsOf(ROLES.typical), 'online');
    expect(idle).toMatchObject({ onGen: false, atsTarget: 'grid', mainsOn: true, genRun: false, kw: null });
  });
  test('flow plan: an offline controller is stale', () => {
    const p = flowPlan(valuesFor('typical', 'unavail'), capsOf(ROLES.typical), 'offline');
    expect(p.stale).toBe(true);
    expect(p.engine).toBe('unknown');
  });
  test('flow plan: a switch role without a mains role still draws the switch', () => {
    const v = { ...valuesFor('minimal', 'run'), supply_source: { value: 'generator', unit: '', available: true, updated_at: null, label: '' } };
    const p = flowPlan(v, new Caps(['engine_state', 'gen_v_l1', 'supply_source']), 'online');
    expect(p.showAts).toBe(true);
    expect(p.showMains).toBe(false);
    expect(p.onGen).toBe(true);
  });

  test('gauges: only the roles that exist, in order, load only without fuel', () => {
    const roles = (l: 'minimal' | 'typical' | 'full') => gaugeList(valuesFor(l, 'run'), capsOf(ROLES[l]), th, 'running', 200).map((g) => g.role);
    expect(roles('minimal')).toEqual([]);
    expect(roles('typical')).toEqual(['battery_v', 'coolant_temp', 'load_pct']);
    expect(roles('full')).toEqual(['fuel_pct', 'battery_v', 'coolant_temp', 'oil_pressure']);
  });
  test('gauge tones follow the thresholds; oil is idle while stopped', () => {
    const v = valuesFor('full', 'run');
    v.fuel_pct.value = 20;
    v.coolant_temp.value = 99;
    const g = gaugeList(v, capsOf(ROLES.full), th, 'running', 200);
    expect(g.find((x) => x.role === 'fuel_pct')!.tone).toBe('err');
    expect(g.find((x) => x.role === 'coolant_temp')!.tone).toBe('err');
    const idle = gaugeList(valuesFor('full', 'standby'), capsOf(ROLES.full), th, 'stopped', 200).find((x) => x.role === 'oil_pressure')!;
    expect(idle.limit?.kind).toBe('idle');
    expect(idle.tone).toBe('ok');
  });

  test('phase table: columns and rows follow the roles', () => {
    expect(phaseTable(valuesFor('minimal', 'run'), capsOf(ROLES.minimal), 250)).toMatchObject({ cols: ['v'], multi: false });
    const t = phaseTable(valuesFor('typical', 'run'), capsOf(ROLES.typical), 250)!;
    expect(t.cols).toEqual(['v', 'a', 'bar']);
    expect(t.rows).toHaveLength(3);
    expect(t.sumA).toBe(537);
    const f = phaseTable(valuesFor('full', 'run'), capsOf(ROLES.full), 250)!;
    expect(f.cols).toEqual(['v', 'a', 'kw', 'bar']);
    expect(f.rows[0].kw).toBeCloseTo((231 * 180 * 0.86) / 1000, 1);
    expect(phaseTable(valuesFor('full', 'run'), capsOf(ROLES.full), null)!.cols).toEqual(['v', 'a', 'kw']);
  });

  test('engine rows, phone KPIs and chart metrics by capability', () => {
    expect(engineRows(capsOf(ROLES.minimal))).toEqual(['state']);
    expect(engineRows(capsOf(ROLES.full))).toEqual(['state', 'mode', 'hours', 'rpm', 'last_start', 'last_test', 'next_test', 'service']);
    expect(phoneKpis(valuesFor('typical', 'run'), capsOf(ROLES.typical)).map((k) => k.role)).toEqual(['load_pct', 'gen_kw', 'battery_v']);
    expect(phoneKpis(valuesFor('full', 'run'), capsOf(ROLES.full)).map((k) => k.role)).toEqual(['load_pct', 'gen_kw', 'fuel_pct']);
    expect(metricsOf(capsOf(ROLES.minimal)).map((m) => m.role)).toEqual(['gen_v_l1']);
    expect(metricsOf(capsOf(ROLES.full)).map((m) => m.role)).toEqual(['load_pct', 'gen_kw', 'gen_v_l1', 'fuel_pct', 'battery_v', 'coolant_temp', 'oil_pressure']);
    expect(metricsOf(new Caps(['engine_state', 'gen_v_l3'])).map((m) => m.role)).toEqual(['gen_v_l3']);
  });
});

test.describe('generator: charts, ranges, view mode', () => {
  test('a gap larger than 2.5 steps breaks the line', () => {
    const pts = [0, 300, 600, 3000, 3300].map((t) => ({ t, v: 50, min: 40, max: 60 }));
    const p = plotSeries(pts, 0, 3600, 300, 600, 120, [0, 100]);
    expect(p.lines).toHaveLength(2);
    expect(p.n).toBe(5);
    expect(p.min).toBe(40);
    expect(p.max).toBe(60);
  });
  test('an empty series has no path', () => {
    expect(plotSeries([], 0, 100, 60, 600, 120).lines).toEqual([]);
  });
  test('custom range validation', () => {
    const now = Date.parse('2026-10-05T12:00:00Z');
    expect(customRangeError('', '2026-10-05T10:00', 35, now)).toBe('missing');
    expect(customRangeError('2026-10-05T10:00', '2026-10-05T09:00', 35, now)).toBe('order');
    expect(customRangeError('2026-12-01T10:00', '2026-12-02T10:00', 35, now)).toBe('future');
    expect(customRangeError('2026-08-01T10:00', '2026-10-05T10:00', 35, now)).toBe('span');
    expect(customRangeError('2026-10-01T10:00', '2026-10-04T10:00', 35, now)).toBeNull();
  });
  test('view mode defaults to gauges; only charts is charts', () => {
    expect(viewModeOf(undefined)).toBe('gauges');
    expect(viewModeOf('x')).toBe('gauges');
    expect(viewModeOf('charts')).toBe('charts');
    expect(normalizeViewMode(null)).toBe('gauges');
  });
  test('csv has one row per bucket and a header with units', () => {
    const csv = toCsv({ step_s: 300, source: 'rollup_5m', from: 0, to: 600, series: { fuel_pct: [{ t: 0, v: 90, min: 90, max: 90 }, { t: 300, v: 89, min: 89, max: 89 }] }, units: { fuel_pct: '%' }, labels: { fuel_pct: 'דלק' }, range: '24h' }, ['fuel_pct']);
    expect(csv.split('\n')).toHaveLength(3);
    expect(csv.split('\n')[0]).toContain('(%)');
  });
});

test.describe('generator: alerts and routing', () => {
  const mk = (id: string, severity: GenAlert['severity'], ack: boolean, at: string): GenAlert => ({ id, device_id: 'g1', device_name: 'x', key: 'k', group: null, title: id, severity, state: 'open', raised_at: at, cleared_at: null, last_at: at, count: 1, acknowledged: ack, acked_by: null, acked_at: null, ack_note: null });
  test('open alerts sort unacknowledged first, then severity, then newest', () => {
    const l = [mk('a', 'info', false, '2026-10-05T10:00:00Z'), mk('b', 'critical', true, '2026-10-05T11:00:00Z'), mk('c', 'alert', false, '2026-10-05T09:00:00Z'), mk('d', 'alert', false, '2026-10-05T12:00:00Z')];
    expect(sortOpen(l).map((x) => x.id)).toEqual(['d', 'c', 'a', 'b']);
    expect(alertCounts(l)).toEqual({ open: 4, unacked: 3, acked: 1 });
  });
  test('history filter query: window start, flags, ack tri-state', () => {
    const now = new Date('2026-10-05T12:00:00');
    const q = filterQuery({ ...EMPTY_FILTER, window: '7d', ack: 'no', severity: 'critical' }, 'g1', now);
    expect(q).toMatchObject({ device_id: 'g1', ack: false, severity: 'critical', limit: 100 });
    expect(new Date(q.from!).getDate()).toBe(28);
    expect(filterQuery({ ...EMPTY_FILTER, ack: 'yes' }, 'g1', now).ack).toBe(true);
  });
  const items = (level: 'minimal' | 'typical' | 'full'): PolicyItem[] => typesFor(level).map((t) => ({ key: t.key, group: t.group, title: t.title, title_en: '', default_severity: 'alert', event: '', available: t.available, needs: t.needs, message: '{name}', policy: null }));
  test('routing groups: a group with no available type is hidden; unavailable rows stay in a visible group', () => {
    const keys = (l: 'minimal' | 'typical' | 'full') => routeGroups(GROUPS, items(l)).map((g) => g.key);
    expect(keys('minimal')).toEqual(['engine', 'comm']);
    expect(keys('full')).toEqual(['engine', 'fuel', 'electrical', 'mains', 'maintenance', 'comm']);
    const eng = routeGroups(GROUPS, items('minimal'))[0];
    expect(eng.items.filter((i) => !i.available).length).toBeGreaterThan(0);
  });
  test('routing starts empty and stops being empty with one recipient', () => {
    const l = items('full');
    expect(routingEmpty(l)).toBe(true);
    l[0] = { ...l[0], policy: { enabled: true, severity: null, recipients: { roles: ['operator'], users: [] }, channels: [], quiet_mode: 'matrix', escalate: false, after_s: 0, row_version: 1 } };
    expect(routingEmpty(l)).toBe(false);
  });
  test('message template: a clause with a missing variable is dropped', () => {
    const tpl = 'כשל התנעה: {device} לא התניע ב-{time}. מתח מצבר {battery}, מפלס דלק {fuel}.';
    expect(renderTemplate(tpl, { device: 'גנרטור', time: '14:02', battery: '23.1 V', fuel: '58%' })).toBe('כשל התנעה: גנרטור לא התניע ב-14:02. מתח מצבר 23.1 V, מפלס דלק 58%.');
    const noFuel = renderTemplate(tpl, { device: 'גנרטור', time: '14:02', battery: '23.1 V' });
    expect(noFuel).toContain('מתח מצבר 23.1 V');
    expect(noFuel).not.toContain('דלק');
    expect(noFuel).not.toContain('{');
    expect(renderTemplate(tpl, { device: 'גנרטור', time: '14:02' })).toBe('כשל התנעה: גנרטור לא התניע ב-14:02.');
  });
  test('template variables follow the capabilities', () => {
    expect(availableVars(capsOf(ROLES.minimal))).not.toContain('battery');
    expect(availableVars(capsOf(ROLES.full))).toEqual(expect.arrayContaining(['battery', 'fuel', 'load', 'device']));
    expect(fill('{n} מתוך {total}', { n: 3, total: 9 })).toBe('3 מתוך 9');
  });
});

test.describe('generator: navigation gate', () => {
  const can = () => true;
  test('the tab is hidden until a generator is detected, and the meters tab stays', () => {
    applyInfraGenerator(false);
    expect(visibleTabs(INFRA_TABS, true, can).map((t) => t.id)).toEqual(['electricity']);
    applyInfraGenerator(true);
    expect(visibleTabs(INFRA_TABS, true, can).map((t) => t.id)).toEqual(['electricity', 'generator']);
  });
  test('without generator.view the tab is not offered; the static demo never shows it', () => {
    applyInfraGenerator(true);
    expect(visibleTabs(INFRA_TABS, true, (p) => p !== 'generator.view').map((t) => t.id)).toEqual(['electricity']);
    expect(visibleTabs(INFRA_TABS, false).map((t) => t.id)).toEqual(['electricity']);
  });
  test('fixtures: the detail payload carries only the roles of its level', () => {
    expect(deviceFor('g1', 'x', 'minimal', 'run').capabilities.roles).toEqual(ROLES.minimal);
    expect(Object.keys(deviceFor('g1', 'x', 'full', 'run').values!)).toHaveLength(ROLES.full.length);
  });
});
