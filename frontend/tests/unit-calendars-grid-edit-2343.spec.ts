import { test, expect } from '@playwright/test';
import type { Calendar, Occurrence } from '../src/api/calendars';
import {
  Press, UndoStack, clickSpan, deleteLabel, dragSpan, hintFor, hintTag, kbStep, minuteAt, moveSpan, movedText, openOn, placePopover, resizeSpan, snapFloor, snapRound, stepOf,
  type HintSettings,
} from '../src/calendars/grid-logic';
import { editableInDrawer } from '../src/calendars/event-drawer-logic';

// CAL-GRID-EDIT-2343: the pure logic of Outlook-style editing on the calendar grid (drag, snap, keyboard, conflict hints). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-calendars-grid-edit-2343.spec.ts --workers=1

const BAND = { from: 7 * 60, to: 22 * 60 };
const DAY = new Date(2026, 10, 3); // Tuesday 3.11.2026 (local)
const NOW = new Date(2026, 10, 3, 8, 20);
const at = (h: number, m = 0, d = DAY) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const iso = (h: number, m = 0, d = DAY) => at(h, m, d).toISOString();
const S: HintSettings = { contested_requests: 'queue', maintenance_overlap: 'first_holds', editors_bypass_approval: true, pending_holds_slot: false };
const cal = (o: Partial<Calendar> = {}): Calendar => ({
  id: 'gym', name: 'אולם ספורט', type: 'room', color: 'blue', tz: 'Asia/Jerusalem', owner: { id: 'u1', name: 'דנה לוי' }, my_role: 'book', visibility: 'members', approval_mode: 'none',
  approval_timeout_h: 2, capacity: 60, equipment: [], floor_id: null, area_ref: null, conflict_policy: 'exclusive', buffer_after_min: 0, buffer_before_min: 0, slot_step_min: 15,
  min_minutes: 15, max_minutes: 180, overlap_override: null, sync: null, pending_count: 0, archived: false, revision: 1, approved_move: 'reapproval',
  open_hours: { weekdays: [1, 2, 3, 4, 5, 7], start: '07:00', end: '21:00' }, ...o,
});
const occ = (id: string, s: string, e: string, o: Partial<Occurrence> = {}): Occurrence => ({
  occurrence_id: id, event_id: id, calendar_id: 'gym', room_calendar_ids: [], start: s, end: e, title: id, state: 'confirmed', kind: 'booking', on_behalf_label: null, organizer: null,
  recurring: false, ...o,
});

// ---------------------------------------------------------------- geometry and snapping (owner answer 2C: the calendar's own step)

test('the minute under the pointer and the snapping to the step', () => {
  expect(minuteAt(0, BAND)).toBe(420);
  expect(minuteAt(1, BAND)).toBe(1320);
  expect(minuteAt(1.4, BAND)).toBe(1320); // clamped
  expect(snapFloor(9 * 60 + 14, 15, BAND)).toBe(540);
  expect(snapFloor(9 * 60 + 14, 30, BAND)).toBe(540);
  expect(snapFloor(9 * 60 + 44, 30, BAND)).toBe(570);
  expect(snapFloor(22 * 60, 15, BAND)).toBe(21 * 60 + 45); // one step still fits
  expect(snapRound(9 * 60 + 8, 15)).toBe(9 * 60 + 15);
  expect(stepOf({ slot_step_min: 30 })).toBe(30);
  expect(stepOf({ slot_step_min: 7 })).toBe(15); // unknown -> the default 15
  expect(stepOf(undefined)).toBe(15);
});

test('a click is 30 minutes, or one step when the step is longer', () => {
  expect(clickSpan(9 * 60 + 20, 15, BAND)).toEqual({ s: 555, e: 585 });
  expect(clickSpan(9 * 60 + 20, 60, BAND)).toEqual({ s: 540, e: 600 });
  expect(clickSpan(21 * 60 + 50, 15, BAND)).toEqual({ s: 1305, e: 1320 }); // cut at the band's end
});

