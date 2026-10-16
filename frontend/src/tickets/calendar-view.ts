import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { automationsStyles } from '../styles/automations-glass';
import { applyAutomationsGlass } from '../api/automations-demo';
import { SkinController } from '../design/skin';
import { bubbleChrome } from '../styles/bubble-chrome';
import { bidi } from '../i18n/bidi';
import type { TicketItem } from '../api/tickets';
import { sentenceFor, type ViewerRole } from './status-sentence';
import { tIcon } from './icons';
import { calName, ct } from './calendar-text';
import {
  DEFAULT_TZ, addDays, dayNum, eventsOf, groupByDay, monthNum, nearestEventWeek, stepWeek, timeText, todayKey, toneOf, unscheduledCount, weekCount, weekKeys, weekStart, weekdayOf,
  type CalKind, type DaySegment,
} from './calendar-model';
import './elapsed-clock';

/**
 * TKCAL: the weekly calendar of the request list (`יומן שבועי`, the fourth mode of tickets/list-view-switch.ts). A Sunday-first week of seven
 * day columns; on a phone one day at a time (the day strip, arrows and a sideways swipe). The items are the list's own items: the visit time
 * (`eta_at`) and the SLA targets, each with the one-sentence status and the running clock. Colours are the existing states (info for a visit,
 * quiet / warn / bad for a target by how near it is). A click opens the request through the host's `hrefOf` (the drawer or the full screen).
 * The host owns the data and the filters (scope, department, text, priority / handler / flags); this element only lays them out.
 */
