/**
 * Pure logic of the native schedules screen (CR-036 slice S9, read only): no DOM, no Lit, no network - the unit spec
 * (tests/unit-access-schedules-logic.spec.ts) imports this module in Node.
 *
 * What the screen shows, and what each piece really is (the rc.37 reference copy, read never run; shapes are W? until W2):
 * - per DOOR, its program: the weekly hold-open windows the integration executes for that relay (enabled / paused / being removed /
 *   an error), the execution state of its last command, and the specific dates; a door with no program may carry an older SAVED
 *   draft (never activated). The public door code: presence only ("set / not set / unknown"), never a value.
 * - the LIBRARY: the integration's own schedules (weekly windows, holidays) - drafts kept by the integration, not applied to a
 *   station by themselves;
 * - the PROPOSALS: a library schedule prepared for one station, the integration's last read-only comparison, and its latest
 *   check job. Applying is not available in this version of the integration (`can_apply` false), and the screen says so.
 * Anything the screen cannot map is "unknown" - never a guess.
 */
import type { AccessStation, Period, StationCodes, StationPolicy, StationProgram, StationPrograms, WeekdayName } from '../api/access-stations';
import type { JobStatus, LibrarySchedule, ScheduleJob, ScheduleOperations, SchedulePlan } from '../api/access-schedules';
import type { DisplayZone, IntercomFeedState } from '../api/intercom';
import { sch, schDynamic } from '../i18n/access-schedules';
import { offsetAt, UTC_ZONE } from '../screens/wiskey-format';

/** The reads repeat while the screen is visible (CR-036 3.4: the integration's change notice may not cover these stores, W6); the
 * server caches them for 30-60 s, so asking more often would only repeat the answer. */
export const POLL_MS = 60_000;
/** The table view's minimum viewport (below it the door view is the only one: no shrunken tables on a phone). */
export const TABLE_MIN = 820;

// ---------------------------------------------------------------- doors

export interface DoorRef {
  /** `<station id>:<relay>` - the address key (`?door=`). */
  key: string;
  stationId: string;
  stationName: string;
  door: number;
  doorName: string;
  online: boolean;
}

export const doorKey = (stationId: string, door: number): string => `${stationId}:${door}`;

/** `<station id>:<relay>` back into its parts (a station id may itself hold a colon: the relay is after the LAST one). */
export function parseDoorKey(key: string | null | undefined): { stationId: string; door: number } | null {
  if (!key) return null;
  const at = key.lastIndexOf(':');
  if (at <= 0) return null;
  const door = Number(key.slice(at + 1));
  return Number.isInteger(door) && door >= 1 ? { stationId: key.slice(0, at), door } : null;
}

export function doorLabel(name: string | null | undefined, index: number): string {
  return name?.trim() || sch('doorDefault', { n: index });
}

/** The doors whose schedules the caller may read: every relay of a station the server sent with its technical part (the server
 * sends it only with `access.stations.read` on that station - the screen never infers a right) and an integrated lock. In the
 * server's order of stations, relays by their physical index. */
export function doorsOf(stations: readonly AccessStation[]): DoorRef[] {
  const out: DoorRef[] = [];
  for (const s of stations) {
    if (!s.technical || !s.lock_enabled) continue;
    for (const lock of [...(s.locks ?? [])].sort((a, b) => a.physical_index - b.physical_index)) {
      out.push({ key: doorKey(s.id, lock.physical_index), stationId: s.id, stationName: s.name, door: lock.physical_index, doorName: doorLabel(lock.name, lock.physical_index), online: s.online });
    }
  }
  return out;
}

/** The door to show: the one asked for when the caller has it, else the first one. */
export function pickDoor(doors: readonly DoorRef[], wanted: string | null | undefined): DoorRef | null {
  return doors.find((d) => d.key === wanted) ?? doors[0] ?? null;
}

/** The doors grouped by station, for the door list (a station header, then its doors). */
export function doorGroups(doors: readonly DoorRef[]): { stationId: string; stationName: string; online: boolean; doors: DoorRef[] }[] {
  const groups: { stationId: string; stationName: string; online: boolean; doors: DoorRef[] }[] = [];
  for (const d of doors) {
    const g = groups.find((x) => x.stationId === d.stationId);
    if (g) g.doors.push(d);
    else groups.push({ stationId: d.stationId, stationName: d.stationName, online: d.online, doors: [d] });
  }
  return groups;
}

