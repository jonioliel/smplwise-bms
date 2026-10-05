import { test, expect } from '@playwright/test';
import { control, errorLine, lockedBy, reasonHe, shownFields, draftOf, diffDraft, type Ctx } from '../src/screens/nvr-cameras-edit';
import { choicesFor, encodingStreams, settingsOf, EMPTY_DRAFT } from '../src/screens/nvr-encoding-logic';
import type { CameraDetail, NvrCamera, StreamEncoding, StreamOptions } from '../src/api/nvr-settings';

// CR-025 NN2B: a Provision-ISR camera in the NVR camera editor and the bulk encoding editor. The vendor-specific part is DATA: the stream carries
// `fields.svc / fields.b_frames = {supported: false}` and its options carry `svc: false`, `b_frames: false`, quality 1..5, a bitrate list - the
// existing capability mechanism hides what the device lacks, and `writable` / `not_writable_reason` is declared per stream. Node only.

function pstream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  return {
    stream_ref: ref, role, enabled: true, codec: 'H.265', codec_raw: 'h265', codec_plus: false, profile: 'main', resolution: '2592x1520', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 3072, quality: 4, gop: 50, svc: null, smart_codec: false, b_frames: null, webrtc: 'unknown', webrtc_reason: 'h265',
    fields: { svc: { supported: false, editable: false }, b_frames: { supported: false, editable: false } },
    writable: true, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
}

const POPTS: StreamOptions = {
  codec: ['H.264', 'H.265'], profile: { 'H.264': ['baseline', 'main', 'high'], 'H.265': ['main'] },
  resolution: { 'H.264': ['2592x1520', '1920x1080'], 'H.265': ['2592x1520', '1920x1080'] }, fps: [1, 2, 3, 4, 5, 6, 10, 15, 20, 25], fps_full: false,
  bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 64, max: 8192 }, quality: [1, 2, 3, 4, 5], gop: { min: 25, max: 1500 }, svc: false, smart_codec: true, b_frames: false,
  locks: {}, source: 'stream_caps',
};

const pcam = (ch: number, streams: StreamEncoding[], extra: Partial<NvrCamera> = {}): NvrCamera => ({
  camera_id: `p${ch}`, recorder_id: 'nvr-2', source_ref: String(ch), channel: ch, name: `Provision ${ch}`, online: true, enabled_in_arx: true, streams, error: null, ...extra,
});
const pdetail = (c: NvrCamera, extra: Partial<CameraDetail> = {}): CameraDetail => ({
  camera: c, options: Object.fromEntries(c.streams.map((s) => [s.stream_ref, POPTS])), can_write: true, stale: false, ...extra,
});

