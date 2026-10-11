import { test, expect } from '@playwright/test';
import { SECTION_BULK, sectionBulkActions, sectionBulkShown } from '../src/screens/devices-area-design';
import { BULK_KINDS, BULK_KIND_LABEL, BULK_MENU_KINDS, BULK_ON_KINDS } from '../src/api/device-bulk';
import type { DeviceRow } from '../src/api/devices';

// ALLON (owner 2026-10-10, "like there is turn-all-off there must be turn-all-on"): the area sections' "הדלק הכל" registry and
// when it is drawn. Pure logic - the server's preview still decides (and states) exactly what is sent.

function row(entity_id: string, over: Partial<DeviceRow> = {}): DeviceRow {
  return {
    entity_id, name: entity_id, domain: entity_id.split('.')[0], device_class: null, state: 'off', available: true, fresh: true, active: false,
    icon: null, last_changed: null, can_control: true, ...over,
  } as DeviceRow;
}

test.describe('"הדלק הכל" next to "כבה הכל"', () => {
  test('lighting and switches pair "on" (first, the right side in RTL) with "off", the same look; climate stays off-only', () => {
    expect(SECTION_BULK.lighting!.map((a) => a.kind)).toEqual(['lights_on', 'lights_off']);
    expect(SECTION_BULK.switches!.map((a) => a.kind)).toEqual(['switches_on', 'switches_off']);
    for (const card of ['lighting', 'switches'] as const) {
      const [on, off] = SECTION_BULK[card]!;
      expect([on.label, off.label]).toEqual(['הדלק הכל', 'כבה הכל']);
      expect([on.icon, off.icon]).toEqual(['bolt', 'power']);
    }
    expect(SECTION_BULK.climate!.map((a) => a.kind)).toEqual(['climate_off']);
    expect(SECTION_BULK.media).toBeUndefined();
  });

  test('"on" is drawn only while something could be turned on: off, available, a switch not protected / door layer / alarm', () => {
    const on = SECTION_BULK.switches![0];
    const off = SECTION_BULK.switches![1];
    expect(sectionBulkShown(on, [row('switch.a', { state: 'on', active: true })])).toBe(false); // all on
    expect(sectionBulkShown(on, [row('switch.a', { state: 'off' })])).toBe(true);
    expect(sectionBulkShown(on, [row('switch.a', { state: 'off', bulk_reason: 'allowed' })])).toBe(true);
    for (const reason of ['protected', 'doors_layer', 'alarm_managed'] as const) {
      expect(sectionBulkShown(on, [row('switch.boiler', { state: 'off', bulk_reason: reason, bulk_protected: reason === 'protected' })]), reason).toBe(false);
    }
    expect(sectionBulkShown(on, [row('switch.x', { state: 'off', alarm_managed: true })])).toBe(false);
    expect(sectionBulkShown(on, [row('switch.dead', { state: 'unavailable', available: false })])).toBe(false);
    // another domain in the switches card (a valve / water heater entity) is never reached by switches_on
    expect(sectionBulkShown(on, [row('valve.garden', { state: 'closed' }), row('water_heater.boiler', { state: 'off' })])).toBe(false);
    // "off" keeps its own rule: drawn whenever the section has devices (the caller checks the count)
    expect(sectionBulkShown(off, [row('switch.a', { state: 'off' })])).toBe(true);
    expect(sectionBulkActions('switches', [row('switch.a', { state: 'on', active: true })]).map((a) => a.kind)).toEqual(['switches_off']);
    expect(sectionBulkActions('switches', [row('switch.a', { state: 'on', active: true }), row('switch.b')]).map((a) => a.kind)).toEqual(['switches_on', 'switches_off']);
    expect(sectionBulkActions('lighting', [row('light.a', { state: 'off' })]).map((a) => a.kind)).toEqual(['lights_on', 'lights_off']);
    expect(sectionBulkActions('lighting', [row('light.a', { state: 'on', active: true })]).map((a) => a.kind)).toEqual(['lights_off']);
    expect(sectionBulkActions('sensors', [row('sensor.t')])).toEqual([]);
  });

  test('the floor / area menu adds "הדלק תאורה" after "כבה תאורה"; no "turn everything on"; BULK_KINDS (the scheduler order) unchanged', () => {
    expect(BULK_MENU_KINDS.slice(0, 2)).toEqual(['lights_off', 'lights_on']);
    expect(BULK_MENU_KINDS.filter((k) => k !== 'lights_on')).toEqual(BULK_KINDS);
    expect(BULK_KIND_LABEL.lights_on).toBe('הדלק תאורה');
    expect([...BULK_ON_KINDS].sort()).toEqual(['lights_on', 'screens_on', 'switches_on']);
    expect(BULK_MENU_KINDS.some((k) => (k as string) === 'all_on')).toBe(false);
  });
});
