import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { BPT_DEV_MARKED, BPT_KEYS, BPT_TABLES, bpt } from '../src/i18n/backup-password';

// BACKUP-HASH-ENC: the backup-password words exist in every column with the same placeholders; the Arabic and Russian columns
// stay dev-marked (initial translation); the screen never keeps the password after a request and never puts it in a message.

test('every column has every key with the same placeholders', () => {
  for (const lang of ['en', 'ar', 'ru'] as const) {
    for (const k of BPT_KEYS) {
      const v = BPT_TABLES[lang][k];
      expect(v, `${lang}.${k}`).toBeTruthy();
      expect((v ?? '').match(/\{\w+\}/g) ?? [], `${lang}.${k}`).toEqual(BPT_TABLES.he[k]?.match(/\{\w+\}/g) ?? []);
    }
  }
  expect([...BPT_DEV_MARKED]).toEqual(['ar', 'ru']);
  expect(bpt('resultNeedReset', { n: 3 }, 'en')).toBe('3 local accounts need a password reset link');
});

test('the screen clears the password after create and restore and sends it only when typed', () => {
  const src = readFileSync(new URL('../src/screens/system-diagnostics.ts', import.meta.url), 'utf8');
  expect(src).toContain("...(pw ? { backup_password: pw } : {})");
  expect(src).toContain("this.backupPassword = '';");
  expect(src).toContain("this.restorePassword = '';");
  expect(src).toContain('type="password" autocomplete="new-password" data-backup-password');
  expect(src).not.toMatch(/backupMsg = [^;]*Password/);
  expect(src).not.toMatch(/localStorage[^;]*[pP]assword/);
});

test('the minimum-length setting: 8-64 on the screen, the placeholder names the minimum in force', () => {
  const src = readFileSync(new URL('../src/screens/system-diagnostics.ts', import.meta.url), 'utf8');
  expect(src).toContain('type="number" min="8" max="64" data-ltr data-backup-min');
  expect(src).toContain('n < 8 || n > 64');
  expect(src).toContain("patchSettings({ 'backup.password_min': n })");
  expect(bpt('createPlaceholder', { n: 20 }, 'en')).toBe('At least 20 characters (optional)');
  expect(bpt('createPlaceholder', { n: 8 }, 'he')).toContain('8');
});
