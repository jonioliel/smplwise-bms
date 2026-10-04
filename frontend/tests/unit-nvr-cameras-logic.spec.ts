import { test, expect } from '@playwright/test';
import {
  DASH,
  DEFAULT_SORT,
  NO_FILTERS,
  applyFilters,
  bitrateLabel,
  codecLabel,
  counts,
  filtersActive,
  flatten,
  fpsLabel,
  matchesSearch,
  nextSort,
  resolutionLabel,
  sortRows,
  startsGroup,
  svcLabel,
} from '../src/screens/nvr-cameras-logic';
import { resetNvrSettingsDemo, nvrSettings, type NvrCamera, type StreamEncoding } from '../src/api/nvr-settings';
import { SECURITY_CAMERAS_HREF, SECURITY_SETTINGS_TABS, TAB_SECTIONS, applyNvrLess, isNvrHref, isNvrRoute, tabAllowed, visibleTabs, type Can } from '../src/shell/nav';
import type { RouteState } from '../src/router';

// CR-020 S1: the logic of the read-only cameras table (flatten, search, filters, sort, formats), the demo data and the tab's
// gate. Node only - the same modules the screen uses.

function stream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  return {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: null, resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: null, smart_codec: false, b_frames: null, webrtc: 'ok', webrtc_reason: 'h264',
    fields: {}, writable: false, not_writable_reason: 'read_only', etag: `${ref}-e`, ...v,
  };
}

function cam(channel: number, name: string, streams: StreamEncoding[], extra: Partial<NvrCamera> = {}): NvrCamera {
  return { camera_id: `c${channel}`, recorder_id: 'nvr-1', source_ref: String(channel), channel, name, online: true, enabled_in_arx: true, streams, error: null, ...extra };
}

const CAMERAS: NvrCamera[] = [
  cam(2, 'חצר', [
    stream('201', 'main', { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '2688x1520', bitrate_kbps: 4096, svc: false, webrtc: 'unknown', webrtc_reason: 'h265', gop: 25 }),
    stream('202', 'sub', { resolution: '640x360', fps: 20, bitrate_kbps: 512, bitrate_mode: 'CBR', gop: 40 }),
  ]),
  cam(1, 'כניסה', [
    stream('101', 'main', { resolution: '2560x1440', fps: null, fps_full: true, bitrate_kbps: 3072, svc: true, b_frames: true, webrtc: 'no', webrtc_reason: 'b_frames', profile: 'High' }),
    stream('102', 'sub', { resolution: '640x360', fps: 12.5, bitrate_kbps: null, bitrate_mode: null, gop: null, webrtc: 'ok' }),
    stream('103', 'third', { codec: 'H.264', codec_raw: 'H.264+', codec_plus: true, smart_codec: true, resolution: null, webrtc: 'unknown' }),
  ]),
  cam(3, 'מחסן', [], { online: false, error: 'source_error' }),
  cam(4, 'גג', [stream('401', 'main', { codec: null, codec_raw: null, codec_plus: null, resolution: null, fps: null, bitrate_kbps: null, gop: null, webrtc: 'unknown', webrtc_reason: 'codec_unknown' })], { enabled_in_arx: false }),
];

const refs = (rows: { stream: StreamEncoding | null; channel: number }[]) => rows.map((r) => (r.stream ? r.stream.stream_ref : `none${r.channel}`));

test('flatten: one row per stream, a camera without streams keeps a placeholder', () => {
  const rows = flatten(CAMERAS);
  expect(refs(rows)).toEqual(['201', '202', '101', '102', '103', 'none3', '401']);
  expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  expect(rows[5]).toMatchObject({ stream: null, cameraName: 'מחסן', online: false, error: 'source_error', cameraKey: 'nvr-1:3' });
  expect(rows[6].enabledInArx).toBe(false);
  expect(counts(rows)).toEqual({ cameras: 4, streams: 6, notWebrtc: 1 });
});

test('formats: a value the device does not report is a dash, never a default', () => {
  const [h265, sub, , plus] = [CAMERAS[0].streams[0], CAMERAS[1].streams[1], CAMERAS[1].streams[0], CAMERAS[1].streams[2]];
  expect(codecLabel(h265)).toBe('H.265');
  expect(codecLabel(plus)).toBe('H.264+');
  expect(codecLabel(CAMERAS[3].streams[0])).toBe(DASH);
  expect(codecLabel(null)).toBe(DASH);
  expect(resolutionLabel(h265)).toBe('2688×1520');
  expect(resolutionLabel(plus)).toBe(DASH);
  expect(fpsLabel(CAMERAS[1].streams[0])).toBe('מלא');
  expect(fpsLabel(sub)).toBe('12.5');
  expect(fpsLabel(CAMERAS[0].streams[1])).toBe('20');
  expect(fpsLabel(CAMERAS[3].streams[0])).toBe(DASH);
  expect(bitrateLabel(h265)).toBe('4096 kbps');
  expect(bitrateLabel(sub)).toBe(DASH);
  expect([svcLabel(CAMERAS[1].streams[0]), svcLabel(h265), svcLabel(sub)]).toEqual(['פעיל', 'כבוי', DASH]);
});

