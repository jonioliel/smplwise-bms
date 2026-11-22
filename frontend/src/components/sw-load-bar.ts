import { LitElement, html, css, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { loadFraction, loadTone } from './load-bar-logic';

/**
 * CR-CMP2-GEN-REST-2460 (owner N10): a small shared load bar - how much of a capacity is in use (a generator phase's current against its
 * rating). A thin track with a fill from the reading start (the right edge in Hebrew), in the accent, the warning ink above `warn-above`
 * and the danger ink above `bad-above`. It is a `meter` for assistive technology (`label` names it, `value-text` reads the value; the
 * percentage by default). No value is an empty track. Tokens only; the fill moves on the compositor (a scale, not a width) and stands
 * still under reduced motion.
 *
 *   <sw-load-bar .value=${72} warn-above="80" bad-above="90" label="Load L1"></sw-load-bar>
 *
 * Knobs: `--sw-load-bar-h` (6 px), `--sw-load-bar-min` (the bar's minimum width, 70 px). The host reflects its tone as `data-tone`.
 */
@customElement('sw-load-bar')
export class SwLoadBar extends LitElement {
  @property({ type: Number }) value: number | null = null;
  @property({ type: Number }) max = 100;
  @property({ type: Number, attribute: 'warn-above' }) warnAbove: number | null = null;
  @property({ type: Number, attribute: 'bad-above' }) badAbove: number | null = null;
  @property() label = '';
  @property({ attribute: 'value-text' }) valueText = '';

  static styles = css`
    :host {
      display: block;
      min-inline-size: var(--sw-load-bar-min, 70px);
    }
    .track {
      block-size: var(--sw-load-bar-h, 6px);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface-3);
      overflow: hidden;
    }
    .fill {
      display: block;
      block-size: 100%;
      background: var(--sw-accent);
      transform: scaleX(var(--_f, 0));
      transform-origin: left center;
      transition:
        transform var(--sw-t-med) var(--sw-ease-out),
        background-color var(--sw-t-state) var(--sw-ease-color);
    }
    :host(:dir(rtl)) .fill {
      transform-origin: right center;
    }
    :host([data-tone='warn']) .fill {
      background: var(--sw-warning);
    }
    :host([data-tone='bad']) .fill {
      background: var(--sw-danger);
    }
    @media (prefers-reduced-motion: reduce) {
      .fill {
        transition: none;
      }
    }
  `;

  protected willUpdate() {
    this.dataset.tone = loadTone(this.value, this.warnAbove, this.badAbove);
  }

  render() {
    const f = loadFraction(this.value, this.max);
    const has = this.value !== null && Number.isFinite(this.value);
    const text = this.valueText || (has ? `${Math.round(f * 100)}%` : '');
    return html`<div class="track" part="track" role="meter" aria-label=${this.label} aria-valuemin="0" aria-valuemax=${this.max}
      aria-valuenow=${has ? String(Math.min(this.max, Math.max(0, this.value as number))) : '0'} aria-valuetext=${text || nothing}><i class="fill" part="fill" style="--_f:${f}"></i></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-load-bar': SwLoadBar;
  }
}
