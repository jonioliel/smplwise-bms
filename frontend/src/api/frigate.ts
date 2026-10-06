/** NN5-F1B: the Frigate provider's client (phase F1, "see and play": read-only against Frigate).
 * Server: `routers/frigate.py` of pilot/NN5-F1A-backend (read at 0edf1bad, not yet published to origin when this was written):
 *   GET  frigate/recorders                          names only
 *   GET  frigate/{rid}/status                       version, discovered features, retention, detectors, sync, live mode
 *   GET  frigate/{rid}/cameras                      Arx's cameras of that recorder (key, name, enabled, frigate_enabled)
 *   GET  frigate/{rid}/reviews?severity&camera_id&reviewed&from&to&before&limit    alert / detection items, per-user `reviewed`
 *   GET  frigate/{rid}/reviews/summary?days          counts per severity (total / unreviewed)
 *   GET  frigate/{rid}/reviews/{id}                  one item (+ detection count)
 *   POST frigate/{rid}/reviews/reviewed {ids, reviewed}       the caller's state, Arx only
 *   GET  frigate/{rid}/activity?from&to             the MOTION layer (30 s buckets, at most 24 h)
 *   GET  cameras/{id}/snapshot.jpg                   the latest still (existing route; a Frigate camera is served by its adapter)
 * and `recorder-health` cards carry `vendor_details` for a Frigate recorder. This file turns those wire shapes into the UI model
 * below (ReviewItem, ReviewList, FrigateCapabilities, FrigateHealth) so a change of the server contract is a change HERE only.
 * Everything else is pure helpers; the screens only render. Times are UTC ISO strings, shown in the site's zone by the screens. */
import { ApiError, apiUrl, get, post, resourceUrl } from './client';
import { isApi } from './session';
import type { Camera } from './types';
import { he } from '../i18n/he';

// ---- what a recorder offers (the capability summary) ----

/** Discovered abilities (`status.features`): never version guesses. `null` = unknown (the viewer role could not read the document). */
export type FrigateFeature = 'review_items' | 'object_events' | 'timeline' | 'snapshots_latest' | 'recordings' | 'hls_playback' | 'restream' | 'search_text' | 'search_semantic' | 'audio_events' | 'faces' | 'lpr' | 'genai';

export interface FrigateDetector {
  name: string;
  /** cpu | edgetpu | openvino | tensorrt | ... as Frigate names it (absent in the health reading) */
  type?: string;
  inference_ms?: number | null;
}

/** What the recorder's retention does: `motion` keeps only segments with motion, `all` is continuous, `events` keeps only around alerts / detections. */
export type RecordingMode = 'all' | 'motion' | 'events' | 'off' | 'unknown';

export interface FrigateCapabilities {
  /** Frigate's own version string (a test before saving knows only this and the camera count) */
  version?: string | null;
  cameras?: { total: number; enabled: number; disabled: number };
  detectors?: FrigateDetector[];
  features?: Partial<Record<FrigateFeature, boolean | null>>;
  retention?: { mode: RecordingMode; days?: number | null; alert_days?: number | null };
  /** `true` when Frigate offers a restream the live wall could use; `false` = still tiles only (the F1 default). */
  restream?: boolean;
}

/** The feature rows in screen order. */
export const FEATURE_ORDER: FrigateFeature[] = ['review_items', 'object_events', 'timeline', 'recordings', 'hls_playback', 'snapshots_latest', 'restream', 'search_text', 'search_semantic', 'audio_events', 'faces', 'lpr', 'genai'];
/** Always listed (on or off); the rest only when the server reported them. */
export const FEATURE_CORE: FrigateFeature[] = ['review_items', 'object_events', 'recordings', 'hls_playback', 'snapshots_latest'];

export const featureLabel = (f: string): string => (he.frigate.features as Record<string, string>)[f] ?? f;

/** `all | motion | events | off | unknown` from the retention block of `status` (the server's `recording_policy`, same rule). */
export function recordingMode(r: Record<string, unknown> | null | undefined): RecordingMode {
  if (!r || !Object.keys(r).length) return 'unknown';
  const n = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0);
  if (r.record_enabled === false) return 'off';
  if (n('continuous_days') > 0) return 'all';
  if (n('motion_days') > 0) return 'motion';
  if (n('alerts_days') > 0 || n('detections_days') > 0) return 'events';
  return 'unknown';
}

