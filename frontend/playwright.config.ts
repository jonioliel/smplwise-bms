import { defineConfig, devices } from '@playwright/test';

// Screenshot harness for design review (DESIGN_CONTRACT): reference desktop / tablet / mobile widths,
// RTL shell, deterministic fixtures. Run `npm run build` first; the preview server serves dist/.
// SW_BASE_URL: another preview (a second worktree serves on its own port); the default is the usual 4173.
const BASE = process.env.SW_BASE_URL || 'http://127.0.0.1:4173/';

export default defineConfig({
  testDir: 'tests',
  timeout: 60_000,
  retries: 0,
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
