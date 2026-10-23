import { test, expect } from '@playwright/test';
import { ageText, matches, parseThreshold } from '../src/maintenance/emergency-model';
import { EM_KEYS, TH_LABEL, EM_TABLES, EN_SUMMARY, EN_TITLES, em } from '../src/i18n/emergency';

// CR-EMERG104: the words of the emergency readiness tab. No browser:
//   npx playwright test -c playwright.unit.config.ts tests/unit-emergency.spec.ts

test('every key exists in Hebrew and English, none empty', () => {
  for (const k of EM_KEYS) {
    expect(EM_TABLES.he[k], k).toBeTruthy();
    expect(EM_TABLES.en[k], k).toBeTruthy();
  }
  expect(Object.keys(EM_TABLES.en).sort()).toEqual([...EM_KEYS].sort());
});

test('placeholders match between the two languages', () => {
  const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of EM_KEYS) expect(vars(EM_TABLES.en[k]), k).toBe(vars(EM_TABLES.he[k]));
});

test('the verdict and every status have a word; a filled placeholder is replaced', () => {
  for (const v of ['ready', 'ready_with_gaps', 'not_ready']) expect(EM_KEYS).toContain(`verdict_${v}`);
  for (const s of ['green', 'amber', 'red', 'unknown', 'not_applicable', 'hidden']) expect(EM_KEYS).toContain(`st_${s}`);
  expect(em('ageDay', { n: 3 }, 'en')).toBe('3 days');
  expect(em('checkedAt', { t: '10:00' }, 'he')).toContain('10:00');
});

test('English titles cover all 20 items and the page never names the home platform', () => {
  expect(Object.keys(EN_TITLES)).toHaveLength(20);
  const all = JSON.stringify([EM_TABLES, EN_TITLES, EN_SUMMARY]);
  expect(all).not.toMatch(/Home Assistant|Ingress|Companion|\bHA\b/);
});

test('age text, status filter and threshold parsing', () => {
  expect(ageText(null)).toBe('');
  expect(ageText(30, 'en')).toBe('1 min');
  expect(ageText(7200, 'en')).toBe('2 h');
  expect(ageText(86400 * 5, 'en')).toBe('5 days');
  expect(matches('all', 'green')).toBe(true);
  expect(matches('red', 'amber')).toBe(false);
  expect(parseThreshold(' 35 ', 1, 365)).toBe(35);
  expect(parseThreshold('0', 1, 365)).toBeNull();
  expect(parseThreshold('abc', 1, 365)).toBeNull();
  expect(parseThreshold('11.5', 1, 60)).toBe(11.5);
});

test('every editable threshold has a label in both languages (20 keys, as the backend)', () => {
  expect(Object.keys(TH_LABEL)).toHaveLength(20);
  for (const v of Object.values(TH_LABEL)) {
    expect(v.he).toBeTruthy();
    expect(v.en).toBeTruthy();
  }
});
