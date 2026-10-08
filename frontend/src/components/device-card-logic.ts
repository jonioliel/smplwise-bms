/**
 * CARD1 (2026-10-07): the pure logic of the three equipment cards inside the device activity window - water heater (דוד), tap / valve
 * (ברז) and robot vacuum (שואב רובוטי). Which card a server kind gets, which allow-listed action each button sends (per the entity's real
 * domain: a boiler or a tap wired through a switch keeps switch.turn_on / turn_off; a valve.* entity gets valve.open_valve / close_valve;
 * a vacuum gets start / pause / return_to_base), the one-off "auto-off" schedule the time-boxed run creates through the EXISTING scheduler
 * (a `single` schedule that deletes itself after running - no timer of our own, nothing that dies with the tab), and the words.
 * No Lit and no DOM, so the unit specs import it under Playwright's own transpiler.
 */
import type { ActivityItem, ActivityKind } from '../api/device-activity';
import type { Schedule, ScheduleDraft } from '../api/schedules';
import type { I18nKey } from '../i18n/he';

export type CardKind = 'water_heater' | 'valve' | 'vacuum';
export const CARD_KINDS: readonly CardKind[] = ['water_heater', 'valve', 'vacuum'];

/** How long the "open the tap" button must be held (the same family as the 500 ms long press that opens the window, but a decision). */
export const HOLD_MS = 1100;
/** The time-boxed runs offered (minutes). */
export const BOOST_MINUTES: readonly number[] = [30, 60, 90];
export const AUTO_CLOSE_MINUTES: readonly number[] = [10, 20, 30];

export function cardKindOf(kind: ActivityKind | null | undefined): CardKind | null {
  return kind === 'water_heater' || kind === 'valve' || kind === 'vacuum' ? kind : null;
}

export const domainOf = (entityId: string): string => entityId.split('.')[0] ?? '';

export interface CardAction {
  /** The allow-listed action id (services/ha_bridge.ACTIONS). */
  action: string;
  /** The optimistic value / expected state. */
  expect: string;
  /** True when the server treats it as "attention": the UI holds-to-confirm and sends the confirmation grant. */
  confirm: boolean;
  /** The i18n key of the button / command label. */
  label: I18nKey;
}

export interface PowerActions {
  on: CardAction;
  off: CardAction;
  /** The service the scheduler may carry for the auto-off (schedule_policy allow-list), or null when there is none for this domain. */
  schedulableOff: string | null;
}

/** The on / off (open / close) pair of a water heater or a tap, by the entity's real domain; null when the domain has no mapping. */
export function powerActions(kind: CardKind, entityId: string): PowerActions | null {
  const domain = domainOf(entityId);
  if (kind === 'water_heater') {
    if (domain === 'switch' || domain === 'input_boolean') {
      return { on: { action: `${domain}.turn_on`, expect: 'on', confirm: false, label: 'deviceCard.heaterTurnOn' }, off: { action: `${domain}.turn_off`, expect: 'off', confirm: false, label: 'deviceCard.heaterTurnOff' }, schedulableOff: `${domain}.turn_off` };
    }
    if (domain === 'water_heater') {
      return { on: { action: 'water_heater.turn_on', expect: 'on', confirm: false, label: 'deviceCard.heaterTurnOn' }, off: { action: 'water_heater.turn_off', expect: 'off', confirm: false, label: 'deviceCard.heaterTurnOff' }, schedulableOff: null };
    }
    return null;
  }
  if (kind === 'valve') {
    if (domain === 'switch' || domain === 'input_boolean') {
      // a relay-wired tap: opening lets water flow - held to confirm in the UI even though the service itself is routine
      return { on: { action: `${domain}.turn_on`, expect: 'on', confirm: true, label: 'deviceCard.valveDoOpen' }, off: { action: `${domain}.turn_off`, expect: 'off', confirm: false, label: 'deviceCard.valveDoClose' }, schedulableOff: `${domain}.turn_off` };
    }
    if (domain === 'valve') {
      return { on: { action: 'valve.open_valve', expect: 'open', confirm: true, label: 'deviceCard.valveDoOpen' }, off: { action: 'valve.close_valve', expect: 'closed', confirm: false, label: 'deviceCard.valveDoClose' }, schedulableOff: null };
    }
    return null;
  }
  return null;
}

