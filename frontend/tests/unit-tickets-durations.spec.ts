import { test, expect } from '@playwright/test';
import {
  MINUTES_MAX, SLA_COUNTERS, SLA_THRESHOLDS, effectiveLinks, intIn, slaRowChanges, splitMinutes, toCounter, toMinutes, windowProblem,
} from '../src/tickets/durations';
import { TICKET_TEXT_EN_KEYS, TICKET_TEXT_KEYS, template } from '../src/tickets/text';

// CR-038 slice 2: the pure helpers of the SLA grid and the department policy editors (minutes <-> value + unit, the send-hours window,
// the effective link values, the changed fields of a grid row) and the slice-2 texts. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-durations.spec.ts

test('a stored minute count shows in the largest unit that divides it; a round trip keeps the number', () => {
  expect(splitMinutes(1440)).toEqual({ value: 1, unit: 'd' });
  expect(splitMinutes(4320)).toEqual({ value: 3, unit: 'd' });
  expect(splitMinutes(120)).toEqual({ value: 2, unit: 'h' });
  expect(splitMinutes(90)).toEqual({ value: 90, unit: 'min' });
  expect(splitMinutes(null)).toBeNull();
  expect(splitMinutes(0)).toBeNull();
  for (const m of [1, 15, 30, 60, 240, 480, 1440, 2880, 10080, 20160, 43200, 61, 1500]) {
    const s = splitMinutes(m)!;
    expect(toMinutes(String(s.value), s.unit)).toBe(m);
  }
});

test('typed values: empty = off, out of range or not a whole number = invalid', () => {
  expect(toMinutes('', 'h')).toBeNull();
  expect(toMinutes('  ', 'd')).toBeNull();
  expect(toMinutes('8', 'h')).toBe(480);
  expect(toMinutes('0', 'min')).toBeNaN();
  expect(toMinutes('1.5', 'h')).toBeNaN();
  expect(toMinutes('-1', 'h')).toBeNaN();
  expect(toMinutes('366', 'd')).toBeNaN();
  expect(toMinutes('365', 'd')).toBe(MINUTES_MAX);
  expect(toCounter('0')).toBe(0);
  expect(toCounter('10')).toBe(10);
  expect(toCounter('11')).toBeNaN();
  expect(toCounter('')).toBeNaN();
  expect(intIn('14', 1, 90)).toBe(14);
  expect(intIn('91', 1, 90)).toBeNaN();
  expect(intIn('x', 1, 90)).toBeNaN();
});

test('the send-hours window (D4): HH:MM both ends, start before end, never across midnight', () => {
  expect(windowProblem('07:00', '21:00')).toBeNull();
  expect(windowProblem('00:00', '23:59')).toBeNull();
  expect(windowProblem('21:00', '07:00')).toBe('order');
  expect(windowProblem('08:00', '08:00')).toBe('order');
  expect(windowProblem('7:00', '21:00')).toBe('time');
  expect(windowProblem('07:00', '24:00')).toBe('time');
});

test('the effective link values (D5): an override wins, the cap never falls under the window', () => {
  const inst = { sliding_days: 14, cap_days: 90, grace_hours: 24 };
  expect(effectiveLinks(inst, { link_sliding_days: null, link_cap_days: null, link_grace_hours: null })).toEqual(inst);
  expect(effectiveLinks(inst, { link_sliding_days: 30, link_cap_days: null, link_grace_hours: 0 })).toEqual({ sliding_days: 30, cap_days: 90, grace_hours: 0 });
  expect(effectiveLinks(inst, { link_sliding_days: 60, link_cap_days: 30, link_grace_hours: null }).cap_days).toBe(60);
});

test('a grid row sends only the fields that changed; bad cells are named, not sent', () => {
  const stored = {
    unassigned_after_min: 15, link_unopened_min: 1440, ack_within_min: 30, stuck_after_min: 60, stuck_waiting_min: 1440, resolve_within_min: 480,
    remind_every_min: 30, max_reminders: 2, manager_alert_after_steps: 1,
  };
  expect(slaRowChanges(stored, {})).toEqual({ changes: {}, invalid: [] });
  expect(slaRowChanges(stored, { ack_within_min: { raw: '30', unit: 'min' }, stuck_after_min: { raw: '1', unit: 'h' } })).toEqual({ changes: {}, invalid: [] });
  expect(slaRowChanges(stored, { ack_within_min: { raw: '20', unit: 'min' }, link_unopened_min: { raw: '', unit: 'h' }, max_reminders: '4' }))
    .toEqual({ changes: { ack_within_min: 20, link_unopened_min: null, max_reminders: 4 }, invalid: [] });
  expect(slaRowChanges(stored, { stuck_after_min: { raw: '0', unit: 'h' }, manager_alert_after_steps: '' }).invalid).toEqual(['stuck_after_min', 'manager_alert_after_steps']);
  expect(SLA_THRESHOLDS.length + SLA_COUNTERS.length).toBe(9);
});

test('every SLA field and unit has a text in both languages', () => {
  for (const k of [...SLA_THRESHOLDS, ...SLA_COUNTERS]) {
    const key = `sla_${k}` as (typeof TICKET_TEXT_KEYS)[number];
    expect(TICKET_TEXT_KEYS).toContain(key);
    expect(TICKET_TEXT_EN_KEYS).toContain(key);
    expect(template(key, 'he').length).toBeGreaterThan(0);
  }
  for (const u of ['unit_d', 'unit_h', 'unit_min', 'err_range', 'err_order', 'err_time', 'err_below_sliding'] as const) {
    expect(TICKET_TEXT_EN_KEYS).toContain(u);
  }
});
