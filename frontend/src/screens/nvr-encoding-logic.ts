/**
 * CR-020 phase D: the pure logic of the bulk encoding change on מערכת › אבטחה › מצלמות ("שינוי קידוד לכמה מצלמות") - which streams can be
 * chosen (and why not), the checklist's filters (codec, main / sub, SVC, WebRTC, search), "select all that match", the target settings form
 * ("ללא שינוי" by default for every field), the option lists the form offers (the union of what the chosen streams' devices accept), the
 * preview's rows ("before → after", adjusted values, skipped streams with the server's reason) and the ONE confirmation. No DOM and no
 * network, so the unit spec runs it in Node.
 *
 * The server plans every stream against its own device (closest valid value, clamped ranges, the profile the new codec needs, fields kept as
 * they are, or "cannot be applied") and starts exactly the plan the person confirmed; this module only shapes the screen. Device strings are
 * only ever rendered as text by the callers; nothing here builds HTML.
 */
import type { EncodingPreview, EncodingSettings, EncodingStartRequest, PlanItem } from '../api/nvr-batch';
import type { CameraDetail, EncodingField, NvrCamera, StreamEncoding, StreamOptions, StreamRole, Verdict } from '../api/nvr-settings';
import { DASH, ROLE_HE } from './nvr-cameras-logic';
import { FIELD_HE, REASON_HE, countLabel, reasonHe, valueLabel, type ConfirmModel } from './nvr-cameras-edit';

// ------------------------------------------------------------------------------------------------ the streams that can be chosen

export interface EncStream {
  /** `cameraId:streamRef` */
  key: string;
  cameraId: string;
  recorderId: string;
  cameraName: string;
  channel: number;
  streamRef: string;
  role: StreamRole;
  codec: string | null;
  resolution: string | null;
  svc: boolean | null;
  webrtc: Verdict;
  /** Can be ticked: the camera's detail was read, the stream is writable, it has a fresh reading. */
  selectable: boolean;
  /** Why not (a short word for the row's muted meta; empty when selectable). */
  reason: string;
}

export const keyOf = (cameraId: string, streamRef: string): string => `${cameraId}:${streamRef}`;

const ROLE_ORDER: Record<StreamRole, number> = { main: 0, sub: 1, third: 2, other: 3 };

/** The detail's copy of a stream (it carries `writable`) over the list's. */
function fresh(s: StreamEncoding, d: CameraDetail | 'error' | undefined): StreamEncoding {
  return d && d !== 'error' ? d.camera.streams.find((x) => x.stream_ref === s.stream_ref) ?? s : s;
}

/** Every stream of every camera Arx knows, in channel order (main before sub), with whether it can be chosen. Cameras the administrator
 * may not write (a camera deny: the detail's `can_write` false) are not listed at all. The server repeats every check. */
export function encodingStreams(cameras: NvrCamera[], details: Map<string, CameraDetail | 'error'>, stale: boolean): EncStream[] {
  const out: EncStream[] = [];
  for (const c of cameras) {
    if (!c.camera_id) continue;
    const d = details.get(c.camera_id);
    if (d && d !== 'error' && d.can_write === false) continue;
    for (const raw of c.streams) {
      const s = fresh(raw, d);
      let reason = '';
      if (stale) reason = REASON_HE.stale;
      else if (d === undefined) reason = 'נטען';
      else if (d === 'error' || (d && d.stale)) reason = REASON_HE.detail_error;
      else if (c.online === false) reason = REASON_HE.offline;
      else if (s.writable === false) reason = reasonHe(s.not_writable_reason);
      else if (!d.options?.[s.stream_ref]) reason = REASON_HE.no_options;
      else if (!s.etag) reason = REASON_HE.stale;
      out.push({
        key: keyOf(c.camera_id, s.stream_ref), cameraId: c.camera_id, recorderId: c.recorder_id, cameraName: c.name, channel: c.channel, streamRef: s.stream_ref,
        role: s.role, codec: s.codec, resolution: s.resolution, svc: s.svc, webrtc: s.webrtc ?? 'unknown', selectable: !reason, reason,
      });
    }
  }
  return out.sort((a, b) => a.channel - b.channel || a.cameraName.localeCompare(b.cameraName, 'he') || ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.streamRef.localeCompare(b.streamRef));
}

// ------------------------------------------------------------------------------------------------ filters and selection

