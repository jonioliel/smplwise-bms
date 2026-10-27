import { expect, test } from '@playwright/test';
import * as model from '../src/announce/model';
import { ANNOUNCE_SCREEN_RANGE } from '../src/api/announcements';
import { ANNOUNCE_TABLES } from '../src/i18n/announce';

// ANNOUNCE2-297 (owner 27.10): the emergency close lock is a setting of 0-600 whole seconds (15 by default, server side); the translation
// provider list offers the free Google translation (default) and OpenAI; a translation never holds back sending - only a short, quiet mark.

test('the close lock: 0-600 whole seconds', () => {
  expect(ANNOUNCE_SCREEN_RANGE.critical_close_s).toEqual([0, 600]);
  expect(model.clampScreenNumber('critical_close_s', '15')).toBe(15);
  expect(model.clampScreenNumber('critical_close_s', '0')).toBe(0);
  expect(model.clampScreenNumber('critical_close_s', '15.6')).toBe(16);
  expect(model.clampScreenNumber('critical_close_s', '-4')).toBe(0);
  expect(model.clampScreenNumber('critical_close_s', '9000')).toBe(600);
  expect(model.clampScreenNumber('critical_close_s', '')).toBeNull();
});

test('no "reviewed" gate: a machine-translated part never blocks sending', () => {
  expect('reviewOk' in model).toBe(false);
  const mt = new Set(['ar'] as const);
  // the room and the texts decide, never the review
  expect(model.canSend(model.ALL_ROOMS, { he: 'א', ar: 'ب' }, ['he', 'ar'])).toBe(true);
  // the parts still carry the machine mark (the screens and the history show it)
  expect(model.partsWithMachine({ he: 'א', ar: 'ب' }, ['he', 'ar'], mt)).toEqual([{ language: 'he', text: 'א' }, { language: 'ar', text: 'ب', machine: true }]);
  expect(model.sentMachine({ he: 'א', ar: 'ب' }, ['he', 'ar'], mt)).toEqual(['ar']);
});

test('the machine mark is short and quiet in every language; no "I reviewed" string is left', () => {
  for (const [lang, t] of Object.entries(ANNOUNCE_TABLES)) {
    expect(t.machineBadge.length, lang).toBeLessThanOrEqual(20);
    expect(t.machineBadge, lang).not.toMatch(/[–-]/);
    expect('reviewed' in t, lang).toBe(false);
    expect(t.translateProviderGoogle, lang).toBeTruthy();
    expect(t.translateProviderCloud, lang).toBe('OpenAI');
  }
});
