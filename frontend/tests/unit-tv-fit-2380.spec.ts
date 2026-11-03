import { expect, test } from '@playwright/test';
import { CHIP_FITS, LOGO_TALL_MAX, LOGO_WIDE_MAX, chipFitOf, dropOrder, logoArea, safeInset, safeMarginOf } from '../src/notice-tv/tv-fit';
import { dayIn, fixedFromGregorian, hebrewDate, hebrewDateText, hebrewFromGregorian, hebrewMonthName, nativeHebrewOk } from '../src/notice-tv/heb-date';

// TV-FIT-2380: the pure rules of the TV board's fit to a real screen - the footer chips (two rows by default, priority drop on request),
// the safe-area / overscan margin, the company logo sized by area (gap H7) and the Hebrew date without the browser's Hebrew calendar.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tv-fit-2380.spec.ts --workers=1

// TV-CHIPS-2381 (owner 03.11, Q3 = B): the default is the priority drop; two rows only when chosen.
test('the chips behaviour: priority drop by default, two rows when chosen, the test hook wins', () => {
  expect(CHIP_FITS).toEqual(['rows', 'drop']);
  expect(chipFitOf(undefined)).toBe('drop');
  expect(chipFitOf({ portrait_chips: null })).toBe('drop');
  expect(chipFitOf({ portrait_chips: 'drop' })).toBe('drop');
  expect(chipFitOf({ portrait_chips: 'rows' })).toBe('rows');
  expect(chipFitOf({ portrait_chips: 'bogus' as never })).toBe('drop');
  expect(chipFitOf({ portrait_chips: 'drop' }, 'rows')).toBe('rows');
  expect(chipFitOf({ portrait_chips: 'rows' }, 'drop')).toBe('drop');
  expect(chipFitOf({}, 'drop')).toBe('drop');
  expect(chipFitOf({}, 'other')).toBe('drop');
});

test('drop order: the healthy chips leave first (the later one first), then "off", then warnings, an alarm last', () => {
  // elevators ok, elevator warn, generator ok, parking ok -> parking, generator, north elevator, then the warning
  expect(dropOrder(['ok', 'warn', 'ok', 'ok'])).toEqual([3, 2, 0, 1]);
  expect(dropOrder(['alarm', 'off', 'warn', 'ok'])).toEqual([3, 1, 2, 0]);
  expect(dropOrder(['mystery', 'alarm'])).toEqual([0, 1]); // an unknown state counts as healthy
  expect(dropOrder([])).toEqual([]);
});

test('the safe-area margin: 0 by default, 0..5 % from the board, the device address wins, anything else is 0', () => {
  expect(safeMarginOf(undefined)).toBe(0);
  expect(safeMarginOf({ safe_margin: null })).toBe(0);
  expect(safeMarginOf({ safe_margin: 3 })).toBe(3);
  expect(safeMarginOf({ safe_margin: 2.5 })).toBe(2.5);
  expect(safeMarginOf({ safe_margin: 2.3 })).toBe(2.5); // halves only
  expect(safeMarginOf({ safe_margin: 9 })).toBe(0);
  expect(safeMarginOf({ safe_margin: -1 })).toBe(0);
  expect(safeMarginOf({ safe_margin: 3 }, '5')).toBe(5);
  expect(safeMarginOf({ safe_margin: 3 }, '0')).toBe(0); // a device without overscan turns the board's margin off
  expect(safeMarginOf({ safe_margin: 3 }, 'x')).toBe(3);
  expect(safeMarginOf({ safe_margin: 3 }, '')).toBe(3);
  expect(safeInset(1920, 1080, 0)).toEqual({ x: 0, y: 0, w: 1920, h: 1080 });
  expect(safeInset(1920, 1080, 5)).toEqual({ x: 96, y: 54, w: 1728, h: 972 });
  expect(safeInset(3840, 2160, 2.5)).toEqual({ x: 96, y: 54, w: 3648, h: 2052 });
  expect(safeInset(1080, 1920, 3)).toEqual({ x: 32, y: 58, w: 1016, h: 1804 });
});

