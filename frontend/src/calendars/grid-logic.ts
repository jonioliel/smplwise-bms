/**
 * CAL-GRID-EDIT-2343: the pure logic of Outlook-style editing on the week / day grid (owner answers 02.11, round 13; the approved prototype
 * private/design-system-2026-10-27/round13/calendar-outlook). No DOM, no network: unit-tested in Node (tests/unit-calendars-grid-edit-2343.spec.ts).
 *
 * - geometry: a column's hour band in minutes, the minute under the pointer, snapping to the calendar's own time step (owner answer 2C);
 * - gestures: a press that becomes a click, a drag-select, a move or a resize - with the touch long-press (owner answer 4A);
 * - keyboard: arrows move the selection, Shift + arrows extend it, Enter opens the quick create (keyboard actions never animate);
 * - hints: what the server will say about a time, BEFORE saving - open hours, length (the calendar manager may exceed it), the past, a
 *   maintenance window through the maintenance-overlap mode, buffers, the overlap policy (a request after a confirmed entry waits for the
 *   manager, or is refused when `contested_requests` = reject), approval, and the per-calendar rule for moving an approved booking.
 *   These are hints only: every write goes through the server, which decides again.
 */
import type { Calendar, CalSettings, Occurrence } from '../api/calendars';
import { DAY_LONG, hm, pad, startOfDay } from './model';

export interface Band { from: number; to: number }
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** The minute of the day under a pointer at `frac` (0..1) of a column's height. */
export function minuteAt(frac: number, band: Band): number {
  return band.from + clamp(frac, 0, 1) * (band.to - band.from);
}
/** The step-aligned minute at or before `m`, inside the band so that one step still fits. */
export function snapFloor(m: number, step: number, band: Band): number {
  return clamp(Math.floor((m - band.from) / step) * step + band.from, band.from, band.to - step);
}
/** The nearest step-aligned minute (a moved start, a resized end). */
export const snapRound = (m: number, step: number) => Math.round(m / step) * step;

/** The calendar's time step (5 / 10 / 15 / 30 / 60; default 15 - owner answer 2C). */
export function stepOf(cal: Pick<Calendar, 'slot_step_min'> | undefined | null): number {
  const s = cal?.slot_step_min;
  return s && [5, 10, 15, 30, 60].includes(s) ? s : 15;
}

/** A single click on a free slot: 30 minutes from the step under the pointer (or one step when the step is longer). */
export function clickSpan(at: number, step: number, band: Band): { s: number; e: number } {
  const s = snapFloor(at, step, band);
  return { s, e: Math.min(band.to, s + Math.max(30, step)) };
}

/** A drag over free time: from the anchor's step to the step under the pointer, in either direction; a touch selection is at least 30 min. */
export function dragSpan(anchor: number, at: number, step: number, band: Band, minLen = step): { s: number; e: number } {
  const m = snapFloor(at, step, band);
  const s = Math.min(anchor, m);
  let e = Math.max(anchor, m) + step;
  if (e - s < minLen) e = Math.min(band.to, s + minLen);
  return { s, e };
}

/** A moved entry keeps its length; the pointer holds it where it was grabbed. */
export function moveSpan(cur: { s: number; e: number }, at: number, grab: number, step: number, band: Band): { s: number; e: number } {
  const len = cur.e - cur.s;
  const s = clamp(snapRound(at - grab, step), band.from, Math.max(band.from, band.to - len));
  return { s, e: s + len };
}

/** A resized entry keeps its start; at least one step long. */
export function resizeSpan(cur: { s: number; e: number }, at: number, step: number, band: Band): { s: number; e: number } {
  return { s: cur.s, e: clamp(snapRound(at, step), cur.s + step, band.to) };
}

/** Local minutes of a day -> an instant, and back. */
export const instantAt = (day: Date, min: number) => new Date(startOfDay(day).getTime() + min * 60000);
export const minOfDay = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d;
  return x.getHours() * 60 + x.getMinutes();
};

// ---------------------------------------------------------------- the press: click, drag-select, move, resize, long-press

export const LONG_PRESS_SLOT_MS = 450; // touch: holding a free slot starts a selection
export const LONG_PRESS_EVENT_MS = 350; // touch: holding an entry picks it up
export const MOVE_TOLERANCE = { mouse: 4, touch: 8 };

export type PressTarget = { kind: 'slot'; col: number; at: number } | { kind: 'event'; col: number; at: number; id: string; editable: boolean; mode: 'move' | 'resize' } | { kind: 'none' };
export type PressStep = 'none' | 'cancel' | 'start' | 'drag';
export type PressEnd = 'click' | 'drop' | 'coach' | 'none';

