import { test, expect } from '@playwright/test';
import type { DraftSlot } from '../src/api/schedules';
import {
  addSlot,
  applyTableEdit,
  clock,
  contiguousAfter,
  createSlot,
  dayRows,
  duplicateSlot,
  freeGap,
  freeGaps,
  minutesToPercent,
  moveSlot,
  offsetToMinutes,
  parseTimeInput,
  removeSlot,
  resizeSlot,
  slotCategory,
  snap,
  spanOf,
  splitSlot,
  stopRaw,
  tableRows,
  timeInputText,
  toggleDay,
  tokensOf,
  type OpOptions,
} from '../src/screens/schedule-grid-logic';

// CR-014 S4: the pure geometry of the schedule editor's 24-hour scheme - snapping, slot spans, drag create / resize /
// move, the shared boundary of contiguous slots, sun-anchored edges, the table's typed times and the day rows. Node only.

const SUN = { sunrise: 390, sunset: 1095 }; // 06:30, 18:15
const o = (step = 15, extra: Partial<OpOptions> = {}): OpOptions => ({ step, sun: SUN, ...extra });
const slot = (start: string, stop: string | null, service = 'light.turn_on'): DraftSlot => ({ start, stop, actions: [{ service, entity_id: 'light.a', data: {} }] });

test.describe('snapping and geometry', () => {
  test('snap rounds to the step and stays inside the day', () => {
    expect(snap(487, 15)).toBe(480);
    expect(snap(488, 15)).toBe(495);
    expect(snap(7, 5)).toBe(5);
    expect(snap(14, 30)).toBe(0);
    expect(snap(16, 30)).toBe(30);
    expect(snap(-30, 15)).toBe(0);
    expect(snap(1500, 15)).toBe(1440);
  });

  test('pointer offsets map to minutes and percent', () => {
    expect(offsetToMinutes(250, 1000)).toBe(360);
    expect(offsetToMinutes(-5, 1000)).toBe(0);
    expect(offsetToMinutes(1200, 1000)).toBe(1440);
    expect(offsetToMinutes(10, 0)).toBe(0);
    expect(minutesToPercent(720)).toBe(50);
    expect(clock(450)).toBe('07:30');
    expect(clock(1440)).toBe('24:00');
    expect(stopRaw(1440)).toBe('00:00:00');
    expect(stopRaw(90)).toBe('01:30:00');
  });

  test('a span: fixed, end of day, point action, sun anchored', () => {
    expect(spanOf(slot('07:30:00', '19:00:00'), SUN)).toEqual({ start: 450, end: 1140 });
    expect(spanOf(slot('20:00:00', '00:00:00'), SUN)).toEqual({ start: 1200, end: 1440 });
    expect(spanOf(slot('23:30:00', null), SUN)).toEqual({ start: 1410, end: 1411 });
    expect(spanOf(slot('sunset+00:30:00', '00:00:00'), SUN)).toEqual({ start: 1125, end: 1440 });
    expect(spanOf(slot('nonsense', null), SUN)).toBeNull();
  });

  test('free gaps of the day', () => {
    const spans = [
      { start: 60, end: 120 },
      { start: 300, end: 360 },
    ];
    expect(freeGap(spans, 200)).toEqual({ start: 120, end: 300 });
    expect(freeGap(spans, 90)).toBeNull();
    expect(freeGap(spans, 10)).toEqual({ start: 0, end: 60 });
    expect(freeGaps(spans, 30)).toEqual([
      { start: 0, end: 60 },
      { start: 120, end: 300 },
      { start: 360, end: 1440 },
    ]);
  });
});

