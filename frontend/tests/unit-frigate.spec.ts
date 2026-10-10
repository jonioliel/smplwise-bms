import { test, expect } from '@playwright/test';
import {
  DEFAULT_FILTERS, MOTION_GAP_S, STILL_MIN_MS, cameraHealthText, capabilitiesOf, capabilitiesOfTest, cardTime, decodeCursor, detectorOverloaded, encodeCursor, frigateHealthOf, hoursLeftState, hoursLeftText,
  motionSpans, periodDays, periodSince, playbackParams, playbackState, recordingMode, retentionText, reviewQuery, spanRows, spanText, stillDue, stillIntervalMs, summaryRows, timelineText, withBust,
  type FrigateHealthCamera, type ReviewItem, type ReviewList, type WireCamera, type WireStatus,
} from '../src/api/frigate';
import { appendPage, applyReviewed, filtersActive, focusAfter, keyAction, moveFocus, nextReviewedValue, targetIds, toggleId, viewOf } from '../src/screens/reviews-logic';
import { FRIGATE_CAM_LIST, FRIGATE_STATUS, FRIGATE_VENDOR_DETAILS, REVIEW_ITEMS, reviewDetail, reviewList } from '../src/fixtures/frigate';

// NN5-F1B: the Frigate screens' pure logic - the query a filter makes, the wire-to-UI adapters (status, health, motion spans), the
// wording of the summary / health / timeline, the reviewed state (optimistic, per user), the keys, the state the list area is in and
// the rules of the refreshing still. Node only, no server.

const NOW = new Date('2026-10-06T08:00:00Z');
const list = (over: Partial<ReviewList> = {}): ReviewList => ({ ...reviewList(REVIEW_ITEMS.map((i) => ({ ...i })), { layer: 'alert' }), ...over });
const STATUS = FRIGATE_STATUS as unknown as WireStatus;
const CAMS = FRIGATE_CAM_LIST as WireCamera[];

test('a filter becomes the query of the server route: severity and the start of the period always, the rest only when chosen', () => {
  const q = new URLSearchParams(reviewQuery({ ...DEFAULT_FILTERS, status: 'all' }, null, NOW));
  expect(q.get('severity')).toBe('alert');
  expect(q.get('from')).toBe('2026-10-05T08:00:00.000Z');
  expect(q.has('camera_id')).toBe(false);
  expect(q.has('reviewed')).toBe(false);
  expect(q.has('before')).toBe(false);
  expect(q.get('limit')).toBe('50');
  const full = new URLSearchParams(reviewQuery({ layer: 'detection', camera: 'c1', period: '7d', status: 'reviewed', object: 'person' }, 1791227000.5, NOW));
  expect(Object.fromEntries(full)).toEqual({ severity: 'detection', camera_id: 'c1', from: '2026-09-29T08:00:00.000Z', reviewed: 'true', limit: '50', before: '1791227000.5' }); // no object filter: the server has none
  expect(new URLSearchParams(reviewQuery(DEFAULT_FILTERS, null, NOW)).get('reviewed')).toBe('false'); // the default is the unreviewed ones
});

test('the period starts a fixed span back, "today" at the local midnight; the summary covers whole days', () => {
  expect(periodSince('24h', NOW)).toBe('2026-10-05T08:00:00.000Z');
  expect(periodSince('30d', NOW)).toBe('2026-09-06T08:00:00.000Z');
  const midnight = new Date(periodSince('today', NOW));
  expect([midnight.getHours(), midnight.getMinutes(), midnight.getSeconds()]).toEqual([0, 0, 0]);
  expect(midnight.getTime()).toBeLessThanOrEqual(NOW.getTime());
  expect(NOW.getTime() - midnight.getTime()).toBeLessThan(86_400_000 + 3_600_000);
  expect((['today', '24h', '7d', '30d'] as const).map((p) => periodDays(p))).toEqual([1, 1, 7, 30]);
});