test('default order: by channel, then main before sub before the rest', () => {
  expect(refs(sortRows(flatten(CAMERAS), DEFAULT_SORT))).toEqual(['101', '102', '103', '201', '202', 'none3', '401']);
  expect(refs(sortRows(flatten(CAMERAS), { key: 'channel', dir: 'desc' }))).toEqual(['401', 'none3', '201', '202', '101', '102', '103']);
});

test('sort by a column: numbers numerically, missing values always last, ties keep the camera order', () => {
  const rows = flatten(CAMERAS);
  const nulls = ['102', 'none3', '401']; // no bit-rate: by channel, in both directions
  expect(refs(sortRows(rows, { key: 'bitrate', dir: 'asc' }))).toEqual(['202', '103', '101', '201', ...nulls]); // 512, 2048, 3072, 4096
  expect(refs(sortRows(rows, { key: 'bitrate', dir: 'desc' }))).toEqual(['201', '101', '103', '202', ...nulls]);
  const res = refs(sortRows(rows, { key: 'resolution', dir: 'desc' }));
  expect(res.slice(0, 4)).toEqual(['201', '101', '102', '202']); // 2688x1520 > 2560x1440 > 640x360 twice (ties by channel)
  expect(res.slice(4)).toEqual(['103', 'none3', '401']);
  expect(refs(sortRows(rows, { key: 'fps', dir: 'desc' }))[0]).toBe('101'); // the full rate sorts above any number
  expect(refs(sortRows(rows, { key: 'webrtc', dir: 'asc' })).slice(0, 3)).toEqual(['101', '103', '201']); // the streams known not to play first, then the unknown ones (ties by channel)
  expect(refs(sortRows(rows, { key: 'svc', dir: 'desc' }))[0]).toBe('101');
  expect(refs(sortRows(rows, { key: 'camera', dir: 'asc' }))).toEqual(['401', '201', '202', '101', '102', '103', 'none3']); // גג, חצר, כניסה, מחסן
});

test('sort does not mutate its input and nextSort flips or restarts', () => {
  const rows = flatten(CAMERAS);
  const before = refs(rows);
  sortRows(rows, { key: 'gop', dir: 'desc' });
  expect(refs(rows)).toEqual(before);
  expect(nextSort(DEFAULT_SORT, 'channel')).toEqual({ key: 'channel', dir: 'desc' });
  expect(nextSort({ key: 'channel', dir: 'desc' }, 'channel')).toEqual({ key: 'channel', dir: 'asc' });
  expect(nextSort(DEFAULT_SORT, 'codec')).toEqual({ key: 'codec', dir: 'asc' });
});

test('search: every word must match name, channel, stream type, codec, profile, resolution or bit-rate mode', () => {
  const rows = flatten(CAMERAS);
  const find = (q: string) => refs(rows.filter((r) => matchesSearch(r, q)));
  expect(find('')).toHaveLength(7);
  expect(find('חצר')).toEqual(['201', '202']);
  expect(find('ערוץ 1')).toEqual(['101', '102', '103']);
  expect(find('h.265')).toEqual(['201']);
  expect(find('H.264+')).toEqual(['103']);
  expect(find('2560×1440'.replace('×', 'x'))).toEqual(['101']);
  expect(find('כניסה משני')).toEqual(['102']);
  expect(find('cbr')).toEqual(['202']);
  expect(find('high')).toEqual(['101']);
  expect(find('אין-כזה')).toEqual([]);
});