test.describe('creating slots by dragging', () => {
  test('a drag on an empty track makes a snapped slot with no actions', () => {
    const r = createSlot([], 483, 571, o())!;
    expect(r.slots).toHaveLength(1);
    expect(r.slots[0]).toEqual({ start: '08:00:00', stop: '09:30:00', actions: [] });
    expect(r.index).toBe(0);
  });

  test('a backwards drag is the same slot; a tiny drag is one step long', () => {
    expect(createSlot([], 570, 480, o())!.slots[0].start).toBe('08:00:00');
    const t = createSlot([], 481, 482, o())!;
    expect(t.slots[0]).toMatchObject({ start: '08:00:00', stop: '08:15:00' });
    const t5 = createSlot([], 481, 482, o(5))!;
    expect(t5.slots[0]).toMatchObject({ start: '08:00:00', stop: '08:05:00' });
  });

  test('a new slot stays inside the free gap; a start inside a slot is refused', () => {
    const base = [slot('09:00:00', '10:00:00')];
    const r = createSlot(base, 480, 660, o())!;
    expect(r.slots.map((s) => s.start)).toEqual(['08:00:00', '09:00:00']);
    expect(r.slots[0].stop).toBe('09:00:00');
    expect(createSlot(base, 550, 640, o())).toBeNull();
    // the raw pointer is in the gap although snapping would land inside the neighbour
    const gapStart = [slot('08:00:00', '09:05:00')];
    const g = createSlot(gapStart, 546, 640, o())!; // 09:06 snaps down to 09:00, inside the neighbour: the gap's own start wins
    expect(g.slots[1].start).toBe('09:05:00');
  });

  test('"+ משבצת" takes an hour in the first free gap, or splits the longest slot when the day is full', () => {
    const r = addSlot([], o())!;
    expect(r.slots[0]).toMatchObject({ start: '08:00:00', stop: '09:00:00' });
    const full = [slot('00:00:00', '06:00:00'), slot('06:00:00', '00:00:00', 'light.turn_off')];
    const s = addSlot(full, o())!;
    expect(s.slots).toHaveLength(3);
    // the longest slot (06:00-24:00) is cut at its midpoint (15:00); the copy keeps the actions
    expect(s.slots[1]).toMatchObject({ start: '06:00:00', stop: '15:00:00' });
    expect(s.slots[2]).toMatchObject({ start: '15:00:00', stop: '00:00:00' });
    expect(s.slots[2].actions[0].service).toBe('light.turn_off');
  });

  test('split, duplicate and remove', () => {
    const one = [slot('08:00:00', '10:00:00')];
    const sp = splitSlot(one, 0, 545, o())!; // 09:05 -> 09:00
    expect(sp.slots.map((s) => [s.start, s.stop])).toEqual([
      ['08:00:00', '09:00:00'],
      ['09:00:00', '10:00:00'],
    ]);
    expect(splitSlot(one, 0, 480, o())).toBeNull();
    const dup = duplicateSlot(one, 0, o())!;
    expect(dup.slots).toHaveLength(2);
    expect(dup.slots[1]).toMatchObject({ start: '10:00:00', stop: '12:00:00' });
    expect(removeSlot(dup.slots, 0)).toHaveLength(1);
  });
});

