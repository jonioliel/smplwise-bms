import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { liftRef, liftedReset } from '../components/top-layer';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import '../components/sw-page';
import '../components/sw-card';
import '../components/sw-tabs';
import { describeError } from '../api/client';
import { calendarsApi, type CalSettings, type Calendar, type CalendarsApi, type OverlapMode } from '../api/calendars';
import { attendeesApi, type AttendeePolicy, type AttendeeSettings } from '../api/calendar-attendees';
import type { RouteState } from '../router';
import { refreshCalendars } from '../calendars/access';
import { APPROVAL_LABEL, OVERLAP_LABEL, OVERLAP_SHORT, ROLE_HINT, ROLE_LABEL, STRICTNESS, TYPE_LABEL, colorVar, pageOf, rowsThatFit } from '../calendars/model';
import { calCss } from '../calendars/styles';

type Tab = 'overlap' | 'behavior' | 'approval' | 'perm' | 'retention';
const TABS: [Tab, string, string][] = [['overlap', 'חפיפת תחזוקה', 'חפיפה'], ['behavior', 'התנהגות', 'התנהגות'], ['approval', 'אישור לכל יומן', 'אישור'], ['perm', 'הרשאות', 'הרשאות'], ['retention', 'פרטי אורחים', 'אורחים']];

/** The server's defaults (smplwise/services/calendar/model.py SETTINGS_DEFAULTS) - the "ברירת מחדל" under every row and its reset. */
export const CAL_DEFAULTS: Partial<CalSettings> = {
  maintenance_overlap: 'first_holds', contested_requests: 'queue', pending_holds_slot: false, menu_position: 'rail', holiday_eve_as_holiday: false, guest_details_enabled: true,
  guest_retention_days: 30, editors_bypass_approval: true, default_room_buffer_after_min: 10, series_horizon_days: 400, max_calendars: 500, notify_confirmations: false,
  contested_order: 'first_come', allow_displace: true, displace_approver: 'calendar_manager', override_scope: 'both', phone_time_picker: 'grid', reauth_mode: 'reauth_and_continue',
  sync_conflict_display: 'side_by_side', tablet_panels: 'collapse', resident_pending_display: 'count', resident_cancel_until: 'start', resident_rooms: 'bookable',
  purge_confirm: 'type_word', loading_style: 'skeleton', default_approval_timeout_h: 2, reopen_days: 7, sync_external_delete: 'cancel',
  grid_edit: 'drag', cancel_notice_delay_s: 6, undo_window_s: 120, feed_max_age_days: 365,
};

type Opt = [value: string | boolean | number, label: string];
/** CALMSG-POLISH-2331: the topic of a behaviour row - the tab filters by it (22 rows were one unsorted list of 2 pages, 8 on a phone). */
export type BehaviorGroup = 'display' | 'requests' | 'booking' | 'residents' | 'sync' | 'attendees';
export interface SettingRow { key: keyof CalSettings | 'displaced'; label: string; kind: 'seg' | 'tog' | 'step'; opts?: Opt[]; min?: number; max?: number; step?: number; unit?: string; hint?: string; static?: boolean; group?: BehaviorGroup }

export const BEHAVIOR_GROUPS: [BehaviorGroup | 'all', string][] = [['all', 'הכל'], ['display', 'תצוגה'], ['requests', 'בקשות ואישורים'], ['booking', 'הזמנות'], ['residents', 'דיירים'], ['sync', 'סנכרון ופרטיות'], ['attendees', 'משתתפים']];

/** CAL-ATTENDEES-2343 follow-up: the attendee rows ("משתתפים" topic) - the installation document and one calendar's policy (server defaults). */
const ATT_DEFAULTS: AttendeeSettings = { enabled: true, cancel_notice_delay_s: 6, guest_channel_order: ['whatsapp', 'sms', 'email'], notify_users_inapp: true, notify_guests: true };
const POLICY_DEFAULTS: Omit<AttendeePolicy, 'revision'> = { guests_mode: 'organizer', self_join: false, max_attendees: 50, notify_on_change: true, list_visibility: 'organizer' };
const GUESTS_OPTS: Opt[] = [['off', 'אף אחד'], ['organizer', 'מארגן ומנהלים'], ['anyone', 'כל משתתף']];
const VISIBILITY_OPTS: Opt[] = [['organizer', 'מארגן ומנהלים'], ['attendees', 'המשתתפים'], ['viewers', 'כל מי שרואה']];

