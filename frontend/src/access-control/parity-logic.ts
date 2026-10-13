/**
 * CR-036 S12: the pure logic of the parity segment ("בדיקת התאמה") of the Settings page "בקרת כניסה" - the words and tones of a report
 * row, the links to open a screen natively and in the classic panel, and the side-by-side checklist kept in this browser. Plain node,
 * so tests/unit-access-parity-logic.spec.ts runs it without a browser. Nothing here reads a network or names an integration command.
 */
import type { ParityOutcome, ParityRow, ParitySide } from '../api/access-parity';
import { STATION_MEDIA_MODES, type StationMediaMode } from '../api/station-media';
import { pt, ptDynamic, type PtKey } from '../i18n/access-parity';
import { POLICY_KEYS, parsePolicy } from '../screens/wiskey-stations-logic';

// ---------------------------------------------------------------- the stations-screen display card (Settings › מתגי מסכי כניסה)

/** The server keeps at most this many characters of the phrases setting (routers/settings.py `max_length`). */
export const PHRASES_STORED_MAX = 2000;

/** What the phrase box will give the announce dialog (the stations screen's own `parsePolicy`): how many phrases it shows, and how many
 * non-empty lines it leaves out (too long, or past the eighth). None shown = the built-in phrases. */
export function phrasePreview(text: string): { shown: number; dropped: number; builtIn: boolean } {
  const lines = text.split(/\r?\n/).map((l) => l.split(/\s+/).filter(Boolean).join(' ')).filter((l) => l.length > 0);
  const shown = parsePolicy({ [POLICY_KEYS.phrases]: text }).phrases.length;
  return { shown, dropped: Math.max(0, lines.length - shown), builtIn: shown === 0 };
}

const MEDIA_LABEL: Record<StationMediaMode, PtKey> = { off: 'dispMediaOff', video: 'dispMediaVideo', video_talk: 'dispMediaTalk' };

/** The choices of the "וידאו ודיבור במסך התחנות" row (`access.station_media`): value and label, in the order Settings offers them. The
 * live picture always goes through the product's own media server (WebRTC or MSE); that is not a choice, so nothing here names it. */
export const mediaOptions = (): Array<[StationMediaMode, string]> => STATION_MEDIA_MODES.map((m) => [m, pt(MEDIA_LABEL[m])]);

export type BadgeKind = 'live' | 'neutral' | 'error' | 'partial' | 'forbidden' | 'unknown' | 'offline';

const TONE: Record<ParityOutcome, BadgeKind> = {
  match: 'live',
  filtered: 'neutral',
  mismatch: 'error',
  partial: 'partial',
  not_permitted: 'forbidden',
  unsupported: 'unknown',
  unavailable: 'offline',
};

/** The badge of an outcome; an outcome this build has no word for is "unknown". */
export const outcomeTone = (outcome: string): BadgeKind => TONE[outcome as ParityOutcome] ?? 'unknown';
export const outcomeText = (outcome: string): string => ptDynamic(`out_${outcome}`, 'out_unavailable');

/** Why a row came out as it did: the rule that filtered, or what the outcome means; '' when there is nothing to add. */
export function whyText(row: Pick<ParityRow, 'outcome' | 'rule'>): string {
  if (row.outcome === 'filtered') return ptDynamic(`why_${row.rule ?? 'station_scope'}`, 'why_station_scope');
  if (row.outcome === 'not_permitted') return pt('why_permission');
  if (row.outcome === 'mismatch') return pt('why_mismatch');
  if (row.outcome === 'partial') return pt('why_partial');
  return '';
}

/** A count as shown: a dash when the side was not read, "at least n" when it stopped at its cap. */
export function countText(side: ParitySide | null | undefined): string {
  if (!side || side.count === null || side.count === undefined) return '—';
  return side.complete ? String(side.count) : pt('notComplete', { n: side.count });
}

export const screenText = (screen: string): string => ptDynamic(`scr_${screen}`, 'scr_stations');

/** The tabs the embedded panel itself has (its own screens): only these have a classic counterpart to open side by side. */
export const CLASSIC_SEGMENTS: readonly string[] = ['overview', 'events', 'people', 'devices'];

/** The native screen behind a report row and the classic panel of the same screen. `native` is null unless the screen is switched on
 * (`switchedOn` true): off, its route shows the embedded panel anyway; unknown (null), this build has no such switch yet. A Settings page is
 * always native. `classic` is the per-visit `?classic=1` address (it changes no setting), for the embedded panel's own tabs only. */
export function rowLinks(route: string, switchedOn: (segment: string) => boolean | null): { native: string | null; classic: string | null } {
  const m = /^#\/wiskey\/([a-z-]+)$/.exec(route);
  if (!m) return { native: route || null, classic: null };
  return { native: switchedOn(m[1]) === true ? route : null, classic: CLASSIC_SEGMENTS.includes(m[1]) ? `${route}?classic=1` : null };
}

// ---------------------------------------------------------------- the side-by-side checklist (CR-036 6.2 step 3)

export interface ChecklistScreen {
  /** The access.ui screen it belongs to (`overview`, `events`, `people`, `stations`, `schedules`). */
  screen: string;
  label: PtKey;
  items: PtKey[];
}

export const CHECKLIST: readonly ChecklistScreen[] = [
  { screen: 'overview', label: 'chk_overview', items: ['item_stations_count', 'item_ringing'] },
  { screen: 'stations', label: 'chk_stations', items: ['item_stations_count', 'item_doors', 'item_technical'] },
  { screen: 'people', label: 'chk_people', items: ['item_people_count', 'item_sample_person'] },
  { screen: 'events', label: 'chk_events', items: ['item_last_events', 'item_event_filters'] },
  { screen: 'schedules', label: 'chk_schedules', items: ['item_schedule'] },
];

/** screen -> item -> ticked */
export type ChecklistState = Record<string, Record<string, boolean>>;

export const CHECKLIST_KEY = 'sw.access.parity.checklist';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The ticks kept in this browser (a per-viewer convenience: an unreadable, blocked or foreign value reads as nothing ticked). */
export function loadChecklist(storage: StorageLike | null | undefined): ChecklistState {
  try {
    const raw = storage?.getItem(CHECKLIST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: ChecklistState = {};
    for (const entry of CHECKLIST) {
      const ticks = (parsed as Record<string, unknown>)[entry.screen];
      if (!ticks || typeof ticks !== 'object') continue;
      for (const item of entry.items) if ((ticks as Record<string, unknown>)[item] === true) (out[entry.screen] ??= {})[item] = true;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveChecklist(storage: StorageLike | null | undefined, state: ChecklistState): void {
  try {
    if (!storage) return;
    if (!Object.keys(state).length) storage.removeItem(CHECKLIST_KEY);
    else storage.setItem(CHECKLIST_KEY, JSON.stringify(state));
  } catch {
    /* storage blocked: the ticks live for this visit only */
  }
}

export function toggleItem(state: ChecklistState, screen: string, item: string): ChecklistState {
  const next: ChecklistState = JSON.parse(JSON.stringify(state)) as ChecklistState;
  const ticks = (next[screen] ??= {});
  if (ticks[item]) delete ticks[item];
  else ticks[item] = true;
  if (!Object.keys(ticks).length) delete next[screen];
  return next;
}

/** How many items are ticked over the screens shown, of how many. */
export function checklistProgress(state: ChecklistState, screens: readonly ChecklistScreen[]): { done: number; all: number } {
  let done = 0;
  let all = 0;
  for (const s of screens) {
    all += s.items.length;
    done += s.items.filter((i) => state[s.screen]?.[i]).length;
  }
  return { done, all };
}
