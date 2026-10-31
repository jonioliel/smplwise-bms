import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { ApiError, describeError } from '../api/client';
import { dateInputLang } from '../api/day-format';
import type { MaintPreview, OverlapMode } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx, type NewMaintDetail } from './ctx';
import { calCss } from './styles';
import { addDays, colorVar, ddmm, hm, isoDate, OVERLAP_LABEL, sameDay, STATE_LABEL } from './model';

/** What saving does in each overlap mode (contract section 8, C3; the warning itself is shown in every mode). */
const MODE_TEXT: Record<OverlapMode, string> = {
  first_holds: 'החלון יישמר כממתין ומסומן "מתחרה". אף הזמנה לא נדחקת עד שמנהלי החדרים מחליטים.',
  override_notify: 'ההזמנות החופפות יעברו ל"נדחק" (לא נמחקות) והמארגנים יקבלו הודעה עם 3 זמנים חלופיים.',
  block: 'השמירה חסומה. הזיזו את החלון או בחרו זמן פנוי.',
  ask: 'בחרו מה יקרה להזמנות החופפות.',
};

/**
 * CALENDARS-UI-2310 slice B: "חלון תחזוקה חדש" - a maintenance window over one or more rooms. The overlap with existing entries is previewed
 * before saving (POST /calendar/maintenance/preview) and always shown; what saving does follows the installation's (or the room's own)
 * overlap mode - the first confirmed holds (default, the window waits as a request), maintenance wins and the organizers are told, it cannot
 * be placed (free windows of the same length are offered), or ask each time (the planner chooses, the choice is stored with the window).
 */
