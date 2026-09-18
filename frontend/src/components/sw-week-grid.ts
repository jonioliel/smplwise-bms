import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/** One range of a day's schedule; `mode` is used by the recording schedule (CMR / MOTION / EDR…), absent for arming. */
export interface WeekRange {
  begin: string;
  end: string;
  mode?: string;
}
export type WeekDays = WeekRange[][];
export interface WeekMode {
  id: string;
  label: string;
  color: string;
}

/** Hebrew week: Sunday first on screen; the data keeps the ISAPI order (0 = Monday … 6 = Sunday). */
const ORDER = [6, 0, 1, 2, 3, 4, 5];
const NAMES = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

const pad = (n: number) => String(n).padStart(2, '0');
const hourOf = (t: string) => Number(t.slice(0, 2)) + Number(t.slice(3, 5)) / 60;

/** Ranges → 24 hourly cells per day (a cell is on when the range covers any part of the hour). */
export function cellsOf(days: WeekDays): string[][] {
  return Array.from({ length: 7 }, (_, d) => {
    const row = Array.from({ length: 24 }, () => '');
    for (const r of days[d] ?? []) {
      const a = Math.floor(hourOf(r.begin));
      const b = Math.min(24, Math.ceil(hourOf(r.end)));
      for (let h = a; h < b; h++) row[h] = r.mode ?? 'on';
    }
    return row;
  });
}

/** Cells → ranges (consecutive cells of one mode merge; 24 = end of day). */
export function rangesOf(cells: string[][], withMode: boolean): WeekDays {
  return cells.map((row) => {
    const out: WeekRange[] = [];
    let h = 0;
    while (h < 24) {
      const m = row[h];
      if (!m) {
        h++;
        continue;
      }
      let e = h;
      while (e < 24 && row[e] === m) e++;
      out.push(withMode ? { begin: `${pad(h)}:00:00`, end: `${pad(e)}:00:00`, mode: m } : { begin: `${pad(h)}:00:00`, end: `${pad(e)}:00:00` });
      h = e;
    }
    return out;
  });
}

/**
 * Weekly schedule grid (0.1.72): 7 rows × 24 hourly cells, painted with the mouse in the chosen mode; emits
 * `change` {days} on every stroke. Read-only when `editable` is false.
 */
@customElement('sw-week-grid')
export class SwWeekGrid extends LitElement {
  @property({ attribute: false }) days: WeekDays = Array.from({ length: 7 }, () => []);
  /** Modes to paint with; a single mode means on / off. */
  @property({ attribute: false }) modes: WeekMode[] = [{ id: 'on', label: 'פעיל', color: 'var(--sw-accent)' }];
  @property() mode = 'on';
  @property({ type: Boolean }) editable = false;
  @state() private painting: string | null = null;
  private cells: string[][] = [];
  private lastDays: WeekDays | null = null;

  static styles = css`
    :host {
      display: block;
      direction: ltr;
      font-size: var(--sw-fs-xs);
      user-select: none;
    }
    .grid {
      display: grid;
      grid-template-columns: 28px repeat(24, minmax(0, 1fr));
      gap: 2px;
    }
    .h {
      color: var(--sw-text-3);
      text-align: center;
      font-size: 10px;
    }
    .d {
      color: var(--sw-text-2);
      align-self: center;
      text-align: center;
      font-weight: var(--sw-fw-semibold);
    }
    .c {
      block-size: 18px;
      border-radius: 3px;
      background: var(--sw-surface-3);
      border: 1px solid transparent;
    }
    .c.on {
      background: var(--cell, var(--sw-accent));
    }
    :host([editable]) .c {
      cursor: crosshair;
    }
    .legend {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-block-start: 6px;
      direction: rtl;
      align-items: center;
    }
    .legend button {
      font: inherit;
      border: 1px solid var(--sw-border-strong);
      background: var(--sw-surface);
      border-radius: 999px;
      padding: 2px 10px;
      cursor: pointer;
      display: inline-flex;
      gap: 6px;
      align-items: center;
    }
    .legend button.on {
      outline: 2px solid var(--sw-accent);
    }
    .sw {
      inline-size: 10px;
      block-size: 10px;
      border-radius: 3px;
      display: inline-block;
    }
  `;

