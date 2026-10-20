import { test, expect } from '@playwright/test';
import { addAffordances, bodyOf, chipsOf, deg, doorRuns, draftOf, durationText, eventText, eventValue, fmt1, gaugeRange, hoursOf, hvacText, kpisOf, linePath, frameOf, matchesKpi,
  newDraft, problemOf, ruleOf, setRule, stateRuns, stepPath, windowText, LOOK_OF } from '../src/temperature/model';
import { TT_DEV_MARKED, TT_KEYS, TT_TABLES, tt } from '../src/i18n/temperature';
import { INFRA_TABS, activeAreaTab, applyInfraTemperature, visibleTabs } from '../src/shell/nav';
import type { ManagedUnit, TempEvent, TempUnit } from '../src/api/temperature';

// CR-INFRA-TEMPERATURE 2.9.1: the presentation of the server-decided status (chips, KPIs, gauge, lines, ring, timeline), the wizard's draft
// and checks, the strings and the tab gate. Pure functions, no browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-temperature.spec.ts

const NOW = Date.parse('2026-10-19T10:42:00Z');
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();

const unit = (extra: Partial<TempUnit> = {}): TempUnit => ({
  id: 'u1', name: 'מקרר מטבח', kind: 'fridge', area_id: null, area_name: 'מטבח', low: 2, high: 6, hard_max: 11, band_mode: 'fixed', source: 'sensor', hvac: null,
  status: 'ok', value: 4.1, value_last: null, updated_at: iso(1), trend: null, temp_sensor_name: 'טמפרטורה מקרר', door: null, events: [],
  defrost: { mode: 'none', in_window: false, next_at: null, state: 'none', days: 0, windows: [] }, muted_until: null,
  rules: { warn_on_excursion: true, high_alarm: true, high_alarm_min: 10, low_alarm: true, low_alarm_min: 15, door_alarm: true, door_alarm_min: 10, offline_warn: true, offline_min: 15,
    quiet_enabled: false, quiet_from: '23:00', quiet_to: '06:00', exclude_defrost_stats: true, setpoint_tolerance: 2, alert_when_off: false },
  stats_24h: { min: 2.5, max: 5.5, avg: 4, out_min: 0, out_min_raw: 0, door_opens: 0, door_total_min: 0, door_longest_min: 0, alarms: 0, warnings: 0 }, stale: false, ...extra,
});
const ev = (extra: Partial<TempEvent>): TempEvent => ({
  id: 'e1', unit_id: 'u1', kind: 'high', severity: 'warning', started_at: iso(6), warned_at: iso(6), alarmed_at: null, ended_at: null, value: 6.8, peak: 7.1, threshold: 6,
  suppressed: null, ack_at: null, ack_by_name: null, notified: true, alarm_at: iso(-4), detail: {}, ...extra,
});

test('numbers use one decimal and a real minus sign; durations read naturally', () => {
  expect(fmt1(-18.44)).toBe('−18.4');
  expect(fmt1(-0.01)).toBe('0.0');
  expect(fmt1(null)).toBe('—');
  expect(deg(6)).toBe('6°');
  expect(deg(-22.5)).toBe('−22.5°');
  expect(durationText(14)).toBe('14 דק׳');
  expect(durationText(130)).toBe('2 שע׳ 10 דק׳');
  expect(durationText(120)).toBe('2 שע׳');
  expect(durationText(3000)).toBe('2 ימים');
  expect(windowText({ start_min: 23 * 60 + 50, minutes: 30 })).toBe('23:50–00:20');
});

