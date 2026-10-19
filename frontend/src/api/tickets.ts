/**
 * CR-038 slice 1: the ONLY module of the frontend that talks to `/api/v1/tickets/...` (smplwise_vms/backend/smplwise/routers/tickets.py and
 * tickets_admin.py). Without a backend (static preview, design review) every call is answered by the in-memory demo store in
 * ./tickets-mock.ts (the schedules.ts / electricity-billing.ts pattern). A change of the wire contract is an edit here and there.
 *
 * Every route but `GET tickets/module` answers 404 `feature_disabled` while the module is off; an invisible ticket is the same 404
 * `ticket_not_found` as an unknown id (the server's single visibility check decides - the screens never filter for security).
 */
import { api, apiUrl, get, patch, post, put, resourceUrl, upload } from './client';
import { isApi } from './session';
import { mockBackend } from './tickets-mock';
import type { TicketLang, TicketName } from '../tickets/naming';
import type { CostMode, TicketCostBlock } from './tickets-costs';
import type { RequestLocation } from './tickets-locations';

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
  /** slice 2: the SLA dues (null = no threshold applies now / off). TK251: null for a limited viewer (management information) */
  sla?: { ack_due_at: string | null; stuck_due_at: string | null; resolve_due_at: string | null } | null;
  /** slice 3: a device's ticket */
  entity_id?: string | null;
}

/** Slice 3 (section 12.3): one line of a device's 24 h history - no person name ever (the actor's type only, a name for an automation). */
export interface HistoryItem {
  at: string;
  kind: string;
  from: Record<string, string | number | boolean | null>;
  to: Record<string, string | number | boolean | null>;
  changed: string[];
  actor: { type: string; name?: string };
}
export interface HistorySummary {
  source: 'device_activity' | 'state_history' | 'none' | null;
  window_hours: number;
  window_from: string | null;
  window_to: string | null;
  count: number;
  truncated: boolean;
  withheld: string | null;
  lines: HistoryItem[];
}
/** The frozen snapshot on a ticket's detail (internal content; present only when the viewer may read the device too). */
export interface DeviceContext extends HistorySummary {
  captured_at: string | null;
  coverage: { from?: string | null; gaps?: { from: string; to: string }[]; availability?: string };
  /** D3 / D23: whether it may EVER be shown to an outside handler (never for locks, alarm panels, covers, cameras) */
  shareable: boolean;
}
/** GET tickets/by-entity/{entity_id} - the device window's tab. */
export interface EntityTickets {
  entity: { entity_id: string; name: string; domain: string; tracked: boolean };
  items: TicketItem[];
  open_count: number;
  can_create: boolean;
  place_text: string;
  /** what a new ticket would carry (only with can_create) */
  history: HistorySummary | null;
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
  /** owner 14.10: full deletion - manager rights here AND tickets.delete where the ticket lies (absent from older servers) */
  delete?: boolean;
  /** TKUI3B (contract v1.4 §2): the manager of an open request may change the internal owner (absent from older servers) */
  change_owner?: boolean;
}

/** TKUI3B (contract v1.4 §2): "אחראי בארגון" - the internal person responsible; `source` says how it was set. */
export interface InternalOwner { id: string; name: string; since: string; source: 'handoff' | 'manual' | 'rfq'; active: boolean }

export interface TicketDetail extends Omit<TicketItem, 'excerpt'> {
  description: string;
  /** CR-ORG-LOCATIONS: the organisation location named at creation (its snapshot; null / absent: none) */
  location?: RequestLocation | null;
  events: TicketEvent[];
  attachments: TicketAttachment[];
  close_note: string | null;
  closed_by_name: string | null;
  duplicate_of: { id: string; number: number } | null;
  reopen_until: string | null;
  can: TicketCan;
  transitions: { to: TicketStatus; note_required: boolean }[];
  assignments: TicketAssignment[];
  /** slice 3 */
  device_context?: DeviceContext | null;
  /** slice 9 (11A.3 / 11A.8): the cost status chip for everyone; amounts and actions only with tickets.costs.view */
  cost?: TicketCostBlock;
  /** TKUI3B: the internal owner - full view only (null for a limited viewer or while nobody is responsible; absent from older servers) */
  internal_owner?: InternalOwner | null;
  /** TKRFQ4 (RFQ contract 18.4): the request for quotation this item was opened from (a work order) - full view only; `id` null when the
   * viewer may not open the request; `siblings` = the other items the same request opened (a split, one per vendor) the viewer may see */
  rfq_origin?: RfqOrigin | null;
}

