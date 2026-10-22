import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Handler } from '../src/api/tickets';
import type { ExternalAssignment } from '../src/api/tickets-costs';
import type { Quote } from '../src/api/tickets-quotes';
import { canChangeOwner, ownerChoices, ownerPlan, ownerView, type OwnerTicket } from '../src/tickets/owner-model';
import {
  approvalNeedsExpiredConfirm, editorKinds, enteredByViewer, isQuoteExpired, onBehalfTarget, quoteBodyOf, quoteFormProblem, validDayText, validUntilIso,
  validUntilProblem, workWindowProblem, type QuoteForm,
} from '../src/tickets/quote-model';
import { blankLine } from '../src/tickets/cost-model';
import { DRAWER_TEXT_EN_KEYS, DRAWER_TEXT_KEYS, drawerTemplate } from '../src/tickets/drawer-text';
import { QUOTE_TEXT_EN_KEYS, QUOTE_TEXT_KEYS, quoteTemplate } from '../src/tickets/quote-text';
import { demoCostBlock, mockQuotes } from '../src/api/tickets-costs-mock';

// TKUI3B: the internal owner's picker and the quote a manager enters on the vendor's behalf - their pure rules, node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-3b.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const NOW = new Date('2026-10-16T10:00:00Z');

// ---------------------------------------------------------------- the internal owner

const owner = { id: 'u-dana', name: 'דנה פרץ', since: '2026-10-16T08:00:00Z', source: 'manual' as const, active: true };
const ticket = (over: Partial<OwnerTicket> = {}): OwnerTicket => ({ view: 'full', status: 'in_progress', internal_owner: owner, can: { change_owner: true }, ...over });
const handler = (id: string, name: string, over: Partial<Handler> = {}): Handler => ({
  key: `user:${id}`, kind: 'user', id, name, account: true, member_role: 'member', phone: null, has_phone: false, preferred_channel: 'inapp', ...over,
});

test('the owner is for the full view only: a limited viewer or an older server shows nothing, never "unknown"', () => {
  expect(ownerView(ticket({ view: 'limited' }))).toBe('hidden');
  expect(ownerView(ticket({ view: 'limited', internal_owner: owner }))).toBe('hidden');
  expect(ownerView(ticket({ internal_owner: undefined }))).toBe('hidden');
  expect(ownerView(ticket())).toBe('set');
});

test('"no owner yet" is shown only to who may set one; a viewer who cannot change sees nothing', () => {
  expect(ownerView(ticket({ internal_owner: null }))).toBe('none');
  expect(ownerView(ticket({ internal_owner: null, can: {} }))).toBe('hidden');
  expect(ownerView(ticket({ can: {} }))).toBe('set'); // an existing owner is visible to the members, the button is not
});

test('only the manager of an OPEN request may change the owner', () => {
  expect(canChangeOwner(ticket())).toBe(true);
  expect(canChangeOwner(ticket({ can: {} }))).toBe(false);
  expect(canChangeOwner(ticket({ can: { change_owner: false } }))).toBe(false);
  for (const status of ['closed', 'cancelled'] as const) expect(canChangeOwner(ticket({ status })), status).toBe(false);
  expect(canChangeOwner(ticket({ view: 'limited' }))).toBe(false);
});

test('the picker reads the ONE assignee list: account holders only, the current owner first, then by name', () => {
  const list = [
    handler('u-zed', 'זהר'), handler('u-dana', 'דנה פרץ'), handler('c-staff', 'יוסי טכנאי', { kind: 'contact', account: false, key: 'contact:c-staff' }),
    handler('u-avi', 'אבי'), handler('c-vendor', 'קירור הצפון', { kind: 'contact', account: false, key: 'contact:c-vendor' }),
  ];
  expect(ownerChoices(list, owner).map((h) => h.id)).toEqual(['u-dana', 'u-avi', 'u-zed']);
  expect(ownerChoices(list, null).map((h) => h.id)).toEqual(['u-avi', 'u-dana', 'u-zed']);
  expect(ownerChoices([], owner)).toEqual([]);
});

