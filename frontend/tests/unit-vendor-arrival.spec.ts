import { test, expect } from '@playwright/test';
import { art } from '../src/public-ticket/arrived/arrived-text';
import { stamp } from '../src/public-ticket/arrived/arrived-card';
import { LANGS } from '../src/public-ticket/strings';
import { vat } from '../src/tickets/vendor-arrival-text';
import { NMT_TABLES } from '../src/i18n/notify-matrix';
import { TICKET_SOURCES } from '../src/api/notifications';

// VENDORARRIVAL126-295: the pure parts of the vendor's "I have arrived" card, its words and the settings words. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-vendor-arrival.spec.ts

const KEYS = ['title', 'expected', 'late', 'open', 'button', 'sending', 'arrived', 'access', 'errOffline', 'errGeneric'] as const;

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
});

test('the settings words exist in Hebrew and English', () => {
  for (const k of ['card', 'on', 'onSub', 'window', 'grace', 'repeat', 'max', 'managers', 'users', 'offer', 'save', 'errDay'] as const) {
    expect(vat(k)).toBeTruthy();
  }
  expect(vat('remove', { name: 'דנה' })).toContain('דנה');
});

test('the missed-arrival source is in the client catalogue and in all four matrix languages', () => {
  const s = TICKET_SOURCES.find((x) => x.key === 'ticket.vendor_missed');
  expect(s?.severity).toBe('alert');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(NMT_TABLES[lang].src_ticket_vendor_missed, lang).toBeTruthy();
});
