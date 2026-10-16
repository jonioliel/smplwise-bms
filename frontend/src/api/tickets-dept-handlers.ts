/**
 * CR-DEPT-MANAGER-HANDLERS (owner 2026-10-17): the department manager's routes of "מטפלים וספקים" (routers/tickets_dept_handlers.py).
 * A manager with the capability (tickets.manage + tickets.handlers + a manager membership) adds / removes plain members with an account,
 * attaches / detaches directory rows, creates a row and edits / erases the rows he created that no other department uses - for HIS
 * departments only. Without a server (the demo) the manager view is empty and every write answers "no permission".
 */
import { api, get, post, put } from './client';
import { ApiError } from './client';
import { isApi } from './session';
import type { Contact, ContactChannel, ContactKind, ContactLang } from './tickets-s4';

export interface ManagedMember {
  kind: 'user' | 'group';
  id: string;
  name: string;
  role: 'manager' | 'member';
  /** users only: masked ("•••• 1234") unless the caller may see the full number */
  has_mobile?: boolean;
  mobile?: string | null;
  mobile_full?: boolean;
  mobile_confirmed?: boolean;
  notify_whatsapp?: boolean;
}
export interface ManagedDepartment { id: string; name: string; active: boolean; can_manage: boolean; members: ManagedMember[] }
export interface ManagerOverview { departments: ManagedDepartment[]; can_manage: boolean; full_phones: boolean }
export interface ManagerContactBody {
  kind?: ContactKind;
  display_name?: string;
  company?: string;
  vendor_id?: string | null;
  phone?: string | null;
  email?: string | null;
  preferred_channel?: ContactChannel;
  require_code?: boolean;
  share_history?: boolean | null;
  lang?: ContactLang;
  active?: boolean;
  /** create only, vendors / contacts: shared with every department (the server's default) or attached to this department */
  shared?: boolean;
  revision?: number;
}

export interface DeptHandlersBackend {
  overview(): Promise<ManagerOverview>;
  people(q?: string): Promise<{ users: { id: string; name: string }[] }>;
  addMember(deptId: string, userId: string): Promise<ManagedDepartment>;
  removeMember(deptId: string, userId: string): Promise<ManagedDepartment>;
  createContact(deptId: string, body: ManagerContactBody): Promise<Contact>;
  patchContact(deptId: string, contactId: string, body: ManagerContactBody): Promise<Contact>;
  attach(deptId: string, contactId: string): Promise<Contact>;
  detach(deptId: string, contactId: string): Promise<{ id: string; department_id: string; detached: true }>;
  erase(deptId: string, contactId: string): Promise<{ id: string; erased: boolean; links_revoked: number }>;
}

const B = 'tickets/dept-handlers';
const enc = encodeURIComponent;

const rest: DeptHandlersBackend = {
  overview: () => get<ManagerOverview>(B),
  people: (q) => get<{ users: { id: string; name: string }[] }>(`${B}/people${q?.trim() ? `?q=${enc(q.trim())}` : ''}`),
  addMember: (d, u) => put<ManagedDepartment>(`${B}/${enc(d)}/members/${enc(u)}`, {}),
  removeMember: (d, u) => api<ManagedDepartment>(`${B}/${enc(d)}/members/${enc(u)}`, { method: 'DELETE' }),
  createContact: (d, body) => post<Contact>(`${B}/${enc(d)}/contacts`, body),
  patchContact: (d, c, body) => api<Contact>(`${B}/${enc(d)}/contacts/${enc(c)}`, { method: 'PATCH', body: JSON.stringify(body) }),
  attach: (d, c) => put<Contact>(`${B}/${enc(d)}/contacts/${enc(c)}`, {}),
  detach: (d, c) => api<{ id: string; department_id: string; detached: true }>(`${B}/${enc(d)}/contacts/${enc(c)}`, { method: 'DELETE' }),
  erase: (d, c) => post<{ id: string; erased: boolean; links_revoked: number }>(`${B}/${enc(d)}/contacts/${enc(c)}/erase`, { confirm: true }),
};

const denied = (): Promise<never> =>
  Promise.reject(new ApiError(403, { code: 'forbidden', user_message: '', retryable: false, correlation_id: '', details: { permission: 'tickets.handlers' } }));

const demo: DeptHandlersBackend = {
  overview: () => Promise.resolve({ departments: [], can_manage: false, full_phones: false }),
  people: () => Promise.resolve({ users: [] }),
  addMember: denied,
  removeMember: denied,
  createContact: denied,
  patchContact: denied,
  attach: denied,
  detach: denied,
  erase: denied,
};

export function deptHandlersApi(): DeptHandlersBackend {
  return isApi() ? rest : demo;
}
