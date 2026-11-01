import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import type { Calendar, Equipment, RoomDay } from '../api/calendars';
import { CAL_EVENTS, emit, visibleCals, type CalCtx } from './ctx';
import { DAY_LONG, MONTHS, addDays, colorVar, hm, isoDate, markOf, pad, pageOf, sameDay, span, startOfDay, timelineWindow } from './model';
import { calCss } from './styles';
import { EQUIPMENT_LABEL, firstFree, parseDateParam, readHashParam, trackLanes, writeHashParams } from './booking-logic';

const CAPACITY_STEPS = [0, 6, 10, 20, 50];

/**
 * CALENDARS-UI-2310 slice A: יומנים › חדרים לפי שעות - the rooms timeline of one day (the approved round-8 mock-up). One row per room
 * (name, capacity, floor, "באישור", a lock for view-only), a time axis left to right inside the RTL page (like the schedules day bar), hour
 * lines, closed hours hatched, the now line with its time pill, entries with the kind marks (a maintenance window and the booking it displaced
 * get two bands). The phone shows a 6-hour window that moves by 3 hours. Capacity and equipment filters, "מצא חדר פנוי" (the first free hour
 * from now, drawn dashed, one tap books it). Rows that do not fit page instead of scrolling.
 */
@customElement('cal-view-rooms')
export class CalViewRooms extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; min-block-size: 0; min-inline-size: 0; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; }
    .big b { font-variant-numeric: tabular-nums; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .tl-row { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 10px; min-block-size: 0; }
    .tl-row.head { block-size: 26px; flex: none; }
    .rows { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; }
    .rows .tl-row { flex: 1 1 0; max-block-size: 86px; min-block-size: 52px; }
    .tl-room { display: flex; align-items: center; gap: 10px; padding-inline: 12px; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); min-inline-size: 0; }
    .tl-room .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .tl-room .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .tl-room .lock { color: var(--sw-text-3); display: inline-flex; }
    .tl-track { position: relative; direction: ltr; background: var(--sw-surface-2); border-radius: var(--sw-r-lg); overflow: hidden; cursor: copy; }
    .tl-track .closed { position: absolute; inset-block: 0; opacity: 0.9; pointer-events: none; }
    .tl-track .hl { position: absolute; inset-block: 0; inline-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .tl-track .ev { position: absolute; padding: 3px 8px; direction: rtl; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); line-height: 1.25; display: flex; flex-direction: column;
      justify-content: center; z-index: 1; }
    .tl-track .ev b { font-size: var(--sw-fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tl-track .ev small { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: var(--sw-fs-xs); }
    .tl-axis { position: relative; direction: ltr; block-size: 26px; }
    .tl-axis span { position: absolute; transform: translateX(-50%); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); color: var(--sw-text-3); top: 4px; }
    .tl-axis span.first { transform: none; }
    .tl-axis span.last { transform: translateX(-100%); }
    .tl-now { position: absolute; inset-block: 0; inline-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .tl-nowlab { position: absolute; top: 2px; line-height: 18px; transform: translateX(-50%); background: var(--sw-accent); color: var(--sw-text-inverse); font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-bold);
      border-radius: var(--sw-r-pill); padding: 1px 7px; z-index: 3; }
    .tl-free { position: absolute; inset-block: 7px; border-radius: var(--sw-r-xs); outline: 1.5px dashed var(--sw-accent); outline-offset: -1.5px; background: var(--sw-accent-soft);
      color: var(--sw-accent-text); display: grid; place-items: center; font-weight: var(--sw-fw-bold); font-size: var(--sw-fs-sm); direction: rtl; z-index: 2; border: 0; font-family: inherit;
      cursor: pointer; white-space: nowrap; overflow: hidden; }
    .legend { flex: none; }
    .legend i[data-k='closed'] { box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .pop { position: absolute; z-index: calc(var(--sw-z-drawer) + 1); inset-block-start: 56px; inset-inline-end: 16px; background: var(--sw-menu-surface); border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-3); padding: 8px; display: grid; gap: 2px; min-inline-size: 200px; }
    .pop label { display: flex; gap: 8px; align-items: center; min-block-size: 34px; padding-inline: 8px; border-radius: var(--sw-r-sm); font-size: var(--sw-fs-md); cursor: pointer; }
    .pop label:hover { background: var(--sw-hover-wash); }
    .btn[aria-pressed='true'] { background: var(--sw-accent-soft); color: var(--sw-accent-text); border-color: transparent; }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    .found { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    @media (max-width: 1179px) { .tl-row { grid-template-columns: 200px minmax(0, 1fr); } }
    @media (max-width: 699px) {
      .panel { padding: 12px; gap: 8px; }
      .big { font-size: var(--sw-fs-xl); }
      .tl-row { grid-template-columns: 112px minmax(0, 1fr); gap: 6px; }
      .tl-room { padding-inline: 8px; gap: 6px; }
      .tl-room .name { font-size: var(--sw-fs-md); }
      .tl-room .dot { display: none; }
      .rows .tl-row { min-block-size: 56px; }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @state() private day: Date = startOfDay(new Date());
  @state() private rooms: RoomDay[] | null = null;
  @state() private error = '';
  @state() private capacity = 0;
  @state() private equipment = new Set<Equipment>();
  @state() private eqOpen = false;
  @state() private page = 1;
  @state() private per = 8;
  @state() private shift = 0;
  @state() private free: { room: string; start: Date; end: Date } | null | undefined = undefined;
  private loadedKey = '';
  private ro: ResizeObserver | null = null;
  private host: EventTarget | null = null;
  private onChanged = () => {
    this.loadedKey = '';
    void this.load();
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.day = parseDateParam(readHashParam('date'), this.ctx?.now ?? new Date());
    this.ro = new ResizeObserver(() => this.fit());
    this.host = (this.getRootNode() as ShadowRoot).host ?? null;
    this.host?.addEventListener(CAL_EVENTS.changed, this.onChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.host?.removeEventListener(CAL_EVENTS.changed, this.onChanged);
  }

  protected updated(): void {
    const rows = this.renderRoot.querySelector('.tl');
    if (rows && this.ro) this.ro.observe(rows);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('ctx') || changed.has('day')) void this.load();
  }

  /** How many room rows fit the panel (a row is at least 52 px, 56 on the phone, plus the 6 px gap): the rest go to the next page. */
  private fit(): void {
    const tl = this.renderRoot.querySelector('.tl') as HTMLElement | null;
    if (!tl) return;
    const rowMin = (this.ctx?.device === 'phone' ? 56 : 52) + 6;
    const per = Math.max(1, Math.floor((tl.clientHeight - 32) / rowMin));
    if (per !== this.per) this.per = per;
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const key = `${isoDate(this.day)}|${ctx.cals.map((c) => c.id).join(',')}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    try {
      const r = await ctx.api.roomsDay(isoDate(this.day));
      if (key !== this.loadedKey) return;
      this.rooms = r.rooms;
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  private go(step: number): void {
    this.day = addDays(this.day, step);
    this.free = undefined;
    writeHashParams({ date: isoDate(this.day) });
  }

  private calOf(id: string): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === id);
  }

  private filtered(): RoomDay[] {
    const ctx = this.ctx as CalCtx;
    const allowed = new Set(visibleCals(ctx).map((c) => c.id));
    return (this.rooms ?? []).filter((r) => allowed.has(r.calendar_id) && (!this.capacity || (r.capacity ?? 0) >= this.capacity) && [...this.equipment].every((e) => r.equipment.includes(e)));
  }

  private findFree(): void {
    const ctx = this.ctx as CalCtx;
    const list = this.filtered().filter((r) => {
      const c = this.calOf(r.calendar_id);
      return c?.my_role && c.my_role !== 'view';
    });
    this.free = firstFree(list, this.day, ctx.now, 60);
    if (this.free) {
      const i = this.filtered().findIndex((r) => r.calendar_id === this.free?.room);
      this.page = Math.floor(i / this.per) + 1;
    }
  }

  private book(room: string, start: Date, end: Date): void {
    emit(this, CAL_EVENTS.newEvent, { calendarId: room, start: start.toISOString(), end: end.toISOString() });
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return nothing;
    const phone = ctx.device === 'phone';
    const base = timelineWindow(phone, ctx.now);
    const win = phone ? { from: Math.min(Math.max(base.from + this.shift, 0), 18), to: Math.min(Math.max(base.from + this.shift, 0), 18) + 6 } : base;
    const rooms = this.filtered();
    const pg = pageOf(rooms, this.page, this.per);
    const today = sameDay(this.day, ctx.now);
    const title = phone ? `${DAY_LONG[this.day.getDay()]}, ${this.day.getDate()}.${pad(this.day.getMonth() + 1)}` : `${DAY_LONG[this.day.getDay()]}, `;
    return html`<section class="panel main" data-cal-rooms>
      <div class="ph">
        <span class="big" data-cal-title>${phone ? title : html`${title}<b>${this.day.getDate()}</b> ב${MONTHS[this.day.getMonth()]}`}</span>
        <button type="button" class="btn icon sm" aria-label="יום קודם" data-cal-prev @click=${() => this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <button type="button" class="btn icon sm" aria-label="יום הבא" data-cal-next @click=${() => this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
        ${phone
          ? html`<button type="button" class="btn sm num ltr" data-cal-window aria-label="חלון השעות" @click=${() => (this.shift = this.shift >= 6 ? -6 : this.shift + 3)}>${pad(win.from)}:00–${pad(win.to % 24)}:00</button>`
          : today ? nothing : html`<button type="button" class="btn sm" data-cal-today @click=${() => { this.day = startOfDay(ctx.now); writeHashParams({ date: isoDate(this.day) }); }}>היום</button>`}
        <span class="sp"></span>
        ${phone ? nothing : html`
          <button type="button" class="btn sm" data-cal-capacity aria-pressed=${String(this.capacity > 0)} @click=${() => this.nextCapacity()}><sw-icon name="users" size="16"></sw-icon>${this.capacity ? html`<span class="num">${this.capacity}+</span> מקומות` : 'כל הקיבולות'}</button>
          <button type="button" class="btn sm" data-cal-equipment aria-pressed=${String(this.equipment.size > 0)} aria-expanded=${String(this.eqOpen)} @click=${() => (this.eqOpen = !this.eqOpen)}><sw-icon name="filter" size="16"></sw-icon>ציוד${this.equipment.size ? html` <span class="num">${this.equipment.size}</span>` : nothing}</button>`}
        <button type="button" class="btn sm" data-cal-find @click=${() => this.findFree()}><sw-icon name="search" size="16"></sw-icon>${phone ? 'חדר פנוי' : 'מצא חדר פנוי'}</button>
      </div>
      ${this.eqOpen ? this.equipmentPop() : nothing}
      ${this.error ? html`<div class="fail" role="alert">${this.error}</div>` : nothing}
      ${this.free === null ? html`<div class="found" role="status" data-cal-free-none>אין היום חדר פנוי לשעה אחת שמתאים לסינון.</div>` : nothing}
      ${this.rooms && !rooms.length
        ? html`<sw-state-panel icon="calendar" state="empty" data-cal-rooms-empty heading=${this.rooms.length ? 'אין חדר שמתאים לסינון' : 'אין חדרים להזמנה'}
            hint=${this.rooms.length ? 'אפשר לשנות את הקיבולת או את הציוד.' : 'חדר הוא יומן מסוג "חדר": קיבולת, ציוד, שעות פתיחה ואישור.'}></sw-state-panel>`
        : this.timeline(pg.items, win, today)}
      ${pg.pages > 1 ? html`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="חדרים קודמים" ?disabled=${pg.page <= 1} @click=${() => (this.page = pg.page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
        <span class="num">${pg.page} / ${pg.pages}</span><button type="button" class="btn sm" aria-label="חדרים הבאים" ?disabled=${pg.page >= pg.pages} @click=${() => (this.page = pg.page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>` : nothing}
      ${phone ? nothing : this.legend()}
    </section>`;
  }

  private nextCapacity(): void {
    const i = CAPACITY_STEPS.indexOf(this.capacity);
    this.capacity = CAPACITY_STEPS[(i + 1) % CAPACITY_STEPS.length];
    this.page = 1;
  }

  private equipmentPop() {
    return html`<div class="pop" role="group" aria-label="ציוד" data-cal-equipment-pop>
      ${(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map((e) => html`<label><input type="checkbox" .checked=${this.equipment.has(e)} @change=${() => {
        const s = new Set(this.equipment);
        if (s.has(e)) s.delete(e);
        else s.add(e);
        this.equipment = s;
        this.page = 1;
      }}>${EQUIPMENT_LABEL[e]}</label>`)}
      <button type="button" class="btn sm" @click=${() => (this.eqOpen = false)}>סגירה</button></div>`;
  }

  private timeline(rooms: RoomDay[], win: { from: number; to: number }, today: boolean) {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const hours = win.to - win.from;
    const nowL = today ? ((ctx.now.getHours() * 60 + ctx.now.getMinutes() - win.from * 60) / (hours * 60)) * 100 : -1;
    const showNow = nowL > 0 && nowL < 100;
    const axis = Array.from({ length: hours + 1 }, (_, k) => {
      const x = (k / hours) * 100;
      if (showNow && Math.abs(x - nowL) < (phone ? 9 : 3)) return nothing; // the hour under the now pill is dropped
      return html`<span class=${`num${k === 0 ? ' first' : k === hours ? ' last' : ''}`} style=${`left:${x}%`}>${pad((win.from + k) % 24)}${phone ? '' : ':00'}</span>`;
    });
    return html`<div class="tl" data-cal-timeline>
      <div class="tl-row head"><div></div><div class="tl-axis">${axis}${showNow ? html`<span class="tl-nowlab num" style=${`left:${nowL}%`}>${hm(ctx.now)}</span>` : nothing}</div></div>
      <div class="rows">${rooms.map((r) => this.row(r, win, showNow ? nowL : -1))}</div>
    </div>`;
  }

  private row(r: RoomDay, win: { from: number; to: number }, nowL: number) {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const c = this.calOf(r.calendar_id);
    const hours = win.to - win.from;
    const lines = Array.from({ length: hours - 1 }, (_, k) => html`<div class="hl" style=${`left:${((k + 1) / hours) * 100}%`}></div>`);
    const toPct = (hhmm: string) => {
      const [h, m] = hhmm.split(':').map(Number);
      return Math.min(100, Math.max(0, ((h * 60 + m - win.from * 60) / (hours * 60)) * 100));
    };
    // closed hours: everything outside the open windows
    const open = r.open.map((w) => [toPct(w.from), toPct(w.to)] as const).sort((a, b) => a[0] - b[0]);
    const closed: [number, number][] = [];
    let at = 0;
    for (const [a, b] of open) {
      if (a > at) closed.push([at, a]);
      at = Math.max(at, b);
    }
    if (at < 100) closed.push([at, 100]);
    const entries = r.entries.filter((o) => !['cancelled', 'rejected', 'withdrawn', 'expired'].includes(o.state)).sort((a, b) => a.start.localeCompare(b.start));
    const lanes = trackLanes(entries);
    const nLanes = Math.max(1, ...lanes.map((l) => l + 1));
    const free = this.free && this.free.room === r.calendar_id ? span({ start: this.free.start.toISOString(), end: this.free.end.toISOString() }, this.day, win.from, win.to) : null;
    const sub = [`${r.capacity ?? '-'} מקומות`, phone ? '' : c?.floor_name ?? '', !phone && c && c.approval_mode !== 'none' ? 'באישור' : ''].filter(Boolean).join(' · ');
    return html`<div class="tl-row" data-cal-room=${r.calendar_id}>
      <div class="tl-room"><span class="dot" style=${`--h:${colorVar(c?.color)}`}></span>
        <div class="grow"><div class="name ell" title=${r.name}>${r.name}</div><div class="sub ell">${sub}</div></div>
        ${c?.my_role === 'view' ? html`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>` : nothing}</div>
      <div class="tl-track" @click=${(e: MouseEvent) => this.trackClick(e, r, win)}>
        ${closed.filter(([a, b]) => b > a).map(([a, b]) => html`<div class="closed" style=${`left:${a}%;width:${b - a}%`}></div>`)}
        ${lines}
        ${entries.map((o, i) => {
          const sp = span(o, this.day, win.from, win.to);
          if (!sp) return nothing;
          const band = 100 / nLanes;
          const top = `calc(${lanes[i] * band}% + ${nLanes > 1 ? 3 : 7}px)`;
          const h = `calc(${band}% - ${nLanes > 1 ? 6 : 14}px)`;
          const mark = markOf(o);
          const who = o.state === 'pending' ? 'ממתין לאישור' : mark === 'displaced' ? 'נדחק בגלל תחזוקה' : o.on_behalf_label ? `בשם: ${o.on_behalf_label}` : o.organizer?.name ?? '';
          const wide = sp.width > (phone ? 30 : 8) && nLanes === 1;
          return html`<button type="button" class="ev" data-mark=${mark} data-cal-entry=${o.event_id} style=${`--h:${colorVar(mark === 'maint' ? 'orange' : c?.color)};left:${sp.start}%;width:${sp.width}%;top:${top};height:${h}`}
            title=${`${o.title ?? 'תפוס'} · ${hm(o.start)}–${hm(o.end)}`} @click=${(e: Event) => { e.stopPropagation(); emit(this, CAL_EVENTS.newEvent, { eventId: o.event_id }); }}>
            <b>${o.title ?? 'תפוס'}</b>${wide && who ? html`<small>${who}</small>` : nothing}</button>`;
        })}
        ${free ? html`<button type="button" class="tl-free" data-cal-free style=${`left:${free.start}%;width:${free.width}%`} @click=${(e: Event) => { e.stopPropagation(); this.book(r.calendar_id, (this.free as { start: Date }).start, (this.free as { end: Date }).end); }}>
          פנוי · <span class="num">${hm((this.free as { start: Date }).start)}</span></button>` : nothing}
        ${nowL > 0 ? html`<div class="tl-now" style=${`left:${nowL}%`}></div>` : nothing}
      </div></div>`;
  }

  /** A tap on the free part of a room's track opens the new booking drawer at that half hour, if the viewer may book that room. */
  private trackClick(e: MouseEvent, r: RoomDay, win: { from: number; to: number }): void {
    const c = this.calOf(r.calendar_id);
    if (!this.ctx?.access.can.book || !c?.my_role || c.my_role === 'view') return;
    const t = e.currentTarget as HTMLElement;
    const b = t.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientX - b.left) / b.width, 0), 1);
    const mins = Math.floor((win.from * 60 + frac * (win.to - win.from) * 60) / 30) * 30;
    const s = new Date(startOfDay(this.day).getTime() + mins * 60000);
    this.book(r.calendar_id, s, new Date(s.getTime() + 60 * 60000));
  }

  private legend() {
    return html`<div class="legend" data-cal-legend>
      <span><i class="ev" style="--h:var(--cal-blue)"></i>מאושר</span>
      <span><i class="ev" data-mark="pending" style="--h:var(--cal-blue)"></i>ממתין לאישור</span>
      <span><i class="ev" data-mark="maint"></i>תחזוקה</span>
      <span><i class="ev" data-mark="displaced"></i>נדחק בגלל תחזוקה</span>
      <span><i class="closed" data-k="closed"></i>סגור</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-rooms': CalViewRooms;
  }
}
