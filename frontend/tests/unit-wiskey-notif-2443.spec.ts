import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { peopleLookupsMemo, syncBadge, t } from '../src/screens/wiskey-format';
import { NOTIFY_SECTION_IDS, mailDraftAfterReload, mailDraftDirty, mailDraftOf, notifySection } from '../src/components/notify-logic';
import { DEFAULT_SETTINGS, type NotifySettings } from '../src/api/notifications';
import type { AcGroup, AcStationLite } from '../src/api/access-people';

// CR-WISKEY-NOTIF-2443 (code review 2026-11-13: 06:WK-1, 06:NOTIF-1, D2 for the people screen). Node only: the pure helpers the two
// screens now use, plus source checks for the wiring a Node spec cannot mount (the people screen's subscription and poll).

const src = (rel: string) => readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', rel), 'utf8');

test.describe('people screen (06:WK-1)', () => {
  test('syncBadge kept its table after the move to wiskey-format', () => {
    expect(syncBadge('synced')).toEqual({ kind: 'recorded', label: t('synced') });
    for (const s of ['pending', 'syncing', 'delete_pending']) expect(syncBadge(s)).toEqual({ kind: 'stale', label: t(s) });
    for (const s of ['conflict', 'error']) expect(syncBadge(s)).toEqual({ kind: 'error', label: t(s) });
    expect(syncBadge('offline')).toEqual({ kind: 'offline', label: t('offline') });
    expect(syncBadge('unassigned')).toEqual({ kind: 'unknown', label: t('filter_unassigned') });
    expect(syncBadge('something_new')).toEqual({ kind: 'neutral', label: 'something new' });
  });

  test('the editor no longer imports the screen that imports it (the cycle is gone)', () => {
    const editor = src('screens/wiskey-person-editor.ts');
    expect(editor).not.toMatch(/from '\.\/wiskey-people'/);
    expect(src('screens/wiskey-people.ts')).not.toMatch(/export function syncBadge/);
  });

  test('the lookups are rebuilt only when the station or group list is another array', () => {
    const stations: AcStationLite[] = [{ id: 'd1', name: 'שער' }, { id: 'd2', name: 'לובי' }];
    const groups: AcGroup[] = [{ id: 'g1', label: 'עובדים', enabled: true, station_ids: ['d1', 'd2'] }, { id: 'g2', label: 'כולם', enabled: true, station_ids: null }];
    const memo = peopleLookupsMemo();
    const a = memo(stations, groups);
    expect(a.stationNames).toEqual({ d1: 'שער', d2: 'לובי' });
    expect(a.groupLabels).toEqual({ g1: 'עובדים', g2: 'כולם' });
    expect(a.groupStations).toEqual({ g1: 2, g2: null });
    expect(a.bulkStations).toEqual([{ id: 'd1', name: 'שער', locks: [1, 2] }, { id: 'd2', name: 'לובי', locks: [1, 2] }]);
    expect(a.bulkGroups).toEqual([{ id: 'g1', label: 'עובדים' }, { id: 'g2', label: 'כולם' }]);
    expect(memo(stations, groups)).toBe(a); // a render with the same lists: the very same objects
    const b = memo([...stations, { id: 'd3', name: 'חניון' }], groups);
    expect(b).not.toBe(a);
    expect(b.stationNames.d3).toBe('חניון');
    const c = memo(stations, [...groups]); // a new group list alone also rebuilds
    expect(c).not.toBe(b);
    expect(c.groupLabels).toEqual(a.groupLabels);
  });

  test('the change-notice subscription is made in begin(), so a permission granted later subscribes too', () => {
    const s = src('screens/wiskey-people.ts');
    // exactly one call site, inside subscribe(), and subscribe() is idempotent
    expect(s.match(/subscribeIntercom\(/g)?.length).toBe(1);
    expect(s).toMatch(/private subscribe\(\) \{\s*if \(this\.stop\) return;\s*this\.stop = subscribeIntercom\(/);
    // begin() subscribes; the session listener's late-permission branch calls begin()
    expect(s).toMatch(/private begin\(\) \{\s*this\.phase = 'loading';\s*this\.subscribe\(\);/);
    expect(s).toMatch(/if \(next\.people && !was && this\.phase === 'forbidden'\) this\.begin\(\);/);
    // connectedCallback no longer subscribes after its early "forbidden" return
    const connected = s.slice(s.indexOf('connectedCallback() {'), s.indexOf('disconnectedCallback() {'));
    expect(connected).not.toContain('subscribeIntercom');
  });

  test('the fallback poll is the shared PollController (D2), not a bare interval', () => {
    const s = src('screens/wiskey-people.ts');
    expect(s).toContain('new PollController(this)');
    expect(s).not.toMatch(/setInterval\(/);
    expect(s).toMatch(/this\.poll\.every\('people', POLL_MS, \(\) => this\.refresh\(\)\)/);
    expect(s).toMatch(/const POLL_MS = 30000;/); // the period is unchanged
  });
});

test.describe('notification settings (06:NOTIF-1)', () => {
  const settings = (email: Partial<NotifySettings['email']> = {}): NotifySettings => {
    const s = DEFAULT_SETTINGS();
    return { ...s, email: { ...s.email, configured: true, host: 'smtp.example.test', port: 587, user: 'arx', from: 'arx@example.test', recipients: ['a@example.test'], password_set: true, ...email } };
  };

  test('only the nine section ids are accepted', () => {
    expect(NOTIFY_SECTION_IDS).toEqual(['sources', 'quiet', 'esc', 'lock', 'keep', 'mail', 'wa', 'chan', 'log']);
    for (const id of NOTIFY_SECTION_IDS) expect(notifySection(id)).toBe(id);
    for (const bad of ['quiet-windows', 'wa-inner', '', 'SOURCES', 'constructor', 'toString', undefined, null, 3]) expect(notifySection(bad)).toBeNull();
  });

  test('the screen routes every outside section id through the guard', () => {
    const s = src('screens/system-notifications.ts');
    expect(s).not.toMatch(/as SecId/);
    expect(s).toMatch(/notifySection\(this\.section\)/);
    expect(s).toMatch(/private setSec\(id: string\) \{\s*const sec = notifySection\(id\);/);
  });

  test('a clean mail form follows the reloaded settings', () => {
    const before = settings();
    const after = settings({ host: 'smtp2.example.test', recipients: ['a@example.test', 'b@example.test'] });
    const draft = mailDraftOf(before);
    expect(mailDraftDirty(draft, before)).toBe(false);
    expect(mailDraftAfterReload(draft, before, after)).toEqual(mailDraftOf(after));
    expect(mailDraftAfterReload(draft, null, after)).toEqual(mailDraftOf(after)); // the first load
  });

  test('a revision conflict keeps an unsaved mail form as typed', () => {
    const before = settings();
    const after = { ...settings({ host: 'smtp2.example.test' }), revision: 9 };
    for (const typed of [{ host: 'smtp.typed.test' }, { recipients: 'a@example.test, c@example.test' }, { pwEdit: true, password: 'secret-typed' }, { port: '2525' }]) {
      const draft = { ...mailDraftOf(before), ...typed };
      expect(mailDraftDirty(draft, before)).toBe(true);
      expect(mailDraftAfterReload(draft, before, after)).toBe(draft);
    }
  });

  test('the screen reload uses the keep-the-draft rule', () => {
    const s = src('screens/system-notifications.ts');
    expect(s).toMatch(/this\.mail = mailDraftAfterReload\(this\.mail, before, s\);/);
    expect(s).not.toMatch(/this\.mail = mailDraftOf\(s\)/);
  });
});
