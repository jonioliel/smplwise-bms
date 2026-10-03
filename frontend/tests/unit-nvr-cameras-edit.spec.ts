import { test, expect } from '@playwright/test';
import {
  EDIT_FIELDS,
  confirmModel,
  control,
  diffDraft,
  draftOf,
  errorLine,
  invalidFields,
  isUnknownOutcome,
  lastChanges,
  lockedBy,
  reconcile,
  shownFields,
  undoable,
  valueLabel,
  changeFields,
  type Ctx,
} from '../src/screens/nvr-cameras-edit';
import { ApiError } from '../src/api/client';
import { nvrSettings, resetNvrSettingsDemo, type CameraDetail, type NvrCamera, type StreamChange, type StreamEncoding, type StreamOptions } from '../src/api/nvr-settings';
import { shapeOf } from '../src/screens/nvr-cameras-actions';

// CR-020 S2 phase B: the pure logic of the stream editing (which control a stream gets and why it is disabled, the one confirmation,
// the error lines, the editor's draft / diff / locks, the change log) and the in-memory demo of the write calls. Node only.

function stream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  const s: StreamEncoding = {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: 'High', resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: true, smart_codec: false, b_frames: null, webrtc: 'unknown', webrtc_reason: 'svc',
    fields: { b_frames: { supported: false, editable: false } }, writable: true, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
  return s;
}

const OPTS: StreamOptions = {
  codec: ['H.264', 'H.265'], profile: { 'H.264': ['Baseline', 'Main', 'High'], 'H.265': ['Main'] },
  resolution: { 'H.264': ['2560x1440', '1920x1080'], 'H.265': ['2560x1440'] }, fps: [25, 20, 15], fps_full: true,
  bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 32, max: 8192 }, quality: [30, 60, 90], gop: { min: 1, max: 400 }, svc: true, smart_codec: true, b_frames: false,
  locks: { smart_codec: ['gop', 'bitrate_mode', 'quality'] }, source: 'capabilities',
};

const cam = (streams: StreamEncoding[], extra: Partial<NvrCamera> = {}): NvrCamera => ({
  camera_id: 'cam-1', recorder_id: 'nvr-1', source_ref: '1', channel: 1, name: 'כניסה', online: true, enabled_in_arx: true, streams, error: null, ...extra,
});
const detail = (c: NvrCamera, extra: Partial<CameraDetail> = {}): CameraDetail => ({ camera: c, options: Object.fromEntries(c.streams.map((s) => [s.stream_ref, OPTS])), can_write: true, stale: false, ...extra });

test.describe('which control a stream gets (control)', () => {
  const main = stream('101', 'main');
  const c = cam([main]);
  const ctx = (over: Partial<Ctx> = {}): Ctx => ({ canWrite: true, stale: false, detail: detail(c), ...over });

  test('an enabled switch and pencil after the detail was read', () => {
    expect(control('svc', c, main, ctx())).toEqual({ show: true, enabled: true, reason: '' });
    expect(control('edit', c, main, ctx())).toEqual({ show: true, enabled: true, reason: '' });
  });

  test('nothing without nvr.configure, without the detail, without a camera id, or on a stream without SVC', () => {
    expect(control('svc', c, main, ctx({ canWrite: false })).show).toBe(false);
    expect(control('edit', c, main, ctx({ canWrite: false })).show).toBe(false);
    expect(control('svc', c, main, ctx({ detail: null })).show).toBe(false); // writable is null in the list
    expect(control('svc', cam([main], { camera_id: null }), main, ctx()).show).toBe(false);
    expect(control('svc', c, stream('102', 'sub', { svc: null }), ctx()).show).toBe(false);
    expect(control('svc', c, main, ctx({ detail: detail(c, { can_write: false }) })).show).toBe(false); // a camera deny
  });

  test('disabled with the reason only in `reason`: not writable, offline, no options, stale, detail error', () => {
    const notWritable = cam([stream('101', 'main', { writable: false, not_writable_reason: 'not_supported' })]);
    expect(control('svc', notWritable, notWritable.streams[0], ctx({ detail: detail(notWritable) }))).toEqual({ show: true, enabled: false, reason: 'ה־NVR אינו תומך בשינוי הזרם הזה' });
    expect(control('svc', cam([main], { online: false }), main, ctx())).toEqual({ show: true, enabled: false, reason: 'המצלמה אינה מקוונת' });
    expect(control('svc', c, main, ctx({ detail: detail(c, { options: { '101': null } }) }))).toEqual({ show: true, enabled: false, reason: 'יכולות הזרם אינן ידועות' });
    expect(control('svc', c, main, ctx({ detail: detail(c, { stale: true }) }))).toEqual({ show: true, enabled: false, reason: 'ה־NVR אינו זמין' });
    expect(control('svc', c, main, ctx({ detail: 'error' }))).toEqual({ show: true, enabled: false, reason: 'ה־NVR אינו זמין' });
    expect(control('svc', c, stream('101', 'main', { etag: null }), ctx()).enabled).toBe(false); // no etag, no if_match
  });

  test('a writable value that is not a boolean (null) is not offered', () => {
    const unknown = cam([stream('101', 'main', { writable: null })]);
    expect(control('svc', unknown, unknown.streams[0], ctx({ detail: detail(unknown) })).show).toBe(false);
  });
});

