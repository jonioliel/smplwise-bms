import { test, expect } from '@playwright/test';
import {
  bodyOf, codeDue, confirmedNumber, daySpan, doorsBody, eligibility, freshForm, keepRequestable, phoneOk, rangeDates, selfBlock, timingOf, validate, windowOf,
  type Ctx, type RequestForm,
} from '../src/access-external/request-model';
import { actionsOf } from '../src/access-external/model';
import { RT_KEYS, RT_TABLES, rt } from '../src/i18n/access-request';
import type { Contact } from '../src/api/tickets-s4';
import type { Grant, GrantableDoors } from '../src/api/access-grants';
import { grantOf } from './access-external-mocks';

// ACCESSREQ-293: the pure logic of the manual "request external access" form and its words. Runs in Node (no page):
//   npx playwright test tests/unit-access-request.spec.ts --project=desktop

const TZ = 'Asia/Jerusalem';
const station = (id: string, over: Partial<GrantableDoors['stations'][number]> = {}) => ({
  station_id: id, name: id, online: true, relays: [{ relay: 1, name: null }], may_request: true, may_approve: true, may_approve_pin: true, entrance: false, ticket: false, ...over,
});
const grantable = (over: Partial<GrantableDoors> = {}): GrantableDoors => ({
  stations: [station('st-a'), station('st-b', { may_approve: false, may_approve_pin: false })], max_doors: 4, max_days: 14, tickets_requester: false, system_admin: true,
  as_of: '2026-10-20T06:41:00Z', reachable: true, has_copy: true, ...over,
});
const contact = (over: Partial<Contact> = {}): Contact => ({
  id: 'c1', kind: 'person', vendor_id: null, vendor_name: null, user_linked: false, display_name: 'יוסי', company: '', phone: '····42', phone_full: false, has_phone: true, email: null,
  preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: 'he', notes: '', active: true, erased: false, departments: [], open_tickets: 0, last_assigned_at: null,
  revision: 1, phone_confirmed: true, phone_confirmed_via: 'code', ...over,
});
const ctx = (over: Partial<Ctx> = {}): Ctx => ({ today: '2026-10-20', maxDoors: 4, maxDays: 14, grantable: grantable(), contact: contact(), approvers: 2, ...over });
const filled = (over: Partial<RequestForm> = {}): RequestForm => ({
  ...freshForm(), contactId: 'c1', doors: new Set(['st-a:1']), from: '2026-10-21', until: '2026-10-22', told: true, ...over,
});

test('every word exists in the four languages with the same placeholders, and no text names the home platform', () => {
  const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    expect(Object.keys(RT_TABLES[lang]).sort()).toEqual([...RT_KEYS].sort());
    for (const k of RT_KEYS) {
      const v = RT_TABLES[lang][k];
      expect(v.trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(ph(v), `${lang}.${k}`).toBe(ph(RT_TABLES.he[k]));
      expect(v, `${lang}.${k}`).not.toMatch(/home assistant|\bHA\b|ingress|companion|אינטרקום|intercom/i);
    }
  }
  // owner decision (SHAREDID 1): the product is "WisKey" - spelled the same everywhere
  const all = Object.values(RT_TABLES).flatMap((t) => Object.values(t)).join(' ');
  expect(all).not.toMatch(/wiskey|Wiskey|WISKEY|ויסקי/);
  expect(rt('daysOf', { n: 2, max: 14 }, 'en')).toBe('2 days · max 14');
});

test('an empty form names every missing field; a filled one passes', () => {
  const e = validate(freshForm(), ctx({ contact: null }));
  expect(Object.keys(e).sort()).toEqual(['dates', 'doors', 'person', 'told']);
  expect(validate(filled(), ctx())).toEqual({});
  const n = validate({ ...freshForm(), mode: 'new', np: { name: 'ג', company: '', phone: '05-12', lang: 'he' } }, ctx());
  expect(n.npName?.key).toBe('err_npName');
  expect(n.npPhone?.key).toBe('err_npPhone');
  expect(validate({ ...filled(), mode: 'new', contactId: null, np: { name: 'גיא כהן', company: '', phone: '050-1234567', lang: 'he' } }, ctx()).npPhone).toBeUndefined();
});