/** The days the mode keeps, rounded; null when not reported. */
function retentionDays(r: Record<string, unknown>, mode: RecordingMode): number | null {
  const key = mode === 'all' ? 'continuous_days' : mode === 'motion' ? 'motion_days' : mode === 'events' ? 'alerts_days' : '';
  const v = key ? r[key] : null;
  return typeof v === 'number' ? Math.round(v * 10) / 10 : null;
}

/** One line for the retention row: "הקלטה על תנועה בלבד · 10 ימים". */
export function retentionText(r: NonNullable<FrigateCapabilities['retention']>): string {
  const s = he.frigate.summary;
  const mode = r.mode === 'all' ? s.retentionAll : r.mode === 'events' ? s.retentionEvents : r.mode === 'motion' ? s.retentionMotion : r.mode === 'off' ? s.retentionOff : '';
  return [mode, r.days != null && r.mode !== 'off' ? `${r.days} ${s.days}` : null].filter(Boolean).join(' · ');
}

/** Rows of the summary card, ready to render: only what is known. Pure so the unit tests pin the wording. */
export function summaryRows(c: FrigateCapabilities): { key: string; label: string; value: string }[] {
  const s = he.frigate.summary;
  const rows: { key: string; label: string; value: string }[] = [];
  if (c.version) rows.push({ key: 'version', label: s.version, value: c.version });
  if (c.cameras) rows.push({ key: 'cameras', label: s.cameras, value: `${c.cameras.enabled} ${s.camerasOf} ${c.cameras.total}${c.cameras.disabled ? ` · ${c.cameras.disabled} ${s.disabled}` : ''}` });
  if (c.detectors) {
    const extra = (d: FrigateDetector) => [d.type, d.inference_ms != null ? `${Math.round(d.inference_ms)} ${he.frigate.health.inference}` : null].filter(Boolean).join(', ');
    const text = c.detectors.length ? c.detectors.map((d) => (extra(d) ? `${d.name} (${extra(d)})` : d.name)).join(', ') : s.noDetectors;
    rows.push({ key: 'detectors', label: s.detectors, value: text });
  }
  if (c.retention) {
    const text = retentionText(c.retention);
    if (text) rows.push({ key: 'retention', label: s.retention, value: text });
  }
  return rows;
}

// ---- the wire (F1A) ----

interface WireRecorder {
  id: string;
  name: string;
  enabled: boolean;
  firmware: string | null;
}

export interface WireStatus {
  version: string | null;
  version_ok: boolean;
  features: Partial<Record<FrigateFeature, boolean | null>>;
  retention: Record<string, unknown> | null;
  detectors: { name: string; type: string }[] | null;
  cameras: number;
  sync?: { last_poll_error?: string | null; ws_state?: string | null } | null;
  live?: { mode: 'still' | 'restream' };
}

export interface WireCamera {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  frigate_enabled: boolean;
}

interface WireReview {
  id: string;
  recorder_id: string;
  camera_id: string | null;
  camera_key: string;
  camera_name?: string;
  severity: 'alert' | 'detection';
  start: string;
  end: string | null;
  open: boolean;
  duration_s: number | null;
  objects: string[];
  zones: string[];
  sub_labels?: string[];
  detections?: number;
  reviewed: boolean | null;
  /** an absolute server path (`/api/v1/frigate/{rid}/reviews/{id}/thumbnail`), never a Frigate URL */
  thumbnail: string;
}

interface WireSummary {
  severity: Record<string, { total: number; unreviewed: number }>;
  unreviewed_by_camera: Record<string, number>;
}

interface WireActivity {
  buckets: { start: number; motion: number; cameras: string[] }[];
}

/** The wire answers are small and change slowly: one minute of memory keeps a 30 s poll from asking three questions each time. */
const MEMO_MS = 60_000;
const memo = new Map<string, { at: number; value: Promise<unknown> }>();
function memoised<T>(key: string, make: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_MS) return hit.value as Promise<T>;
  const value = make();
  memo.set(key, { at: Date.now(), value });
  value.catch(() => memo.delete(key));
  return value;
}
/** Tests and a settings change forget what was remembered. */
export const forgetFrigate = (): void => memo.clear();

