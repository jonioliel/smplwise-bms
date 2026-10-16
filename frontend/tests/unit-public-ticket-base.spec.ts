import { expect, test } from '@playwright/test';
import { homePath, publicBase, withBase } from '../src/public-ticket/base';
import { bootFrom } from '../src/public-ticket/state';

// TK255: the handler page follows the prefix of the path it was opened on (the listener serves /support/ itself, /t/ stays for old links)
test('the base is the first path segment when it has the server shape, else /t', () => {
  expect(publicBase('/support/')).toBe('/support');
  expect(publicBase('/support')).toBe('/support');
  expect(publicBase(`/support/r/${'a'.repeat(32)}`)).toBe('/support');
  expect(publicBase('/t/')).toBe('/t');
  expect(publicBase('/my_help-2/')).toBe('/my_help-2');
  for (const odd of ['', '/', '//', '/Support/', '/x/', '/a b/', '/%2e%2e/', '/support./', 'support/', '/' + 'a'.repeat(40) + '/']) expect(publicBase(odd)).toBe('/t');
});

test('routes are mapped onto the open page prefix and only /t/ routes are accepted', () => {
  expect(withBase('/t/api/ticket', '/support/')).toBe('/support/api/ticket');
  expect(withBase('/t/api/claim/file', '/support/r/' + 'a'.repeat(32))).toBe('/support/api/claim/file');
  expect(withBase('/t/api/photo/abc', '/t/')).toBe('/t/api/photo/abc');
  expect(withBase('/t/api/quote', '/')).toBe('/t/api/quote');
  for (const bad of ['/api/ticket', 'https://evil.test/t/api/ticket', '//evil.test/t/x', 't/api/x']) expect(() => withBase(bad, '/support/')).toThrow();
});

test('the address bar returns to the page home of the same prefix', () => {
  expect(homePath('/support/')).toBe('/support/');
  expect(homePath('/support/r/' + 'a'.repeat(32))).toBe('/support/');
  expect(homePath('/t/')).toBe('/t/');
});

test('a redeem link works under every valid prefix and under none other', () => {
  const rid = 'ab'.repeat(16);
  expect(bootFrom('', `/support/r/${rid}`, null).rid).toBe(rid);
  expect(bootFrom('', `/my_help-2/r/${rid}`, null).rid).toBe(rid);
  expect(bootFrom('', `/t/r/${rid}`, null).rid).toBe(rid);
  for (const bad of [`/x/r/${rid}`, `/Support/r/${rid}`, `/support/../r/${rid}`, `/a/b/r/${rid}`]) expect(bootFrom('', bad, null).rid).toBeNull();
});
