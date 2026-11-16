import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * CR-UI-CONTROLLERS-2440 (review finding 07:F12): THE timer of a screen's flash message ("toast").
 *
 * 39 elements carry a private `flash(text)` that sets a `@state` string and clears it with a bare `setTimeout`. The copies differ in
 * the one thing that matters: some never clear the previous timer (a second message is cut short by the first message's timer), some
 * clear it, some compare the text, and none stops the timer when the element leaves the page. This controller is that logic once:
 *
 *     private toast = new ToastController(this);            // default 2500 ms; { ms: 2600 } keeps a screen's own duration
 *     ...
 *     this.toast.show('נשמר');                              // or show('נכשל', { tone: 'err', ms: 4000 })
 *     ...
 *     ${this.toast.text ? html`<div class="toast ${this.toast.tone}" role="status">${this.toast.text}</div>` : nothing}
 *
 * Only the timer is shared. The screen keeps its own markup, class names and CSS, so adopting it moves no pixel.
 *
 *  - ONE timer: a new `show()` replaces the message and restarts the clock, so every message gets its full time;
 *  - `ms: 0` (or `Infinity`) keeps the message until `clear()` or the next `show()`;
 *  - `show('')` is `clear()`;
 *  - the host is asked to update on every change (`requestUpdate`), so `text` / `tone` need no `@state` of their own;
 *  - on disconnect the timer is stopped and the message dropped: a screen that comes back does not show an old message for ever.
 */

export interface ToastOptions<Tone extends string = string> {
  /** The message's tone - whatever the screen's CSS names ('ok', 'err', 'warn', ...). Default: the controller's `tone` option, else ''. */
  tone?: Tone | '';
  /** How long the message stays, in ms. Default: the controller's `ms`. 0 or Infinity: until cleared or replaced. */
  ms?: number;
}

export interface ToastTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

export interface ToastControllerOptions<Tone extends string = string> {
  /** The default duration (ms). Default 2500 - the most common value among the private copies. */
  ms?: number;
  /** The default tone. Default ''. */
  tone?: Tone | '';
  /** Called after every change with the new text ('' when the message went away) - for a host that mirrors it elsewhere. */
  onChange?: (text: string, tone: Tone | '') => void;
  /** Tests: a fake clock. */
  timers?: ToastTimers;
}

export const TOAST_DEFAULT_MS = 2500;

export class ToastController<Tone extends string = string> implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly defaultMs: number;
  private readonly defaultTone: Tone | '';
  private readonly onChange?: (text: string, tone: Tone | '') => void;
  private readonly timers: ToastTimers;
  private timer: unknown = null;
  private _text = '';
  private _tone: Tone | '' = '';

  constructor(host: ReactiveControllerHost, options: ToastControllerOptions<Tone> = {}) {
    this.host = host;
    this.defaultMs = options.ms ?? TOAST_DEFAULT_MS;
    this.defaultTone = options.tone ?? '';
    this.onChange = options.onChange;
    this.timers = options.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
    };
    host.addController(this);
  }

  /** The message on show ('' = none). */
  get text(): string {
    return this._text;
  }

  /** The tone of the message on show ('' when there is none or it has no tone). */
  get tone(): Tone | '' {
    return this._tone;
  }

  /** A message is on show. */
  get visible(): boolean {
    return this._text !== '';
  }

  /** Show `text` (replacing whatever is on show) for `ms`; the clock always starts again. */
  show(text: string, options: ToastOptions<Tone> = {}): void {
    this.stopTimer();
    if (!text) {
      this.set('', '');
      return;
    }
    this.set(text, options.tone ?? this.defaultTone);
    const ms = options.ms ?? this.defaultMs;
    if (ms > 0 && Number.isFinite(ms)) {
      this.timer = this.timers.setTimeout(() => {
        this.timer = null;
        this.set('', '');
      }, ms);
    }
  }

  /** Drop the message now. */
  clear(): void {
    this.stopTimer();
    this.set('', '');
  }

  hostDisconnected(): void {
    // no update is asked of a host that has left the page; the fields are simply empty when it comes back
    this.stopTimer();
    const had = this._text !== '';
    this._text = '';
    this._tone = '';
    if (had) this.onChange?.('', '');
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private set(text: string, tone: Tone | ''): void {
    if (text === this._text && tone === this._tone) return;
    this._text = text;
    this._tone = tone;
    this.host.requestUpdate();
    this.onChange?.(text, tone);
  }
}
