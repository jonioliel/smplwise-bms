/**
 * CR-038 slice 1: the ONLY module of the frontend that talks to `/api/v1/tickets/...` (smplwise_vms/backend/smplwise/routers/tickets.py and
 * tickets_admin.py). Without a backend (static preview, design review) every call is answered by the in-memory demo store in
 * ./tickets-mock.ts (the schedules.ts / electricity-billing.ts pattern). A change of the wire contract is an edit here and there.
 *
 * Every route but `GET tickets/module` answers 404 `feature_disabled` while the module is off; an invisible ticket is the same 404
 * `ticket_not_found` as an unknown id (the server's single visibility check decides - the screens never filter for security).
 */
import { api, apiUrl, get, patch, post, put, upload } from './client';
import { isApi } from './session';
import { mockBackend } from './tickets-mock';
import type { TicketLang, TicketName } from '../tickets/naming';
import type { CostMode, TicketCostBlock } from './tickets-costs';

export type TicketStatus = 'new' | 'assigned' | 'acknowledged' | 'in_progress' | 'waiting_part' | 'done' | 'returned' | 'closed' | 'cancelled';
export type StatusFilter = 'open' | 'unassigned' | 'handling' | 'done' | 'closed' | 'all';
export type ListScope = 'visible' | 'mine' | 'department' | 'all';
export type Severity = 'info' | 'alert' | 'critical';
export type DetailMode = 'drawer' | 'fullscreen' | 'drawer_fullscreen';
export type NewTicketMode = 'sheet' | 'dialog';

export interface DeptBrief { id: string; key: string; name: string; icon: string | null; color: string | null }
export interface PriorityBrief { id: string; key: string; name: string; rank: number; severity: Severity }
export interface Assignee { kind: 'user' | 'contact'; id: string | null; name: string; since: string | null; acknowledged_at: string | null }

/** One row of a list (a card). `view: limited` = a creator or internal assignee who is not a member (no internal content). */
export interface TicketItem {
  id: string;
  number: number;
  title: string;
  excerpt: string;
  status: TicketStatus;
  origin: string;
  department: DeptBrief | null;
  category: { id: string; name: string } | null;
  priority: PriorityBrief | null;
  place_text: string;
  device_name: string;
  created_by: { id: string; name: string };
  created_at: string;
  last_activity_at: string;
  assignee: Assignee | null;
  last_assignee_name: string | null;
  eta_at: string | null;
  waiting_on: 'manager' | 'assignee' | 'none';
  waiting_reason: string | null;
  reopen_count: number;
  external_stale: boolean;
  closed_at: string | null;
  revision: number;
  view: 'full' | 'limited';
}

export interface TicketEvent {
  id: string;
  at: string;
  kind: string;
  actor: { kind: string; name: string; me: boolean };
  from: TicketStatus | null;
  to: TicketStatus | null;
  body: string | null;
  data: Record<string, unknown>;
  via: string;
  /** visible to the handler (slice 4: the external page) */
  external: boolean;
}

export interface TicketAttachment {
  id: string;
  at: string;
  width: number;
  height: number;
  bytes: number;
  external: boolean;
  mine: boolean;
  can_delete: boolean;
  /** relative to /api/v1/ */
  url: string;
}

export interface TicketAssignment {
  id: string;
  kind: 'user' | 'contact';
  name: string;
  channel: string;
  assigned_at: string;
  assigned_by_name: string;
  acknowledged_at: string | null;
  ended_at: string | null;
  end_reason: string | null;
  return_kind: 'cannot_handle' | 'not_mine' | null;
  return_reason: string | null;
  /** slice 9 (D32): the cost-claim requirement of an external assignment (null for an internal user) */
  cost_claim?: CostMode | null;
}

export interface TicketCan {
  edit_fields: string[];
  assign: boolean;
  assign_external: boolean;
  note: boolean;
  note_external: boolean;
  attach: boolean;
  attach_external: boolean;
  eta: boolean;
  return: boolean;
  manage: boolean;
}

export interface TicketDetail extends Omit<TicketItem, 'excerpt'> {
  description: string;
  events: TicketEvent[];
  attachments: TicketAttachment[];
  close_note: string | null;
  closed_by_name: string | null;
  duplicate_of: { id: string; number: number } | null;
  reopen_until: string | null;
  can: TicketCan;
  transitions: { to: TicketStatus; note_required: boolean }[];
  assignments: TicketAssignment[];
  /** slice 9 (11A.3 / 11A.8): the cost status chip for everyone; amounts and actions only with tickets.costs.view */
  cost?: TicketCostBlock;
}

export interface UiSettings { detail: DetailMode; new_ticket: NewTicketMode }
export type NameEntries = Record<TicketLang, TicketName>;
export type NameDoc = NameEntries & { revision: number };

/** GET tickets/module - the one route that answers while the module is off. */
export interface ModuleState { enabled: boolean; public_ready: boolean; name: NameEntries; name_revision: number; ui: UiSettings }

