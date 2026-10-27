import { defineConfig, devices } from '@playwright/test';

// Screenshot harness for design review (DESIGN_CONTRACT): reference desktop / tablet / mobile widths,
// RTL shell, deterministic fixtures. Run `npm run build` first; the preview server serves dist/.
// SW_BASE_URL: another preview (a second worktree serves on its own port); the default is the usual 4173.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

// GATEHYGIENE (2.9.1): the Node side of every spec - dates a test computes for its mocks / expectations, and the specs that run product
// modules in Node - uses the installation's zone, the same as the browser (`timezoneId` below). The gate runner is Etc/UTC: between
// 21:00 and 24:00 UTC its calendar day is not the installation's, so "today" computed in the test and "today" rendered by the page
// differed there and nowhere else (a workstation in Israel never saw it). Set before the workers start, so they inherit it.
// SW_TEST_TZ overrides it (e.g. SW_TEST_TZ=UTC to reproduce the old runner behaviour).
process.env.TZ = process.env.SW_TEST_TZ || 'Asia/Jerusalem';

export default defineConfig({
  testDir: 'tests',
  // GATELANES-297: tests/archive/ holds retired specs (history kept, never run; tests/archive/README.md says how to restore one)
  testIgnore: ['**/archive/**'],
  timeout: 60_000,
  retries: 0,
  // Live specs share one backend and installation-wide settings (e.g. הגדרות › בקרות כניסה, switched by the WisKey
  // specs for their run): never in parallel. The demo-mode fixture specs keep Playwright's default.
  ...(process.env.SW_LIVE === '1' ? { workers: 1 } : {}),
  reporter: [['list']],
  use: {
    baseURL: BASE,
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'light',
    // Live-video evidence needs H.264: SW_CHROME=1 runs the installed Google Chrome instead of bundled Chromium.
    ...(process.env.SW_CHROME === '1' ? { channel: 'chrome' as const } : {}),
  },
  webServer: {
    command: `npm run preview -- --port ${new URL(BASE).port || '4173'}`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 768 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
