/**
 * CR-020: NVR camera settings - every stream's encoding per camera, guarded writes, add / remove a camera
 * (docs/architecture/NVR_SETTINGS_API.md). Reading needs system.configure; every write needs `nvr.configure`, a system
 * permission only system administrators hold. The server checks everything; `can_write` only shapes the screen.
 *
 * Slice S1 (read-only table) is implemented on the backend: `recorders`, `cameras` and `camera` (no `options`) answer for real.
 * The write calls are the S2 / S3 stub: the demo implements them in memory, the backend does not have them yet.
 * With a backend the HTTP adapter calls the contract's routes; without one
 * (static demo / mockup) an in-memory demo answers in the lab's shape: H.264 mains with SVC on, an H.265 camera, H.264 subs.
 * No address, user name, password, serial or MAC ever appears in these types.
 */
import { ApiError, api, get, post, put } from './client';
import { isApi } from './session';

export type Vendor = 'hikvision' | 'provision_isr' | 'frigate';
/** Hikvision: N01 main, N02 sub, N03 third, N04+ other. */
export type StreamRole = 'main' | 'sub' | 'third' | 'other';
export type Verdict = 'ok' | 'no' | 'unknown';
export type BitrateMode = 'CBR' | 'VBR';
export type EncodingField = 'codec' | 'profile' | 'resolution' | 'fps' | 'bitrate_mode' | 'bitrate_kbps' | 'quality' | 'gop' | 'svc' | 'smart_codec' | 'b_frames';

export interface RecorderCapabilities {
  read_encodings: boolean;
  write_encodings: boolean;
  add_channel: boolean;
  remove_channel: boolean;
  max_channels: number | null;
  used_channels: number | null;
  encoding_fields: EncodingField[];
}

export interface Recorder {
  recorder_id: string;
  name: string;
  vendor: Vendor;
  model: string | null;
  firmware: string | null;
  enabled: boolean;
  online: boolean;
  checked_at: string | null;
  capabilities: RecorderCapabilities;
  error: string | null;
}

/** Only the exceptions are listed: an absent field is supported and editable when the page may write. */
export interface FieldState {
  supported: boolean;
  editable: boolean;
  /** The field another field's value locks (e.g. GOP under smart codec). */
  locked_by?: EncodingField;
}

export interface StreamEncoding {
  /** The vendor's stream key (Hikvision streaming id "101"). */
  stream_ref: string;
  role: StreamRole;
  enabled: boolean | null;
  /** null = the device does not say (never a default). */
  codec: string | null;
  codec_raw: string | null;
  /** The vendor's "+" variants (H.264+ / H.265+): smart codec on, or the raw codec name ends with "+". */
  codec_plus?: boolean | null;
  profile: string | null;
  resolution: string | null;
  fps: number | null;
  /** The device's 0: the camera's full frame rate. */
  fps_full: boolean;
  bitrate_mode: BitrateMode | null;
  bitrate_kbps: number | null;
  quality: number | null;
  gop: number | null;
  svc: boolean | null;
  smart_codec: boolean | null;
  b_frames: boolean | null;
  webrtc: Verdict;
  webrtc_reason: string;
  fields: Partial<Record<EncodingField, FieldState>>;
  /** null until the stream's options were read once (the server then knows the write path). */
  writable: boolean | null;
  not_writable_reason: string | null;
  /** Send back as `if_match`; null when the reading came from the registry (stale). */
  etag: string | null;
}

export interface NvrCamera {
  /** null: a channel the NVR has but Arx has not discovered yet (shown to installation-wide administrators only). */
  camera_id: string | null;
  recorder_id: string;
  source_ref: string;
  channel: number;
  name: string;
  online: boolean | null;
  enabled_in_arx: boolean;
  streams: StreamEncoding[];
  error: string | null;
}

export interface CameraList {
  cameras: NvrCamera[];
  recorders_failed: string[];
  /** True when the device could not be read and the values are the registry's last reading (main and sub only). */
  stale: boolean;
  can_write: boolean;
  /** The adapter's error code when the device could not be read (with `stale`). */
  error?: string | null;
  checked_at?: string;
}

