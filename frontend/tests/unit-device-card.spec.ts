import { test, expect } from '@playwright/test';
import {
  AUTO_CLOSE_MINUTES, BOOST_MINUTES, CARD_KINDS, HOLD_MS, VACUUM_ACTIONS, autoOffDraft, autoOffTime, cardKindOf, domainOf, fanSpeedKey, findAutoOff, isOnState, lastCleaningAt,
  powerActions, stateKey,
} from '../src/components/device-card-logic';
import type { Schedule } from '../src/api/schedules';
import type { ActivityItem } from '../src/api/device-activity';
import { en } from '../src/i18n/en';
import { he } from '../src/i18n/he';

// CARD1 (2026-10-07): the pure parts of the three equipment cards of the activity window - which kind gets a card, which allow-listed action
// each button sends per the entity's REAL domain, the one-off auto-off schedule, the words. No DOM.

test.describe('device card logic', () => {
  test('exactly three kinds get a card; the rest keep the plain window', () => {
    expect(CARD_KINDS).toEqual(['water_heater', 'valve', 'vacuum']);
    for (const k of CARD_KINDS) expect(cardKindOf(k)).toBe(k);
    for (const k of ['light', 'switch', 'outlet', 'cover', 'garage_door', 'climate', 'heater', 'fan', 'generic'] as const) expect(cardKindOf(k)).toBeNull();
    expect(cardKindOf(null)).toBeNull();
    expect(HOLD_MS).toBeGreaterThanOrEqual(1000);
    expect(BOOST_MINUTES).toEqual([30, 60, 90]);
    expect(AUTO_CLOSE_MINUTES).toEqual([10, 20, 30]);
  });

  test('a boiler or a tap wired through a switch keeps switch.turn_on / turn_off; the auto-off is schedulable', () => {
    const h = powerActions('water_heater', 'switch.boiler')!;
    expect(h.on).toMatchObject({ action: 'switch.turn_on', expect: 'on', confirm: false });
    expect(h.off).toMatchObject({ action: 'switch.turn_off', expect: 'off', confirm: false });
    expect(h.schedulableOff).toBe('switch.turn_off');
    const v = powerActions('valve', 'switch.irrigation')!;
    expect(v.on).toMatchObject({ action: 'switch.turn_on', confirm: true }); // water starts flowing: held to confirm
    expect(v.off).toMatchObject({ action: 'switch.turn_off', confirm: false });
    expect(v.schedulableOff).toBe('switch.turn_off');
    expect(powerActions('water_heater', 'input_boolean.boiler')!.on.action).toBe('input_boolean.turn_on');
  });

  test('a valve.* entity gets open_valve (confirmed) / close_valve; a water_heater.* entity its own on / off; neither is schedulable', () => {
    const v = powerActions('valve', 'valve.garden')!;
    expect(v.on).toMatchObject({ action: 'valve.open_valve', expect: 'open', confirm: true });
    expect(v.off).toMatchObject({ action: 'valve.close_valve', expect: 'closed', confirm: false });
    expect(v.schedulableOff).toBeNull();
    const h = powerActions('water_heater', 'water_heater.boiler')!;
    expect(h.on.action).toBe('water_heater.turn_on');
    expect(h.off.action).toBe('water_heater.turn_off');
    expect(h.schedulableOff).toBeNull();
    // a domain the card has no mapping for: no controls at all (never a guess)
    expect(powerActions('water_heater', 'climate.boiler')).toBeNull();
    expect(powerActions('valve', 'cover.tap')).toBeNull();
    expect(powerActions('vacuum', 'vacuum.robo')).toBeNull();
    expect(domainOf('valve.garden')).toBe('valve');
  });

  test('the vacuum buttons are the three allow-listed services', () => {
    expect(VACUUM_ACTIONS.start).toMatchObject({ action: 'vacuum.start', expect: 'cleaning', confirm: false });
    expect(VACUUM_ACTIONS.pause).toMatchObject({ action: 'vacuum.pause', expect: 'paused', confirm: false });
    expect(VACUUM_ACTIONS.dock).toMatchObject({ action: 'vacuum.return_to_base', expect: 'returning', confirm: false });
  });

  test('on / off per kind, and the big state word', () => {
    expect(isOnState('water_heater', 'on')).toBe(true);
    expect(isOnState('water_heater', 'eco')).toBe(true);
    expect(isOnState('water_heater', 'off')).toBe(false);
    expect(isOnState('valve', 'open')).toBe(true);
    expect(isOnState('valve', 'on')).toBe(true);
    expect(isOnState('valve', 'closed')).toBe(false);
    expect(isOnState('vacuum', 'cleaning')).toBe(true);
    expect(isOnState('vacuum', 'docked')).toBe(false);
    for (const k of CARD_KINDS) {
      expect(isOnState(k, 'unavailable')).toBe(false);
      expect(stateKey(k, null)).toBe('deviceCard.stateUnknown');
    }
    expect(stateKey('water_heater', 'on')).toBe('deviceCard.heaterOn');
    expect(stateKey('water_heater', 'off')).toBe('deviceCard.heaterOff');
    expect(stateKey('valve', 'opening')).toBe('deviceCard.valveOpening');
    expect(stateKey('valve', 'off')).toBe('deviceCard.valveClosed');
    expect(stateKey('vacuum', 'returning')).toBe('deviceCard.vacReturning');
    expect(stateKey('vacuum', 'weird')).toBe('deviceCard.stateUnknown');
    expect(fanSpeedKey('quiet')).toBe('deviceCard.fanQuiet');
    expect(fanSpeedKey('Turbo')).toBe('deviceCard.fanTurbo');
    expect(fanSpeedKey('vendor-x')).toBeNull();
    expect(fanSpeedKey(null)).toBeNull();
  });

  test('the last cleaning is the newest "to cleaning" event of the feed', () => {
    const item = (id: string, at: string, to: string): ActivityItem => ({ id, at, kind: 'power', actor: { type: 'person' }, from: { state: 'x' }, to: { state: to } });
    expect(lastCleaningAt([item('a', '2026-10-05T12:00:00Z', 'docked'), item('b', '2026-10-05T11:00:00Z', 'cleaning'), item('c', '2026-10-04T11:00:00Z', 'cleaning')])).toBe('2026-10-05T11:00:00Z');
    expect(lastCleaningAt([item('a', '2026-10-05T12:00:00Z', 'docked')])).toBeNull();
    expect(lastCleaningAt([])).toBeNull();
  });

  test('the auto-off draft: a single-run daily schedule with one off action at now + minutes (wrapped at midnight)', () => {
    const now = new Date(2026, 9, 5, 16, 5, 30);
    expect(autoOffTime(now, 30)).toBe('16:35:00');
    expect(autoOffTime(new Date(2026, 9, 5, 23, 50, 0), 20)).toBe('00:10:00');
    const d = autoOffDraft('switch.boiler', 'switch.turn_off', 'כיבוי אוטומטי · דוד שמש', now, 60);
    expect(d).toEqual({
      name: 'כיבוי אוטומטי · דוד שמש', weekdays: ['daily'], start_date: null, end_date: null, repeat: 'single', tags: [], conditions: { items: [], type: null, track: false },
      slots: [{ start: '17:05:00', stop: null, actions: [{ service: 'switch.turn_off', entity_id: 'switch.boiler', data: {} }] }],
    });
  });

  test('the pending auto-off is found among the device schedules by its exact shape only', () => {
    const base = (over: Partial<Schedule>): Schedule =>
      ({
        id: 's', entity_id: null, name: 'x', display_name: 'x', enabled: true, state: 'on', days: { tokens: ['daily'], kind: 'daily', days: null }, start_date: null, end_date: null, repeat: 'single',
        slots: [{ index: 0, start: { kind: 'fixed', time: '17:05', raw: '17:05:00' }, stop: null, actions: [{ service: 'switch.turn_off', entity_id: 'switch.boiler', data: {}, supported: true, class: 'switch', sensitive: false, lowering: false }], supported: true, unsupported: [] }],
        conditions: { items: [], type: null, track: false, uniform: true, summary: null, preset: null }, entities: [], tags: [], folder_id: null, order: null, pinned: false,
        next_run: { at: '2026-10-05T14:05:00Z', slot_index: 0, source: 'computed', conditional: false }, upcoming: [], last_run: null, sensitive: false, sensitive_classes: [], lowering: false, source: 'arx', owner: null,
        created_at: null, updated_at: null, revision: 'r1', can: { edit: true, toggle: true, run: true, delete: true, copy: true }, read_only: null, warnings: [], ...over,
      }) as Schedule;
    const ok = base({});
    expect(findAutoOff([ok], 'switch.boiler', 'switch.turn_off')).toBe(ok);
    expect(findAutoOff([base({ repeat: 'repeat' })], 'switch.boiler', 'switch.turn_off')).toBeNull(); // a real recurring schedule is not a timer
    expect(findAutoOff([base({ enabled: false })], 'switch.boiler', 'switch.turn_off')).toBeNull();
    expect(findAutoOff([base({ next_run: null })], 'switch.boiler', 'switch.turn_off')).toBeNull();
    expect(findAutoOff([ok], 'switch.other', 'switch.turn_off')).toBeNull();
    expect(findAutoOff([ok], 'switch.boiler', null)).toBeNull(); // a domain whose off the scheduler cannot carry
  });

  test('every Hebrew card string has its English, and no card string names the platform', () => {
    const heKeys = Object.keys(he.deviceCard).sort();
    expect(Object.keys(en.deviceCard).sort()).toEqual(heKeys);
    for (const v of [...Object.values(he.deviceCard), ...Object.values(en.deviceCard)]) expect(v).not.toMatch(/Home Assistant|Ingress|\bHA\b/);
  });
});