test.describe('the ONE confirmation (confirmModel)', () => {
  test('SVC off / on: heading, camera · stream, one change, the buttons, details', () => {
    const s = stream('101', 'main');
    const off = confirmModel('כניסה', s, { svc: false });
    expect(off.heading).toBe('לכבות SVC?');
    expect(off.lead).toBe('כניסה · ראשי. השידור ייקטע לכמה שניות.');
    expect(off.count).toBe('שינוי אחד');
    expect(off.confirmLabel).toBe('כבה');
    expect(off.details).toEqual([{ field: 'svc', label: 'SVC', from: 'פעיל', to: 'כבוי' }]);
    const on = confirmModel('כניסה', stream('101', 'main', { svc: false }), { svc: true });
    expect([on.heading, on.confirmLabel]).toEqual(['להפעיל SVC?', 'הפעל']);
  });

  test('several changes: "לשמור את השינויים?" with the count; values formatted', () => {
    const m = confirmModel('חצר', stream('101', 'main', { fps: null, fps_full: true }), { codec: 'H.265', fps: 25, resolution: '2560x1440', bitrate_kbps: 4096 });
    expect(m.heading).toBe('לשמור את השינויים?');
    expect(m.count).toBe('4 שינויים');
    expect(m.confirmLabel).toBe('שמור');
    expect(m.details.map((d) => `${d.field}:${d.from}>${d.to}`)).toEqual(['codec:H.264>H.265', 'fps:מלא>25', 'resolution:1920×1080>2560×1440', 'bitrate_kbps:2048 kbps>4096 kbps']);
  });

  test('values', () => {
    expect(valueLabel('svc', true)).toBe('פעיל');
    expect(valueLabel('svc', false)).toBe('כבוי');
    expect(valueLabel('fps', 'full')).toBe('מלא');
    expect(valueLabel('profile', null)).toBe('—');
  });
});

test.describe('error lines (errorLine)', () => {
  const E = (code: string, details: Record<string, unknown> = {}, user_message = '') => errorLine({ status: 409, code, details, user_message });

  test('every code of the contract has its Hebrew line', () => {
    expect(E('stale')).toEqual({ text: 'הערכים השתנו ב־NVR. נטען מחדש.', reload: true });
    expect(E('write_in_progress').text).toBe('שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע.');
    expect(E('nvr_busy').text).toBe('ה־NVR עסוק. נסו שוב בעוד רגע.');
    expect(E('nvr_no_effect').text).toBe('ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.');
    expect(E('nvr_diverged')).toEqual({ text: 'ה־NVR שינה רק חלק מההגדרות. נטען מחדש.', reload: true });
    expect(E('nvr_not_supported').text).toBe('ה־NVR אינו תומך בשינוי הזה.');
    expect(E('nvr_rejected').text).toBe('ה־NVR דחה את השינוי.');
    expect(E('capabilities_unreadable').text).toBe('יכולות הזרם אינן ידועות, ולכן השינוי בוטל.');
    expect(E('confirm_required').text).toBe('נדרש אישור.');
    expect(E('value_not_allowed').text).toBe('הערך אינו נתמך במצלמה.');
    expect(E('value_not_allowed', { field: 'gop' }).text).toBe('GOP: הערך אינו נתמך במצלמה.');
    expect(E('field_locked').text).toBe('השדה נעול כרגע.');
    expect(E('field_not_supported').text).toBe('השדה אינו נתמך בזרם הזה.');
    expect(E('source_unavailable').text).toBe('ה־NVR אינו זמין.');
    expect(E('something_new', {}, 'הודעת השרת').text).toBe('הודעת השרת');
  });

  test('an unknown outcome is "הסטטוס נבדק", reads again, and is recognised only with details.outcome = unknown', () => {
    expect(E('source_unavailable', { outcome: 'unknown' })).toEqual({ text: 'הסטטוס נבדק', reload: true });
    expect(isUnknownOutcome({ status: 503, code: 'source_unavailable', details: { outcome: 'unknown' } })).toBe(true);
    expect(isUnknownOutcome({ status: 503, code: 'source_unavailable', details: {} })).toBe(false);
    expect(isUnknownOutcome({ status: 409, code: 'nvr_busy', details: { outcome: 'unknown' } })).toBe(false);
  });

  test('a network failure on a write is an unknown outcome (the request may have left); on a read it is a plain failure', () => {
    expect(isUnknownOutcome(shapeOf(new TypeError('failed to fetch'), true))).toBe(true);
    expect(isUnknownOutcome(shapeOf(new TypeError('failed to fetch'), false))).toBe(false);
    const api = shapeOf(new ApiError(409, { code: 'nvr_busy', user_message: 'x', retryable: false, correlation_id: '', details: {} }), true);
    expect(api.code).toBe('nvr_busy');
  });
});

