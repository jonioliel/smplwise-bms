import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodingStreams } from '../src/screens/nvr-encoding-logic';
import { REASON_HE } from '../src/screens/nvr-cameras-edit';
import {
  PRESET_SETTINGS,
  PRESET_STORAGE,
  PRESET_WHY,
  WRITES_CONFIRM_POINTS,
  WRITES_LABEL,
  presetBlocked,
  presetButtonLabel,
  presetEmptyLine,
  presetKeys,
  presetStreams,
  undoLabel,
  writesStatusLine,
} from '../src/screens/nvr-h264-preset';
import type { CameraDetail, NvrCamera, StreamEncoding, StreamOptions } from '../src/api/nvr-settings';

// NVR-H264-BULK-2341: the one-click "המר את כל הזרמים ל־H.264" (which streams it sends, the settings it sends, its hints) and the words of the
// per-recorder switch "אפשר שינויי הגדרות ב־NVR" and its confirmation dialog. Node only (no page, no server).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

function stream(ref: string, role: StreamEncoding['role'], v: Partial<StreamEncoding> = {}): StreamEncoding {
  return {
    stream_ref: ref, role, enabled: true, codec: 'H.265', codec_raw: 'H.265', codec_plus: false, profile: 'Main', resolution: '2560x1440', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 3072, quality: 60, gop: 50, svc: null, smart_codec: false, b_frames: null, webrtc: 'no', webrtc_reason: 'codec',
    fields: {}, writable: true, not_writable_reason: null, etag: `${ref}e1`, ...v,
  };
}
const cam = (ch: number, name: string, over: Partial<StreamEncoding> = {}, extra: Partial<NvrCamera> = {}): NvrCamera => ({
  camera_id: `c${ch}`, recorder_id: 'nvr-1', source_ref: String(ch), channel: ch, name, online: true, enabled_in_arx: true,
  streams: [stream(`${ch}01`, 'main', over), stream(`${ch}02`, 'sub', { codec: 'H.264', resolution: '640x360', ...over })], error: null, ...extra,
});
const opts = (): StreamOptions => ({
  codec: ['H.264', 'H.265'], profile: { 'H.264': ['Baseline', 'Main', 'High'], 'H.265': ['Main'] }, resolution: { 'H.264': ['2560x1440'], 'H.265': ['2560x1440'] },
  fps: [25], fps_full: false, bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 32, max: 8192 }, quality: [60], gop: { min: 1, max: 400 }, svc: false, smart_codec: false,
  b_frames: false, locks: {}, source: 'capabilities',
});
const detail = (c: NvrCamera): CameraDetail => ({ camera: c, options: Object.fromEntries(c.streams.map((s) => [s.stream_ref, opts()])), stale: false, can_write: true });

const CAMS = [
  cam(1, 'כניסה'),
  cam(2, 'חצר'),
  cam(3, 'גג', { writable: false, not_writable_reason: 'writes_disabled' }),
  cam(4, 'מחסן', {}, { online: false }),
];
const rowsOf = () => encodingStreams(CAMS, new Map(CAMS.map((c) => [c.camera_id as string, detail(c)])), false);

