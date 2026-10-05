/** NN5-F1B: the Frigate provider's client contract (phase F1, "see and play": read-only against Frigate).
 * The server side is built in parallel (branch pilot/NN5-F1A-backend); the routes below follow docs/research/FRIGATE_STUDY.md
 * (section 7-8) and are the ASSUMED shapes until that branch publishes its routes - see `docs/architecture/FRIGATE_UI_CONTRACT.md`
 * for the list the backend is asked to match (or the one place to adapt: this file).
 * Everything here is data and pure helpers; the screens only render. Times are UTC ISO strings (the study: epoch seconds on the
 * wire of Frigate, converted by the backend), shown in the user's zone by the screens. */
import { apiUrl, get, post } from './client';
import { he } from '../i18n/he';

// ---- connection test: what the recorder offers (the capability summary of the settings card) ----

/** Discovered abilities (never version guesses): the study's `features`. A key absent = not offered. */
export type FrigateFeature = 'review_items' | 'object_events' | 'timeline' | 'snapshots' | 'search_text' | 'search_semantic' | 'zones' | 'audio_events' | 'faces' | 'lpr' | 'genai';

export interface FrigateDetector {
  name: string;
  /** cpu | edgetpu | openvino | tensorrt | ... as Frigate names it */
  type: string;
  inference_ms?: number | null;
}

export interface FrigateCapabilities {
  version: string;
  cameras: { total: number; enabled: number; disabled: number };
  detectors: FrigateDetector[];
  features: Partial<Record<FrigateFeature, boolean>>;
  retention: {
    /** `motion`: only segments with motion are kept; `all`: continuous; `events`: only around alerts / detections */
    mode: 'motion' | 'all' | 'events';
    days?: number | null;
    /** days of alerts / detections kept, when they differ from the recording days */
    alert_days?: number | null;
  };
  /** True when Frigate offers a restream the live wall can use; false = still tiles only (F1 default). */
  restream?: boolean;
}

/** The feature rows in screen order. */
export const FEATURE_ORDER: FrigateFeature[] = ['review_items', 'object_events', 'timeline', 'snapshots', 'search_text', 'search_semantic', 'zones', 'audio_events', 'faces', 'lpr', 'genai'];

export const featureLabel = (f: string): string => (he.frigate.features as Record<string, string>)[f] ?? f;

/** One line for the retention row: "הקלטה על תנועה בלבד · 10 ימים". */
export function retentionText(r: FrigateCapabilities['retention']): string {
  const mode = r.mode === 'all' ? he.frigate.summary.retentionAll : r.mode === 'events' ? he.frigate.summary.retentionEvents : he.frigate.summary.retentionMotion;
  return [mode, r.days != null ? `${r.days} ${he.frigate.summary.days}` : null].filter(Boolean).join(' · ');
}

/** Rows of the summary card, ready to render: [key, label, value text]. Pure so the unit tests pin the wording. */
export function summaryRows(c: FrigateCapabilities): { key: string; label: string; value: string }[] {
  const s = he.frigate.summary;
  const detectors = c.detectors.length ? c.detectors.map((d) => `${d.name} (${d.type}${d.inference_ms != null ? `, ${Math.round(d.inference_ms)} ${he.frigate.health.inference}` : ''})`).join(', ') : s.noDetectors;
  return [
    { key: 'version', label: s.version, value: c.version },
    { key: 'cameras', label: s.cameras, value: `${c.cameras.enabled} ${s.camerasOf} ${c.cameras.total}${c.cameras.disabled ? ` · ${c.cameras.disabled} ${s.disabled}` : ''}` },
    { key: 'detectors', label: s.detectors, value: detectors },
    { key: 'retention', label: s.retention, value: retentionText(c.retention) },
  ];
}

// ---- health rows (the recorder health card, CR-026) ----