test('the card chips: door, excursion with "alarm in", outage, defrost, mute, acknowledged', () => {
  const u = unit({
    status: 'warning', door: { open: true, since: iso(14), sensor_name: 'דלת' }, events: [ev({}), ev({ id: 'e2', kind: 'offline', severity: 'warning', started_at: iso(42) })],
    defrost: { mode: 'fixed', in_window: false, next_at: '2026-10-19T12:00:00Z', state: 'fixed', days: 0, windows: [] }, muted_until: '2026-10-19T11:30:00Z',
  });
  const chips = chipsOf(u, NOW, 'he-IL');
  expect(chips.map((c) => c.id)).toEqual(['door', 'ev-e1', 'ev-e2', 'defrost', 'mute']);
  expect(chips[0].tone).toBe('doorOpen');
  expect(chips[0].text).toBe('דלת פתוחה · 14 דק׳');
  expect(chips[1].text).toContain('אזעקה בעוד 4 דק׳');
  expect(chips[1].tone).toBe('warn');
  expect(chips[2].tone).toBe('off');
  // a stale list: the door is unknown, nothing is claimed
  expect(chipsOf({ ...u, stale: true, events: [], muted_until: null }, NOW)[0].text).toBe('דלת: לא ידוע');
  // acknowledged
  const acked = chipsOf(unit({ status: 'alarm', events: [ev({ severity: 'alarm', alarmed_at: iso(1), ack_at: iso(0), ack_by_name: 'יוני', alarm_at: null })] }), NOW);
  expect(acked.map((c) => c.id)).toEqual(['ev-e1', 'ack-e1']);
  expect(acked[0].tone).toBe('err');
});

test('a climate unit shows its mode / action and setpoint; off is its own grey state', () => {
  const u = unit({ source: 'climate', hvac: { setpoint: 22, setpoint_low: null, setpoint_high: null, hvac_mode: 'cool', hvac_action: 'cooling' } });
  const chips = chipsOf(u, NOW);
  expect(chips.map((c) => c.id)).toEqual(['hvac', 'setpoint']);
  expect(chips[0].text).toBe('קירור · מקרר כעת');
  expect(chips[1].text).toBe('יעד ⁦22°⁩');
  const off = chipsOf(unit({ status: 'off', source: 'climate', hvac: { setpoint: 22, setpoint_low: null, setpoint_high: null, hvac_mode: 'off', hvac_action: 'off' } }), NOW);
  expect(off.map((c) => c.text)).toEqual(['כבוי']);
  expect(LOOK_OF.off).toBe('idle');
  expect(hvacText('heat_cool', null)).toBe('חימום/קירור');
  expect(hvacText('weird_mode', 'odd')).toBe('weird_mode · odd'); // unknown values as they come, never guessed
});

test('KPIs count by status; door open now; a stale list counts nothing as healthy; off counts with OK', () => {
  const list = [unit({ id: 'a' }), unit({ id: 'b', status: 'alarm', door: { open: true, since: iso(1), sensor_name: '' } }), unit({ id: 'c', status: 'offline' }), unit({ id: 'd', status: 'off' })];
  expect(kpisOf(list, false)).toEqual({ total: 4, ok: 2, warning: 0, alarm: 1, door: 1, offline: 1, health: 0 }); // phase 3: + sensor health
  expect(kpisOf(list, true)).toEqual({ total: 4, ok: 0, warning: 0, alarm: 0, door: 0, offline: 0, health: 0 });
  expect(list.filter((u) => matchesKpi(u, 'door', false)).map((u) => u.id)).toEqual(['b']);
  expect(list.filter((u) => matchesKpi(u, 'ok', false)).map((u) => u.id)).toEqual(['a', 'd']);
  expect(list.filter((u) => matchesKpi(u, null, false))).toHaveLength(4);
});

test('add affordances only for a manager in page edit mode', () => {
  expect(addAffordances(true, true)).toEqual({ newButton: true, addCard: true, doneButton: true });
  expect(addAffordances(true, false)).toEqual({ newButton: false, addCard: false, doneButton: false });
  expect(addAffordances(false, true)).toEqual({ newButton: false, addCard: false, doneButton: false });
});

test('the gauge range always shows the band and the reading; lines lift the pen over a gap; the setpoint is a step line', () => {
  const g = gaugeRange(2, 6, [12]);
  expect(g.frac(2)).toBeGreaterThan(0);
  expect(g.frac(12)).toBeLessThan(1);
  expect(g.frac(-100)).toBe(0);
  const f = frameOf([[0, 4], [60, 5]], 2, 6, 0, 3600, 300, 50);
  expect(linePath([[0, 4], [60, 5], [2000, 5]], f, 900).match(/M/g)).toHaveLength(2);
  const s = stepPath([[0, 22], [300, 22], [600, 23], [700, null], [900, 23]], f, 900);
  expect(s.startsWith('M')).toBe(true);
  expect(s).toContain('H');
  expect(s.match(/M/g)).toHaveLength(2); // the null breaks the line
});