export interface RfqOrigin { id: string | null; number: number; ref: string; work_from: string | null; work_to: string | null; siblings: { id: string; number: number }[];
  /** RFQ-VENDOR-UPLOAD (contract 19.10): the awarded vendor's files the work order references - [] without tickets.costs.view */
  vendor_files?: { id: string; name: string; kind: string; bytes: number }[] }

/** RFQ-VENDOR-UPLOAD: where a referenced vendor file is read (same-origin; always a download, costs.view on the ticket). */
export function rfqVendorFileUrl(ticketId: string, fileId: string): string {
  return resourceUrl(`api/v1/tickets/${encodeURIComponent(ticketId)}/rfq-vendor-files/${encodeURIComponent(fileId)}`);
}

/** TKUI1 (2.6.0): the request drawer's defaults - the tab it opens on, its desktop size (a viewer's own switch wins) and the phone sheet. */
export type DetailTab = 'overview' | 'conv' | 'costs' | 'history';
export type DrawerSizeSetting = 'drawer' | 'wide' | 'full';
export type PhoneSheetSetting = 'full' | 'half';
export interface UiSettings { detail: DetailMode; new_ticket: NewTicketMode; detail_tab?: DetailTab; drawer_size?: DrawerSizeSetting; phone_sheet?: PhoneSheetSetting; /* HANDLERLOAD */ handled_days?: 1 | 7 | 30;
  /* MGRDASH (read through tickets/overview-model.ts overviewSettingsOf) */ dash_handler_numbers?: string; dash_vendors?: string; dash_busy?: number; dash_busy_departments?: Record<string, number>; dash_compare?: string;
  /* MGRDASH phase 5: the alerts' values */ dash_digest_hour?: number; dash_dept_stuck?: number }
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
  /** CR-DEPT-MANAGER-HANDLERS: the caller manages this department's handlers and vendors (an older server: absent) */
  can_handlers?: boolean;
  open_to_all: boolean;
  categories: { id: string; name: string; parent_id: string | null; default_priority_id: string | null; domains?: string[] }[];
  priorities: { id: string; key: string; name: string; rank: number; severity: Severity; is_default: boolean }[];
  /** slice 2: the department's active ticket templates (the create form prefills from them) */
  templates?: { id: string; name: string; title: string; body: string; category_id: string | null; priority_key: PriorityKey | null }[];
}
export interface Meta {
  departments: MetaDepartment[];
  can: { view: boolean; create: boolean; manage: boolean; all_departments: boolean; external: boolean; configure: boolean; handlers?: boolean;
    /** VPORTALRFQ: may see / decide the vendors' technician requests (tickets.configure or tickets.technician_requests) */
    technician_requests?: boolean };
}

export interface ListQuery { scope: ListScope; status: StatusFilter; department_id?: string; q?: string; limit?: number; cursor?: string | null }
export interface ListPage { items: TicketItem[]; next_cursor: string | null }

