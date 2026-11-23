/**
 * ONVIF-UI-2500: the pure rules of "חיפוש מצלמות ברשת" - the range check before sending (the server's clamp decides), what a found
 * device is and whether it can be chosen (Q58: behind the recorder / already added - marked, never selectable; Q59: a recorder is
 * offered to the recorder wizard), the state line of an identification press, the one-attempt rule (Q57: a pair a camera refused is
 * not sent to it again; the row's own password has to change first), the suggested streams, the add step's default name, the words of
 * a refusal (never the server's code) and the pages of a list (control screens never scroll).
 */
import type { AddResult, FoundDevice, MediaProfile, ScanJob } from '../api/camera-discovery';
import { cdt, type CdKey } from '../i18n/camera-discovery';
import { ltrIsolate } from '../i18n/bidi';

export type Step = 'scan' | 'identify' | 'add';
export type Tone = 'ok' | 'warn' | 'bad' | 'muted' | 'accent';

/** The example range of the hint (RFC 5737 documentation range: never a real network). */
const RANGE_EXAMPLE = '192.0.2.0/24';

/** The number of addresses of an IPv4 `a.b.c.d/len` range, or null when it is not one. */
export function cidrSize(range: string): number | null {
  const m = /^\s*(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})\s*$/.exec(range);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  const len = Number(m[5]);
  if (octets.some((o) => o > 255) || len > 32) return null;
  return 2 ** (32 - len);
}

/** The line under the range field: how many addresses, or why it cannot be sent. Empty = the server's suggestion. */
export function rangeCheck(range: string, max: number): { ok: boolean; text: string; tone: Tone } {
  if (!range.trim()) return { ok: true, text: '', tone: 'muted' };
  const n = cidrSize(range);
  if (n === null) return { ok: false, text: cdt('rangeBad', { example: ltrIsolate(RANGE_EXAMPLE) }), tone: 'bad' };
  if (max > 0 && n > max) return { ok: false, text: cdt('rangeTooLarge', { n: n.toLocaleString('en-US'), max: max.toLocaleString('en-US') }), tone: 'bad' };
  return { ok: true, text: cdt('rangeCount', { n: n.toLocaleString('en-US') }), tone: 'muted' };
}

/** 0..100 of the sweep. */
export function progressPct(job: Pick<ScanJob, 'progress' | 'state'> | null): number {
  if (!job) return 0;
  if (job.state !== 'running') return 100;
  const { checked, total } = job.progress;
  return total > 0 ? Math.max(0, Math.min(100, Math.round((checked / total) * 100))) : 0;
}

/** camera / recorder / unknown - the three kinds of the results list. */
type RowClass = 'camera' | 'recorder' | 'unknown';
export function rowClass(d: Pick<FoundDevice, 'kind' | 'known'>): RowClass {
  if (d.kind === 'nvr' || d.known === 'recorder') return 'recorder';
  return d.kind === 'camera' ? 'camera' : 'unknown';
}

export const KIND_TEXT: Record<RowClass, CdKey> = { camera: 'kindCamera', recorder: 'kindRecorder', unknown: 'kindUnknown' };

/** Can the device be ticked at all (identify, then add)? The server's own `addable` (never a recorder, never a known camera, has a service). */
export function selectable(d: Pick<FoundDevice, 'addable' | 'known' | 'kind' | 'has_service'>): boolean {
  return d.addable && d.known === 'none' && d.kind !== 'nvr' && d.has_service;
}

/** The mark of a device that is not offered as a new camera, with its reason (Q58 / Q59). */
export function rowMark(d: Pick<FoundDevice, 'known' | 'kind' | 'has_service' | 'recorder_prefill'>): { key: CdKey; note: CdKey | null; tone: Tone } | null {
  if (d.known === 'behind_recorder') return { key: 'markBehind', note: 'markBehindNote', tone: 'muted' };
  if (d.known === 'standalone') return { key: 'markStandalone', note: null, tone: 'accent' };
  if (d.known === 'recorder') return { key: 'markOwnRecorder', note: null, tone: 'muted' };
  if (d.kind === 'nvr') return { key: 'markLooksRecorder', note: 'recorderNote', tone: 'muted' };
  if (!d.has_service) return { key: 'noService', note: 'noStreamNote', tone: 'warn' };
  return null;
}

