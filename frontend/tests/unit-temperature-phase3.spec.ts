import { test, expect } from '@playwright/test';
import { chipsOf, eventText, eventDuration, eventValue, floorsOf, groupLook, groupUnits, hasHealthIssue, healthChips, heldText, kpisOf, matchesKpi, normalize, bodyOf, newDraft } from '../src/temperature/model';
import { temperatureView } from '../src/temperature/home-widget';
import { bigFrame } from '../src/temperature/charts';
import { configOf, defaultConfig, resolveWidgets, WIDGET_IDS } from '../src/api/home-config';
import { personalOf } from '../src/api/home';
import { TT_TABLES, tt } from '../src/i18n/temperature';
import type { Health, TempEvent, TempUnit } from '../src/api/temperature';

// CR-INFRA-TEMPERATURE phase 3 (the accepted improvement ideas, owner 2026-10-20): the presentation of the projection, the maintenance window,
// sensor health, the escalation, the floor grouping, the comparison scale and the home widget. Pure functions, no browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-temperature-phase3.spec.ts

const NOW = Date.parse('2026-10-19T10:42:00Z');
const iso = (minAgo: number) => new Date(NOW - minAgo * 60_000).toISOString();
const okHealth: Health = { battery: 90, battery_low: false, signal: -60, signal_unit: 'dBm', signal_weak: false, age_min: 2, frozen_since: null, issues: [] };

const unit = (extra: Partial<TempUnit> = {}): TempUnit => ({
  id: 'u1', name: 'מקרר מטבח', kind: 'fridge', area_id: 'kitchen', area_name: 'מטבח', low: 2, high: 6, hard_max: 11, band_mode: 'fixed', source: 'sensor', hvac: null,
  status: 'ok', value: 4.1, value_last: null, updated_at: iso(1), trend: null, temp_sensor_name: 'טמפרטורה מקרר', door: null, events: [],
  defrost: { mode: 'none', in_window: false, next_at: null, state: 'none', days: 0, windows: [] }, muted_until: null,
  rules: { warn_on_excursion: true, high_alarm: true, high_alarm_min: 10, low_alarm: true, low_alarm_min: 15, door_alarm: true, door_alarm_min: 10, offline_warn: true, offline_min: 15,
    quiet_enabled: false, quiet_from: '23:00', quiet_to: '06:00', exclude_defrost_stats: true, setpoint_tolerance: 2, alert_when_off: false },
  stats_24h: { min: 2.5, max: 5.5, avg: 4, out_min: 0, out_min_raw: 0, door_opens: 0, door_total_min: 0, door_longest_min: 0, alarms: 0, warnings: 0 }, stale: false,
  health: okHealth, prediction: null, maintenance: null, floor_id: 'f1', floor_name: 'קומה 1', floor_level: 1, ...extra,
});
const ev = (extra: Partial<TempEvent>): TempEvent => ({
  id: 'e1', unit_id: 'u1', kind: 'high', severity: 'warning', started_at: iso(6), warned_at: iso(6), alarmed_at: null, ended_at: null, value: 6.8, peak: 7.1, threshold: 6,
  suppressed: null, ack_at: null, ack_by_name: null, notified: true, detail: {}, ...extra,
});