export interface CreateBody {
  department_id: string;
  category_id?: string | null;
  priority_id?: string | null;
  title: string;
  description?: string;
  assign?: { kind: 'user' | 'contact'; id: string } | null; // TKSTAFF2: a handler of either kind (tickets/assignee-model.ts)
  assign_note?: string;
  assign_note_external?: boolean;
  client_request_id: string;
  /** slice 3: a device's ticket - the server resolves the place and freezes the 24 h history */
  entity_id?: string | null;
  /** CR-ORG-LOCATIONS: an active organisation location (reference + snapshot), or `place_text` = "other (free text)" */
  location_id?: string;
  place_text?: string;
}
export type CreateAnswer = (TicketDetail | { id: string; number: number; view: 'none' }) & { result: 'created' | 'absorbed'; open_for_entity?: TicketItem[] };
export interface PatchBody {
  title?: string; description?: string; category_id?: string | null; priority_id?: string; department_id?: string;
  /** owner 2026-10-19: change the location after creation (a new snapshot; null clears) / the "other (free text)" place */
  location_id?: string | null; place_text?: string;
  revision: number;
}
/** `override_claim_reason` (slice 9, 11A.3): close despite a pending REQUIRED cost claim (tickets.costs; else 409 cost_claim_pending) */
export interface StatusBody { to: TicketStatus; note?: string | null; duplicate_of?: string | null; override_claim_reason?: string; revision: number }
/** `kind: 'contact'` + `cost_claim` are slice 4 / slice 9 (D32: the claim requirement of THIS assignment; omitted = the preselection) */
export interface AssignBody { assignee: { kind: 'user' | 'contact'; id: string }; note?: string | null; note_external?: boolean; cost_claim?: CostMode; revision: number }
export interface ReturnBody { kind: 'cannot_handle' | 'not_mine'; reason: string; revision: number }
export type ReturnAnswer = TicketDetail | { id: string; view: 'none'; status: 'returned' };
export interface Eligible { kind: 'user'; id: string; name: string; member_role: 'manager' | 'member' }
/**
 * TKSTAFF2: one handler of the picker (`handlers` of GET tickets/assignees, services/tickets/assignees.py) - an account holder
 * (`kind: 'user'`, `account: true`) or a staff contact without an account (`kind: 'contact'`, `account: false`: an employee of the
 * directory; it gets the personal handler link). `key` is the board / table filter key (`user:<id>` / `contact:<id>`); the phone is
 * masked unless the directory allows the full number.
 */
export interface Handler {
  key: string;
  kind: 'user' | 'contact';
  id: string;
  name: string;
  account: boolean;
  member_role: 'manager' | 'member' | null;
  phone: string | null;
  has_phone: boolean;
  preferred_channel: string;
}
export interface AssigneesList { users: Eligible[]; handlers?: Handler[] }

// ---------------------------------------------------------------- settings (the module's own screen)

export interface AdminCategory { id: string; name: string; parent_id: string | null; default_priority_id: string | null; domains: string[]; sort_order: number; active: boolean }
export type PriorityKey = 'urgent' | 'high' | 'normal' | 'low';
export interface SendHours { from: string; to: string }
export interface LinkDurations { sliding_days: number; cap_days: number; grace_hours: number }
/** slice 2: the department's own overrides (null = the installation value). */
export interface PolicyOverrides { link_sliding_days: number | null; link_cap_days: number | null; link_grace_hours: number | null; send_hours: SendHours | null; urgent_is_critical: boolean | null }
/** slice 2: what is in force for a department (services/tickets/policy.py). */
export interface EffectivePolicy { links: LinkDurations; send_hours: SendHours; urgent_is_critical: boolean; auto_close_after_days: number | null; share_history_external: boolean; reopen_days: number; overridden: string[] }
export interface InstallationDefaults { links: LinkDurations; send_hours: SendHours; urgent_is_critical: boolean }
/** slice 2: one row of the SLA grid (minutes; null = off). */
export interface SlaRow {
  priority_id: string; priority_key: PriorityKey; priority_name: string; priority_active: boolean;
  unassigned_after_min: number | null; link_unopened_min: number | null; ack_within_min: number | null; stuck_after_min: number | null;
  stuck_waiting_min: number | null; resolve_within_min: number | null; remind_every_min: number | null; max_reminders: number; manager_alert_after_steps: number;
  revision: number; updated_at: string | null; updated_by: string | null;
}
export type SlaField = 'unassigned_after_min' | 'link_unopened_min' | 'ack_within_min' | 'stuck_after_min' | 'stuck_waiting_min' | 'resolve_within_min'
  | 'remind_every_min' | 'max_reminders' | 'manager_alert_after_steps';