// ---------------------------------------------------------------- weekly windows

/** WisKey's week (and the week grid's data order, ISAPI's): Monday first. The screen shows Sunday first. */
export const WEEKDAYS: readonly WeekdayName[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** The order the screen writes days in (a Hebrew week). */
export const WEEK_SHOWN: readonly WeekdayName[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const HHMM = /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$|^24:00$/;
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const validPeriod = (p: unknown): p is Period =>
  !!p && typeof (p as Period).start === 'string' && typeof (p as Period).end === 'string' && HHMM.test((p as Period).start) && HHMM.test((p as Period).end) && minutes((p as Period).end) > minutes((p as Period).start);

/** One range of the week grid (sw-week-grid's `WeekRange`, kept structural so this module stays DOM-free). */
export interface GridRange {
  begin: string;
  end: string;
  mode: string;
}

/** The week grid's days (Monday first) from a weekly map. `unreadable`: the map is missing, or one of its periods is not a valid
 * `HH:MM` window (the grid then shows only what it could read, and the screen says the hours are unknown). */
export function weekGrid(weekly: Partial<Record<WeekdayName, Period[]>> | null | undefined, mode = 'hold'): { days: GridRange[][]; unreadable: boolean; empty: boolean } {
  if (!weekly || typeof weekly !== 'object') return { days: WEEKDAYS.map(() => []), unreadable: true, empty: true };
  let unreadable = false;
  const days = WEEKDAYS.map((d) => {
    const list = weekly[d];
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list)) {
      unreadable = true;
      return [];
    }
    const out: GridRange[] = [];
    for (const p of list) {
      if (validPeriod(p)) out.push({ begin: p.start, end: p.end, mode });
      else unreadable = true;
    }
    return out;
  });
  return { days, unreadable, empty: days.every((d) => !d.length) };
}

/** A left-to-right isolate (LRI ... PDI): times, dates and their ranges read in their own order inside a Hebrew line (without it,
 * "07:00–09:00" in a right-to-left paragraph shows as "09:00–07:00"). */
export const ltr = (s: string): string => (s ? `⁦${s}⁩` : s);
/** The text without the isolates (for comparisons). */
export const plainText = (s: string): string => s.replace(/[⁦-⁩]/g, '');

const periodsText = (p: readonly Period[] | undefined): string => ltr((p ?? []).filter(validPeriod).map((x) => `${x.start}–${x.end}`).join(', '));

/** The weekly windows as short lines, Sunday first: consecutive days with the same windows are one range ("א׳–ה׳ 07:00–19:00"). */
export function weeklyLines(weekly: Partial<Record<WeekdayName, Period[]>> | null | undefined): string[] {
  if (!weekly || typeof weekly !== 'object') return [];
  const per = WEEK_SHOWN.map((d) => periodsText(Array.isArray(weekly[d]) ? weekly[d] : []));
  if (per.every((p) => p === '')) return [];
  if (per.every((p) => p === per[0])) return [`${sch('allDays')} ${per[0]}`];
  const out: string[] = [];
  let i = 0;
  while (i < per.length) {
    if (per[i] === '') {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < per.length && per[j + 1] === per[i]) j += 1;
    const from = schDynamic(`day_${WEEK_SHOWN[i]}`, 'st_unknown');
    const to = schDynamic(`day_${WEEK_SHOWN[j]}`, 'st_unknown');
    out.push(`${j === i ? from : `${from}–${to}`} ${per[i]}`);
    i = j + 1;
  }
  return out;
}

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const dayShort = (d: string | null): string | null => {
  const m = d ? DAY.exec(d) : null;
  return m ? `${m[3]}.${m[2]}` : null;
};

/** The specific dates (holidays / exceptions) as lines: "02.10–03.10 · סגור", "24.12 · 08:00–12:00". A date the screen cannot read
 * is "unknown". */
export function dateLines(holidays: StationPolicy['holidays'] | null | undefined): string[] {
  return (Array.isArray(holidays) ? holidays : []).map((h) => {
    const a = dayShort(h?.start ?? null);
    const b = dayShort(h?.end ?? null);
    const when = a && b ? ltr(a === b ? a : `${a}–${b}`) : sch('st_unknown');
    const hours = periodsText(Array.isArray(h?.periods) ? h.periods : []) || sch('closed');
    const name = h?.name?.trim();
    return name ? `${name} · ${when} · ${hours}` : `${when} · ${hours}`;
  });
}