test('the plan: nothing to send while nothing is picked or the owner stays; a new owner or "no owner" carries the revision and the trimmed reason', () => {
  expect(ownerPlan(null, owner, '', 5)).toBeNull();
  expect(ownerPlan('u-dana', owner, '', 5)).toBeNull();
  expect(ownerPlan('', null, '', 5)).toBeNull(); // clearing when nobody is the owner
  expect(ownerPlan('u-avi', owner, '  עבר לצוות אחר  ', 5)).toEqual({ user_id: 'u-avi', reason: 'עבר לצוות אחר', revision: 5 });
  expect(ownerPlan('u-avi', null, '   ', 7)).toEqual({ user_id: 'u-avi', revision: 7 });
  expect(ownerPlan('', owner, '', 5)).toEqual({ user_id: null, revision: 5 });
});

// ---------------------------------------------------------------- a quote on the vendor's behalf: when it is offered

const vendor: ExternalAssignment = { id: 'a-v', name: 'קירור הצפון', assigned_at: '2026-10-16T08:00:00Z', ended_at: null, cost_claim: 'required', quote_mode: 'required', quote_capable: true };
const staff: ExternalAssignment = { ...vendor, id: 'a-s', name: 'יוסי טכנאי', quote_capable: false };
const mgr = { status: 'in_progress' as const, cost: { can_decide: true } };
const q = (over: Partial<Quote> = {}): Quote => ({ id: 'q1', version: 1, state: 'submitted', source: 'vendor', created_at: '2026-10-16T09:00:00Z', assignment_id: 'a-v', revision: 1, ...over });

test('never offered for a staff assignment, a request that is not in handling, a viewer who may not decide, or when no quote is wanted', () => {
  expect(onBehalfTarget(mgr, { external_assignments: [staff], flow: { assignment_id: 'a-s' } })).toBeNull();
  expect(onBehalfTarget(mgr, { external_assignments: [staff] })).toBeNull();
  for (const status of ['closed', 'cancelled', 'done', 'new', 'returned'] as const) expect(onBehalfTarget({ ...mgr, status }, { external_assignments: [vendor] }), status).toBeNull();
  expect(onBehalfTarget({ status: 'in_progress', cost: { can_decide: false } }, { external_assignments: [vendor] })).toBeNull();
  expect(onBehalfTarget({ status: 'in_progress' }, { external_assignments: [vendor] })).toBeNull();
  expect(onBehalfTarget(null, { external_assignments: [vendor] })).toBeNull();
  expect(onBehalfTarget(mgr, { external_assignments: [{ ...vendor, quote_mode: 'off' }] })).toBeNull();
  expect(onBehalfTarget(mgr, { external_assignments: [{ ...vendor, ended_at: '2026-10-16T09:30:00Z' }] })).toBeNull();
});

test('offered for an open vendor assignment; never after a quote was approved; a pending quote is marked as replaced', () => {
  expect(onBehalfTarget(mgr, { external_assignments: [vendor], flow: { assignment_id: 'a-v' } })).toEqual({ assignmentId: 'a-v', name: 'קירור הצפון', replaces: false });
  expect(onBehalfTarget(mgr, { external_assignments: [vendor], quotes: [q()] })?.replaces).toBe(true);
  expect(onBehalfTarget(mgr, { external_assignments: [vendor], quotes: [q({ state: 'fix_requested' })] })?.replaces).toBe(true);
  expect(onBehalfTarget(mgr, { external_assignments: [vendor], quotes: [q({ state: 'rejected' })] })?.replaces).toBe(false);
  for (const state of ['approved', 'partially_approved'] as const) expect(onBehalfTarget(mgr, { external_assignments: [vendor], quotes: [q({ state })] }), state).toBeNull();
  // the staff assignment next to a vendor one does not take the vendor's place
  expect(onBehalfTarget(mgr, { external_assignments: [staff, vendor], flow: { assignment_id: 'a-v' } })?.assignmentId).toBe('a-v');
  expect(onBehalfTarget(mgr, { external_assignments: [staff, vendor], flow: { assignment_id: 'a-s' } })).toBeNull();
  expect(onBehalfTarget(mgr, { external_assignments: [{ ...vendor, quote_mode: null }] })?.assignmentId).toBe('a-v'); // an older server = optional
});

