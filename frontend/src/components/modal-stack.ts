/**
 * CR-MODAL-STACK-2441 (code review 07:F13): ONE stack for the three modal primitives - sw-dialog, the modal sw-drawer and sw-sheet -
 * and the three helpers each of them had written for itself (the deep active element, the Tab wrap, the return of focus).
 *
 * Every primitive listens for Escape on its own (the dialog and the sheet on the window, the modal drawer on the document in the
 * capture phase), so two of them open together both answered one key press: a confirmation over a sheet closed the sheet too, a
 * sheet inside a modal drawer closed with the drawer. A11Y-POLISHED-2342 fixed that for a dialog over a dialog with a list of the
 * open dialogs; this is that list, shared: a primitive enters it when it opens and leaves it when it closes or is taken out of the
 * page, and takes Escape only while it is the last one in. A single open primitive is always the last one in, so nothing changes
 * for it.
 *
 * No DOM at import time (the unit spec runs it in Node).
 */

export interface LayerOptions {
  /** Whether the layer keeps Tab inside itself right now (an inline sw-sheet does not). Default: it does. */
  traps?: () => boolean;
}

interface Entry {
  layer: object;
  traps: () => boolean;
}

/** The open layers, oldest first. */
const STACK: Entry[] = [];
/** Key events a layer has already answered: see takesEscape. */
const ANSWERED = new WeakSet<object>();

const always = () => true;
/** A layer that was taken out of the page without leaving the stack must never hold the key. Plain objects (the unit spec) count. */
const live = (layer: object) => (layer as { isConnected?: boolean }).isConnected !== false;

/** `layer` opened: it becomes the top one (a layer that is already in the stack moves to the top). */
export function pushLayer(layer: object, options: LayerOptions = {}): void {
  removeLayer(layer);
  STACK.push({ layer, traps: options.traps ?? always });
}

/** `layer` closed or left the page. */
export function removeLayer(layer: object): void {
  const at = STACK.findIndex((e) => e.layer === layer);
  if (at >= 0) STACK.splice(at, 1);
}

/** The layer opened last that is still in the page, or null. */
export function topLayer(): object | null {
  for (let i = STACK.length - 1; i >= 0; i--) if (live(STACK[i].layer)) return STACK[i].layer;
  return null;
}

/** Whether `layer` is the top one. */
export function isTopLayer(layer: object): boolean {
  return topLayer() === layer;
}

/**
 * Whether `layer` answers this Escape press: it is the top layer and no other layer has answered the same event.
 *
 * The second half matters: the top layer closes inside its listener and leaves the stack before the next listener of the same event
 * runs (the element's update is a microtask, and the browser runs microtasks between listeners), so the layer below would find
 * itself on top and close on the very same press. The layer that answers is recorded on the event; a locked top layer answers too
 * (and does nothing), so the press never falls through to the layer below.
 */
export function takesEscape(layer: object, event: object): boolean {
  if (ANSWERED.has(event) || topLayer() !== layer) return false;
  ANSWERED.add(event);
  return true;
}

/** Whether `layer` is the one that keeps Tab inside itself: the top layer among those that trap (an inline sheet above it does not
 * take the trap away from a modal layer). */
export function holdsTab(layer: object): boolean {
  for (let i = STACK.length - 1; i >= 0; i--) {
    const e = STACK[i];
    if (live(e.layer) && e.traps()) return e.layer === layer;
  }
  return false;
}

/** The number of open layers (tests). */
export function layerCount(): number {
  return STACK.length;
}

/** The element that really holds focus (through shadow roots). */
export function deepActive(): HTMLElement | null {
  let a: Element | null = document.activeElement;
  while (a?.shadowRoot?.activeElement) a = a.shadowRoot.activeElement;
  return a as HTMLElement | null;
}

/**
 * Tab / Shift+Tab wrap inside a modal box. `all` are the box's focusable elements in visual order (deepFocusables), `active` the
 * element that holds focus and `inside` whether that element is in the box. Focus outside the box is pulled to the first element
 * (the last one with Shift); on an edge it wraps to the other edge; anywhere else the browser moves it. An edge also counts when
 * focus sits in its shadow root (an sw-button's inner button). With nothing to focus the key is swallowed.
 */
export function trapTab(e: Pick<KeyboardEvent, 'shiftKey' | 'preventDefault'>, all: HTMLElement[], active: Element | null, inside: boolean): void {
  if (!all.length) {
    e.preventDefault();
    return;
  }
  const first = all[0];
  const last = all[all.length - 1];
  const isEdge = (edge: HTMLElement) => active === edge || (!!active && (edge.shadowRoot?.contains(active) ?? false)) || (active?.getRootNode() as ShadowRoot | undefined)?.host === edge;
  if (!inside || (e.shiftKey && isEdge(first)) || (!e.shiftKey && isEdge(last))) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus({ preventScroll: true });
  }
}

/** Focus goes back to the control that opened the layer, if it is still in the page: on the next frame (the layer is gone by then),
 * or at once with `now`. */
export function restoreFocus(opener: HTMLElement | null, now = false): void {
  if (!opener?.isConnected) return;
  if (now) opener.focus({ preventScroll: true });
  else requestAnimationFrame(() => opener.focus({ preventScroll: true }));
}