test.describe('nvr-h264-preset', () => {
  test('all cameras: every selectable stream of the chosen role; streams already on H.264 stay in (the server answers "כבר מוגדרים")', () => {
    const rows = rowsOf();
    expect(presetStreams(rows, new Set(), 'all', 'both').map((r) => r.key)).toEqual(['c1:101', 'c1:102', 'c2:201', 'c2:202']);
    expect(presetStreams(rows, new Set(), 'all', 'main').map((r) => r.key)).toEqual(['c1:101', 'c2:201']);
    expect(presetStreams(rows, new Set(), 'all', 'sub').map((r) => r.key)).toEqual(['c1:102', 'c2:202']);
    expect([...presetKeys(presetStreams(rows, new Set(), 'all', 'main'))]).toEqual(['c1:101', 'c2:201']);
  });

  test('selected cameras: the cameras with a ticked stream, both of their streams when the role says so', () => {
    const rows = rowsOf();
    expect(presetStreams(rows, new Set(['c2:202']), 'selected', 'both').map((r) => r.key)).toEqual(['c2:201', 'c2:202']);
    expect(presetStreams(rows, new Set(['c2:202']), 'selected', 'main').map((r) => r.key)).toEqual(['c2:201']);
    expect(presetStreams(rows, new Set(), 'selected', 'both')).toEqual([]);
    expect(presetEmptyLine('selected', { total: 0, writesOff: 0 }, 0)).toContain('יש לסמן');
  });

  test('the streams it cannot send are counted, and a recorder with writes switched off points at the connection settings', () => {
    const rows = rowsOf();
    expect(rows.find((r) => r.key === 'c3:301')?.reason).toBe(REASON_HE.writes_disabled);
    const b = presetBlocked(rows, new Set(), 'all', 'both', REASON_HE.writes_disabled);
    expect(b).toEqual({ total: 4, writesOff: 2 });
    expect(presetEmptyLine('all', b, 0)).toContain('הגדרות החיבור');
    expect(presetEmptyLine('all', { total: 1, writesOff: 0 }, 0)).toBe('אין זרמים שאפשר לשנות.');
  });

  test('it sends ONLY the codec (every other field "ללא שינוי") and explains why, with the storage warning', () => {
    expect(PRESET_SETTINGS).toEqual({ codec: 'H.264' });
    expect(PRESET_WHY).toBe('H.264 מנגן בשידור חי בכל דפדפן; H.265 חוסך נפח הקלטה אך לא מנגן ב-Chrome/Edge.');
    expect(PRESET_STORAGE).toContain('נפח ההקלטה');
    expect(presetButtonLabel(0)).toBe('המר את כל הזרמים ל־H.264');
    expect(presetButtonLabel(1)).toBe('המר זרם אחד ל־H.264');
    expect(presetButtonLabel(12)).toBe('המר 12 זרמים ל־H.264');
  });

  test('the undo of an encoding change says "החזר לערכים הקודמים"; the SVC batch keeps its words', () => {
    expect(undoLabel('encoding')).toBe('החזר לערכים הקודמים');
    expect(undoLabel('svc')).toBe('בטל את מה שנשמר');
    expect(undoLabel(undefined)).toBe('בטל את מה שנשמר');
  });

  test('no new write path: the preset runs the existing preview / confirm / start, and the switch only calls its own route', () => {
    const screen = read('screens/nvr-encoding-batch.ts');
    expect(screen.match(/startEncoding\(/g)?.length).toBe(1);
    expect(screen.match(/previewEncoding\(/g)?.length).toBe(1);
    expect(screen).toContain('PRESET_SETTINGS');
    expect(screen).toMatch(/runPreset\(\)[\s\S]*void this\.runPreview\(\)/);
    const sw = read('components/nvr-writes-switch.ts');
    expect(sw).not.toMatch(/nvrBatch|startEncoding|streams\//);
    expect(sw).toContain('setRecorderWrites');
    expect(read('components/nvr-connection-form.ts')).toContain('<nvr-writes-switch');
    expect(read('screens/nvr-camera-batch.ts')).toContain('undoLabel(b.mode)');
  });
});

test.describe('nvr-writes-switch words', () => {
  test('the label and the confirmation: what Arx writes, that it is recorded, that it can be turned off any time', () => {
    expect(WRITES_LABEL).toBe('אפשר שינויי הגדרות ב־NVR');
    expect(WRITES_CONFIRM_POINTS).toHaveLength(3);
    expect(WRITES_CONFIRM_POINTS[0]).toContain('הגדרות קידוד');
    expect(WRITES_CONFIRM_POINTS[1]).toContain('מי ומתי');
    expect(WRITES_CONFIRM_POINTS[2]).toContain('לכבות בכל רגע');
  });

  test('the status line: on / off, the vendor default when never switched, who and when otherwise', () => {
    const f = (iso: string) => `[${iso}]`;
    expect(writesStatusLine({ enabled: false, explicit: false, last_change: null }, f)).toBe('כבוי (ברירת המחדל)');
    expect(writesStatusLine({ enabled: true, explicit: true, last_change: { at: 'T', by: 'jon' } }, f)).toBe('פעיל · jon · [T]');
    expect(writesStatusLine({ enabled: false, explicit: true, last_change: { at: 'T', by: null } }, f)).toBe('כבוי · מערכת · [T]');
  });

  test('turning on sends the confirmation, turning off never does', () => {
    const api = read('api/recorders.ts');
    expect(api).toMatch(/enabled \? \{ enabled, confirm \} : \{ enabled \}/);
    const sw = read('components/nvr-writes-switch.ts');
    expect(sw).toMatch(/if \(want\) this\.confirmOpen = true;\s*else void this\.apply\(false\);/);
  });
});
