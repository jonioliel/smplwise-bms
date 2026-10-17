import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { qst } from '../src/tickets/rfq-settings-text';

// RFQQSET: the two vendor-question settings on the module's settings screen - words and wiring (node only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-rfq-question-settings.spec.ts

test('the four texts exist in Hebrew and none is empty', () => {
  for (const k of ['qReminder', 'qReminderSub', 'qBadgeAll', 'qBadgeAllSub'] as const) expect(qst(k).length).toBeGreaterThan(5);
});

test('the settings screen writes both keys through the rfq patch and bounds the hours 0-168', () => {
  const src = readFileSync('src/screens/system-tickets.ts', 'utf8');
  expect(src).toContain('rfq: { question_reminder_hours: qn }');
  expect(src).toContain('rfq: { question_badge_all_viewers: e.detail.checked }');
  expect(src).toContain('intIn(qRaw, 0, 168)');
  const api = readFileSync('src/api/tickets.ts', 'utf8');
  expect(api).toContain('question_badge_all_viewers?: boolean');
});
