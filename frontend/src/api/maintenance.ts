/**
 * CR-MAINT215 slice 2: the ONLY module of the frontend that talks to `/api/v1/maintenance...` (smplwise_vms/backend/smplwise/routers/maintenance.py).
 * The server is the authority for every permission and visibility rule; the screens only hide what `can` says is not offered.
 * Nothing here reaches a device: a service request is opened only through the tickets module, and only while that module is on.
 */
import { del, get, patch, post, put } from './client';

export type TaskKind = 'certificate' | 'preventive' | 'round' | 'vendor_document';
export const TASK_KINDS: readonly TaskKind[] = ['certificate', 'preventive', 'round', 'vendor_document'];
export type DueState = 'overdue' | 'due_soon' | 'ok' | 'none';
export type IntervalUnit = 'day' | 'week' | 'month' | 'year';
export const INTERVAL_UNITS: readonly IntervalUnit[] = ['day', 'week', 'month', 'year'];
export type ItemKind = 'check' | 'number' | 'text';
export type DocType = 'insurance' | 'electrician_license' | 'work_at_height' | 'other';
export const DOC_TYPES: readonly DocType[] = ['insurance', 'electrician_license', 'work_at_height', 'other'];
export const CATEGORIES = ['elevator', 'generator', 'fire', 'kitchen_hood', 'electrical', 'pumps', 'hvac', 'water', 'safety', 'other'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface PlaceRef { kind: 'site' | 'building' | 'floor'; id: string; name: string }
export interface Interval { unit: IntervalUnit; count: number }
export interface ChecklistItem { key: string; label: string; kind?: ItemKind; required?: boolean; min?: number | null; max?: number | null; unit?: string }

export interface RunSummary { id: string; started_by_name: string; started_at: string; answered: number; total: number }
export interface LastRun { id: string; performed_on: string | null; finished_at: string | null; result: 'ok' | 'issues' | null; issues: number }

export interface Task {
  id: string;
  kind: TaskKind;
  title: string;
  category: string;
  place: PlaceRef | null;
  place_path: PlaceRef[];
  checklist_count: number;
  entity_id: string | null;
  elevator_id: string | null;
  generator_id: string | null;
  vendor_id: string | null;
  doc_type: DocType | null;
  owner_user_id: string | null;
  interval: Interval | null;
  anchor_date: string | null;
  due_date: string | null;
  lead_days: number;
  state: DueState;
  days_left: number | null;
  active: boolean;
  auto_ticket: boolean;
  department_id: string | null;
  ticket_id: string | null;
  last_done_at: string | null;
  revision: number;
  vendor_name?: string | null;
  elevator_name?: string | null;
  generator_name?: string | null;
  entity_name?: string | null;
  owner_name?: string;
  /** rounds only */
  open_run?: RunSummary | null;
  last_run?: LastRun | null;
}

export interface TaskDetail extends Task {
  notes: string;
  checklist: ChecklistItem[];
  ticket_error: string | null;
  open_run_id: string | null;
  can: { edit: boolean; complete: boolean; start_round: boolean; open_request: boolean };
}

export interface TaskList { items: Task[]; counts: Record<DueState, number>; truncated: boolean; today: string }

export interface Answer { ok?: boolean | null; value?: number | string | null; note?: string; at?: string; ticket_id?: string }

export interface MaintRecord {
  id: string;
  task_id: string;
  kind: 'completion' | 'run';
  status: 'open' | 'done' | 'cancelled';
  started_by_name: string;
  started_at: string;
  finished_at: string | null;
  performed_on: string | null;
  due_before: string | null;
  due_after: string | null;
  valid_until: string | null;
  note: string;
  result: 'ok' | 'issues' | null;
  checklist: ChecklistItem[];
  answers: Record<string, Answer>;
  ticket_ids: string[];
  revision: number;
}

export interface Run extends MaintRecord {
  task: { id: string; title: string; entity_id: string | null; department_id?: string | null };
  can: { write: boolean; open_request: boolean };
  /** the departments this person may open a request in from a checkpoint (empty while the tickets module is off) */
  request_departments?: { id: string; name: string }[];
}

export interface ModuleState {
  enabled: boolean;
  can: { view: boolean; perform: boolean; manage: boolean; open_request: boolean };
  /** the tickets module's switch: every request affordance leaves while it is off (owner rule 2026-10-20) */
  tickets_on?: boolean;
}

export interface VendorRow { id: string; name: string; state: 'expired' | 'expiring' | 'ok' | 'none'; expired: { doc_type: DocType; valid_until: string }[]; expiring: { doc_type: DocType; valid_until: string }[] }
export interface VendorCard { vendor_id: string; name: string; state: VendorRow['state']; documents: Task[]; tasks: Task[] }

export interface FormPlace { kind: 'site' | 'building' | 'floor'; id: string; name: string; parent_id: string | null }
export interface Options {
  places: FormPlace[];
  placeless: boolean;
  vendors: VendorRow[];
  departments: { id: string; name: string }[];
  people: { id: string; name: string }[];
  categories: string[];
  doc_types: string[];
  defaults: { lead_days: Record<TaskKind, number>; tag_base_url: string };
  tickets_on: boolean;
}

export type TagMedium = 'qr' | 'nfc';
export interface Tag {
  id: string;
  token: string;
  path: string;
  target_kind: 'task' | 'entity';
  target_id: string;
  label: string;
  medium: TagMedium;
  created_at: string;
  revoked_at: string | null;
  last_scan_at: string | null;
  target_name?: string;
  target_task_kind?: TaskKind | null;
}

export type ScanAnswer =
  | { kind: 'task'; label: string; task: TaskDetail; route: string }
  | { kind: 'entity'; label: string; entity_id: string; route: string; tasks: Task[]; open_requests: number | null; can: { open_request: boolean } };

/** A task body for create / PATCH (only the fields sent change). */
export interface TaskBody {
  kind?: TaskKind;
  title?: string;
  category?: string;
  notes?: string;
  place?: { kind: 'site' | 'building' | 'floor'; id: string } | null;
  vendor_id?: string | null;
  doc_type?: DocType | null;
  owner_user_id?: string | null;
  entity_id?: string | null;
  interval?: Interval | null;
  anchor_date?: string | null;
  due_date?: string | null;
  lead_days?: number | null;
  checklist?: ChecklistItem[];
  auto_ticket?: boolean;
  department_id?: string | null;
  active?: boolean;
  revision?: number;
}

export interface CompleteBody { performed_on?: string; valid_until?: string; next_due?: string; note?: string; revision?: number }

const B = 'maintenance';
const enc = encodeURIComponent;

export const maintApi = {
  module: () => get<ModuleState>(`${B}/module`),
  tasks: (q: { kind?: TaskKind; include_inactive?: boolean } = {}) => {
    const p = new URLSearchParams();
    if (q.kind) p.set('kind', q.kind);
    if (q.include_inactive) p.set('include_inactive', 'true');
    const s = p.toString();
    return get<TaskList>(`${B}/tasks${s ? `?${s}` : ''}`);
  },
  task: (id: string) => get<TaskDetail>(`${B}/tasks/${enc(id)}`),
  records: (id: string) => get<{ items: MaintRecord[] }>(`${B}/tasks/${enc(id)}/records`),
  create: (body: TaskBody) => post<TaskDetail>(`${B}/tasks`, body),
  update: (id: string, body: TaskBody) => patch<TaskDetail>(`${B}/tasks/${enc(id)}`, body),
  remove: (id: string) => del(`${B}/tasks/${enc(id)}`),
  complete: (id: string, body: CompleteBody) => post<{ record: MaintRecord; task: TaskDetail }>(`${B}/tasks/${enc(id)}/complete`, body),
  startRun: (taskId: string) => post<Run>(`${B}/tasks/${enc(taskId)}/runs`, {}),
  run: (runId: string) => get<Run>(`${B}/runs/${enc(runId)}`),
  answers: (runId: string, answers: Record<string, Answer>, revision?: number) => put<Run>(`${B}/runs/${enc(runId)}/answers`, { answers, ...(revision !== undefined ? { revision } : {}) }),
  finish: (runId: string, note?: string) => post<Run>(`${B}/runs/${enc(runId)}/finish`, note ? { note } : {}),
  cancel: (runId: string) => post<Run>(`${B}/runs/${enc(runId)}/cancel`, {}),
  request: (runId: string, key: string, body: { department_id?: string } = {}) => post<{ ticket_id: string; number: number; run: Run }>(`${B}/runs/${enc(runId)}/items/${enc(key)}/request`, body),
  vendors: () => get<{ items: VendorRow[] }>(`${B}/vendors`),
  vendor: (id: string) => get<VendorCard>(`${B}/vendors/${enc(id)}/documents`),
  options: () => get<Options>(`${B}/options`),
  tags: () => get<{ items: Tag[]; base_url: string }>(`${B}/tags`),
  createTag: (body: { target_kind: 'task' | 'entity'; target_id: string; label?: string; medium?: TagMedium }) => post<Tag>(`${B}/tags`, body),
  revokeTag: (id: string) => del(`${B}/tags/${enc(id)}`),
  scan: (token: string) => get<ScanAnswer>(`${B}/scan/${enc(token)}`),
};
