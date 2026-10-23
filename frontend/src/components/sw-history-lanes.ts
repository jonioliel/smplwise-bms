import { LitElement, html, css, svg, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Lane, MsGap } from '../map/history-replay';

/**
 * CR-TIMESCRUB101: the per-layer lanes of the historical map's time scrub, drawn above the recording track (sw-timeline) for
 * the same window. One thin bar per layer: the spans where the layer was active (a light on, a door open, a panel armed),
 * hatched where a bucketed range says "changed during", ticks at the recorded changes; a switched-off or locked layer is
 * dimmed (a locked one draws nothing). The gaps of the local history are hatched in the warning colour across every lane.
 * Time flows LEFT -> RIGHT inside the RTL shell (direction: ltr), like sw-timeline; the labels keep their RTL text.
 * A click seeks (`seek` with `{ ms }`); the window itself is owned by the host.
 */
@customElement('sw-history-lanes')
export class SwHistoryLanes extends LitElement {
  @property({ attribute: false }) lanes: Lane[] = [];
  @property({ attribute: false }) gaps: MsGap[] = [];
  /** The window (ms since the epoch). */
  @property({ type: Number }) from = 0;
  @property({ type: Number }) to = 1;
  @property({ type: Number }) cursor = 0;
  /** Later instants are the future (drawn grey, refused); null = no limit in the window. */
  @property({ type: Number }) limit: number | null = null;

  static styles = css`
    :host {
      display: grid;
      grid-template-columns: var(--sw-lanes-label-w, 92px) minmax(0, 1fr);
      column-gap: 8px;
      direction: ltr;
      user-select: none;
    }
    .labels {
      display: grid;
      grid-auto-rows: var(--sw-lane-h, 12px);
      row-gap: 2px;
    }
    .ln {
      display: flex;
      align-items: center;
      gap: 5px;
      direction: rtl;
      font-size: var(--sw-fs-2xs);
      line-height: 1;
      color: var(--sw-text-3);
      white-space: nowrap;
      overflow: hidden;
    }
    .ln i {
      flex: none;
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: var(--c, var(--sw-accent));
    }
    .ln.off {
      opacity: 0.45;
    }
    .trk {
      position: relative;
      min-inline-size: 0;
    }
    /* absolutely placed: the row height comes from the labels (the lane height token), the bars stretch to it */
    svg {
      position: absolute;
      inset: 0;
      display: block;
      inline-size: 100%;
      block-size: 100%;
      cursor: crosshair;
    }
  `;

  private x(ms: number, w: number): number {
    const span = Math.max(1, this.to - this.from);
    return ((ms - this.from) / span) * w;
  }

  private onClick(e: MouseEvent) {
    const r = (e.currentTarget as SVGElement).getBoundingClientRect();
    if (!r.width) return;
    let ms = this.from + ((e.clientX - r.left) / r.width) * (this.to - this.from);
    if (this.limit !== null) ms = Math.min(ms, this.limit);
    this.dispatchEvent(new CustomEvent('seek', { detail: { ms: Math.round(ms) }, bubbles: true, composed: true }));
  }

  render() {
    const W = 1000;
    const rowH = 12;
    const gapH = 2;
    const H = Math.max(1, this.lanes.length * (rowH + gapH) - gapH);
    const cx = this.x(this.cursor, W);
    const limitX = this.limit !== null && this.limit < this.to ? Math.max(0, this.x(this.limit, W)) : null;
    return html`
      <div class="labels">
        ${this.lanes.map((l) => html`<div class="ln ${l.off ? 'off' : ''}" style=${`--c:${l.color}`} data-lane=${l.id} data-off=${l.off ? 'true' : 'false'} data-locked=${l.locked ? 'true' : 'false'}><i></i>${l.label}</div>`)}
      </div>
      <div class="trk"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="שינויים לפי שכבה" @click=${this.onClick}>
        <defs>
          <pattern id="gap" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="var(--sw-warning)" stroke-width="2.5" opacity="0.6" /></pattern>
          <pattern id="chg" patternUnits="userSpaceOnUse" width="4" height="4" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--sw-text-3)" stroke-width="1.5" opacity="0.55" /></pattern>
        </defs>
        ${this.lanes.map((l, i) => {
          const y = i * (rowH + gapH);
          const op = l.off ? 0.35 : 1;
          const ticks = new Set<number>();
          for (const m of l.marks) ticks.add(Math.round(this.x(m, W) / 2) * 2); // at most one tick per two units
          return svg`<g data-lane-track=${l.id} opacity=${op}>
            <rect x="0" y=${y + rowH / 2 - 1} width=${W} height="2" rx="1" fill="var(--sw-surface-3)" />
            ${l.locked ? nothing : l.spans.map((s) => {
              const a = Math.max(0, this.x(s.from, W));
              const b = Math.min(W, this.x(s.to, W));
              if (b <= a) return nothing;
              return s.kind === 'on'
                ? svg`<rect x=${a} y=${y + 2} width=${Math.max(1.5, b - a)} height=${rowH - 4} rx="2" fill=${l.color} opacity="0.85" />`
                : svg`<rect x=${a} y=${y + 1} width=${Math.max(1.5, b - a)} height=${rowH - 2} fill="url(#chg)" />`;
            })}
            ${l.locked ? nothing : [...ticks].filter((x) => x >= 0 && x <= W).map((x) => svg`<rect x=${x - 0.6} y=${y} width="1.2" height=${rowH} fill=${l.color} opacity="0.9" />`)}
          </g>`;
        })}
        ${this.gaps.map((g) => {
          const a = Math.max(0, this.x(g.from, W));
          const b = Math.min(W, this.x(g.to, W));
          return b > a ? svg`<rect data-gap x=${a} y="0" width=${b - a} height=${H} fill="url(#gap)" stroke="var(--sw-warning)" stroke-width="0.5" />` : nothing;
        })}
        ${limitX !== null ? svg`<rect x=${limitX} y="0" width=${Math.max(0, W - limitX)} height=${H} fill="var(--sw-surface-3)" opacity="0.7" />` : nothing}
        ${cx >= 0 && cx <= W ? svg`<line x1=${cx} x2=${cx} y1="0" y2=${H} stroke="var(--sw-accent)" stroke-width="2" vector-effect="non-scaling-stroke" pointer-events="none" />` : nothing}
      </svg></div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-history-lanes': SwHistoryLanes;
  }
}
