import type { GenDevice, GenValues, GenValue } from '../src/api/generator';

// CR-031 GEN1 test fixtures: an invented controller at three capability levels (minimal / typical / full), in the WIRE shape of routers/generator.py.
// No real device, entity or address.
export type Level = 'minimal' | 'typical' | 'full';
export type Scenario = 'run' | 'standby' | 'unavail';

const V = (value: GenValue['value'], unit = '', label = ''): GenValue => ({ value, unit, available: value !== null, updated_at: '2026-10-05T11:00:00Z', label });

export const ROLES: Record<Level, string[]> = {
  minimal: ['engine_state', 'gen_v_l1'],
  typical: ['engine_state', 'controller_mode', 'ats_position', 'mains_available', 'on_load', 'rpm', 'run_hours', 'coolant_temp', 'battery_v', 'gen_v_l1', 'gen_v_l2', 'gen_v_l3', 'gen_a_l1', 'gen_a_l2', 'gen_a_l3', 'gen_kw', 'gen_hz', 'load_pct', 'last_start_at', 'last_test_at', 'service_hours_left'],
  full: ['engine_state', 'controller_mode', 'ats_position', 'mains_available', 'on_load', 'rpm', 'run_hours', 'starts', 'coolant_temp', 'oil_pressure', 'battery_v', 'fuel_pct', 'gen_v_l1', 'gen_v_l2', 'gen_v_l3', 'gen_a_l1', 'gen_a_l2', 'gen_a_l3', 'gen_kw', 'pf', 'gen_hz', 'load_pct', 'last_start_at', 'last_test_at', 'next_test_at', 'service_hours_left'],
};

export function valuesFor(level: Level, sc: Scenario): GenValues {
  const run = sc === 'run';
  const all: GenValues = {
    engine_state: V(sc === 'unavail' ? null : run ? 'running' : 'stopped'),
    controller_mode: V('auto'),
    ats_position: V(run ? 'generator' : 'mains'),
    mains_available: V(!run),
    on_load: V(run),
    rpm: V(run ? 1500 : 0, 'rpm'), run_hours: V(1284.5, 'h'), starts: V(212),
    coolant_temp: V(run ? 84 : 38, '°C'), oil_pressure: V(run ? 4.2 : 0, 'bar'), battery_v: V(27.4, 'V'), fuel_pct: V(run ? 58 : 92, '%'),
    gen_v_l1: V(run ? 231 : 0, 'V'), gen_v_l2: V(run ? 229 : 0, 'V'), gen_v_l3: V(run ? 232 : 0, 'V'),
    gen_a_l1: V(run ? 180 : 0, 'A'), gen_a_l2: V(run ? 171 : 0, 'A'), gen_a_l3: V(run ? 186 : 0, 'A'),
    gen_kw: V(run ? 124 : 0, 'kW'), pf: V(run ? 0.86 : 0), gen_hz: V(run ? 50 : 0, 'Hz'), load_pct: V(run ? 62 : 0, '%'),
    last_start_at: V('2026-09-28T09:00:00Z'), last_test_at: V('2026-09-28T09:00:00Z'), next_test_at: V('2026-10-12T09:00:00Z'), service_hours_left: V(46, 'h'),
  };
  const out: GenValues = {};
  for (const r of ROLES[level]) out[r] = { ...all[r], label: r };
  if (sc === 'unavail') for (const r of Object.keys(out)) out[r] = { ...out[r], available: false, value: null };
  return out;
}

const TYPES = [
  ['fail_to_start', 'engine', 'כשל התנעה', true], ['low_oil_pressure', 'engine', 'לחץ שמן נמוך', true], ['high_coolant_temp', 'engine', 'טמפרטורת נוזל קירור גבוהה', true],
  ['low_fuel', 'fuel', 'מפלס דלק נמוך', true], ['overload', 'electrical', 'עומס יתר', true], ['battery_low', 'electrical', 'מתח מצבר נמוך', true], ['mains_lost', 'mains', 'אובדן רשת חשמל', true],
  ['service_due', 'maintenance', 'טיפול תקופתי', true], ['controller_offline', 'comm', 'אין תקשורת עם הבקר', true],
] as const;
const NEEDS: Record<string, string[]> = { low_oil_pressure: ['oil_pressure'], high_coolant_temp: ['coolant_temp'], low_fuel: ['fuel_pct'], overload: ['gen_kw', 'load_pct'], battery_low: ['battery_v'], mains_lost: ['mains_available'], service_due: ['service_hours_left'] };
export const GROUPS = [{ key: 'engine', title: 'מנוע' }, { key: 'fuel', title: 'דלק' }, { key: 'electrical', title: 'חשמל הגנרטור' }, { key: 'mains', title: 'רשת ומתג העברה' }, { key: 'maintenance', title: 'תחזוקה ומבחנים' }, { key: 'comm', title: 'תקשורת ומצב בקר' }];

export const typesFor = (level: Level) => TYPES.map(([key, group, title]) => {
  const need = NEEDS[key];
  const available = !need || need.some((r) => ROLES[level].includes(r));
  return { key, group, title, available, needs: available ? null : need.join(', ') };
});

export function deviceFor(id: string, name: string, level: Level, sc: Scenario, open = 0, detail = true): GenDevice {
  const roles = ROLES[level];
  const types = typesFor(level);
  const d: GenDevice = {
    id, name, area_id: 'a-gen', area_name: 'חדר גנרטור', status: 'detected', source_kind: 'integration', rated_kw: 200, rated_kva: 250, fuel_type: 'diesel', detected_at: '2026-10-01T08:00:00Z', last_seen_at: '2026-10-05T09:41:00Z', revision: 1,
    availability: sc === 'unavail' ? 'offline' : 'online', stale: sc === 'unavail', core_met: true, open_alerts: open,
    capabilities: { roles, values: roles.length, values_total: 41, alert_types: types.filter((t) => t.available).length, alert_types_total: types.length, disabled_roles: [], missing_core: [] },
  };
  if (detail) {
    d.values = valuesFor(level, sc);
    d.alert_types = types;
    d.thresholds = { fuel_low_pct: 25, battery_min_24v: 23.2, coolant_max_c: 95, oil_min_bar: 1, overload_pct: 100, service_warn_h: 25 };
  }
  return d;
}
