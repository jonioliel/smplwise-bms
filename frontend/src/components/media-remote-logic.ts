/**
 * CR-015 S3: the remote's rules as pure functions and small classes - no DOM, no Lit, no network (the unit specs load this in
 * node; `media-remote.ts` and the area card / home widget use it). Everything that decides WHAT may be sent, HOW OFTEN and
 * WHAT COUNTS AS CONFIRMED lives here, on top of the client's own helpers (`commandOffered`, `remoteSections`, `KeyThrottle`).
 *
 * The safety rules this file carries (CR-015 §5.3-§5.4, §12):
 *  - power only through power_on / power_off (there is no key for it anywhere; see media-remote-keys.ts);
 *  - opening a remote sends nothing - `openSends()` is the documented "no command on open" contract the specs assert;
 *  - keys, volume steps, mute and transport go through ONE token bucket (`CommandGate`, the client's `KeyThrottle`); a press
 *    over it is dropped, never queued and never retried;
 *  - hold-to-repeat only for arrows and volume, 200 ms interval, stops on release, capped at 10 s (`HoldRepeater`);
 *  - one power command in flight per screen; text at most once a second;
 *  - a command the server accepted shows as pending until the screen's state confirms it; after 8 s it is "not confirmed"
 *    and the UI is back on the last confirmed state (`expectation` decides what confirms which command).
 */
import {
  CONFIRM_TIMEOUT_MS, HOLD_MAX_MS, HOLD_REPEAT_MS, KeyThrottle, TEXT_MAX, commandOffered, remoteSections,
  type AudioTarget, type KeyId, type MediaCommand, type MediaDevice, type MediaDeviceDetail, type MediaLive, type RemoteSection, type SourceItem,
} from '../api/media-screens';

// ------------------------------------------------------------------------------------------------ mode of the remote

/** What the remote shows for a screen: the full pad (`on`), the big power button over a dimmed pad (`off`), art mode (power
 * off / switch to viewing only), or nothing but "לא זמין" (`unavailable`: unavailable or unknown). */
export type RemoteMode = 'on' | 'off' | 'art' | 'unavailable';

export function remoteMode(d: Pick<MediaDevice, 'live'>): RemoteMode {
  switch (d.live.power) {
    case 'on': return 'on';
    case 'art': return 'art';
    case 'off': case 'standby': return 'off';
    default: return 'unavailable'; // unavailable, unknown
  }
}

/** The remote is view-only for a caller without control or power on this screen: state visible, controls absent. */
export const viewOnly = (d: Pick<MediaDevice, 'can'>): boolean => !d.can.control && !d.can.power;

/** The big button of the off state: what it does, whether it is enabled and why not (tooltip only). */
export interface PowerOffer {
  /** `on` = power_on, `off` = power_off, `none` = nothing to offer. */
  action: 'on' | 'off' | 'none';
  enabled: boolean;
  /** `no_remote_wake` / `unavailable` / `forbidden` - the reason a disabled power-on stays disabled (a tooltip, never text). */
  reason: string | null;
}

export function powerOffer(d: Pick<MediaDevice, 'live' | 'caps' | 'can' | 'public'>): PowerOffer {
  if (!d.can.power) return { action: 'none', enabled: false, reason: 'forbidden' };
  const mode = remoteMode(d);
  if (mode === 'unavailable') return { action: 'none', enabled: false, reason: 'unavailable' };
  if (mode === 'on' || mode === 'art') return { action: 'off', enabled: commandOffered(d, { command: 'power_off' }), reason: null };
  const ok = commandOffered(d, { command: 'power_on' });
  return { action: 'on', enabled: ok, reason: ok ? null : d.caps.power_on_reason ?? 'no_remote_wake' };
}

/** Art mode's second button "מעבר לצפייה": a power-on that leaves the art mode; offered when the screen can power on at all. */
export const artSwitchOffered = (d: Pick<MediaDevice, 'live' | 'caps' | 'can' | 'public'>): boolean => d.live.power === 'art' && d.can.power && d.caps.power_on;

/** The contract of opening: a remote that has just been opened sends NOTHING (never a power-on, never a probe key). */
export const openSends = (): MediaCommand[] => [];

// ------------------------------------------------------------------------------------------------ what is drawn