/** Every behaviour of the module is a setting (owner rule); the rows of the "התנהגות" tab, by topic (the placement first, as in the mock-up). */
export const BEHAVIOR_ROWS: SettingRow[] = [
  { group: 'display', key: 'menu_position', label: 'מיקום "יומנים" בתפריט', kind: 'seg', opts: [['rail', 'סרגל צד'], ['home_tab', 'לשונית בראשי'], ['both', 'שניהם']], hint: 'דייר עם יומנים בלבד מקבל תמיד כפתור משלו' },
  { group: 'display', key: 'phone_time_picker', label: 'בחירת שעה בטלפון', kind: 'seg', opts: [['grid', 'רשת שעות'], ['timeline', 'פס זמן']] },
  { group: 'display', key: 'tablet_panels', label: 'טאבלט 1024: לוחות צד', kind: 'seg', opts: [['collapse', 'נפתחים בלחיצה'], ['shrink', 'מוקטנים']] },
  { group: 'display', key: 'loading_style', label: 'טעינה', kind: 'seg', opts: [['skeleton', 'שלד'], ['spinner', 'סמל מסתובב']] },
  { group: 'requests', key: 'editors_bypass_approval', label: 'מנהלים ועורכים לא צריכים אישור ביומן שלהם', kind: 'tog' },
  { group: 'requests', key: 'notify_confirmations', label: 'הודעת אישור למארגן כשאין צורך באישור', kind: 'tog' },
  { group: 'requests', key: 'default_approval_timeout_h', label: 'בקשה שלא הוחלטה פגה לפני ההתחלה', kind: 'step', min: 0, max: 720, step: 1, unit: 'שע׳', hint: 'ליומן חדש' },
  { group: 'requests', key: 'reopen_days', label: 'פתיחה מחדש של בקשה שנדחתה', kind: 'step', min: 0, max: 60, step: 1, unit: 'ימים' },
  { group: 'requests', key: 'contested_order', label: 'עדיפות כשבקשות מתחרות', kind: 'seg', opts: [['first_come', 'סדר הגעה'], ['manual', 'מנהל מחליט'], ['by_kind', 'לפי סוג']] },
  { group: 'requests', key: 'allow_displace', label: 'אישור בקשה מעל הזמנה מאושרת (דחיקה)', kind: 'tog', hint: 'כבוי: רק לדחות את הבקשות' },
  { group: 'requests', key: 'displace_approver', label: 'מי רשאי לדחוק הזמנה מאושרת', kind: 'seg', opts: [['calendar_manager', 'מנהל היומן'], ['any_manager', 'כל מנהל']] },
  { group: 'requests', key: 'displaced', label: 'הזמנה שנדחקה', kind: 'seg', opts: [['organizer', 'המארגן בוחר'], ['auto', 'הזזה אוטומטית']], static: true, hint: 'הזזה אוטומטית לא נבנתה' },
  { group: 'booking', key: 'holiday_eve_as_holiday', label: 'ערב חג', kind: 'seg', opts: [[false, 'יום רגיל'], [true, 'כמו חג']] },
  { group: 'booking', key: 'default_room_buffer_after_min', label: 'הפסקה אחרי הזמנת חדר', kind: 'step', min: 0, max: 240, step: 5, unit: 'דק׳' },
  // CAL-GRID-EDIT-2343 (owner answers 02.11): editing on the grid, and how long "בטל" waits before the organizer is told
  { group: 'booking', key: 'grid_edit', label: 'עבודה על לוח היומן', kind: 'seg', opts: [['drag', 'יצירה, הזזה ושינוי אורך'], ['create_only', 'יצירה בלבד']], hint: 'בלי הזזה: משנים שעה מהעריכה' },
  { group: 'requests', key: 'cancel_notice_delay_s', label: 'הודעה למארגן על ביטול או הזזה אחרי', kind: 'step', min: 0, max: 60, step: 1, unit: 'שנ׳', hint: 'כדי ש"בטל" לא ישלח "בוטל" ואז "נקבע שוב"' },
  { group: 'requests', key: 'undo_window_s', label: 'אפשר לשחזר מחיקה עד', kind: 'step', min: 10, max: 600, step: 10, unit: 'שנ׳' },
  { group: 'booking', key: 'series_horizon_days', label: 'טווח פריסת סדרות', kind: 'step', min: 30, max: 800, step: 10, unit: 'יום' },
  { group: 'booking', key: 'max_calendars', label: 'מספר יומנים מרבי', kind: 'step', min: 1, max: 2000, step: 10 },
  { group: 'residents', key: 'resident_cancel_until', label: 'דייר יכול לבטל עד', kind: 'seg', opts: [['start', 'תחילה'], ['1h', 'שעה לפני'], ['24h', '24 שע׳']] },
  { group: 'residents', key: 'resident_pending_display', label: 'שעה עם בקשות ממתינות, אצל הדייר', kind: 'seg', opts: [['count', '"2 מבקשים"'], ['free', 'רק "פנוי"'], ['blocked', 'חסומה']] },
  { group: 'residents', key: 'resident_rooms', label: 'חדרים במסך ההזמנה של הדייר', kind: 'seg', opts: [['bookable', 'רק שמותר לו'], ['all_busy', 'כולם, השאר "תפוס"']] },
  { group: 'sync', key: 'sync_conflict_display', label: 'התנגשות מסנכרון בתצוגת השבוע', kind: 'seg', opts: [['side_by_side', 'זו לצד זו'], ['list_only', 'רק ברשימה']] },
  { group: 'sync', key: 'reauth_mode', label: 'חיבור שדורש הרשאה מחדש', kind: 'seg', opts: [['reauth_and_continue', 'הרשאה + "המשך"'], ['reauth_only', 'הרשאה בלבד']] },
  { group: 'sync', key: 'purge_confirm', label: 'אישור "מחיקת כל פרטי האורחים"', kind: 'seg', opts: [['type_word', 'הקלדת "מחיקה"'], ['one_click', 'לחיצה בחלון']] },
  // CAL-FEED-REVIEW-2351 owner round 14 (3C): the expiry a new or renewed outgoing-feed address gets; an address already out keeps its own
  { group: 'sync', key: 'feed_max_age_days', label: 'תוקף קישור של פיד יוצא', kind: 'seg', opts: [[90, '90 יום'], [180, '180 יום'], [365, '365 יום'], [0, 'ללא הגבלה']],
    hint: 'לקישורים חדשים ומחודשים; קישור קיים שומר על התוקף שלו' },
];

/** The label of a row's default value ("ברירת מחדל: ..."). */
export function defaultLabel(r: SettingRow): string {
  if (r.static) return 'המארגן בוחר חלופה';
  const d = CAL_DEFAULTS[r.key as keyof CalSettings];
  if (r.kind === 'tog') return d ? 'דולק' : 'כבוי';
  if (r.kind === 'step') return `${d}${r.unit ? ` ${r.unit}` : ''}`;
  return r.opts?.find((o) => o[0] === d)?.[1] ?? String(d);
}

const OVERLAP_HINT: Record<OverlapMode, string> = {
  first_holds: 'חלון התחזוקה נשמר כממתין ומסומן "מתחרה". שום הזמנה לא זזה עד שהמנהל מחליט.',
  override_notify: 'ההזמנה עוברת ל"נדחק" ולא נמחקת. המארגן בוחר אחת מ־3 חלופות.',
  block: 'השמירה נחסמת ומוצעים חלונות פנויים באותו אורך.',
  ask: 'מי שמציב את החלון בוחר בכל פעם, והבחירה נשמרת עם החלון.',
};

/**
 * CALENDARS-UI-2310: הגדרות › יומנים (#/system/calendars?tab=...). The module switch, then five tabs - the maintenance overlap (and how far a
 * calendar may differ), every behaviour of the module (owner rule: every behaviour is a setting; the owner answers of 30.10 night each switch
 * between their options here), approval per calendar, permissions, guest details. A change is saved at once (the whole document, PUT
 * /calendar/settings); the navigation follows a change of the placement at once. Without calendar.configure everything is read-only.
 * Paging instead of a page scroll (owner rule 2026-10-24): the rows that fit the panel are shown, the rest on the next page.
 */
