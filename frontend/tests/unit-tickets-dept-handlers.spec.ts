import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handlerDepartments, mayShare, memberRemovable, rowActions } from '../src/tickets/dept-handlers-model';
import { DM_EN, DM_HE } from '../src/tickets/text-deptmgr';
import { boardHref, parseBoardRoute } from '../src/tickets/board-model';
import { template, tt } from '../src/tickets/text';
import type { Contact } from '../src/api/tickets-s4';
import { ticketPermLabel } from '../src/tickets/perm-label';

// CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): what the "מטפלים וספקים" cards offer a department manager (mirrors the server's rules,
// which stay the authority), the board's handlers pane address, and the texts (Hebrew and English complete, no internal codes). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-dept-handlers.spec.ts

const here = path.dirname(fileURLToPath(import.meta.url));
const row = (p: Partial<Contact>): Pick<Contact, 'departments' | 'manager_editable' | 'user_linked' | 'erased'> => ({
  departments: [], manager_editable: false, user_linked: false, erased: false, ...p,
});

test('handler departments come from the meta flag only (an older server without it: none)', () => {
  expect(handlerDepartments([{ id: 'a', can_handlers: true }, { id: 'b', can_handlers: false }, { id: 'c' }])).toEqual(['a']);
  expect(handlerDepartments([])).toEqual([]);
});

test('a manager removes plain members with an account only - never a manager row, never a group, never without the capability', () => {
  expect(memberRemovable({ kind: 'user', role: 'member' }, true)).toBe(true);
  expect(memberRemovable({ kind: 'user', role: 'manager' }, true)).toBe(false);
  expect(memberRemovable({ kind: 'group', role: 'member' }, true)).toBe(false);
  expect(memberRemovable({ kind: 'user', role: 'member' }, false)).toBe(false);
});

test('row actions: shared rows change nothing, the last department never detaches, edit follows the server flag', () => {
  const mine = ['maint', 'gardens'];
  // a row shared with every department: no attach / detach (attaching would narrow it for everyone)
  expect(rowActions(row({ departments: [] }), mine)).toEqual({ edit: false, attach: [], detach: [], shared: true });
  // his department only: attach to his other department, never detach the last one
  expect(rowActions(row({ departments: ['maint'] }), mine)).toEqual({ edit: false, attach: ['gardens'], detach: [], shared: false });
  // his and another department: detach his, attach to his other one
  expect(rowActions(row({ departments: ['maint', 'cleaning'] }), mine)).toEqual({ edit: false, attach: ['gardens'], detach: ['maint'], shared: false });
  // a row of another department only (the server would not even list it): nothing
  expect(rowActions(row({ departments: ['cleaning'] }), mine).attach).toEqual([]);
  expect(rowActions(row({ departments: ['maint'], manager_editable: true }), mine).edit).toBe(true);
  // a user's row, an erased row, or no capability: nothing at all
  expect(rowActions(row({ departments: ['maint'], user_linked: true, manager_editable: true }), mine)).toMatchObject({ edit: false, attach: [], detach: [] });
  expect(rowActions(row({ departments: ['maint'], erased: true }), mine).attach).toEqual([]);
  expect(rowActions(row({ departments: ['maint'], manager_editable: true }), []).edit).toBe(false);
});

test('an employee without an account belongs to his department; vendors and contacts may be shared', () => {
  expect(mayShare('employee')).toBe(false);
  expect(mayShare('vendor')).toBe(true);
  expect(mayShare('person')).toBe(true);
});

test('the board keeps the handlers pane in its address (and drops it for the requests)', () => {
  const r = parseBoardRoute(new URLSearchParams('pane=handlers&dept=x'));
  expect(r.pane).toBe('handlers');
  expect(boardHref(r)).toBe('#/tickets/board?dept=x&pane=handlers');
  expect(parseBoardRoute(new URLSearchParams('pane=bogus')).pane).toBeUndefined();
  expect(boardHref({ ...r, pane: 'cards' })).toBe('#/tickets/board?dept=x');
});

test('texts: Hebrew and English complete, merged into the catalogue, no internal codes', () => {
  expect(Object.keys(DM_EN).sort()).toEqual(Object.keys(DM_HE).sort());
  for (const k of Object.keys(DM_HE) as (keyof typeof DM_HE)[]) {
    expect(template(k, 'he')).toBe(DM_HE[k]);
    expect(template(k, 'en')).toBe(DM_EN[k]);
    expect(DM_HE[k]).not.toMatch(/CR-|DEPT|Home Assistant|HA\b|tickets\./);
    expect(DM_HE[k]).toMatch(/[֐-׿]/);
  }
  expect(tt('dmFullPhones')).toBe('מנהלי מחלקה רואים מספרים מלאים');
  expect(ticketPermLabel('tickets.handlers')).toBe('מטפלים וספקים במחלקות שלי');
});

test('the components use the manager routes and never send a configurer-only field', () => {
  const contacts = readFileSync(path.join(here, '../src/tickets/contacts-directory.ts'), 'utf8');
  const keep = /const keep = \[([^\]]+)\]/.exec(contacts)?.[1] ?? '';
  for (const forbidden of ['notes', 'user_id', 'departments', 'labor_rate', 'cost_claim', 'phone_verify']) expect(keep).not.toContain(`'${forbidden}'`);
  expect(contacts).toContain('deptHandlersApi().createContact');
  const members = readFileSync(path.join(here, '../src/tickets/handlers-members.ts'), 'utf8');
  expect(members).toContain('deptHandlersApi().addMember');
  expect(members).toContain('deptHandlersApi().removeMember');
  const board = readFileSync(path.join(here, '../src/screens/tickets-board.ts'), 'utf8');
  expect(board).toContain('<tickets-handlers embedded');
});

test('VPORTALRFQ: the technician-request approval permission has its words in the "הרשאות" tab', () => {
  expect(ticketPermLabel('tickets.technician_requests')).toBe('אישור בקשות טכנאים מספקים (במחלקות שלי)');
});
