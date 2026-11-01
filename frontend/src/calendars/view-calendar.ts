import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { describeError } from '../api/client';
import type { Calendar, Occurrence } from '../api/calendars';
import { CAL_EVENTS, emit, visibleCals, type CalCtx } from './ctx';
import {
  DAY_LONG, DAY_SHORT, MONTHS, TYPE_GROUP, addDays, colorVar, grouped, hm, isoDate, markOf, minutesOf, monthGrid, onDay, pad, pageOf, placeDay, sameDay, startOfDay, weekStart,
} from './model';
import { calCss } from './styles';
import { parseDateParam, readHashParam, writeHashParams } from './booking-logic';

export type CalMode = 'month' | 'week' | 'day';
const FROM_H = 7;
const TO_H = 22;

/**
 * CALENDARS-UI-2310 slice A: יומנים › יומן - month / week / day with the calendar switcher (the approved round-8 mock-up). The switcher
 * groups the viewer's calendars by type (colour check boxes, a lock for view-only); on a tablet it is hidden and opens on tap (setting
 * `tablet_panels`, owner answer 23A) or kept narrow; on the phone it opens as a sheet. Week and day draw the hour band 07-22 with the now
 * line; entries the sync flagged stand side by side with a red frame (setting `sync_conflict_display`, owner answer 22A). A free part of a
 * column opens the new booking drawer at that time. Nothing scrolls: the month caps the entries per cell ("עוד N"), the day pages its calendars.
 */
