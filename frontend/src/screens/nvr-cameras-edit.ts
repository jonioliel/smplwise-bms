/**
 * CR-020 S2 phase B: the pure logic of the stream editing on הגדרות › אבטחה › מצלמות - which controls a stream gets (and why one is
 * disabled), the editor's draft and its diff, the lock rules, the texts of the ONE confirmation, the Hebrew line of every error
 * code and the display of the change log. No DOM and no network, so the unit spec runs it in Node.
 *
 * Rules carried from the owner and the contract:
 *  - only a holder of `nvr.configure` sees edit controls (the list's / the detail's `can_write`); the server checks everything;
 *  - `writable` is null in the list and boolean only in the detail: a control is offered only after the detail was read;
 *  - a control that cannot act is disabled and its reason lives ONLY in the tooltip / aria-label (clean operator screens);
 *  - an unknown outcome (`source_unavailable` with `details.outcome = "unknown"`) is never retried by the screen: "הסטטוס נבדק".
 * Device strings (codec_raw, profile, channel names) are only ever rendered as text by the callers; nothing here builds HTML.
 */
import type { BitrateMode, CameraDetail, EncodingChanges, EncodingField, NvrCamera, StreamChange, StreamEncoding, StreamOptions } from '../api/nvr-settings';
import { DASH, ROLE_HE } from './nvr-cameras-logic';

export const FIELD_HE: Record<EncodingField, string> = {
  codec: 'קידוד', profile: 'פרופיל', resolution: 'רזולוציה', fps: 'FPS', bitrate_mode: 'סוג קצב', bitrate_kbps: 'קצב', quality: 'איכות', gop: 'GOP',
  svc: 'SVC', smart_codec: 'Smart codec', b_frames: 'B-frames',
};

/** The fields the editor can change in S2 (B-frames are `field_not_supported` on the server). */
export const EDIT_FIELDS: EncodingField[] = ['codec', 'profile', 'resolution', 'fps', 'bitrate_mode', 'bitrate_kbps', 'quality', 'gop', 'svc', 'smart_codec'];

// ------------------------------------------------------------------------------------------------ which controls a stream gets

export interface Ctx {
  /** The list's `can_write` (nvr.configure at installation scope). */
  canWrite: boolean;
  /** The list is the registry's last reading (the device could not be read): no etag, nothing can be written. */
  stale: boolean;
  /** null until the camera's detail was read (the first time `writable` and the options are known). */
  detail: CameraDetail | null | 'error';
}

export interface Control {
  /** Rendered at all (false: no permission, or the answer is not known yet - the cell stays plain text). */
  show: boolean;
  enabled: boolean;
  /** The tooltip / aria-label of a disabled control. Never a visible paragraph. */
  reason: string;
}

const NONE: Control = { show: false, enabled: false, reason: '' };

export const REASON_HE: Record<string, string> = {
  read_only: 'השינוי אינו זמין',
  not_supported: 'ה־NVR אינו תומך בשינוי הזרם הזה',
  capabilities_unreadable: 'יכולות הזרם אינן ידועות',
  proxied: 'ה־NVR אינו מאפשר לשנות את הזרם הזה',
  offline: 'המצלמה אינה מקוונת',
  stale: 'ה־NVR אינו זמין',
  detail_error: 'ה־NVR אינו זמין',
  no_options: 'יכולות הזרם אינן ידועות',
};

/** `not_writable_reason` is a code of the server or - when the device's capability documents were refused - the device's own short status
 * (`notSupport`, `http_404`, `capabilities_invalid`): none of those is shown raw; any unknown code means "the capabilities are not known". */
export const reasonHe = (code: string | null | undefined): string => (!code ? REASON_HE.read_only : REASON_HE[code] ?? REASON_HE.no_options);

