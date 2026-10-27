import { defineConfig } from '@playwright/test';

// Node-only unit specs (tests/unit-*.spec.ts): no browser page, so no preview server is started. Used for the quick local loop:
//   npx playwright test -c playwright.unit.config.ts tests/unit-people-logic.spec.ts
// The full suites (evidence / layout / pixel) still run through playwright.config.ts on the runner.
// GATEHYGIENE: the installation's zone, as in playwright.config.ts (the same spec must see the same "today" in both configs).
process.env.TZ = process.env.SW_TEST_TZ || 'Asia/Jerusalem';
export default defineConfig({
  testDir: 'tests',
  testIgnore: ['**/archive/**'], // GATELANES-297: retired specs, never run (tests/archive/README.md)
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'unit' }],
});
