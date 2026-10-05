import { test, expect } from '@playwright/test';
import { syncDisconnectedText, syncErrorText } from '../src/api/ha-sync-status';

// HA1: during a platform restart the status reads plain Hebrew; no technical class name and no HA branding leaks. Node only.

test('restart code reads as a plain Hebrew reconnect message', () => {
  expect(syncDisconnectedText('ha_restarting')).toBe('מנותק · תשתית המערכת מופעלת מחדש, מתחבר שוב...');
});

test('unknown technical names never reach the screen', () => {
  for (const code of ['InvalidStatus', 'ha_unreachable', 'ha_auth_failed', 'ha_not_configured', 'ConnectionRefusedError']) {
    const t = syncDisconnectedText(code);
    expect(t).not.toMatch(/[A-Za-z]/);
  }
  expect(syncErrorText(null)).toBe('');
  expect(syncDisconnectedText(null)).toBe('מנותק');
});
