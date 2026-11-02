/**
 * CALENDARS-UI-2310: what <calendars-page> hands every view - one object, so a view never fetches the module state or the calendar list again.
 * A view asks the page to open a drawer or to reload through DOM events (CAL_EVENTS) instead of reaching up.
 */
import type { CalendarsApi, Calendar } from '../api/calendars';
import type { CalAccess } from './access';

export type CalView = 'cal' | 'rooms' | 'approvals' | 'maint' | 'manage';
export const CAL_VIEWS: CalView[] = ['cal', 'rooms', 'approvals', 'maint', 'manage'];

export interface CalCtx {
  api: CalendarsApi;
  access: CalAccess;
  /** every calendar the viewer may see (not archived) */
  cals: Calendar[];
  /** the floor chip: '' = all floors */
  floor: string;
  /** the page's search field */
  q: string;
  /** '#/calendars' or '#/devices/calendars' (the address the viewer came from) */
  base: string;
  /** the second address segment after the view (#/calendars/manage/<id>) */
  sub: string;
  /** "now", read once per render (the specs pin the clock) */
  now: Date;
  /** layout class of the window */
  device: 'desktop' | 'tablet' | 'phone';
  /** the viewer holds `manage` in at least one calendar */
  manages: boolean;
}

/** The events a view sends up to <calendars-page> (bubbles + composed). */
export const CAL_EVENTS = {
  /** open the new / edit booking drawer: detail { calendarId?, start?, end?, eventId? } */
  newEvent: 'cal-new-event',
  /** open the maintenance window drawer: detail { rooms?, start?, end? } */
  newMaint: 'cal-new-maint',
  /** something changed on the server: reload the calendars (counts) */
  changed: 'cal-changed',
  /** show a short message: detail string */
  toast: 'cal-toast',
} as const;

/** CAL-GRID-EDIT-2343: the quick create's draft travels into the full drawer on "פרטים נוספים" (nothing typed is lost). */
export interface NewEventDetail {
  calendarId?: string; start?: string; end?: string; eventId?: string;
  title?: string; repeat?: 'none' | 'daily' | 'weekly'; count?: number; behalf?: string; behalfLabel?: string; headcount?: number;
  /** CAL-ATTENDEES-2343 follow-up: the quick create's picked attendees (AttendeeDraft[]), seeded into the drawer's new-entry list */
  attendees?: unknown;
}

/**
 * CAL-GRID-EDIT-2343 - THE ATTENDEE SLOT. Named attendees are built on their own branch (pilot/CAL-ATTENDEES-2343); this branch only leaves
 * the place where the picker plugs in, in the quick create popover and in the booking drawer (new and edit). Until a picker registers,
 * nothing is drawn there and the existing fields (headcount, on behalf, guest details) are what a booking carries.
 *
 *   import { calHooks } from './ctx';
 *   calHooks.attendees = (p) => html`<cal-attendee-picker .calendarId=${p.calendarId} .eventId=${p.eventId} @change=${...}></cal-attendee-picker>`;
 *
 * `p.surface` says where it is drawn ('quick' = the narrow popover / phone sheet, 'drawer' = the full form); `p.onChange` hands the picked
 * value back to the host form, which sends it with the booking as `attendees` once the server knows that field (not sent by this branch).
 */
export interface AttendeeSlotProps { surface: 'quick' | 'drawer'; calendarId: string; eventId?: string; value: unknown; onChange: (value: unknown) => void }
export const calHooks: { attendees: ((p: AttendeeSlotProps) => unknown) | null } = { attendees: null };
/** The host's call: the registered picker's template, or nothing (the slot keeps its data attribute for the picker's own specs). */
export function attendeeSlot(p: AttendeeSlotProps): unknown {
  return calHooks.attendees ? calHooks.attendees(p) : null;
}
export interface NewMaintDetail { rooms?: string[]; start?: string; end?: string }

export function emit(el: HTMLElement, name: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** The calendars a filter leaves: the floor chip (rooms on that floor; calendars without a floor stay) and the search. */
export function visibleCals(ctx: Pick<CalCtx, 'cals' | 'floor' | 'q'>): Calendar[] {
  const q = ctx.q.trim();
  return ctx.cals.filter((c) => (!ctx.floor || !c.floor_id || c.floor_id === ctx.floor) && (!q || c.name.includes(q)));
}
