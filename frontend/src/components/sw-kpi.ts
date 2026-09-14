import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import type { StateKind } from './sw-badge';

/** Compact status tile (overview only — never on map screens, per DESIGN_CONTRACT). */
@customElement('sw-kpi')
export class SwKpi extends LitElement {
  @property() label = '';
  @property() value = '';
  @property() detail = '';
  @property() icon: IconName = 'info';
  @property({ reflect: true }) tone: StateKind = 'neutral';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--sw-s-3);
      padding: var(--sw-s-3) var(--sw-s-4);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 40px;
      block-size: 40px;
      border-radius: var(--sw-r-sm);
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      flex-shrink: 0;
    }
    :host([tone='live']) .icon {
      background: var(--sw-live-soft);
      color: var(--sw-live);
    }
    :host([tone='stale']) .icon,
    :host([tone='partial']) .icon {
      background: var(--sw-stale-soft);
      color: var(--sw-stale);
    }
    :host([tone='error']) .icon,
    :host([tone='offline']) .icon {
      background: var(--sw-danger-soft);
      color: var(--sw-danger);
    }
    .value {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
    }
    .label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .detail {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
    }
  `;

  render() {
    return html`
      <div class="icon"><sw-icon .name=${this.icon} size=${20}></sw-icon></div>
      <div>
        <div class="value">${this.value}</div>
        <div class="label">${this.label}</div>
        ${this.detail ? html`<div class="detail">${this.detail}</div>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-kpi': SwKpi;
  }
}
