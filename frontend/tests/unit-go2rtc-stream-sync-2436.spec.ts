import { test, expect } from '@playwright/test';
import { REPLACED_CLOSE, frameSaysReplaced, replacedCloseCode } from '../src/api/socket-replaced';
import { streamStateLabel } from '../src/api/media';

// GO2RTC-STREAM-SYNC-2436 (docs/changes/GO2RTC-STREAM-SYNC-2436.md): the pure parts - the replaced frame and the close code the
// player acts on (HA ingress delivers 4410 as 1000), and the words of a go2rtc stream row. No browser page.

test('a replaced frame turns the ingress close 1000 into 4410; our own codes are kept', () => {
  expect(frameSaysReplaced({ type: 'replaced', value: 'superseded' })).toBe(true);
  expect(frameSaysReplaced({ type: 'error', value: 'media_unavailable' })).toBe(false);
  expect(frameSaysReplaced(null)).toBe(false);
  expect(replacedCloseCode(true, 1000)).toBe(REPLACED_CLOSE);
  expect(replacedCloseCode(true, 1006)).toBe(4410);
  expect(replacedCloseCode(true, 4410)).toBe(4410);
  expect(replacedCloseCode(true, 4403), 'an application code that did arrive wins').toBe(4403);
  expect(replacedCloseCode(false, 1000), 'without the frame a 1000 is still "ended"').toBe(1000);
});

test('a go2rtc stream row: idle reads as ready, never as offline', () => {
  expect(streamStateLabel({ online: false, state: 'idle' })).toEqual({ state: 'idle', text: 'מוכן (מתחבר בצפייה)' });
  expect(streamStateLabel({ online: true, state: 'active', consumers: 2 })).toEqual({ state: 'active', text: 'פעיל כעת · 2 צופים' });
  expect(streamStateLabel({ online: true, state: 'active', consumers: 1 }).text).toBe('פעיל כעת · 1 צופה');
  expect(streamStateLabel({ online: false, state: 'no_source' }).text).toBe('ללא מקור');
  // an older server without `state`
  expect(streamStateLabel({ online: false }).state).toBe('idle');
  expect(streamStateLabel({ online: true }).text).toBe('פעיל כעת');
  for (const s of ['idle', 'active', 'no_source'] as const) expect(streamStateLabel({ online: s === 'active', state: s }).text).not.toMatch(/offline|לא מחובר/i);
});
