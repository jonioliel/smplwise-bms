import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { calendarsApi, type CalendarsApi, type Calendar } from '../api/calendars';
import { getDevicesTree } from '../api/devices';
import { isApi } from '../api/session';
import type { RouteState } from '../router';
import { calendarsBase, CALENDARS_SETTINGS_HREF } from '../shell/nav';
import { calAccess, onCalAccess, refreshCalendars, type CalAccess } from './access';
import { CAL_EVENTS, CAL_VIEWS, type CalCtx, type CalView, type NewEventDetail, type NewMaintDetail } from './ctx';
import { calCss } from './styles';
import './view-calendar';
import './view-rooms';
import './event-drawer';
import './view-approvals';
import './view-maint';
import './maint-drawer';
import './view-manage';
import './resident';

const TAB_LABEL: Record<CalView, string> = { cal: 'יומן', rooms: 'חדרים לפי שעות', approvals: 'אישורים', maint: 'תחזוקה', manage: 'ניהול יומנים' };
const TAB_SHORT: Record<CalView, string> = { cal: 'יומן', rooms: 'חדרים', approvals: 'אישורים', maint: 'תחזוקה', manage: 'ניהול' };

/**
 * CALENDARS-UI-2310: "יומנים" - the module's page (the approved round-8 mock-up). The head (title, floor chips), the view tabs (יומן · חדרים לפי
 * שעות · אישורים · תחזוקה · ניהול יומנים, each offered by the viewer's rights), the search and "חדש"; below, one view that fills the rest of
 * the screen without a page scroll (owner rule 2026-10-24: views page instead). On the phone a viewer without a managing right gets the
 * resident flow (הזמנת חדר · ההזמנות שלי). The module off, no right, loading (skeleton after 300 ms, or the spinner - owner answer 26 as a
 * setting), error and "no calendar yet" are their own states.
 */
