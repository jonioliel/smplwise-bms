import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import { t } from '../i18n/he';

// Visible data-quality states. Live / recorded / offline / stale / unknown / forbidden must stay
// distinguishable by shape and text, not only by colour (DESIGN_CONTRACT).
export type StateKind = 'live' | 'recorded' | 'historic' | 'offline' | 'stale' | 'unknown' | 'forbidden' | 'error' | 'partial' | 'neutral';

const LABELS: Record<StateKind, () => string> = {
  live: () => t('states.live'),
  recorded: () => t('states.recorded'),
  historic: () => t('states.historic'),
  offline: () => t('states.offline'),
  stale: () => t('states.stale'),
  unknown: () => t('states.unknown'),
  forbidden: () => t('states.forbidden'),
  error: () => t('states.error'),
  partial: () => t('states.partial'),
  neutral: () => '',
};

@customElement('sw-badge')
export class SwBadge extends LitElement {
  @property({ reflect: true }) kind: StateKind = 'neutral';
  @property() label = '';
  @property({ type: Boolean, reflect: true }) onImage = false;
  /** R5-INVESTIGATE-297: a solid status field (the state's colour, inverse ink) instead of the soft wash. */
  @property({ type: Boolean, reflect: true }) filled = false;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 1px 8px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 16px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border: 1px solid transparent;
      white-space: nowrap;
      /* break-ui (POLISH-CLASSIC-DOMUS-297): a long label stays inside its row (ellipsis; the full text is the title) */
      max-inline-size: 100%;
      min-inline-size: 0;
      box-sizing: border-box;
    }
    .t {
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      /* second pass (break-ui): the text takes its own direction, so a Latin e-mail in the RTL shell is cut at its END, not its start */
      unicode-bidi: plaintext;
    }
    :host([onimage]) {
      background: var(--sw-on-image-bg);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .dot {
      inline-size: 6px;
      block-size: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    :host([kind='live']) {
      background: var(--sw-live-soft);
      color: var(--sw-live-text);
    }
    :host([kind='live']) .dot {
      background: var(--sw-live);
      animation: pulse 1.6s ease-in-out infinite;
    }
    :host([onimage][kind='live']) {
      background: var(--sw-on-image-bg);
      color: var(--sw-text);
    }
    :host([kind='recorded']),
    :host([kind='historic']) {
      background: var(--sw-recorded-soft);
      color: var(--sw-accent-text);
    }
    :host([kind='offline']) {
      background: var(--sw-offline-soft);
      color: var(--sw-offline-text);
    }
    :host([kind='offline']) .dot {
      background: transparent;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    :host([kind='stale']),
    :host([kind='partial']) {
      background: var(--sw-stale-soft);
      color: var(--sw-stale-text);
      border-style: dashed;
      border-color: var(--sw-stale);
    }
    :host([kind='unknown']) {
      background: var(--sw-unknown-soft);
      color: var(--sw-text-3);
      border: 1px dashed var(--sw-border-strong);
    }
    :host([kind='unknown']) .dot {
      background: transparent;
      border: 1px dashed currentColor;
      box-sizing: border-box;
    }
    :host([kind='forbidden']),
    :host([kind='error']) {
      background: var(--sw-danger-soft);
      color: var(--sw-danger-text);
    }
    /* R5-INVESTIGATE-297 (status as a filled field, not a wash): "filled" paints the badge in the state's own colour with inverse ink,
       a solid edge and a slightly larger reading size; an outline-only kind (stale, unknown) keeps its dashed meaning in the dot */
    :host([filled]) {
      border-style: solid;
      border-color: transparent;
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      line-height: 18px;
      padding: 2px 10px;
      color: var(--sw-text-inverse);
      background: var(--sw-text-3);
    }
    :host([filled]) .dot {
      background: currentColor;
      border: 0;
      animation: none;
    }
    :host([filled][kind='live']) {
      background: var(--sw-success);
    }
    :host([filled][kind='recorded']),
    :host([filled][kind='historic']) {
      background: var(--sw-accent);
    }
    :host([filled][kind='offline']) {
      background: var(--sw-offline);
    }
    :host([filled][kind='stale']),
    :host([filled][kind='partial']) {
      background: var(--sw-stale);
      color: var(--sw-on-lit);
    }
    :host([filled][kind='unknown']) {
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border: 1px dashed var(--sw-border-strong);
    }
    :host([filled][kind='forbidden']),
    :host([filled][kind='error']) {
      background: var(--sw-danger);
    }
    @keyframes pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.35;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([kind='live']) .dot {
        animation: none;
      }
    }
  `;

  render() {
    const text = this.label || LABELS[this.kind]();
    return html`<span class="dot" aria-hidden="true"></span><span class="t" title=${text}>${text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-badge': SwBadge;
  }
}