  private sync() {
    if (this.lastDays !== this.days) {
      this.cells = cellsOf(this.days);
      this.lastDays = this.days;
    }
  }

  private colorOf(id: string) {
    return this.modes.find((m) => m.id === id)?.color ?? 'var(--sw-accent)';
  }

  private paint(d: number, h: number, start: boolean) {
    if (!this.editable) return;
    if (start) this.painting = this.cells[d][h] === this.mode ? '' : this.mode;
    if (this.painting === null) return;
    if (this.cells[d][h] === this.painting) return;
    this.cells = this.cells.map((row, i) => (i === d ? row.map((v, j) => (j === h ? this.painting! : v)) : row));
    const days = rangesOf(this.cells, this.modes.length > 1 || this.modes[0]?.id !== 'on');
    this.lastDays = days;
    this.days = days;
    this.dispatchEvent(new CustomEvent('change', { detail: { days }, bubbles: true, composed: true }));
  }

  private end = () => {
    this.painting = null;
  };

  /** The cell under a pointer event (through the shadow root), as [day, hour]. */
  private cellAt(e: PointerEvent): [number, number] | null {
    const root = this.renderRoot as ShadowRoot;
    const el = root.elementFromPoint ? root.elementFromPoint(e.clientX, e.clientY) : null;
    const key = (el as HTMLElement | null)?.dataset?.cell;
    if (!key) return null;
    const [d, h] = key.split('-').map(Number);
    return Number.isFinite(d) && Number.isFinite(h) ? [d, h] : null;
  }

  /** Painting is handled on the grid container with pointer capture: one press paints a cell, a drag paints a stroke. */
  private onDown = (e: PointerEvent) => {
    if (!this.editable || e.button !== 0) return;
    const cell = this.cellAt(e);
    if (!cell) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    this.paint(cell[0], cell[1], true);
  };

  private onMove = (e: PointerEvent) => {
    if (this.painting === null || !e.buttons) return;
    const cell = this.cellAt(e);
    if (cell) this.paint(cell[0], cell[1], false);
  };

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('pointerup', this.end);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('pointerup', this.end);
  }

  render() {
    this.sync();
    return html`
      <div class="grid" role="grid" aria-label="לוח שבועי" @pointerdown=${this.onDown} @pointermove=${this.onMove} @pointerup=${this.end} @pointercancel=${this.end}>
        <span></span>
        ${Array.from({ length: 24 }, (_, h) => html`<span class="h">${h % 3 === 0 ? h : ''}</span>`)}
        ${ORDER.map((d, i) => html`
          <span class="d">${NAMES[i]}</span>
          ${this.cells[d].map((v, h) => html`<div class="c ${v ? 'on' : ''}" data-cell=${`${d}-${h}`} data-mode=${v} style=${v ? `--cell:${this.colorOf(v)}` : ''} title=${`${NAMES[i]} ${pad(h)}:00–${pad(h + 1)}:00${v ? ` · ${this.modes.find((m) => m.id === v)?.label ?? v}` : ''}`}></div>`)}
        `)}
      </div>
      ${this.editable && this.modes.length > 1
        ? html`<div class="legend">צבע: ${this.modes.map((m) => html`<button class=${m.id === this.mode ? 'on' : ''} data-week-mode=${m.id} @click=${() => (this.mode = m.id)}><span class="sw" style="background:${m.color}"></span>${m.label}</button>`)}<span style="color:var(--sw-text-3)">לחיצה על תא צבוע באותו צבע מנקה אותו</span></div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-week-grid': SwWeekGrid;
  }
}
