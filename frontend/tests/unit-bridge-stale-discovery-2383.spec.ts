import { test, expect } from '@playwright/test';
import { regenHint, regenMessage } from '../src/api/ha';

// BRIDGE-STALE-DISCOVERY-2383: the "גשר Arx" regenerate row and its result say what really happens to the new code (node only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-bridge-stale-discovery-2383.spec.ts

test('the regenerate hint follows whether the code reaches the bridge by itself', () => {
  expect(regenHint(true)).toContain('נשלח לגשר הקיים אוטומטית');
  expect(regenHint(false)).toContain('לא נשלח אוטומטית');
  expect(regenHint(undefined)).toBe('מבטל את הצימוד הקיים; יש להגדיר מחדש את האינטגרציה');
  for (const v of [true, false, undefined]) expect(regenHint(v)).not.toMatch(/Home Assistant/);
});

test('the result message never claims a delivery that did not happen', () => {
  expect(regenMessage(true)).toContain('נשלח לגשר הקיים');
  expect(regenMessage(false)).toContain('לא נשלח לגשר אוטומטית');
  expect(regenMessage(undefined)).toBe(regenMessage(false));
  expect(regenMessage(false)).not.toMatch(/Home Assistant/);
});