test('the logo by area: an ordinary logo keeps its box, a crest gets height, a banner gets width, both capped (H7)', () => {
  for (const r of [2, 2.5, 3, 3.5, 4]) expect(logoArea(r)).toEqual({ h: 1, w: 1, shape: 'box' });
  for (const r of [0, -1, NaN, Infinity]) expect(logoArea(r)).toEqual({ h: 1, w: 1, shape: 'box' });
  const crest = logoArea(120 / 480); // the 1:4 crest of notice-tv-header-worst-297
  expect(crest.shape).toBe('tall');
  expect(crest.w).toBe(1);
  expect(crest.h).toBe(LOGO_TALL_MAX);
  expect(logoArea(1).h).toBe(1.4); // a square: sqrt(2) = 1.41, capped
  expect(logoArea(1.5).h).toBe(1.15);
  expect(logoArea(1.99).h).toBeLessThan(1.01); // continuous at the band's edge: no jump
  const banner = logoArea(16);
  expect(banner).toEqual({ h: 1, w: LOGO_WIDE_MAX, shape: 'wide' });
  expect(logoArea(5).w).toBe(1.12);
  expect(logoArea(4.01).w).toBeLessThan(1.01);
});

test('the computed Hebrew date matches the browser calendar for every day of 1990-2059', () => {
  const f = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  test.skip(f.resolvedOptions().calendar !== 'hebrew', 'this Node has no Hebrew calendar to compare with');
  const bad: string[] = [];
  for (let t = Date.UTC(1990, 0, 1); t < Date.UTC(2060, 0, 1); t += 86_400_000) {
    const d = new Date(t + 12 * 3_600_000);
    const want = f.format(d);
    const got = hebrewDateText(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    if (want !== got && bad.length < 5) bad.push(d.toISOString().slice(0, 10) + ': ' + want + ' / ' + got);
  }
  expect(bad).toEqual([]);
});

test('Hebrew date anchors: Rosh Hashana, the leap year Adars, the board fixture day', () => {
  expect(hebrewFromGregorian(2026, 9, 12)).toEqual({ y: 5787, m: 7, d: 1 }); // 1 Tishrei 5787
  expect(hebrewDateText(2026, 10, 23)).toBe('12 בחשוון 5787'); // the fixed clock of the TV specs
  expect(hebrewMonthName(12, 5784)).toBe('אדר א׳'); // 5784 is a leap year
  expect(hebrewMonthName(13, 5784)).toBe('אדר ב׳');
  expect(hebrewMonthName(12, 5785)).toBe('אדר');
  expect(hebrewDateText(2025, 3, 15)).toBe('15 באדר 5785');
  expect(fixedFromGregorian(1, 1, 1)).toBe(1);
});

test('the Hebrew date line: the browser calendar when it has one, the computed date when it does not', () => {
  const at = new Date('2026-10-23T06:12:00Z'); // 09:12 in Jerusalem
  const computed = '12 בחשוון 5787';
  // no Hebrew calendar at all (the formatter cannot be made)
  expect(hebrewDate('Asia/Jerusalem', at, () => null)).toBe(computed);
  // a browser that silently falls back to the Gregorian calendar
  const gregory = new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jerusalem' });
  expect(nativeHebrewOk(gregory, at)).toBe(false);
  expect(hebrewDate('Asia/Jerusalem', at, () => gregory)).toBe(computed);
  // a formatter that says "hebrew" but prints Latin letters (no Hebrew locale data)
  const latin = { resolvedOptions: () => ({ calendar: 'hebrew' }), format: () => '12 Heshvan 5787' } as unknown as Intl.DateTimeFormat;
  expect(hebrewDate('Asia/Jerusalem', at, () => latin)).toBe(computed);
  // a formatter that throws while formatting
  const broken = { resolvedOptions: () => ({ calendar: 'hebrew' }), format: () => { throw new RangeError('no data'); } } as unknown as Intl.DateTimeFormat;
  expect(hebrewDate('Asia/Jerusalem', at, () => broken)).toBe(computed);
  // the real one (this Node has full ICU): the same text
  expect(hebrewDate('Asia/Jerusalem', at)).toBe(computed);
  // the day is the board zone's day: 23:30 UTC on 22.10 is already 23.10 in Jerusalem
  expect(dayIn('Asia/Jerusalem', new Date('2026-10-22T23:30:00Z'))).toEqual({ y: 2026, m: 10, d: 23 });
  expect(hebrewDate('Asia/Jerusalem', new Date('2026-10-22T23:30:00Z'), () => null)).toBe(computed);
});
