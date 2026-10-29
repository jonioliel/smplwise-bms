import { test, expect } from '@playwright/test';
import { OBR_KEYS, OBR_TABLES, obr, obrError } from '../src/i18n/backup-offbox-restore';
import { restoreReady } from '../src/api/backup-offbox';

// OFFBOX-RESTORE-2300: the words of "restore from an off-box copy" exist in Hebrew and English with the same placeholders, every
// refusal code the server can answer has words, and the destructive button needs the typed word.

test('every key has English words with the same {placeholders}', () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
  for (const k of OBR_KEYS) {
    expect(OBR_TABLES.en[k], `en.${k}`).toBeTruthy();
    expect(ph(OBR_TABLES.en[k]), `en.${k}`).toBe(ph(OBR_TABLES.he[k]));
  }
});

test('no home-system branding in any column', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of OBR_KEYS) expect(OBR_TABLES[lang][k], `${lang}.${k}`).not.toMatch(/Home Assistant|\bHA\b|Ingress|Supervisor/i);
  }
});

test('server refusal codes have words; unknown ones fall back', () => {
  for (const code of ['key_missing', 'key_mismatch', 'sealed_damaged', 'sealed_invalid', 'archive_invalid', 'schema_newer', 'disk_insufficient',
    'object_missing', 'stage_missing', 'stage_changed', 'safety_failed', 'destination_unavailable', 'push_running']) {
    expect(obrError(code, 'en'), code).not.toBe(obr('err_other', undefined, 'en'));
    expect(obrError(code, 'he'), code).not.toBe(obr('err_other', undefined, 'he'));
  }
  expect(obrError('something_new', 'en')).toBe('The action was refused.');
  expect(obr('done', { name: 'a.zip.swxb', n: 3, files: 2, safety: 's.zip' }, 'en')).toBe('Restored from a.zip.swxb: 3 tables, 2 files. Safety backup: s.zip. Refresh the screen.');
});

test('the restore button needs exactly the typed word and no request in flight', () => {
  expect(restoreReady('RESTORE', false)).toBe(true);
  expect(restoreReady('restore', false)).toBe(false);
  expect(restoreReady('', false)).toBe(false);
  expect(restoreReady('RESTORE', true)).toBe(false);
});
