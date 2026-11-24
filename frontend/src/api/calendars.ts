/**
 * CALENDARS-UI-2310: the ONLY module of the frontend that talks to `/api/v1/calendar...` (routers/calendar.py, routers/calendar_sync.py;
 * docs/changes/CALENDARS-CONTRACT-298.md section 13). The server is the authority for every permission, visibility and conflict rule; the
 * screens only hide what `can` / `my_role` say is not offered. Without a backend (the static demo, the visual matrix) every call is answered
 * by calendars/demo.ts - invented data, never a network call.
 */
import { del, get, patch, post, put } from './client';
import { isApi } from './session';
import { tr } from '../i18n/msg/api-home';
import type * as SyncWire from './generated/wire-calendar-sync';
import type * as FeedWire from './generated/wire-calendar-feeds';
import type * as CalWire from './generated/wire-calendar';

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
type GridEdit = 'drag' | 'create_only';
interface OpenHours { weekdays: number[]; start: string; end: string }
export type Equipment = 'screen' | 'projector' | 'video_call' | 'whiteboard' | 'kitchen' | 'accessible';

export const CAL_TYPES: readonly CalType[] = ['room', 'team', 'maintenance', 'event'];
export const CAL_COLORS: readonly CalColor[] = ['blue', 'rose', 'cyan', 'orange', 'violet', 'brown', 'magenta', 'slate'];
export const CAL_ROLES: readonly CalRole[] = ['view', 'book', 'edit', 'manage'];

/* The calendar, entry, occurrence, request and preview shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/
 * calendar.py, generated into ./generated/wire-calendar.ts): a field the server renames or drops is a compile error here (code review
 * 07:F8 step 2). Narrowed on purpose: the enumerations to the module's own types (stored text on the server); optional on purpose: the
 * fields the demo store (calendars/demo.ts) does not build. The settings document stays hand-typed (its own versioning, stored as is). */
export type Person = CalWire.CalPerson;
interface SyncInfo extends Pick<CalWire.CalSync, 'direction'>, Partial<Pick<CalWire.CalSync, 'detail' | 'dedicated'>> {
  state: 'ok' | 'error' | 'paused' | 'needs_reauth' | 'revoked' | 'pending';
  provider: 'ical' | 'ics_in' | 'ics_out' | 'google' | 'microsoft';
}

export interface Calendar
  extends Pick<CalWire.CalCalendar, 'id' | 'name' | 'tz' | 'approval_timeout_h' | 'capacity' | 'floor_id' | 'area_ref' | 'pending_count' | 'archived' | 'revision'>,
    Partial<Pick<CalWire.CalCalendar, 'description' | 'buffer_after_min' | 'buffer_before_min' | 'slot_step_min' | 'min_minutes' | 'max_minutes' | 'horizon_days' | 'lead_min'>> {
  type: CalType;
  color: CalColor;
  /** the server answers null only for a calendar whose owner was removed from the users table */
  owner: Person;
  my_role: CalRole | null;
  visibility: 'members' | 'busy_to_all' | 'details_to_all';
  approval_mode: ApprovalMode;
  equipment: Equipment[];
  conflict_policy?: 'exclusive' | 'overlap';
  overlap_override: OverlapMode | null;
  /** CAL-GRID-EDIT-2343: the per-calendar rule for moving an approved booking (default re-approval) */
  approved_move?: ApprovedMove;
  /** CAL-GRID-EDIT-2343: the open hours in force ({weekdays ISO 1-7, start, end}); null = always open; absent = unknown (no hint) */
  open_hours?: OpenHours | null;
  sync: SyncInfo | null;
  /** demo / UI only: a floor's display name (the server answers floor_id; the screen resolves the name from the building tree) */
  floor_name?: string;
}

/** One occurrence as this viewer may see it. CAL-GRID-EDIT-2343: `can_edit` (the PATCH decides again), `revision`, `local_start`;
 * `held` = the approved slot a change request keeps until the decision; `held_slot` = this row IS such a kept slot (dotted, never dragged). */
export interface Occurrence
  extends Pick<CalWire.CalOccurrence, 'occurrence_id' | 'event_id' | 'calendar_id' | 'room_calendar_ids' | 'start' | 'end' | 'title' | 'on_behalf_label' | 'organizer' | 'recurring'>,
    Partial<Pick<CalWire.CalOccurrence, 'all_day' | 'contested' | 'can_edit' | 'revision' | 'local_start' | 'held' | 'held_slot'>> {
  state: EntryState;
  kind: EntryKind;
  sync_flag?: 'conflict' | 'deleted_external' | null;
}

export type RoomDay = Omit<CalWire.CalRoomDay, 'equipment' | 'entries'> & { equipment: Equipment[]; entries: Occurrence[] };