test('a drag selects in either direction, and a touch selection is at least 30 minutes', () => {
  expect(dragSpan(540, 610, 15, BAND)).toEqual({ s: 540, e: 615 });
  expect(dragSpan(600, 545, 15, BAND)).toEqual({ s: 540, e: 615 }); // upwards
  expect(dragSpan(540, 541, 15, BAND, 30)).toEqual({ s: 540, e: 570 });
});

test('a move keeps the length and the grab point; a resize keeps the start and at least one step', () => {
  expect(moveSpan({ s: 540, e: 630 }, 700, 20, 15, BAND)).toEqual({ s: 675, e: 765 });
  expect(moveSpan({ s: 540, e: 630 }, 400, 20, 15, BAND)).toEqual({ s: 420, e: 510 }); // the band's top
  expect(moveSpan({ s: 540, e: 630 }, 1400, 0, 15, BAND)).toEqual({ s: 1230, e: 1320 }); // the band's end
  expect(resizeSpan({ s: 540, e: 600 }, 668, 15, BAND)).toEqual({ s: 540, e: 675 });
  expect(resizeSpan({ s: 540, e: 600 }, 500, 15, BAND)).toEqual({ s: 540, e: 555 });
  expect(resizeSpan({ s: 540, e: 600 }, 668, 30, BAND)).toEqual({ s: 540, e: 660 });
});

// ---------------------------------------------------------------- the press (owner answer 4A: long press on touch)

test('mouse: a press without movement is a click; a few pixels start a drag', () => {
  const click = new Press({ kind: 'slot', col: 0, at: 540 }, 100, 100, false);
  expect(click.onMove(102, 101)).toBe('none');
  expect(click.onUp()).toBe('click');
  const drag = new Press({ kind: 'slot', col: 0, at: 540 }, 100, 100, false);
  expect(drag.onMove(100, 110)).toBe('start');
  expect(drag.onMove(100, 130)).toBe('drag');
  expect(drag.onUp()).toBe('click'); // a finished selection opens the quick create
  const ev = new Press({ kind: 'event', col: 0, at: 545, id: 'e1', editable: true, mode: 'move' }, 100, 100, false);
  expect(ev.onMove(100, 120)).toBe('start');
  expect(ev.onUp()).toBe('drop');
});

test('touch: a tap on a free slot only shows the hint; moving before the long press is a scroll, never a selection', () => {
  const tap = new Press({ kind: 'slot', col: 0, at: 540 }, 100, 100, true);
  expect(tap.onUp()).toBe('coach');
  const swipe = new Press({ kind: 'slot', col: 0, at: 540 }, 100, 100, true);
  expect(swipe.onMove(100, 120)).toBe('cancel');
  expect(swipe.onTimer()).toBe('none');
  expect(swipe.onUp()).toBe('none');
});

test('touch: the long press selects, and dragging on extends it', () => {
  const p = new Press({ kind: 'slot', col: 1, at: 540 }, 100, 100, true);
  expect(p.delay).toBe(450);
  expect(p.onTimer()).toBe('select');
  expect(p.onMove(100, 140)).toBe('drag');
  expect(p.onUp()).toBe('click');
});

test('touch: a long press picks up an entry the viewer may move, not one he may not', () => {
  const mine = new Press({ kind: 'event', col: 0, at: 545, id: 'e1', editable: true, mode: 'move' }, 100, 100, true);
  expect(mine.delay).toBe(350);
  expect(mine.onTimer()).toBe('lift');
  expect(mine.onMove(100, 130)).toBe('start');
  expect(mine.onUp()).toBe('drop');
  const theirs = new Press({ kind: 'event', col: 0, at: 545, id: 'e2', editable: false, mode: 'move' }, 100, 100, true);
  expect(theirs.onTimer()).toBe('none');
  expect(theirs.onUp()).toBe('click'); // a tap still opens its card
  const locked = new Press({ kind: 'event', col: 0, at: 545, id: 'e3', editable: false, mode: 'move' }, 100, 100, false);
  expect(locked.onMove(100, 140)).toBe('none'); // a viewer's drag does nothing
  expect(locked.onUp()).toBe('click');
});