const missing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);

/** The enabled Frigate recorders; an older server without the route, or a caller who may not read recorders, has none. */
export async function frigateRecorders(): Promise<WireRecorder[]> {
  return memoised('recorders', async () => {
    try {
      return (await get<{ recorders: WireRecorder[] }>('frigate/recorders')).recorders.filter((r) => r.enabled);
    } catch (e) {
      if (missing(e) || (e instanceof ApiError && e.status === 403)) return [];
      throw e;
    }
  });
}

const statusOf = (rid: string) => memoised(`status:${rid}`, () => get<WireStatus>(`frigate/${encodeURIComponent(rid)}/status`));
const camerasOf = (rid: string) => memoised(`cameras:${rid}`, () => get<{ cameras: WireCamera[] }>(`frigate/${encodeURIComponent(rid)}/cameras`).then((r) => r.cameras));

/** What a saved recorder offers, from `status` and its camera list (the settings card). */
export async function recorderCapabilities(rid: string): Promise<FrigateCapabilities> {
  const [st, cams] = await Promise.all([get<WireStatus>(`frigate/${encodeURIComponent(rid)}/status`), get<{ cameras: WireCamera[] }>(`frigate/${encodeURIComponent(rid)}/cameras`).then((r) => r.cameras).catch(() => null)]);
  return capabilitiesOf(st, cams);
}

export function capabilitiesOf(st: WireStatus, cams: WireCamera[] | null): FrigateCapabilities {
  const mode = recordingMode(st.retention);
  const total = cams ? cams.length : st.cameras;
  const enabled = cams ? cams.filter((c) => c.enabled && c.frigate_enabled !== false).length : st.cameras;
  return {
    version: st.version,
    cameras: { total, enabled, disabled: total - enabled },
    detectors: (st.detectors ?? []).map((d) => ({ name: d.name, type: d.type })),
    features: st.features,
    retention: st.retention ? { mode, days: retentionDays(st.retention, mode), alert_days: typeof st.retention.alerts_days === 'number' ? (st.retention.alerts_days as number) : null } : undefined,
    restream: st.live?.mode === 'restream' || st.features?.restream === true,
  };
}

/** The connection test before saving knows the version text and the camera count only (the server's coarse answer). */
export function capabilitiesOfTest(t: { firmware?: string | null; channels?: number | null }): FrigateCapabilities {
  return { version: t.firmware ?? null, cameras: t.channels != null ? { total: t.channels, enabled: t.channels, disabled: 0 } : undefined };
}

// ---- health rows (the recorder health card, CR-026) ----

export interface FrigateHealthCamera {
  id: string;
  name: string;
  /** `camera_fps`; 0 with the camera enabled = no picture */
  fps: number | null;
  /** ok | off (disabled on purpose) | down (enabled, no picture) */
  state: 'ok' | 'off' | 'down';
  reconnects_last_hour?: number | null;
  stalls_last_hour?: number | null;
}

export interface FrigateHealth {
  detectors: (FrigateDetector & { skipped_fps?: number | null })[];
  cameras: FrigateHealthCamera[];
  storage: { hours_left: number | null; mb_per_hour?: number | null; free_pct?: number | null } | null;
  /** The recording policy keeps only part of the time: shown as partial coverage, never as "no recording" (AGENTS). */
  partial_coverage: boolean;
}

/** A detector is overloaded when Frigate skips frames. */
export const detectorOverloaded = (d: { skipped_fps?: number | null }): boolean => (d.skipped_fps ?? 0) > 0;

type VendorDetails = {
  detectors?: { name: string; inference_ms?: number | null }[];
  skipped_fps_total?: number | null;
  cameras?: { key: string; fps?: number | null; reconnects_last_hour?: number | null; stalls_last_hour?: number | null }[];
  storage?: { hours_left?: number | null; bandwidth_mb_per_h?: number | null } | null;
  recording_policy?: Record<string, unknown> | null;
};

