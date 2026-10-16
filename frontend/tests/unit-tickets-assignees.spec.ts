import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assigneeKey, assigneeRef, handlersOf, holdersOf, holds, mergeHandlers } from '../src/tickets/assignee-model';
import { staffBlock } from '../src/tickets/readiness-model';
import type { Handler } from '../src/api/tickets';
import type { Readiness } from '../src/api/tickets-s4';

// TKSTAFF2 (owner 2026-10-16): the ONE assignee model of the screens - account holders and staff contacts without an account in one
// list with one reference, and every picker reading it (no parallel path for staff). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-assignees.spec.ts

const READY: Readiness = {
  public_page: true, public_option: true, base_url: true, module_key: true, public_ready: true, public_missing: [], master_switch: true, account_mapped: true,
  email_fallback: true, email_configured: false, contacts_count: { employee: 1, vendor: 1, person: 2 },
};
const AVI: Handler = { key: 'user:u-avi', kind: 'user', id: 'u-avi', name: 'אבי כהן', account: true, member_role: 'manager', phone: null, has_phone: false, preferred_channel: 'inapp' };
const STAFF: Handler = { key: 'contact:c-e1', kind: 'contact', id: 'c-e1', name: 'יוסי טכנאי', account: false, member_role: null, phone: '•••• 0077', has_phone: true, preferred_channel: 'whatsapp' };

test('the picker list: the server\'s handlers, or (an older server / the demo store) its account holders in the same shape', () => {
  expect(handlersOf({ users: [], handlers: [AVI, STAFF] })).toEqual([AVI, STAFF]);
  expect(handlersOf({ users: [{ kind: 'user', id: 'u-avi', name: 'אבי כהן', member_role: 'manager' }] })).toEqual([AVI]);
  expect(handlersOf(null)).toEqual([]);
});

test('one reference for both kinds, and one filter key', () => {
  expect(assigneeRef(AVI)).toEqual({ kind: 'user', id: 'u-avi' });
  expect(assigneeRef(STAFF)).toEqual({ kind: 'contact', id: 'c-e1' });
  const held = { kind: 'contact' as const, id: 'c-e1', name: 'יוסי טכנאי', since: null, acknowledged_at: null };
  expect(assigneeKey(held)).toBe('contact:c-e1');
  expect(assigneeKey(null)).toBe('');
  expect(holds(held, STAFF)).toBe(true);
  expect(holds(held, AVI)).toBe(false);
});

test('the bulk bar merges departments: each handler once, account holders first', () => {
  const other: Handler = { ...AVI, key: 'user:u-zz', id: 'u-zz', name: 'זיו' };
  expect(mergeHandlers([[STAFF, AVI], [AVI, other]]).map((h) => h.key)).toEqual(['user:u-avi', 'user:u-zz', 'contact:c-e1']);
});

test('the table filter offers whoever holds a loaded row, staff included, each once', () => {
  const rows = [
    { assignee: { kind: 'contact' as const, id: 'c-e1', name: 'יוסי טכנאי', since: null, acknowledged_at: null } },
    { assignee: { kind: 'user' as const, id: 'u-avi', name: 'אבי כהן', since: null, acknowledged_at: null } },
    { assignee: { kind: 'contact' as const, id: 'c-e1', name: 'יוסי טכנאי', since: null, acknowledged_at: null } },
    { assignee: null },
  ];
  expect(holdersOf(rows)).toEqual([{ key: 'user:u-avi', name: 'אבי כהן', account: true }, { key: 'contact:c-e1', name: 'יוסי טכנאי', account: false }]);
});

test('the staff group never asks for the outside permission; it needs the handler page and someone to offer', () => {
  expect(staffBlock({ readiness: READY, publicReady: true, count: 1 })).toBeNull();
  expect(staffBlock({ readiness: { ...READY, public_page: false }, publicReady: false, count: 1 })?.key).toBe('page_off');
  expect(staffBlock({ readiness: { ...READY, base_url: false }, publicReady: true, count: 1 })?.key).toBe('address');
  expect(staffBlock({ readiness: READY, publicReady: true, count: 0 })).toMatchObject({ key: 'no_employees', href: '#/tickets/handlers' });
  expect(staffBlock({ readiness: null, publicReady: false, count: 1 })?.key).toBe('page_off');
});

test('every picker reads the one model (no parallel path for staff)', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  for (const f of ['tickets/ticket-detail.ts', 'tickets/ticket-create.ts', 'tickets/table-bulk.ts', 'screens/tickets-table.ts']) {
    const src = readFileSync(path.join(root, f), 'utf8');
    expect(src, f).toContain('assignee-model');
    expect(src, f).not.toMatch(/\.users\b/);
    expect(src, f).not.toMatch(/kind: 'user'( as const)?, id: /);
  }
});
