/**
 * One pointer-drag session (code review 08:F14). The plan canvas wrote the same wiring ten times: add `pointermove`,
 * `pointerup` and `pointercancel` to the viewport, remove all three when the gesture ends. In six of the copies
 * `pointercancel` was bound to the same handler as `pointerup`, so a gesture the browser took over (a system swipe, a
 * palm, a lost capture) ended as a COMMITTED move - with the coordinates of the cancel event, which are not the pointer's.
 *
 * `dragSession` owns the three listeners and tells the two endings apart: `commit` for a release, `cancel` for an
 * interrupted gesture (the tool restores its pre-drag state and dispatches nothing). The listeners are removed before
 * either handler runs, and exactly one of the two runs, once.
 */

/** The part of an element the session needs (the canvas viewport; a plain object in the unit spec). */
export interface DragTarget {
  addEventListener(type: string, listener: (e: PointerEvent) => void): void;
  removeEventListener(type: string, listener: (e: PointerEvent) => void): void;
}

interface DragHandlers {
  /** The pointer moved while the gesture is alive. */
  move(e: PointerEvent): void;
  /** The pointer was released: the drag is the user's decision. */
  commit(e: PointerEvent): void;
  /** The gesture was interrupted (`pointercancel`): put back what the drag previewed; nothing is saved or dispatched. */
  cancel(e: PointerEvent): void;
}

/** Starts a session on `target`. Returns a function that ends it early without calling `commit` or `cancel` (the
 * element went away); calling it after the gesture ended does nothing. */
export function dragSession(target: DragTarget, handlers: DragHandlers): () => void {
  let live = true;
  const stop = (): boolean => {
    if (!live) return false;
    live = false;
    target.removeEventListener('pointermove', move);
    target.removeEventListener('pointerup', up);
    target.removeEventListener('pointercancel', cancel);
    return true;
  };
  const move = (e: PointerEvent): void => {
    if (live) handlers.move(e);
  };
  const up = (e: PointerEvent): void => {
    if (stop()) handlers.commit(e);
  };
  const cancel = (e: PointerEvent): void => {
    if (stop()) handlers.cancel(e);
  };
  target.addEventListener('pointermove', move);
  target.addEventListener('pointerup', up);
  target.addEventListener('pointercancel', cancel);
  return () => void stop();
}
