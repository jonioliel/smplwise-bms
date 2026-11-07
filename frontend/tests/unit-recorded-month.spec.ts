import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canGoNext, dayLabel, daysInMonth, gridRows, monthGrid, monthOf, monthTitle, shiftMonth, summaryText, weekdayOf, type MonthCell } from '../src/components/recorded-month-logic';

// RECORDED-DAYS-MONTH-2407: the month view of the playback screen (days with recordings) - its pure logic, and the wiring of the
// screen (the picker sits beside the date field and a picked day opens that day).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const cellsOf = (g: (MonthCell | null)[]) => g.filter((c): c is MonthCell => !!c);

test('month arithmetic crosses years and knows leap February', () => {
  expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  expect(shiftMonth('2026-03', -14)).toBe('2025-01');
  expect(daysInMonth('2028-02')).toBe(29);
  expect(daysInMonth('2026-02')).toBe(28);
  expect(daysInMonth('2026-03')).toBe(31);
  expect(monthOf('2026-11-07')).toBe('2026-11');
  expect(monthTitle('2026-03')).toBe('מרץ 2026');
});

test('weekdays do not depend on the browser zone (Sunday first)', () => {
  expect(weekdayOf('2026-03-01')).toBe(0); // a Sunday
  expect(weekdayOf('2026-03-27')).toBe(5); // Friday - the Israeli DST switch day
  expect(weekdayOf('2026-11-01')).toBe(0);
});

test('the grid leads with blanks up to day 1 and marks recorded / empty / future / today / selected', () => {
  const g = monthGrid('2026-10', { recorded: ['2026-10-01', '2026-10-04', '2026-10-31'], today: '2026-10-20', selected: '2026-10-04', loaded: true });
  expect(g.slice(0, 4)).toEqual([null, null, null, null]); // 1 Oct 2026 is a Thursday
  const cells = cellsOf(g);
  expect(cells).toHaveLength(31);
  const by = (d: string) => cells.find((c) => c.date === d)!;
  expect(by('2026-10-01').state).toBe('recorded');
  expect(by('2026-10-02').state).toBe('empty');
  expect(by('2026-10-04').selected).toBe(true);
  expect(by('2026-10-20').today).toBe(true);
  expect(by('2026-10-21').state).toBe('future');
  expect(by('2026-10-31').state).toBe('future'); // a recorded day after today is still future (never asked)
  expect(by('2026-10-01').weekday).toBe(4);
});

test('before the answer arrives past days are "checking", never "empty"', () => {
  const cells = cellsOf(monthGrid('2026-09', { recorded: [], today: '2026-11-07', loaded: false }));
  expect(new Set(cells.map((c) => c.state))).toEqual(new Set(['unknown']));
});

test('an empty month is all empty days', () => {
  const cells = cellsOf(monthGrid('2026-08', { recorded: [], today: '2026-11-07', loaded: true }));
  expect(cells.every((c) => c.state === 'empty')).toBe(true);
});

test('rows: 4 to 6 weeks; the card reserves six so nothing moves or scrolls', () => {
  expect(gridRows('2026-02')).toBe(4); // February 2026 starts on Sunday: exactly four weeks
  expect(gridRows('2026-08')).toBe(6); // starts on Saturday
  expect(gridRows('2026-10')).toBe(5);
  const css = readFileSync(path.join(SRC, 'components', 'sw-recorded-month.ts'), 'utf8');
  expect(css).toContain('repeat(6, var(--cell))');
  expect(css).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
});

test('later months are never offered', () => {
  expect(canGoNext('2026-10', '2026-11-07')).toBe(true);
  expect(canGoNext('2026-11', '2026-11-07')).toBe(false);
});

test('Hebrew labels and the honest summary', () => {
  const [cell] = cellsOf(monthGrid('2026-11', { recorded: ['2026-11-01'], today: '2026-11-01', loaded: true }));
  expect(dayLabel(cell)).toBe('יום ראשון, 1 בנובמבר 2026 · יש הקלטות · היום');
  expect(summaryText(0, 'complete')).toBe('אין ימים עם הקלטות בחודש זה');
  expect(summaryText(1, 'complete')).toBe('יום אחד עם הקלטות');
  expect(summaryText(12, 'partial')).toBe('12 ימים עם הקלטות · ייתכן שחסרים ימים (החיפוש הוגבל)');
});

test('the playback screen wires the month view beside the date field and opens a picked day', () => {
  const screen = readFileSync(path.join(SRC, 'screens', 'investigate-playback.ts'), 'utf8');
  expect(screen).toContain("import '../components/sw-recorded-month';");
  expect(screen).toMatch(/<sw-recorded-month data-recorded-month[^>]*@pick=\$\{\(e: CustomEvent<\{ date: string \}>\) => api && void this\.setDate\(e\.detail\.date\)\}/);
  const api = readFileSync(path.join(SRC, 'api', 'recordings.ts'), 'utf8');
  expect(api).toContain('cameras/${cameraId}/recordings/days?month=${month}');
});