test('the person who entered a quote for the vendor is recognised (they cannot approve it); a vendor quote is nobody\'s', () => {
  expect(enteredByViewer(q({ source: 'manager', created_by_name: 'רונית לוי' }), 'רונית לוי')).toBe(true);
  expect(enteredByViewer(q({ source: 'manager', created_by_name: 'רונית לוי' }), ' רונית לוי ')).toBe(true);
  expect(enteredByViewer(q({ source: 'manager', created_by_name: 'דנה פרץ' }), 'רונית לוי')).toBe(false);
  expect(enteredByViewer(q({ source: 'vendor', created_by_name: 'רונית לוי' }), 'רונית לוי')).toBe(false);
  expect(enteredByViewer(q({ source: 'manager', created_by_name: '' }), 'רונית לוי')).toBe(false);
  expect(enteredByViewer(q({ source: 'manager', created_by_name: 'רונית לוי' }), null)).toBe(false);
  expect(enteredByViewer(undefined, 'רונית לוי')).toBe(false);
});

// ---------------------------------------------------------------- the form

const form = (over: Partial<QuoteForm> = {}): QuoteForm => ({
  assignment: 'a-v', currency: 'ILS', include: false, from: '', to: '', validUntil: '', note: '', lines: [{ ...blankLine('labor'), hours: '2', rate: '200' }], ...over,
});

test('labour is always an allowed kind and the order is canonical', () => {
  expect(editorKinds(undefined)).toEqual(['labor']);
  expect(editorKinds([])).toEqual(['labor']);
  expect(editorKinds(['travel', 'parts'])).toEqual(['labor', 'parts', 'travel']);
  expect(editorKinds(['labor', 'parts', 'travel', 'other'])).toEqual(['labor', 'parts', 'travel', 'other']);
});

test('the work window: both ends optional, real instants from yesterday to a year ahead, the end not before the start', () => {
  expect(workWindowProblem('', '', NOW)).toBe('');
  expect(workWindowProblem('2026-10-17T08:00', '2026-10-17T12:00', NOW)).toBe('');
  expect(workWindowProblem('2026-10-17T08:00', '', NOW)).toBe('');
  expect(workWindowProblem('', '2026-10-20T08:00', NOW)).toBe('');
  expect(workWindowProblem('2026-10-17T12:00', '2026-10-17T08:00', NOW)).toBe('order');
  expect(workWindowProblem('2026-10-10T08:00', '', NOW)).toBe('range'); // earlier than yesterday
  expect(workWindowProblem('', '2028-01-01T08:00', NOW)).toBe('range'); // beyond a year
  expect(workWindowProblem('2026-10-17T08:00', '2027-10-10T08:00', NOW)).toBe('');
  expect(workWindowProblem('not a date', '', NOW)).toBe('format');
});

test('the form is valid with one valid line of an allowed kind; an invalid or disallowed line, or a bad window, blocks it', () => {
  expect(quoteFormProblem(form(), ['labor', 'parts'], NOW)).toBe('');
  expect(quoteFormProblem(form({ lines: [] }), ['labor'], NOW)).toBe('lines');
  expect(quoteFormProblem(form({ lines: [blankLine('labor')] }), ['labor'], NOW)).toBe('lines'); // hours empty
  expect(quoteFormProblem(form({ lines: [{ ...blankLine('parts'), description: 'מדחס', unit_price: '950' }] }), ['labor'], NOW)).toBe('kind');
  expect(quoteFormProblem(form({ lines: [{ ...blankLine('parts'), description: 'מדחס', unit_price: '950' }] }), ['parts'], NOW)).toBe('');
  expect(quoteFormProblem(form({ from: '2026-10-18T10:00', to: '2026-10-17T10:00' }), ['labor'], NOW)).toBe('work_order');
  expect(quoteFormProblem(form({ from: '2026-01-01T10:00' }), ['labor'], NOW)).toBe('work_range');
});

test('the body: decimal strings, UTC instants, empty optionals left out, the currency only when there is a choice, a valid-until only when given (the end of its day)', () => {
  const body = quoteBodyOf(form({ note: '  המדחס במלאי  ', include: true, from: '2026-10-17T08:00', to: '2026-10-17T12:00' }), { multiCurrency: false });
  expect(body).toEqual({
    assignment_id: 'a-v', lines: [{ kind: 'labor', hours: '2', rate: '200' }], amounts_include_vat: true, note: 'המדחס במלאי',
    work_from: new Date('2026-10-17T08:00').toISOString().replace(/\.\d+Z$/, 'Z'), work_to: new Date('2026-10-17T12:00').toISOString().replace(/\.\d+Z$/, 'Z'),
  });
  expect(typeof body.lines[0]).toBe('object');
  const plain = quoteBodyOf(form(), { multiCurrency: true });
  expect(plain).toEqual({ assignment_id: 'a-v', lines: [{ kind: 'labor', hours: '2', rate: '200' }], currency: 'ILS', amounts_include_vat: false });
  expect(JSON.stringify(plain)).not.toMatch(/valid|until|expires/);
  const withValid = quoteBodyOf(form({ validUntil: '2026-11-05' }), { multiCurrency: false });
  expect(withValid.valid_until).toBe(new Date(2026, 10, 5, 23, 59, 59).toISOString().replace(/\.\d+Z$/, 'Z'));
});

