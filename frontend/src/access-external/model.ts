/**
 * SHAREDID-293: the pure logic of the external-access screen - what a grant looks like on the screen (owner decision 2: "Active -
 * verified" only when the server says it holds read-back proof), its bucket, the ladder, the per-door state, the filters, the window
 * narrowing of the approval dialog (in the installation's IANA zone, DST-safe) and the reference rules. No DOM, no network: unit-tested.
 */
import type { Grant, GrantState } from '../api/access-grants';
import { dateInZone, instantInZone, minuteInZone } from '../api/recordings';

export type UiState = 'draft' | 'pending' | 'pushing' | 'verified' | 'accepted' | 'sync' | 'unknown' | 'revoking' | 'revoked' | 'ended' | 'refused' | 'failed' | 'gone';
export type Bucket = 'attention' | 'waiting' | 'moving' | 'active' | 'history';
export type Filter = Bucket | 'live';
export type Tone = 'ok' | 'acc' | 'warn' | 'err' | 'off';
export const BUCKETS: Bucket[] = ['attention', 'waiting', 'moving', 'active', 'history'];
export const LIVE_STATES: GrantState[] = ['requested', 'approved', 'provisioning', 'active', 'revoking', 'unknown'];
const FAILED_ATTENTION_MS = 7 * 24 * 3600_000;

/** What the screen shows for a grant. "verified" ONLY from the server's `scope_verified` (stored read-back proof). */
export function uiState(g: Grant): UiState {
  if (g.closure && !g.closure.reappeared_at && g.state !== 'revoking') return 'gone';
  switch (g.state) {
    case 'requested':
      return g.person.pending ? 'draft' : 'pending';
    case 'approved':
    case 'provisioning':
      return 'pushing';
    case 'active':
      return g.needs_push ? 'sync' : g.scope_verified === true ? 'verified' : 'accepted';
    case 'unknown':
      return 'unknown';
    case 'revoking':
      return 'revoking';
    case 'ended':
      return 'ended';
    case 'revoked':
      return 'revoked';
    case 'refused':
      return 'refused';
    default:
      return 'failed';
  }
}

export const STATE_TONE: Record<UiState, Tone> = {
  draft: 'off', pending: 'acc', pushing: 'acc', verified: 'ok', accepted: 'ok', sync: 'warn', unknown: 'warn',
  revoking: 'err', revoked: 'off', ended: 'off', refused: 'off', failed: 'err', gone: 'off',
};

export const STATE_ICON: Record<UiState, string> = {
  draft: 'edit', pending: 'clock', pushing: 'refresh', verified: 'check', accepted: 'check', sync: 'refresh', unknown: 'help',
  revoking: 'bell', revoked: 'lock', ended: 'clock', refused: 'close', failed: 'warning', gone: 'user',
};

export function bucketOf(g: Grant, now = Date.now()): Bucket {
  const s = uiState(g);
  if (s === 'revoking' || s === 'unknown') return 'attention';
  if (s === 'failed') {
    const at = Date.parse(g.ended_at ?? g.updated_at ?? '');
    return Number.isFinite(at) && now - at < FAILED_ATTENTION_MS ? 'attention' : 'history';
  }
  if (s === 'draft' || s === 'pending' || g.pending_amendment) return 'waiting';
  if (s === 'pushing') return 'moving';
  if (s === 'verified' || s === 'accepted' || s === 'sync') return 'active';
  return 'history';
}

export function counts(grants: Grant[], now = Date.now()): Record<Bucket, number> {
  const out: Record<Bucket, number> = { attention: 0, waiting: 0, moving: 0, active: 0, history: 0 };
  for (const g of grants) out[bucketOf(g, now)] += 1;
  return out;
}

export interface Query {
  filter: Filter;
  q: string;
  station: string;
  source: string;
}