test('the pages continue per recorder through one cursor string; a broken cursor is no cursor', () => {
  expect(encodeCursor({})).toBeNull();
  expect(decodeCursor(encodeCursor({ 'nvr-2': 1791227000.5 }))).toEqual({ 'nvr-2': 1791227000.5 });
  expect(decodeCursor(null)).toEqual({});
  expect(decodeCursor('{not json')).toEqual({});
});

test('the retention policy is read the way the server reads it: continuous, motion, events, off, unknown', () => {
  expect(recordingMode({ record_enabled: true, continuous_days: 3, motion_days: 10 })).toBe('all');
  expect(recordingMode({ record_enabled: true, continuous_days: null, motion_days: 10 })).toBe('motion');
  expect(recordingMode({ record_enabled: true, alerts_days: 30 })).toBe('events');
  expect(recordingMode({ record_enabled: false, motion_days: 10 })).toBe('off');
  expect(recordingMode({})).toBe('unknown');
  expect(recordingMode(null)).toBe('unknown');
});

test('the capability summary reads in plain Hebrew: version, cameras (enabled of all), detectors, retention; the features are the discovered ones', () => {
  const caps = capabilitiesOf(STATUS, CAMS);
  const rows = Object.fromEntries(summaryRows(caps).map((r) => [r.key, r.value]));
  expect(rows.version).toBe('0.18.0-fake');
  expect(rows.cameras).toBe('3 פעילות מתוך 4 · 1 כבויות');
  expect(rows.detectors).toBe('cpu1 (cpu)');
  expect(rows.retention).toBe('הקלטה על תנועה בלבד · 10 ימים');
  expect(caps.features?.review_items).toBe(true);
  expect(caps.features?.search_semantic).toBe(false);
  expect(caps.restream).toBe(false);
  expect(retentionText({ mode: 'all', days: null })).toBe('הקלטה רציפה');
  expect(retentionText({ mode: 'off', days: 5 })).toBe('ההקלטה כבויה');
  expect(retentionText({ mode: 'unknown' })).toBe('');
  // without the camera list the server's count stands; no detectors is said
  const bare = summaryRows(capabilitiesOf({ ...STATUS, detectors: [], retention: null }, null));
  expect(bare.find((r) => r.key === 'cameras')?.value).toBe('4 פעילות מתוך 4');
  expect(bare.find((r) => r.key === 'detectors')?.value).toBe('אין גלאי מוגדר');
  expect(bare.some((r) => r.key === 'retention')).toBe(false);
  // a restream the server found is said
  expect(capabilitiesOf({ ...STATUS, live: { mode: 'restream' } }, CAMS).restream).toBe(true);
});

test('the connection test before saving knows the version and the camera count only: the card shows those and leaves out the rest', () => {
  const rows = summaryRows(capabilitiesOfTest({ firmware: '0.18.0-fake', channels: 4 }));
  expect(rows.map((r) => r.key)).toEqual(['version', 'cameras']);
  expect(rows[1].value).toBe('4 פעילות מתוך 4');
  expect(summaryRows(capabilitiesOfTest({ firmware: null, channels: null }))).toEqual([]);
});

