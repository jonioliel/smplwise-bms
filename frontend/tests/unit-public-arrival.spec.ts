import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bodyOf, codeKey, draftProblem, firstDraft, outsideWindow, refusalKey, shortDay, type ArrivalView } from '../src/public-ticket/arrival/arrival-model';
import { ARRIVAL_TEXT, at } from '../src/public-ticket/arrival/arrival-text';

// GRANTS3-295: the pure logic and the words of the arrival step on the vendor's page (Node only):
//   npx playwright test -c playwright.unit.config.ts tests/unit-public-arrival.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIR = path.resolve(HERE, '../src/public-ticket/arrival');

const view = (over: Partial<ArrivalView> = {}): ArrivalView => ({
  available: true, persons: [{ id: 'p1', label: 'Ron ····61' }], can_add: true, window: { from: null, to: null },
  hours: ['07:00-12:00', '08:00-17:00', '00:00-24:00'], max_days: 14,
  notice: { version: 'n2', text: 'notice', attest: 'I confirm', lang: 'en' }, current: null, ...over,
});

test('the first draft takes the agreed window (never before today), one person preselected, the usual hours', () => {
  const d = firstDraft(view({ window: { from: '2026-10-22', to: '2026-10-23' } }), '2026-10-20');
  expect([d.from, d.to, d.personId, d.hours, d.ack]).toEqual(['2026-10-22', '2026-10-23', 'p1', '08:00-17:00', false]);
  const past = firstDraft(view({ window: { from: '2026-10-01', to: '2026-10-30' }, max_days: 3 }), '2026-10-20');
  expect([past.from, past.to]).toEqual(['2026-10-20', '2026-10-22']);
  expect(firstDraft(view({ persons: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] }), '2026-10-20').personId).toBeNull();
});

test('nothing is sent without a person and the notice tick, or with dates the server would refuse', () => {
  const v = view();
  const ok = { ...firstDraft(v, '2026-10-20'), ack: true };
  expect(draftProblem(ok, v, '2026-10-20')).toBeNull();
  expect(draftProblem({ ...ok, ack: false }, v, '2026-10-20')).toBe('errRequired');
  expect(draftProblem({ ...ok, personId: null }, v, '2026-10-20')).toBe('errRequired');
  expect(draftProblem({ ...ok, personId: 'new', newName: 'A', newPhone: '0500000000' }, v, '2026-10-20')).toBe('errRequired');
  expect(draftProblem({ ...ok, personId: 'new', newName: 'Avi New', newPhone: '050-000-0057' }, v, '2026-10-20')).toBeNull();
  expect(draftProblem({ ...ok, from: '2026-10-19' }, v, '2026-10-20')).toBe('errDates');
  expect(draftProblem({ ...ok, from: '2026-10-22', to: '2026-10-21' }, v, '2026-10-20')).toBe('errDates');
  expect(draftProblem({ ...ok, to: '2026-11-03' }, v, '2026-10-20')).toBe('errDates');
  expect(draftProblem({ ...ok, hours: '06:00-23:00' }, v, '2026-10-20')).toBe('errDates');
});

test('the body carries exactly one of person / new person, the notice version and the request id', () => {
  const v = view();
  const d = { ...firstDraft(v, '2026-10-20'), ack: true };
  expect(bodyOf(d, v, 'c1')).toEqual({ person_id: 'p1', date_from: '2026-10-20', date_to: '2026-10-20', hours: '08:00-17:00', notice_ack: true, notice_version: 'n2', client_request_id: 'c1' });
  const n = bodyOf({ ...d, personId: 'new', newName: ' Avi ', newPhone: ' 0500000057 ' }, v, 'c2');
  expect(n.new_person).toEqual({ name: 'Avi', phone: '0500000057' });
  expect('person_id' in n).toBe(false);
});

test('outside the agreed window is shown (the server flags it), refusals map to words', () => {
  const v = view({ window: { from: '2026-10-22', to: '2026-10-23' } });
  expect(outsideWindow({ ...firstDraft(v, '2026-10-20'), to: '2026-10-25' }, v)).toBe(true);
  expect(outsideWindow(firstDraft(v, '2026-10-20'), v)).toBe(false);
  expect(refusalKey(409, 'arrival_other_person')).toBe('errOther');
  expect(refusalKey(409, 'arrival_other_ticket')).toBe('errOtherTicket');
  expect(refusalKey(409, 'no_doors_suggested')).toBe('errNoDoors');
  expect(refusalKey(0, undefined)).toBe('offline');
  expect(refusalKey(500, undefined)).toBe('errGeneric');
});

test('the approved access names the code delivery, never a code', () => {
  const base = { doors: ['Gate A'], from: '2026-10-22', to: '2026-10-23', hours: '08:00-17:00', credential: 'pin' as const };
  expect(codeKey({ ...base, code: { state: 'scheduled', at: '2026-10-21T18:00', to: '····61' } })).toBe('codeScheduled');
  expect(codeKey({ ...base, code: { state: 'sent', at: null, to: '····61' } })).toBe('codeSent');
  expect(codeKey({ ...base, code: { state: 'not_delivered', at: null, to: '····61' } })).toBe('codeFailed');
  expect(codeKey({ ...base, credential: 'card', card: { state: 'ready' } })).toBe('cardReady');
  expect(codeKey({ ...base, credential: 'none' })).toBeNull();
  expect(shortDay('2026-10-21T18:00')).toBe('21.10 18:00');
  expect(shortDay('2026-10-22')).toBe('22.10');
  expect(at('en', 'codeScheduled', { to: '····61', at: '21.10 18:00' })).toBe('A personal code will be sent by WhatsApp to ····61 on 21.10 18:00.');
});

test('every language has every key, and no text promises to show the code', () => {
  const keys = Object.keys(ARRIVAL_TEXT.he).sort();
  for (const lang of ['en', 'ar', 'ru'] as const) expect(Object.keys(ARRIVAL_TEXT[lang]).sort()).toEqual(keys);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const s of Object.values(ARRIVAL_TEXT[lang])) expect(s).not.toMatch(/\{code\}|\{pin\}/);
  }
});

test('the chunk builds DOM from text nodes only, builds no link and keeps nothing in storage', () => {
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.ts'))) {
    const src = readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src, f).not.toMatch(/innerHTML|outerHTML|insertAdjacentHTML|document\.write|eval\(|new Function/);
    expect(src, f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    expect(src, f).not.toMatch(/createElement\(['"]a['"]\)|h\(['"]a['"]|\.href\s*=/);
    expect(src, f).not.toMatch(/from '\.\.\/\.\.\//);
  }
});