/** The tabs of the remote body: the pad always, sources and apps only when the screen has any to offer. */
export type RemoteTab = 'pad' | 'sources' | 'apps';
export function remoteTabs(d: Pick<MediaDeviceDetail, 'caps' | 'sources' | 'apps' | 'can'>): RemoteTab[] {
  const out: RemoteTab[] = ['pad'];
  if (d.caps.sources && d.sources.length && d.can.power) out.push('sources');
  if (d.caps.apps && d.apps.length && d.can.power) out.push('apps');
  return out;
}

/** The "אחרונים" chips: the last three confirmed picks (the server keeps six). */
export function recentChips(d: Pick<MediaDeviceDetail, 'recent' | 'caps' | 'can'>): MediaDeviceDetail['recent'] {
  if (!d.can.power || !(d.caps.sources || d.caps.apps)) return [];
  return d.recent.slice(0, 3);
}

/** Which keys of a section the screen really has (a section with none is not drawn at all). */
export function has(d: Pick<MediaDevice, 'caps'>, ...keys: KeyId[]): boolean {
  return keys.some((k) => d.caps.keys.includes(k));
}

/** Everything the remote draws when on, split the way `remoteSections` splits it (the client's own rule). */
export function layoutOf(d: Pick<MediaDeviceDetail, 'caps' | 'remote' | 'recent' | 'can'>): { main: RemoteSection[]; more: RemoteSection[] } {
  // view-only: no sections at all (the state is shown by the now-playing card). Power without control: only the recent picks
  // (keys, volume, transport and text are all `media.control`).
  if (!d.can.control) return { main: d.can.power && remoteSections(d).main.includes('recent') ? ['recent'] : [], more: [] };
  const s = remoteSections(d);
  const keep = (x: RemoteSection) => !(x === 'recent' && !d.can.power);
  // the d-pad and the touchpad are alternatives: the touchpad replaces the arrows only when it is on AND the arrows are off
  const touchOnly = s.main.includes('touch') && !s.main.includes('dpad') && !s.more.includes('dpad');
  return { main: s.main.filter(keep).filter((x) => x !== 'touch' || touchOnly), more: s.more.filter(keep) };
}

/** Whether the pad offers both the arrows and the touchpad (the "חצים / משטח" switch is drawn only then). */
export function padModes(d: Pick<MediaDeviceDetail, 'caps' | 'remote'>): { dpad: boolean; touch: boolean } {
  const on = (id: RemoteSection) => d.remote.sections.some((s) => s.id === id && s.on);
  const arrows = ['up', 'down', 'left', 'right', 'ok'].some((k) => d.caps.keys.includes(k as KeyId));
  return { dpad: on('dpad') && arrows, touch: on('touch') && d.caps.touchpad && arrows };
}

/** The volume a screen shows: the linked receiver's when the audio target says so (live.volume follows the target). */
export function volumeTarget(d: Pick<MediaDevice, 'live' | 'audio_link'>, choice: AudioTarget | null): AudioTarget {
  if (!d.audio_link) return 'screen';
  return choice ?? d.live.volume.target ?? d.audio_link.default;
}

/** Whether a source / app item is the one showing now. */
export function isCurrent(live: MediaLive, item: Pick<SourceItem, 'id' | 'kind'>): boolean {
  return item.kind === 'app' ? live.now.app_id === item.id : live.now.source_id === item.id;
}

// ------------------------------------------------------------------------------------------------ keys

/** Arrows and volume may repeat while held (nothing else: a held Home or OK would be a mistake). */
export const REPEATABLE: readonly KeyId[] = ['up', 'down', 'left', 'right', 'volup', 'voldown'];
export const isRepeatable = (k: KeyId): boolean => REPEATABLE.includes(k);

/** The desktop keyboard's map (only while the remote has focus and nobody is typing in a field). */
export const KEYBOARD: Record<string, KeyId> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', Enter: 'ok', Backspace: 'back',
  '+': 'volup', '=': 'volup', '-': 'voldown', _: 'voldown', m: 'mute', M: 'mute',
  PageUp: 'chup', PageDown: 'chdown',
};

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
  /** The element the key was pressed on (or its tag and editability). */
  target?: { tagName?: string; isContentEditable?: boolean; type?: string } | null;
}

/**
 * The remote key a keyboard event stands for, or null. Escape is NOT mapped here: it closes the drawer (sw-drawer handles
 * it) and is never an "exit" key press. A key is ignored while typing in a field, with a modifier, and Enter / Space on a
 * focused button are left to the button itself (its click sends the key once).
 */
