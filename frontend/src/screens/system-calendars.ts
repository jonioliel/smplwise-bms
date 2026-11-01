import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { calendarsApi, type CalSettings, type Calendar, type CalendarsApi, type OverlapMode } from '../api/calendars';
import type { RouteState } from '../router';
import { refreshCalendars } from '../calendars/access';
import { APPROVAL_LABEL, OVERLAP_LABEL, OVERLAP_SHORT, ROLE_HINT, ROLE_LABEL, STRICTNESS, TYPE_LABEL, colorVar, pageOf, rowsThatFit } from '../calendars/model';
import { calCss } from '../calendars/styles';
import { leadReserveStyles } from '../styles/lead-reserve';

type Tab = 'overlap' | 'behavior' | 'approval' | 'perm' | 'retention';
const TABS: [Tab, string, string][] = [['overlap', 'חפיפת תחזוקה', 'חפיפה'], ['behavior', 'התנהגות', 'התנהגות'], ['approval', 'אישור לכל יומן', 'אישור'], ['perm', 'הרשאות', 'הרשאות'], ['retention', 'פרטי אורחים', 'אורחים']];

/** The server's defaults (smplwise/services/calendar/model.py SETTINGS_DEFAULTS) - the "ברירת מחדל" under every row and its reset. */
export const CAL_DEFAULTS: Partial<CalSettings> = {
  maintenance_overlap: 'first_holds', contested_requests: 'queue', pending_holds_slot: false, menu_position: 'rail', holiday_eve_as_holiday: false, guest_details_enabled: true,
  guest_retention_days: 30, editors_bypass_approval: true, default_room_buffer_after_min: 10, series_horizon_days: 400, max_calendars: 500, notify_confirmations: false,
  contested_order: 'first_come', allow_displace: true, displace_approver: 'calendar_manager', override_scope: 'both', phone_time_picker: 'grid', reauth_mode: 'reauth_and_continue',
  sync_conflict_display: 'side_by_side', tablet_panels: 'collapse', resident_pending_display: 'count', resident_cancel_until: 'start', resident_rooms: 'bookable',
  purge_confirm: 'type_word', loading_style: 'skeleton', default_approval_timeout_h: 2, reopen_days: 7, sync_external_delete: 'cancel',
};

type Opt = [value: string | boolean, label: string];
export interface SettingRow { key: keyof CalSettings | 'displaced'; label: string; kind: 'seg' | 'tog' | 'step'; opts?: Opt[]; min?: number; max?: number; step?: number; unit?: string; hint?: string; static?: boolean }