@customElement('tickets-calendar')
export class TicketsCalendar extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) items: readonly TicketItem[] = [];
  @property({ attribute: false }) now: Date = new Date();
  @property({ attribute: false }) hrefOf: (id: string) => string = (id) => `#/tickets/${id}`;
  @property({ attribute: false }) roleOf: (t: TicketItem) => ViewerRole = () => 'manager';
  @property({ type: String }) tz = DEFAULT_TZ;
  @property({ type: Boolean }) hasMore = false;
  @property({ type: Boolean }) loadingMore = false;
  @property({ type: String }) openId = '';
  /** the day the view is anchored on (the week of it is shown; on a phone it is the day shown) */
  @state() private anchor = '';
  @state() private phone = window.matchMedia('(max-width: 767px)').matches;
  private mq = window.matchMedia('(max-width: 767px)');
  private onMq = () => (this.phone = this.mq.matches);
  private touch: { x: number; y: number } | null = null;

  static styles = [bubbleChrome, ...automationsStyles, css`
    :host {
      display: block;
      min-inline-size: 0;
    }
    .cal {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-inline-size: 0;
    }
    .bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 10px;
      min-inline-size: 0;
    }
    .bar h2 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: 700;
      color: var(--dv-text);
      min-inline-size: 0;
      font-variant-numeric: tabular-nums;
    }
    .step {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sw-touch-desktop, 32px);
      block-size: var(--sw-touch-desktop, 32px);
      padding: 0;
      border-radius: var(--sw-r-pill);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      color: var(--dv-text);
      cursor: pointer;
      font-size: var(--sw-fs-lg);
    }
    .step .ic {
      display: block;
    }
    .step.flip .ic {
      transform: scaleX(-1);
    }
    .step:focus-visible,
    .today:focus-visible,
    .dbtn:focus-visible,
    a.ev:focus-visible {
      outline: 2px solid var(--dv-accent);
      outline-offset: 2px;
    }
    .grow {
      flex: 1;
    }
    .cnt {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
    }
    .leg {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 12px;
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .leg li {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .leg i {
      inline-size: 10px;
      block-size: 10px;
      border-radius: var(--sw-r-pill);
      background: var(--c);
    }
    .tone-info {
      --c: var(--dv-accent);
    }
    .tone-quiet {
      --c: var(--dv-text-3);
    }
    .tone-warn {
      --c: var(--dv-warning);
    }
    .tone-bad {
      --c: var(--dv-danger);
    }
    .note {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-2);
      margin: 0;
    }
    /* ---- the week */
    .week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 10px;
      align-items: start;
    }
    .day {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
      min-block-size: 220px;
      padding: 10px 8px 12px;
      box-sizing: border-box;
      border-radius: var(--sw-r-2xl);
    }
    .day.today {
      border-color: color-mix(in srgb, var(--dv-accent) 50%, transparent);
      box-shadow: var(--dv-shadow-1), 0 0 0 3px var(--dv-accent-soft);
    }
    .dhd {
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 0 4px 6px;
      margin-block-end: 4px;
      border-block-end: 1px solid var(--dv-border);
    }
    .dhd b {
      font-size: var(--sw-fs-xl);
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      color: var(--dv-text);
    }
    .day.today .dhd b {
      color: var(--dv-accent-text);
    }
    .dhd small {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-3);
      font-weight: 600;
    }
    .dhd .n {
      margin-inline-start: auto;
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-3);
      font-weight: 700;
    }
    .none {
      font-size: var(--sw-fs-sm);
      color: var(--dv-text-3);
      padding-inline: 4px;
    }
    .evs {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
      min-inline-size: 0;
    }
    a.ev {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      box-sizing: border-box;
      padding: 7px 9px;
      border-radius: var(--sw-r-xl);
      background: var(--dv-surface-2);
      border-inline-start: 3px solid var(--c);
      color: var(--dv-text);
      text-decoration: none;
      cursor: pointer;
      transition: transform 120ms;
    }
    a.ev:hover {
      transform: translateY(-1px);
    }
    a.ev[aria-current='true'] {
      box-shadow: 0 0 0 2px var(--dv-accent-soft);
      border-color: var(--dv-accent);
    }
    .ev .top {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 2px 8px;
      min-inline-size: 0;
    }
    .ev time {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      color: var(--dv-text-2);
    }
    .ev .kind {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      font-weight: 700;
      color: var(--c);
    }
    .ev.tone-quiet .kind {
      color: var(--dv-text-2);
    }
    .ev b {
      font-size: var(--sw-fs-sm);
      font-weight: 700;
      overflow-wrap: anywhere;
    }
    .ev .sent {
      font-size: var(--sw-fs-xs);
      line-height: 1.45;
      color: var(--dv-text-2);
      display: -webkit-box;
      -webkit-line-clamp: 3;
      line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .ev ticket-elapsed {
      font-size: var(--sw-fs-xs);
    }
    /* ---- the phone: one day at a time */
    .strip {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .dbtn {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      min-block-size: 44px;
      padding: 2px 0;
      border-radius: var(--sw-r-xl);
      border: 1px solid var(--dv-border);
      background: var(--dv-surface);
      color: var(--dv-text);
      cursor: pointer;
      font: inherit;
      font-size: var(--sw-fs-sm);
      position: relative;
    }
    .dbtn b {
      font-size: var(--sw-fs-md);
      font-variant-numeric: tabular-nums;
    }
    .dbtn small {
      font-size: var(--sw-fs-xs);
      color: var(--dv-text-3);
    }
    .dbtn[aria-pressed='true'] {
      background: var(--dv-accent-soft);
      border-color: var(--dv-accent);
      color: var(--dv-accent-text);
    }
    .dbtn.today b {
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .dbtn .dot {
      position: absolute;
      inset-block-end: 3px;
      inline-size: 5px;
      block-size: 5px;
      border-radius: var(--sw-r-pill);
      background: var(--dv-accent);
    }
    .dayhd {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .dayhd h3 {
      margin: 0;
      flex: 1;
      font-size: var(--sw-fs-md);
      font-weight: 700;
      color: var(--dv-text);
      min-inline-size: 0;
    }
    .daybox {
      padding: 10px;
      box-sizing: border-box;
      border-radius: var(--sw-r-2xl);
      touch-action: pan-y;
    }
    .more {
      display: flex;
      justify-content: center;
    }
    @media (max-width: 767px) {
      .step {
        inline-size: 44px;
        block-size: 44px;
      }
      .today {
        min-block-size: 44px;
      }
      .bar h2 {
        flex: 1;
        font-size: var(--sw-fs-md);
      }
      a.ev {
        min-block-size: 44px;
        padding: 9px 11px;
      }
      .ev .sent {
        font-size: var(--sw-fs-sm);
      }
    }
  `];

  connectedCallback() {
    super.connectedCallback();
    applyAutomationsGlass(this);
    this.mq.addEventListener('change', this.onMq);
    this.phone = this.mq.matches;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }

  protected willUpdate(_c: PropertyValues<this>): void {
    if (!this.anchor) this.anchor = todayKey(this.now, this.tz);
  }

  // ---------------------------------------------------------------- navigation

  private step(n: number): void {
    this.anchor = this.phone ? addDays(this.anchor, n) : stepWeek(this.anchor, n);
  }

  private goToday = (): void => {
    this.anchor = todayKey(new Date(), this.tz);
  };

  private onKey = (e: KeyboardEvent): void => {
    const t = e.target as HTMLElement | null;
    if (!t || !t.closest('[data-cal-nav]') || e.altKey || e.ctrlKey || e.metaKey) return;
    const rtl = getComputedStyle(this).direction === 'rtl';
    let n = 0;
    if (e.key === 'ArrowRight') n = rtl ? -1 : 1;
    else if (e.key === 'ArrowLeft') n = rtl ? 1 : -1;
    else if (e.key === 'PageUp') n = -1;
    else if (e.key === 'PageDown') n = 1;
    else if (e.key === 'Home') {
      e.preventDefault();
      this.goToday();
      return;
    } else return;
    if (t.closest('.strip') && !this.phone) return;
    e.preventDefault();
    this.step(n);
  };

  private onTouchStart = (e: TouchEvent): void => {
    const p = e.touches[0];
    this.touch = p ? { x: p.clientX, y: p.clientY } : null;
  };

  private onTouchEnd = (e: TouchEvent): void => {
    const s = this.touch;
    this.touch = null;
    const p = e.changedTouches[0];
    if (!s || !p) return;
    const dx = p.clientX - s.x;
    const dy = p.clientY - s.y;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // content dragged to the right reveals the left: "next" in a right-to-left page, "previous" in a left-to-right one
    const rtl = getComputedStyle(this).direction === 'rtl';
    this.step((dx > 0) === rtl ? 1 : -1);
  };

  // ---------------------------------------------------------------- text

  private dateLabel(key: string): string {
    return `${dayNum(key)} ${calName('months', monthNum(key) - 1)}`;
  }

  private weekRange(start: string): { from: string; to: string } {
    const end = addDays(start, 6);
    return monthNum(start) === monthNum(end) ? { from: String(dayNum(start)), to: this.dateLabel(end) } : { from: this.dateLabel(start), to: this.dateLabel(end) };
  }

  private dayName(key: string, short = false): string {
    return calName(short ? 'daysShort' : 'days', weekdayOf(key));
  }

  private kindIcon(kind: CalKind): TemplateResult | typeof nothing {
    return kind === 'visit' ? tIcon('user') : tIcon('clock');
  }

  // ---------------------------------------------------------------- render

  private eventCard(s: DaySegment<TicketItem>): TemplateResult {
    const ev = s.event;
    const t = ev.ticket;
    const tone = toneOf(ev, this.now);
    const role = this.roleOf(t);
    const sentence = sentenceFor(t, role, this.now);
    return html`<li><a class=${`ev tone-${tone}`} href=${this.hrefOf(t.id)} data-cal-event=${ev.kind} data-cal-tone=${tone} data-ticket=${t.id} aria-current=${String(this.openId === t.id)}>
      <span class="top"><time datetime=${new Date(ev.startMs).toISOString()}>${timeText(ev.startMs, this.tz)}</time><span class="kind">${this.kindIcon(ev.kind)}${ct(`calK_${ev.kind}` as 'calK_visit')}</span></span>
      <b>${bidi(`#${t.number} ${t.title}`)}</b>
      <span class="sent" data-cal-sentence title=${sentence}>${sentence}</span>
      <ticket-elapsed .item=${t}></ticket-elapsed>
    </a></li>`;
  }

  private dayList(list: DaySegment<TicketItem>[]): TemplateResult {
    return list.length ? html`<ul class="evs">${list.map((s) => this.eventCard(s))}</ul>` : html`<span class="none" data-cal-day-empty>${ct('calDayEmpty')}</span>`;
  }

  private legend(): TemplateResult {
    const rows: [string, string][] = [['info', ct('calK_visit')], ['quiet', ct('calK_resolve')], ['warn', `${ct('calK_resolve')} < 24h`], ['bad', `${ct('calK_resolve')} !`]];
    return html`<ul class="leg" aria-label=${ct('calLegend')} data-cal-legend>
      ${rows.map(([tone, text]) => html`<li class=${`tone-${tone}`}><i></i>${text}</li>`)}
    </ul>`;
  }

  render() {
    const anchor = this.anchor || todayKey(this.now, this.tz);
    const start = weekStart(anchor);
    const keys = weekKeys(start);
    const today = todayKey(this.now, this.tz);
    const all = eventsOf(this.items as TicketItem[]);
    const by = groupByDay(all as never, keys, this.tz) as Record<string, DaySegment<TicketItem>[]>;
    const n = weekCount(by);
    const unsched = unscheduledCount(this.items);
    const range = this.weekRange(start);
    const nearest = n === 0 ? nearestEventWeek(all, start, this.tz) : null;
    const empty = n === 0;
    const label = ct('calWeekOf', range);
    const countText = n === 0 ? ct('calCountNone') : n === 1 ? ct('calCountOne') : ct('calCount', { n });
    const rtl = getComputedStyle(this).direction === "rtl";
    const prev = this.phone ? ct('calPrevDay') : ct('calPrev');
    const next = this.phone ? ct('calNextDay') : ct('calNext');
    return html`<section class="cal" data-cal data-cal-mode=${this.phone ? 'day' : 'week'} aria-label=${ct('calGroup')} @keydown=${this.onKey}>
      <div class="bar" data-cal-nav>
        <button type="button" class=${`step prev${rtl ? "" : " flip"}`} data-cal-prev aria-label=${prev} title=${prev} @click=${() => this.step(-1)}>${tIcon('back')}</button>
        <button type="button" class=${`step next${rtl ? " flip" : ""}`} data-cal-next aria-label=${next} title=${next} @click=${() => this.step(1)}>${tIcon('back')}</button>
        <h2 data-cal-range aria-live="polite" aria-label=${ct('calWeekAria', range)}>${label}</h2>
        <button type="button" class="btn sm today" data-cal-today title=${ct('calTodayJump')} aria-current=${anchor === today ? "date" : nothing} @click=${this.goToday}>${ct('calToday')}</button>
        <span class="grow"></span>
        <span class="cnt" data-cal-count>${countText}</span>
      </div>
      ${this.legend()}
      ${unsched ? html`<p class="note" data-cal-unscheduled>${unsched === 1 ? ct('calUnscheduledOne') : ct('calUnscheduled', { n: unsched })}</p>` : nothing}
      ${this.phone ? this.dayMode(keys, by, anchor, today) : this.weekMode(keys, by, today)}
      ${empty ? html`<div class="statebox glass" role="status" data-cal-state="empty"><span class="ring">${tIcon('clock')}</span><b>${this.items.length ? ct('calEmptyTitle') : ct('calEmptyAll')}</b>
        ${nearest ? html`<button type="button" class="btn sm" data-cal-nearest @click=${() => (this.anchor = nearest)}>${ct('calJumpNearest')}</button>` : nothing}</div>` : nothing}
      ${this.hasMore ? html`<div class="more"><button type="button" class="btn" data-cal-more ?disabled=${this.loadingMore} @click=${() => this.dispatchEvent(new CustomEvent('cal-load-more', { bubbles: true, composed: true }))}>${ct('calLoadMore')}</button></div>` : nothing}
    </section>`;
  }

  private weekMode(keys: string[], by: Record<string, DaySegment<TicketItem>[]>, today: string): TemplateResult {
    return html`<div class="week" data-cal-week role="group" aria-label=${ct('calDaysStrip')}>
      ${keys.map((k) => html`<section class=${`day glass${k === today ? ' today' : ''}`} data-cal-day=${k} aria-label=${ct('calDayLabel', { day: this.dayName(k), date: this.dateLabel(k) })} aria-current=${k === today ? 'date' : 'false'}>
        <div class="dhd"><b>${dayNum(k)}</b><small>${this.dayName(k, true)}</small>${by[k].length ? html`<span class="n">${by[k].length}</span>` : nothing}</div>
        ${this.dayList(by[k])}
      </section>`)}
    </div>`;
  }

  private dayMode(keys: string[], by: Record<string, DaySegment<TicketItem>[]>, anchor: string, today: string): TemplateResult {
    const list = by[anchor] ?? [];
    return html`<div class="strip" role="group" aria-label=${ct('calDaysStrip')} data-cal-nav data-cal-strip>
        ${keys.map((k) => html`<button type="button" class=${`dbtn${k === today ? ' today' : ''}`} data-cal-pick=${k} aria-pressed=${String(k === anchor)} aria-label=${ct('calDayLabel', { day: this.dayName(k), date: this.dateLabel(k) })}
          @click=${() => (this.anchor = k)}><small>${this.dayName(k, true)}</small><b>${dayNum(k)}</b>${by[k].length ? html`<span class="dot" aria-hidden="true"></span>` : nothing}</button>`)}
      </div>
      <div class="daybox glass" data-cal-day=${anchor} @touchstart=${this.onTouchStart} @touchend=${this.onTouchEnd} title=${ct('calSwipeHint')}>
        <div class="dayhd"><h3>${ct('calDayLabel', { day: this.dayName(anchor), date: this.dateLabel(anchor) })}</h3><span class="cnt">${list.length ? ct('calDayCount', { n: list.length }) : ''}</span></div>
        ${this.dayList(list)}
      </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tickets-calendar': TicketsCalendar;
  }
}