// ---------------------------------------------------------------- a door's program

export type ProgramState = 'active' | 'paused' | 'removing' | 'error' | 'draft' | 'unknown';
export type Tone = 'live' | 'stale' | 'error' | 'offline' | 'unknown' | 'neutral';

/** The program's state word: an error the integration recorded wins, then a removal in progress, then enabled / paused. */
export function programState(p: Pick<StationProgram, 'enabled' | 'removing' | 'error'> | null | undefined): ProgramState {
  if (!p) return 'unknown';
  if (p.error) return 'error';
  if (p.removing) return 'removing';
  if (p.enabled === true) return 'active';
  if (p.enabled === false) return 'paused';
  return 'unknown';
}

/** The `sw-badge` kind of a program state: active = live, removing = stale (on its way), error, paused / draft neutral, unknown. */
export function programTone(s: ProgramState): Tone {
  switch (s) {
    case 'active':
      return 'live';
    case 'removing':
      return 'stale';
    case 'error':
      return 'error';
    case 'paused':
    case 'draft':
      return 'neutral';
    default:
      return 'unknown';
  }
}

export interface DoorSchedule {
  door: DoorRef;
  /** No program and no saved draft: nothing scheduled on this door. */
  none: boolean;
  state: ProgramState;
  name: string;
  /** The execution words of the program's last command ('' without a program). */
  execution: string;
  /** Week grid days (Monday first) and whether some window could not be read. */
  days: GridRange[][];
  unreadable: boolean;
  lines: string[];
  dates: string[];
  timezone: string | null;
  checkedAt: string | null;
}

/** The door's schedule from its station's programs read: the program of that relay, else an older saved draft of it (shown as a
 * draft, never as active), else nothing. `programs` null = not read (yet), which is not "none". */
export function doorSchedule(door: DoorRef, programs: StationPrograms | null | undefined): DoorSchedule | null {
  if (!programs) return null;
  const program = (Array.isArray(programs.programs) ? programs.programs : []).find((p) => p?.door === door.door) ?? null;
  const saved = program ? null : ((Array.isArray(programs.saved) ? programs.saved : []).find((s) => s?.door === door.door) ?? null);
  const policy = program?.policy ?? saved?.policy ?? null;
  const base = { door, timezone: policy?.timezone ?? programs.timezone ?? null };
  if (!program && !saved) {
    return { ...base, none: true, state: 'unknown', name: '', execution: '', days: WEEKDAYS.map(() => []), unreadable: false, lines: [], dates: [], checkedAt: null };
  }
  const grid = weekGrid(policy?.weekly ?? null);
  const state: ProgramState = program ? programState(program) : 'draft';
  const exec = program?.execution?.status ?? null;
  return {
    ...base,
    none: false,
    state,
    name: policy?.name?.trim() || sch('unnamed'),
    execution: program ? schDynamic(`ex_${exec ?? 'unknown'}`, 'ex_unknown') : '',
    days: grid.days,
    unreadable: !policy || grid.unreadable,
    lines: weeklyLines(policy?.weekly ?? null),
    dates: dateLines(policy?.holidays ?? null),
    checkedAt: program?.checked_at ?? null,
  };
}

// ---------------------------------------------------------------- the public code (presence only)

export type CodeState = 'set' | 'unset' | 'unknown';

/** Whether the station's public door code is set - presence only, never a value: the integration's own state first, else the
 * slots (any set = set; every one known and not set = not set), else unknown. */
export function codeState(codes: StationCodes | null | undefined): CodeState {
  if (!codes) return 'unknown';
  if (codes.public_pin_state === 'configured') return 'set';
  if (codes.public_pin_state === 'absent') return 'unset';
  const slots = Array.isArray(codes.slots) ? codes.slots : [];
  if (slots.some((s) => s?.configured === true)) return 'set';
  if (slots.length && slots.every((s) => s?.configured === false)) return 'unset';
  return 'unknown';
}

export const codeWord = (s: CodeState): string => sch(s === 'set' ? 'codeSet' : s === 'unset' ? 'codeUnset' : 'codeUnknown');

// ---------------------------------------------------------------- the library and the proposals

/** The latest check job of a proposal (by its update time, then its creation), or null. */
export function latestJob(ops: Pick<ScheduleOperations, 'jobs'> | null | undefined, planId: string): ScheduleJob | null {
  const jobs = (Array.isArray(ops?.jobs) ? ops!.jobs : []).filter((j) => j?.plan_id === planId);
  const at = (j: ScheduleJob) => Date.parse(j.updated_at ?? j.created_at ?? '') || 0;
  return jobs.reduce<ScheduleJob | null>((best, j) => (!best || at(j) > at(best) ? j : best), null);
}

