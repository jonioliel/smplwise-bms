/**
 * CAL-GRID-EDIT-2343: the pure rule of the booking drawer (no DOM): unit-tested in Node (tests/unit-calendars-grid-edit-2343.spec.ts).
 */
import type { CalEvent } from '../api/calendars';

/** An existing entry opens as an editable form when this viewer may change it (a booker his own, an editor or manager every entry - the
 * server's `can.edit`), it is still open and not over, and it is an Arx booking or event; the server decides again on save. */
export function editableInDrawer(ev: Pick<CalEvent, 'can' | 'state' | 'kind' | 'end' | 'source'>, now: Date): boolean {
  return ev.can.edit && ['pending', 'confirmed'].includes(ev.state) && (ev.kind === 'booking' || ev.kind === 'event') && new Date(ev.end) > now && (ev.source ?? 'arx') === 'arx';
}
