import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './sw-icon';
import { avatarInitials } from './avatar-initials';

export { avatarInitials };

/** Initials avatar (board 3: users table, top bar). */
@customElement('sw-avatar')
export class SwAvatar extends LitElement {
  @property() name = '';
  @property({ type: Number }) size = 32;

  static styles = css`
    :host {
      display: inline-grid;
      place-items: center;
      inline-size: var(--sz, 32px);
      block-size: var(--sz, 32px);
      border-radius: 50%;
      background: var(--sw-accent-soft);
      color: var(--sw-accent-text);
      font-size: calc(var(--sz, 32px) * 0.38);
      font-weight: var(--sw-fw-semibold);
      line-height: 1;
      flex-shrink: 0;
      user-select: none;
      overflow: hidden;
      white-space: nowrap;
    }
  `;

  render() {
    this.style.setProperty('--sz', `${this.size}px`);
    const initials = avatarInitials(this.name);
    return initials ? html`${initials}` : html`<sw-icon name="user" size=${Math.round(this.size * 0.5)} aria-hidden="true"></sw-icon>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-avatar': SwAvatar;
  }
}
