/**
 * CALENDARS-UI-2310: the demo backend of the calendars screens (no installation behind the page: the static demo, the visual matrix, the
 * screenshot specs). Invented data only - no real person, place, phone or system. It answers the same shapes as the server
 * (api/calendars.ts CalendarsApi) and keeps writes in memory for the page's life, so every screen can be tried end to end.
 * Hash parameters (read on every call, so a spec can switch them): `data=worst` (break-ui: the realistic worst case of every value),
 * `data=empty`, `data=error` (every read fails), `data=slow` (every read waits 1.2 s: the skeleton), `role=operator|site_admin|cal_manager|resident`,
 * `mode=first_holds|override_notify|block|ask` (the maintenance overlap setting).
 */
import { ApiError } from '../api/client';
import type {
  CalendarsApi, CalColor, CalEvent, CalRequest, CalSettings, CalType, Calendar, Connection, ConnSetup, EntryKind, EntryState, Feed, Member, ModuleState, NewEvent, Occurrence, RoomDay,
  SyncFlag,
} from '../api/calendars';

const hashParams = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
const dataMode = () => hashParams().get('data') ?? 'demo';
const roleMode = () => hashParams().get('role') ?? 'site_admin';

/** A local wall-clock time on a day relative to today (the browser's zone is the installation's in every spec). */
function at(dayOffset: number, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}
const P = (id: string, name: string) => ({ id, name });
const OPEN = (start: string, end: string) => ({ weekdays: [1, 2, 3, 4, 5, 6, 7], start, end });
/** CALCONNECT-2330: the credential flags of a demo connection (the server never answers a value either). */
const SETUP = (o: Partial<ConnSetup>): ConnSetup => ({ client_id_set: false, client_secret_set: false, authorized: false, feed_url_set: false, tenant: null, ready: false,
  pending_flow: null, ...o, ...(o.ready === undefined ? { ready: !!(o.authorized || o.feed_url_set) } : {}) });
const demoErr = (status: number, code: string, msg: string) => new ApiError(status, { code, user_message: msg, retryable: false, correlation_id: 'demo', details: {} });
const ME = P('u-me', 'יוני');

interface Seed { id: string; name: string; type: CalType; color: CalColor; mgr: string; floor: string; cap: number | null; equip: string[]; approval: Calendar['approval_mode']; my: Calendar['my_role']; sync: Calendar['sync']; override?: Calendar['overlap_override'] }
const SEEDS: Seed[] = [
  { id: 'alon', name: 'חדר ישיבות אלון', type: 'room', color: 'blue', mgr: 'נועה ברק', floor: 'קומה 1', cap: 12, equip: ['screen', 'video_call'], approval: 'none', my: 'manage', sync: { state: 'ok', provider: 'google', direction: 'two_way', dedicated: true } },
  { id: 'brosh', name: 'חדר ישיבות ברוש', type: 'room', color: 'rose', mgr: 'נועה ברק', floor: 'קומה 1', cap: 6, equip: ['screen'], approval: 'none', my: 'manage', sync: null },
  { id: 'hall', name: 'אולם רב־תכליתי', type: 'room', color: 'violet', mgr: 'אבי שושן', floor: 'קומת קרקע', cap: 120, equip: ['projector', 'accessible'], approval: 'always', my: 'manage', sync: null, override: 'block' },
  { id: 'studio', name: 'סטודיו לתנועה', type: 'room', color: 'magenta', mgr: 'מירב אלון', floor: 'קומת קרקע', cap: 25, equip: ['screen'], approval: 'on_behalf', my: 'book', sync: null },
  { id: 'class2', name: 'חדר חוגים 2', type: 'room', color: 'cyan', mgr: 'מירב אלון', floor: 'קומה 1', cap: 18, equip: ['kitchen'], approval: 'always', my: 'manage', sync: null },
  { id: 'quiet', name: 'חדר עבודה שקט', type: 'room', color: 'blue', mgr: 'נועה ברק', floor: 'קומה 1', cap: 4, equip: [], approval: 'none', my: 'book', sync: null },
  { id: 'kitchen', name: 'מטבחון קהילתי', type: 'room', color: 'brown', mgr: 'אבי שושן', floor: 'קומת קרקע', cap: 10, equip: ['kitchen'], approval: 'always', my: 'book', sync: null, override: 'override_notify' },
  { id: 'pc', name: 'חדר מחשבים', type: 'room', color: 'orange', mgr: 'עומר חדד', floor: 'קומה 1', cap: 16, equip: ['projector'], approval: 'none', my: 'view', sync: null },
  { id: 'classes', name: 'צוות חוגים', type: 'team', color: 'rose', mgr: 'מירב אלון', floor: '', cap: null, equip: [], approval: 'none', my: 'edit', sync: null },
  { id: 'mgmt', name: 'הנהלה', type: 'team', color: 'violet', mgr: 'רונית קפלן', floor: '', cap: null, equip: [], approval: 'none', my: 'view', sync: { state: 'needs_reauth', provider: 'microsoft', direction: 'export' } },
  { id: 'maint', name: 'אחזקה ומערכות', type: 'maintenance', color: 'orange', mgr: 'יוסי דהן', floor: '', cap: null, equip: [], approval: 'none', my: 'edit', sync: { state: 'ok', provider: 'ical', direction: 'export' } },
  { id: 'vendors', name: 'ביקורי ספקים', type: 'maintenance', color: 'brown', mgr: 'יוסי דהן', floor: '', cap: null, equip: [], approval: 'none', my: 'view', sync: null },
  { id: 'events', name: 'אירועי הקהילה', type: 'event', color: 'magenta', mgr: 'דנה לוי', floor: '', cap: null, equip: [], approval: 'none', my: 'book', sync: { state: 'ok', provider: 'ical', direction: 'export' } },
  { id: 'holidays', name: 'חגים ומועדים', type: 'event', color: 'slate', mgr: 'רונית קפלן', floor: '', cap: null, equip: [], approval: 'none', my: 'view', sync: { state: 'ok', provider: 'ical', direction: 'import' } },
];

