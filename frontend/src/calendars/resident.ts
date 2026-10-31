import { LitElement, html, nothing, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import type { Calendar, Equipment, Occurrence, RoomDay } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx } from './ctx';
import {
  DAY_LONG, DAY_SHORT, addDays, cancelClosed, colorVar, ddmm, hm, isoDate, nextFree, pageOf, rowsThatFit, slotGrid, slotLook, span, startOfDay, timelineWindow, whenText,
  type Slot,
} from './model';
import { calCss } from './styles';

const EQUIP: Record<Equipment, string> = { screen: 'מסך', projector: 'מקרן', video_call: 'שיחת וידאו', whiteboard: 'לוח', kitchen: 'מטבח', accessible: 'נגישות' };
const DURATIONS: [number, string][] = [[30, '30 דק׳'], [60, 'שעה'], [120, 'שעתיים'], [180, '3 שעות']];
const BOOKABLE = new Set(['book', 'edit', 'manage']);

type Sheet = { kind: 'confirm' } | { kind: 'cancel'; o: Occurrence } | { kind: 'displaced'; o: Occurrence } | { kind: 'equip' } | null;
interface Alt { calendar_id: string; start: Date; end: Date; note: string }

/**
 * CALENDARS-UI-2310: the resident's phone flow (round-8 mock-up "res-*"): הזמנת חדר · ההזמנות שלי. A day strip, the rooms he may book (owner
 * answer 15 as a setting: only those, or all with "תפוס" for the others), each with its next free time and a mini bar of the day; a room
 * opens its start grid + duration chips (answer 16: or a time bar, a setting); a start with pending requests reads "2 מבקשים" and may be
 * requested (answer 13: or just "פנוי", or blocked); a bottom sheet confirms (the request goes to the room's manager when it needs approval);
 * "ההזמנות שלי" lists his entries with withdraw / cancel (answer 14: until the start, an hour or a day before - a setting) and, for an entry
 * displaced by maintenance, three alternatives he picks from (Arx never moves a booking by itself). No page scroll: lists page.
 */
