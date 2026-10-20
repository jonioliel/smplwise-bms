import { hev, type HevKey } from '../i18n/ha-events';
import type { EventFacets, EventKind, VmsEvent } from '../api/events';

// NVRLESS-295: the pure half of the sensor events list (investigate-ha-events.ts) - wording of a transition, the area options, the
// place label. No DOM, so the node-only unit specs import it.

/** NVRLESS-295: where a sensor event's entity is placed now (the server resolves it from the plan anchors). */
export type SensorPlace = { floor_id: string; floor_name: string; building_name?: string; zone: string | null } | null;
export type SensorEvent = VmsEvent & { place?: SensorPlace };

/** The type filter: the kinds the sensors produce (doors and locks, motion, the alarm panel's "other"). */
export const SENSOR_TYPES: { value: EventKind; label: HevKey }[] = [
  { value: 'door', label: 'typeDoor' },
  { value: 'motion', label: 'typeMotion' },
  { value: 'other', label: 'typeOther' },
];

const ON_STATES = new Set(['on', 'open', 'opening', 'unlocked', 'unlocking', 'triggered', 'detected']);
const OFF_STATES = new Set(['off', 'closed', 'closing', 'locked', 'locking', 'clear', 'disarmed']);

/** One line in the operator's words for a sensor transition (no entity ids, no platform names). Pure: unit-tested. */
export function describeSensorEvent(ev: Pick<VmsEvent, 'type' | 'details'>, lang?: Parameters<typeof hev>[2]): string {
  const d = ev.details ?? {};
  const to = String(d.to ?? '').toLowerCase();
  const from = String(d.from ?? '');
  const domain = String(d.domain ?? '');
  const say = (k: HevKey, v?: Record<string, string | number>) => hev(k, v, lang);
  if (d.availability === 'lost') return say('unavailable');
  if (d.availability === 'restored') return say('restored');
  if (ev.type === 'door') {
    if (domain === 'lock') return to === 'locked' ? say('locked') : to === 'unlocked' ? say('unlocked') : say('stateChange', { from, to: String(d.to ?? '') });
    if (ON_STATES.has(to)) return say('opened');
    if (OFF_STATES.has(to)) return say('closed');
  }
  if (ev.type === 'motion') {
    if (ON_STATES.has(to)) return say('motionStart');
    if (OFF_STATES.has(to)) return say('motionEnd');
  }
  if (ev.type === 'other' && domain === 'alarm_control_panel') return say('alarmChanged', { to: String(d.to ?? '') });
  return say('stateChange', { from, to: String(d.to ?? '') });
}

/** The area filter options from the facets: every floor with its rooms, flat (`floor:<id>` / `zone:<id>`). */
export function areaOptions(f: Pick<EventFacets, 'places'> | null): { value: string; label: string }[] {
  if (!f) return [];
  const out: { value: string; label: string }[] = [];
  for (const s of f.places) {
    for (const b of s.buildings) {
      for (const fl of b.floors) {
        const floor = `${b.name} · ${fl.name}`;
        out.push({ value: `floor:${fl.id}`, label: hev('areaFloor', { floor }) });
        for (const z of fl.zones) out.push({ value: `zone:${z.id}`, label: hev('areaZone', { floor, zone: z.name }) });
      }
    }
  }
  return out;
}

/** The place of a row, in words (the room when there is one, else the floor). */
export function placeLabel(p: SensorPlace | undefined): string {
  if (!p) return '';
  return p.zone ? `${p.zone} · ${p.floor_name}` : p.floor_name;
}