/** "הוספה כמקליט" is offered only for a device that looks like a recorder and is not this installation's own (Q59). */
export const offersRecorder = (d: Pick<FoundDevice, 'kind' | 'known' | 'recorder_prefill'>): boolean =>
  d.kind === 'nvr' && d.known !== 'recorder' && !!d.recorder_prefill;

/** The profiles whose stream address can be used. */
export const usableProfiles = (d: Pick<FoundDevice, 'profiles'>): MediaProfile[] => d.profiles.filter((p) => p.stream === 'ok');

/** Identified with at least one usable stream: it can go on to the add step. */
export const readyToAdd = (d: FoundDevice): boolean => selectable(d) && d.auth === 'ok' && usableProfiles(d).length > 0;

/** The state line of the last identification press. */
export function authState(d: FoundDevice): { text: string; tone: Tone; note: string } {
  switch (d.auth) {
    case 'ok': {
      const n = usableProfiles(d).length;
      if (!n) return { text: cdt('noStream'), tone: 'warn', note: cdt('noStreamNote') };
      return { text: cdt('authOk', { n }), tone: 'ok', note: streamsLine(d) };
    }
    case 'wrong_password':
      return { text: cdt('authWrong'), tone: 'bad', note: cdt('authWrongNote') };
    case 'locked_guard':
      return { text: cdt('authLocked'), tone: 'bad', note: cdt('authLockedNote') };
    case 'digest_required':
      return { text: cdt('authDigest'), tone: 'warn', note: cdt('noStreamNote') };
    case 'busy':
      return { text: cdt('authBusy'), tone: 'warn', note: '' };
    case 'no_answer':
      return { text: cdt('authNoAnswer'), tone: 'warn', note: '' };
    case 'not_onvif':
      return { text: cdt('authNotOnvif'), tone: 'warn', note: cdt('noStreamNote') };
    case 'skipped':
      return { text: cdt('authSkipped'), tone: 'muted', note: '' };
    default:
      return { text: cdt('authNotTried'), tone: 'muted', note: '' };
  }
}

/** A pair as the wizard remembers which one a camera was last sent (memory only, never sent or stored anywhere else). */
export const pairKey = (user: string, password: string): string => `${user}\u0001${password}`;

/** States after which another press can help (a refused pair only with a changed password - `retryAllowed`). */
const WAITING = new Set<FoundDevice['auth']>(['not_tried', 'no_answer', 'busy']);

/**
 * The devices one press of the bulk "זיהוי" sends: ticked, selectable, not identified yet, not stopped by the lockout guard, and -
 * Q57 - never a camera that already refused the very pair being typed (`tried` holds the pair last sent to each device).
 */
export function identifyTargets(devs: FoundDevice[], selected: ReadonlySet<string>, tried: ReadonlyMap<string, string>, pair: string): string[] {
  return devs
    .filter((d) => selected.has(d.id) && selectable(d))
    .filter((d) => WAITING.has(d.auth) || (d.auth === 'wrong_password' && tried.get(d.id) !== pair))
    .map((d) => d.id);
}

/** Why the bulk press is not possible now ('' = it is). */
export function identifyBlock(targets: string[], user: string, password: string, sameForAll: boolean): '' | 'none' | 'creds' | 'same' {
  if (!targets.length) return 'none';
  if (!user.trim() || !password) return 'creds';
  if (targets.length > 1 && !sameForAll) return 'same';
  return '';
}

