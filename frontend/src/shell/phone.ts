import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * The one definition of "a phone" for behaviour that depends on it (mobile audit 2026-09-30): the viewport is narrower
 * than 768 px. CSS keeps using `@media (max-width: 767px)`; script uses this so every screen agrees, and follows a
 * rotation / resize live.
 *
 *   private readonly phone = new PhoneWidth(this);     // a Lit element: re-renders when the width crosses 768 px
 *   ... this.phone.matches ...
 *   isPhoneWidth()                                       // one-off checks (event handlers, plain functions)
 */
export const PHONE_MAX_WIDTH_PX = 767;
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

/** The text of the guard state a phone shows instead of a structure-management screen. */
export const STRUCTURE_DESKTOP_ONLY = 'עריכת מבנה וקומות זמינה במחשב בלבד';

/**
 * Owner decision 2026-09-30: structure management (creating, editing or deleting sites, buildings, floors and plans, the
 * plan import and the plan editor) is not offered on a phone, so nobody breaks the structure from a small screen.
 * This is a UX guard, NOT a security boundary: the server still enforces every permission on every write, and a
 * desktop-width window (or the desktop-site mode of a phone browser) reaches the same screens.
 */
export function structureEditAllowed(): boolean {
  return !isPhoneWidth();
}

let mq: MediaQueryList | null | undefined;

function query(): MediaQueryList | null {
  if (mq === undefined) {
    try {
      mq = window.matchMedia(PHONE_QUERY);
    } catch {
      mq = null;
    }
  }
  return mq;
}

export function isPhoneWidth(): boolean {
  return query()?.matches ?? false;
}

/** Calls `fn` whenever the viewport crosses the phone breakpoint; returns the unsubscribe function. */
export function onPhoneWidthChange(fn: (phone: boolean) => void): () => void {
  const q = query();
  if (!q) return () => undefined;
  const h = () => fn(q.matches);
  q.addEventListener('change', h);
  return () => q.removeEventListener('change', h);
}

/** A Lit reactive controller: `matches` is the live answer and the host re-renders when it changes. */
export class PhoneWidth implements ReactiveController {
  private off?: () => void;
  constructor(private readonly host: ReactiveControllerHost) {
    host.addController(this);
  }
  get matches(): boolean {
    return isPhoneWidth();
  }
  hostConnected() {
    this.off = onPhoneWidthChange(() => this.host.requestUpdate());
  }
  hostDisconnected() {
    this.off?.();
    this.off = undefined;
  }
}