export function jobTone(s: JobStatus | null | undefined): Tone {
  switch (s) {
    case 'ready':
    case 'verified':
      return 'live';
    case 'pending':
    case 'queued':
    case 'checking':
    case 'blocked':
    case 'interrupted':
      return 'stale';
    case 'failed':
      return 'error';
    case 'cancelled':
      return 'neutral';
    default:
      return 'unknown';
  }
}

export function sourceTone(s: string | null | undefined): Tone {
  switch (s) {
    case 'current':
      return 'live';
    case 'changed':
      return 'stale';
    case 'missing':
      return 'error';
    default:
      return 'unknown';
  }
}

export interface PlanRow {
  id: string;
  name: string;
  station: string;
  stationId: string | null;
  /** The state word and its tone: the latest check job when there is one, else how the proposal relates to its library schedule. */
  state: string;
  tone: Tone;
  /** How the proposal relates to the library schedule now ("matches the library" / "the library changed" ...). */
  source: string;
  /** The proposal was prepared from an older revision of its library schedule. */
  outdated: boolean;
  /** Never applied by this version of the integration (always true in the reference copy). */
  notApplied: boolean;
  checkedAt: string | null;
}

export type StationNames = (id: string | null) => string;

export function stationNamer(stations: readonly Pick<AccessStation, 'id' | 'name'>[]): StationNames {
  const names = new Map(stations.map((s) => [s.id, s.name]));
  return (id) => (id && names.get(id)) || sch('stationUnknown');
}

export function planRows(plans: readonly SchedulePlan[] | null | undefined, ops: ScheduleOperations | null | undefined, library: readonly LibrarySchedule[] | null | undefined, names: StationNames): PlanRow[] {
  const revisionOf = new Map((library ?? []).map((s) => [s.id, s.revision]));
  return (plans ?? []).map((p) => {
    const job = latestJob(ops, p.id);
    const source = schDynamic(`pl_${p.source_state ?? 'unknown'}`, 'pl_unknown');
    const libRev = p.draft_id ? revisionOf.get(p.draft_id) : undefined;
    return {
      id: p.id,
      name: p.name?.trim() || sch('unnamed'),
      station: names(p.station_id),
      stationId: p.station_id,
      state: job ? schDynamic(`job_${job.status ?? 'unknown'}`, 'job_unknown') : source,
      tone: job ? jobTone(job.status) : sourceTone(p.source_state),
      source,
      outdated: typeof libRev === 'number' && typeof p.draft_revision === 'number' && p.draft_revision < libRev,
      notApplied: !p.can_apply,
      checkedAt: p.report?.checked_at ?? null,
    };
  });
}

export interface LibraryRow {
  id: string;
  name: string;
  version: string;
  lines: string[];
  holidays: string;
  /** "proposed for <stations>" / "not proposed to any station" (names of the stations of its proposals). */
  proposals: string;
  updatedAt: string | null;
}

export function libraryRows(library: readonly LibrarySchedule[] | null | undefined, plans: readonly SchedulePlan[] | null | undefined, names: StationNames): LibraryRow[] {
  return (library ?? []).map((s) => {
    const stations = [...new Set((plans ?? []).filter((p) => p.draft_id === s.id).map((p) => names(p.station_id)))];
    const n = Array.isArray(s.holidays) ? s.holidays.length : 0;
    return {
      id: s.id,
      name: s.name?.trim() || sch('unnamed'),
      version: typeof s.revision === 'number' ? sch('version', { n: s.revision }) : '',
      lines: weeklyLines(s.weekly),
      holidays: n === 0 ? '' : n === 1 ? sch('holidayOne') : sch('holidayMany', { n }),
      proposals: stations.length ? sch('proposedFor', { stations: stations.join(', ') }) : sch('notProposed'),
      updatedAt: s.updated_at ?? null,
    };
  });
}

// ---------------------------------------------------------------- the table across doors

export interface TableRow {
  key: string;
  door: string;
  station: string;
  program: string;
  kind: string;
  when: string;
  state: string;
  tone: Tone;
  code: string;
  codeState: CodeState;
}