@customElement('system-calendars')
export class SystemCalendars extends LitElement {
  static styles = [calCss, liftedReset, css`
    /* AUDIT30-F4 (#18, owner Q11 option A assumed): one settings structure - the shared page (crumb, title, the module switch at the row's
       end), underline tabs, the tab's content in one card. The card fills the page and pages its rows (no page scroll, owner rule 2026-10-24). */
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; overflow: hidden; }
    sw-page { flex: 1; min-block-size: 0; }
    .tabcard { flex: 1; min-block-size: 0; }
    .cardin { display: flex; flex-direction: column; gap: 12px; block-size: 100%; min-block-size: 0; overflow: hidden; }
    .tabhead { display: flex; align-items: flex-end; gap: 8px 16px; flex-wrap: wrap; min-inline-size: 0; }
    .tabhead h2 + .lead { margin-block-start: 4px; }
    .groups { flex-wrap: wrap; }
    .groups .mod { display: inline-grid; place-items: center; min-inline-size: 18px; block-size: 18px; padding: 0 5px; margin-inline-start: 6px; border-radius: var(--sw-r-pill);
      background: var(--sw-accent-soft); color: var(--sw-accent-text); font-size: var(--sw-fs-2xs); font-weight: var(--sw-fw-bold); }
    .groupsel { inline-size: 100%; }
    /* focus and hover on every control the screen draws itself (the shared .btn / .seg have theirs in calCss) */
    .opt, .reset, .linkrow, .seg button, .selw select { transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color); }
    @media (prefers-reduced-motion: reduce) { .opt, .stepper button, .opt:active, .stepper button:active { transition: none; transform: none; } }
    .opt:focus-visible, .stepper button:focus-visible, .reset:focus-visible, .linkrow:focus-visible, .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: var(--sw-focus-offset); }
    .stepper input:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; border-radius: var(--sw-r-sm); }
    .stepper button:not([disabled]):active, .opt:not([disabled]):active { transform: scale(0.97); }
    .stepper button { transition: transform var(--sw-t-press) var(--sw-ease), background var(--sw-t-hover) var(--sw-ease-color); }
    @media (hover: hover) {
      .opt:not([disabled]):not([aria-checked='true']):hover { background: var(--sw-hover-wash); }
      .stepper button:not([disabled]):hover { background: var(--sw-hover-wash); }
      .linkrow:hover { background: var(--sw-hover-wash); }
      .linkrow:hover .chip.acc { background: var(--sw-accent); color: var(--sw-text-inverse); }
      .reset:hover { text-decoration: underline; text-underline-offset: 2px; }
    }
    /* a select reads as a select: the chevron at its end (appearance: none hid the native arrow) */
    .selw { position: relative; display: inline-flex; align-items: center; max-inline-size: 100%; }
    .selw select { padding-inline-end: 30px; }
    .selw sw-icon { position: absolute; inset-inline-end: 10px; pointer-events: none; color: var(--sw-text-3); }
    .selw select[disabled] + sw-icon { opacity: var(--sw-disabled-opacity); }
    table.t tbody tr { transition: background var(--sw-t-hover) var(--sw-ease-color); }
    @media (hover: hover) { table.t tbody tr:hover td { background: var(--sw-hover-wash); } }
    .modsw { display: inline-flex; align-items: center; gap: 10px; font-size: var(--sw-fs-md); color: var(--sw-text-2); }
    .tabs { flex: none; }
    h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    h3 { margin: 4px 0 0; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .lead { margin: -4px 0 0; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .twocol { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 16px 20px; min-block-size: 0; }
    .col { display: flex; flex-direction: column; gap: 8px; min-inline-size: 0; min-block-size: 0; }
    .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt[disabled] { cursor: default; }
    .rad { flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%; border: 2px solid var(--sw-border-strong); margin-block-start: 2px; display: grid; place-items: center; }
    .opt[aria-checked='true'] .rad { border-color: var(--sw-accent); }
    .opt[aria-checked='true'] .rad::after { content: ''; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .opt b { display: block; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .opt small { display: block; font-size: var(--sw-fs-sm); color: var(--sw-text-2); margin-block-start: 2px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: max-content; gap: 8px; flex: 1; min-block-size: 0; align-content: start; overflow: hidden; }
    .fitbox { container-type: inline-size; flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
    @container (min-width: 760px) { .rows2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); } }
    .row { flex-wrap: wrap; min-block-size: 58px; padding-block: 8px; gap: 8px 12px; }
    .row .ctl { display: flex; align-items: center; gap: 8px; flex: none; max-inline-size: 100%; }
    .reset { font: inherit; font-size: var(--sw-fs-xs); color: var(--sw-accent-text); background: none; border: 0; cursor: pointer; padding: 2px 4px; }
    .stepper { display: inline-flex; align-items: center; gap: 4px; }
    .stepper button { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading);
      font: inherit; font-size: var(--sw-fs-lg); cursor: pointer; display: grid; place-items: center; padding: 0; }
    .stepper button[disabled] { opacity: var(--sw-disabled-opacity); cursor: default; }
    .stepper input { inline-size: 60px; text-align: center; font: inherit; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); border: 0;
      background: transparent; font-variant-numeric: tabular-nums; -moz-appearance: textfield; appearance: textfield; }
    .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; }
    .def { color: var(--sw-accent-text); background: var(--sw-accent-soft); }
    table.t { inline-size: 100%; border-collapse: collapse; font-size: var(--sw-fs-sm); }
    table.t th { text-align: start; font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); font-size: var(--sw-fs-xs); padding: 8px 10px; border-block-end: 1px solid var(--sw-border); white-space: nowrap; }
    table.t td { padding: 8px 10px; border-block-end: 1px solid var(--sw-border); vertical-align: middle; color: var(--sw-text); }
    table.t tr:last-child td { border-block-end: 0; }
    table.t .n { font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    table.t select.inp { min-block-size: 34px; font-size: var(--sw-fs-sm); inline-size: auto; max-inline-size: 220px; }
    .cname { display: flex; align-items: center; gap: 8px; min-inline-size: 0; max-inline-size: 260px; }
    .danger { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--sw-danger) 40%, transparent); }
    .banner { display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-warning-soft); font-size: var(--sw-fs-sm); }
    .banner b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .banner sw-icon { color: var(--sw-warning-text); flex: none; }
    .err { background: var(--sw-danger-soft); color: var(--sw-danger-text); padding: 8px 12px; border-radius: var(--sw-r-md); font-size: var(--sw-fs-sm); }
    .ro { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .dlg p { margin: 0 0 10px; }
    .typed { display: grid; gap: 6px; margin-block-start: 10px; }
    .typed .lbl { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    .rolechips { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; flex: none; }
    .rolechips .row { min-block-size: 0; flex-direction: column; align-items: flex-start; gap: 2px; }
    .linkrow { text-decoration: none; color: inherit; }
    @media (max-width: 1179px) { .rolechips { display: none; } }
    @media (max-width: 699px) {
      .cardin { gap: 10px; }
      .twocol { grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
      .col { gap: 5px; }
      .opt { padding: 9px 12px; align-items: center; }
      .opt small { display: none; }
      .opt .rad { margin-block-start: 0; }
      .wide-only { display: none; }
      .row .ctl { inline-size: 100%; }
      .row .seg { flex-wrap: wrap; border-radius: var(--sw-r-lg); }
      .lead { display: none; }
      .tabhead { flex-direction: column; align-items: stretch; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];

  @property({ attribute: false }) route: RouteState | null = null;
  @state() private s: CalSettings | null = null;
  @state() private canEdit = false;
  @state() private cals: Calendar[] = [];
  @state() private error = '';
  @state() private saveError = '';
  @state() private page = 1;
  @state() private per = 6;
  @state() private draftRetention: number | null = null;
  @state() private confirm: 'retention' | 'purge' | null = null;
  @state() private typed = '';
  @state() private toastText = '';
  @state() private phone = window.innerWidth < 700;
  /** CALMSG-POLISH-2331: the topic shown on the behaviour tab ("הכל" by default; every row stays reachable) */
  @state() private group: BehaviorGroup | 'all' = 'all';
  /** CAL-ATTENDEES-2343 follow-up: the attendee settings (loaded when the "משתתפים" topic opens) and the chosen calendar's policy */
  @state() private att: AttendeeSettings | null = null;
  @state() private attCanEdit = false;
  @state() private attCal = '';
  @state() private policy: AttendeePolicy | null = null;
  @state() private policyCanEdit = false;
  private api: CalendarsApi | null = null;
  private attTimer = 0;
  private ro: ResizeObserver | null = null;
  private stepTimer = 0;
  /** The tallest row met on this tab so far: rows per page only shrink while paging, so turning a page never skips a row. */
  private fitRowH = 0;
  private toastTimer = 0;
  private onResize = () => (this.phone = window.innerWidth < 700);

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this.onResize);
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    this.ro?.disconnect();
    clearTimeout(this.stepTimer);
    clearTimeout(this.toastTimer);
    clearTimeout(this.attTimer);
  }

  // ---------------------------------------------------------------- attendees (CAL-ATTENDEES-2343 follow-up)

  private async loadAttendees(): Promise<void> {
    try {
      const r = await attendeesApi().settings();
      this.att = r.settings;
      this.attCanEdit = r.can_configure;
      const first = this.attCals()[0]?.id ?? '';
      if (!this.attCal && first) await this.pickPolicyCal(first);
    } catch (e) {
      this.saveError = describeError(e);
    }
  }

  private attCals(): Calendar[] {
    return this.cals.filter((c) => c.type !== 'maintenance');
  }

  private async pickPolicyCal(cid: string): Promise<void> {
    this.attCal = cid;
    this.policy = null;
    if (!cid) return;
    try {
      const r = await attendeesApi().policy(cid);
      if (this.attCal !== cid) return;
      this.policy = r.policy;
      this.policyCanEdit = r.can_edit;
    } catch (e) {
      this.saveError = describeError(e);
    }
  }

  /** Saves the whole installation document with one change (the server validates; a refusal restores the old value). */
  private async saveAtt(patch: Partial<AttendeeSettings>): Promise<void> {
    if (!this.att || !this.attCanEdit) return;
    const before = this.att;
    this.att = { ...this.att, ...patch };
    this.saveError = '';
    try {
      this.att = (await attendeesApi().saveSettings(this.att)).settings;
    } catch (e) {
      this.att = before;
      this.saveError = describeError(e);
    }
  }

  private async savePolicy(patch: Partial<AttendeePolicy>): Promise<void> {
    if (!this.policy || !this.policyCanEdit) return;
    const before = this.policy;
    const cid = this.attCal;
    this.policy = { ...this.policy, ...patch };
    this.saveError = '';
    try {
      const r = await attendeesApi().savePolicy(cid, { ...patch, revision: before.revision });
      if (this.attCal === cid) this.policy = r.policy;
    } catch (e) {
      if (this.attCal === cid) this.policy = before;
      this.saveError = describeError(e);
    }
  }

  /** One attendee row in the shared look of settingRow: name, default (+ reset), control. */
  private attRow(key: string, label: string, hint: string, off: boolean, cur: unknown, def: unknown, kind: 'seg' | 'tog' | 'step', save: (v: unknown) => void,
    o: { opts?: Opt[]; min?: number; max?: number; unit?: string } = {}) {
    let ctl;
    if (kind === 'tog') {
      ctl = html`<sw-toggle label=${label} labelHidden ?checked=${!!cur} ?disabled=${off} @change=${(e: CustomEvent<{ checked: boolean }>) => save(e.detail.checked)}></sw-toggle>`;
    } else if (kind === 'step') {
      const n = Number(cur);
      const lo = o.min ?? 0;
      const hi = o.max ?? 9999;
      const set = (x: number) => {
        const v = Math.min(hi, Math.max(lo, Math.round(x || 0)));
        clearTimeout(this.attTimer);
        this.attTimer = window.setTimeout(() => save(v), 500);
        if (key.startsWith('policy.') && this.policy) this.policy = { ...this.policy, [key.slice(7)]: v };
        else if (this.att) this.att = { ...this.att, [key.slice(4)]: v };
      };
      ctl = html`<span class="stepper"><button type="button" aria-label="פחות" ?disabled=${off || n <= lo} @click=${() => set(n - 1)}>−</button>
        <input type="number" inputmode="numeric" aria-label=${label} .value=${String(n)} ?disabled=${off} min=${lo} max=${hi} @change=${(e: Event) => set(Number((e.target as HTMLInputElement).value))}><button type="button" aria-label="יותר" ?disabled=${off || n >= hi} @click=${() => set(n + 1)}>+</button></span>`;
    } else {
      ctl = html`<div class="seg" role="radiogroup" aria-label=${label}>${(o.opts ?? []).map(([val, lab]) => html`<button type="button" role="radio" aria-pressed=${String(cur === val)} aria-checked=${String(cur === val)}
        ?disabled=${off} data-opt=${String(val)} @click=${() => { if (cur !== val) save(val); }}>${lab}</button>`)}</div>`;
    }
    const defText = kind === 'tog' ? (def ? 'דולק' : 'כבוי') : kind === 'step' ? `${def}${o.unit ? ` ${o.unit}` : ''}` : o.opts?.find((x) => x[0] === def)?.[1] ?? String(def);
    return html`<div class="row" data-setting=${key}><div class="grow"><div class="name ell" title=${label}>${label}</div>
      <div class="sub">ברירת מחדל: ${defText}${hint ? html` · ${hint}` : nothing}${cur !== def && !off ? html` <button type="button" class="reset" data-reset=${key} @click=${() => save(def)}>איפוס</button>` : nothing}</div></div><div class="ctl">${ctl}</div></div>`;
  }

  /** The "משתתפים" topic of the behaviour tab: the installation rows, then the policy of the calendar picked in the head. */
  private attendeeRows(): unknown[] {
    const a = this.att;
    if (!a) return [html`<div class="skel" style="block-size:56px"></div>`];
    const offA = !this.attCanEdit;
    const sa = (k: keyof AttendeeSettings) => (v: unknown) => void this.saveAtt({ [k]: v } as Partial<AttendeeSettings>);
    const rows: unknown[] = [
      this.attRow('att.enabled', 'משתתפים בשמם באירועים', 'כבוי: אין רשימת משתתפים ואין הודעות', offA, a.enabled, ATT_DEFAULTS.enabled, 'tog', sa('enabled')),
      this.attRow('att.notify_users_inapp', 'הודעה במערכת למשתמשים ולדיירים', '', offA, a.notify_users_inapp, ATT_DEFAULTS.notify_users_inapp, 'tog', sa('notify_users_inapp')),
      this.attRow('att.notify_guests', 'הודעה לאורחים בערוץ ההודעות', 'וואטסאפ היום', offA, a.notify_guests, ATT_DEFAULTS.notify_guests, 'tog', sa('notify_guests')),
      this.attRow('att.cancel_notice_delay_s', 'הודעת ביטול למשתתפים אחרי', 'כדי ש"בטל" יעצור אותה', offA, a.cancel_notice_delay_s, ATT_DEFAULTS.cancel_notice_delay_s, 'step', sa('cancel_notice_delay_s'), { min: 0, max: 120, unit: 'שנ׳' }),
    ];
    const p = this.policy;
    if (!this.attCal) return rows;
    if (!p) return [...rows, html`<div class="skel" style="block-size:56px"></div>`];
    const offP = !this.policyCanEdit;
    const sp = (k: keyof AttendeePolicy) => (v: unknown) => void this.savePolicy({ [k]: v } as Partial<AttendeePolicy>);
    const D = POLICY_DEFAULTS;
    return [...rows,
      this.attRow('policy.guests_mode', 'מי מזמין אורחים מבחוץ', 'ביומן הנבחר', offP, p.guests_mode, D.guests_mode, 'seg', sp('guests_mode'), { opts: GUESTS_OPTS }),
      this.attRow('policy.self_join', 'מי שרואה את האירוע מצטרף בעצמו', 'ביומן הנבחר', offP, p.self_join, D.self_join, 'tog', sp('self_join')),
      this.attRow('policy.list_visibility', 'מי רואה את רשימת המשתתפים', 'ביומן הנבחר · השאר רואים רק את המספר', offP, p.list_visibility, D.list_visibility, 'seg', sp('list_visibility'), { opts: VISIBILITY_OPTS }),
      this.attRow('policy.max_attendees', 'מספר משתתפים מרבי', 'ביומן הנבחר', offP, p.max_attendees, D.max_attendees, 'step', sp('max_attendees'), { min: 1, max: 500 }),
      this.attRow('policy.notify_on_change', 'הודעה למשתתפים על שינוי', 'ביומן הנבחר', offP, p.notify_on_change, D.notify_on_change, 'tog', sp('notify_on_change')),
    ];
  }

  protected willUpdate(changed: PropertyValues): void {
    const old = changed.get('route') as RouteState | null | undefined;
    if (changed.has('route') && old && old.params.get('tab') !== this.route?.params.get('tab')) {
      this.page = 1;
      this.per = 6;
      this.fitRowH = 0;
    }
    if (changed.has('phone')) this.fitRowH = 0;
  }

  protected updated(): void {
    // paging instead of a page scroll: as many rows as the panel holds (measured: the tablet, a short laptop and the phone all fit)
    const box = this.renderRoot.querySelector<HTMLElement>('[data-fit]');
    this.ro ??= new ResizeObserver(() => this.fit());
    this.ro.disconnect();
    if (box) {
      this.ro.observe(box);
      requestAnimationFrame(() => this.fit());
    }
  }

  private fit(): void {
    const box = this.renderRoot.querySelector<HTMLElement>('[data-fit]');
    if (!box) return;
    const cols = getComputedStyle(box).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
    // the tallest row drawn decides (a row wraps its control under the name on the phone), never less than the declared height
    const table = !!box.querySelector('tbody');
    const rows = table ? [...box.querySelectorAll('tbody tr')] : [...box.children];
    const tallest = Math.max(0, ...rows.map((c) => (c as HTMLElement).offsetHeight + (table ? 0 : 8)));
    const rowH = Math.max(Number(box.dataset.fit) || 66, tallest, this.fitRowH);
    this.fitRowH = rowH;
    // CALMSG-POLISH-2331: a table's header row takes its share of the box - counted, the last body row was drawn half cut off
    const avail = table ? box.clientHeight - (box.querySelector<HTMLElement>('thead')?.offsetHeight ?? 0) : box.clientHeight + 8;
    const per = cols * rowsThatFit(avail, rowH);
    if (per !== this.per) {
      // keep the first row of the page in view when the measure changes, so a page is never skipped
      this.page = Math.floor(((this.page - 1) * this.per) / Math.max(1, per)) + 1;
      this.per = per;
    }
  }

  private get tab(): Tab {
    const t = this.route?.params.get('tab') as Tab | null;
    return t && TABS.some((x) => x[0] === t) ? t : 'overlap';
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.api ??= await calendarsApi();
      const [r, c] = await Promise.all([this.api.settings(), this.api.calendars().catch(() => ({ calendars: [] as Calendar[] }))]);
      this.s = r.settings;
      this.canEdit = r.can_configure;
      this.cals = c.calendars.filter((x) => !x.archived);
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private toast(t: string): void {
    this.toastText = t;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastText = ''), 3200);
  }

  /** Saves the whole document with one change (the server refuses unknown keys and replaces the document). */
  private async save(patch: Partial<CalSettings>): Promise<number> {
    if (!this.s || !this.api || !this.canEdit) return 0;
    const before = this.s;
    this.s = { ...this.s, ...patch } as CalSettings;
    this.saveError = '';
    try {
      const r = await this.api.saveSettings(this.s);
      this.s = r.settings;
      void refreshCalendars(); // the navigation (placement, the switch) and every screen's ui follow at once
      return r.erase_preview;
    } catch (e) {
      this.s = before;
      this.saveError = describeError(e);
      return 0;
    }
  }

  private stepSave(key: keyof CalSettings, v: number): void {
    if (!this.s) return;
    this.s = { ...this.s, [key]: v } as CalSettings;
    clearTimeout(this.stepTimer);
    this.stepTimer = window.setTimeout(() => void this.save({ [key]: v } as Partial<CalSettings>), 500);
  }

  render() {
    if (this.error) return html`<sw-page crumbs="הגדרות" heading="יומנים" wide><sw-state-panel state="error" data-calset-state="error" heading="לא הצלחנו לטעון את הגדרות היומנים" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.load()}></sw-state-panel></sw-page>`;
    if (!this.s) return html`<sw-page crumbs="הגדרות" heading="יומנים" wide><div class="panel" data-calset-state="loading" role="status" aria-label="טוען">${[0, 1, 2, 3].map(() => html`<div class="skel" style="block-size:56px"></div>`)}</div></sw-page>`;
    const tab = this.tab;
    return html`
      <sw-page crumbs=${this.phone ? '' : 'הגדרות' /* the phone drops the crumb, as before: the rows get the height */} heading="יומנים" wide data-calset-page>
        <label class="modsw" slot="actions"><span class="wide-only">מודול היומנים</span><sw-toggle data-calset="enabled" label="מודול היומנים פעיל" labelHidden ?checked=${this.s.enabled} ?disabled=${!this.canEdit}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked })}></sw-toggle><b>${this.s.enabled ? 'פעיל' : 'כבוי'}</b></label>
      ${this.canEdit ? nothing : html`<div class="ro" data-calset-ro>צפייה בלבד: שינוי ההגדרות דורש את ההרשאה "יומנים: הגדרות".</div>`}
      ${this.saveError ? html`<div class="err" role="alert" data-calset-error>${this.saveError}</div>` : nothing}
        <sw-tabs class="tabs" variant="underline" group-label="הגדרות היומנים" data-calset-tabs ?short-labels=${this.phone}
          .items=${TABS.map(([id, he, short]) => ({ id, label: he, short, href: `#/system/calendars?tab=${id}` }))} .active=${tab}></sw-tabs>
        <sw-card class="tabcard" fill clip data-calset-tab=${tab}><div class="cardin">
          ${tab === 'overlap' ? this.overlapTab() : tab === 'behavior' ? this.behaviorTab() : tab === 'approval' ? this.approvalTab() : tab === 'perm' ? this.permTab() : this.retentionTab()}
        </div></sw-card>
      </sw-page>
      ${this.dialogs()}
      ${this.toastText ? html`<div class="toast" role="status" data-calset-toast ${liftRef() /* DIALOG-TOPLAYER-2381: above an open sw-dialog */}>${this.toastText}</div>` : nothing}`;
  }

  // ---------------------------------------------------------------- tab: maintenance overlap (D7 / C1 / C3, owner answers 9 and 10)

  private overlapTab() {
    const s = this.s as CalSettings;
    const modes: OverlapMode[] = ['first_holds', 'override_notify', 'block', 'ask'];
    const overrides = this.cals.filter((c) => c.overlap_override).slice(0, 2);
    const inst = STRICTNESS[s.maintenance_overlap];
    return html`<div class="twocol">
      <div class="col" role="radiogroup" aria-label="כשחלון תחזוקה נופל על הזמנה מאושרת"><h2>כשחלון תחזוקה נופל על הזמנה מאושרת</h2>
        ${modes.map((m) => html`<button type="button" class="opt" role="radio" aria-checked=${String(s.maintenance_overlap === m)} ?disabled=${!this.canEdit} data-overlap=${m}
          @click=${() => void this.save({ maintenance_overlap: m })}><span class="rad"></span><div><b>${OVERLAP_LABEL[m]}${m === 'first_holds' ? html` <span class="chip def">ברירת מחדל</span>` : nothing}</b><small>${OVERLAP_HINT[m]}</small></div></button>`)}
      </div>
      <div class="col"><h2>יומן שקובע אחרת</h2>
        <p class="lead">מנהל יומן יכול לבחור ערך אחר ליומן שלו${overrides.length ? '. דוגמה מהיומנים שלך:' : '. אף יומן לא בחר ערך משלו.'}</p>
        ${overrides.map((c) => {
          const stricter = STRICTNESS[c.overlap_override as OverlapMode] >= inst;
          return html`<div class="row wide-only" data-override=${c.id}><span class="dot" style=${`--h:${colorVar(c.color)}`}></span><div class="grow"><div class="name ell" title=${c.name}>${c.name}: "${OVERLAP_SHORT[c.overlap_override as OverlapMode]}"</div>
            <div class="sub">${stricter ? 'מחמיר מההגדרה הכללית' : 'מקל מההגדרה הכללית'}</div></div><span class=${`chip ${stricter ? '' : 'warn'}`}>${stricter ? 'מחמיר' : 'מקל'}</span></div>`;
        })}
        ${this.settingRow({ key: 'override_scope', label: 'מנהל יומן רשאי לשנות', kind: 'seg', opts: [['both', 'שני הכיוונים'], ['stricter', 'רק מחמיר'], ['none', 'לא']] })}
        ${this.settingRow({ key: 'pending_holds_slot', label: 'בקשה ממתינה שומרת את המועד', kind: 'tog', hint: 'כבוי: הראשון שאושר זוכה' })}
        ${this.settingRow({ key: 'contested_requests', label: 'בקשות חופפות', kind: 'seg', opts: [['queue', 'לתור'], ['reject', 'לדחות']], hint: 'לתור החלטה, עם מספר המבקשים' })}
      </div></div>`;
  }

  // ---------------------------------------------------------------- tab: behaviour (owner rule: every behaviour is a setting)

  private behaviorTab() {
    const attendees = this.group === 'attendees';
    const rows: unknown[] = attendees ? this.attendeeRows() : (this.group === 'all' ? BEHAVIOR_ROWS : BEHAVIOR_ROWS.filter((r) => r.group === this.group)).map((r) => this.settingRow(r));
    const p = pageOf(rows, this.page, this.per);
    const changed = (g: BehaviorGroup | 'all') => BEHAVIOR_ROWS.filter((r) => (g === 'all' || r.group === g) && !r.static && this.s?.[r.key as keyof CalSettings] !== CAL_DEFAULTS[r.key as keyof CalSettings]).length;
    const pick = (g: BehaviorGroup | 'all') => {
      if (g === this.group) return;
      this.group = g;
      this.page = 1;
      this.fitRowH = 0;
      if (g === 'attendees' && !this.att) void this.loadAttendees();
    };
    // the calendar whose attendee policy the lower rows show (a calendar manager edits his own; the server decides)
    const calPick = attendees && this.attCals().length ? html`<span class="selw"><select class="inp" aria-label="יומן" data-calset-attcal .value=${this.attCal}
        @change=${(e: Event) => { this.page = 1; void this.pickPolicyCal((e.target as HTMLSelectElement).value); }}>
        ${this.attCals().map((c) => html`<option value=${c.id} ?selected=${c.id === this.attCal}>${c.name}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>` : nothing;
    return html`<div class="tabhead"><div class="grow"><h2>התנהגות המודול</h2><p class="lead">כל התנהגות היא הגדרה. ברירת המחדל כתובה מתחת לכל שורה; "איפוס" מחזיר אותה.</p></div>
        ${this.phone ? html`<select class="inp groupsel" aria-label="נושא" data-calset-group .value=${this.group} @change=${(e: Event) => pick((e.target as HTMLSelectElement).value as BehaviorGroup | 'all')}>
            ${BEHAVIOR_GROUPS.map(([g, he]) => html`<option value=${g} ?selected=${g === this.group}>${he}</option>`)}</select>`
          : html`<div class="seg groups" role="radiogroup" aria-label="נושא" data-calset-groups>${BEHAVIOR_GROUPS.map(([g, he]) => {
            const n = g === 'all' ? 0 : changed(g);
            return html`<button type="button" role="radio" aria-pressed=${String(g === this.group)} aria-checked=${String(g === this.group)} data-calset-group=${g} @click=${() => pick(g)}>${he}${n ? html`<span class="mod num" title="שונו מברירת המחדל">${n}</span>` : nothing}</button>`;
          })}</div>`}${calPick}</div>
      <div class="fitbox"><div class="grid rows2" data-fit="66" data-calset-rows>${p.items}</div></div>
      ${this.pager(p.page, p.pages)}`;
  }

  private pager(page: number, pages: number) {
    if (pages <= 1) return nothing;
    return html`<div class="pager" data-calset-pager><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${page <= 1} data-calset-prev @click=${() => (this.page = page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <span class="num">${page} / ${pages}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${page >= pages} data-calset-next @click=${() => (this.page = page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>`;
  }

  /** One setting row: the name, "ברירת מחדל: X" (and "איפוס" when it differs), the control. */
  private settingRow(r: SettingRow) {
    const s = this.s as CalSettings;
    const v = r.static ? 'organizer' : s[r.key as keyof CalSettings];
    const def = r.static ? 'organizer' : CAL_DEFAULTS[r.key as keyof CalSettings];
    const off = !this.canEdit;
    const changed = !r.static && v !== def;
    let ctl;
    if (r.kind === 'tog') {
      ctl = html`<sw-toggle label=${r.label} labelHidden ?checked=${!!v} ?disabled=${off} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ [r.key]: e.detail.checked } as Partial<CalSettings>)}></sw-toggle>`;
    } else if (r.kind === 'step') {
      const n = Number(v);
      const set = (x: number) => this.stepSave(r.key as keyof CalSettings, Math.min(r.max ?? 9999, Math.max(r.min ?? 0, Math.round(x || 0))));
      ctl = html`<span class="stepper"><button type="button" aria-label="פחות" ?disabled=${off || n <= (r.min ?? 0)} @click=${() => set(n - (r.step ?? 1))}>−</button>
        <input type="number" inputmode="numeric" aria-label=${r.label} .value=${String(n)} ?disabled=${off} min=${r.min ?? 0} max=${r.max ?? 9999}
          @change=${(e: Event) => set(Number((e.target as HTMLInputElement).value))}><button type="button" aria-label="יותר" ?disabled=${off || n >= (r.max ?? 9999)} @click=${() => set(n + (r.step ?? 1))}>+</button></span>`;
    } else {
      ctl = html`<div class="seg" role="radiogroup" aria-label=${r.label}>${(r.opts ?? []).map(([val, lab]) => html`<button type="button" role="radio" aria-pressed=${String(v === val)} aria-checked=${String(v === val)}
        ?disabled=${off || (r.static && val !== 'organizer')} title=${r.static && val !== 'organizer' ? 'לא נבנה' : ''} data-opt=${String(val)}
        @click=${() => { if (!r.static && v !== val) void this.save({ [r.key]: val } as Partial<CalSettings>); }}>${lab}</button>`)}</div>`;
    }
    return html`<div class="row" data-setting=${r.key}><div class="grow"><div class="name ell" title=${r.label}>${r.label}</div>
      <div class="sub">ברירת מחדל: ${defaultLabel(r)}${r.hint ? html` · ${r.hint}` : nothing}${changed && !off ? html` <button type="button" class="reset" data-reset=${r.key}
        @click=${() => void this.save({ [r.key]: def } as Partial<CalSettings>)}>איפוס</button>` : nothing}</div></div><div class="ctl">${ctl}</div></div>`;
  }

  // ---------------------------------------------------------------- tab: approval per calendar (D6)

  private approvalTab() {
    const list = this.cals.filter((c) => c.type === 'room' || c.type === 'team' || c.type === 'event');
    const p = pageOf(list, this.page, this.per);
    const scope = (this.s as CalSettings).override_scope;
    const inst = (this.s as CalSettings).maintenance_overlap;
    const modes = (['first_holds', 'override_notify', 'block', 'ask'] as OverlapMode[]).filter((m) => scope === 'both' || STRICTNESS[m] >= STRICTNESS[inst]);
    const canRow = (c: Calendar) => this.canEdit || c.my_role === 'manage';
    if (!list.length) return html`<h2>אישור לכל יומן</h2><sw-state-panel icon="calendar" state="empty" compact heading="אין עדיין יומנים" hint="יומן נוצר בלשונית ניהול יומנים."></sw-state-panel>`;
    if (this.phone) {
      return html`<h2>אישור לכל יומן</h2>
        <div class="fitbox"><div class="grid" data-fit="66" data-calset-rows>${p.items.map((c) => html`<div class="row" data-approval=${c.id}><span class="dot" style=${`--h:${colorVar(c.color)}`}></span>
          <div class="grow"><div class="name ell">${c.name}</div><div class="sub ell">${APPROVAL_LABEL[c.approval_mode]}</div></div>
          <sw-toggle label=${`אישור ב${c.name}`} labelHidden ?checked=${c.approval_mode !== 'none'} ?disabled=${!canRow(c)} @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patchCal(c, { approval_mode: e.detail.checked ? 'always' : 'none' })}></sw-toggle></div>`)}</div></div>
        ${this.pager(p.page, p.pages)}`;
    }
    return html`<h2>אישור לכל יומן</h2><p class="lead">ברירת המחדל: ללא אישור. כשמדליקים, מנהל היומן מאשר או דוחה. כל שינוי נשמר מיד.</p>
      <div class="fitbox"><div class="grid" data-fit="51" data-calset-rows><table class="t"><thead><tr><th>יומן</th><th>מנהל</th><th>מתי צריך אישור</th><th>מבטל אם לא הוחלט</th><th>תחזוקה מעל הזמנה</th></tr></thead><tbody>
      ${p.items.map((c) => html`<tr data-approval=${c.id}><td><span class="cname"><span class="dot" style=${`--h:${colorVar(c.color)}`}></span><span class="n ell" title=${c.name}>${c.name}</span></span></td>
        <td>${c.owner.name ? html`<span class="ell">${c.owner.name}</span>` : html`<span class="chip warn">חסר</span>`}</td>
        <td><span class="selw"><select class="inp" aria-label=${`מתי צריך אישור ב${c.name}`} ?disabled=${!canRow(c)} data-approval-mode @change=${(e: Event) => void this.patchCal(c, { approval_mode: (e.target as HTMLSelectElement).value })}>
          ${(Object.keys(APPROVAL_LABEL) as Calendar['approval_mode'][]).map((m) => html`<option value=${m} ?selected=${c.approval_mode === m}>${APPROVAL_LABEL[m]}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span></td>
        <td>${c.approval_mode === 'none' ? html`<span class="muted">—</span>` : html`<span class="selw"><select class="inp num" aria-label=${`זמן ההחלטה ב${c.name}`} ?disabled=${!canRow(c)}
          @change=${(e: Event) => void this.patchCal(c, { approval_timeout_h: Number((e.target as HTMLSelectElement).value) })}>
          ${[0, 1, 2, 4, 12, 24, 48].map((h) => html`<option value=${h} ?selected=${(c.approval_timeout_h ?? 0) === h}>${h ? `${h} שע׳ לפני` : 'בתחילת המועד'}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>`}</td>
        <td>${c.type !== 'room' ? html`<span class="muted">—</span>` : scope === 'none' ? html`<span class="muted">לפי ההתקנה</span>` : html`<span class="selw"><select class="inp" aria-label=${`תחזוקה מעל הזמנה ב${c.name}`} ?disabled=${!canRow(c)}
          @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.patchCal(c, { overlap_override: v || null }); }}>
          <option value="" ?selected=${!c.overlap_override}>לפי ההתקנה</option>${modes.map((m) => html`<option value=${m} ?selected=${c.overlap_override === m}>${OVERLAP_SHORT[m]}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>`}</td></tr>`)}
      </tbody></table></div></div>${this.pager(p.page, p.pages)}`;
  }

  private async patchCal(c: Calendar, body: Record<string, unknown>): Promise<void> {
    if (!this.api) return;
    this.saveError = '';
    try {
      const r = await this.api.patchCalendar(c.id, { revision: c.revision, ...body });
      this.cals = this.cals.map((x) => (x.id === c.id ? { ...x, ...r.calendar } : x));
    } catch (e) {
      this.saveError = describeError(e);
      this.cals = [...this.cals];
    }
  }

  // ---------------------------------------------------------------- tab: permissions (contract section 6)

  private permTab() {
    const PERMS: [string, string, boolean][] = [
      ['יומנים: צפייה', 'צופה ומעלה', false], ['יומנים: יצירת הזמנות', 'מפעיל ומעלה', false], ['יומנים: הזמנה בשם צוות, חוג או לקוח', 'מנהל אתר, מנהל מערכת', false],
      ['יומנים: חלונות תחזוקה', 'מנהל אתר, מנהל מערכת', true], ['יומנים: פרטי אורחים (שם וטלפון)', 'מנהל מערכת, ומנהל היומן ביומן שלו', true],
      ['יומנים: חיבור יומנים חיצוניים', 'מנהל מערכת, ומי שהבעלים מעניק לו', true], ['יומנים: הגדרות', 'מנהל מערכת', true],
    ];
    const p = pageOf(this.cals, this.page, this.per);
    return html`<h2>הרשאות</h2><p class="lead">לכל יומן תפקידים משלו. התפקיד ביומן לא נותן יותר מההרשאות של המשתמש במערכת.</p>
      <div class="rolechips">${(['view', 'book', 'edit', 'manage'] as const).map((r) => html`<div class="row"><b class="name">${ROLE_LABEL[r]}</b><span class="sub">${ROLE_HINT[r]}</span></div>`)}</div>
      <div class="twocol" style="flex:1;min-block-size:0">
        <div class="col"><h3>תפקידים לכל יומן</h3>
          <div class="fitbox"><div class="grid" data-fit="66" data-calset-rows>${p.items.map((c) => html`<a class="row linkrow" href=${`#/calendars/manage/${encodeURIComponent(c.id)}`} data-perm-cal=${c.id}>
            <span class="dot" style=${`--h:${colorVar(c.color)}`}></span><div class="grow"><div class="name ell" title=${c.name}>${c.name}</div><div class="sub ell">${TYPE_LABEL[c.type]} · מנהל: ${c.owner.name || 'חסר'}${c.my_role ? ` · שלך: ${ROLE_LABEL[c.my_role]}` : ''}</div></div>
            <span class="chip acc">חברים ותפקידים</span></a>`)}</div></div>${this.pager(p.page, p.pages)}</div>
        <div class="col wide-only"><h3>הרשאות במערכת שהתפקיד ביומן נשען עליהן</h3>
          <table class="t"><thead><tr><th>הרשאה</th><th>מי מחזיק כברירת מחדל</th><th>רגישה</th></tr></thead><tbody>
          ${PERMS.map(([a, b, sens]) => html`<tr><td><span class="n">${a}</span></td><td>${b}</td><td>${sens ? html`<span class="chip warn">רגישה</span>` : html`<span class="muted">—</span>`}</td></tr>`)}
          </tbody></table><p class="lead">את ההרשאות עצמן נותנים בהגדרות ‹ משתמשים והרשאות.</p></div>
      </div>`;
  }

  // ---------------------------------------------------------------- tab: guest details (D10 / C4, owner answer 24)

  private retentionTab() {
    const s = this.s as CalSettings;
    const days = this.draftRetention ?? s.guest_retention_days;
    const dirty = this.draftRetention !== null && this.draftRetention !== s.guest_retention_days;
    const set = (x: number) => (this.draftRetention = Math.min(3650, Math.max(0, Math.round(x || 0))));
    const off = !this.canEdit;
    return html`<h2>שם וטלפון של אורחים ולקוחות</h2><p class="lead">נשמרים מוצפנים, לא יוצאים להודעות, לפידים או ליומנים חיצוניים. התווית (למשל "חוג קרמיקה") נשארת.</p>
      <div class="row" data-setting="guest_retention_days"><div class="grow"><div class="name">ימים אחרי המועד האחרון</div><div class="sub">ברירת מחדל 30 · בין 0 ל־3650 · 0 = מחיקה בסיום המועד</div></div>
        <div class="ctl"><span class="stepper"><button type="button" aria-label="פחות" ?disabled=${off || days <= 0} @click=${() => set(days - 1)}>−</button>
          <input type="number" inputmode="numeric" aria-label="ימי שמירה" data-retention .value=${String(days)} min="0" max="3650" ?disabled=${off} @change=${(e: Event) => set(Number((e.target as HTMLInputElement).value))}>
          <button type="button" aria-label="יותר" ?disabled=${off || days >= 3650} @click=${() => set(days + 1)}>+</button></span>
          ${dirty ? html`<button type="button" class="btn pri sm" data-retention-save @click=${() => this.saveRetention()}>שמירה</button>` : nothing}</div></div>
      ${this.settingRow({ key: 'guest_details_enabled', label: 'לאפשר פרטי אורח בהזמנות', kind: 'tog', hint: 'בכל הזמנה בשם מישהו אחר' })}
      <div class="row wide-only"><div class="grow"><div class="name">המחיקה האוטומטית</div><div class="sub">רצה פעם בשעה לכל היותר ונרשמת ביומן הפעולות (מספרים בלבד)</div></div><span class="chip ok">פעיל</span></div>
      <div class="banner"><sw-icon name="warning" size="18"></sw-icon><div><b>הקטנת המספר מוחקת מוקדם יותר</b><span class="muted">לפני השמירה תתבקש לאשר; אחריה תוצג כמות הרשומות שיימחקו בהרצה הבאה.</span></div></div>
      <div class="row danger"><div class="grow"><div class="name">מחיקת כל פרטי האורחים עכשיו</div><div class="sub">בלתי הפיך. נרשם ביומן הפעולות (מספרים בלבד).</div></div>
        <button type="button" class="btn bad sm" data-purge ?disabled=${off} @click=${() => { this.typed = ''; this.confirm = 'purge'; }}><sw-icon name="trash" size="14"></sw-icon>מחיקה…</button></div>`;
  }

  private saveRetention(): void {
    const s = this.s as CalSettings;
    if (this.draftRetention === null) return;
    if (this.draftRetention < s.guest_retention_days) {
      this.confirm = 'retention';
      return;
    }
    void this.commitRetention();
  }

  private async commitRetention(): Promise<void> {
    const v = this.draftRetention;
    this.confirm = null;
    if (v === null) return;
    const n = await this.save({ guest_retention_days: v });
    this.draftRetention = null;
    if (!this.saveError) this.toast(n ? `${n.toLocaleString('he-IL')} רשומות יימחקו בהרצה הבאה` : 'נשמר');
  }

  private async purge(): Promise<void> {
    if (!this.api) return;
    this.confirm = null;
    try {
      const r = await this.api.purgeGuests();
      this.toast(`נמחקו פרטי אורחים מ־${r.erased.toLocaleString('he-IL')} רשומות`);
    } catch (e) {
      this.saveError = describeError(e);
    }
  }

  private dialogs() {
    const word = (this.s as CalSettings).purge_confirm !== 'one_click';
    if (this.confirm === 'retention') {
      return html`<sw-dialog open heading="להקטין את זמן השמירה?" data-retention-confirm @close=${() => (this.confirm = null)}><div class="dlg"><p>פרטי אורחים יימחקו מוקדם יותר: רשומות שהמועד שלהן הסתיים לפני יותר
        מ־<b class="num">${this.draftRetention}</b> ימים יימחקו בהרצה הבאה.</p></div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button>
        <button slot="footer" type="button" class="btn pri" data-confirm-ok @click=${() => void this.commitRetention()}>שמירה</button></sw-dialog>`;
    }
    if (this.confirm === 'purge') {
      const ok = !word || this.typed.trim() === 'מחיקה';
      return html`<sw-dialog open heading="למחוק את כל פרטי האורחים?" data-purge-confirm @close=${() => (this.confirm = null)}><div class="dlg"><p>השמות ומספרי הטלפון של כל האורחים יימחקו עכשיו. התוויות נשארות. אי אפשר לבטל.</p>
        ${word ? html`<label class="typed"><span class="lbl">כדי לאשר, יש להקליד "מחיקה"</span><input class="inp" data-purge-word autocomplete="off" .value=${this.typed} @input=${(e: Event) => (this.typed = (e.target as HTMLInputElement).value)}></label>` : nothing}</div>
        <button slot="footer" type="button" class="btn" @click=${() => (this.confirm = null)}>ביטול</button>
        <button slot="footer" type="button" class="btn bad fill" data-purge-ok ?disabled=${!ok} @click=${() => void this.purge()}>מחיקה</button></sw-dialog>`;
    }
    return nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-calendars': SystemCalendars;
  }
}
