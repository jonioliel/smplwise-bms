import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * CR-SHELL-EXTRACT-B-2450 (owner N5, the follow-up named in CR-SHELL-EXTRACT-2440): the shell's overlay history entry, moved out of
 * shell/sw-app.ts into one controller. Behaviour unchanged (review M4, CR-013); only where it lives:
 *  - while the phone sheet, the tab-order dialog or the notification center is open, ONE history entry (same address, state
 *    `swOverlay: true`) stands for it, so Back closes the overlay instead of leaving the screen underneath (`push` / `pop`);
 *  - a menu item that navigates or acts on the screen first drops that entry (Back then returns to the screen the user was on, not to
 *    a duplicate of it), and only then runs (`leave`): the run waits for the `popstate` of that `history.back()`;
 *  - Back on the entry closes whatever overlay stands for it (`NavOverlayEnv.onBack`, the shell's own close).
 * The shell keeps what the overlays are (the user menu, the tab-order dialog, the center) and when they open and close; this
 * controller only keeps the entry. Nothing here is rendered, so nothing requests a render (the fields were plain fields before).
 */

/** The browser surface the controller uses (shell/sw-app.ts passes `window`; a unit spec fakes it). */
export interface NavOverlayEnv {
  /** `window.history`: its live `state`, `pushState` and `back`. */
  history: Pick<History, 'state' | 'pushState' | 'back'>;
  /** Where `popstate` is listened to (`window`). */
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  /** Back took the entry away while an overlay stood on it: the shell closes the tab-order dialog, the center and the menu. */
  onBack(): void;
}

const isOverlayState = (s: unknown): boolean => !!(s as { swOverlay?: boolean } | null)?.swOverlay;

export class NavOverlay implements ReactiveController {
  /** An overlay's history entry is on the stack (pushed by `push`, not yet popped). */
  private entry = false;
  /** What a menu item does once its overlay entry is gone (`leave`). */
  private pendingRun: (() => void) | null = null;

  constructor(host: ReactiveControllerHost, private readonly env: NavOverlayEnv) {
    host.addController(this);
  }

  hostConnected(): void {
    this.env.target.addEventListener('popstate', this.onPopState);
  }

  hostDisconnected(): void {
    this.env.target.removeEventListener('popstate', this.onPopState);
  }

  /** An overlay opened: one history entry (same address) stands for it. A second overlay that takes over keeps the same entry. */
  push(): void {
    if (this.entry) return;
    this.entry = true;
    try {
      this.env.history.pushState({ ...(this.env.history.state ?? {}), swOverlay: true }, '');
    } catch {
      this.entry = false;
    }
  }

  /** The overlay closed by itself (✕, Esc, save): drop its history entry. */
  pop(): void {
    if (!this.entry) return;
    this.entry = false;
    if (isOverlayState(this.env.history.state)) this.env.history.back();
  }

  /** CR-013: a navigation moved the address on: the entry is behind the new one now and simply stays (Back returns to the same
   * screen); it no longer stands for an overlay. */
  forget(): void {
    this.entry = false;
  }

  /** A menu item's navigation or screen action (the shell has closed its overlays already): when the overlay's own entry is on top it
   * is dropped first and `then` runs on its `popstate`; otherwise `then` runs at once. */
  leave(then: () => void): void {
    const own = this.entry && isOverlayState(this.env.history.state);
    this.entry = false;
    if (own) {
      this.pendingRun = then;
      this.env.history.back();
    } else {
      then();
    }
  }

  private onPopState = (e: PopStateEvent): void => {
    if (this.pendingRun) {
      const run = this.pendingRun;
      this.pendingRun = null;
      run();
      return;
    }
    if (!this.entry || isOverlayState(e.state)) return;
    this.entry = false;
    this.env.onBack();
  };
}
