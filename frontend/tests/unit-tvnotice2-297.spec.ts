import { expect, test } from '@playwright/test';
import {
  IDLE_LOGOS, TV_FACTORY, TV_KEYS, UPDATED_LINES, effectiveTv, headerOf, idleLogoOf, tvDefaultsOf, updatedLineParts, updatedOf,
} from '../src/notice-tv/tv-logic';

// TVNOTICE2-297 (owner 27.10): the TV header default stays "as before"; the "updated" line has both wordings with the approved preview
// wording as the default; the idle board shows the clock and SmplWise by default, with a choice to add the developer logo.

test('the header default stays as before; a and b stay choices', () => {
  expect(TV_FACTORY.header).toBe('c');
  expect(headerOf({ header: undefined })).toBe('c');
  expect(headerOf({ header: 'a' })).toBe('a');
  expect(headerOf({ header: 'b' })).toBe('b');
});

test('the "updated" line: both wordings, the preview wording by default', () => {
  expect(UPDATED_LINES).toEqual(['place', 'full', 'time', 'issues']);
  expect(TV_FACTORY.updated).toBe('place');
  expect(updatedOf({ updated: undefined })).toBe('place');
  expect(updatedOf({ updated: 'full' })).toBe('full');
  expect(tvDefaultsOf({}).updated).toBe('place');
  expect(tvDefaultsOf({ updated: 'full' }).updated).toBe('full');
});

test('the wording of each "updated" line', () => {
  const ctx = { label: 'עודכן', place: 'כניסה ראשית', board: 'לוח הלובי' };
  // the approved preview: "עודכן · כניסה ראשית 09:46"
  expect(updatedLineParts('place', ctx)).toEqual({ before: 'עודכן · כניסה ראשית ', after: '' });
  // the wording the product had: "עודכן 09:46 · לוח הלובי"
  expect(updatedLineParts('full', ctx)).toEqual({ before: 'עודכן ', after: ' · לוח הלובי' });
  // no place on the board: the board name stands in
  expect(updatedLineParts('place', { ...ctx, place: '  ' })).toEqual({ before: 'עודכן · לוח הלובי ', after: '' });
  // neither: the label and the time only
  expect(updatedLineParts('place', { ...ctx, place: '', board: '' })).toEqual({ before: 'עודכן ', after: '' });
  expect(updatedLineParts('full', { ...ctx, board: '' })).toEqual({ before: 'עודכן ', after: '' });
});

test('the idle logos: SmplWise by default, the developer logo on request', () => {
  expect(IDLE_LOGOS).toEqual(['sw', 'both']);
  expect(TV_FACTORY.idle_logo).toBe('sw');
  expect(TV_KEYS).toContain('idle_logo');
  expect(idleLogoOf({ idle_logo: undefined })).toBe('sw');
  expect(idleLogoOf({ idle_logo: 'both' })).toBe('both');
  expect(idleLogoOf({ idle_logo: 'dev' as never })).toBe('sw');
  expect(tvDefaultsOf({ idle_logo: 'both' }).idle_logo).toBe('both');
  expect(effectiveTv({}, { ...TV_FACTORY, idle_logo: 'both' }).idle_logo).toBe('both');
  expect(effectiveTv({ idle_logo: 'sw' }, { ...TV_FACTORY, idle_logo: 'both' }).idle_logo).toBe('sw');
});