/** One pointer press. A mouse is armed at once (a drag starts after a few pixels); a touch is armed only by the long-press timer, and a move
 * before it means the user is scrolling or swiping: the press is cancelled, nothing is selected. */
export class Press {
  armed: boolean;
  started = false;
  cancelled = false;
  constructor(readonly target: PressTarget, readonly x0: number, readonly y0: number, readonly touch: boolean) {
    this.armed = !touch;
  }

  get delay(): number {
    return this.target.kind === 'event' ? LONG_PRESS_EVENT_MS : LONG_PRESS_SLOT_MS;
  }

  /** The long-press timer fired (touch). For a slot the selection starts now; for an entry it is lifted (only if it may be dragged). */
  onTimer(): 'select' | 'lift' | 'none' {
    if (this.cancelled || this.armed) return 'none';
    if (this.target.kind === 'slot') {
      this.armed = true;
      this.started = true;
      return 'select';
    }
    if (this.target.kind === 'event' && this.target.editable) {
      this.armed = true;
      return 'lift';
    }
    return 'none';
  }

  onMove(x: number, y: number): PressStep {
    const far = Math.hypot(x - this.x0, y - this.y0) > (this.touch ? MOVE_TOLERANCE.touch : MOVE_TOLERANCE.mouse);
    if (this.cancelled) return 'none';
    if (!this.armed) {
      if (far) {
        this.cancelled = true;
        return 'cancel';
      }
      return 'none';
    }
    if (this.target.kind === 'none' || (this.target.kind === 'event' && !this.target.editable)) return 'none';
    if (!this.started) {
      if (!far) return 'none';
      this.started = true;
      return 'start';
    }
    return 'drag';
  }

  onUp(): PressEnd {
    if (this.target.kind === 'none') return 'none';
    if (this.started) return this.target.kind === 'slot' ? 'click' : 'drop';
    if (this.cancelled) return 'none';
    // a short tap on a free slot on touch does not create (the hint says "hold"); a tap on an entry opens its card
    if (this.target.kind === 'slot' && this.touch) return 'coach';
    return 'click';
  }
}

// ---------------------------------------------------------------- keyboard

export interface KbSel { col: number; anchor: number; focus: number }
export type KbResult = { kind: 'select'; sel: KbSel; span: { col: number; s: number; e: number } } | { kind: 'open'; span: { col: number; s: number; e: number } } | { kind: 'none' };

/** Arrows move the selection by one step (Up / Down) or one column (Left / Right - in RTL the next column is to the left), Shift extends,
 * Enter opens the quick create on the selection. `cols` columns; `first` is where a new keyboard selection starts. */
export function kbStep(cur: KbSel | null, key: string, shift: boolean, cols: number, step: number, band: Band, first: { col: number; min: number }, rtl = true): KbResult {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(key)) return { kind: 'none' };
  const sel: KbSel = cur ? { ...cur } : { col: clamp(first.col, 0, Math.max(0, cols - 1)), anchor: snapFloor(first.min, step, band), focus: snapFloor(first.min, step, band) };
  const span = () => ({ col: sel.col, s: Math.min(sel.anchor, sel.focus), e: Math.max(sel.anchor, sel.focus) + step });
  if (key === 'Enter') return { kind: 'open', span: span() };
  if (key === 'ArrowUp') sel.focus = Math.max(band.from, sel.focus - step);
  if (key === 'ArrowDown') sel.focus = Math.min(band.to - step, sel.focus + step);
  const next = (key === 'ArrowLeft') === rtl ? 1 : -1;
  if (key === 'ArrowLeft' || key === 'ArrowRight') sel.col = clamp(sel.col + next, 0, Math.max(0, cols - 1));
  if ((key === 'ArrowUp' || key === 'ArrowDown') && !shift) sel.anchor = sel.focus;
  return { kind: 'select', sel, span: span() };
}

// ---------------------------------------------------------------- hints (the server decides again)

export type HintLevel = 'ok' | 'pend' | 'contest' | 'bad';
export interface Hint { level: HintLevel; reason: string | null; warn: string | null; peers: number; contested: Occurrence | null; approver: string | null }
export interface Candidate { cal: Calendar; start: Date; end: Date; ignoreId?: string; behalf?: string; moving?: 'confirmed' | 'pending' | null; started?: boolean; headcount?: number }
export type HintSettings = Pick<CalSettings, 'contested_requests' | 'maintenance_overlap' | 'editors_bypass_approval' | 'pending_holds_slot'>;

export const durText = (m: number) => (m < 60 ? `${m} דק׳` : m === 60 ? 'שעה' : m === 120 ? 'שעתיים' : m % 60 ? `${Math.floor(m / 60)}:${pad(m % 60)} שעות` : `${m / 60} שעות`);
const strongRole = (c: Calendar) => c.my_role === 'edit' || c.my_role === 'manage';