test.describe('the editor draft', () => {
  const s = stream('101', 'main', { fps: null, fps_full: true });

  test('draftOf and diffDraft: only what changed, in the request shape', () => {
    const d = draftOf(s);
    expect(diffDraft(s, OPTS, d)).toEqual({});
    expect(diffDraft(s, OPTS, { ...d, gop: '60', fps: '20', svc: false })).toEqual({ gop: 60, fps: 20, svc: false });
    expect(diffDraft(s, OPTS, { ...d, fps: 'full' })).toEqual({});
    expect(diffDraft(stream('101', 'main'), OPTS, { ...draftOf(stream('101', 'main')), fps: 'full' })).toEqual({ fps: 'full' });
  });

  test('shownFields: unsupported fields are not shown; stream without SVC shows no SVC; every edit field is covered', () => {
    const shown = shownFields(s, OPTS, draftOf(s));
    expect(shown).toEqual(EDIT_FIELDS);
    const noSvc = stream('102', 'sub', { svc: null, fields: { svc: { supported: false, editable: false }, gop: { supported: false, editable: false } } });
    expect(shownFields(noSvc, OPTS, draftOf(noSvc))).not.toContain('svc');
    expect(shownFields(noSvc, OPTS, draftOf(noSvc))).not.toContain('gop');
  });

  test('locks: smart codec locks GOP / bit-rate type / quality; quality only under VBR; the server facts count', () => {
    const smart = stream('201', 'main', { smart_codec: true });
    const d = draftOf(smart);
    expect(lockedBy('gop', smart, OPTS, d)).toBe('smart_codec');
    expect(lockedBy('bitrate_mode', smart, OPTS, d)).toBe('smart_codec');
    expect(lockedBy('bitrate_kbps', smart, OPTS, d)).toBeNull();
    expect(lockedBy('quality', s, OPTS, { ...draftOf(s), bitrate_mode: 'CBR' })).toBe('bitrate_mode');
    const turnedOn = lockedBy('gop', s, OPTS, { ...draftOf(s), smart_codec: true });
    expect(turnedOn).toBe('smart_codec'); // switching it on in the draft locks at once
    const serverLocked = stream('101', 'main', { fields: { gop: { supported: true, editable: false, locked_by: 'smart_codec' } } });
    expect(lockedBy('gop', serverLocked, OPTS, draftOf(serverLocked))).toBe('smart_codec');
    // a locked field is never sent
    expect(diffDraft(smart, OPTS, { ...draftOf(smart), gop: '99' })).toEqual({});
  });

  test('a codec change clears a profile / resolution the new codec does not offer; Save stays off until the person chooses', () => {
    const d = { ...draftOf(s), codec: 'H.265' };
    const next = reconcile(d, { ...OPTS, resolution: { 'H.264': ['1920x1080'], 'H.265': ['2560x1440'] } });
    expect(next.profile).toBe(''); // High is not an H.265 profile: never picked silently
    expect(next.resolution).toBe(''); // 1920x1080 is not offered for H.265 here
    expect(invalidFields(s, OPTS, next)).toEqual(expect.arrayContaining(['profile']));
    const chosen = { ...next, profile: 'Main', resolution: '2560x1440' };
    expect(invalidFields(s, OPTS, chosen)).toEqual([]);
    expect(diffDraft(s, OPTS, chosen)).toEqual({ codec: 'H.265', profile: 'Main', resolution: '2560x1440' });
  });

  test('invalid values: outside the range / the list; an untouched unset value is not invalid', () => {
    const d = draftOf(s);
    expect(invalidFields(s, OPTS, { ...d, gop: '0' })).toEqual(['gop']);
    expect(invalidFields(s, OPTS, { ...d, gop: '401' })).toEqual(['gop']);
    expect(invalidFields(s, OPTS, { ...d, gop: 'abc' })).toEqual(['gop']);
    expect(invalidFields(s, OPTS, { ...d, bitrate_kbps: '31' })).toEqual(['bitrate_kbps']);
    expect(invalidFields(s, OPTS, { ...d, fps: '7' })).toEqual(['fps']);
    const unsetProfile = stream('103', 'main', { profile: null });
    expect(invalidFields(unsetProfile, OPTS, draftOf(unsetProfile))).toEqual([]);
  });
});

