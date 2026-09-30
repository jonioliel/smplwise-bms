/**
 * CR-014 S4: the pure geometry and slot operations of the schedule editor's 24-hour scheme (no DOM, no Lit, so the unit
 * specs run in Node). Everything works on the contract's stored strings (`DraftSlot`: "HH:MM:SS" / "sunset+HH:MM:SS",
 * a stop of "00:00:00" = end of day, a null stop = a point action) and on minutes from midnight.
 *
 * Rules the operations keep (docs/architecture/SCHEDULER_API.md §2, §5.7):
 *  - slots of one schedule never overlap (half-open intervals; contiguous slots, stop == next start, are the normal case
 *    of a real installation);
 *  - an edge that is anchored to the sun keeps its anchor: a drag changes its offset, never silently makes it fixed;
 *    negative offsets are only written once the server says so (`allowNegativeSun`, capability `negative_sun_offset`);
 *  - a drag of a boundary shared by two contiguous slots moves both edges (they were one boundary), unless detached.
 */
import {
  draftSlotSpan,
  minutesToRaw,
  parseTime,
  timeMinutes,
  timeToRaw,
  SUN_FALLBACK,
  type DayId,
  type DayToken,
  type DraftSlot,
  type SunTimes,
} from '../api/schedules';
import { DAY_ORDER, resolveDays } from '../api/schedules';

export const DAY_MIN = 1440;
export const SNAP_CHOICES = [5, 15, 30] as const;

export interface Span {
  start: number;
  end: number;
}

export interface OpOptions {
  /** Snap step in minutes (5 / 15 / 30). */
  step: number;
  sun: SunTimes | null;
  /** Negative sun offsets may be written (capability `negative_sun_offset`, P0-7). */
  allowNegativeSun?: boolean;
  /** Alt held: a shared boundary of two contiguous slots is dragged alone (the neighbour stays). */
  detach?: boolean;
}

export interface OpResult<S extends DraftSlot> {
  slots: S[];
  /** The index of the slot the operation was about, after re-sorting. */
  index: number;
}

// ------------------------------------------------------------------------------------------------ snapping and geometry

/** Snap to the step, within the day. */
export function snap(minutes: number, step: number): number {
  const s = Math.max(1, step);
  return Math.min(DAY_MIN, Math.max(0, Math.round(minutes / s) * s));
}

/** A pointer offset inside a track of `size` pixels → minutes (not snapped), clamped to the day. */
export function offsetToMinutes(offset: number, size: number): number {
  if (size <= 0) return 0;
  return Math.min(DAY_MIN, Math.max(0, (offset / size) * DAY_MIN));
}

/** Minutes → percent of the track (0..100). */
export function minutesToPercent(minutes: number): number {
  return (Math.min(DAY_MIN, Math.max(0, minutes)) / DAY_MIN) * 100;
}

