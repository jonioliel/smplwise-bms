/**
 * CR-028 (CAST1 UI): one shared view of the open cast sessions for the pill, the live screen and the picker. It fetches
 * `GET multimedia/cast/sessions`, refetches on the live-window event `cast_sessions_changed` (the frame carries no id: the server answers
 * with this person's own permissions) and keeps a one-second clock while anything is open, so countdowns tick without a request.
 * The socket and the clock exist only while something listens. A failure keeps the last list (never invents sessions).
 */
import { subscribeHa } from '../api/ha';
import { castSessions, type CastSession } from '../api/cast';
import { canAnywhere, isApi } from '../api/session';
import { isOpen } from '../screens/cast-logic';

type Listener = () => void;

class CastStore {
  sessions: CastSession[] = [];
  max = 2;
  loaded = false;
  now = Date.now();
  private listeners = new Set<Listener>();
  private stopWs: (() => void) | null = null;
  private clock = 0;
  private busy = false;
  private again = false;

  /** Whether this person can see sessions at all (the server decides again). */
  static eligible(): boolean {
    return isApi() && (canAnywhere('media.cast') || canAnywhere('media.read'));
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    if (this.listeners.size === 1) this.attach();
    else fn();
    return () => {
      this.listeners.delete(fn);
      if (!this.listeners.size) this.detach();
    };
  }

  private attach() {
    if (!CastStore.eligible()) return;
    this.stopWs = subscribeHa((m) => {
      if (m.type === 'cast_sessions_changed') void this.refresh();
    });
    void this.refresh();
    this.clock = window.setInterval(() => {
      this.now = Date.now();
      if (this.sessions.some(isOpen)) this.emit();
    }, 1000);
  }

  private detach() {
    this.stopWs?.();
    this.stopWs = null;
    window.clearInterval(this.clock);
    this.clock = 0;
  }

  private emit() {
    for (const l of [...this.listeners]) l();
  }

  /** Refetch; a call during a fetch is coalesced into one more fetch afterwards. */
  async refresh(): Promise<void> {
    if (!CastStore.eligible()) return;
    if (this.busy) {
      this.again = true;
      return;
    }
    this.busy = true;
    try {
      const r = await castSessions();
      this.sessions = r.sessions ?? [];
      this.max = r.max_sessions ?? this.max;
      this.loaded = true;
    } catch {
      /* keep the last list: a hiccup must not make a running cast disappear from the screen */
      this.loaded = true;
    } finally {
      this.busy = false;
      this.now = Date.now();
      this.emit();
      if (this.again) {
        this.again = false;
        void this.refresh();
      }
    }
  }

  /** Put a server answer in without waiting for the event (the action's own result), then refetch to be sure. */
  put(s: CastSession) {
    const i = this.sessions.findIndex((x) => x.session_id === s.session_id);
    if (i >= 0) this.sessions = this.sessions.map((x, j) => (j === i ? s : x));
    else if (isOpen(s)) this.sessions = [...this.sessions, s];
    this.now = Date.now();
    this.emit();
    void this.refresh();
  }

  open(): CastSession[] {
    return this.sessions.filter(isOpen);
  }
}

export const castStore = new CastStore();

/** Lit reactive-controller glue: `new CastWatch(this)` re-renders the host on every store change. */
export class CastWatch {
  private off: (() => void) | null = null;
  constructor(private host: { addController(c: unknown): void; requestUpdate(): void }) {
    host.addController(this);
  }
  hostConnected() {
    this.off = castStore.subscribe(() => this.host.requestUpdate());
  }
  hostDisconnected() {
    this.off?.();
    this.off = null;
  }
  get sessions() {
    return castStore.sessions;
  }
  get open() {
    return castStore.open();
  }
  get now() {
    return castStore.now;
  }
}
