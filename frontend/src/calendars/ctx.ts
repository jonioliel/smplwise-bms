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

export interface NewEventDetail { calendarId?: string; start?: string; end?: string; eventId?: string }
export interface NewMaintDetail { rooms?: string[]; start?: string; end?: string }

export function emit(el: HTMLElement, name: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/** The calendars a filter leaves: the floor chip (rooms on that floor; calendars without a floor stay) and the search. */
export function visibleCals(ctx: Pick<CalCtx, 'cals' | 'floor' | 'q'>): Calendar[] {
  const q = ctx.q.trim();
  return ctx.cals.filter((c) => (!ctx.floor || !c.floor_id || c.floor_id === ctx.floor) && (!q || c.name.includes(q)));
}
