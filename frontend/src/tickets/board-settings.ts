import { LitElement, html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ApiError, describeError } from '../api/client';
import { boardApi, BOARD_UI_DEFAULTS, type BoardSettingsDoc, type BoardUi } from '../api/tickets-board';
import { bt, type BoardTextKey } from './board-text';

/**
 * CR-038 slice 6: the board's rows of Settings > the module > display (D19 floors on the board, D20 grouping, D21 the state strip); the D28 row is
 * slice 2's (the hours card). It renders ROWS for the display card of screens/system-tickets.ts (`.row` /
 * `.lbl` / `.seg` of that screen's styles reach it through the light DOM - no shadow root) and saves through PUT /tickets/settings with the
 * card's document revision; the new document goes back up as `doc-changed` so the card's own rows keep a fresh revision.
 */
@customElement('ticket-board-settings')
export class TicketBoardSettings extends LitElement {
  @property({ attribute: false }) doc: BoardSettingsDoc | null = null;
  @property({ type: Boolean }) disabled = false;
  @state() private busy = false;
  @state() private error = '';

  protected createRenderRoot() {
    return this; // the rows live in the settings card and take its styles
  }

  connectedCallback() {
    super.connectedCallback();
    this.style.display = 'contents'; // the rows are the card's own rows (its grid and dividers)
  }

  private async save(patch: { ui?: Partial<BoardUi>; urgent_is_critical?: boolean }): Promise<void> {
    if (!this.doc || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const doc = await boardApi().saveSettings(this.doc.revision, patch);
      this.dispatchEvent(new CustomEvent('doc-changed', { detail: doc, bubbles: true, composed: true }));
    } catch (e) {
      this.error = e instanceof ApiError ? e.body.user_message || describeError(e) : describeError(e);
    } finally {
      this.busy = false;
    }
  }

  private seg<K extends keyof BoardUi>(key: K, label: BoardTextKey, sub: BoardTextKey, values: readonly BoardUi[K][], prefix: string): TemplateResult {
    const cur = (this.doc?.ui?.[key] as BoardUi[K] | undefined) ?? BOARD_UI_DEFAULTS[key];
    return html`<div class="row"><span class="lbl">${bt(label)}<span class="muted">${bt(sub)}</span></span>
      <span class="seg" role="radiogroup" aria-label=${bt(label)}>${values.map((v) => html`<button type="button" role="radio" aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)} data-ui-board=${`${String(key)}:${String(v)}`}
        ?disabled=${this.disabled || this.busy} @click=${() => void this.save({ ui: { [key]: v } as Partial<BoardUi> })}>${bt(`${prefix}${String(v)}` as BoardTextKey)}</button>`)}</span></div>`;
  }

  render() {
    return html`
      ${this.seg('board_floors', 'setBoardFloors', 'setBoardFloorsSub', ['tree', 'chips', 'chips_tree'], 'bf_')}
      ${this.seg('grouping', 'setGrouping', 'setGroupingSub', ['no_status_filter', 'always', 'never'], 'g_')}
      ${this.seg('closed_strip', 'setClosedStrip', 'setClosedStripSub', ['all', 'week', 'hidden'], 'cs_')}
      ${this.error ? html`<div class="row"><span class="field-error" role="alert" data-board-settings-error>${this.error}</span></div>` : ''}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ticket-board-settings': TicketBoardSettings;
  }
}