export interface MetaDepartment {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  color: string | null;
  my_role: 'manager' | 'member' | null;
  can_create: boolean;
  can_manage: boolean;
  open_to_all: boolean;
  categories: { id: string; name: string; parent_id: string | null; default_priority_id: string | null }[];
  priorities: { id: string; key: string; name: string; rank: number; severity: Severity; is_default: boolean }[];
}
export interface Meta {
  departments: MetaDepartment[];
  can: { view: boolean; create: boolean; manage: boolean; all_departments: boolean; external: boolean; configure: boolean };
}

export interface ListQuery { scope: ListScope; status: StatusFilter; department_id?: string; q?: string; limit?: number; cursor?: string | null }
export interface ListPage { items: TicketItem[]; next_cursor: string | null }

export interface CreateBody {
  department_id: string;
  category_id?: string | null;
  priority_id?: string | null;
  title: string;
  description?: string;
  assign?: { kind: 'user'; id: string } | null;
  assign_note?: string;
  assign_note_external?: boolean;
  client_request_id: string;
}
export type CreateAnswer = (TicketDetail | { id: string; number: number; view: 'none' }) & { result: 'created' | 'absorbed' };
export interface PatchBody { title?: string; description?: string; category_id?: string | null; priority_id?: string; department_id?: string; revision: number }
/** `override_claim_reason` (slice 9, 11A.3): close despite a pending REQUIRED cost claim (tickets.costs; else 409 cost_claim_pending) */
export interface StatusBody { to: TicketStatus; note?: string | null; duplicate_of?: string | null; override_claim_reason?: string; revision: number }
/** `kind: 'contact'` + `cost_claim` are slice 4 / slice 9 (D32: the claim requirement of THIS assignment; omitted = the preselection) */
export interface AssignBody { assignee: { kind: 'user' | 'contact'; id: string }; note?: string | null; note_external?: boolean; cost_claim?: CostMode; revision: number }
export interface ReturnBody { kind: 'cannot_handle' | 'not_mine'; reason: string; revision: number }
export type ReturnAnswer = TicketDetail | { id: string; view: 'none'; status: 'returned' };
export interface Eligible { kind: 'user'; id: string; name: string; member_role: 'manager' | 'member' }

// ---------------------------------------------------------------- settings (the module's own screen)

export interface AdminCategory { id: string; name: string; parent_id: string | null; default_priority_id: string | null; sort_order: number; active: boolean }
export interface AdminPriority { id: string; key: string; name: string; rank: number; severity: Severity; is_default: boolean; active: boolean }
export interface AdminMember { kind: 'user' | 'group'; id: string; name: string; role: 'manager' | 'member'; notify_new: boolean; added_at: string }
export interface AdminDepartment {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  active: boolean;
  open_to_all: boolean;
  reopen_days: number;
  revision: number;
  open_tickets: number;
  categories: AdminCategory[];
  priorities: AdminPriority[];
  members: AdminMember[];
  can_edit_members: boolean;
}
export interface DepartmentBody { key?: string; name?: string; description?: string; active?: boolean; open_to_all?: boolean; reopen_days?: number; sort_order?: number; revision?: number }
export interface Holder {
  id: string;
  name: string;
  active: boolean;
  grants: { binding_id: string; permissions: string[]; via: 'grant' | 'group' | 'role'; role_id: string; role_name: string; group_name: string | null;
    scope_type: string; scope_id: string; scope_name: string; effect: 'allow' | 'deny'; expires_at: string | null }[];
}
export interface HoldersResponse { users: Holder[]; grant_roles: string[] }
export interface SettingsDoc { revision: number; ui: UiSettings }

export interface TicketsBackend {
  module(): Promise<ModuleState>;
  meta(): Promise<Meta>;
  list(q: ListQuery): Promise<ListPage>;
  get(id: string): Promise<TicketDetail>;
  create(body: CreateBody): Promise<CreateAnswer>;
  patch(id: string, body: PatchBody): Promise<TicketDetail>;
  status(id: string, body: StatusBody): Promise<TicketDetail>;
  assign(id: string, body: AssignBody): Promise<TicketDetail>;
  giveBack(id: string, body: ReturnBody): Promise<ReturnAnswer>;
  note(id: string, text: string, external: boolean): Promise<TicketDetail>;
  eta(id: string, etaAt: string | null): Promise<TicketDetail>;
  upload(id: string, file: File, external: boolean): Promise<TicketDetail>;
  removePhoto(id: string, attachmentId: string): Promise<TicketDetail>;
  photoUrl(att: TicketAttachment): string;
  assignees(departmentId: string, ticketId?: string): Promise<{ users: Eligible[] }>;
  settings(): Promise<SettingsDoc>;
  saveSettings(revision: number, ui: Partial<UiSettings>): Promise<SettingsDoc>;
  saveName(revision: number, names: Partial<NameEntries>): Promise<NameDoc>;
  departments(): Promise<{ departments: AdminDepartment[]; all_departments: boolean }>;
  createDepartment(body: DepartmentBody): Promise<AdminDepartment>;
  patchDepartment(id: string, body: DepartmentBody): Promise<AdminDepartment>;
  deleteDepartment(id: string): Promise<void>;
  createCategory(departmentId: string, name: string): Promise<AdminDepartment>;
  patchCategory(id: string, body: { name?: string; active?: boolean; default_priority_id?: string | null }): Promise<AdminDepartment>;
  deleteCategory(id: string): Promise<AdminDepartment>;
  patchPriority(id: string, body: { name?: string; is_default?: boolean; active?: boolean }): Promise<AdminDepartment>;
  putMember(departmentId: string, kind: 'user' | 'group', subjectId: string, role: 'manager' | 'member'): Promise<AdminDepartment>;
  deleteMember(departmentId: string, kind: 'user' | 'group', subjectId: string): Promise<AdminDepartment>;
  directory(q?: string): Promise<{ users: { id: string; name: string }[]; groups: { id: string; name: string }[] }>;
  holders(): Promise<HoldersResponse>;
}

