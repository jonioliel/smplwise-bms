/**
 * CR-020 S1: the logic of the cameras' video-settings table (הגדרות › אבטחה › מצלמות) - flattening the server's cameras into
 * one row per stream, the search / filters, the sort and the display formats. Pure functions (no DOM, no network), so the
 * unit spec runs them in Node. The table is read-only: nothing here builds a write request.
 *
 * Rule from the contract (API section 3.2): a value the device does not report is null and shows as "—"; there is never a
 * guessed default. A camera whose streams could not be read keeps one placeholder row ("לא נקרא").
 */
import type { NvrCamera, StreamEncoding, StreamRole, Verdict } from '../api/nvr-settings';

export const DASH = '—';

export const ROLE_HE: Record<StreamRole, string> = { main: 'ראשי', sub: 'משני', third: 'שלישי', other: 'נוסף' };
const ROLE_ORDER: Record<StreamRole, number> = { main: 0, sub: 1, third: 2, other: 3 };

/** One table row: one stream of one camera (or the placeholder of a camera with no readable stream: `stream` null). */
export interface StreamRow {
  /** Unique and stable: recorder + channel + stream. */
  key: string;
  cameraKey: string;
  recorderId: string;
  cameraId: string | null;
  channel: number;
  cameraName: string;
  online: boolean | null;
  enabledInArx: boolean;
  /** The camera's own read error (its streams come from the last reading, or are missing). */
  error: string | null;
  stream: StreamEncoding | null;
}

export function flatten(cameras: NvrCamera[]): StreamRow[] {
  const rows: StreamRow[] = [];
  for (const c of cameras) {
    const base = {
      cameraKey: `${c.recorder_id}:${c.source_ref}`, recorderId: c.recorder_id, cameraId: c.camera_id, channel: c.channel, cameraName: c.name, online: c.online,
      enabledInArx: c.enabled_in_arx, error: c.error,
    };
    if (!c.streams.length) rows.push({ ...base, key: `${base.cameraKey}:none`, stream: null });
    for (const s of c.streams) rows.push({ ...base, key: `${base.cameraKey}:${s.stream_ref}`, stream: s });
  }
  return rows;
}

// ------------------------------------------------------------------------------------------------ formats

/** The codec as the administrator knows it: H.264 / H.265 / MJPEG, with the "+" of the smart-codec variants (H.264+). */
export function codecLabel(s: StreamEncoding | null): string {
  if (!s || !s.codec) return DASH;
  return s.codec_plus && (s.codec === 'H.264' || s.codec === 'H.265') ? `${s.codec}+` : s.codec;
}

export function resolutionLabel(s: StreamEncoding | null): string {
  return s?.resolution ? s.resolution.replace(/x/i, '×') : DASH;
}

export function fpsLabel(s: StreamEncoding | null): string {
  if (!s) return DASH;
  if (s.fps_full) return 'מלא';
  return s.fps === null || s.fps === undefined ? DASH : String(Number.isInteger(s.fps) ? s.fps : Number(s.fps.toFixed(2)));
}

export function bitrateLabel(s: StreamEncoding | null): string {
  return s?.bitrate_kbps ? `${s.bitrate_kbps} kbps` : DASH;
}

export function svcLabel(s: StreamEncoding | null): string {
  return s?.svc === true ? 'פעיל' : s?.svc === false ? 'כבוי' : DASH;
}

export const VERDICT_HE: Record<Verdict, string> = { ok: 'מתנגן בדפדפן', no: 'לא מתנגן בדפדפן', unknown: 'לא ידוע' };

export function numberLabel(v: number | null | undefined): string {
  return v === null || v === undefined ? DASH : String(v);
}

// ------------------------------------------------------------------------------------------------ filters

export type CodecFilter = '' | 'h264' | 'h265' | 'other';
export type RoleFilter = '' | 'main' | 'sub' | 'other';
export type SvcFilter = '' | 'on' | 'off' | 'none';
export type VerdictFilter = '' | Verdict;

export interface Filters {
  q: string;
  codec: CodecFilter;
  role: RoleFilter;
  svc: SvcFilter;
  webrtc: VerdictFilter;
}

export const NO_FILTERS: Filters = { q: '', codec: '', role: '', svc: '', webrtc: '' };

export const filtersActive = (f: Filters): boolean => !!(f.q.trim() || f.codec || f.role || f.svc || f.webrtc);

/** Hebrew-insensitive, case-insensitive text the search field matches against (all words must be found). */
function haystack(r: StreamRow): string {
  const s = r.stream;
  return [
    r.cameraName, `ערוץ ${r.channel}`, String(r.channel), s ? ROLE_HE[s.role] : '', s ? s.role : '', codecLabel(s), s?.codec_raw ?? '', s?.profile ?? '', resolutionLabel(s), s?.resolution ?? '',
    s?.bitrate_mode ?? '', s?.stream_ref ?? '', s?.svc === true ? 'svc' : '',
  ].join(' ').toLowerCase();
}

