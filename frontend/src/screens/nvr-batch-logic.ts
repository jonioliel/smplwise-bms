/**
 * CR-020 S2 phase C: the pure logic of the multi-camera SVC change on הגדרות › אבטחה › מצלמות - which cameras can be chosen, the selection
 * ("select all that match the search"), the window of a long list (hundreds of cameras: only the visible rows are drawn), and the plain
 * Hebrew of every state of a batch (running, stopped by the user, stopped on a failure, an unknown outcome, interrupted, partial failure with
 * a result and a reason per camera). No DOM and no network, so the unit spec runs it in Node.
 *
 * Rules (owner 2026-10-03): no cap on the number of cameras; one confirmation; the server runs the batch in the background; after an unknown
 * outcome the server stops and checks read-only (the screen only reports); the undo-all needs one confirmation (the press on the toast is it).
 * Device strings (camera names, the server's lines) are only ever rendered as text by the callers; nothing here builds HTML.
 */
import type { Batch, BatchItem, BatchItemStatus, BatchState } from '../api/nvr-batch';
import type { CameraDetail, NvrCamera, StreamEncoding } from '../api/nvr-settings';
import { errorLine } from './nvr-cameras-edit';

// ------------------------------------------------------------------------------------------------ who can be chosen

/** One selectable camera: its main stream is H.264 with SVC on and can be written. */
export interface BatchCandidate {
  cameraId: string;
  recorderId: string;
  name: string;
  channel: number;
  streamRef: string;
  /** The etag the page holds (sent as `if_match`). */
  etag: string;
}

/** The main stream as the page knows it now: the detail's copy (it carries `writable`) over the list's. */
function freshMain(c: NvrCamera, d: CameraDetail | 'error' | undefined): StreamEncoding | null {
  const pick = (streams: StreamEncoding[]) => streams.find((s) => s.role === 'main') ?? null;
  const fromDetail = d && d !== 'error' ? pick(d.camera.streams) : null;
  return fromDetail ?? pick(c.streams);
}

/**
 * Cameras whose main stream is H.264 with SVC on and writable, in channel order. Not listed (and not explained): offline cameras, other codecs,
 * SVC already off or not present, a stream that is not writable, a reading from the registry (no etag), a camera the administrator may not write.
 * The server repeats every one of these checks (preflight and per camera); this list only spares the person a refusal.
 */
export function batchCandidates(cameras: NvrCamera[], details: Map<string, CameraDetail | 'error'>, stale: boolean): BatchCandidate[] {
  if (stale) return [];
  const out: BatchCandidate[] = [];
  for (const c of cameras) {
    if (!c.camera_id || c.online === false) continue;
    const d = details.get(c.camera_id);
    if (d === 'error' || (d && d.can_write === false)) continue;
    const s = freshMain(c, d);
    if (!s || s.codec !== 'H.264' || s.svc !== true || s.writable === false || !s.etag) continue;
    if (d && d.options && d.options[s.stream_ref] === null) continue; // capabilities unreadable: the server would refuse it
    out.push({ cameraId: c.camera_id, recorderId: c.recorder_id, name: c.name, channel: c.channel, streamRef: s.stream_ref, etag: s.etag });
  }
  return out.sort((a, b) => a.channel - b.channel || a.name.localeCompare(b.name, 'he'));
}

/** The checklist's own search: every word must be found in the name or the channel ("ערוץ 3" is a channel). */
export function filterCandidates(list: BatchCandidate[], q: string): BatchCandidate[] {
  let text = q.trim().toLowerCase();
  if (!text) return list;
  const channels = [...text.matchAll(/ערוץ\s*(\d+)/g)].map((m) => Number(m[1]));
  text = text.replace(/ערוץ\s*\d+/g, ' ');
  const words = text.split(/\s+/).filter(Boolean);
  return list.filter((c) => {
    if (channels.length && !channels.includes(c.channel)) return false;
    const h = `${c.name} ${c.channel}`.toLowerCase();
    return words.every((w) => h.includes(w));
  });
}

/** "Select all" adds every camera that matches the search (not only the visible rows) to the selection; the rest of the selection stays. */
export function selectAllMatching(selected: Set<string>, matching: BatchCandidate[]): Set<string> {
  const next = new Set(selected);
  for (const c of matching) next.add(c.cameraId);
  return next;
}

/** "Clear" empties the selection but the camera the person started from, which stays ticked. */
export function clearSelection(fixedId: string | null): Set<string> {
  return new Set(fixedId ? [fixedId] : []);
}

