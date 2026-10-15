import { expect, test } from '@playwright/test';
import { sampleLink } from '../src/tickets/public-address';
import { tt } from '../src/tickets/text';

test('2.5.4: the sample vendor link uses the one path prefix, or /t without it', () => {
  expect(sampleLink('https://ecc.smplwise.com/support')).toBe('https://ecc.smplwise.com/support/#…');
  expect(sampleLink('https://ecc.smplwise.com/support/')).toBe('https://ecc.smplwise.com/support/#…');
  expect(sampleLink('https://ecc.smplwise.com')).toBe('https://ecc.smplwise.com/t/#…');
  for (const bad of ['', 'http://ecc.smplwise.com', 'https://ecc.smplwise.com/a/b', 'https://ecc.smplwise.com/s', 'https://ecc.smplwise.com/support?x=1']) expect(sampleLink(bad)).toBe('');
});

test('2.5.4: the address card texts name the example, the optional prefix and the not-routed answer', () => {
  expect(tt('pubAddressHint')).toBe('https://ecc.smplwise.com/support');
  expect(tt('pubAddressNote')).toContain('/support');
  expect(tt('probe_not_routed')).toContain('Rewrite');
  expect(tt('pubSampleLink', { url: 'https://h.example/support/#…' })).toContain('https://h.example/support/#…');
  for (const k of ['pubAddressNote', 'pubSampleLink', 'probe_not_routed'] as const) expect(tt(k)).not.toMatch(/קריא/);
});
