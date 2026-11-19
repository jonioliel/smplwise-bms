import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import '../components/sw-drawer';
import '../components/sw-button';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { SkinController } from '../design/skin';

/**
 * CR-DUP-METERS-2440 (code review 08:F25): the meter card of a metered utility, written once. `electricity/meter-card.ts` and
 * `water/meter-card.ts` were the same drawer twice: the `meterId` / `canManage` contract, the guarded load (a newer meter wins), the quiet
 * re-read, the consumption chart's range (24 hours / 30 days / 12 months) and its load, the drawer that steps aside for a dialog, the range
 * switch, the actions row and the layout rules. This base owns those; a module supplies its API, its facts, its chart and its dialogs.
 * Fires `close` and `changed` (after a change: the list reloads).
 */

export type MeterRange = 'hours' | 'days' | 'months';
export type MeterSeriesStep = '1h' | '1d';
const RANGES: MeterRange[] = ['hours', 'days', 'months'];
type Slot = TemplateResult | typeof nothing;

/** The card's own layout (after the module's style sheet, before the module's extra rules). */
export const meterCardCss = css`
  :host {
    display: contents;
  }
  .body {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 0 8px;
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
  .form {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .form .wide {
    grid-column: 1 / -1;
  }
  @media (max-width: 520px) {
    .form {
      grid-template-columns: 1fr;
    }
  }
`;

/** The actions row of the card (shown to a manager): the words and what each button does. */
interface MeterCardActions {
  rename: string;
  replace: string;
  pause: string;
  remove: string;
  pauseDisabled: boolean;
  onRename: () => void;
  onReplace: () => void;
  onPause: () => void;
  onRemove: () => void;
}

/** `D`: the module's meter detail. `K`: the names of the dialogs the card opens (the drawer steps aside while one is open). */
export abstract class MeterCardBase<D, K extends string> extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() meterId = '';
  @property({ type: Boolean }) canManage = false;

  @state() protected detail: D | null = null;
  @state() protected phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() protected error = '';
  @state() protected range: MeterRange;
  @state() protected chartError = false;
  @state() protected dlg: '' | K = '';
  @state() protected busy = false;
  @state() protected actionError = '';
  private seq = 0;

  protected constructor(range: MeterRange) {
    super();
    this.range = range;
  }

  // ---------------------------------------------------------------- what a module supplies
  protected abstract fetchDetail(): Promise<D>;
  /** Before a load starts (optional): drop what belongs to another meter. */
  protected beforeLoad?(): void;
  /** The meter is on screen: start the chart and the module's companions. `current()` is false once a newer load began. */
  protected abstract afterLoad(current: () => boolean): void | Promise<void>;
  /** Reads the chart's data for the range; the returned step puts it on screen (skipped when the range changed meanwhile). */
  protected abstract fetchSeries(range: MeterRange, step: MeterSeriesStep, from: string, to: string): Promise<() => void>;
  protected abstract titles(d: D): { heading: string; subheading: string };
  protected abstract texts(): { loadError: string; retry: string };
  protected abstract renderBody(d: D): TemplateResult;
  protected abstract renderDialogs(): Slot;

  // ---------------------------------------------------------------- shared behaviour
  willUpdate(changed: Map<string, unknown>) {
    if (changed.has('meterId') && this.meterId) void this.load();
  }

  protected fire(name: string) {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));
  }

  protected async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    this.beforeLoad?.();
    try {
      const d = await this.fetchDetail();
      if (my !== this.seq) return;
      this.detail = d;
      this.phase = 'ready';
      const after = this.afterLoad(() => my === this.seq);
      if (after) await after;
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  /** Re-read the meter without the loading state (after a rename or a conflict). */
  protected async refresh() {
    try {
      this.detail = await this.fetchDetail();
    } catch {
      /* the card keeps what it has */
    }
  }

  protected async loadSeries() {
    const range = this.range;
    const step: MeterSeriesStep = range === 'hours' ? '1h' : '1d';
    const span = range === 'hours' ? 1 : range === 'days' ? 30 : 365;
    const to = new Date();
    const from = new Date(to.getTime() - span * 86_400_000);
    try {
      const show = await this.fetchSeries(range, step, from.toISOString(), to.toISOString());
      if (range !== this.range) return;
      show();
      this.chartError = false;
    } catch {
      this.chartError = true;
    }
  }

  /** The chart's range switch. */
  protected rangeSeg(ariaLabel: string, label: (r: MeterRange) => string) {
    return html`<div class="seg" role="group" aria-label=${ariaLabel}>${RANGES.map((r) => html`<button type="button" aria-pressed=${this.range === r ? 'true' : 'false'} data-range=${r} @click=${() => { this.range = r; void this.loadSeries(); }}>${label(r)}</button>`)}</div>`;
  }

  protected actionsRow(a: MeterCardActions) {
    return html`<div class="actions">
            <sw-button data-meter-rename @click=${a.onRename}>${a.rename}</sw-button>
            <sw-button data-meter-replace @click=${a.onReplace}>${a.replace}</sw-button>
            <sw-button data-meter-pause ?disabled=${a.pauseDisabled} @click=${a.onPause}>${a.pause}</sw-button>
            <span class="sp"></span>
            <sw-button variant="danger" data-meter-remove @click=${a.onRemove}>${a.remove}</sw-button>
          </div>`;
  }

  render() {
    const d = this.detail;
    const t = this.texts();
    const head = d ? this.titles(d) : { heading: '', subheading: '' };
    // a dialog opened from the card sits above the drawer's top layer only while the drawer steps aside
    return html`
      <sw-drawer ?open=${!this.dlg} modal heading=${head.heading} subheading=${head.subheading} data-meter-drawer @close=${() => { if (!this.dlg) this.fire('close'); }}>
        ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
        ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading=${t.loadError} hint=${this.error} actionLabel=${t.retry} @action=${() => void this.load()}></sw-state-panel>` : nothing}
        ${this.phase === 'ready' && d ? this.renderBody(d) : nothing}
      </sw-drawer>
      ${this.renderDialogs()}`;
  }
}