type Row = [day: number, cal: string, from: string, to: string, title: string, kind?: 'ok' | 'pending' | 'maint' | 'displaced' | 'flag' | 'hol', who?: string];
// relative to today (0); the mockup's week, month and today rows
const ROWS: Row[] = [
  [0, 'alon', '08:30', '09:30', 'סטנדאפ תפעול', 'ok', 'בשם: צוות תפעול'], [0, 'alon', '10:00', '11:30', 'ראיון לתפקיד רכז/ת נוער', 'ok', 'רונית קפלן'],
  [0, 'alon', '13:00', '14:00', 'ביקור ספק מעליות', 'ok', 'מתוך בקשה 1182'], [0, 'alon', '16:00', '17:30', 'ועדת תרבות', 'pending', 'עומר חדד'],
  [0, 'brosh', '09:00', '10:00', 'שיחת משוב', 'ok', 'נועה ברק'], [0, 'brosh', '11:00', '12:00', 'תיאום תקציב חוגים', 'ok', 'בשם: צוות חוגים'], [0, 'brosh', '14:30', '15:15', 'שיחת הורים', 'ok', 'בשם: לקוח'],
  [0, 'hall', '07:00', '09:30', 'טיפול במערכת המיזוג', 'maint', 'אחזקה ומערכות'], [0, 'hall', '17:00', '21:00', 'ערב קהילה - הכנות והופעה', 'pending', 'דנה לוי'],
  [0, 'hall', '19:00', '21:30', 'חזרות מקהלה', 'ok', 'אבי שושן'], // slice B: the confirmed holder of the contested window (mock-up contestedDetail)
  [0, 'studio', '08:00', '09:00', 'פילאטיס בוקר', 'ok', 'בשם: חוג'], [0, 'studio', '17:00', '18:00', 'בלט ד׳-ו׳', 'ok', 'בשם: חוג'], [0, 'studio', '18:15', '19:30', 'זומבה', 'ok', 'כל חמישי'],
  [0, 'class2', '16:00', '17:30', 'חוג קרמיקה - מבוגרים', 'pending', 'מירב אלון'], [0, 'quiet', '09:00', '13:00', 'עבודה שקטה', 'ok', 'דנה לוי'],
  [0, 'kitchen', '10:00', '11:00', 'החלפת מסנן מים', 'maint', 'אחזקה ומערכות'], [0, 'kitchen', '10:00', '12:00', 'סדנת בישול לגיל הזהב', 'displaced', 'נדחק בגלל תחזוקה'],
  [0, 'pc', '15:00', '17:00', 'מחשבים לוותיקים', 'ok', 'בשם: עמותת ותיקי השכונה'],
  [-4, 'mgmt', '09:00', '10:00', 'ישיבת הנהלה שבועית'], [-4, 'maint', '07:30', '09:00', 'סבב בוקר - לוחות חשמל', 'maint'], [-4, 'classes', '16:00', '18:00', 'פתיחת חוג ציור'],
  [-3, 'alon', '10:00', '11:00', 'ראיון'], [-3, 'alon', '10:30', '11:30', 'שיחת לקוח', 'flag'], [-3, 'events', '18:00', '20:00', 'הרצאה: תולדות השכונה'], [-3, 'vendors', '12:00', '13:00', 'טכנאי גנרטור'],
  [-2, 'classes', '16:00', '17:30', 'קרמיקה - מבוגרים'], [-2, 'mgmt', '13:00', '14:30', 'תקציב 2027'], [-2, 'maint', '08:00', '10:00', 'ניקוי מזגנים - אולם', 'maint'],
  [-1, 'alon', '09:00', '10:00', 'סטנדאפ'], [-1, 'events', '17:00', '19:00', 'שוק איכרים'], [-1, 'hall', '19:00', '21:30', 'חזרות מקהלה'],
  [1, 'events', '09:00', '12:00', 'בוקר משפחות'], [1, 'maint', '07:00', '08:00', 'בדיקת משאבות', 'maint'],
  [2, 'holidays', '00:00', '23:59', 'שבת', 'hol'],
  [5, 'class2', '16:00', '17:30', 'חוג קרמיקה - מבוגרים', 'pending', 'מירב אלון'], [9, 'hall', '20:00', '23:30', 'יום הולדת 40 - השכרת אולם', 'pending', 'אבי שושן'],
  [-25, 'mgmt', '09:00', '10:00', 'הנהלה'], [-24, 'alon', '10:00', '11:00', 'ראיון'], [-23, 'classes', '16:00', '17:30', 'פתיחת שנת חוגים'], [-23, 'maint', '08:00', '09:00', 'בדיקת גנרטור', 'maint'],
  [-18, 'mgmt', '09:00', '10:00', 'הנהלה'], [-17, 'vendors', '12:00', '13:00', 'טכנאי מעליות'], [-16, 'classes', '16:00', '17:30', 'קרמיקה'], [-16, 'hall', '19:00', '21:30', 'מקהלה'],
  [-15, 'maint', '08:00', '09:00', 'ניקוי מזגנים', 'maint'], [-14, 'events', '09:00', '12:00', 'בוקר משפחות'], [-11, 'mgmt', '09:00', '10:00', 'הנהלה'], [-11, 'alon', '13:00', '14:00', 'ספק תקשורת'],
  [-10, 'events', '18:00', '20:00', 'ערב שירה'], [-9, 'classes', '16:00', '17:30', 'קרמיקה'], [-8, 'studio', '17:00', '18:00', 'בלט'], [-7, 'events', '09:00', '12:00', 'שוק'],
  [3, 'mgmt', '09:00', '10:00', 'הנהלה'], [4, 'classes', '16:00', '17:30', 'קרמיקה'], [6, 'events', '18:00', '20:00', 'ערב שירה'],
];

function settingsDefaults(): CalSettings {
  return {
    enabled: true, maintenance_overlap: 'first_holds', contested_requests: 'queue', pending_holds_slot: false, menu_position: 'rail', holiday_eve_as_holiday: false,
    guest_details_enabled: true, guest_details_kinds: ['class', 'customer'], guest_retention_days: 30, editors_bypass_approval: true, default_room_buffer_after_min: 10,
    series_horizon_days: 400, max_calendars: 500, notify_confirmations: false, contested_order: 'first_come', allow_displace: true, displace_approver: 'calendar_manager',
    override_scope: 'both', phone_time_picker: 'grid', reauth_mode: 'reauth_and_continue', sync_conflict_display: 'side_by_side', tablet_panels: 'collapse',
    resident_pending_display: 'count', resident_cancel_until: 'start', resident_rooms: 'bookable', purge_confirm: 'type_word', loading_style: 'skeleton',
    default_approval_timeout_h: 2, reopen_days: 7, sync_external_delete: 'cancel',
  };
}

interface Store { cals: Calendar[]; occ: Occurrence[]; requests: CalRequest[]; settings: CalSettings; members: Record<string, Member[]>; connections: Connection[]; flags: SyncFlag[]; feeds: Feed[]; guests: number; seq: number }
let store: Store | null = null;
let storeKey = '';

