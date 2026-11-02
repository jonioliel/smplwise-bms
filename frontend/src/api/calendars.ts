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
/** CAL-GRID-EDIT-2343 (owner answer 3C, per calendar): moving an approved booking that now needs an approval. */
export type ApprovedMove = 'reapproval' | 'managers';
export type GridEdit = 'drag' | 'create_only';
export interface OpenHours { weekdays: number[]; start: string; end: string }
export type Equipment = 'screen' | 'projector' | 'video_call' | 'whiteboard' | 'kitchen' | 'accessible';

export const CAL_TYPES: readonly CalType[] = ['room', 'team', 'maintenance', 'event'];
export const CAL_COLORS: readonly CalColor[] = ['blue', 'rose', 'cyan', 'orange', 'violet', 'brown', 'magenta', 'slate'];
export const CAL_ROLES: readonly CalRole[] = ['view', 'book', 'edit', 'manage'];

export interface Person { id: string; name: string }
export interface SyncInfo { state: 'ok' | 'error' | 'paused' | 'needs_reauth' | 'revoked' | 'pending'; provider: 'ical' | 'ics_in' | 'ics_out' | 'google' | 'microsoft'; direction: string; detail?: string; dedicated?: boolean }

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
  buffer_before_min?: number;
  slot_step_min?: number;
  min_minutes?: number | null;
  max_minutes?: number | null;
  horizon_days?: number;
  overlap_override: OverlapMode | null;
  /** CAL-GRID-EDIT-2343: the per-calendar rule for moving an approved booking (default re-approval) */
  approved_move?: ApprovedMove;
  /** CAL-GRID-EDIT-2343: the open hours in force ({weekdays ISO 1-7, start, end}); null = always open; absent = unknown (no hint) */
  open_hours?: OpenHours | null;
  lead_min?: number;
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
  /** CAL-GRID-EDIT-2343: may this viewer move / resize it (the PATCH decides again), its revision and local start */
  can_edit?: boolean;
  revision?: number;
  local_start?: string;
  /** a change request: the approved slot it keeps until the decision */
  held?: { calendar_id: string; start: string; end: string } | null;
  /** this row IS such a kept slot (drawn dotted, never dragged) */
  held_slot?: boolean;
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
  can: { edit: boolean; cancel: boolean; approve: boolean; restore?: boolean };
  rooms: { room_calendar_id: string; state: EntryState; contested: boolean }[];
  /** CAL-GRID-EDIT-2343: the approved slot a change request keeps */
  held?: { calendar_id: string; start: string; end: string } | null;
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
  /** CAL-GRID-EDIT-2343: a change of an approved booking - the slot it keeps until the decision */
  change_of?: { calendar_id: string; start: string; end: string } | null;
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
  /** CAL-FEED-REVIEW-2351 round 14 (3C): the expiry a new or renewed feed address gets, in days (0 = no limit; default 365) */
  feed_max_age_days?: number;
  /** CAL-GRID-EDIT-2343 */
  grid_edit?: GridEdit;
  cancel_notice_delay_s?: number;
  undo_window_s?: number;
  [k: string]: unknown;
}

/** The presentation choices GET /calendar/module carries (every screen needs them before it draws). */
export type CalUi = Pick<CalSettings, 'contested_order' | 'displace_approver' | 'override_scope' | 'phone_time_picker' | 'reauth_mode' | 'sync_conflict_display' | 'tablet_panels'
  | 'resident_pending_display' | 'resident_cancel_until' | 'resident_rooms' | 'purge_confirm' | 'loading_style' | 'allow_displace' | 'guest_details_enabled'> & { grid_edit?: GridEdit };

export interface ModuleState {
  enabled: boolean;
  menu_position: MenuPosition;
  can: { view: boolean; book: boolean; book_for_others: boolean; manage: boolean; maintenance: boolean; guests: boolean; configure: boolean; connect: boolean };
  ui?: Partial<CalUi>;
}

/** The provider names of the server (`ics_in` iCal subscription, `ics_out` iCal feed) and the screen's card names (`ical`). */
export type ServerProvider = 'ics_in' | 'ics_out' | 'google' | 'microsoft';
export type ProviderCard = 'ical' | 'google' | 'microsoft';

/** CALCONNECT-2330: what the server says about a connection's credentials - flags only, never a value. */
export interface ConnSetup {
  client_id_set: boolean;
  client_secret_set: boolean;
  authorized: boolean;
  feed_url_set: boolean;
  tenant: string | null;
  ready: boolean;
  pending_flow: 'google' | 'microsoft' | null;
}