const T = 'tickets';
const enc = encodeURIComponent;
const qs = (o: Record<string, string | number | null | undefined>): string => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
};
const del = <R>(path: string) => api<R>(path, { method: 'DELETE' });

const rest: TicketsBackend = {
  module: () => get<ModuleState>(`${T}/module`),
  meta: () => get<Meta>(`${T}/meta`),
  list: (q) => get<ListPage>(`${T}${qs({ scope: q.scope, status: q.status, department_id: q.department_id, q: q.q?.trim(), limit: q.limit, cursor: q.cursor })}`),
  get: (id) => get<TicketDetail>(`${T}/${enc(id)}`),
  create: (body) => post<CreateAnswer>(T, body),
  patch: (id, body) => patch<TicketDetail>(`${T}/${enc(id)}`, body),
  status: (id, body) => post<TicketDetail>(`${T}/${enc(id)}/status`, body),
  assign: (id, body) => post<TicketDetail>(`${T}/${enc(id)}/assign`, body),
  giveBack: (id, body) => post<ReturnAnswer>(`${T}/${enc(id)}/return`, body),
  note: (id, text, external) => post<TicketDetail>(`${T}/${enc(id)}/notes`, { text, external }),
  eta: (id, etaAt) => post<TicketDetail>(`${T}/${enc(id)}/eta`, { eta_at: etaAt }),
  upload: (id, file, external) => {
    const form = new FormData();
    form.append('file', file, file.name || 'photo.jpg');
    form.append('external', external ? 'true' : 'false');
    return upload<TicketDetail>(`${T}/${enc(id)}/attachments`, form);
  },
  removePhoto: (id, attachmentId) => del<TicketDetail>(`${T}/${enc(id)}/attachments/${enc(attachmentId)}`),
  photoUrl: (att) => apiUrl(att.url),
  assignees: (departmentId, ticketId) => get<{ users: Eligible[] }>(`${T}/assignees${qs({ department_id: departmentId, ticket_id: ticketId })}`),
  settings: () => get<SettingsDoc>(`${T}/settings`),
  saveSettings: (revision, ui) => put<SettingsDoc>(`${T}/settings`, { revision, ui }),
  saveName: (revision, names) => put<NameDoc>(`${T}/name`, { revision, ...names }),
  departments: () => get<{ departments: AdminDepartment[]; all_departments: boolean }>(`${T}/admin/departments`),
  createDepartment: (body) => post<AdminDepartment>(`${T}/admin/departments`, body),
  patchDepartment: (id, body) => patch<AdminDepartment>(`${T}/admin/departments/${enc(id)}`, body),
  deleteDepartment: (id) => del<void>(`${T}/admin/departments/${enc(id)}`),
  createCategory: (departmentId, name) => post<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/categories`, { name }),
  patchCategory: (id, body) => patch<AdminDepartment>(`${T}/admin/categories/${enc(id)}`, body),
  deleteCategory: (id) => del<AdminDepartment>(`${T}/admin/categories/${enc(id)}`),
  patchPriority: (id, body) => patch<AdminDepartment>(`${T}/admin/priorities/${enc(id)}`, body),
  putMember: (departmentId, kind, subjectId, role) => put<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/members/${kind}/${enc(subjectId)}`, { role }),
  deleteMember: (departmentId, kind, subjectId) => del<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/members/${kind}/${enc(subjectId)}`),
  directory: (q = '') => get<{ users: { id: string; name: string }[]; groups: { id: string; name: string }[] }>(`${T}/admin/directory${qs({ q })}`),
  holders: () => get<HoldersResponse>(`${T}/admin/holders`),
};

/** The backend in force: REST with a server, the demo store without one. */
export function ticketsApi(): TicketsBackend {
  return isApi() ? rest : mockBackend;
}

/** A client request id for an idempotent create (the server's CLIENT_REQUEST_RE: 8-64 of [A-Za-z0-9_-], a letter or digit first). */
export function newRequestId(): string {
  const raw = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `t${raw}`.slice(0, 40);
}
