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

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 9px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      line-height: 18px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border: 1px solid transparent;
      white-space: nowrap;
    }
    :host([onimage]) {
      background: rgba(255, 255, 255, 0.92);
      color: var(--sw-text);
      box-shadow: var(--sw-shadow-1);
    }
    .dot {
      inline-size: 7px;
      block-size: 7px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    :host([kind='live']) {
      background: var(--sw-live-soft);
      color: #15803d;
    }
    :host([kind='live']) .dot {
      background: var(--sw-live);
      animation: pulse 1.6s ease-in-out infinite;
    }
    :host([onimage][kind='live']) {
      background: rgba(255, 255, 255, 0.92);
      color: var(--sw-text);
    }
    :host([kind='recorded']),
    :host([kind='historic']) {
      background: var(--sw-recorded-soft);
      color: var(--sw-accent-text);
    }
    :host([kind='offline']) {
      background: var(--sw-offline-soft);
      color: #6b7280;
    }
    :host([kind='offline']) .dot {
      background: transparent;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    :host([kind='stale']),
    :host([kind='partial']) {
      background: var(--sw-stale-soft);
      color: #b45309;
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
      color: #b91c1c;
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
    return html`<span class="dot" aria-hidden="true"></span><span>${text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-badge': SwBadge;
  }
}
