import { test, expect } from '@playwright/test';
import { EFFECT_LABEL, fixtureReadingLog, isoToLocalInput, localInputToIso, parseFactor, parseReading } from '../src/api/electricity-readings';
import { fmtReading, fmtSigned } from '../src/electricity/format';

// EL6 (manual readings and calibration of the electricity meters): the pure helpers of the screens - typed readings, the factor, the local
// date-time field, the number formats, the effect labels and the fake log. No DOM, no browser.

test.describe('manual reading helpers', () => {
  test('a typed reading: digits, one decimal mark (dot or comma), thousands separators dropped, nothing else', () => {
    expect(parseReading('12345.678')).toBe('12345.678');
    expect(parseReading(' 12,345.6 ')).toBe('12345.6');
    expect(parseReading('1060,25')).toBe('1060.25');
    expect(parseReading('0')).toBe('0');
    for (const bad of ['', ' ', '-5', '1.2.3', 'abc', '12a', '1e5', '+3']) expect(parseReading(bad), bad).toBeNull();
  });

  test('a factor: 0.5 to 2, at most six decimals', () => {
    expect(parseFactor('1')).toBe('1');
    expect(parseFactor('1,0213')).toBe('1.0213');
    expect(parseFactor('0.5')).toBe('0.5');
    expect(parseFactor('2')).toBe('2');
    for (const bad of ['0.49', '2.01', '1.0000001', '', 'x', '-1']) expect(parseFactor(bad), bad).toBeNull();
  });

  test('the local date-time field round-trips through UTC', () => {
    const d = new Date(2026, 9, 5, 9, 7);
    const local = isoToLocalInput(d);
    expect(local).toBe('2026-10-05T09:07');
    expect(localInputToIso(local)).toBe(d.toISOString());
    expect(localInputToIso('')).toBeNull();
    expect(localInputToIso('not a date')).toBeNull();
  });

  test('readings keep up to three decimals; a difference carries its sign in front', () => {
    expect(fmtReading(248912.4)).toBe('248,912.4');
    expect(fmtReading(1060.25)).toBe('1,060.25');
    expect(fmtReading(1.2346)).toBe('1.235');
    expect(fmtReading(null)).toBe('-');
    expect(fmtSigned(5)).toBe('+5');
    expect(fmtSigned(-1385.5)).toBe('−1,385.5');
    expect(fmtSigned(0)).toBe('0');
  });

  test('every effect has a short label; only the gap effects say they changed anything', () => {
    expect(EFFECT_LABEL.open_gap).toBe('השלימה פער');
    expect(EFFECT_LABEL.closed_gap).toBe('חילקה פער');
    for (const k of ['reported', 'outside_counter', 'no_counter_data', 'counter_events', 'implausible', 'billed'] as const) expect(EFFECT_LABEL[k]).toBe('להשוואה');
  });

  test('the fake log: a calibrated meter with a suggestion, a not-reporting meter whose reading closed the gap, an empty one', () => {
    const m1 = fixtureReadingLog('m1');
    expect(m1.calibration.identity).toBe(false);
    expect(m1.calibrations.filter((c) => c.in_force)).toHaveLength(1);
    expect(m1.suggestion?.anchor_reading_id).toBe(m1.items[0].id);
    expect(m1.items.every((r) => r.deviation_kwh != null && r.effect === 'record')).toBe(true);
    const m8 = fixtureReadingLog('m8', 18120.07);
    expect(m8.items[0].effect).toBe('allocation');
    expect(m8.items[0].can_undo).toBe(true);
    const m3 = fixtureReadingLog('m3');
    expect(m3.items).toEqual([]);
    expect(m3.calibration.identity).toBe(true);
    // no money and no platform names in any text of the log
    expect(JSON.stringify([m1, m8])).not.toMatch(/₪|Home Assistant|\bHA\b/);
  });
});