/** The control state of one stream for the SVC toggle (`kind: 'svc'`) or the editor's pencil (`kind: 'edit'`). */
export function control(kind: 'svc' | 'edit', cam: Pick<NvrCamera, 'camera_id' | 'online'>, s: StreamEncoding | null, ctx: Ctx): Control {
  if (!s || !ctx.canWrite || !cam.camera_id) return NONE;
  if (kind === 'svc' && s.svc === null) return NONE; // no SVC element on this stream: a dash, as in S1
  if (ctx.detail === null) return NONE; // not read yet: writable is null in the list, so no toggle yet
  if (ctx.stale) return { show: true, enabled: false, reason: REASON_HE.stale };
  if (ctx.detail === 'error') return { show: true, enabled: false, reason: REASON_HE.detail_error };
  if (ctx.detail.stale) return { show: true, enabled: false, reason: REASON_HE.stale };
  if (ctx.detail.can_write === false) return NONE; // a camera deny for this administrator: no edit controls at all
  const fresh = ctx.detail.camera.streams.find((x) => x.stream_ref === s.stream_ref) ?? s;
  if (fresh.writable === false) return { show: true, enabled: false, reason: reasonHe(fresh.not_writable_reason) };
  if (fresh.writable !== true) return NONE;
  if (cam.online === false) return { show: true, enabled: false, reason: REASON_HE.offline };
  const opts = ctx.detail.options?.[s.stream_ref];
  if (!opts) return { show: true, enabled: false, reason: REASON_HE.no_options };
  if (kind === 'svc' && !opts.svc) return { show: true, enabled: false, reason: REASON_HE.not_supported };
  if (s.etag === null) return { show: true, enabled: false, reason: REASON_HE.stale };
  return { show: true, enabled: true, reason: '' };
}

// ------------------------------------------------------------------------------------------------ the ONE confirmation

/** Display of a field's value in the confirmation, the change log and the editor (LTR values are wrapped by the caller). */
export function valueLabel(field: EncodingField | string, v: unknown): string {
  if (v === null || v === undefined || v === '') return DASH;
  if (typeof v === 'boolean') return v ? 'פעיל' : 'כבוי';
  if (field === 'fps') return v === 'full' || v === 0 ? 'מלא' : String(v);
  if (field === 'resolution') return String(v).replace(/x/i, '×');
  if (field === 'bitrate_kbps') return `${v} kbps`;
  return String(v);
}

export interface Detail {
  field: EncodingField;
  label: string;
  from: string;
  to: string;
}

export interface ConfirmModel {
  heading: string;
  /** "camera · stream. The picture will cut for a few seconds." */
  lead: string;
  /** "שינוי אחד" / "3 שינויים" */
  count: string;
  confirmLabel: string;
  details: Detail[];
  /** CR-020 S2C: the camera names of a multi-camera change, listed (scrolling) under "פרטים" instead of the field list. */
  names?: string[];
  /** CR-020 S2C: a second, text button before "ביטול" (the SVC dialog's "החל גם על מצלמות נוספות"); the dialog then also fires `extra`. */
  extraLabel?: string;
}

export const countLabel = (n: number): string => (n === 1 ? 'שינוי אחד' : `${n} שינויים`);

/** The value the stream holds for a field, in the same shape the request uses. */
export function currentValue(s: StreamEncoding, f: EncodingField): unknown {
  if (f === 'fps') return s.fps_full ? 'full' : s.fps;
  return s[f as keyof StreamEncoding];
}

/** The ONE confirmation of every change (owner Q3 = A): the count, two buttons, the field-by-field list collapsed under "פרטים". */
export function confirmModel(camera: string, s: StreamEncoding, changes: EncodingChanges): ConfirmModel {
  const fields = (Object.keys(changes) as EncodingField[]).filter((f) => changes[f] !== undefined);
  const only = fields.length === 1 ? fields[0] : null;
  const lead = `${camera} · ${ROLE_HE[s.role]}. השידור ייקטע לכמה שניות.`;
  const details = fields.map((f) => ({ field: f, label: FIELD_HE[f], from: valueLabel(f, currentValue(s, f)), to: valueLabel(f, changes[f]) }));
  if (only === 'svc') {
    const on = changes.svc === true;
    return { heading: on ? 'להפעיל SVC?' : 'לכבות SVC?', lead, count: countLabel(1), confirmLabel: on ? 'הפעל' : 'כבה', details };
  }
  return { heading: 'לשמור את השינויים?', lead, count: countLabel(fields.length), confirmLabel: 'שמור', details };
}