export function visible(grants: Grant[], query: Query, now = Date.now()): Grant[] {
  const needle = query.q.trim().toLowerCase();
  return grants.filter((g) => {
    const b = bucketOf(g, now);
    if (query.filter === 'live' ? b === 'history' : b !== query.filter) return false;
    if (query.station && !g.doors.some((d) => d.station_id === query.station)) return false;
    if (query.source && g.source !== query.source) return false;
    if (needle) {
      const hay = [g.person.name ?? '', g.source_ref ?? ''].join(' ').toLowerCase();
      if (!hay.includes(needle)) return false;
    }
    return true;
  });
}

/** The stations named in the grants (the station filter's choices), by name. */
export function stationsOf(grants: Grant[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const g of grants) for (const d of g.doors) if (!seen.has(d.station_id)) seen.set(d.station_id, d.name);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Why the grant is where it is: an i18n key (`why_*`). */
export function whyKey(g: Grant): string {
  const s = uiState(g);
  if (s === 'revoking') {
    if (g.closure?.reappeared_at) return 'why_reopened';
    if (g.link?.state === 'wiskey_missing') return 'why_revoking_missing';
    if (g.create_unresolved) return 'why_revoking_unresolved';
    if (g.link?.origin === 'matched') return 'why_revoking_notours';
    return 'why_revoking';
  }
  if ((s === 'accepted' || s === 'verified') && g.pending_amendment) return 'why_widening';
  return `why_${s}`;
}

export type StepMark = 'done' | 'cur' | 'unk' | 'stop' | 'no';

/** The ladder (where the grant / the revocation honestly stands): the step keys and a mark per step. */
export function ladder(g: Grant): { revoke: boolean; steps: { key: string; mark: StepMark }[] } {
  const s = uiState(g);
  const grantKeys = ['lad_requested', 'lad_approved', 'lad_sent', 'lad_accepted', 'lad_verified'];
  const revokeKeys = ['lad_decided', 'lad_written', 'lad_clean', 'lad_nothing'];
  const G: Partial<Record<UiState, StepMark[]>> = {
    draft: ['cur', 'no', 'no', 'no', 'no'], pending: ['done', 'cur', 'no', 'no', 'no'], pushing: ['done', 'done', 'cur', 'no', 'no'],
    accepted: ['done', 'done', 'done', 'done', 'no'], verified: ['done', 'done', 'done', 'done', 'done'], sync: ['done', 'done', 'cur', 'no', 'no'],
    unknown: ['done', 'done', 'unk', 'unk', 'no'], failed: ['done', 'done', 'stop', 'no', 'no'], refused: ['done', 'stop', 'no', 'no', 'no'],
  };
  const unproven = g.link?.state === 'wiskey_missing' || g.create_unresolved || g.link?.origin === 'matched';
  const R: Partial<Record<UiState, StepMark[]>> = {
    revoking: unproven ? ['done', 'unk', 'unk', 'no'] : ['done', 'done', 'cur', 'no'], revoked: ['done', 'done', 'done', 'done'], ended: ['done', 'done', 'done', 'done'],
    gone: ['done', 'unk', 'unk', 'no'],
  };
  const revoke = s in R;
  const marks = (revoke ? R[s] : G[s]) ?? (revoke ? ['no', 'no', 'no', 'no'] : ['no', 'no', 'no', 'no', 'no']);
  return { revoke, steps: (revoke ? revokeKeys : grantKeys).map((key, i) => ({ key, mark: marks[i] })) };
}

/** The state of each door row in the drawer: an i18n key and a tone. */
export function doorState(g: Grant): { key: string; tone: Tone } {
  const s = uiState(g);
  if (s === 'verified') return { key: 'dr_verified', tone: 'ok' };
  if (s === 'accepted') return { key: 'dr_accepted', tone: 'acc' };
  if (s === 'sync' || s === 'pushing') return { key: 'dr_desired', tone: 'acc' };
  if (s === 'unknown') return { key: 'dr_unknown', tone: 'warn' };
  if (s === 'draft' || s === 'pending') return { key: 'dr_proposed', tone: 'off' };
  if (s === 'revoking') return { key: unprovenRevoke(g) ? 'dr_unknown' : 'dr_removing', tone: unprovenRevoke(g) ? 'warn' : 'err' };
  return { key: 'dr_closed', tone: 'off' };
}

function unprovenRevoke(g: Grant): boolean {
  return g.link?.state === 'wiskey_missing' || g.create_unresolved || g.link?.origin === 'matched';
}

/** The code cell: an i18n key and a tone; null = the caller may not see the delivery state (below the sensitive level). */
export function codeOf(g: Grant): { key: string; tone: Tone } | null {
  if (g.code_state === null || g.code_state === undefined) return null;
  const map: Record<string, Tone> = { sent: 'ok', pending: 'acc', queued: 'acc', not_delivered: 'warn', unknown: 'warn', not_needed: 'off' };
  return { key: `code_${g.code_state}`, tone: map[g.code_state] ?? 'off' };
}

/** What the drawer offers in this state (the server checks every one again). */
export interface Actions {
  accept: boolean;
  refuse: boolean;
  approve: boolean;
  retry: boolean;
  rotate: boolean;
  revoke: boolean;
  gone: boolean;
  readNow: boolean;
}

export function actionsOf(g: Grant, systemAdmin: boolean): Actions {
  const s = uiState(g);
  return {
    accept: s === 'draft',
    refuse: s === 'pending' || (!!g.pending_amendment && ['accepted', 'verified', 'sync', 'pushing'].includes(s)),
    // ACCESSREQ-293, owner decision (a): whoever asked for the scope does not approve it (a system administrator may) - the server refuses anyway
    approve: (s === 'pending' || (!!g.pending_amendment && ['accepted', 'verified', 'sync', 'pushing'].includes(s))) && (!g.self_requested || systemAdmin),
    retry: g.state === 'approved',
    rotate: g.state === 'active' && g.credential === 'pin' && ['sent', 'not_delivered', 'unknown'].includes(g.code_state ?? '') && (g.code_sends ?? 0) < 3,
    revoke: ['pushing', 'accepted', 'verified', 'sync', 'unknown'].includes(s),
    gone: systemAdmin && s === 'revoking' && g.link?.state === 'wiskey_missing',
    readNow: s === 'unknown' || s === 'revoking' || s === 'accepted' || s === 'verified',
  };
}

// ---------------------------------------------------------------- dates (the installation's zone)

export function localDate(iso: string, tz: string): string {
  return dateInZone(new Date(iso), tz);
}

/** The last calendar day a window covers (its end is exclusive). */
export function lastDay(validUntil: string, tz: string): string {
  return dateInZone(new Date(Date.parse(validUntil) - 1000), tz);
}

/** "22.10" or "22.10-23.10" in the installation's zone. */
export function datesText(validFrom: string, validUntil: string, tz: string): string {
  const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  const a = localDate(validFrom, tz);
  const b = lastDay(validUntil, tz);
  return a === b ? dm(a) : `${dm(a)}-${dm(b)}`;
}

export function hoursText(g: Pick<Grant, 'timing' | 'valid_from' | 'valid_until'>, tz: string): string {
  const periods = g.timing?.periods ?? [];
  if (periods.length) return periods.map((p) => `${p.start}-${p.end}`).join(', ');
  const hm = (iso: string) => {
    const m = Math.round(minuteInZone(new Date(iso), tz));
    return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  };
  return `${hm(g.valid_from)}-${hm(g.valid_until)}`;
}

function addDays(date: string, n: number): string {
  const t = Date.UTC(Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10))) + n * 86400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export function daysBetween(from: string, until: string): number {
  return Math.round((Date.UTC(+until.slice(0, 4), +until.slice(5, 7) - 1, +until.slice(8, 10)) - Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10))) / 86400_000) + 1;
}

