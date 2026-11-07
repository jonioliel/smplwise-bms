import { test, expect } from '@playwright/test';
import { CR_KEYS, CR_TABLES, crt } from '../src/i18n/camera-reboot';
import { rebootErrorText, rebootView } from '../src/screens/camera-reboot-logic';
import { ApiError } from '../src/api/client';
import type { CameraRebootState } from '../src/api/nvr';

// CAMERA-REBOOT-2407: the camera's "restart" action - the words (he / en), when the button is enabled, the reason it is not, and
// the words of a refusal. Node-only:  npx playwright test -c playwright.unit.config.ts tests/unit-camera-reboot-2407.spec.ts

const base: CameraRebootState = { camera_id: 'c1', supported: true, permitted: true, writes_enabled: true, can_reboot: true, reason: null, cooldown_s: 0, recorder_id: 'nvr-1' };
const err = (status: number, code: string) => new ApiError(status, { code, user_message: 'server text', retryable: false, correlation_id: 'x', details: {} });

test('every key exists in he and en, non-empty, with the same placeholders', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CR_KEYS) {
      const v = CR_TABLES[lang][k];
      expect(typeof v === 'string' && v.trim().length > 0, `${lang}.${k}`).toBe(true);
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',');
      expect(ph(v), `${lang}.${k} placeholders`).toBe(ph(CR_TABLES.he[k]));
    }
  }
});

test('no internal code, permission name, device path or home platform on the face', () => {
  for (const lang of ['he', 'en'] as const) {
    for (const k of CR_KEYS) {
      const v = CR_TABLES[lang][k];
      expect(/nvr\.camera|nvr_writes|rate_limited|_not_supported|ISAPI|InputProxy|home assistant|\bHA\b/i.test(v), `${lang}.${k}`).toBe(false);
    }
  }
});

test('enabled when the server says so; hidden for a recorder type without the action or before the state is read', () => {
  expect(rebootView(base)).toEqual({ shown: true, enabled: true, reason: '' });
  expect(rebootView(base, true).enabled).toBe(false);
  expect(rebootView(null).shown).toBe(false);
  expect(rebootView({ ...base, supported: false, can_reboot: false, reason: 'not_supported' }).shown).toBe(false);
});

test('disabled with the reason in words: permission missing, NVR changes off, just restarted', () => {
  const noPerm = rebootView({ ...base, permitted: false, can_reboot: false, reason: 'no_permission' }, false);
  expect(noPerm).toEqual({ shown: true, enabled: false, reason: crt('reasonNoPermission') });
  const off = rebootView({ ...base, writes_enabled: false, can_reboot: false, reason: 'writes_off' });
  expect(off.enabled).toBe(false);
  expect(off.reason).toBe(crt('reasonWritesOff'));
  const cool = rebootView({ ...base, can_reboot: false, reason: 'cooldown', cooldown_s: 130 });
  expect(cool.enabled).toBe(false);
  expect(cool.reason).toBe(crt('reasonCooldown', { min: 3 }));
  expect(cool.reason).toContain('3');
});

test('a refusal is said in words, never the server code', () => {
  expect(rebootErrorText(err(409, 'nvr_writes_off'))).toBe(crt('reasonWritesOff'));
  expect(rebootErrorText(err(409, 'camera_reboot_not_supported'))).toBe(crt('reasonNotSupported'));
  expect(rebootErrorText(err(409, 'nvr_not_supported'))).toBe(crt('reasonNotSupported'));
  expect(rebootErrorText(err(429, 'rate_limited'))).toBe(crt('errorRateLimited'));
  expect(rebootErrorText(err(409, 'nvr_rejected'))).toBe(crt('errorRejected'));
  expect(rebootErrorText(err(503, 'source_unavailable'))).toBe(crt('errorUnavailable'));
  expect(rebootErrorText(err(403, 'forbidden'))).toBe(crt('errorForbidden'));
  expect(rebootErrorText(new Error('boom'))).toBe(crt('errorGeneric'));
  for (const e of [err(409, 'nvr_writes_off'), err(429, 'rate_limited'), err(503, 'source_forbidden')]) {
    expect(rebootErrorText(e)).not.toContain(e.code);
  }
});

test('the English column is used when the document is English', () => {
  expect(crt('button', undefined, 'en')).toBe('Restart camera…');
  expect(crt('dialogSub', { name: 'Lobby', channel: 3 }, 'en')).toBe('Lobby · channel 3');
  expect(crt('dialogSub', { name: 'לובי', channel: 3 }, 'he')).toBe('לובי · ערוץ 3');
});