/** One row per door: its program (or "none"), the windows as one line, the state, the code presence. A station whose reads have
 * not arrived (or failed) says "unknown" on its doors. */
export function tableRows(doors: readonly DoorRef[], programs: Readonly<Record<string, StationPrograms | null | undefined>>, codes: Readonly<Record<string, StationCodes | null | undefined>>): TableRow[] {
  return doors.map((d) => {
    const s = doorSchedule(d, programs[d.stationId]);
    const cs = codeState(codes[d.stationId]);
    const base = { key: d.key, door: d.doorName, station: d.stationName, code: codeWord(cs), codeState: cs };
    if (!s) return { ...base, program: sch('st_unknown'), kind: '', when: '', state: sch('st_unknown'), tone: 'unknown' as Tone };
    if (s.none) return { ...base, program: sch('noProgram'), kind: '', when: '', state: '', tone: 'neutral' as Tone };
    return {
      ...base,
      program: s.name,
      kind: s.state === 'draft' ? sch('kindDraft') : sch('kindHold'),
      when: s.unreadable && !s.lines.length ? sch('hoursUnknown') : s.lines.join(' · '),
      state: schDynamic(`st_${s.state}`, 'st_unknown'),
      tone: programTone(s.state),
    };
  });
}

// ---------------------------------------------------------------- words, panels, time

export function subtitle(doors: number, library: number | null): string {
  const parts = [doors === 1 ? sch('doorsOne') : sch('doorsMany', { n: doors })];
  if (library !== null) parts.push(library === 1 ? sch('libraryOne') : sch('libraryMany', { n: library }));
  return parts.join(' · ');
}

export type PanelKind = 'loading' | 'empty' | 'error' | 'forbidden' | 'stale';

/** The honest message for a read state the screen cannot show schedules in, without naming the platform. `ready` has none. */
export function feedPanel(state: Exclude<IntercomFeedState | 'unsupported', 'ready'> | string): { panel: PanelKind; heading: string } {
  switch (state) {
    case 'ha_not_configured':
      return { panel: 'stale', heading: sch('sNotConfigured') };
    case 'connecting':
      return { panel: 'loading', heading: sch('sConnecting') };
    case 'ha_unavailable':
      return { panel: 'stale', heading: sch('sUnavailable') };
    case 'not_installed':
      return { panel: 'empty', heading: sch('sNotInstalled') };
    case 'forbidden':
      return { panel: 'forbidden', heading: sch('noPermission') };
    case 'unsupported':
      return { panel: 'empty', heading: sch('sUnsupported') };
    default:
      return { panel: 'error', heading: sch('error') };
  }
}

/** A read answered "not now" (the integration's shared limit, a busy station slot, a timeout): try again in a moment, calmly. */
export const isBusy = (lastError: string | null | undefined): boolean => lastError === 'busy' || lastError === 'rate_limited' || lastError === 'timeout';

const pad2 = (n: number) => String(n).padStart(2, '0');

/** An instant as "DD.MM.YYYY HH:MM" in `zone` (the station's clock zone, else the installation's); '' for anything else. */
export function stamp(iso: string | null | undefined, zone: DisplayZone | null = UTC_ZONE): string {
  if (!iso || !/(Z|[+-][0-9]{2}:[0-9]{2})$/.test(iso)) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  let offset = 0;
  try {
    offset = offsetAt(ms, zone ?? UTC_ZONE);
  } catch {
    offset = 0;
  }
  const d = new Date(ms + offset * 1000);
  return ltr(`${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`);
}

// ---------------------------------------------------------------- who sees what (the server still decides every read)

export interface SchedulesAccess {
  /** The screen at all: `access.stations.read` at any scope (the per-door reads are per station). */
  screen: boolean;
  /** The library and the proposals: installation-wide in the integration, so only for `access.stations.read` at installation scope
   * (a station-scoped caller would be refused with an audited 403 - never asked). */
  library: boolean;
  /** "Edit in the intercom window": administrators (`system.configure`) until the write phase edits in Arx. */
  edit: boolean;
}

export function schedulesAccess(canAnywhere: (p: string) => boolean, canInstallation: (p: string) => boolean): SchedulesAccess {
  return { screen: canAnywhere('access.stations.read'), library: canInstallation('access.stations.read'), edit: canInstallation('system.configure') };
}

/** The classic panel's management tools, where the integration's own schedule editors live (always the embedded panel). */
export const CLASSIC_EDIT_HREF = '#/wiskey/tools';