export type WindowError = 'before' | 'too_long' | 'outside' | null;

/**
 * The approval dialog may only NARROW the requested window (the server refuses anything wider): the approver picks a first and a last day
 * among the requested ones; the times of day stay the requested ones. Returns the instants to send (unchanged when the days are), or the
 * error. DST-safe: each local day + minute is resolved in the zone.
 */
export function narrowWindow(validFrom: string, validUntil: string, fromDay: string, untilDay: string, tz: string, maxDays: number): { valid_from: string; valid_until: string; days: number; error: WindowError } {
  const rf = localDate(validFrom, tz);
  const ru = lastDay(validUntil, tz);
  const days = daysBetween(fromDay, untilDay);
  let error: WindowError = null;
  if (!fromDay || !untilDay || untilDay < fromDay) error = 'before';
  else if (fromDay < rf || untilDay > ru) error = 'outside';
  else if (days > maxDays) error = 'too_long';
  const startMin = minuteInZone(new Date(validFrom), tz);
  const endMin = minuteInZone(new Date(validUntil), tz);
  const vf = fromDay === rf ? validFrom : iso(instantInZone(fromDay, startMin, tz));
  let vu = validUntil;
  if (untilDay !== ru) vu = endMin === 0 ? iso(instantInZone(addDays(untilDay, 1), 0, tz)) : iso(instantInZone(untilDay, endMin, tz));
  return { valid_from: vf, valid_until: vu, days: Math.max(days, 0), error };
}

