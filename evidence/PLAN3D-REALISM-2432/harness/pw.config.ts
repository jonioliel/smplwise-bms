import { defineConfig } from 'C:/cloude/smplwise-3drealism/frontend/node_modules/@playwright/test/index.mjs';
export default defineConfig({ testDir: '.', timeout: 600000, retries: 0, reporter: [['list']], outputDir: './out',
  use: { baseURL: 'http://127.0.0.1:4417/', locale: 'he-IL', timezoneId: 'Asia/Jerusalem', colorScheme: 'light' } });