// ------------------------------------------------------------------------------------------------ errors

export interface ErrorShape {
  status: number;
  code: string;
  user_message?: string;
  details?: Record<string, unknown>;
}

export interface ErrorLine {
  text: string;
  /** The row / the camera must be read again (stale, diverged, an unknown outcome). A read, never a repeat of the write. */
  reload: boolean;
}

/** An unknown outcome: the request was sent and the answer was lost. The write is NEVER repeated by the screen. */
export const isUnknownOutcome = (e: ErrorShape): boolean => e.code === 'source_unavailable' && e.details?.outcome === 'unknown';

const LINE: Record<string, string> = {
  stale: 'הערכים השתנו ב־NVR. נטען מחדש.',
  write_in_progress: 'שינוי אחר של הזרם הזה מתבצע. נסו שוב בעוד רגע.',
  batch_in_progress: 'מתבצע שינוי מרובה',
  nvr_busy: 'ה־NVR עסוק. נסו שוב בעוד רגע.',
  nvr_no_effect: 'ה־NVR אישר את השינוי אבל לא שינה את ההגדרה.',
  nvr_diverged: 'ה־NVR שינה רק חלק מההגדרות. נטען מחדש.',
  nvr_not_supported: 'ה־NVR אינו תומך בשינוי הזה.',
  nvr_rejected: 'ה־NVR דחה את השינוי.',
  capabilities_unreadable: 'יכולות הזרם אינן ידועות, ולכן השינוי בוטל.',
  confirm_required: 'נדרש אישור.',
  value_not_allowed: 'הערך אינו נתמך במצלמה.',
  field_locked: 'השדה נעול כרגע.',
  field_not_supported: 'השדה אינו נתמך בזרם הזה.',
  not_rollbackable: 'אי אפשר לבטל את השינוי הזה.',
  forbidden: 'אין הרשאה לפעולה הזו.',
  source_unavailable: 'ה־NVR אינו זמין.',
  source_forbidden: 'ל־NVR אין הרשאה לשינוי הזה.',
};

/** The one muted line under a row / in the editor for a failed write or undo. */
export function errorLine(e: ErrorShape): ErrorLine {
  if (isUnknownOutcome(e)) return { text: 'הסטטוס נבדק', reload: true };
  const reload = e.code === 'stale' || e.code === 'nvr_diverged';
  if (e.code === 'value_not_allowed' && typeof e.details?.field === 'string' && e.details.field in FIELD_HE) return { text: `${FIELD_HE[e.details.field as EncodingField]}: ${LINE.value_not_allowed}`, reload };
  const text = LINE[e.code] ?? (e.user_message || 'השינוי לא נשמר.');
  return { text, reload };
}

/** The error codes that mean the write did not reach the device at all (a safe state to try again by hand). */
export const NOT_SENT = new Set(['stale', 'write_in_progress', 'batch_in_progress', 'confirm_required', 'value_not_allowed', 'field_locked', 'field_not_supported', 'capabilities_unreadable', 'forbidden', 'validation']);

// ------------------------------------------------------------------------------------------------ the editor's draft