// ---------------------------------------------------------------- keyboard

test('keyboard: arrows move by a step, Shift extends, Left is the next column in RTL, Enter opens', () => {
  let r = kbStep(null, 'ArrowDown', false, 3, 15, BAND, { col: 0, min: 540 });
  expect(r.kind === 'select' && r.span).toEqual({ col: 0, s: 555, e: 570 });
  const sel = r.kind === 'select' ? r.sel : null;
  r = kbStep(sel, 'ArrowDown', true, 3, 15, BAND, { col: 0, min: 540 });
  expect(r.kind === 'select' && r.span).toEqual({ col: 0, s: 555, e: 585 });
  r = kbStep(r.kind === 'select' ? r.sel : null, 'ArrowLeft', false, 3, 15, BAND, { col: 0, min: 540 });
  expect(r.kind === 'select' && r.span.col).toBe(1);
  r = kbStep(r.kind === 'select' ? r.sel : null, 'ArrowRight', false, 3, 15, BAND, { col: 0, min: 540 }, false);
  expect(r.kind === 'select' && r.span.col).toBe(2); // LTR: right is next
  expect(kbStep(r.kind === 'select' ? r.sel : null, 'Enter', false, 3, 15, BAND, { col: 0, min: 540 }).kind).toBe('open');
  expect(kbStep(null, 'a', false, 3, 15, BAND, { col: 0, min: 540 }).kind).toBe('none');
  const top = kbStep({ col: 0, anchor: 420, focus: 420 }, 'ArrowUp', false, 3, 15, BAND, { col: 0, min: 540 });
  expect(top.kind === 'select' && top.span.s).toBe(420); // never above the band
});

// ---------------------------------------------------------------- hints: the product's rules before saving (the server decides again)

test('open hours: a booker is refused, the calendar manager is warned, an outside-hours room asks for approval', () => {
  const late = { start: at(20, 30), end: at(21, 30) };
  const b = hintFor({ cal: cal(), ...late }, [], S, NOW);
  expect(b.level).toBe('bad');
  expect(b.reason).toContain('מחוץ לשעות הפתיחה');
  const m = hintFor({ cal: cal({ my_role: 'manage' }), ...late }, [], S, NOW);
  expect(m.level).toBe('ok');
  expect(m.warn).toContain('כמנהל היומן');
  expect(hintFor({ cal: cal({ approval_mode: 'outside_hours' }), ...late }, [], S, NOW).level).toBe('pend');
  expect(openOn(cal(), new Date(2026, 10, 7))).toBeNull(); // Saturday closed
  expect(hintFor({ cal: cal(), start: at(10, 0, new Date(2026, 10, 7)), end: at(11, 0, new Date(2026, 10, 7)) }, [], S, NOW).reason).toContain('סגור בשבת');
  expect(openOn(cal({ open_hours: null }), DAY)).toEqual({ from: 0, to: 1440 });
});

test('the past, the length, the step and the capacity', () => {
  expect(hintFor({ cal: cal(), start: at(8, 0), end: at(9, 0) }, [], S, NOW).reason).toBe('המועד כבר התחיל או עבר');
  expect(hintFor({ cal: cal(), start: at(8, 0), end: at(10, 0), started: true }, [], S, NOW).level).toBe('ok'); // a started entry may still grow
  const long = hintFor({ cal: cal(), start: at(9, 0), end: at(13, 0) }, [], S, NOW);
  expect(long.level).toBe('bad');
  expect(long.reason).toContain('עד 3 שעות');
  expect(hintFor({ cal: cal({ my_role: 'manage' }), start: at(9, 0), end: at(13, 0) }, [], S, NOW).warn).toContain('לחרוג');
  expect(hintFor({ cal: cal({ slot_step_min: 30 }), start: at(9, 15), end: at(10, 0) }, [], S, NOW).reason).toContain('בקפיצות של 30');
  expect(hintFor({ cal: cal({ capacity: 10 }), start: at(9, 0), end: at(10, 0), headcount: 12 }, [], S, NOW).reason).toContain('10 מקומות');
  expect(hintFor({ cal: cal({ my_role: 'view' }), start: at(9, 0), end: at(10, 0) }, [], S, NOW).reason).toContain('צפייה בלבד');
});