@customElement('cal-view-calendar')
export class CalViewCalendar extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; gap: 14px; min-block-size: 0; min-inline-size: 0; position: relative; }
    .main { flex: 1; min-inline-size: 0; }
    .big { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
    .switcher { inline-size: 270px; flex: none; gap: 2px; }
    .switcher.narrow { inline-size: 210px; }
    .switcher .grp { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); margin: 8px 4px 2px; }
    .switcher .list { min-block-size: 0; overflow: hidden; display: flex; flex-direction: column; gap: 1px; }
    .cal-it { display: flex; align-items: center; gap: 10px; min-block-size: 32px; padding-inline: 8px; border-radius: var(--sw-r-md); font: inherit; font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold); color: var(--sw-text); background: transparent; border: 0; cursor: pointer; text-align: start; inline-size: 100%; -webkit-tap-highlight-color: transparent; flex: none; }
    .cal-it .box { inline-size: 18px; block-size: 18px; border-radius: var(--sw-r-xs); flex: none; display: grid; place-items: center; box-shadow: inset 0 0 0 2px var(--h); color: var(--sw-text-inverse); }
    .cal-it[aria-pressed='true'] .box { background: var(--h); }
    .cal-it[aria-pressed='false'] { color: var(--sw-text-2); }
    .cal-it[aria-pressed='false'] .box sw-icon { visibility: hidden; }
    .cal-it .lock { margin-inline-start: auto; color: var(--sw-text-3); display: inline-flex; }
    @media (hover: hover) { .cal-it:hover { background: var(--sw-hover-wash); } }
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); }
    .switcher.overlay { position: fixed; inset-block: 12px; inset-inline-end: 12px; z-index: calc(var(--sw-z-modal) + 1); box-shadow: var(--sw-shadow-3); inline-size: min(300px, calc(100vw - 24px)); }
    .month { flex: 1; min-block-size: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .mhead, .mgrid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); }
    .mhead div { padding: 0 8px 6px; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); }
    .mgrid { grid-template-rows: repeat(6, minmax(0, 1fr)); gap: 3px; min-block-size: 0; }
    .mcell { background: var(--sw-surface-2); border-radius: var(--sw-r-md); padding: 6px 6px 4px; display: flex; flex-direction: column; gap: 3px; min-block-size: 0; min-inline-size: 0;
      overflow: hidden; border: 0; font: inherit; text-align: start; cursor: pointer; color: inherit; -webkit-tap-highlight-color: transparent; }
    .mcell.we { background: var(--sw-surface-3); }
    .mcell.out { opacity: 0.5; }
    .mcell .d { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); display: flex; align-items: center; gap: 6px; min-block-size: 22px; min-inline-size: 0; }
    .mcell.today .d b { background: var(--sw-accent); color: var(--sw-text-inverse); border-radius: var(--sw-r-pill); min-inline-size: 24px; block-size: 22px; display: inline-grid; place-items: center; padding-inline: 6px; }
    .mcell[aria-pressed='true'] { box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .mcell .ev { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); block-size: 20px; line-height: 20px; padding: 0 6px; display: flex; gap: 5px; align-items: center; flex: none; inline-size: 100%; }
    .mcell .ev .t { font-weight: var(--sw-fw-bold); flex: none; }
    .mcell .more { font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-bold); color: var(--sw-text-2); padding-inline: 6px; }
    .dots { display: flex; gap: 3px; flex-wrap: wrap; justify-content: center; }
    .dots i { inline-size: 7px; block-size: 7px; border-radius: 50%; background: var(--h); }
    .week { flex: 1; min-block-size: 0; display: grid; grid-template-columns: 52px repeat(var(--cols), minmax(0, 1fr)); grid-template-rows: auto minmax(0, 1fr); column-gap: 3px; }
    .wh { padding: 0 6px 8px; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); display: flex; gap: 6px; align-items: baseline; min-inline-size: 0;
      border: 0; background: transparent; font-family: inherit; cursor: pointer; text-align: start; }
    .wh b { font-size: var(--sw-fs-2xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .wh.today b { color: var(--sw-accent-text); }
    .wh.cal { align-items: center; cursor: default; }
    .wh.cal b { font-size: var(--sw-fs-lg); }
    .axis { position: relative; }
    .axis span { position: absolute; inset-inline-end: 6px; transform: translateY(-50%); font-size: var(--sw-fs-xs); color: var(--sw-text-3); font-weight: var(--sw-fw-semibold); }
    .axis span:first-child { transform: none; }
    .col { position: relative; background: var(--sw-surface-2); border-radius: var(--sw-r-md); min-block-size: 0; cursor: copy; overflow: hidden; }
    .col.we { background: var(--sw-surface-3); }
    .col .hl { position: absolute; inset-inline: 0; block-size: 1px; background: color-mix(in srgb, var(--sw-text) 7%, transparent); pointer-events: none; }
    .col .ev { position: absolute; padding: 3px 6px; font-size: var(--sw-fs-xs); font-weight: var(--sw-fw-semibold); line-height: 1.3; z-index: 1; }
    .col .ev b { display: flex; gap: 4px; align-items: center; font-size: var(--sw-fs-sm); min-inline-size: 0; }
    .col .ev .tm { display: block; font-variant-numeric: tabular-nums; }
    .col .ev[data-flag='conflict'] sw-icon { color: var(--sw-danger-text); flex: none; }
    .col .allday { position: absolute; inset: 8px 8px auto; font-weight: var(--sw-fw-bold); color: var(--sw-text-2); font-size: var(--sw-fs-sm); pointer-events: none; }
    .now { position: absolute; inset-inline: 0; block-size: 2px; background: var(--sw-accent); z-index: 2; pointer-events: none; }
    .now::before { content: ''; position: absolute; inset-inline-end: -1px; inset-block-start: -4px; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .agenda { display: flex; flex-direction: column; gap: 6px; min-block-size: 0; overflow: hidden; }
    .agenda h3 { margin: 4px 0 0; font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .agenda .row { min-block-size: 44px; border: 0; font: inherit; text-align: start; cursor: pointer; inline-size: 100%; flex: none; }
    .agenda .row b { color: var(--sw-heading); }
    .fail { color: var(--sw-danger-text); font-size: var(--sw-fs-sm); }
    @media (max-width: 699px) {
      :host { flex-direction: column; }
      .panel { padding: 12px; gap: 10px; }
      .big { font-size: var(--sw-fs-xl); }
      .ph { gap: 6px; }
      .month { flex: none; block-size: 262px; }
      .mhead div { padding: 0 0 4px; text-align: center; }
      .mcell { padding: 3px; border-radius: var(--sw-r-sm); align-items: center; gap: 2px; }
      .mcell .d { justify-content: center; min-block-size: 20px; }
      .week { grid-template-columns: 40px repeat(var(--cols), minmax(0, 1fr)); }
      .wh b { font-size: var(--sw-fs-xl); }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @state() private mode: CalMode = 'month';
  @state() private anchor: Date = startOfDay(new Date());
  @state() private picked: Date | null = null;
  @state() private hiddenCals = new Set<string>();
  @state() private occ: Occurrence[] = [];
  @state() private error = '';
  @state() private switcherOpen = false;
  @state() private dayPage = 1;
  @state() private cap = 3;
  private loadedKey = '';
  private ro: ResizeObserver | null = null;
  private host: EventTarget | null = null;
  private onChanged = () => this.reload();

  connectedCallback(): void {
    super.connectedCallback();
    const v = readHashParam('view');
    this.mode = v === 'week' || v === 'day' ? v : 'month';
    this.anchor = parseDateParam(readHashParam('date'), this.ctx?.now ?? new Date());
    try {
      const raw = sessionStorage.getItem('sw.cal.hidden');
      if (raw) this.hiddenCals = new Set(JSON.parse(raw) as string[]);
    } catch {
      /* storage unavailable: every calendar shown */
    }
    this.ro = new ResizeObserver(() => this.fitMonth());
    // a booking made in the drawer (a sibling of this view) changes what is drawn: the page hears CAL_EVENTS.changed
    this.host = (this.getRootNode() as ShadowRoot).host ?? null;
    this.host?.addEventListener(CAL_EVENTS.changed, this.onChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    this.host?.removeEventListener(CAL_EVENTS.changed, this.onChanged);
  }

  protected updated(): void {
    const g = this.renderRoot.querySelector('.mgrid');
    if (g && this.ro) this.ro.observe(g);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('ctx') || changed.has('mode') || changed.has('anchor')) void this.load();
  }

  /** The month caps the entries per cell by the cell's height ("עוד N" for the rest): no cell ever scrolls. */
  private fitMonth(): void {
    const cell = this.renderRoot.querySelector('.mcell') as HTMLElement | null;
    if (!cell) return;
    const cap = Math.max(0, Math.floor((cell.clientHeight - 52) / 23));
    if (cap !== this.cap) this.cap = cap;
  }

  private range(): { from: Date; to: Date } {
    if (this.mode === 'month') {
      const g = monthGrid(this.anchor);
      return { from: g[0].day, to: addDays(g[41].day, 1) };
    }
    if (this.mode === 'week') {
      const s = weekStart(this.anchor);
      return { from: s, to: addDays(s, 7) };
    }
    return { from: startOfDay(this.anchor), to: addDays(startOfDay(this.anchor), 1) };
  }

  private async load(): Promise<void> {
    const ctx = this.ctx;
    if (!ctx) return;
    const { from, to } = this.range();
    const key = `${from.toISOString()}|${to.toISOString()}|${ctx.cals.map((c) => c.id).join(',')}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    try {
      const r = await ctx.api.occurrences(from.toISOString(), to.toISOString());
      if (this.loadedKey !== key) return;
      this.occ = r.occurrences.filter((o) => !['cancelled', 'rejected', 'withdrawn', 'expired'].includes(o.state));
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  /** The page asks again after a booking (CAL_EVENTS.changed reloads the calendars, which hands a new ctx). */
  reload(): void {
    this.loadedKey = '';
    void this.load();
  }

  private setMode(m: CalMode): void {
    this.mode = m;
    this.dayPage = 1;
    writeHashParams({ view: m, date: isoDate(this.anchor) });
  }

  private go(step: number): void {
    const a = this.anchor;
    this.anchor = this.mode === 'month' ? new Date(a.getFullYear(), a.getMonth() + step, 1) : addDays(a, this.mode === 'week' ? step * 7 : step);
    this.picked = null;
    writeHashParams({ view: this.mode, date: isoDate(this.anchor) });
  }

  private today(): void {
    this.anchor = startOfDay(this.ctx?.now ?? new Date());
    this.picked = null;
    writeHashParams({ view: this.mode, date: isoDate(this.anchor) });
  }

  private toggle(id: string): void {
    const h = new Set(this.hiddenCals);
    if (h.has(id)) h.delete(id);
    else h.add(id);
    this.hiddenCals = h;
    try {
      sessionStorage.setItem('sw.cal.hidden', JSON.stringify([...h]));
    } catch {
      /* the choice lasts for this page only */
    }
  }

  private shownCals(): Calendar[] {
    return visibleCals(this.ctx as CalCtx).filter((c) => !this.hiddenCals.has(c.id));
  }

  private shownOcc(): Occurrence[] {
    const ids = new Set(this.shownCals().map((c) => c.id));
    return this.occ.filter((o) => ids.has(o.calendar_id) || o.room_calendar_ids.some((r) => ids.has(r)));
  }

  private calOf(id: string): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === id);
  }

  private rangeTitle(): string {
    const a = this.anchor;
    if (this.mode === 'month') return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`;
    if (this.mode === 'week') {
      const s = weekStart(a);
      const e = addDays(s, 6);
      return s.getMonth() === e.getMonth() ? `${s.getDate()}–${e.getDate()} ב${MONTHS[s.getMonth()]} ${s.getFullYear()}` : `${s.getDate()}.${pad(s.getMonth() + 1)}–${e.getDate()}.${pad(e.getMonth() + 1)}.${e.getFullYear()}`;
    }
    return `${DAY_LONG[a.getDay()]}, ${a.getDate()} ב${MONTHS[a.getMonth()]}`;
  }

  render() {
    const ctx = this.ctx;
    if (!ctx) return nothing;
    const dev = ctx.device;
    const collapse = dev === 'phone' || (dev === 'tablet' && ctx.access.ui.tablet_panels === 'collapse');
    return html`
      ${collapse ? nothing : this.switcher(dev === 'tablet')}
      <section class="panel main" data-cal-view=${this.mode}>
        ${this.header(collapse)}
        ${this.error ? html`<div class="fail" role="alert" data-cal-error>${this.error}</div>` : nothing}
        ${this.mode === 'month' ? this.month() : this.week(this.mode === 'day')}
      </section>
      ${collapse && this.switcherOpen ? html`<div class="scrim" @click=${() => (this.switcherOpen = false)}></div>${this.switcher(false, true)}` : nothing}`;
  }

  private header(collapse: boolean) {
    const shown = this.shownCals().length;
    return html`<div class="ph" data-cal-head>
      <span class="big" data-cal-title>${this.rangeTitle()}</span>
      <button type="button" class="btn icon sm" aria-label="הקודם" data-cal-prev @click=${() => this.go(-1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <button type="button" class="btn icon sm" aria-label="הבא" data-cal-next @click=${() => this.go(1)}><sw-icon name="chevron" size="16"></sw-icon></button>
      <button type="button" class="btn sm" data-cal-today @click=${() => this.today()}>היום</button>
      <span class="sp"></span>
      ${collapse ? html`<button type="button" class="btn sm" data-cal-switcher-open aria-expanded=${String(this.switcherOpen)} @click=${() => (this.switcherOpen = true)}>
        <sw-icon name="calendar" size="16"></sw-icon><span class="num">${shown}</span> יומנים</button>` : nothing}
      <div class="seg" role="group" aria-label="תצוגה">
        ${(['month', 'week', 'day'] as CalMode[]).map((m) => html`<button type="button" aria-pressed=${String(this.mode === m)} data-cal-mode=${m} @click=${() => this.setMode(m)}>${{ month: 'חודש', week: 'שבוע', day: 'יום' }[m]}</button>`)}
      </div>
    </div>`;
  }

  private switcher(narrow: boolean, overlay = false) {
    const ctx = this.ctx as CalCtx;
    const list = visibleCals(ctx);
    const shown = list.filter((c) => !this.hiddenCals.has(c.id)).length;
    return html`<aside class=${`panel switcher${narrow && ctx.access.ui.tablet_panels === 'shrink' ? ' narrow' : ''}${overlay ? ' overlay' : ''}`} data-cal-switcher aria-label="יומנים">
      <div class="ph"><h2>יומנים</h2><span class="sp"></span><span class="muted num">${shown} מתוך ${list.length}</span>
        ${overlay ? html`<button type="button" class="btn icon sm" aria-label="סגירה" data-cal-switcher-close @click=${() => (this.switcherOpen = false)}><sw-icon name="close" size="16"></sw-icon></button>` : nothing}</div>
      <div class="list">
        ${grouped(list).map((g) => html`<div class="grp">${TYPE_GROUP[g.type]}</div>
          ${g.cals.map((c) => html`<button type="button" class="cal-it" style=${`--h:${colorVar(c.color)}`} aria-pressed=${String(!this.hiddenCals.has(c.id))} data-cal-toggle=${c.id} @click=${() => this.toggle(c.id)}>
            <span class="box"><sw-icon name="check" size="13"></sw-icon></span><span class="ell" title=${c.name}>${c.name}</span>
            ${c.my_role === 'view' ? html`<span class="lock" title="צפייה בלבד"><sw-icon name="lock" size="14"></sw-icon></span>` : nothing}</button>`)}`)}
      </div></aside>`;
  }

  // ---------- month ----------
  private month() {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const grid = monthGrid(this.anchor);
    const occ = this.shownOcc();
    const now = ctx.now;
    const cap = phone ? 0 : this.cap;
    const picked = this.picked ?? (this.anchor.getMonth() === now.getMonth() && this.anchor.getFullYear() === now.getFullYear() ? startOfDay(now) : this.anchor);
    return html`<div class="month" data-cal-month>
        <div class="mhead">${(phone ? DAY_SHORT : DAY_LONG).map((d) => html`<div>${d}</div>`)}</div>
        <div class="mgrid">${grid.map(({ day, inMonth }) => {
          const evs = onDay(occ, day);
          const hol = evs.find((o) => o.kind === 'holiday');
          const rest = evs.filter((o) => o.kind !== 'holiday');
          const we = day.getDay() >= 5;
          const today = sameDay(day, now);
          return html`<button type="button" class=${`mcell${inMonth ? '' : ' out'}${we ? ' we' : ''}${today ? ' today' : ''}`} aria-pressed=${String(phone && sameDay(day, picked))}
            aria-label=${`${day.getDate()} ב${MONTHS[day.getMonth()]}, ${rest.length} אירועים`} data-cal-day=${isoDate(day)} @click=${() => this.pickDay(day)}>
            <div class="d"><b class="num">${day.getDate()}</b>${hol && !phone ? html`<span class="ell">${hol.title}</span>` : nothing}</div>
            ${rest.slice(0, cap).map((o) => this.monthEv(o))}
            ${phone ? html`<span class="dots">${evs.slice(0, 4).map((o) => html`<i style=${`--h:${colorVar(this.calOf(o.calendar_id)?.color)}`}></i>`)}</span>`
              : rest.length > cap ? html`<div class="more">עוד <span class="num">${rest.length - cap}</span></div>` : nothing}
          </button>`;
        })}</div>
      </div>
      ${phone ? this.agenda(picked, occ) : nothing}`;
  }

  private monthEv(o: Occurrence) {
    const c = this.calOf(o.calendar_id);
    return html`<span class="ev" data-mark=${markOf(o)} data-flag=${o.sync_flag === 'conflict' && this.ctx?.access.ui.sync_conflict_display !== 'list_only' ? 'conflict' : ''}
      style=${`--h:${colorVar(c?.color)}`} title=${o.title ?? 'תפוס'}><span class="t num">${hm(o.start)}</span><span class="ell">${o.title ?? 'תפוס'}</span></span>`;
  }

  /** On the phone a tap on a day lists its entries under the grid; elsewhere it opens the day. */
  private pickDay(day: Date): void {
    if (this.ctx?.device === 'phone') {
      this.picked = day;
      return;
    }
    this.anchor = day;
    this.setMode('day');
  }

  private agenda(day: Date, occ: Occurrence[]) {
    const list = onDay(occ, day);
    const now = this.ctx?.now ?? new Date();
    const fit = list.length > 3 ? 2 : 3;
    return html`<div class="agenda" data-cal-agenda>
      <h3>${sameDay(day, now) ? 'היום, ' : ''}${DAY_LONG[day.getDay()]} ${day.getDate()}.${pad(day.getMonth() + 1)}</h3>
      ${list.length ? list.slice(0, fit).map((o) => html`<button type="button" class="row" data-cal-entry=${o.event_id} @click=${() => this.open(o)}>
          <span class="dot" style=${`--h:${colorVar(this.calOf(o.calendar_id)?.color)}`}></span><b class="num">${o.all_day ? 'כל היום' : hm(o.start)}</b>
          <span class="grow ell">${o.title ?? 'תפוס'}</span>${o.state === 'pending' ? html`<span class="chip dash">ממתין</span>` : o.kind === 'maintenance' ? html`<span class="chip">תחזוקה</span>` : nothing}</button>`)
        : html`<span class="muted">אין אירועים ביום הזה.</span>`}
      ${list.length > fit ? html`<button type="button" class="btn sm" data-cal-agenda-more @click=${() => { this.anchor = day; this.setMode('day'); }}>עוד <span class="num">${list.length - fit}</span> · לתצוגת יום</button>` : nothing}
    </div>`;
  }

  // ---------- week / day ----------
  private week(day: boolean) {
    const ctx = this.ctx as CalCtx;
    const phone = ctx.device === 'phone';
    const now = ctx.now;
    const occ = this.shownOcc();
    const conflicts = ctx.access.ui.sync_conflict_display !== 'list_only';
    let cols: { key: string; day: Date; cal?: Calendar }[];
    let pager: unknown = nothing;
    if (day) {
      const per = phone ? 2 : ctx.device === 'tablet' ? 4 : 6;
      const today = onDay(occ, this.anchor);
      // calendars with entries that day first, then the rest (a free room is a column too)
      const shown = this.shownCals();
      const ordered = [...shown.filter((c) => today.some((o) => o.calendar_id === c.id)), ...shown.filter((c) => !today.some((o) => o.calendar_id === c.id))];
      const pg = pageOf(ordered, this.dayPage, per);
      cols = pg.items.map((c) => ({ key: c.id, day: this.anchor, cal: c }));
      if (pg.pages > 1) {
        pager = html`<div class="pager" data-cal-pager><button type="button" class="btn sm" aria-label="יומנים קודמים" ?disabled=${pg.page <= 1} @click=${() => (this.dayPage = pg.page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
          <span class="num">${pg.page} / ${pg.pages}</span><button type="button" class="btn sm" aria-label="יומנים הבאים" ?disabled=${pg.page >= pg.pages} @click=${() => (this.dayPage = pg.page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>`;
      }
    } else {
      const s = weekStart(this.anchor);
      const all = Array.from({ length: 7 }, (_, i) => addDays(s, i));
      const mid = Math.min(Math.max(this.anchor.getDay(), 1), 5); // the phone shows three days around the chosen one
      const days = phone ? all.slice(mid - 1, mid + 2) : all;
      cols = days.map((d) => ({ key: isoDate(d), day: d }));
    }
    const hours = TO_H - FROM_H;
    const lines = Array.from({ length: hours }, (_, k) => html`<div class="hl" style=${`top:${(k / hours) * 100}%`}></div>`);
    const nowTop = ((minutesOf(now) - FROM_H * 60) / (hours * 60)) * 100;
    return html`<div class="week" style=${`--cols:${Math.max(1, cols.length)}`} data-cal-week>
        <div></div>
        ${cols.map((c) => c.cal
          ? html`<div class="wh cal"><span class="dot" style=${`--h:${colorVar(c.cal.color)}`}></span><b class="ell" title=${c.cal.name}>${c.cal.name}</b></div>`
          : html`<button type="button" class=${`wh${sameDay(c.day, now) ? ' today' : ''}`} @click=${() => { this.anchor = c.day; this.setMode('day'); }}>${phone ? DAY_SHORT[c.day.getDay()] : DAY_LONG[c.day.getDay()]} <b class="num">${c.day.getDate()}</b></button>`)}
        <div class="axis">${Array.from({ length: hours }, (_, k) => (k % 2 === 0 || !phone ? html`<span class="num" style=${`top:${(k / hours) * 100}%`}>${pad(FROM_H + k)}:00</span>` : nothing))}</div>
        ${cols.map((c) => {
          const list = c.cal ? occ.filter((o) => o.calendar_id === c.cal?.id || o.room_calendar_ids.includes(c.cal?.id ?? '')) : occ;
          const placed = placeDay(list, c.day, FROM_H, TO_H);
          const allDay = onDay(list, c.day).filter((o) => o.all_day || o.kind === 'holiday');
          const we = !c.cal && (c.day.getDay() === 6 || allDay.length > 0);
          return html`<div class=${`col${we ? ' we' : ''}`} data-cal-col=${c.key} @click=${(e: MouseEvent) => this.newAt(e, c.day, c.cal)}>
            ${lines}
            ${allDay.length ? html`<div class="allday ell">${allDay[0].title}</div>` : nothing}
            ${placed.map((p) => {
              const flag = conflicts && p.o.sync_flag === 'conflict';
              const w = 100 / p.lanes;
              return html`<button type="button" class="ev" data-mark=${markOf(p.o)} data-flag=${flag ? 'conflict' : ''} data-cal-entry=${p.o.event_id}
                style=${`--h:${colorVar(this.calOf(p.o.calendar_id)?.color)};top:${p.top}%;height:${p.height}%;inset-inline-start:calc(${p.lane * w}% + 3px);inline-size:calc(${w}% - 6px)`}
                title=${flag ? 'התנגשות עם יומן חיצוני: שתי ההזמנות נשמרו, מחכה להחלטה' : `${p.o.title ?? 'תפוס'} · ${hm(p.o.start)}–${hm(p.o.end)}`}
                @click=${(e: Event) => { e.stopPropagation(); this.open(p.o); }}>
                <b>${flag ? html`<sw-icon name="warning" size="13"></sw-icon>` : nothing}<span class="ell">${p.o.title ?? 'תפוס'}</span></b>
                ${p.height > 6 ? html`<span class="tm num ell ltr">${hm(p.o.start)}–${hm(p.o.end)}</span>` : nothing}</button>`;
            })}
            ${sameDay(c.day, now) && nowTop > 0 && nowTop < 100 ? html`<div class="now" style=${`top:${nowTop}%`}></div>` : nothing}
          </div>`;
        })}
      </div>${pager}`;
  }

  /** A tap on a free part of a column opens the new booking drawer at that half hour (one hour long). */
  private newAt(e: MouseEvent, day: Date, cal?: Calendar): void {
    const ctx = this.ctx;
    if (!ctx?.access.can.book) return;
    const col = e.currentTarget as HTMLElement;
    const r = col.getBoundingClientRect();
    const frac = Math.min(Math.max((e.clientY - r.top) / r.height, 0), 1);
    const mins = Math.floor((FROM_H * 60 + frac * (TO_H - FROM_H) * 60) / 30) * 30;
    const start = new Date(startOfDay(day).getTime() + mins * 60000);
    const end = new Date(start.getTime() + 60 * 60000);
    emit(this, CAL_EVENTS.newEvent, { calendarId: cal && cal.my_role && cal.my_role !== 'view' ? cal.id : undefined, start: start.toISOString(), end: end.toISOString() });
  }

  private open(o: Occurrence): void {
    emit(this, CAL_EVENTS.newEvent, { eventId: o.event_id });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-calendar': CalViewCalendar;
  }
}