export interface FrigateHealthCamera {
  id: string;
  name: string;
  /** `camera_fps`; 0 with the camera enabled = no picture */
  fps: number | null;
  /** ok | off (disabled / paused on purpose) | down (enabled, no picture) */
  state: 'ok' | 'off' | 'down';
  detect_enabled?: boolean;
  reconnects_last_hour?: number | null;
  stalls_last_hour?: number | null;
}

export interface FrigateHealth {
  version?: string | null;
  detectors: (FrigateDetector & { skipped_fps?: number | null })[];
  cameras: FrigateHealthCamera[];
  storage: { hours_left: number | null; mb_per_hour?: number | null; free_pct?: number | null } | null;
  /** The recording policy keeps only part of the time: shown as partial coverage, never as "no recording" (AGENTS). */
  partial_coverage: boolean;
}

/** A detector is overloaded when Frigate skips frames. */
export const detectorOverloaded = (d: { skipped_fps?: number | null }): boolean => (d.skipped_fps ?? 0) > 0;

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
  /** normalised object labels: person, car, dog ... */
  objects: string[];
  zones: string[];
  /** the room / floor of the camera on the plan, when it is anchored (a review card says where, the study's appendix C) */
  area_name?: string | null;
  floor_name?: string | null;
  thumbnail: 'ready' | 'none';
  /** Demo / fixture only: a ready-made picture instead of the backend still. */
  thumb_url?: string;
  /** per user (Arx-side state; Frigate keeps its own and is never written) */
  reviewed: boolean;
  /** The existing playback entry can open this item: absent = not yet (marked unavailable on the card). */
  playback?: { available: boolean; reason?: 'no_coverage' | 'not_ready' };
}

export interface ReviewList {
  /** false: the installation has no Frigate recorder - the screen falls back to the event windows */
  available: boolean;
  items: ReviewItem[];
  /** counts per layer for the current camera / period / object filters (reviewed state ignored) */
  counts: Record<ReviewLayer, number>;
  unreviewed: Record<ReviewLayer, number>;
  facets: { objects: string[] };
  next_cursor: string | null;
  /** the recorder did not answer: the items are the last ones Arx kept (offline state with data) */
  stale?: boolean;
  /** the recording policy keeps motion only: partial coverage */
  partial_coverage?: boolean;
}

export type TimelineKind = 'enter' | 'zone' | 'stationary' | 'active' | 'exit' | 'attribute';

export interface TimelineRow {
  at: string;
  kind: TimelineKind;
  zone?: string | null;
  note?: string | null;
}

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

/** The query string of `GET analytics/reviews`. Empty filters are omitted; the cursor continues a list. */
export function reviewQuery(f: ReviewFilters, cursor: string | null = null, now: Date = new Date(), limit = 48): string {
  const q = new URLSearchParams();
  q.set('layer', f.layer);
  if (f.camera) q.set('camera_id', f.camera);
  q.set('since', periodSince(f.period, now));
  if (f.status !== 'all') q.set('reviewed', f.status === 'reviewed' ? 'true' : 'false');
  if (f.object) q.set('object', f.object);
  q.set('limit', String(limit));
  if (cursor) q.set('cursor', cursor);
  return q.toString();
}

export const listReviews = (f: ReviewFilters, cursor: string | null = null) => get<ReviewList>(`analytics/reviews?${reviewQuery(f, cursor)}`);
export const reviewDetail = (id: string) => get<ReviewDetail>(`analytics/reviews/${encodeURIComponent(id)}`);
/** Per-user reviewed state (needs `analytics.review`). `ids` of one or many; the answer repeats the ids that changed. */
export const markReviewed = (ids: string[], reviewed: boolean) => post<{ changed: string[] }>('analytics/reviews/reviewed', { ids, reviewed });
/** The card's still: served by the backend with the adapter token (the browser never talks to Frigate). */
export const reviewThumbUrl = (id: string): string => apiUrl(`analytics/reviews/${encodeURIComponent(id)}/thumbnail.jpg`);

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

