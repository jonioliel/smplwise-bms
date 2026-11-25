// CR-I18N-LAZY-LANG-2443: language pack table of src/i18n/generator-routing.ts, fetched only when the page is in this language (i18n/lang-packs.ts).
// Moved by scripts/i18n-split-langs.mjs; edit the texts here.
/* eslint-disable */

export const en = {
  emptyTitle: 'No one is set to receive generator alerts',
  emptyCritical: 'Only an unacknowledged critical alert reaches the system administrators, after {n} min',
  defaultsTitle: 'Default by severity',
  defaultsSub: 'An alert type with no recipients of its own uses the choice for its severity',
  criticalNote: 'A critical alert always escalates to the system administrators after {n} min, even when escalation is off',
  criticalQuiet: 'A critical alert is never held by quiet hours',
  criticalDelay: 'Time until a critical alert escalates',
  unitMin: 'min',
  escalateAfter: 'Time until escalation',
  escalateUntil: 'until escalation',
  group_engine: 'Engine',
  group_fuel: 'Fuel',
  group_electrical: 'Generator power',
  group_mains: 'Mains and transfer switch',
  group_maintenance: 'Maintenance and tests',
  group_comm: 'Communication and controller state',
  ph_name: 'Generator name',
  ph_detail: 'Value detail (for example fuel level 18%)',
  ph_type: 'Alert type',
  ph_severity: 'Severity',
  editDefault: 'Default: {name}',
  inheritedFrom: 'from severity',
  colEscalate: 'Escalation',
  always: 'Always',
  saved: 'Saved',
};
