import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { SessionMode } from '../api/session';

/**
 * CR-SHELL-EXTRACT-B-2450 (owner N5, the follow-up named in CR-SHELL-EXTRACT-2440): the shell's "your permissions were updated"
 * wiring (T055), moved out of shell/sw-app.ts into one controller. Behaviour unchanged; only where it lives:
 *  - the /me/ws access channel is followed once the session is signed in (`api`) or known without a role (`no_access`);
 *  - a permissions change re-reads /me (navigation and gates follow the session), resets the alarm pages' presence, bumps `epoch`
 *    (the shell re-mounts the current screen keyed on it, so it re-fetches what it may still see), shows the notice for 5 s and
 *    tells the page (`sw-permissions-changed`);
 *  - the channel and the notice's timer end with the shell.
 * The shell keeps the notice's markup and style (`renderPermToast`, `.perm-toast`). Every state change asks the host to render only
 * when a value really changed (the `@state()` rule `permEpoch` / `permToast` followed).
 */

/** What the controller calls (shell/sw-app.ts passes the real ones; a unit spec fakes them). */
export interface PermissionsEnv {
  /** api/session.ts watchPermissions: `onChanged` on every `permissions_changed`; returns the stop function. */
  watch(onChanged: () => void): () => void;
  /** api/session.ts loadSession: /me is read again. */
  reload(): Promise<unknown>;
  /** After the re-read, before the screen re-mounts: the alarm pages follow the new permissions (resetAlarmPresence). */
  afterReload(): void;
  /** The notice's text in the interface language. */
  text(): string;
  /** The page is told (`sw-permissions-changed` on window). */
  announce(): void;
  /** window.setTimeout / window.clearTimeout. */
  setTimer(fn: () => void, ms: number): number;
  clearTimer(id: number): void;
}

/** How long the notice stays (ms). */
const PERM_NOTICE_MS = 5000;

export class PermissionsNotice implements ReactiveController {
  private n = 0;
  private shown = '';
  private timer = 0;
  private stop?: () => void;

  constructor(private readonly host: ReactiveControllerHost, private readonly env: PermissionsEnv) {
    host.addController(this);
  }

  hostDisconnected(): void {
    this.stop?.();
    this.stop = undefined;
    this.env.clearTimer(this.timer);
  }

  /** Bumped on every permissions change: the shell keys the current screen on it. */
  get epoch(): number {
    return this.n;
  }

  /** The notice's text ('' = not shown). */
  get text(): string {
    return this.shown;
  }

  /** The session is known: a signed-in user, or one without a role yet, follows the access channel (once). */
  follow(mode: SessionMode): void {
    if ((mode === 'api' || mode === 'no_access') && !this.stop) this.stop = this.env.watch(() => void this.changed());
  }

  /** T055: the server says this user's access changed. */
  private async changed(): Promise<void> {
    await this.env.reload();
    this.env.afterReload();
    this.n += 1;
    this.host.requestUpdate();
    this.setText(this.env.text());
    this.env.clearTimer(this.timer);
    this.timer = this.env.setTimer(() => this.setText(''), PERM_NOTICE_MS);
    this.env.announce();
  }

  private setText(t: string): void {
    if (Object.is(this.shown, t)) return;
    this.shown = t;
    this.host.requestUpdate();
  }
}