test.describe('Provision streams in the camera editor', () => {
  const main = pstream('101', 'main');
  const c = pcam(1, [main, pstream('102', 'sub', { codec: 'H.264', profile: 'baseline', resolution: '704x576', bitrate_mode: 'CBR', quality: null })]);
  const ctx = (over: Partial<Ctx> = {}): Ctx => ({ canWrite: true, stale: false, detail: pdetail(c), ...over });

  test('no SVC toggle (the stream has no SVC element) and the pencil is enabled', () => {
    expect(control('svc', c, main, ctx()).show).toBe(false);
    expect(control('edit', c, main, ctx())).toEqual({ show: true, enabled: true, reason: '' });
  });

  test('the editor offers resolution, frame rate, bit-rate mode + bit rate, quality, GOP, codec, profile - and neither SVC nor B-frames', () => {
    const shown = shownFields(main, POPTS, draftOf(main));
    expect(shown).toEqual(['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'smart_codec']);
    expect(shown).not.toContain('svc');
    expect(shown).not.toContain('b_frames' as never);
  });

  test('a stream without a quality field (CBR sub) shows no quality control', () => {
    const sub = c.streams[1];
    expect(shownFields({ ...sub, fields: { ...sub.fields, quality: { supported: false, editable: false } } }, POPTS, draftOf(sub))).not.toContain('quality');
  });

  test('quality is a 1..5 scale and only under VBR; the diff carries the value as the request does', () => {
    expect(lockedBy('quality', main, POPTS, { ...draftOf(main), bitrate_mode: 'CBR' })).toBe('bitrate_mode');
    expect(lockedBy('quality', main, POPTS, draftOf(main))).toBeNull();
    expect(diffDraft(main, POPTS, { ...draftOf(main), quality: '5', gop: '60', bitrate_kbps: '2048' })).toEqual({ quality: 5, gop: 60, bitrate_kbps: 2048 });
  });

  test('a stream the NVR refuses is disabled with its reason (R2), another stream of the same camera stays editable', () => {
    const refused = pcam(2, [pstream('201', 'main', { writable: false, not_writable_reason: 'device_refused' }), pstream('202', 'sub')]);
    const d = pdetail(refused);
    expect(control('edit', refused, refused.streams[0], { canWrite: true, stale: false, detail: d })).toEqual({ show: true, enabled: false, reason: 'ה־NVR אינו מעביר שינויים למצלמה הזו' });
    expect(control('edit', refused, refused.streams[1], { canWrite: true, stale: false, detail: d }).enabled).toBe(true);
  });

  test('every support-gate reason has its own Hebrew line, never the raw code', () => {
    expect(reasonHe('device_refused')).toBe('ה־NVR אינו מעביר שינויים למצלמה הזו');
    expect(reasonHe('write_api_missing')).toBe('ה־NVR אינו תומך בשינוי הגדרות זרם');
    expect(reasonHe('no_caps')).toBe('יכולות הזרם אינן ידועות');
    expect(reasonHe('writes_disabled')).toBe('כתיבה ל־NVR הזה כבויה');
  });

  test('a write the NVR refuses (409 nvr_not_supported) ends as one short line, no reload loop', () => {
    expect(errorLine({ status: 409, code: 'nvr_not_supported', details: { reason: 'device_refused' } })).toEqual({ text: 'ה־NVR אינו תומך בשינוי הזה.', reload: false });
  });
});

test.describe('Provision streams in the bulk encoding editor', () => {
  const cams = [
    pcam(1, [pstream('101', 'main'), pstream('102', 'sub', { codec: 'H.264' })]),
    pcam(2, [pstream('201', 'main', { writable: false, not_writable_reason: 'device_refused' }), pstream('202', 'sub', { writable: false, not_writable_reason: 'device_refused' })]),
  ];
  const details = new Map<string, CameraDetail | 'error'>(cams.map((c) => [c.camera_id as string, pdetail(c)]));

  test('streams the NVR does not pass writes to are listed but cannot be chosen, with the reason', () => {
    const rows = encodingStreams(cams, details, false);
    expect(rows.filter((r) => r.selectable).map((r) => r.key)).toEqual(['p1:101', 'p1:102']);
    expect(rows.find((r) => r.key === 'p2:201')?.reason).toBe('ה־NVR אינו מעביר שינויים למצלמה הזו');
  });

  test('the form offers no SVC for Provision streams, offers the 1..5 quality scale, and the device bounds for bit rate and GOP', () => {
    const rows = encodingStreams(cams, details, false).filter((r) => r.selectable);
    const ch = choicesFor(rows, details, '');
    expect(ch.svc).toBe(false);
    expect(ch.quality).toEqual([5, 4, 3, 2, 1]);
    expect(ch.bitrate).toEqual({ min: 64, max: 8192 });
    expect(ch.gop).toEqual({ min: 25, max: 1500 });
    expect(ch.bitrateMode).toEqual(['CBR', 'VBR']);
  });

  test('a GOP below the device minimum is invalid before any request', () => {
    const rows = encodingStreams(cams, details, false).filter((r) => r.selectable);
    const ch = choicesFor(rows, details, '');
    const { settings, invalid } = settingsOf({ ...EMPTY_DRAFT, gop: '5', bitrate_kbps: '2048' }, ch);
    expect(invalid).toEqual(['gop']);
    expect(settings).toEqual({ bitrate_kbps: 2048 });
  });
});