export function keyFromEvent(e: KeyEventLike): KeyId | null {
  if (e.ctrlKey || e.altKey || e.metaKey) return null;
  const tag = (e.target?.tagName ?? '').toUpperCase();
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) return null;
  if (e.key === 'Escape') return null;
  if ((e.key === 'Enter' || e.key === ' ') && tag === 'BUTTON') return null;
  const k = KEYBOARD[e.key];
  return k ?? null;
}

// ------------------------------------------------------------------------------------------------ hold to repeat

export interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (h: unknown) => void;
  now: () => number;
}

export const REAL_TIMERS: Timers = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (h) => globalThis.clearTimeout(h as number),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (h) => globalThis.clearInterval(h as number),
  now: () => Date.now(),
};

/**
 * Press-and-hold: fires once at `start()`, then - after a short hold delay - every 200 ms until `stop()` (pointer up, key up,
 * leave, blur) or until 10 s have passed. One instance repeats one control; starting it again restarts it.
 */
export class HoldRepeater {
  private timer: unknown = null;
  private startedAt = 0;
  private running = false;
  constructor(
    private readonly fire: () => void,
    private readonly timers: Timers = REAL_TIMERS,
    readonly intervalMs = HOLD_REPEAT_MS,
    readonly maxMs = HOLD_MAX_MS,
    readonly holdDelayMs = 400,
  ) {}

  get active(): boolean {
    return this.running;
  }

