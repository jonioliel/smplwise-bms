import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';

/** Small centred modal for short forms and confirmations. Closes on Escape, backdrop click or the ✕. */
@customElement('sw-dialog')
export class SwDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() heading = '';
  @property() subheading = '';
  /** Re-review M2: while set, nothing closes the dialog (✕, Escape, backdrop) - a physical action is on its way. */
  @property({ type: Boolean }) locked = false;
  /** A wider box (up to 720px) for text the person reads and copies. */
  @property({ type: Boolean, reflect: true }) wide = false;
  /** The footer only when something is slotted into it (re-review low). */
  @state() private hasFooter = false;

  static styles = css`
    :host {
      display: none;
    }
    :host([open]) {
      display: block;
    }
    .backdrop {
      position: fixed;
      inset: 0;
      background: var(--sw-overlay);
      z-index: var(--sw-z-modal);
      display: grid;
      place-items: center;
      /* standalone: keep the box clear of the notch and the home indicator */
      padding: max(16px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(16px, env(safe-area-inset-bottom, 0px)) max(16px, env(safe-area-inset-left, 0px));
    }
    .box {
      inline-size: min(440px, 100%);
      background: var(--sw-surface);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      max-block-size: calc(100dvh - 32px);
      /* set only inside a device screen in the glass style (CR-007 6a, devices-style.ts); none everywhere else */
      backdrop-filter: var(--sw-glass-blur, none);
      -webkit-backdrop-filter: var(--sw-glass-blur, none);
    }
    :host([wide]) .box {
      inline-size: min(720px, 100%);
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 14px 16px 10px;
    }
    header div {
      flex: 1;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      margin-block-start: 2px;
    }
    .body {
      padding: 0 16px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: auto;
    }
    footer[hidden] {
      display: none;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 16px 14px;
      border-block-start: 1px solid var(--sw-border);
    }
  `;

  /** Review B1: the control that had focus when the dialog opened - focus returns there when it closes. */
  private opener: HTMLElement | null = null;

  private restoreFocus() {
    const back = this.opener;
    this.opener = null;
    if (back?.isConnected) requestAnimationFrame(() => back.focus({ preventScroll: true }));
  }

  private close() {
    if (this.locked) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && this.open) this.close();
  };

  /** Keyboard focus moves into the dialog when it opens (the first field, else the first button, else the box):
   * until 0.1.80 it stayed on the page behind, so a keyboard user had to tab through the whole page. */
  updated(changed: Map<string, unknown>) {
    if (changed.has('open') && !this.open && changed.get('open') === true) this.restoreFocus();
    if (!changed.has('open') || !this.open) return;
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    if (a && !this.contains(a) && !this.shadowRoot?.contains(a)) this.opener = a as HTMLElement;
    requestAnimationFrame(() => {
      const pick = (root: ParentNode): HTMLElement | null => {
        for (const el of root.querySelectorAll<HTMLElement>('[autofocus], input, textarea, select, sw-button, button')) {
          if (el.hasAttribute('disabled') || (el as HTMLInputElement).type === 'hidden' || el.slot === 'footer') continue;
          if (el.tagName === 'SW-BUTTON') return el.shadowRoot?.querySelector<HTMLElement>('button') ?? el;
          return el;
        }
        for (const el of root.querySelectorAll<HTMLElement>('*')) {
          const inner = el.shadowRoot && pick(el.shadowRoot);
          if (inner) return inner;
        }
        return null;
      };
      const target = pick(this) ?? this.renderRoot.querySelector<HTMLElement>('.box');
      if (target) {
        if (!target.hasAttribute('tabindex') && !target.matches('input, textarea, select, button, a[href]')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    });
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.open) this.restoreFocus();
    window.removeEventListener('keydown', this.onKey);
  }

  render() {
    return html`<div class="backdrop" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header><div><h3>${this.heading}</h3>${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}</div><sw-button variant="ghost" size="sm" iconOnly icon="close" label="סגור" @click=${this.close}></sw-button></header>
        <div class="body"><slot></slot></div>
        <footer ?hidden=${!this.hasFooter}><slot name="footer" @slotchange=${(e: Event) => (this.hasFooter = (e.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE))}></slot></footer>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-dialog': SwDialog;
  }
}
