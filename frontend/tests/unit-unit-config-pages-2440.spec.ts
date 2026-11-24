import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config, { PAGE_SPEC, UNIT_SPEC } from '../playwright.unit.config';

// FIX-UNIT-PAGES-CONFIG-2440: playwright.unit.config.ts sorts the unit-* specs into node-only and page specs. A page spec that navigated
// relative to the baseURL ('./#/devices', unit-session-me-failure-2435) was not recognised, ran in the node-only run without a baseURL and
// failed 5 tests there. Node-only: no browser page, no server.
//   npx playwright test -c playwright.unit.config.ts tests/unit-unit-config-pages-2440.spec.ts
// The sample addresses are built by concatenation so that this file itself is not a page spec.

const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)));
const q = "'";
const goto = (addr: string) => 'await page.goto(' + q + addr + q + ');';

test('an address relative to the baseURL is a page spec, as an absolute app address is', () => {
  for (const addr of ['./#/devices', '/#/devices', '/?design=a#/home', './?design=a#/home']) expect(PAGE_SPEC.test(goto(addr)), addr).toBe(true);
  expect(PAGE_SPEC.test('const HOME = ' + q + './#/home' + q + ';')).toBe(true);
  expect(PAGE_SPEC.test('const HOME = ' + q + '/?design=a#/home' + q + ';')).toBe(true);
});

test('the gotoApp helper with an app address is a page spec (TRIAL-2480, after FLAKY-SWEEP-2480)', () => {
  expect(PAGE_SPEC.test('await gotoApp(page, ' + q + '/?design=a#/system/diagnostics?tab=devices' + q + ');')).toBe(true);
  expect(PAGE_SPEC.test('await gotoApp(page, ' + q + './#/devices' + q + ');')).toBe(true);
  expect(PAGE_SPEC.test(fs.readFileSync(path.join(testsDir, 'unit-device-types-admin-ui.spec.ts'), 'utf8'))).toBe(true);
});

test('an own origin, a data URL or plain text is not a page spec', () => {
  expect(PAGE_SPEC.test('await page.goto(`${ORIGIN}/arx/`);')).toBe(false);
  expect(PAGE_SPEC.test(goto('about:blank'))).toBe(false);
  expect(PAGE_SPEC.test('const X = ' + q + '../src/app' + q + ';')).toBe(false);
  expect(PAGE_SPEC.test("const X = './x';")).toBe(false);
});

test('unit-session-me-failure-2435 (the spec that failed) is a page spec', () => {
  expect(PAGE_SPEC.test(fs.readFileSync(path.join(testsDir, 'unit-session-me-failure-2435.spec.ts'), 'utf8'))).toBe(true);
});

test('the config only takes unit-* specs: evidence, layout and pixel specs stay out', () => {
  for (const f of ['unit-people-logic.spec.ts', 'unit-session-me-failure-2435.spec.ts']) expect(UNIT_SPEC.test(f)).toBe(true);
  for (const f of ['evidence-wkwater-2331.spec.ts', 'layout-shell.spec.ts', 'pixel-home.spec.ts', 'unit-helpers.ts']) expect(UNIT_SPEC.test(f)).toBe(false);
  // this run is the node-only mode (SW_UNIT_PAGES unset): its testMatch is the unit-* glob and the page specs are ignored
  expect(config.testMatch).toBe('unit-*.spec.ts');
  expect(config.testIgnore).toContain('unit-session-me-failure-2435.spec.ts');
});