test.describe('resizing and moving', () => {
  const chain = () => [slot('00:00:00', '06:00:00'), slot('06:00:00', '12:00:00', 'light.turn_off'), slot('12:00:00', '00:00:00')];

  test('the boundary of two contiguous slots moves both edges', () => {
    const r = resizeSlot(chain(), 0, 'end', 427, o()); // 07:07 -> 07:00
    expect(r.slots[0].stop).toBe('07:00:00');
    expect(r.slots[1].start).toBe('07:00:00');
    expect(contiguousAfter(r.slots, 0, SUN)).toBe(1);
    const back = resizeSlot(chain(), 1, 'start', 300, o()); // dragging the start edge of slot 1
    expect(back.slots[0].stop).toBe('05:00:00');
    expect(back.slots[1].start).toBe('05:00:00');
  });

  test('Alt (detach) drags one edge alone and cannot cross the neighbour', () => {
    const r = resizeSlot(chain(), 0, 'end', 300, o(15, { detach: true }));
    expect(r.slots[0].stop).toBe('05:00:00');
    expect(r.slots[1].start).toBe('06:00:00'); // a gap opened between them
    const cross = resizeSlot(chain(), 0, 'end', 500, o(15, { detach: true }));
    expect(cross.slots[0].stop).toBe('06:00:00'); // held at the neighbour's start
  });

  test('a shared boundary cannot swallow the neighbour: it keeps one step', () => {
    const r = resizeSlot(chain(), 0, 'end', 1000, o());
    expect(r.slots[0].stop).toBe('11:45:00');
    expect(r.slots[1].start).toBe('11:45:00');
    expect(r.slots[1].stop).toBe('12:00:00');
  });

  test('a slot keeps at least one step; the end can reach the end of the day', () => {
    const one = [slot('08:00:00', '09:00:00')];
    expect(resizeSlot(one, 0, 'end', 480, o()).slots[0].stop).toBe('08:15:00');
    expect(resizeSlot(one, 0, 'start', 900, o()).slots[0].start).toBe('08:45:00');
    expect(resizeSlot(one, 0, 'end', 5000, o()).slots[0].stop).toBe('00:00:00');
    expect(resizeSlot(one, 0, 'start', -20, o()).slots[0].start).toBe('00:00:00');
  });

  test('a point action gets a stop when its end is dragged', () => {
    const p = [slot('23:30:00', null)];
    const r = resizeSlot(p, 0, 'end', 1440, o());
    expect(r.slots[0].stop).toBe('00:00:00');
  });

  test('a sun-anchored edge keeps its anchor and changes its offset', () => {
    const s = [slot('sunset+00:00:00', '00:00:00')];
    expect(resizeSlot(s, 0, 'start', 1125, o()).slots[0].start).toBe('sunset+00:30:00');
    // earlier than the sun: stays on the marker unless negative offsets are supported (P0-7)
    expect(resizeSlot(s, 0, 'start', 1000, o()).slots[0].start).toBe('sunset+00:00:00');
    expect(resizeSlot(s, 0, 'start', 1000, o(15, { allowNegativeSun: true })).slots[0].start).toBe('sunset-01:30:00');
  });

  test('moving shifts the slot by a snapped delta and stops at the neighbours', () => {
    const two = [slot('08:00:00', '09:00:00'), slot('12:00:00', '13:00:00')];
    const m = moveSlot(two, 0, 47, o());
    expect(m.slots[0]).toMatchObject({ start: '08:45:00', stop: '09:45:00' });
    const blocked = moveSlot(two, 0, 400, o());
    expect(blocked.slots[0]).toMatchObject({ start: '11:00:00', stop: '12:00:00' });
    const early = moveSlot(two, 0, -900, o());
    expect(early.slots[0].start).toBe('00:00:00');
    // order is kept by start time and the index follows the slot
    const swap = moveSlot([slot('08:00:00', '09:00:00')], 0, 0, o());
    expect(swap.index).toBe(0);
  });

  test('moving a sun-anchored slot shifts its offset', () => {
    const s = [slot('sunset+00:00:00', '23:00:00')];
    const m = moveSlot(s, 0, 30, o());
    expect(m.slots[0].start).toBe('sunset+00:30:00');
    expect(m.slots[0].stop).toBe('23:30:00');
  });
});

test.describe('typed times (the table)', () => {
  test('fixed times', () => {
    expect(parseTimeInput('7:30')).toEqual({ raw: '07:30:00' });
    expect(parseTimeInput('07:30')).toEqual({ raw: '07:30:00' });
    expect(parseTimeInput('0730')).toEqual({ raw: '07:30:00' });
    expect(parseTimeInput('18')).toEqual({ raw: '18:00:00' });
    expect(parseTimeInput('24:00')).toEqual({ error: 'range' });
    expect(parseTimeInput('24:00', { end: true })).toEqual({ raw: '00:00:00' });
    expect(parseTimeInput('25:00')).toEqual({ error: 'range' });
    expect(parseTimeInput('abc')).toEqual({ error: 'format' });
    expect(parseTimeInput('  ')).toEqual({ error: 'empty' });
  });

  test('sun times with an offset', () => {
    expect(parseTimeInput('שקיעה')).toEqual({ raw: 'sunset+00:00:00' });
    expect(parseTimeInput('שקיעה+30')).toEqual({ raw: 'sunset+00:30:00' });
    expect(parseTimeInput('שקיעה +00:40')).toEqual({ raw: 'sunset+00:40:00' });
    expect(parseTimeInput('זריחה+1:00')).toEqual({ raw: 'sunrise+01:00:00' });
    expect(parseTimeInput('sunset+0:40')).toEqual({ raw: 'sunset+00:40:00' });
    expect(parseTimeInput('שקיעה-15')).toEqual({ error: 'negative_sun' });
    expect(parseTimeInput('שקיעה-15', { allowNegative: true })).toEqual({ raw: 'sunset-00:15:00' });
    expect(parseTimeInput('שקיעה−15', { allowNegative: true })).toEqual({ raw: 'sunset-00:15:00' });
  });

  test('the text of a stored time', () => {
    expect(timeInputText('07:30:00')).toBe('07:30');
    expect(timeInputText('00:00:00', true)).toBe('24:00');
    expect(timeInputText('sunset+00:30:00')).toBe('שקיעה+00:30');
    expect(timeInputText('sunrise+00:00:00')).toBe('זריחה');
    expect(timeInputText(null, true)).toBe('');
  });

  test('graph and table are one model: rows follow the start order and edits go through the same rules', () => {
    const slots = [slot('18:00:00', '00:00:00', 'light.turn_off'), slot('07:00:00', '18:00:00')];
    const rows = tableRows(slots, SUN);
    expect(rows.map((r) => [r.index, r.from, r.to])).toEqual([
      [1, '07:00', '18:00'],
      [0, '18:00', '24:00'],
    ]);
    const ok = applyTableEdit(slots, 1, 'to', '17:30', o());
    expect('slots' in ok && ok.slots.map((s) => [s.start, s.stop])).toEqual([
      ['07:00:00', '17:30:00'],
      ['18:00:00', '00:00:00'],
    ]);
    const sun = applyTableEdit(slots, 0, 'from', 'שקיעה+30', o());
    expect('slots' in sun && sun.slots.find((s) => s.start.startsWith('sunset'))!.start).toBe('sunset+00:30:00');
    expect(applyTableEdit(slots, 1, 'to', '19:00', o())).toEqual({ error: 'המשבצת חופפת למשבצת אחרת.' });
    expect(applyTableEdit(slots, 1, 'to', '06:00', o())).toEqual({ error: 'שעת הסיום חייבת להיות אחרי שעת ההתחלה.' });
    expect(applyTableEdit(slots, 1, 'from', '19:00', o())).toEqual({ error: 'שעת ההתחלה חייבת להיות לפני שעת הסיום.' });
    expect(applyTableEdit(slots, 1, 'from', '7:99', o())).toEqual({ error: 'שעה מחוץ לטווח.' });
    const point = applyTableEdit(slots, 1, 'to', '', o());
    expect('slots' in point && point.slots.find((s) => s.start === '07:00:00')!.stop).toBeNull();
  });
});

