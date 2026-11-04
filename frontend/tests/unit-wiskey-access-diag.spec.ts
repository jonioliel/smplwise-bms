import { test, expect } from '@playwright/test';
import {
  DIAG_ROUTE, VIEWS, cleanReason, dayText, diagHref, diffText, doorChoices, doorKey, doorLabel, expiringFirst, instantText, issueText, parseDoorKey, relationText,
  remainingText, rowsByStation, scenarioLines, sourceText, validityText, viewOf, viewState,
} from '../src/access-control/access-diag-logic';
import { DIAG_HE, dt, dtDyn } from '../src/i18n/access-diag';
import { DEEP_LINKS, deepLinksFor, linkFor } from '../src/wiskey/deep-links';
import { parseRoute } from '../src/router';
import type { CompareRow, DiagHome, DiagStation, GrantSide, LifeRow, Scenario } from '../src/api/access-diag';
import type { DisplayZone } from '../src/api/intercom';

// WISKEY-ACCESS-DIAG-2400 (plan task T10): the pure part of the "אבחון הרשאות" screen - its route and views, the door choices, the
// scenario's explanation, the comparison / quality / lifecycle texts, the time in the installation's zone - and the deep-link table's native
// routes. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-access-diag.spec.ts

const JERUSALEM: DisplayZone = { kind: 'iana', name: 'Asia/Jerusalem' };
const BANNED = /wiskey|home\s*assistant|hikvision|ingress|supervisor|\bHA\b/i;

const STATIONS: DiagStation[] = [
  { id: 'entry-a', name: 'שער ראשי', online: true, zone: null, doors: [{ lock_id: 1, name: null }] },
  { id: 'entry-c', name: 'רציף', online: false, zone: null, doors: [{ lock_id: 1, name: 'שער' }, { lock_id: 2, name: null }] },
];

const side = (over: Partial<GrantSide> = {}): GrantSide => ({ granted: true, configured: true, source: 'inherited', groups: [{ id: 'staff', name: 'צוות' }], override: null, sources_known: true, ...over });

function scenario(over: Partial<Scenario['desired']> = {}, extra: Partial<Scenario> = {}): Scenario {
  return {
    person_revision: 4, station_id: 'entry-a', lock_id: 1, at: '2026-11-04T08:00:00+00:00',
    desired: { allowed: false, reason: 'outside_schedule', timing_mode: 'ha', draft_ignored: false, ...over },
    observed: { sync_state: 'synced', last_sync_at: '2026-11-03T08:00:00+00:00', revision_matches: true,
                timing: { status: 'unavailable', mode: null, checked_at: null, valid_from: null, valid_until: null, interval_contains_target: null } },
    station_status: 'online', physical_result: 'not_verified', source: side(),
    person: { kind: 'person', id: 'u1', name: 'דנה כהן', active: true, archived: false, valid_from: null, valid_until: '2026-12-01T00:00:00+00:00', timing_mode: 'ha' },
    ...extra,
  };
}

test.describe('the route and the views', () => {
  test('a view per tab, the scenario by default; an unknown view is the scenario', () => {
    expect([...VIEWS]).toEqual(['scenario', 'compare', 'reviews', 'quality', 'lifecycle', 'audit', 'sync']);
    expect(viewOf(parseRoute('#/wiskey/access-diag').params)).toBe('scenario');
    expect(viewOf(parseRoute('#/wiskey/access-diag?view=reviews').params)).toBe('reviews');
    expect(viewOf(parseRoute('#/wiskey/access-diag?view=nope').params)).toBe('scenario');
    expect(diagHref('scenario')).toBe(`#${DIAG_ROUTE}`);
    expect(diagHref('audit')).toBe('#/wiskey/access-diag?view=audit');
  });

  test('a view is offered by the installed system, and a people view needs people', () => {
    const home = (available: boolean, people: boolean): DiagHome => ({
      feed: 'ready', doors: [], default_zone: null, can: { people, decide: false, sensitive: false, employee_no: false },
      features: Object.fromEntries(['pickers', 'scenario', 'compare', 'compare_doors', 'reviews', 'review_decide', 'quality', 'lifecycle', 'sync', 'permission_audit']
        .map((f) => [f, { available, reason: available ? null : 'not_listed' }])) as DiagHome['features'],
    });
    expect(viewState(home(true, true), 'reviews')).toBe('ok');
    expect(viewState(home(false, true), 'reviews')).toBe('unsupported');
    expect(viewState(home(true, false), 'reviews')).toBe('people');
    expect(viewState(home(true, false), 'sync')).toBe('ok'); // sync names no person
    expect(viewState(null, 'audit')).toBe('ok');
  });
});

