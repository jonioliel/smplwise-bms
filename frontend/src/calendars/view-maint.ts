import { LitElement, html, nothing, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import type { Occurrence, OverlapMode } from '../api/calendars';
import { CAL_EVENTS, emit, type CalCtx } from './ctx';
import { calCss } from './styles';
import { addDays, colorVar, OVERLAP_SHORT, pageOf, rowsThatFit, startOfDay, whenText } from './model';

/** One maintenance window (its occurrences on the maintenance calendar and on every room it holds, merged). */
interface Win { o: Occurrence; rooms: string[] }

const WIN_STATE: Record<string, [string, string]> = {
  confirmed: ['מוצב', 'ok'], pending: ['ממתין להחלטה', 'dash'], rejected: ['נדחה', 'bad'], cancelled: ['בוטל', ''], done: ['הסתיים', ''], displaced: ['נדחק', 'warn'], expired: ['פג', ''], withdrawn: ['בוטל', ''],
};

/**
 * CALENDARS-UI-2310 slice B: תחזוקה - the maintenance windows of the coming month (and the past week), each with its rooms, when, and its state:
 * placed, or waiting for the room managers (the default overlap mode, "the first confirmed holds"). "חלון תחזוקה" (the page's button, or the
 * empty state's) opens the drawer that previews the overlap before saving. The list pages instead of scrolling.
 */
@customElement('cal-view-maint')
export class CalViewMaint extends LitElement {
  static styles = [calCss, css`
    :host { display: flex; min-block-size: 0; }
    .panel { flex: 1; }
    .list { flex: 1; min-block-size: 0; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
    .row { cursor: default; flex: none; }
    .rooms { display: flex; gap: 4px; flex-wrap: nowrap; overflow: hidden; min-inline-size: 0; max-inline-size: 40%; }
    .when { font-weight: var(--sw-fw-bold); color: var(--sw-heading); font-size: var(--sw-fs-md); white-space: nowrap; }
    .mode { font-size: var(--sw-fs-sm); color: var(--sw-text-3); display: inline-flex; gap: 6px; align-items: center; }
    .mode b { color: var(--sw-heading); }
    .center { flex: 1; display: grid; place-items: center; }
    @media (max-width: 699px) {
      .row { flex-wrap: wrap; row-gap: 6px; }
      .rooms { max-inline-size: 100%; order: 3; inline-size: 100%; }
      .mode { display: none; }
    }
  `];

  @property({ attribute: false }) ctx: CalCtx | null = null;
  @state() private wins: Win[] | null = null;
  @state() private error = '';
  @state() private seg: 'next' | 'past' = 'next';
  @state() private page = 1;
  @state() private listH = 0;
  @state() private overlap: OverlapMode = 'first_holds';
  private ro: ResizeObserver | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.ro?.disconnect();
  }

  protected firstUpdated(): void {
    this.ro = new ResizeObserver(() => this.measure());
    this.ro.observe(this);
  }

  protected updated(): void {
    this.measure();
  }

  private measure(): void {
    const el = this.renderRoot.querySelector('.list') as HTMLElement | null;
    if (el && Math.abs(el.clientHeight - this.listH) > 4) this.listH = el.clientHeight;
  }

  private async load(): Promise<void> {
    if (!this.ctx) return;
    const now = this.ctx.now;
    try {
      const { occurrences } = await this.ctx.api.occurrences(startOfDay(addDays(now, -7)).toISOString(), startOfDay(addDays(now, 54)).toISOString());
      const by = new Map<string, Win>();
      for (const o of occurrences.filter((x) => x.kind === 'maintenance' || x.kind === 'maintenance_task')) {
        const k = `${o.event_id}@${o.start}`;
        const w = by.get(k) ?? { o, rooms: [] };
        const isRoom = this.ctx.cals.find((c) => c.id === o.calendar_id)?.type === 'room';
        for (const r of [...o.room_calendar_ids, ...(isRoom ? [o.calendar_id] : [])]) if (!w.rooms.includes(r)) w.rooms.push(r);
        if (!isRoom) w.o = { ...o, room_calendar_ids: w.o.room_calendar_ids };
        by.set(k, w);
      }
      void this.ctx.api.settings().then((r) => (this.overlap = r.settings.maintenance_overlap)).catch(() => undefined);
      this.wins = [...by.values()].sort((a, b) => a.o.start.localeCompare(b.o.start));
      this.error = '';
    } catch (e) {
      this.error = describeError(e);
    }
  }

  render() {
    if (!this.ctx) return nothing;
    if (this.error && !this.wins) {
      return html`<section class="panel" data-cal-state="error"><div class="center"><sw-state-panel state="error" heading="חלונות התחזוקה לא נטענו" hint=${this.error} actionLabel="לנסות שוב" @action=${() => void this.load()}></sw-state-panel></div></section>`;
    }
    if (!this.wins) return html`<section class="panel" aria-busy="true">${Array.from({ length: 5 }, () => html`<div class="skel" style="block-size:56px"></div>`)}</section>`;
    const now = this.ctx.now.toISOString();
    const list = this.seg === 'next' ? this.wins.filter((w) => w.o.end >= now) : this.wins.filter((w) => w.o.end < now).reverse();
    const rowH = this.ctx.device === 'phone' ? 104 : 64;
    const pg = pageOf(list, this.page, this.listH ? rowsThatFit(this.listH + 6, rowH) : 5);
    const can = this.ctx.access.can.maintenance;
    return html`<section class="panel" data-maint-list>
      <div class="ph">
        <div class="seg" role="group" aria-label="חלונות">
          <button type="button" aria-pressed=${String(this.seg === 'next')} data-seg="next" @click=${() => { this.seg = 'next'; this.page = 1; }}>הבאים <span class="num">${this.wins.filter((w) => w.o.end >= now).length}</span></button>
          <button type="button" aria-pressed=${String(this.seg === 'past')} data-seg="past" @click=${() => { this.seg = 'past'; this.page = 1; }}>השבוע שעבר</button>
        </div>
        <span class="sp"></span>
        <span class="mode"><sw-icon name="info" size="14"></sw-icon>מעל הזמנה מאושרת: <b>${OVERLAP_SHORT[this.overlap]}</b></span>
      </div>
      ${list.length ? html`<div class="list">${pg.items.map((w) => this.row(w))}</div>
        <div class="pager" data-pager><button type="button" class="btn" aria-label="הקודם" ?disabled=${pg.page <= 1} @click=${() => (this.page = pg.page - 1)}><sw-icon name="chevron" size="14"></sw-icon></button>
          <span class="num" data-page>${pg.page} / ${pg.pages}</span>
          <button type="button" class="btn" aria-label="הבא" ?disabled=${pg.page >= pg.pages} @click=${() => (this.page = pg.page + 1)}><sw-icon name="chevronBack" size="14"></sw-icon></button></div>`
      : html`<div class="center" data-cal-state="empty"><sw-state-panel state="empty" icon="wrench" heading=${this.seg === 'next' ? 'אין חלונות תחזוקה מתוכננים' : 'לא היו חלונות תחזוקה בשבוע שעבר'}
          hint="חלון תחזוקה מסמן חדרים כתפוסים לעבודה; לפני השמירה רואים אם הוא חופף להזמנות." actionLabel=${can && this.seg === 'next' ? 'חלון תחזוקה חדש' : ''}
          @action=${() => emit(this, CAL_EVENTS.newMaint, {})}></sw-state-panel></div>`}
    </section>`;
  }

  private row(w: Win) {
    const cal = this.ctx?.cals.find((c) => c.id === w.o.calendar_id);
    const [label, look] = WIN_STATE[w.o.state] ?? [w.o.state, ''];
    const names = w.rooms.map((r) => this.ctx?.cals.find((c) => c.id === r)).filter(Boolean);
    return html`<div class="row" data-maint-row=${w.o.event_id}>
      <span class="sq" style=${`--h:${colorVar(cal?.color ?? 'orange')}`}></span>
      <div class="grow"><div class="name ell" title=${w.o.title ?? ''}>${w.o.title ?? 'חלון תחזוקה'}</div><div class="sub ell">${cal?.name ?? ''}${w.o.contested ? ' · מתחרה על החלון' : ''}</div></div>
      <div class="rooms">${names.map((c) => html`<span class="chip" title=${c!.name}><span class="dot" style=${`--h:${colorVar(c!.color)}`}></span>${c!.name}</span>`)}</div>
      <span class="when num">${whenText(w.o.start, w.o.end, this.ctx?.now ?? new Date())}</span>
      <span class=${`chip ${look}`}>${label}</span>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'cal-view-maint': CalViewMaint;
  }
}
