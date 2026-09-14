import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';

/** Wizard progress header (setup, plan import). */
@customElement('sw-steps')
export class SwSteps extends LitElement {
  @property({ attribute: false }) steps: string[] = [];
  @property({ type: Number }) current = 0;

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      overflow-x: auto;
      scrollbar-width: none;
    }
    .step {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      white-space: nowrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .n {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
    }
    .step.done {
      color: var(--sw-text-2);
    }
    .step.done .n {
      background: var(--sw-live);
      border-color: var(--sw-live);
      color: #fff;
    }
    .step.current {
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
    .step.current .n {
      border-color: var(--sw-accent);
      background: var(--sw-accent);
      color: #fff;
    }
    .line {
      flex: 1;
      min-inline-size: 24px;
      block-size: 2px;
      background: var(--sw-border);
    }
  `;

  render() {
    return html`${this.steps.map(
      (s, i) => html`
        <div class="step ${i < this.current ? 'done' : i === this.current ? 'current' : ''}">
          <span class="n">${i < this.current ? html`<sw-icon name="check" size=${14}></sw-icon>` : i + 1}</span><span>${s}</span>
        </div>
        ${i < this.steps.length - 1 ? html`<div class="line"></div>` : ''}
      `,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-steps': SwSteps;
  }
}