test.describe('days and colours', () => {
  test('the seven rows follow the schedule days (Sunday first); workday / weekend cannot be resolved', () => {
    const rows = dayRows(['sun', 'mon', 'tue', 'wed', 'thu'])!;
    expect(rows.map((r) => r.day)).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    expect(rows.filter((r) => r.active)).toHaveLength(5);
    expect(rows[0].linked).toBe(5);
    expect(dayRows(['daily'])!.every((r) => r.active)).toBe(true);
    expect(dayRows(['workday'])).toBeNull();
  });

  test('toggling a day keeps the order, never empties, and folds seven days into daily', () => {
    expect(toggleDay(['daily'], 'fri')).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'sat']);
    expect(toggleDay(['sun', 'mon', 'tue', 'wed', 'thu'], 'sat')).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'sat']);
    expect(toggleDay(['sun', 'mon', 'tue', 'wed', 'thu', 'fri'], 'sat')).toEqual(['daily']);
    expect(toggleDay(['tue'], 'tue')).toEqual(['tue']);
    expect(toggleDay(['workday'], 'mon')).toEqual(['mon']);
    expect(tokensOf(['sat', 'sun'])).toEqual(['sun', 'sat']);
    expect(tokensOf(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'])).toEqual(['daily']);
  });

  test('colour category by what the slot does (with the class of the device)', () => {
    const cls = (id: string | null) => (id === 'alarm_control_panel.house' ? 'alarm' : null);
    const s = (service: string, data: Record<string, unknown> = {}, entity = 'x.y'): DraftSlot => ({ start: '08:00:00', stop: null, actions: [{ service, entity_id: entity, data }] });
    expect(slotCategory(s('light.turn_on'), cls)).toBe('on');
    expect(slotCategory(s('light.turn_on', { brightness: 204 }), cls)).toBe('level');
    expect(slotCategory(s('light.turn_off'), cls)).toBe('off');
    expect(slotCategory(s('climate.set_temperature', { temperature: 23 }), cls)).toBe('climate');
    expect(slotCategory(s('climate.turn_off'), cls)).toBe('off');
    expect(slotCategory(s('cover.set_cover_position', { position: 10 }), cls)).toBe('cover');
    expect(slotCategory(s('alarm_control_panel.alarm_arm_home', {}, 'alarm_control_panel.house'), cls)).toBe('secure');
    expect(slotCategory(s('lock.lock'), cls)).toBe('secure');
    expect(slotCategory({ start: '08:00:00', stop: null, actions: [] }, cls)).toBe('empty');
    expect(slotCategory(s('script.x'), cls)).toBe('custom');
  });
});
