/**
 * Plan Studio 6, slice S5-B (CR-029 section 3.4, docs/changes/CR-029-ST7-S5B-NOTES.md): a signature of what a plan shows of its
 * devices, so a kiosk can tell "something changed" from "the clock ticked". Pure and deterministic: the same facts in any order
 * give the same string.
 *
 * It names the discrete things a wall display would visibly change for - which rooms are lit, where there is presence (the
 * boolean, not its fade), which openings are open, each circuit's switch (unknown is its own value: a stale switch is a change),
 * each camera's status, each room's lock and alarm state. It leaves out what drifts without anything happening: the presence tint's
 * fade steps and age, and the temperatures. Without that, a fading tint would wake an idle kiosk twelve times per window.
 */
import type { RoomStateLayer } from './room-state';

export interface PlanChangeInput {
  layer: RoomStateLayer | null;
  /** circuit id -> switch state ('on' / 'off' / ...); null = unknown (stale). */
  circuits: Record<string, string | null>;
  /** camera anchor id -> its status ('online' / 'offline' / ...). */
  cameras: Record<string, string>;
}

const by = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const pairs = (o: Record<string, string | null>): string =>
  Object.keys(o)
    .sort(by)
    .map((k) => `${k}=${o[k] ?? '?'}`)
    .join(',');

export function planChangeKey(i: PlanChangeInput): string {
  const rooms = Object.values(i.layer?.rooms ?? {}).sort((a, b) => by(a.id, b.id));
  const lit = rooms.filter((r) => r.lit).map((r) => r.id);
  const presence = rooms.filter((r) => r.presence).map((r) => r.id);
  const locks = rooms.filter((r) => r.lock !== null || r.alarm !== null).map((r) => `${r.id}=${r.lock ?? '-'}/${r.alarm ?? '-'}`);
  const open = [...(i.layer?.openOpenings ?? [])].sort(by);
  return [`lit:${lit.join(',')}`, `pre:${presence.join(',')}`, `open:${open.join(',')}`, `cir:${pairs(i.circuits)}`, `cam:${pairs(i.cameras)}`, `lock:${locks.join(',')}`].join('|');
}
