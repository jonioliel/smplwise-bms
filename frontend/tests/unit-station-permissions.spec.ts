import { test, expect } from '@playwright/test';
import { addChoices, blockNotice, doorsText, outcomeKey, rowButtons, sourceBadge, stationLabel, syncBadge } from '../src/access-control/station-permissions-logic';
import { SP_KEYS, SP_TABLES, spt } from '../src/i18n/station-permissions';
import type { SpPerson, SpStation } from '../src/api/station-permissions';

// STATIONPERM-295: the pure logic and the words of the person's per-station access block. Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-station-permissions.spec.ts

const NONE = { allow: false, deny: false, inherit: false, approve: false, refuse: false, sync: false };
const st = (over: Partial<SpStation> = {}): SpStation => ({
  station_id: 'st-a', name: 'כניסה ראשית', enabled: true, relays: [1], source: 'group', record: null, request: null, revision: 0, decides: true,
  request_only: false, actions: { ...NONE }, ...over,
});
const person = (over: Partial<SpPerson> = {}): SpPerson => ({
  person_id: 'wk-p1', read: 'fresh', wiskey_revision: 3, timing_mode: null, grant_live: false, self: false, system_admin: false, stations: [st()],
  addable: [], ...over,
});

test('every word exists in the four languages with the same placeholders, and no text names the home platform', () => {
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(SP_TABLES[lang]).sort()).toEqual([...SP_KEYS].sort());
    for (const k of SP_KEYS) {
      const v = SP_TABLES[lang][k];
      expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(ph(v), `${lang}.${k}`).toBe(ph(SP_TABLES.he[k]));
      expect(v, `${lang}.${k}`).not.toMatch(/home assistant|\bHA\b|ingress|companion|אינטרקום|intercom/i);
    }
  }
  const all = Object.values(SP_TABLES).flatMap((t) => Object.values(t)).join(' ');
  expect(all).not.toMatch(/wiskey|Wiskey|WISKEY|ויסקי/);
  expect(spt('confirmDeny', { station: 'A' }, 'en')).toBe('Block A?');
});

test('the source and sync chips', () => {
  expect(sourceBadge('group').kind).toBe('neutral');
  expect(sourceBadge('personal').kind).toBe('live');
  expect(sourceBadge('blocked').kind).toBe('error');
  expect(sourceBadge('unknown').kind).toBe('unknown');
  expect(syncBadge('pending')?.kind).toBe('stale');
  expect(syncBadge('failed')?.kind).toBe('error');
  expect(syncBadge('none')).toBeNull();
  expect(syncBadge(null)).toBeNull();
});

test('the row buttons follow the server and a fixed order', () => {
  expect(rowButtons(st())).toEqual([]);
  const all = st({ actions: { allow: true, deny: true, inherit: true, approve: false, refuse: false, sync: true }, source: 'blocked' });
  expect(rowButtons(all).map((b) => b.action)).toEqual(['allow', 'inherit', 'deny', 'sync']);
  // a personal station offers no second "allow"
  expect(rowButtons(st({ source: 'personal', actions: { ...NONE, allow: true, deny: true } })).map((b) => b.action)).toEqual(['deny']);
  // a waiting request: approve first; the requester sees "withdraw"
  const req = { effect: 'allow' as const, relays: [1], requested_at: null, requested_by_name: 'מונה', mine: true };
  const mine = rowButtons(st({ request: req, actions: { ...NONE, refuse: true, allow: true } }));
  expect(mine.map((b) => [b.action, b.label])).toEqual([['refuse', spt('withdraw')]]);
  const holder = rowButtons(st({ request: { ...req, mine: false }, actions: { ...NONE, approve: true, refuse: true } }));
  expect(holder.map((b) => b.action)).toEqual(['approve', 'refuse']);
  expect(holder[0].primary).toBe(true);
});

test('one notice at a time, in order of weight', () => {
  expect(blockNotice(person())).toBeNull();
  expect(blockNotice(person({ grant_live: true, self: true, read: 'unavailable' }))).toBe('grantLive');
  expect(blockNotice(person({ self: true }))).toBe('self');
  expect(blockNotice(person({ self: true, system_admin: true }))).toBeNull();
  expect(blockNotice(person({ read: 'unavailable' }))).toBe('unavailable');
});

test('doors, labels, add choices and the outcome line', () => {
  expect(doorsText([1])).toBe('');
  expect(doorsText([])).toBe('');
  expect(doorsText([1, 2], )).toBe(spt('doors', { doors: '1, 2' }));
  expect(stationLabel({ station_id: 'st-x', name: null }, { 'st-x': 'חניון' })).toBe('חניון');
  expect(stationLabel({ station_id: 'st-x', name: null }, {})).toBe('st-x');
  const p = person({ addable: [{ station_id: 'st-z', name: 'צ', relays: [1], request_only: false }, { station_id: 'st-a', name: 'dup', relays: [1], request_only: false },
    { station_id: 'st-b', name: 'ב', relays: [1, 2], request_only: true }] });
  expect(addChoices(p).map((s) => s.station_id)).toEqual(['st-b', 'st-z']);
  expect(outcomeKey('requested')).toBe('requestSent');
  expect(outcomeKey('decided')).toBe('done');
});

// GRANTDENY-295: a personal deny over a station a group still grants is said on the row; removing a personal allow reads as a removal.
test('a personal deny over a group grant has its own chip, and the removal of a personal allow its own label', () => {
  expect(sourceBadge('blocked_group').kind).toBe('error');
  expect(sourceBadge('blocked_group').label).toBe(spt('src_blocked_group'));
  expect(sourceBadge('blocked_group').label).not.toBe(sourceBadge('blocked').label);
  const personal = rowButtons(st({ source: 'personal', actions: { ...NONE, inherit: true, deny: true } }));
  expect(personal.map((b) => [b.action, b.label])).toEqual([['inherit', spt('removePersonal')], ['deny', spt('deny')]]);
  const blocked = rowButtons(st({ source: 'blocked_group', actions: { ...NONE, inherit: true } }));
  expect(blocked.map((b) => [b.action, b.label])).toEqual([['inherit', spt('inherit')]]);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(spt('src_blocked_group', undefined, lang).length).toBeGreaterThan(0);
    expect(spt('removePersonal', undefined, lang).length).toBeGreaterThan(0);
  }
});
