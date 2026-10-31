import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import type { CalEvent, Calendar, EventPreview, NewEvent, OnBehalfKind, Occurrence } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx, type NewEventDetail } from './ctx';
import { STATE_LABEL, addDays, colorVar, ddmm, hm, isoDate, pad, startOfDay, whenText } from './model';
import { calCss } from './styles';
import { BEHALF_LABEL, localInstant, repeatSummary, rruleOf, type Repeat } from './booking-logic';

/**
 * CALENDARS-UI-2310 slice A: the new / edit booking drawer (the approved round-8 mock-up, screen 4). Permission-aware: an operator books for
 * himself only (the "on behalf" line is locked with the reason); a holder of calendar.book_for_others books on behalf of a team, class,
 * customer, department or vendor, with guest name + phone when the installation allows it (and the retention notice); a calendar's manager
 * needs no approval. The availability bar and the answer of POST /calendar/events/preview say before saving whether the time is free in
 * every occurrence and whether the request goes to approval (a request does not hold the time: the first approved wins, owner C2). An
 * existing entry opens read-only with cancel / withdraw. The server decides everything; errors 409 / 422 are shown in place.
 */
@customElement('cal-event-drawer')
export class CalEventDrawer extends LitElement {
  static styles = [calCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); animation: fade var(--sw-t-med) var(--sw-ease); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: slide 240ms var(--sw-ease-drawer); }
    @keyframes slide { from { transform: translateX(100%); } }
    @keyframes fade { from { opacity: 0; } }
    :host-context([dir='ltr']) aside { animation-name: slide-l; }
    @keyframes slide-l { from { transform: translateX(-100%); } }
    @media (prefers-reduced-motion: reduce) { aside, .scrim { animation: none; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    header .muted { margin-block-start: 2px; }
    header .x { margin-inline-start: auto; flex: none; }
    .body { flex: 1; min-block-size: 0; padding: 4px 22px 12px; display: flex; flex-direction: column; gap: 10px; overflow: hidden; }
    footer { display: flex; gap: 10px; padding: 12px 22px calc(16px + env(safe-area-inset-bottom, 0px)); border-block-start: 1px solid var(--sw-border); align-items: center; }
    .lockline { display: flex; align-items: center; gap: 8px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); padding: 8px 12px; border-radius: var(--sw-r-md);
      background: var(--sw-surface-3); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; align-items: center; }
    .ctls > .inp { flex: 1; }
    .ctls > .short { flex: 0 0 104px; }
    .selrow { position: relative; display: flex; align-items: center; }
    .selrow .dot { position: absolute; inset-inline-start: 12px; pointer-events: none; }
    .selrow select { padding-inline-start: 30px; }
    .selrow sw-icon { position: absolute; inset-inline-end: 10px; color: var(--sw-text-3); pointer-events: none; }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .hint.ok { color: var(--sw-success-text); }
    .hint.bad { color: var(--sw-danger-text); }
    .hint.warn { color: var(--sw-warning-text); }
    .mini { position: relative; direction: ltr; block-size: 26px; border-radius: var(--sw-r-sm); background: var(--sw-surface-2); overflow: hidden; }
    .mini .busy { position: absolute; inset-block: 4px; border-radius: var(--sw-r-2xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .mini .busy[data-mark='pending'] { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .mini .slot { position: absolute; inset-block: 2px; border-radius: var(--sw-r-2xs); background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mini .slot.clash { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .scale { display: flex; justify-content: space-between; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .sugg { display: flex; gap: 6px; flex-wrap: wrap; }
    .sugg button { font: inherit; min-block-size: 30px; padding-inline: 12px; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text); border: 0;
      font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); cursor: pointer; }
    .col { display: flex; flex-direction: column; gap: 6px; min-inline-size: 0; }
    .fld.top { align-items: start; }
    .fld.top > .lbl, .fld.top > label { padding-block-start: 10px; }
    .note sw-icon { flex: none; color: var(--sw-accent-text); margin-block-start: 2px; }
    .note.warn sw-icon { color: var(--sw-warning-text); }
    .note.bad sw-icon { color: var(--sw-danger-text); }
    .note .muted { display: block; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    dl { margin: 0; display: grid; grid-template-columns: 96px minmax(0, 1fr); gap: 10px 14px; font-size: var(--sw-fs-md); }
    dt { font-weight: var(--sw-fw-semibold); color: var(--sw-heading); }
    dd { margin: 0; min-inline-size: 0; overflow-wrap: anywhere; color: var(--sw-text); }
    input[type='date'], input[type='time'] { font-variant-numeric: tabular-nums; }
    @media (max-width: 699px) {
      aside { inline-size: 100vw; }
      header { padding: 14px 16px 6px; }
      header h2 { font-size: var(--sw-fs-xl); }
      .body { padding: 4px 16px 10px; gap: 8px; overflow-y: auto; overscroll-behavior: contain; }
      footer { padding-inline: 16px; }
      .ctls { flex-wrap: wrap; }
      .ctls > .inp { flex: 1 1 120px; }
      .inp { min-block-size: 44px; }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ attribute: false }) detail: NewEventDetail | null = null;
  @state() private calId = '';
  @state() private evTitle = '';
  @state() private date = '';
  @state() private from = '';
  @state() private to = '';
  @state() private repeat: Repeat = 'none';
  @state() private count = 9;
  @state() private behalf: OnBehalfKind = 'self';
  @state() private behalfLabel = '';
  @state() private headcount = '';
  @state() private guestName = '';
  @state() private guestPhone = '';
  @state() private dayOcc: Occurrence[] = [];
  @state() private preview: EventPreview | null = null;
  @state() private error = '';
  @state() private suggestions: { start: string; end: string }[] = [];
  @state() private busy = false;
  @state() private event: CalEvent | null = null;
  @state() private confirmCancel = false;
  @state() private retention: number | null = null;
  @state() private guestKinds: OnBehalfKind[] = ['customer', 'class'];
  private previewTimer = 0;
  private dayKey = '';
  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.onKey);
    const d = this.detail ?? {};
    if (d.eventId) {
      void this.loadEvent(d.eventId);
      return;
    }
    const ctx = this.ctx;
    const now = ctx?.now ?? new Date();
    const cal = this.bookable().find((c) => c.id === d.calendarId) ?? this.defaultCal();
    this.calId = cal?.id ?? '';
    const start = d.start ? new Date(d.start) : new Date(Math.ceil(now.getTime() / (30 * 60000)) * 30 * 60000);
    const end = d.end ? new Date(d.end) : new Date(start.getTime() + 60 * 60000);
    this.date = isoDate(start);
    this.from = hm(start);
    this.to = hm(end);
    void this.loadSettings();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.onKey);
    clearTimeout(this.previewTimer);
  }

  protected firstUpdated(): void {
    (this.renderRoot.querySelector('[data-cal-field="title"]') as HTMLInputElement | null)?.focus({ preventScroll: true });
  }

  protected willUpdate(changed: PropertyValues): void {
    if (this.event || this.detail?.eventId) return;
    if (['calId', 'date', 'from', 'to', 'repeat', 'count', 'behalf', 'headcount'].some((k) => changed.has(k))) this.schedulePreview();
    if (changed.has('calId') || changed.has('date')) void this.loadDay();
  }

  private bookable(): Calendar[] {
    return (this.ctx?.cals ?? []).filter((c) => !c.archived && c.my_role && c.my_role !== 'view' && c.type !== 'maintenance');
  }

  /** The first room the viewer manages (a calendar manager's own room), else the first room he may book, else any bookable calendar. */
  private defaultCal(): Calendar | undefined {
    const list = this.bookable();
    return list.find((c) => c.type === 'room' && c.my_role === 'manage') ?? list.find((c) => c.type === 'room') ?? list[0];
  }

  private cal(): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === this.calId);
  }

  private async loadSettings(): Promise<void> {
    try {
      const { settings } = await (this.ctx as CalCtx).api.settings();
      this.retention = settings.guest_retention_days;
      this.guestKinds = settings.guest_details_kinds?.length ? settings.guest_details_kinds : this.guestKinds;
    } catch {
      /* the retention line falls back to a sentence without the number */
    }
  }

  private async loadEvent(id: string): Promise<void> {
    try {
      this.event = (await (this.ctx as CalCtx).api.event(id)).event;
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private async loadDay(): Promise<void> {
    const ctx = this.ctx;
    const day = localInstant(this.date, '00:00');
    if (!ctx || !day || !this.calId) return;
    const key = `${this.calId}|${this.date}`;
    if (key === this.dayKey) return;
    this.dayKey = key;
    try {
      const r = await ctx.api.occurrences(day.toISOString(), addDays(day, 1).toISOString(), [this.calId]);
      if (key === this.dayKey) this.dayOcc = r.occurrences.filter((o) => ['confirmed', 'pending'].includes(o.state));
    } catch {
      this.dayOcc = [];
    }
  }

  private body(): NewEvent | null {
    const s = localInstant(this.date, this.from);
    const e = localInstant(this.date, this.to);
    if (!s || !e || !this.calId) return null;
    const ctx = this.ctx as CalCtx;
    const out: NewEvent = { calendar_id: this.calId, kind: 'booking', title: this.evTitle.trim(), start: s.toISOString(), end: e.toISOString() };
    const rr = rruleOf(this.repeat, this.count);
    if (rr) out.rrule = rr;
    if (ctx.access.can.book_for_others && this.behalf !== 'self') out.on_behalf = { kind: this.behalf, label: this.behalfLabel.trim() };
    const hc = parseInt(this.headcount, 10);
    if (hc > 0) out.headcount = hc;
    if (this.guestsOffered() && (this.guestName.trim() || this.guestPhone.trim())) out.guests = [{ name: this.guestName.trim(), phone: this.guestPhone.trim() }];
    return out;
  }

  private guestsOffered(): boolean {
    const ctx = this.ctx as CalCtx;
    return ctx.access.ui.guest_details_enabled && ctx.access.can.book_for_others && this.behalf !== 'self' && this.guestKinds.includes(this.behalf);
  }

  private schedulePreview(): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => void this.runPreview(), 250);
  }

  private async runPreview(): Promise<void> {
    const b = this.body();
    if (!b || new Date(b.end) <= new Date(b.start)) {
      this.preview = null;
      return;
    }
    try {
      this.preview = await (this.ctx as CalCtx).api.previewEvent({ ...b, title: b.title || 'בדיקה' });
    } catch {
      this.preview = null;
    }
  }

  private close(): void {
    this.dispatchEvent(new Event('close'));
  }

  private problem(): string {
    const s = localInstant(this.date, this.from);
    const e = localInstant(this.date, this.to);
    if (!this.calId) return 'אין יומן שאפשר להזמין בו.';
    if (!this.evTitle.trim()) return 'חסרה כותרת.';
    if (!s || !e) return 'חסר תאריך או שעה.';
    if (e <= s) return 'שעת הסיום לפני שעת ההתחלה.';
    if (this.behalf !== 'self' && !this.behalfLabel.trim()) return `חסר שם ה${BEHALF_LABEL[this.behalf]}.`;
    return '';
  }

  private async submit(): Promise<void> {
    const p = this.problem();
    if (p) {
      this.error = p;
      return;
    }
    const b = this.body() as NewEvent;
    this.busy = true;
    this.error = '';
    this.suggestions = [];
    try {
      const r = await (this.ctx as CalCtx).api.createEvent(b);
      emit(this, CAL_EVENTS.changed);
      emit(this, CAL_EVENTS.toast, r.state === 'pending' ? 'הבקשה נשלחה לאישור' : 'ההזמנה נשמרה');
      this.close();
    } catch (e) {
      this.error = describeError(e);
      if (e instanceof ApiError && Array.isArray((e.body.details as { suggestions?: unknown }).suggestions)) {
        this.suggestions = ((e.body.details as { suggestions: { start: string; end: string }[] }).suggestions).slice(0, 3);
      }
    } finally {
      this.busy = false;
    }
  }

  private take(s: { start: string; end: string }): void {
    const a = new Date(s.start);
    this.date = isoDate(a);
    this.from = hm(a);
    this.to = hm(s.end);
    this.suggestions = [];
    this.error = '';
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return nothing;
    const editing = !!this.detail?.eventId;
    return html`<div class="scrim" @click=${() => this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-labelledby="h" data-cal-drawer=${editing ? 'event' : 'new'}>
        ${editing ? this.viewEvent() : this.form()}
      </aside>`;
  }

  // ---------- an existing entry ----------
  private viewEvent() {
    const ctx = this.ctx as CalCtx;
    const ev = this.event;
    const cal = ev ? ctx.cals.find((c) => c.id === ev.calendar_id) : undefined;
    const canCancel = !!ev && ev.can.cancel && ['confirmed', 'displaced'].includes(ev.state);
    const canWithdraw = !!ev && ev.state === 'pending' && (ev.can.cancel || ev.can.edit);
    return html`<header><div><h2 id="h" class="ell">${ev ? ev.title ?? 'תפוס' : 'טוען…'}</h2>${cal ? html`<div class="muted">${cal.name}</div>` : nothing}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${ev ? html`<dl>
          <dt>מתי</dt><dd class="num">${whenText(ev.start, ev.end, ctx.now).split(' · ')[0]} · <span class="ltr">${hm(ev.start)}–${hm(ev.end)}</span>${ev.recurring ? ' · חוזר' : ''}</dd>
          <dt>מצב</dt><dd><span class=${`chip ${ev.state === 'confirmed' ? 'ok' : ev.state === 'pending' ? 'dash' : ev.state === 'displaced' ? 'warn' : ''}`}>${STATE_LABEL[ev.state]}</span>${ev.contested ? html` <span class="chip warn">מתחרה על החלון</span>` : nothing}</dd>
          ${ev.organizer ? html`<dt>מארגן</dt><dd>${ev.organizer.name}</dd>` : nothing}
          ${ev.on_behalf_label ? html`<dt>בשם</dt><dd>${ev.on_behalf_label}</dd>` : nothing}
          ${ev.headcount ? html`<dt>משתתפים</dt><dd class="num">${ev.headcount}</dd>` : nothing}
          ${ev.notes ? html`<dt>הערות</dt><dd>${ev.notes}</dd>` : nothing}
        </dl>
        ${ev.sync_flag ? html`<div class="note bad" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>מסומן להחלטה</b><span class="muted">${ev.sync_flag === 'conflict' ? 'התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו. ההחלטה בהגדרות › חיבורי יומן.' : 'האירוע נמחק ביומן החיצוני.'}</span></div></div>` : nothing}
        ${ev.state === 'displaced' ? html`<div class="note warn" role="note"><sw-icon name="warning" size="18"></sw-icon><div><b>ההזמנה נדחקה בגלל תחזוקה</b><span class="muted">היא לא נמחקה. אפשר לבחור מועד אחר ולבטל אותה.</span></div></div>` : nothing}
        ${this.confirmCancel ? html`<div class="note warn" role="alert"><sw-icon name="warning" size="18"></sw-icon><div><b>${canWithdraw ? 'למשוך את הבקשה?' : 'לבטל את ההזמנה?'}</b><span class="muted">${ev.recurring ? 'הביטול חל על כל הסדרה.' : 'המועד יתפנה לאחרים.'}</span></div></div>` : nothing}`
        : this.error ? nothing : html`<div class="skel" style="block-size:120px"></div>`}
        ${this.error ? html`<div class="err" role="alert" data-cal-error>${this.error}</div>` : nothing}
      </div>
      <footer>
        ${canCancel || canWithdraw ? html`<button type="button" class=${`btn bad${this.confirmCancel ? ' fill' : ''}`} ?disabled=${this.busy} data-cal-cancel-event @click=${() => void this.cancelEvent(canWithdraw)}>
          <sw-icon name="trash" size="16"></sw-icon>${this.confirmCancel ? 'כן, לבטל' : canWithdraw ? 'משיכת הבקשה' : 'ביטול ההזמנה'}</button>` : nothing}
        <button type="button" class="btn" @click=${() => this.close()}>סגירה</button>
      </footer>`;
  }

  private async cancelEvent(withdraw: boolean): Promise<void> {
    if (!this.confirmCancel) {
      this.confirmCancel = true;
      return;
    }
    const ev = this.event as CalEvent;
    this.busy = true;
    try {
      const api = (this.ctx as CalCtx).api;
      if (withdraw) await api.withdrawEvent(ev.id, ev.revision);
      else await api.cancelEvent(ev.id, ev.revision);
      emit(this, CAL_EVENTS.changed);
      emit(this, CAL_EVENTS.toast, withdraw ? 'הבקשה נמשכה' : 'ההזמנה בוטלה');
      this.close();
    } catch (e) {
      this.error = describeError(e);
      this.confirmCancel = false;
    } finally {
      this.busy = false;
    }
  }

  // ---------- a new booking ----------
  private roleLine(cal: Calendar | undefined): string {
    const ctx = this.ctx as CalCtx;
    if (cal?.my_role === 'manage') return `ניהול היומן "${cal.name}" · ללא צורך באישור`;
    if (ctx.access.can.book_for_others) return 'מזמין גם בשם אחרים';
    return 'יוצר הזמנות שלו בלבד';
  }

  private form() {
    const ctx = this.ctx as CalCtx;
    const cal = this.cal();
    const list = this.bookable();
    const behalfOk = ctx.access.can.book_for_others;
    const start = localInstant(this.date, this.from);
    const end = localInstant(this.date, this.to);
    const conflicts = this.preview?.conflicts ?? [];
    const needsApproval = !!this.preview?.needs_approval_by.length && cal?.my_role !== 'manage';
    const toApproval = needsApproval || conflicts.length > 0;
    const hc = parseInt(this.headcount, 10);
    const over = !!cal?.capacity && hc > cal.capacity;
    const sub = cal ? [cal.name, cal.floor_name].filter(Boolean).join(' · ') : '';
    return html`<header><div><h2 id="h">הזמנה חדשה</h2>${sub ? html`<div class="muted ell">${sub}</div>` : nothing}</div>
        <button type="button" class="btn icon x" aria-label="סגירה" data-cal-close @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="lockline" data-cal-roleline><sw-icon name="shield" size="16"></sw-icon><span class="ell">${this.roleLine(cal)}</span></div>
        ${!list.length ? html`<div class="note warn" role="note"><sw-icon name="lock" size="18"></sw-icon><div><b>אין יומן שאפשר להזמין בו</b><span class="muted">מנהל היומן יכול לתת הרשאה.</span></div></div>` : nothing}
        <div class="fld"><label for="cal">יומן</label>
          <div class="selrow"><span class="dot" style=${`--h:${colorVar(cal?.color)}`}></span>
            <select id="cal" class="inp" data-cal-field="calendar" .value=${this.calId} @change=${(e: Event) => (this.calId = (e.target as HTMLSelectElement).value)}>
              ${list.map((c) => html`<option value=${c.id} ?selected=${c.id === this.calId}>${c.name}</option>`)}</select><sw-icon name="chevronDown" size="16"></sw-icon></div></div>
        <div class="fld"><label for="t">כותרת</label><input id="t" class="inp" maxlength="200" data-cal-field="title" .value=${this.evTitle} placeholder="למשל: ישיבת צוות" @input=${(e: Event) => (this.evTitle = (e.target as HTMLInputElement).value)}></div>
        <div class="fld"><span class="lbl">מתי</span><div class="ctls">
          <input type="date" class="inp" aria-label="תאריך" data-cal-field="date" .value=${this.date} @change=${(e: Event) => (this.date = (e.target as HTMLInputElement).value)}>
          <input type="time" class="inp short" aria-label="שעת התחלה" step="300" data-cal-field="from" .value=${this.from} @change=${(e: Event) => (this.from = (e.target as HTMLInputElement).value)}>
          <input type="time" class="inp short" aria-label="שעת סיום" step="300" data-cal-field="to" .value=${this.to} @change=${(e: Event) => (this.to = (e.target as HTMLInputElement).value)}></div></div>
        <div class="fld"><label for="rep">חזרה</label><div class="ctls">
          <select id="rep" class="inp" data-cal-field="repeat" .value=${this.repeat} @change=${(e: Event) => (this.repeat = (e.target as HTMLSelectElement).value as Repeat)}>
            <option value="none" ?selected=${this.repeat === 'none'}>פעם אחת</option><option value="weekly" ?selected=${this.repeat === 'weekly'}>כל שבוע</option><option value="daily" ?selected=${this.repeat === 'daily'}>כל יום</option></select>
          ${this.repeat !== 'none' ? html`<input type="number" class="inp short num" min="2" max="104" aria-label="מספר מועדים" data-cal-field="count" .value=${String(this.count)} @input=${(e: Event) => (this.count = parseInt((e.target as HTMLInputElement).value, 10) || 2)}>` : nothing}</div></div>
        ${this.repeat !== 'none' && start ? html`<div class="fld"><span></span><span class="hint num" data-cal-repeat-summary><sw-icon name="refresh" size="14"></sw-icon><span class="ell">${repeatSummary(this.repeat, this.count, start)}</span></span></div>` : nothing}
        <div class="fld top"><span class="lbl">הזמינות</span><div class="col">${this.availability(start, end, conflicts)}</div></div>
        ${behalfOk ? html`
          <div class="fld"><label for="bh">בשם</label><div class="ctls">
            <select id="bh" class="inp short" data-cal-field="behalf" .value=${this.behalf} @change=${(e: Event) => (this.behalf = (e.target as HTMLSelectElement).value as OnBehalfKind)}>
              ${(Object.keys(BEHALF_LABEL) as OnBehalfKind[]).map((k) => html`<option value=${k} ?selected=${k === this.behalf}>${BEHALF_LABEL[k]}</option>`)}</select>
            ${this.behalf !== 'self' ? html`<input class="inp" maxlength="80" aria-label=${`שם ה${BEHALF_LABEL[this.behalf]}`} data-cal-field="behalf-label" .value=${this.behalfLabel} placeholder=${`שם ה${BEHALF_LABEL[this.behalf]}`} @input=${(e: Event) => (this.behalfLabel = (e.target as HTMLInputElement).value)}>` : nothing}</div></div>`
          : html`<div class="lockline" data-cal-behalf-locked><sw-icon name="lock" size="16"></sw-icon><span>הזמנה בשם צוות, חוג או לקוח - למי שקיבל את ההרשאה</span></div>`}
        <div class="fld"><label for="hc">משתתפים</label><div class="ctls">
          <input id="hc" type="number" min="1" class="inp short num" inputmode="numeric" data-cal-field="headcount" .value=${this.headcount} @input=${(e: Event) => (this.headcount = (e.target as HTMLInputElement).value)}>
          ${cal?.capacity ? html`<span class=${`hint${over ? ' bad' : ''}`} data-cal-capacity-hint><span>מתוך <span class="num">${cal.capacity}</span> מקומות${over ? ' · יותר מהקיבולת' : ''}</span></span>` : nothing}</div></div>
        ${this.guestsOffered() ? html`<div class="fld top"><span class="lbl">פרטי אורח</span><div class="col">
            <div class="ctls"><input class="inp" maxlength="80" aria-label="שם האורח" placeholder="שם" data-cal-field="guest-name" .value=${this.guestName} @input=${(e: Event) => (this.guestName = (e.target as HTMLInputElement).value)}>
              <input class="inp num ltr" type="tel" inputmode="tel" maxlength="20" aria-label="טלפון האורח" placeholder="050-000-0000" data-cal-field="guest-phone" .value=${this.guestPhone} @input=${(e: Event) => (this.guestPhone = (e.target as HTMLInputElement).value)}></div>
            <span class="hint" data-cal-retention><sw-icon name="clock" size="14"></sw-icon><span>${this.retention === null ? 'השם והטלפון יימחקו אחרי המועד האחרון, לפי הגדרות השמירה.' : this.retention === 0 ? 'השם והטלפון יימחקו בסיום המועד האחרון.' : html`השם והטלפון יימחקו <span class="num">${this.retention}</span> יום אחרי המועד האחרון.`}${this.behalfLabel.trim() ? ` התווית "${this.behalfLabel.trim()}" נשארת.` : ''}</span></span></div></div>` : nothing}
        ${toApproval ? html`<div class="note" role="note" data-cal-approval-note><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח לאישור</b>
          <span class="muted">${conflicts.length ? 'המועד חופף להזמנה שכבר אושרה; הבקשה תיכנס לתור והמנהל יחליט. ' : ''}${cal?.owner.name ? `${cal.owner.name}, מנהל/ת היומן, ת/יקבל התראה. ` : ''}בקשה לא שומרת את המועד: מי שמאושר ראשון מקבל אותו.</span></div></div>` : nothing}
        ${this.error ? html`<div class="err" role="alert" data-cal-error>${this.error}</div>` : nothing}
        ${this.suggestions.length ? html`<div class="sugg">${this.suggestions.map((s) => html`<button type="button" class="num ltr" @click=${() => this.take(s)}>${hm(s.start)}–${hm(s.end)}</button>`)}</div>` : nothing}
      </div>
      <footer>
        <button type="button" class="btn pri" ?disabled=${this.busy || !list.length} data-cal-submit @click=${() => void this.submit()}><sw-icon name="check" size="16"></sw-icon>${toApproval ? 'שליחה לאישור' : 'שמירה'}</button>
        <button type="button" class="btn" @click=${() => this.close()}>ביטול</button>
      </footer>`;
  }

  /** The day of the chosen calendar 07:00-22:00 with the asked time on it; the hint says whether every occurrence is free. */
  private availability(start: Date | null, end: Date | null, conflicts: EventPreview['conflicts']) {
    const from = 7;
    const to = 22;
    const total = (to - from) * 60;
    const day = start ? startOfDay(start) : null;
    const pct = (d: Date) => Math.min(100, Math.max(0, (((d.getTime() - (day as Date).getTime()) / 60000 - from * 60) / total) * 100));
    const clash = conflicts.length > 0;
    const n = this.repeat === 'none' ? 1 : Math.min(Math.max(this.count, 2), 104);
    const cal = this.cal();
    const gap = cal?.buffer_after_min ?? 0;
    const nextFree = clash && start && end ? this.nextFree(start, end) : null;
    return html`<div class="mini" aria-hidden="true" data-cal-mini>
        ${day ? this.dayOcc.map((o) => html`<div class="busy" data-mark=${o.state === 'pending' ? 'pending' : ''} style=${`left:${pct(new Date(o.start))}%;width:${pct(new Date(o.end)) - pct(new Date(o.start))}%`}></div>`) : nothing}
        ${start && end && end > start ? html`<div class=${`slot${clash ? ' clash' : ''}`} style=${`left:${pct(start)}%;width:${Math.max(1, pct(end) - pct(start))}%`}></div>` : nothing}
      </div>
      <div class="scale num"><span>07:00</span><span>12:00</span><span>17:00</span><span>22:00</span></div>
      ${!this.preview ? nothing : clash
        ? html`<span class="hint bad" data-cal-avail="clash"><sw-icon name="warning" size="14"></sw-icon><span class="ell"><b>${n > 1 ? html`<span class="num">${conflicts.length}</span> מועדים מתנגשים` : 'המועד תפוס'}</b>${conflicts[0] ? html` · <span class="num">${ddmm(new Date(conflicts[0].start))} ${hm(conflicts[0].start)}</span>${conflicts[0].title ? ` (${conflicts[0].title})` : ''}` : nothing}</span></span>
          ${nextFree ? html`<div class="sugg"><button type="button" class="num ltr" data-cal-suggest @click=${() => this.take(nextFree)}>${hm(nextFree.start)}–${hm(nextFree.end)}</button></div>` : nothing}`
        : html`<span class="hint ok" data-cal-avail="free"><sw-icon name="check" size="14"></sw-icon><span class="ell"><b>${n > 1 ? html`פנוי בכל <span class="num">${n}</span> המועדים` : 'פנוי'}</b>${gap ? html` · כולל <span class="num">${gap}</span> דק׳ הפסקה אחרי` : nothing}</span></span>`}`;
  }

  /** The first start on the same day (15-minute steps, until 22:00) where the same length meets no entry of the day. */
  private nextFree(start: Date, end: Date): { start: string; end: string } | null {
    const len = end.getTime() - start.getTime();
    const limit = new Date(startOfDay(start).getTime() + 22 * 3600000);
    for (let t = start.getTime() + 15 * 60000; t + len <= limit.getTime(); t += 15 * 60000) {
      const s = new Date(t);
      const e = new Date(t + len);
      if (!this.dayOcc.some((o) => o.state === 'confirmed' && new Date(o.start) < e && new Date(o.end) > s)) return { start: s.toISOString(), end: e.toISOString() };
    }
    return null;
  }
}

/** Two-digit local time label of a number of minutes (unit-tested helper of the drawer). */
export const minutesLabel = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

declare global {
  interface HTMLElementTagNameMap {
    'cal-event-drawer': CalEventDrawer;
  }
}
