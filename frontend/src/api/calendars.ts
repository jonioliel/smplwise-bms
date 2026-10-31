/**
 * CALENDARS-UI-2310: the ONLY module of the frontend that talks to `/api/v1/calendar...` (routers/calendar.py, routers/calendar_sync.py;
 * docs/changes/CALENDARS-CONTRACT-298.md section 13). The server is the authority for every permission, visibility and conflict rule; the
 * screens only hide what `can` / `my_role` say is not offered. Without a backend (the static demo, the visual matrix) every call is answered
 * by calendars/demo.ts - invented data, never a network call.
 */
import { del, get, patch, post, put } from './client';
import { isApi } from './session';

export type CalType = 'room' | 'team' | 'maintenance' | 'event';
export type CalColor = 'blue' | 'rose' | 'cyan' | 'orange' | 'violet' | 'brown' | 'magenta' | 'slate';
export type CalRole = 'view' | 'book' | 'edit' | 'manage';
export type EntryState = 'pending' | 'confirmed' | 'rejected' | 'withdrawn' | 'expired' | 'cancelled' | 'displaced' | 'done';
export type EntryKind = 'booking' | 'event' | 'maintenance' | 'external' | 'holiday' | 'ticket_visit' | 'maintenance_task';
export type OverlapMode = 'first_holds' | 'override_notify' | 'block' | 'ask';
export type ApprovalMode = 'none' | 'always' | 'outside_hours' | 'on_behalf';
export type OnBehalfKind = 'self' | 'team' | 'class' | 'customer' | 'department' | 'vendor';
export type MenuPosition = 'rail' | 'home_tab' | 'both';
export type Equipment = 'screen' | 'projector' | 'video_call' | 'whiteboard' | 'kitchen' | 'accessible';

export const CAL_TYPES: readonly CalType[] = ['room', 'team', 'maintenance', 'event'];
export const CAL_COLORS: readonly CalColor[] = ['blue', 'rose', 'cyan', 'orange', 'violet', 'brown', 'magenta', 'slate'];
export const CAL_ROLES: readonly CalRole[] = ['view', 'book', 'edit', 'manage'];

export interface Person { id: string; name: string }
export interface SyncInfo { state: 'ok' | 'error' | 'paused' | 'needs_reauth' | 'revoked' | 'pending'; provider: 'ical' | 'google' | 'microsoft'; direction: string; detail?: string; dedicated?: boolean }

export interface Calendar {
  id: string;
  name: string;
  type: CalType;
  description?: string;
  color: CalColor;
  tz: string;
  owner: Person;
  my_role: CalRole | null;
  visibility: 'members' | 'busy_to_all' | 'details_to_all';
  approval_mode: ApprovalMode;
  approval_timeout_h: number | null;
  capacity: number | null;
  equipment: Equipment[];
  floor_id: string | null;
  area_ref: string | null;
  conflict_policy?: 'exclusive' | 'overlap';
  buffer_after_min?: number;
  slot_step_min?: number;
  min_minutes?: number | null;
  max_minutes?: number | null;
  horizon_days?: number;
  overlap_override: OverlapMode | null;
  sync: SyncInfo | null;
  pending_count: number;
  archived: boolean;
  revision: number;
  /** demo / UI only: a floor's display name (the server answers floor_id; the screen resolves the name from the building tree) */
  floor_name?: string;
}

export interface Occurrence {
  occurrence_id: string;
  event_id: string;
  calendar_id: string;
  room_calendar_ids: string[];
  start: string;
  end: string;
  all_day?: boolean;
  title: string | null;
  state: EntryState;
  kind: EntryKind;
  on_behalf_label: string | null;
  organizer: Person | null;
  recurring: boolean;
  contested?: boolean;
  sync_flag?: 'conflict' | 'deleted_external' | null;
}

export interface RoomDay {
  calendar_id: string;
  name: string;
  capacity: number | null;
  equipment: Equipment[];
  open: { from: string; to: string }[];
  entries: Occurrence[];
}

export interface CalEvent {
  id: string;
  calendar_id: string;
  kind: EntryKind;
  title: string | null;
  notes: string | null;
  start: string;
  end: string;
  all_day: boolean;
  tz: string;
  rrule: string | null;
  state: EntryState;
  contested: boolean;
  on_behalf_label: string | null;
  on_behalf_kind: OnBehalfKind | null;
  headcount: number | null;
  organizer: Person | null;
  revision: number;
  recurring: boolean;
  source?: string;
  sync_flag?: string | null;
  can: { edit: boolean; cancel: boolean; approve: boolean };
  rooms: { room_calendar_id: string; state: EntryState; contested: boolean }[];
}

export interface CalRequest {
  event_id: string;
  room_calendar_id: string | null;
  calendar: { id: string; name: string; color: CalColor };
  title: string | null;
  kind: EntryKind;
  start: string;
  end: string;
  recurring: boolean;
  organizer: Person | null;
  on_behalf_label: string | null;
  headcount: number | null;
  contested: boolean;
  competing_count: number;
  conflicts_now: number;
  requested_at: string;
  revision: number;
  queue_position?: number;
  suggested?: boolean;
  /** demo / UI: a recurring summary (the server sends `recurring` only) */
  recurring_summary?: string;
  guests_count?: number;
}

