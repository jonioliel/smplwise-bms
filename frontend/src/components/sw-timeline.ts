import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
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

/**
 * Recording timeline (SVG): coverage vs gaps vs events, a cursor with the requested time, and zoom
 * windows. Geometry is LTR (time flows left→right) inside the RTL shell, like video and maps.
 */
@customElement('sw-timeline')
export class SwTimeline extends LitElement {
  @property({ attribute: false }) segments: DemoSegment[] = [];
  @property({ attribute: false }) events: TimelineEvent[] = [];
  @property({ type: Number }) cursor = 615; // minute of day
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
      padding: var(--sw-s-3);
      user-select: none;
    }
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      direction: rtl;
      margin-block-end: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .windows {
      display: inline-flex;
      gap: 2px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-pill);
      padding: 2px;
    }
    .windows button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-xs);
      padding: 4px 10px;
      border-radius: var(--sw-r-pill);
      cursor: pointer;
      color: var(--sw-text-2);
    }
    .windows button.on {
      background: var(--sw-surface);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .cursor-label {
      font-family: var(--sw-font-mono);
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-semibold);
      direction: ltr;
    }
    .precision {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    svg {
      inline-size: 100%;
      block-size: 84px;
      display: block;
      cursor: crosshair;
    }
    .legend {
      display: flex;
      gap: var(--sw-s-4);
      direction: rtl;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      margin-block-start: var(--sw-s-2);
    }
    .legend span::before {
      content: '';
      display: inline-block;
      inline-size: 12px;
      block-size: 8px;
      border-radius: 2px;
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
    const minute = this.start + ((e.clientX - rect.left) / rect.width) * this.windowMinutes;
    this.hover = Math.round(minute);
  }

  private onClick(e: MouseEvent) {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    const minute = Math.round(this.start + ((e.clientX - rect.left) / rect.width) * this.windowMinutes);
    this.cursor = minute;
    this.dispatchEvent(new CustomEvent('seek', { detail: { minute }, bubbles: true, composed: true }));
  }

  render() {
    const W = 1000;
    const H = 84;
    const trackY = 30;
    const trackH = 26;
    const tickEvery = this.windowMinutes <= 60 ? 10 : this.windowMinutes <= 360 ? 60 : 180;
    const ticks: number[] = [];
    for (let m = Math.ceil(this.start / tickEvery) * tickEvery; m <= this.start + this.windowMinutes; m += tickEvery) ticks.push(m);
    const precisionText = { verified: 'זמן מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'זמן משוער', unknown: 'דיוק לא ידוע' }[this.precision];
    return html`
      <div class="bar">
        <span class="cursor-label">${minuteLabel(this.cursor)}</span>
        <span class="precision">${precisionText}</span>
        <div class="windows">
          ${WINDOWS.map((w) => html`<button class=${w.minutes === this.windowMinutes ? 'on' : ''} @click=${() => (this.windowMinutes = w.minutes)}>${w.label}</button>`)}
        </div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" @mousemove=${this.onMove} @mouseleave=${() => (this.hover = null)} @click=${this.onClick} role="img" aria-label="ציר זמן הקלטות">
        <rect x="0" y=${trackY} width=${W} height=${trackH} fill="var(--sw-surface-3)" rx="4" />
        ${this.segments.map((s) => {
          const x1 = Math.max(0, this.x(s.startMin, W));
          const x2 = Math.min(W, this.x(s.endMin, W));
          if (x2 <= 0 || x1 >= W) return nothing;
          return svg`<rect x=${x1} y=${trackY} width=${Math.max(1.5, x2 - x1)} height=${trackH} fill=${s.kind === 'motion' ? 'var(--sw-live)' : 'var(--sw-recorded)'} opacity=${s.kind === 'motion' ? 0.85 : 0.75} />`;
        })}
        ${ticks.map((m) => svg`<line x1=${this.x(m, W)} x2=${this.x(m, W)} y1=${trackY - 8} y2=${trackY + trackH + 6} stroke="var(--sw-border-strong)" stroke-width="1" /><text x=${this.x(m, W)} y=${H - 6} font-size="11" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${minuteLabel(m)}</text>`)}
        ${this.events.map((ev) => {
          const x = this.x(ev.minute, W);
          if (x < 0 || x > W) return nothing;
          const color = ev.kind === 'offline' ? 'var(--sw-danger)' : ev.kind === 'person' ? 'var(--sw-stale)' : 'var(--sw-accent)';
          return svg`<g><line x1=${x} x2=${x} y1="10" y2=${trackY - 2} stroke=${color} stroke-width="2" /><circle cx=${x} cy="9" r="4.5" fill=${color} /><title>${ev.label} · ${minuteLabel(ev.minute)}</title></g>`;
        })}
        ${this.hover !== null ? svg`<line x1=${this.x(this.hover, W)} x2=${this.x(this.hover, W)} y1="4" y2=${H - 18} stroke="var(--sw-text-3)" stroke-dasharray="3 3" />` : nothing}
        <g transform="translate(${this.x(this.cursor, W)} 0)">
          <line x1="0" x2="0" y1="2" y2=${H - 18} stroke="var(--sw-text)" stroke-width="2" />
          <path d="M-6 0 H6 L0 7 Z" fill="var(--sw-text)" />
        </g>
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-recorded)">הקלטה רציפה</span>
        <span style="--lg: var(--sw-live)">הקלטת תנועה</span>
        <span style="--lg: var(--sw-surface-3)">אין הקלטה / לא נבדק</span>
        <span style="--lg: var(--sw-stale)">אירועים</span>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-timeline': SwTimeline;
  }
}