/** The Frigate rows of a health card (`vendor_details` + the recorder's camera list for names and the disabled ones). */
export function frigateHealthOf(details: Record<string, unknown> | null | undefined, cams: { key: string; id: string; name: string; frigate_enabled: boolean }[], freePct?: number | null): FrigateHealth | null {
  if (!details) return null;
  const d = details as VendorDetails;
  const live = new Map((d.cameras ?? []).map((c) => [c.key, c]));
  const cameras: FrigateHealthCamera[] = [];
  for (const c of cams) {
    const w = live.get(c.key);
    if (w) cameras.push({ id: c.id, name: c.name, fps: w.fps ?? null, state: (w.fps ?? 0) > 0 ? 'ok' : 'down', reconnects_last_hour: w.reconnects_last_hour ?? null, stalls_last_hour: w.stalls_last_hour ?? null });
    else if (c.frigate_enabled === false) cameras.push({ id: c.id, name: c.name, fps: null, state: 'off' });
  }
  const skipped = d.skipped_fps_total ?? 0;
  const mode = recordingMode(d.recording_policy);
  return {
    detectors: (d.detectors ?? []).map((x) => ({ name: x.name, inference_ms: x.inference_ms ?? null, skipped_fps: skipped })),
    cameras,
    storage: d.storage ? { hours_left: d.storage.hours_left ?? null, mb_per_hour: d.storage.bandwidth_mb_per_h ?? null, free_pct: freePct ?? null } : null,
    partial_coverage: mode === 'motion' || mode === 'events',
  };
}

/** The health rows of one Frigate recorder: its camera list is read for names (a failure keeps the rows with the keys as names). */
export async function frigateHealthFor(rid: string, details: Record<string, unknown> | null | undefined, freePct?: number | null): Promise<FrigateHealth | null> {
  if (!details) return null;
  let cams: WireCamera[] = [];
  try {
    cams = await camerasOf(rid);
  } catch {
    /* names only: the rows still show */
  }
  const known = cams.length ? cams : ((details as VendorDetails).cameras ?? []).map((c) => ({ id: c.key, key: c.key, name: c.key, enabled: true, frigate_enabled: true }));
  return frigateHealthOf(details, known, freePct);
}

export function cameraHealthText(c: FrigateHealthCamera): string {
  const h = he.frigate.health;
  if (c.state === 'off') return h.cameraOff;
  if (c.state === 'down') return h.cameraDown;
  return c.fps != null ? `${Math.round(c.fps * 10) / 10} ${h.fps}` : h.cameraOk;
}

/** The storage row: hours left, or null when the recorder did not report one. */
export function hoursLeftText(s: FrigateHealth['storage']): string | null {
  if (!s || s.hours_left == null) return null;
  const hrs = s.hours_left;
  return hrs >= 48 ? `${Math.round(hrs / 24)} ${he.frigate.summary.days}` : `${Math.round(hrs)} ${he.frigate.health.hours}`;
}

/** Softer Arx threshold on the hours of recording left (the study: Frigate's own emergency cleanup is near 1 h). */
export function hoursLeftState(s: FrigateHealth['storage']): 'ok' | 'warn' | 'error' | 'unknown' {
  if (!s || s.hours_left == null) return 'unknown';
  return s.hours_left < 2 ? 'error' : s.hours_left < 24 ? 'warn' : 'ok';
}

// ---- review items ----

export type ReviewLayer = 'alert' | 'detection' | 'motion';
export const LAYERS: ReviewLayer[] = ['alert', 'detection', 'motion'];

export interface ReviewItem {
  id: string;
  recorder_id: string;
  camera_id: string;
  camera_name: string;
  /** UTC ISO instants; `end` null while the activity is still going */
  start: string;
  end: string | null;
  layer: ReviewLayer;
  /** normalised object labels: person, car, dog ... (a motion span has none) */
  objects: string[];
  zones: string[];
  /** the room / floor of the camera on the plan, when it is anchored (a review card says where, the study's appendix C) */
  area_name?: string | null;
  floor_name?: string | null;
  thumbnail: 'ready' | 'none';
  /** The still: an absolute address of the server's thumbnail route (or a ready-made picture in a fixture). */
  thumb_url?: string;
  /** per user (Arx-side state; Frigate keeps its own and is never written); a motion span has none */
  reviewed: boolean;
  /** The existing playback entry can open this item: absent = not yet (marked unavailable on the card). */
  playback?: { available: boolean; reason?: 'no_coverage' | 'not_ready' };
}