// ---------------------------------------------------------------- TKQVALID: the validity

test('validity: optional, a real day, from one day back to 366 days ahead (negative cases first)', () => {
  expect(validUntilProblem('', NOW)).toBe('');
  for (const bad of ['x', '2026-13-01', '2026-02-30', '16/10/2026', '2026-10-1', '2026-10-16T10:00']) expect(validUntilProblem(bad, NOW), bad).toBe('format');
  expect(validUntilProblem('2026-10-10', NOW)).toBe('range'); // the end of that day is earlier than yesterday
  expect(validUntilProblem('2028-01-01', NOW)).toBe('range');
  expect(validUntilProblem('2027-10-18', NOW)).toBe('range'); // beyond 366 days
  expect(validUntilProblem('2026-10-15', NOW)).toBe(''); // yesterday: a just-lapsed quote can still be entered
  expect(validUntilProblem('2026-12-31', NOW)).toBe('');
  expect(validUntilIso('2026-02-30')).toBe('');
  expect(quoteFormProblem(form({ validUntil: '2028-01-01' }), ['labor'], NOW)).toBe('valid_range');
  expect(quoteFormProblem(form({ validUntil: 'zzz' }), ['labor'], NOW)).toBe('valid_format');
  expect(quoteFormProblem(form({ validUntil: '2026-11-01' }), ['labor'], NOW)).toBe('');
  expect(quoteFormProblem(form({ from: '2026-01-01T10:00', validUntil: '2028-01-01' }), ['labor'], NOW)).toBe('work_range'); // the work window is checked first
});

test('expired: only a passed instant; an approval of a pending expired quote needs the explicit confirmation, a rejection never does', () => {
  expect(isQuoteExpired(undefined, NOW)).toBe(false);
  expect(isQuoteExpired({ valid_until: null }, NOW)).toBe(false);
  expect(isQuoteExpired({ valid_until: 'garbage' }, NOW)).toBe(false);
  expect(isQuoteExpired({ valid_until: '2026-10-16T09:59:59Z' }, NOW)).toBe(true);
  expect(isQuoteExpired({ valid_until: '2026-10-16T10:00:01Z' }, NOW)).toBe(false);
  const old = { state: 'submitted' as const, valid_until: '2026-10-14T20:59:59Z' };
  expect(approvalNeedsExpiredConfirm(old, 'approve', NOW)).toBe(true);
  expect(approvalNeedsExpiredConfirm(old, 'partial', NOW)).toBe(true);
  expect(approvalNeedsExpiredConfirm(old, 'reject', NOW)).toBe(false);
  expect(approvalNeedsExpiredConfirm(old, 'fix', NOW)).toBe(false);
  expect(approvalNeedsExpiredConfirm({ ...old, state: 'approved' }, 'approve', NOW)).toBe(false);
  expect(approvalNeedsExpiredConfirm({ state: 'submitted', valid_until: null }, 'approve', NOW)).toBe(false);
  expect(validDayText('2026-10-14T12:00:00Z')).toMatch(/^\d{2}\.\d{2}\.2026$/);
  expect(validDayText(null)).toBe('');
  expect(validDayText('nope')).toBe('');
});

