import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { parseDoorConfirmLink, type NotifySummary } from '../api/notifications';
import type { SessionMode } from '../api/session';
import { badgeOf, parseNotificationLink } from '../components/notify-logic';

/**
 * CR-SHELL-EXTRACT-2440 (code review 07:F24): the shell's notification wiring, moved out of shell/sw-app.ts into one controller.
 * Behaviour unchanged (CR-018); only where it lives:
 *  - the numbers behind the avatar's red dot and the user menu's chip: `/notifications/summary` (unread, open critical) from the
 *    notification store, refreshed by its live events and by the shell's 60 s poll; when the summary does not answer (an older
 *    backend) the rule-alert count stands in (`rules/alerts?unacked=true`, null = this user may not read alerts);
 *  - the notification center's open state, the row a deep link focuses and the door confirmation it asks for;
 *  - the deep links of a push (`#/notifications/<id>`, `#/doors/<id>?confirm=<id>`): the center opens on that row once the session
 *    is known, and survives the route change the shell makes right after (the address falls back to the home screen).
 * The shell keeps what is not the notifications' own: the user menu, the tab-order dialog and the overlay history entry the center
 * shares with them (shell/sw-app.ts openCenter / closeCenter; the entry itself: shell/overlay-history.ts).
 *
 * Every state change asks the host to render only when a value really changed (the `@state()` rule this state used to follow).
 */

/** What the controller reads from the notification store and the rules API (shell/sw-app.ts passes the real ones; a unit spec fakes them). */
export interface NotifyEnv {
  /** notifyStore.subscribe: called with the summary on every store change; returns the unsubscribe function. */
  subscribe(fn: (summary: NotifySummary | null) => void): () => void;
  /** notifyStore.start: the summary now, the live events afterwards (idempotent). */
  start(): Promise<void>;
  /** notifyStore.stop: the live events end. */
  stop(): void;
  /** notifyStore.refreshSummary: the summary is read again (its answer arrives through `subscribe`). */
  refreshSummary(): Promise<void>;
  /** The open rule alerts in this user's scope (the server's `unacked`). */
  unackedAlerts(): Promise<number>;
  /** This user may read the rule alerts (events.read). */
  mayReadAlerts(): boolean;
}

export class ShellNotify implements ReactiveController {
  private sum: NotifySummary | null = null;
  private alerts: number | null = null;
  private isOpen = false;
  private focus = '';
  private door = false;
  /** A deep link asked for the center before the session was known; the center opens once it is (never in a gate, never in the kiosk). */
  private pending = false;
  /** The route change right after a deep link (the address falls back to the home screen) keeps the center open. */
  private keepOnce = false;
  private unsubscribe?: () => void;

  constructor(private readonly host: ReactiveControllerHost, private readonly env: NotifyEnv) {
    host.addController(this);
  }

  hostConnected(): void {
    this.unsubscribe = this.env.subscribe((s) => {
      if (this.changed(this.sum, s)) this.sum = s;
    });
  }

  hostDisconnected(): void {
    this.unsubscribe?.();
    this.env.stop();
  }

  /** `/notifications/summary` (null while it is not available: the rule-alert count stands in). */
  get summary(): NotifySummary | null {
    return this.sum;
  }
  /** The open rule alerts of the last poll (null = this user may not read alerts, or not asked yet). */
  get alertCount(): number | null {
    return this.alerts;
  }
  get open(): boolean {
    return this.isOpen;
  }
  /** The row a deep link focuses ('' = none). */
  get focusId(): string {
    return this.focus;
  }
  /** The deep link was a push's "פתח דלת": the center asks for the in-app confirmation. */
  get confirmDoor(): boolean {
    return this.door;
  }

  /** The avatar's dot and the menu chip (CR-018): see `badgeOf`. A gated user (no role, a presence gate) has none. */
  badge(gated: boolean): ReturnType<typeof badgeOf> {
    return badgeOf(gated ? null : this.sum, gated ? null : this.alerts);
  }

  /** The session is known (api / demo, not the Lovelace card view): the badge's summary and the live events start. */
  startLive(mode: SessionMode, embedded: boolean): void {
    if ((mode === 'api' || mode === 'demo') && !embedded) void this.env.start();
  }

  /** The numbers behind the red dot and the menu's chip: the summary first, the rule-alert count when it does not answer. Never inside the kiosk
   * or the Lovelace card view (`chromeless`): they have no user menu. */
  async poll(mode: SessionMode, chromeless: boolean): Promise<void> {
    if (chromeless) return;
    if (mode === 'demo') {
      this.setAlerts(0);
      return;
    }
    if (mode !== 'api') {
      this.setAlerts(null);
      return;
    }
    await this.env.refreshSummary();
    if (this.sum) return;
    if (!this.env.mayReadAlerts()) {
      this.setAlerts(null);
      return;
    }
    try {
      this.setAlerts(await this.env.unackedAlerts());
    } catch {
      /* keep the last known count */
    }
  }

  /** CR-018 / CR §9: a push's deep link in the address. The "פתח דלת" link (#/doors/<id>?confirm=<notification id>) opens the center on that
   * notification with the in-app confirmation - never an unlock by itself; every other push opens '#/notifications/<id>': the center on that
   * row. True when the address was such a link: the center is now pending (`takePending`) and survives the next route change. */
  takeLink(hash: string): boolean {
    const doorLink = parseDoorConfirmLink(hash);
    const rowLink = doorLink ? null : parseNotificationLink(hash);
    if (!doorLink && !rowLink) return false;
    const focus = doorLink?.notificationId ?? (rowLink as string);
    if (this.changed(this.focus, focus)) this.focus = focus;
    if (this.changed(this.door, !!doorLink)) this.door = !!doorLink;
    this.pending = true;
    this.keepOnce = true;
    return true;
  }

  /** A pending deep link meets a known session: true when the center should open now (a signed-in session or the demo). */
  takePending(mode: SessionMode): boolean {
    if (!this.pending || mode === 'loading') return false;
    this.pending = false;
    return mode === 'api' || mode === 'demo';
  }

  /** The center opens (the shell has handed the user menu's overlay entry over to it). */
  show(): void {
    if (this.changed(this.isOpen, true)) this.isOpen = true;
  }

  /** The center closes by itself (✕, Esc): its focus and confirmation are forgotten. False when it was not open (nothing to undo). */
  hide(): boolean {
    if (!this.isOpen) return false;
    this.isOpen = false;
    this.host.requestUpdate();
    if (this.changed(this.focus, '')) this.focus = '';
    if (this.changed(this.door, false)) this.door = false;
    return true;
  }

  /** Another overlay or a navigation takes over (a menu item, Back): the center closes, its focus stays as it was. */
  dismiss(): void {
    if (this.changed(this.isOpen, false)) this.isOpen = false;
  }

  /** A navigation that is not the program's own address move: the center closes, unless a deep link has just opened it. */
  routeChanged(): void {
    if (this.keepOnce) this.keepOnce = false;
    else this.dismiss();
  }

  private setAlerts(n: number | null): void {
    if (this.changed(this.alerts, n)) this.alerts = n;
  }

  /** Lit's `@state()` rule: a render is requested only when the value really changed (`Object.is`). */
  private changed<T>(before: T, after: T): boolean {
    if (Object.is(before, after)) return false;
    this.host.requestUpdate();
    return true;
  }
}
