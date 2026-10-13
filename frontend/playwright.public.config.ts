import { defineConfig, devices } from '@playwright/test';

// CR-038 slice 4: the handler page's evidence without any server - the spec serves the BUILT bundle (smplwise_vms/www-public) by
// route interception with the public listener's headers. Build it first (npm run build:public:addon), then:
//   npx playwright test -c playwright.public.config.ts
// The same spec also runs under playwright.config.ts (it never uses that config's preview server).
export default defineConfig({
  testDir: 'tests',
  testMatch: /evidence-public-ticket\.spec\.ts$/,
  timeout: 180_000,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: { locale: 'he-IL', timezoneId: 'Asia/Jerusalem' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