test('health: a camera with no picture is down, a disabled one is off, hours left have a soft threshold, skipped frames are an overloaded detector, partial coverage follows the policy', () => {
  const cam = (over: Partial<FrigateHealthCamera>): FrigateHealthCamera => ({ id: 'a', name: 'א', fps: 5, state: 'ok', ...over });
  expect(cameraHealthText(cam({}))).toBe('5 פריימים בשנייה');
  expect(cameraHealthText(cam({ fps: 4.84 }))).toBe('4.8 פריימים בשנייה');
  expect(cameraHealthText(cam({ state: 'down', fps: 0 }))).toBe('אין תמונה');
  expect(cameraHealthText(cam({ state: 'off', fps: null }))).toBe('המצלמה כבויה');
  expect(hoursLeftText({ hours_left: 70 })).toBe('3 ימים');
  expect(hoursLeftText({ hours_left: 30 })).toBe('30 שעות');
  expect(hoursLeftText({ hours_left: null })).toBeNull();
  expect(hoursLeftText(null)).toBeNull();
  expect([1, 10, 100].map((h) => hoursLeftState({ hours_left: h }))).toEqual(['error', 'warn', 'ok']);
  expect(hoursLeftState(null)).toBe('unknown');
  expect(detectorOverloaded({ skipped_fps: 1.5 })).toBe(true);
  expect(detectorOverloaded({ skipped_fps: 0 })).toBe(false);
  expect(detectorOverloaded({})).toBe(false);
  const h = frigateHealthOf(FRIGATE_VENDOR_DETAILS, CAMS, 41)!;
  expect(h.cameras.map((c) => [c.name, c.state])).toEqual([['כניסה ראשית', 'ok'], ['חצר אחורית', 'ok'], ['חניה', 'down'], ['שער צדדי עם שם ארוך מאוד של מצלמה', 'off']]);
  expect(h.cameras[1].reconnects_last_hour).toBe(1);
  expect(h.detectors).toEqual([{ name: 'cpu1', inference_ms: 62, skipped_fps: 0 }]);
  expect(h.storage).toEqual({ hours_left: 70, mb_per_hour: 1400, free_pct: 41 });
  expect(h.partial_coverage).toBe(true); // motion-only retention: partial, not "no recording"
  expect(frigateHealthOf({ ...FRIGATE_VENDOR_DETAILS, recording_policy: { record_enabled: true, continuous_days: 5 } }, CAMS)!.partial_coverage).toBe(false);
  expect(frigateHealthOf({ ...FRIGATE_VENDOR_DETAILS, skipped_fps_total: 2.5 }, CAMS)!.detectors[0].skipped_fps).toBe(2.5);
  expect(frigateHealthOf(null, CAMS)).toBeNull();
});

test('motion spans: buckets of one camera at most 90 s apart are one span, a longer gap splits it, cameras stay apart, an unknown camera is dropped', () => {
  const cams = [{ id: 'fg-front', key: 'cam_front', name: 'כניסה ראשית' }, { id: 'fg-yard', key: 'cam_yard', name: 'חצר אחורית' }];
  const b = (start: number, ...c: string[]) => ({ start, motion: 3, cameras: c });
  const spans = motionSpans('nvr-2', [b(1000, 'cam_front'), b(1030, 'cam_front'), b(1060, 'cam_front', 'cam_yard'), b(1300, 'cam_front'), b(1000, 'cam_ghost')], cams);
  expect(spans.map((s) => [s.camera_id, s.start, s.end])).toEqual([
    ['fg-front', new Date(1300 * 1000).toISOString(), new Date(1330 * 1000).toISOString()],
    ['fg-yard', new Date(1060 * 1000).toISOString(), new Date(1090 * 1000).toISOString()],
    ['fg-front', new Date(1000 * 1000).toISOString(), new Date(1090 * 1000).toISOString()],
  ]);
  expect(MOTION_GAP_S).toBe(90);
  expect(spans.every((s) => s.layer === 'motion' && s.objects.length === 0 && s.thumbnail === 'none' && !s.reviewed)).toBe(true);
  expect(spans[0].id).toBe('motion-nvr-2-cam_front-1300');
});

test('"open the recording" is offered only when the backend says the item can be opened; otherwise the reason is named', () => {
  expect(playbackState({ playback: { available: true } })).toEqual({ available: true, reason: '' });
  expect(playbackState({}).available).toBe(false);
  expect(playbackState({}).reason).toBe('ההקלטה עדיין לא זמינה לנגינה מכאן');
  expect(playbackState({ playback: { available: false, reason: 'no_coverage' } }).reason).toBe('אין הקלטה בטווח הזה');
  expect(playbackParams({ camera_id: 'c1', start: '2026-10-06T07:00:00Z' })).toEqual({ camera: 'c1', t: '2026-10-06T07:00:00Z' });
});