/** The open window of a calendar on a day (local minutes), or null when it is closed that day; undefined hours = always open. */
export function openOn(cal: Pick<Calendar, 'open_hours'>, day: Date): { from: number; to: number } | null {
  const h = cal.open_hours;
  if (!h) return { from: 0, to: 1440 };
  const iso = day.getDay() === 0 ? 7 : day.getDay();
  if (!h.weekdays.includes(iso)) return null;
  const [sh, sm] = h.start.split(':').map(Number);
  const [eh, em] = h.end.split(':').map(Number);
  return { from: sh * 60 + sm, to: eh * 60 + em };
}

/** What saving `c` would meet, from the entries on screen (`busy`: the occurrences of the day, held slots included). */
export function hintFor(c: Candidate, busy: Occurrence[], s: HintSettings, now: Date): Hint {
  const cal = c.cal;
  const out: Hint = { level: 'ok', reason: null, warn: null, peers: 0, contested: null, approver: cal.owner?.name || null };
  const block: string[] = [];
  const strong = strongRole(cal);
  if (!cal.my_role || cal.my_role === 'view') block.push(cal.my_role === 'view' ? `${cal.name}: צפייה בלבד` : 'אין לך הרשאה ליצור אירועים');
  const day = startOfDay(c.start);
  const sMin = minOfDay(c.start);
  const eMin = c.end.getTime() - day.getTime() >= 86_400_000 ? 1440 : minOfDay(c.end);
  let needsApproval = cal.approval_mode === 'always' || (cal.approval_mode === 'on_behalf' && !!c.behalf && c.behalf !== 'self');
  const open = openOn(cal, day);
  if (!open) {
    if (strong) out.warn = `${cal.name} סגור ב${DAY_LONG[day.getDay()]}. כמנהל היומן מותר לך`;
    else if (cal.approval_mode === 'outside_hours') needsApproval = true;
    else block.push(`${cal.name} סגור ב${DAY_LONG[day.getDay()] === 'שבת' ? 'שבת' : 'יום הזה'}`);
  } else if (sMin < open.from || eMin > open.to) {
    const txt = `מחוץ לשעות הפתיחה של ${cal.name}: ${pad(Math.floor(open.from / 60))}:${pad(open.from % 60)}–${pad(Math.floor(open.to / 60))}:${pad(open.to % 60)}`;
    if (strong) out.warn = `${txt}. כמנהל היומן מותר לך`;
    else if (cal.approval_mode === 'outside_hours') needsApproval = true;
    else block.push(txt);
  }
  if (c.started ? c.end <= now : c.start < now) block.push('המועד כבר התחיל או עבר');
  const len = Math.round((c.end.getTime() - c.start.getTime()) / 60000);
  if (cal.max_minutes && len > cal.max_minutes) {
    if (strong) out.warn ??= `ארוך מ-${durText(cal.max_minutes)}. כמנהל היומן מותר לך לחרוג`;
    else block.push(`ב${cal.name} אפשר להזמין עד ${durText(cal.max_minutes)}`);
  }
  if (cal.min_minutes && len < cal.min_minutes) {
    if (strong) out.warn ??= `קצר מ-${durText(cal.min_minutes)}. כמנהל היומן מותר לך`;
    else block.push(`ב${cal.name} ההזמנה הקצרה ביותר היא ${durText(cal.min_minutes)}`);
  }
  const step = stepOf(cal);
  if (sMin % step || eMin % step) block.push(`השעות ב${cal.name} בקפיצות של ${step} דק׳`);
  if (cal.capacity && c.headcount && c.headcount > cal.capacity) block.push(`ב${cal.name} יש ${cal.capacity} מקומות`);
  // conflicts: only an exclusive calendar; buffers on both sides (touching is not a clash)
  if ((cal.conflict_policy ?? 'exclusive') === 'exclusive') {
    const margin = ((cal.buffer_before_min ?? 0) + (cal.buffer_after_min ?? 0)) * 60000;
    const a = c.start.getTime() - margin;
    const b = c.end.getTime() + margin;
    for (const o of busy) {
      if (c.ignoreId && o.event_id === c.ignoreId) continue; // itself, and the slot its own change request keeps
      if (o.calendar_id !== cal.id && !o.room_calendar_ids.includes(cal.id)) continue;
      if (!(new Date(o.start).getTime() < b && new Date(o.end).getTime() > a)) continue;
      const holds = o.state === 'confirmed' || (s.pending_holds_slot && o.state === 'pending');
      if (o.kind === 'maintenance' && o.state === 'confirmed') {
        const mode = cal.overlap_override ?? s.maintenance_overlap;
        if (mode === 'override_notify' || mode === 'block') {
          block.push(`חלון תחזוקה${o.title ? ` "${o.title}"` : ''} ${hm(o.start)}–${hm(o.end)}`);
          continue;
        }
      }
      if (holds) {
        if (s.contested_requests === 'reject') block.push(`חופף ל${o.title ? `"${o.title}"` : 'הזמנה קיימת'} ${hm(o.start)}–${hm(o.end)}`);
        else out.contested ??= o;
      } else if (o.state === 'pending') out.peers += 1;
    }
  }
  if (needsApproval && strong && s.editors_bypass_approval) needsApproval = false;
  const toRequest = needsApproval || !!out.contested;
  if (toRequest && c.moving === 'confirmed' && cal.approved_move === 'managers' && !strong) block.push('הזמנה מאושרת: שינוי רק דרך מנהל החדר');
  if (block.length) {
    out.level = 'bad';
    out.reason = block[0];
  } else if (out.contested) {
    out.level = 'contest';
    const t = out.contested.title;
    out.reason = `חופף ל${t ? `"${t}"` : 'הזמנה קיימת'} · יישלח כבקשה מתחרה`;
  } else if (needsApproval) {
    out.level = 'pend';
    out.reason = out.approver ? `באישור ${out.approver}` : 'באישור מנהל היומן';
  }
  return out;
}