/** Every behaviour of the module is a setting (owner rule); the rows of the "התנהגות" tab, in the mock-up's order, then the answers of 30.10. */
export const BEHAVIOR_ROWS: SettingRow[] = [
  { key: 'menu_position', label: 'מיקום "יומנים" בתפריט', kind: 'seg', opts: [['rail', 'סרגל צד'], ['home_tab', 'לשונית בראשי'], ['both', 'שניהם']], hint: 'דייר עם יומנים בלבד מקבל תמיד כפתור משלו' },
  { key: 'holiday_eve_as_holiday', label: 'ערב חג', kind: 'seg', opts: [[false, 'יום רגיל'], [true, 'כמו חג']] },
  { key: 'editors_bypass_approval', label: 'מנהלים ועורכים לא צריכים אישור ביומן שלהם', kind: 'tog' },
  { key: 'notify_confirmations', label: 'הודעת אישור למארגן כשאין צורך באישור', kind: 'tog' },
  { key: 'default_room_buffer_after_min', label: 'הפסקה אחרי הזמנת חדר', kind: 'step', min: 0, max: 240, step: 5, unit: 'דק׳' },
  { key: 'default_approval_timeout_h', label: 'בקשה שלא הוחלטה פגה לפני ההתחלה', kind: 'step', min: 0, max: 720, step: 1, unit: 'שע׳', hint: 'ליומן חדש' },
  { key: 'reopen_days', label: 'פתיחה מחדש של בקשה שנדחתה', kind: 'step', min: 0, max: 60, step: 1, unit: 'ימים' },
  { key: 'resident_cancel_until', label: 'דייר יכול לבטל עד', kind: 'seg', opts: [['start', 'תחילה'], ['1h', 'שעה לפני'], ['24h', '24 שע׳']] },
  { key: 'displaced', label: 'הזמנה שנדחקה', kind: 'seg', opts: [['organizer', 'המארגן בוחר'], ['auto', 'הזזה אוטומטית']], static: true, hint: 'הזזה אוטומטית לא נבנתה' },
  { key: 'series_horizon_days', label: 'טווח פריסת סדרות', kind: 'step', min: 30, max: 800, step: 10, unit: 'יום' },
  { key: 'max_calendars', label: 'מספר יומנים מרבי', kind: 'step', min: 1, max: 2000, step: 10 },
  { key: 'contested_order', label: 'עדיפות כשבקשות מתחרות', kind: 'seg', opts: [['first_come', 'סדר הגעה'], ['manual', 'מנהל מחליט'], ['by_kind', 'לפי סוג']] },
  { key: 'allow_displace', label: 'אישור בקשה מעל הזמנה מאושרת (דחיקה)', kind: 'tog', hint: 'כבוי: רק לדחות את הבקשות' },
  { key: 'displace_approver', label: 'מי רשאי לדחוק הזמנה מאושרת', kind: 'seg', opts: [['calendar_manager', 'מנהל היומן'], ['any_manager', 'כל מנהל']] },
  { key: 'resident_pending_display', label: 'שעה עם בקשות ממתינות, אצל הדייר', kind: 'seg', opts: [['count', '"2 מבקשים"'], ['free', 'רק "פנוי"'], ['blocked', 'חסומה']] },
  { key: 'resident_rooms', label: 'חדרים במסך ההזמנה של הדייר', kind: 'seg', opts: [['bookable', 'רק שמותר לו'], ['all_busy', 'כולם, השאר "תפוס"']] },
  { key: 'phone_time_picker', label: 'בחירת שעה בטלפון', kind: 'seg', opts: [['grid', 'רשת שעות'], ['timeline', 'פס זמן']] },
  { key: 'tablet_panels', label: 'טאבלט 1024: לוחות צד', kind: 'seg', opts: [['collapse', 'נפתחים בלחיצה'], ['shrink', 'מוקטנים']] },
  { key: 'sync_conflict_display', label: 'התנגשות מסנכרון בתצוגת השבוע', kind: 'seg', opts: [['side_by_side', 'זו לצד זו'], ['list_only', 'רק ברשימה']] },
  { key: 'reauth_mode', label: 'חיבור שדורש הרשאה מחדש', kind: 'seg', opts: [['reauth_and_continue', 'הרשאה + "המשך"'], ['reauth_only', 'הרשאה בלבד']] },
  { key: 'purge_confirm', label: 'אישור "מחיקת כל פרטי האורחים"', kind: 'seg', opts: [['type_word', 'הקלדת "מחיקה"'], ['one_click', 'לחיצה בחלון']] },
  { key: 'loading_style', label: 'טעינה', kind: 'seg', opts: [['skeleton', 'שלד'], ['spinner', 'סמל מסתובב']] },
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
  static styles = [calCss, leadReserveStyles, css`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 12px; overflow: hidden; }
    h1 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .head { display: flex; align-items: center; gap: 10px 16px; flex-wrap: wrap; padding-inline-end: var(--sw-float-reserve, 0px); }
    .modsw { display: inline-flex; align-items: center; gap: 10px; font-size: var(--sw-fs-md); color: var(--sw-text-2); }
    .panel { flex: 1; }
    .tabs { align-self: flex-start; flex: none; }
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
      :host { padding: 10px var(--sw-page-pad-phone); gap: 10px; }
      .panel { padding: 12px; gap: 10px; }
      .twocol { grid-template-columns: minmax(0, 1fr); gap: 12px; align-content: start; }
      .col { gap: 5px; }
      .opt { padding: 9px 12px; align-items: center; }
      .opt small { display: none; }
      .opt .rad { margin-block-start: 0; }
      .wide-only { display: none; }
      .tabs { align-self: stretch; }
      .tabs button { flex: 1; padding: 6px 2px; }
      .row .ctl { inline-size: 100%; }
      .row .seg { flex-wrap: wrap; border-radius: var(--sw-r-lg); }
      .lead { display: none; }
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
  private api: CalendarsApi | null = null;
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
    const rows = box.querySelector('tbody') ? [...box.querySelectorAll('tbody tr')] : [...box.children];
    const tallest = Math.max(0, ...rows.map((c) => (c as HTMLElement).offsetHeight + (box.querySelector('tbody') ? 0 : 8)));
    const rowH = Math.max(Number(box.dataset.fit) || 66, tallest, this.fitRowH);
    this.fitRowH = rowH;
    const per = cols * rowsThatFit(box.clientHeight + 8, rowH);
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
    if (this.error) return html`<sw-state-panel state="error" data-calset-state="error" heading="לא הצלחנו לטעון את הגדרות היומנים" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.load()}></sw-state-panel>`;
    if (!this.s) return html`<div class="panel" data-calset-state="loading" role="status" aria-label="טוען">${[0, 1, 2, 3].map(() => html`<div class="skel" style="block-size:56px"></div>`)}</div>`;
    const tab = this.tab;
    return html`
      <div class="head lead-head">
        <h1>יומנים</h1><span class="sp"></span>
        <label class="modsw"><span>מודול היומנים</span><sw-toggle data-calset="enabled" label="מודול היומנים פעיל" labelHidden ?checked=${this.s.enabled} ?disabled=${!this.canEdit}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.save({ enabled: e.detail.checked })}></sw-toggle><b>${this.s.enabled ? 'פעיל' : 'כבוי'}</b></label>
      </div>
      ${this.canEdit ? nothing : html`<div class="ro" data-calset-ro>צפייה בלבד: שינוי ההגדרות דורש את ההרשאה "יומנים: הגדרות".</div>`}
      ${this.saveError ? html`<div class="err" role="alert" data-calset-error>${this.saveError}</div>` : nothing}
      <section class="panel" data-calset-tab=${tab}>
        <div class="seg tabs" role="tablist" aria-label="הגדרות היומנים">${TABS.map(([id, he, short]) => html`<button type="button" role="tab" aria-pressed=${String(tab === id)} aria-selected=${String(tab === id)}
          data-calset-tabbtn=${id} @click=${() => (location.hash = `#/system/calendars?tab=${id}`)}>${this.phone ? short : he}</button>`)}</div>
        ${tab === 'overlap' ? this.overlapTab() : tab === 'behavior' ? this.behaviorTab() : tab === 'approval' ? this.approvalTab() : tab === 'perm' ? this.permTab() : this.retentionTab()}
      </section>
      ${this.dialogs()}
      ${this.toastText ? html`<div class="toast" role="status" data-calset-toast>${this.toastText}</div>` : nothing}`;
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
    const p = pageOf(BEHAVIOR_ROWS, this.page, this.per);
    return html`<h2>התנהגות המודול</h2><p class="lead">כל התנהגות היא הגדרה. ברירת המחדל כתובה מתחת לכל שורה; "איפוס" מחזיר אותה.</p>
      <div class="fitbox"><div class="grid rows2" data-fit="66" data-calset-rows>${p.items.map((r) => this.settingRow(r))}</div></div>
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
        <td><select class="inp" aria-label=${`מתי צריך אישור ב${c.name}`} ?disabled=${!canRow(c)} data-approval-mode @change=${(e: Event) => void this.patchCal(c, { approval_mode: (e.target as HTMLSelectElement).value })}>
          ${(Object.keys(APPROVAL_LABEL) as Calendar['approval_mode'][]).map((m) => html`<option value=${m} ?selected=${c.approval_mode === m}>${APPROVAL_LABEL[m]}</option>`)}</select></td>
        <td>${c.approval_mode === 'none' ? html`<span class="muted">—</span>` : html`<select class="inp num" aria-label=${`זמן ההחלטה ב${c.name}`} ?disabled=${!canRow(c)}
          @change=${(e: Event) => void this.patchCal(c, { approval_timeout_h: Number((e.target as HTMLSelectElement).value) })}>
          ${[0, 1, 2, 4, 12, 24, 48].map((h) => html`<option value=${h} ?selected=${(c.approval_timeout_h ?? 0) === h}>${h ? `${h} שע׳ לפני` : 'בתחילת המועד'}</option>`)}</select>`}</td>
        <td>${c.type !== 'room' ? html`<span class="muted">—</span>` : scope === 'none' ? html`<span class="muted">לפי ההתקנה</span>` : html`<select class="inp" aria-label=${`תחזוקה מעל הזמנה ב${c.name}`} ?disabled=${!canRow(c)}
          @change=${(e: Event) => { const v = (e.target as HTMLSelectElement).value; void this.patchCal(c, { overlap_override: v || null }); }}>
          <option value="" ?selected=${!c.overlap_override}>לפי ההתקנה</option>${modes.map((m) => html`<option value=${m} ?selected=${c.overlap_override === m}>${OVERLAP_SHORT[m]}</option>`)}</select>`}</td></tr>`)}
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