test('demo: the store keeps the validity and refuses a bad one (422)', async () => {
  const id = 'demo-qvalid-1';
  demoCostBlock(id, 1043, 'in_progress');
  const lines = [{ kind: 'labor' as const, hours: '2', rate: '200' }];
  await expect(mockQuotes.onBehalf(id, { lines, valid_until: 'not a date' })).rejects.toMatchObject({ status: 422 });
  await expect(mockQuotes.onBehalf(id, { lines, valid_until: new Date(Date.now() - 5 * 86_400_000).toISOString() })).rejects.toMatchObject({ status: 422 });
  await expect(mockQuotes.onBehalf(id, { lines, valid_until: new Date(Date.now() + 400 * 86_400_000).toISOString() })).rejects.toMatchObject({ status: 422 });
  const ok = await mockQuotes.onBehalf(id, { lines, valid_until: new Date(Date.now() + 5 * 86_400_000).toISOString() });
  expect(ok.quotes.at(-1)!.valid_until).toBeTruthy();
  const plain = await mockQuotes.onBehalf(id, { lines });
  expect(plain.quotes.at(-1)!.valid_until).toBeNull();
});

// ---------------------------------------------------------------- the demo store (no backend)

test('demo: a quote entered for the vendor is a manager quote of the viewer, and the same person cannot approve it (409 self_approval)', async () => {
  const id = 'demo-3b-1';
  demoCostBlock(id, 1043, 'in_progress');
  const answer = await mockQuotes.onBehalf(id, { lines: [{ kind: 'labor', hours: '2', rate: '200' }], note: 'בשם הספק' });
  const mine = answer.quotes.filter((x) => x.source === 'manager').at(-1)!;
  expect(mine.state).toBe('submitted');
  expect(mine.created_by_name).toBeTruthy();
  await expect(mockQuotes.decide(id, mine.id, 'approve', { revision: mine.revision! })).rejects.toMatchObject({ status: 409, body: { code: 'self_approval' } });
  // a correction request is not an approval: it is allowed
  const fix = await mockQuotes.decide(id, mine.id, 'request-fix', { revision: mine.revision!, reason: 'חסר פירוט' });
  expect(fix.quotes.find((x) => x.id === mine.id)?.state).toBe('fix_requested');
});

test('demo: nothing is entered for a staff assignment', async () => {
  demoCostBlock('demo-3b-staff', 1047, 'in_progress');
  await expect(mockQuotes.onBehalf('demo-3b-staff', { lines: [{ kind: 'labor', hours: '1', rate: '100' }] })).rejects.toMatchObject({ status: 409 });
});

// ---------------------------------------------------------------- text and source guards

test('the new texts exist in Hebrew and English, the owner texts carry no hard-coded module name', () => {
  for (const k of QUOTE_TEXT_KEYS.filter((x) => x.startsWith('ob') || x === 'selfApproval')) {
    expect(QUOTE_TEXT_EN_KEYS, k).toContain(k);
    expect(quoteTemplate(k, 'he').trim(), k).not.toBe('');
  }
  for (const k of DRAWER_TEXT_KEYS.filter((x) => x.startsWith('owner'))) {
    expect(DRAWER_TEXT_EN_KEYS, k).toContain(k);
    expect(drawerTemplate(k, 'he'), k).not.toMatch(/פנייה|פניה|קריאה|תקלה/); // the module's name only through the tokens
  }
  expect(quoteTemplate('obNotice', 'he')).toContain('אדם אחר צריך לאשר');
  expect(quoteTemplate('obNotice', 'en')).toMatch(/another person has to approve/);
});

test('static guard: the quote dialog opens only through onBehalfTarget; the owner API and the owner picker use the one assignee list; the validity goes through the model only (TKQVALID)', () => {
  const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
  const tab = read('tickets/costs-tab.ts');
  expect(tab).toContain('onBehalfTarget(');
  expect((tab.match(/this\.entering = true/g) ?? []).length).toBe(2); // the empty stage / pending card button, and the card's menu
  expect(tab).toMatch(/if \(!this\.entering \|\| !target/); // the dialog is rendered only while a target exists
  const detail = read('tickets/ticket-detail.ts');
  expect(detail).toContain("ticketsApi().assignees(t.department?.id ?? '', t.id).then((r) => { this.eligible = handlersOf(r); })");
  expect(detail).toContain('ownerChoices(');
  expect(read('api/tickets-owner.ts')).not.toMatch(/candidates\.map|\.candidates/);
  // TKQVALID: the dialog never builds the wire field itself - the model's quoteBodyOf does; the API type carries it; the tab asks before an expired approval
  expect(read('tickets/quote-form.ts')).not.toMatch(/valid_until/);
  expect(read('tickets/quote-model.ts')).toContain('validUntilIso(');
  expect(read('api/tickets-quotes.ts')).toMatch(/valid_until\?: string/);
  expect(tab).toContain('confirm_expired');
});