function iso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// ---------------------------------------------------------------- references (mirrors of the server's rules)

/** The "confirmed gone" reference: 8..128 characters, no phone number (seven or more digits in a row). */
export function goneReferenceOk(text: string): boolean {
  const ref = text.split(/\s+/).filter(Boolean).join(' ');
  return ref.length >= 8 && ref.length <= 128 && !/\d[\d\s\-.]{6,}\d/.test(ref);
}

/** The attach evidence reference (the helper's own pattern): ASCII, 8..128, starting with a letter or a digit. */
export function evidenceRefOk(text: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9:._/-]{7,127}$/.test(text);
}

export function durationText(minutes: number, lang: string): string {
  const h = Math.floor(minutes / 60);
  const m = Math.max(0, Math.round(minutes % 60));
  const u = { he: ['ש׳', 'ד׳'], en: ['h', 'min'], ar: ['س', 'د'], ru: ['ч', 'мин'] }[lang as 'he'] ?? ['h', 'min'];
  return h ? `${h} ${u[0]} ${m} ${u[1]}` : `${m} ${u[1]}`;
}

/** The derived timeline of a grant (the server keeps ids-only audit rows; the instants on the row tell the story). */
export function timeline(g: Grant): { at: string; key: string; tone: Tone; vars?: Record<string, string> }[] {
  const out: { at: string; key: string; tone: Tone; vars?: Record<string, string> }[] = [];
  if (g.created_at) out.push({ at: g.created_at, key: 'ev_created', tone: 'acc' });
  if (g.approved_at) out.push(g.approved_by_name ? { at: g.approved_at, key: 'ev_approved', tone: 'ok', vars: { name: g.approved_by_name } } : { at: g.approved_at, key: 'ev_approvedAnon', tone: 'ok' });
  if (g.scope_verified && g.scope_verified_at) out.push({ at: g.scope_verified_at, key: 'ev_verified', tone: 'ok' });
  if (g.revoking_since) out.push({ at: g.revoking_since, key: 'ev_revoking', tone: 'err', vars: { reason: g.end_reason ?? 'manual' } });
  if (g.closure) out.push({ at: g.closure.closed_at, key: 'ev_closed', tone: 'off', vars: { name: g.closure.closed_by_name ?? '-' } });
  if (g.closure?.reappeared_at) out.push({ at: g.closure.reappeared_at, key: 'ev_reappeared', tone: 'err' });
  if (g.ended_at && !g.closure) out.push({ at: g.ended_at, key: 'ev_ended', tone: 'off' });
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** The weekday names start on Sunday (0), the installation's digest day. */
export const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
