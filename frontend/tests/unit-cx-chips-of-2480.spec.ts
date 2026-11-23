import { test } from '@playwright/test';
import type { Health, TempEvent, TempUnit } from '../src/api/temperature';
import { chipsOf } from '../src/temperature/model';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of chipsOf (temperature/model.ts) before its split. Climate modes / setpoints, door states, every
// event kind and severity (acknowledged, escalated, "alarm in"), the projection, the maintenance window, sensor health, defrost, mute -
// each fresh and stale, alone and together; the answers must equal the record taken from the unsplit function
// (tests/fixtures/cx/chips-of.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-chips-of-2480.spec.ts --workers=1

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
  suppressed: null, ack_at: null, ack_by_name: null, notified: true, alarm_at: iso(-4), detail: {}, ...extra,
});
const hvac = (mode: string | null, action: string | null, setpoint: number | null, low: number | null = null, high: number | null = null) =>
  ({ hvac_mode: mode, hvac_action: action, setpoint, setpoint_low: low, setpoint_high: high }) as unknown as TempUnit['hvac'];
const defrost = (o: Partial<TempUnit['defrost']>): TempUnit['defrost'] => ({ mode: 'fixed', in_window: false, next_at: null, state: 'fixed', days: 0, windows: [], ...o });

const VARIANTS: Array<[string, Partial<TempUnit>]> = [
  ['plain', {}],
  ['hvac-cool', { hvac: hvac('cool', 'cooling', 22) }], ['hvac-heat', { hvac: hvac('heat', 'heating', 21.5) }], ['hvac-off', { hvac: hvac('off', 'off', 22) }],
  ['hvac-auto-idle', { hvac: hvac('auto', 'idle', null) }], ['hvac-heat-cool', { hvac: hvac('heat_cool', 'cooling', 22, 20, 24) }], ['hvac-heat-cool-half', { hvac: hvac('heat_cool', null, 22, 20, null) }],
  ['hvac-unknown', { hvac: hvac('turbo', 'whirring', -3) }], ['hvac-empty', { hvac: hvac(null, null, 22) }], ['hvac-mode-only', { hvac: hvac('dry', null, null) }],
  ['door-open', { door: { open: true, since: iso(14), sensor_name: 'דלת' } }], ['door-closed', { door: { open: false, since: iso(200), sensor_name: 'דלת' } }],
  ['door-unknown', { door: { open: null, since: null, sensor_name: 'דלת' } as never }], ['door-no-since', { door: { open: true, since: null, sensor_name: 'דלת' } as never }],
  ['ev-high-warn', { events: [ev({})] }], ['ev-high-warn-past', { events: [ev({ alarm_at: iso(2) })] }], ['ev-high-warn-no-at', { events: [ev({ alarm_at: null })] }],
  ['ev-low-alarm', { events: [ev({ kind: 'low', severity: 'alarm', value: 0.5, threshold: 2, alarm_at: null })] }],
  ['ev-door-alarm', { events: [ev({ kind: 'door', severity: 'alarm', threshold: 10 as never, started_at: iso(25) })] }], ['ev-door-alarm-no-x', { events: [ev({ kind: 'door', severity: 'alarm', threshold: null })] }],
  ['ev-door-warn', { events: [ev({ kind: 'door', severity: 'warning' })] }], ['ev-offline', { events: [ev({ kind: 'offline', severity: 'warning', started_at: iso(42) })] }],
  ['ev-other', { events: [ev({ kind: 'power' as never, severity: 'alarm' })] }], ['ev-info', { events: [ev({ severity: 'info' as never, ack_at: iso(1), ack_by_name: 'דנה' })] }],
  ['ev-acked', { events: [ev({ severity: 'alarm', ack_at: iso(1), ack_by_name: 'יוני' }), ev({ id: 'e2', kind: 'low', ack_at: iso(1), ack_by_name: null })] }],
  ['ev-escalated', { events: [ev({ severity: 'alarm', escalation_level: 2 }), ev({ id: 'e3', escalation_level: 1, ack_at: iso(1), ack_by_name: 'יוני' }), ev({ id: 'e4', escalation_level: 0 })] }],
  ['predict-high', { prediction: { side: 'high', threshold: 6, eta_min: 12, rate_h: 6 } as never }], ['predict-low', { prediction: { side: 'low', threshold: -18, eta_min: 40, rate_h: -2 } as never }],
  ['maint', { maintenance: { until: '2026-10-19T11:30:00Z', reason: 'ניקוי', by_name: 'דנה' } as never }],
  ['health-battery', { health: { ...okHealth, battery: 12.4, battery_low: true, issues: ['battery'] } }], ['health-battery-null', { health: { ...okHealth, battery: null, battery_low: true } as never }],
  ['health-all', { health: { ...okHealth, battery: 9, battery_low: true, frozen_since: iso(400), issues: ['battery', 'frozen', 'recovery', 'duty'] } }], ['no-health', { health: undefined }],
  ['defrost-in', { defrost: defrost({ in_window: true, next_at: '2026-10-19T12:00:00Z' }) }], ['defrost-next', { defrost: defrost({ next_at: '2026-10-19T12:00:00Z' }) }],
  ['defrost-next-offline', { status: 'offline', defrost: defrost({ next_at: '2026-10-19T12:00:00Z', mode: 'learn', state: 'learning' }) }],
  ['defrost-learning', { defrost: defrost({ mode: 'learn', state: 'learning' }) }], ['defrost-learn-done', { defrost: defrost({ mode: 'learn', state: 'learned' as never }) }],
  ['muted', { muted_until: '2026-10-19T11:30:00Z' }],
  ['everything', {
    status: 'alarm', hvac: hvac('heat_cool', 'heating', 22, 19.5, 23), door: { open: true, since: iso(14), sensor_name: 'דלת' },
    events: [ev({ severity: 'alarm', escalation_level: 1 }), ev({ id: 'e2', kind: 'offline', severity: 'warning', started_at: iso(42), ack_at: iso(3), ack_by_name: 'דנה' }), ev({ id: 'e5', kind: 'door', severity: 'alarm' })],
    prediction: { side: 'low', threshold: 2, eta_min: 5, rate_h: -1 } as never, maintenance: { until: '2026-10-19T13:05:00Z', reason: '', by_name: 'x' } as never,
    health: { ...okHealth, battery_low: true, frozen_since: iso(90), issues: ['duty'] }, defrost: defrost({ in_window: true }), muted_until: '2026-10-19T10:50:00Z',
  }],
];

test('chipsOf: every answer equals the record of the unsplit function', () => {
  const out = VARIANTS.flatMap(([v, o]) => [false, true].map((stale) => ({ v, stale, chips: chipsOf(unit({ ...o, stale }), NOW) })));
  expectRecorded('chips-of', out);
});
