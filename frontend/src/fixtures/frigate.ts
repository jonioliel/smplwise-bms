/** NN5-F1B: fixtures for the Frigate screens (demo mode and the Playwright mocks). Every name and value is made up; the pictures are
 * generated gradients, never a real frame. */
import type { ReviewDetail, ReviewItem, ReviewLayer, ReviewList } from '../api/frigate';

const svg = (a: string, b: string, label: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="170" cy="96" r="22" fill="rgba(255,255,255,.35)"/><rect x="146" y="116" width="48" height="50" rx="14" fill="rgba(255,255,255,.28)"/><text x="12" y="20" font-size="12" fill="rgba(255,255,255,.7)" font-family="sans-serif">${label}</text></svg>`)}`;

export const FRIGATE_CAMERAS = [
  { id: 'fg-front', name: 'כניסה ראשית', area: 'כניסה', floor: 'קומת קרקע' },
  { id: 'fg-yard', name: 'חצר אחורית', area: 'חצר', floor: 'קומת קרקע' },
  { id: 'fg-garage', name: 'חניה', area: 'חניה', floor: 'קומת קרקע' },
  { id: 'fg-gate', name: 'שער צדדי עם שם ארוך מאוד של מצלמה', area: null, floor: null },
] as const;

const BASE = Date.parse('2026-10-06T08:00:00Z');
const at = (min: number) => new Date(BASE - min * 60_000).toISOString();

const item = (n: number, cam: number, layer: ReviewLayer, minAgo: number, objects: string[], zones: string[], over: Partial<ReviewItem> = {}): ReviewItem => ({
  id: `rv-${n}`,
  recorder_id: 'nvr-2',
  camera_id: FRIGATE_CAMERAS[cam].id,
  camera_name: FRIGATE_CAMERAS[cam].name,
  start: at(minAgo),
  end: at(minAgo - 1),
  layer,
  objects,
  zones,
  area_name: FRIGATE_CAMERAS[cam].area,
  floor_name: FRIGATE_CAMERAS[cam].floor,
  thumbnail: 'ready',
  thumb_url: svg(layer === 'alert' ? '#7a2e2e' : layer === 'detection' ? '#7a5a2e' : '#2e4a7a', '#1d2330', `rv-${n}`),
  reviewed: false,
  playback: { available: false, reason: 'not_ready' },
  ...over,
});

export const REVIEW_ITEMS: ReviewItem[] = [
  item(1, 0, 'alert', 12, ['person'], ['מדרגות כניסה'], { playback: { available: true } }),
  item(2, 0, 'alert', 47, ['person', 'dog'], ['מדרגות כניסה', 'שביל']),
  item(3, 1, 'alert', 130, ['person'], ['דשא'], { reviewed: true, playback: { available: true } }),
  item(4, 2, 'alert', 260, ['car'], ['חניה'], { playback: { available: false, reason: 'no_coverage' } }),
  item(5, 3, 'alert', 410, ['person', 'package'], [], { end: null, thumbnail: 'none', thumb_url: undefined }),
  item(6, 1, 'detection', 20, ['cat'], []),
  item(7, 2, 'detection', 95, ['car'], ['רחוב']),
  item(8, 0, 'motion', 30, [], []),
  item(9, 1, 'motion', 33, [], []),
];

const countLayer = (items: ReviewItem[], f: (i: ReviewItem) => boolean) => ({
  alert: items.filter((i) => i.layer === 'alert' && f(i)).length,
  detection: items.filter((i) => i.layer === 'detection' && f(i)).length,
  motion: items.filter((i) => i.layer === 'motion' && f(i)).length,
});

/** The list the screen shows for a filter, the way the server would answer it (used by the mock and the demo mode). */
export function reviewList(items: ReviewItem[], q: { layer: string; camera?: string; object?: string; reviewed?: string }): ReviewList {
  const base = items.filter((i) => (!q.camera || i.camera_id === q.camera) && (!q.object || i.objects.includes(q.object)));
  const shown = base.filter((i) => i.layer === q.layer && (q.reviewed == null || String(i.reviewed) === q.reviewed));
  return {
    available: true,
    items: shown,
    counts: countLayer(base, () => true),
    unreviewed: countLayer(base, (i) => !i.reviewed),
    facets: { objects: [...new Set(items.flatMap((i) => i.objects))].sort() },
    next_cursor: null,
    partial_coverage: true,
  };
}

export function reviewDetail(id: string, items: ReviewItem[] = REVIEW_ITEMS): ReviewDetail | null {
  const it = items.find((i) => i.id === id);
  if (!it) return null;
  const t = Date.parse(it.start);
  const iso = (s: number) => new Date(t + s * 1000).toISOString();
  return {
    ...it,
    tracked: it.objects.length
      ? it.objects.map((label, k) => ({
          id: `${it.id}-o${k}`,
          label,
          sub_label: null,
          start: iso(k * 4),
          end: it.end ? iso(40 + k * 4) : null,
          top_score: 0.87 - k * 0.1,
          zones: it.zones,
          timeline: [
            { at: iso(k * 4), kind: 'enter' as const },
            ...it.zones.map((z, zi) => ({ at: iso(6 + k * 4 + zi * 8), kind: 'zone' as const, zone: z })),
            { at: iso(30 + k * 4), kind: 'stationary' as const },
            ...(it.end ? [{ at: iso(40 + k * 4), kind: 'exit' as const }] : []),
          ],
        }))
      : [],
  };
}

/** The server's `GET frigate/{rid}/status` for the fixture recorder (a motion-only policy, one CPU detector, no restream). */
export const FRIGATE_STATUS = {
  version: '0.18.0-fake', version_ok: true,
  features: { review_items: true, object_events: true, snapshots_latest: true, recordings: true, hls_playback: true, restream: false, audio_events: false, search_text: true, search_semantic: false, timeline: false, faces: false, lpr: false, genai: false },
  retention: { record_enabled: true, continuous_days: null, motion_days: 10, alerts_days: 30, detections_days: 10, mode: null },
  detectors: [{ name: 'cpu1', type: 'cpu' }], cameras: 4, sync: { last_poll_error: null, ws_state: 'up' }, live: { mode: 'still' },
};

/** `GET frigate/{rid}/cameras` (the key is Frigate's own camera name). */
export const FRIGATE_CAM_LIST = FRIGATE_CAMERAS.map((c) => ({ id: c.id, key: `cam_${c.id.replace('fg-', '')}`, name: c.name, enabled: true, frigate_enabled: c.id !== 'fg-gate' }));

/** The recorder-health card's `vendor_details` for a Frigate recorder (fake numbers; the third camera has no picture). */
export const FRIGATE_VENDOR_DETAILS = {
  version: '0.18.0-fake', uptime_s: 90000,
  detectors: [{ name: 'cpu1', inference_ms: 62 }], skipped_fps_total: 0,
  cameras: [
    { key: 'cam_front', fps: 5, expected_fps: 5, skipped_fps: 0, detection_fps: 5, reconnects_last_hour: 0, stalls_last_hour: 0 },
    { key: 'cam_yard', fps: 4.8, expected_fps: 5, skipped_fps: 0, detection_fps: 4.8, reconnects_last_hour: 1, stalls_last_hour: 0 },
    { key: 'cam_garage', fps: 0, expected_fps: 5, skipped_fps: 0, detection_fps: 0, reconnects_last_hour: 6, stalls_last_hour: 2 },
  ],
  storage: { bandwidth_mb_per_h: 1400, hours_left: 70, basis: 'recent bandwidth' },
  recording_policy: { record_enabled: true, continuous_days: null, motion_days: 10, alerts_days: 30, detections_days: 10 },
};
