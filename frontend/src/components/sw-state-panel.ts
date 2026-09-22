import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import './sw-button';
import type { IconName } from './sw-icon';
import { t } from '../i18n/he';

// The mandatory non-ready states (DESIGN_CONTRACT): loading, empty, error, forbidden, stale/offline, partial.
export type PanelState = 'loading' | 'empty' | 'error' | 'forbidden' | 'stale' | 'partial';

const PRESETS: Record<PanelState, { icon: IconName; title: () => string; hint: () => string; tone: string }> = {
  loading: { icon: 'clock', title: () => t('states.loading'), hint: () => '', tone: 'neutral' },
  empty: { icon: 'map', title: () => t('states.empty'), hint: () => '', tone: 'neutral' },
  error: { icon: 'warning', title: () => t('states.error'), hint: () => t('states.errorHint'), tone: 'danger' },
  forbidden: { icon: 'lock', title: () => t('states.forbidden'), hint: () => t('states.forbiddenHint'), tone: 'forbidden' },
  stale: { icon: 'offline', title: () => t('states.stale'), hint: () => t('states.staleHint'), tone: 'stale' },
  partial: { icon: 'info', title: () => t('states.partial'), hint: () => '', tone: 'stale' },
};

@customElement('sw-state-panel')
export class SwStatePanel extends LitElement {
  @property({ reflect: true }) state: PanelState = 'empty';
  @property() heading = '';
  @property() hint = '';
  @property() actionLabel = '';
  @property({ type: Boolean, reflect: true }) compact = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-8) var(--sw-s-4);
      color: var(--sw-text-2);
      min-block-size: 220px;
    }
    :host([compact]) {
      min-block-size: 0;
      padding: var(--sw-s-4);
      flex-direction: row;
      text-align: start;
      justify-content: flex-start;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 48px;
      block-size: 48px;
      border-radius: var(--sw-r-lg);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    :host([compact]) .icon {
      inline-size: 34px;
      block-size: 34px;
      border-radius: var(--sw-r-sm);
    }
    :host([state='error']) .icon {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    :host([state='forbidden']) .icon,
    .icon[data-look='forbidden'] {
      background: var(--sw-forbidden-soft);
      color: var(--sw-forbidden);
    }
    :host([state='stale']) .icon,
    :host([state='partial']) .icon {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
    }
    :host([state='loading']) .icon {
      animation: spin 1.2s linear infinite;
    }
    h4 {
      margin: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text);
    }
    p {
      margin: 0;
      max-inline-size: 42ch;
      font-size: var(--sw-fs-sm);
    }
    .text {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      align-items: inherit;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      :host([state='loading']) .icon {
        animation: none;
      }
    }
  `;

  render() {
    // A screen that only kept the message of a refused request still gets the lock: every 403 the backend writes
    // says "אין הרשאה…" (rbac.forbidden), so for such a hint the error preset yields to the forbidden one and the
    // retry button goes away - a viewer used to see "משהו השתבש · נסה שוב" on the events centre (0.1.80).
    const forbidden = this.state === 'error' && /אין (לך )?הרשא/.test(this.hint);
    const preset = PRESETS[forbidden ? 'forbidden' : this.state];
    const hint = this.hint || preset.hint();
    return html`
      <div class="icon" data-look=${forbidden ? 'forbidden' : ''} aria-hidden="true"><sw-icon .name=${preset.icon} size=${this.compact ? 20 : 26}></sw-icon></div>
      <div class="text" role="status">
        <h4>${this.heading || preset.title()}</h4>
        ${hint ? html`<p>${hint}</p>` : ''}
        <slot></slot>
      </div>
      ${this.actionLabel && !forbidden
        ? html`<sw-button variant=${this.state === 'error' ? 'primary' : 'secondary'} size="sm" @click=${() => this.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true }))}>${this.actionLabel}</sw-button>`
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-state-panel': SwStatePanel;
  }
}
