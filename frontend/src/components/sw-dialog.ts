import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import { t } from '../i18n/he';
import { deepFocusables } from './sw-drawer';
import { raiseLifted, setTopLayer } from './top-layer';
import { deepActive, holdsTab, pushLayer, removeLayer, restoreFocus, takesEscape, trapTab } from './modal-stack';

/** Small centred modal for short forms and confirmations. Closes on Escape, backdrop click or the ✕.
 *
 * DIALOG-TOPLAYER-2381: the backdrop is a manual popover shown in the browser's top layer, so it always covers the whole viewport and the
 * box is centred on the screen, whatever the dialog's ancestors carry (in the glass skins every sw-card has a backdrop-filter, which made
 * the card the containing block of the fixed backdrop: the dialog was centred on the card and only the card was dimmed). A dialog opened
 * from a dialog is shown later, so it paints above (the same order as the modal stack). Nothing else changes: the focus trap, Escape, the
 * return of focus and the page behind (not inert) are this element's own, as before. Without the Popover API the backdrop stays a fixed
 * element at --sw-z-modal.
 *
 * DIALOG-DRAWER-ONE-2439: the approved single dialog (owner round 33, Q-DES-8A) - see the rule block in the styles. `beforeclose`
 * (cancelable, not bubbling) is raised before the ✕ / Escape / the scrim close the dialog.
 *
 * A11Y-POLISHED-2342 / CR-MODAL-STACK-2441: every dialog listens for Escape on the window, so a confirmation opened over another
 * dialog closed BOTH on one press; only the top layer answers the key. The list of open layers is components/modal-stack.ts, shared
 * with the modal sw-drawer and sw-sheet (a dialog over a sheet had the same fault). */
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
      /* the browser's [popover] style (fit-content size, auto margin, a border, Canvas colours) put back to a full-viewport layer */
      inline-size: auto;
      block-size: auto;
      max-inline-size: none;
      max-block-size: none;
      margin: 0;
      border: 0;
      overflow: visible;
      color: inherit;
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
    /* DIALOG-DRAWER-ONE-2439 (owner round 33, Q-DES-8A a): ONE dialog for the whole system. An opaque surface with no blur - the
       floating-layer pair --sw-menu-surface / --sw-menu-border is opaque in every skin and is the solid twin inside a glass host, so
       nothing behind the box shows through it; the page is only dimmed by the scrim. Always centred, three fixed widths (440 / wide
       720 / xl 1120; fit is the content-sized exception for a table). The title, one line of explanation and the round close
       button on top; the actions on the bottom behind a hairline. On a phone it is a full-width sheet that rises from the bottom. */
    .box {
      box-sizing: border-box;
      inline-size: min(440px, 100%);
      color: var(--sw-text);
      background: var(--sw-menu-surface);
      border: 1px solid var(--sw-menu-border);
      border-radius: var(--sw-r-lg);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      max-block-size: calc(100dvh - 32px);
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
      padding: 16px 18px 10px;
    }
    header div {
      flex: 1;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xl);
      font-weight: var(--sw-fw-bold);
      line-height: 1.3;
      color: var(--sw-heading);
      letter-spacing: -0.01em;
      text-wrap: balance;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      margin-block-start: 2px;
    }
    .body {
      padding: 2px 18px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: auto;
      overscroll-behavior: contain;
    }
    footer[hidden] {
      display: none;
    }
    footer {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      padding: 12px 18px 16px;
      border-block-start: 1px solid var(--sw-menu-border);
    }
    /* phone: the same dialog as a sheet - full width, attached to the bottom edge, rising from it on the drawer curve (apple-design:
       a sheet enters along the edge it is attached to). The rise is a reveal from the bottom edge (a mask, see sheet-rise), not a
       transform: the box never leaves its resting place, so nothing is ever outside the viewport and a
       measurement taken mid-way is already the final one. One-shot keyframes (an entrance is never reversed; there is no exit
       animation), not filled forwards, so the resting sheet carries no clip and keeps its shadow. The duration is a token, so reduced
       motion (css.ts) shows it in place. */
    /* DIALOG-DRAWER-ONE-2439 r2: a MASK reveal, not clip-path - a clip-path also cuts the clipped part out of hit-testing, so a tap that
       landed on the sheet while it was still rising fell through to the scrim and closed the sheet (and a drag started there was lost).
       A mask hides the same part but the box keeps receiving every press at its resting place. The mask lives only in the keyframes:
       the resting sheet carries no mask (a mask would cut its shadow). */
    @keyframes sheet-rise {
      from {
        mask-image: linear-gradient(#000, #000);
        mask-repeat: no-repeat;
        mask-position: bottom;
        mask-size: 100% 0%;
      }
      to {
        mask-image: linear-gradient(#000, #000);
        mask-repeat: no-repeat;
        mask-position: bottom;
        mask-size: 100% 100%;
      }
    }
    @media (max-width: 767px) {
      .backdrop {
        place-items: end stretch;
        padding: max(16px, env(safe-area-inset-top, 0px)) 0 0;
      }
      .box,
      :host([wide]) .box,
      :host([xl]) .box,
      :host([fit]) .box {
        inline-size: 100%;
        min-inline-size: 0;
        max-inline-size: none;
        max-block-size: calc(100dvh - max(16px, env(safe-area-inset-top, 0px)));
        border-inline: 0;
        border-block-end: 0;
        border-end-start-radius: 0;
        border-end-end-radius: 0;
        transition: none;
        animation: sheet-rise var(--sw-t-sheet) var(--sw-ease-drawer) backwards;
      }
      header,
      .body,
      footer {
        padding-inline: max(18px, env(safe-area-inset-left, 0px)) max(18px, env(safe-area-inset-right, 0px));
      }
      .body {
        padding-block-end: max(14px, env(safe-area-inset-bottom, 0px));
      }
      footer {
        padding-block-end: max(16px, env(safe-area-inset-bottom, 0px));
      }
      @starting-style {
        .box {
          opacity: 1;
          transform: none;
        }
      }
    }
  `;

  /** Review B1: the control that had focus when the dialog opened - focus returns there when it closes. */
  private opener: HTMLElement | null = null;

  private restoreFocus() {
    const back = this.opener;
    this.opener = null;
    restoreFocus(back);
  }

  private close() {
    if (this.locked) return;
    // DIALOG-DRAWER-ONE-2439: a host with unsaved work may refuse the close request (the ✕, Escape, the scrim) and ask first - it
    // cancels `beforeclose` and closes the dialog itself (sets `open`) once the person has answered.
    if (!this.dispatchEvent(new CustomEvent('beforeclose', { cancelable: true }))) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private onKey = (e: KeyboardEvent) => {
    if (!this.open) return;
    if (e.key === 'Escape') {
      if (!takesEscape(this, e)) return; // a layer above this one (a dialog, a sheet, a modal drawer) takes the key
      this.close();
    } else if (e.key === 'Tab') this.trapTab(e);
  };

  /** A11Y-2310: aria-modal promises the page behind is out of reach, so Tab / Shift+Tab wrap inside the box
   * (through shadow roots and slots), like sw-sheet and sw-drawer. */
  private trapTab(e: KeyboardEvent) {
    const box = this.renderRoot.querySelector('.box');
    if (!box) return;
    // a layer opened above this one keeps Tab for itself
    if (!holdsTab(this)) return;
    const all = deepFocusables(box);
    if (!all.length) {
      e.preventDefault();
      return;
    }
    const active: Element | null = deepActive();
    const inside = !!active && (box.contains(active) || this.contains(active) || this.shadowRoot?.contains(active) === true || (active.getRootNode() as ShadowRoot).host?.closest?.('sw-dialog') === this);
    // a second dialog opened above this one holds the focus: its own trap decides
    for (let n: Node | null = active; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) {
      if (n instanceof SwDialog && n !== this && n.open) return;
    }
    trapTab(e, all, active, inside);
  }

  /** Keyboard focus moves into the dialog when it opens (the first field, else the first button, else the box):
   * until 0.1.80 it stayed on the page behind, so a keyboard user had to tab through the whole page. */
  updated(changed: Map<string, unknown>) {
    if (changed.has('open')) this.track(this.open);
    if (changed.has('open') && !this.open) this.layer(false);
    if (changed.has('open') && !this.open && changed.get('open') === true) this.restoreFocus();
    if (!changed.has('open') || !this.open) return;
    const a = deepActive();
    if (a && !this.contains(a) && !this.shadowRoot?.contains(a)) this.opener = a;
    this.layer(true);
    requestAnimationFrame(() => {
      // a field the user (or a test) already focused inside the dialog in the frame before keeps the focus: typing into the reason box
      // right after the dialog opened lost its caret to the first control (pixel-wiskey-access-diag, I18N-EN-SWITCH-2438 entry check)
      for (let now: Element | null = document.activeElement; now && now !== document.body; now = now.shadowRoot?.activeElement ?? null) {
        if (now !== this && (this.contains(now) || this.shadowRoot?.contains(now))) return;
      }
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

  /** DIALOG-TOPLAYER-2381: the backdrop in / out of the top layer. Opening raises the toasts that must stay above a dialog. */
  private layer(show: boolean) {
    setTopLayer(this.renderRoot.querySelector('.backdrop'), show);
    if (show) raiseLifted();
  }

  /** In / out of the shared stack of open layers (components/modal-stack.ts). */
  private track(open: boolean) {
    if (open) pushLayer(this);
    else removeLayer(this);
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.onKey);
    if (this.open && this.hasUpdated) {
      this.track(true);
      this.layer(true); // taken out of the page and put back while open: the browser hid the popover on removal
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.track(false);
    if (this.open) this.restoreFocus();
    window.removeEventListener('keydown', this.onKey);
  }

  render() {
    return html`<div class="backdrop" popover="manual" @click=${(e: Event) => e.target === e.currentTarget && this.close()}>
      <div class="box" role="dialog" aria-modal="true" aria-label=${this.heading}>
        <header><div><h3>${this.heading}</h3>${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}</div><sw-button round iconOnly icon="close" label=${t('actions.close')} data-dialog-close @click=${this.close}></sw-button></header>
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
