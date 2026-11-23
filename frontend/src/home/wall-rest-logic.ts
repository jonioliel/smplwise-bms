// HOME-WALL-NIGHT-2500 (owner 22.11, Q70 / Q71 / Q73 / Q74 = the recommendation): the wall panel's rest screen, night mode and screen
// takeover as pure logic - no DOM, no globals. The clock and the timers are injected (map/kiosk-idle.ts `IdleScheduler`), so a unit test
// drives every rule with a fake clock and the home interface drives the real one.
//
// - Rest (Q70): on by default; after `rest_after_min` minutes without a touch the panel shows the rest screen (the hour, the weather, what
//   is on today, the doors and the alarm). The first touch only wakes it - it never reaches a control underneath.
// - Night (Q71 / Q73): fixed local hours (23:00-06:00 by default, editable; a window may cross midnight; start == end = no window). At
//   night the screen is ONLY dimmed - a dark layer the page draws over itself, which works on every tablet; no brightness or backlight API.
//   An idle panel at night takes the chosen dim; a panel someone is using at night keeps a lighter dim so it does not dazzle.
// - Takeover (Q74): the alarm and an urgent notice take the whole screen over and wake the panel (rest and night dim step aside). A door
//   call always comes first: while it rings, no takeover is drawn over it. `call_only` keeps the 2.47 behaviour (only the door call).
import { KioskIdle, type IdlePhase, type IdleScheduler } from '../map/kiosk-idle';

export type NightDim = 'soft' | 'medium' | 'strong';
export type Takeover = 'alarm_urgent' | 'alarm' | 'call_only';

/** The policy's `wall` block (wire HomeWallSettings), normalised. */
export interface WallSettings {
  rest: boolean;
  restAfterMin: number;
  night: boolean;
  /** minutes after local midnight */
  nightStart: number;
  nightEnd: number;
  nightDim: NightDim;
  takeover: Takeover;
}

/** The installation defaults (services/home_interface.INSTALL_VALUES / INSTALL_TIMES): what a server older than 2.50 implies. */
export const WALL_DEFAULTS: WallSettings = { rest: true, restAfterMin: 2, night: true, nightStart: 23 * 60, nightEnd: 6 * 60, nightDim: 'medium', takeover: 'alarm_urgent' };

