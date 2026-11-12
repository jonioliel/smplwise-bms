import { defineConfig } from 'C:/cloude/smplwise-furnmerge/frontend/node_modules/@playwright/test/index.mjs';
export default defineConfig({ testDir: '.', timeout: 900000, retries: 0, workers: 1, reporter: [['list']], outputDir: './out',
  use: { baseURL: 'http://127.0.0.1:4434/', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: 'light' } });