export type SlaPatch = { priority_id: string; revision: number } & Partial<Record<SlaField, number | null>>;
export interface AdminTemplate { id: string; kind: 'ticket'; name: string; title: string; body: string; category_id: string | null; priority_key: PriorityKey | null; active: boolean; revision: number; updated_at: string }
export interface TemplateBody { name?: string; title?: string; body?: string; category_id?: string | null; priority_key?: PriorityKey | null; active?: boolean; revision?: number }
export interface AdminPriority { id: string; key: string; name: string; rank: number; severity: Severity; is_default: boolean; active: boolean }
export interface AdminMember {
  kind: 'user' | 'group'; id: string; name: string; role: 'manager' | 'member'; notify_new: boolean; added_at: string;
  /** TKSTAFF1: a user member's mobile for the no-login staff link (display form; null = none), its message language and the user's WhatsApp switch */
  mobile?: string | null; notify_whatsapp?: boolean; lang?: 'he' | 'en' | 'ar' | 'ru';
  /** security review F3: the employee confirmed this number in their own account (until then no staff link is sent) */
  mobile_confirmed?: boolean;
  /** TKNOTIFOTP: the directory row, its "verify with a code" switch, whether a code is required, the manager-mark token (null = not offered) */
  contact_id?: string | null; phone_verify?: boolean; verify_required?: boolean; mobile_confirm?: string | null;
}
/** TKSTAFF1 review F3 / F4: GET /tickets/me/staff-mobile - the caller's OWN work-link mobile (last four digits only) */
export interface StaffMine { has_phone: boolean; phone: string | null; confirmed: boolean; confirm: string | null; notify_whatsapp: boolean; lang: string;
  /** TKNOTIFOTP: the number is confirmed only by typing the code sent to it */
  verify_required?: boolean; code_pending?: boolean; confirmed_via?: 'user' | 'manager' | 'code' | null }
export type StaffMineBody = { confirm: string } | { confirmed: false } | { notify_whatsapp: boolean };
/** TKSTAFF1: PUT /tickets/admin/staff/{user_id} (tickets.configure) - the mobile of an internal employee with an account */
export interface StaffMobile { user_id: string; contact_id: string | null; phone: string | null; has_phone: boolean; notify_whatsapp: boolean; lang: 'he' | 'en' | 'ar' | 'ru'; active: boolean; live_links: number;
  confirmed?: boolean; phone_verify?: boolean; verify_required?: boolean; confirm?: string | null }
export interface StaffMobileBody { phone?: string | null; lang?: 'he' | 'en' | 'ar' | 'ru'; notify_whatsapp?: boolean; /** TKNOTIFOTP */ phone_verify?: boolean }
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
  // slice 2
  auto_close_after_days: number | null;
  share_history_external: boolean;
  overrides: PolicyOverrides;
  effective: EffectivePolicy;
  sla: SlaRow[];
  templates: AdminTemplate[];
}
export interface DepartmentBody {
  key?: string; name?: string; description?: string; active?: boolean; open_to_all?: boolean; reopen_days?: number; sort_order?: number; revision?: number;
  // slice 2 - null clears an override
  auto_close_after_days?: number | null; share_history_external?: boolean; urgent_is_critical?: boolean | null;
  link_sliding_days?: number | null; link_cap_days?: number | null; link_grace_hours?: number | null; send_hours?: SendHours | null;
}
/** A soft-deleted department (owner 2026-10-14: "מחלקות שנמחקו" with its restore action). */
export interface DeletedDepartment { id: string; name: string; deleted_at: string; tickets: number }
export interface DepartmentsResponse { departments: AdminDepartment[]; all_departments: boolean; installation?: InstallationDefaults; deleted?: DeletedDepartment[] }
/** slice 2: a row of the "who may" matrix (a role and the ticket permissions it carries). */
export interface RoleRow { id: string; name: string; builtin: boolean; permissions: string[] }
export interface Holder {
  id: string;
  name: string;
  active: boolean;
  grants: { binding_id: string; permissions: string[]; via: 'grant' | 'group' | 'role'; role_id: string; role_name: string; group_name: string | null;
    scope_type: string; scope_id: string; scope_name: string; effect: 'allow' | 'deny'; expires_at: string | null }[];
}
export interface HoldersResponse { users: Holder[]; grant_roles: string[]; roles?: RoleRow[] }
/** slice 4: the handler page's keys of the document - its public address and the proxies whose client-address header is believed. */
export interface PublicSettings { base_url: string; trusted_proxy_cidrs: string[]; client_ip_header: 'cf-connecting-ip' | 'x-forwarded-for'; theme: 'light' | 'dark' | 'auto'; /* TK255 */ path_prefix?: string; legacy_t_paths?: boolean; /* a request field only */ confirm_live_links?: boolean }
/** CR-RFQ-PAYMENT-SCHEDULE: the requests-for-quotation keys the settings screen edits (the rest of the `rfq` block is read-only here). */
export interface RfqSettings { award_notice?: 'confirm' | 'auto' | 'off'; postpone_late_hours?: number; schedule_arrival?: boolean; arrival_reminder_hours?: number; question_reminder_hours?: number; question_badge_all_viewers?: boolean;
  /** RFQPAY2: hours between two reminders of the same overdue instalments (0 = once only) */
  instalment_reminder_hours?: number; vendor_uploads?: RfqVendorUploadSettings; [key: string]: unknown }
