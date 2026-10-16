import { test, expect } from '@playwright/test';
import {
  LATER, SEARCH_ABOVE, assignParam, createAssignGroups, handlerValue, parseAssignParam, parsePick, vendorValue, withAssign,
} from '../src/tickets/create-assign-model';
import type { Handler } from '../src/api/tickets';
import type { ExternalAssignee } from '../src/api/tickets-s4';

// TKUI1 (owner 16.10): the handler choice of the new-request sheet - "assign later" first, three headed groups (with an account / without an
// account / vendors and outside contacts), the vendor group disabled with its reason, the search above six entries, the two-step vendor
// flow's address parameter. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-create-assign.spec.ts

const h = (id: string, name: string, account: boolean): Handler => ({ key: `${account ? 'user' : 'contact'}:${id}`, kind: account ? 'user' : 'contact', id, name, account, member_role: account ? 'member' : null, phone: account ? null : '•••• 0045', has_phone: !account, preferred_channel: account ? 'inapp' : 'whatsapp' });
const c = (id: string, name: string, kind: ExternalAssignee['contact_kind'] = 'vendor', company = 'מיזוג אלון'): ExternalAssignee => ({ kind: 'contact', id, contact_kind: kind, name, company, vendor_name: null, phone: '050-000-0001', has_phone: true, has_email: false, preferred_channel: 'whatsapp', require_code: false, share_history: null, lang: 'he' } as ExternalAssignee);
const HANDLERS = [h('u1', 'אבי כהן', true), h('u2', 'יוסי מזרחי', true), h('s1', 'דנה (ללא חשבון)', false)];
const CONTACTS = [c('v1', 'מיזוג אלון'), c('p1', 'יוסי חשמל', 'person', 'חשמלאי מוסמך'), c('e1', 'עובד', 'employee' as ExternalAssignee['contact_kind'])];

test('the groups in order: later first, then with / without an account, then vendors (staff contacts never as vendors)', () => {
  const { groups, searchable } = createAssignGroups({ handlers: HANDLERS, contacts: CONTACTS, external: true, publicReady: true });
  expect(groups.map((g) => g.key)).toEqual(['later', 'account', 'staff', 'vendor']);
  expect(groups[0].options.map((o) => o.value)).toEqual([LATER]);
  expect(groups[1].options.map((o) => o.label)).toEqual(['אבי כהן', 'יוסי מזרחי']);
  expect(groups[2].options.map((o) => o.value)).toEqual(['h:contact:s1']);
  expect(groups[3].options.map((o) => o.value)).toEqual(['v:v1', 'v:p1']);
  expect(groups[3].options[1].sub).toBe('חשמלאי מוסמך · 050-000-0001');
  expect(groups[3].blocked).toBeNull();
  expect(searchable).toBe(false); // 3 handlers + 2 vendors = 5
});

test('the vendor group is shown disabled with the reason: no tickets.external, the handler page not ready, nobody in the directory', () => {
  const g = (o: Partial<Parameters<typeof createAssignGroups>[0]>) => createAssignGroups({ handlers: HANDLERS, contacts: CONTACTS, external: true, publicReady: true, ...o }).groups[3];
  expect(g({ external: false }).blocked?.key).toBe('external');
  expect(g({ external: false }).options).toEqual([]);
  expect(g({ publicReady: false }).blocked?.key).toBe('page_off');
  expect(g({ contacts: [] }).blocked?.key).toBe('no_contacts');
  expect(g({ contacts: null }).blocked, 'still loading: no reason yet').toBeNull();
  expect(g({ readiness: { public_page: true, base_url: false, module_key: true, master_switch: true, account_mapped: true } as never }).blocked?.key).toBe('address');
  // a disabled vendor group does not count toward the search threshold
  const many = Array.from({ length: 6 }, (_, i) => c(`v${i}`, `ספק ${i}`));
  expect(createAssignGroups({ handlers: HANDLERS.slice(0, 1), contacts: many, external: false, publicReady: true }).searchable).toBe(false);
});

test('the search: above six entries; filters names, phones and companies; "assign later" always stays', () => {
  const many = Array.from({ length: 5 }, (_, i) => c(`v${i}`, `ספק ${i}`, 'vendor', i === 3 ? 'קירור צפון' : 'חברה'));
  const all = createAssignGroups({ handlers: HANDLERS, contacts: many, external: true, publicReady: true });
  expect(all.searchable).toBe(true);
  expect(3 + 5).toBeGreaterThan(SEARCH_ABOVE);
  const q = createAssignGroups({ handlers: HANDLERS, contacts: many, external: true, publicReady: true, query: 'קירור' });
  expect(q.groups[0].options).toHaveLength(1);
  expect(q.groups[1].options).toHaveLength(0);
  expect(q.groups[3].options.map((o) => o.value)).toEqual(['v:v3']);
  expect(q.groups[3].total, 'the total is before the search').toBe(5);
  expect(createAssignGroups({ handlers: HANDLERS, contacts: many, external: true, publicReady: true, query: '  אבי ' }).groups[1].options.map((o) => o.label)).toEqual(['אבי כהן']);
});

test('the radio values and the vendor flow\'s address parameter', () => {
  expect(handlerValue(HANDLERS[0])).toBe('h:user:u1');
  expect(vendorValue(CONTACTS[0])).toBe('v:v1');
  expect(parsePick('h:user:u1')).toEqual({ kind: 'handler', id: 'user:u1' });
  expect(parsePick('v:v1')).toEqual({ kind: 'vendor', id: 'v1' });
  expect(parsePick(LATER)).toEqual({ kind: 'later', id: '' });
  expect(parsePick('')).toEqual({ kind: 'later', id: '' });
  expect(assignParam('c000000000000p01')).toBe('contact:c000000000000p01');
  expect(parseAssignParam('contact:c000000000000p01')).toBe('c000000000000p01');
  for (const bad of [null, '', 'user:u1', 'contact:', 'contact:../x', 'contact:a b']) expect(parseAssignParam(bad), String(bad)).toBe('');
  expect(withAssign('#/tickets/mine?t=0000000000000a09', 'c1')).toBe('#/tickets/mine?t=0000000000000a09&assign=contact%3Ac1');
  expect(withAssign('#/tickets/0000000000000a09', 'c1')).toBe('#/tickets/0000000000000a09?assign=contact%3Ac1');
  expect(parseAssignParam(new URLSearchParams('t=x&assign=contact%3Ac1').get('assign'))).toBe('c1');
});