const KIND: Record<string, { state: EntryState; kind: EntryKind }> = {
  ok: { state: 'confirmed', kind: 'booking' }, pending: { state: 'pending', kind: 'booking' }, maint: { state: 'confirmed', kind: 'maintenance' },
  displaced: { state: 'displaced', kind: 'booking' }, flag: { state: 'confirmed', kind: 'external' }, hol: { state: 'confirmed', kind: 'holiday' },
};

function build(mode: string): Store {
  const cals: Calendar[] = SEEDS.map((s, i) => ({
    id: s.id, name: s.name, type: s.type, color: s.color, tz: 'Asia/Jerusalem', owner: P(`u${i}`, s.mgr), my_role: s.my, visibility: 'members', approval_mode: s.approval,
    approval_timeout_h: 2, capacity: s.cap, equipment: s.equip as Calendar['equipment'], floor_id: s.floor ? (s.floor === 'קומה 1' ? 'f1' : 'f0') : null, floor_name: s.floor || undefined,
    area_ref: null, conflict_policy: s.type === 'room' || s.type === 'maintenance' ? 'exclusive' : 'overlap', buffer_after_min: s.type === 'room' ? 10 : 0, slot_step_min: 15,
    min_minutes: 15, max_minutes: 720, horizon_days: 180, overlap_override: s.override ?? null, sync: s.sync, pending_count: 0, archived: false, revision: 1,
    // CAL-GRID-EDIT-2343: the open hours the grid shades (the same windows roomsDay answers) and the per-calendar move rule
    approved_move: 'reapproval', open_hours: s.id === 'quiet' ? OPEN('07:00', '19:00') : s.id === 'kitchen' ? OPEN('07:00', '16:00') : null,
  }));
  let n = 0;
  const occ: Occurrence[] = ROWS.map(([day, cal, from, to, title, k = 'ok', who]) => {
    const { state, kind } = KIND[k];
    const room = cals.find((c) => c.id === cal)?.type === 'room';
    n += 1;
    return {
      occurrence_id: `o${n}`, event_id: `e${n}`, calendar_id: cal, room_calendar_ids: room ? [cal] : [], start: at(day, from), end: at(day, to), all_day: k === 'hol', title, state, kind,
      on_behalf_label: who?.startsWith('בשם') ? who.replace(/^בשם:?\s*/, '') : null, organizer: who && !who.startsWith('בשם') ? P(`p${n}`, who) : P('u-me', 'יוני'), recurring: title.includes('זומבה') || title.includes('קרמיקה'),
      contested: k === 'pending' && cal === 'hall', sync_flag: k === 'flag' ? 'conflict' : null,
    };
  });
  // the "שיחת לקוח" conflict pairs with "ראיון" the same day
  const pair = occ.find((o) => o.title === 'ראיון' && o.calendar_id === 'alon' && o.start === at(-3, '10:00'));
  if (pair) pair.sync_flag = 'conflict';
  const requests: CalRequest[] = [
    { event_id: 'r1', room_calendar_id: 'class2', calendar: { id: 'class2', name: 'חדר חוגים 2', color: 'cyan' }, title: 'חוג קרמיקה - מבוגרים', kind: 'booking', start: at(5, '16:00'), end: at(5, '17:30'), recurring: true,
      recurring_summary: 'כל שלישי עד 29.12 · 9 מועדים', organizer: P('p-m', 'מירב אלון'), on_behalf_label: 'חוג קרמיקה', headcount: 14, contested: false, competing_count: 1, conflicts_now: 0, requested_at: at(0, '10:20'), revision: 1, queue_position: 1, suggested: false },
    { event_id: 'r2', room_calendar_id: 'hall', calendar: { id: 'hall', name: 'אולם רב־תכליתי', color: 'violet' }, title: 'ערב קהילה - הכנות והופעה', kind: 'booking', start: at(0, '17:00'), end: at(0, '21:00'), recurring: false,
      organizer: P('p-d', 'דנה לוי'), on_behalf_label: 'צוות אירועים', headcount: 110, contested: true, competing_count: 3, conflicts_now: 1, requested_at: at(0, '09:40'), revision: 1, queue_position: 2, suggested: false },
    { event_id: 'r3', room_calendar_id: 'alon', calendar: { id: 'alon', name: 'חדר ישיבות אלון', color: 'blue' }, title: 'ועדת תרבות', kind: 'booking', start: at(0, '16:00'), end: at(0, '17:30'), recurring: false,
      organizer: P('p-o', 'עומר חדד'), on_behalf_label: 'ועדת תרבות', headcount: 9, contested: false, competing_count: 1, conflicts_now: 0, requested_at: at(0, '08:40'), revision: 1, queue_position: 1, suggested: false },
    { event_id: 'r4', room_calendar_id: 'hall', calendar: { id: 'hall', name: 'אולם רב־תכליתי', color: 'violet' }, title: 'יום הולדת 40 - השכרת אולם', kind: 'booking', start: at(9, '20:00'), end: at(9, '23:30'), recurring: false,
      organizer: P('p-a', 'אבי שושן'), on_behalf_label: 'משפחת גולן', headcount: 80, contested: false, competing_count: 1, conflicts_now: 1, requested_at: at(-1, '18:00'), revision: 1, queue_position: 1, suggested: false, guests_count: 2 },
    { event_id: 'r5', room_calendar_id: 'hall', calendar: { id: 'hall', name: 'אולם רב־תכליתי', color: 'violet' }, title: 'סדנת תיאטרון קהילתי', kind: 'booking', start: at(0, '18:00'), end: at(0, '21:00'), recurring: false,
      organizer: P('p-l', 'אבי שושן'), on_behalf_label: 'מקהלה', headcount: 30, contested: true, competing_count: 3, conflicts_now: 1, requested_at: at(0, '07:10'), revision: 1, queue_position: 1, suggested: true },
    { event_id: 'r6', room_calendar_id: 'hall', calendar: { id: 'hall', name: 'אולם רב־תכליתי', color: 'violet' }, title: 'יום עיון לוותיקים', kind: 'booking', start: at(0, '18:00'), end: at(0, '22:00'), recurring: false,
      organizer: P('p-t', 'עומר חדד'), on_behalf_label: null, headcount: 40, contested: true, competing_count: 3, conflicts_now: 1, requested_at: at(0, '10:05'), revision: 1, queue_position: 3, suggested: false },
  ];
  for (const c of cals) c.pending_count = requests.filter((r) => r.calendar.id === c.id).length;
  const members: Record<string, Member[]> = {
    hall: [
      { subject_kind: 'user', subject_id: 'u2', label: 'אבי שושן', cal_role: 'manage' }, { subject_kind: 'user', subject_id: 'p-d', label: 'דנה לוי', cal_role: 'edit' },
      { subject_kind: 'role', subject_id: 'operator', label: 'מפעיל', cal_role: 'book' }, { subject_kind: 'department', subject_id: 'd-cls', label: 'צוות חוגים (12 חברים)', cal_role: 'book' },
      { subject_kind: 'user', subject_id: 'p-o', label: 'עומר חדד', cal_role: 'view' }, { subject_kind: 'everyone', subject_id: '*', label: 'כל מי שיש לו צפייה ביומנים', cal_role: 'view' },
    ],
  };
  const connections: Connection[] = [
    { id: 'c-ical', provider: 'ics_in', label: 'לוח חגים ומועדים', scope: 'read', state: 'ok', owner: P('u0', 'יוני'), last_sync_at: at(0, '10:31'), next_sync_at: at(0, '10:45'), error_code: null, adapter_available: true,
      account_hint: 'calendar.example.org', setup: SETUP({ feed_url_set: true }),
      bindings: [{ id: 'b1', calendar_id: 'maint', direction: 'export', detail: 'busy', dedicated: false }, { id: 'b2', calendar_id: 'holidays', direction: 'import', detail: 'titles', dedicated: false }], revision: 1 },
    { id: 'c-google', provider: 'google', label: 'רונית קפלן', scope: 'read_write', state: 'ok', owner: P('u9', 'רונית קפלן'), last_sync_at: at(0, '10:37'), next_sync_at: at(0, '10:42'), error_code: null, adapter_available: true,
      setup: SETUP({ client_id_set: true, client_secret_set: true, authorized: true }),
      bindings: [{ id: 'b3', calendar_id: 'alon', direction: 'two_way', detail: 'titles', dedicated: true }, { id: 'b4', calendar_id: 'events', direction: 'export', detail: 'titles', dedicated: false }], revision: 1 },
    { id: 'c-ms', provider: 'microsoft', label: 'רונית קפלן', scope: 'read_write', state: 'needs_reauth', owner: P('u9', 'רונית קפלן'), last_sync_at: at(-2, '09:00'), next_sync_at: null, error_code: 'auth_expired', adapter_available: true,
      setup: SETUP({ client_id_set: true, authorized: true, tenant: 'common' }),
      bindings: [{ id: 'b5', calendar_id: 'mgmt', direction: 'export', detail: 'busy', dedicated: false }], revision: 1 },
  ];
  const flags: SyncFlag[] = [
    { event_id: 'e22', calendar: { id: 'alon', name: 'חדר ישיבות אלון', color: 'blue' }, title: 'ראיון (Arx) מול "שיחת לקוח" (Google)', start: at(-3, '10:00'), end: at(-3, '11:30'), flag: 'conflict', source: 'arx', state: 'confirmed', revision: 1 },
    { event_id: 'e40', calendar: { id: 'events', name: 'אירועי הקהילה', color: 'magenta' }, title: 'ערב שירה', start: at(6, '18:00'), end: at(6, '20:00'), flag: 'deleted_external', source: 'arx', state: 'confirmed', revision: 1 },
  ];
  const feeds: Feed[] = [{ id: 'f1', calendar_ids: ['maint'], detail: 'busy', created_at: at(-20, '09:00'), last_used_at: at(0, '10:20'), revoked: false }];
  const s: Store = { cals, occ, requests, settings: settingsDefaults(), members, connections, flags, feeds, guests: 214, seq: 100 };
  if (mode === 'empty') return { ...s, cals: [], occ: [], requests: [], members: {}, connections: [], flags: [], feeds: [], guests: 0 };
  if (mode === 'worst') worst(s);
  return s;
}

