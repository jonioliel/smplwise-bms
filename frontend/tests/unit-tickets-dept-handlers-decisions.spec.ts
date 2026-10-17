import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SHARED_BY_DEFAULT, createdLabel, lookupReady, mobileEditable } from '../src/tickets/dept-handlers-model';
import { DM_AR_DEV, DM_EN, DM_HE, DM_RU_DEV } from '../src/tickets/text-deptmgr';

// DEPTMGR2 (owner answers 2026-10-17 to the department-manager CR's open questions): the manager's new vendor is his department's only by
// default, the exact-phone lookup, a plain member's mobile, the creating department. Negative first. Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-dept-handlers-decisions.spec.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.join(here, '..', p), 'utf8');

test('a new vendor / contact is NOT shared by default', () => {
  expect(SHARED_BY_DEFAULT).toBe(false);
  const contacts = src('src/tickets/contacts-directory.ts');
  expect(contacts).toContain('private mgrShared = SHARED_BY_DEFAULT');
  expect(contacts).not.toMatch(/mgrShared = mayShare\(/);
});

test('the lookup sends only a full number - never a fragment, a wildcard or letters', () => {
  for (const bad of ['', '050', '05000', '%', '*', '050-000-006_', 'abc', '0'.repeat(16), '+972 50 ab']) expect(lookupReady(bad)).toBe(false);
  for (const ok of ['050-000-0060', '+972 (50) 000-0060', '0500000060', '972500000060']) expect(lookupReady(ok)).toBe(true);
});

test('the phone travels in the request body, never in the URL', () => {
  const api = src('src/api/tickets-dept-handlers.ts');
  expect(api).toMatch(/lookup: \(d, phone\) => post<[^>]+>\(`\$\{B\}\/\$\{enc\(d\)\}\/contacts\/lookup`, \{ phone \}\)/);
  expect(api).toMatch(/attachByPhone: \(d, c, phone\) => post<Contact>\(`\$\{B\}\/\$\{enc\(d\)\}\/contacts\/attach-by-phone`, \{ contact_id: c, phone \}\)/);
  expect(api).not.toMatch(/lookup[^\n]*\?phone=/);
});

test('a member mobile is editable only on the server flag, for a plain member with an account', () => {
  expect(mobileEditable({ kind: 'user', role: 'member', mobile_editable: false })).toBe(false);
  expect(mobileEditable({ kind: 'user', role: 'member' })).toBe(false); // an older server: read-only
  expect(mobileEditable({ kind: 'user', role: 'manager', mobile_editable: true })).toBe(false);
  expect(mobileEditable({ kind: 'group', role: 'member', mobile_editable: true })).toBe(false);
  expect(mobileEditable({ kind: 'user', role: 'member', mobile_editable: true })).toBe(true);
  const members = src('src/tickets/handlers-members.ts');
  expect(members).toContain('deptHandlersApi().memberMobile');
  // the manager's save sends the phone and the language only (never the WhatsApp / verification switches)
  const save = /saveManagerMobile\(d: AdminDepartment, m: AdminMember, body: \{([^}]+)\}/.exec(members)?.[1] ?? '';
  expect(save).not.toMatch(/notify_whatsapp|phone_verify/);
});

test('the creating department: the name only when the server gives it, "another department" otherwise, nothing for Settings rows', () => {
  const nameOf = (id: string) => ({ maint: 'אחזקה' })[id] ?? id;
  expect(createdLabel(null, nameOf, 'מחלקה אחרת')).toBeNull();
  expect(createdLabel(undefined, nameOf, 'מחלקה אחרת')).toBeNull();
  expect(createdLabel({ id: null, name: null, other: true }, nameOf, 'מחלקה אחרת')).toBe('מחלקה אחרת');
  expect(createdLabel({ id: 'maint', name: 'אחזקה', other: false }, nameOf, 'x')).toBe('אחזקה');
  expect(createdLabel({ id: 'maint', name: '', other: false }, nameOf, 'x')).toBe('אחזקה');
});

test('texts: the new words exist in Hebrew and English; Arabic / Russian are dev-marked drafts of existing keys only', () => {
  for (const k of ['dmCreatedIn', 'dmCreatedOther', 'dmLookupTitle', 'dmLookupHint', 'dmLookupFind', 'dmLookupNone', 'dmLookupAttach', 'dmLookupAttached'] as const) {
    expect(DM_HE[k]).toMatch(/[֐-׿]/);
    expect(DM_EN[k]).toBeTruthy();
    expect(DM_AR_DEV[k]).toMatch(/[؀-ۿ]/);
    expect(DM_RU_DEV[k]).toMatch(/[Ѐ-ӿ]/);
  }
  for (const k of [...Object.keys(DM_AR_DEV), ...Object.keys(DM_RU_DEV)]) expect(Object.keys(DM_HE)).toContain(k);
  expect(src('src/tickets/text-deptmgr.ts')).toContain('DEV-MARKED');
});