/** "07:30"; 1440 → "24:00" (end of day). */
export function clock(minutes: number): string {
  const m = Math.min(DAY_MIN, Math.max(0, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** The stored form of a slot's stop for `minutes` (end of day is the component's "00:00:00"). */
export function stopRaw(minutes: number): string {
  return minutes >= DAY_MIN ? '00:00:00' : minutesToRaw(minutes);
}

/** A slot's span in minutes (a point action occupies one minute; a stop at or before the start = end of day). */
export function spanOf(slot: DraftSlot, sun: SunTimes | null): Span | null {
  return draftSlotSpan(slot, sun);
}

/** The slots' spans, index-aligned (null for a slot whose times do not parse). */
export function spansOf(slots: DraftSlot[], sun: SunTimes | null): (Span | null)[] {
  return slots.map((s) => spanOf(s, sun));
}

/** Indexes of `slots` in start order (unparseable ones last, stable). */
export function orderOf(slots: DraftSlot[], sun: SunTimes | null): number[] {
  const spans = spansOf(slots, sun);
  return slots
    .map((_, i) => i)
    .sort((a, b) => (spans[a]?.start ?? 1e6) - (spans[b]?.start ?? 1e6) || a - b);
}

/** Sort by start (stable); returns the slots and where the old index `keep` went. */
export function sorted<S extends DraftSlot>(slots: S[], sun: SunTimes | null, keep = -1): OpResult<S> {
  const order = orderOf(slots, sun);
  return { slots: order.map((i) => slots[i]), index: keep < 0 ? -1 : order.indexOf(keep) };
}

/** The sun's minute for an anchor (today's value; the fallback when unknown). */
export function sunMinute(event: 'sunrise' | 'sunset', sun: SunTimes | null): number {
  return (sun ?? SUN_FALLBACK)[event];
}

/**
 * The same anchor at a new minute: a fixed time becomes "HH:MM:00"; a sun-anchored time keeps its event and gets the
 * offset that lands on `minute` (never below zero unless `allowNegative`). `end: true` writes 24:00 as "00:00:00".
 */
export function retime(raw: string, minute: number, sun: SunTimes | null, allowNegative = false, end = false): string {
  const spec = parseTime(raw);
  if (spec && spec.kind === 'sun') {
    let offset = Math.round(minute) - sunMinute(spec.event, sun);
    if (offset < 0 && !allowNegative) offset = 0;
    return timeToRaw({ kind: 'sun', event: spec.event, offset_min: offset });
  }
  return end ? stopRaw(minute) : minutesToRaw(Math.min(1439, Math.max(0, Math.round(minute))));
}

/** True when the time string is anchored to the sun. */
export function isSun(raw: string | null): boolean {
  const spec = parseTime(raw);
  return !!spec && spec.kind === 'sun';
}

// ------------------------------------------------------------------------------------------------ the free space

/** The maximal free interval around `at` (minutes), given the other slots' spans; null when `at` is inside a slot. */
export function freeGap(spans: (Span | null)[], at: number, ignore = -1): Span | null {
  let lo = 0;
  let hi = DAY_MIN;
  for (let i = 0; i < spans.length; i++) {
    const s = spans[i];
    if (!s || i === ignore) continue;
    if (at >= s.start && at < s.end) return null;
    if (s.end <= at) lo = Math.max(lo, s.end);
    if (s.start > at) hi = Math.min(hi, s.start);
  }
  return { start: lo, end: hi };
}

/** All free intervals of the day (minutes), in order, at least `minLen` long. */
export function freeGaps(spans: (Span | null)[], minLen = 1): Span[] {
  const used = spans.filter((s): s is Span => !!s).sort((a, b) => a.start - b.start);
  const out: Span[] = [];
  let cur = 0;
  for (const s of used) {
    if (s.start - cur >= minLen) out.push({ start: cur, end: s.start });
    cur = Math.max(cur, s.end);
  }
  if (DAY_MIN - cur >= minLen) out.push({ start: cur, end: DAY_MIN });
  return out;
}

// ------------------------------------------------------------------------------------------------ operations

const blank = (start: number, end: number, stopIsEnd = true): DraftSlot => ({
  start: minutesToRaw(start),
  stop: stopIsEnd ? stopRaw(end) : null,
  actions: [],
});

/**
 * Create a slot between two minutes (a drag on an empty track). The span is snapped, kept inside the free gap that holds
 * its start, and at least one step long; null when the start lies inside an existing slot.
 */
export function createSlot<S extends DraftSlot>(slots: S[], from: number, to: number, o: OpOptions, make: (s: DraftSlot) => S = (s) => s as S): OpResult<S> | null {
  const span = clampCreate(spansOf(slots, o.sun), from, to, o.step);
  if (!span) return null;
  const made = make(blank(span.start, span.end));
  const r = sorted([...slots, made], o.sun, slots.length);
  return { slots: r.slots, index: r.index };
}

/** A default new slot (the "+ משבצת" button): one hour in the first free gap from `preferred`, else half of the longest slot. */
export function addSlot<S extends DraftSlot>(slots: S[], o: OpOptions, preferred = 8 * 60, make: (s: DraftSlot) => S = (s) => s as S): OpResult<S> | null {
  const spans = spansOf(slots, o.sun);
  const gaps = freeGaps(spans, o.step);
  if (gaps.length) {
    const g = gaps.find((x) => x.end > preferred) ?? gaps[0];
    const a = snap(Math.max(g.start, Math.min(preferred, g.end - o.step)), o.step);
    const start = Math.min(Math.max(a, g.start), g.end - o.step);
    const end = Math.min(g.end, start + 60);
    return createSlot(slots, start, end, o, make);
  }
  // no free minute: split the longest slot at its midpoint (the card's rule)
  let best = -1;
  let len = 0;
  spans.forEach((s, i) => {
    if (s && s.end - s.start > len) {
      len = s.end - s.start;
      best = i;
    }
  });
  if (best < 0 || len < o.step * 2) return null;
  const s = spans[best]!;
  return splitSlot(slots, best, snap((s.start + s.end) / 2, o.step), o, make);
}

/** Split slot `i` at `at`: the first keeps [start, at), the second [at, stop) with the same actions. */
export function splitSlot<S extends DraftSlot>(slots: S[], i: number, at: number, o: OpOptions, make: (s: DraftSlot) => S = (s) => s as S): OpResult<S> | null {
  const s = slots[i];
  const span = s ? spanOf(s, o.sun) : null;
  if (!s || !span || !s.stop) return null;
  const m = snap(at, o.step);
  if (m <= span.start || m >= span.end) return null;
  const first: S = { ...s, stop: retime(s.start, m, o.sun, o.allowNegativeSun, true) };
  const second: S = make({ start: retime(s.start, m, o.sun, o.allowNegativeSun), stop: s.stop, actions: s.actions.map((a) => ({ ...a, data: { ...a.data } })) });
  const next = slots.slice();
  next.splice(i, 1, first, second);
  const r = sorted(next, o.sun, i + 1);
  return { slots: r.slots, index: r.index };
}

/** Remove slot `i`. */
export function removeSlot<S extends DraftSlot>(slots: S[], i: number): S[] {
  return slots.filter((_, k) => k !== i);
}

/** A copy of slot `i` in the next free gap of the same length (or right after it); null when there is no room. */
export function duplicateSlot<S extends DraftSlot>(slots: S[], i: number, o: OpOptions, make: (s: DraftSlot) => S = (s) => s as S): OpResult<S> | null {
  const s = slots[i];
  const span = s ? spanOf(s, o.sun) : null;
  if (!s || !span) return null;
  const len = Math.max(o.step, span.end - span.start);
  const gap = freeGaps(spansOf(slots, o.sun), o.step).find((g) => g.end - g.start >= len && g.start >= span.end) ?? freeGaps(spansOf(slots, o.sun), o.step).find((g) => g.end - g.start >= len);
  if (!gap) return null;
  const copy = make({ start: minutesToRaw(gap.start), stop: s.stop ? stopRaw(gap.start + len) : null, actions: s.actions.map((a) => ({ ...a, data: { ...a.data } })) });
  const r = sorted([...slots, copy], o.sun, slots.length);
  return { slots: r.slots, index: r.index };
}

/** Index of the slot whose stop is exactly this slot's start (contiguous predecessor). */
export function contiguousBefore(slots: DraftSlot[], i: number, sun: SunTimes | null): number {
  return linkedNeighbour(spansOf(slots, sun), slots.map((s) => s.stop == null), i, 'start');
}

/** Index of the slot whose start is exactly this slot's stop (contiguous successor). */
export function contiguousAfter(slots: DraftSlot[], i: number, sun: SunTimes | null): number {
  return linkedNeighbour(spansOf(slots, sun), slots.map((s) => s.stop == null), i, 'end');
}

// ---- span-only helpers: the grid draws its drag preview with the very functions the operations below apply ----

/**
 * The slot that shares `edge` of slot `i`: for the end edge the one starting exactly there, for the start edge the one
 * ending exactly there. Point actions (`points[k]`) never share a boundary. -1 when there is none.
 */
export function linkedNeighbour(spans: (Span | null)[], points: boolean[], i: number, edge: 'start' | 'end'): number {
  const s = spans[i];
  if (!s || points[i]) return -1;
  for (let k = 0; k < spans.length; k++) {
    const o = spans[k];
    if (k === i || !o) continue;
    if (edge === 'end' && o.start === s.end) return k;
    if (edge === 'start' && !points[k] && o.end === s.start) return k;
  }
  return -1;
}

/**
 * Where an edge lands when dragged to `minute`: snapped, at least one step from the other edge, never across a
 * neighbour; a shared boundary may push into the neighbour down to one step from its far edge (unless `detach`).
 */
export function clampEdge(spans: (Span | null)[], points: boolean[], i: number, edge: 'start' | 'end', minute: number, step: number, detach = false): number {
  const span = spans[i];
  if (!span) return minute;
  const target = snap(minute, step);
  const link = detach ? -1 : linkedNeighbour(spans, points, i, edge);
  if (edge === 'end') {
    let hi = DAY_MIN;
    for (let k = 0; k < spans.length; k++) {
      const os = spans[k];
      if (k === i || !os || k === link) continue;
      if (os.start >= span.end) hi = Math.min(hi, os.start);
    }
    if (link >= 0) hi = Math.min(hi, spans[link]!.end - step);
    const m = Math.min(Math.max(target, span.start + step), hi);
    return m <= span.start ? Math.min(span.start + step, DAY_MIN) : m;
  }
  let lo = 0;
  for (let k = 0; k < spans.length; k++) {
    const os = spans[k];
    if (k === i || !os || k === link) continue;
    if (os.end <= span.start) lo = Math.max(lo, os.end);
  }
  if (link >= 0) lo = Math.max(lo, spans[link]!.start + step);
  const maxStart = span.end - (points[i] ? 0 : step);
  const m = Math.max(Math.min(target, maxStart), lo);
  return m >= DAY_MIN ? DAY_MIN - step : m;
}

/** Where slot `i` starts after being dragged by `delta` minutes: snapped, held between its neighbours. */
export function clampMoveStart(spans: (Span | null)[], i: number, delta: number, step: number): number {
  const span = spans[i];
  if (!span) return 0;
  let lo = 0;
  let hi = DAY_MIN;
  spans.forEach((os, k) => {
    if (k === i || !os) return;
    if (os.end <= span.start) lo = Math.max(lo, os.end);
    if (os.start >= span.end) hi = Math.min(hi, os.start);
  });
  const len = span.end - span.start;
  return Math.min(Math.max(snap(span.start + delta, step), lo), Math.max(lo, hi - len));
}

/** The span a new drag from `from` to `to` would create (snapped, inside the free gap that holds its start), or null. */
export function clampCreate(spans: (Span | null)[], from: number, to: number, step: number): Span | null {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  // the free gap is found from the raw pointer position, so snapping down never lands inside the previous slot
  const gap = freeGap(spans, Math.min(Math.floor(lo), DAY_MIN - 1));
  if (!gap) return null;
  let a = Math.min(Math.max(snap(lo, step), gap.start), gap.end - 1);
  let b = Math.min(snap(hi, step), gap.end);
  if (b - a < step) {
    b = Math.min(gap.end, a + step);
    if (b - a < step) a = Math.max(gap.start, b - step);
  }
  return b > a ? { start: a, end: b } : null;
}

/**
 * Drag one edge of slot `i` to `minute`. The result is snapped and clamped: a slot keeps at least one step, never
 * crosses its neighbours, and a shared boundary moves the neighbour's adjacent edge with it (unless `detach`).
 */
export function resizeSlot<S extends DraftSlot>(slots: S[], i: number, edge: 'start' | 'end', minute: number, o: OpOptions): OpResult<S> {
  const s = slots[i];
  const span = s ? spanOf(s, o.sun) : null;
  if (!s || !span) return { slots, index: i };
  const spans = spansOf(slots, o.sun);
  const points = slots.map((x) => x.stop == null);
  const m = clampEdge(spans, points, i, edge, minute, o.step, o.detach);
  const link = o.detach ? -1 : linkedNeighbour(spans, points, i, edge);
  const next = slots.slice();
  if (edge === 'end') {
    next[i] = { ...s, stop: s.stop == null ? stopRaw(m) : retime(s.stop, m, o.sun, o.allowNegativeSun, true) };
    if (link >= 0) next[link] = { ...slots[link], start: retime(slots[link].start, m, o.sun, o.allowNegativeSun) };
  } else {
    next[i] = { ...s, start: retime(s.start, m, o.sun, o.allowNegativeSun) };
    if (link >= 0) next[link] = { ...slots[link], stop: retime(slots[link].stop ?? slots[link].start, m, o.sun, o.allowNegativeSun, true) };
  }
  const r = sorted(next, o.sun, i);
  return { slots: r.slots, index: r.index };
}

/** Drag the whole slot by `delta` minutes (snapped); clamped between the neighbours. A point action moves as one minute. */
export function moveSlot<S extends DraftSlot>(slots: S[], i: number, delta: number, o: OpOptions): OpResult<S> {
  const s = slots[i];
  const span = s ? spanOf(s, o.sun) : null;
  if (!s || !span) return { slots, index: i };
  const start = clampMoveStart(spansOf(slots, o.sun), i, delta, o.step);
  if (start === span.start) return { slots, index: i };
  const shift = start - span.start;
  const len = span.end - span.start;
  const next = slots.slice();
  next[i] = {
    ...s,
    start: retime(s.start, timeMinutes(parseTime(s.start)!, o.sun) + shift, o.sun, o.allowNegativeSun),
    stop: s.stop ? retime(s.stop, start + len, o.sun, o.allowNegativeSun, true) : null,
  };
  const r = sorted(next, o.sun, i);
  return { slots: r.slots, index: r.index };
}

/** True when the two slots' spans overlap (half-open). */
export function overlaps(a: Span, b: Span): boolean {
  return a.start < b.end && b.start < a.end;
}

// ------------------------------------------------------------------------------------------------ text input of a time

export type TimeInput = { raw: string } | { error: 'empty' | 'format' | 'range' | 'negative_sun' };

/**
 * Parse what a person types into a time cell: "7:30", "07:30", "0730", "18", "שקיעה", "שקיעה+30", "שקיעה +00:30",
 * "זריחה-15", "sunset+0:40". Returns the stored string, or the reason it was refused. `end: true` also accepts "24:00"
 * (end of day, stored as "00:00:00"). A minus offset needs `allowNegative`.
 */
export function parseTimeInput(text: string, opts: { end?: boolean; allowNegative?: boolean } = {}): TimeInput {
  const t = text.trim().replace(/−|–|־/g, '-').replace(/\s+/g, ' ');
  if (!t) return { error: 'empty' };
  const sun = /^(שקיעה|זריחה|sunset|sunrise)\s*(?:([+-])\s*(\d{1,2})(?::?(\d{2}))?)?$/i.exec(t);
  if (sun) {
    const event = /שקיעה|sunset/i.test(sun[1]) ? 'sunset' : 'sunrise';
    let minutes = 0;
    if (sun[3] !== undefined) {
      // "+30" = minutes; "+0:30" / "+00:30" / "+1:00" = h:mm; "+100" is read as h:mm too
      minutes = sun[4] !== undefined ? Number(sun[3]) * 60 + Number(sun[4]) : Number(sun[3]);
    }
    if (minutes > 12 * 60) return { error: 'range' };
    if (sun[2] === '-' && minutes > 0 && !opts.allowNegative) return { error: 'negative_sun' };
    return { raw: timeToRaw({ kind: 'sun', event, offset_min: sun[2] === '-' ? -minutes : minutes }) };
  }
  let m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(t);
  let h: number;
  let min: number;
  if (m) {
    h = Number(m[1]);
    min = Number(m[2]);
  } else if ((m = /^(\d{2})(\d{2})$/.exec(t))) {
    h = Number(m[1]);
    min = Number(m[2]);
  } else if ((m = /^(\d{1,2})$/.exec(t))) {
    h = Number(m[1]);
    min = 0;
  } else return { error: 'format' };
  if (h === 24 && min === 0 && opts.end) return { raw: '00:00:00' };
  if (h > 23 || min > 59) return { error: 'range' };
  return { raw: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:00` };
}

export const TIME_INPUT_ERROR: Record<'empty' | 'format' | 'range' | 'negative_sun', string> = {
  empty: 'נא למלא שעה.',
  format: 'שעה כמו 07:30, או "שקיעה+30".',
  range: 'שעה מחוץ לטווח.',
  negative_sun: 'הקדמה לפני זריחה או שקיעה עדיין אינה נתמכת.',
};

/** The text a time cell shows for editing: "07:30", "שקיעה+00:30", "שקיעה" (offset 0), empty for none. */
export function timeInputText(raw: string | null, end = false): string {
  if (raw == null) return '';
  const spec = parseTime(raw);
  if (!spec) return raw;
  if (spec.kind === 'fixed') return end && spec.time === '00:00' ? '24:00' : spec.time;
  const word = spec.event === 'sunrise' ? 'זריחה' : 'שקיעה';
  if (!spec.offset_min) return word;
  const a = Math.abs(spec.offset_min);
  return `${word}${spec.offset_min < 0 ? '-' : '+'}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------------------------------------------ table view

export interface TableRow {
  index: number;
  from: string;
  to: string;
  start: Span['start'] | null;
  end: Span['end'] | null;
  /** The stored strings, for the anchors' kind. */
  fromSun: boolean;
  toSun: boolean;
  point: boolean;
  /** Index of this row's "כיבוי בסיום" companion, or the slot it is the companion of. */
  pairedWith: number | null;
}

/** The table rows of a schedule's slots, in start order - the same data as the graph. */
export function tableRows(slots: DraftSlot[], sun: SunTimes | null, pairOf: (i: number) => number | null = () => null): TableRow[] {
  return orderOf(slots, sun).map((index) => {
    const s = slots[index];
    const span = spanOf(s, sun);
    return {
      index,
      from: timeInputText(s.start),
      to: s.stop == null ? '' : timeInputText(s.stop, true),
      start: span?.start ?? null,
      end: span && s.stop ? span.end : null,
      fromSun: isSun(s.start),
      toSun: isSun(s.stop),
      point: s.stop == null,
      pairedWith: pairOf(index),
    };
  });
}

export type TableField = 'from' | 'to';

/**
 * Apply a typed time to the table's cell. The graph and the table are one model: this returns the new slots, or the
 * reason the text was refused (the caller shows it under the cell). An empty "to" makes the slot a point action.
 * A start that would sit at or after its stop, or an overlap with another slot, is refused too.
 */
export function applyTableEdit<S extends DraftSlot>(slots: S[], index: number, field: TableField, text: string, o: OpOptions): { slots: S[]; index: number } | { error: string } {
  const s = slots[index];
  if (!s) return { error: 'המשבצת לא נמצאה.' };
  let nextSlot: S;
  if (field === 'to' && !text.trim()) {
    nextSlot = { ...s, stop: null };
  } else {
    const parsed = parseTimeInput(text, { end: field === 'to', allowNegative: o.allowNegativeSun });
    if ('error' in parsed) return { error: TIME_INPUT_ERROR[parsed.error] };
    nextSlot = field === 'from' ? { ...s, start: parsed.raw } : { ...s, stop: parsed.raw };
  }
  const span = spanOf(nextSlot, o.sun);
  if (!span) return { error: TIME_INPUT_ERROR.format };
  if (nextSlot.stop && field === 'to') {
    const startM = timeMinutes(parseTime(nextSlot.start)!, o.sun);
    const stopSpec = parseTime(nextSlot.stop)!;
    const stopM = timeMinutes(stopSpec, o.sun);
    const isEnd = nextSlot.stop === '00:00:00';
    if (!isEnd && stopM <= startM) return { error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.' };
  }
  if (nextSlot.stop && field === 'from') {
    const startM = timeMinutes(parseTime(nextSlot.start)!, o.sun);
    const stopM = timeMinutes(parseTime(nextSlot.stop)!, o.sun);
    if (nextSlot.stop !== '00:00:00' && stopM <= startM) return { error: 'שעת ההתחלה חייבת להיות לפני שעת הסיום.' };
  }
  const spans = spansOf(slots, o.sun);
  for (let k = 0; k < spans.length; k++) {
    const os = spans[k];
    if (k !== index && os && overlaps(span, os)) return { error: 'המשבצת חופפת למשבצת אחרת.' };
  }
  const next = slots.slice();
  next[index] = nextSlot;
  const r = sorted(next, o.sun, index);
  return { slots: r.slots, index: r.index };
}

// ------------------------------------------------------------------------------------------------ days and rows

export interface DayRow {
  day: DayId;
  /** The day belongs to the schedule. */
  active: boolean;
  /** How many days share this row's slots (linked): the schedule's day count, or 1 for a split group. */
  linked: number;
}

/**
 * The week grid's seven rows for a schedule's day tokens (Sunday first). `workday` / `weekend` cannot be resolved to
 * days (P0-1): they give no rows; the caller shows one combined row.
 */
export function dayRows(tokens: DayToken[]): DayRow[] | null {
  const days = resolveDays(tokens);
  if (!days) return null;
  return DAY_ORDER.map((day) => ({ day, active: days.includes(day), linked: days.length }));
}

/** Toggle one day of a schedule's tokens; never empties the set; `workday` / `weekend` give way to explicit days. */
export function toggleDay(tokens: DayToken[], day: DayId): DayToken[] {
  const cur = resolveDays(tokens);
  if (!cur) return [day];
  const has = cur.includes(day);
  const next = has ? cur.filter((d) => d !== day) : DAY_ORDER.filter((d) => d === day || cur.includes(d));
  if (!next.length) return tokens;
  return next.length === 7 ? ['daily'] : next;
}

/** Explicit day tokens for a set of days (all seven = "daily"). */
export function tokensOf(days: DayId[]): DayToken[] {
  const set = DAY_ORDER.filter((d) => days.includes(d));
  return set.length === 7 ? ['daily'] : set;
}

/** The colour class of a slot's bar by what it does (always shown with an icon and text as well). */
export type SlotCategory = 'on' | 'off' | 'level' | 'climate' | 'cover' | 'secure' | 'custom' | 'empty';

export function slotCategory(slot: DraftSlot, classOf: (entityId: string | null) => string | null): SlotCategory {
  const a = slot.actions[0];
  if (!a) return 'empty';
  for (const x of slot.actions) {
    const c = classOf(x.entity_id);
    if (c === 'alarm' || c === 'lock' || c === 'door' || x.service.startsWith('alarm_control_panel.') || x.service.startsWith('lock.')) return 'secure';
  }
  const dom = a.service.split('.')[0];
  if (dom === 'climate') return a.service === 'climate.turn_off' ? 'off' : 'climate';
  if (dom === 'cover') return 'cover';
  if (a.service.endsWith('.turn_off')) return 'off';
  if (dom === 'light' && (typeof a.data.brightness === 'number' || typeof a.data.brightness_pct === 'number')) return 'level';
  if (dom === 'fan' && (typeof a.data.percentage === 'number' || a.service === 'fan.set_percentage')) return 'level';
  if (a.service.endsWith('.turn_on')) return 'on';
  return 'custom';
}

export const CATEGORY_LABEL: Record<SlotCategory, string> = {
  on: 'הדלקה',
  off: 'כיבוי',
  level: 'עוצמה',
  climate: 'מזגן',
  cover: 'תריס',
  secure: 'אבטחה',
  custom: 'אחר',
  empty: 'ללא פעולה',
};

/** Only the sun's markers a grid draws: null when both are the fallback (still drawn, as an estimate). */
export function sunMarks(sun: SunTimes | null): { rise: number; set: number } {
  const s = sun ?? SUN_FALLBACK;
  return { rise: s.sunrise, set: s.sunset };
}