const HM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "HH:MM" -> minutes after midnight; null when it is not a 24-hour time. */
export function parseHm(v: unknown): number | null {
  const m = typeof v === 'string' ? HM.exec(v) : null;
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Minutes after midnight -> "HH:MM". */
export function fmtHm(mins: number): string {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The policy's `wall` block, whatever arrived: a missing or unknown value takes the installation default. */
export function wallSettings(raw: unknown): WallSettings {
  const w = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const after = Number(w.rest_after_min);
  return {
    rest: typeof w.rest === 'boolean' ? w.rest : WALL_DEFAULTS.rest,
    restAfterMin: Number.isFinite(after) && after > 0 ? after : WALL_DEFAULTS.restAfterMin,
    night: typeof w.night === 'boolean' ? w.night : WALL_DEFAULTS.night,
    nightStart: parseHm(w.night_start) ?? WALL_DEFAULTS.nightStart,
    nightEnd: parseHm(w.night_end) ?? WALL_DEFAULTS.nightEnd,
    nightDim: w.night_dim === 'soft' || w.night_dim === 'strong' || w.night_dim === 'medium' ? w.night_dim : WALL_DEFAULTS.nightDim,
    takeover: w.takeover === 'alarm' || w.takeover === 'call_only' || w.takeover === 'alarm_urgent' ? w.takeover : WALL_DEFAULTS.takeover,
  };
}

/** Is the local minute `mins` inside [start, end)? A window that crosses midnight (23:00-06:00) wraps; start == end is no window. */
export function inWindow(mins: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end ? mins >= start && mins < end : mins >= start || mins < end;
}

const ZONE = 'Asia/Jerusalem';
const PARTS = new Map<string, Intl.DateTimeFormat>();

/** The local wall-clock minute of an instant in the installation's zone (by IANA zone, never a fixed offset - AGENTS.md). */
export function localMinutes(at: number, zone = ZONE): number {
  let f = PARTS.get(zone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
    PARTS.set(zone, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(at)).map((x) => [x.type, x.value]));
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Night now, by the settings (off = never night). */
export function isNight(s: WallSettings, at: number, zone = ZONE): boolean {
  return s.night && inWindow(localMinutes(at, zone), s.nightStart, s.nightEnd);
}

/** The dark layer's opacity (0 = none): the chosen dim on an idle panel at night, a lighter one while someone uses it at night. */
const DIM: Record<NightDim, number> = { soft: 0.5, medium: 0.68, strong: 0.82 };
export function dimOpacity(s: WallSettings, night: boolean, phase: IdlePhase, woken: boolean): number {
  if (!night || woken) return 0;
  const idle = DIM[s.nightDim];
  return phase === 'idle' ? idle : Math.round(idle * 0.4 * 100) / 100;
}

// ---------------------------------------------------------------- takeover

/** The alarm panels as the home interface holds them (api/alarm AlarmPanel, the fields used here). */
export interface PanelLike { entity_id: string; name: string; state: string | null; available: boolean; last_changed: string | null; open_sensors?: string[] }
/** The notices as the home interface reads them (home-p2-api Notice, the fields used here). */
export interface NoticeLike { id: string; title: string; body: string; severity: string; read?: boolean; published_at: string | null; starts_at: string | null; ends_at: string | null }

export type TakeoverItem =
  | { kind: 'alarm'; key: string; panel: PanelLike }
  | { kind: 'notice'; key: string; notice: NoticeLike };

/** An alarm state that takes the screen over: sounding, or the entry delay (someone must enter the code now). */
export const ALARM_TAKEOVER = new Set(['triggered', 'pending']);
/** The board's urgent severities (notices/model.ts counts `critical` as urgent; the home board also knows `urgent`). */
export const URGENT = new Set(['critical', 'urgent']);
/** An urgent notice takes the screen over only while it is new: published within the last 48 hours (owner Q72's "new" window). */
export const URGENT_FRESH_MS = 48 * 3600_000;

/** What takes the screen over now, if anything: the alarm first, then the newest fresh urgent notice not yet seen on this panel. */
export function takeoverFor(mode: Takeover, panels: readonly PanelLike[], notices: readonly NoticeLike[], seen: ReadonlySet<string>, now: number): TakeoverItem | null {
  if (mode === 'call_only') return null;
  for (const p of panels) {
    if (!p.available || !ALARM_TAKEOVER.has(p.state ?? '')) continue;
    const key = `alarm:${p.entity_id}:${p.state}:${p.last_changed ?? ''}`;
    if (!seen.has(key)) return { kind: 'alarm', key, panel: p };
  }
  if (mode !== 'alarm_urgent') return null;
  const fresh = notices
    .filter((n) => URGENT.has(n.severity))
    .map((n) => ({ n, at: Date.parse(n.published_at ?? n.starts_at ?? '') }))
    .filter(({ n, at }) => Number.isFinite(at) && at <= now + 60_000 && now - at < URGENT_FRESH_MS && !(n.ends_at && Date.parse(n.ends_at) <= now) && !seen.has(`notice:${n.id}`))
    .sort((a, b) => b.at - a.at);
  return fresh.length ? { kind: 'notice', key: `notice:${fresh[0].n.id}`, notice: fresh[0].n } : null;
}

// ---------------------------------------------------------------- the panel's state machine

export interface WallState {
  /** the rest screen is drawn */
  rest: boolean;
  /** the dark layer's opacity (0 = none) */
  dim: number;
  /** night by the settings */
  night: boolean;
  /** the idle machine's phase */
  phase: IdlePhase;
  /** a takeover or a door call holds the panel awake */
  woken: boolean;
}

/**
 * One wall panel: the idle machine (KioskIdle, never woken by a device change - an automation switching a light must not light up the
 * wall) plus the holds that keep it awake (a takeover on screen, a ringing door call). `state(at)` is what to draw at that instant.
 */
export class WallRest {
  private idle: KioskIdle;
  private s: WallSettings;
  private woken = new Set<string>();

  constructor(settings: WallSettings, private readonly onChange: () => void, private readonly sched?: IdleScheduler) {
    this.s = settings;
    this.idle = this.make();
  }

  private make(): KioskIdle {
    return new KioskIdle({ idleS: this.s.restAfterMin * 60, wakeOnChange: false, scheduler: this.sched, onChange: () => this.onChange() });
  }

  get settings(): WallSettings {
    return this.s;
  }

  /** New settings (a policy reload): a changed rest time restarts the count from now, awake. */
  configure(next: WallSettings): void {
    const same = next.restAfterMin === this.s.restAfterMin;
    this.s = next;
    if (!same) this.idle.setIdleS(next.restAfterMin * 60);
    this.onChange();
  }

  /** A touch, a key, a scroll: wake and count again. */
  input(): void {
    this.idle.input();
  }

  /** Keep the panel awake while `reason` holds (a takeover on screen, a ringing call); released, the rest time counts again. */
  hold(reason: string, on: boolean): void {
    const had = this.woken.has(reason);
    if (on === had) return;
    if (on) this.woken.add(reason);
    else this.woken.delete(reason);
    this.idle.hold(reason, on);
    this.onChange();
  }

  /** The page is shown again (a tab, a screen that slept): counts as a person. */
  visible(on: boolean): void {
    this.idle.setVisible(on);
  }

  state(at: number): WallState {
    const night = isNight(this.s, at);
    const phase = this.idle.phase;
    const woken = this.woken.size > 0;
    return { rest: this.s.rest && phase === 'idle' && !woken, dim: dimOpacity(this.s, night, phase, woken), night, phase, woken };
  }

  dispose(): void {
    this.idle.dispose();
  }
}
