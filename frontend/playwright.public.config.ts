import { defineConfig, devices } from '@playwright/test';

// CR-038 slice 4: the slice's evidence WITHOUT any server (one browser, nothing else running):
// - evidence-public-ticket.spec.ts serves the BUILT handler page (smplwise_vms/www-public) by route interception with the public
//   listener's headers - build it first: npm run build:public:addon
// - evidence-tickets-s4.spec.ts serves the BUILT app (dist/, `vite build`) by route interception on the base origin below
//   (SW_DIST_ROUTE) and answers the API with the mock layer.
//   npx playwright test -c playwright.public.config.ts
// Both specs also run under playwright.config.ts (the runner's spec job), where the app comes from the usual server.
process.env.SW_DIST_ROUTE = '1';

export default defineConfig({
  testDir: 'tests',
  testMatch: /(evidence-(public-ticket|public-vendor-card|public-ui5|tickets-s4|tickets-map)|layout-tickets-s4)\.spec\.ts$/,
  timeout: 240_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4199/', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', serviceWorkers: 'block' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
