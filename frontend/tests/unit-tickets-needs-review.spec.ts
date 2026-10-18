import { test, expect } from '@playwright/test';
import { HANDLERS_SEGMENTS, REVIEW_SEGMENTS, handlersSegments } from '../src/tickets/readiness-model';
import { NR_AR_DEV, NR_EN, NR_HE, NR_RU_DEV } from '../src/tickets/text-needsreview';
import { template } from '../src/tickets/text';

// NEEDSREVIEW (2.8.0): the "דורש בחינה" segment is the directory editors' only, and its words are complete in Hebrew and English (the
// tickets screens' two columns) with the dev-marked Arabic / Russian drafts covering every key. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-needs-review.spec.ts

test('the review segment is shown to tickets.configure holders only, last', () => {
  expect(handlersSegments(false)).toEqual(HANDLERS_SEGMENTS);
  expect(handlersSegments(false)).not.toContain('review');
  expect(handlersSegments(true)).toEqual([...HANDLERS_SEGMENTS, 'review']);
  expect(REVIEW_SEGMENTS.at(-1)).toBe('review');
});

test('the words: Hebrew and English complete, Arabic / Russian drafts cover every key in their script', () => {
  const keys = Object.keys(NR_HE).sort();
  expect(Object.keys(NR_EN).sort()).toEqual(keys);
  expect(Object.keys(NR_AR_DEV).sort()).toEqual(keys);
  expect(Object.keys(NR_RU_DEV).sort()).toEqual(keys);
  for (const k of keys as (keyof typeof NR_HE)[]) {
    expect(NR_HE[k]).toMatch(/[֐-׿]/);
    expect(NR_AR_DEV[k]).toMatch(/[؀-ۿ]/);
    expect(NR_RU_DEV[k]).toMatch(/[Ѐ-ӿ]/);
    // the same {variables} in every language
    const vars = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const other of [NR_EN[k], NR_AR_DEV[k], NR_RU_DEV[k]]) expect(vars(other)).toEqual(vars(NR_HE[k]));
  }
  expect(template('hdSeg_review', 'he')).toBe('דורש בחינה');
  expect(template('hdSeg_review', 'en')).toBe('Needs review');
});

test('no infrastructure or vendor product names on the screen', () => {
  for (const s of [...Object.values(NR_HE), ...Object.values(NR_EN)]) expect(s).not.toMatch(/Home Assistant|\bHA\b|Ingress|WisKey/i);
});
