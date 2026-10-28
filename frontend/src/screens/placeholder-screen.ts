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
    /* R5-SYSTEM-297: the page title at the page-heading size; the box is a card of the ladder (shadow 2 + the light line) */
    h2 {
      margin: 0 0 var(--sw-s-4);
      font-family: var(--sw-font-heading, var(--sw-font));
      font-size: var(--sw-h1, var(--sw-fs-2xl));
      font-weight: var(--sw-h1-weight, var(--sw-fw-bold));
      letter-spacing: var(--sw-h1-tracking, -0.01em);
      color: var(--sw-heading, var(--sw-text));
    }
    .box {
      display: flex;
      flex-direction: column;
      background: var(--sw-surface);
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-2), inset 0 1px 0 var(--sw-highlight);
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