/** CAL-GRID-EDIT-2343: `held` = the approved slot a change request keeps. */
export interface CalEvent
  extends Pick<CalWire.CalEvent, 'id' | 'calendar_id' | 'title' | 'notes' | 'start' | 'end' | 'all_day' | 'tz' | 'rrule' | 'contested' | 'on_behalf_label' | 'headcount'
    | 'organizer' | 'revision' | 'recurring'>,
    Partial<Pick<CalWire.CalEvent, 'source' | 'sync_flag' | 'held'>> {
  kind: EntryKind;
  state: EntryState;
  on_behalf_kind: OnBehalfKind | null;
  can: Omit<CalWire.CalEventCan, 'restore'> & Partial<Pick<CalWire.CalEventCan, 'restore'>>;
  rooms: (Omit<CalWire.CalEventRoom, 'state'> & { state: EntryState })[];
}

/** A request waiting for this manager. CAL-GRID-EDIT-2343: `change_of` = a change of an approved booking, the slot it keeps until the
 * decision. The server always sends `title`; the demo store may leave it null. */
export interface CalRequest
  extends Pick<CalWire.CalRequest, 'event_id' | 'room_calendar_id' | 'start' | 'end' | 'recurring' | 'organizer' | 'on_behalf_label' | 'headcount' | 'contested'
    | 'competing_count' | 'conflicts_now' | 'requested_at' | 'revision'>,
    Partial<Pick<CalWire.CalRequest, 'queue_position' | 'suggested' | 'change_of'>> {
  calendar: Omit<CalWire.CalRequestCalendar, 'color'> & { color: CalColor };
  title: string | null;
  kind: EntryKind;
  /** demo / UI: a recurring summary (the server sends `recurring` only) */
  recurring_summary?: string;
  guests_count?: number;
}

export type Member = CalWire.CalMember;

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

/** `can`: the module's permissions held anywhere (the server answers every permission short name). */
export interface ModuleState extends Pick<CalWire.CalModuleState, 'enabled'> {
  menu_position: MenuPosition;
  can: { view: boolean; book: boolean; book_for_others: boolean; manage: boolean; maintenance: boolean; guests: boolean; configure: boolean; connect: boolean };
  ui?: Partial<CalUi>;
}

/* The connection shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/calendar_sync.py, generated into
 * ./generated/wire-calendar-sync.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Narrowed on
 * purpose: `provider` also takes the screen's card names (the demo store), `state` / `owner` use the module's own types, `pending_flow`
 * the two consent providers; `setup` / `account_hint` stay optional (the demo store has neither). */
/** The provider names of the server (`ics_in` iCal subscription, `ics_out` iCal feed) and the screen's card names (`ical`). */
type ServerProvider = SyncWire.CalSyncProvider['provider'];
export type ProviderCard = 'ical' | 'google' | 'microsoft';

/** CALCONNECT-2330: what the server says about a connection's credentials - flags only, never a value. */
export type ConnSetup = Omit<SyncWire.CalSyncSetup, 'pending_flow'> & { pending_flow: 'google' | 'microsoft' | null };

export interface Connection
  extends Pick<SyncWire.CalSyncConnection, 'id' | 'label' | 'scope' | 'last_sync_at' | 'next_sync_at' | 'error_code' | 'adapter_available' | 'bindings' | 'revision'>,
    Partial<Pick<SyncWire.CalSyncConnection, 'account_hint'>> {
  provider: ProviderCard | ServerProvider;
  state: SyncInfo['state'];
  owner: Person;
  setup?: ConnSetup;
}

/** Google answers an address to open and takes back the loopback address; Microsoft answers a device code. */
type AuthorizeWire = Required<SyncWire.CalSyncAuthorizeStart>;
export type AuthorizeStart =
  | ({ flow: 'paste' } & Pick<AuthorizeWire, 'authorize_url' | 'redirect_prefix' | 'expires_in'>)
  | ({ flow: 'device' } & Pick<AuthorizeWire, 'user_code' | 'verification_url' | 'expires_in' | 'interval'>);
type AuthorizePoll = Omit<SyncWire.CalSyncAuthorizeResult, 'state' | 'connection'> & {
  state: 'none' | 'pending' | 'slow_down' | 'denied' | 'expired' | 'connected';
  connection?: Connection;
};
export type ExtCalendar = SyncWire.CalSyncExternalCalendar;
export interface BindingBody { connection_id: string | null; external_calendar_ref?: string; direction?: 'export' | 'import' | 'two_way'; detail?: 'busy' | 'titles' | 'details'; dedicated?: boolean }
/* The feed shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/calendar_feeds.py, generated into
 * ./generated/wire-calendar-feeds.ts). The round-14 fields stay optional on the client (an older server, the demo store has no
 * `token_set_at`). `remote`: the address also answers outside the building network (the per-feed remote switch, default off);
 * `detail_effective` (4A): what the document really carries - always 'busy' while `remote` is on; `can_remote` (2A): may THIS person
 * change the remote switch now; `expires_at` (3C): when the current address stops answering (null = no expiry). */
export type Feed = Pick<FeedWire.CalFeed, 'id' | 'calendar_ids' | 'detail' | 'created_at' | 'last_used_at' | 'revoked'>
  & Partial<Pick<FeedWire.CalFeed, 'remote' | 'detail_effective' | 'can_remote' | 'expires_at' | 'token_set_at'>>;
