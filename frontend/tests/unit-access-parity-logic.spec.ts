import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PARITY_OUTCOMES, parityQueryString, type ParityRow } from '../src/api/access-parity';
import { auditQueryString } from '../src/api/access-status';
import {
  CHECKLIST,
  CHECKLIST_KEY,
  checklistProgress,
  countText,
  loadChecklist,
  outcomeText,
  outcomeTone,
  phrasePreview,
  rowLinks,
  saveChecklist,
  screenText,
  toggleItem,
  whyText,
} from '../src/access-control/parity-logic';
import { AUDIT_PERIODS, auditPeriodStart, auditPersonOf } from '../src/access-control/status-logic';
import { stationEventsHref } from '../src/screens/wiskey-stations-logic';
import { PARITY_HE } from '../src/i18n/access-parity';

// CR-036 S12: the pure logic of the parity segment, the display card's phrase preview, the action log's new filters, the stations
// drawer's entry-log link - and the guard that the per-screen switch (and any access-control display choice) is written only by a
// Settings screen, never from a screen header (owner answer 1 of 2026-10-12).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });
}

const row = (o: Partial<ParityRow>): ParityRow => ({ screen: 'people', feature: 'people', permission: 'access.people.read', route: '#/wiskey/people', source: null, expected_count: null, native: null, outcome: 'match', rule: null, reason: null, ...o });

test.describe('parity report rows', () => {
  test('every outcome the server sends has a word and a tone; an unknown one is "unknown"', () => {
    for (const o of PARITY_OUTCOMES) expect(PARITY_HE[`out_${o}` as keyof typeof PARITY_HE], o).toBeTruthy();
    expect(PARITY_OUTCOMES.map(outcomeTone)).toEqual(['live', 'neutral', 'error', 'partial', 'forbidden', 'unknown', 'offline']);
    expect(outcomeTone('brand_new')).toBe('unknown');
    expect(outcomeText('brand_new')).toBe(PARITY_HE.out_unavailable);
  });

  test('why: the rule that filtered, or what the outcome means', () => {
    expect(whyText(row({ outcome: 'filtered', rule: 'station_scope' }))).toBe(PARITY_HE.why_station_scope);
    expect(whyText(row({ outcome: 'filtered', rule: 'installation_wide' }))).toBe(PARITY_HE.why_installation_wide);
    expect(whyText(row({ outcome: 'filtered', rule: 'a_rule_from_the_future' }))).toBe(PARITY_HE.why_station_scope);
    expect(whyText(row({ outcome: 'not_permitted', rule: 'permission' }))).toBe(PARITY_HE.why_permission);
    expect(whyText(row({ outcome: 'mismatch' }))).toBe(PARITY_HE.why_mismatch);
    expect(whyText(row({ outcome: 'match' }))).toBe('');
  });

  test('counts: a dash when not read, "at least" when a side stopped at its cap', () => {
    expect(countText(null)).toBe('—');
    expect(countText({ count: 7, complete: true, digest: 'a' })).toBe('7');
    expect(countText({ count: 1000, complete: false, digest: null })).toBe('לפחות 1000');
    expect(screenText('schedules')).toBe('לוחות זמנים');
  });

  test('links: native only while the screen is switched on; the classic panel per visit for its own tabs; a Settings route is always native', () => {
    expect(rowLinks('#/wiskey/people', () => true)).toEqual({ native: '#/wiskey/people', classic: '#/wiskey/people?classic=1' });
    expect(rowLinks('#/wiskey/people', () => false)).toEqual({ native: null, classic: '#/wiskey/people?classic=1' });
    expect(rowLinks('#/wiskey/devices', () => false)).toEqual({ native: null, classic: '#/wiskey/devices?classic=1' });
    // the schedules screen: no switch in this build (null) and no top-level tab in the embedded panel
    expect(rowLinks('#/wiskey/schedules', () => null)).toEqual({ native: null, classic: null });
    expect(rowLinks('#/wiskey/schedules', () => true)).toEqual({ native: '#/wiskey/schedules', classic: null });
    expect(rowLinks('#/system/access-control/groups', () => false)).toEqual({ native: '#/system/access-control/groups', classic: null });
  });

  test('the query: as_user only when another user is chosen; the window in hours', () => {
    expect(parityQueryString({})).toBe('hours=24');
    expect(parityQueryString({ asUser: 'dev-sara', hours: 168 })).toBe('as_user=dev-sara&hours=168');
  });
});

