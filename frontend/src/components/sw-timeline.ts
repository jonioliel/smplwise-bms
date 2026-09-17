import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { DemoSegment } from '../fixtures/catalog';

export interface TimelineEvent {
  minute: number;
  kind: 'person' | 'vehicle' | 'motion' | 'line' | 'offline' | 'door';
  label: string;
}

/** A case bookmark on the track (T049): a flag at its start, a thin band over its window. */
export interface TimelineBookmark {
  id: string;
  minute: number;
  endMinute: number;
  label: string;
  preservation: 'preserved' | 'preserving' | 'nvr';
}

const BOOKMARK_COLOR: Record<TimelineBookmark['preservation'], string> = { preserved: '#16a34a', preserving: '#d97706', nvr: '#7c3aed' };

/** Zoom windows from a whole day down to one minute (chapter 23: zoom must not re-query per pixel). */
export const WINDOWS: { label: string; minutes: number }[] = [
  { label: 'יום', minutes: 1440 },
  { label: '6 שע׳', minutes: 360 },
  { label: 'שעה', minutes: 60 },
  { label: '10 דק׳', minutes: 10 },
  { label: 'דקה', minutes: 1 },
];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
export function minuteLabel(m: number) {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${pad(Math.floor(mm / 60))}:${pad(Math.floor(mm % 60))}`;
}
/** HH:MM:SS for fractional minutes (fine zoom). */
export function secondLabel(m: number) {
  const mm = ((m % 1440) + 1440) % 1440;
  const s = Math.min(59, Math.round((mm % 1) * 60));
  return `${minuteLabel(mm)}:${pad(s)}`;
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
 * clips exist), a blue marker with a time bubble, ticks below, and gaps left visibly empty.
 * Time flows left→right (LTR) inside the RTL shell, like video and maps.
 *
 * Interaction: click = seek (`seek` event; whole minutes at day/6 h zoom, seconds below that);
 * drag = scrub (`scrub` events while moving, one `seek` on release); wheel = zoom around the pointer;
 * the window follows the cursor while `follow` is on (playback), a manual pan/zoom pauses following
 * until the next seek.
 */
@customElement('sw-timeline')
export class SwTimeline extends LitElement {
  @property({ attribute: false }) segments: DemoSegment[] = [];
  @property({ attribute: false }) events: TimelineEvent[] = [];
  @property({ attribute: false }) bookmarks: TimelineBookmark[] = [];
  @property({ type: Number }) cursor = 615;
  @property({ type: Number }) windowMinutes = 360;
  @property() precision: 'verified' | 'keyframe_limited' | 'estimated' | 'unknown' = 'estimated';
  /** Keep the visible window centred on the cursor. */
  @property({ type: Boolean }) follow = true;
  /** Minute of day that must not be exceeded (now, for today); later positions are drawn grey and refused. */
  @property({ type: Number }) limit = 1440;

  @state() private hover: number | null = null;
  private lastHoverBucket = -1;
  @state() private viewStart = -1;
  @state() private dragging = false;

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
    g.bm {
      cursor: pointer;
    }
    g.bm:focus-visible polygon {
      stroke: var(--sw-text);
      stroke-width: 1.5;
    }
    svg {
      inline-size: 100%;
      block-size: 84px;
      display: block;
      cursor: crosshair;
      touch-action: none;
    }
    svg.dragging {
      cursor: grabbing;
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

  /** Left edge of the visible window in minutes of day. */
  get start(): number {
    const max = Math.max(0, 1440 - this.windowMinutes);
    if (this.viewStart >= 0 && !this.follow) return Math.max(0, Math.min(max, this.viewStart));
    return Math.max(0, Math.min(max, this.cursor - this.windowMinutes / 2));
  }

  /** Granularity of an emitted seek: whole minutes for day/6 h, 10 s for an hour, 1 s below. */
  private get step(): number {
    return this.windowMinutes >= 360 ? 1 : this.windowMinutes >= 60 ? 1 / 6 : 1 / 60;
  }

  private snap(minute: number): number {
    const st = this.step;
    return Math.max(0, Math.min(this.limit, Math.round(minute / st) * st));
  }

  private x(minute: number, width: number) {
    return ((minute - this.start) / this.windowMinutes) * width;
  }

  private minuteAt(e: PointerEvent | WheelEvent): number {
    const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
    return this.start + ((e.clientX - rect.left) / rect.width) * this.windowMinutes;
  }

  private onMove(e: PointerEvent) {
    const m = this.minuteAt(e);
    this.hover = m;
    if (!this.dragging) {
      const bucket = Math.floor(m * 6); // 10-second buckets keep the preview requests sparse
      if (bucket !== this.lastHoverBucket) {
        this.lastHoverBucket = bucket;
        const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
        this.dispatchEvent(new CustomEvent('hover', { detail: { minute: m, x: e.clientX - rect.left, width: rect.width }, bubbles: true, composed: true }));
      }
    }
    if (this.dragging) {
      const snapped = this.snap(m);
      this.cursor = snapped;
      this.dispatchEvent(new CustomEvent('scrub', { detail: { minute: snapped }, bubbles: true, composed: true }));
    }
  }

  private onDown(e: PointerEvent) {
    if (e.button !== 0) return;
    (e.currentTarget as SVGElement).setPointerCapture(e.pointerId);
    this.dragging = true;
    this.viewStart = this.start;
    this.follow = false;
  }

  private onUp(e: PointerEvent) {
    if (!this.dragging) return;
    this.dragging = false;
    const minute = this.snap(this.minuteAt(e));
    this.cursor = minute;
    this.follow = true;
    this.dispatchEvent(new CustomEvent('seek', { detail: { minute, alt: e.altKey }, bubbles: true, composed: true }));
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const idx = WINDOWS.findIndex((w) => w.minutes === this.windowMinutes);
    const next = Math.max(0, Math.min(WINDOWS.length - 1, idx + (e.deltaY > 0 ? -1 : 1)));
    if (next === idx) return;
    this.setWindow(WINDOWS[next].minutes, this.minuteAt(e));
  }

  /** Change the zoom keeping `anchor` (a minute of day) at the same screen position. */
  setWindow(minutes: number, anchor: number = this.cursor) {
    const rel = Math.max(0, Math.min(1, (anchor - this.start) / this.windowMinutes));
    this.windowMinutes = minutes;
    this.viewStart = anchor - rel * minutes;
    this.follow = false;
    this.dispatchEvent(new CustomEvent('window-change', { detail: { minutes }, bubbles: true, composed: true }));
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

  private tickEvery(): number {
    const w = this.windowMinutes;
    if (w <= 1) return 10 / 60;
    if (w <= 10) return 1;
    if (w <= 60) return 10;
    if (w <= 360) return 60;
    return 180;
  }

  private label(m: number): string {
    return this.windowMinutes <= 10 ? secondLabel(m) : minuteLabel(m);
  }

  render() {
    const W = 1000;
    const H = 84;
    const baseY = 58;
    const count = 160;
    const bw = W / count;
    const tickEvery = this.tickEvery();
    const ticks: number[] = [];
    for (let m = Math.ceil(this.start / tickEvery - 1e-9) * tickEvery; m <= this.start + this.windowMinutes + 1e-9; m += tickEvery) ticks.push(m);
    const heights = [0, 12, 26, 36];
    const precisionText = { verified: 'זמן מאומת', keyframe_limited: 'דיוק לפי keyframe', estimated: 'זמן משוער', unknown: 'דיוק לא ידוע' }[this.precision];
    const cx = this.x(this.cursor, W);
    const label = this.label(this.cursor);
    const bubble = label.length > 5 ? 62 : 48;
    const limitX = this.limit < this.start + this.windowMinutes ? Math.max(0, this.x(this.limit, W)) : null;
    return html`
      <div class="bar">
        <span class="precision">${precisionText} · לחיצה או גרירה = seek · גלגלת = זום</span>
        <div class="windows">
          ${WINDOWS.map((w) => html`<button class=${w.minutes === this.windowMinutes ? 'on' : ''} @click=${() => this.setWindow(w.minutes)}>${w.label}</button>`)}
        </div>
      </div>
      <svg
        class=${this.dragging ? 'dragging' : ''}
        viewBox="0 0 ${W} ${H}"
        preserveAspectRatio="none"
        @pointermove=${this.onMove}
        @pointerleave=${() => { this.hover = null; this.lastHoverBucket = -1; this.dispatchEvent(new CustomEvent('hover-end', { bubbles: true, composed: true })); }}
        @pointerdown=${this.onDown}
        @pointerup=${this.onUp}
        @pointercancel=${() => (this.dragging = false)}
        @wheel=${this.onWheel}
        role="img"
        aria-label="ציר זמן הקלטות">
        <line x1="0" x2=${W} y1=${baseY + 0.5} y2=${baseY + 0.5} stroke="var(--sw-border)" />
        ${limitX !== null ? svg`<rect x=${limitX} y="14" width=${Math.max(0, W - limitX)} height=${baseY - 14} fill="var(--sw-surface-3)" opacity="0.7" />` : nothing}
        ${this.buckets(count).map((lvl, i) => {
          if (!lvl) return nothing;
          const h = heights[lvl];
          return svg`<rect x=${i * bw + 1} y=${baseY - h} width=${Math.max(2, bw - 2)} height=${h} rx="1.5" fill="var(--sw-accent)" opacity=${lvl === 1 ? 0.45 : lvl === 2 ? 0.8 : 1} />`;
        })}
        ${ticks.map((m) => svg`<line x1=${this.x(m, W)} x2=${this.x(m, W)} y1=${baseY} y2=${baseY + 5} stroke="var(--sw-border-strong)" /><text x=${this.x(m, W)} y=${H - 6} font-size="10.5" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font)">${this.label(m)}</text>`)}
        ${this.events.map((ev) => {
          const x = this.x(ev.minute, W);
          if (x < 0 || x > W) return nothing;
          return svg`<g><circle cx=${x} cy=${baseY - heights[3] - 8} r="3.5" fill=${EVENT_COLOR[ev.kind]} /><title>${ev.label} · ${minuteLabel(ev.minute)}</title></g>`;
        })}
        ${this.bookmarks.map((b) => {
          const x = this.x(b.minute, W);
          const x2 = this.x(b.endMinute, W);
          if (x2 < 0 || x > W) return nothing;
          const c = BOOKMARK_COLOR[b.preservation];
          // the track captures the pointer on pointerdown, which would retarget the click to the SVG: the flag keeps
          // the pointerdown to itself and does the seek on its own
          const open = (e: Event) => {
            e.stopPropagation();
            this.cursor = b.minute;
            this.follow = true;
            this.dispatchEvent(new CustomEvent('seek', { detail: { minute: b.minute, alt: false }, bubbles: true, composed: true }));
            this.dispatchEvent(new CustomEvent('bookmark-click', { detail: { id: b.id, minute: b.minute }, bubbles: true, composed: true }));
          };
          return svg`<g class="bm" data-bookmark=${b.id} role="button" tabindex="0" aria-label=${b.label} @pointerdown=${(e: Event) => e.stopPropagation()} @click=${open} @keydown=${(e: KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && open(e)}>
            <rect x=${Math.max(0, x)} y="13" width=${Math.max(2, Math.min(W, x2) - Math.max(0, x))} height="3" rx="1.5" fill=${c} opacity="0.55" />
            <line x1=${x} x2=${x} y1="3" y2=${baseY} stroke=${c} stroke-dasharray="2 3" opacity="0.6" />
            <polygon points=${`${x},2 ${x + 9},6 ${x},10`} fill=${c} />
            <title>${b.label} · ${minuteLabel(b.minute)}</title>
          </g>`;
        })}
        ${this.hover !== null && !this.dragging
          ? svg`<line pointer-events="none" x1=${this.x(this.hover, W)} x2=${this.x(this.hover, W)} y1="18" y2=${baseY} stroke="var(--sw-text-3)" stroke-dasharray="3 3" /><text pointer-events="none" x=${this.x(this.hover, W)} y="12" font-size="10" text-anchor="middle" fill="var(--sw-text-3)" font-family="var(--sw-font-mono)">${this.label(this.hover)}</text>`
          : nothing}
        ${cx >= -60 && cx <= W + 60
          ? svg`<g transform="translate(${cx} 0)" pointer-events="none">
              <line x1="0" x2="0" y1="15" y2=${baseY + 4} stroke="var(--sw-accent)" stroke-width="2" />
              <rect x=${-bubble / 2} y="0" width=${bubble} height="16" rx="5" fill="var(--sw-accent)" />
              <text x="0" y="11.5" font-size="10.5" text-anchor="middle" fill="#fff" font-family="var(--sw-font-mono)" font-weight="600">${label}</text>
            </g>`
          : nothing}
      </svg>
      <div class="legend">
        <span style="--lg: var(--sw-accent)">הקלטה (גובה = פעילות)</span>
        <span style="--lg: #ef4444">תנועה</span>
        <span style="--lg: #2f6bff">אדם</span>
        <span style="--lg: #22c55e">רכב</span>
        <span style="--lg: #8b5cf6">דלת</span>
        <span style="--lg: var(--sw-border-strong)">ריק = אין הקלטה / לא נבדק</span>
        ${this.limit < 1440 ? html`<span style="--lg: var(--sw-surface-3)">אפור = עתיד</span>` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-timeline': SwTimeline;
  }
}
