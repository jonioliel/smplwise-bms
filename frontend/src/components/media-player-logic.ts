/**
 * CR-016 S3: the player panel's rules as pure functions and small classes - no DOM, no Lit, no network (the unit specs load this
 * in node; `media-player-panel.ts`, `media-player-volume.ts`, the area card and the home widget use it). Everything that decides
 * WHAT the panel may offer, HOW OFTEN a control may fire and WHAT COUNTS AS CONFIRMED lives here, on top of the S0 client
 * (`api/media-players.ts`: capability check, group rules, volume plan) which stays the single source of the shared rules.
 *
 * The safety rules this file carries (MEDIA_PLAYERS_API.md, CR-016 §6.4, §10; CR-015 §5.3):
 *  - nothing is offered that `caps` / `can` / `live.caps_known` do not allow (`playerCommandOffered`); with `caps_known` false every
 *    control is greyed, never guessed;
 *  - opening the panel sends nothing (`openSends()`);
 *  - transport / step / mute go through ONE token bucket (the client's `KeyThrottle`); seek, shuffle, repeat, play_item and transfer
 *    have the server's own rate (CR §6.4) mirrored here; a press over a limit is dropped (a short shake, no text, never queued);
 *  - a command the server accepted is pending until the state confirms it, after 8 s "הנגן לא אישר את הפקודה" and the last
 *    confirmed state is back (`playerExpectation`);
 *  - a ceiling is displayed ONLY where an administrator set one (decision 7ב: there is no default): `volumeDisplay`;
 *  - a partial queue is never shown as empty (`upNextView`: unconfirmed is "לא זמין");
 *  - the party rule (4+ rooms / more than one floor) opens the confirmation before anything is sent (`joinPlan`).
 */
import { CONFIRM_TIMEOUT_MS, KeyThrottle, isDead } from '../api/media-screens';
import {
  PARTY_MIN_DEVICES, clampVolume, effectiveCeiling, groupCandidates, groupLevel, groupSectionOffered, groupVolumePlan, interpolatePosition, isMember, isPlaying,
  joinDiff, leaderLabel, liveGroupKeys, needsConfirmation, playerCommandOffered, resolveLeader, upNextMore, upNextText,
  type GroupPreview, type LibraryKind, type MemberOutcome, type PlanMember, type PlayerCommand, type PlayerDevice, type PlayerLive, type ReceiverZone, type UpNext, type VolumeStep,
} from '../api/media-players';

export { CONFIRM_TIMEOUT_MS };
export const NOT_CONFIRMED = 'הנגן לא אישר את הפקודה';
/** The press-and-hold long enough to mean "נגן אחרי הנוכחי" on a library item. */
export const LONG_PRESS_MS = 520;
/** One slider change goes out after this quiet (the volume slider of the TV remote uses the same). */
export const VOLUME_DEBOUNCE_MS = 250;
/** A seek goes out after the thumb rests this long (server rate: 2/s per device). */
export const SEEK_DEBOUNCE_MS = 300;

// ------------------------------------------------------------------------------------------------ mode of the panel

/** What the panel shows: the full body (`on`), the big power button over a dimmed body (`off`), or only "לא זמין" (`unavailable`:
 * unavailable or unknown). An `art` power never occurs on a player, it counts as on. */
export type PanelMode = 'on' | 'off' | 'unavailable';

export function panelMode(d: Pick<PlayerDevice, 'live'>): PanelMode {
  switch (d.live.power) {
    case 'on': case 'art': return 'on';
    case 'off': case 'standby': return 'off';
    default: return 'unavailable';
  }
}

/** View-only (`media.read` only): the state and "הבא בתור", no controls at all. */
export const viewOnly = (d: Pick<PlayerDevice, 'can'>): boolean => !d.can.control && !d.can.power;

/** Controls drawn greyed: the device is shown but no endpoint is available to take a command (`caps_known` false, CR §5.4). */
export const greyed = (d: Pick<PlayerDevice, 'live'>): boolean => !d.live.caps_known;

