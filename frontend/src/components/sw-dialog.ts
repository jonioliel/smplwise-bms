import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import { deepFocusables } from './sw-drawer';

/** A11Y-POLISHED-2342: the open dialogs, oldest first. Every dialog listens for Escape on the window, so a confirmation opened over
 * another dialog closed BOTH on one press; now only the top one answers the key. */
const OPEN_STACK: SwDialog[] = [];

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
  /** ACCESSREQ-293: an extra-wide box (up to 1120px) for a two-column form; the body scrolls, the footer stays. */
  @property({ type: Boolean, reflect: true }) xl = false;
  /** SHARED-POLISH-2342 (CAMADMIN-POLISH-2331 proposal): the box takes the width its content asks for - never narrower than the
   * default 440 px box, never wider than the xl one; for a list or a table whose width the screen does not know ahead. Opt-in. */
  @property({ type: Boolean, reflect: true }) fit = false;
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
      /* POLISH-CLASSIC-DOMUS-297 (apple-design "dim to focus", emil-design-eng "nothing appears from nothing"): the scrim fades in and
         the box lands from 96 % with opacity on the dialog spring. Centred (a modal is not anchored to a trigger). Reduced motion zeroes
         the durations (css.ts); a browser without @starting-style simply shows the dialog, as before. */
      opacity: 1;
      transition: opacity var(--sw-t-slow) var(--sw-ease);
      overscroll-behavior: contain;
    }
    @starting-style {
      .backdrop {
        opacity: 0;
      }
      .box {
        opacity: 0;
        transform: scale(0.96) translateY(6px);
      }
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
      backdrop-filter: var(--sw-glass-blur);
      -webkit-backdrop-filter: var(--sw-glass-blur);
      opacity: 1;
      transform: none;
      transition: opacity var(--sw-t-sheet) var(--sw-ease), transform var(--sw-spring-dialog-ms) var(--sw-spring-dialog);
    }
    :host([wide]) .box {
      inline-size: min(720px, 100%);
    }
    :host([xl]) .box {
      inline-size: min(1120px, 100%);
    }
    :host([fit]) .box {
      inline-size: fit-content;
      min-inline-size: min(440px, 100%);
      max-inline-size: min(1120px, 100%);
    }
    :host([xl]) .body {
      padding-inline: 20px;
      gap: 14px;
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
      color: var(--sw-heading);
      letter-spacing: -0.01em;
      text-wrap: balance;
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
    if (!this.open) return;
    if (e.key === 'Escape') {
      const top = OPEN_STACK[OPEN_STACK.length - 1];
      if (top && top !== this) return; // a dialog above this one takes the key
      this.close();
    } else if (e.key === 'Tab') this.trapTab(e);
  };

  /** A11Y-2310: aria-modal promises the page behind is out of reach, so Tab / Shift+Tab wrap inside the box
   * (through shadow roots and slots), like sw-sheet and sw-drawer. */
  private trapTab(e: KeyboardEvent) {
    const box = this.renderRoot.querySelector('.box');
    if (!box) return;
    const all = deepFocusables(box);
    if (!all.length) {
      e.preventDefault();
      return;
    }
    let active: Element | null = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    const inside = !!active && (box.contains(active) || this.contains(active) || this.shadowRoot?.contains(active) === true || (active.getRootNode() as ShadowRoot).host?.closest?.('sw-dialog') === this);
    // a second dialog opened above this one holds the focus: its own trap decides
    for (let n: Node | null = active; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      if (n instanceof SwDialog && n !== this && n.open) return;
    }
    const first = all[0];
    const last = all[all.length - 1];
    const isEdge = (edge: HTMLElement) => active === edge || (edge.shadowRoot?.contains(active) ?? false) || (active?.getRootNode() as ShadowRoot | undefined)?.host === edge;
    if (!inside || (e.shiftKey && isEdge(first)) || (!e.shiftKey && isEdge(last))) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }

  /** Keyboard focus moves into the dialog when it opens (the first field, else the first button, else the box):
   * until 0.1.80 it stayed on the page behind, so a keyboard user had to tab through the whole page. */
  updated(changed: Map<string, unknown>) {
    if (changed.has('open')) this.track(this.open);
    if (changed.has('open') && !this.open && changed.get('open') === true) this.restoreFocus();
    if (!changed.has('open') || !this.open) return;
    let a: Element | null = document.activeElement;
    while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
    if (a && !this.contains(a) && !this.shadowRoot?.contains(a)) this.opener = a as HTMLElement;
    requestAnimationFrame(() => {
      this.keepBoxInView();
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

  /** GATE2380-B: in the glass style (domus, crystal) a sw-card carries a backdrop-filter, which makes it the containing block of the
   * fixed backdrop: the box is centred on the CARD, not on the screen, and on a phone scrolled along a tall card it opened partly or
   * wholly outside the visible part of the page (the NVR connection card's "save anyway" dialog, 2.38.0 gate). Only when the backdrop
   * is not the viewport AND the box is not inside what its scrollers show, the page scrolls so the box sits in the middle of the
   * visible part; a dialog on the viewport (every other skin) or one already in view moves nothing. */
  private keepBoxInView() {
    const back = this.renderRoot.querySelector<HTMLElement>('.backdrop');
    const box = this.renderRoot.querySelector<HTMLElement>('.box');
    if (!back || !box) return;
    const b = back.getBoundingClientRect();
    const de = document.documentElement;
    if (Math.abs(b.top) < 1 && Math.abs(b.left) < 1 && Math.abs(b.width - de.clientWidth) < 2 && Math.abs(b.height - de.clientHeight) < 2) return;
    // the box's own place (offsets ignore the opening transform of @starting-style), then the visible part: the viewport cut by every
    // clipping ancestor up the composed tree
    const top = b.top + box.offsetTop;
    const bottom = top + box.offsetHeight;
    let lo = 0;
    let hi = de.clientHeight;
    for (let n: Node | null = back.parentNode; n; n = n instanceof ShadowRoot ? n.host : n.parentNode) {
      if (!(n instanceof Element) || getComputedStyle(n).overflowY === 'visible') continue;
      const r = n.getBoundingClientRect();
      lo = Math.max(lo, r.top + n.clientTop);
      hi = Math.min(hi, r.top + n.clientTop + n.clientHeight);
    }
    if (top >= lo - 0.5 && bottom <= hi + 0.5) return;
    box.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
  }

  private track(open: boolean) {
    const at = OPEN_STACK.indexOf(this);
    if (at >= 0) OPEN_STACK.splice(at, 1);
    if (open) OPEN_STACK.push(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    if (this.open && this.hasUpdated) this.track(true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.track(false);
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
