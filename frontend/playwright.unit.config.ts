import { defineConfig } from '@playwright/test';

// Node-only unit specs (tests/unit-*.spec.ts): no browser page, so no preview server is started. Used for the quick local loop:
//   npx playwright test -c playwright.unit.config.ts tests/unit-people-logic.spec.ts
// The full suites (evidence / layout / pixel) still run through playwright.config.ts on the runner.
export default defineConfig({
  testDir: 'tests',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  projects: [{ name: 'unit' }],
});