test('an overlap with a confirmed entry is a contested request (queue) or refused (reject); pending ones only count', () => {
  const busy = [occ('a', iso(9), iso(10), { title: 'כדורסל נוער' }), occ('p', iso(9, 30), iso(11), { state: 'pending' })];
  const q = hintFor({ cal: cal(), start: at(9, 30), end: at(10, 30) }, busy, S, NOW);
  expect(q.level).toBe('contest');
  expect(q.reason).toContain('"כדורסל נוער"');
  expect(q.peers).toBe(1);
  expect(hintFor({ cal: cal(), start: at(9, 30), end: at(10, 30) }, busy, { ...S, contested_requests: 'reject' }, NOW).level).toBe('bad');
  expect(hintFor({ cal: cal(), start: at(10, 0), end: at(10, 30) }, busy, S, NOW).level).toBe('ok'); // touching is not a clash
  expect(hintFor({ cal: cal({ buffer_after_min: 10 }), start: at(10, 0), end: at(10, 30) }, busy, S, NOW).level).toBe('contest'); // the buffer
  expect(hintFor({ cal: cal({ conflict_policy: 'overlap' }), start: at(9, 30), end: at(10, 30) }, busy, S, NOW).level).toBe('ok');
  expect(hintFor({ cal: cal(), start: at(10, 30), end: at(11, 0) }, busy, { ...S, pending_holds_slot: true }, NOW).level).toBe('contest');
  expect(hintFor({ cal: cal(), start: at(9, 0), end: at(10, 0), ignoreId: 'a' }, busy, S, NOW).level).toBe('ok'); // itself
});

test('a maintenance window follows the maintenance-overlap mode', () => {
  const busy = [occ('m', iso(13), iso(14), { kind: 'maintenance', title: 'בדיקת מכשירים', calendar_id: 'maint', room_calendar_ids: ['gym'] })];
  expect(hintFor({ cal: cal(), start: at(13, 0), end: at(13, 30) }, busy, S, NOW).level).toBe('contest'); // first_holds: the window holds, the manager decides
  const b = hintFor({ cal: cal(), start: at(13, 0), end: at(13, 30) }, busy, { ...S, maintenance_overlap: 'override_notify' }, NOW);
  expect(b.level).toBe('bad');
  expect(b.reason).toContain('חלון תחזוקה "בדיקת מכשירים"');
  expect(hintFor({ cal: cal({ overlap_override: 'block' }), start: at(13, 0), end: at(13, 30) }, busy, S, NOW).level).toBe('bad'); // the room's own mode
});

test('approval: a request in an approval room, none for its manager; moving an approved booking follows the calendar rule', () => {
  const room = cal({ approval_mode: 'always' });
  const h = hintFor({ cal: room, start: at(11), end: at(12) }, [], S, NOW);
  expect(h.level).toBe('pend');
  expect(h.reason).toBe('באישור דנה לוי');
  expect(hintFor({ cal: { ...room, my_role: 'manage' }, start: at(11), end: at(12) }, [], S, NOW).level).toBe('ok');
  expect(hintFor({ cal: { ...room, my_role: 'manage' }, start: at(11), end: at(12) }, [], { ...S, editors_bypass_approval: false }, NOW).level).toBe('pend');
  expect(hintFor({ cal: cal({ approval_mode: 'on_behalf' }), start: at(11), end: at(12), behalf: 'team' }, [], S, NOW).level).toBe('pend');
  expect(hintFor({ cal: room, start: at(11), end: at(12), moving: 'confirmed' }, [], S, NOW).level).toBe('pend'); // re-approval (default)
  const mgr = hintFor({ cal: { ...room, approved_move: 'managers' }, start: at(11), end: at(12), moving: 'confirmed' }, [], S, NOW);
  expect(mgr.level).toBe('bad');
  expect(mgr.reason).toContain('מנהל החדר');
  // the slot its own change request keeps never blocks it
  const held = [occ('e1', iso(9), iso(10), { held_slot: true })];
  expect(hintFor({ cal: room, start: at(9), end: at(10), ignoreId: 'e1', moving: 'pending' }, held, S, NOW).level).toBe('pend');
  expect(hintFor({ cal: room, start: at(9), end: at(10), ignoreId: 'x' }, held, S, NOW).level).toBe('contest');
});

