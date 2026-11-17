/**
 * CR-FE-NITS-2442 (code review 06:RESIZE-1): many calls, one run per animation frame.
 *
 * A window `resize` listener that asks for a render or reads the layout did so once per raw event. `schedule` is the listener:
 * the first call of a frame books one animation frame, the calls after it are dropped, and the work runs once when the frame
 * comes. `cancel()` (the host's disconnectedCallback) drops a booked frame, so nothing runs on an element that left the page.
 *
 * The frame source is injected (default: the window's), so the rule is tested in node with a fake one.
 */
export interface FrameEnv {
  request(run: () => void): number;
  cancel(handle: number): void;
}

const windowFrames: FrameEnv = {
  request: (run) => window.requestAnimationFrame(run),
  cancel: (handle) => window.cancelAnimationFrame(handle),
};

export class FrameCoalescer {
  private handle: number | null = null;

  constructor(
    private readonly run: () => void,
    private readonly env: FrameEnv = windowFrames,
  ) {}

  /** True while a frame is booked. */
  get pending(): boolean {
    return this.handle !== null;
  }

  /** Books the run for the next frame; a call while one is booked does nothing. An arrow, so it is the event listener itself. */
  readonly schedule = (): void => {
    if (this.handle !== null) return;
    this.handle = this.env.request(() => {
      this.handle = null;
      this.run();
    });
  };

  /** Drops the booked frame, if any; `schedule` works again afterwards. */
  cancel(): void {
    if (this.handle === null) return;
    this.env.cancel(this.handle);
    this.handle = null;
  }
}