@customElement('cal-maint-drawer')
export class CalMaintDrawer extends LitElement {
  static styles = [calCss, css`
    :host { position: fixed; inset: 0; z-index: var(--sw-z-modal); display: block; }
    .scrim { position: absolute; inset: 0; background: var(--sw-overlay); }
    aside { position: absolute; inset-block: 0; inset-inline-start: 0; inline-size: min(500px, 100vw); background: var(--sw-surface-solid); box-shadow: var(--sw-shadow-3);
      display: flex; flex-direction: column; animation: in var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    @keyframes in { from { transform: translateX(24px); opacity: 0; } }
    header { display: flex; align-items: flex-start; gap: 12px; padding: 18px 22px 10px; }
    header h2 { margin: 0; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .body { flex: 1; min-block-size: 0; overflow: hidden; padding: 6px 22px 12px; display: flex; flex-direction: column; gap: 12px; }
    footer { display: flex; gap: 10px; padding: 14px 22px calc(14px + env(safe-area-inset-bottom)); border-block-start: 1px solid var(--sw-border); }
    .ctls { display: flex; gap: 8px; min-inline-size: 0; }
    .ctls > .inp { inline-size: auto; flex: 1 1 0; padding-inline: 10px; }
    .ctls > .inp[type='date'] { flex-grow: 1.5; }
    .rooms { display: flex; flex-wrap: wrap; gap: 6px; }
    .room { font: inherit; font-size: var(--sw-fs-sm); display: inline-flex; align-items: center; gap: 6px; min-block-size: 32px; padding: 0 12px; border-radius: var(--sw-r-pill);
      border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-text-2); cursor: pointer; max-inline-size: 100%; }
    .room[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-heading); border-color: transparent; font-weight: var(--sw-fw-semibold); }
    .room span.ell { max-inline-size: 180px; }
    .ovl { display: flex; flex-direction: column; gap: 6px; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-warning-soft); }
    .ovl.bad { background: var(--sw-danger-soft); }
    .ovl > b { display: flex; gap: 8px; align-items: center; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-solid); min-inline-size: 0; }
    .orow .t { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .orow .s { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .modeline { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: flex; gap: 6px; align-items: center; }
    .modeline b { color: var(--sw-heading); }
    .opt { display: flex; gap: 10px; align-items: flex-start; padding: 10px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent;
      cursor: pointer; text-align: start; font: inherit; color: inherit; inline-size: 100%; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .opt .rad { inline-size: 18px; block-size: 18px; border-radius: 50%; border: 2px solid var(--sw-border-strong); flex: none; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border: 5px solid var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); font-size: var(--sw-fs-md); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .sugg { display: flex; gap: 8px; flex-wrap: wrap; }
    .err { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .more { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    @media (max-width: 699px) {
      aside { inset: auto 0 0 0; inline-size: 100%; max-block-size: 94dvh; border-start-start-radius: var(--sw-r-2xl); border-start-end-radius: var(--sw-r-2xl); }
      header { padding: 14px 16px 6px; } .body { padding: 4px 16px 8px; gap: 10px; } footer { padding-inline: 16px; }
      .fld { grid-template-columns: minmax(0, 1fr); }
      @keyframes in { from { transform: translateY(24px); opacity: 0; } }
    }
    @media (prefers-reduced-motion: reduce) { aside { animation: none; } }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @property({ attribute: false }) detail: NewMaintDetail | null = null;
  @state() private calId = '';
  @state() private evTitle = '';
  @state() private date = '';
  @state() private from = '';
  @state() private to = '';
  @state() private rooms: string[] = [];
  @state() private devices = '';
  @state() private preview: MaintPreview | null = null;
  @state() private decision: 'override_notify' | 'block' = 'override_notify';
  @state() private busy = false;
  @state() private err = '';
  private timer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    const now = this.ctx?.now ?? new Date();
    const d = this.detail ?? {};
    const s = d.start ? new Date(d.start) : new Date(Math.ceil(now.getTime() / 1_800_000) * 1_800_000 + 3_600_000);
    const e = d.end ? new Date(d.end) : new Date(s.getTime() + 150 * 60000);
    this.date = isoDate(s);
    this.from = hm(s);
    this.to = hm(e);
    this.calId = this.maintCals()[0]?.id ?? '';
    const rooms = this.roomCals();
    this.rooms = d.rooms?.length ? d.rooms.filter((r) => rooms.some((c) => c.id === r)) : rooms.slice(0, 1).map((c) => c.id);
    window.addEventListener('keydown', this.onKey);
    this.schedule();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.onKey);
    clearTimeout(this.timer);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') this.close();
  };

  private maintCals() {
    return (this.ctx?.cals ?? []).filter((c) => c.type === 'maintenance' && c.my_role && c.my_role !== 'view');
  }

  private roomCals() {
    return (this.ctx?.cals ?? []).filter((c) => c.type === 'room');
  }

  private span(): { start: string; end: string } | null {
    if (!this.date || !this.from || !this.to) return null;
    const s = new Date(`${this.date}T${this.from}:00`);
    let e = new Date(`${this.date}T${this.to}:00`);
    if (e <= s) e = addDays(e, 1);
    return Number.isNaN(s.getTime()) ? null : { start: s.toISOString(), end: e.toISOString() };
  }

  private schedule(): void {
    clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.runPreview(), 250);
  }

  private async runPreview(): Promise<void> {
    const sp = this.span();
    if (!this.ctx || !sp || !this.rooms.length || !this.calId) {
      this.preview = null;
      return;
    }
    try {
      this.preview = await this.ctx.api.maintPreview({ calendar_id: this.calId, rooms: this.rooms, ...sp });
      this.err = '';
    } catch (e) {
      this.preview = null;
      this.err = describeError(e);
    }
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close'));
  }

  private async save(): Promise<void> {
    const sp = this.span();
    if (!this.ctx || !sp) return;
    if (!this.evTitle.trim()) {
      this.err = 'צריך כותרת לחלון.';
      return;
    }
    const mode = this.preview?.mode;
    const overlaps = this.preview?.overlaps.length ?? 0;
    this.busy = true;
    this.err = '';
    try {
      const out = await this.ctx.api.maintPlace({ calendar_id: this.calId, title: this.evTitle.trim(), rooms: this.rooms, ...sp, notes: this.devices.trim() || undefined,
        overlap_decision: mode === 'ask' && overlaps ? this.decision : undefined });
      const n = out.displaced.length;
      emit(this, CAL_EVENTS.toast, out.event.state === 'pending' ? 'החלון נשמר כממתין להחלטת מנהלי החדרים' : n ? `החלון הוצב; ${n} הזמנות נדחקו והמארגנים קיבלו הודעה` : 'חלון התחזוקה הוצב');
      emit(this, CAL_EVENTS.changed);
      this.close();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'maintenance_overlap') this.err = 'אי אפשר להציב את החלון מעל הזמנה. בחרו אחד מהזמנים הפנויים.';
      else if (e instanceof ApiError && e.code === 'overlap_decision_required') this.err = 'יש חפיפה עם הזמנות קיימות. יש לבחור מה לעשות.';
      else this.err = describeError(e);
      void this.runPreview();
    } finally {
      this.busy = false;
    }
  }

  private useAlt(a: { start: string; end: string }): void {
    const s = new Date(a.start);
    this.date = isoDate(s);
    this.from = hm(s);
    this.to = hm(a.end);
    this.schedule();
  }

  render() {
    const cals = this.maintCals();
    const rooms = this.roomCals();
    const pv = this.preview;
    const overlaps = pv?.overlaps ?? [];
    const mode = pv?.mode ?? 'first_holds';
    const blocked = !!overlaps.length && (mode === 'block' || (mode === 'ask' && this.decision === 'block'));
    const now = this.ctx?.now ?? new Date();
    const sp = this.span();
    const dayText = sp ? (sameDay(new Date(sp.start), now) ? 'היום' : ddmm(new Date(sp.start))) : '';
    const label = blocked ? 'אי אפשר לשמור' : overlaps.length && mode === 'first_holds' ? 'שמירה כממתין להחלטה' : 'הצבת החלון';
    const shown = overlaps.slice(0, this.ctx?.device === 'phone' ? 2 : 3);
    const roomName = (id: string) => this.ctx?.cals.find((c) => c.id === id)?.name ?? '';
    return html`<div class="scrim" @click=${() => this.close()}></div>
      <aside role="dialog" aria-modal="true" aria-label="חלון תחזוקה חדש" data-maint-drawer data-mode=${mode}>
        <header><div class="grow"><h2>חלון תחזוקה חדש</h2><div class="muted num">${this.rooms.length} ${this.rooms.length === 1 ? 'חדר' : 'חדרים'}${dayText ? ` · ${dayText}` : ''}</div></div>
          <button type="button" class="btn icon" aria-label="סגירה" @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body">
          ${!cals.length ? html`<div class="note warn" data-no-maint-cal><div><b>אין יומן אחזקה שאפשר להציב בו</b><span class="muted">מנהל המערכת יוצר יומן מסוג אחזקה במסך ניהול יומנים.</span></div></div>` : nothing}
          <div class="fld"><label for="mc">יומן</label><select id="mc" class="inp" .value=${this.calId} @change=${(e: Event) => { this.calId = (e.target as HTMLSelectElement).value; this.schedule(); }}>
            ${cals.map((c) => html`<option value=${c.id} ?selected=${c.id === this.calId}>${c.name}</option>`)}</select></div>
          <div class="fld"><label for="mt">כותרת</label><input id="mt" class="inp" maxlength="120" placeholder="למשל: החלפת גוף תאורה ובדיקת גלאים" .value=${this.evTitle}
            @input=${(e: Event) => (this.evTitle = (e.target as HTMLInputElement).value)} data-maint-title></div>
          <div class="fld"><span class="lbl">מתי</span><div class="ctls">
            <input class="inp num" type="date" lang=${dateInputLang()} aria-label="תאריך" .value=${this.date} @change=${(e: Event) => { this.date = (e.target as HTMLInputElement).value; this.schedule(); }}>
            <input class="inp num" type="time" lang=${dateInputLang()} step="900" aria-label="משעה" .value=${this.from} @change=${(e: Event) => { this.from = (e.target as HTMLInputElement).value; this.schedule(); }} data-maint-from>
            <input class="inp num" type="time" lang=${dateInputLang()} step="900" aria-label="עד שעה" .value=${this.to} @change=${(e: Event) => { this.to = (e.target as HTMLInputElement).value; this.schedule(); }} data-maint-to></div></div>
          <div class="fld"><span class="lbl">חדרים</span><div class="rooms" role="group" aria-label="חדרים">${rooms.slice(0, this.ctx?.device === 'phone' ? 6 : 10).map((c) => {
            const on = this.rooms.includes(c.id);
            return html`<button type="button" class="room" aria-pressed=${String(on)} data-room=${c.id} title=${c.name}
              @click=${() => { this.rooms = on ? this.rooms.filter((x) => x !== c.id) : [...this.rooms, c.id]; this.schedule(); }}><span class="dot" style=${`--h:${colorVar(c.color)}`}></span><span class="ell">${c.name}</span></button>`;
          })}</div></div>
          <div class="fld"><label for="md">מכשירים</label><input id="md" class="inp" maxlength="200" placeholder='למשל: תאורה ו-2 גלאי עשן · "צפויה חריגה"' .value=${this.devices}
            @input=${(e: Event) => (this.devices = (e.target as HTMLInputElement).value)}></div>
          ${overlaps.length ? html`<div class=${`ovl ${mode === 'block' ? 'bad' : ''}`} data-overlaps>
            <b><sw-icon name="warning" size="16"></sw-icon>החלון חופף ל-<span class="num">${overlaps.length}</span> ${overlaps.length === 1 ? 'הזמנה' : 'הזמנות'}</b>
            ${shown.map((o) => html`<div class="orow" data-overlap=${o.event_id}><div class="grow"><div class="t ell" title=${o.title ?? 'תפוס'}>${o.title ?? 'תפוס'}</div>
              <div class="s ell">${roomName(o.calendar_id)}${o.organizer?.name ? ` · ${o.organizer.name}` : ''}</div></div>
              <b class="num ltr">${hm(o.start)}–${hm(o.end)}</b><span class=${`chip ${o.state === 'confirmed' ? 'ok' : 'dash'}`}>${o.state === 'confirmed' ? 'מאושר' : STATE_LABEL[o.state]}</span></div>`)}
            ${overlaps.length > shown.length ? html`<span class="more num">ועוד ${overlaps.length - shown.length}</span>` : nothing}</div>
            <div class="modeline"><sw-icon name="info" size="14"></sw-icon>לפי ההגדרה: <b>${OVERLAP_LABEL[mode]}</b></div>
            ${mode === 'ask' ? html`<div role="radiogroup" aria-label="מה יקרה להזמנות" style="display:flex;flex-direction:column;gap:6px">
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision === 'override_notify')} data-decision="override_notify" @click=${() => (this.decision = 'override_notify')}><span class="rad"></span><span><b>התחזוקה גוברת</b><small>ההזמנות נדחקות והמארגנים מקבלים הודעה</small></span></button>
                <button type="button" class="opt" role="radio" aria-checked=${String(this.decision === 'block')} data-decision="block" @click=${() => (this.decision = 'block')}><span class="rad"></span><span><b>לא להציב</b><small>לחזור ולבחור זמן אחר</small></span></button></div>`
              : html`<div class="muted" data-mode-text>${MODE_TEXT[mode]}</div>`}
            ${blocked && pv?.alternatives.length ? html`<div class="sugg" data-alternatives>${pv.alternatives.slice(0, 3).map((a) => html`<button type="button" class="btn sm" @click=${() => this.useAlt(a)}>
              ${sameDay(new Date(a.start), now) ? '' : `${ddmm(new Date(a.start))} `}<span class="num ltr">${hm(a.start)}–${hm(a.end)}</span></button>`)}</div>` : nothing}`
          : pv ? html`<div class="note" data-no-overlap><sw-icon name="check" size="16"></sw-icon><div><b>אין חפיפה עם הזמנות</b><span class="muted">החלון יוצב מיד.</span></div></div>` : nothing}
          ${this.err ? html`<div class="err" role="alert" data-maint-error>${this.err}</div>` : nothing}
        </div>
        <footer>
          <button type="button" class="btn pri" ?disabled=${blocked || this.busy || !cals.length || !this.rooms.length} data-maint-save @click=${() => void this.save()}><sw-icon name="wrench" size="16"></sw-icon>${label}</button>
          <button type="button" class="btn" @click=${() => this.close()}>ביטול</button>
        </footer>
      </aside>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-maint-drawer': CalMaintDrawer;
  }
}
