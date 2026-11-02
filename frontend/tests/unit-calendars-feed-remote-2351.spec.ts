import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FEED_REMOTE_CONFIRM_HE, FEED_REMOTE_LOCAL_ONLY_HE, feedDetailHe, feedExpiry, feedMaxAgeHe, feedRemoteNeedsConfirm, feedRemoteView,
} from '../src/calendars/connect-model';

// CAL-FEED-REVIEW-2351, owner decisions round 14 (02.11): the "גישה מרחוק" toggle of פידים יוצאים - who sees it, the confirmation that names
// the consequence (ON only), the lock on the remote channel, the busy-only chip of a feed open from outside, the expiry line and
// "חידוש קישור", and the calendars setting of the default expiry. Node only (the server decides every rule again):
//   npx playwright test -c playwright.unit.config.ts tests/unit-calendars-feed-remote-2351.spec.ts --workers=1

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => fs.readFileSync(path.join(here, '..', 'src', f), 'utf8');
const NOW = new Date('2026-11-02T09:00:00Z');

test('the toggle shows only to whom the server lets switch it, and is locked on the remote channel', () => {
  expect(feedRemoteView({ remote: false, can_remote: false, revoked: false }, true)).toEqual({ show: false });
  expect(feedRemoteView({ remote: false, revoked: false }, true)).toEqual({ show: false }); // an older server: no field = no toggle
  expect(feedRemoteView({ remote: true, can_remote: true, revoked: true }, true)).toEqual({ show: false });
  expect(feedRemoteView({ remote: false, can_remote: true, revoked: false }, true)).toEqual({ show: true, on: false, locked: false });
  expect(feedRemoteView({ remote: true, can_remote: true, revoked: false }, true)).toEqual({ show: true, on: true, locked: false });
  expect(feedRemoteView({ remote: true, can_remote: true, revoked: false }, false)).toEqual({ show: true, on: true, locked: true });
});

test('turning remote access ON asks first and names the consequence; OFF applies at once', () => {
  expect(feedRemoteNeedsConfirm(true)).toBe(true);
  expect(feedRemoteNeedsConfirm(false)).toBe(false);
  expect(FEED_REMOTE_CONFIRM_HE).toContain('מחוץ לרשת של הבניין');
  expect(FEED_REMOTE_CONFIRM_HE).toContain('כל מי שמחזיק בקישור');
  expect(FEED_REMOTE_CONFIRM_HE).toContain('"תפוס"');
  expect(FEED_REMOTE_LOCAL_ONLY_HE).toContain('רק מתוך הרשת של הבניין');
  for (const t of [FEED_REMOTE_CONFIRM_HE, FEED_REMOTE_LOCAL_ONLY_HE]) expect(t).not.toMatch(/Home Assistant|\bHA\b/);
});

test('a feed open from outside reads busy-only whatever its own choice', () => {
  expect(feedDetailHe({ detail: 'titles', detail_effective: 'busy', remote: true })).toBe('"תפוס" בלבד · פתוח מבחוץ');
  expect(feedDetailHe({ detail: 'titles', detail_effective: 'titles', remote: false })).toBe('כותרות');
  expect(feedDetailHe({ detail: 'busy', remote: false })).toBe('"תפוס" בלבד');
  expect(feedDetailHe({ detail: 'titles' })).toBe('כותרות'); // an older server without detail_effective
});

test('the expiry line: none, a date, past it; the default in words', () => {
  expect(feedExpiry(null, NOW)).toEqual({ text: 'ללא תאריך תפוגה', expired: false });
  expect(feedExpiry(undefined, NOW).expired).toBe(false);
  expect(feedExpiry('2027-11-02T09:00:00Z', NOW)).toEqual({ text: 'בתוקף עד 02.11.2027', expired: false });
  const past = feedExpiry('2026-10-01T09:00:00Z', NOW);
  expect(past.expired).toBe(true);
  expect(past.text).toContain('01.10.2026');
  expect(past.text).toContain('לחדש קישור');
  expect(feedExpiry('garbage', NOW).expired).toBe(true);
  expect([feedMaxAgeHe(365), feedMaxAgeHe(90), feedMaxAgeHe(0), feedMaxAgeHe(null)]).toEqual(['365 יום', '90 יום', 'ללא הגבלה', 'ללא הגבלה']);
});

test('the dialog: toggle wired through the confirmation, lock note, expiry, renew; the API call and the setting row', () => {
  const d = src('calendars/connect-dialogs.ts');
  expect(d).toContain('data-feed-remote-toggle');
  expect(d).toContain('data-feed-remote-confirm');
  expect(d).toContain('data-feed-remote-local-only');
  expect(d).toContain('data-feed-expiry');
  expect(d).toContain('>חידוש קישור</button>');
  // ON goes through the confirmation only: the one call with `true` sits on the "yes" button; the toggle's own handler only sends `false`
  const flip = d.slice(d.indexOf('private flipRemote('), d.indexOf('private feedRow('));
  expect(flip).toContain('this.confirmRemote = f.id');
  expect(flip).toContain('setFeedRemote(f.id, false)');
  expect(flip).not.toContain('setFeedRemote(f.id, true)');
  const confirm = d.slice(d.indexOf('private remoteConfirm('), d.indexOf('private feedsBody('));
  expect(confirm).toMatch(/data-feed-remote-yes[\s\S]*setFeedRemote\(f\.id, true\)/);
  expect(confirm).toContain('FEED_REMOTE_CONFIRM_HE');
  // the toggle follows the server's state (live), so a cancelled confirmation puts it back
  expect(d).toContain('.checked=${live(on)}');
  expect(src('api/calendars.ts')).toContain('setFeedRemote: (id, enabled) => put(`/calendar/feeds/${encodeURIComponent(id)}/remote`, { enabled })');
  const s = src('screens/system-calendars.ts');
  expect(s).toContain("key: 'feed_max_age_days'");
  expect(s).toContain("[[90, '90 יום'], [180, '180 יום'], [365, '365 יום'], [0, 'ללא הגבלה']]");
  expect(s).toContain('feed_max_age_days: 365');
  for (const f of ['calendars/connect-dialogs.ts', 'calendars/connect-model.ts']) expect(src(f)).not.toContain('Home Assistant');
});
