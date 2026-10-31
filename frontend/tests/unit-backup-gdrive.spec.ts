import { test, expect } from '@playwright/test';
import { OBT_TABLES, obt, obtError } from '../src/i18n/backup-offbox';
import {
  CONFIG_FIELDS, GDRIVE_NUMBERS, SECRET_FIELDS, blankTarget, isGoogleDeviceUrl, pollContinues, pollDelayMs, toRequest,
} from '../src/api/backup-offbox';

// GDRIVEBK-2310: a Google Drive off-box target in the screen - it starts OFF, the refresh token is never a form field (it arrives only
// from "connect"), the numbers go out as numbers within their ranges, the consent poll follows the server's interval, only Google's own
// device page is shown as a link, and the Google statuses (quota, reconnect, rate limit ...) have words in every language.

test('a new Google Drive target starts off with the defaults, and only the client secret is typed', () => {
  const g = blankTarget('gdrive');
  expect(g.enabled).toBe(false);
  expect(Object.keys(g.config).sort()).toEqual([...CONFIG_FIELDS.gdrive].sort());
  expect(g.config.folder_name).toBe('SmplWise Arx backups');
  expect(g.config.prune_mode).toBe('delete');
  expect(SECRET_FIELDS.gdrive).toEqual(['client_secret']);
  expect(SECRET_FIELDS.gdrive).not.toContain('refresh_token');
});

test('the request body: trimmed client id, numbers clamped to their ranges, empty numbers fall back, untyped secret omitted', () => {
  const g = blankTarget('gdrive');
  const body = toRequest({ ...g, config: { ...g.config, client_id: ' 123-abc.apps.googleusercontent.com ', chunk_mib: '200', quota_margin_pct: '-5',
    min_free_mib: '' }, secrets: { client_secret: '' } });
  expect(body.config.client_id).toBe('123-abc.apps.googleusercontent.com');
  expect(body.config.chunk_mib).toBe(GDRIVE_NUMBERS.chunk_mib.max);
  expect(body.config.quota_margin_pct).toBe(0);
  expect(body.config.min_free_mib).toBe(GDRIVE_NUMBERS.min_free_mib.fallback);
  expect(body.secrets).toEqual({});
  expect(toRequest({ ...g, secrets: { client_secret: ' GOCSPX-x ' } }).secrets).toEqual({ client_secret: 'GOCSPX-x' });
});

test('the consent poll follows the server interval and stops on an end state', () => {
  expect(pollDelayMs(5)).toBe(5000);
  expect(pollDelayMs(10)).toBe(10000);
  expect(pollDelayMs(0)).toBe(2000);
  expect(pollDelayMs(999)).toBe(60000);
  expect(pollDelayMs(undefined)).toBe(5000);
  expect(pollContinues('pending')).toBe(true);
  expect(pollContinues('slow_down')).toBe(true);
  for (const s of ['connected', 'denied', 'expired', 'none'] as const) expect(pollContinues(s)).toBe(false);
});

test('only Google’s own device page is a link', () => {
  expect(isGoogleDeviceUrl('https://www.google.com/device')).toBe(true);
  expect(isGoogleDeviceUrl('https://google.com/device')).toBe(true);
  expect(isGoogleDeviceUrl('https://evil.example/device')).toBe(false);
  expect(isGoogleDeviceUrl('https://www.google.com.evil.example/device')).toBe(false);
  expect(isGoogleDeviceUrl('http://www.google.com/device')).toBe(false);
});

test('Google statuses have words in every language (Hebrew first) and the step text keeps its {url} placeholder', () => {
  const codes = ['quota_exceeded', 'rate_limited', 'gdrive_reconnect_required', 'gdrive_not_connected', 'gdrive_client_invalid', 'gdrive_client_missing',
    'gdrive_scope_refused', 'gdrive_token_via_connect', 'remote_error'];
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const c of codes) {
      expect(obtError(c, lang), `${lang}.${c}`).not.toBe(obt('err_other', undefined, lang));
    }
    expect(OBT_TABLES[lang].gdriveStep1, lang).toContain('{url}');
  }
  expect(obtError('quota_exceeded', 'he')).toMatch(/[֐-׿]/);
  expect(obtError('gdrive_reconnect_required', 'en')).toContain('connect again');
  expect(obt('kind_gdrive', undefined, 'he')).toBe('Google Drive');
});