/** The row's own "ניסיון" after a wrong password: only with a password typed and different from the one it refused. */
export function retryAllowed(d: FoundDevice, user: string, rowPassword: string, tried: ReadonlyMap<string, string>): boolean {
  if (d.auth !== 'wrong_password' || !selectable(d)) return false;
  if (!user.trim() || !rowPassword) return false;
  return tried.get(d.id) !== pairKey(user, rowPassword);
}

/** `1920×1080 · H.264` (the resolution one left-to-right run: in a right-to-left line `1920×1080` was drawn as `1080×1920`). */
export function profileLabel(p: MediaProfile): string {
  const res = p.width && p.height ? ltrIsolate(`${p.width}×${p.height}`) : '';
  const codec = p.codec ? CODEC[p.codec] : '';
  return [res, codec].filter(Boolean).join(' · ') || ltrIsolate(p.name ?? p.token);
}
const CODEC: Record<NonNullable<MediaProfile['codec']>, string> = { h264: 'H.264', h265: 'H.265', mjpeg: 'MJPEG', mpeg4: 'MPEG-4', other: '' };

/** The suggested main and sub profiles (design 4.2 step 3), each a usable one or null. */
export function suggestedPair(d: FoundDevice): { main: string | null; sub: string | null } {
  const usable = usableProfiles(d);
  const has = (t: string | null) => !!t && usable.some((p) => p.token === t);
  const main = has(d.suggested.main) ? d.suggested.main : usable[0]?.token ?? null;
  const sub = has(d.suggested.sub) && d.suggested.sub !== main ? d.suggested.sub : null;
  return { main, sub };
}

/** "ראשי 2688×1520 · H.265 · משני 640×360 · H.264" for the identified row. */
export function streamsLine(d: FoundDevice): string {
  const { main, sub } = suggestedPair(d);
  const byToken = (t: string | null) => d.profiles.find((p) => p.token === t);
  const m = byToken(main);
  const s = byToken(sub);
  if (!m) return '';
  return s ? cdt('mainSub', { main: profileLabel(m), sub: profileLabel(s) }) : cdt('mainOnly', { main: profileLabel(m) });
}

/** The default name of the add step (design 4.5): `<maker> <model> - <last octet>`. */
export function defaultName(d: Pick<FoundDevice, 'manufacturer' | 'model' | 'name' | 'address'>): string {
  const octet = d.address.split('.').pop() ?? d.address;
  const what = [d.manufacturer, d.model].filter(Boolean).join(' ').trim() || d.name?.trim() || cdt('kindCamera');
  return `${what} - ${octet}`.slice(0, 120);
}

/** The camera's clock line when it is more than two minutes off (evidence, never corrected; design section 9). */
export function clockNote(offset: number | null): string {
  if (offset === null || Math.abs(offset) < 120) return '';
  return cdt('clockOff', { min: Math.round(Math.abs(offset) / 60) });
}

/** An H.265 main gets the existing hint (live view through the sub stream). */
export const needsH265Note = (d: FoundDevice, mainToken: string | null): boolean => d.profiles.find((p) => p.token === mainToken)?.codec === 'h265';

/** One page of a list (pages are 1-based; an out-of-range page is clamped). */
export function pageSlice<T>(list: readonly T[], page: number, size: number): { items: T[]; page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(list.length / Math.max(1, size)));
  const p = Math.min(Math.max(1, page), pages);
  return { items: list.slice((p - 1) * size, p * size), page: p, pages };
}

/** Rows per page so that the dialog never scrolls: by the step and the room the viewport gives. */
export function pageSize(step: Step, phone: boolean, viewportHeight: number): number {
  if (step === 'add') return phone ? 1 : viewportHeight >= 860 ? 4 : viewportHeight >= 720 ? 3 : 2; // the phone steps through one camera at a time
  if (phone) return viewportHeight >= 800 ? 3 : 2;
  return viewportHeight >= 860 ? 5 : viewportHeight >= 820 ? 4 : 3; // 1024x768 (a tablet) showed 4 rows overflow the body by 36px
}