test('filters combine (and) and report whether any is active', () => {
  const rows = flatten(CAMERAS);
  const f = (p: Partial<typeof NO_FILTERS>) => refs(applyFilters(rows, { ...NO_FILTERS, ...p }));
  expect(filtersActive(NO_FILTERS)).toBe(false);
  expect(filtersActive({ ...NO_FILTERS, q: '  ' })).toBe(false);
  expect(filtersActive({ ...NO_FILTERS, svc: 'on' })).toBe(true);
  expect(f({})).toHaveLength(7);
  expect(f({ codec: 'h265' })).toEqual(['201']);
  expect(f({ codec: 'h264' })).toEqual(['202', '101', '102', '103']);
  expect(f({ codec: 'other' })).toEqual(['401']); // an unknown codec is "other"; a camera without streams matches no codec
  expect(f({ role: 'main' })).toEqual(['201', '101', '401']);
  expect(f({ role: 'other' })).toEqual(['103']);
  expect(f({ svc: 'on' })).toEqual(['101']);
  expect(f({ svc: 'off' })).toEqual(['201']);
  expect(f({ svc: 'none' })).toEqual(['202', '102', '103', '401']);
  expect(f({ webrtc: 'no' })).toEqual(['101']);
  expect(f({ webrtc: 'unknown' })).toEqual(['201', '103', '401']);
  expect(f({ role: 'main', webrtc: 'no', codec: 'h264' })).toEqual(['101']);
  expect(f({ q: 'כניסה', webrtc: 'ok' })).toEqual(['102']);
});

test('startsGroup marks the first row of each camera in the shown order', () => {
  const rows = sortRows(flatten(CAMERAS), DEFAULT_SORT);
  expect(rows.map((_, i) => startsGroup(rows, i))).toEqual([true, false, false, true, false, true, true]);
});

test('the demo answers in the lab shape (S2: writable), no address or secret in the data', async () => {
  resetNvrSettingsDemo();
  const list = await nvrSettings().cameras();
  expect(list.can_write).toBe(true); // the demo implements the S2 write calls in memory
  expect(list.stale).toBe(false);
  expect(list.cameras.length).toBeGreaterThanOrEqual(4);
  const text = JSON.stringify(list);
  expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+|password|serial|mac/i);
  const rows = flatten(list.cameras);
  expect(rows.some((r) => r.stream?.svc === true && r.stream.webrtc === 'unknown')).toBe(true); // SVC mains are tried over WebRTC (0.1.151)
  expect(rows.some((r) => r.stream?.codec === 'H.265')).toBe(true);
  expect(rows.some((r) => r.stream?.role === 'third')).toBe(true);
  expect(rows.some((r) => r.online === false)).toBe(true);
  const rec = (await nvrSettings().recorders()).recorders[0];
  expect(rec.name).toBe('NVR ראשי');
});

test('the tab: in הגדרות › אבטחה after NVR, system administrators only, installation scope, hidden without an NVR', () => {
  const only = (...perms: string[]): Can => (p, installationOnly) => perms.includes(p) && (installationOnly ? true : true);
  expect(SECURITY_SETTINGS_TABS.map((t) => t.id)).toEqual(['alarm', 'manage', 'nvr', 'cameras']);
  expect(SECURITY_SETTINGS_TABS.find((t) => t.id === 'cameras')).toMatchObject({ label: 'מצלמות', href: SECURITY_CAMERAS_HREF });
  expect(SECURITY_CAMERAS_HREF).toBe('#/system/security/cameras');
  expect(tabAllowed(SECURITY_CAMERAS_HREF, only('system.configure'))).toBe(true);
  expect(tabAllowed(SECURITY_CAMERAS_HREF, only('sources.configure', 'alarm.view'))).toBe(false); // sources.configure alone is not enough
  expect(tabAllowed(SECURITY_CAMERAS_HREF, only())).toBe(false);
  // installation scope only (a site-scoped holder of system.configure does not see it)
  const siteOnly: Can = (p, installationOnly) => p === 'system.configure' && !installationOnly;
  expect(tabAllowed(SECURITY_CAMERAS_HREF, siteOnly)).toBe(false);
  expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('system.configure')).map((t) => t.id)).toContain('cameras');
  expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('alarm.view')).map((t) => t.id)).not.toContain('cameras');
  const ui = TAB_SECTIONS.find((s) => s.id === 'system.security');
  expect(ui?.tabs().map((t) => t.id)).toContain('cameras'); // the tab row can be ordered / hidden like the others
  // NVR-less mode: no tab, and the direct URL gets the "no NVR" panel
  expect(isNvrHref(SECURITY_CAMERAS_HREF)).toBe(true);
  try {
    applyNvrLess(true);
    expect(visibleTabs(SECURITY_SETTINGS_TABS, true, only('system.configure')).map((t) => t.id)).not.toContain('cameras');
  } finally {
    applyNvrLess(false);
  }
  const route = (path: string): RouteState => ({ path, segments: path.split('/').filter(Boolean), params: new URLSearchParams(), mode: 'system' });
  expect(isNvrRoute(route('/system/security/cameras'))).toBe(true);
  expect(isNvrRoute(route('/system/security/nvr'))).toBe(false);
});
