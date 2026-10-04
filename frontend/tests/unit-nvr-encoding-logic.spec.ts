import { test, expect } from '@playwright/test';
import {
  EMPTY_DRAFT,
  NO_ENC_FILTERS,
  choicesFor,
  chosenStreams,
  deltas,
  encErrorLine,
  encodingConfirmModel,
  encodingStreams,
  filterStreams,
  keptNotes,
  onBitrateMode,
  onCodec,
  previewSummary,
  selectAllStreams,
  settingsOf,
  startRequest,
  streamName,
  toggleStream,
} from '../src/screens/nvr-encoding-logic';
import { batchView, doneToast, undoConfirmModel } from '../src/screens/nvr-batch-logic';
import type { Batch, EncodingPreview, PlanItem } from '../src/api/nvr-batch';
import type { CameraDetail, NvrCamera, StreamEncoding, StreamOptions } from '../src/api/nvr-settings';

// CR-020 phase D: the pure logic of the bulk encoding change - which streams can be chosen, the checklist's filters and selection, the form's
// option lists and settings, the preview's rows and summary, the ONE confirmation, and the batch dialog's words for an encoding batch. Node only.

function stream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  return {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: 'High', resolution: '2560x1440', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 3072, quality: 60, gop: 50, svc: true, smart_codec: false, b_frames: null, webrtc: 'unknown', webrtc_reason: 'svc',
    fields: {}, writable: true, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
}
const cam = (ch: number, name: string, main: Partial<StreamEncoding> = {}, extra: Partial<NvrCamera> = {}): NvrCamera => ({
  camera_id: `c${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: true, enabled_in_arx: true,
  streams: [stream(`${ch}01`, 'main', main), stream(`${ch}02`, 'sub', { svc: null, resolution: '640x360', codec: main.codec ?? 'H.264', webrtc: 'ok' })], error: null, ...extra,
});
const opts = (over: Partial<StreamOptions> = {}): StreamOptions => ({
  codec: ['H.264', 'H.265'], profile: { 'H.264': ['Baseline', 'Main', 'High'], 'H.265': ['Main'] },
  resolution: { 'H.264': ['2560x1440', '1920x1080', '1280x720'], 'H.265': ['2560x1440', '1920x1080'] }, fps: [25, 20, 15], fps_full: true,
  bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 32, max: 8192 }, quality: [30, 60, 90], gop: { min: 1, max: 400 }, svc: true, smart_codec: true, b_frames: false,
  locks: { smart_codec: ['gop'] }, source: 'capabilities', ...over,
});
const detail = (c: NvrCamera, o: Partial<CameraDetail> = {}): CameraDetail => ({ camera: c, options: Object.fromEntries(c.streams.map((s) => [s.stream_ref, opts()])), stale: false, can_write: true, ...o });

const CAMS = [cam(1, 'כניסה'), cam(2, 'חצר', { codec: 'H.265', profile: 'Main' }), cam(3, 'גג', {}, { online: false }), cam(4, 'מחסן')];
const details = (): Map<string, CameraDetail | 'error'> => new Map<string, CameraDetail | 'error'>([['c1', detail(CAMS[0])], ['c2', detail(CAMS[1])], ['c3', detail(CAMS[2])], ['c4', 'error']]);

test.describe('nvr-encoding-logic', () => {
  test('every stream of every camera is listed; only readable, writable, online ones can be chosen, with the reason', () => {
    const rows = encodingStreams(CAMS, details(), false);
    expect(rows.map((r) => r.key)).toEqual(['c1:101', 'c1:102', 'c2:201', 'c2:202', 'c3:301', 'c3:302', 'c4:401', 'c4:402']);
    expect(rows.filter((r) => r.selectable).map((r) => r.key)).toEqual(['c1:101', 'c1:102', 'c2:201', 'c2:202']);
    expect(rows.find((r) => r.key === 'c3:301')?.reason).toBe('המצלמה אינה מקוונת');
    expect(rows.find((r) => r.key === 'c4:401')?.reason).toBe('ה־NVR אינו זמין');
    // not read yet, no options, not writable, a camera deny (not listed at all), a stale list
    const d = details();
    d.delete('c1');
    d.set('c2', detail(CAMS[1], { options: { '201': null, '202': opts() } }));
    const r2 = encodingStreams(CAMS, d, false);
    expect(r2.find((r) => r.key === 'c1:101')?.reason).toBe('נטען');
    expect(r2.find((r) => r.key === 'c2:201')?.reason).toBe('יכולות הזרם אינן ידועות');
    d.set('c2', detail({ ...CAMS[1], streams: [stream('201', 'main', { writable: false, not_writable_reason: 'proxied' })] }));
    expect(encodingStreams(CAMS, d, false).find((r) => r.key === 'c2:201')?.reason).toBe('ה־NVR אינו מאפשר לשנות את הזרם הזה');
    d.set('c2', detail(CAMS[1], { can_write: false }));
    expect(encodingStreams(CAMS, d, false).some((r) => r.cameraId === 'c2')).toBe(false);
    expect(encodingStreams(CAMS, details(), true).every((r) => !r.selectable)).toBe(true);
  });

  test('filters: role (main / sub), codec, SVC, WebRTC and the search; select all takes only selectable matches', () => {
    const rows = encodingStreams(CAMS, details(), false);
    expect(filterStreams(rows, { ...NO_ENC_FILTERS, role: 'main' }).map((r) => r.key)).toEqual(['c1:101', 'c2:201', 'c3:301', 'c4:401']);
    expect(filterStreams(rows, { ...NO_ENC_FILTERS, role: 'sub', codec: 'h265' }).map((r) => r.key)).toEqual(['c2:202']);
    expect(filterStreams(rows, { ...NO_ENC_FILTERS, svc: 'none' }).every((r) => r.role === 'sub')).toBe(true);
    expect(filterStreams(rows, { ...NO_ENC_FILTERS, webrtc: 'ok' }).every((r) => r.role === 'sub')).toBe(true);
    expect(filterStreams(rows, { ...NO_ENC_FILTERS, q: 'ערוץ 2 משני' }).map((r) => r.key)).toEqual(['c2:202']);
    const all = selectAllStreams(new Set(), filterStreams(rows, { ...NO_ENC_FILTERS, role: 'main' }));
    expect([...all]).toEqual(['c1:101', 'c2:201']);
    const t = toggleStream(all, rows.find((r) => r.key === 'c3:301')!);
    expect(t.has('c3:301')).toBe(false); // not selectable: a press does nothing
    expect(chosenStreams(rows, toggleStream(all, rows[1])).map((r) => r.key)).toEqual(['c1:101', 'c1:102', 'c2:201']);
  });

  test('the form offers the union of the chosen streams options and builds only the fields that were set', () => {
    const rows = chosenStreams(encodingStreams(CAMS, details(), false), new Set(['c1:101', 'c2:201']));
    const ch = choicesFor(rows, details(), '');
    expect(ch.codec).toEqual(['H.264', 'H.265']);
    expect(ch.resolution).toEqual(['2560x1440', '1920x1080', '1280x720']); // each stream's own codec, biggest first
    expect(choicesFor(rows, details(), 'H.265').resolution).toEqual(['2560x1440', '1920x1080']);
    expect(ch.bitrate).toEqual({ min: 32, max: 8192 });
    expect(settingsOf(EMPTY_DRAFT, ch)).toEqual({ settings: {}, invalid: [] });
    const d = { ...EMPTY_DRAFT, codec: 'H.264' as const, fps: 'full', bitrate_kbps: '4096', gop: ' 25 ', svc: 'off' as const };
    expect(settingsOf(d, ch)).toEqual({ settings: { codec: 'H.264', fps: 'full', bitrate_kbps: 4096, gop: 25, svc: false }, invalid: [] });
    expect(settingsOf({ ...EMPTY_DRAFT, bitrate_kbps: '99999', gop: 'abc' }, ch).invalid).toEqual(['bitrate_kbps', 'gop']);
    // a new codec without the chosen resolution clears it; CBR clears quality
    expect(onCodec({ ...EMPTY_DRAFT, resolution: '1280x720' }, 'H.265', choicesFor(rows, details(), 'H.265')).resolution).toBe('');
    expect(onBitrateMode({ ...EMPTY_DRAFT, quality: '60' }, 'CBR').quality).toBe('');
  });

  const item = (over: Partial<PlanItem>): PlanItem => ({
    index: 0, camera_id: 'c1', stream_ref: '101', role: 'main', status: 'change', if_match: '0123456789abcdef', changes: { codec: 'H.265', profile: 'Main' },
    fields: { profile: ['High', 'Main'], codec: ['H.264', 'H.265'] }, notes: [{ kind: 'adjusted', field: 'profile', reason: 'profile_codec', message: 'הפרופיל הנוכחי אינו קיים בקידוד החדש.' },
      { kind: 'kept', field: 'svc', reason: 'not_in_stream', message: 'לא קיים בזרם הזה; נשאר כמו שהוא.' }], reason: null, message: null, ...over,
  });
  const preview: EncodingPreview = {
    recorder_id: 'nvr-1', settings: { codec: 'H.265' }, changes_total: 3, adjusted: 1, batch_in_progress: false, counts: { change: 2, unchanged: 1, skip: 1 },
    items: [item({}), item({ index: 1, stream_ref: '102', role: 'sub', changes: { codec: 'H.265' }, fields: { codec: ['H.264', 'H.265'] }, notes: [] }),
      item({ index: 2, camera_id: 'c2', stream_ref: '201', status: 'unchanged', changes: {}, fields: {}, notes: [] }),
      item({ index: 3, camera_id: 'c3', stream_ref: '301', status: 'skip', changes: {}, fields: {}, notes: [], reason: 'codec_not_offered', message: 'המצלמה אינה תומכת בקידוד הזה.' })],
  };

  test('preview rows: before → after in field order, adjusted marked with the reason, kept fields named', () => {
    const ds = deltas(preview.items[0]);
    expect(ds.map((d) => [d.field, d.from, d.to, d.adjusted])).toEqual([['codec', 'H.264', 'H.265', false], ['profile', 'High', 'Main', true]]);
    expect(ds[1].why).toBe('הפרופיל הנוכחי אינו קיים בקידוד החדש.');
    expect(keptNotes(preview.items[0])).toEqual([{ label: 'SVC', why: 'לא קיים בזרם הזה; נשאר כמו שהוא.' }]);
    expect(previewSummary(preview)).toBe('ישתנו 2 זרמים · לא ניתן: זרם אחד · כבר מוגדרים: זרם אחד');
  });

  test('the start carries exactly the planned changes of every changing stream; one confirmation with the streams under "פרטים"', () => {
    expect(startRequest(preview)).toEqual({
      confirm: true, settings: { codec: 'H.265' }, recorder_id: 'nvr-1',
      targets: [{ camera_id: 'c1', stream_ref: '101', if_match: '0123456789abcdef', changes: { codec: 'H.265', profile: 'Main' } }, { camera_id: 'c1', stream_ref: '102', if_match: '0123456789abcdef', changes: { codec: 'H.265' } }],
    });
    const m = encodingConfirmModel(preview, (it) => streamName('כניסה', it.role));
    expect([m.heading, m.count, m.confirmLabel, m.names]).toEqual(['לשנות את הקידוד ב־2 זרמים?', '3 שינויים', 'החל', ['כניסה · ראשי', 'כניסה · משני']]);
    expect(encErrorLine({ status: 409, code: 'plan_changed' }).reload).toBe(true);
    expect(encErrorLine({ status: 409, code: 'batch_in_progress' }).text).toBe('מתבצע שינוי מרובה');
  });

  test('the batch dialog speaks of streams and of the encoding for an encoding batch', () => {
    const b = (state: Batch['state'], kind: Batch['kind'] = 'write'): Batch => ({
      batch_id: 'b1', kind, state, mode: 'encoding', total: 3, can_rollback: true,
      items: [0, 1, 2].map((index) => ({ index, camera_id: 'c1', stream_ref: `10${index + 1}`, status: 'applied' as const })),
    });
    expect(batchView(b('completed'), () => 'x').title).toBe('הקידוד עודכן ב־3 זרמים');
    expect(batchView(b('completed', 'rollback'), () => 'x').title).toBe('הקידוד הוחזר ב־3 זרמים');
    expect(doneToast(b('completed'))).toEqual({ message: 'נשמר ב־3 זרמים', undo: true });
    expect(undoConfirmModel(['a', 'b'], 'encoding').heading).toBe('להחזיר את הקידוד ב־2 זרמים?');
    expect(batchView({ ...b('completed'), mode: undefined }, () => 'x').title).toBe('SVC כבוי ב־3 מצלמות'); // an older server: an SVC batch
  });
});
