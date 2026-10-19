import { expect, test } from '@playwright/test';
import { privacyPatch, validPrivacyContact, validPrivacyLink } from '../src/tickets/privacy-contact';
import { tt } from '../src/tickets/text';

test('PRIVORG-291: the contact point is an e-mail address, a phone number, or empty', () => {
  for (const ok of ['', '  ', 'privacy@example.test', 'a.b+c@sub.example.test', '050-123-4567', '+972 50 123 4567', '(03) 555-1234']) expect(validPrivacyContact(ok), ok).toBe(true);
  for (const bad of ['hello', 'a@b', 'x@y.z', '12345', '1'.repeat(20), 'a b@example.test', '{x}@example.test', 'mailto:a@example.test', `${'x'.repeat(80)}@example.test`]) expect(validPrivacyContact(bad), bad).toBe(false);
});

test('PRIVORG-291: the link is https or empty', () => {
  for (const ok of ['', 'https://hadar.example.test/privacy', 'https://hadar.example.test/privacy?lang=he']) expect(validPrivacyLink(ok), ok).toBe(true);
  for (const bad of ['http://hadar.example.test', 'javascript:alert(1)', 'https://', 'https://u:p@hadar.example.test/', 'https://a b.test/', 'https://hadar.example.test/{x}', `https://${'a'.repeat(200)}.test`]) expect(validPrivacyLink(bad), bad).toBe(false);
});

test('PRIVORG-291: only changed, valid values are sent', () => {
  expect(privacyPatch(undefined, { contact: '', link: '' })).toBeNull();
  expect(privacyPatch({ contact: 'a@example.test', link: '' }, { contact: ' a@example.test ', link: '' })).toBeNull();
  expect(privacyPatch({ contact: '', link: '' }, { contact: 'a@example.test', link: '' })).toEqual({ contact: 'a@example.test' });
  expect(privacyPatch({ contact: 'a@example.test', link: 'https://h.example.test/p' }, { contact: '', link: 'https://h.example.test/p' })).toEqual({ contact: '' });
  expect(privacyPatch({ contact: '', link: '' }, { contact: 'nope', link: '' })).toBeNull();
  expect(privacyPatch({ contact: '', link: '' }, { contact: '', link: 'http://h.example.test' })).toBeNull();
});

test('PRIVORG-291: the settings texts exist and say the wording is unchanged while empty', () => {
  for (const k of ['pubPrivContact', 'pubPrivLink', 'pubPrivNote', 'pubPrivBad'] as const) expect(tt(k).length, k).toBeGreaterThan(5);
  expect(tt('pubPrivNote')).toContain('ריק');
});
