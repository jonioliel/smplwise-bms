import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elapsedView, type ElapsedInput } from './elapsed-model';
import { lt } from './list-text';
import { subscribeClock } from '../api/clock-ticker';

/**
 * TKUI4: ONE shared minute ticker for every running clock on the screen - no per-second timers, no timer per element. CLOCK-293: it is now the
 * page-wide wall-clock ticker (api/clock-ticker.ts): aligned to the minute, resumes on visibility / focus / wake from sleep, stops with the
 * last clock.
 */
let running = 0;
/** the number of running clocks (the tests read it) */
export function runningClocks(): number {
  return running;
}

/**
 * `<ticket-elapsed .item>`: "פתוחה 3 ש׳ 12 ד׳" while open, "טופלה תוך 5 ש׳ 40 ד׳" once closed (frozen). The text is static for a screen reader
 * (no aria-live: a tick is never announced); the colour is quiet and follows the existing SLA state only. Reusable by the drawer header.
 */
@customElement('ticket-elapsed')
export class TicketElapsed extends LitElement {
  @property({ attribute: false }) item!: ElapsedInput;
  @state() private now = new Date();
  private off: (() => void) | null = null;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      min-inline-size: 0;
    }
    /* a narrow host (the calendar's week columns) sets --sw-elapsed-wrap: normal and its own --sw-elapsed-fs */
    span {
      font-size: var(--sw-elapsed-fs, var(--sw-fs-base));
      font-variant-numeric: tabular-nums;
      color: var(--dv-text-2);
      white-space: var(--sw-elapsed-wrap, nowrap);
      overflow-wrap: anywhere;
      min-inline-size: 0;
    }
    span.warn {
      color: var(--au-warn-text);
      font-weight: 600;
    }
    span.bad {
      color: var(--dv-danger);
      font-weight: 600;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.now = new Date();
    running++;
    const off = subscribeClock((now) => (this.now = now));
    this.off = () => {
      running--;
      off();
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.off?.();
    this.off = null;
  }

  render() {
    const v = this.item ? elapsedView(this.item, this.now) : null;
    if (!v) return nothing;
    return html`<span class=${v.tone} data-elapsed=${v.frozen ? 'frozen' : 'open'} title=${lt('elTitle')}>${v.text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-elapsed': TicketElapsed;
  }
}