test('the 24-hour ring: the worst state per hour; a defrost hour below the hard max is "defrost"', () => {
  const t = (h: number, m = 0) => (Date.parse('2026-10-19T00:00:00Z') + (h * 60 + m) * 60_000) / 1000;
  const now = Date.parse('2026-10-19T23:30:00Z');
  const pts: [number, number][] = [[t(1), 4], [t(2), 6.5], [t(3), 8], [t(4, 10), 9]];
  const hrs = hoursOf(pts, 2, 6, now, [[t(4), t(4, 30)]], 11);
  expect(hrs).toHaveLength(24);
  const at = (h: number) => hrs.find((x) => new Date(x.start).getUTCHours() === h)!.state;
  expect(at(1)).toBe('ok');
  expect(at(2)).toBe('warn');
  expect(at(3)).toBe('alarm');
  expect(at(4)).toBe('defrost');
  expect(at(5)).toBe('none');
  expect(hoursOf([[t(4, 10), 13]], 2, 6, now, [[t(4), t(4, 30)]], 11).find((x) => new Date(x.start).getUTCHours() === 4)!.state).toBe('alarm');
});

test('timeline runs fill the window; door openings never vanish', () => {
  const lo = 0;
  const hi = 3600_000;
  const runs = doorRuns([[600, 660]], lo, hi);
  expect(runs.map((r) => r.k)).toEqual(['none', 'open', 'none']);
  expect(runs.reduce((s, r) => s + r.pct, 0)).toBeGreaterThan(99);
  const st = stateRuns([[0, 4], [300, 7.5], [600, 4]], 2, 6, lo, hi, []);
  expect(st.map((r) => r.k)).toEqual(['ok', 'alarm', 'ok', 'none']);
});

test('log rows: event text, value and held reason', () => {
  expect(eventText(ev({}))).toBe('טמפרטורה מעל ⁦6°⁩');
  expect(eventText(ev({ kind: 'door', threshold: 10 }))).toBe('דלת פתוחה יותר מ־10 דק׳');
  expect(eventText(ev({ kind: 'ack', ack_by_name: 'דנה' }))).toBe('התראה אושרה · דנה');
  expect(eventValue(ev({ kind: 'offline', value: 5.2 }))).toBe('⁦5.2°⁩ (אחרון)');
  expect(eventValue(ev({ ended_at: iso(0) }))).toBe('7.1°'); // closed: the peak
});

test('the wizard draft: checks per step, overrides only when different from the default, the body', () => {
  const d = newDraft();
  expect(d.defrost_mode).toBe('learn'); // owner 2026-10-19: learning is the default when no window is entered
  expect(problemOf(d, 1)).toBe('needName');
  expect(problemOf({ ...d, name: 'x' }, 1)).toBe('needSensor');
  expect(problemOf({ ...d, name: 'x', temp_entity_id: 'sensor.a', low: 6, high: 6 }, 2)).toBe('bandInvalid');
  expect(problemOf({ ...d, defrost_mode: 'fixed' }, 3)).toBe('needWindow');
  const defaults = { high_alarm_min: 10, quiet_enabled: false };
  let x = setRule(d, defaults, 'high_alarm_min', 5);
  expect(x.rules).toEqual({ high_alarm_min: 5 });
  expect(ruleOf<number>(x, defaults, 'high_alarm_min')).toBe(5);
  x = setRule(x, defaults, 'high_alarm_min', 10);
  expect(x.rules).toEqual({}); // back to the default: follows later changes of the installation default
  const body = bodyOf({ ...d, name: ' מקרר ', temp_entity_id: 'sensor.a', door_entity_id: null, door_invert: true, band_mode: 'setpoint', defrost_windows: [{ start: '03:00', minutes: 30 }] });
  expect(body.name).toBe('מקרר');
  expect(body.door_invert).toBe(false);
  expect(body.band_mode).toBe('fixed'); // a sensor never follows a setpoint
  expect(body.defrost_windows).toEqual([]); // only a fixed mode sends windows
  expect(body.recipients).toBeNull();
  const climate = bodyOf({ ...d, name: 'מזגן', temp_entity_id: 'climate.ac', band_mode: 'setpoint' });
  expect(climate.band_mode).toBe('setpoint');
  const m: ManagedUnit = { id: 'u', name: 'n', kind: 'freezer', area_id: null, enabled: true, sort_order: 0, revision: 3, temp_entity_id: 'sensor.f', temp_sensor_name: '', temp_missing: false,
    door_entity_id: null, door_sensor_name: '', door_missing: false, door_invert: false, low: -22, high: -16, band_mode: 'fixed', source: 'sensor', rules: { door_alarm_min: 5 },
    recipients: { roles: [], users: ['x'], groups: [] }, defrost_mode: 'fixed', defrost_windows: [{ start: '03:00', minutes: 30 }] };
  const back = bodyOf(draftOf(m));
  expect(back.revision).toBe(3);
  expect(back.recipients).toEqual({ roles: [], users: ['x'], groups: [] });
  expect(back.defrost_windows).toEqual([{ start: '03:00', minutes: 30 }]);
});

