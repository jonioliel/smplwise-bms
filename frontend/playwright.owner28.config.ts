import { defineConfig } from '@playwright/test';

// WISKEY-ADOPT-2272: the WisKey owner28 media reproduction (delivery frontend/owner28-playwright.config.ts) - the ORIGINAL station live
// view (MSE video) next to the ORIGINAL listen player (G.711 -> WebAudio), synthetic sockets only (no station, no backend, no speaker:
// Chromium runs with --mute-audio). Its own file name pattern (*.owner28.ts) keeps it out of the main suite.
//   npx playwright test -c playwright.owner28.config.ts
const PORT = Number(process.env.SW_OWNER28_PORT || '5188');

export default defineConfig({
  testDir: 'tests/owner28',
  testMatch: '*.owner28.ts',
  timeout: 45_000,
  workers: 1,
  outputDir: 'test-results/owner28',
  reporter: [['list'], ['json', { outputFile: 'test-results/owner28/BROWSER_RESULT.json' }]],
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 } } },
  ],
  use: { baseURL: `http://127.0.0.1:${PORT}`, headless: true, launchOptions: { args: ['--mute-audio'] } },
  webServer: {
    command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/tests/owner28/owner28-harness.html`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