export interface Member { subject_kind: 'user' | 'role' | 'department' | 'everyone'; subject_id: string; label: string; cal_role: CalRole }

export interface CalSettings {
  enabled: boolean;
  maintenance_overlap: OverlapMode;
  contested_requests: 'queue' | 'reject';
  pending_holds_slot: boolean;
  menu_position: MenuPosition;
  holiday_eve_as_holiday: boolean;
  guest_details_enabled: boolean;
  guest_details_kinds: OnBehalfKind[];
  guest_retention_days: number;
  editors_bypass_approval: boolean;
  default_room_buffer_after_min: number;
  series_horizon_days: number;
  max_calendars: number;
  notify_confirmations: boolean;
  contested_order: 'first_come' | 'manual' | 'by_kind';
  allow_displace: boolean;
  displace_approver: 'calendar_manager' | 'any_manager';
  override_scope: 'both' | 'stricter' | 'none';
  phone_time_picker: 'grid' | 'timeline';
  reauth_mode: 'reauth_and_continue' | 'reauth_only';
  sync_conflict_display: 'side_by_side' | 'list_only';
  tablet_panels: 'collapse' | 'shrink';
  resident_pending_display: 'count' | 'free' | 'blocked';
  resident_cancel_until: 'start' | '1h' | '24h';
  resident_rooms: 'bookable' | 'all_busy';
  purge_confirm: 'type_word' | 'one_click';
  loading_style: 'skeleton' | 'spinner';
  default_approval_timeout_h: number;
  reopen_days: number;
  sync_external_delete: 'cancel' | 'flag';
  [k: string]: unknown;
}

/** The presentation choices GET /calendar/module carries (every screen needs them before it draws). */
export type CalUi = Pick<CalSettings, 'contested_order' | 'displace_approver' | 'override_scope' | 'phone_time_picker' | 'reauth_mode' | 'sync_conflict_display' | 'tablet_panels'
  | 'resident_pending_display' | 'resident_cancel_until' | 'resident_rooms' | 'purge_confirm' | 'loading_style' | 'allow_displace' | 'guest_details_enabled'>;

export interface ModuleState {
  enabled: boolean;
  menu_position: MenuPosition;
  can: { view: boolean; book: boolean; book_for_others: boolean; manage: boolean; maintenance: boolean; guests: boolean; configure: boolean; connect: boolean };
  ui?: Partial<CalUi>;
}

export interface Connection {
  id: string;
  provider: 'ical' | 'google' | 'microsoft';
  label: string;
  scope: string;
  state: SyncInfo['state'];
  owner: Person;
  last_sync_at: string | null;
  next_sync_at: string | null;
  error_code: string | null;
  adapter_available: boolean;
  bindings: { id: string; calendar_id: string; direction: string; detail: string; dedicated: boolean }[];
  revision: number;
}

export interface SyncFlag { event_id: string; calendar: { id: string; name: string; color: CalColor }; title: string | null; start: string; end: string; flag: 'conflict' | 'deleted_external'; source: string; state: EntryState; revision: number }

export interface MaintOverlap { event_id: string; calendar_id: string; start: string; end: string; title: string | null; organizer: Person | null; state: EntryState }
export interface MaintPreview { overlaps: MaintOverlap[]; mode: OverlapMode; alternatives: { start: string; end: string }[] }

export interface NewEvent {
  calendar_id: string;
  kind?: 'booking' | 'event';
  title: string;
  notes?: string;
  start: string;
  end: string;
  rrule?: string;
  rooms?: string[];
  on_behalf?: { kind: OnBehalfKind; label: string };
  headcount?: number;
  guests?: { name: string; phone: string }[];
}
export interface EventPreview { conflicts: { calendar_id: string; start: string; end: string; title: string | null; state: EntryState }[]; needs_approval_by: string[]; outside_hours: boolean; holiday_hits: string[]; capacity_ok: boolean }