test('the span, the time and the timeline rows are worded for an operator', () => {
  expect(spanText('2026-10-06T08:00:00Z', '2026-10-06T08:00:34Z')).toBe('34 שנ׳');
  expect(spanText('2026-10-06T08:00:00Z', '2026-10-06T08:02:05Z')).toBe('2 דק׳ 5 שנ׳');
  expect(spanText('2026-10-06T08:00:00Z', '2026-10-06T08:03:00Z')).toBe('3 דק׳');
  expect(spanText('2026-10-06T08:00:00Z', null)).toBeNull();
  expect(cardTime('2026-10-06T07:12:00Z', 'UTC', NOW)).toBe('07:12');
  expect(cardTime('2026-10-04T07:12:00Z', 'UTC', NOW)).toMatch(/^04\.10 07:12$|^4\.10 07:12$|^04\/10 07:12$/);
  expect(timelineText('zone', 'מדרגות כניסה')).toBe('נכנס לאזור: מדרגות כניסה');
  expect(timelineText('exit')).toBe('יצא מהמצלמה');
  expect(spanRows({ start: '2026-10-06T08:00:00Z', end: '2026-10-06T08:01:00Z' }).map((r) => r.kind)).toEqual(['start', 'end']);
  expect(spanRows({ start: '2026-10-06T08:00:00Z', end: null }).map((r) => r.kind)).toEqual(['start', 'ongoing']);
  expect(timelineText('ongoing')).toBe('הפעילות נמשכת');
});

test('the still never refreshes faster than 5 s, never while hidden or out of view', () => {
  expect(stillIntervalMs(1)).toBe(STILL_MIN_MS);
  expect(stillIntervalMs(undefined)).toBe(10_000);
  expect(stillIntervalMs(30)).toBe(30_000);
  const base = { hidden: false, inView: true, lastAt: 1000, now: 11_000, intervalMs: 10_000 };
  expect(stillDue(base)).toBe(true);
  expect(stillDue({ ...base, now: 10_999 })).toBe(false);
  expect(stillDue({ ...base, hidden: true })).toBe(false);
  expect(stillDue({ ...base, inView: false })).toBe(false);
  expect(withBust('api/v1/cameras/x/snapshot.jpg', 5)).toBe('api/v1/cameras/x/snapshot.jpg?t=5');
  expect(withBust('a.jpg?h=300', 5)).toBe('a.jpg?h=300&t=5');
});

const key = (k: string, extra: Record<string, unknown> = {}) => keyAction({ key: k, target: { tagName: 'BODY' }, ...extra });

test('keys: arrows and J / K move, space selects, R reviews, Enter opens, Ctrl+A selects all, Esc clears; typing in a field is never a shortcut', () => {
  expect(['j', 'ArrowDown', 'ArrowRight'].map((k) => key(k))).toEqual(['next', 'next', 'next']);
  expect(['k', 'ArrowUp', 'ArrowLeft'].map((k) => key(k))).toEqual(['prev', 'prev', 'prev']);
  expect(key(' ')).toBe('toggle-select');
  expect(key('x')).toBe('toggle-select');
  expect(key('R')).toBe('toggle-reviewed');
  expect(key('Enter')).toBe('open');
  expect(key('a', { ctrlKey: true })).toBe('select-all');
  expect(key('a', { metaKey: true })).toBe('select-all');
  expect(key('Escape')).toBe('escape');
  expect(key('c', { ctrlKey: true })).toBeNull();
  expect(key('r', { altKey: true })).toBeNull();
  expect(key('q')).toBeNull();
  expect(keyAction({ key: 'r', target: { tagName: 'INPUT' } })).toBeNull();
  expect(keyAction({ key: 'j', target: { tagName: 'SELECT' } })).toBeNull();
  expect(keyAction({ key: 'j', target: { tagName: 'DIV', isContentEditable: true } })).toBeNull();
  expect(keyAction({ key: 'r', target: { tagName: 'SW-DROPDOWN' }, path: ['button', 'sw-dropdown', 'div'] })).toBeNull(); // the dropdown's typeahead
  expect(keyAction({ key: ' ', target: { tagName: 'SW-BUTTON' }, path: ['button', 'sw-button'] })).toBeNull(); // a focused button is activated by Space
  expect(keyAction({ key: 'Enter', target: { tagName: 'BUTTON' } })).toBeNull();
  expect(keyAction({ key: 'j', target: { tagName: 'BUTTON' } })).toBe('next'); // arrows and letters still move after a click on a button
});

