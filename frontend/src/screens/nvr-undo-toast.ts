import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';

/**
 * CR-020 S2: the short toast after a stream change. "נשמר" with "בטל" for 10 seconds (the press on "בטל" IS the confirmation of the
 * undo: the screen sends `confirm: true`), or a plain message with an optional link (the NVR asks for a restart). Local to this
 * screen on purpose (no shared toast component exists yet; several screens roll their own).
 * Events: `undo` (the action), `dismiss` (the timer ran out or the X was pressed).
 */
@customElement('nvr-undo-toast')
export class NvrUndoToast extends LitElement {
  @property() message = '';
  /** The undo button's label; empty = no button (a message only). */
  @property() actionLabel = '';
  @property() linkLabel = '';
  @property() linkHref = '';
  @property({ type: Number }) duration = 10_000;
  @property({ type: Boolean }) busy = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  static styles = css`
    :host {
      position: fixed;
      inset-block-end: calc(var(--sw-bottomnav-h) + 16px);
      inset-inline: 0;
      margin-inline: auto;
      inline-size: max-content;
      max-inline-size: calc(100vw - 32px);
      z-index: var(--sw-z-toast);
      display: block;
    }
    .toast {
      display: flex;
      gap: 12px;
      align-items: center;
      padding: 6px 8px 6px 14px;
      background: var(--sw-toast-bg);
      color: var(--sw-toast-text);
      border-radius: var(--sw-r-md);
      box-shadow: var(--sw-shadow-3);
      font-size: var(--sw-fs-sm);
      min-block-size: 44px;
    }
    button,
    a {
      border: 0;
      background: transparent;
      color: var(--sw-toast-action);
      font: inherit;
      font-weight: var(--sw-fw-semibold);
      cursor: pointer;
      padding: 0 10px;
      min-block-size: 44px;
      min-inline-size: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
      border-radius: var(--sw-r-sm);
    }
    button:focus-visible,
    a:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: -2px;
    }
    button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .x {
      color: inherit;
      opacity: 0.8;
      font-size: var(--sw-fs-lg);
    }
  `;

  private arm() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = this.duration > 0 ? setTimeout(() => this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true })), this.duration) : null;
  }

  protected updated(changed: PropertyValues) {
    if (changed.has('message') || changed.has('duration')) this.arm();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  render() {
    if (!this.message) return nothing;
    return html`<div class="toast" role="status" aria-live="polite" data-nvr-toast>
      <span data-nvr-toast-text>${this.message}</span>
      ${this.actionLabel ? html`<button type="button" data-nvr-undo ?disabled=${this.busy} @click=${() => this.dispatchEvent(new CustomEvent('undo', { bubbles: true, composed: true }))}>${this.actionLabel}</button>` : nothing}
      ${this.linkLabel && this.linkHref ? html`<a href=${this.linkHref} data-nvr-toast-link>${this.linkLabel}</a>` : nothing}
      <button type="button" class="x" aria-label="סגור" data-nvr-toast-close @click=${() => this.dispatchEvent(new CustomEvent('dismiss', { bubbles: true, composed: true }))}>✕</button>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'nvr-undo-toast': NvrUndoToast;
  }
}