/** The editor's form values as strings / booleans (an empty string = nothing chosen). */
export interface Draft {
  codec: string;
  profile: string;
  resolution: string;
  fps: string;
  bitrate_mode: string;
  bitrate_kbps: string;
  quality: string;
  gop: string;
  svc: boolean | null;
  smart_codec: boolean | null;
}

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export function draftOf(s: StreamEncoding): Draft {
  return {
    codec: str(s.codec), profile: str(s.profile), resolution: str(s.resolution), fps: s.fps_full ? 'full' : str(s.fps), bitrate_mode: str(s.bitrate_mode),
    bitrate_kbps: str(s.bitrate_kbps), quality: str(s.quality), gop: str(s.gop), svc: s.svc, smart_codec: s.smart_codec,
  };
}

const num = (v: string): number | null => (/^\d{1,7}$/.test(v.trim()) ? Number(v) : null);

/** Which fields the editor shows for this stream and these options (unsupported fields are not shown at all). */
export function shownFields(s: StreamEncoding, o: StreamOptions, d: Draft): EncodingField[] {
  const codec = d.codec || s.codec || '';
  const has = (f: EncodingField) => s.fields[f]?.supported !== false;
  const out: EncodingField[] = [];
  if (has('codec') && o.codec.length) out.push('codec');
  if (has('profile') && (o.profile[codec] ?? []).length) out.push('profile');
  if (has('resolution') && (o.resolution[codec] ?? []).length) out.push('resolution');
  if (has('fps') && (o.fps.length || o.fps_full)) out.push('fps');
  if (has('bitrate_mode') && o.bitrate_mode.length) out.push('bitrate_mode');
  if (has('bitrate_kbps') && o.bitrate_kbps) out.push('bitrate_kbps');
  if (has('quality') && o.quality.length) out.push('quality');
  if (has('gop') && o.gop) out.push('gop');
  if (has('svc') && o.svc && s.svc !== null) out.push('svc');
  if (has('smart_codec') && o.smart_codec && s.smart_codec !== null) out.push('smart_codec');
  return out;
}

/** The field that locks `f` right now (its draft value switches `f` off), or null. Combines the device's `locks` and the server's per-field facts. */
export function lockedBy(f: EncodingField, s: StreamEncoding, o: StreamOptions, d: Draft): EncodingField | null {
  if (s.fields[f]?.editable === false) return s.fields[f]?.locked_by ?? f;
  for (const [src, targets] of Object.entries(o.locks) as [EncodingField, EncodingField[]][]) {
    if (targets?.includes(f) && f !== src && (d as unknown as Record<string, unknown>)[src] === true) return src;
  }
  if (f === 'quality' && d.bitrate_mode !== 'VBR') return 'bitrate_mode'; // quality exists only under a variable bit rate
  return null;
}

/** A form value the device would refuse: outside the list / range of the options, or empty where the codec change left it unset. */
export function invalidFields(s: StreamEncoding, o: StreamOptions, d: Draft): EncodingField[] {
  const bad: EncodingField[] = [];
  const codec = d.codec || s.codec || '';
  const was = draftOf(s);
  for (const f of shownFields(s, o, d)) {
    if (lockedBy(f, s, o, d)) continue;
    // a value the person did not touch (and the codec is the same) is what the device already holds: never "invalid", even when it is unset
    if (d.codec === was.codec && f in was && d[f as keyof Draft] === was[f as keyof Draft]) continue;
    switch (f) {
      case 'codec':
        if (!o.codec.includes(d.codec)) bad.push(f);
        break;
      case 'profile':
        if (!(o.profile[codec] ?? []).includes(d.profile)) bad.push(f);
        break;
      case 'resolution':
        if (!(o.resolution[codec] ?? []).includes(d.resolution)) bad.push(f);
        break;
      case 'fps':
        if (d.fps === 'full' ? !o.fps_full : !o.fps.includes(Number(d.fps))) bad.push(f);
        break;
      case 'bitrate_mode':
        if (!o.bitrate_mode.includes(d.bitrate_mode as BitrateMode)) bad.push(f);
        break;
      case 'bitrate_kbps': {
        const n = num(d.bitrate_kbps);
        if (n === null || n < o.bitrate_kbps.min || n > o.bitrate_kbps.max) bad.push(f);
        break;
      }
      case 'quality':
        if (!o.quality.includes(Number(d.quality))) bad.push(f);
        break;
      case 'gop': {
        const n = num(d.gop);
        if (n === null || n < o.gop.min || n > o.gop.max) bad.push(f);
        break;
      }
      default:
        break;
    }
  }
  return bad;
}