test.describe('doors', () => {
  test('every door of every station; a single unnamed door is the station; the key round-trips', () => {
    const c = doorChoices(STATIONS);
    expect(c.map((x) => `${x.key}=${x.label}`)).toEqual(['entry-a:1=שער ראשי', 'entry-c:1=רציף · שער', 'entry-c:2=רציף · דלת 2']);
    expect(c[1].online).toBe(false);
    expect(parseDoorKey(doorKey('entry-c', 2))).toEqual({ station_id: 'entry-c', lock_id: 2 });
    expect(parseDoorKey('entry-c:3')).toBeNull();
    expect(parseDoorKey('a:b:1')).toEqual({ station_id: 'a:b', lock_id: 1 });
    expect(doorLabel(STATIONS, 'entry-c', 2)).toBe('רציף · דלת 2');
    expect(doorLabel(STATIONS, 'gone', 1)).toBe('gone');
    expect(doorChoices(null)).toEqual([]);
  });
});

test.describe('time in the installation zone (never a fixed offset)', () => {
  test('an instant, a day, the validity', () => {
    expect(instantText('2026-11-04T08:00:00+00:00', JERUSALEM)).toBe('4.11.2026 10:00');
    expect(instantText('2026-07-04T08:00:00Z', JERUSALEM)).toBe('4.7.2026 11:00'); // summer time
    expect(instantText('2026-11-04T08:00:00', JERUSALEM)).toBe(''); // not an aware instant
    expect(dayText('2026-12-01T00:00:00+00:00', JERUSALEM)).toBe('1.12.2026');
    expect(validityText(null, null, JERUSALEM)).toBe('ללא הגבלת תוקף');
    expect(validityText(null, '2026-12-01T00:00:00+00:00', JERUSALEM)).toBe('עד 1.12.2026');
    expect(validityText('2026-11-01T00:00:00+00:00', '2026-12-01T00:00:00+00:00', JERUSALEM)).toBe('1.11.2026 – 1.12.2026');
  });

  test('how long until an expiry', () => {
    expect(remainingText(6 * 86_400)).toBe('בעוד 6 ימים');
    expect(remainingText(5 * 3600)).toBe('בעוד 5 שעות');
    expect(remainingText(-3600)).toBe('היום');
    expect(remainingText(-3 * 86_400)).toBe('לפני 3 ימים');
    expect(remainingText(null)).toBe('');
  });
});

test.describe('"can X open door Y": the explanation', () => {
  test('the reason first, then the source, validity, schedule, holidays, station and sync', () => {
    const lines = scenarioLines(scenario(), { name: 'שער ראשי', online: true }, JERUSALEM);
    expect(lines.map((l) => l.id)).toEqual(['reason', 'source', 'validity', 'schedule', 'holidays', 'station', 'sync']);
    expect(lines[0]).toMatchObject({ tone: 'bad', text: 'מחוץ ללוח הזמנים שלו בשעה הזו.' });
    expect(lines[1].text).toBe('ההרשאה מגיעה מקבוצה: צוות');
    expect(lines.find((l) => l.id === 'schedule')!.tone).toBe('bad');
    expect(lines.find((l) => l.id === 'holidays')!.text).toBe('מערכת בקרת הכניסה אינה מחשבת חגים בבדיקה הזו.');
    expect(lines.find((l) => l.id === 'sync')!.text).toBe('מסונכרן · סנכרון אחרון 3.11.2026 10:00');
  });

  test('every reason the system gives has words; an unknown one is said to be unknown', () => {
    for (const r of ['allowed', 'archived', 'inactive', 'no_assignment', 'lock_not_assigned', 'outside_validity', 'outside_schedule'] as const) {
      expect(DIAG_HE).toHaveProperty(`r_${r}`);
    }
    const unknown = scenarioLines(scenario({ reason: 'unknown' }), null, JERUSALEM);
    expect(unknown[0].text).toBe(dt('r_unknown'));
    const ok = scenarioLines(scenario({ allowed: true, reason: 'allowed' }), null, JERUSALEM);
    expect(ok[0].tone).toBe('ok');
  });

  test('a personal block, a station offline, a sync behind, the station\'s last timing evidence', () => {
    const s = scenario({ reason: 'lock_not_assigned' }, {
      source: side({ granted: false, source: 'personal_deny', groups: [], override: 'deny' }),
      observed: { sync_state: 'pending', last_sync_at: null, revision_matches: false,
                  timing: { status: 'historical', mode: 'ha', checked_at: '2026-11-03T08:00:00+00:00', valid_from: '2026-11-03T04:00:00+00:00', valid_until: '2026-11-03T15:00:00+00:00', interval_contains_target: false } },
    });
    const lines = scenarioLines(s, { name: 'רציף', online: false }, JERUSALEM);
    expect(lines.find((l) => l.id === 'source')).toMatchObject({ tone: 'bad', text: 'חסימה אישית בעמדה הזו' });
    expect(lines.find((l) => l.id === 'station')).toMatchObject({ tone: 'warn', text: 'רציף · לא מחוברת' });
    expect(lines.find((l) => l.id === 'sync')!.text).toBe('ממתין לסנכרון · השינוי האחרון עדיין לא הגיע לעמדה.');
    expect(lines.find((l) => l.id === 'evidence')!.text).toBe('בדיקה אחרונה בעמדה (3.11.2026 10:00): 3.11.2026 06:00 – 3.11.2026 17:00');
    expect(sourceText(null)).toBe('מקור ההרשאה לא ידוע');
  });
});

