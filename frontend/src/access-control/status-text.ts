/**
 * CR-036 S10: the words of the Settings page "בקרת כניסה" - what status-logic.ts answers (keys, ages, durations, codes) turned into the
 * page's own sentences through i18n/access-status.ts. Still no DOM: the unit tests read these strings directly.
 * A code the page has no word for is shown AS the code (a Settings page keeps the technical truth) - never as an invented sentence.
 */
import type { FleetAlert } from '../api/access-status';
import type { DisplayZone } from '../api/intercom';
import { st, stDynamic, type StKey } from '../i18n/access-status';
import {
  actionKey,
  age,
  alertKindKey,
  duration,
  errorKey,
  fieldKey,
  suppressionKey,
  versionActionKey,
  whenOf,
  wordKey,
  CLOCKS,
  DRIFTS,
  HISTORIES,
  STREAMS,
  TIME_MODES,
  type Age,
  type Duration,
  type SyncWord,
  type When,
} from './status-logic';

export function ageText(a: Age): string {
  switch (a.key) {
    case 'none':
      return st('ageNone');
    case 'now':
      return st('ageNow');
    case 'minute':
      return st('ageMinute');
    case 'minutes':
      return st('ageMinutes', { n: a.n });
    case 'hours':
      return st('ageHours', { n: a.n });
    case 'today':
      return st('ageToday', { time: a.time });
    case 'yesterday':
      return st('ageYesterday', { time: a.time });
    case 'date':
      return st('ageDate', { date: a.date, time: a.time });
  }
}

export function whenText(w: When): string {
  switch (w.key) {
    case 'none':
      return st('ageNone');
    case 'today':
      return st('ageToday', { time: w.time });
    case 'yesterday':
      return st('ageYesterday', { time: w.time });
    case 'tomorrow':
      return st('whenTomorrow', { time: w.time });
    case 'date':
      return st('ageDate', { date: w.date, time: w.time });
  }
}

export function durationText(d: Duration | null): string {
  if (!d) return '';
  if (d.key === 'minutes') return st('durMinutes', { n: d.n });
  if (d.key === 'hours') return st('durHours', { n: d.n });
  return d.n === 1 ? st('durDay') : st('durDays', { n: d.n });
}

export const syncText = (word: SyncWord): string => st(`sync_${word}` as StKey);

/** A failure code in words, or `שגיאה (code)` for one the page has no word for; '' for no code. */
export function errorText(code: string | null | undefined): string {
  if (!code) return '';
  const key = errorKey(code);
  return key ? st(key as StKey) : st('errUnknown', { code });
}

/** An action code in words; a code the page has no word for stays the code. */
export function actionText(code: string | null | undefined): string {
  const key = actionKey(code);
  return key ? st(key as StKey) : (code ?? '');
}

export function fieldText(name: string): string {
  const key = fieldKey(name);
  return key ? st(key as StKey) : name;
}

export const versionActionText = (action: string | null | undefined): string => stDynamic(versionActionKey(action), 'ver_other');

/** "Lobby: sync stalled". */
export function alertTitle(a: Pick<FleetAlert, 'station_name' | 'station_id' | 'kind'>): string {
  const who = a.station_name || a.station_id || '';
  const what = st(alertKindKey(a.kind) as StKey);
  return who ? `${who}: ${what}` : what;
}

/** The detail line of an alert: since when and for how long, or - for a muted one - why and until when. */
export function alertDetail(a: FleetAlert, now: Date, zone: DisplayZone): string {
  const parts: string[] = [];
  if (a.suppressed && a.suppression) {
    const reason = st(suppressionKey(a.suppression.reason) as StKey);
    parts.push(a.suppression.until ? st('alertMutedUntil', { reason, until: whenText(whenOf(a.suppression.until, now, zone)) }) : st('alertMuted', { reason }));
  }
  const since = a.observed_since ? age(a.observed_since, now, zone) : null;
  if (since && since.key !== 'none') parts.push(st('alertSince', { when: ageText(since) }));
  // a start that is a clock time ("yesterday 22:10") does not say how long it has been: the length follows; "35 min ago" already does
  const relative = since !== null && ['now', 'minute', 'minutes', 'hours'].includes(since.key);
  const d = durationText(duration(a.observed_seconds));
  if (d && !a.suppressed && !relative) parts.push(d);
  return parts.join(' · ');
}

// ---------------------------------------------------------------- health words

export const streamText = (v: string | null | undefined): string => st(wordKey('stream_', v, STREAMS) as StKey);
export const historyText = (v: string | null | undefined): string => st(wordKey('hist_', v, HISTORIES) as StKey);
export const driftText = (v: string | null | undefined): string => st(wordKey('drift_', v, DRIFTS) as StKey);
export const clockText = (v: string | null | undefined): string => st(wordKey('clock_', v, CLOCKS) as StKey);
export const timeModeText = (v: string | null | undefined): string => st(wordKey('tmode_', v, TIME_MODES) as StKey);

/** `device_unavailable 1, revision_conflict 2` for the error counts of a station's sync worker (codes in words, counts as written). */
export function countsText(counts: Record<string, number>, wordOf: (k: string) => string): string {
  return Object.entries(counts)
    .map(([k, n]) => `${wordOf(k)} ${n}`)
    .join(' · ');
}

/** A model with its firmware on one line ("DS-KD8003 V2.2.62"); either may be missing. */
export function modelLine(model: string | null | undefined, firmware: string | null | undefined): string {
  return [model, firmware].filter((v): v is string => !!v).join(' ');
}

/** The number of seconds as written in the health card ("1 s" for a skew), no decimals below a tenth. */
export function secondsText(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return st('hdSkewVal', { n: Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n) });
}

export function msText(n: number | null | undefined): string {
  return n === null || n === undefined || !Number.isFinite(n) ? '—' : st('hdMs', { n: Math.round(n) });
}

export function yesNo(v: boolean | null | undefined): string {
  return v === null || v === undefined ? '—' : v ? st('hdYes') : st('hdNo');
}

