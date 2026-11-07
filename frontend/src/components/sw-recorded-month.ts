import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import './sw-icon';
import { WEEKDAYS_HE, WEEKDAY_NAMES_HE, canGoNext, dayLabel, monthGrid, monthOf, monthTitle, shiftMonth, summaryText, type MonthCell } from './recorded-month-logic';

export interface MonthAnswer {
  days: string[];
  coverage: 'complete' | 'partial';
}
export type MonthLoader = (month: string) => Promise<MonthAnswer>;

/**
 * RECORDED-DAYS-MONTH-2407: the month view of the playback screen - a calendar button beside the date field that opens a
 * small month card (the legacy add-on's monthly calendar of days with recordings). Days with recordings carry the
 * recorded accent; a tap on a day fires `pick` with its date and closes the card. Future days are disabled; while the
 * answer is on its way past days are "checking", never "empty".
 *
 * The card lives in the top layer (popover), anchored under the button on a desktop and a bottom sheet on a phone; the
 * grid always reserves six weeks, so changing months never moves the card and nothing inside it scrolls (owner rule:
 * no scrolling in control screens). Hebrew, RTL: the week runs Sunday → Saturday from the right; "previous month" is
 * the chevron on the right side.
 */
@customElement('sw-recorded-month')
export class SwRecordedMonth extends LitElement {
  /** The selected local date (YYYY-MM-DD). */
  @property() value = '';
  /** Today in the installation's zone (YYYY-MM-DD): later days are disabled, later months are not offered. */
  @property() today = '';
  @property({ attribute: false }) loader: MonthLoader | null = null;
  @property({ type: Boolean, reflect: true }) disabled = false;

  @state() private open = false;
  @state() private month = '';
  @state() private answer: MonthAnswer | null = null;
  @state() private error = '';
  @state() private sheet = false;
  /** The day the keyboard is on (roving tab stop). */
  @state() private focusDate = '';
  private seq = 0;
  private cache = new Map<string, MonthAnswer>();

  @query('.pop') private pop!: HTMLElement & { showPopover?: () => void; hidePopover?: () => void };
  @query('.trigger') private trigger!: HTMLButtonElement;

