/**
 * HEALTH-GO2RTC-FOLLOWUP-2431 (owner 11.11): the video services (go2rtc add-ons) this installation runs, and the administrator's choice.
 *
 * `GET /api/v1/system/video-services[?fresh=true]`, `PUT /api/v1/system/video-services/selection {slug}`, `DELETE .../selection` -
 * system administrators only, local sessions only. The server finds the candidates (read only) and probes each started one; choosing
 * one takes precedence over the add-on option `go2rtc_url` at once for requests and at every start. Words on screen never name the
 * platform; the address shown is host:port only.
 */
import { api, get, put } from './client';

export type ServiceState = 'started' | 'stopped' | 'startup' | 'error' | 'unknown';
export type ProbeOutcome = 'ok' | 'auth_required' | 'unreachable' | 'error' | 'not_probed';

export interface VideoServiceCandidate {
  slug: string;
  name: string;
  state: ServiceState;
  version: string | null;
  image_go2rtc: boolean;
  address: string | null;
  probe: ProbeOutcome;
  go2rtc_version: string | null;
  current: boolean;
}

export interface VideoServicesView {
  supported: boolean;
  reason: 'no_supervisor' | 'forbidden' | 'unreachable' | null;
  checked_at: string | null;
  current: { source: 'selection' | 'option' | 'none'; address: string | null; state: string; slug: string | null };
  option_address: string | null;
  selection: { slug: string; name: string; at: string | null; by: string | null; address: string | null } | null;
  candidates: VideoServiceCandidate[];
  restart_recommended: boolean;
}

const SHARED_MS = 15000;
let shared: { at: number; p: Promise<VideoServicesView> } | null = null;
/** One request per tab for every picker mounted within SHARED_MS (a wall of tiles that all say "video service unavailable"); `fresh` always asks. */
export const listVideoServices = (fresh = false): Promise<VideoServicesView> => {
  const now = Date.now();
  if (!fresh && shared && now - shared.at < SHARED_MS) return shared.p;
  const p = get<VideoServicesView>(`system/video-services${fresh ? '?fresh=true' : ''}`);
  shared = { at: now, p };
  p.catch(() => {
    if (shared?.p === p) shared = null; // a failure is not shared with the next picker
  });
  return p;
};
const forget = <T>(p: Promise<T>): Promise<T> => {
  shared = null;
  return p;
};
export const selectVideoService = (slug: string) => forget(put<VideoServicesView>('system/video-services/selection', { slug }));
export const clearVideoService = () => forget(api<VideoServicesView>('system/video-services/selection', { method: 'DELETE' }));

/** Owner 11.11 answer 1: the delay before the administrators' notice, minutes; 15 by default. */
export const NOTICE_AFTER_CHOICES = [1, 5, 15, 30, 60] as const;
export const NOTICE_AFTER_DEFAULT = 15;
export const noticeAfterLabel = (m: number): string => (m === 1 ? 'דקה אחת' : m === 60 ? 'שעה' : `${m} דקות`);
export const noticeAfterValue = (v: unknown): number => {
  const n = Number(v);
  return (NOTICE_AFTER_CHOICES as readonly number[]).includes(n) ? n : NOTICE_AFTER_DEFAULT;
};

export const STATE_LABEL: Record<ServiceState, string> = { started: 'פועל', stopped: 'כבוי', startup: 'עולה', error: 'בתקלה', unknown: 'מצב לא ידוע' };
export const PROBE_LABEL: Record<ProbeOutcome, string> = {
  ok: 'עונה',
  auth_required: 'עונה, דורש סיסמה',
  unreachable: 'לא עונה',
  error: 'עונה עם שגיאה',
  not_probed: 'לא נבדק',
};
export const SOURCE_LABEL: Record<VideoServicesView['current']['source'], string> = {
  selection: 'נבחר כאן',
  option: 'מתצורת התוסף',
  none: 'לא הוגדר',
};
export const REASON_TEXT: Record<NonNullable<VideoServicesView['reason']>, string> = {
  no_supervisor: 'בהתקנה הזאת אי אפשר לזהות שירותי וידאו; הכתובת נקבעת בתצורת התוסף.',
  forbidden: 'אין הרשאה לקרוא את רשימת השירותים המותקנים.',
  unreachable: 'רשימת השירותים המותקנים אינה זמינה כרגע.',
};

/** The sw-badge kind of a candidate: running and answering = live, running but not answering = stale, stopped = neutral. */
export function candidateKind(c: VideoServiceCandidate): 'live' | 'stale' | 'neutral' | 'error' {
  if (c.state === 'started') return c.probe === 'ok' || c.probe === 'auth_required' ? 'live' : 'stale';
  if (c.state === 'error') return 'error';
  return 'neutral';
}

/** One line under the name: state · probe · version. */
export function candidateLine(c: VideoServiceCandidate): string {
  const parts = [STATE_LABEL[c.state] ?? STATE_LABEL.unknown];
  if (c.state === 'started') parts.push(PROBE_LABEL[c.probe] ?? PROBE_LABEL.not_probed);
  const v = c.go2rtc_version || c.version;
  if (v) parts.push(`גרסה ${v}`);
  return parts.join(' · ');
}

/** "Use this" is offered for a candidate that is not the one in use and has an address; a stopped one is allowed (it may be started later). */
export const canUse = (c: VideoServiceCandidate): boolean => !c.current && !!c.address;

/** In use first, then running and answering, then running, then the rest; name order within. */
export function sortCandidates(list: VideoServiceCandidate[]): VideoServiceCandidate[] {
  const rank = (c: VideoServiceCandidate) => (c.current ? 0 : c.state === 'started' ? (c.probe === 'ok' || c.probe === 'auth_required' ? 1 : 2) : 3);
  return [...list].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'he'));
}

/** The confirmation before switching: what changes, in plain words. */
export function confirmText(c: VideoServiceCandidate): string {
  const tail = c.state === 'started' ? '' : ' השירות כבוי כרגע: הווידאו יחזור רק אחרי שיופעל.';
  return `לעבור לשירות הווידאו "${c.name}"? כל הווידאו החי וההקלטות יעברו דרכו מיד; הבחירה גוברת על הכתובת שבתצורת התוסף.${tail}`;
}
