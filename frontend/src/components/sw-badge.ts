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

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 2px 10px;
      border-radius: var(--sw-r-pill);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      line-height: 18px;
      background: var(--sw-surface-3);
      color: var(--sw-text-2);
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .dot {
      inline-size: 8px;
      block-size: 8px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }
    :host([kind='live']) {
      background: var(--sw-live-soft);
      color: var(--sw-live);
    }
    :host([kind='live']) .dot {
      animation: pulse 1.6s ease-in-out infinite;
    }
    :host([kind='recorded']),
    :host([kind='historic']) {
      background: var(--sw-recorded-soft);
      color: var(--sw-accent-text);
    }
    :host([kind='offline']) {
      background: var(--sw-offline-soft);
      color: var(--sw-offline);
    }
    :host([kind='offline']) .dot {
      background: transparent;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    :host([kind='stale']),
    :host([kind='partial']) {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
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
      color: var(--sw-forbidden);
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