/** GET /calendar/feeds. `local` false = this page came through the remote channel, where the server refuses the remote switch. */
type FeedList = Pick<FeedWire.CalFeedList, 'enabled'> & Partial<Pick<FeedWire.CalFeedList, 'local' | 'default_max_age_days'>> & { feeds: Feed[] };
/** A new or renewed address: the feed and its document path (shown once). */
type FeedIssued = Omit<FeedWire.CalFeedIssued, 'feed'> & { feed: Feed };

/** A flagged entry (wire: CalSyncFlag); narrowed: the calendar colour, the flag kinds and the entry state; `title` may be null in the demo store. */
export type SyncFlag = Omit<SyncWire.CalSyncFlag, 'calendar' | 'title' | 'flag' | 'state'> & { calendar: { id: string; name: string; color: CalColor }; title: string | null; flag: 'conflict' | 'deleted_external'; state: EntryState };

type MaintOverlap = Omit<CalWire.CalOverlap, 'state'> & { state: EntryState };
export type MaintPreview = Omit<CalWire.CalMaintPreview, 'overlaps' | 'mode'> & { overlaps: MaintOverlap[]; mode: OverlapMode };

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
/** The server's conflict names the entry (`event_id`) and, since RESPONSE-HINTS-2480, its `title` where this viewer may read it (null =
 * hidden: the hint says "another booking"; absent = an older server). The demo store and the edit form's own contested slot carry a `title`
 * too. `contested` / `suggestions` (free slots nearby) are not built by the demo store. */
type PreviewConflict = Omit<CalWire.CalConflict, 'state' | 'event_id'> & Partial<Pick<CalWire.CalConflict, 'event_id'>> & { state: EntryState; title?: string | null };
export type EventPreview = Omit<CalWire.CalEventPreview, 'conflicts' | 'contested' | 'suggestions'> & Partial<Pick<CalWire.CalEventPreview, 'contested' | 'suggestions'>>
  & { conflicts: PreviewConflict[] };

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
  /** The server also answers the approval history and the guest count / visibility (the demo store answers the entry only). */
  event(id: string): Promise<{ event: CalEvent } & Partial<Omit<CalWire.CalEventDetail, 'event'>>>;
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
  /** The server also answers the providers, the setup steps and the Google loopback address (the demo store does not). */
  connections(): Promise<{ connections: Connection[] } & Partial<Omit<SyncWire.CalSyncConnections, 'connections'>>>;
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
  createFeed(calendarIds: string[], detail: Feed['detail']): Promise<FeedIssued>;
  rotateFeed(id: string): Promise<FeedIssued>;
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

const httpCalendars: CalendarsApi = {
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
  auth_expired: tr('ההרשאה פגה או בוטלה אצל הספק. יש לאשר מחדש.'),
  not_authorized: tr('החיבור עדיין לא אושר אצל הספק.'),
  needs_reauth: tr('נדרשת הרשאה מחדש אצל הספק.'),
  token_revoked: tr('ההרשאה בוטלה אצל הספק. יש לאשר מחדש.'),
  rate_limited: tr('הספק מגביל כרגע את קצב הבקשות. ננסה שוב אוטומטית.'),
  quota_exceeded: tr('המכסה היומית אצל הספק נוצלה. ננסה שוב מאוחר יותר.'),
  provider_unavailable: tr('הספק לא זמין כרגע. ננסה שוב אוטומטית.'),
  provider_error: tr('הספק החזיר שגיאה. ננסה שוב אוטומטית.'),
  client_invalid: tr('הספק דחה את מזהה הלקוח או את הסוד. יש לבדוק את ההגדרה אצל הספק.'),
  client_missing: tr('חסר מזהה הלקוח של האפליקציה אצל הספק.'),
  forbidden: tr('אין הרשאה ליומן הזה אצל הספק.'),
  not_found: tr('היומן החיצוני לא נמצא (אולי נמחק).'),
  adapter_unavailable: tr('אין עדיין מתאם לספק הזה.'),
  feed_missing: tr('עדיין לא הוזנה כתובת iCal.'),
  feed_refused: tr('הכתובת נחסמה (רק https לכתובת ציבורית).'),
  feed_unreachable: tr('כתובת ה־iCal לא ענתה.'),
  feed_invalid: tr('בכתובת אין יומן iCal תקין.'),
  feed_too_large: tr('יומן ה־iCal גדול מדי (עד 5MB).'),
  resync_failed: tr('הסנכרון המלא נכשל. ננסה שוב.'),
  read_only: tr('החיבור לקריאה בלבד.'),
};

export function connErrorText(code: string | null | undefined): string {
  return code ? CONN_ERROR_HE[code] ?? tr('הסנכרון נכשל. ננסה שוב אוטומטית.') : '';
}

let demoApi: Promise<CalendarsApi> | null = null;
/** The client for the current session: the server, or (no backend) the demo behind a dynamic import - the demo data never ships into
 * the installation's hot path unless it is asked for. */
export function calendarsApi(): Promise<CalendarsApi> {
  if (isApi()) return Promise.resolve(httpCalendars);
  demoApi ??= import('../calendars/demo').then((m) => m.demoCalendars);
  return demoApi;
}