test('focus moves one card and stops at the ends; the first move lands on the first (or last) card', () => {
  expect(moveFocus(-1, 1, 5)).toBe(0);
  expect(moveFocus(-1, -1, 5)).toBe(4);
  expect(moveFocus(4, 1, 5)).toBe(4);
  expect(moveFocus(0, -1, 5)).toBe(0);
  expect(moveFocus(2, 1, 5)).toBe(3);
  expect(moveFocus(0, 1, 0)).toBe(-1);
});

test('FRG-polish: Home / End jump to the ends, the arrows step through focusAfter; the empty state knows when filters are set', () => {
  expect(key('Home')).toBe('first');
  expect(key('End')).toBe('last');
  expect(keyAction({ key: 'Home', target: { tagName: 'INPUT' } })).toBeNull();
  expect(focusAfter(2, 'first', 5)).toBe(0);
  expect(focusAfter(2, 'last', 5)).toBe(4);
  expect(focusAfter(-1, 'last', 5)).toBe(4);
  expect(focusAfter(2, 'next', 5)).toBe(3);
  expect(focusAfter(0, 'prev', 5)).toBe(0);
  expect(focusAfter(0, 'first', 0)).toBe(-1);
  expect(filtersActive(DEFAULT_FILTERS, DEFAULT_FILTERS)).toBe(false);
  expect(filtersActive({ ...DEFAULT_FILTERS, layer: 'motion' }, DEFAULT_FILTERS)).toBe(false); // the layer is a tab, not a filter to clear
  expect(filtersActive({ ...DEFAULT_FILTERS, camera: 'c1' }, DEFAULT_FILTERS)).toBe(true);
  expect(filtersActive({ ...DEFAULT_FILTERS, status: 'all' }, DEFAULT_FILTERS)).toBe(true);
  expect(filtersActive({ ...DEFAULT_FILTERS, period: '7d' }, DEFAULT_FILTERS)).toBe(true);
});

test('selection toggles without touching the old set; the action targets the selection, else the focused card', () => {
  const s0 = new Set(['a']);
  const s1 = toggleId(s0, 'b');
  expect([...s0]).toEqual(['a']);
  expect([...s1].sort()).toEqual(['a', 'b']);
  expect([...toggleId(s1, 'a')]).toEqual(['b']);
  expect(targetIds(new Set(['x', 'y']), 'z')).toEqual(['x', 'y']);
  expect(targetIds(new Set(), 'z')).toEqual(['z']);
  expect(targetIds(new Set(), null)).toEqual([]);
});

