import { test, expect } from '@playwright/test';
import { climateWord, FAN_HE, PRESET_HE, SWING_HE } from '../src/api/devices';

// POLISH-LEFTOVERS-2341: a climate entity's fan / swing / preset / hvac values (and a humidifier's mode) are shown in Hebrew;
// the words are display only - the select's option values and the commands keep the device's raw value (devices-controls.ts).

test.describe('climateWord', () => {
  test('the common fan, swing, preset and hvac values read in Hebrew', () => {
    expect(climateWord('fan', 'auto')).toBe('אוטומטי');
    expect(climateWord('fan', 'low')).toBe('נמוך');
    expect(climateWord('fan', 'medium')).toBe('בינוני');
    expect(climateWord('fan', 'high')).toBe('גבוה');
    expect(climateWord('swing', 'off')).toBe('כבוי');
    expect(climateWord('swing', 'vertical')).toBe('אנכי');
    expect(climateWord('swing', 'horizontal')).toBe('אופקי');
    expect(climateWord('swing', 'both')).toBe('אנכי ואופקי');
    expect(climateWord('preset', 'eco')).toBe('חיסכון');
    expect(climateWord('preset', 'none')).toBe('ללא');
    expect(climateWord('hvac', 'heat_cool')).toBe('חימום/קירור');
    expect(climateWord('hmode', 'normal')).toBe('רגיל');
  });

  test('case and separators do not matter; an unknown value keeps its own name; empty stays empty', () => {
    expect(climateWord('fan', 'Auto')).toBe('אוטומטי');
    expect(climateWord('fan', 'Medium High')).toBe('בינוני-גבוה');
    expect(climateWord('fan', 'medium-high')).toBe('בינוני-גבוה');
    expect(climateWord('swing', 'Vertical')).toBe('אנכי');
    expect(climateWord('fan', 'Breeze 7')).toBe('Breeze 7');
    expect(climateWord('swing', 'swing_45deg')).toBe('swing_45deg');
    expect(climateWord('preset', '')).toBe('');
    expect(climateWord('fan', null)).toBe('');
    expect(climateWord('swing', undefined)).toBe('');
  });

  test('every map entry is a non-empty Hebrew word (no raw value leaks as its own label)', () => {
    for (const [k, v] of Object.entries({ ...FAN_HE, ...SWING_HE, ...PRESET_HE })) {
      expect(v.trim(), k).not.toBe('');
      expect(v, k).toMatch(/[֐-׿]/);
    }
  });
});