test('chips: the projection, the maintenance window, health problems and an escalated alarm', () => {
  const u = unit({
    prediction: { side: 'high', threshold: 6, eta_min: 12, rate_h: 6 }, maintenance: { until: '2026-10-19T11:30:00Z', reason: 'ניקוי', by_name: 'דנה' },
    health: { ...okHealth, battery: 12, battery_low: true, frozen_since: iso(400), issues: ['battery', 'frozen', 'recovery'] },
    events: [ev({ severity: 'alarm', alarmed_at: iso(30), escalation_level: 1 })],
  });
  const ids = chipsOf(u, NOW, 'he-IL').map((c) => c.id);
  expect(ids).toEqual(['ev-e1', 'predict', 'maint', 'h-battery', 'h-frozen', 'h-recovery', 'esc-e1']);
  const c = chipsOf(u, NOW, 'he-IL');
  expect(c.find((x) => x.id === 'predict')!.text).toContain('12');
  expect(c.find((x) => x.id === 'h-battery')!.text).toBe('סוללה חלשה · 12%');
  expect(c.find((x) => x.id === 'esc-e1')!.text).toBe('הוסלמה · שלב 1');
  // an acknowledged escalation is not shouted again; a stale list shows no projection and no health
  expect(chipsOf(unit({ events: [ev({ severity: 'alarm', escalation_level: 2, ack_at: iso(1), ack_by_name: 'יוני' })] }), NOW).some((x) => x.id.startsWith('esc-'))).toBe(false);
  expect(healthChips({ ...u, stale: true })).toEqual([]);
  // a weak signal is a detail, not a chip
  expect(healthChips(unit({ health: { ...okHealth, signal_weak: true, issues: ['signal'] } }))).toEqual([]);
});

test('the sensor-health KPI widens the offline tile: battery, frozen value, weak signal', () => {
  const list = [unit({ id: 'a' }), unit({ id: 'b', health: { ...okHealth, battery_low: true, issues: ['battery'] } }), unit({ id: 'c', health: { ...okHealth, signal_weak: true, issues: ['signal'] } }),
    unit({ id: 'd', health: undefined })];
  expect(kpisOf(list, false).health).toBe(2);
  expect(list.filter((u) => matchesKpi(u, 'health', false)).map((u) => u.id)).toEqual(['b', 'c']);
  expect(kpisOf(list, true).health).toBe(0);
  expect(hasHealthIssue(unit())).toBe(false);
});

test('grouping by area and floor: ordered by floor level, "no area" last; a floor filter narrows; the worst state colours the header', () => {
  const list = [
    unit({ id: 'a', area_id: 'bar', area_name: 'בר', floor_id: 'f2', floor_name: 'קומה 2', floor_level: 2 }),
    unit({ id: 'b', area_id: 'kitchen', area_name: 'מטבח', status: 'alarm' }),
    unit({ id: 'c', area_id: null, area_name: null, floor_id: null, floor_name: null, floor_level: null }),
    unit({ id: 'd', area_id: 'kitchen', area_name: 'מטבח' }),
  ];
  const g = groupUnits(list);
  expect(g.map((x) => [x.key, x.units.map((u) => u.id)])).toEqual([['kitchen', ['b', 'd']], ['bar', ['a']], ['', ['c']]]);
  expect(g[2].name).toBe(tt('groupNoArea'));
  expect(groupLook(g[0], false)).toBe('alarm');
  expect(groupLook(g[0], true)).toBe('unk');
  expect(floorsOf(list)).toEqual([{ id: 'f1', name: 'קומה 1' }, { id: 'f2', name: 'קומה 2' }]);
  expect(groupUnits(list, 'f2').map((x) => x.key)).toEqual(['bar']);
});

test('comparison: readings normalized to each band share one axis (0 = low, 1 = high)', () => {
  expect(normalize(2, 2, 6)).toBe(0);
  expect(normalize(6, 2, 6)).toBe(1);
  expect(normalize(-19, -22, -16)).toBeCloseTo(0.5);
  const f = bigFrame({ points: [[0, 0.5], [60, 1.8]], low: 0, high: 1, doors: [], defrost: [], t0: 0, t1: 60, step: 60, axisUnit: '', overlays: [{ id: 'x', name: 'x', points: [[0, -0.7]] }] }, 600, 250);
  expect(f.lo).toBe(-1);
  expect(f.hi).toBe(2);
});