@customElement('cal-resident')
export class CalResident extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; flex-direction: column; min-block-size: 0; gap: 10px; overflow: hidden; }
    h1 { margin: 0; font-size: var(--sw-fs-3xl); font-weight: var(--sw-fw-bold); color: var(--sw-heading); line-height: 1.15; }
    .tabs { display: flex; gap: 2px; padding: 4px; border-radius: var(--sw-r-pill); background: var(--sw-surface-3); }
    .tabs button { flex: 1; font: inherit; font-size: var(--sw-fs-md); border: 0; background: transparent; color: var(--sw-text-2); min-block-size: 40px; border-radius: var(--sw-r-pill);
      cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; -webkit-tap-highlight-color: transparent; }
    .tabs button[aria-pressed='true'] { background: var(--sw-surface-solid); color: var(--sw-heading); font-weight: var(--sw-fw-semibold); box-shadow: var(--sw-shadow-1); }
    .panel { flex: 1; padding: 12px; gap: 10px; }
    .days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; flex: none; }
    .days button { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 52px; display: grid; place-items: center;
      align-content: center; gap: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; padding: 4px 0; }
    .days small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .days b { font-size: var(--sw-fs-xl); font-variant-numeric: tabular-nums; }
    .days button[aria-pressed='true'] { background: var(--sw-accent); color: var(--sw-text-inverse); }
    .days button[aria-pressed='true'] small { color: var(--sw-text-inverse); }
    .tools { display: flex; align-items: center; gap: 8px; flex: none; }
    .hc { display: inline-flex; align-items: center; gap: 6px; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .hc button { inline-size: 32px; block-size: 32px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); font: inherit; cursor: pointer; padding: 0; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 8px; overflow: hidden; }
    .rcard { display: flex; gap: 10px; align-items: flex-start; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 0; font: inherit; color: inherit; text-align: start;
      cursor: pointer; inline-size: 100%; min-block-size: 84px; -webkit-tap-highlight-color: transparent; transition: transform var(--sw-t-press) var(--sw-ease); }
    .rcard:active { transform: scale(0.98); }
    .rcard[aria-disabled='true'] { cursor: default; opacity: 0.75; }
    .rcard .name { font-size: var(--sw-fs-lg); font-weight: var(--sw-fw-bold); color: var(--sw-heading); }
    .rcard .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .rnext { display: grid; justify-items: end; gap: 2px; flex: none; text-align: end; }
    .rnext small { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .rnext b { font-size: var(--sw-fs-xl); color: var(--sw-success-text); font-variant-numeric: tabular-nums; }
    .rnext b.none { color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
    .mini { position: relative; block-size: 10px; margin-block-start: 8px; direction: ltr; }
    .mini i { position: absolute; inset-block: 1px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); }
    .mini i.p { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-3); }
    .shead { display: flex; align-items: center; gap: 10px; flex: none; }
    .shead b { display: block; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .shead .sub { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .dur { align-self: center; flex: none; }
    .slots { flex: 1; min-block-size: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; align-content: start; overflow: hidden; }
    .slot { font: inherit; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); color: var(--sw-heading); min-block-size: 48px; display: grid; place-items: center; align-content: center;
      cursor: pointer; padding: 4px 2px; -webkit-tap-highlight-color: transparent; }
    .slot b { font-size: var(--sw-fs-md); font-variant-numeric: tabular-nums; }
    .slot small { font-size: var(--sw-fs-2xs); color: var(--sw-text-2); }
    .slot[data-look='contest'] { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .slot[data-look='busy'], .slot[data-look='blocked'] { cursor: default; color: var(--sw-text-3); }
    .slot[data-look='busy'] b { text-decoration: line-through; }
    .slot[data-sel] { background: var(--sw-accent); color: var(--sw-text-inverse); outline: 0; }
    .slot[data-sel] small { color: var(--sw-text-inverse); }
    .legend { flex: none; }
    .legend i.lf { background: var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border); }
    .legend i.lc { background: transparent; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .legend i.lb { background: var(--sw-surface-3); }
    .go { inline-size: 100%; min-block-size: 52px; font-size: var(--sw-fs-lg); flex: none; }
    .tl { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
    .bar { position: relative; block-size: 72px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); direction: ltr; touch-action: none; cursor: pointer; overflow: hidden; }
    .bar .e { position: absolute; inset-block: 10px; border-radius: var(--sw-r-xs); background: var(--sw-surface-3); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .bar .e.p { background: transparent; box-shadow: none; outline: 1.5px dashed var(--sw-text-3); outline-offset: -1.5px; }
    .bar .sel { position: absolute; inset-block: 4px; border-radius: var(--sw-r-sm); background: color-mix(in srgb, var(--sw-accent) 30%, transparent); box-shadow: inset 0 0 0 2px var(--sw-accent); }
    .bar .sel.bad { background: var(--sw-danger-soft); box-shadow: inset 0 0 0 2px var(--sw-danger); }
    .axis { position: relative; block-size: 16px; direction: ltr; font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
    .axis span { position: absolute; transform: translateX(-50%); font-variant-numeric: tabular-nums; }
    .tlnav { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .tlsel { text-align: center; font-size: var(--sw-fs-md); color: var(--sw-heading); }
    .bk { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); min-inline-size: 0; flex: none; }
    .bk[data-state='displaced'] { box-shadow: inset 0 0 0 1.5px var(--sw-warning); background: var(--sw-surface-solid); }
    .bkt { display: flex; align-items: center; gap: 8px; min-inline-size: 0; }
    .bkt b { flex: 1; min-inline-size: 0; font-size: var(--sw-fs-lg); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .bkw { display: flex; align-items: baseline; gap: 8px; min-inline-size: 0; }
    .bkw b { font-size: var(--sw-fs-lg); color: var(--sw-heading); font-variant-numeric: tabular-nums; flex: none; }
    .bka { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; align-items: center; }
    .bka .why { font-size: var(--sw-fs-xs); color: var(--sw-text-3); margin-inline-end: auto; }
    .sugg { display: flex; flex-wrap: wrap; gap: 6px; }
    .sugg button { font: inherit; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); border: 0; border-radius: var(--sw-r-pill); background: var(--sw-accent-soft); color: var(--sw-accent-text);
      padding: 6px 12px; cursor: pointer; min-block-size: 32px; }
    .btn.badtxt { color: var(--sw-danger-text); }
    .done { display: flex; gap: 10px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-lg); background: var(--sw-success-soft); color: var(--sw-success-text); flex: none; }
    .done b { color: var(--sw-heading); display: block; }
    .center { display: grid; place-items: center; flex: 1; }
    /* the bottom sheet (mobile-native: safe area, 16 px inputs, 44 px targets, the grab handle) */
    .scrim { position: fixed; inset: 0; background: var(--sw-overlay); z-index: var(--sw-z-modal); animation: fade var(--sw-t-sheet) var(--sw-ease); }
    .sheet { position: fixed; inset-inline: 0; inset-block-end: 0; z-index: var(--sw-z-modal); background: var(--sw-surface-solid); border-start-start-radius: var(--sw-r-2xl);
      border-start-end-radius: var(--sw-r-2xl); box-shadow: var(--sw-shadow-3); display: flex; flex-direction: column; max-block-size: 88dvh;
      padding-block-end: env(safe-area-inset-bottom); animation: up var(--sw-spring-drawer-ms) var(--sw-ease-drawer); }
    .grab { inline-size: 40px; block-size: 5px; border-radius: var(--sw-r-pill); background: var(--sw-border-strong); margin: 8px auto 0; }
    .sheet header { display: flex; align-items: flex-start; gap: 10px; padding: 10px 16px 6px; }
    .sheet header h2 { margin: 0; font-size: var(--sw-fs-xl); color: var(--sw-heading); }
    .sheet .body { padding: 6px 16px 10px; display: flex; flex-direction: column; gap: 10px; overflow: auto; overscroll-behavior: contain; }
    .sheet footer { display: flex; gap: 8px; padding: 10px 16px 14px; border-block-start: 1px solid var(--sw-border); }
    .sheet footer .btn { min-block-size: 48px; }
    .x { inline-size: 44px; block-size: 44px; border-radius: 50%; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); display: grid; place-items: center;
      cursor: pointer; flex: none; padding: 0; }
    .opt { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: var(--sw-r-lg); background: var(--sw-surface-2); border: 1.5px solid transparent; cursor: pointer;
      text-align: start; font: inherit; color: inherit; inline-size: 100%; min-block-size: 44px; }
    .opt[aria-checked='true'] { border-color: var(--sw-accent); background: var(--sw-surface-solid); }
    .rad { flex: none; inline-size: 20px; block-size: 20px; border-radius: 50%; border: 2px solid var(--sw-border-strong); display: grid; place-items: center; margin-block-start: 2px; }
    .opt[aria-checked='true'] .rad { border-color: var(--sw-accent); }
    .opt[aria-checked='true'] .rad::after { content: ''; inline-size: 10px; block-size: 10px; border-radius: 50%; background: var(--sw-accent); }
    .opt b { display: block; color: var(--sw-heading); }
    .opt small { display: block; color: var(--sw-text-2); font-size: var(--sw-fs-sm); }
    .lockline { display: flex; gap: 8px; align-items: center; padding: 10px 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .hint { display: flex; gap: 6px; align-items: flex-start; font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .eq { display: flex; flex-wrap: wrap; gap: 8px; }
    .eq button { font: inherit; border: 1px solid var(--sw-border); background: var(--sw-surface-solid); color: var(--sw-heading); border-radius: var(--sw-r-pill); min-block-size: 44px; padding: 0 16px; cursor: pointer; }
    .eq button[aria-pressed='true'] { background: var(--sw-accent-soft); border-color: var(--sw-accent); color: var(--sw-accent-text); font-weight: var(--sw-fw-semibold); }
    @keyframes up { from { transform: translateY(100%); } }
    @keyframes fade { from { opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .sheet, .scrim { animation: none; } .rcard { transition: none; } }
    @media (hover: hover) { .rcard:hover { background: var(--sw-surface-3); } }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @state() private tab: 'book' | 'mine' = 'book';
  @state() private dayIdx = 0;
  @state() private rooms: RoomDay[] | null = null;
  @state() private roomId = '';
  @state() private duration = 60;
  @state() private start: Date | null = null;
  @state() private headcount = 0;
  @state() private equip = new Set<Equipment>();
  @state() private sheet: Sheet = null;
  @state() private mine: Occurrence[] | null = null;
  @state() private past = false;
  @state() private error = '';
  @state() private slow = false;
  @state() private busy = false;
  @state() private actionError = '';
  @state() private done = '';
  @state() private evTitle = '';
  @state() private people = 1;
  @state() private cancelScope: 'occurrence' | 'series' = 'occurrence';
  @state() private alts: Alt[] | null = null;
  @state() private altPick = 0;
  @state() private page = 1;
  @state() private per = 4;
  @state() private tlFrom = 8;
  private ro: ResizeObserver | null = null;
  private slowTimer = 0;
  private drag = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadDay();
    void this.loadMine();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
    clearTimeout(this.slowTimer);
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('dayIdx') || changed.has('roomId') || changed.has('tab') || changed.has('past') || changed.has('duration')) this.page = 1;
    if (changed.has('roomId') || changed.has('dayIdx')) this.tlFrom = this.dayIdx === 0 ? timelineWindow(true, this.now).from : 8; // the time bar opens around now today
  }

  protected updated(): void {
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
    const tallest = Math.max(0, ...[...box.children].map((c) => (c as HTMLElement).offsetHeight + 8));
    const rowH = Math.max(Number(box.dataset.fit) || 66, tallest);
    const per = cols * rowsThatFit(box.clientHeight + 8, rowH);
    if (per !== this.per) this.per = per;
  }

  private get now(): Date {
    return this.ctx?.now ?? new Date();
  }

  private get day(): Date {
    return addDays(startOfDay(this.now), this.dayIdx);
  }

  private get ui() {
    return this.ctx!.access.ui;
  }

  private async loadDay(): Promise<void> {
    if (!this.ctx) return;
    this.error = '';
    this.slow = false;
    clearTimeout(this.slowTimer);
    this.slowTimer = window.setTimeout(() => (this.slow = true), 300); // owner answer 26: no flash for a fast answer
    try {
      const r = await this.ctx.api.roomsDay(isoDate(this.day));
      this.rooms = r.rooms;
    } catch (e) {
      this.error = describeError(e);
    } finally {
      clearTimeout(this.slowTimer);
    }
  }

  private async loadMine(): Promise<void> {
    if (!this.ctx) return;
    try {
      const from = this.past ? addDays(this.now, -30) : this.now;
      const to = this.past ? this.now : addDays(this.now, 31);
      const r = await this.ctx.api.mine(from.toISOString(), to.toISOString());
      this.mine = r.occurrences.filter((o) => o.state !== 'cancelled' && o.state !== 'withdrawn').sort((a, b) => a.start.localeCompare(b.start));
    } catch (e) {
      this.mine = [];
      this.error = describeError(e);
    }
  }

  private cal(id: string): Calendar | undefined {
    return this.ctx?.cals.find((c) => c.id === id);
  }

  /** Owner answer 15 as a setting: only the rooms he may book, or all of them (the others read "תפוס"). */
  private roomList(): { r: RoomDay; cal: Calendar; bookable: boolean }[] {
    const all = this.ui.resident_rooms === 'all_busy';
    return (this.rooms ?? []).flatMap((r) => {
      const cal = this.cal(r.calendar_id);
      if (!cal) return [];
      const bookable = BOOKABLE.has(cal.my_role ?? '');
      if (!bookable && !all) return [];
      if (this.headcount && r.capacity && this.headcount > r.capacity) return [];
      if ([...this.equip].some((e) => !r.equipment.includes(e))) return [];
      return [{ r, cal, bookable }];
    });
  }

  render() {
    if (!this.ctx) return nothing;
    const mineN = (this.mine ?? []).length;
    return html`
      <h1>יומנים</h1>
      <div class="tabs" role="tablist" aria-label="יומנים">
        <button type="button" role="tab" aria-pressed=${String(this.tab === 'book')} aria-selected=${String(this.tab === 'book')} data-res-tab="book" @click=${() => (this.tab = 'book')}>הזמנת חדר</button>
        <button type="button" role="tab" aria-pressed=${String(this.tab === 'mine')} aria-selected=${String(this.tab === 'mine')} data-res-tab="mine" @click=${() => { this.tab = 'mine'; this.done = ''; }}>ההזמנות שלי${!this.past && mineN ? html` <b class="num">${mineN}</b>` : nothing}</button>
      </div>
      ${this.tab === 'book' ? this.bookView() : this.mineView()}
      ${this.sheetView()}`;
  }

  private stateView() {
    if (this.error) return html`<div class="center"><sw-state-panel state="error" data-res-state="error" heading="לא הצלחנו לטעון את החדרים" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.loadDay()}></sw-state-panel></div>`;
    if (!this.slow) return html`<section class="panel" aria-busy="true"></section>`;
    if (this.ui.loading_style === 'spinner') return html`<div class="center" data-res-state="loading"><div class="spin" role="status" aria-label="טוען"></div></div>`;
    return html`<section class="panel" data-res-state="loading" role="status" aria-label="טוען"><div class="skel" style="block-size:52px"></div>${[0, 1, 2, 3].map(() => html`<div class="skel" style="block-size:84px"></div>`)}</section>`;
  }

  // ---------------------------------------------------------------- הזמנת חדר

  private bookView() {
    if (!this.rooms) return this.stateView();
    const room = this.roomId ? this.roomList().find((x) => x.r.calendar_id === this.roomId) : undefined;
    if (room) return this.slotView(room.r, room.cal);
    const list = this.roomList();
    const p = pageOf(list, this.page, this.per);
    return html`<section class="panel" data-res-view="rooms">
      ${this.dayStrip()}
      <div class="tools"><span class="hc"><sw-icon name="users" size="16"></sw-icon>
        <button type="button" aria-label="פחות אנשים" @click=${() => (this.headcount = Math.max(0, this.headcount - 1))}>−</button><b class="num" data-res-headcount>${this.headcount || 'כל'}</b>
        <button type="button" aria-label="יותר אנשים" @click=${() => (this.headcount += 1)}>+</button> אנשים</span><span class="sp"></span>
        <button type="button" class="btn sm" data-res-equip @click=${() => (this.sheet = { kind: 'equip' })}><sw-icon name="filter" size="14"></sw-icon>ציוד${this.equip.size ? html` <b class="num">${this.equip.size}</b>` : nothing}</button></div>
      ${list.length ? html`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="92">${p.items.map((x) => this.roomCard(x.r, x.cal, x.bookable))}</div>${this.pager(p.page, p.pages)}`
        : html`<div class="center"><sw-state-panel state="empty" icon="calendar" data-res-state="empty" heading=${(this.rooms ?? []).length ? 'אין חדר שמתאים לסינון' : 'אין חדרים פתוחים להזמנה בשבילך'}
          hint=${(this.rooms ?? []).length ? 'אפשר לשנות את מספר האנשים או את הציוד.' : 'ההנהלה קובעת אילו חדרים דיירים יכולים להזמין.'}></sw-state-panel></div>`}
    </section>`;
  }

  private dayStrip() {
    return html`<div class="days" role="group" aria-label="יום">${Array.from({ length: 7 }, (_, i) => {
      const d = addDays(startOfDay(this.now), i);
      return html`<button type="button" aria-pressed=${String(this.dayIdx === i)} data-res-day=${i} aria-label=${`${DAY_LONG[d.getDay()]} ${ddmm(d)}`}
        @click=${() => { if (this.dayIdx !== i) { this.dayIdx = i; this.start = null; this.rooms = null; void this.loadDay(); } }}><small>${i === 0 ? 'היום' : DAY_SHORT[d.getDay()]}</small><b>${d.getDate()}</b></button>`;
    })}</div>`;
  }

  private roomCard(r: RoomDay, cal: Calendar, bookable: boolean) {
    const nf = bookable ? nextFree(r.entries, this.day, r.open, 30, this.now) : null;
    const approval = cal.approval_mode !== 'none';
    const eq = r.equipment.map((e) => EQUIP[e]).join(' · ');
    return html`<button type="button" class="rcard" data-res-room=${r.calendar_id} aria-disabled=${String(!bookable)}
      @click=${() => { if (bookable) { this.roomId = r.calendar_id; this.start = null; } }}>
      <span class="sq" style=${`--h:${colorVar(cal.color)}`}></span>
      <div class="grow"><div class="name ell" title=${r.name}>${r.name}</div><div class="sub ell">${r.capacity ? html`<span class="num">${r.capacity}</span> מקומות` : 'ללא הגבלת מקום'}${eq ? ` · ${eq}` : ''}</div>
        <div class="mini" aria-hidden="true">${r.entries.map((o) => { const s = span(o, this.day, 7, 23); return s ? html`<i class=${o.state === 'pending' ? 'p' : ''} style=${`left:${s.start}%;width:${s.width}%`}></i>` : nothing; })}</div></div>
      <div class="rnext">${bookable ? (nf ? html`<small>פנוי מ־</small><b>${hm(nf)}</b>` : html`<b class="none">תפוס ${this.dayIdx ? 'ביום הזה' : 'היום'}</b>`) : html`<b class="none">תפוס</b><small>צפייה בלבד</small>`}
        ${approval && bookable ? html`<span class="chip acc">באישור</span>` : nothing}</div></button>`;
  }

  private pager(page: number, pages: number) {
    if (pages <= 1) return nothing;
    return html`<div class="pager" data-res-pager><button type="button" class="btn icon" aria-label="הקודם" ?disabled=${page <= 1} @click=${() => (this.page = page - 1)}><sw-icon name="chevronBack" size="16"></sw-icon></button>
      <span class="num">${page} / ${pages}</span><button type="button" class="btn icon" aria-label="הבא" ?disabled=${page >= pages} data-res-next @click=${() => (this.page = page + 1)}><sw-icon name="chevron" size="16"></sw-icon></button></div>`;
  }

  // ---------------------------------------------------------------- choosing a time (owner answer 16 as a setting)

  private slots(r: RoomDay): Slot[] {
    return slotGrid(r.entries, this.day, r.open, this.duration, 30, this.now);
  }

  private slotView(r: RoomDay, cal: Calendar) {
    const approval = cal.approval_mode !== 'none';
    const sel = this.start;
    const end = sel ? new Date(sel.getTime() + this.duration * 60000) : null;
    const timeline = this.ui.phone_time_picker === 'timeline';
    return html`<section class="panel" data-res-view="slot" data-picker=${timeline ? 'timeline' : 'grid'}>
      <div class="shead"><span class="sq" style=${`--h:${colorVar(cal.color)}`}></span><div class="grow"><b class="ell" title=${r.name}>${r.name}</b>
        <span class="sub">${this.dayIdx === 0 ? 'היום' : this.dayIdx === 1 ? 'מחר' : DAY_SHORT[this.day.getDay()]} · ${DAY_LONG[this.day.getDay()]} ${ddmm(this.day)}${approval ? ' · כל בקשה באישור' : ''}</span></div>
        <button type="button" class="btn icon" aria-label="חזרה לחדרים" data-res-back @click=${() => { this.roomId = ''; this.start = null; }}><sw-icon name="chevron" size="16"></sw-icon></button></div>
      <div class="seg dur" role="radiogroup" aria-label="משך">${DURATIONS.map(([m, l]) => html`<button type="button" role="radio" aria-pressed=${String(this.duration === m)} aria-checked=${String(this.duration === m)} data-res-dur=${m}
        @click=${() => { this.duration = m; this.start = null; }}>${l}</button>`)}</div>
      ${timeline ? this.timelineView(r) : this.gridView(r)}
      <button type="button" class="btn pri go" data-res-continue ?disabled=${!sel} @click=${() => { this.evTitle = ''; this.people = Math.max(1, this.headcount || 1); this.actionError = ''; this.sheet = { kind: 'confirm' }; }}>
        <sw-icon name="check" size="16"></sw-icon>${sel && end ? html`המשך · <span class="num ltr">${hm(sel)}–${hm(end)}</span>` : 'בחירת שעת התחלה'}</button>
    </section>`;
  }

  private gridView(r: RoomDay) {
    const display = this.ui.resident_pending_display;
    const all = this.slots(r);
    const p = pageOf(all, this.page, this.per);
    const sel = this.start;
    const end = sel ? sel.getTime() + this.duration * 60000 : 0;
    if (!all.length) return html`<div class="center"><sw-state-panel state="empty" compact data-res-state="noslots" heading="אין שעות פנויות ביום הזה" hint="אפשר לבחור יום אחר או משך קצר יותר."></sw-state-panel></div>`;
    return html`<div class="slots" data-fit="56" data-res-slots>${p.items.map((s) => {
      const look = slotLook(s, display);
      const inSel = !!sel && s.start.getTime() >= sel.getTime() && s.start.getTime() < end;
      return html`<button type="button" class="slot" data-look=${look} ?data-sel=${inSel} data-res-slot=${hm(s.start)} ?disabled=${look === 'busy' || look === 'blocked'}
        aria-label=${`${hm(s.start)} ${look === 'busy' ? 'תפוס' : look === 'blocked' ? 'יש בקשות ממתינות' : look === 'contest' ? `${s.pending} מבקשים` : 'פנוי'}`}
        @click=${() => (this.start = s.start)}><b>${hm(s.start)}</b>${look === 'busy' ? html`<small>תפוס</small>` : look === 'blocked' ? html`<small>ממתין</small>` : look === 'contest' ? html`<small>${s.pending} מבקשים</small>` : nothing}</button>`;
    })}</div>
    ${this.pager(p.page, p.pages)}
    <div class="legend"><span><i class="lf"></i>פנוי</span>${display === 'count' ? html`<span><i class="lc"></i>יש בקשות ממתינות, אפשר לבקש</span>` : display === 'blocked' ? html`<span><i class="lb"></i>יש בקשות ממתינות</span>` : nothing}<span><i class="lb"></i>תפוס</span></div>`;
  }

  /** The time bar: tap or drag places the chosen duration; the window moves by three hours. LTR geometry inside the RTL page. */
  private timelineView(r: RoomDay) {
    const win = { from: this.tlFrom, to: Math.min(24, this.tlFrom + 6) };
    const total = (win.to - win.from) * 60;
    const sel = this.start;
    const free = sel ? this.slotFree(r, sel) : true;
    const selSpan = sel ? span({ start: sel.toISOString(), end: new Date(sel.getTime() + this.duration * 60000).toISOString() }, this.day, win.from, win.to) : null;
    const place = (e: PointerEvent) => {
      const bar = e.currentTarget as HTMLElement;
      const rect = bar.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
      const min = Math.round((win.from * 60 + x * total - this.duration / 2) / 15) * 15;
      const st = new Date(startOfDay(this.day).getTime() + Math.max(win.from * 60, Math.min(win.to * 60 - this.duration, min)) * 60000);
      if (st >= this.now) this.start = st;
    };
    return html`<div class="tl" data-res-timeline>
      <div class="tlnav"><button type="button" class="btn icon" aria-label="מוקדם יותר" ?disabled=${win.from <= 0} @click=${() => (this.tlFrom = Math.max(0, this.tlFrom - 3))}><sw-icon name="chevron" size="16"></sw-icon></button>
        <div class="tlsel num" data-res-tlsel>${sel ? html`<span class="ltr">${hm(sel)}–${hm(new Date(sel.getTime() + this.duration * 60000))}</span>${free ? '' : ' · תפוס'}` : 'נגיעה בפס בוחרת שעה'}</div>
        <button type="button" class="btn icon" aria-label="מאוחר יותר" ?disabled=${win.to >= 24} @click=${() => (this.tlFrom = Math.min(18, this.tlFrom + 3))}><sw-icon name="chevronBack" size="16"></sw-icon></button></div>
      <div class="bar" role="slider" aria-label="שעת התחלה" aria-valuetext=${sel ? hm(sel) : ''} tabindex="0" data-res-bar
        @pointerdown=${(e: PointerEvent) => { this.drag = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); place(e); }}
        @pointermove=${(e: PointerEvent) => { if (this.drag) place(e); }} @pointerup=${() => (this.drag = false)} @pointercancel=${() => (this.drag = false)}
        @keydown=${(e: KeyboardEvent) => this.tlKey(e)}>
        ${r.entries.map((o) => { const s = span(o, this.day, win.from, win.to); return s ? html`<span class=${`e ${o.state === 'pending' ? 'p' : ''}`} style=${`left:${s.start}%;width:${s.width}%`}></span>` : nothing; })}
        ${selSpan ? html`<span class=${`sel ${free ? '' : 'bad'}`} style=${`left:${selSpan.start}%;width:${selSpan.width}%`}></span>` : nothing}
      </div>
      <div class="axis" aria-hidden="true">${Array.from({ length: win.to - win.from + 1 }, (_, i) => html`<span style=${`left:${(i / (win.to - win.from)) * 100}%`}>${String(win.from + i).padStart(2, '0')}</span>`)}</div>
    </div>`;
  }

  private tlKey(e: KeyboardEvent): void {
    const step = e.key === 'ArrowRight' ? 15 : e.key === 'ArrowLeft' ? -15 : 0;
    if (!step) return;
    e.preventDefault();
    const base = this.start ?? new Date(startOfDay(this.day).getTime() + this.tlFrom * 3600000);
    const next = new Date(base.getTime() + step * 60000);
    if (next >= this.now) this.start = next;
  }

  private slotFree(r: RoomDay, s: Date): boolean {
    const e = new Date(s.getTime() + this.duration * 60000);
    const blocked = this.ui.resident_pending_display === 'blocked';
    return !r.entries.some((o) => new Date(o.start) < e && new Date(o.end) > s && (o.state === 'confirmed' || (blocked && o.state === 'pending')));
  }

  // ---------------------------------------------------------------- ההזמנות שלי

  private mineView() {
    if (!this.mine) return this.stateView();
    const list = this.mine;
    const p = pageOf(list, this.page, this.per);
    return html`<section class="panel" data-res-view="mine">
      ${this.done ? html`<div class="done" role="status" data-res-done><sw-icon name="check" size="18"></sw-icon><div><b>${this.done}</b><span class="muted">תקבל הודעה כשיוחלט</span></div></div>` : nothing}
      <div class="seg" style="align-self:center;flex:none" role="radiogroup" aria-label="הזמנות"><button type="button" role="radio" aria-pressed=${String(!this.past)} aria-checked=${String(!this.past)} data-res-upcoming
        @click=${() => { this.past = false; this.mine = null; void this.loadMine(); }}>קרובות</button>
        <button type="button" role="radio" aria-pressed=${String(this.past)} aria-checked=${String(this.past)} data-res-past @click=${() => { this.past = true; this.mine = null; void this.loadMine(); }}>הסתיימו</button></div>
      ${list.length ? html`<div class="list" style="display:grid;grid-template-columns:minmax(0,1fr);align-content:start" data-fit="148">${p.items.map((o) => this.booking(o))}</div>${this.pager(p.page, p.pages)}`
        : html`<div class="center"><sw-state-panel state="empty" icon="calendar" data-res-state="mine-empty" heading=${this.past ? 'אין הזמנות שהסתיימו' : 'אין לך הזמנות קרובות'}
          hint=${this.past ? 'הזמנות שהסתיימו נשמרות כאן 30 יום.' : 'חדר פנוי אפשר להזמין בלשונית "הזמנת חדר".'} actionLabel=${this.past ? '' : 'הזמנת חדר'} @action=${() => (this.tab = 'book')}></sw-state-panel></div>`}
    </section>`;
  }

  private booking(o: Occurrence) {
    const cal = this.cal(o.calendar_id);
    const K: Record<string, [string, string]> = { confirmed: ['ok', 'מאושר'], pending: ['dash', 'ממתין'], displaced: ['warn', 'נדחק'], rejected: ['bad', 'נדחה'], expired: ['', 'פג'], done: ['', 'הסתיים'] };
    const [look, label] = K[o.state] ?? ['', o.state];
    const until = this.ui.resident_cancel_until;
    const closed = o.state === 'confirmed' && cancelClosed(o.start, until, this.now);
    const note = o.state === 'pending' ? `ממתין לאישור${o.contested ? ' · יש עוד בקשה לחלון' : ''}` : o.state === 'displaced' ? 'נדחק בגלל תחזוקה. אפשר לבחור זמן אחר' : o.state === 'confirmed' ? 'מאושר' : '';
    return html`<div class="bk" data-state=${o.state} data-res-booking=${o.event_id}>
      <div class="bkt"><span class="dot" style=${`--h:${colorVar(cal?.color)}`}></span><b title=${o.title ?? ''}>${o.title ?? 'הזמנה'}</b><span class=${`chip ${look}`}>${label}</span></div>
      <div class="bkw"><b>${whenText(o.start, o.end, this.now)}</b><span class="sub ell">${cal?.name ?? ''}${o.recurring ? ' · סדרה' : ''}</span></div>
      ${note ? html`<div class="sub ell">${note}</div>` : nothing}
      ${this.past ? nothing : o.state === 'displaced' ? html`<div class="bka"><button type="button" class="btn sm pri" data-res-alts @click=${() => void this.openDisplaced(o)}>בחירת זמן חלופי</button>
          <button type="button" class="btn sm badtxt" data-res-cancel @click=${() => this.openCancel(o)}>ביטול</button></div>`
        : o.state === 'pending' ? html`<div class="bka"><button type="button" class="btn sm badtxt" data-res-withdraw ?disabled=${this.busy} @click=${() => void this.withdraw(o)}>משיכת הבקשה</button></div>`
        : o.state === 'confirmed' ? html`<div class="bka">${closed ? html`<span class="why" data-res-closed>${until === 'start' ? 'המועד התחיל' : `אפשר לבטל עד ${until === '1h' ? 'שעה' : '24 שעות'} לפני; מנהל היומן יכול לבטל`}</span>` : nothing}
          <button type="button" class="btn sm badtxt" data-res-cancel ?disabled=${closed} @click=${() => this.openCancel(o)}>ביטול</button></div>` : nothing}
    </div>`;
  }

  private openCancel(o: Occurrence): void {
    this.cancelScope = 'occurrence';
    this.actionError = '';
    this.sheet = { kind: 'cancel', o };
  }

  private async withdraw(o: Occurrence): Promise<void> {
    if (!this.ctx) return;
    this.busy = true;
    try {
      const ev = await this.ctx.api.event(o.event_id);
      await this.ctx.api.withdrawEvent(o.event_id, ev.event.revision);
      emit(this, CAL_EVENTS.toast, 'הבקשה נמשכה');
      await this.loadMine();
    } catch (e) {
      emit(this, CAL_EVENTS.toast, describeError(e));
    } finally {
      this.busy = false;
    }
  }

  /** Three alternatives for a displaced entry: the same room later that day, the same time the next day, another room at the same time. */
  private async openDisplaced(o: Occurrence): Promise<void> {
    if (!this.ctx) return;
    this.alts = null;
    this.altPick = 0;
    this.actionError = '';
    this.sheet = { kind: 'displaced', o };
    const api = this.ctx.api;
    const s0 = new Date(o.start);
    const dur = new Date(o.end).getTime() - s0.getTime();
    const dmin = Math.max(15, Math.round(dur / 60000));
    const d0 = startOfDay(s0);
    const out: Alt[] = [];
    try {
      const [today, next] = await Promise.all([api.roomsDay(isoDate(d0)), api.roomsDay(isoDate(addDays(d0, 1)))]);
      const room = (list: RoomDay[], id: string) => list.find((r) => r.calendar_id === id);
      const same = room(today.rooms, o.calendar_id);
      const later = same && slotGrid(same.entries.filter((e) => e.event_id !== o.event_id), d0, same.open, dmin, 30, this.now).find((x) => x.free && x.start.getTime() >= new Date(o.end).getTime());
      if (later) out.push({ calendar_id: o.calendar_id, start: later.start, end: new Date(later.start.getTime() + dur), note: 'אותו חדר, אותו אורך' });
      const nd = room(next.rooms, o.calendar_id);
      const ns = new Date(s0.getTime() + 86_400_000);
      if (nd && slotGrid(nd.entries, addDays(d0, 1), nd.open, dmin, 15, this.now).some((x) => x.free && x.start.getTime() === ns.getTime())) {
        out.push({ calendar_id: o.calendar_id, start: ns, end: new Date(ns.getTime() + dur), note: 'אותה שעה, יום אחר' });
      }
      const other = today.rooms.find((r) => r.calendar_id !== o.calendar_id && BOOKABLE.has(this.cal(r.calendar_id)?.my_role ?? '')
        && !r.entries.some((e) => e.state === 'confirmed' && new Date(e.start) < new Date(o.end) && new Date(e.end) > s0));
      if (other) out.push({ calendar_id: other.calendar_id, start: s0, end: new Date(o.end), note: `אותה שעה, חדר אחר${this.cal(other.calendar_id)?.approval_mode !== 'none' ? ' · באישור' : ''}` });
    } catch (e) {
      this.actionError = describeError(e);
    }
    this.alts = out.slice(0, 3);
  }

  // ---------------------------------------------------------------- sheets

  private close(): void {
    this.sheet = null;
  }

  private sheetView() {
    const s = this.sheet;
    if (!s) return nothing;
    const scrim = html`<div class="scrim" @click=${() => this.close()}></div>`;
    if (s.kind === 'equip') {
      return html`${scrim}<aside class="sheet" role="dialog" aria-label="ציוד" data-res-sheet="equip"><div class="grab" aria-hidden="true"></div>
        <header><div class="grow"><h2>ציוד בחדר</h2><div class="muted">רק חדרים שיש בהם הכול</div></div><button type="button" class="x" aria-label="סגירה" @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
        <div class="body"><div class="eq">${(Object.keys(EQUIP) as Equipment[]).map((e) => html`<button type="button" aria-pressed=${String(this.equip.has(e))} data-res-eq=${e}
          @click=${() => { const n = new Set(this.equip); if (n.has(e)) n.delete(e); else n.add(e); this.equip = n; }}>${EQUIP[e]}</button>`)}</div></div>
        <footer><button type="button" class="btn pri" style="flex:1" @click=${() => this.close()}>הצגת חדרים</button><button type="button" class="btn" @click=${() => (this.equip = new Set())}>ניקוי</button></footer></aside>`;
    }
    if (s.kind === 'confirm') return html`${scrim}${this.confirmSheet()}`;
    if (s.kind === 'cancel') return html`${scrim}${this.cancelSheet(s.o)}`;
    return html`${scrim}${this.displacedSheet(s.o)}`;
  }

  private confirmSheet() {
    const room = this.roomList().find((x) => x.r.calendar_id === this.roomId);
    if (!room || !this.start) return nothing;
    const { r, cal } = room;
    const end = new Date(this.start.getTime() + this.duration * 60000);
    const pending = r.entries.filter((o) => o.state === 'pending' && new Date(o.start) < end && new Date(o.end) > (this.start as Date)).length;
    const approval = cal.approval_mode !== 'none' || pending > 0 || !this.slotFree(r, this.start);
    const owner = cal.owner.name || 'מנהל החדר';
    const timeout = cal.approval_timeout_h ?? 2;
    return html`<aside class="sheet" role="dialog" aria-label="אישור הזמנה" data-res-sheet="confirm"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>${approval ? `בקשה להזמנת ${cal.name}` : `הזמנת ${cal.name}`}</h2><div class="muted ell">${cal.name} · ${whenText(this.start.toISOString(), end.toISOString(), this.now)}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        <div class="fld"><label for="rt">כותרת</label><input id="rt" class="inp" data-res-title maxlength="120" placeholder="למשל: יום הולדת" .value=${this.evTitle} @input=${(e: Event) => (this.evTitle = (e.target as HTMLInputElement).value)}></div>
        <div class="fld"><span class="lbl">משתתפים</span><span class="hc"><button type="button" aria-label="פחות" @click=${() => (this.people = Math.max(1, this.people - 1))}>−</button>
          <b class="num" data-res-people>${this.people}</b><button type="button" aria-label="יותר" @click=${() => (this.people = Math.min(r.capacity ?? 2000, this.people + 1))}>+</button>${r.capacity ? html`מתוך <span class="num">${r.capacity}</span>` : nothing}</span></div>
        <div class="lockline"><sw-icon name="lock" size="14"></sw-icon><span>הזמנה בשמך. הזמנה בשם חוג או לקוח רק לצוות.</span></div>
        ${approval ? html`<div class="note" data-res-approval><sw-icon name="info" size="18"></sw-icon><div><b>הבקשה תישלח ל${owner}</b>
          <span>בקשה לא שומרת את המועד.${pending ? ` יש עוד ${pending === 1 ? 'בקשה אחת' : `${pending} בקשות`} לחלון הזה; מי שיאושר ראשון יקבל אותו.` : ''} אם לא תאושר, תקבל הצעות לזמן אחר.</span></div></div>
          <div class="hint"><sw-icon name="clock" size="14"></sw-icon>${timeout ? `אם לא תהיה החלטה עד ${timeout === 1 ? 'שעה' : timeout === 2 ? 'שעתיים' : `${timeout} שעות`} לפני, הבקשה תפוג ותקבל הודעה.` : 'אם לא תהיה החלטה עד תחילת המועד, הבקשה תפוג.'}</div>` : nothing}
        ${this.actionError ? html`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>` : nothing}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-submit ?disabled=${this.busy} @click=${() => void this.submit(cal, approval)}><sw-icon name="check" size="16"></sw-icon>${approval ? 'שליחה לאישור' : 'הזמנה'}</button>
        <button type="button" class="btn" @click=${() => this.close()}>חזרה</button></footer></aside>`;
  }

  private async submit(cal: Calendar, approval: boolean): Promise<void> {
    if (!this.ctx || !this.start) return;
    this.busy = true;
    this.actionError = '';
    const end = new Date(this.start.getTime() + this.duration * 60000);
    try {
      const r = await this.ctx.api.createEvent({ calendar_id: cal.id, kind: 'booking', title: this.evTitle.trim() || 'הזמנת חדר', start: this.start.toISOString(), end: end.toISOString(), headcount: this.people });
      this.sheet = null;
      this.start = null;
      this.roomId = '';
      this.done = r.state === 'pending' || approval ? `הבקשה נשלחה ל${cal.owner.name || 'מנהל החדר'}` : 'ההזמנה נקבעה';
      this.tab = 'mine';
      this.past = false;
      this.rooms = null;
      void this.loadDay();
      await this.loadMine();
    } catch (e) {
      this.actionError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private cancelSheet(o: Occurrence) {
    const cal = this.cal(o.calendar_id);
    return html`<aside class="sheet" role="alertdialog" aria-label="ביטול הזמנה" data-res-sheet="cancel"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>לבטל את "${o.title ?? 'ההזמנה'}"?</h2><div class="muted ell">${cal?.name ?? ''} · ${whenText(o.start, o.end, this.now)}</div></div></header>
      <div class="body">
        ${o.recurring ? html`<div role="radiogroup" aria-label="מה לבטל" style="display:grid;gap:8px">
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope === 'occurrence')} data-res-scope="occurrence" @click=${() => (this.cancelScope = 'occurrence')}><span class="rad"></span><div><b>רק ${DAY_SHORT[new Date(o.start).getDay()]} ${ddmm(new Date(o.start))}</b><small>שאר המועדים נשארים</small></div></button>
          <button type="button" class="opt" role="radio" aria-checked=${String(this.cancelScope === 'series')} data-res-scope="series" @click=${() => (this.cancelScope = 'series')}><span class="rad"></span><div><b>כל הסדרה</b><small>מועדים שעברו נשארים בהיסטוריה</small></div></button></div>` : nothing}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>החדר יתפנה מיד ומי שביקש אותו יקבל הודעה.</div>
        ${this.actionError ? html`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>` : nothing}
      </div>
      <footer><button type="button" class="btn bad fill" style="flex:1" data-res-cancel-ok ?disabled=${this.busy} @click=${() => void this.cancel(o)}><sw-icon name="trash" size="16"></sw-icon>${o.recurring && this.cancelScope === 'series' ? 'ביטול הסדרה' : 'ביטול המועד'}</button>
        <button type="button" class="btn" @click=${() => this.close()}>השארה</button></footer></aside>`;
  }

  private async cancel(o: Occurrence): Promise<void> {
    if (!this.ctx) return;
    this.busy = true;
    this.actionError = '';
    try {
      const ev = await this.ctx.api.event(o.event_id);
      await this.ctx.api.cancelEvent(o.event_id, ev.event.revision, o.recurring && this.cancelScope === 'occurrence' ? o.start : undefined);
      this.sheet = null;
      emit(this, CAL_EVENTS.toast, 'ההזמנה בוטלה');
      await this.loadMine();
    } catch (e) {
      this.actionError = describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private displacedSheet(o: Occurrence) {
    const alts = this.alts;
    return html`<aside class="sheet" role="dialog" aria-label="בחירת זמן חלופי" data-res-sheet="displaced"><div class="grab" aria-hidden="true"></div>
      <header><div class="grow"><h2>בחירת זמן חלופי</h2><div class="muted">"${o.title ?? 'ההזמנה'}" נדחקה בגלל תחזוקה ב${this.cal(o.calendar_id)?.name ?? 'חדר'}</div></div>
        <button type="button" class="x" aria-label="סגירה" @click=${() => this.close()}><sw-icon name="close" size="16"></sw-icon></button></header>
      <div class="body">
        ${alts === null ? html`${[0, 1, 2].map(() => html`<div class="skel" style="block-size:56px"></div>`)}`
          : alts.length ? html`<div role="radiogroup" aria-label="זמן חלופי" style="display:grid;gap:8px">${alts.map((a, i) => html`<button type="button" class="opt" role="radio" aria-checked=${String(this.altPick === i)} data-res-alt=${i}
            @click=${() => (this.altPick = i)}><span class="rad"></span><div><b class="num">${whenText(a.start.toISOString(), a.end.toISOString(), this.now)} · ${this.cal(a.calendar_id)?.name ?? ''}</b><small>${a.note}</small></div></button>`)}</div>`
          : html`<div class="note warn">אין כרגע זמן חלופי קרוב. אפשר לבחור זמן בלשונית "הזמנת חדר".</div>`}
        <div class="hint"><sw-icon name="info" size="14"></sw-icon>Arx לא מזיז הזמנות לבד. אם לא תבחר, ההזמנה נשארת "נדחק" עד שתבטל.</div>
        ${this.actionError ? html`<div class="note bad" role="alert" data-res-error>${this.actionError}</div>` : nothing}
      </div>
      <footer><button type="button" class="btn pri" style="flex:1" data-res-alt-ok ?disabled=${!alts?.length || this.busy} @click=${() => void this.rebook(o)}><sw-icon name="check" size="16"></sw-icon>קביעה בזמן הזה</button>
        <button type="button" class="btn" @click=${() => this.openCancel(o)}>ביטול ההזמנה</button></footer></aside>`;
  }

  /** Contract section 7: the organizer's pick follows the normal create path; the displaced entry becomes cancelled. */
  private async rebook(o: Occurrence): Promise<void> {
    const a = this.alts?.[this.altPick];
    if (!this.ctx || !a) return;
    this.busy = true;
    this.actionError = '';
    try {
      const r = await this.ctx.api.createEvent({ calendar_id: a.calendar_id, kind: 'booking', title: o.title ?? 'הזמנת חדר', start: a.start.toISOString(), end: a.end.toISOString() });
      const ev = await this.ctx.api.event(o.event_id);
      await this.ctx.api.cancelEvent(o.event_id, ev.event.revision);
      this.sheet = null;
      this.done = r.state === 'pending' ? 'הבקשה לזמן החדש נשלחה לאישור' : 'ההזמנה נקבעה בזמן החדש';
      await this.loadMine();
    } catch (e) {
      this.actionError = describeError(e);
    } finally {
      this.busy = false;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-resident': CalResident;
  }
}
