import { test, expect } from '@playwright/test';
import { OTP_EN, OTP_HE } from '../src/tickets/text-otp';

// TKNOTIFOTP: the words of the optional number verification by code (he / en) and their copy rules.
//   npx playwright test -c playwright.unit.config.ts tests/unit-phone-verify.spec.ts
test.describe('phone verification texts', () => {
  test('every Hebrew key has an English text and nothing is empty', () => {
    expect(Object.keys(OTP_EN).sort()).toEqual(Object.keys(OTP_HE).sort());
    for (const v of [...Object.values(OTP_HE), ...Object.values(OTP_EN)]) expect(v.trim().length).toBeGreaterThan(0);
  });

  test('no infrastructure product name, no module noun and no code placeholder in the UI words', () => {
    for (const v of [...Object.values(OTP_HE), ...Object.values(OTP_EN)]) {
      expect(v).not.toMatch(/Home Assistant|\bHA\b|Ingress|קריא|פנייה|ticket/i);
      expect(v).not.toMatch(/\{code\}|\d{6}/);
    }
  });

  test('the setting says it is off by default (owner decision: optional, never mandatory)', () => {
    expect(OTP_HE.otpSettingHint).toContain('כבוי כברירת מחדל');
    expect(OTP_EN.otpSettingHint).toContain('Off by default');
  });
});
