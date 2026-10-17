import { test, expect } from '@playwright/test';
import { navForAssign, navForPreview, navSwitch } from '../src/tickets/assign-nav-model';
import { LOC_TEXT_EN, LOC_TEXT_HE } from '../src/tickets/org-locations-text';

// CR-ORG-LOCATIONS (owner 2026-10-17): the "add a navigation link to the message" switch of the service request's external assign dialog.
// Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-assign-nav.spec.ts

const AVAILABLE = { available: true, on: false };
const ON = { available: true, on: true };
const NONE = { available: false, on: false };

test('hidden without coordinates: a request with no location, or a location without coordinates, shows no switch', () => {
  for (const answer of [NONE, null, undefined]) expect(navSwitch(answer, true), String(answer)).toEqual({ visible: false, checked: false });
});

test('default off: the switch is shown unchecked and nothing about a link is sent', () => {
  expect(navSwitch(AVAILABLE, false)).toEqual({ visible: true, checked: false });
  expect(navForPreview(AVAILABLE, false)).toBeUndefined();
  expect(navForAssign(AVAILABLE, false)).toBeUndefined();
});

test('switched on: the preview is asked with the flag and the assignment carries it only when the preview showed the link', () => {
  expect(navSwitch(AVAILABLE, true)).toEqual({ visible: true, checked: true });
  expect(navForPreview(AVAILABLE, true)).toBe(true);
  expect(navForAssign(AVAILABLE, true), 'the preview has not answered with the link yet: nothing is sent').toBeUndefined();
  expect(navForAssign(ON, true), 'the text the manager saw carries the link').toBe(true);
});

test('a stale "on" never leaves: without coordinates the flag stays off the wire (the server would refuse it)', () => {
  expect(navForPreview(NONE, true)).toBeUndefined();
  expect(navForAssign(NONE, true)).toBeUndefined();
  expect(navForAssign(ON, false)).toBeUndefined();
});

test('the switch has Hebrew and English words', () => {
  for (const key of ['navOn', 'navOnSub'] as const) {
    expect(LOC_TEXT_HE[key].length).toBeGreaterThan(5);
    expect(LOC_TEXT_EN[key].length).toBeGreaterThan(5);
  }
});