export interface StreamOptions {
  codec: string[];
  profile: Record<string, string[]>;
  resolution: Record<string, string[]>;
  fps: number[];
  fps_full: boolean;
  bitrate_mode: BitrateMode[];
  bitrate_kbps: { min: number; max: number };
  quality: number[];
  gop: { min: number; max: number };
  svc: boolean;
  smart_codec: boolean;
  b_frames: boolean;
  /** field → the fields it locks while on. */
  locks: Partial<Record<EncodingField, EncodingField[]>>;
  source: 'capabilities' | 'dynamic_cap';
}

export interface CameraDetail {
  camera: NvrCamera;
  /** By stream_ref; null when the device's capability documents cannot be read. Absent in S1 (the backend adds it with S2). */
  options?: Record<string, StreamOptions | null>;
  stale?: boolean;
  can_write?: boolean;
}

export interface EncodingChanges {
  codec?: string;
  profile?: string;
  resolution?: string;
  fps?: number | 'full';
  bitrate_mode?: BitrateMode;
  bitrate_kbps?: number;
  quality?: number;
  gop?: number;
  svc?: boolean;
  smart_codec?: boolean;
  b_frames?: boolean;
}

export interface StreamWriteRequest {
  if_match: string;
  confirm: true;
  changes: EncodingChanges;
}

export type ChangeStatus = 'pending' | 'applied' | 'unchanged' | 'no_effect' | 'refused' | 'failed' | 'diverged' | 'rolled_back';

export interface ChangeRef {
  id: string;
  status: ChangeStatus;
  kind: 'stream_encoding' | 'channel_add' | 'channel_remove';
  created_at: string;
}

export interface StreamWriteResult {
  change: ChangeRef;
  stream: StreamEncoding;
  applied_fields: EncodingField[];
  unchanged_fields: EncodingField[];
  reboot_required: boolean;
}

/** S3. The password exists only in this request; the server never stores or returns it. */
export interface NewChannel {
  confirm: true;
  name: string;
  address: string;
  port: number;
  protocol: 'HIKVISION' | 'ONVIF';
  username: string;
  password: string;
  src_input_port: number;
}

export interface AddChannelResult {
  change: ChangeRef;
  channel: { source_ref: string; name: string; online: boolean | null };
  discovery: 'queued';
}

export interface NvrSettingsAdapter {
  recorders(): Promise<{ recorders: Recorder[]; can_write: boolean }>;
  cameras(recorderId?: string): Promise<CameraList>;
  camera(cameraId: string): Promise<CameraDetail>;
  /** One stream's options for a codec it is not on yet (the editor reloads resolution / FPS lists). */
  options(cameraId: string, streamRef: string, codec?: string): Promise<StreamOptions | null>;
  writeStream(cameraId: string, streamRef: string, req: StreamWriteRequest): Promise<StreamWriteResult>;
  /** The existing change-log rollback (needs the change's permission: nvr.configure). */
  undo(changeId: string): Promise<ChangeRef>;
  addChannel(recorderId: string, spec: NewChannel): Promise<AddChannelResult>;
  removeChannel(cameraId: string, confirmName: string): Promise<void>;
}

const enc = encodeURIComponent;

const http: NvrSettingsAdapter = {
  recorders: () => get('nvr/recorders'),
  cameras: (recorderId) => get(`nvr/cameras${recorderId ? `?recorder_id=${enc(recorderId)}` : ''}`),
  camera: (cameraId) => get(`nvr/cameras/${enc(cameraId)}`),
  options: (cameraId, streamRef, codec) => get(`nvr/cameras/${enc(cameraId)}/streams/${enc(streamRef)}/options${codec ? `?codec=${enc(codec)}` : ''}`),
  writeStream: (cameraId, streamRef, req) => put(`nvr/cameras/${enc(cameraId)}/streams/${enc(streamRef)}`, req),
  undo: (changeId) => post(`nvr/changes/${enc(changeId)}/rollback`),
  addChannel: (recorderId, spec) => post(`nvr/recorders/${enc(recorderId)}/channels`, spec),
  // DELETE with a body (the shared `del` sends none): the typed name is the server-checked confirmation
  removeChannel: (cameraId, confirmName) => api<void>(`nvr/cameras/${enc(cameraId)}/channel`, { method: 'DELETE', body: JSON.stringify({ confirm_name: confirmName }) }),
};

// ------------------------------------------------------------------------------------------------ verdict (mirror of nvr.webrtc_verdict)

