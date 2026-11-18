import { deepActive, holdsTab, isTopLayer, pushLayer, removeLayer, restoreFocus, takesEscape, trapTab } from './modal-stack';
import { deepFocusables } from './sw-drawer';

/**
 * CR-MODAL-STACK-B-2442 (code review 07:F13, the part CR-MODAL-STACK-2441 left open): a hand-built modal - a screen that draws its own
 * dialog box (role dialog) instead of using sw-dialog / sw-drawer / sw-sheet - joins the shared modal stack through this class. It changes no
 * markup and no style: the screen keeps drawing its box exactly as before and only tells this object when the box is open.
 *
 * While the box is open:
 *  - it is a layer of the stack, so Escape closes only the top layer (a confirmation above the box closes alone; the box closes on the
 *    next press) and a primitive below the box no longer closes with it;
 *  - Tab / Shift+Tab stay inside the box (only while this layer holds the trap);
 *  - the elements the screen names as its background are `inert`;
 *  - when it closes after a KEYBOARD action (Escape, Enter on a button of the box), focus returns to the control that opened it. A
 *    pointer or touch close leaves focus alone: a programmatic focus after a tap counts as keyboard focus in the browser and would draw
 *    the opener's focus ring (the rule screens/area-quick-sheet.ts already follows).
 *
 * The keys are heard on the window (as sw-dialog and sw-sheet do), so they also work when focus is not inside the box - an inert
 * background drops the focus of the control that opened the box to the page.
 *
 * Use: `private modal = new HandModal({ box: () => ..., close: () => ... })`, `this.modal.sync(open)` in `updated()`, and
 * `this.modal.release()` in `disconnectedCallback()`. The screen's own Escape listener is removed (this one replaces it).
 */
export interface HandModalOptions {
  /** The box that holds everything of the modal (the element with the dialog role, or the wrapper of the dialog and its scrim). */
  box: () => Element | null | undefined;
  /** Close the modal (Escape while it is the top layer). */
  close: (e: KeyboardEvent) => void;
  /** Whether Escape closes it right now. A modal that says no still answers the key, so the press never reaches the layer below. */
  escape?: () => boolean;
  /** Whether Tab is kept inside right now. Default: it is. */
  traps?: () => boolean;
  /** The background made inert while the modal is open. Elements that are already inert are left alone and never restored. */
  inert?: () => Array<Element | null | undefined>;
  /** Whether focus returns to the opener after a keyboard close. Default: it does. */
  restore?: boolean;
}

/** Whether `node` sits inside `root` in the composed tree (through shadow hosts and slots). */
function insideComposed(node: Node | null, root: Node): boolean {
  let n: Node | null = node;
  while (n) {
    if (n === root) return true;
    n = (n as Element).assignedSlot ?? n.parentNode ?? (n as ShadowRoot).host ?? null;
  }
  return false;
}

export class HandModal {
  private on = false;
  private opener: HTMLElement | null = null;
  private inerted: Element[] = [];
  /** The last thing the person did while the box was open was a key press (not a pointer press). */
  private byKey = false;
  private onAnyKey = () => { this.byKey = true; };
  private onPointer = () => { this.byKey = false; };

  constructor(private readonly o: HandModalOptions) {}

  /** The stack skips a layer that is not in the page (modal-stack `live`): a box that vanished without `sync(false)` never holds a key. */
  get isConnected(): boolean {
    return this.on && this.o.box()?.isConnected === true;
  }

  /** Whether the modal is open as far as the stack knows. */
  get open(): boolean {
    return this.on;
  }

  /** Tell the stack whether the box is open. Call it after every render (`updated()`); it acts only when the state changes. */
  sync(open: boolean): void {
    if (open === this.on) return;
    this.on = open;
    if (open) {
      this.opener = deepActive();
      pushLayer(this, { traps: this.o.traps });
      this.byKey = false;
      window.addEventListener('keydown', this.onKey);
      window.addEventListener('keydown', this.onAnyKey, true);
      window.addEventListener('pointerdown', this.onPointer, true);
      for (const el of this.o.inert?.() ?? []) {
        if (!el || el.hasAttribute('inert')) continue;
        el.setAttribute('inert', '');
        this.inerted.push(el);
      }
      return;
    }
    this.leave();
    const back = this.opener;
    this.opener = null;
    if (this.o.restore !== false && this.byKey && back && back !== document.body) restoreFocus(back);
  }

  /** The host left the page: leave the stack, drop the listener, give the background back. Focus is not moved. */
  release(): void {
    if (!this.on) return;
    this.on = false;
    this.opener = null;
    this.leave();
  }

  private leave() {
    removeLayer(this);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keydown', this.onAnyKey, true);
    window.removeEventListener('pointerdown', this.onPointer, true);
    for (const el of this.inerted) el.removeAttribute('inert');
    this.inerted = [];
  }

  private onKey = (e: KeyboardEvent) => {
    const box = this.o.box();
    if (!box?.isConnected) return;
    if (e.key === 'Escape') {
      if (!takesEscape(this, e)) return; // a layer above this one takes the key
      e.preventDefault();
      if (this.o.escape?.() === false) return;
      this.o.close(e);
      return;
    }
    if (e.key !== 'Tab' || e.altKey || e.ctrlKey || e.metaKey || !holdsTab(this)) return;
    const active = deepActive();
    trapTab(e, deepFocusables(box), active, insideComposed(active, box));
  };

  /** Whether this modal is the top layer (a screen that also closes on other keys asks first). */
  get top(): boolean {
    return isTopLayer(this);
  }
}