  start(): void {
    this.stop();
    this.running = true;
    this.startedAt = this.timers.now();
    this.fire();
    this.timer = this.timers.setTimeout(() => {
      if (!this.running) return;
      this.timer = this.timers.setInterval(() => {
        if (!this.running) return;
        if (this.timers.now() - this.startedAt >= this.maxMs) {
          this.stop();
          return;
        }
        this.fire();
      }, this.intervalMs);
    }, this.holdDelayMs);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      this.timers.clearTimeout(this.timer);
      this.timers.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

// ------------------------------------------------------------------------------------------------ the gate

/** Why a press was not sent. `not_offered` = the screen does not offer it (caps / state / permission); `dropped` = over the
 * key rate (a short shake, no text); `busy` = a power command of this screen is still in flight; `cooldown` = text within 1 s. */
export type GateVerdict = 'send' | 'not_offered' | 'dropped' | 'busy' | 'cooldown';

const KEYLIKE: readonly MediaCommand['command'][] = ['key', 'volume_step', 'mute', 'transport'];
export const isKeyLike = (c: MediaCommand): boolean => KEYLIKE.includes(c.command);

/**
 * The one checkpoint every press of the remote passes before `sendCommand`: offered at all (`commandOffered`: the same rule
 * the server re-checks), key-like presses through the token bucket (5/s, burst 8), one power command in flight, text once a
 * second. Nothing here queues: the answer is `send` or a reason, and the caller drops the press.
 */
export class CommandGate {
  private readonly keys = new KeyThrottle();
  private powerBusy = false;
  private lastText = 0;
  private lastPower = 0;

  check(d: Pick<MediaDevice, 'live' | 'caps' | 'can' | 'public'>, c: MediaCommand, now: number = Date.now()): GateVerdict {
    if (!commandOffered(d, c)) return 'not_offered';
    if (c.command === 'power_on' || c.command === 'power_off') {
      if (this.powerBusy || now - this.lastPower < 2000) return 'busy';
      this.powerBusy = true;
      this.lastPower = now;
      return 'send';
    }
    if (c.command === 'text') {
      if (now - this.lastText < 1000) return 'cooldown';
      this.lastText = now;
      return 'send';
    }
    if (isKeyLike(c) && !this.keys.take(now)) return 'dropped';
    return 'send';
  }

  /** The power command finished (confirmed, refused or timed out): the next one may go (after the 2 s minimum). */
  powerDone(): void {
    this.powerBusy = false;
  }
}

// ------------------------------------------------------------------------------------------------ confirmation

/** `null` = the effect is not observable (keys, steps, text): the press is "sent", never "confirmed". Otherwise the
 * predicate the screen's live state must satisfy; it is evaluated against fresh `live` until true or `CONFIRM_TIMEOUT_MS`. */
export type Expectation = ((live: MediaLive) => boolean) | null;

export function expectation(c: MediaCommand, before: MediaLive): Expectation {
  switch (c.command) {
    case 'power_on': return (l) => l.power === 'on';
    case 'power_off': return (l) => l.power === 'off' || l.power === 'standby' || l.power === 'art';
    case 'volume_set': return (l) => l.volume.level !== null && Math.abs(l.volume.level - Math.round(c.level)) <= 1;
    case 'mute': return (l) => l.volume.muted === c.muted;
    case 'source': return (l) => l.now.source_id === c.source_id;
    case 'app': return (l) => l.now.app_id === c.app_id;
    case 'sound_output': return (l) => l.sound_output === c.output;
    case 'transport':
      if (c.action === 'play') return (l) => l.play === 'playing';
      if (c.action === 'pause') return (l) => l.play === 'paused';
      if (c.action === 'stop') return (l) => l.play === 'idle' || l.play === null || l.power !== 'on';
      if (c.action === 'play_pause') {
        const was = before.play;
        return (l) => l.play !== was;
      }
      return null; // next / previous: nothing observable that is reliable
    default: return null; // key, volume_step, text
  }
}

/** What the UI shows for one command over its life. */
export type Progress = 'idle' | 'pending' | 'confirmed' | 'not_confirmed' | 'sent' | 'refused';

export { CONFIRM_TIMEOUT_MS };

// ------------------------------------------------------------------------------------------------ small formatters

/** "25:20" / "1:05:20" - durations in the now-playing card (rendered left-to-right by the component). */
export function mmss(total: number | null | undefined): string {
  if (total === null || total === undefined || !Number.isFinite(total)) return '';
  const s = Math.max(0, Math.round(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  return `${h ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(x).padStart(2, '0')}`;
}

/** The playback position now: the reported position advanced by the time since it was reported while playing, clamped to the duration. */
export function positionNow(live: Pick<MediaLive, 'play' | 'now'>, nowMs: number): number | null {
  const n = live.now;
  if (n.position_s === null || n.position_s === undefined) return null;
  let p = n.position_s;
  if (live.play === 'playing' && n.position_at) {
    const t = Date.parse(n.position_at);
    if (Number.isFinite(t)) p += Math.max(0, (nowMs - t) / 1000);
  }
  if (n.duration_s !== null && n.duration_s !== undefined && n.duration_s > 0) p = Math.min(p, n.duration_s);
  return p;
}

/** The unavailable state's only lines: "המסך לא זמין" and "מאז 14:20" (`since` is the time alone, in the browser's zone; '' = unknown). */
export function unavailableLine(live: Pick<MediaLive, 'power' | 'since'>): { title: string; since: string } {
  const title = live.power === 'unknown' ? 'מצב לא ידוע' : 'המסך לא זמין';
  if (!live.since) return { title, since: '' };
  const t = new Date(live.since);
  if (Number.isNaN(t.getTime())) return { title, since: '' };
  const hhmm = new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(t);
  return { title, since: hhmm };
}

// ------------------------------------------------------------------------------------------------ text and digits

/** Text for the typing field: control characters removed, at most `TEXT_MAX` characters (the server enforces the same). */
export function cleanText(v: string): string {
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, TEXT_MAX);
}

/** The channel digits typed so far (at most three; the newest last) - a display of the keys already sent. */
export function pushDigit(buf: string, digit: string): string {
  return /^[0-9]$/.test(digit) ? (buf + digit).slice(-3) : buf;
}
/** `n7` -> "7". */
export const digitOf = (k: KeyId): string => (/^n[0-9]$/.test(k) ? k.slice(1) : '');

// ------------------------------------------------------------------------------------------------ sections for the editor

/** The remote configuration with one section switched or moved - the editor's primitives (immutable). */
export function toggleSection(cfg: MediaDeviceDetail['remote'], id: RemoteSection, on: boolean): MediaDeviceDetail['remote'] {
  return { ...cfg, sections: cfg.sections.map((s) => (s.id === id ? { ...s, on } : s)) };
}
export function moveSection(cfg: MediaDeviceDetail['remote'], id: RemoteSection, to: number): MediaDeviceDetail['remote'] {
  const from = cfg.sections.findIndex((s) => s.id === id);
  if (from < 0) return cfg;
  const sections = [...cfg.sections];
  const [item] = sections.splice(from, 1);
  sections.splice(Math.max(0, Math.min(sections.length, to)), 0, item);
  return { ...cfg, sections };
}
/** Behind "עוד מקשים" or not (`more` is a subset of the sections). */
export function setMore(cfg: MediaDeviceDetail['remote'], id: RemoteSection, more: boolean): MediaDeviceDetail['remote'] {
  const rest = cfg.more.filter((x) => x !== id);
  return { ...cfg, more: more ? [...rest, id] : rest };
}