/** break-ui, Hebrew edition: long compound names with geresh / gershayim, mixed Hebrew / Latin, a one-letter name, an unbreakable
 * e-mail-like label, big counts, a series of 104, a calendar with no manager name, every optional field missing. */
function worst(s: Store): void {
  const c = Object.fromEntries(s.cals.map((x) => [x.id, x]));
  c.alon.name = 'חדר הישיבות הגדול ע״ש משפחת בן־אברהם־רוזנטל (קומה 3, אגף מזרחי)';
  c.alon.owner = P('u0', 'אלכסנדרה וישנייבסקה־קובלצ׳יק');
  c.brosh.name = 'ת';
  c.brosh.owner = P('u1', 'יו');
  c.hall.name = 'Main Hall - אולם ראשי ומבואה (כולל במה)';
  c.hall.equipment = ['screen', 'projector', 'video_call', 'whiteboard', 'kitchen', 'accessible'];
  c.studio.capacity = 1;
  c.class2.name = 'חדר חוגים 2 / מעבדת אומנות וקרמיקה לילדים ונוער';
  c.mgmt.name = 'board-meetings@giv-hadekel-community-center.example.org';
  c.maint.owner = P('u10', '');
  c.events.pending_count = 1284;
  c.hall.pending_count = 37;
  for (const o of s.occ) {
    if (o.title === 'ועדת תרבות') o.title = 'ועדת תרבות, אומנות ופנאי - דיון בתקציב פסטיבל החורף 2027 (המשך)';
    if (o.title === 'שיחת הורים') o.title = 'י';
    if (o.title === 'מחשבים לוותיקים') o.on_behalf_label = 'עמותת ותיקי השכונה לקידום אוריינות דיגיטלית בגיל השלישי (ע״ר)';
  }
  for (let i = 0; i < 6; i += 1) s.occ.push({ ...s.occ[0], occurrence_id: `w${i}`, event_id: `w${i}`, calendar_id: ['events', 'classes', 'pc', 'brosh', 'mgmt', 'quiet'][i], title: ['ערב', 'קרמיקה', 'מחשבים לוותיקים', 'תקציב חוגים', 'הנהלה', 'עבודה'][i], start: at(-1, `1${i}:00`), end: at(-1, `1${i}:45`) });
  s.requests[0].recurring_summary = 'כל שלישי וחמישי עד 30.12.2027 · 104 מועדים · אושר למעט 2';
  s.requests[0].organizer = P('p-m', 'אלכסנדרה וישנייבסקה־קובלצ׳יק');
  s.requests[1].competing_count = 37;
  s.requests[1].title = 'Board Meeting - ישיבת דירקטוריון Q4 עם נציגי העירייה, הוועד המנהל והמבקר הפנימי';
  s.requests[2].on_behalf_label = '';
  s.requests[3].on_behalf_label = 'bartholomew.fitzgerald@northwind-industries-holdings.example.com';
  s.requests[3].headcount = 2000;
  s.members.hall = [...s.members.hall, ...Array.from({ length: 52 }, (_, i): Member => ({ subject_kind: 'user', subject_id: `x${i}`, label: i % 2 ? `משתמש ${i + 1} בעל שם ארוך מאוד שלא נגמר` : `u${i}`, cal_role: 'view' }))];
  s.guests = 48213;
}

