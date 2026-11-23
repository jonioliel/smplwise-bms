import { test, expect } from '@playwright/test';
import { SETTINGS_GROUPS, searchSettings, visibleGroups } from '../src/screens/system-index';

// I18N-EN-2490 (owner answer N52 = a): the settings search index carries English keywords beside the Hebrew ones, and the search reads
// both lists in either interface language. Node-only:
//   npx playwright test tests/unit-settings-search-en-2490.spec.ts --config=playwright.unit.config.ts

const all = SETTINGS_GROUPS.flatMap((g) => g.entries);
const HEB = /[֐-׿]/;

test('every entry has English keywords (the tickets entries follow the language through their own catalogue)', () => {
  for (const e of all) {
    if (e.tab === 'tickets') continue;
    expect(e.keywordsEn, e.href).toBeTruthy();
    expect(HEB.test(e.keywordsEn ?? ''), `${e.href}: English keywords without Hebrew letters`).toBe(false);
  }
});

test('an English word that is only a keyword finds its entry', () => {
  const groups = visibleGroups(false);
  const hrefs = (q: string) => searchSettings(groups, q).map((r) => r.entry.href);
  expect(hrefs('restore')[0]).toBe('#/system/diagnostics?tab=backup');
  expect(hrefs('timetable')).toContain('#/system/transit');
  expect(hrefs('codec')).toContain('#/system/security/cameras');
  expect(hrefs('ntp drift')).toEqual(['#/system/intercom-installer/clock']);
  expect(hrefs('Do Not Disturb')).toEqual(['#/system/notifications?section=quiet']); // case-insensitive, every word must match
  expect(hrefs('upgrade')).toContain('#/system/update');
});

test('Hebrew keywords keep working and the two languages may be mixed in one query', () => {
  const groups = visibleGroups(false);
  expect(searchSettings(groups, 'גיבוי')[0].entry.href).toBe('#/system/diagnostics?tab=backup');
  expect(searchSettings(groups, 'גיבוי restore').map((r) => r.entry.href)).toContain('#/system/diagnostics?tab=backup');
  expect(searchSettings(groups, 'restore webrtc')).toEqual([]);
});
