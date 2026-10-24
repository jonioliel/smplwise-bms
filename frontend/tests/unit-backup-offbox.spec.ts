import { test, expect } from '@playwright/test';
import { OBT_KEYS, OBT_TABLES, keyExportReady, obt, obtError } from '../src/i18n/backup-offbox';
import { CONFIG_FIELDS, SECRET_FIELDS, blankTarget, toRequest } from '../src/api/backup-offbox';

// DATASTORE-295 phase 2: the words of the off-box copies screen exist in all four languages with the same placeholders, every
// server error code the screen can meet has words, and the request body never carries an untyped (empty) secret.

test('every key has en / ar / ru words with the same {placeholders}', () => {
  for (const lang of ['en', 'ar', 'ru'] as const) {
    for (const k of OBT_KEYS) {
      const v = OBT_TABLES[lang][k];
      expect(v, `${lang}.${k}`).toBeTruthy();
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v as string), `${lang}.${k}`).toBe(ph(OBT_TABLES.he[k] as string));
    }
  }
});

test('no home-system branding in any column', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of OBT_KEYS) expect(OBT_TABLES[lang][k] ?? '', `${lang}.${k}`).not.toMatch(/Home Assistant|\bHA\b|Ingress|Supervisor/i);
  }
});

test('server error codes have words; unknown ones fall back', () => {
  for (const code of ['auth_failed', 'host_key_mismatch', 'bucket_missing', 'destination_unavailable', 'verify_hash_mismatch', 'credential_missing',
    'secrets_missing', 'key_already_exported', 'key_mismatch', 'transport_not_available', 'push_running']) {
    expect(obtError(code, 'en')).not.toBe(obt('err_other', undefined, 'en'));
  }
  expect(obtError('something_new', 'en')).toBe('Transfer error');
  expect(obt('dryRunOk', { name: 'a.zip.swxb', n: 2 }, 'en')).toBe('a.zip.swxb would be uploaded; 2 old copies would be deleted');
});

test('the request body: trimmed fields, numeric port, typed secrets only, cleared ones as empty strings', () => {
  const s3 = blankTarget('s3');
  expect(Object.keys(s3.config).sort()).toEqual([...CONFIG_FIELDS.s3].sort());
  const body = toRequest({ ...s3, name: '  R2  ', config: { ...s3.config, endpoint: ' https://acc.r2.cloudflarestorage.com ' }, secrets: { access_key: ' AK ', secret_key: '' } });
  expect(body.name).toBe('R2');
  expect(body.config.endpoint).toBe('https://acc.r2.cloudflarestorage.com');
  expect(body.secrets).toEqual({ access_key: 'AK' });
  const sftp = blankTarget('sftp');
  expect(Object.keys(sftp.config).sort()).toEqual([...CONFIG_FIELDS.sftp].sort());
  const b2 = toRequest({ ...sftp, config: { ...sftp.config, port: '2222' }, secrets: { key: '-----BEGIN KEY-----\n' } }, ['key']);
  expect(b2.config.port).toBe(2222);
  expect(b2.secrets, 'an explicit clear wins').toEqual({ key: '' });
  expect(SECRET_FIELDS.sftp).toEqual(['key']);
});

test('key export wording: the four statements exist in every language and the button needs the word AND the tick', () => {
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of ['keyExportWhat', 'keyExportNoRestore', 'keyExportLost', 'keyExportStore', 'keyExportAck'] as const) {
      expect(OBT_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
    }
  }
  expect(keyExportReady('EXPORT', true, false)).toBe(true);
  expect(keyExportReady('EXPORT', false, false)).toBe(false);
  expect(keyExportReady('', true, false)).toBe(false);
  expect(keyExportReady('export', true, false)).toBe(false);
  expect(keyExportReady('EXPORT', true, true)).toBe(false);
});
