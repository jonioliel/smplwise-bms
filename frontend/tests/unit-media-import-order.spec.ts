import { test, expect } from '@playwright/test';
// CR-015: media-screens.ts and media-screens-mock.ts import each other. Here the CLIENT is evaluated first (the order the app's
// component imports produce); the mock must not read the client's constants while it loads.
import { KEY_IDS, media } from '../src/api/media-screens';
import { resetMediaMock } from '../src/api/media-screens-mock';

test('the client loads before its mock: the mock builds its key tables on first use', async () => {
  const m = resetMediaMock();
  const d = await m.get('md-living');
  expect(d.caps.keys.length).toBeGreaterThan(20);
  expect(d.caps.keys.every((k) => KEY_IDS.includes(k))).toBe(true);
  expect(typeof media).toBe('function');
});
