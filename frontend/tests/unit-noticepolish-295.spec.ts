import { test, expect } from '@playwright/test';
import { RETENTION_HALF, RETENTION_YEAR, placePresets, retentionOptions } from '../src/notices/model';

// NOTICEPOLISH-295: the retention choice and the place presets of a TV board. Node only.

test('retention: a year and half a year map to the stored day counts', () => {
  expect(RETENTION_YEAR).toBe(365);
  expect(RETENTION_HALF).toBe(180);
  expect(retentionOptions(365).map((o) => [o.value, o.label])).toEqual([[365, 'שנה'], [180, 'חצי שנה']]);
  expect(retentionOptions(180).map((o) => o.value)).toEqual([365, 180]);
});

test('retention: an older stored value stays selectable and is not rewritten', () => {
  const o = retentionOptions(90);
  expect(o[0]).toEqual({ value: 90, label: '90 ימים' });
  expect(o.map((x) => x.value)).toEqual([90, 365, 180]);
});

test('place presets: floor and building, no duplicates, no empty names', () => {
  expect(placePresets([{ name: 'לובי', building: 'מבנה א' }, { name: 'חניון', building: '' }, { name: 'לובי', building: 'מבנה א' }, { name: ' ', building: 'x' }]))
    .toEqual(['לובי · מבנה א', 'חניון']);
  expect(placePresets([])).toEqual([]);
});
