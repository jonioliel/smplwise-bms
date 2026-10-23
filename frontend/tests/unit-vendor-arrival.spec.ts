import { test, expect } from '@playwright/test';
import { art } from '../src/public-ticket/arrived/arrived-text';
import { stamp, view, type VisitBlock } from '../src/public-ticket/arrived/arrived-card';
import { LANGS } from '../src/public-ticket/strings';
import { vst } from '../src/tickets/visits-settings-text';

// VENDORARRIVAL126B-295: the pure parts of the vendor's "I have arrived" card (on the existing visits flow) and the settings words. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-vendor-arrival.spec.ts

const KEYS = ['title', 'expected', 'late', 'notYet', 'button', 'sending', 'arrived', 'reported', 'access', 'errOffline', 'errOutside', 'errGeneric'] as const;

test('every word of the card exists in all four languages and no placeholder is left open', () => {
  for (const lang of LANGS) {
    for (const k of KEYS) {
      const s = art(lang, k, { from: '09:00', to: '11:00', at: '10:30' });
      expect(s, `${lang}.${k}`).toBeTruthy();
      expect(s, `${lang}.${k}`).not.toMatch(/\{\w+\}/);
    }
  }
});

test('the card carries no phone number and points to a manager approval for any entry code', () => {
  for (const lang of LANGS) for (const k of KEYS) expect(art(lang, k)).not.toMatch(/\d{7,}/);
  expect(art('he', 'access')).toContain('מנהל');
  expect(art('en', 'access')).toContain('manager');
});

test('a time is shown in the installation zone and a bad value shows as it came', () => {
  expect(stamp('2026-11-02T07:30:00Z', 'en', 'Asia/Jerusalem')).toMatch(/09:30/);
  expect(stamp('2026-11-02T07:30:00Z', 'en', 'UTC')).toMatch(/07:30/);
  expect(stamp('not-a-time', 'he', 'UTC')).toBe('not-a-time');
  expect(stamp(undefined, 'he', 'UTC')).toBe('');
  expect(stamp(null, 'he', 'UTC')).toBe('');
});

test('the card state follows the server visit block, the button only when the server says it is open', () => {
  const b = (o: Partial<VisitBlock>): VisitBlock => ({ state: 'planned', can_arrive: false, ...o });
  expect(view(b({}))).toBe('notYet');
  expect(view(b({ can_arrive: true }))).toBe('ready');
  expect(view(b({ state: 'missed', can_arrive: true }))).toBe('late');
  expect(view(b({ state: 'missed' }))).toBe('notYet');
  expect(view(b({ state: 'reported' }))).toBe('reported');
  expect(view(b({ state: 'arrived' }))).toBe('arrived');
  expect(view(b({ state: 'done' }))).toBe('arrived');
});

test('the settings words exist in Hebrew', () => {
  for (const k of ['card', 'enabled', 'publicArrival', 'claimCounts', 'offer', 'offerSub', 'notifyVendor', 'grace', 'early', 'save', 'errRange'] as const) {
    expect(vst(k)).toBeTruthy();
  }
});