test.describe('the change log', () => {
  const row = (id: string, created_at: string, over: Partial<StreamChange> = {}): StreamChange => ({ id, status: 'applied', kind: 'stream_encoding', created_at, camera_id: 'cam-1', stream_ref: '101', ...over });

  test('fields: the contract object, the legacy JSON string, both pair shapes; nothing else', () => {
    expect(changeFields(row('a', '2026-10-03T10:00:00Z', { fields: { svc: [true, false], gop: { from: 50, to: 60 } } }))).toEqual([
      { field: 'svc', from: 'פעיל', to: 'כבוי' }, { field: 'gop', from: '50', to: '60' },
    ]);
    expect(changeFields(row('a', '2026-10-03T10:00:00Z', { fields_json: '{"svc":[true,false]}' }))).toHaveLength(1);
    expect(changeFields(row('a', '2026-10-03T10:00:00Z', { fields_json: 'not json' }))).toEqual([]);
    expect(changeFields(row('a', '2026-10-03T10:00:00Z'))).toEqual([]);
  });

  test('lastChanges: this stream only, encoding changes only, newest first, at most five; undo only on the newest applied', () => {
    const rows = [
      ...Array.from({ length: 7 }, (_, i) => row(`r${i}`, `2026-10-03T10:0${i}:00Z`)),
      row('other', '2026-10-03T11:00:00Z', { stream_ref: '102' }),
      row('add', '2026-10-03T11:30:00Z', { kind: 'channel_add' }),
    ];
    const list = lastChanges(rows, '101');
    expect(list.map((c) => c.id)).toEqual(['r6', 'r5', 'r4', 'r3', 'r2']);
    expect(undoable(list)?.id).toBe('r6');
    expect(undoable([row('x', '2026-10-03T12:00:00Z', { status: 'rolled_back' })])).toBeNull();
    expect(undoable([])).toBeNull();
    // rows never carry the documents
    expect(Object.keys(list[0]).some((k) => k.endsWith('_xml'))).toBe(false);
  });
});

test.describe('the in-memory demo of the write calls', () => {
  test.beforeEach(() => resetNvrSettingsDemo());

  test('a write answers like the server; a no-op is change null; the undo needs confirm and answers the stream', async () => {
    const api = nvrSettings();
    const d = await api.camera('demo-cam-1');
    const s = d.camera.streams.find((x) => x.stream_ref === '101') as StreamEncoding;
    expect(s.writable).toBe(true);
    const r = await api.writeStream('demo-cam-1', '101', { if_match: s.etag as string, confirm: true, changes: { svc: false } });
    expect(r.change?.status).toBe('applied');
    expect(r.stream.svc).toBe(false);
    expect(r.stream.etag).not.toBe(s.etag);
    const noop = await api.writeStream('demo-cam-1', '101', { if_match: r.stream.etag as string, confirm: true, changes: { svc: false } });
    expect(noop.change).toBeNull();
    expect(noop.unchanged_fields).toEqual(['svc']);
    const log = await api.changes('demo-cam-1');
    expect(log.changes).toHaveLength(1);
    expect(log.changes[0].fields).toEqual({ svc: [true, false] });
    const undo = await api.undo(r.change!.id);
    expect(undo.stream.svc).toBe(true);
    expect(undo.rollback_of).toBe(r.change!.id);
    await expect(api.undo(r.change!.id)).rejects.toMatchObject({ status: 409 }); // already rolled back
    await expect(api.writeStream('demo-cam-1', '101', { if_match: 'old', confirm: true, changes: { svc: true } })).rejects.toMatchObject({ status: 409 });
  });
});