export interface ReviewList {
  /** false: the installation has no Frigate recorder - the screen falls back to the event windows */
  available: boolean;
  items: ReviewItem[];
  /** counts per layer for the period (the server's summary: every camera, reviewed state ignored); motion is -1 until that layer is shown */
  counts: Record<ReviewLayer, number>;
  unreviewed: Record<ReviewLayer, number>;
  facets: { objects: string[] };
  next_cursor: string | null;
  /** the Frigate recorders behind the list (the camera filter lists their cameras only) */
  recorder_ids?: string[];
  /** the recorder did not answer: the items are the last ones Arx kept (offline state with data) */
  stale?: boolean;
  /** the recording policy keeps motion / events only: partial coverage */
  partial_coverage?: boolean;
}

export type TimelineKind = 'enter' | 'zone' | 'stationary' | 'active' | 'exit' | 'attribute' | 'start' | 'end' | 'ongoing';

export interface TimelineRow {
  at: string;
  kind: TimelineKind;
  zone?: string | null;
  note?: string | null;
}

/** One tracked object with its lifecycle rows. The F1 server does not send these yet; the drawer shows them when it does. */
export interface TrackedObject {
  id: string;
  label: string;
  sub_label?: string | null;
  start: string;
  end: string | null;
  top_score?: number | null;
  zones: string[];
  timeline: TimelineRow[];
}

export interface ReviewDetail extends ReviewItem {
  /** how many tracked objects the review bundles */
  detections?: number;
  sub_labels?: string[];
  tracked: TrackedObject[];
}

export type ReviewPeriod = 'today' | '24h' | '7d' | '30d';
export type ReviewStatus = 'all' | 'unreviewed' | 'reviewed';

export interface ReviewFilters {
  layer: ReviewLayer;
  camera: string;
  period: ReviewPeriod;
  status: ReviewStatus;
  object: string;
}

export const DEFAULT_FILTERS: ReviewFilters = { layer: 'alert', camera: '', period: '24h', status: 'unreviewed', object: '' };

const DAY = 86_400_000;
/** The server's motion activity window is at most 24 h. */
export const MOTION_MAX_MS = DAY;
/** Merge motion buckets of one camera into one span when they are at most this far apart (three 30 s buckets). */
export const MOTION_GAP_S = 90;
export const MOTION_BUCKET_S = 30;
export const PAGE = 50;