/** CALENDARS-UI-2310 slice C: the resident's own bookings (role=resident only, so the other views' pictures stay as they were): one pending
 * request in a contested window, one entry displaced by maintenance, a confirmed one this evening (the cancel cutoff) and a weekly lesson. */
const RES = P('u-res', 'מיכל');
function addResident(s: Store, mode: string): void {
  if (mode === 'empty') return;
  const row = (id: string, cal: string, day: number, from: string, to: string, title: string, state: EntryState, extra: Partial<Occurrence> = {}): Occurrence => ({
    occurrence_id: id, event_id: id, calendar_id: cal, room_calendar_ids: [cal], start: at(day, from), end: at(day, to), title, state, kind: 'booking', on_behalf_label: null,
    organizer: RES, recurring: false, ...extra,
  });
  s.occ.push(
    row('res1', 'hall', 0, '17:00', '19:00', mode === 'worst' ? 'מסיבת יום הולדת 40 + מפגש מחזור י״ב 2006 של תיכון הדקל (כולל הורים וילדים)' : 'יום הולדת לנועם', 'pending', { contested: true }),
    row('res2', 'kitchen', 1, '10:00', '12:00', 'סדנת בישול', 'displaced'),
    row('res3', 'class2', 0, '19:30', '20:30', 'חוג ציור', 'confirmed'),
    row('res4', 'brosh', 5, '18:00', '19:00', 'שיעור פרטי', 'confirmed', { recurring: true }),
  );
}

