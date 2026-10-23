import { test, expect } from '@playwright/test';
import { INTAKE_KEYS, INTAKE_TABLES, itx } from '../src/i18n/intake';
import {
  INTAKE_DEFAULTS, INTAKE_LIMITS, fieldValue, flagKeys, intakeOf, limitedInt, numberPatch, pager, plausiblePhone, segments, urgencyTone,
} from '../src/tickets/intake-model';
import type { IntakeDraft } from '../src/api/tickets-intake';

// CR-INTAKE99 / TENANTINTAKE098-295: the pure rules of the free-text request queue and its settings.
//   npx playwright test -c playwright.unit.config.ts tests/unit-intake.spec.ts

test.describe('evidence segments (the requester text is plain text, never HTML)', () => {
  test('split at the server offsets, merged, clamped, in reading order', () => {
    const text = 'המעלית תקועה בקומה 3';
    expect(segments(text, [[0, 6, 'D-elevator'], [13, 20, 'P-floor-num']])).toEqual([
      { text: 'המעלית', hit: true }, { text: ' תקועה ', hit: false }, { text: 'בקומה 3', hit: true },
    ]);
    expect(segments('abc', [[1, 2, 'x'], [1, 3, 'y'], [-5, 0, 'z'], [9, 12, 'w']])).toEqual([{ text: 'a', hit: false }, { text: 'bc', hit: true }]);
    expect(segments('abc', [])).toEqual([{ text: 'abc', hit: false }]);
    expect(segments('', [[0, 2, 'x']])).toEqual([]);
  });

  test('markup typed by a stranger stays text in every segment', () => {
    const evil = '<img src=x onerror=alert(1)> https://evil.example';
    const joined = segments(evil, [[0, 5, 'x']]).map((s) => s.text).join('');
    expect(joined).toBe(evil);
  });
});

test.describe('flags, tones, paging', () => {
  test('known flags are worded, unknown ones ignored', () => {
    expect(flagKeys(['safety', 'future_flag', 'possible_multi_issue'])).toEqual(['safety', 'multi']);
    expect(urgencyTone('urgent')).toBe('danger');
    expect(urgencyTone('high')).toBe('warning');
    expect(urgencyTone('low')).toBe('neutral');
  });

  test('five rows a page, never a scroll', () => {
    expect(pager(0, 0, 0)).toEqual({ from: 0, to: 0, total: 0, prev: null, next: null });
    expect(pager(12, 0, 5)).toEqual({ from: 1, to: 5, total: 12, prev: null, next: 5 });
    expect(pager(12, 10, 2)).toEqual({ from: 11, to: 12, total: 12, prev: 5, next: null });
  });
});

test.describe('settings model', () => {
  test('everything ships off; an older server without the block shows nothing', () => {
    expect(INTAKE_DEFAULTS.enabled).toBe(false);
    expect(INTAKE_DEFAULTS.whatsapp).toBe(false);
    expect(intakeOf(undefined)).toBeNull();
    expect(intakeOf({})).toEqual(INTAKE_DEFAULTS);
    expect(intakeOf({ enabled: true, open_max: 'many' as never, classifier: 'llm' as never })).toEqual({ ...INTAKE_DEFAULTS, enabled: true });
  });

  test('number fields accept only whole numbers inside the server range', () => {
    expect(limitedInt('5', 'sender_per_day')).toBe(5);
    for (const bad of ['0', '21', '-1', '1.5', '', 'abc']) expect(limitedInt(bad, 'sender_per_day'), bad).toBeNull();
    expect(limitedInt('2000', 'open_max')).toBe(2000);
    expect(limitedInt('2001', 'open_max')).toBeNull();
    expect(Object.keys(INTAKE_LIMITS).length).toBe(10);
    expect(numberPatch(INTAKE_DEFAULTS, 'coalesce_min', '10')).toBeNull();
    expect(numberPatch(INTAKE_DEFAULTS, 'coalesce_min', '20')).toEqual({ coalesce_min: 20 });
  });

  test('a plausible number needs 8-15 digits', () => {
    expect(plausiblePhone('050-111 2233')).toBe(true);
    expect(plausiblePhone('+972 50 111 2233')).toBe(true);
    expect(plausiblePhone('12')).toBe(false);
    expect(plausiblePhone('abcdefghij')).toBe(false);
  });
});

test.describe('draft field values', () => {
  const draft = {
    text: 'המזגן לא מקרר',
    edited: { title: 'תיקון', category_id: null },
    suggestion: { department_id: 'd1', category: { value: 'c1' }, location: { value: null }, place: { text: 'בחדר 204' }, urgency: { value: 'high' }, title: 'המזגן לא מקרר' },
  } as unknown as IntakeDraft;
  test('an edit wins over the suggestion, an explicit empty edit clears it', () => {
    expect(fieldValue(draft, 'title')).toBe('תיקון');
    expect(fieldValue(draft, 'category_id')).toBe('');
    expect(fieldValue(draft, 'department_id')).toBe('d1');
    expect(fieldValue(draft, 'priority_key')).toBe('high');
    expect(fieldValue(draft, 'place_other')).toBe('בחדר 204');
    expect(fieldValue(draft, 'description')).toBe('המזגן לא מקרר');
  });
});

test.describe('strings', () => {
  test('every English key exists in Hebrew; a missing translation falls back to Hebrew, never to the key', () => {
    for (const k of Object.keys(INTAKE_TABLES.en)) expect(INTAKE_KEYS, k).toContain(k);
    for (const k of INTAKE_KEYS) {
      expect(itx(k, 'he'), k).toBeTruthy();
      expect(itx(k, 'ar'), k).toBe(itx(k, 'he'));
    }
  });

  test('copy rules: the home platform is never named; no paragraphs', () => {
    for (const t of Object.values(INTAKE_TABLES)) {
      for (const v of Object.values(t)) {
        expect(v).not.toMatch(/home assistant|ingress|\bHA\b/i);
        expect((v ?? '').length).toBeLessThan(60);
      }
    }
  });
});