test('log rows of the phase 3 kinds: words, no value / duration for the acts, the maintenance hold', () => {
  expect(eventText(ev({ kind: 'maint', severity: 'info', detail: { reason: 'ניקוי' }, ack_by_name: 'דנה' }))).toBe('חלון תחזוקה: ניקוי · דנה');
  expect(eventText(ev({ kind: 'escalate', severity: 'info', detail: { level: 2 } }))).toBe('אזעקה לא אושרה · הוסלמה לשלב 2');
  expect(eventText(ev({ kind: 'ticket', severity: 'info', detail: { number: 41 }, ack_by_name: 'יוני' }))).toBe('נפתחה קריאת שירות #41 · יוני');
  expect(eventText(ev({ kind: 'battery' }))).toBe('סוללת החיישן חלשה');
  expect(eventText(ev({ kind: 'predict', threshold: 6 }))).toContain('6°');
  expect(eventValue(ev({ kind: 'escalate' }))).toBe('—');
  expect(eventDuration(ev({ kind: 'ticket', ended_at: iso(0) }), NOW)).toBe('—');
  expect(heldText(ev({ suppressed: 'maintenance' }))).toBe('נשמר ביומן (תחזוקה)');
});

test('the wizard body carries the optional power sensor', () => {
  expect(bodyOf({ ...newDraft(), name: 'x', temp_entity_id: 'sensor.a', power_entity_id: 'sensor.plug' }).power_entity_id).toBe('sensor.plug');
  expect(bodyOf({ ...newDraft(), name: 'x', temp_entity_id: 'sensor.a' }).power_entity_id).toBeNull();
});

test('the home widget: appended last, absent without units, hidden units and the alerts filter', () => {
  expect(WIDGET_IDS.slice(-5)).toEqual(['temperature', 'generators', 'doors', 'notices', 'presence']); // GENWIDGET 2.9.3 appended the generators after it
  const cfg = defaultConfig();
  expect(cfg.temperature).toEqual({ on: true, sizes: { a: 'm', b: 's', c: 'm' }, label: '', phone_on: null, phone_size: null, mode: 'combined', hidden: [], filter: 'all' });
  const data = { weather: null, sensors: {}, alarm: null } as never;
  expect(resolveWidgets(cfg, 'a', data, {}).some((i) => i.id === 'temperature')).toBe(false); // no units, no widget (edit mode too)
  expect(resolveWidgets(cfg, 'a', data, { editing: true }).some((i) => i.id === 'temperature')).toBe(false);
  expect(resolveWidgets(cfg, 'a', data, { temperatureAvailable: true }).some((i) => i.id === 'temperature')).toBe(true);
  const back = configOf({ temperature: { mode: 'both', hidden: ['u2', 'u2', 'bad id!'], filter: 'alerts' } });
  expect([back.temperature.mode, back.temperature.hidden, back.temperature.filter]).toEqual(['both', ['u2'], 'alerts']);
  expect(personalOf({ widgets: { temperature: { mode: 'cards', hidden: ['u1'] } } }).widgets.temperature).toEqual({ mode: 'cards', hidden: ['u1'] });
  const units = [unit({ id: 'u1' }), unit({ id: 'u2', status: 'alarm' }), unit({ id: 'u3', health: { ...okHealth, battery_low: true, issues: ['battery'] } })];
  const v = temperatureView(units, { ...cfg.temperature, hidden: ['u1'] }, false);
  expect(v.included.map((u) => u.id)).toEqual(['u2', 'u3']);
  expect(v.loudest?.id).toBe('u2');
  expect(v.counts).toEqual({ n: 2, alarm: 1, warning: 0 });
  expect(temperatureView(units, { ...cfg.temperature, filter: 'alerts' }, false).items.map((u) => u.id)).toEqual(['u2', 'u3']); // a sensor problem counts as an alert
  expect(temperatureView(units, { ...cfg.temperature, filter: 'alerts' }, true).items).toEqual([]); // stale: nothing is claimed
});

test('owner 2026-10-20: the early warning has its own switch and lead time, with words in he / en / ar / ru', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(tt('predictWarn', undefined, lang)).not.toBe('predictWarn');
    expect(TT_TABLES[lang].predictWarnMin).toBeTruthy();
  }
});
