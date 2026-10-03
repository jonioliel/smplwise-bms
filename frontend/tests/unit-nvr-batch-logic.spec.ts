import { test, expect } from '@playwright/test';
import {
  batchCandidates,
  batchConfirmModel,
  batchView,
  camerasLabel,
  chosen,
  clearSelection,
  doneToast,
  filterCandidates,
  firstProblem,
  focusIndex,
  inCameras,
  isUnsettled,
  itemLine,
  scrollFor,
  selectAllMatching,
  startErrorLine,
  tally,
  toggleSelection,
  toneOf,
  undoConfirmModel,
  windowOf,
} from '../src/screens/nvr-batch-logic';
import { normalizeActive, normalizeBatch, type Batch, type BatchItem, type BatchItemStatus } from '../src/api/nvr-batch';
import type { CameraDetail, NvrCamera, StreamEncoding } from '../src/api/nvr-settings';

// CR-020 S2C: the pure logic of the multi-camera change - candidates, selection, the window of a long list, the plain Hebrew of every
// state of a batch, the error lines. Node only: the same modules the screen uses.

function stream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  return {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: null, resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: true, smart_codec: false, b_frames: null, webrtc: 'unknown', webrtc_reason: 'svc',
    fields: {}, writable: null, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
}
const cam = (ch: number, name: string, main: Partial<StreamEncoding> = {}, extra: Partial<NvrCamera> = {}): NvrCamera => ({
  camera_id: `c${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: true, enabled_in_arx: true, streams: [stream(`${ch}01`, 'main', main), stream(`${ch}02`, 'sub', { svc: null })], error: null, ...extra,
});

const item = (index: number, status: BatchItemStatus, extra: Partial<BatchItem> = {}): BatchItem => ({ index, camera_id: `c${index + 1}`, stream_ref: `${index + 1}01`, status, ...extra });
const batch = (state: Batch['state'], statuses: BatchItemStatus[], extra: Partial<Batch> = {}): Batch => ({
  batch_id: 'b1', kind: 'write', state, items: statuses.map((s, i) => item(i, s)), ...extra,
});
const name = (i: BatchItem) => `מצלמה ${i.index + 1}`;

test.describe('batch candidates', () => {
  const none = new Map<string, CameraDetail | 'error'>();
  test('only an online H.264 main with SVC on, sorted by channel; offline, H.265, SVC off, no etag, stale are left out', () => {
    const cams = [
      cam(3, 'ג'),
      cam(1, 'א'),
      cam(2, 'ב', { codec: 'H.265', codec_raw: 'H.265' }),
      cam(4, 'ד', { svc: false }),
      cam(5, 'ה', {}, { online: false }),
      cam(6, 'ו', { etag: null }),
      cam(7, 'ז', { svc: null }),
      cam(8, 'ח', {}, { camera_id: null }),
    ];
    expect(batchCandidates(cams, none, false).map((c) => c.cameraId)).toEqual(['c1', 'c3']);
    expect(batchCandidates(cams, none, true)).toEqual([]);
  });
  test('a detail that says not writable, a camera deny, an unreadable detail or unreadable options removes the camera; the detail copy wins over the list', () => {
    const c1 = cam(1, 'א');
    const c2 = cam(2, 'ב');
    const c3 = cam(3, 'ג');
    const c4 = cam(4, 'ד');
    const det = (c: NvrCamera, over: Partial<StreamEncoding>, extra: Partial<CameraDetail> = {}): CameraDetail => ({ camera: { ...c, streams: c.streams.map((s) => (s.role === 'main' ? { ...s, ...over } : s)) }, can_write: true, ...extra });
    const details = new Map<string, CameraDetail | 'error'>([
      ['c1', det(c1, { writable: false })],
      ['c2', 'error'],
      ['c3', det(c3, { writable: true, etag: 'fresh' })],
      ['c4', det(c4, { writable: true }, { can_write: false })],
    ]);
    const out = batchCandidates([c1, c2, c3, c4], details, false);
    expect(out.map((c) => [c.cameraId, c.etag])).toEqual([['c3', 'fresh']]);
    expect(batchCandidates([c1], new Map([['c1', det(c1, { writable: true }, { options: { '101': null } })]]), false)).toEqual([]);
  });
});

test.describe('selection', () => {
  const list = [1, 2, 3, 4, 5].map((n) => ({ cameraId: `c${n}`, recorderId: 'nvr-1', name: n === 3 ? 'חצר אחורית' : `כניסה ${n}`, channel: n, streamRef: `${n}01`, etag: 'e' }));
  test('search: words in the name, "ערוץ N" is a channel', () => {
    expect(filterCandidates(list, '').length).toBe(5);
    expect(filterCandidates(list, 'חצר').map((c) => c.cameraId)).toEqual(['c3']);
    expect(filterCandidates(list, 'כניסה 4').map((c) => c.cameraId)).toEqual(['c4']);
    expect(filterCandidates(list, 'ערוץ 2').map((c) => c.cameraId)).toEqual(['c2']);
    expect(filterCandidates(list, 'כניסה ערוץ 5').map((c) => c.cameraId)).toEqual(['c5']);
    expect(filterCandidates(list, 'zzz')).toEqual([]);
  });
  test('select all adds every match (not only the visible rows), clear keeps the fixed camera, the fixed camera cannot be toggled off', () => {
    let sel = new Set(['c1']);
    sel = selectAllMatching(sel, filterCandidates(list, 'כניסה'));
    expect([...sel].sort()).toEqual(['c1', 'c2', 'c4', 'c5']);
    sel = toggleSelection(sel, 'c1', 'c1');
    expect(sel.has('c1')).toBe(true);
    sel = toggleSelection(sel, 'c2', 'c1');
    expect(sel.has('c2')).toBe(false);
    sel = toggleSelection(sel, 'c3', 'c1');
    expect(sel.has('c3')).toBe(true);
    expect([...clearSelection('c1')]).toEqual(['c1']);
    expect([...clearSelection(null)]).toEqual([]);
    expect(chosen(list, new Set(['c5', 'c2'])).map((c) => c.cameraId)).toEqual(['c2', 'c5']);
  });
});

test.describe('window of a long list', () => {
  test('hundreds of rows draw a handful', () => {
    const w = windowOf(0, 400, 500, 44);
    expect(w.start).toBe(0);
    expect(w.end).toBeLessThan(25);
    expect(w.total).toBe(22000);
    const mid = windowOf(44 * 200, 400, 500, 44);
    expect(mid.start).toBe(195);
    expect(mid.top).toBe(195 * 44);
    expect(mid.end - mid.start).toBeLessThan(25);
    const last = windowOf(1e9, 400, 500, 44);
    expect(last.end).toBe(500);
    expect(windowOf(0, 400, 0, 44)).toEqual({ start: 0, end: 0, top: 0, total: 0 });
    expect(scrollFor(100, 400, 52)).toBe(100 * 52 - (400 - 52) / 2);
    expect(scrollFor(0, 400, 52)).toBe(0);
  });
});

test.describe('batch numbers and words', () => {
  test('tally from the items, from the counts when there are no items', () => {
    const b = batch('running', ['applied', 'applied', 'pending', 'queued', 'queued']);
    expect(tally(b)).toMatchObject({ total: 5, ok: 2, processed: 2, inFlight: 1, queued: 2, applied: 2 });
    expect(tally({ batch_id: 'x', kind: 'write', state: 'running', counts: { applied: 3, queued: 7 } })).toMatchObject({ total: 10, processed: 3 });
  });
  test('running: "2 מתוך 3" with "עצור"; stopping says it waits for the camera in flight', () => {
    const b = batch('running', ['applied', 'applied', 'pending']);
    expect(batchView(b, name)).toMatchObject({ tone: 'running', title: '2 מתוך 3', canStop: true, showUndo: false });
    expect(batchView(b, name, true)).toMatchObject({ sub: 'עוצר אחרי המצלמה הנוכחית', canStop: false });
  });
  test('completed, stopped by the user, failed at a camera, unknown outcome, interrupted', () => {
    expect(batchView(batch('completed', ['applied', 'applied', 'applied']), name)).toMatchObject({ tone: 'done', title: 'SVC כבוי ב־3 מצלמות', showUndo: true, canUndo: true });
    expect(batchView(batch('completed', ['applied', 'unchanged']), name)).toMatchObject({ title: 'SVC כבוי במצלמה אחת', sub: 'ללא שינוי במצלמה אחת' });
    expect(batchView(batch('stopped', ['applied', 'not_attempted', 'not_attempted']), name)).toMatchObject({ tone: 'warn', title: 'נעצר בבקשתך', sub: 'נשמר במצלמה אחת · לא בוצע ב־2 מצלמות', showUndo: true });
    const failed = batch('failed', ['applied', 'refused', 'not_attempted']);
    expect(batchView(failed, name)).toMatchObject({ tone: 'error', title: 'נעצר במצלמה מצלמה 2', sub: 'נשמר במצלמה אחת · נכשל במצלמה אחת · לא בוצע במצלמה אחת', showUndo: true, canUndo: true });
    const unknown = batch('stopped_unknown', ['applied', 'unknown', 'not_attempted']);
    expect(batchView(unknown, name)).toMatchObject({ title: 'נעצר: לא ברור אם בוצע במצלמה מצלמה 2', showUndo: true, canUndo: false });
    expect(isUnsettled(unknown)).toBe(true);
    expect(batchView(batch('interrupted', ['applied', 'not_attempted']), name)).toMatchObject({ title: 'השינוי נקטע באמצע', canUndo: true });
    expect(batchView(batch('failed', ['refused', 'not_attempted']), name).showUndo).toBe(false); // nothing was saved: nothing to undo
  });
  test('rollback: restored and still-changed counts, retry only with the source id', () => {
    const done = batch('completed', ['applied', 'rolled_back'], { kind: 'rollback', rollback_of: 'b0' });
    expect(batchView(done, name)).toMatchObject({ title: 'SVC הוחזר ב־2 מצלמות', showUndo: false, showRetry: false });
    const partial = batch('failed', ['applied', 'refused', 'not_attempted'], { kind: 'rollback', rollback_of: 'b0' });
    expect(batchView(partial, name)).toMatchObject({ title: 'ההחזרה נעצרה במצלמה מצלמה 2', sub: 'הוחזר במצלמה אחת · לא הוחזר ב־2 מצלמות', showRetry: true, showUndo: false });
    expect(batchView({ ...partial, rollback_of: null }, name).showRetry).toBe(false);
  });
  test('toast text carries the count', () => {
    expect(doneToast(batch('completed', ['applied', 'applied', 'applied']))).toEqual({ message: 'נשמר ב־3 מצלמות', undo: true });
    expect(doneToast(batch('completed', ['unchanged', 'unchanged']))).toEqual({ message: 'ללא שינוי', undo: false });
    expect(doneToast(batch('completed', ['applied', 'applied'], { kind: 'rollback' }))).toEqual({ message: 'בוטל ב־2 מצלמות', undo: false });
    expect(camerasLabel(1)).toBe('מצלמה אחת');
    expect(inCameras(12)).toBe('ב־12 מצלמות');
  });
  test('item tones and lines; a hostile server line stays plain text', () => {
    expect(toneOf(item(0, 'queued'))).toBe('wait');
    expect(toneOf(item(0, 'pending'))).toBe('spin');
    expect(toneOf(item(0, 'applied'))).toBe('ok');
    expect(toneOf(item(0, 'nvr_busy' as BatchItemStatus))).toBe('wait');
    expect(toneOf(item(0, 'refused'))).toBe('bad');
    expect(toneOf(item(0, 'unknown'))).toBe('unk');
    expect(toneOf(item(0, 'not_attempted'))).toBe('skip');
    expect(itemLine(item(0, 'unknown'), 'write')).toBe('לא ברור אם בוצע. נבדק מול ה־NVR.');
    expect(itemLine(item(0, 'not_attempted'), 'write')).toBe('לא בוצע');
    expect(itemLine(item(0, 'refused', { error_code: 'nvr_busy' }), 'write')).toBe('ה־NVR עסוק. נסו שוב בעוד רגע.');
    const hostile = '<img src=x onerror=alert(1)>';
    expect(itemLine(item(0, 'failed', { error_code: 'weird', user_message: hostile }), 'write')).toBe(hostile); // the screen renders text; nothing builds HTML
    expect(itemLine(item(0, 'applied'), 'rollback')).toBe('הוחזר');
  });
  test('the problem camera and the row to bring into view', () => {
    const b = batch('failed', ['applied', 'refused', 'not_attempted']);
    expect(firstProblem(b)?.index).toBe(1);
    expect(focusIndex(b)).toBe(1);
    expect(focusIndex(batch('running', ['applied', 'pending', 'queued']))).toBe(1);
    expect(focusIndex(batch('running', ['applied', 'queued', 'queued']))).toBe(1);
    expect(focusIndex(batch('completed', ['applied', 'applied']))).toBe(0);
  });
  test('confirmations: count in the heading, the names listed', () => {
    const m = batchConfirmModel(['א', 'ב', 'ג']);
    expect(m).toMatchObject({ heading: 'לכבות SVC ב־3 מצלמות?', count: '3 מצלמות', confirmLabel: 'כבה', names: ['א', 'ב', 'ג'] });
    expect(m.lead).toBe('השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.');
    expect(undoConfirmModel(['א', 'ב'])).toMatchObject({ heading: 'להחזיר SVC ב־2 מצלמות?', confirmLabel: 'החזר' });
  });
  test('start errors in plain words; stale names the camera and asks for a reload', () => {
    expect(startErrorLine({ status: 409, code: 'batch_in_progress' })).toEqual({ text: 'מתבצע שינוי מרובה', reload: false });
    expect(startErrorLine({ status: 409, code: 'stale', details: { index: 1 } }, (i) => `מצלמה ${i + 1}`)).toEqual({ text: 'הערכים של מצלמה 2 השתנו ב־NVR. נטען מחדש.', reload: true });
    expect(startErrorLine({ status: 409, code: 'stale' })).toEqual({ text: 'הערכים השתנו ב־NVR. נטען מחדש.', reload: true });
    expect(startErrorLine({ status: 403, code: 'forbidden' }).text).toBe('אין הרשאה לפעולה הזו.');
    expect(startErrorLine({ status: 0, code: 'network' }).text).toBe('אין חיבור לשרת.');
    expect(startErrorLine({ status: 422, code: 'validation' }).text).toBe('הבחירה אינה תקינה.');
  });
});

test.describe('the client module', () => {
  test('?active=1 is read in every answer shape', () => {
    const b = { batch_id: 'b1', kind: 'write', state: 'running' };
    expect(normalizeActive(b)?.batch_id).toBe('b1');
    expect(normalizeActive({ batch: b })?.batch_id).toBe('b1');
    expect(normalizeActive({ batch: null })).toBeNull();
    expect(normalizeActive({ batches: [{ ...b, state: 'completed', batch_id: 'b0' }, b] })?.batch_id).toBe('b1');
    expect(normalizeActive({ batches: [] })).toBeNull();
    expect(normalizeActive(null)).toBeNull();
    expect(normalizeActive('x')).toBeNull();
  });
});

test.describe('the backend contract of pilot/CR020-s2c (7068b093)', () => {
  test('an unknown outcome the server could not prove ends `interrupted` with an unknown_* reason: the same plain words as an unknown stop', () => {
    const b = batch('interrupted', ['applied', 'unknown', 'not_attempted'], { stopped_reason: 'unknown_unverified' });
    expect(batchView(b, name)).toMatchObject({ tone: 'error', title: 'נעצר: לא ברור אם בוצע במצלמה מצלמה 2', showUndo: true, canUndo: false });
    const settled = batch('interrupted', ['applied', 'applied', 'not_attempted'], { stopped_reason: 'unknown_unverified', can_rollback: true });
    expect(batchView(settled, name)).toMatchObject({ title: 'השינוי נקטע באמצע', canUndo: true }); // settled: no problem camera left
    expect(batchView(batch('interrupted', ['applied', 'not_attempted'], { stopped_reason: 'interrupted' }), name).title).toBe('השינוי נקטע באמצע');
    // the check found the camera on the old value: that is a plain failure at the camera, not an unknown
    expect(batchView(batch('interrupted', ['applied', 'no_effect', 'not_attempted'], { stopped_reason: 'unknown_not_applied' }), name)).toMatchObject({ title: 'נעצר במצלמה מצלמה 2', showUndo: true });
  });
  test('a running batch with an unknown item says it is being checked; the server's can_rollback:false keeps undo-all off', () => {
    const b = batch('running', ['applied', 'unknown', 'queued']);
    expect(batchView(b, name)).toMatchObject({ title: '1 מתוך 3', sub: 'נבדק מול ה־NVR', canStop: true });
    expect(batchView(batch('failed', ['applied', 'refused'], { can_rollback: false }), name)).toMatchObject({ showUndo: true, canUndo: false });
    expect(batchView(batch('failed', ['applied', 'refused'], { can_rollback: true }), name).canUndo).toBe(true);
  });
  test('the total is the server's (items of cameras the person may not see are hidden); `running` items are in flight', () => {
    const b = batch('running', ['applied', 'running'], { total: 5 });
    expect(tally(b)).toMatchObject({ total: 5, processed: 1, inFlight: 1 });
    expect(batchView(b, name).title).toBe('1 מתוך 5');
    expect(toneOf(item(0, 'running'))).toBe('spin');
  });
  test('the undone batch is `source_batch_id` on the wire and `rollback_of` for the screen', () => {
    expect(normalizeBatch({ batch_id: 'b2', kind: 'rollback', state: 'running', source_batch_id: 'b1' }).rollback_of).toBe('b1');
    expect(normalizeBatch({ batch_id: 'b2', kind: 'rollback', state: 'running', rollback_of: 'b9', source_batch_id: 'b1' }).rollback_of).toBe('b9');
    expect(normalizeBatch({ batch_id: 'b1', kind: 'write', state: 'running' }).rollback_of).toBeNull();
  });
  test('the backend's refusal codes have plain lines', () => {
    expect(startErrorLine({ status: 422, code: 'batch_target_not_allowed', details: { reason: 'svc' } })).toEqual({ text: 'אחת המצלמות אינה מתאימה לשינוי. נטען מחדש.', reload: true });
    expect(startErrorLine({ status: 409, code: 'write_in_progress' }).text).toBe('שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.');
    expect(startErrorLine({ status: 503, code: 'capabilities_unreadable' }).text).toBe('יכולות הזרם אינן ידועות, ולכן השינוי בוטל.');
  });
});

