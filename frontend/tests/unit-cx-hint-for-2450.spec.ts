import { test } from '@playwright/test';
import type { Calendar, Occurrence } from '../src/api/calendars';
import { hintFor, type Candidate, type HintSettings } from '../src/calendars/grid-logic';
import { expectRecorded } from './cx-record';

// CR-FE-COMPLEXITY-2450: characterisation of hintFor (calendars/grid-logic.ts) before its split. Calendars x candidates x (busy, settings)
// scenarios; the answers must equal the record taken from the unsplit function (tests/fixtures/cx/hint-for.json). Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-hint-for-2450.spec.ts --workers=1

const DAY = new Date(2026, 10, 3); // Tuesday 3.11.2026 (local; the unit config pins the zone)
const SAT = new Date(2026, 10, 7);
const MON = new Date(2026, 10, 2);
const NOW = new Date(2026, 10, 3, 8, 20);
const at = (h: number, m = 0, d = DAY) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
const iso = (h: number, m = 0, d = DAY) => at(h, m, d).toISOString();
const cal = (o: Partial<Calendar> = {}): Calendar => ({
  id: 'gym', name: 'אולם ספורט', type: 'room', color: 'blue', tz: 'Asia/Jerusalem', owner: { id: 'u1', name: 'דנה לוי' }, my_role: 'book', visibility: 'members', approval_mode: 'none',
  approval_timeout_h: 2, capacity: 60, equipment: [], floor_id: null, area_ref: null, conflict_policy: 'exclusive', buffer_after_min: 0, buffer_before_min: 0, slot_step_min: 15,
  min_minutes: 15, max_minutes: 180, overlap_override: null, sync: null, pending_count: 0, archived: false, revision: 1, approved_move: 'reapproval',
  open_hours: { weekdays: [1, 2, 3, 4, 5, 7], start: '07:00', end: '21:00' }, ...o,
});
const occ = (id: string, s: string, e: string, o: Partial<Occurrence> = {}): Occurrence => ({
  occurrence_id: id, event_id: id, calendar_id: 'gym', room_calendar_ids: [], start: s, end: e, title: id, state: 'confirmed', kind: 'booking', on_behalf_label: null, organizer: null,
  recurring: false, ...o,
});

const CALS: Array<[string, Calendar]> = [
  ['book', cal()], ['manage', cal({ my_role: 'manage' })], ['edit', cal({ my_role: 'edit' })], ['view', cal({ my_role: 'view' })], ['none', cal({ my_role: null as never })],
  ['always', cal({ approval_mode: 'always' })], ['always-mgr', cal({ approval_mode: 'always', my_role: 'manage' })], ['behalf', cal({ approval_mode: 'on_behalf' })],
  ['outside', cal({ approval_mode: 'outside_hours' })], ['no-hours', cal({ open_hours: null as never, owner: null as never })],
  ['step30-cap10', cal({ slot_step_min: 30, capacity: 10, min_minutes: 60, max_minutes: 90 })], ['overlap', cal({ conflict_policy: 'overlap' as never, max_minutes: 0 as never, min_minutes: 0 as never })],
  ['buffers', cal({ buffer_before_min: 15, buffer_after_min: 10, overlap_override: 'block' as never })], ['mgr-move', cal({ approved_move: 'managers', approval_mode: 'always' })],
  ['no-policy', cal({ conflict_policy: undefined as never, buffer_after_min: undefined as never, buffer_before_min: undefined as never, overlap_override: 'override_notify' as never })],
];
const CANDS: Array<[string, Omit<Candidate, 'cal'>]> = [
  ['plain', { start: at(9), end: at(10) }], ['past', { start: at(8), end: at(9) }], ['started', { start: at(8), end: at(10), started: true }],
  ['started-over', { start: at(7), end: at(8), started: true }], ['late', { start: at(20, 30), end: at(21, 30) }], ['early', { start: at(6, 45), end: at(7, 30) }],
  ['long', { start: at(9), end: at(13) }], ['short', { start: at(9), end: at(9, 10) }], ['odd-step', { start: at(9, 5), end: at(10, 5) }],
  ['saturday', { start: at(10, 0, SAT), end: at(11, 0, SAT) }], ['monday', { start: at(10, 0, MON), end: at(11, 0, MON) }],
  ['whole-day', { start: at(0), end: new Date(2026, 10, 4) }], ['crowd', { start: at(11), end: at(12), headcount: 12 }],
  ['behalf-team', { start: at(11), end: at(12), behalf: 'team' }], ['behalf-self', { start: at(11), end: at(12), behalf: 'self' }],
  ['move-confirmed', { start: at(9, 30), end: at(10, 30), moving: 'confirmed' }], ['move-pending', { start: at(9), end: at(10), ignoreId: 'a', moving: 'pending' }],
  ['clash', { start: at(9, 30), end: at(10, 30) }], ['touch', { start: at(10), end: at(10, 30) }], ['maint', { start: at(13), end: at(13, 30) }],
];
const BUSY: Occurrence[] = [
  occ('a', iso(9), iso(10)), occ('p', iso(10, 30), iso(11, 30), { state: 'pending', title: '' }), occ('m', iso(12, 45), iso(14), { kind: 'maintenance', title: 'ניקיון' }),
  occ('m2', iso(12, 50), iso(13, 10), { kind: 'maintenance', title: '' }), occ('mp', iso(13), iso(13, 20), { kind: 'maintenance', state: 'pending' }),
  occ('other', iso(9), iso(12), { calendar_id: 'hall' }), occ('room', iso(9, 45), iso(10, 15), { calendar_id: 'hall', room_calendar_ids: ['gym'], title: '' }),
  occ('x', iso(15), iso(16), { state: 'cancelled' as never }),
];
const S: HintSettings = { contested_requests: 'queue', maintenance_overlap: 'first_holds', editors_bypass_approval: true, pending_holds_slot: false };
const SCENARIOS: Array<[string, Occurrence[], HintSettings]> = [
  ['empty', [], S], ['busy', BUSY, S], ['busy-reject', BUSY, { ...S, contested_requests: 'reject', maintenance_overlap: 'override_notify' }],
  ['busy-holds', BUSY, { ...S, pending_holds_slot: true, maintenance_overlap: 'block', editors_bypass_approval: false }],
];

test('hintFor: every answer equals the record of the unsplit function', () => {
  const out = CALS.flatMap(([c, calendar]) =>
    CANDS.flatMap(([k, cand]) =>
      SCENARIOS.map(([sc, busy, s]) => {
        const hint = hintFor({ cal: calendar, ...cand }, busy, s, NOW);
        // the contested entry is one of BUSY, passed through: recorded by id (the identity is asserted too)
        if (hint.contested && !busy.includes(hint.contested)) throw new Error('contested is not an entry of the busy list');
        return { c, k, sc, hint: { ...hint, contested: hint.contested?.occurrence_id ?? null } };
      }),
    ),
  );
  expectRecorded('hint-for', out);
});