function st(): Store {
  const res = roleMode() === 'resident';
  const key = `${dataMode()}${res ? '|res' : ''}`;
  if (!store || storeKey !== key) {
    // switching only the role (the same data) keeps the settings a spec just changed
    const keep = store && storeKey.split('|')[0] === dataMode() ? store.settings : null;
    store = build(dataMode());
    if (keep) store.settings = keep;
    if (res) addResident(store, dataMode());
    storeKey = key;
  }
  const mode = hashParams().get('mode');
  if (mode && ['first_holds', 'override_notify', 'block', 'ask'].includes(mode)) store.settings.maintenance_overlap = mode as CalSettings['maintenance_overlap'];
  return store;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** CAL-GRID-EDIT-2343: the state an entry had before a cancel (the demo's "בטל"), revisions, and putting a change back on its approved slot. */
const prevState: Record<string, EntryState> = {};
const heads: Record<string, number> = {};
function bump(o: Occurrence): void {
  o.revision = (o.revision ?? 1) + 1;
}
function backToHeld(s: Store, o: Occurrence): void {
  if (!o.held) return;
  Object.assign(o, { calendar_id: o.held.calendar_id, start: o.held.start, end: o.held.end, state: 'confirmed', contested: false, held: null });
  s.occ = s.occ.filter((x) => !(x.held_slot && x.event_id === o.event_id));
  bump(o);
}
async function read<T>(fn: (s: Store) => T): Promise<T> {
  const m = dataMode();
  if (m === 'slow') await wait(1200);
  if (m === 'error') throw new ApiError(500, { code: 'demo_error', user_message: 'השרת לא ענה. נסו שוב בעוד רגע.', retryable: true, correlation_id: 'demo', details: {} });
  return fn(st());
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function role(): ModuleState['can'] {
  const r = roleMode();
  const all = { view: true, book: true, book_for_others: true, manage: true, maintenance: true, guests: true, configure: true, connect: true };
  if (r === 'operator' || r === 'resident') return { ...all, book_for_others: false, manage: false, maintenance: false, guests: false, configure: false, connect: false };
  if (r === 'cal_manager') return { ...all, configure: false, connect: false };
  return all;
}

/** CAL-GRID-EDIT-2343: may the demo's viewer drag it (the server's rule: his own booking with book+, anything with edit+), and its revision. */
function gridFields(s: Store, o: Occurrence): Occurrence {
  if (o.held_slot) return { ...o, can_edit: false };
  const cal = s.cals.find((c) => c.id === o.calendar_id);
  const r = roleMode();
  const role = ['operator', 'resident'].includes(r) ? (cal?.type === 'room' && cal.my_role !== 'view' ? 'book' : 'view') : cal?.my_role ?? null;
  const me = r === 'resident' ? 'u-res' : 'u-me';
  const own = o.organizer?.id === me;
  const kindOk = o.kind === 'booking' || o.kind === 'event';
  const can = kindOk && ['pending', 'confirmed'].includes(o.state) && !!role && (role === 'edit' || role === 'manage' || (own && role === 'book'));
  return { ...o, can_edit: can, revision: o.revision ?? 1 };
}

function eventOf(o: Occurrence): CalEvent {
  return {
    id: o.event_id, calendar_id: o.calendar_id, kind: o.kind, title: o.title, notes: null, start: o.start, end: o.end, all_day: !!o.all_day, tz: 'Asia/Jerusalem', rrule: o.recurring ? 'FREQ=WEEKLY' : null,
    state: o.state, contested: !!o.contested, on_behalf_label: o.on_behalf_label, on_behalf_kind: o.on_behalf_label ? 'class' : 'self', headcount: heads[o.event_id] ?? null, organizer: o.organizer, revision: o.revision ?? 1, recurring: o.recurring,
    source: 'arx', sync_flag: o.sync_flag ?? null, can: { edit: true, cancel: true, approve: roleMode() !== 'operator', restore: ['cancelled', 'withdrawn'].includes(o.state) },
    rooms: o.room_calendar_ids.map((r) => ({ room_calendar_id: r, state: o.state, contested: !!o.contested })), held: o.held ?? null,
  };
}

function overlaps(s: Store, cal: string, start: string, end: string) {
  return s.occ.filter((o) => (o.calendar_id === cal || o.room_calendar_ids.includes(cal)) && ['confirmed', 'pending'].includes(o.state) && o.start < end && o.end > start);
}

export const demoCalendars: CalendarsApi = {
  module: async () => ({ enabled: true, menu_position: st().settings.menu_position, can: role(), ui: clone(st().settings) }),
  settings: () => read((s) => ({ settings: clone(s.settings), can_configure: role().configure })),
  saveSettings: async (doc) => {
    const s = st();
    const lower = doc.guest_retention_days < s.settings.guest_retention_days;
    s.settings = { ...s.settings, ...doc };
    return { settings: clone(s.settings), erase_preview: lower ? 6 : 0 };
  },
  purgeGuests: async () => {
    const s = st();
    const n = s.guests;
    s.guests = 0;
    return { erased: n };
  },
  // slice C: an operator / resident manages nothing - rooms he may book, everything else read-only (the resident phone flow needs this)
  calendars: () => read((s) => ({ calendars: clone(s.cals).map((c) => (['operator', 'resident'].includes(roleMode()) ? { ...c, my_role: c.type === 'room' && c.my_role !== 'view' ? 'book' : 'view' } : c)) })),
  createCalendar: async (body) => {
    const s = st();
    s.seq += 1;
    const cal: Calendar = { ...clone(s.cals[0] ?? (build('demo').cals[0])), ...body, id: `c${s.seq}`, owner: ME, my_role: 'manage', pending_count: 0, sync: null, revision: 1 } as Calendar;
    s.cals.push(cal);
    return { calendar: clone(cal) };
  },
  patchCalendar: async (id, body) => {
    const c = st().cals.find((x) => x.id === id);
    if (!c) throw new ApiError(404, { code: 'not_found', user_message: 'היומן לא נמצא.', retryable: false, correlation_id: 'demo', details: {} });
    Object.assign(c, body, { revision: c.revision + 1 });
    return { calendar: clone(c) };
  },
  archiveCalendar: async (id) => {
    const s = st();
    const c = s.cals.find((x) => x.id === id);
    if (c) c.archived = true;
    s.cals = s.cals.filter((x) => x.id !== id);
    return { calendar: clone(c as Calendar) };
  },
  members: (id) => read((s) => ({ members: clone(s.members[id] ?? [{ subject_kind: 'user', subject_id: 'u0', label: s.cals.find((c) => c.id === id)?.owner.name ?? '', cal_role: 'manage' }]) })),
  putMembers: async (id, _rev, members) => {
    st().members[id] = clone(members);
    return { members: clone(members) };
  },
  occurrences: (from, to, cals) => read((s) => ({ occurrences: clone(s.occ.filter((o) => o.start < to && o.end > from && (!cals || cals.includes(o.calendar_id)))).map((o) => gridFields(s, o)), truncated: false })),
  roomsDay: (date) => read((s) => {
    const day = new Date(`${date}T00:00:00`);
    const from = day.toISOString();
    const to = new Date(day.getTime() + 86_400_000).toISOString();
    const rooms: RoomDay[] = s.cals.filter((c) => c.type === 'room').map((c) => ({
      calendar_id: c.id, name: c.name, capacity: c.capacity, equipment: c.equipment, open: c.id === 'quiet' || c.id === 'kitchen' ? [{ from: '07:00', to: c.id === 'quiet' ? '19:00' : '16:00' }] : [{ from: '00:00', to: '24:00' }],
      entries: clone(s.occ.filter((o) => o.calendar_id === c.id && o.start < to && o.end > from)),
    }));
    return { rooms };
  }),
  createEvent: async (body: NewEvent) => {
    const s = st();
    s.seq += 1;
    const cal = s.cals.find((c) => c.id === body.calendar_id);
    const clash = overlaps(s, body.calendar_id, body.start, body.end).some((o) => o.state === 'confirmed');
    const state: EntryState = clash || (cal?.approval_mode === 'always' && cal.my_role !== 'manage') ? 'pending' : 'confirmed';
    const o: Occurrence = { occurrence_id: `n${s.seq}`, event_id: `n${s.seq}`, calendar_id: body.calendar_id, room_calendar_ids: cal?.type === 'room' ? [cal.id] : [], start: body.start, end: body.end,
      title: body.title, state, kind: 'booking', on_behalf_label: body.on_behalf?.label ?? null, organizer: roleMode() === 'resident' ? RES : ME, recurring: !!body.rrule, contested: clash, revision: 1 };
    
    s.occ.push(o);
    if (body.headcount) heads[o.event_id] = body.headcount;
    return { event: eventOf(o), state };
  },
  previewEvent: async (body) => {
    const s = st();
    const cal = s.cals.find((c) => c.id === body.calendar_id);
    const conflicts = overlaps(s, body.calendar_id, body.start, body.end).map((o) => ({ calendar_id: o.calendar_id, start: o.start, end: o.end, title: o.title, state: o.state }));
    return { conflicts, needs_approval_by: cal && cal.approval_mode !== 'none' ? [cal.id] : [], outside_hours: false, holiday_hits: [], capacity_ok: !cal?.capacity || (body.headcount ?? 0) <= cal.capacity };
  },
  event: (id) => read((s) => {
    const o = s.occ.find((x) => x.event_id === id);
    if (!o) throw new ApiError(404, { code: 'not_found', user_message: 'האירוע לא נמצא.', retryable: false, correlation_id: 'demo', details: {} });
    return { event: eventOf(o) };
  }),
  cancelEvent: async (id) => {
    const s = st();
    const o = s.occ.find((x) => x.event_id === id && !x.held_slot);
    if (o) {
      prevState[id] = o.state;
      o.state = 'cancelled';
      bump(o);
      s.occ = s.occ.filter((x) => !(x.held_slot && x.event_id === id));
    }
    return { event: eventOf(o as Occurrence) };
  },
  withdrawEvent: async (id) => {
    const s = st();
    const o = s.occ.find((x) => x.event_id === id && !x.held_slot);
    if (o?.held) {
      backToHeld(s, o);
      return { event: eventOf(o), change_withdrawn: true };
    }
    if (o) {
      prevState[id] = o.state;
      o.state = 'withdrawn';
      bump(o);
    }
    return { event: eventOf(o as Occurrence) };
  },
  // CAL-GRID-EDIT-2343: a move / resize / edit as the server does it (stale revision, permission, past, a change that needs approval keeps the
  // approved slot held; back onto the held slot restores the booking) and "בטל" after a delete
  patchEvent: async (id, body) => {
    const s = st();
    const o = s.occ.find((x) => x.event_id === id && !x.held_slot);
    if (!o) throw demoErr(404, 'not_found', 'האירוע לא נמצא.');
    if ((o.revision ?? 1) !== body.revision) throw demoErr(409, 'stale', 'האירוע עודכן בינתיים. רענן ונסה שוב.');
    if (!gridFields(s, o).can_edit) throw demoErr(403, 'forbidden', 'אין הרשאה לפעולה הזו ביומן.');
    if (body.title !== undefined) o.title = body.title;
    if (body.headcount !== undefined) heads[o.event_id] = body.headcount ?? 0;
    if (body.start === undefined && body.end === undefined && body.calendar_id === undefined) {
      bump(o);
      return { event: eventOf(o) };
    }
    const calId = body.calendar_id ?? o.calendar_id;
    const start = body.start ?? o.start;
    const end = body.end ?? o.end;
    if (new Date(start) < new Date() && start !== o.start) throw demoErr(422, 'past_start', 'אי אפשר להזיז אירוע לזמן שכבר עבר.');
    if (o.held && o.held.calendar_id === calId && o.held.start === start && o.held.end === end) {
      backToHeld(s, o);
      return { event: eventOf(o), change_withdrawn: true };
    }
    const cal = s.cals.find((c) => c.id === calId);
    const clash = overlaps(s, calId, start, end).some((x) => x.event_id !== id && x.state === 'confirmed');
    const strong = cal?.my_role === 'manage' || cal?.my_role === 'edit';
    const needs = clash || (cal?.approval_mode === 'always' && !strong);
    if (needs && o.state === 'confirmed') {
      if (cal?.approved_move === 'managers' && !strong) throw demoErr(409, 'change_needs_manager', 'הזמנה מאושרת בחדר הזה משתנה רק דרך מנהל החדר.');
      o.held = { calendar_id: o.calendar_id, start: o.start, end: o.end };
      s.occ.push({ ...o, occurrence_id: `${id}@held`, held: null, held_slot: true, state: 'confirmed', contested: false, can_edit: false });
    }
    o.state = needs ? 'pending' : 'confirmed';
    o.contested = clash;
    if (!needs) {
      o.held = null;
      s.occ = s.occ.filter((x) => !(x.held_slot && x.event_id === id));
    }
    Object.assign(o, { calendar_id: calId, start, end, room_calendar_ids: cal?.type === 'room' ? [calId] : [] });
    bump(o);
    return { event: eventOf(o) };
  },
  restoreEvent: async (id) => {
    const o = st().occ.find((x) => x.event_id === id && !x.held_slot);
    if (!o || !['cancelled', 'withdrawn'].includes(o.state)) throw demoErr(409, 'bad_state', 'אין מה לשחזר.');
    o.state = prevState[id] ?? 'confirmed';
    bump(o);
    return { event: eventOf(o), state: o.state };
  },
  mine: () => read((s) => ({ occurrences: clone(s.occ.filter((o) => o.organizer?.id === (roleMode() === 'resident' ? 'u-res' : 'u-me') && o.end > new Date().toISOString() && o.state !== 'cancelled')) })),
  requests: () => read((s) => ({ requests: clone(s.requests) })),
  decide: async (id, body) => {
    const s = st();
    const change = s.occ.find((x) => x.event_id === id && !x.held_slot && x.held && x.state === 'pending');
    if (change) {
      if (body.decision === 'reject') {
        backToHeld(s, change);
        return { state: 'confirmed' as EntryState, change_rejected: true };
      }
      change.state = 'confirmed';
      change.held = null;
      s.occ = s.occ.filter((x) => !(x.held_slot && x.event_id === id));
      bump(change);
      return { state: 'confirmed' as EntryState };
    }
    const grid = s.occ.find((x) => x.event_id === id && x.state === 'pending' && !s.requests.some((r) => r.event_id === id));
    if (grid) {
      grid.state = body.decision === 'approve' ? 'confirmed' : 'rejected';
      bump(grid);
      return { state: grid.state };
    }
    const r = s.requests.find((x) => x.event_id === id);
    if (r && body.decision === 'approve' && r.conflicts_now && !body.displace_existing) {
      throw new ApiError(409, { code: 'slot_held', user_message: 'החלון כבר תפוס על ידי אירוע שאושר קודם.', retryable: false, correlation_id: 'demo', details: {} });
    }
    if (r && body.decision === 'approve' && body.displace_existing && !s.settings.allow_displace) {
      throw new ApiError(409, { code: 'displace_disabled', user_message: 'בהתקנה הזאת אי אפשר לדחוק הזמנה שאושרה. אפשר לדחות את הבקשה.', retryable: false, correlation_id: 'demo', details: {} });
    }
    if (r && body.decision === 'approve' && body.displace_existing) {
      // slice B: the confirmed holder of the window becomes "displaced" (never deleted), as on the server
      for (const o of s.occ) if (o.calendar_id === (r.room_calendar_id ?? r.calendar.id) && o.state === 'confirmed' && o.kind !== 'maintenance' && o.start < r.end && o.end > r.start) o.state = 'displaced';
    }
    s.requests = s.requests.filter((x) => x.event_id !== id);
    return { state: body.decision === 'approve' ? 'confirmed' : 'rejected' };
  },
  maintPreview: async (body) => {
    const s = st();
    const list = body.rooms.flatMap((r) => overlaps(s, r, body.start, body.end)).filter((o) => o.kind !== 'maintenance');
    const mode = body.rooms.map((r) => s.cals.find((c) => c.id === r)?.overlap_override).find(Boolean) ?? s.settings.maintenance_overlap;
    return { overlaps: list.map((o) => ({ event_id: o.event_id, calendar_id: o.calendar_id, start: o.start, end: o.end, title: o.title, organizer: o.organizer, state: o.state })), mode,
      alternatives: [{ start: body.end, end: new Date(new Date(body.end).getTime() + (new Date(body.end).getTime() - new Date(body.start).getTime())).toISOString() }] };
  },
  maintPlace: async (body) => {
    const s = st();
    s.seq += 1;
    const o: Occurrence = { occurrence_id: `m${s.seq}`, event_id: `m${s.seq}`, calendar_id: body.calendar_id, room_calendar_ids: body.rooms, start: body.start, end: body.end, title: body.title,
      state: s.settings.maintenance_overlap === 'first_holds' ? 'pending' : 'confirmed', kind: 'maintenance', on_behalf_label: null, organizer: ME, recurring: false };
    s.occ.push(o);
    return { event: eventOf(o), displaced: [] };
  },
  connections: () => read((s) => ({ connections: clone(s.connections) })),
  syncNow: async () => ({ ok: true }),
  pauseConnection: async (id) => {
    const c = st().connections.find((x) => x.id === id) as Connection;
    c.state = 'paused';
    return { connection: clone(c) };
  },
  resumeConnection: async (id) => {
    const s = st();
    const c = s.connections.find((x) => x.id === id) as Connection;
    if (c.state === 'needs_reauth' && s.settings.reauth_mode === 'reauth_only') {
      throw new ApiError(409, { code: 'bad_state', user_message: 'אי אפשר לבצע את הפעולה במצב הנוכחי של החיבור.', retryable: false, correlation_id: 'demo', details: {} });
    }
    c.state = 'ok';
    return { connection: clone(c) };
  },
  removeConnection: async (id) => {
    const s = st();
    s.connections = s.connections.filter((x) => x.id !== id);
  },
  syncFlags: () => read((s) => ({ flags: clone(s.flags) })),
  resolveFlag: async (id) => {
    const s = st();
    s.flags = s.flags.filter((f) => f.event_id !== id);
    return { ok: true };
  },
  // CALCONNECT-2330: the connect flow in memory. Nothing leaves the page: the "provider" pages are not opened, a pasted address is
  // accepted when it is the loopback address with a code, the device code is approved on the second poll.
  createConnection: async (body) => {
    const s = st();
    s.seq += 1;
    const c: Connection = { id: `c${s.seq}`, provider: body.provider, label: body.label, scope: body.scope, state: 'ok', owner: ME, last_sync_at: null, next_sync_at: null, error_code: null,
      adapter_available: true, setup: SETUP({ ready: false, tenant: body.provider === 'microsoft' ? 'common' : null }), bindings: [], revision: 1 };
    s.connections.push(c);
    return { connection: clone(c), setup_steps: [] };
  },
  putClient: async (id, body) => {
    const c = conn(id);
    if (c.provider === 'google' && !/^[0-9]{1,30}-[a-z0-9]{1,64}\.apps\.googleusercontent\.com$/.test(body.client_id)) throw demoErr(422, 'client_id_invalid', 'מזהה הלקוח לא נראה תקין עבור הספק הזה.');
    if (c.provider === 'microsoft' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.client_id)) throw demoErr(422, 'client_id_invalid', 'מזהה הלקוח לא נראה תקין עבור הספק הזה.');
    c.setup = SETUP({ ...c.setup, client_id_set: true, client_secret_set: !!body.client_secret || !!c.setup?.client_secret_set, tenant: c.provider === 'microsoft' ? body.tenant || 'common' : null, ready: !!c.setup?.authorized });
    return { connection: clone(c) };
  },
  putFeedUrl: async (id, url) => {
    const c = conn(id);
    if (!/^(https|webcal):\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(url)) throw demoErr(422, 'feed_refused', 'אי אפשר לקרוא מהכתובת הזו (רק https, פורט 443, כתובת ציבורית).');
    c.account_hint = url.replace(/^[a-z]+:\/\//i, '').split('/')[0].toLowerCase();
    c.setup = SETUP({ ...c.setup, feed_url_set: true, ready: true });
    return { connection: clone(c) };
  },
  authorize: async (id) => {
    const c = conn(id);
    if (!c.setup?.client_id_set) throw demoErr(409, 'client_missing', 'חסר מזהה הלקוח (Client ID) של האפליקציה שלך אצל הספק.');
    demoPolls[id] = 0;
    c.setup = { ...c.setup, pending_flow: c.provider === 'microsoft' ? 'microsoft' : 'google' };
    return c.provider === 'microsoft' ? { flow: 'device', user_code: 'DEMO1234', verification_url: 'https://microsoft.com/devicelogin', expires_in: 900, interval: 1 }
      : { flow: 'paste', authorize_url: 'about:blank#demo-consent', redirect_prefix: 'http://127.0.0.1:8749/', expires_in: 600 };
  },
  authorizeComplete: async (id, redirectUrl) => {
    if (!/^http:\/\/127\.0\.0\.1:8749\/\?.*code=/.test(redirectUrl.trim())) throw demoErr(422, 'paste_invalid', 'יש להדביק את כל הכתובת שהדפדפן הגיע אליה (מתחילה ב־http://127.0.0.1:8749/).');
    return { state: 'connected', connection: connected(id) };
  },
  authorizePoll: async (id) => {
    demoPolls[id] = (demoPolls[id] ?? 0) + 1;
    return demoPolls[id] < 2 ? { state: 'pending', interval: 1 } : { state: 'connected', connection: connected(id) };
  },
  authorizeCancel: async (id) => {
    const c = conn(id);
    if (c.setup) c.setup = { ...c.setup, pending_flow: null };
  },
  connectionCalendars: async (id) => {
    const c = conn(id);
    if (c.provider === 'ics_in' || c.provider === 'ical') return { calendars: [{ id_ref: 'feed', name: c.label, can_write: false, is_primary: true }] };
    return { calendars: [{ id_ref: 'primary', name: 'היומן הראשי', can_write: true, is_primary: true }, { id_ref: 'rooms', name: 'חדרי ישיבות (ייעודי ל־Arx)', can_write: true, is_primary: false },
      { id_ref: 'holidays', name: 'חגים בישראל', can_write: false, is_primary: false }] };
  },
  putBinding: async (calendarId, body) => {
    const s = st();
    for (const c of s.connections) c.bindings = c.bindings.filter((b) => b.calendar_id !== calendarId);
    if (body.connection_id) {
      const c = conn(body.connection_id);
      if ((c.provider === 'ics_in' || c.provider === 'ical') && body.direction !== 'import') throw demoErr(422, 'direction_unsupported', 'מנוי iCal הוא לקריאה בלבד.');
      if (body.direction === 'two_way' && !body.dedicated) throw demoErr(422, 'two_way_requires_dedicated', 'סנכרון דו־כיווני רק ליומן ייעודי.');
      s.seq += 1;
      c.bindings.push({ id: `b${s.seq}`, calendar_id: calendarId, direction: body.direction ?? 'export', detail: body.detail ?? 'busy', dedicated: !!body.dedicated });
    }
    return { ok: true };
  },
  feeds: () => read((s) => ({ feeds: clone(s.feeds), enabled: s.settings.feeds_enabled !== false })),
  createFeed: async (calendarIds, detail) => {
    const s = st();
    s.seq += 1;
    const f: Feed = { id: `f${s.seq}`, calendar_ids: calendarIds, detail, created_at: new Date().toISOString(), last_used_at: null, revoked: false };
    s.feeds.push(f);
    return { feed: clone(f), path: `/api/v1/calendar/feed/demo-token-${s.seq}-shown-once.ics` };
  },
  rotateFeed: async (id) => {
    const s = st();
    s.seq += 1;
    return { feed: clone(s.feeds.find((f) => f.id === id) as Feed), path: `/api/v1/calendar/feed/demo-token-${s.seq}-shown-once.ics` };
  },
  revokeFeed: async (id) => {
    const f = st().feeds.find((x) => x.id === id) as Feed;
    f.revoked = true;
    return { feed: clone(f) };
  },
};

const demoPolls: Record<string, number> = {};

function conn(id: string): Connection {
  const c = st().connections.find((x) => x.id === id);
  if (!c) throw demoErr(404, 'not_found', 'החיבור לא נמצא.');
  return c;
}

function connected(id: string): Connection {
  const c = conn(id);
  c.state = 'ok';
  c.error_code = null;
  c.setup = SETUP({ ...c.setup, authorized: true, ready: true, pending_flow: null });
  return clone(c);
}

/** Specs: forget the in-memory writes (a new page load does too). */
export function resetDemo(): void {
  store = null;
}