test('the tag under a dragged entry and the toast after it', () => {
  expect(hintTag({ level: 'ok', reason: null, warn: null, peers: 0, contested: null, approver: null })).toBeNull();
  expect(hintTag({ level: 'pend', reason: 'באישור דנה לוי', warn: null, peers: 0, contested: null, approver: 'דנה לוי' })).toEqual({ cls: 'pend', text: 'באישור דנה לוי' });
  expect(hintTag({ level: 'ok', reason: null, warn: 'ארוך', peers: 0, contested: null, approver: null })).toEqual({ cls: 'warn', text: 'ארוך' });
  expect(movedText('move', 'רקפת', null, at(14), at(15), 'confirmed', false, false)).toBe('הועבר: רקפת · 14:00–15:00');
  expect(movedText('resize', null, null, at(9), at(10, 30), 'pending', true, false)).toBe('האורך עודכן: 09:00–10:30 · ממתין לאישור, המועד הקודם שמור');
  expect(deleteLabel({ state: 'pending', held: { calendar_id: 'gym', start: iso(9), end: iso(10) } })).toBe('משיכת השינוי');
  expect(deleteLabel({ state: 'pending', held: null })).toBe('משיכה');
  expect(deleteLabel({ state: 'confirmed' })).toBe('מחק');
});

// ---------------------------------------------------------------- undo and the popover

test('undo takes the newest action, keeps 40, and forgets an entry', () => {
  const u = new UndoStack();
  for (let i = 0; i < 45; i += 1) u.push({ kind: 'delete', eventId: `e${i}`, rev: 2 });
  expect(u.size).toBe(40);
  expect(u.pop()?.eventId).toBe('e44');
  u.push({ kind: 'move', eventId: 'x', rev: 3, before: { calendarId: 'gym', start: iso(9), end: iso(10) } });
  u.drop('x');
  expect(u.peek()?.eventId).toBe('e43');
});

test('the popover sits beside the selection inside the viewport and grows from it', () => {
  const left = placePopover({ x: 900, y: 300, w: 120, h: 60 }, 360, 420, 1440, 900);
  expect(left.left).toBe(900 - 10 - 360);
  expect(left.origin.startsWith('right')).toBe(true);
  const right = placePopover({ x: 100, y: 300, w: 120, h: 60 }, 360, 420, 1440, 900);
  expect(right.left).toBe(230);
  const centre = placePopover({ x: 20, y: 850, w: 350, h: 40 }, 360, 420, 390, 844);
  expect(centre.origin.startsWith('center')).toBe(true);
  expect(centre.top).toBe(844 - 420 - 8); // kept inside the viewport
});

test('the drawer edits an entry only where the viewer may (bookers their own, managers all, viewers none)', () => {
  const base = { can: { edit: true, cancel: true, approve: false }, state: 'confirmed' as const, kind: 'booking' as const, end: iso(12), source: 'arx' };
  expect(editableInDrawer(base, NOW)).toBe(true);
  expect(editableInDrawer({ ...base, can: { ...base.can, edit: false } }, NOW)).toBe(false);
  expect(editableInDrawer({ ...base, end: iso(8) }, NOW)).toBe(false);
  expect(editableInDrawer({ ...base, kind: 'maintenance' }, NOW)).toBe(false);
  expect(editableInDrawer({ ...base, state: 'cancelled' }, NOW)).toBe(false);
  expect(editableInDrawer({ ...base, source: 'google' }, NOW)).toBe(false);
});