/** RFQ-VENDOR-UPLOAD (contract 19.10): a vendor's files on his quote / question - the switch (OFF by default) and the limits per vendor
 * per request, each inside a hard cap the server enforces (files 1-10, uploads 1-30, picture 1-8 MB, document 1-10 MB, total 1-50 MB). */
export interface RfqVendorUploadSettings { enabled: boolean; max_files: number; max_uploads: number; max_image_mb: number; max_doc_mb: number; max_total_mb: number }
/** VPORTAL: the vendor portal on the public page (OFF by default), how far back closed requests are listed and (2.6.4 review F1,
 * default ON) whether only a number confirmed by code may sign in */
export interface VendorPortalSettings { enabled: boolean; closed_months: number; require_confirmed_number?: boolean;
  /** VPORTALRFQ (default OFF): open requests for quotation / company technician requests inside the portal */
  rfqs?: boolean; technician_requests?: boolean }
export interface SettingsDoc { revision: number; ui: UiSettings; links?: LinkDurations; send_hours?: SendHours; urgent_is_critical?: boolean; organization_name?: string; public?: PublicSettings; device_long_press?: 'sheet' | 'menu' /* D17 (slice 3) */;
  /** PRIVORG-291: the contact point for privacy requests (e-mail or phone) and an optional https link ("" = not set) */
  privacy?: { contact: string; link: string };
  /** CR-DEPT-MANAGER-HANDLERS: "מנהלי מחלקה רואים מספרים מלאים" (system.configure, default off) */
  directory?: { managers_full_phones: boolean; /* NEEDSREVIEW: the report's thresholds (days / months) */ review_pending_days?: number; review_idle_months?: number }; rfq?: RfqSettings;
  vendor_portal?: VendorPortalSettings; brand?: { logo: string } /* VPORTAL: the logo's stamp ("" = none), set only by the logo routes */ }