/** The short line under a dragged entry / a selection: the reason it cannot go there, or that it goes to approval, or a manager's warning. */
export function hintTag(h: Hint): { cls: '' | 'pend' | 'warn'; text: string } | null {
  if (h.level === 'bad' || h.level === 'contest') return { cls: '', text: h.reason as string };
  if (h.level === 'pend') return { cls: 'pend', text: h.reason as string };
  if (h.warn) return { cls: 'warn', text: h.warn };
  return null;
}

/** What a toast says after a move / resize (the server's answer decides the state). */
export function movedText(kind: 'move' | 'resize', toCal: string | null, day: string | null, s: Date, e: Date, state: string, held: boolean, contested: boolean): string {
  const parts = [toCal, day, `${hm(s)}–${hm(e)}`].filter(Boolean).join(' · ');
  const tail = state === 'pending' ? (held ? ' · ממתין לאישור, המועד הקודם שמור' : contested ? ' · בקשה מתחרה, ממתין לאישור' : ' · ממתין לאישור') : '';
  return `${kind === 'resize' ? 'האורך עודכן' : 'הועבר'}: ${parts}${tail}`;
}

// ---------------------------------------------------------------- undo (the toast's "בטל" and Ctrl+Z)

/** `rev` is the entry's revision after the action (the undo call must name it, or the server answers 409 stale). */
export type UndoItem =
  | { kind: 'move'; eventId: string; rev: number; before: { calendarId: string; start: string; end: string } }
  | { kind: 'delete'; eventId: string; rev: number }
  | { kind: 'create'; eventId: string; rev: number };

/** The last 40 actions of this view; undo takes the newest. */
export class UndoStack {
  private items: UndoItem[] = [];
  push(u: UndoItem): void {
    this.items.push(u);
    if (this.items.length > 40) this.items.shift();
  }
  pop(): UndoItem | undefined {
    return this.items.pop();
  }
  peek(): UndoItem | undefined {
    return this.items[this.items.length - 1];
  }
  get size(): number {
    return this.items.length;
  }
  /** an entry changed by someone else / reloaded away: its actions can no longer be undone */
  drop(eventId: string): void {
    this.items = this.items.filter((u) => u.eventId !== eventId);
  }
}

/** The peek card's delete label: withdrawing a change request, withdrawing a request, or deleting. */
export function deleteLabel(o: Pick<Occurrence, 'state' | 'held'>): string {
  return o.held ? 'משיכת השינוי' : o.state === 'pending' ? 'משיכה' : 'מחק';
}

/** Placing a popover next to an anchor rectangle inside the viewport: to its left first (RTL reading flows that way), then right, else centred
 * under it; the transform origin points at the anchor (popovers grow from their trigger). */
export function placePopover(a: { x: number; y: number; w: number; h: number }, pw: number, ph: number, vw: number, vh: number, gap = 10): { left: number; top: number; origin: string } {
  let left: number;
  let ox: string;
  if (a.x - gap - pw >= 8) {
    left = a.x - gap - pw;
    ox = 'right';
  } else if (a.x + a.w + gap + pw <= vw - 8) {
    left = a.x + a.w + gap;
    ox = 'left';
  } else {
    left = clamp(a.x + a.w / 2 - pw / 2, 8, Math.max(8, vw - pw - 8));
    ox = 'center';
  }
  const top = clamp(a.y - 8, 8, Math.max(8, vh - ph - 8));
  return { left, top, origin: `${ox} ${clamp(a.y - top + 12, 0, ph)}px` };
}
