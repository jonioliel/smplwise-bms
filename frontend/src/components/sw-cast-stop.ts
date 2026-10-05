import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-icon';
import { castStop, type CastSession, type CastStopResult } from '../api/cast';
import { describeError } from '../api/client';
import { castStore } from './cast-store';
import { powerOffOffered } from '../screens/cast-logic';
import { t } from '../i18n/he';

/**
 * CR-028: the stop control of one cast. When the screen was off before the cast and the installation rule is on (`power_off_after`) the stop first
 * asks, with the power-off ticked by default (owner Q10: yes, cancellable - unticking sends `?power_off=false`); otherwise it stops at once.
 * The result is put into the shared store (the pill, the live screen and the picker follow) and announced as `cast-stopped`.
 */
@customElement('sw-cast-stop')
export class SwCastStop extends LitElement {
  @property({ attribute: false }) session: CastSession | null = null;
  /** `solid` draws the red text button of the tray; `ghost` is the compact one of the live screen's strip. */
  @property() variant: 'solid' | 'ghost' = 'solid';
  @state() private confirming = false;
  @state() private off = true;
  @state() private busy = false;
  @state() private error = '';

  static styles = css`
    :host {
      display: inline-flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
    button {
      all: unset;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-block-size: 32px;
      padding-inline: 12px;
      border-radius: var(--sw-r-pill);
      font: inherit;
      font-size: var(--sw-fs-sm);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
    }
    button.stop {
      color: var(--sw-danger);
      background: color-mix(in srgb, var(--sw-danger) 10%, var(--sw-surface));
      border-color: color-mix(in srgb, var(--sw-danger) 35%, var(--sw-border));
    }
    button:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .confirm {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface-2, var(--sw-surface));
    }
    label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
    }
    .hint {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-xs);
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
  `;

  private async run() {
    const s = this.session;
    if (!s || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r: CastStopResult = await castStop(s.session_id, powerOffOffered(s) && !this.off ? false : undefined);
      castStore.put(r.session);
      this.confirming = false;
      this.dispatchEvent(new CustomEvent('cast-stopped', { detail: r, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
      void castStore.refresh();
    } finally {
      this.busy = false;
    }
  }

  private onStopClick() {
    if (this.session && powerOffOffered(this.session)) {
      this.off = true;
      this.confirming = true;
    } else void this.run();
  }

  render() {
    const s = this.session;
    if (!s || !s.can.stop) return nothing;
    if (this.confirming) {
      return html`<div class="confirm" role="group" aria-label=${t('cast.stopTitle')} data-cast-stop-confirm>
        <label><input type="checkbox" data-cast-stop-off .checked=${this.off} @change=${(e: Event) => (this.off = (e.target as HTMLInputElement).checked)} />${t('cast.stopOff')}</label>
        <span class="hint">${t('cast.stopOffHint')}</span>
        <button class="stop" type="button" data-cast-stop-yes ?disabled=${this.busy} @click=${() => void this.run()}>${t('cast.stopYes')}</button>
        <button type="button" data-cast-stop-keep ?disabled=${this.busy} @click=${() => (this.confirming = false)}>${t('cast.stopKeep')}</button>
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>`;
    }
    return html`<button class="stop" type="button" data-cast-stop ?disabled=${this.busy} aria-label=${`${t('cast.pillStop')}: ${s.screen_name}`} @click=${() => this.onStopClick()}><sw-icon name="stopSquare" size=${13}></sw-icon>${t('cast.pillStop')}</button>${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-cast-stop': SwCastStop;
  }
}
