import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { dateInputLang } from '../api/day-format';
import type { Calendar, OnBehalfKind, Occurrence } from '../api/calendars';
import { attendeeSlot, type CalCtx } from './ctx';
import { DAY_LONG, colorVar, ddmm, hm, pad } from './model';
import { calCss } from './styles';
import { BEHALF_LABEL, repeatSummary, type Repeat } from './booking-logic';
import { deleteLabel, durText, instantAt, openOn, placePopover, type Hint } from './grid-logic';

/** The quick create's draft (the selection on the grid + what the popover adds). Minutes are local minutes of `day`. */
export interface QuickDraft {
  calId: string;
  day: Date;
  s: number;
  e: number;
  title: string;
  allDay: boolean;
  prev?: [number, number];
  repeat: Repeat;
  count: number;
  behalf: OnBehalfKind;
  behalfLabel: string;
  headcount: number;
  attendees?: unknown;
}
export interface Anchor { x: number; y: number; w: number; h: number }

const fire = (el: HTMLElement, name: string, detail?: unknown) => el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
const mm = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const toMin = (v: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Shared look of the two floating surfaces: the anchored popover (desktop / tablet) and the bottom sheet (phone). */
const overlayCss = css`
  :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); pointer-events: none; display: block; }
  .pop { position: fixed; pointer-events: auto; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border); border-radius: var(--sw-r-xl); box-shadow: var(--sw-shadow-3);
    opacity: 0; transform: scale(0.96); transition: opacity 160ms var(--sw-ease-dialog), transform 160ms var(--sw-ease-dialog); }
  .pop.in { opacity: 1; transform: none; }
  .pop.instant { transition: none; }
  .scrim { position: fixed; inset: 0; background: var(--sw-overlay); pointer-events: auto; opacity: 0; transition: opacity 220ms ease; }
  .scrim.in { opacity: 1; }
  .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; pointer-events: auto; background: var(--sw-menu-surface); border-radius: var(--sw-r-2xl) var(--sw-r-2xl) 0 0; box-shadow: var(--sw-shadow-3);
    padding: 8px 16px calc(18px + env(safe-area-inset-bottom, 0px)); max-block-size: 90vh; display: flex; flex-direction: column; gap: 11px; overflow: auto; overscroll-behavior: contain;
    transform: translateY(100%); transition: transform 280ms var(--sw-ease-drawer); }
  .sheet.in { transform: none; }
  .grab { inline-size: 40px; block-size: 5px; border-radius: 3px; background: var(--sw-border-strong); margin: 2px auto 4px; flex: none; }
  .st { display: flex; gap: 8px; padding: 9px 11px; border-radius: var(--sw-r-lg); font-size: var(--sw-fs-sm); line-height: 1.42; }
  .st > sw-icon { margin-block-start: 2px; flex: none; }
  .st b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
  .st span { display: block; color: var(--sw-text-2); }
  .st.ok { background: var(--sw-success-soft); }
  .st.ok > sw-icon, .st.ok b { color: var(--sw-success-text); }
  .st.info { background: var(--sw-accent-soft); }
  .st.info > sw-icon { color: var(--sw-accent-text); }
  .st.bad { background: var(--sw-danger-soft); }
  .st.bad > sw-icon, .st.bad b { color: var(--sw-danger-text); }
  .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
  kbd { font: inherit; font-size: var(--sw-fs-2xs); border: 1px solid var(--sw-border-strong); border-block-end-width: 2px; border-radius: var(--sw-r-2xs); padding: 0 4px; background: var(--sw-surface-2); }
  .kb { margin-inline-start: auto; font-size: var(--sw-fs-xs); color: var(--sw-text-3); white-space: nowrap; }
  .x { inline-size: 32px; min-block-size: 32px; border: 0; background: transparent; }
  @media (prefers-reduced-motion: reduce) {
    .pop, .pop.in { transform: none; }
    .sheet, .sheet.in { transform: none; transition: opacity 200ms ease; }
    .sheet:not(.in) { opacity: 0; }
  }
`;

/** Places a popover next to its anchor after it is drawn (its own size is known only then). */
function placeAt(pop: HTMLElement | null, anchor: Anchor | null): void {
  if (!pop) return;
  const a = anchor ?? { x: window.innerWidth / 2 - 20, y: window.innerHeight / 3, w: 40, h: 40 };
  const p = placePopover(a, pop.offsetWidth, pop.offsetHeight, window.innerWidth, window.innerHeight);
  pop.style.left = `${p.left}px`;
  pop.style.top = `${p.top}px`;
  pop.style.transformOrigin = p.origin;
}

function statusLine(h: Hint, cal: Calendar | undefined) {
  if (h.level === 'bad') return html`<div class="st bad" role="status" data-cal-qc-status="bad"><sw-icon name="warning" size="16"></sw-icon><div><b>אי אפשר לשמור כאן</b><span>${h.reason}</span></div></div>`;
  if (h.level === 'contest') {
    const x = h.contested as Occurrence;
    return html`<div class="st bad" role="status" data-cal-qc-status="contest"><sw-icon name="warning" size="16"></sw-icon><div><b>חופף ל${x.title ? `"${x.title}"` : 'הזמנה קיימת'} <span class="ltr num" style="display:inline">${hm(x.start)}–${hm(x.end)}</span></b>
      <span>אפשר לשלוח כבקשה מתחרה. ${h.approver ?? 'מנהל היומן'} יחליט/תחליט, ומי שמאושר ראשון מקבל את המועד.</span></div></div>`;
  }
  if (h.level === 'pend') return html`<div class="st info" role="status" data-cal-qc-status="pend"><sw-icon name="info" size="16"></sw-icon><div><b>תישלח לאישור</b>
    <span>${h.approver ? `${h.approver}, מנהל/ת ${cal?.name ?? 'היומן'}, יקבל/תקבל התראה. ` : ''}עד ההחלטה ההזמנה מסומנת "ממתין לאישור".</span></div></div>`;
  return html`<div class="st ok" role="status" data-cal-qc-status="ok"><sw-icon name="check" size="16"></sw-icon><div><b>פנוי</b>${h.warn ? html`<span>${h.warn}</span>` : nothing}
    ${h.peers ? html`<span>יש עוד ${h.peers === 1 ? 'בקשה ממתינה אחת' : html`<span class="num">${h.peers}</span> בקשות ממתינות`} לחלון הזה</span>` : nothing}</div></div>`;
}

/**
 * CAL-GRID-EDIT-2343: the quick create (prototype `quickHTML` / `sheetNewHTML`). Next to the selection on desktop and tablet, a bottom sheet
 * on the phone: title, calendar, times (a step of the calendar), "כל היום" = the calendar's open hours, the recurrence shortcut, the organizer
 * (on behalf of a team / class / customer for whoever holds that right), headcount against the capacity, THE ATTENDEE SLOT (ctx.ts), and a
 * live status line. Enter saves, Esc cancels, "פרטים נוספים" moves the draft into the full drawer. The parent owns the draft and the hint, so
 * the selection on the grid and this surface always agree.
 */
@customElement('cal-quick-create')
export class CalQuickCreate extends LitElement {
  static styles = [calCss, overlayCss, css`
    .pop { inline-size: min(372px, calc(100vw - 16px)); padding: 12px 14px; display: flex; flex-direction: column; gap: 9px; }
    .qtop { display: flex; gap: 8px; align-items: center; }
    .qt { flex: 1; min-inline-size: 0; font: inherit; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); border: 0; border-block-end: 2px solid var(--sw-accent); background: transparent;
      padding: 4px 2px 6px; color: var(--sw-heading); outline: none; border-radius: 0; }
    .qt::placeholder { color: var(--sw-text-3); font-weight: var(--sw-fw-medium); }
    .qr { display: flex; gap: 10px; align-items: flex-start; }
    .qr > sw-icon { margin-block-start: 8px; color: var(--sw-text-3); flex: none; }
    .qv { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; min-inline-size: 0; flex: 1; min-block-size: 34px; font-size: var(--sw-fs-md); }
    .qv .muted { font-size: var(--sw-fs-sm); }
    .tm { display: inline-flex; align-items: center; gap: 4px; }
    .tm input, .fi { font: inherit; font-size: var(--sw-fs-md); border: 1px solid transparent; background: var(--sw-surface-2); border-radius: var(--sw-r-sm); padding: 5px 8px; color: var(--sw-heading); min-block-size: 32px; }
    .tm input[type='time'] { inline-size: 96px; font-variant-numeric: tabular-nums; }
    .tm input:focus, .fi:focus, .sel select:focus, .qt:focus-visible { outline: var(--sw-focus-w) solid var(--sw-focus); outline-offset: 1px; }
    .ck { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-size: var(--sw-fs-sm); }
    .ck input { inline-size: 16px; block-size: 16px; accent-color: var(--sw-accent); margin: 0; }
    .sel { position: relative; display: inline-flex; align-items: center; }
    .sel .dot { position: absolute; inset-inline-start: 10px; pointer-events: none; }
    .sel sw-icon { position: absolute; inset-inline-end: 8px; pointer-events: none; color: var(--sw-text-3); }
    .sel select { appearance: none; font: inherit; font-size: var(--sw-fs-md); font-weight: var(--sw-fw-semibold); border: 1px solid transparent; background: var(--sw-surface-2); border-radius: var(--sw-r-sm);
      padding-block: 5px; padding-inline: 28px 30px; color: var(--sw-heading); min-block-size: 32px; cursor: pointer; max-inline-size: 220px; }
    .sel.plain select { padding-inline-start: 10px; }
    .step { display: inline-flex; align-items: center; gap: 2px; background: var(--sw-surface-2); border-radius: var(--sw-r-pill); padding: 2px; }
    .step button { inline-size: 28px; block-size: 28px; border: 0; border-radius: 50%; background: transparent; cursor: pointer; font-size: var(--sw-fs-lg); line-height: 1; color: var(--sw-heading); }
    .step button:active { background: var(--sw-surface-3); }
    .step b { min-inline-size: 26px; text-align: center; }
    .lockl { display: inline-flex; gap: 5px; align-items: center; color: var(--sw-text-3); font-size: var(--sw-fs-xs); }
    .rs { font-size: var(--sw-fs-sm); color: var(--sw-text-2); display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
    .rs .bad { color: var(--sw-danger-text); }
    .qf { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .slot:empty { display: none; }
    .tbig { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tcol { background: var(--sw-surface-2); border-radius: var(--sw-r-lg); padding: 8px 10px; display: flex; flex-direction: column; gap: 4px; align-items: center; }
    .tcol small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .tcol .stp { display: flex; align-items: center; gap: 8px; }
    .tcol .stp b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .tcol .stp button { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); font-size: var(--sw-fs-xl); cursor: pointer; color: var(--sw-heading); }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .sheet h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .sheet .btn { min-block-size: 46px; }
    .sheet .wide { flex: 1; }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ attribute: false }) draft: QuickDraft | null = null;
  @property({ attribute: false }) hint: Hint | null = null;
  @property({ attribute: false }) anchor: Anchor | null = null;
  @property({ type: Boolean }) sheet = false;
  @property({ type: Boolean }) instant = false;
  @property({ type: Boolean }) busy = false;
  @property() error = '';
  /** the server's word on a series (POST /calendar/events/preview): how many occurrences clash; null = not asked */
  @property({ attribute: false }) seriesClash: number | null = null;
  @state() private shown = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (this.instant) this.shown = true;
    else requestAnimationFrame(() => requestAnimationFrame(() => (this.shown = true)));
  }

  protected firstUpdated(): void {
    if (!this.sheet) placeAt(this.renderRoot.querySelector('.pop'), this.anchor);
    (this.renderRoot.querySelector('[data-cal-qc="title"]') as HTMLInputElement | null)?.focus({ preventScroll: true });
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('anchor') && !this.sheet && changed.get('anchor') !== undefined) placeAt(this.renderRoot.querySelector('.pop'), this.anchor);
  }

  private cals(): Calendar[] {
    return (this.ctx?.cals ?? []).filter((c) => !c.archived && c.my_role && c.my_role !== 'view' && c.type !== 'maintenance');
  }

  private set(p: Partial<QuickDraft>): void {
    fire(this, 'qc-change', p);
  }

  private onKey(e: KeyboardEvent): void {
    const t = e.target as HTMLElement;
    if (e.key === 'Escape') {
      e.stopPropagation();
      fire(this, 'qc-close');
    } else if (e.key === 'Enter' && !['TEXTAREA', 'BUTTON', 'SELECT'].includes(t.tagName)) {
      e.preventDefault();
      fire(this, 'qc-save');
    }
  }

  private allDay(on: boolean): void {
    const d = this.draft as QuickDraft;
    const cal = this.cals().find((c) => c.id === d.calId);
    if (on) {
      const o = (cal && openOn(cal, d.day)) ?? { from: 0, to: 1440 };
      this.set({ allDay: true, prev: [d.s, d.e], s: o.from, e: Math.min(o.to, 1440) });
    } else this.set({ allDay: false, s: d.prev?.[0] ?? d.s, e: d.prev?.[1] ?? d.e });
  }

  private time(which: 's' | 'e', v: string): void {
    const d = this.draft as QuickDraft;
    const m = toMin(v);
    if (m === null) return;
    if (which === 's') {
      const len = d.e - d.s;
      this.set({ s: m, e: Math.min(1440, m + len) });
    } else if (m > d.s) this.set({ e: m });
  }

  render() {
    const d = this.draft;
    const ctx = this.ctx;
    if (!d || !ctx) return nothing;
    return this.sheet ? this.sheetView(d, ctx) : this.popView(d, ctx);
  }

  private saveLabel(): string {
    const lv = this.hint?.level;
    return lv === 'pend' || lv === 'contest' ? 'שליחה לאישור' : 'שמירה';
  }

  private organizer(d: QuickDraft, ctx: CalCtx) {
    if (ctx.access.can.book_for_others) {
      return html`<span class="sel plain"><select aria-label="בשם" data-cal-qc="behalf" @change=${(e: Event) => this.set({ behalf: (e.target as HTMLSelectElement).value as OnBehalfKind })}>
          ${(Object.keys(BEHALF_LABEL) as OnBehalfKind[]).map((k) => html`<option value=${k} ?selected=${d.behalf === k}>${k === 'self' ? 'בשמי' : `בשם ${BEHALF_LABEL[k]}`}</option>`)}</select><sw-icon name="chevronDown" size="14"></sw-icon></span>
        ${d.behalf !== 'self' ? html`<input class="fi" style="inline-size:140px" maxlength="80" data-cal-qc="behalf-label" .value=${d.behalfLabel} placeholder=${`שם ה${BEHALF_LABEL[d.behalf]}`}
          aria-label=${`שם ה${BEHALF_LABEL[d.behalf]}`} @input=${(e: Event) => this.set({ behalfLabel: (e.target as HTMLInputElement).value })}>` : nothing}`;
    }
    return html`<span>מארגן: <b>אני</b></span><span class="lockl"><sw-icon name="lock" size="12"></sw-icon>בשם אחרים: למי שקיבל הרשאה</span>`;
  }

  private repeatLine(d: QuickDraft) {
    if (d.repeat === 'none') return nothing;
    const start = instantAt(d.day, d.s);
    return html`<div class="rs" data-cal-qc-series><sw-icon name="refresh" size="14"></sw-icon><span class="num">${repeatSummary(d.repeat, d.count, start)}</span>
      ${this.seriesClash === null ? nothing : this.seriesClash ? html`· <b class="bad"><span class="num">${this.seriesClash}</span> מועדים לא פנויים</b>` : html`· <span>פנוי בכל המועדים</span>`}</div>`;
  }

  private attendees(d: QuickDraft) {
    return html`<div class="slot" data-cal-slot="attendees">${attendeeSlot({ surface: 'quick', calendarId: d.calId, value: d.attendees, onChange: (v) => this.set({ attendees: v }) })}</div>`;
  }

  private popView(d: QuickDraft, ctx: CalCtx) {
    const cals = this.cals();
    const cal = cals.find((c) => c.id === d.calId);
    const step = (cal?.slot_step_min ?? 15) * 60;
    const bad = this.hint?.level === 'bad';
    return html`<div class=${`pop${this.shown ? ' in' : ''}${this.instant ? ' instant' : ''}`} role="dialog" aria-label="אירוע חדש" data-cal-quick @keydown=${this.onKey}>
      <div class="qtop"><input class="qt" data-cal-qc="title" placeholder="הוספת כותרת" maxlength="120" aria-label="כותרת" .value=${d.title} @input=${(e: Event) => this.set({ title: (e.target as HTMLInputElement).value })}>
        <button type="button" class="btn icon sm x" aria-label="סגירה" data-cal-qc-close @click=${() => fire(this, 'qc-close')}><sw-icon name="close" size="16"></sw-icon></button></div>
      <div class="qr"><sw-icon name="clock" size="16"></sw-icon><div class="qv"><span>${DAY_LONG[d.day.getDay()]} ${ddmm(d.day)}</span>
        <span class="tm ltr"><input type="time" lang=${dateInputLang()} step=${step} aria-label="שעת התחלה" data-cal-qc="from" .value=${mm(d.s)} ?disabled=${d.allDay} @change=${(e: Event) => this.time('s', (e.target as HTMLInputElement).value)}><span>–</span>
          <input type="time" lang=${dateInputLang()} step=${step} aria-label="שעת סיום" data-cal-qc="to" .value=${mm(Math.min(d.e, 1439))} ?disabled=${d.allDay} @change=${(e: Event) => this.time('e', (e.target as HTMLInputElement).value)}></span>
        <label class="ck"><input type="checkbox" data-cal-qc="allday" .checked=${d.allDay} @change=${(e: Event) => this.allDay((e.target as HTMLInputElement).checked)}>כל היום</label></div></div>
      <div class="qr"><sw-icon name="pin" size="16"></sw-icon><div class="qv"><span class="sel" style=${`--h:${colorVar(cal?.color)}`}><span class="dot"></span>
          <select aria-label="יומן" data-cal-qc="calendar" @change=${(e: Event) => this.set({ calId: (e.target as HTMLSelectElement).value })}>${cals.map((c) => html`<option value=${c.id} ?selected=${c.id === d.calId}>${c.name}</option>`)}</select>
          <sw-icon name="chevronDown" size="14"></sw-icon></span>${cal?.floor_name || (cal && cal.approval_mode !== 'none' && cal.my_role !== 'manage') ? html`<span class="muted">${[cal?.floor_name, cal && cal.approval_mode !== 'none' && cal.my_role !== 'manage' ? 'באישור' : ''].filter(Boolean).join(' · ')}</span>` : nothing}</div></div>
      <div class="qr"><sw-icon name="refresh" size="16"></sw-icon><div class="qv"><div class="seg" role="group" aria-label="חזרה">
        ${([['none', 'פעם אחת'], ['weekly', `כל ${DAY_LONG[d.day.getDay()]}`], ['daily', 'כל יום']] as [Repeat, string][]).map(([k, v]) => html`<button type="button" aria-pressed=${String(d.repeat === k)} data-cal-qc-repeat=${k} @click=${() => this.set({ repeat: k })}>${v}</button>`)}</div>
        ${d.repeat !== 'none' ? html`<span class="tm"><input type="number" min="2" max="104" class="num" style="inline-size:64px" aria-label="מספר מועדים" data-cal-qc="count" .value=${String(d.count)} @change=${(e: Event) => this.set({ count: Math.min(104, Math.max(2, parseInt((e.target as HTMLInputElement).value, 10) || 2)) })}> <span class="muted">מועדים</span></span>` : nothing}</div></div>
      <div class="qr"><sw-icon name="user" size="16"></sw-icon><div class="qv">${this.organizer(d, ctx)}</div></div>
      <div class="qr"><sw-icon name="users" size="16"></sw-icon><div class="qv"><span class="step"><button type="button" aria-label="פחות משתתפים" data-cal-qc-step="-1" @click=${() => this.set({ headcount: Math.max(0, d.headcount - 1) })}>−</button>
        <b class="num">${d.headcount || '—'}</b><button type="button" aria-label="יותר משתתפים" data-cal-qc-step="1" @click=${() => this.set({ headcount: d.headcount + 1 })}>+</button></span>
        ${cal?.capacity ? html`<span class="muted">משתתפים · <span class="num">${cal.capacity}</span> מקומות</span>` : html`<span class="muted">משתתפים</span>`}</div></div>
      ${this.attendees(d)}
      ${this.hint ? statusLine(this.hint, cal) : nothing}
      ${this.repeatLine(d)}
      ${this.error ? html`<div class="err" role="alert" data-cal-qc-error>${this.error}</div>` : nothing}
      <div class="qf"><button type="button" class="btn pri" ?disabled=${bad || this.busy} data-cal-qc-save @click=${() => fire(this, 'qc-save')}><sw-icon name="check" size="16"></sw-icon>${this.saveLabel()}</button>
        <button type="button" class="btn" data-cal-qc-more @click=${() => fire(this, 'qc-more')}>פרטים נוספים</button>
        <span class="kb"><kbd>Enter</kbd> שמירה · <kbd>Esc</kbd> ביטול</span></div>
    </div>`;
  }

  /** The phone: a bottom sheet with big time steppers and duration chips (prototype `sheetNewHTML`). */
  private sheetView(d: QuickDraft, ctx: CalCtx) {
    const cal = this.cals().find((c) => c.id === d.calId);
    const st = Math.max(15, cal?.slot_step_min ?? 15);
    const len = d.e - d.s;
    const o = (cal && openOn(cal, d.day)) ?? { from: 0, to: 1440 };
    const moveS = (dir: number) => {
      const s = Math.min(Math.max(d.s + dir * st, o.from), o.to - len);
      this.set({ s, e: s + len, allDay: false });
    };
    const moveE = (dir: number) => this.set({ e: Math.min(Math.max(d.e + dir * st, d.s + st), o.to), allDay: false });
    void ctx;
    return html`<div class=${`scrim${this.shown ? ' in' : ''}`} @click=${() => fire(this, 'qc-close')}></div>
      <div class=${`sheet${this.shown ? ' in' : ''}`} role="dialog" aria-modal="true" aria-label="הזמנה חדשה" data-cal-quick="sheet" @keydown=${this.onKey}>
        <div class="grab"></div><h2>הזמנה חדשה</h2>
        <div class="muted">${cal?.name ?? ''} · ${DAY_LONG[d.day.getDay()]} ${ddmm(d.day)} · <span class="ltr num">${mm(d.s)}–${mm(Math.min(d.e, 1440))}</span></div>
        <div class="tbig">
          <div class="tcol"><small>התחלה</small><div class="stp"><button type="button" aria-label="התחלה מאוחר יותר" data-cal-qc-tm="s+" @click=${() => moveS(1)}>+</button><b class="num ltr">${mm(d.s)}</b>
            <button type="button" aria-label="התחלה מוקדם יותר" data-cal-qc-tm="s-" @click=${() => moveS(-1)}>−</button></div></div>
          <div class="tcol"><small>סיום</small><div class="stp"><button type="button" aria-label="סיום מאוחר יותר" data-cal-qc-tm="e+" @click=${() => moveE(1)}>+</button><b class="num ltr">${mm(Math.min(d.e, 1440))}</b>
            <button type="button" aria-label="סיום מוקדם יותר" data-cal-qc-tm="e-" @click=${() => moveE(-1)}>−</button></div></div></div>
        <div class="chips">${[30, 60, 120, 180].map((m) => html`<button type="button" class="chipb" aria-pressed=${String(len === m)} data-cal-qc-len=${m} @click=${() => this.set({ e: Math.min(o.to, d.s + m), allDay: false })}>${durText(m)}</button>`)}</div>
        <input class="inp" data-cal-qc="title" maxlength="120" aria-label="כותרת" placeholder="כותרת" .value=${d.title} @input=${(e: Event) => this.set({ title: (e.target as HTMLInputElement).value })}>
        ${this.attendees(d)}
        ${this.hint ? statusLine(this.hint, cal) : nothing}
        ${this.error ? html`<div class="err" role="alert" data-cal-qc-error>${this.error}</div>` : nothing}
        <div class="qf"><button type="button" class="btn pri wide" ?disabled=${this.hint?.level === 'bad' || this.busy} data-cal-qc-save @click=${() => fire(this, 'qc-save')}><sw-icon name="check" size="16"></sw-icon>${this.saveLabel()}</button>
          <button type="button" class="btn" data-cal-qc-more @click=${() => fire(this, 'qc-more')}>פרטים נוספים</button></div>
      </div>`;
  }
}

/**
 * CAL-GRID-EDIT-2343: the peek card of an entry (prototype `peekHTML`): where, when, who, its state chips, the approved slot a change request
 * keeps, and the actions this viewer has - ערוך, שכפל, מחק (or withdraw), and approve / reject for the calendar's manager on a request.
 * Approving over a confirmed entry asks first ("לאשר ולדחוק") when the installation allows displacing.
 */
@customElement('cal-peek')
export class CalPeek extends LitElement {
  static styles = [calCss, overlayCss, css`
    .pop { inline-size: min(320px, calc(100vw - 16px)); padding: 14px; display: flex; flex-direction: column; gap: 9px; }
    .pkh { display: flex; gap: 8px; align-items: flex-start; }
    .pkh h3 { margin: 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); flex: 1; min-inline-size: 0; line-height: 1.3; overflow-wrap: anywhere; }
    .pkh .sq { inline-size: 12px; block-size: 12px; margin-block-start: 5px; border-radius: var(--sw-r-2xs); }
    .pkl { display: flex; gap: 8px; align-items: center; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
    .pkl sw-icon { color: var(--sw-text-3); flex: none; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; }
    .pka { display: flex; gap: 6px; flex-wrap: wrap; border-block-start: 1px solid var(--sw-border); padding-block-start: 10px; align-items: center; }
    .note { padding: 9px 11px; font-size: var(--sw-fs-sm); }
    .note b { font-size: var(--sw-fs-sm); }
    .sheet .btn { min-block-size: 44px; }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ attribute: false }) occ: Occurrence | null = null;
  @property({ attribute: false }) anchor: Anchor | null = null;
  @property({ type: Boolean }) sheet = false;
  @property({ type: Boolean }) busy = false;
  @property() error = '';
  /** the server answered 409 slot_held: approving now displaces the confirmed entry (asked first) */
  @property({ attribute: false }) displaceAsk: { title: string | null; start: string; end: string } | null = null;
  @state() private shown = false;

  connectedCallback(): void {
    super.connectedCallback();
    requestAnimationFrame(() => requestAnimationFrame(() => (this.shown = true)));
  }

  protected firstUpdated(): void {
    if (!this.sheet) placeAt(this.renderRoot.querySelector('.pop'), this.anchor);
    (this.renderRoot.querySelector('[data-cal-pk-close]') as HTMLElement | null)?.focus({ preventScroll: true });
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('displaceAsk') && !this.sheet) placeAt(this.renderRoot.querySelector('.pop'), this.anchor);
  }

  private cal(): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === this.occ?.calendar_id);
  }

  /** Why this viewer cannot change it (the server's rule in words). */
  whyNot(): string {
    const o = this.occ as Occurrence;
    const cal = this.cal();
    if (!cal?.my_role || cal.my_role === 'view') return 'צפייה בלבד';
    if (o.kind === 'maintenance') return 'חלון תחזוקה נערך בלשונית "תחזוקה"';
    if (new Date(o.end) <= (this.ctx?.now ?? new Date())) return 'המועד כבר עבר';
    if (o.kind === 'external' || o.kind === 'holiday') return 'אירוע מיומן חיצוני';
    return 'רק המארגן או מנהל היומן יכולים לשנות';
  }

  render() {
    const o = this.occ;
    if (!o || !this.ctx) return nothing;
    const body = this.content(o);
    if (this.sheet) {
      return html`<div class=${`scrim${this.shown ? ' in' : ''}`} @click=${() => fire(this, 'pk-close')}></div>
        <div class=${`sheet${this.shown ? ' in' : ''}`} role="dialog" aria-modal="true" aria-label=${o.title ?? 'תפוס'} data-cal-peek="sheet" @keydown=${this.onKey}><div class="grab"></div>${body}</div>`;
    }
    return html`<div class=${`pop${this.shown ? ' in' : ''}`} role="dialog" aria-label=${o.title ?? 'תפוס'} data-cal-peek @keydown=${this.onKey}>${body}</div>`;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      fire(this, 'pk-close');
    }
  }

  private content(o: Occurrence) {
    const ctx = this.ctx as CalCtx;
    const cal = this.cal();
    const ed = !!o.can_edit && new Date(o.end) > ctx.now;
    const dupOk = !!o.title && o.kind !== 'maintenance' && !!cal?.my_role && cal.my_role !== 'view' && !o.recurring;
    const manager = cal?.my_role === 'manage' && o.state === 'pending' && o.kind !== 'maintenance';
    const len = Math.round((new Date(o.end).getTime() - new Date(o.start).getTime()) / 60000);
    const chips = [
      o.state === 'confirmed' && o.kind !== 'maintenance' ? html`<span class="chip ok">מאושר</span>` : nothing,
      o.state === 'pending' ? html`<span class="chip dash">ממתין לאישור</span>` : nothing,
      o.contested ? html`<span class="chip bad"><sw-icon name="warning" size="12"></sw-icon>חופף להזמנה מאושרת</span>` : nothing,
      o.held ? html`<span class="chip warn">בקשת שינוי</span>` : nothing,
      o.kind === 'maintenance' ? html`<span class="chip warn">חלון תחזוקה</span>` : nothing,
      o.state === 'displaced' ? html`<span class="chip warn">נדחק · צריך לבחור מועד אחר</span>` : nothing,
      o.recurring ? html`<span class="chip">חוזר</span>` : nothing,
    ];
    const heldCal = o.held && o.held.calendar_id !== o.calendar_id ? ctx.cals.find((c) => c.id === o.held?.calendar_id)?.name : '';
    return html`<div class="pkh" style=${`--h:${o.kind === 'maintenance' ? 'var(--cal-orange)' : colorVar(cal?.color)}`}><span class="sq"></span><h3>${o.title ?? 'תפוס'}</h3>
        <button type="button" class="btn icon sm x" aria-label="סגירה" data-cal-pk-close @click=${() => fire(this, 'pk-close')}><sw-icon name="close" size="16"></sw-icon></button></div>
      <div class="pkl"><sw-icon name="pin" size="14"></sw-icon><span class="ell">${cal?.name ?? ''}</span></div>
      <div class="pkl"><sw-icon name="clock" size="14"></sw-icon><span>${DAY_LONG[new Date(o.start).getDay()]} ${ddmm(new Date(o.start))} · <span class="ltr num">${hm(o.start)}–${hm(o.end)}</span> · ${durText(len)}</span></div>
      ${o.organizer || o.on_behalf_label ? html`<div class="pkl"><sw-icon name="user" size="14"></sw-icon><span class="ell">${[o.organizer?.name, o.on_behalf_label ? `בשם ${o.on_behalf_label}` : ''].filter(Boolean).join(' · ')}</span></div>` : nothing}
      <div class="chips">${chips}</div>
      ${o.held ? html`<div class="note" role="note" data-cal-pk-held><sw-icon name="info" size="16"></sw-icon><div>המועד הקודם <span class="ltr num">${hm(o.held.start)}–${hm(o.held.end)}</span>${heldCal ? ` ב${heldCal}` : ''} שמור עד ההחלטה. דחייה תחזיר את ההזמנה אליו.</div></div>` : nothing}
      ${!ed ? html`<div class="note" role="note" data-cal-pk-why><sw-icon name="lock" size="16"></sw-icon><div>${this.whyNot()}</div></div>` : nothing}
      ${this.error ? html`<div class="err" role="alert" data-cal-pk-error>${this.error}</div>` : nothing}
      ${ed || dupOk ? html`<div class="pka">
        ${ed ? html`<button type="button" class="btn sm" data-cal-pk="edit" @click=${() => fire(this, 'pk-edit')}><sw-icon name="edit" size="14"></sw-icon>ערוך</button>` : nothing}
        ${dupOk ? html`<button type="button" class="btn sm" ?disabled=${this.busy} data-cal-pk="dup" @click=${() => fire(this, 'pk-dup')}><sw-icon name="copy" size="14"></sw-icon>שכפל</button>` : nothing}
        ${ed ? html`<button type="button" class="btn sm bad" ?disabled=${this.busy} data-cal-pk="del" @click=${() => fire(this, 'pk-del')}><sw-icon name="trash" size="14"></sw-icon>${deleteLabel(o)}</button>
          ${this.sheet ? nothing : html`<span class="kb"><kbd>Del</kbd> מחיקה</span>`}` : nothing}</div>` : nothing}
      ${manager ? html`<div class="pka">
        <button type="button" class="btn sm pri" ?disabled=${this.busy} data-cal-pk="approve" @click=${() => fire(this, 'pk-approve', { displace: false })}><sw-icon name="check" size="14"></sw-icon>אישור</button>
        <button type="button" class="btn sm bad" ?disabled=${this.busy} data-cal-pk="reject" @click=${() => fire(this, 'pk-reject')}><sw-icon name="close" size="14"></sw-icon>דחייה</button></div>` : nothing}
      ${this.displaceAsk ? html`<div class="note warn" role="alert" data-cal-pk-displace><sw-icon name="warning" size="16"></sw-icon><div><b>יש הזמנה מאושרת בחלון</b>
        ${this.displaceAsk.title ? `"${this.displaceAsk.title}" ` : ''}<span class="ltr num">${hm(this.displaceAsk.start)}–${hm(this.displaceAsk.end)}</span>. אישור ידחק אותה: היא לא תימחק, והמארגן יבחר מועד אחר.
        <div class="pka" style="border:0;padding-block-start:8px"><button type="button" class="btn sm bad fill" ?disabled=${this.busy} data-cal-pk="displace" @click=${() => fire(this, 'pk-approve', { displace: true })}>לאשר ולדחוק</button>
          <button type="button" class="btn sm" @click=${() => fire(this, 'pk-back')}>חזרה</button></div></div></div>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-quick-create': CalQuickCreate;
    'cal-peek': CalPeek;
  }
}