/** The identification step's summary line. */
export function identifySummary(devs: FoundDevice[], selected: ReadonlySet<string>): { ok: number; waiting: number; bad: number } {
  const mine = devs.filter((d) => selected.has(d.id) && selectable(d));
  const ok = mine.filter(readyToAdd).length;
  const waiting = mine.filter((d) => d.auth === 'not_tried').length;
  return { ok, waiting, bad: mine.length - ok - waiting };
}

const ERROR_KEY: Record<string, CdKey> = {
  range_invalid: 'errRangeInvalid',
  range_too_large: 'errRangeTooLarge',
  range_refused: 'errRangeRefused',
  site_network_unknown: 'errSiteUnknown',
  scan_running: 'errRunning',
  scan_not_found: 'errGone',
  scan_not_active: 'errGone',
  discovery_off: 'errOff',
  webrtc_server_required: 'errMedia',
  media_not_configured: 'errMedia',
  credentials_invalid: 'errCreds',
  same_for_all_required: 'errSameForAll',
  device_unknown: 'errDeviceUnknown',
  forbidden: 'errForbidden',
};

interface ErrLike {
  status?: unknown;
  code?: unknown;
  body?: { details?: Record<string, unknown> };
}

/** The server's code of a refused call ('' when it is not one). */
export function errorCode(err: unknown): string {
  return typeof err === 'object' && err !== null && 'code' in err ? String((err as ErrLike).code ?? '') : '';
}

/** A refused or failed call, in words (never the server's code). `max` fills the range cap; 429 says when to try again. */
export function discoveryErrorText(err: unknown, max = 1024): string {
  const e = (typeof err === 'object' && err !== null ? err : {}) as ErrLike;
  const status = Number(e.status ?? 0);
  const code = errorCode(err);
  if (status === 429 || code === 'rate_limited') {
    const s = Number(e.body?.details?.retry_after_s ?? 0);
    return s > 0 ? cdt('errRate', { s }) : cdt('errRateSoon');
  }
  if (ERROR_KEY[code]) return cdt(ERROR_KEY[code], { max: max.toLocaleString('en-US') });
  if (status === 403) return cdt('errForbidden');
  return cdt('errGeneric');
}

const ADD_KEY: Record<string, CdKey> = {
  behind_recorder: 'failBehind',
  is_recorder: 'failRecorder',
  already_added: 'failAlready',
  not_identified: 'failNotIdentified',
  no_stream: 'failNoStream',
  profile_unknown: 'failProfile',
  device_duplicate: 'failDuplicate',
  device_unknown: 'errDeviceUnknown',
  standalone_limit: 'failLimit',
  source_not_allowed: 'failNotAllowed',
  source_not_supported: 'failNotAllowed',
  area_invalid: 'failArea',
  name_required: 'failName',
};

/** A camera the add step refused, in words: the catalogue's text for a known code, else the server's own fixed text. */
export function addFailureText(f: { code: string; message: string }): string {
  return ADD_KEY[f.code] ? cdt(ADD_KEY[f.code]) : f.message || cdt('errGeneric');
}

/** The answer card after "הוספה". */
export function addSummary(r: AddResult): { tone: Tone; title: string } {
  const added = r.added.length;
  const total = added + r.failed.length;
  if (!added) return { tone: 'bad', title: cdt('noneAdded') };
  if (!r.failed.length) return { tone: 'ok', title: cdt('doneTitle', { n: added }) };
  return { tone: 'warn', title: cdt('partialTitle', { added, total }) };
}

/** Merge the devices of an identification answer into the scan's list (same order, answered rows replaced). */
export function mergeDevices(list: FoundDevice[], answered: FoundDevice[]): FoundDevice[] {
  const by = new Map(answered.map((d) => [d.id, d]));
  return list.map((d) => by.get(d.id) ?? d);
}

/** The newest running scan of a list (to find it again after a reload), or null. */
export function runningScan<T extends { state: string; started_at: string }>(scans: T[]): T | null {
  return scans.filter((s) => s.state === 'running').sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
}