test('strings: English is complete; Arabic and Russian are dev-marked partial translations; placeholders survive', () => {
  const missingEn = TT_KEYS.filter((k) => TT_TABLES.en[k] === undefined && !['windowText', 'tpl', 'muteFor', 'csv'].includes(k));
  expect(missingEn).toEqual([]);
  expect(TT_DEV_MARKED).toEqual(['ar', 'ru']);
  for (const k of TT_KEYS) {
    const he = (TT_TABLES.he[k] ?? '').match(/\{\w+\}/g) ?? [];
    const en = (TT_TABLES.en[k] ?? TT_TABLES.he[k] ?? '').match(/\{\w+\}/g) ?? [];
    expect([k, en.sort()]).toEqual([k, he.sort()]);
  }
  expect(tt('subtitle', { n: 5, d: 4 }, 'en')).toBe('Infrastructure · 5 units · 4 with a door sensor · live from the sensors');
  expect(tt('stOff', undefined, 'ru')).toBe('Выключен');
  expect(tt('logSub', undefined, 'ar')).toBe(TT_TABLES.he.logSub); // falls back to Hebrew
  // operator words never name the home platform
  for (const k of TT_KEYS) expect([k, /Home Assistant|\bHA\b|Ingress/.test(TT_TABLES.he[k] ?? '')]).toEqual([k, false]);
});

test('the temperatures tab: hidden until a unit exists (or the viewer manages them); its route is active', () => {
  const can = () => true;
  expect(visibleTabs(INFRA_TABS, true, can).some((x) => x.id === 'temperature')).toBe(false);
  applyInfraTemperature(true);
  expect(visibleTabs(INFRA_TABS, true, can).some((x) => x.id === 'temperature')).toBe(true);
  expect(visibleTabs(INFRA_TABS, false).some((x) => x.id === 'temperature')).toBe(false); // the static demo has no units
  expect(activeAreaTab({ path: '/infra/temperature/log', segments: ['infra', 'temperature', 'log'], params: new URLSearchParams(), mode: 'infra' })).toBe('temperature');
  applyInfraTemperature(false);
});

test('phase 2: unreachable recipients are counted for the warning; the report ranges all have words', async () => {
  const { unreachable, REPORT_RANGES, localInput } = await import('../src/temperature/model');
  const users = [{ id: 'a', name: 'A', reach: 'ok' as const, selectable: true }, { id: 'b', name: 'B', reach: 'no_address' as const, selectable: true },
    { id: 'c', name: 'C', reach: 'no_consent' as const, selectable: true }];
  expect(unreachable(users, ['a', 'b'])).toBe(1);
  expect(unreachable(users, ['a', 'b', 'c'])).toBe(2);
  expect(unreachable(users, [])).toBe(0);
  for (const r of REPORT_RANGES) {
    expect(tt(`rp${r}` as never)).not.toBe(`rp${r}`);
    expect(tt(`rp${r}` as never, undefined, 'en')).not.toBe(`rp${r}`);
  }
  expect(localInput(Date.UTC(2026, 9, 19, 7, 0))).toMatch(/^2026-10-19T\d\d:00$/);
});
