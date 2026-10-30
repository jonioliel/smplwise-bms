/**
 * CALENDARS-UI-2310: what the frontend knows about the calendars module for this viewer - the switch, the placement of "יומנים" and `can`
 * from GET /calendar/module (it answers while the module is off), shared by the navigation and every calendars screen. The server checks
 * every call again; this only decides what is offered.
 *
 * Placement (owner, 2026-10-30 night, a setting): the side rail entry "יומנים" (default), a tab of the home area's top menu between
 * "מבט על" and "קברניט", or both. A viewer who has no home area (a tenant with calendars only, owner answer 25) always gets the rail entry.
 */
import { calendarsApi, type CalUi, type MenuPosition, type ModuleState } from '../api/calendars';
import { isApi, onSession } from '../api/session';
import { applyCalendarsNav } from '../shell/nav';

export interface CalAccess {
  /** null = not asked yet */
  enabled: boolean | null;
  placement: MenuPosition;
  can: ModuleState['can'];
  ui: CalUi;
}

export const UI_DEFAULTS: CalUi = {
  contested_order: 'first_come', displace_approver: 'calendar_manager', override_scope: 'both', phone_time_picker: 'grid', reauth_mode: 'reauth_and_continue',
  sync_conflict_display: 'side_by_side', tablet_panels: 'collapse', resident_pending_display: 'count', resident_cancel_until: 'start', resident_rooms: 'bookable',
  purge_confirm: 'type_word', loading_style: 'skeleton', allow_displace: true, guest_details_enabled: true,
};
const NONE: ModuleState['can'] = { view: false, book: false, book_for_others: false, manage: false, maintenance: false, guests: false, configure: false, connect: false };
const OFF: CalAccess = { enabled: false, placement: 'rail', can: NONE, ui: UI_DEFAULTS };

export function accessOf(s: ModuleState | null): CalAccess {
  // an answer without `can` (an older backend, a proxy page) reads as "off", like a failed read - never a TypeError
  if (!s || typeof s.can !== 'object' || s.can === null) return { ...OFF };
  const placement: MenuPosition = s.menu_position === 'home_tab' || s.menu_position === 'both' ? s.menu_position : 'rail';
  return { enabled: s.enabled === true, placement, can: { ...NONE, ...s.can }, ui: { ...UI_DEFAULTS, ...(s.ui ?? {}) } };
}

let current: CalAccess = { ...OFF, enabled: null };
const listeners = new Set<(a: CalAccess) => void>();

export function calAccess(): CalAccess {
  return current;
}

function publish(a: CalAccess): void {
  current = a;
  applyCalendarsNav(!!a.enabled && a.can.view, a.placement);
  for (const l of listeners) l(a);
}

export function onCalAccess(fn: (a: CalAccess) => void): () => void {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

let inflight: Promise<CalAccess> | null = null;

/** Asked when the session loads and after a switch in Settings. A failed read hides the module (an installation that does not use it
 * never sees an error banner for it). Without a backend the navigation keeps it OFF (like the tickets and notice board modules: an always-on
 * extra rail entry would move every demo screen), while the screens themselves answer from the demo. */
export function refreshCalendars(): Promise<CalAccess> {
  if (!isApi()) {
    inflight = null;
    return calendarsApi().then((api) => api.module()).then((s) => {
      const a = accessOf(s);
      current = a; // the screens read the demo's answer; the navigation stays off
      applyCalendarsNav(false, a.placement);
      for (const l of listeners) l(a);
      return a;
    });
  }
  inflight ??= calendarsApi().then((api) => api.module()).then((s) => accessOf(s)).catch(() => ({ ...OFF })).then((a) => {
    inflight = null;
    publish(a);
    return a;
  });
  return inflight;
}

let wired = false;
/** The shell calls this once: every new session (sign-in, a permission change) asks again. */
export function wireCalendars(): void {
  if (wired) return;
  wired = true;
  onSession((s) => {
    if (s.mode === 'loading') return;
    void refreshCalendars();
  });
}
