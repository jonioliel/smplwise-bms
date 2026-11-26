import { test, expect } from '@playwright/test';
import { batterySystem, capsOf, gaugeList } from '../src/generator/gen-logic';
import { ROLES, valuesFor } from './generator-fixtures';

// DATA-RULES-2540 (review D-02 / SCR-21): the battery dial judges a reading by the server's ONE 12 V / 24 V rule
// (services/generator_core.battery_system): the device's known system (`battery_system_v`), else above 16 V = 24 V. Before, the dial
// used its own 18 V boundary and a 24 V bank sagging to 16.1-18 V (or lower) showed full scale, green, "min 11.6". Pure functions, no browser.
const th = { fuel_low_pct: 25, battery_min_12v: 11.6, battery_min_24v: 23.2, coolant_max_c: 95, oil_min_bar: 1, overload_pct: 100 };

function battery(reading: number, known: number | null = null) {
  const v = valuesFor('full', 'standby');
  v.battery_v.value = reading;
  return gaugeList(v, capsOf(ROLES.full), th, 'stopped', 200, known).find((g) => g.role === 'battery_v')!;
}

test.describe('generator battery: one rule with the server', () => {
  test('the boundary is the server one (16 V), not 18 V', () => {
    expect(batterySystem(null, 16)).toBe(12);
    expect(batterySystem(null, 16.1)).toBe(24);
    expect(batterySystem(null, 17.5)).toBe(24);
    expect(batterySystem(24, 12.4)).toBe(24);
    expect(batterySystem(12, 26)).toBe(12);
  });

  test('a 24 V bank sagging to 17 V is low on the dial (the server raises battery_low there)', () => {
    const g = battery(17);
    expect(g.limit).toEqual({ kind: 'min', a: 23.2 });
    expect(g.tone).toBe('err');
  });

  test('a 24 V bank the server knows stays a 24 V bank below 16 V', () => {
    const g = battery(15.8, 24);
    expect(g.limit).toEqual({ kind: 'min', a: 23.2 });
    expect(g.tone).toBe('err');
    expect(g.pct).toBe(0);
  });

  test('a healthy bank looks as before', () => {
    expect(battery(27.4).tone).toBe('ok');
    expect(battery(13.4).limit).toEqual({ kind: 'min', a: 11.6 });
    expect(battery(13.4).tone).toBe('ok');
  });
});
