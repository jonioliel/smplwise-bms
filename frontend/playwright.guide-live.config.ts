import { defineConfig } from '@playwright/test';

// T091: the live user-guide capture (tests/guide-screenshots-live.spec.ts) talks to a real installation through its
// Ingress URL, so it needs no preview server, runs one screen at a time in the installed Google Chrome (H.264 for
// live video) and never retries (a retry would only repeat a privacy failure). Started by
// scripts/guide_live_capture.py, which supplies the environment; see the spec header.
export default defineConfig({
  testDir: 'tests',
  testMatch: /guide-screenshots-live\.spec\.ts$/,
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    channel: 'chrome',
    locale: 'he-IL',
    timezoneId: 'Asia/Jerusalem',
    colorScheme: 'light',
  },
  projects: [{ name: 'live-guide' }],
});