/** The contract of opening: a panel that has just been opened sends NOTHING (never a power-on, never a probe command). */
export const openSends = (): PlayerCommand[] => [];

const KIND_WORD: Record<string, string> = { speaker: 'הרמקול', receiver: 'המגבר', player: 'הנגן', group: 'הקבוצה' };

/** The unavailable state's only lines: "הרמקול לא זמין" and "מאז 14:20" (`since` is the time alone, in the browser's zone; '' = unknown). */
export function playerUnavailableLine(d: Pick<PlayerDevice, 'live' | 'kind'>): { title: string; since: string } {
  const word = KIND_WORD[d.kind] ?? 'הנגן';
  const title = d.live.power === 'unknown' ? 'מצב לא ידוע' : `${word} לא זמין`;
  if (!d.live.since) return { title, since: '' };
  const t = new Date(d.live.since);
  if (Number.isNaN(t.getTime())) return { title, since: '' };
  return { title, since: new Intl.DateTimeFormat('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(t) };
}

/** The big button of the off state: what it does, whether it is enabled and why not (tooltip only). */
export interface PlayerPowerOffer {
  action: 'on' | 'off' | 'none';
  enabled: boolean;
  reason: string | null;
}

/** Power of the device (or of a second zone: `zone`). Nothing is offered without `media.power`, to an unavailable device or to one
 * whose capabilities are unknown. */
export function playerPowerOffer(d: Pick<PlayerDevice, 'live' | 'caps' | 'can' | 'zones'>, zone?: string): PlayerPowerOffer {
  if (!d.can.power) return { action: 'none', enabled: false, reason: 'forbidden' };
  const z = zone && d.zones && zone !== d.zones[0]?.id ? d.zones.find((x) => x.id === zone) ?? null : null;
  const mode = panelMode(d);
  if (mode === 'unavailable') return { action: 'none', enabled: false, reason: 'unavailable' };
  const lit = z ? z.power === 'on' : mode === 'on';
  const cmd: PlayerCommand = { command: lit ? 'power_off' : 'power_on', ...(z && zone ? { zone } : {}) };
  const ok = playerCommandOffered(d, cmd);
  return { action: lit ? 'off' : 'on', enabled: ok, reason: ok ? null : d.live.caps_known ? 'not_supported' : 'unavailable' };
}

// ------------------------------------------------------------------------------------------------ what is drawn

/** The small line over the title: "מנגן עם סלון" / "מושהה" / "תחנה" / "מנגן". The leader is the device the playback belongs to. */
export function nowStatusWord(d: Pick<PlayerDevice, 'live'>, leader: Pick<PlayerDevice, 'name' | 'area_name'> | null): string {
  const l = d.live;
  const paused = l.play === 'paused';
  if (l.group.role === 'member' && leader) return `מנגן עם ${leaderLabel(leader)}${paused ? ' · מושהה' : ''}`;
  if (paused) return 'מושהה';
  return l.now.kind === 'station' ? 'תחנה' : 'מנגן';
}

/** Something is loaded in the player (a title and a playing or paused state): the now-playing card is drawn, else "לא מנגן". */
export const hasNow = (l: Pick<PlayerLive, 'play' | 'now'>): boolean => (l.play === 'playing' || l.play === 'paused') && !!l.now.title;

/** The transport buttons of the pad, in order, each only where `caps` allow it (shuffle / repeat only with the music layer). */
export interface TransportButton {
  id: 'shuffle' | 'previous' | 'play_pause' | 'next' | 'repeat';
  offered: boolean;
}
export function transportButtons(d: Pick<PlayerDevice, 'caps' | 'live'>): TransportButton[] {
  const c = d.caps;
  const out: TransportButton[] = [];
  if (c.shuffle) out.push({ id: 'shuffle', offered: true });
  if (c.transport.previous) out.push({ id: 'previous', offered: true });
  if (c.transport.play || c.transport.pause) out.push({ id: 'play_pause', offered: true });
  if (c.transport.next) out.push({ id: 'next', offered: true });
  if (c.repeat) out.push({ id: 'repeat', offered: true });
  return out;
}

/** The repeat button's label (the glyph carries a "1" for one). */
export const repeatLabel = (m: PlayerLive['repeat']): string => `חזרה: ${m === 'all' ? 'הכל' : m === 'one' ? 'שיר אחד' : 'כבוי'}`;

/** The playback position now (client interpolation of the reported position while playing; null for a station / no position). */
export function positionOf(l: Pick<PlayerLive, 'play' | 'now'>, at: number = Date.now()): number | null {
  return interpolatePosition(l.now, l.play === 'playing', at);
}

/** The seek bar: a seekable range only with the cap AND a duration AND control; else a plain bar (never a control that does nothing). */
export function seekState(d: Pick<PlayerDevice, 'caps' | 'can' | 'live'>): 'none' | 'live' | 'bar' | 'seek' {
  const n = d.live.now;
  if (n.kind === 'station') return 'live';
  if (n.position_s === null || n.duration_s === null || n.duration_s <= 0) return 'none';
  return d.caps.transport.seek && d.can.control && d.live.caps_known && !isDead(d.live) ? 'seek' : 'bar';
}

/** Fraction 0..1 of the bar for a position. */
export const fraction = (pos: number | null, dur: number | null): number => (pos === null || !dur || dur <= 0 ? 0 : Math.max(0, Math.min(1, pos / dur)));

// ------------------------------------------------------------------------------------------------ up next

/** What the "הבא בתור" block draws: `none` (this device has no queue read at all: no section), `loading` (nothing read yet),
 * `unavailable` ("לא זמין", never an empty list), or the rows. A partial queue is never shown as empty. */
export type UpNextView =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'rows'; count: number | null; current: { name: string; artist: string | null; duration_s: number | null; index: number | null; playing: boolean }; next: { name: string; artist: string | null; duration_s: number | null; index: number | null } | null; more: number };

export function upNextView(d: Pick<PlayerDevice, 'caps' | 'live'>, u: UpNext | null | 'error', libraryAbsent = false): UpNextView {
  if (!d.caps.up_next) return { kind: 'none' };
  if (d.live.now.kind === 'station') return { kind: 'none' }; // a station is not a queue
  if (u === 'error' || libraryAbsent) return { kind: 'unavailable' };
  if (u === null) return hasNow(d.live) ? { kind: 'loading' } : { kind: 'none' }; // nothing playing: nothing is read, nothing to show
  if (!u.confirmed) return { kind: 'unavailable' };
  if (!hasNow(d.live) || !u.current) return { kind: 'none' }; // confirmed and nothing queued / playing: no block (never "empty" for an unconfirmed read, handled above)
  return {
    kind: 'rows', count: u.count,
    current: { name: u.current.name, artist: u.current.artist, duration_s: u.current.duration_s, index: u.index, playing: d.live.play === 'playing' },
    next: u.next ? { name: u.next.name, artist: u.next.artist, duration_s: u.next.duration_s, index: u.index === null ? null : u.index + 1 } : null,
    more: upNextMore(u),
  };
}
export { upNextText };

// ------------------------------------------------------------------------------------------------ volume

/** What a volume slider displays for `level`: clamped to the ceiling in force ONLY where one is set (decision 7ב: there is no
 * default ceiling, so nothing is clamped and no marker is drawn for a device without one). */
export function volumeDisplay(d: Pick<PlayerDevice, 'volume_max' | 'volume_night'>, level: number, now: Date = new Date()): { level: number; ceiling: number | null; clamped: boolean } {
  const ceiling = effectiveCeiling(d, now);
  const raw = Math.max(0, Math.min(100, Math.round(level)));
  const shown = ceiling === null ? raw : clampVolume(d, raw, now);
  return { level: shown, ceiling, clamped: ceiling !== null && raw > ceiling };
}

/** The group slider's value: the max of the powered members (like MA), from the members the panel knows. */
export function groupSliderLevel(rooms: readonly PlayerDevice[]): number | null {
  return groupLevel(rooms.map(planMember));
}

/** A device as the group-volume plan reads it. */
export function planMember(d: PlayerDevice): PlanMember {
  return { key: d.key, volume_max: d.volume_max, volume_night: d.volume_night, can: { control: d.can.control }, live: { power: d.live.power, volume: { level: d.live.volume.level, muted: d.live.volume.muted } } };
}

/** The steps the UI expects of a group volume change (the server does the same and reports the real outcome per room). */
export function expectedGroupSteps(rooms: readonly PlayerDevice[], level: number, mode: 'relative' | 'absolute', now?: Date): VolumeStep[] {
  return groupVolumePlan(rooms.map(planMember), level, mode, now).steps;
}

// ------------------------------------------------------------------------------------------------ rooms and the group section

export interface RoomRow {
  key: string;
  name: string;
  room: string | null;
  floor: string | null;
  level: number | null;
  muted: boolean | null;
  available: boolean;
  leader: boolean;
  dev: PlayerDevice;
}

/** The leader of a device's group among `devices` (itself when it is not a member or the leader is not in the list). */
export function leaderOf(d: PlayerDevice, devices: readonly PlayerDevice[]): PlayerDevice {
  return resolveLeader(d, devices);
}

/** The keys of the rooms that play together with `lead`: a live group's members (leader first) or a static group's members. */
export function groupKeysOf(lead: PlayerDevice): string[] {
  if (lead.kind === 'group') return [...new Set(lead.live.group.member_keys)];
  return liveGroupKeys(lead.live.group, lead.key);
}

/** The per-room rows ("לפי חדר"): every room of the group, in group order, as far as `devices` knows them. */
export function roomRows(lead: PlayerDevice, devices: readonly PlayerDevice[]): RoomRow[] {
  const by = new Map(devices.map((x) => [x.key, x]));
  const rows: RoomRow[] = [];
  for (const k of groupKeysOf(lead)) {
    const dev = k === lead.key ? lead : by.get(k);
    if (!dev) continue;
    rows.push({ key: dev.key, name: dev.name, room: dev.area_name, floor: dev.floor_name, level: dev.live.volume.level, muted: dev.live.volume.muted, available: dev.live.power !== 'unavailable' && dev.live.power !== 'unknown', leader: dev.key === lead.key && lead.kind !== 'group', dev });
  }
  return rows;
}

/** Whether this panel is in "grouped" mode: a live group of two or more rooms, or a static group. */
export function isGroupedView(lead: PlayerDevice, rooms: readonly RoomRow[]): boolean {
  return lead.kind === 'group' ? rooms.length > 0 : rooms.length > 1;
}

/** The group slider is offered: the leader (or static group) carries `volume_group` and the caller may group. */
export const groupVolumeOffered = (lead: Pick<PlayerDevice, 'caps' | 'can' | 'live'>): boolean => lead.caps.volume_group && lead.can.group && lead.can.control && lead.live.caps_known && !isDead(lead.live);

/** The rooms of the "קבוצה" section: the leader first (ticked, fixed), then the candidates of the SAME layer by floor, each with its tick state. */
export interface GroupRow {
  key: string;
  name: string;
  sub: string;
  member: boolean;
  leader: boolean;
  /** What is playing in the room when it is not in the group (the small tile of the row). */
  playing: { glyph: string; hue: number | null } | null;
}

export function groupSectionRows(lead: PlayerDevice, devices: readonly PlayerDevice[]): GroupRow[] {
  const cands = groupCandidates(lead, devices).sort((a, b) => (a.floor_name ?? '￿').localeCompare(b.floor_name ?? '￿', 'he') || a.name.localeCompare(b.name, 'he'));
  const sub = (d: PlayerDevice): string => [d.area_name ?? 'ללא חדר', d.floor_name && lead.floor_name && d.floor_name !== lead.floor_name ? d.floor_name : null].filter(Boolean).join(' · ');
  return [lead, ...cands].map((d) => ({
    key: d.key, name: d.name, sub: sub(d), leader: d.key === lead.key, member: d.key === lead.key || (d.live.group.role === 'member' && d.live.group.leader_key === lead.key),
    playing: d.key !== lead.key && isPlaying(d) && d.live.group.role === 'none' && !!d.live.now.title ? { glyph: d.live.now.glyph, hue: d.live.now.hue } : null,
  }));
}

/** The panel offers the group section: live GROUPING, permission, same-layer candidates, not view-only. */
export const groupSectionShown = (lead: PlayerDevice, rows: readonly GroupRow[]): boolean => groupSectionOffered(lead) && rows.length > 1;

/** What the user's ticks turn into: who leaves, who joins, and whether the party rule asks first. */
export interface JoinPlan {
  diff: ReturnType<typeof joinDiff>;
  /** The devices of the group after the change (the leader included). */
  after: PlayerDevice[];
  needsConfirmation: boolean;
  floors: number;
}
export function joinPlan(lead: PlayerDevice, current: readonly string[], desired: readonly string[], devices: readonly PlayerDevice[]): JoinPlan {
  const diff = joinDiff(current, desired, lead.key);
  const by = new Map(devices.map((x) => [x.key, x]));
  const keep = [...diff.stay, ...diff.join];
  const after = [lead, ...keep.map((k) => by.get(k)).filter((x): x is PlayerDevice => !!x)];
  const floors = new Set(after.map((x) => x.floor_id).filter((f): f is string => f !== null)).size;
  return { diff, after, needsConfirmation: diff.join.length > 0 && needsConfirmation(after), floors };
}

/** The confirmation's question ("לצרף 4 חדרים לקבוצה אחת?") and, across floors, the one line under it. */
export const joinQuestion = (total: number): string => `לצרף ${total} חדרים לקבוצה אחת?`;
export const floorsLine = (floors: number): string | null => (floors > 1 ? `הקבוצה תשמיע ב־${floors} קומות.` : null);
/** The question and line for a server preview (409 `confirm_required`), else for the local plan. */
export function confirmCopy(preview: GroupPreview | null, plan: JoinPlan): { question: string; line: string | null } {
  const total = preview ? preview.devices : plan.after.length;
  const floors = preview ? preview.floors : plan.floors;
  return { question: joinQuestion(total), line: floorsLine(floors) };
}
export { PARTY_MIN_DEVICES };

/** One row of the outcome of a group run, by room ("פרגולה לא הצטרף"): only the ones that are worth a line (the failures). */
export function failedLines(members: readonly { device_key: string; area_name: string | null; outcome: MemberOutcome }[], names: ReadonlyMap<string, string>): string[] {
  return members
    .filter((m) => m.outcome === 'not_joined' || m.outcome === 'unknown' || m.outcome === 'not_allowed')
    .map((m) => `${m.area_name ?? names.get(m.device_key) ?? ''} ${OUTCOME_SHORT[m.outcome]}`.trim());
}
const OUTCOME_SHORT: Record<string, string> = { not_joined: 'לא הצטרף', unknown: 'לא ידוע', not_allowed: 'אין הרשאה' };

// ------------------------------------------------------------------------------------------------ transfer

/** The players playing now that could hand their music over: not a member (the leader holds the queue), not this device, with a queue. */
export function transferSources(d: PlayerDevice, devices: readonly PlayerDevice[]): PlayerDevice[] {
  return devices.filter((x) => x.key !== d.key && x.kind !== 'group' && isPlaying(x) && x.live.group.role !== 'member' && x.caps.up_next && x.live.caps_known);
}
/** "העבר את המוזיקה לכאן": only on a music layer that transfers (MA), only to a device that is not playing, only when another plays. */
export const transferOffered = (d: PlayerDevice, sources: readonly PlayerDevice[]): boolean => d.caps.transfer && d.can.control && d.live.caps_known && !isDead(d.live) && !isPlaying(d) && !isMember(d) && sources.length > 0;

// ------------------------------------------------------------------------------------------------ the library

/** The library tab to show: the wanted one when it exists, else the first. */
export const pickTab = (tabs: readonly LibraryKind[], want: LibraryKind | null): LibraryKind | null => (want && tabs.includes(want) ? want : tabs[0] ?? null);
/** "נגן אחרי הנוכחי" behind a long press: only with a music layer that queues (MA); Sonos starts the favourite only. */
export const enqueueOffered = (d: Pick<PlayerDevice, 'music_provider'>): boolean => d.music_provider === 'ma';

// ------------------------------------------------------------------------------------------------ receivers

/** The zone the panel shows (the first zone is the device itself): its own state, never the other zone's. */
export interface ZoneView extends ReceiverZone {
  main: boolean;
}
export function zoneViews(d: Pick<PlayerDevice, 'zones'>): ZoneView[] {
  return (d.zones ?? []).map((z, i) => ({ ...z, main: i === 0 }));
}
export function zoneView(d: Pick<PlayerDevice, 'zones' | 'live'>, id: string | null): ZoneView | null {
  const z = zoneViews(d);
  if (!z.length) return null;
  return z.find((x) => x.id === id) ?? z[0];
}

// ------------------------------------------------------------------------------------------------ the gate

/** Why a press was not sent: `not_offered` (caps / state / permission), `dropped` (over a rate: a short shake, no text), `busy` (a
 * power command is still in flight), `cooldown` (a second tap on a slow command). */
export type PlayerGateVerdict = 'send' | 'not_offered' | 'dropped' | 'busy' | 'cooldown';

const KEYLIKE: readonly PlayerCommand['command'][] = ['transport', 'volume_step', 'mute', 'key'];

/** Minimum gaps per command (CR §6.4): seek 2/s, shuffle / repeat 2/s, transfer 1 per 5 s; `play_item` 1/s and 6 per minute. */
const GAP_MS: Partial<Record<PlayerCommand['command'], number>> = { seek: 500, shuffle: 500, repeat: 500, transfer: 5000, play_item: 1000 };
const PLAY_ITEM_PER_MINUTE = 6;

/**
 * The one checkpoint every press of the panel passes before the client's sender: offered at all (`playerCommandOffered`, the rule the
 * server re-checks), key-like presses through the token bucket (5/s, burst 8), the slower commands through their own minimum gap, one
 * power command in flight. Nothing queues: the answer is `send` or a reason, and the caller drops the press.
 */
export class PlayerGate {
  private readonly keys = new KeyThrottle();
  private readonly last = new Map<string, number>();
  private readonly plays: number[] = [];
  private powerBusy = false;
  private lastPower = 0;

  check(d: Pick<PlayerDevice, 'live' | 'caps' | 'can' | 'zones'>, c: PlayerCommand, now: number = Date.now()): PlayerGateVerdict {
    if (!playerCommandOffered(d, c)) return 'not_offered';
    if (c.command === 'power_on' || c.command === 'power_off') {
      if (this.powerBusy || now - this.lastPower < 2000) return 'busy';
      this.powerBusy = true;
      this.lastPower = now;
      return 'send';
    }
    if (KEYLIKE.includes(c.command) && !this.keys.take(now)) return 'dropped';
    const gap = GAP_MS[c.command];
    if (gap !== undefined) {
      const before = this.last.get(c.command);
      if (before !== undefined && now - before < gap) return c.command === 'transfer' ? 'cooldown' : 'dropped';
      if (c.command === 'play_item') {
        while (this.plays.length && now - this.plays[0] > 60_000) this.plays.shift();
        if (this.plays.length >= PLAY_ITEM_PER_MINUTE) return 'dropped';
        this.plays.push(now);
      }
      this.last.set(c.command, now);
    }
    return 'send';
  }

  /** The power command finished (confirmed, refused or timed out): the next one may go (after the 2 s minimum). */
  powerDone(): void {
    this.powerBusy = false;
  }
}

/** A group volume send is at most 2/s per group, last value wins (the panel debounces; this guards the direct path). */
export class RateGap {
  private last: number | null = null;
  constructor(private readonly gapMs: number) {}
  take(now: number = Date.now()): boolean {
    if (this.last !== null && now - this.last < this.gapMs) return false;
    this.last = now;
    return true;
  }
}

// ------------------------------------------------------------------------------------------------ confirmation

/** `null` = the effect is not observable (steps, next / previous): the press is "sent", never "confirmed". Otherwise the predicate
 * the fresh `live` must satisfy; it is evaluated until true or `CONFIRM_TIMEOUT_MS`. */
export type PlayerExpectation = ((live: PlayerLive) => boolean) | null;

export interface ExpectContext {
  /** The library item being started (its name is what a track / station shows once it plays). */
  itemName?: string | null;
  /** The device a transfer takes the music from. */
  at?: number;
}

export function playerExpectation(c: PlayerCommand, before: PlayerLive, ctx: ExpectContext = {}): PlayerExpectation {
  switch (c.command) {
    case 'power_on': return (l) => l.power === 'on';
    case 'power_off': return (l) => l.power === 'off' || l.power === 'standby';
    case 'volume_set': return (l) => l.volume.level !== null && Math.abs(l.volume.level - Math.round(c.level)) <= 1;
    case 'mute': return (l) => l.volume.muted === c.muted;
    case 'source': return (l) => l.now.source_id === c.source_id;
    case 'sound_output': return (l) => l.sound_output === c.output;
    case 'shuffle': return (l) => l.shuffle === c.on;
    case 'repeat': return (l) => l.repeat === c.mode;
    case 'seek': return (l) => { const p = positionOf(l); return p !== null && Math.abs(p - c.position_s) <= 3; };
    case 'transport':
      if (c.action === 'play') return (l) => l.play === 'playing';
      if (c.action === 'pause') return (l) => l.play === 'paused';
      if (c.action === 'stop') return (l) => l.play === 'idle' || l.play === null || l.power !== 'on';
      if (c.action === 'play_pause') { const was = before.play; return (l) => l.play !== was; }
      return null; // next / previous: nothing observable that is reliable
    case 'play_item': {
      if (c.enqueue === 'next' || c.enqueue === 'add') return null; // a queue change: the "הבא בתור" read shows it
      return (l) => l.play === 'playing' && (before.play !== 'playing' || l.now.title !== before.now.title || (!!ctx.itemName && l.now.title === ctx.itemName));
    }
    case 'transfer': return (l) => l.play === 'playing';
    default: return null;
  }
}

/** The pending id of a command (one spinner per control). */
export function pendId(c: PlayerCommand): string {
  switch (c.command) {
    case 'power_on': case 'power_off': return `power${c.zone ? `:${c.zone}` : ''}`;
    case 'source': return `src:${c.source_id}`;
    case 'sound_output': return `mode:${c.output}`;
    case 'transport': return c.action === 'play_pause' || c.action === 'play' || c.action === 'pause' ? 'toggle' : c.action;
    case 'play_item': return `item:${c.item_ref}`;
    case 'volume_set': return c.zone ? `vol:${c.zone}` : 'vol';
    default: return c.command;
  }
}

// ------------------------------------------------------------------------------------------------ small formatters

/** The artwork's glow colour (r g b) of what plays: the album's hue, else a neutral. */
export const NEUTRAL_GLOW = '107 119 136';
