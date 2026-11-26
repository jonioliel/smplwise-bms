// MEDIUM-REST-2540 (deep review SCR-30): when the home interface re-reads its overview after a pushed change.
//
// Before: every `entity_state_changed` of any entity restarted one 600 ms timer. On a site with more than ~2 events a second (power
// meters, motion sensors) the timer never fired - the post-command refresh was cancelled too - and the home kept its optimistic state
// only. And an overview read that started before a toggle replaced the screen with the old state (the tile flipped back, a dimmer jumped
// under the finger); there was no sequence guard either.
// Now:
// - `PushRefresh`: a quiet period with a MAXIMUM wait - a burst of pushes refreshes at most PUSH_MAX_WAIT_MS after its first push;
// - `homeDraws`: only the pushes of what the overview draws ask for a refresh (a power meter does not);
// - `keepLocal`: a device with a command of this person in flight (or sent after the read started) keeps what the screen shows;
// - the caller drops an answer that is not the newest read (sw-home.ts `ovSeq`).
import type { HRoom } from './home-api';

/** The quiet period after the last push (as before). */
export const PUSH_QUIET_MS = 600;
/** The longest a burst of pushes delays the refresh. */
export const PUSH_MAX_WAIT_MS = 2000;

/** The door / window classes the room's "open" count reads (services/devices.py OPENING_CLASSES). */
const OPENING_CLASSES = new Set(['door', 'window', 'opening', 'garage_door']);
/** The domains the overview draws as controls (routers/home_interface.py `overview`) and the weather line. */
const DRAWN_DOMAINS = new Set(['light', 'switch', 'climate', 'cover', 'lock', 'weather']);

/** Does a pushed entity change something the overview shows? Controls, the weather, a room's temperature sensor and a door / window
 * contact (the room's open count). An entity the overview never reads (a power meter, a motion sensor, a media player) does not. */
export function homeDraws(e: { entity_id: string; domain?: string | null; device_class?: string | null } | null | undefined): boolean {
  if (!e?.entity_id) return true; // a push we cannot read: refresh, as before
  const domain = e.domain || e.entity_id.split('.')[0];
  if (DRAWN_DOMAINS.has(domain)) return true;
  if (domain === 'sensor') return e.device_class === 'temperature';
  if (domain === 'binary_sensor') return OPENING_CLASSES.has(e.device_class ?? '');
  return false;
}

interface Timers {
  set: (fn: () => void, ms: number) => number;
  clear: (id: number) => void;
  now: () => number;
}

/** A trailing refresh with a maximum wait: every `poke(ms)` asks for a refresh `ms` from now, but never later than `maxWait` after the
 * first poke of the burst. Never two reads at once: a refresh due while one is still running runs once when it ends (on a busy site a
 * read every two seconds that is slower than that would otherwise be dropped by the newer one, for ever). */
export class PushRefresh {
  private timer = 0;
  private burstAt: number | null = null;
  private running = false;
  private again = false;
  private dead = false;

  constructor(
    private readonly run: () => unknown,
    private readonly maxWait = PUSH_MAX_WAIT_MS,
    private readonly t: Timers = { set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => window.clearTimeout(id), now: () => Date.now() },
  ) {}

  poke(ms = PUSH_QUIET_MS): void {
    this.dead = false;
    const now = this.t.now();
    this.burstAt ??= now;
    const wait = Math.max(0, Math.min(ms, this.burstAt + this.maxWait - now));
    this.t.clear(this.timer);
    this.timer = this.t.set(() => {
      this.timer = 0;
      this.burstAt = null;
      this.fire();
    }, wait);
  }

  private fire(): void {
    if (this.dead) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    void Promise.resolve()
      .then(() => this.run())
      .catch(() => undefined)
      .finally(() => {
        this.running = false;
        if (this.again) {
          this.again = false;
          this.fire();
        }
      });
  }

  cancel(): void {
    this.t.clear(this.timer);
    this.timer = 0;
    this.burstAt = null;
    this.again = false;
    this.dead = true;
  }
}

/** The rooms of a new overview with every device in `ids` kept as the screen shows it (the previous object: a command's own callbacks
 * keep updating it). A device the new answer does not have is not brought back. */
export function keepLocal(prev: readonly HRoom[] | null | undefined, next: HRoom[], ids: ReadonlySet<string>): HRoom[] {
  if (!prev?.length || !ids.size) return next;
  const old = new Map<string, unknown>();
  for (const r of prev) {
    for (const x of r.lights) old.set(`l|${x.id}`, x);
    for (const x of r.loads) old.set(`s|${x.id}`, x);
    for (const x of r.zones) old.set(`z|${x.id}`, x);
    for (const x of r.shades) old.set(`c|${x.id}`, x);
    for (const x of r.doors) old.set(`d|${x.id}`, x);
  }
  const keep = <T extends { id: string }>(kind: string, xs: T[]): T[] => xs.map((x) => (ids.has(x.id) ? ((old.get(`${kind}|${x.id}`) as T | undefined) ?? x) : x));
  return next.map((r) => ({ ...r, lights: keep('l', r.lights), loads: keep('s', r.loads), zones: keep('z', r.zones), shades: keep('c', r.shades), doors: keep('d', r.doors) }));
}
