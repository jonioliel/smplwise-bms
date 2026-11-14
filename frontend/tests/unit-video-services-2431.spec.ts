import { test, expect } from '@playwright/test';
import {
  NOTICE_AFTER_CHOICES,
  NOTICE_AFTER_DEFAULT,
  PROBE_LABEL,
  REASON_TEXT,
  SOURCE_LABEL,
  STATE_LABEL,
  canUse,
  candidateKind,
  candidateLine,
  confirmText,
  noticeAfterLabel,
  noticeAfterValue,
  sortCandidates,
  type VideoServiceCandidate,
} from '../src/api/video-services';

// HEALTH-GO2RTC-FOLLOWUP-2431 (docs/changes/HEALTH-GO2RTC-FOLLOWUP-2431.md): the picker's logic - which candidate is offered, in which
// order, with which words; the notice delay's choices. No browser page.

const cand = (over: Partial<VideoServiceCandidate>): VideoServiceCandidate => ({
  slug: 'a1_go2rtc', name: 'go2rtc', state: 'started', version: '1.9.9', image_go2rtc: true, address: 'a1-go2rtc:1984', probe: 'ok', go2rtc_version: '1.9.9', current: false, ...over,
});

test('the notice delay: 1 / 5 / 15 / 30 / 60 minutes, 15 by default, anything else reads as 15', () => {
  expect([...NOTICE_AFTER_CHOICES]).toEqual([1, 5, 15, 30, 60]);
  expect(NOTICE_AFTER_DEFAULT).toBe(15);
  expect(noticeAfterValue(5)).toBe(5);
  expect(noticeAfterValue('30')).toBe(30);
  for (const bad of [undefined, null, 0, 7, '', 'x', 120]) expect(noticeAfterValue(bad)).toBe(15);
  expect(NOTICE_AFTER_CHOICES.map(noticeAfterLabel)).toEqual(['דקה אחת', '5 דקות', '15 דקות', '30 דקות', 'שעה']);
});

test('"use this" is offered for every other candidate with an address, never for the one in use', () => {
  expect(canUse(cand({}))).toBe(true);
  expect(canUse(cand({ current: true }))).toBe(false);
  expect(canUse(cand({ address: null }))).toBe(false);
  expect(canUse(cand({ state: 'stopped', probe: 'not_probed' })), 'a stopped one may be chosen (it may be started later)').toBe(true);
  expect(confirmText(cand({ state: 'stopped' }))).toContain('השירות כבוי כרגע');
  expect(confirmText(cand({}))).not.toContain('כבוי');
});

test('order: in use, running and answering, running, the rest', () => {
  const list = [
    cand({ slug: 'd', name: 'ד', state: 'stopped', probe: 'not_probed' }),
    cand({ slug: 'c', name: 'ג', probe: 'unreachable' }),
    cand({ slug: 'b', name: 'ב', probe: 'auth_required' }),
    cand({ slug: 'a', name: 'א', current: true, probe: 'unreachable' }),
  ];
  expect(sortCandidates(list).map((c) => c.slug)).toEqual(['a', 'b', 'c', 'd']);
  expect(list.map((c) => c.slug), 'the input is not reordered').toEqual(['d', 'c', 'b', 'a']);
});

test('badge kind and line per state', () => {
  expect(candidateKind(cand({}))).toBe('live');
  expect(candidateKind(cand({ probe: 'auth_required' }))).toBe('live');
  expect(candidateKind(cand({ probe: 'unreachable' }))).toBe('stale');
  expect(candidateKind(cand({ state: 'stopped', probe: 'not_probed' }))).toBe('neutral');
  expect(candidateKind(cand({ state: 'error' }))).toBe('error');
  expect(candidateLine(cand({}))).toBe('פועל · עונה · גרסה 1.9.9');
  expect(candidateLine(cand({ state: 'stopped', probe: 'not_probed', go2rtc_version: null, version: '1.9.4' }))).toBe('כבוי · גרסה 1.9.4');
});

test('words on screen never name the platform and every value has a label', () => {
  const words = [...Object.values(STATE_LABEL), ...Object.values(PROBE_LABEL), ...Object.values(SOURCE_LABEL), ...Object.values(REASON_TEXT), confirmText(cand({}))];
  for (const w of words) {
    expect(w.length).toBeGreaterThan(0);
    expect(w).not.toMatch(/home assistant|supervisor|hass/i);
  }
});