export function matchesSearch(r: StreamRow, q: string): boolean {
  let text = q.toLowerCase();
  // "ערוץ 3" is a channel, not the words "ערוץ" and "3" (a bare 3 would also hit 1920x1080 and 3072 kbps)
  const channels = [...text.matchAll(/ערוץ\s*(\d+)/g)].map((m) => Number(m[1]));
  text = text.replace(/ערוץ\s*\d+/g, ' ');
  if (channels.length && !channels.includes(r.channel)) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const h = haystack(r);
  return words.every((w) => h.includes(w));
}

export function applyFilters(rows: StreamRow[], f: Filters): StreamRow[] {
  return rows.filter((r) => {
    const s = r.stream;
    if (!matchesSearch(r, f.q)) return false;
    if (f.codec) {
      const fam = s?.codec === 'H.264' ? 'h264' : s?.codec === 'H.265' ? 'h265' : 'other';
      if (!s || fam !== f.codec) return false;
    }
    if (f.role) {
      const fam = s?.role === 'main' || s?.role === 'sub' ? s.role : 'other';
      if (!s || fam !== f.role) return false;
    }
    if (f.svc) {
      const v = s?.svc === true ? 'on' : s?.svc === false ? 'off' : 'none';
      if (!s || v !== f.svc) return false;
    }
    if (f.webrtc && (!s || s.webrtc !== f.webrtc)) return false;
    return true;
  });
}

// ------------------------------------------------------------------------------------------------ sort

export type SortKey = 'channel' | 'camera' | 'role' | 'codec' | 'svc' | 'resolution' | 'fps' | 'bitrate' | 'gop' | 'webrtc';
export type SortDir = 'asc' | 'desc';
export interface Sort {
  key: SortKey;
  dir: SortDir;
}
export const DEFAULT_SORT: Sort = { key: 'channel', dir: 'asc' };

const VERDICT_ORDER: Record<Verdict, number> = { no: 0, unknown: 1, ok: 2 }; // ascending = the streams that will not play first

/** The value one column sorts on; null sorts last in both directions (a value the device does not report). */
function sortValue(r: StreamRow, key: SortKey): string | number | null {
  const s = r.stream;
  switch (key) {
    case 'channel':
      return r.channel;
    case 'camera':
      return r.cameraName;
    case 'role':
      return s ? ROLE_ORDER[s.role] : null;
    case 'codec':
      return s?.codec ? codecLabel(s) : null;
    case 'svc':
      return s?.svc === true ? 1 : s?.svc === false ? 0 : null;
    case 'resolution': {
      const m = /^(\d+)x(\d+)$/i.exec(s?.resolution ?? '');
      return m ? Number(m[1]) * Number(m[2]) : null;
    }
    case 'fps':
      return s ? (s.fps_full ? Number.MAX_SAFE_INTEGER : s.fps ?? null) : null;
    case 'bitrate':
      return s?.bitrate_kbps ?? null;
    case 'gop':
      return s?.gop ?? null;
    case 'webrtc':
      return s ? VERDICT_ORDER[s.webrtc] ?? 1 : null;
  }
}

/** Stable: ties keep channel order, then main before sub (the contract's fixed order), so a re-sort never shuffles a camera's streams. */
export function sortRows(rows: StreamRow[], sort: Sort = DEFAULT_SORT): StreamRow[] {
  const dir = sort.dir === 'desc' ? -1 : 1;
  const collator = new Intl.Collator('he', { numeric: true, sensitivity: 'base' });
  const tie = (a: StreamRow, b: StreamRow) => a.channel - b.channel || (a.stream ? ROLE_ORDER[a.stream.role] : 9) - (b.stream ? ROLE_ORDER[b.stream.role] : 9) || (a.stream?.stream_ref ?? '').localeCompare(b.stream?.stream_ref ?? '');
  return [...rows].sort((a, b) => {
    const x = sortValue(a, sort.key);
    const y = sortValue(b, sort.key);
    if (x === null && y === null) return tie(a, b);
    if (x === null) return 1;
    if (y === null) return -1;
    const c = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
    return c ? c * dir : tie(a, b);
  });
}

/** Click on a header: the same column flips direction, another column starts ascending. */
export function nextSort(current: Sort, key: SortKey): Sort {
  return current.key === key ? { key, dir: current.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
}

// ------------------------------------------------------------------------------------------------ the page

export interface Counts {
  cameras: number;
  streams: number;
  /** streams the browser cannot play over WebRTC */
  notWebrtc: number;
}

export function counts(rows: StreamRow[]): Counts {
  const cams = new Set<string>();
  let streams = 0;
  let no = 0;
  for (const r of rows) {
    cams.add(r.cameraKey);
    if (r.stream) {
      streams++;
      if (r.stream.webrtc === 'no') no++;
    }
  }
  return { cameras: cams.size, streams, notWebrtc: no };
}

/** True for the first row of a camera in the shown order (the row that starts a visual group when the table is by channel). */
export function startsGroup(rows: StreamRow[], i: number): boolean {
  return i === 0 || rows[i - 1].cameraKey !== rows[i].cameraKey;
}