export interface SettingsPatch { ui?: Partial<UiSettings>; links?: Partial<LinkDurations>; send_hours?: SendHours; urgent_is_critical?: boolean; organization_name?: string; privacy?: { contact?: string; link?: string }; public?: Partial<PublicSettings>; device_long_press?: 'sheet' | 'menu'; directory?: { managers_full_phones?: boolean; review_pending_days?: number; review_idle_months?: number };
  rfq?: { award_notice?: 'confirm' | 'auto' | 'off'; postpone_late_hours?: number; schedule_arrival?: boolean; arrival_reminder_hours?: number; question_reminder_hours?: number; question_badge_all_viewers?: boolean; instalment_reminder_hours?: number; vendor_uploads?: Partial<RfqVendorUploadSettings> }; vendor_portal?: Partial<VendorPortalSettings> }

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
  assignees(departmentId: string, ticketId?: string): Promise<AssigneesList>;
  settings(): Promise<SettingsDoc>;
  saveSettings(revision: number, ui: Partial<UiSettings>): Promise<SettingsDoc>;
  /** slice 2: any installation key of the document (links, send hours, urgent as critical, ui) */
  saveInstallation(revision: number, patch: SettingsPatch): Promise<SettingsDoc>;
  /** slice 3: the device window's tab */
  byEntity(entityId: string): Promise<EntityTickets>;
  saveName(revision: number, names: Partial<NameEntries>): Promise<NameDoc>;
  departments(): Promise<DepartmentsResponse>;
  createDepartment(body: DepartmentBody): Promise<AdminDepartment>;
  patchDepartment(id: string, body: DepartmentBody): Promise<AdminDepartment>;
  deleteDepartment(id: string): Promise<void>;
  /** owner 2026-10-14: a soft-deleted department back with everything under it (a taken key is replaced: `key_changed`) */
  restoreDepartment(id: string): Promise<AdminDepartment & { key_changed?: boolean }>;
  createCategory(departmentId: string, name: string): Promise<AdminDepartment>;
  patchCategory(id: string, body: { name?: string; active?: boolean; default_priority_id?: string | null; parent_id?: string | null; domains?: string[] }): Promise<AdminDepartment>;
  deleteCategory(id: string): Promise<AdminDepartment>;
  patchPriority(id: string, body: { name?: string; is_default?: boolean; active?: boolean; notify_severity?: Severity }): Promise<AdminDepartment>;
  /** slice 2: rows of the SLA grid (all or nothing; 409 sla_stale names the rows whose revision moved) */
  saveSla(departmentId: string, rows: SlaPatch[]): Promise<AdminDepartment>;
  createTemplate(departmentId: string, body: TemplateBody): Promise<AdminDepartment>;
  patchTemplate(id: string, body: TemplateBody): Promise<AdminDepartment>;
  deleteTemplate(id: string): Promise<AdminDepartment>;
  putMember(departmentId: string, kind: 'user' | 'group', subjectId: string, role: 'manager' | 'member', notifyNew?: boolean): Promise<AdminDepartment>;
  deleteMember(departmentId: string, kind: 'user' | 'group', subjectId: string): Promise<AdminDepartment>;
  /** TKSTAFF1: the mobile (E.164 validated by the server), language and WhatsApp switch of a staff member with an account */
  putStaffMobile(userId: string, body: StaffMobileBody): Promise<StaffMobile>;
  /** review F3 / F4: the caller's own work-link mobile - confirm the number a manager set, the own WhatsApp switch */
  myStaffMobile(): Promise<StaffMine>;
  setMyStaffMobile(body: StaffMineBody): Promise<StaffMine>;
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
  assignees: (departmentId, ticketId) => get<AssigneesList>(`${T}/assignees${qs({ department_id: departmentId, ticket_id: ticketId })}`),
  settings: () => get<SettingsDoc>(`${T}/settings`),
  saveSettings: (revision, ui) => put<SettingsDoc>(`${T}/settings`, { revision, ui }),
  saveInstallation: (revision, body) => put<SettingsDoc>(`${T}/settings`, { revision, ...body }),
  byEntity: (entityId) => get<EntityTickets>(`${T}/by-entity/${enc(entityId)}`),
  saveName: (revision, names) => put<NameDoc>(`${T}/name`, { revision, ...names }),
  departments: () => get<DepartmentsResponse>(`${T}/admin/departments`),
  createDepartment: (body) => post<AdminDepartment>(`${T}/admin/departments`, body),
  patchDepartment: (id, body) => patch<AdminDepartment>(`${T}/admin/departments/${enc(id)}`, body),
  deleteDepartment: (id) => del<void>(`${T}/admin/departments/${enc(id)}`),
  restoreDepartment: (id) => post<AdminDepartment & { key_changed?: boolean }>(`${T}/admin/departments/${enc(id)}/restore`, {}),
  createCategory: (departmentId, name) => post<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/categories`, { name }),
  patchCategory: (id, body) => patch<AdminDepartment>(`${T}/admin/categories/${enc(id)}`, body),
  deleteCategory: (id) => del<AdminDepartment>(`${T}/admin/categories/${enc(id)}`),
  patchPriority: (id, body) => patch<AdminDepartment>(`${T}/admin/priorities/${enc(id)}`, body),
  saveSla: (departmentId, rows) => put<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/sla`, { rows }),
  createTemplate: (departmentId, body) => post<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/templates`, body),
  patchTemplate: (id, body) => patch<AdminDepartment>(`${T}/admin/templates/${enc(id)}`, body),
  deleteTemplate: (id) => del<AdminDepartment>(`${T}/admin/templates/${enc(id)}`),
  putMember: (departmentId, kind, subjectId, role, notifyNew) =>
    put<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/members/${kind}/${enc(subjectId)}`, notifyNew === undefined ? { role } : { role, notify_new: notifyNew }),
  deleteMember: (departmentId, kind, subjectId) => del<AdminDepartment>(`${T}/admin/departments/${enc(departmentId)}/members/${kind}/${enc(subjectId)}`),
  putStaffMobile: (userId, body) => put<StaffMobile>(`${T}/admin/staff/${enc(userId)}`, body),
  myStaffMobile: () => get<StaffMine>(`${T}/me/staff-mobile`),
  setMyStaffMobile: (body) => put<StaffMine>(`${T}/me/staff-mobile`, body),
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