/** Start of the period as a UTC ISO instant. `today` = local midnight of the viewer's zone (the browser's, as the other screens). */
export function periodSince(period: ReviewPeriod, now: Date = new Date()): string {
  if (period === 'today') {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const ms = period === '24h' ? DAY : period === '7d' ? 7 * DAY : 30 * DAY;
  return new Date(now.getTime() - ms).toISOString();
}

/** Days the summary covers for a period (rounded up; `today` is one). */
export const periodDays = (period: ReviewPeriod): number => (period === '30d' ? 30 : period === '7d' ? 7 : 1);

/** The query of `GET frigate/{rid}/reviews`. Empty filters are omitted; `before` (an epoch) continues a list. The server has no
 * object filter: that one is applied here on the page. */
export function reviewQuery(f: ReviewFilters, before: number | null = null, now: Date = new Date(), limit = PAGE): string {
  const q = new URLSearchParams();
  q.set('severity', f.layer === 'detection' ? 'detection' : 'alert');
  if (f.camera) q.set('camera_id', f.camera);
  q.set('from', periodSince(f.period, now));
  if (f.status !== 'all') q.set('reviewed', f.status === 'reviewed' ? 'true' : 'false');
  q.set('limit', String(limit));
  if (before != null) q.set('before', String(before));
  return q.toString();
}

/** The pages' cursor: the `next_before` epoch of every recorder that has more, as one string. */
export const encodeCursor = (c: Record<string, number>): string | null => (Object.keys(c).length ? JSON.stringify(c) : null);
export const decodeCursor = (s: string | null): Record<string, number> => {
  if (!s) return {};
  try {
    const v = JSON.parse(s) as Record<string, number>;
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};

/** The server's playback plan marks its anchors UNPROVEN (media-anchor rule): until a measured anchor says otherwise the card says the
 * recording cannot be opened from here. Flip when the backend proves seek / anchor accuracy. */
export const PLAYBACK_PROVEN = false;

export function itemOf(w: WireReview): ReviewItem {
  return {
    id: w.id,
    recorder_id: w.recorder_id,
    camera_id: w.camera_id ?? w.camera_key,
    camera_name: w.camera_name || w.camera_key,
    start: w.start,
    end: w.end,
    layer: w.severity,
    objects: w.objects,
    zones: w.zones,
    thumbnail: w.thumbnail ? 'ready' : 'none',
    thumb_url: w.thumbnail ? resourceUrl(w.thumbnail) : undefined,
    reviewed: w.reviewed === true,
    playback: PLAYBACK_PROVEN ? { available: true } : { available: false, reason: 'not_ready' },
  };
}

/** Motion spans from the activity buckets of one recorder: buckets of one camera at most MOTION_GAP_S apart become one span. */
export function motionSpans(rid: string, buckets: { start: number; motion: number; cameras: string[] }[], cams: { id: string; key: string; name: string }[]): ReviewItem[] {
  const byKey = new Map(cams.map((c) => [c.key, c]));
  const per = new Map<string, number[]>();
  for (const b of buckets) for (const k of b.cameras) per.set(k, [...(per.get(k) ?? []), b.start]);
  const out: ReviewItem[] = [];
  for (const [key, starts] of per) {
    const cam = byKey.get(key);
    if (!cam) continue;
    const sorted = [...starts].sort((a, b) => a - b);
    let from = sorted[0];
    let last = sorted[0];
    const flush = () => {
      out.push({
        id: `motion-${rid}-${key}-${from}`, recorder_id: rid, camera_id: cam.id, camera_name: cam.name,
        start: new Date(from * 1000).toISOString(), end: new Date((last + MOTION_BUCKET_S) * 1000).toISOString(), layer: 'motion', objects: [], zones: [],
        thumbnail: 'none', reviewed: false, playback: { available: false, reason: 'not_ready' },
      });
    };
    for (const t of sorted.slice(1)) {
      if (t - last > MOTION_GAP_S) {
        flush();
        from = t;
      }
      last = t;
    }
    flush();
  }
  return out.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
}

/** `motion: -1` = not counted (the motion layer is read only when it is the one shown). */
const EMPTY_COUNTS = { alert: 0, detection: 0, motion: -1 };

/** The review list for a filter. Reads every enabled Frigate recorder (usually one) and merges newest first. */
export async function listReviews(f: ReviewFilters, cursor: string | null = null, now: Date = new Date()): Promise<ReviewList> {
  const recs = await frigateRecorders();
  if (!recs.length) return { available: false, items: [], counts: { ...EMPTY_COUNTS }, unreviewed: { ...EMPTY_COUNTS }, facets: { objects: [] }, next_cursor: null };
  const before = decodeCursor(cursor);
  const next: Record<string, number> = {};
  let items: ReviewItem[] = [];
  const counts = { ...EMPTY_COUNTS };
  const unreviewed = { alert: 0, detection: 0, motion: 0 };
  let stale = false;
  let partial = false;
  let failures = 0;
  await Promise.all(recs.map(async (r) => {
    const rid = encodeURIComponent(r.id);
    try {
      const [st, sum] = await Promise.all([statusOf(r.id).catch(() => null), get<WireSummary>(`frigate/${rid}/reviews/summary?days=${periodDays(f.period)}`).catch(() => null)]);
      if (st?.sync?.last_poll_error) stale = true;
      const mode = recordingMode(st?.retention);
      if (mode === 'motion' || mode === 'events') partial = true;
      for (const sev of ['alert', 'detection'] as const) {
        counts[sev] += sum?.severity?.[sev]?.total ?? 0;
        unreviewed[sev] += sum?.severity?.[sev]?.unreviewed ?? 0;
      }
      if (f.layer === 'motion') {
        const nowMs = now.getTime();
        const since = Math.max(Date.parse(periodSince(f.period, now)), nowMs - MOTION_MAX_MS);
        const [act, cams] = await Promise.all([get<WireActivity>(`frigate/${rid}/activity?from=${Math.floor(since / 1000)}&to=${Math.floor(nowMs / 1000)}`), camerasOf(r.id)]);
        const spans = motionSpans(r.id, act.buckets, cams).filter((s) => !f.camera || s.camera_id === f.camera);
        items = items.concat(spans);
        counts.motion = Math.max(0, counts.motion) + spans.length;
      } else {
        const page = await get<{ items: WireReview[]; next_before: number | null }>(`frigate/${rid}/reviews?${reviewQuery(f, before[r.id] ?? null, now)}`);
        items = items.concat(page.items.map(itemOf));
        if (page.next_before != null) next[r.id] = page.next_before;
      }
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) throw e;
      failures += 1;
      stale = true;
    }
  }));
  if (failures === recs.length) throw new ApiError(502, { code: 'source_unavailable', user_message: he.frigate.review.error, retryable: true, correlation_id: '', details: {} });
  items.sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const facets = [...new Set(items.flatMap((i) => i.objects))].sort();
  const shown = f.object ? items.filter((i) => i.objects.includes(f.object)) : items;
  return {
    available: true, items: shown, counts, unreviewed, facets: { objects: facets }, next_cursor: f.layer === 'motion' ? null : encodeCursor(next),
    recorder_ids: recs.map((r) => r.id), stale: stale || undefined, partial_coverage: partial || undefined,
  };
}

/** One item's detail: the item plus what the server adds (detection count, sub labels). A motion span is its own detail. */
export async function reviewDetail(item: ReviewItem): Promise<ReviewDetail> {
  if (item.layer === 'motion') return { ...item, tracked: [] };
  const w = await get<WireReview>(`frigate/${encodeURIComponent(item.recorder_id)}/reviews/${encodeURIComponent(item.id)}`);
  return { ...item, ...itemOf(w), camera_name: item.camera_name, detections: w.detections, sub_labels: w.sub_labels, tracked: [] };
}

/** The caller's reviewed state, per recorder (needs events.read on each item). Arx's state first; the server mirrors it to Frigate only when that write class is on (F2), and a failed mirror never fails the mark. */
export async function markReviewed(items: readonly { id: string; recorder_id: string }[], reviewed: boolean): Promise<void> {
  const by = new Map<string, string[]>();
  for (const i of items) by.set(i.recorder_id, [...(by.get(i.recorder_id) ?? []), i.id]);
  await Promise.all([...by].map(([rid, ids]) => post(`frigate/${encodeURIComponent(rid)}/reviews/reviewed`, { ids, reviewed })));
}

// ---- display helpers ----

export const LAYER_TEXT: Record<ReviewLayer, { many: string; one: string }> = {
  alert: { many: he.frigate.review.layerAlert, one: he.frigate.review.layerAlertOne },
  detection: { many: he.frigate.review.layerDetection, one: he.frigate.review.layerDetectionOne },
  motion: { many: he.frigate.review.layerMotion, one: he.frigate.review.layerMotionOne },
};

export const objectLabel = (o: string): string => (he.frigate.review.obj as Record<string, string>)[o] ?? o;

export const PERIOD_TEXT: Record<ReviewPeriod, string> = {
  today: he.frigate.review.periodToday,
  '24h': he.frigate.review.period24h,
  '7d': he.frigate.review.period7d,
  '30d': he.frigate.review.period30d,
};

export const STATUS_TEXT: Record<ReviewStatus, string> = {
  all: he.frigate.review.statusAll,
  unreviewed: he.frigate.review.statusUnreviewed,
  reviewed: he.frigate.review.statusReviewed,
};

/** "34 שנ׳" / "2 דק׳ 5 שנ׳" - the span of an item; null when still going or unknown. */
export function spanText(start: string, end: string | null): string | null {
  if (!end) return null;
  const s = Math.max(0, Math.round((Date.parse(end) - Date.parse(start)) / 1000));
  if (!Number.isFinite(s)) return null;
  if (s < 60) return `${s} שנ׳`;
  const m = Math.floor(s / 60);
  return s % 60 ? `${m} דק׳ ${s % 60} שנ׳` : `${m} דק׳`;
}

/** Why "פתח הקלטה" is not offered (the existing playback entry is used when the backend says it can open the item). */
export function playbackState(it: Pick<ReviewItem, 'playback'>): { available: boolean; reason: string } {
  const p = it.playback;
  if (p?.available) return { available: true, reason: '' };
  return { available: false, reason: p?.reason === 'no_coverage' ? he.frigate.review.recordingNoCoverage : he.frigate.review.recordingUnavailable };
}

/** The route of the existing recording screen for an item (`#/investigate/playback?camera&t`). */
export const playbackParams = (it: Pick<ReviewItem, 'camera_id' | 'start'>): Record<string, string> => ({ camera: it.camera_id, t: it.start });

/** The rows of a review's own span when the server sends no per-object lifecycle: when it began and when it ended (real data only). */
export function spanRows(it: Pick<ReviewItem, 'start' | 'end'>): TimelineRow[] {
  return [{ at: it.start, kind: 'start' }, it.end ? { at: it.end, kind: 'end' } : { at: it.start, kind: 'ongoing' }];
}

/** The time of an item in a zone: "10:12" and, when it is not today, the date before it. */
export function cardTime(iso: string, tz: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const day = (x: Date) => new Intl.DateTimeFormat('he-IL', { timeZone: tz, day: '2-digit', month: '2-digit' }).format(x);
  const hm = new Intl.DateTimeFormat('he-IL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return day(d) === day(now) ? hm : `${day(d)} ${hm}`;
}

/** The timeline row's wording: "נכנס לאזור: מדרגות כניסה". Data only (no overlay, no seek: F2). */
export function timelineText(kind: TimelineKind, zone?: string | null, note?: string | null): string {
  const base = he.frigate.review.kind[kind] ?? kind;
  return [base, zone || note].filter(Boolean).join(': ');
}

// ---- the refreshing still (live tile of a camera without a stream) ----

/** Smallest interval between two refreshes of one still (the study R4: Frigate's CPU, poll no faster than 5 s). */
export const STILL_MIN_MS = 5000;
export const STILL_DEFAULT_MS = 10_000;

export const stillIntervalMs = (seconds: number | null | undefined): number => Math.max(STILL_MIN_MS, Math.round((seconds && seconds > 0 ? seconds : STILL_DEFAULT_MS / 1000) * 1000));

/** Whether a still may be fetched now: never while the tab is hidden or the tile is out of view, never sooner than the interval. */
export function stillDue(s: { hidden: boolean; inView: boolean; lastAt: number; now: number; intervalMs: number }): boolean {
  return !s.hidden && s.inView && s.now - s.lastAt >= s.intervalMs;
}

/** `url` with a cache-buster that keeps the URL's own query. */
export function withBust(url: string, bust: number): string {
  return `${url}${url.includes('?') ? '&' : '?'}t=${bust}`;
}

/** The recorders whose cameras have no live stream: a Frigate recorder whose `status.live.mode` is `still` (the F1 default). A status
 * that cannot be read counts as still (no restream is offered without it). */
async function stillRecorderIds(): Promise<Set<string>> {
  const recs = await frigateRecorders();
  const out = new Set<string>();
  await Promise.all(recs.map(async (r) => {
    try {
      if ((await statusOf(r.id)).live?.mode !== 'restream') out.add(r.id);
    } catch {
      out.add(r.id);
    }
  }));
  return out;
}

/** True when the recorder is a Frigate one without a restream: its cameras are refreshing stills (the area cards ask per camera). */
export async function isStillRecorder(rid: string): Promise<boolean> {
  if (!isApi() || !rid) return false;
  try {
    return (await stillRecorderIds()).has(rid);
  } catch {
    return false;
  }
}

/** Mark the cameras of a Frigate recorder without a restream as stills (`live_kind`), so the live screens show a refreshing picture
 * instead of opening a stream that does not exist. A camera the server already marked keeps its own value. Quiet on any failure. */
export async function markStillCameras(cams: Camera[]): Promise<void> {
  if (!isApi() || !cams.length) return;
  try {
    const still = await stillRecorderIds();
    if (!still.size) return;
    for (const c of cams) if (c.live_kind === undefined && still.has(c.recorder_id)) c.live_kind = 'still';
  } catch {
    /* the live screens work without the mark: a stream is tried as before */
  }
}

/** The address of a camera's latest still (the existing route, served by the recorder's adapter). */
export const stillUrl = (cameraId: string): string => apiUrl(`cameras/${encodeURIComponent(cameraId)}/snapshot.jpg`);
