import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DemoSegment } from '../fixtures/catalog';

export interface TimelineEvent {
  minute: number;
  kind: 'person' | 'vehicle' | 'motion' | 'line' | 'offline' | 'door';
  label: string;
}

const WINDOWS: { label: string; minutes: number }[] = [
  { label: 'שעה', minutes: 60 },
  { label: '6 שע׳', minutes: 360 },
  { label: 'יום', minutes: 1440 },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
export function minuteLabel(m: number) {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(mm / 60))}:${pad(Math.floor(mm % 60))}`;
}

const EVENT_COLOR: Record<TimelineEvent['kind'], string> = {
  motion: '#ef4444',
  person: '#2f6bff',
  vehicle: '#22c55e',
  line: '#f59e0b',
  offline: '#6b7280',
  door: '#8b5cf6',
};

/**
 * Recording timeline in the board-1 style: a row of thin blue activity bars (taller where motion
 * clips exist), a blue marker with a time bubble, hour ticks below, and gaps left visibly empty.
 * Time flows left→right (LTR) inside the RTL shell, like video and maps.
 */
@customElement('sw-timeline')
export class SwTimeline extends LitElement {
  @property({ attribute: false }) segments: DemoSegment[] = [];
  @property({ attribute: false }) events: TimelineEvent[] = [];
  @property({ type: Number }) cursor = 615;
  @property({ type: Number }) windowMinutes = 360;
  @property() precision: 'verified' | 'keyframe_limited' | 'estimated' | 'unknown' = 'estimated';

  @state() private hover: number | null = null;

  static styles = css`
    :host {
      display: block;
      direction: ltr;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      padding: var(--sw-s-3) var(--sw-s-3) var(--sw-s-2);
      user-select: none;
      box-shadow: var(--sw-shadow-1);
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      direction: rtl;
      margin-block-end: 6px;
      flex-wrap: wrap;
    }
    .windows {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: 7px;
      padding: 2px;
    }
    .windows button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      border-radius: 5px;
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .windows button.on {
      background: var(--sw-surface);
      color: var(--sw-accent-text);
      box-shadow: var(--sw-shadow-1);
    }
    .precision {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
    svg {
      inline-size: 100%;
      block-size: 96px;
      display: block;
      cursor: crosshair;
    }
    .legend {
      display: flex;
      gap: var(--sw-s-4);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      margin-block-start: 4px;
      flex-wrap: wrap;
    }
    .legend span::before {
      content: '';
      display: inline-block;
      inline-size: 10px;
      block-size: 10px;
      border-radius: 50%;
      margin-inline-end: 6px;
      vertical-align: middle;
      background: var(--lg);
    }
  `;

  private get start() {
    return Math.max(0, Math.min(1440 - this.windowMinutes, this.cursor - this.windowMinutes / 2));
  }

  private x(minute: number, width: number) {
    return ((minute - this.start) / this.windowMinutes) * width;
  }

  private onMove(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    this.hover = Math.round(this.start + ((e.clientX - rect.left) / rect.width) * this.windowMinutes);
  }

  private onClick(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const minute = Math.round(this.start + ((e.clientX - rect.left) / rect.width) * this.windowMinutes);
    this.cursor = minute;
    this.dispatchEvent(new CustomEvent('seek', { detail: { minute }, bubbles: true, composed: true }));
  }

  /** Activity per bucket: 0 = no recording, 1 = continuous, 2 = motion clip, 3 = event nearby. */
  private buckets(count: number) {
    const out: number[] = [];
    const size = this.windowMinutes / count;
    for (let i = 0; i < count; i++) {
      const a = this.start + i * size;
      const b = a + size;
      let level = 0;
      for (const s of this.segments) {
        if (s.endMin > a && s.startMin < b) level = Math.max(level, s.kind === 'motion' ? 2 : 1);
      }
      if (level && this.events.some((ev) => ev.minute >= a - size && ev.minute <= b + size)) level = 3;
      out.push(level);
    }
    return out;
  }

  render() {
    const W = 1000;
    const H = 96;
    const baseY = 66;
    const count = 140;
    const bw = W / count;
    const tickEvery = this.windowMinutes <= 60 ? 10 : this.windowMinutes <= 360 ? 60 : 180;
    const ticks: number[] = [];
    for (let m = Math.ceil(this.start / tickEvery) * tickEvery; m <= this.start + this.windowMinutes; m += tickEvery) ticks.push(m);
    const heights = [0, 14, 30, 42];
    const precisionText = { verified: 'זמן מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'זמן משוער', unknown: 'דיוק לא ידוע' }[this.precision];
    const cx = this.x(this.cursor, W);
    const label = minuteLabel(this.cursor);
    return html`
      <div class="bar">
        <span class="precision">${precisionText} · לחיצה על הציר מבצעת seek</span>
        <div class="windows">
          ${WINDOWS.map((w) => html`<button class=${w.minutes === this.windowMinutes ? 'on' : ''} @click=${() => (this.windowMinutes = w.minutes)}>${w.label}</button>`)}
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" @mousemove=${this.onMove} @mouseleave=${() => (this.hover = null)} @click=${this.onClick} role="img" aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${W} y1=${baseY + 0.5} y2=${baseY + 0.5} stroke="var(--sw-border)" />
        ${this.buckets(count).map((lvl, i) => {
          if (!lvl) return nothing;
          const h = heights[lvl];
          return svg`<rect x=${i * bw + 1} y=${baseY - h} width=${Math.max(2, bw - 2)} height=${h} rx="1.5" fill=${lvl === 3 ? 'var(--sw-accent)' : 'var(--sw-accent)'} opacity=${lvl === 1 ? 0.45 : lvl === 2 ? 0.8 : 1} />`;
        })}
        ${ticks.map((m) => svg`<line x1=${this.x(m, W)} x2=${this.x(m, W)} y1=${baseY} y2=${baseY + 6} stroke="var(--sw-border-strong)" /><text x=${this.x(m, W)} y=${H - 6} font-size="11" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${minuteLabel(m)}</text>`)}
        ${this.events.map((ev) => {
          const x = this.x(ev.minute, W);
          if (x < 0 || x > W) return nothing;
          return svg`<g><circle cx=${x} cy=${baseY - heights[3] - 8} r="3.5" fill=${EVENT_COLOR[ev.kind]} /><title>${ev.label} · ${minuteLabel(ev.minute)}</title></g>`;
        })}
        ${this.hover !== null ? svg`<line x1=${this.x(this.hover, W)} x2=${this.x(this.hover, W)} y1="18" y2=${baseY} stroke="var(--sw-text-3)" stroke-dasharray="3 3" />` : nothing}
        <g transform="translate(${cx} 0)">
          <line x1="0" x2="0" y1="16" y2=${baseY + 4} stroke="var(--sw-accent)" stroke-width="2" />
          <rect x="-26" y="0" width="52" height="18" rx="5" fill="var(--sw-accent)" />
          <text x="0" y="13" font-size="11.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${label}</text>
        </g>
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-accent)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: #ef4444">תנועה</span>
        <span style="--lg: #2f6bff">אדם</span>
        <span style="--lg: #22c55e">רכב</span>
        <span style="--lg: #8b5cf6">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-timeline': SwTimeline;
  }
}
