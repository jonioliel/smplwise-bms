import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { elapsedView, type ElapsedInput } from './elapsed-model';
import { lt } from './list-text';

/**
 * TKUI4: ONE shared minute ticker for every running clock on the screen - no per-second timers, no timer per element. It runs only while
 * a clock is connected, skips ticks while the tab is hidden (and ticks at once when it is visible again), and stops with the last clock.
 */
const subs = new Set<() => void>();
let timer = 0;
function tickAll(): void {
  if (document.visibilityState === 'hidden') return;
  subs.forEach((f) => f());
}
function subscribe(f: () => void): () => void {
  subs.add(f);
  if (!timer) {
    timer = window.setInterval(tickAll, 60_000);
    document.addEventListener('visibilitychange', tickAll);
  }
  return () => {
    subs.delete(f);
    if (!subs.size && timer) {
      window.clearInterval(timer);
      timer = 0;
      document.removeEventListener('visibilitychange', tickAll);
    }
  };
}
/** the number of running clocks (the tests read it) */
export function runningClocks(): number {
  return subs.size;
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
    this.off = subscribe(() => (this.now = new Date()));
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
