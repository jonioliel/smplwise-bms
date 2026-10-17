/**
 * CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): what the "מטפלים וספקים" cards offer a department manager - pure rules mirroring the
 * server's (services/tickets/dept_handlers.py), which stays the authority: a button shown here can still be refused there.
 */
import type { Contact } from '../api/tickets-s4';
import type { ManagedMember } from '../api/tickets-dept-handlers';
import type { MetaDepartment } from '../api/tickets';

/** The departments in which the caller manages handlers (the meta's `can_handlers`; an older server: none). */
export function handlerDepartments(depts: readonly Pick<MetaDepartment, 'id' | 'can_handlers'>[]): string[] {
  return depts.filter((d) => d.can_handlers === true).map((d) => d.id);
}

/** A member the manager may remove: a plain member with an account (never a manager row, never a group). */
export function memberRemovable(m: Pick<ManagedMember, 'kind' | 'role'>, canManage: boolean): boolean {
  return canManage && m.kind === 'user' && m.role === 'member';
}

export interface RowActions {
  /** edit the details and erase (he created it and no other department uses it - the server's `manager_editable`) */
  edit: boolean;
  /** his departments the row may be attached to (it is attached to one of his departments already, and not to this one) */
  attach: string[];
  /** his departments the row may be detached from (never its last department) */
  detach: string[];
  /** shared with every department: no attachment change from here */
  shared: boolean;
}

/** The manager's actions on one directory row, for the departments he manages handlers in. */
export function rowActions(c: Pick<Contact, 'departments' | 'manager_editable' | 'user_linked' | 'erased'>, mine: readonly string[]): RowActions {
  const none: RowActions = { edit: false, attach: [], detach: [], shared: !c.departments.length };
  if (!mine.length || c.erased || c.user_linked) return none;
  const shared = !c.departments.length;
  const attachedMine = c.departments.filter((d) => mine.includes(d));
  return {
    edit: c.manager_editable === true,
    shared,
    attach: shared || !attachedMine.length ? [] : mine.filter((d) => !c.departments.includes(d)),
    detach: shared || c.departments.length <= 1 ? [] : attachedMine,
  };
}

/** Whether a new row of this kind may be shared with every department (an employee without an account belongs to his department). */
export function mayShare(kind: Contact['kind']): boolean {
  return kind !== 'employee';
}

/** The default of the "available to every department" switch of a manager's new row: off (owner 2026-10-17 - his department only). */
export const SHARED_BY_DEFAULT = false;

/**
 * The "creating department" text of a row (0113): the department's name when the server named it, "another department" when it says
 * only that, nothing for a row created in Settings (null / absent - an older server too).
 */
export function createdLabel(cd: Contact['created_department'], nameOf: (id: string) => string, other: string): string | null {
  if (!cd) return null;
  if (cd.other) return other;
  return cd.name || (cd.id ? nameOf(cd.id) : null);
}

/** A number worth sending to the exact lookup: 9-15 digits once spaces, dashes, dots, parentheses and a leading + are dropped. */
export function lookupReady(raw: string): boolean {
  const s = raw.trim().replace(/[\s\-().]/g, '').replace(/^\+/, '');
  return /^\d{9,15}$/.test(s);
}

/** A member whose mobile and language the manager may edit (the server's `mobile_editable`: a plain member, never a manager). */
export function mobileEditable(m: Pick<ManagedMember, 'kind' | 'role' | 'mobile_editable'>): boolean {
  return m.kind === 'user' && m.role === 'member' && m.mobile_editable === true;
}
