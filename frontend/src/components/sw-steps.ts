import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';

/** Wizard progress header as on the onboarding board: numbered circles with labels beneath, connected by lines. */
@customElement('sw-steps')
export class SwSteps extends LitElement {
  @property({ attribute: false }) steps: string[] = [];
  @property({ type: Number }) current = 0;

  static styles = css`
    :host {
      display: flex;
      align-items: flex-start;
      overflow-x: auto;
      scrollbar-width: none;
    }
    .step {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      min-inline-size: 72px;
    }
    .n {
      display: grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      border-radius: 50%;
      border: 2px solid var(--sw-border-strong);
      background: var(--sw-surface);
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
      box-shadow: 0 0 0 4px var(--sw-accent-soft);
    }
    .line {
      flex: 1;
      min-inline-size: 20px;
      block-size: 2px;
      margin-block-start: 13px;
      background: var(--sw-border);
      border-radius: 1px;
    }
    .line.done {
      background: var(--sw-live);
    }
  `;

  render() {
    return html`${this.steps.map(
      (s, i) => html`
        <div class="step ${i < this.current ? 'done' : i === this.current ? 'current' : ''}">
          <span class="n">${i < this.current ? html`<sw-icon name="check" size=${13}></sw-icon>` : i + 1}</span><span>${s}</span>
        </div>
        ${i < this.steps.length - 1 ? html`<div class="line ${i < this.current ? 'done' : ''}"></div>` : ''}
      `,
    )}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-steps': SwSteps;
  }
}
