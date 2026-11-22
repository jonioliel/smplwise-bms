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
 *
 * CR-CMP2-SELECTS-2450 (the last 7 copies):
 *  - `exitMs`: a toast that fades out keeps its text for `exitMs` after its time ran out, with `leaving` true, so the screen's
 *    exit transition plays before the element goes (calendars/view-calendar.ts);
 *  - `onExpire`: called when a message's time ran out on its own (not on `clear()`, a replacement or a disconnect) - for an
 *    element whose parent owns the message (screens/nvr-undo-toast.ts tells its screen `dismiss`);
 *  - `ToastStackController` (below): several messages at once, each with its own clock (screens/access-external.ts).
 */

interface ToastOptions<Tone extends string = string> {
  /** The message's tone - whatever the screen's CSS names ('ok', 'err', 'warn', ...). Default: the controller's `tone` option, else ''. */
  tone?: Tone | '';
  /** How long the message stays, in ms. Default: the controller's `ms`. 0 or Infinity: until cleared or replaced. */
  ms?: number;
}

export interface ToastTimers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}

interface ToastControllerOptions<Tone extends string = string> {
  /** The default duration (ms). Default 2500 - the most common value among the private copies. */
  ms?: number;
  /** The default tone. Default ''. */
  tone?: Tone | '';
  /** Called after every change with the new text ('' when the message went away) - for a host that mirrors it elsewhere. */
  onChange?: (text: string, tone: Tone | '') => void;
  /** Called when a message's time ran out on its own (after the exit phase, when there is one). */
  onExpire?: () => void;
  /** The exit phase (ms): after its time a message stays this long with `leaving` true, then goes. Default 0 (none). */
  exitMs?: number;
  /** Tests: a fake clock. */
  timers?: ToastTimers;
}

export const TOAST_DEFAULT_MS = 2500;

export class ToastController<Tone extends string = string> implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly defaultMs: number;
  private readonly defaultTone: Tone | '';
  private readonly onChange?: (text: string, tone: Tone | '') => void;
  private readonly onExpire?: () => void;
  private readonly exitMs: number;
  private readonly timers: ToastTimers;
  private timer: unknown = null;
  private _text = '';
  private _tone: Tone | '' = '';
  private _leaving = false;

  constructor(host: ReactiveControllerHost, options: ToastControllerOptions<Tone> = {}) {
    this.host = host;
    this.defaultMs = options.ms ?? TOAST_DEFAULT_MS;
    this.defaultTone = options.tone ?? '';
    this.onChange = options.onChange;
    this.onExpire = options.onExpire;
    this.exitMs = Math.max(0, options.exitMs ?? 0);
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

  /** The message's time ran out and it is in its exit phase (`exitMs`); the text is still there for the fade. */
  get leaving(): boolean {
    return this._leaving;
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
        if (this.exitMs > 0) {
          this._leaving = true;
          this.host.requestUpdate();
          this.timer = this.timers.setTimeout(() => {
            this.timer = null;
            this.expire();
          }, this.exitMs);
          return;
        }
        this.expire();
      }, ms);
    }
  }

  private expire(): void {
    this.set('', '');
    this.onExpire?.();
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
    this._leaving = false;
    if (had) this.onChange?.('', '');
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private set(text: string, tone: Tone | ''): void {
    const wasLeaving = this._leaving;
    this._leaving = false;
    if (text === this._text && tone === this._tone) {
      if (wasLeaving) this.host.requestUpdate(); // the same message again during its fade: it comes back
      return;
    }
    this._text = text;
    this._tone = tone;
    this.host.requestUpdate();
    this.onChange?.(text, tone);
  }
}

interface StackedToast<Tone extends string = string> {
  /** A new number per message (a stable `repeat` key). */
  readonly id: number;
  readonly text: string;
  readonly tone: Tone | '';
}

/**
 * CR-CMP2-SELECTS-2450 (07:F12, the stacked copy): several flash messages on show at once, each with ITS OWN clock - a second message
 * neither cuts the first one short nor replaces it. The rules of `ToastController` otherwise: the host is asked to update on every
 * change, `ms: 0` / Infinity keeps a message until it is removed, and on disconnect every timer stops and the stack empties.
 *
 *     private toasts = new ToastStackController(this, { ms: 3200 });
 *     this.toasts.push('נשמר');
 *     ${this.toasts.items.map((t) => html`<div class="toast">${t.text}</div>`)}
 */
export class ToastStackController<Tone extends string = string> implements ReactiveController {
  private readonly host: ReactiveControllerHost;
  private readonly defaultMs: number;
  private readonly defaultTone: Tone | '';
  private readonly timers: ToastTimers;
  private readonly clocks = new Map<number, unknown>();
  private seq = 0;
  private _items: readonly StackedToast<Tone>[] = [];

  constructor(host: ReactiveControllerHost, options: Pick<ToastControllerOptions<Tone>, 'ms' | 'tone' | 'timers'> = {}) {
    this.host = host;
    this.defaultMs = options.ms ?? TOAST_DEFAULT_MS;
    this.defaultTone = options.tone ?? '';
    this.timers = options.timers ?? {
      setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
      clearTimeout: (h) => globalThis.clearTimeout(h as ReturnType<typeof globalThis.setTimeout>),
    };
    host.addController(this);
  }

  /** The messages on show, oldest first (a new array on every change). */
  get items(): readonly StackedToast<Tone>[] {
    return this._items;
  }

  /** Add `text` to the stack for `ms`; returns its id ('' adds nothing and returns 0). */
  push(text: string, options: ToastOptions<Tone> = {}): number {
    if (!text) return 0;
    const id = ++this.seq;
    this._items = [...this._items, { id, text, tone: options.tone ?? this.defaultTone }];
    this.host.requestUpdate();
    const ms = options.ms ?? this.defaultMs;
    if (ms > 0 && Number.isFinite(ms)) {
      this.clocks.set(
        id,
        this.timers.setTimeout(() => {
          this.clocks.delete(id);
          this.remove(id);
        }, ms),
      );
    }
    return id;
  }

  /** Drop one message now. */
  remove(id: number): void {
    const clock = this.clocks.get(id);
    if (clock !== undefined) {
      this.timers.clearTimeout(clock);
      this.clocks.delete(id);
    }
    if (!this._items.some((t) => t.id === id)) return;
    this._items = this._items.filter((t) => t.id !== id);
    this.host.requestUpdate();
  }

  /** Drop every message now. */
  clear(): void {
    this.stopClocks();
    if (!this._items.length) return;
    this._items = [];
    this.host.requestUpdate();
  }

  hostDisconnected(): void {
    this.stopClocks();
    this._items = [];
  }

  private stopClocks(): void {
    for (const clock of this.clocks.values()) this.timers.clearTimeout(clock);
    this.clocks.clear();
  }
}