  static styles = css`
    :host {
      display: inline-flex;
    }
    .trigger {
      display: inline-grid;
      place-items: center;
      inline-size: 38px;
      block-size: 38px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text-2);
      cursor: pointer;
      transition: background var(--sw-t-hover) var(--sw-ease-color), border-color var(--sw-t-hover) var(--sw-ease-color), transform var(--sw-t-press) var(--sw-ease);
    }
    @media (hover: hover) {
      .trigger:hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .trigger:active {
      transform: scale(0.96);
    }
    .trigger[aria-expanded='true'] {
      border-color: var(--sw-accent);
      color: var(--sw-accent-text);
    }
    .trigger:disabled {
      opacity: 0.45;
      cursor: default;
    }
    @media (max-width: 1100px), (pointer: coarse) {
      .trigger {
        inline-size: 44px;
        block-size: 44px;
      }
    }
    button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: var(--sw-focus-offset);
    }

    .pop {
      position: fixed;
      inset: auto;
      margin: 0;
      box-sizing: border-box;
      inline-size: 296px;
      padding: 12px;
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      background: var(--sw-menu-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-3);
      overflow: hidden;
      transform-origin: top center;
      transition: opacity var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease);
    }
    @starting-style {
      .pop:popover-open {
        opacity: 0;
        transform: scale(0.97) translateY(-4px);
      }
    }
    .pop.sheet {
      inset-inline: 0;
      inset-block: auto 0;
      inline-size: auto;
      padding: 14px 16px calc(16px + env(safe-area-inset-bottom, 0px));
      border-radius: var(--sw-r-xl) var(--sw-r-xl) 0 0;
      transform-origin: bottom center;
    }
    @starting-style {
      .pop.sheet:popover-open {
        opacity: 1;
        transform: translateY(24px);
      }
    }
    .pop::backdrop {
      background: transparent;
    }
    .pop.sheet::backdrop {
      background: rgb(0 0 0 / 0.32);
    }

    .head {
      display: flex;
      align-items: center;
      gap: 4px;
      margin-block-end: 8px;
    }
    .title {
      flex: 1;
      margin: 0;
      text-align: center;
      font-size: var(--sw-fs-base);
      font-weight: var(--sw-fw-semibold);
      font-variant-numeric: tabular-nums;
    }
    .nav {
      display: inline-grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-2);
      cursor: pointer;
    }
    @media (hover: hover) {
      .nav:not(:disabled):hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
    }
    .nav:disabled {
      opacity: 0.3;
      cursor: default;
    }
    /* the chevron icon points right: in RTL "previous" sits on the right and points right, "next" on the left points left */
    .nav.next sw-icon {
      transform: scaleX(-1);
    }
    :host(:dir(ltr)) .nav.prev sw-icon {
      transform: scaleX(-1);
    }
    :host(:dir(ltr)) .nav.next sw-icon {
      transform: none;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      /* the weekday row + six weeks, always: a month never changes the card's height */
      grid-template-rows: 22px repeat(6, var(--cell));
      gap: 2px;
      --cell: 36px;
    }
    .pop.sheet .grid {
      --cell: 44px;
    }
    .wd {
      display: grid;
      place-items: center;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text-3);
    }
    .day {
      position: relative;
      display: grid;
      place-items: center;
      margin: 0;
      padding: 0;
      border: 0;
      border-radius: var(--sw-r-sm);
      background: transparent;
      color: var(--sw-text-3);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
      cursor: pointer;
      transition: background var(--sw-t-hover) var(--sw-ease-color), color var(--sw-t-hover) var(--sw-ease-color);
    }
    .day[data-state='recorded'] {
      background: var(--sw-accent-soft);
      color: var(--sw-recorded-text, var(--sw-accent-text));
      font-weight: var(--sw-fw-semibold);
    }
    /* the recorded mark is also a shape (a dot under the number), not only a colour */
    .day[data-state='recorded']::after {
      content: '';
      position: absolute;
      inset-block-end: 4px;
      inline-size: 4px;
      block-size: 4px;
      border-radius: 50%;
      background: currentColor;
    }
    .day[data-state='unknown'] {
      color: var(--sw-text-3);
      animation: pulse 1.2s var(--sw-ease-in-out, ease-in-out) infinite alternate;
    }
    @keyframes pulse {
      from { opacity: 0.45; }
      to { opacity: 0.9; }
    }
    @media (prefers-reduced-motion: reduce) {
      .day[data-state='unknown'] {
        animation: none;
      }
      .pop,
      .trigger {
        transition: none;
      }
    }
    @media (hover: hover) {
      .day:not(:disabled):not([aria-current='date']):hover {
        background: var(--sw-surface-2);
        color: var(--sw-text);
      }
      .day[data-state='recorded']:not([aria-current='date']):hover {
        background: var(--sw-accent-soft);
        box-shadow: inset 0 0 0 1px var(--sw-accent);
      }
    }
    .day[data-today] {
      box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    }
    .day[aria-current='date'] {
      background: var(--sw-accent);
      color: var(--sw-text-inverse, #fff);
      font-weight: var(--sw-fw-bold);
    }
    .day:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .foot {
      display: flex;
      align-items: center;
      gap: 8px;
      min-block-size: 28px;
      margin-block-start: 8px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .foot .msg {
      flex: 1;
      min-inline-size: 0;
    }
    .foot[data-partial] .msg {
      color: var(--sw-warning-text);
    }
    .foot[data-error] .msg {
      color: var(--sw-danger-text);
    }
    .retry {
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      cursor: pointer;
    }
    .sr {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('resize', this.onViewport);
  }

  protected willUpdate(changed: PropertyValues<this>): void {
    // a new camera (a new loader) asks the device again
    if (changed.has('loader') && changed.get('loader') !== undefined) {
      this.cache.clear();
      if (this.open) void this.load(this.month);
    }
  }

  /** Open when the pointer went down on the button: the popover's light dismiss closes it on that pointerdown, so the click
   * that follows must not open it again. */
  private openAtPress = false;

  private toggle(): void {
    const wasOpen = this.open || this.openAtPress;
    this.openAtPress = false;
    if (wasOpen) this.close();
    else void this.show();
  }

  private async show(): Promise<void> {
    if (this.disabled) return;
    this.month = monthOf(this.value || this.today);
    this.focusDate = this.value || this.today;
    this.sheet = window.matchMedia('(max-width: 600px)').matches;
    this.open = true;
    await this.updateComplete;
    this.pop.showPopover?.();
    this.place();
    window.addEventListener('resize', this.onViewport);
    void this.load(this.month);
    this.focusDay(false);
  }

  close(returnFocus = true): void {
    if (!this.open) return;
    this.open = false;
    window.removeEventListener('resize', this.onViewport);
    try {
      this.pop?.hidePopover?.();
    } catch {
      /* already hidden (light dismiss) */
    }
    if (returnFocus) this.trigger?.focus({ preventScroll: true });
  }

  private onViewport = () => this.place();

  /** Under the button, its inline-end edge aligned with the button's (right in RTL), kept inside the viewport. */
  private place(): void {
    if (!this.pop) return;
    this.sheet = window.matchMedia('(max-width: 600px)').matches;
    if (this.sheet) {
      this.pop.style.removeProperty('left'); // the sheet is pinned by its class, not by a desktop anchor of an earlier opening
      this.pop.style.removeProperty('top');
      return;
    }
    const r = this.trigger.getBoundingClientRect();
    const w = this.pop.offsetWidth;
    const h = this.pop.offsetHeight;
    const rtl = getComputedStyle(this).direction === 'rtl';
    let left = rtl ? r.right - w : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
    this.pop.style.left = `${Math.round(left)}px`;
    this.pop.style.top = `${Math.round(top)}px`;
  }

  private onToggle(e: Event): void {
    // light dismiss (outside click / Escape) closes the popover by itself: keep the state in step
    if ((e as ToggleEvent).newState === 'closed' && this.open) {
      this.open = false;
      window.removeEventListener('resize', this.onViewport);
    }
  }

  private async load(month: string): Promise<void> {
    const seq = ++this.seq;
    this.error = '';
    const hit = this.cache.get(month);
    this.answer = hit ?? null;
    if (hit || !this.loader) return;
    if (month > monthOf(this.today)) {
      this.answer = { days: [], coverage: 'complete' };
      return;
    }
    try {
      const a = await this.loader(month);
      this.cache.set(month, a);
      if (seq === this.seq) this.answer = a;
    } catch (err) {
      if (seq === this.seq) this.error = err instanceof Error && err.message ? err.message : 'בדיקת ההקלטות נכשלה';
    }
  }

  private go(delta: number): void {
    const next = shiftMonth(this.month, delta);
    if (delta > 0 && !canGoNext(this.month, this.today)) return;
    this.month = next;
    const keep = Number(this.focusDate.slice(8, 10)) || 1;
    this.focusDate = this.clampToMonth(next, keep);
    void this.load(next);
  }

  private clampToMonth(month: string, day: number): string {
    const cells = monthGrid(month, { recorded: [], today: this.today, loaded: false }).filter((c): c is MonthCell => !!c);
    const d = Math.min(day, cells.length);
    const date = `${month}-${String(d).padStart(2, '0')}`;
    return date > this.today ? this.today : date;
  }

  private pick(cell: MonthCell): void {
    if (cell.state === 'future') return;
    this.dispatchEvent(new CustomEvent('pick', { detail: { date: cell.date, recorded: cell.state === 'recorded' }, bubbles: true, composed: true }));
    this.close();
  }

  /** Arrow keys walk the days (in RTL "right" is the previous day), PageUp/PageDown the months, Home/End the week. */
  private onGridKey(e: KeyboardEvent): void {
    const rtl = getComputedStyle(this).direction === 'rtl';
    const step: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -7, ArrowDown: 7 };
    let target = this.focusDate;
    if (e.key in step) {
      const [y, m, d] = this.focusDate.split('-').map(Number);
      const t = new Date(Date.UTC(y, m - 1, d + step[e.key]));
      target = t.toISOString().slice(0, 10);
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      this.go(e.key === 'PageUp' ? -1 : 1);
      e.preventDefault();
      void this.updateComplete.then(() => this.focusDay(true));
      return;
    } else return;
    e.preventDefault();
    if (target > this.today) return;
    this.focusDate = target;
    if (monthOf(target) !== this.month) {
      this.month = monthOf(target);
      void this.load(this.month);
    }
    void this.updateComplete.then(() => this.focusDay(true));
  }

  private focusDay(now: boolean): void {
    const go = () => (this.renderRoot.querySelector(`.day[data-date="${this.focusDate}"]`) as HTMLButtonElement | null)?.focus({ preventScroll: true });
    if (now) go();
    else void this.updateComplete.then(() => requestAnimationFrame(go));
  }

  private renderGrid() {
    const cells = monthGrid(this.month, { recorded: this.answer?.days ?? [], today: this.today, selected: this.value, loaded: !!this.answer });
    const focusable = cells.some((c) => c?.date === this.focusDate) ? this.focusDate : cells.find((c) => c && c.state !== 'future')?.date ?? '';
    return html`<div class="grid" role="grid" aria-labelledby="t" aria-busy=${this.answer || this.error ? 'false' : 'true'} @keydown=${(e: KeyboardEvent) => this.onGridKey(e)}>
      ${WEEKDAYS_HE.map((w, i) => html`<span class="wd" role="columnheader" aria-label=${WEEKDAY_NAMES_HE[i]}>${w}</span>`)}
      ${cells.map((c) =>
        c
          ? html`<button
              class="day"
              role="gridcell"
              data-date=${c.date}
              data-state=${c.state}
              ?data-today=${c.today}
              aria-current=${c.selected ? 'date' : nothing}
              aria-label=${dayLabel(c)}
              tabindex=${c.date === focusable ? 0 : -1}
              ?disabled=${c.state === 'future'}
              @click=${() => this.pick(c)}
            >${c.day}</button>`
          : html`<span aria-hidden="true"></span>`,
      )}
    </div>`;
  }

  private renderFoot() {
    if (this.error)
      return html`<div class="foot" data-error role="status"><span class="msg">${this.error}</span><button class="retry" @click=${() => { this.cache.delete(this.month); void this.load(this.month); }}>נסה שוב</button></div>`;
    if (!this.answer) return html`<div class="foot" role="status"><span class="msg">בודק אילו ימים הוקלטו…</span></div>`;
    return html`<div class="foot" role="status" ?data-partial=${this.answer.coverage === 'partial'}><span class="msg" data-summary>${summaryText(this.answer.days.length, this.answer.coverage)}</span></div>`;
  }

  render() {
    return html`
      <button
        class="trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-label="לוח חודשי · ימים עם הקלטות"
        title="לוח חודשי · ימים עם הקלטות"
        ?disabled=${this.disabled}
        @pointerdown=${() => (this.openAtPress = this.open)}
        @click=${() => this.toggle()}
      >
        <sw-icon name="calendar" size="18"></sw-icon>
      </button>
      <div class="pop ${this.sheet ? 'sheet' : ''}" popover="auto" role="dialog" aria-label="ימים עם הקלטות" @toggle=${(e: Event) => this.onToggle(e)}>
        ${this.open
          ? html`
              <div class="head">
                <button class="nav prev" type="button" aria-label="החודש הקודם" @click=${() => this.go(-1)}><sw-icon name="chevron" size="18"></sw-icon></button>
                <h2 class="title" id="t" aria-live="polite">${monthTitle(this.month)}</h2>
                <button class="nav next" type="button" aria-label="החודש הבא" ?disabled=${!canGoNext(this.month, this.today)} @click=${() => this.go(1)}><sw-icon name="chevron" size="18"></sw-icon></button>
              </div>
              ${this.renderGrid()} ${this.renderFoot()}
            `
          : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-recorded-month': SwRecordedMonth;
  }
}