test('reviewed: marking is optimistic, counters follow, and a toggle un-marks only when every target is reviewed', () => {
  const l = list();
  expect(l.items.map((i) => i.id)).toEqual(['rv-1', 'rv-2', 'rv-3', 'rv-4', 'rv-5']);
  expect(l.unreviewed.alert).toBe(4); // rv-3 is reviewed
  const marked = applyReviewed(l, ['rv-1', 'rv-2', 'rv-3'], true);
  expect(marked.items.filter((i) => i.reviewed).map((i) => i.id)).toEqual(['rv-1', 'rv-2', 'rv-3']);
  expect(marked.unreviewed.alert).toBe(2); // rv-3 was already reviewed: not counted twice
  expect(l.items[0].reviewed).toBe(false); // the old list is untouched (a failed save puts it back)
  const un = applyReviewed(marked, ['rv-1'], false);
  expect(un.unreviewed.alert).toBe(3);
  expect(applyReviewed(l, ['nope'], true)).toEqual({ ...l, items: l.items });
  expect(nextReviewedValue(l.items, ['rv-3'])).toBe(false); // all reviewed -> un-mark
  expect(nextReviewedValue(l.items, ['rv-3', 'rv-1'])).toBe(true);
  expect(nextReviewedValue(l.items, [])).toBe(true);
  const floor = applyReviewed({ ...l, unreviewed: { alert: 0, detection: 0, motion: 0 } }, ['rv-1'], true);
  expect(floor.unreviewed.alert).toBe(0); // the counter never goes negative
});

test('the list area is in exactly one state, checked in a fixed order', () => {
  const ready = list();
  const empty = { ...ready, items: [] };
  const base = { loading: false, forbidden: false, error: '', list: ready, statusUnreviewed: true };
  expect(viewOf({ ...base, list: null })).toBe('loading');
  expect(viewOf({ ...base, list: null, error: 'x' })).toBe('error');
  expect(viewOf({ ...base, forbidden: true })).toBe('forbidden');
  expect(viewOf(base)).toBe('ready');
  expect(viewOf({ ...base, list: empty })).toBe('all-reviewed'); // unreviewed filter, but the layer has items: all reviewed
  expect(viewOf({ ...base, list: { ...empty, counts: { alert: 0, detection: 0, motion: 0 } } })).toBe('empty');
  expect(viewOf({ ...base, list: { ...empty, stale: true } })).toBe('offline-empty');
  expect(viewOf({ ...base, list: empty, statusUnreviewed: false })).toBe('empty');
  expect(viewOf({ ...base, list: { ...ready, stale: true } })).toBe('ready'); // stale with data: the list shows, the banner says it
});

test('a next page adds only the cards not already shown', () => {
  const l = list();
  const page = { ...l, items: [l.items[4], { ...l.items[0], id: 'rv-new' }], next_cursor: null };
  const merged = appendPage({ ...l, next_cursor: 'c' }, page);
  expect(merged.items.map((i) => i.id)).toEqual(['rv-1', 'rv-2', 'rv-3', 'rv-4', 'rv-5', 'rv-new']);
  expect(merged.next_cursor).toBeNull();
});

test('the fixtures answer a filter the way the server would, and a detail carries the tracked-object timeline', () => {
  const unrev = reviewList(REVIEW_ITEMS, { layer: 'alert', reviewed: 'false' });
  expect(unrev.items.every((i) => !i.reviewed && i.layer === 'alert')).toBe(true);
  expect(unrev.counts).toEqual({ alert: 5, detection: 2, motion: 2 });
  expect(reviewList(REVIEW_ITEMS, { layer: 'alert', camera: 'fg-yard' }).items.map((i) => i.id)).toEqual(['rv-3']);
  expect(reviewList(REVIEW_ITEMS, { layer: 'alert', object: 'dog' }).items.map((i) => i.id)).toEqual(['rv-2']);
  const d = reviewDetail('rv-2')!;
  expect(d.tracked.map((t: { label: string }) => t.label)).toEqual(['person', 'dog']);
  expect(d.tracked[0].timeline.map((r: { kind: string }) => r.kind)).toEqual(['enter', 'zone', 'zone', 'stationary', 'exit']);
  expect(reviewDetail('rv-8')!.tracked).toEqual([]); // a motion item has no objects
  expect(reviewDetail('nope')).toBeNull();
  const it = REVIEW_ITEMS.find((i: ReviewItem) => i.id === 'rv-5')!;
  expect(it.end).toBeNull(); // still going
});