@customElement('calendars-page')
export class CalendarsPage extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; flex-direction: column; min-block-size: 0; flex: 1; padding: 14px var(--sw-page-pad) 20px; gap: 14px; overflow: hidden; }
    .top { display: flex; align-items: center; gap: 10px 14px; flex-wrap: wrap; padding-inline-start: var(--sw-lead-reserve, 0px); padding-inline-end: var(--sw-float-reserve, 0px); }
    .top h1 { margin: 0; font-size: var(--sw-h1); font-weight: var(--sw-h1-weight); letter-spacing: var(--sw-h1-tracking); color: var(--sw-heading); line-height: 1.2; }
    .floors { display: flex; gap: 8px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; }
    .bar { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
    .tabs { display: inline-flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); max-inline-size: 100%; overflow: hidden; }
    .tab { font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); padding: 0 14px; min-block-size: 34px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; text-decoration: none; -webkit-tap-highlight-color: transparent; }
    .tab[aria-current='page'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .tab .n { color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .search { display: inline-flex; align-items: center; gap: 8px; min-block-size: var(--sw-ctl-h-lg); padding: 0 14px; border-radius: var(--sw-r-pill); border: 1px solid var(--sw-border);
      background: var(--sw-surface-solid); inline-size: 220px; max-inline-size: 100%; }
    .search input { font: inherit; font-size: var(--sw-fs-md); border: 0; outline: 0; background: transparent; color: var(--sw-text); min-inline-size: 0; flex: 1; }
    .body { flex: 1; min-block-size: 0; display: flex; flex-direction: column; }
    .body > * { flex: 1; min-block-size: 0; }
    .loading { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 14px; flex: 1; min-block-size: 0; }
    .loading .panel { gap: 10px; }
    .center { display: grid; place-items: center; flex: 1; }
    .toast { position: fixed; inset-block-end: 24px; inset-inline-start: 50%; transform: translateX(50%); background: var(--sw-toast-bg); color: var(--sw-toast-text); padding: 10px 16px;
      border-radius: var(--sw-r-pill); font-size: var(--sw-fs-md); z-index: var(--sw-z-toast); box-shadow: var(--sw-shadow-3); max-inline-size: calc(100vw - 32px); }
    @media (max-width: 1179px) { .loading { grid-template-columns: minmax(0, 1fr); } .loading .side { display: none; } }
    @media (max-width: 699px) {
      :host { padding: 10px var(--sw-page-pad-phone) 10px; gap: 10px; }
      .top h1 { font-size: var(--sw-fs-2xl); }
      .bar { gap: 8px; }
      .tabs { inline-size: 100%; }
      .tab { flex: 1; justify-content: center; padding: 0 6px; font-size: var(--sw-fs-sm); }
      .search { display: none; }
      .new { margin-inline-start: auto; }
      .toast { inset-block-end: calc(var(--sw-bottomnav-h) + 16px + env(safe-area-inset-bottom)); }
    }
  `];

  @property({ attribute: false }) route: RouteState | null = null;
  @state() private access: CalAccess = calAccess();
  @state() private cals: Calendar[] | null = null;
  @state() private error = '';
  @state() private floor = '';
  @state() private q = '';
  @state() private floorNames: Record<string, string> = {};
  @state() private slow = false;
  @state() private device: CalCtx['device'] = 'desktop';
  @state() private drawer: { kind: 'event'; d: NewEventDetail } | { kind: 'maint'; d: NewMaintDetail } | null = null;
  @state() private toastText = '';
  private api: CalendarsApi | null = null;
  private stop: (() => void) | null = null;
  private slowTimer = 0;
  private toastTimer = 0;
  private onResize = () => this.measure();

  connectedCallback(): void {
    super.connectedCallback();
    this.measure();
    window.addEventListener('resize', this.onResize);
    this.stop = onCalAccess((a) => (this.access = a));
    // always re-read the module state on open (one shared request): rights or settings changed elsewhere since the navigation read it
    void refreshCalendars();
    void this.load();
    this.addEventListener(CAL_EVENTS.newEvent, (e: Event) => (this.drawer = { kind: 'event', d: (e as CustomEvent<NewEventDetail>).detail ?? {} }));
    this.addEventListener(CAL_EVENTS.newMaint, (e: Event) => (this.drawer = { kind: 'maint', d: (e as CustomEvent<NewMaintDetail>).detail ?? {} }));
    this.addEventListener(CAL_EVENTS.changed, () => void this.load(true));
    this.addEventListener(CAL_EVENTS.toast, (e: Event) => this.toast((e as CustomEvent<string>).detail));
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onResize);
    this.stop?.();
    clearTimeout(this.slowTimer);
    clearTimeout(this.toastTimer);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    // a view tab or a hash parameter of the demo changed: the data may differ (data=worst / empty / error)
    const old = changed.get('route') as RouteState | undefined;
    if (changed.has('route') && old && old.params.toString() !== this.route?.params.toString()) {
      if (old.params.get('role') !== this.route?.params.get('role')) void refreshCalendars(); // the demo's role decides the rights
      void this.load();
    }
  }

  private measure(): void {
    const w = window.innerWidth;
    this.device = w < 700 ? 'phone' : w < 1180 ? 'tablet' : 'desktop';
  }

  private async load(quiet = false): Promise<void> {
    if (!quiet) {
      this.error = '';
      this.slow = false;
      clearTimeout(this.slowTimer);
      // owner answer 26A: the skeleton only after 300 ms, so a fast answer never flashes
      this.slowTimer = window.setTimeout(() => (this.slow = true), 300);
    }
    try {
      this.api ??= await calendarsApi();
      const [{ calendars }] = await Promise.all([this.api.calendars(), this.loadFloors()]);
      this.cals = calendars.filter((c) => !c.archived);
      this.error = '';
    } catch (e) {
      if (!quiet) this.cals = null;
      this.error = describeError(e);
    } finally {
      clearTimeout(this.slowTimer);
    }
  }

  private async loadFloors(): Promise<void> {
    if (!isApi() || Object.keys(this.floorNames).length) return;
    try {
      const t = await getDevicesTree();
      this.floorNames = Object.fromEntries((t.floors ?? []).map((f) => [f.floor_id, f.name]));
    } catch {
      /* the chips fall back to the names the calendars carry */
    }
  }

  private toast(text: string): void {
    this.toastText = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toastText = ''), 3200);
  }

  private get view(): CalView {
    const s = this.route?.segments ?? [];
    const v = (this.route?.mode === 'devices' ? s[2] : s[1]) as CalView | undefined;
    return v && CAL_VIEWS.includes(v) ? v : 'cal';
  }

  private get sub(): string {
    const s = this.route?.segments ?? [];
    return decodeURIComponent((this.route?.mode === 'devices' ? s[3] : s[2]) ?? '');
  }

  private manages(): boolean {
    return (this.cals ?? []).some((c) => c.my_role === 'manage');
  }

  private offered(v: CalView): boolean {
    const can = this.access.can;
    if (v === 'approvals') return this.manages();
    if (v === 'maint') return can.maintenance;
    if (v === 'manage') return can.manage || this.manages();
    return true;
  }

  private ctx(): CalCtx {
    return { api: this.api as CalendarsApi, access: this.access, cals: this.cals ?? [], floor: this.floor, q: this.q, base: calendarsBase(this.route), sub: this.sub, now: new Date(),
      device: this.device, manages: this.manages() };
  }

  private floors(): { id: string; name: string }[] {
    const seen = new Map<string, string>();
    for (const c of this.cals ?? []) if (c.floor_id && !seen.has(c.floor_id)) seen.set(c.floor_id, this.floorNames[c.floor_id] ?? c.floor_name ?? c.floor_id);
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'he'));
  }

  render() {
    const a = this.access;
    if (a.enabled === false && isApi()) {
      return html`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="off" heading="מודול היומנים כבוי"
        hint=${a.can.configure ? 'אפשר להפעיל אותו בהגדרות ‹ יומנים.' : 'מנהל המערכת יכול להפעיל אותו.'} actionLabel=${a.can.configure ? 'להגדרות' : ''}
        @action=${() => (location.hash = CALENDARS_SETTINGS_HREF)}></sw-state-panel></div>`;
    }
    if (a.enabled && !a.can.view) return html`<h1 class="vh">יומנים</h1><div class="center"><sw-state-panel state="forbidden" data-cal-state="forbidden" heading="אין לך גישה ליומנים"></sw-state-panel></div>`;
    const phoneResident = this.device === 'phone' && !!this.cals && !this.manages() && !a.can.manage && !a.can.maintenance;
    return html`
      ${phoneResident ? nothing : this.head()}
      <div class="body" data-cal-body data-view=${this.view}>${this.content(phoneResident)}</div>
      ${this.drawer?.kind === 'event' && this.api ? html`<cal-event-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${() => (this.drawer = null)}></cal-event-drawer>` : nothing}
      ${this.drawer?.kind === 'maint' && this.api ? html`<cal-maint-drawer .ctx=${this.ctx()} .detail=${this.drawer.d} @close=${() => (this.drawer = null)}></cal-maint-drawer>` : nothing}
      ${this.toastText ? html`<div class="toast" role="status" data-cal-toast>${this.toastText}</div>` : nothing}`;
  }

  private head() {
    const floors = this.floors();
    const views = CAL_VIEWS.filter((v) => this.offered(v));
    const base = calendarsBase(this.route);
    const phone = this.device === 'phone';
    const pending = (this.cals ?? []).filter((c) => c.my_role === 'manage').reduce((n, c) => n + c.pending_count, 0);
    return html`
      <div class="top">
        <h1>יומנים</h1><span class="sp"></span>
        ${floors.length > 1 ? html`<div class="floors" role="group" aria-label="קומה">
          <button type="button" class="chipb" aria-pressed=${String(this.floor === '')} data-floor="" @click=${() => (this.floor = '')}>הכל</button>
          ${floors.map((f) => html`<button type="button" class="chipb" aria-pressed=${String(this.floor === f.id)} data-floor=${f.id} @click=${() => (this.floor = f.id)}>${f.name}</button>`)}
        </div>` : nothing}
      </div>
      <div class="bar">
        <nav class="tabs" aria-label="תצוגות היומנים">
          ${views.map((v) => html`<a class="tab" href=${`${base}/${v}${this.demoQuery()}`} aria-current=${this.view === v ? 'page' : 'false'} data-cal-tab=${v}>
            ${phone ? TAB_SHORT[v] : TAB_LABEL[v]}${v === 'approvals' && pending ? html`<span class="count num">${pending > 99 ? '99+' : pending}</span>` : nothing}${v === 'manage' && !phone ? html`<span class="n num">${(this.cals ?? []).length}</span>` : nothing}</a>`)}
        </nav>
        <span class="sp"></span>
        <label class="search"><sw-icon name="search" size="16"></sw-icon><span class="vh">חיפוש ביומנים</span>
          <input type="search" placeholder="חיפוש ביומנים" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} data-cal-search></label>
        ${this.newButton()}
      </div>`;
  }

  /** The demo's hash parameters (data / role / mode) travel with the tabs, so a worst-case screen stays worst-case. */
  private demoQuery(): string {
    if (isApi()) return '';
    const p = this.route?.params.toString() ?? '';
    return p ? `?${p}` : '';
  }

  private newButton() {
    const can = this.access.can;
    if (this.view === 'maint') {
      return can.maintenance ? html`<button type="button" class="btn pri new" data-cal-new @click=${() => (this.drawer = { kind: 'maint', d: {} })}><sw-icon name="plus" size="16"></sw-icon>חלון תחזוקה</button>` : nothing;
    }
    return can.book ? html`<button type="button" class="btn pri new" data-cal-new @click=${() => (this.drawer = { kind: 'event', d: {} })}><sw-icon name="plus" size="16"></sw-icon>חדש</button>` : nothing;
  }

  private content(resident: boolean) {
    if (this.error && !this.cals) {
      return html`<div class="center"><sw-state-panel state="error" data-cal-state="error" heading="לא הצלחנו לטעון את היומנים" hint=${this.error} actionLabel="לנסות שוב"
        @action=${() => void this.load()}></sw-state-panel></div>`;
    }
    if (!this.cals || !this.api) return this.slow ? this.loadingView() : nothing;
    const ctx = this.ctx();
    if (resident) return html`<cal-resident .ctx=${ctx}></cal-resident>`;
    if (!this.cals.length && this.view !== 'manage') {
      return html`<div class="center"><sw-state-panel icon="calendar" state="empty" data-cal-state="empty" heading="אין עדיין יומנים"
        hint=${this.access.can.manage ? 'יומן לכל חדר, צוות, אחזקה או אירועים. אפשר להתחיל מחדר אחד.' : 'כשיוגדר יומן שיש לך בו הרשאה, הוא יופיע כאן.'}
        actionLabel=${this.access.can.manage ? 'יצירת יומן ראשון' : ''} @action=${() => (location.hash = `${calendarsBase(this.route)}/manage${this.demoQuery()}`)}></sw-state-panel></div>`;
    }
    switch (this.view) {
      case 'rooms': return html`<cal-view-rooms .ctx=${ctx}></cal-view-rooms>`;
      case 'approvals': return html`<cal-view-approvals .ctx=${ctx}></cal-view-approvals>`;
      case 'maint': return html`<cal-view-maint .ctx=${ctx}></cal-view-maint>`;
      case 'manage': return html`<cal-view-manage .ctx=${ctx}></cal-view-manage>`;
      default: return html`<cal-view-calendar .ctx=${ctx}></cal-view-calendar>`;
    }
  }

  /** Owner answer 26 as a setting: the skeleton of the page (default) or one spinner. */
  private loadingView() {
    if (this.access.ui.loading_style === 'spinner') return html`<div class="center" data-cal-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`;
    return html`<div class="loading" data-cal-state="loading" role="status" aria-label="טוען">
      <div class="panel">${Array.from({ length: 6 }, (_, i) => html`<div class="skel" style=${`block-size:${i ? 64 : 32}px`}></div>`)}</div>
      <div class="panel side">${Array.from({ length: 8 }, () => html`<div class="skel" style="block-size:22px"></div>`)}</div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendars-page': CalendarsPage;
  }
}