export const VACUUM_ACTIONS: { start: CardAction; pause: CardAction; dock: CardAction } = {
  start: { action: 'vacuum.start', expect: 'cleaning', confirm: false, label: 'deviceCard.vacStart' },
  pause: { action: 'vacuum.pause', expect: 'paused', confirm: false, label: 'deviceCard.vacPause' },
  dock: { action: 'vacuum.return_to_base', expect: 'returning', confirm: false, label: 'deviceCard.vacDock' },
};

/** Is the device "on" (heating / open / cleaning) for its kind, from the state string? */
export function isOnState(kind: CardKind, state: string | null | undefined): boolean {
  if (!state || state === 'unavailable' || state === 'unknown') return false;
  if (kind === 'valve') return state === 'on' || state === 'open' || state === 'opening';
  if (kind === 'vacuum') return state === 'cleaning' || state === 'returning';
  return state !== 'off';
}

export function isMovingState(state: string | null | undefined): boolean {
  return state === 'opening' || state === 'closing';
}

/** The i18n key of the big state word, per kind. */
export function stateKey(kind: CardKind, state: string | null | undefined): I18nKey {
  if (!state || state === 'unavailable' || state === 'unknown') return 'deviceCard.stateUnknown';
  if (kind === 'water_heater') return state === 'off' ? 'deviceCard.heaterOff' : 'deviceCard.heaterOn';
  if (kind === 'valve') {
    if (state === 'opening') return 'deviceCard.valveOpening';
    if (state === 'closing') return 'deviceCard.valveClosing';
    return isOnState('valve', state) ? 'deviceCard.valveOpen' : 'deviceCard.valveClosed';
  }
  const v: Record<string, I18nKey> = { docked: 'deviceCard.vacDocked', cleaning: 'deviceCard.vacCleaning', paused: 'deviceCard.vacPaused', returning: 'deviceCard.vacReturning', idle: 'deviceCard.vacIdle', error: 'deviceCard.vacError' };
  return v[state] ?? 'deviceCard.stateUnknown';
}

/** A vacuum's fan speed in words, or the vendor's own word when we do not know it. */
export function fanSpeedKey(v: string | null | undefined): I18nKey | null {
  const s = (v ?? '').toLowerCase();
  if (!s) return null;
  if (/quiet|silent|gentle|low/.test(s)) return 'deviceCard.fanQuiet';
  if (/standard|balanced|normal|auto/.test(s)) return 'deviceCard.fanStandard';
  if (/medium/.test(s)) return 'deviceCard.fanMedium';
  if (/high|strong/.test(s)) return 'deviceCard.fanHigh';
  if (/turbo/.test(s)) return 'deviceCard.fanTurbo';
  if (/max/.test(s)) return 'deviceCard.fanMax';
  return null;
}

/** When the vacuum last started cleaning, from the activity feed (newest first): the latest "to cleaning" event, or null. */
export function lastCleaningAt(items: readonly ActivityItem[]): string | null {
  return items.find((i) => i.kind === 'power' && i.to.state === 'cleaning')?.at ?? null;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "HH:MM:00" local, `minutes` from `now`, wrapped at midnight (the schedule's days are `daily`, so tomorrow's time is tomorrow). */
export function autoOffTime(now: Date, minutes: number): string {
  const d = new Date(now.getTime() + minutes * 60_000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

/** The one-off schedule that turns the device off (closes the tap) `minutes` from now: `single` = runs once, then the component deletes it. */
export function autoOffDraft(entityId: string, offService: string, name: string, now: Date, minutes: number): ScheduleDraft {
  return {
    name,
    weekdays: ['daily'],
    start_date: null,
    end_date: null,
    repeat: 'single',
    tags: [],
    conditions: { items: [], type: null, track: false },
    slots: [{ start: autoOffTime(now, minutes), stop: null, actions: [{ service: offService, entity_id: entityId, data: {} }] }],
  };
}

/** The pending auto-off of this device among its schedules: enabled, runs once, its only action turns THIS device off, and a next run exists. */
export function findAutoOff(schedules: readonly Schedule[], entityId: string, offService: string | null): Schedule | null {
  if (!offService) return null;
  return (
    schedules.find(
      (s) =>
        s.enabled && s.repeat === 'single' && !!s.next_run && s.slots.length === 1 && s.slots[0].actions.length === 1 && s.slots[0].actions[0].service === offService && s.slots[0].actions[0].entity_id === entityId,
    ) ?? null
  );
}
