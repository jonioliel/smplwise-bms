import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { PAGE_SPEC } from '../playwright.unit.config';
import { reuseServer } from './helpers/server-reuse';

// LOWS-BRIDGE-GATE-2550 (deep review 2.52 TR-10). Node-only: no browser page, no server.
//   npx playwright test -c playwright.unit.config.ts tests/unit-pw-server-reuse-2550.spec.ts
// (a) playwright.config.ts reused WHATEVER served port 4173 (reuseExistingServer: true): a run without SW_BASE_URL on a machine where
//     another worktree's preview held 4173 tested that build. Reuse now needs SW_BASE_URL (the gate's own port) or SW_REUSE_SERVER=1.
// (b) playwright.unit.config.ts's page-spec detector missed unit-mfa-passkeys-2490 (it builds its origin at run time), which then ran
//     in the node-only run and failed with ERR_CONNECTION_REFUSED. A header marker now declares such a spec.
// The marker is built by concatenation so that this file itself is not a page spec.

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const MARKER = '@unit-' + 'page-spec';

test('a server on the port is reused only when the run names it or asks for it', () => {
  expect(reuseServer({})).toBe(false);
  expect(reuseServer({ SW_REUSE_SERVER: '0' })).toBe(false);
  expect(reuseServer({ SW_BASE_URL: '' })).toBe(false);
  expect(reuseServer({ SW_BASE_URL: 'http://127.0.0.1:4189/' })).toBe(true);
  expect(reuseServer({ SW_REUSE_SERVER: '1' })).toBe(true);
});

test('playwright.config.ts takes its reuse rule from the helper, never a bare true', () => {
  const text = fs.readFileSync(path.join(testsDir, '..', 'playwright.config.ts'), 'utf8');
  expect(text).toContain('reuseExistingServer: reuseServer(process.env)');
  expect(text).not.toMatch(/reuseExistingServer:\s*true/);
});

test('the header marker makes a page spec; unit-mfa-passkeys-2490 carries it and leaves the node-only run', () => {
  expect(PAGE_SPEC.test('// ' + MARKER + ' - a page spec')).toBe(true);
  expect(PAGE_SPEC.test('// unit-page-spec without the at sign')).toBe(false);
  const mfa = fs.readFileSync(path.join(testsDir, 'unit-mfa-passkeys-2490.spec.ts'), 'utf8');
  expect(mfa).toContain(MARKER);
  expect(PAGE_SPEC.test(mfa)).toBe(true);
  if (process.env.SW_UNIT_PAGES !== '1') {
    const ignored = (config.testIgnore ?? []) as string[];
    expect(ignored).toContain('unit-mfa-passkeys-2490.spec.ts');
  }
});
