import { test, expect } from '@playwright/test';
import { OVERVIEW_DEFAULTS, overviewSettingsOf, parseDeptStuckInput } from '../src/tickets/overview-model';
import { ot, overviewTemplate, OVERVIEW_TEXT_EN_KEYS } from '../src/tickets/overview-text';
import { setTicketNames } from '../src/tickets/naming';

// MGRDASH phase 5: the alerts' two settings (the morning summary's hour, the busy-department threshold). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-overview-p5.spec.ts

test.beforeEach(() => setTicketNames(null));

test('the alerts\' settings: defaults 08:00 and 10, a bad value reads as its default', () => {
  expect([OVERVIEW_DEFAULTS.digestHour, OVERVIEW_DEFAULTS.deptStuck]).toEqual([8, 10]);
  expect(overviewSettingsOf({ dash_digest_hour: 6, dash_dept_stuck: 25 })).toMatchObject({ digestHour: 6, deptStuck: 25 });
  for (const bad of [24, -1, 7.5, '8', null]) expect(overviewSettingsOf({ dash_digest_hour: bad }).digestHour).toBe(8);
  for (const bad of [0, 1000, '9', 2.5]) expect(overviewSettingsOf({ dash_dept_stuck: bad }).deptStuck).toBe(10);
});

test('the busy-department threshold typed into its field: 1-999 only', () => {
  expect(['1', ' 12 ', '999'].map(parseDeptStuckInput)).toEqual([1, 12, 999]);
  for (const bad of ['', '0', '1000', '-3', '1.5', 'abc']) expect(parseDeptStuckInput(bad), bad).toBeUndefined();
});

test('the phase-5 texts exist in both languages and follow the module name', () => {
  for (const k of ['setDigestHour', 'setDigestHourSub', 'setDeptStuck', 'setDeptStuckSub', 'setDeptStuckInvalid'] as const) {
    expect(OVERVIEW_TEXT_EN_KEYS).toContain(k);
    for (const lang of ['he', 'en'] as const) expect(overviewTemplate(k, lang), `${lang}.${k}`).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
  }
  expect(ot('setDeptStuckSub')).toBe('תקועות במחלקה · להתראה למנהלי המחלקה');
  setTicketNames({ he: { one: 'דיווח', many: 'דיווחים', gender: 'm' } });
  expect(ot('setDeptStuckSub')).toBe('תקועים במחלקה · להתראה למנהלי המחלקה');
  setTicketNames(undefined);
});