test.describe('the side-by-side checklist (this browser only)', () => {
  const mem = () => {
    const m = new Map<string, string>();
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
  };

  test('ticks round-trip; unknown screens / items and foreign values are dropped; a blocked storage is harmless', () => {
    const s = mem();
    let state = toggleItem({}, 'people', 'item_people_count');
    state = toggleItem(state, 'events', 'item_last_events');
    saveChecklist(s, state);
    expect(loadChecklist(s)).toEqual({ people: { item_people_count: true }, events: { item_last_events: true } });
    s.setItem(CHECKLIST_KEY, JSON.stringify({ people: { item_people_count: true, item_made_up: true }, nowhere: { x: true }, events: { item_last_events: 'yes' } }));
    expect(loadChecklist(s)).toEqual({ people: { item_people_count: true } });
    s.setItem(CHECKLIST_KEY, '{not json');
    expect(loadChecklist(s)).toEqual({});
    const blocked = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); }, removeItem: () => { throw new Error('blocked'); } };
    expect(loadChecklist(blocked)).toEqual({});
    expect(() => saveChecklist(blocked, state)).not.toThrow();
    expect(loadChecklist(null)).toEqual({});
  });

  test('untick removes; clearing removes the key; progress counts the screens shown', () => {
    const s = mem();
    let state = toggleItem({}, 'people', 'item_people_count');
    state = toggleItem(state, 'people', 'item_people_count');
    expect(state).toEqual({});
    saveChecklist(s, {});
    expect(s.m.has(CHECKLIST_KEY)).toBe(false);
    const shown = CHECKLIST.filter((c) => c.screen !== 'schedules');
    const all = shown.reduce((n, c) => n + c.items.length, 0);
    expect(checklistProgress({ people: { item_people_count: true }, schedules: { item_schedule: true } }, shown)).toEqual({ done: 1, all });
    for (const c of CHECKLIST) for (const i of [c.label, ...c.items]) expect(PARITY_HE[i], i).toBeTruthy();
  });
});

test.describe('the stations-screen display card', () => {
  test('phrase preview: empty = built-in; long and surplus lines are counted as left out (8 x 160, as the announce dialog)', () => {
    expect(phrasePreview('')).toEqual({ shown: 0, dropped: 0, builtIn: true });
    expect(phrasePreview('  \n\n ')).toEqual({ shown: 0, dropped: 0, builtIn: true });
    expect(phrasePreview('נא לפנות לקבלה\n  החניון סגור  ')).toEqual({ shown: 2, dropped: 0, builtIn: false });
    const ten = Array.from({ length: 10 }, (_, i) => `משפט ${i + 1}`).join('\n');
    expect(phrasePreview(ten)).toEqual({ shown: 8, dropped: 2, builtIn: false });
    expect(phrasePreview(`קצר\n${'א'.repeat(161)}`)).toEqual({ shown: 1, dropped: 1, builtIn: false });
  });
});

test.describe('the intercom action log filters', () => {
  test('a period is a start instant (UTC, whole seconds); "any time" sends none', () => {
    const now = new Date('2026-09-27T10:30:15.678Z');
    expect(AUDIT_PERIODS).toEqual(['', '24h', '7d', '30d']);
    expect(auditPeriodStart('', now)).toBeUndefined();
    expect(auditPeriodStart('24h', now)).toBe('2026-09-26T10:30:15Z');
    expect(auditPeriodStart('7d', now)).toBe('2026-09-20T10:30:15Z');
    expect(auditPeriodStart('30d', now)).toBe('2026-08-28T10:30:15Z');
    expect(auditPeriodStart('1y', now)).toBeUndefined();
  });

  test('the person a record names can narrow the log; the query carries user_id and start', () => {
    expect(auditPersonOf({ person: { id: 'u1', display_name: 'דנה', employee_no: '1001' } })).toEqual({ id: 'u1', name: 'דנה' });
    expect(auditPersonOf({ person: { id: 'u3', display_name: null, employee_no: '1050' } })).toEqual({ id: 'u3', name: '1050' });
    expect(auditPersonOf({ person: { id: null, display_name: 'x', employee_no: null } })).toBeNull();
    expect(auditQueryString({ user_id: 'u1', start: '2026-09-26T10:30:15Z' })).toBe('user_id=u1&start=2026-09-26T10%3A30%3A15Z&limit=50');
  });
});

test.describe('navigation', () => {
  test('the stations drawer links to the entry log of the station only while the entry log is native and readable', () => {
    expect(stationEventsHref('entry-a', true, true)).toBe('#/wiskey/events?station=entry-a');
    expect(stationEventsHref('a b/c', true, true)).toBe('#/wiskey/events?station=a%20b%2Fc');
    expect(stationEventsHref('entry-a', false, true)).toBeNull();
    expect(stationEventsHref('entry-a', true, false)).toBeNull();
  });

  test('the per-screen switch and the access-control display choices are written by Settings screens only (no header switch)', () => {
    const writes = /patchSettings\(|patch(<[^>]*>)?\(\s*'settings'/;
    const accessKeys = /access\.(ui\.|call_hint|talk_button|announce_scope|announce_phrases|phone_embed)|ui\.hide_wiskey/;
    const offenders: string[] = [];
    for (const f of files(SRC)) {
      const rel = path.relative(SRC, f).split(path.sep).join('/');
      const text = readFileSync(f, 'utf8');
      if (!writes.test(text)) continue;
      // an operator screen of the access-control area never writes a product setting at all
      if (/^(screens\/wiskey-|access-control\/|components\/wk-)/.test(rel)) offenders.push(rel);
      // a writer that names an access-control display setting must be a Settings screen (or the typed settings client)
      else if (accessKeys.test(text) && !/^screens\/system-[a-z-]+\.ts$/.test(rel) && rel !== 'api/media.ts') offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
