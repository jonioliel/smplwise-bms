// HOME-WALL-NIGHT-2500: the alarm panels answer (routers/alarm.py wire shape) with one invented panel in `state`, for the wall panel's
// takeover specs (home-wall-night-2500.spec.ts and its captures). Nothing real: the house and the sensor are the mockup's demo names.
export function alarmPanels(state: string, at: number) {
  return { panels: [{
    entity_id: 'alarm_control_panel.house', name: 'אזעקת הבית', platform: null, integration: '', integration_note: '', config_entry_id: null, state, available: true, fresh: true,
    last_changed: new Date(at - 30_000).toISOString(), changed_by: null, arm_modes: ['arm_home', 'arm_away', 'arm_night'], features_reported: true, code_format: 'number', code_arm_required: false, needs_code_arm: false,
    needs_code_disarm: true, area_name: null, open_sensors: ['דלת המרפסת'], bypassed_sensors: [], zones: [], unpaired_controls: [], ready: { ready: true, open: [], faults: [] },
    can: { arm: true, disarm: true, bypass: false, restore: false }, panel_code_set: false, code: { arm: 'none', disarm: 'pin', bypass: 'none' },
  }], counts: { panels: 1, zones: 0, open: 0, bypassed: 0, faults: 0 }, channel: 'local', remote: { control: true, disarm: true, codeless: false }, code_mode: 'personal_pin',
  me: { arm_policy: 'no_code', disarm_policy: 'code_required', pin_set: true }, can_configure: false };
}