export interface Connection {
  id: string;
  provider: ProviderCard | ServerProvider;
  label: string;
  scope: string;
  state: SyncInfo['state'];
  owner: Person;
  last_sync_at: string | null;
  next_sync_at: string | null;
  error_code: string | null;
  adapter_available: boolean;
  account_hint?: string | null;
  setup?: ConnSetup;
  bindings: { id: string; calendar_id: string; direction: string; detail: string; dedicated: boolean }[];
  revision: number;
}

/** Google answers an address to open and takes back the loopback address; Microsoft answers a device code. */
export type AuthorizeStart =
  | { flow: 'paste'; authorize_url: string; redirect_prefix: string; expires_in: number }
  | { flow: 'device'; user_code: string; verification_url: string; expires_in: number; interval: number };
export interface AuthorizePoll { state: 'none' | 'pending' | 'slow_down' | 'denied' | 'expired' | 'connected'; interval?: number; connection?: Connection }
export interface ExtCalendar { id_ref: string; name: string; can_write: boolean; is_primary: boolean }
export interface BindingBody { connection_id: string | null; external_calendar_ref?: string; direction?: 'export' | 'import' | 'two_way'; detail?: 'busy' | 'titles' | 'details'; dedicated?: boolean }
export interface Feed {
  id: string; calendar_ids: string[]; detail: 'busy' | 'titles'; created_at: string; last_used_at: string | null; revoked: boolean;
  /** CAL-FEED-REVIEW-2351: the address also answers outside the building network (the per-feed remote switch, default off) */
  remote?: boolean;
  /** round 14 (4A): what the document really carries - always 'busy' while `remote` is on, whatever `detail` says */
  detail_effective?: 'busy' | 'titles';
  /** round 14 (2A): may THIS person change the remote switch now (on: an administrator or the creator managing every calendar of the feed) */
  can_remote?: boolean;
  /** round 14 (3C): when the current address stops answering (null = no expiry); fixed when the address was issued */
  expires_at?: string | null;
  token_set_at?: string;
}
/** GET /calendar/feeds. `local` false = this page came through the remote channel, where the server refuses the remote switch. */
export interface FeedList { feeds: Feed[]; enabled: boolean; local?: boolean; default_max_age_days?: number }

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
/** CAL-GRID-EDIT-2343: PATCH /calendar/events/{id} - a move / resize / edit (only the keys sent change). */
export interface EventPatch {
  revision: number;
  calendar_id?: string;
  title?: string;
  notes?: string;
  start?: string;
  end?: string;
  all_day?: boolean;
  headcount?: number | null;
  on_behalf?: { kind: OnBehalfKind; label: string };
  scope?: 'occurrence' | 'following' | 'series';
  occurrence_start?: string;
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
  withdrawEvent(id: string, revision: number): Promise<{ event: CalEvent; change_withdrawn?: boolean }>;
  /** CAL-GRID-EDIT-2343: a move / resize / edit, and "בטל" after a delete */
  patchEvent(id: string, body: EventPatch): Promise<{ event: CalEvent; change_withdrawn?: boolean }>;
  restoreEvent(id: string, revision: number): Promise<{ event: CalEvent; state: EntryState }>;
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
  // CALCONNECT-2330: the connect flow
  createConnection(body: { provider: ServerProvider; label: string; scope: 'read' | 'read_write' }): Promise<{ connection: Connection; setup_steps: string[] }>;
  putClient(id: string, body: { client_id: string; client_secret?: string; tenant?: string }): Promise<{ connection: Connection }>;
  putFeedUrl(id: string, url: string): Promise<{ connection: Connection }>;
  authorize(id: string): Promise<AuthorizeStart>;
  authorizeComplete(id: string, redirectUrl: string): Promise<AuthorizePoll>;
  authorizePoll(id: string): Promise<AuthorizePoll>;
  authorizeCancel(id: string): Promise<void>;
  connectionCalendars(id: string): Promise<{ calendars: ExtCalendar[] }>;
  putBinding(calendarId: string, body: BindingBody): Promise<unknown>;
  feeds(): Promise<FeedList>;
  createFeed(calendarIds: string[], detail: 'busy' | 'titles'): Promise<{ feed: Feed; path: string }>;
  rotateFeed(id: string): Promise<{ feed: Feed; path: string }>;
  revokeFeed(id: string): Promise<{ feed: Feed }>;
  /** CAL-FEED-REVIEW-2351 round 14: the per-feed remote switch (a local session only) */
  setFeedRemote(id: string, enabled: boolean): Promise<{ feed: Feed }>;
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
  patchEvent: (id, body) => patch(`/calendar/events/${encodeURIComponent(id)}`, body),
  restoreEvent: (id, revision) => post(`/calendar/events/${encodeURIComponent(id)}/restore`, { revision }),
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
  createConnection: (body) => post('/calendar/connections', body),
  putClient: (id, body) => put(`/calendar/connections/${encodeURIComponent(id)}/client`, body),
  putFeedUrl: (id, url) => put(`/calendar/connections/${encodeURIComponent(id)}/feed`, { url }),
  authorize: (id) => post(`/calendar/connections/${encodeURIComponent(id)}/authorize`),
  authorizeComplete: (id, redirect_url) => post(`/calendar/connections/${encodeURIComponent(id)}/authorize/complete`, { redirect_url }),
  authorizePoll: (id) => post(`/calendar/connections/${encodeURIComponent(id)}/authorize/poll`),
  authorizeCancel: (id) => del(`/calendar/connections/${encodeURIComponent(id)}/authorize`),
  connectionCalendars: (id) => get(`/calendar/connections/${encodeURIComponent(id)}/calendars`),
  putBinding: (cid, body) => put(`/calendar/calendars/${encodeURIComponent(cid)}/binding`, body),
  feeds: () => get('/calendar/feeds'),
  createFeed: (calendar_ids, detail) => post('/calendar/feeds', { calendar_ids, detail }),
  rotateFeed: (id) => post(`/calendar/feeds/${encodeURIComponent(id)}/rotate`),
  revokeFeed: (id) => post(`/calendar/feeds/${encodeURIComponent(id)}/revoke`),
  setFeedRemote: (id, enabled) => put(`/calendar/feeds/${encodeURIComponent(id)}/remote`, { enabled }),
};

