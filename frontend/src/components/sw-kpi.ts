import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import type { IconName } from './sw-icon';
import type { StateKind } from './sw-badge';

/** Stat tile as on board 1: icon in a soft-blue square, big value, label, green/amber sub-label. */
@customElement('sw-kpi')
export class SwKpi extends LitElement {
  @property() label = '';
  @property() value = '';
  @property() detail = '';
  @property() icon: IconName = 'info';
  @property({ reflect: true }) tone: StateKind = 'neutral';
  @property() badge = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 14px 16px;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-1);
      min-inline-size: 0;
      position: relative;
    }
    .icon {
      display: grid;
      place-items: center;
      inline-size: 36px;
      block-size: 36px;
      border-radius: 9px;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
    }
    .value {
      font-size: var(--sw-fs-2xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.1;
      letter-spacing: -0.01em;
    }
    .label {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      margin-block-start: 2px;
    }
    .detail {
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-medium);
      color: #15803d;
    }
    :host([tone='stale']) .detail,
    :host([tone='partial']) .detail {
      color: #b45309;
    }
    :host([tone='error']) .detail,
    :host([tone='offline']) .detail {
      color: var(--sw-danger);
    }
    :host([tone='neutral']) .detail {
      color: var(--sw-text-3);
    }
    .badge {
      position: absolute;
      inset-inline-end: 12px;
      inset-block-start: 12px;
      background: var(--sw-danger);
      color: #fff;
      font-size: 10.5px;
      font-weight: var(--sw-fw-semibold);
      border-radius: var(--sw-r-pill);
      padding: 1px 8px;
    }
  `;

  render() {
    return html`
      <div class="icon"><sw-icon .name=${this.icon} size=${18}></sw-icon></div>
      ${this.badge ? html`<span class="badge">${this.badge}</span>` : ''}
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