/** The wire calls. One object so the demo can stand in for it as a whole (calendars/demo.ts implements the same shape). */
export interface CalendarsApi {
  module(): Promise<ModuleState>;
  settings(): Promise<{ settings: CalSettings; can_configure: boolean }>;
  saveSettings(doc: CalSettings): Promise<{ settings: CalSettings; erase_preview: number }>;
  purgeGuests(): Promise<{ erased: number }>;
  calendars(includeArchived?: boolean): Promise<{ calendars: Calendar[] }>;
  createCalendar(body: Partial<Calendar> & { name: string; type: CalType; color: CalColor; owner_user_id?: string }): Promise<{ calendar: Calendar }>;
  patchCalendar(id: string, body: Record<string, unknown>): Promise<{ calendar: Calendar }>;
  archiveCalendar(id: string, revision: number): Promise<{ calendar: Calendar }>;
  members(id: string): Promise<{ members: Member[] }>;
  putMembers(id: string, revision: number, members: Member[]): Promise<{ members: Member[] }>;
  occurrences(from: string, to: string, calendars?: string[]): Promise<{ occurrences: Occurrence[]; truncated: boolean }>;
  roomsDay(date: string): Promise<{ rooms: RoomDay[] }>;
  createEvent(body: NewEvent): Promise<{ event: CalEvent; state: EntryState }>;
  previewEvent(body: NewEvent): Promise<EventPreview>;
  event(id: string): Promise<{ event: CalEvent }>;
  cancelEvent(id: string, revision: number, occurrenceStart?: string): Promise<{ event: CalEvent }>;
  withdrawEvent(id: string, revision: number): Promise<{ event: CalEvent }>;
  mine(from?: string, to?: string): Promise<{ occurrences: Occurrence[] }>;
  requests(): Promise<{ requests: CalRequest[] }>;
  decide(id: string, body: { decision: 'approve' | 'reject'; revision: number; room_calendar_id?: string | null; note?: string; displace_existing?: boolean; except_occurrences?: string[] }): Promise<{ state: EntryState }>;
  maintPreview(body: { calendar_id: string; rooms: string[]; start: string; end: string }): Promise<MaintPreview>;
  maintPlace(body: { calendar_id: string; title: string; rooms: string[]; start: string; end: string; notes?: string; overlap_decision?: 'override_notify' | 'block' }): Promise<{ event: CalEvent; displaced: string[] }>;
  connections(): Promise<{ connections: Connection[] }>;
  syncNow(id: string): Promise<unknown>;
  pauseConnection(id: string): Promise<{ connection: Connection }>;
  resumeConnection(id: string): Promise<{ connection: Connection }>;
  removeConnection(id: string): Promise<void>;
  syncFlags(): Promise<{ flags: SyncFlag[] }>;
  resolveFlag(id: string, revision: number, resolution: 'keep' | 'cancel'): Promise<unknown>;
}

const q = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const httpCalendars: CalendarsApi = {
  module: () => get('/calendar/module'),
  settings: () => get('/calendar/settings'),
  saveSettings: (doc) => put('/calendar/settings', doc),
  purgeGuests: () => post('/calendar/guests/purge'),
  calendars: (arch) => get(`/calendar/calendars${arch ? '?include_archived=1' : ''}`),
  createCalendar: (body) => post('/calendar/calendars', body),
  patchCalendar: (id, body) => patch(`/calendar/calendars/${encodeURIComponent(id)}`, body),
  archiveCalendar: (id, revision) => post(`/calendar/calendars/${encodeURIComponent(id)}/archive`, { revision }),
  members: (id) => get(`/calendar/calendars/${encodeURIComponent(id)}/members`),
  putMembers: (id, revision, members) => put(`/calendar/calendars/${encodeURIComponent(id)}/members`, { revision, members }),
  occurrences: (from, to, cals) => get(`/calendar/occurrences${q({ from, to, calendars: cals?.join(',') })}`),
  roomsDay: (date) => get(`/calendar/rooms/day${q({ date })}`),
  createEvent: (body) => post('/calendar/events', body),
  previewEvent: (body) => post('/calendar/events/preview', body),
  event: (id) => get(`/calendar/events/${encodeURIComponent(id)}`),
  cancelEvent: (id, revision, occurrence_start) => post(`/calendar/events/${encodeURIComponent(id)}/cancel`, occurrence_start ? { revision, scope: 'occurrence', occurrence_start } : { revision }),
  withdrawEvent: (id, revision) => post(`/calendar/events/${encodeURIComponent(id)}/withdraw`, { revision }),
  mine: (from, to) => get(`/me/calendar${q({ from, to })}`),
  requests: () => get('/calendar/requests'),
  decide: (id, body) => post(`/calendar/requests/${encodeURIComponent(id)}/decide`, body),
  maintPreview: (body) => post('/calendar/maintenance/preview', body),
  maintPlace: (body) => post('/calendar/maintenance', body),
  connections: () => get('/calendar/connections'),
  syncNow: (id) => post(`/calendar/connections/${encodeURIComponent(id)}/sync`),
  pauseConnection: (id) => post(`/calendar/connections/${encodeURIComponent(id)}/pause`),
  resumeConnection: (id) => post(`/calendar/connections/${encodeURIComponent(id)}/resume`),
  removeConnection: (id) => del(`/calendar/connections/${encodeURIComponent(id)}`),
  syncFlags: () => get('/calendar/sync/flags'),
  resolveFlag: (id, revision, resolution) => post(`/calendar/events/${encodeURIComponent(id)}/sync-resolve`, { revision, resolution }),
};

let demoApi: Promise<CalendarsApi> | null = null;
/** The client for the current session: the server, or (no backend) the demo behind a dynamic import - the demo data never ships into
 * the installation's hot path unless it is asked for. */
export function calendarsApi(): Promise<CalendarsApi> {
  if (isApi()) return Promise.resolve(httpCalendars);
  demoApi ??= import('../calendars/demo').then((m) => m.demoCalendars);
  return demoApi;
}