test('the field rules mirror the server: doors, days, windows, purpose, approvers', () => {
  expect(validate(filled({ doors: new Set(['a:1', 'a:2', 'b:1', 'c:1', 'd:1']) }), ctx()).doors).toEqual({ key: 'err_doorsMany', vars: { max: 4, n: 1 } });
  expect(validate(filled({ until: '2026-10-20' }), ctx()).dates?.key).toBe('err_datesOrder');
  expect(validate(filled({ from: '2026-10-10', until: '2026-10-19' }), ctx()).dates?.key).toBe('err_datesPast');
  expect(validate(filled({ until: '2026-11-04' }), ctx()).dates).toEqual({ key: 'err_datesLong', vars: { max: 14 } }); // 21.10..4.11 = 15 days
  expect(validate(filled({ until: '2026-11-03' }), ctx()).dates).toBeUndefined(); // 21.10..3.11 = 14 days
  expect(validate(filled({ until: '2026-10-25' }), ctx({ maxDays: 3 })).dates?.key).toBe('err_datesLong');
  expect(validate(filled({ days: new Set() }), ctx()).days?.key).toBe('err_days');
  expect(validate(filled({ dmode: 'dates' }), ctx()).days?.key).toBe('err_datesNone');
  expect(validate(filled({ wins: [{ s: '16:00', e: '07:00' }] }), ctx()).wins?.key).toBe('err_winsOrder');
  expect(validate(filled({ wins: [{ s: '07:00', e: '12:00' }, { s: '11:00', e: '18:00' }] }), ctx()).wins?.key).toBe('err_winsOverlap');
  expect(validate(filled({ wins: [{ s: '07:00', e: '12:00' }, { s: '12:00', e: '24:00' }] }), ctx()).wins).toBeUndefined();
  expect(validate(filled({ purpose: 'x'.repeat(201) }), ctx()).purpose?.key).toBe('err_purpose');
  expect(validate(filled(), ctx({ approvers: 0 })).path?.key).toBe('err_pathNone');
  expect(validate(filled({ told: false }), ctx()).told?.key).toBe('err_told');
});

test('owner decision (a): "I approve now" only for a system administrator, and only when every check would pass', () => {
  expect(selfBlock(filled(), ctx({ grantable: grantable({ system_admin: false }) }))).toBe('blk_second');
  expect(selfBlock(filled(), ctx())).toBeNull();
  expect(selfBlock(filled(), ctx({ grantable: grantable({ reachable: false }) }))).toBe('blk_offline');
  expect(selfBlock(filled({ doors: new Set(['st-a:1', 'st-b:1']) }), ctx())).toBe('blk_doors');
  const noPin = grantable({ stations: [station('st-a', { may_approve_pin: false })] });
  expect(selfBlock(filled(), ctx({ grantable: noPin }))).toBe('blk_pin');
  expect(selfBlock(filled({ cred: 'none' }), ctx({ grantable: noPin }))).toBeNull();
  expect(selfBlock(filled(), ctx({ contact: contact({ phone_confirmed_via: 'manager' }) }))).toBe('blk_number');
  expect(selfBlock(filled({ mode: 'new' }), ctx())).toBe('blk_numberNew');
  // a blocked "approve now" is an error of the path, so the form never sends it
  expect(validate(filled({ path: 'self' }), ctx({ grantable: grantable({ system_admin: false }) })).path?.key).toBe('blk_second');
  expect(bodyOf(filled({ path: 'self' }), 'c1', TZ, 14).approve_now).toBe(true);
  expect(bodyOf(filled({ path: 'send' }), 'c1', TZ, 14).approve_now).toBe(false);
});

test('owner decision (a) on the list: the requester sees no approve action unless he is a system administrator', () => {
  const g = { ...(grantOf({ id: 'g1', state: 'requested', name: 'א', company: null, stations: [['st-a', 'לובי', [1]]], vf: '2026-10-22T05:00:00', vu: '2026-10-22T14:00:00' }) as unknown as Grant), self_requested: true };
  expect(actionsOf(g, false).approve).toBe(false);
  expect(actionsOf(g, true).approve).toBe(true);
  expect(actionsOf({ ...g, self_requested: false }, false).approve).toBe(true);
  expect(actionsOf(g, false).refuse).toBe(true);
});

