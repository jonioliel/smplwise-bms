import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import '../components/sw-state-panel';

/** Honest placeholder for modes whose screens are built in later tasks. Never fakes data. */
@customElement('placeholder-screen')
export class PlaceholderScreen extends LitElement {
  @property() heading = '';
  @property() task = '';

  static styles = css`
    :host {
      display: block;
      padding: var(--sw-s-4);
    }
    h2 {
      margin: 0 0 var(--sw-s-4);
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-semibold);
    }
    .box {
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
    }
  `;

  render() {
    return html`
      <h2>${this.heading}</h2>
      <div class="box">
        <sw-state-panel state="empty" heading="המסך הזה עדיין לא נבנה" hint=${`ייבנה במשימה ${this.task}. אין כאן נתונים מדומים.`}></sw-state-panel>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'placeholder-screen': PlaceholderScreen;
  }
}