/** The server's verdict logic for one ISAPI-read stream, so the demo flips the same way the backend will. */
export function webrtcVerdict(s: Pick<StreamEncoding, 'codec' | 'svc' | 'b_frames' | 'profile'>): [Verdict, string] {
  if (!s.codec) return ['unknown', 'codec_unknown'];
  if (s.codec === 'H.265') return ['no', 'h265'];
  if (s.codec === 'MJPEG') return ['no', 'mjpeg'];
  if (s.codec !== 'H.264') return ['unknown', 'codec_other'];
  if (s.b_frames === true) return ['no', 'b_frames'];
  if (s.svc === true) return ['no', 'svc'];
  const profile = (s.profile ?? '').toLowerCase();
  if (s.b_frames === false || profile.startsWith('baseline') || profile.startsWith('bp') || profile.startsWith('constrained')) return ['ok', 'h264_no_b_frames'];
  return ['ok', 'h264'];
}

// ------------------------------------------------------------------------------------------------ the demo

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const DEMO_RECORDER: Recorder = {
  recorder_id: 'nvr-1', name: 'NVR ראשי', vendor: 'hikvision', model: 'DS-7616NI-DEMO', firmware: 'V4.84 demo', enabled: true, online: true,
  checked_at: '2026-10-01T09:00:00Z', error: null,
  capabilities: {
    read_encodings: true, write_encodings: true, add_channel: true, remove_channel: true, max_channels: 16, used_channels: 4,
    encoding_fields: ['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'svc', 'smart_codec'],
  },
};

const MAIN_OPTIONS: StreamOptions = {
  codec: ['H.264', 'H.265'],
  profile: { 'H.264': ['Baseline', 'Main', 'High'], 'H.265': ['Main'] },
  resolution: { 'H.264': ['2560x1440', '1920x1080', '1280x720'], 'H.265': ['2560x1440', '1920x1080'] },
  fps: [25, 20, 15, 12, 10, 8, 6, 4, 2, 1], fps_full: true,
  bitrate_mode: ['CBR', 'VBR'], bitrate_kbps: { min: 32, max: 8192 }, quality: [10, 30, 45, 60, 75, 90],
  gop: { min: 1, max: 400 }, svc: true, smart_codec: true, b_frames: false,
  locks: { smart_codec: ['gop', 'bitrate_mode', 'quality'] },
  source: 'capabilities',
};
const SUB_OPTIONS: StreamOptions = {
  ...MAIN_OPTIONS,
  resolution: { 'H.264': ['640x360', '640x480', '352x288'], 'H.265': ['640x360', '640x480'] },
  bitrate_kbps: { min: 32, max: 2048 }, smart_codec: false, locks: {},
};

function demoStream(ref: string, role: StreamRole, v: Partial<StreamEncoding>): StreamEncoding {
  const s: StreamEncoding = {
    stream_ref: ref, role, enabled: true, codec: 'H.264', codec_raw: 'H.264', codec_plus: false, profile: null, resolution: '1920x1080', fps: 25, fps_full: false,
    bitrate_mode: 'VBR', bitrate_kbps: 2048, quality: 60, gop: 50, svc: null, smart_codec: false, b_frames: null,
    webrtc: 'unknown', webrtc_reason: 'codec_unknown',
    fields: { b_frames: { supported: false, editable: false } }, writable: true, not_writable_reason: null, etag: `${ref}-1`, ...v,
  };
  if (s.svc === null) s.fields.svc = { supported: false, editable: false };
  [s.webrtc, s.webrtc_reason] = webrtcVerdict(s);
  s.codec_plus = s.smart_codec === true || String(s.codec_raw ?? '').endsWith('+');
  return s;
}

function demoCameras(): NvrCamera[] {
  const cam = (n: number, name: string, streams: StreamEncoding[], extra: Partial<NvrCamera> = {}): NvrCamera => ({
    camera_id: `demo-cam-${n}`, recorder_id: 'nvr-1', source_ref: String(n), channel: n, name, online: true, enabled_in_arx: true, streams, error: null, ...extra,
  });
  const sub = (n: number) => demoStream(`${n}02`, 'sub', { resolution: '640x360', fps: 20, bitrate_kbps: 1024 });
  return [
    cam(1, 'כניסה', [demoStream('101', 'main', { resolution: '2560x1440', fps: null, fps_full: true, bitrate_kbps: 3072, svc: true }), sub(1)]),
    cam(2, 'חניה', [demoStream('201', 'main', { resolution: '2560x1440', fps: null, fps_full: true, bitrate_kbps: 3072, svc: true }), sub(2)]),
    cam(3, 'חצר אחורית', [
      demoStream('301', 'main', { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '2560x1440', bitrate_kbps: 2048, svc: false }),
      demoStream('302', 'sub', { codec: 'H.265', codec_raw: 'H.265', profile: 'Main', resolution: '640x360', fps: 20, bitrate_kbps: 512, svc: true, smart_codec: true }),
      demoStream('303', 'third', { resolution: '1280x720', fps: 12, bitrate_kbps: 1024 }),
    ]),
    cam(4, 'מחסן', [demoStream('401', 'main', { resolution: '1920x1080', svc: false, profile: 'High' }), sub(4)], { online: false }),
  ];
}

function fail(status: number, code: string, user_message: string, details: Record<string, unknown> = {}): never {
  throw new ApiError(status, { code, user_message, retryable: false, correlation_id: 'demo', details });
}

const FIELD_LABEL: Record<EncodingField, string> = {
  codec: 'קידוד', profile: 'פרופיל', resolution: 'רזולוציה', fps: 'FPS', bitrate_mode: 'סוג קצב', bitrate_kbps: 'קצב', quality: 'איכות', gop: 'GOP',
  svc: 'SVC', smart_codec: 'Smart codec', b_frames: 'B-frames',
};
export const fieldLabel = (f: EncodingField): string => FIELD_LABEL[f];
export const ROLE_LABEL: Record<StreamRole, string> = { main: 'ראשי', sub: 'משני', third: 'שלישי', other: 'נוסף' };

interface DemoChange {
  id: string;
  camera_id: string;
  stream_ref: string;
  before: StreamEncoding;
  after: StreamEncoding;
  status: ChangeStatus;
}

class DemoNvrSettings implements NvrSettingsAdapter {
  cameras_ = demoCameras();
  changes: DemoChange[] = [];
  seq = 0;

  private find(cameraId: string): NvrCamera {
    return this.cameras_.find((c) => c.camera_id === cameraId) ?? fail(404, 'not_found', 'המצלמה לא נמצאה.');
  }

  private optionsOf(s: StreamEncoding): StreamOptions {
    return clone(s.role === 'main' ? MAIN_OPTIONS : SUB_OPTIONS);
  }

  async recorders() {
    return { recorders: [{ ...clone(DEMO_RECORDER), capabilities: { ...DEMO_RECORDER.capabilities, used_channels: this.cameras_.length } }], can_write: true };
  }

  async cameras(recorderId?: string): Promise<CameraList> {
    return { cameras: clone(this.cameras_.filter((c) => !recorderId || c.recorder_id === recorderId)), recorders_failed: [], stale: false, can_write: false };
  }

  async camera(cameraId: string): Promise<CameraDetail> {
    const c = this.find(cameraId);
    return { camera: clone(c), can_write: true, options: Object.fromEntries(c.streams.map((s) => [s.stream_ref, this.optionsOf(s)])) };
  }

  async options(cameraId: string, streamRef: string, codec?: string) {
    const s = this.find(cameraId).streams.find((x) => x.stream_ref === streamRef) ?? fail(404, 'not_found', 'הזרם לא נמצא.');
    const o = this.optionsOf(s);
    if (codec && !o.codec.includes(codec)) fail(422, 'value_not_allowed', 'הערך אינו נתמך במצלמה.', { field: 'codec', allowed: o.codec });
    return o;
  }

  /** Same order as the server: confirm, etag, per-field options, locks; then apply, new etag, verdict, change row. */
  async writeStream(cameraId: string, streamRef: string, req: StreamWriteRequest): Promise<StreamWriteResult> {
    const c = this.find(cameraId);
    const s = c.streams.find((x) => x.stream_ref === streamRef) ?? fail(404, 'not_found', 'הזרם לא נמצא.');
    if (req.confirm !== true) fail(422, 'confirm_required', 'נדרש אישור.');
    if (req.if_match !== s.etag) fail(409, 'stale', 'הערכים השתנו ב־NVR. נטען מחדש.', { stream: clone(s) });
    if (c.online === false) fail(503, 'source_unavailable', 'המצלמה אינה זמינה כרגע.');
    const o = this.optionsOf(s);
    const ch = req.changes;
    const fields = Object.keys(ch) as EncodingField[];
    if (!fields.length) fail(422, 'validation', 'אין מה לשנות.');
    const codec = ch.codec ?? s.codec ?? 'H.264';
    const allowed = (field: EncodingField, ok: boolean, list?: unknown[]) => {
      if (!ok) fail(422, 'value_not_allowed', 'הערך אינו נתמך במצלמה.', { field, allowed: list ?? [] });
    };
    for (const f of fields) if (s.fields[f]?.supported === false) fail(422, 'field_not_supported', `${FIELD_LABEL[f]} אינו נתמך בזרם הזה.`, { field: f });
    if (ch.codec !== undefined) allowed('codec', o.codec.includes(ch.codec), o.codec);
    if (ch.profile !== undefined) allowed('profile', (o.profile[codec] ?? []).includes(ch.profile), o.profile[codec]);
    if (ch.resolution !== undefined) allowed('resolution', (o.resolution[codec] ?? []).includes(ch.resolution), o.resolution[codec]);
    if (ch.fps !== undefined) allowed('fps', ch.fps === 'full' ? o.fps_full : o.fps.includes(ch.fps), o.fps);
    if (ch.bitrate_mode !== undefined) allowed('bitrate_mode', o.bitrate_mode.includes(ch.bitrate_mode), o.bitrate_mode);
    if (ch.bitrate_kbps !== undefined) allowed('bitrate_kbps', ch.bitrate_kbps >= o.bitrate_kbps.min && ch.bitrate_kbps <= o.bitrate_kbps.max, [o.bitrate_kbps.min, o.bitrate_kbps.max]);
    if (ch.quality !== undefined) allowed('quality', (ch.bitrate_mode ?? s.bitrate_mode) === 'VBR' && o.quality.includes(ch.quality), o.quality);
    if (ch.gop !== undefined) allowed('gop', ch.gop >= o.gop.min && ch.gop <= o.gop.max, [o.gop.min, o.gop.max]);
    if (ch.svc !== undefined) allowed('svc', o.svc);
    if (ch.smart_codec !== undefined) allowed('smart_codec', o.smart_codec);
    if (ch.b_frames !== undefined) fail(422, 'field_not_supported', 'B-frames אינו נתמך בזרם הזה.', { field: 'b_frames' });
    const smartOn = ch.smart_codec ?? s.smart_codec;
    for (const f of smartOn ? o.locks.smart_codec ?? [] : []) if (f in ch && f !== 'smart_codec') fail(422, 'field_locked', `${FIELD_LABEL[f]} נעול כש־Smart codec פעיל.`, { field: f, locked_by: 'smart_codec' });

    const before = clone(s);
    const applied: EncodingField[] = [];
    const unchanged: EncodingField[] = [];
    const set = <K extends keyof StreamEncoding>(field: EncodingField, key: K, value: StreamEncoding[K]) => {
      if (s[key] === value) unchanged.push(field);
      else {
        s[key] = value;
        applied.push(field);
      }
    };
    if (ch.codec !== undefined) {
      set('codec', 'codec', ch.codec);
      s.codec_raw = ch.codec;
      if (ch.profile === undefined) s.profile = null;
    }
    if (ch.profile !== undefined) set('profile', 'profile', ch.profile);
    if (ch.resolution !== undefined) set('resolution', 'resolution', ch.resolution);
    if (ch.fps !== undefined) {
      const full = ch.fps === 'full';
      if (s.fps_full === full && (full || s.fps === ch.fps)) unchanged.push('fps');
      else {
        [s.fps_full, s.fps] = [full, full ? null : (ch.fps as number)];
        applied.push('fps');
      }
    }
    if (ch.bitrate_mode !== undefined) set('bitrate_mode', 'bitrate_mode', ch.bitrate_mode);
    if (ch.bitrate_kbps !== undefined) set('bitrate_kbps', 'bitrate_kbps', ch.bitrate_kbps);
    if (ch.quality !== undefined) set('quality', 'quality', ch.quality);
    if (ch.gop !== undefined) set('gop', 'gop', ch.gop);
    if (ch.svc !== undefined) set('svc', 'svc', ch.svc);
    if (ch.smart_codec !== undefined) set('smart_codec', 'smart_codec', ch.smart_codec);
    [s.webrtc, s.webrtc_reason] = webrtcVerdict(s);
    if (applied.length) s.etag = `${s.stream_ref}-${++this.seq + 1}`;
    const id = `demo-change-${++this.seq}`;
    const status: ChangeStatus = applied.length ? 'applied' : 'unchanged';
    this.changes.push({ id, camera_id: cameraId, stream_ref: streamRef, before, after: clone(s), status });
    return { change: { id, status, kind: 'stream_encoding', created_at: new Date().toISOString() }, stream: clone(s), applied_fields: applied, unchanged_fields: unchanged, reboot_required: false };
  }

  async undo(changeId: string): Promise<ChangeRef> {
    const ch = this.changes.find((x) => x.id === changeId) ?? fail(404, 'not_found', 'השינוי לא נמצא.');
    if (ch.status !== 'applied') fail(409, 'not_rollbackable', 'אין לשינוי הזה מסמך קודם להחזיר.', { status: ch.status });
    const c = this.find(ch.camera_id);
    const i = c.streams.findIndex((x) => x.stream_ref === ch.stream_ref);
    if (i < 0 || c.streams[i].etag !== ch.after.etag) fail(409, 'stale', 'הערכים השתנו ב־NVR. נטען מחדש.');
    c.streams[i] = { ...clone(ch.before), etag: `${ch.stream_ref}-${++this.seq + 1}` };
    ch.status = 'rolled_back';
    const id = `demo-change-${++this.seq}`;
    this.changes.push({ id, camera_id: ch.camera_id, stream_ref: ch.stream_ref, before: ch.after, after: clone(c.streams[i]), status: 'applied' });
    return { id, status: 'applied', kind: 'stream_encoding', created_at: new Date().toISOString() };
  }

  async addChannel(recorderId: string, spec: NewChannel): Promise<AddChannelResult> {
    if (recorderId !== DEMO_RECORDER.recorder_id) fail(404, 'not_found', 'ה־NVR לא נמצא.');
    if (spec.confirm !== true) fail(422, 'confirm_required', 'נדרש אישור.');
    if (!spec.name.trim() || !spec.address.trim() || !spec.username.trim() || !spec.password) fail(422, 'validation', 'חסרים פרטים.');
    const used = new Set(this.cameras_.map((c) => c.channel));
    const max = DEMO_RECORDER.capabilities.max_channels ?? 0;
    let n = 1;
    while (used.has(n)) n++;
    if (n > max) fail(409, 'channel_slots_full', 'אין ערוץ פנוי ב־NVR.');
    // the demo plays "discovery ran": the camera appears at once (the server queues a discovery run)
    this.cameras_.push({
      camera_id: `demo-cam-${n}`, recorder_id: recorderId, source_ref: String(n), channel: n, name: spec.name.trim(), online: true, enabled_in_arx: true, error: null,
      streams: [demoStream(`${n}01`, 'main', { svc: false }), demoStream(`${n}02`, 'sub', { resolution: '640x360', fps: 20, bitrate_kbps: 1024 })],
    });
    const id = `demo-change-${++this.seq}`;
    return { change: { id, status: 'applied', kind: 'channel_add', created_at: new Date().toISOString() }, channel: { source_ref: String(n), name: spec.name.trim(), online: true }, discovery: 'queued' };
  }

  async removeChannel(cameraId: string, confirmName: string): Promise<void> {
    const c = this.find(cameraId);
    if (confirmName.trim() !== c.name) fail(422, 'confirm_required', 'השם אינו תואם.');
    this.cameras_ = this.cameras_.filter((x) => x.camera_id !== cameraId);
  }
}

let demo: DemoNvrSettings | null = null;
/** The adapter in force: HTTP with a backend, the in-memory demo otherwise. */
export const nvrSettings = (): NvrSettingsAdapter => (isApi() ? http : (demo ??= new DemoNvrSettings()));
/** Specs: a fresh demo. */
export const resetNvrSettingsDemo = (): void => {
  demo = null;
};