test.describe('comparisons, quality, lifecycle, audit', () => {
  test('relations name the two sides; rows group by station', () => {
    expect(relationText('left_only', 'דנה', 'יוסי')).toBe('רק דנה');
    expect(relationText('right_only', 'דנה', 'יוסי')).toBe('רק יוסי');
    expect(relationText('shared', 'דנה', 'יוסי')).toBe('שניהם');
    const row = (sid: string, lock: 1 | 2): CompareRow => ({ station_id: sid, station_name: sid, lock_id: lock, relation: 'shared', left: side(), right: side() });
    expect(rowsByStation([row('a', 1), row('a', 2), row('b', 1)]).map((g) => `${g.station_id}:${g.rows.length}`)).toEqual(['a:2', 'b:1']);
  });

  test('quality issues name the field, never the value', () => {
    expect(issueText({ kind: 'missing', code: 'missing_phone', field_id: '', label: '', related_count: 0, related_people: [] })).toBe('חסר מספר טלפון');
    expect(issueText({ kind: 'missing', code: 'profile_required', field_id: 'dept', label: 'מחלקה', related_count: 0, related_people: [] })).toBe('חסר שדה חובה: מחלקה');
    expect(issueText({ kind: 'duplicate', code: 'duplicate_profile', field_id: 'badge', label: 'תג', related_count: 1, related_people: [] })).toBe('ערך זהה בשדה ייחודי: תג');
    expect(issueText({ kind: 'invalid', code: 'something_new', field_id: '', label: '', related_count: 0, related_people: [] })).toBe('בעיה בנתונים');
    expect(diffText('pin')).toBe('קוד');
    expect(diffText('teleport')).toBe('אחר');
  });

  test('expiring first (soonest first), then the expired (most recent first)', () => {
    const r = (id: string, state: string, s: number): LifeRow => ({ id, display_name: id, employee_no: null, access_category: 'staff', active: true, valid_from: null, valid_until: null,
                                                                     assignment_count: 1, state, seconds_remaining: s });
    expect(expiringFirst([r('gone2', 'expired', -9000), r('late', 'expiring', 9000), r('gone1', 'expired', -10), r('soon', 'expiring', 100)]).map((x) => x.id))
      .toEqual(['soon', 'late', 'gone1', 'gone2']);
  });

  test('a decision reason: one line, 1..500 characters', () => {
    expect(cleanReason('  נבדק\n מול   הרשימה ')).toBe('נבדק מול הרשימה');
    expect(cleanReason('   ')).toBeNull();
    expect(cleanReason('x'.repeat(501))).toBeNull();
    expect(cleanReason('ok\u0001')).toBeNull();
  });
});

test.describe('the words', () => {
  test('Hebrew, no platform name, every slot filled', () => {
    for (const [k, v] of Object.entries(DIAG_HE)) {
      expect(v, k).not.toMatch(BANNED);
      const words = String(v).replace(/\{\w+\}/g, '');
      if (/\p{L}/u.test(words)) expect(words, k).toMatch(/[֐-׿]/); // a text with words says them in Hebrew (slots and punctuation aside)
    }
    expect(dt('doorLabel', { station: 'א', n: 2 })).toBe('א · דלת 2');
    expect(dtDyn('st_nope', 'st_unknown')).toBe('לא ידוע');
  });
});

test.describe('the deep-link table: native routes replace the panel links', () => {
  test('reviews, compare and quality open "אבחון הרשאות"; the scenario and the station audit join the stations screen', () => {
    expect(linkFor('access.reviews')).toBe('#/wiskey/access-diag?view=reviews');
    expect(linkFor('access.compare')).toBe('#/wiskey/access-diag?view=compare');
    expect(linkFor('people.quality')).toBe('#/wiskey/access-diag?view=quality');
    expect(linkFor('access.scenario')).toBe('#/wiskey/access-diag');
    expect(linkFor('stations.permission_audit')).toBe('#/wiskey/access-diag?view=audit');
    for (const id of ['access.reviews', 'access.compare', 'people.quality', 'access.scenario', 'stations.permission_audit']) {
      expect(DEEP_LINKS[id].native?.need, id).toEqual(['access.read']);
      expect(DEEP_LINKS[id].target.tab, id).toBeTruthy(); // the panel place stays, for the screen's own fallback
    }
    // a caller who holds no access.read anywhere is not offered the native links
    expect(deepLinksFor('people', { panel: false, admin: false, can: () => false })).toEqual([]);
    const native = deepLinksFor('stations', { panel: false, admin: false, can: (p) => p === 'access.read' });
    // (the capacity view of WISKEY-OPS-VIEWS-2400 also follows access.read - it joins the same menu in the 2.40.0 train)
    expect(native.map((l) => `${l.id}:${l.kind}`)).toEqual(['health.fleet:native', 'access.scenario:native', 'stations.permission_audit:native']);
  });
});
