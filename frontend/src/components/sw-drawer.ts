import { LitElement, html, css, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './sw-button';
import { t } from '../i18n/he';

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

/** The focusable elements under `root` in composed (visual) order: into shadow roots and through slots. */
export function deepFocusables(root: Node): HTMLElement[] {
  const out: HTMLElement[] = [];
  const visit = (n: Node) => {
    if (!(n instanceof HTMLElement) && !(n instanceof ShadowRoot) && !(n instanceof DocumentFragment)) return;
    if (n instanceof HTMLElement) {
      if (n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true' || n.hidden) return;
      if (n instanceof HTMLSlotElement) {
        for (const a of n.assignedElements({ flatten: true })) visit(a);
        return;
      }
      if (n.matches(FOCUSABLE) && n.getAttribute('tabindex') !== '-1' && !(n as HTMLButtonElement).disabled && n.getClientRects().length) out.push(n);
      if (n.shadowRoot) {
        visit(n.shadowRoot);
        return;
      }
    }
    for (const c of Array.from(n.childNodes)) visit(c);
  };
  visit(root);
  return out;
}

/** The element that really holds focus (through shadow roots). */
function deepActive(): HTMLElement | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a as HTMLElement | null;
}

/**
 * Context drawer: a side panel on desktop/tablet (start side, i.e. right in RTL) and a bottom sheet on phones. It never
 * covers the whole map, so spatial context stays visible.
 *
 * `modal` (owner 2026-09-29, the overview tiles' panel): the same side panel / bottom sheet as a MODAL dialog in the top
 * layer (`<dialog>.showModal()`): the page behind is inert, focus moves in and is trapped (Tab / Shift+Tab wrap inside
 * the panel, through shadow roots and slots), Escape and a press on the dimmed backdrop close it, and focus returns to
 * the control that opened it. Content that opens its own dialog (a confirmation) must render it inside the drawer,
 * since everything outside the top layer is inert. No transform on the open panel (a transform would become the
 * containing block of a nested fixed confirmation dialog).
 */
/** One reference count per locked scroll container, shared by every drawer: the inline `overflow` is saved by the FIRST lock and
 * restored by the LAST release. Per-drawer save/restore left a container locked for good when two drawers overlapped (the second
 * one saved the first one's "hidden" and put it back on closing last): the page could no longer be scrolled. */
const scrollLocks = new Map<HTMLElement, { n: number; overflow: string }>();

function lockEl(el: HTMLElement) {
  const l = scrollLocks.get(el);
  if (l) l.n++;
  else {
    scrollLocks.set(el, { n: 1, overflow: el.style.overflow });
    el.style.overflow = 'hidden';
  }
}

function unlockEl(el: HTMLElement) {
  const l = scrollLocks.get(el);
  if (!l) return;
  if (--l.n > 0) return;
  scrollLocks.delete(el);
  el.style.overflow = l.overflow;
}

@customElement('sw-drawer')
export class SwDrawer extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property() heading = '';
  @property() subheading = '';
  @property({ type: Boolean, reflect: true }) modal = false;
  private opener: HTMLElement | null = null;
  @state() private hasFooter = false;
  /** review M3: a press that STARTED on the backdrop - a drag from inside the panel ending outside never closes it. */
  private downOnBackdrop = false;
  /** review M2: the scroll containers behind a modal drawer, locked while it is open (their inline overflow before). */
  private locked: HTMLElement[] = [];

  static styles = css`
    :host {
      display: contents;
    }
    .panel {
      position: absolute;
      inset-block: 0;
      inset-inline-start: 0;
      inline-size: min(var(--sw-drawer-w), 100%);
      background: var(--sw-surface);
      border-inline-end: 1px solid var(--sw-border);
      box-shadow: var(--sw-shadow-3);
      display: flex;
      flex-direction: column;
      z-index: var(--sw-z-drawer);
      transform: translateX(100%);
      transition: transform var(--sw-t-med) var(--sw-ease);
      visibility: hidden;
    }
    :host-context([dir='ltr']) aside.panel {
      transform: translateX(-100%);
    }
    :host([open]) .panel {
      transform: none;
      visibility: visible;
    }
    /* review G: closed, the side panel is not laid out at all - an off-screen absolute box still counts toward the
       scrollable overflow of the page around it */
    :host(:not([open])) aside.panel {
      display: none;
    }
    header {
      display: flex;
      align-items: flex-start;
      gap: var(--sw-s-3);
      padding: 12px 14px;
      border-block-end: 1px solid var(--sw-border);
    }
    .titles {
      flex: 1;
      min-inline-size: 0;
    }
    /* an optional header action (the player panel's power button) sits between the title and the close button, and comes AFTER it in
       the focus order: the first focus on open is the close button, never an action */
    header sw-button[data-drawer-close] {
      order: 2;
    }
    ::slotted([slot='action']) {
      order: 1;
      align-self: center;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-lg);
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sub {
      color: var(--sw-text-2);
      font-size: var(--sw-fs-sm);
      font-variant-numeric: tabular-nums;
    }
    .body {
      flex: 1;
      overflow: auto;
      overscroll-behavior: contain;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    footer {
      display: flex;
      gap: var(--sw-s-2);
      padding: 10px 14px;
      border-block-start: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    footer[hidden] {
      display: none;
    }
    .grip {
      display: none;
    }
    @media (max-width: 767px) {
      .panel {
        inset: auto 0 0 0;
        inline-size: 100%;
        max-block-size: 62dvh;
        border-inline-end: 0;
        border-block-start: 1px solid var(--sw-border);
        border-start-start-radius: var(--sw-r-lg);
        border-start-end-radius: var(--sw-r-lg);
        transform: translateY(100%);
        box-shadow: var(--sw-shadow-3);
      }
      :host-context([dir='ltr']) aside.panel {
        transform: translateY(100%);
      }
      .grip {
        display: block;
        inline-size: 40px;
        block-size: 4px;
        border-radius: 2px;
        background: var(--sw-border-strong);
        margin: var(--sw-s-2) auto 0;
      }
    }

    /* ---- modal: a <dialog> in the top layer ---- */
    dialog.panel {
      position: fixed;
      margin: 0;
      padding: 0;
      border: 0;
      border-inline-end: 1px solid var(--sw-border);
      max-inline-size: none;
      max-block-size: none;
      inset-block: 0;
      inset-inline-start: 0;
      inset-inline-end: auto;
      block-size: 100dvh;
      inline-size: min(var(--sw-drawer-modal-w, 480px), 100vw);
      box-sizing: border-box;
      color: var(--sw-text);
      /* a panel over the page must stay readable: a glass palette's solid surface when there is one */
      background: var(--dv-surface-solid, var(--sw-surface));
      transform: none;
      transition: none;
      visibility: visible;
      overflow: hidden;
      overscroll-behavior: contain;
    }
    dialog.panel:not([open]) {
      display: none;
    }
    dialog.panel::backdrop {
      background: rgba(15, 23, 42, 0.38);
    }
    .trap {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
    @media (max-width: 767px) {
      dialog.panel {
        inset-block: auto 0;
        inset-inline: 0;
        inline-size: 100%;
        block-size: auto;
        max-block-size: 88dvh;
        border-inline-end: 0;
        border-block-start: 1px solid var(--sw-border);
        border-start-start-radius: var(--sw-r-lg);
        border-start-end-radius: var(--sw-r-lg);
        transform: none;
      }
      dialog.panel .body {
        padding-block-end: max(14px, env(safe-area-inset-bottom, 0px));
      }
      dialog.panel footer {
        padding-block-end: max(10px, env(safe-area-inset-bottom, 0px));
      }
    }
  `;

  private close() {
    this.open = false;
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private get dialog(): HTMLDialogElement | null {
    return this.renderRoot.querySelector('dialog');
  }

  protected updated(changed: PropertyValues<this>) {
    if (!this.modal || !changed.has('open')) return;
    const dlg = this.dialog;
    if (!dlg) return;
    if (this.open && !dlg.open) {
      this.opener = deepActive();
      try {
        dlg.showModal();
      } catch {
        dlg.setAttribute('open', '');
      }
      this.lockScroll();
      // Escape is caught at the document (capture), wherever focus is - even outside the <dialog> after a re-render
      document.addEventListener('keydown', this.onKeyCapture, true);
      requestAnimationFrame(() => this.focusEdge('start'));
    } else if (!this.open && dlg.open) {
      dlg.close();
      this.unlockScroll();
      document.removeEventListener('keydown', this.onKeyCapture, true);
      const back = this.opener;
      this.opener = null;
      if (back?.isConnected) back.focus({ preventScroll: true });
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.dialog?.open) this.dialog.close();
    this.unlockScroll();
    document.removeEventListener('keydown', this.onKeyCapture, true);
  }

  /** Every scrolling ancestor (through shadow roots) stops scrolling while the modal drawer is open: a wheel or a
   * touch over the dimmed page never moves the screen behind (review M2). */
  private lockScroll() {
    this.unlockScroll();
    let n: Node | null = this;
    while (n) {
      const parent: Node | null = n.parentNode instanceof ShadowRoot ? n.parentNode.host : n.parentNode;
      if (parent instanceof HTMLElement) {
        const oy = getComputedStyle(parent).overflowY;
        if (oy === 'auto' || oy === 'scroll' || parent === document.documentElement) {
          this.locked.push(parent);
          lockEl(parent);
        }
      }
      n = parent;
    }
  }

  private unlockScroll() {
    for (const el of this.locked) unlockEl(el);
    this.locked = [];
  }

  private onFooterSlot = (e: Event) => {
    const slot = e.target as HTMLSlotElement;
    this.hasFooter = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? '').trim() !== '');
  };

  private onPointerDown = (e: PointerEvent) => {
    const dlg = this.dialog;
    if (!dlg || e.target !== dlg) {
      this.downOnBackdrop = false;
      return;
    }
    const r = dlg.getBoundingClientRect();
    this.downOnBackdrop = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };

  /** Focus the first (or last) focusable inside the panel - the Tab trap's two ends. */
  private focusEdge(edge: 'start' | 'end') {
    const dlg = this.dialog;
    if (!dlg) return;
    const all = deepFocusables(dlg).filter((el) => !el.classList.contains('trap'));
    const el = edge === 'start' ? all[0] : all[all.length - 1];
    (el ?? dlg).focus({ preventScroll: true });
  }

  private nestedDialogOpen(): boolean {
    const dlg = this.dialog;
    if (!dlg) return false;
    const walk = (root: Node): boolean => {
      for (const el of Array.from((root as ParentNode).querySelectorAll?.('*') ?? [])) {
        if (el.tagName === 'SW-DIALOG' && el.hasAttribute('open')) return true;
        if (el instanceof HTMLSlotElement && el.assignedElements({ flatten: true }).some((a) => (a.tagName === 'SW-DIALOG' && a.hasAttribute('open')) || walk(a) || (a.shadowRoot ? walk(a.shadowRoot) : false))) return true;
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return walk(dlg);
  }

  /** Escape is handled here, not by the browser's close request (which it may even skip after a prevented one): with a
   * confirmation open inside, the key is left to that confirmation (review B1); otherwise it closes the drawer. */
  private onKeyCapture = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault(); // no native cancel / close for this key
    if (this.nestedDialogOpen()) return;
    this.close();
  };

  private onCancel = (e: Event) => {
    e.preventDefault(); // the dialog closes through `open`, so the opener gets its focus back and `close` is raised
    if (this.nestedDialogOpen()) return;
    this.close();
  };

  /** The browser may close a modal dialog itself (a second Escape without a user activation in between skips the
   * cancel event): keep `open` and the `close` event in step. */
  private onNativeClose = (e: Event) => {
    // only the <dialog>'s own close - a nested confirmation's composed `close` bubbles through here too
    // `close` is queued as a task after dialog.close(): when the panel was closed and re-opened before it ran (a deep link replaced by another
    // one), the event is stale - the dialog is open again - and must not close the new panel. A real browser close leaves the dialog closed.
    if (e.target === e.currentTarget && this.open && !this.dialog?.open) this.close();
  };

  /** A press on the dimmed backdrop (outside the panel's box) closes it. */
  private onDialogClick = (e: MouseEvent) => {
    const dlg = this.dialog;
    if (!dlg || e.target !== dlg || !this.downOnBackdrop) return;
    this.downOnBackdrop = false;
    const r = dlg.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
  };

  private renderInner() {
    return html`<div class="grip" aria-hidden="true"></div>
      <header>
        <div class="titles">
          <h3 id="dh">${this.heading}</h3>
          ${this.subheading ? html`<div class="sub">${this.subheading}</div>` : ''}
        </div>
        <sw-button variant="ghost" size="sm" iconOnly icon="close" label=${t('actions.close')} data-drawer-close @click=${this.close}></sw-button>
        <slot name="action"></slot>
      </header>
      <div class="body"><slot></slot></div>
      <footer ?hidden=${!this.hasFooter}><slot name="footer" @slotchange=${this.onFooterSlot}></slot></footer>`;
  }

  render() {
    if (this.modal) {
      return html`<dialog class="panel" aria-labelledby="dh" @cancel=${this.onCancel} @close=${this.onNativeClose} @pointerdown=${this.onPointerDown} @click=${this.onDialogClick}>
        <span class="trap" tabindex="0" aria-hidden="true" @focus=${() => this.focusEdge('end')}></span>
        ${this.renderInner()}
        <span class="trap" tabindex="0" aria-hidden="true" @focus=${() => this.focusEdge('start')}></span>
      </dialog>${nothing}`;
    }
    return html`
      <aside class="panel" role="dialog" aria-modal="false" aria-label=${this.heading} ?hidden=${!this.open}>
        ${this.renderInner()}
      </aside>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-drawer': SwDrawer;
  }
}