export function toggleSelection(selected: Set<string>, id: string, fixedId: string | null): Set<string> {
  if (id === fixedId) return new Set(selected);
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** A batch needs at least two cameras (one camera is the single write). */
export const MIN_BATCH = 2;

/** The chosen cameras in channel order (the order of the list, which is the order the server will work in). */
export const chosen = (list: BatchCandidate[], selected: Set<string>): BatchCandidate[] => list.filter((c) => selected.has(c.cameraId));

// ------------------------------------------------------------------------------------------------ a window of a long list

export interface Win {
  start: number;
  end: number;
  /** Pixels above the first drawn row. */
  top: number;
  /** The whole list's height. */
  total: number;
}

/** Which rows of `n` fixed-height rows are drawn for a scroll position: the visible ones plus `over` rows each side. Hundreds of cameras stay a handful of nodes. */
export function windowOf(scrollTop: number, viewH: number, n: number, rowH: number, over = 5): Win {
  const total = n * rowH;
  if (n <= 0) return { start: 0, end: 0, top: 0, total: 0 };
  const first = Math.max(0, Math.floor(scrollTop / rowH));
  const start = Math.min(n, Math.max(0, first - over));
  const end = Math.min(n, Math.ceil((scrollTop + Math.max(viewH, rowH)) / rowH) + over);
  return { start, end, top: start * rowH, total };
}

/** The scroll position that puts row `i` in the middle of the view. */
export const scrollFor = (i: number, viewH: number, rowH: number): number => Math.max(0, i * rowH - Math.max(0, viewH - rowH) / 2);

// ------------------------------------------------------------------------------------------------ the batch's numbers

export type Tone = 'wait' | 'spin' | 'ok' | 'bad' | 'unk' | 'skip';

const SETTLED_OK: BatchItemStatus[] = ['applied', 'unchanged', 'rolled_back'];
const BAD: BatchItemStatus[] = ['failed', 'refused', 'no_effect', 'diverged'];
const IN_FLIGHT: BatchItemStatus[] = ['running', 'pending'];

export const isTerminal = (s: BatchState): boolean => s !== 'running';
export const isUnsettled = (b: Batch): boolean => (b.items ?? []).some((i) => i.status === 'unknown' || IN_FLIGHT.includes(i.status));

export interface Tally {
  total: number;
  /** Items that finished well (written, already as asked, or put back). */
  ok: number;
  /** Items the device did not take (failed, refused, no effect, partly changed). */
  bad: number;
  unknown: number;
  inFlight: number;
  queued: number;
  notAttempted: number;
  /** ok + bad: the "2 מתוך 3" of the header. */
  processed: number;
  /** Items the batch changed and still holds changed (an undo-all would reach them). */
  applied: number;
  /** A write batch: applied; a rollback: put back. */
  restored: number;
}

/** Counts from the items; with no items the server's `counts` stand in. */
export function tally(b: Batch): Tally {
  const by: Partial<Record<BatchItemStatus, number>> = {};
  if (b.items) for (const i of b.items) by[i.status] = (by[i.status] ?? 0) + 1;
  else Object.assign(by, b.counts ?? {});
  const n = (...s: BatchItemStatus[]) => s.reduce((a, k) => a + (by[k] ?? 0), 0);
  const total = b.items ? b.items.length : Object.values(by).reduce((a, v) => a + (v ?? 0), 0);
  const ok = n(...SETTLED_OK);
  const bad = n(...BAD);
  return {
    total,
    ok,
    bad,
    unknown: n('unknown'),
    inFlight: n(...IN_FLIGHT),
    queued: n('queued'),
    notAttempted: n('not_attempted'),
    processed: ok + bad,
    // in a rollback batch an item that went well is `applied` (the rollback's own change row) or `rolled_back`: both mean "put back"
    applied: b.kind === 'rollback' ? n('applied') + n('rolled_back') : n('applied'),
    restored: b.kind === 'rollback' ? n('applied', 'rolled_back') : n('applied'),
  };
}

export const camerasLabel = (n: number): string => (n === 1 ? 'מצלמה אחת' : `${n} מצלמות`);
/** "in N cameras": "במצלמה אחת" / "ב־3 מצלמות". */
export const inCameras = (n: number): string => (n === 1 ? 'במצלמה אחת' : `ב־${n} מצלמות`);

/** The icon of a row. */
export function toneOf(i: BatchItem): Tone {
  if (SETTLED_OK.includes(i.status)) return 'ok';
  if (BAD.includes(i.status)) return 'bad';
  if (i.status === 'unknown') return 'unk';
  if (IN_FLIGHT.includes(i.status)) return 'spin';
  if (i.status === 'not_attempted') return 'skip';
  return 'wait';
}

/** The one muted line of a row (the server's `user_message` or a plain line of our own; never a device string we did not escape: the caller renders text). */
export function itemLine(i: BatchItem, kind: Batch['kind']): string {
  switch (i.status) {
    case 'queued':
      return '';
    case 'running':
    case 'pending':
      return kind === 'rollback' ? 'מחזיר' : 'מתבצע';
    case 'applied':
      return kind === 'rollback' ? 'הוחזר' : 'נשמר';
    case 'rolled_back':
      return 'הוחזר';
    case 'unchanged':
      return 'ללא שינוי';
    case 'unknown':
      return 'לא ברור אם בוצע. נבדק מול ה־NVR.';
    case 'not_attempted':
      return 'לא בוצע';
    default:
      // failed / refused / no_effect / diverged: the contract's plain line for the code, else the server's own sentence
      return errorLine({ status: 0, code: i.error_code ?? i.status, user_message: i.user_message ?? undefined }).text;
  }
}

/** The first item that went wrong (or whose outcome is unknown): the failed camera of the header. */
export function firstProblem(b: Batch): BatchItem | null {
  return (b.items ?? []).find((i) => BAD.includes(i.status)) ?? (b.items ?? []).find((i) => i.status === 'unknown') ?? null;
}

/** The row to bring into view: the camera in flight, else the problem, else the first one still waiting. */
export function focusIndex(b: Batch): number {
  const items = b.items ?? [];
  const at = (f: (i: BatchItem) => boolean) => items.findIndex(f);
  const a = at((i) => IN_FLIGHT.includes(i.status));
  if (a >= 0) return a;
  if (isTerminal(b.state)) {
    const p = firstProblem(b);
    if (p) return items.indexOf(p);
    return 0;
  }
  const q = at((i) => i.status === 'queued');
  return q >= 0 ? q : 0;
}

// ------------------------------------------------------------------------------------------------ the dialog's words

export interface BatchView {
  tone: 'running' | 'done' | 'warn' | 'error';
  title: string;
  /** One line under the title (counts); empty when there is nothing to add. */
  sub: string;
  /** "עצור" is offered. */
  canStop: boolean;
  /** "בטל את מה שנשמר" is offered (enabled only when `canUndo`). */
  showUndo: boolean;
  canUndo: boolean;
  /** "נסה שוב" after a rollback that stopped (a NEW request with a new confirmation). */
  showRetry: boolean;
}

const join = (parts: (string | false | '')[]): string => parts.filter(Boolean).join(' · ');

/** `nameOf`: the camera's display name. `stopping`: the person pressed "עצור" and the camera in flight is finishing. */
export function batchView(b: Batch, nameOf: (i: BatchItem) => string, stopping = false): BatchView {
  const t = tally(b);
  const rb = b.kind === 'rollback';
  const problem = firstProblem(b);
  const pname = problem ? nameOf(problem) : '';
  const left = t.total - t.restored; // a rollback that stopped: still changed
  const undoWait = isUnsettled(b) || b.state === 'running';
  const base = { canStop: false, showUndo: false, canUndo: false, showRetry: false };
  if (b.state === 'running') {
    return { ...base, tone: 'running', title: `${t.processed} מתוך ${t.total}`, sub: stopping ? 'עוצר אחרי המצלמה הנוכחית' : t.unknown ? 'נבדק מול ה־NVR' : '', canStop: !stopping };
  }
  const counts = rb
    ? join([t.restored > 0 && `הוחזר ${inCameras(t.restored)}`, left > 0 && `לא הוחזר ${inCameras(left)}`])
    : join([t.applied > 0 && `נשמר ${inCameras(t.applied)}`, t.bad > 0 && `נכשל ${inCameras(t.bad)}`, t.unknown > 0 && `לא ברור אם בוצע ${inCameras(t.unknown)}`,t.notAttempted > 0 && `לא בוצע ${inCameras(t.notAttempted)}`]);
  const undo = !rb && t.applied > 0 ? { showUndo: true, canUndo: !undoWait } : {};
  const retry = rb && left > 0 && !!b.rollback_of && b.state !== 'completed' ? { showRetry: true } : {};
  switch (b.state) {
    case 'completed':
      return {
        ...base, ...undo, tone: 'done',
        title: rb ? `SVC הוחזר ${inCameras(t.restored)}` : t.applied > 0 ? `SVC כבוי ${inCameras(t.applied)}` : 'ללא שינוי',
        sub: !rb && t.applied > 0 && t.ok > t.applied ? `ללא שינוי ${inCameras(t.ok - t.applied)}` : '',
      };
    case 'stopped':
      return { ...base, ...undo, ...retry, tone: 'warn', title: rb ? 'ההחזרה נעצרה בבקשתך' : 'נעצר בבקשתך', sub: counts };
    case 'failed':
      return { ...base, ...undo, ...retry, tone: 'error', title: rb ? `ההחזרה נעצרה במצלמה ${pname}` : `נעצר במצלמה ${pname}`, sub: counts };
    case 'stopped_unknown':
      return { ...base, ...undo, ...retry, tone: 'error', title: rb ? `ההחזרה נעצרה: לא ברור אם בוצע במצלמה ${pname}` : `נעצר: לא ברור אם בוצע במצלמה ${pname}`, sub: counts };
    default:
      return { ...base, ...undo, ...retry, tone: 'error', title: rb ? 'ההחזרה נקטעה באמצע' : 'השינוי נקטע באמצע', sub: counts };
  }
}

/** The toast after a batch that completed in front of the person. */
export function doneToast(b: Batch): { message: string; undo: boolean } {
  const t = tally(b);
  if (b.kind === 'rollback') return { message: `בוטל ${inCameras(t.restored)}`, undo: false };
  if (t.applied === 0) return { message: 'ללא שינוי', undo: false };
  return { message: `נשמר ${inCameras(t.applied)}`, undo: true };
}

/** The line shown when starting (or undoing) the batch was refused. `reload`: the camera list is stale and should be read again. */
export function startErrorLine(e: { status: number; code: string; user_message?: string; details?: Record<string, unknown> }, nameOfIndex?: (index: number) => string | null): { text: string; reload: boolean } {
  switch (e.code) {
    case 'batch_in_progress':
      return { text: 'מתבצע שינוי מרובה', reload: false };
    case 'batch_not_enabled':
      return { text: 'השינוי המרובה אינו זמין.', reload: false };
    case 'forbidden':
      return { text: 'אין הרשאה לפעולה הזו.', reload: false };
    case 'stale': {
      const idx = typeof e.details?.index === 'number' ? e.details.index : typeof e.details?.target === 'number' ? e.details.target : null;
      const name = idx !== null && nameOfIndex ? nameOfIndex(idx) : null;
      return { text: name ? `הערכים של ${name} השתנו ב־NVR. נטען מחדש.` : 'הערכים השתנו ב־NVR. נטען מחדש.', reload: true };
    }
    case 'confirm_required':
      return { text: 'נדרש אישור.', reload: false };
    case 'not_rollbackable':
      return { text: 'אי אפשר לבטל את השינוי הזה.', reload: false };
    case 'source_unavailable':
      return { text: 'ה־NVR אינו זמין.', reload: false };
    case 'network':
      return { text: 'אין חיבור לשרת.', reload: false };
    default:
      return { text: e.status === 422 ? e.user_message || 'הבחירה אינה תקינה.' : e.user_message || 'הפעולה לא בוצעה.', reload: false };
  }
}

// ------------------------------------------------------------------------------------------------ the confirmations

export const CONFIRM_LEAD = 'השידור של כל מצלמה ייקטע לכמה שניות. השינוי יתבצע מצלמה אחרי מצלמה ויעצור בשגיאה הראשונה.';
export const UNDO_LEAD = 'השידור של כל מצלמה ייקטע לכמה שניות. ההחזרה תתבצע מצלמה אחרי מצלמה ותעצור בשגיאה הראשונה.';

export interface BatchConfirm {
  heading: string;
  lead: string;
  count: string;
  confirmLabel: string;
  details: never[];
  names: string[];
}

export function batchConfirmModel(names: string[]): BatchConfirm {
  return { heading: `לכבות SVC ${inCameras(names.length)}?`, lead: CONFIRM_LEAD, count: camerasLabel(names.length), confirmLabel: 'כבה', details: [], names };
}

export function undoConfirmModel(names: string[]): BatchConfirm {
  return { heading: `להחזיר SVC ${inCameras(names.length)}?`, lead: UNDO_LEAD, count: camerasLabel(names.length), confirmLabel: 'החזר', details: [], names };
}

/** Which batch ids a page remembers across a reload (the server is the truth; this is only "which one was I looking at"). */
export const LAST_KEY = 'sw.nvr.batch.last';