/** The screen's card of a server provider: both iCal kinds share the iCal card. */
export function cardOf(p: Connection['provider']): ProviderCard {
  return p === 'ics_in' || p === 'ics_out' || p === 'ical' ? 'ical' : p;
}

/** The server provider a new connection of a card is created with (the iCal card subscribes; feeds have their own list). */
export function serverProviderOf(card: ProviderCard): ServerProvider {
  return card === 'ical' ? 'ics_in' : card;
}

/** CALCONNECT-2330: a connection's error code in the owner's words (auth expired / quota / rate limit / feed problems ...). */
export const CONN_ERROR_HE: Record<string, string> = {
  auth_expired: 'ההרשאה פגה או בוטלה אצל הספק. יש לאשר מחדש.',
  not_authorized: 'החיבור עדיין לא אושר אצל הספק.',
  needs_reauth: 'נדרשת הרשאה מחדש אצל הספק.',
  token_revoked: 'ההרשאה בוטלה אצל הספק. יש לאשר מחדש.',
  rate_limited: 'הספק מגביל כרגע את קצב הבקשות. ננסה שוב אוטומטית.',
  quota_exceeded: 'המכסה היומית אצל הספק נוצלה. ננסה שוב מאוחר יותר.',
  provider_unavailable: 'הספק לא זמין כרגע. ננסה שוב אוטומטית.',
  provider_error: 'הספק החזיר שגיאה. ננסה שוב אוטומטית.',
  client_invalid: 'הספק דחה את מזהה הלקוח או את הסוד. יש לבדוק את ההגדרה אצל הספק.',
  client_missing: 'חסר מזהה הלקוח של האפליקציה אצל הספק.',
  forbidden: 'אין הרשאה ליומן הזה אצל הספק.',
  not_found: 'היומן החיצוני לא נמצא (אולי נמחק).',
  adapter_unavailable: 'אין עדיין מתאם לספק הזה.',
  feed_missing: 'עדיין לא הוזנה כתובת iCal.',
  feed_refused: 'הכתובת נחסמה (רק https לכתובת ציבורית).',
  feed_unreachable: 'כתובת ה־iCal לא ענתה.',
  feed_invalid: 'בכתובת אין יומן iCal תקין.',
  feed_too_large: 'יומן ה־iCal גדול מדי (עד 5MB).',
  resync_failed: 'הסנכרון המלא נכשל. ננסה שוב.',
  read_only: 'החיבור לקריאה בלבד.',
};

export function connErrorText(code: string | null | undefined): string {
  return code ? CONN_ERROR_HE[code] ?? 'הסנכרון נכשל. ננסה שוב אוטומטית.' : '';
}

let demoApi: Promise<CalendarsApi> | null = null;
/** The client for the current session: the server, or (no backend) the demo behind a dynamic import - the demo data never ships into
 * the installation's hot path unless it is asked for. */
export function calendarsApi(): Promise<CalendarsApi> {
  if (isApi()) return Promise.resolve(httpCalendars);
  demoApi ??= import('../calendars/demo').then((m) => m.demoCalendars);
  return demoApi;
}