test('the person: only an active person who is not an Arx user, and a number he confirmed himself', () => {
  expect(eligibility(contact())).toBe('ok');
  expect(eligibility(contact({ kind: 'vendor' }))).toBe('company');
  expect(eligibility(contact({ kind: 'employee' }))).toBe('employee');
  expect(eligibility(contact({ user_linked: true }))).toBe('user');
  expect(eligibility(contact({ active: false }))).toBe('inactive');
  expect(confirmedNumber(contact())).toBe(true);
  expect(confirmedNumber(contact({ phone_confirmed_via: 'manager' }))).toBe(false);
  expect(confirmedNumber(contact({ phone_confirmed: false }))).toBe(false);
  expect(confirmedNumber(contact({ has_phone: false }))).toBe(false);
  expect(phoneOk('050-123-4567')).toBe(true);
  expect(phoneOk('972501234567')).toBe(true);
  expect(phoneOk('03-1234567')).toBe(false);
});

test('owner decision (b): a ticket change drops the doors the caller may no longer request', () => {
  const g = grantable({ stations: [station('st-a'), station('st-c', { may_request: false })] });
  expect([...keepRequestable(new Set(['st-a:1', 'st-c:1']), g)]).toEqual(['st-a:1']);
  expect(doorsBody(new Set(['st-b:2', 'st-a:1', 'st-b:1']))).toEqual({ 'st-b': [1, 2], 'st-a': [1] });
});

test('the window is local 00:00 to 24:00 in the installation zone, DST-safe, never longer than the server allows', () => {
  expect(windowOf('2026-10-21', '2026-10-22', TZ, 14)).toEqual({ valid_from: '2026-10-20T21:00:00Z', valid_until: '2026-10-22T21:00:00Z' });
  // Israel leaves summer time on 25.10.2026: 14 local days are 14 x 24 h + 1 h - the end is held at 14 x 24 h
  const w = windowOf('2026-10-20', '2026-11-02', TZ, 14);
  expect(w.valid_from).toBe('2026-10-19T21:00:00Z');
  expect(Date.parse(w.valid_until) - Date.parse(w.valid_from)).toBe(14 * 86400_000);
  expect(daySpan('2026-10-20', '2026-11-02')).toBe(14);
  expect(rangeDates('2026-10-30', '2026-11-02')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  expect(rangeDates('2026-10-02', '2026-10-01')).toEqual([]);
});

test('the timing payload is WisKey\'s timing draft (weekdays by name, sorted windows)', () => {
  const t = timingOf(filled({ days: new Set([4, 0, 1]), wins: [{ s: '13:00', e: '18:30' }, { s: '07:00', e: '12:00' }] }), TZ);
  expect(t).toEqual({ mode: 'weekly', timezone: TZ, days: ['Sunday', 'Monday', 'Thursday'], dates: [], periods: [{ start: '07:00', end: '12:00' }, { start: '13:00', end: '18:30' }] });
  const d = timingOf(filled({ dmode: 'dates', dates: new Set(['2026-10-22', '2026-10-21']) }), TZ);
  expect(d.mode).toBe('dates');
  expect(d.days).toEqual([]);
  expect(d.dates).toEqual(['2026-10-21', '2026-10-22']);
  const b = bodyOf(filled({ purpose: '  ביקור  ', notes: '' , ticketId: 't1' }), 'c1', TZ, 14);
  expect(b).toMatchObject({ contact_id: 'c1', ticket_id: 't1', doors: { 'st-a': [1] }, credential: 'pin', purpose: 'ביקור', notes: null, told: true });
});

test('the code leaves the evening before at the code hour, or at activation when that has passed', () => {
  expect(codeDue('2026-10-22', '2026-10-20', 18, 600)).toBe('21.10 18:00');
  expect(codeDue('2026-10-21', '2026-10-20', 18, 600)).toBe('20.10 18:00');
  expect(codeDue('2026-10-21', '2026-10-20', 18, 18 * 60 + 5)).toBeNull();
  expect(codeDue('2026-10-20', '2026-10-20', 18, 600)).toBeNull();
  expect(codeDue('', '2026-10-20', 18, 600)).toBeNull();
});
