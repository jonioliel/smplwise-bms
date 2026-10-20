import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Node-only unit specs (tests/unit-*.spec.ts): no browser page of the app, so no preview server is started. Used for the quick local loop and the
// pre-gate unit run:
//   npx playwright test -c playwright.unit.config.ts tests/unit-people-logic.spec.ts
// The full suites (evidence / layout / pixel) still run through playwright.config.ts on the runner.
// GATEHYGIENE: the installation's zone, as in playwright.config.ts (the same spec must see the same "today" in both configs).
process.env.TZ = process.env.SW_TEST_TZ || 'Asia/Jerusalem';

// TESTDEBT-295: some unit-* specs drive the real app in a browser (page.goto('/...') against the preview or the Vite dev server). With no
// baseURL they all failed with "Cannot navigate to invalid URL" (67 failures in the 2.9.3 pre-gate run) - a harness fault, not a product one.
// They are left out of the default (node-only) run and run with SW_UNIT_PAGES=1 against a running server:
//   SW_UNIT_PAGES=1 SW_BASE_URL=http://127.0.0.1:5173/ npx playwright test -c playwright.unit.config.ts --workers=2 --reporter=line
// (the same locale / zone / desktop viewport as playwright.config.ts's desktop project; the release gate itself uses playwright.config.ts).
// A spec counts as a page spec when it navigates to an app-relative address, or names it in a constant (const HOME = '/?design=a#/...').
const PAGE_SPEC = /goto\(\s*[`'"]\/|\bconst\s+[A-Z_]+\s*=\s*['"`]\/[?#]/;
const testsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'tests');
const pageSpecs = fs
  .readdirSync(testsDir)
  .filter((f) => /^unit-.*\.spec\.ts$/.test(f) && PAGE_SPEC.test(fs.readFileSync(path.join(testsDir, f), 'utf8')));
const pages = process.env.SW_UNIT_PAGES === '1';

export default defineConfig({
  testDir: 'tests',
  timeout: pages ? 90_000 : 30_000,
  retries: 0,
  reporter: [['list']],
  // GATELANES-297: retired specs (tests/archive/README.md) are never run, in either mode
  ...(pages ? { testMatch: pageSpecs, testIgnore: ['**/archive/**'] } : { testIgnore: ['**/archive/**', ...pageSpecs] }),
  use: pages
    ? {
        baseURL: process.env.SW_BASE_URL || 'http://127.0.0.1:5173/',
        locale: 'he-IL',
        timezoneId: 'Asia/Jerusalem',
        colorScheme: 'light',
        viewport: { width: 1440, height: 900 },
      }
    : {},
  projects: [{ name: pages ? 'desktop' : 'unit' }],
});