export type EncCodecFilter = '' | 'h264' | 'h265' | 'other';
/** '' = every stream; the role choice of the owner's request: main, sub or both. */
export type EncRoleFilter = '' | 'main' | 'sub';
export type EncSvcFilter = '' | 'on' | 'off' | 'none';
export type EncVerdictFilter = '' | Verdict;

export interface EncFilters {
  q: string;
  codec: EncCodecFilter;
  role: EncRoleFilter;
  svc: EncSvcFilter;
  webrtc: EncVerdictFilter;
}

export const NO_ENC_FILTERS: EncFilters = { q: '', codec: '', role: '', svc: '', webrtc: '' };

export const encFiltersActive = (f: EncFilters): boolean => !!(f.q.trim() || f.codec || f.role || f.svc || f.webrtc);

/** Every word of the search must be found in the camera name, the channel, the stream role or the codec ("ערוץ 3" is a channel). */
export function filterStreams(rows: EncStream[], f: EncFilters): EncStream[] {
  let text = f.q.trim().toLowerCase();
  const channels = [...text.matchAll(/ערוץ\s*(\d+)/g)].map((m) => Number(m[1]));
  text = text.replace(/ערוץ\s*\d+/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (f.role && r.role !== f.role) return false;
    if (f.codec === 'h264' && r.codec !== 'H.264') return false;
    if (f.codec === 'h265' && r.codec !== 'H.265') return false;
    if (f.codec === 'other' && (r.codec === 'H.264' || r.codec === 'H.265')) return false;
    if (f.svc === 'on' && r.svc !== true) return false;
    if (f.svc === 'off' && r.svc !== false) return false;
    if (f.svc === 'none' && r.svc !== null) return false;
    if (f.webrtc && r.webrtc !== f.webrtc) return false;
    if (channels.length && !channels.includes(r.channel)) return false;
    const hay = `${r.cameraName} ${r.channel} ${ROLE_HE[r.role]} ${r.codec ?? ''}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** "Select all" adds every SELECTABLE stream that matches the filters (not only the rows in view); the rest of the selection stays. */
export function selectAllStreams(selected: Set<string>, matching: EncStream[]): Set<string> {
  const next = new Set(selected);
  for (const r of matching) if (r.selectable) next.add(r.key);
  return next;
}

export function toggleStream(selected: Set<string>, r: EncStream): Set<string> {
  const next = new Set(selected);
  if (next.has(r.key)) next.delete(r.key);
  else if (r.selectable) next.add(r.key);
  return next;
}

/** The chosen streams in list order (the order the server will work in). Rows that stopped being selectable drop out. */
export const chosenStreams = (rows: EncStream[], selected: Set<string>): EncStream[] => rows.filter((r) => r.selectable && selected.has(r.key));

// ------------------------------------------------------------------------------------------------ the target settings form

/** The form's values; '' everywhere = "ללא שינוי". Numbers stay strings until they are checked. */
export interface EncDraft {
  codec: '' | 'H.264' | 'H.265';
  resolution: string;
  fps: string;
  bitrate_mode: '' | 'CBR' | 'VBR';
  bitrate_kbps: string;
  quality: string;
  gop: string;
  svc: '' | 'on' | 'off';
  smart_codec: '' | 'on' | 'off';
}

export const EMPTY_DRAFT: EncDraft = { codec: '', resolution: '', fps: '', bitrate_mode: '', bitrate_kbps: '', quality: '', gop: '', svc: '', smart_codec: '' };

/** The fields of the form in display order. */
export const DRAFT_FIELDS: (keyof EncDraft)[] = ['codec', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'svc', 'smart_codec'];

export const LEAVE = 'ללא שינוי';

export interface EncChoices {
  codec: string[];
  resolution: string[];
  fps: number[];
  fpsFull: boolean;
  bitrateMode: string[];
  bitrate: { min: number; max: number } | null;
  quality: number[];
  gop: { min: number; max: number } | null;
  svc: boolean;
  smart: boolean;
}

const px = (r: string): number => {
  const m = /^(\d+)x(\d+)$/.exec(r);
  return m ? Number(m[1]) * Number(m[2]) : 0;
};

/** What the form offers: the union of the chosen streams' options (resolutions of the target codec, or of each stream's own codec). A value only some
 * devices accept is still offered: the server plans the closest valid value for the others and the preview shows it. */
export function choicesFor(rows: EncStream[], details: Map<string, CameraDetail | 'error'>, codec: string): EncChoices {
  const out: EncChoices = { codec: [], resolution: [], fps: [], fpsFull: false, bitrateMode: [], bitrate: null, quality: [], gop: null, svc: false, smart: false };
  const add = <T>(list: T[], v: T) => {
    if (!list.includes(v)) list.push(v);
  };
  for (const r of rows) {
    const d = details.get(r.cameraId);
    const o: StreamOptions | null | undefined = d && d !== 'error' ? d.options?.[r.streamRef] : null;
    if (!o) continue;
    for (const c of o.codec) if (c === 'H.264' || c === 'H.265') add(out.codec, c);
    for (const res of o.resolution[codec || r.codec || ''] ?? []) add(out.resolution, res);
    for (const f of o.fps) add(out.fps, f);
    out.fpsFull ||= o.fps_full;
    for (const m of o.bitrate_mode) add(out.bitrateMode, m);
    if (o.bitrate_kbps) out.bitrate = out.bitrate ? { min: Math.min(out.bitrate.min, o.bitrate_kbps.min), max: Math.max(out.bitrate.max, o.bitrate_kbps.max) } : { ...o.bitrate_kbps };
    for (const q of o.quality) add(out.quality, q);
    if (o.gop) out.gop = out.gop ? { min: Math.min(out.gop.min, o.gop.min), max: Math.max(out.gop.max, o.gop.max) } : { ...o.gop };
    out.svc ||= o.svc;
    out.smart ||= o.smart_codec;
  }
  out.codec.sort();
  out.resolution.sort((a, b) => px(b) - px(a));
  out.fps.sort((a, b) => b - a);
  out.bitrateMode.sort();
  out.quality.sort((a, b) => b - a);
  return out;
}

const int = (v: string): number | null => (/^\d{1,7}$/.test(v.trim()) ? Number(v.trim()) : null);

/** The settings of the request ('' fields are left out) and the fields whose value is not acceptable (a number out of the union's range). */
export function settingsOf(d: EncDraft, ch: EncChoices): { settings: EncodingSettings; invalid: (keyof EncDraft)[] } {
  const s: EncodingSettings = {};
  const invalid: (keyof EncDraft)[] = [];
  if (d.codec) s.codec = d.codec;
  if (d.resolution) s.resolution = d.resolution;
  if (d.fps) s.fps = d.fps === 'full' ? 'full' : Number(d.fps);
  if (d.bitrate_mode) s.bitrate_mode = d.bitrate_mode;
  if (d.bitrate_kbps.trim()) {
    const n = int(d.bitrate_kbps);
    if (n === null || n < 1 || (ch.bitrate && (n < ch.bitrate.min || n > ch.bitrate.max))) invalid.push('bitrate_kbps');
    else s.bitrate_kbps = n;
  }
  if (d.quality) s.quality = Number(d.quality);
  if (d.gop.trim()) {
    const n = int(d.gop);
    if (n === null || n < 1 || (ch.gop && (n < ch.gop.min || n > ch.gop.max))) invalid.push('gop');
    else s.gop = n;
  }
  if (d.svc) s.svc = d.svc === 'on';
  if (d.smart_codec) s.smart_codec = d.smart_codec === 'on';
  return { settings: s, invalid };
}

export const hasSettings = (s: EncodingSettings): boolean => Object.keys(s).length > 0;

/** A different codec makes the old resolution choice meaningless when the new codec's list lacks it: it goes back to "ללא שינוי". */
export function onCodec(d: EncDraft, codec: EncDraft['codec'], ch: EncChoices): EncDraft {
  const next = { ...d, codec };
  if (next.resolution && !ch.resolution.includes(next.resolution)) next.resolution = '';
  return next;
}

/** Quality exists only under a variable bit rate: choosing CBR clears it. */
export function onBitrateMode(d: EncDraft, mode: EncDraft['bitrate_mode']): EncDraft {
  return { ...d, bitrate_mode: mode, quality: mode === 'CBR' ? '' : d.quality };
}

/** One short line under the form / in the preview: H.264 is what the live view plays over WebRTC. Shown only when the codec is changed. */
export const WEBRTC_NOTE = 'הצפייה החיה מנגנת ב־WebRTC רק H.264.';

// ------------------------------------------------------------------------------------------------ the preview

export interface Delta {
  field: string;
  label: string;
  from: string;
  to: string;
  /** The server chose another value than the one asked (closest valid); `why` is its short line. */
  adjusted: boolean;
  why: string;
}

/** "before → after" of one planned stream, in the form's field order (profile after codec). */
export function deltas(it: PlanItem): Delta[] {
  const order = ['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'svc', 'smart_codec'];
  const adj = new Map(it.notes.filter((n) => n.kind === 'adjusted').map((n) => [n.field, n.message]));
  return Object.entries(it.fields ?? {})
    .sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
    .map(([f, [from, to]]) => ({ field: f, label: FIELD_HE[f as EncodingField] ?? f, from: valueLabel(f, from), to: valueLabel(f, to), adjusted: adj.has(f), why: adj.get(f) ?? '' }));
}

/** The fields this stream keeps as they are, with the server's line ("לא קיים בזרם הזה", "נעול כש־Smart codec פעיל"). */
export const keptNotes = (it: PlanItem): { label: string; why: string }[] =>
  it.notes.filter((n) => n.kind === 'kept').map((n) => ({ label: FIELD_HE[n.field as EncodingField] ?? n.field, why: n.message }));

export type PreviewTab = 'change' | 'skip' | 'unchanged';

/** The preview's numbers in one line: "ישתנו 12 זרמים · לא ניתן: 3 זרמים · כבר מוגדרים: 2 זרמים". */
export function previewSummary(p: EncodingPreview): string {
  const n = p.counts;
  const streams = (k: number) => (k === 1 ? 'זרם אחד' : `${k} זרמים`);
  return [n.change ? `ישתנו ${streams(n.change)}` : 'אין מה לשנות', n.skip ? `לא ניתן: ${streams(n.skip)}` : '', n.unchanged ? `כבר מוגדרים: ${streams(n.unchanged)}` : '']
    .filter(Boolean)
    .join(' · ');
}

/** The streams to start: every planned change, exactly as previewed (the server refuses anything else). */
export function startRequest(p: EncodingPreview): EncodingStartRequest {
  return {
    confirm: true, settings: p.settings, recorder_id: p.recorder_id,
    targets: p.items.filter((i) => i.status === 'change' && i.if_match).map((i) => ({ camera_id: i.camera_id, stream_ref: i.stream_ref, if_match: i.if_match as string, changes: i.changes })),
  };
}

export const streamsLabel = (n: number): string => (n === 1 ? 'זרם אחד' : `${n} זרמים`);
export const inStreams = (n: number): string => (n === 1 ? 'בזרם אחד' : `ב־${n} זרמים`);

export const ENC_CONFIRM_LEAD = 'השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.';

/** The ONE confirmation (the S2C rules: one dialog, the count, two buttons, the streams under "פרטים"; no typed word). */
export function encodingConfirmModel(p: EncodingPreview, nameOf: (it: PlanItem) => string): ConfirmModel {
  const items = p.items.filter((i) => i.status === 'change');
  return {
    heading: `לשנות את הקידוד ${inStreams(items.length)}?`,
    lead: ENC_CONFIRM_LEAD,
    count: countLabel(p.changes_total),
    confirmLabel: 'החל',
    details: [],
    names: items.map(nameOf),
  };
}

/** A row's name: "מצלמה 3 · ראשי". */
export const streamName = (cameraName: string, role: string | null | undefined): string => (role && role in ROLE_HE ? `${cameraName} · ${ROLE_HE[role as StreamRole]}` : cameraName);

/** The line when the preview or the start was refused. `back`: return to the checklist (the camera list changed). */
export function encErrorLine(e: { status: number; code: string; user_message?: string }): { text: string; reload: boolean } {
  switch (e.code) {
    case 'stale':
    case 'plan_changed':
      return { text: 'ההגדרות במצלמות השתנו. התצוגה המקדימה נטענה מחדש.', reload: true };
    case 'batch_in_progress':
      return { text: 'מתבצע שינוי מרובה', reload: false };
    case 'batch_target_not_allowed':
      return { text: 'אחד הזרמים כבר אינו מתאים. התצוגה המקדימה נטענה מחדש.', reload: true };
    case 'write_in_progress':
      return { text: 'שינוי אחר של אחד הזרמים מתבצע. נסו שוב בעוד רגע.', reload: false };
    case 'forbidden':
      return { text: 'אין הרשאה לפעולה הזו.', reload: false };
    case 'source_unavailable':
    case 'source_timeout':
      return { text: 'ה־NVR אינו זמין.', reload: false };
    case 'network':
      return { text: 'אין חיבור לשרת.', reload: false };
    default:
      return { text: e.user_message || 'הפעולה לא בוצעה.', reload: false };
  }
}

/** The display of a number range under a field: "32–8192". */
export const rangeLabel = (r: { min: number; max: number } | null): string => (r ? `${r.min}–${r.max}` : DASH);
