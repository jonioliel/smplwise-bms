/** Demo data for אבטחה › אזעקה without a backend (static preview, design review): one panel, six zones. */
import type { AlarmPanels, AlarmZone } from '../api/alarm';

const T = new Date(Date.now() - 12 * 60_000).toISOString();

function zone(n: number, name: string, area: string, kind: AlarmZone['kind'], extra: Partial<AlarmZone> = {}): AlarmZone {
  return {
    entity_id: `binary_sensor.demo_zone_${n}`,
    name,
    platform: 'demo',
    device_class: kind === 'motion' ? 'motion' : 'door',
    kind,
    state: extra.open ? 'on' : 'off',
    available: true,
    open: false,
    fault: false,
    tamper: false,
    battery_low: false,
    battery_level: null,
    alarmed: false,
    bypassed: false,
    last_changed: T,
    area_id: area,
    area_name: area,
    ha_floor_name: null,
    zone_number: n,
    aux: [],
    shared: false,
    bypass: { entity_id: `switch.demo_zone_${n}_bypassed`, domain: 'switch', name: `${name} עקיפה`, state: extra.bypassed ? 'on' : 'off', available: true, bypassed: !!extra.bypassed, strategy: 'device', on_option: null, off_option: null },
    ...extra,
  };
}

export const DEMO_ALARM: AlarmPanels = {
  panels: [
    {
      entity_id: 'alarm_control_panel.demo_house',
      name: 'בית',
      platform: 'demo',
      integration: 'הדגמה',
      integration_note: '',
      config_entry_id: null,
      state: 'disarmed',
      available: true,
      fresh: true,
      last_changed: T,
      changed_by: 'דייר 1',
      arm_modes: ['arm_home', 'arm_away', 'arm_night'],
      features_reported: true,
      code_format: 'number',
      code_arm_required: false,
      needs_code_arm: false,
      needs_code_disarm: true,
      area_name: null,
      open_sensors: [],
      bypassed_sensors: [],
      zones: [
        zone(1, 'דלת כניסה', 'כניסה', 'opening'),
        zone(2, 'דלת אחורית', 'מטבח', 'opening', { open: true, state: 'on' }),
        zone(3, 'גלאי סלון', 'סלון', 'motion'),
        zone(4, 'חלון מטבח', 'מטבח', 'opening', { bypassed: true }),
        zone(5, 'חלון חדר שינה', 'חדר שינה', 'opening', { battery_low: true }),
        zone(6, 'גלאי עשן', 'מטבח', 'fault'),
      ],
      unpaired_controls: [],
      ready: { ready: false, open: ['binary_sensor.demo_zone_2'], faults: [] },
      can: { arm: true, disarm: true, bypass: true, restore: true },
      panel_code_set: true,
      code: { arm: 'none', disarm: 'pin', bypass: 'pin' },
    },
  ],
  counts: { panels: 1, zones: 6, open: 1, bypassed: 1, faults: 0 },
  channel: 'local',
  remote: { control: true, disarm: true, codeless: true },
  code_mode: 'personal_pin',
  me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true },
  can_configure: true,
};