/** Only what differs from the stream (and is editable): the body of `changes`. */
export function diffDraft(s: StreamEncoding, o: StreamOptions, d: Draft): EncodingChanges {
  const out: EncodingChanges = {};
  const was = draftOf(s);
  for (const f of shownFields(s, o, d)) {
    if (lockedBy(f, s, o, d)) continue;
    switch (f) {
      case 'codec':
      case 'profile':
      case 'resolution':
      case 'bitrate_mode':
        if (d[f] && d[f] !== was[f]) (out as Record<string, unknown>)[f] = d[f];
        break;
      case 'fps':
        if (d.fps && d.fps !== was.fps) out.fps = d.fps === 'full' ? 'full' : Number(d.fps);
        break;
      case 'bitrate_kbps':
      case 'quality':
      case 'gop': {
        const n = num(d[f]);
        if (n !== null && d[f] !== was[f]) out[f] = n;
        break;
      }
      case 'svc':
      case 'smart_codec':
        if (d[f] !== null && d[f] !== was[f]) out[f] = d[f] as boolean;
        break;
      default:
        break;
    }
  }
  return out;
}

/** After the options of a new codec arrived: a profile / resolution the new codec does not offer is cleared (never picked silently); the user chooses. */
export function reconcile(d: Draft, o: StreamOptions): Draft {
  const codec = d.codec;
  const next = { ...d };
  if (!(o.profile[codec] ?? []).includes(next.profile)) next.profile = '';
  if (!(o.resolution[codec] ?? []).includes(next.resolution)) next.resolution = '';
  return next;
}

// ------------------------------------------------------------------------------------------------ the change log (last 5)

/** `{field: [from, to]}` of a change row: the contract's `fields` object, or the legacy JSON string. Anything else: empty. */
export function changeFields(c: StreamChange): { field: string; from: string; to: string }[] {
  let raw: unknown = c.fields;
  if (raw === undefined || raw === null) {
    try {
      raw = c.fields_json ? JSON.parse(c.fields_json) : null;
    } catch {
      raw = null;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const out: { field: string; from: string; to: string }[] = [];
  for (const [field, v] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(v) && v.length === 2) out.push({ field, from: valueLabel(field, v[0]), to: valueLabel(field, v[1]) });
    else if (v && typeof v === 'object' && 'to' in v) out.push({ field, from: valueLabel(field, (v as Record<string, unknown>).from), to: valueLabel(field, (v as Record<string, unknown>).to) });
  }
  return out;
}

export const fieldName = (f: string): string => FIELD_HE[f as EncodingField] ?? f;

export const STATUS_HE: Record<string, string> = {
  pending: 'בתהליך', applied: 'נשמר', unchanged: 'ללא שינוי', no_effect: 'לא נקלט', refused: 'נדחה', failed: 'נכשל', diverged: 'נשמר חלקית', rolled_back: 'בוטל',
};

/** The newest `limit` stream-encoding changes of one stream, newest first. Rows without XML, by contract. */
export function lastChanges(rows: StreamChange[], streamRef: string, limit = 5): StreamChange[] {
  return rows
    .filter((c) => c.kind === 'stream_encoding' && c.stream_ref === streamRef)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
    .slice(0, limit);
}

/** The undo goes only on the newest change of the stream, and only when it was applied or diverged (the server allows both; an undo is itself such a change: pressing it again re-applies). */
export function undoable(list: StreamChange[]): StreamChange | null {
  const newest = list[0];
  return newest && (newest.status === 'applied' || newest.status === 'diverged') ? newest : null;
}

