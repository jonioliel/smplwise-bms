/**
 * WISKEY-PROFILES-EDIT-2390 (plan 2026-11-03 T8): the groups and profile fields editor (backend routers/access_control_profiles.py).
 * The browser never names a command of the access-control service and never sees its operation id: it edits a draft, asks for a
 * preview (the server keeps the review), and applies that review with the command envelope and `confirmed: true` - which only the
 * confirmation dialog sends. Nothing here retries, queues or runs by itself.
 */
import { get, post } from './client';
import { commandId } from './request-id';
import { serverNow } from './intercom';

export type FieldType = 'text' | 'select' | 'number' | 'date';

export interface ProfileField {
  id: string;
  label: string;
  enabled: boolean;
  type: FieldType;
  required: boolean;
  unique: boolean;
  options: string[];
  /** A conditional field: shown / required only while the parent field has exactly this value. */
  depends_on: { field_id: string; value: string } | null;
}

export interface ProfileGroup {
  id: string;
  label: string;
  enabled: boolean;
  /** null = the group has no station list (it grants no station). */
  station_ids: string[] | null;
}

export interface PolicyValues {
  photo_enabled: boolean;
  fields: ProfileField[];
  groups: ProfileGroup[];
}

export interface Policy extends PolicyValues {
  revision: number;
  /** How many person templates exist (their values are never shown here; they are kept as they are). */
  templates: number;
}

export interface ProfilesStation {
  id: string;
  name: string;
  online: boolean;
  lock_enabled: boolean;
}

export type ProfilesPart = 'view' | 'edit' | 'versions' | 'compare' | 'suggestions';

export interface ProfilesView {
  state: string;
  configured: boolean;
  last_error: string | null;
  fetched_at: string | null;
  policy: Policy | null;
  stations: ProfilesStation[];
  features: Record<ProfilesPart, { available: boolean | null; reason: string | null }>;
}

export interface DiffChange {
  property: string;
  before: unknown;
  after: unknown;
}

export interface DiffRow {
  kind: 'fields' | 'groups' | 'settings';
  id: string;
  label: string;
  state: 'added' | 'removed' | 'changed';
  changes: DiffChange[];
}

export interface ImpactPerson {
  user_id: string;
  display_name: string;
  employee_no: string | null;
  before: string[];
  after: string[];
  changed: boolean;
  overrides: number;
}

export interface FieldImpact {
  field_id: string;
  label: string;
  new: boolean;
  checked: number;
  applicable: number;
  inactive: number;
  newly_applicable: number;
  missing: number;
  invalid: number;
  previous_issues: number;
  duplicates: number;
  template_issues: number;
  required: boolean;
  unique: boolean;
  examples: { display_name: string; employee_no: string | null; reason: string; archived: boolean }[];
  duplicate_examples: { display_name: string; employee_no: string | null; archived: boolean }[];
  examples_truncated: boolean;
}

export interface Impact {
  people: ImpactPerson[];
  people_truncated: boolean;
  changed: number;
  stations: string[];
  offline: string[];
  field_changes: FieldImpact[];
  can_apply: boolean;
  requires_confirmation: boolean;
  expires_in: number;
  device_writes: number;
  station_names: Record<string, string>;
}

export interface PreviewReply {
  review_id: string;
  base_revision: number;
  expires_at: string;
  diff: DiffRow[];
  impact: Impact;
  values: PolicyValues;
}

export interface Readback {
  state: string;
  revision: number | null;
  matches: boolean | null;
  unchanged?: boolean;
  last_error: string | null;
}

export interface ApplyReply {
  status: 'saved';
  review_id: string;
  command_id?: string;
  revision_before: number;
  receipt: { saved_at: string | null; stations: string[]; changed: number; station_names: Record<string, string> } | null;
  readback: Readback;
  sync: 'requested' | 'none' | 'unknown';
  physical_result: 'not_verified';
  repeated?: boolean;
  confirmed_by?: 'readback';
}

export interface CheckReply {
  review_id: string;
  verdict: 'applied' | 'not_applied' | 'changed_elsewhere';
  readback: Readback;
  result: ApplyReply | null;
}

export interface VersionRecord {
  revision: number | null;
  saved_at: string | null;
  action: string | null;
  origin: string | null;
  field_changes: number | null;
  group_changes: number | null;
}

export interface VersionsPage {
  records: VersionRecord[];
  total: number | null;
  offset: number | null;
  next_offset: number | null;
  previous_offset: number | null;
  current_revision: number | null;
  retained_from_revision: number | null;
}

export interface CompareReply {
  before_revision: number | null;
  after_revision: number | null;
  rows: DiffRow[];
  summary: { fields: number; groups: number };
}

export interface RollbackDraft {
  target_revision: number;
  base_revision: number;
  values: PolicyValues;
  notes: { code: string; id: string }[];
  rows: number;
}

export interface Suggestions {
  user_id: string | null;
  person_revision: number | null;
  policy_revision: number | null;
  fields: { id: string; label: string; value: string | null }[];
  selected_fields: string[];
  suggestions: {
    group_id: string;
    label: string;
    matching_members: number;
    matching_people: number;
    doors: { station_id: string; station_name: string; blocked: boolean; before: number[]; after: number[] }[];
  }[];
  can_apply_to_draft: boolean;
}

const BASE = 'access-control/profiles';
const TTL_MS = 15_000;

export const getProfilesAccess = () => get<{ can_edit: boolean; sensitive: boolean }>(`${BASE}/access`);
export const getProfiles = () => get<ProfilesView>(BASE);
export const postPreview = (revision: number, values: PolicyValues) => post<PreviewReply>(`${BASE}/preview`, { revision, values });
export const postApply = (reviewId: string) =>
  post<ApplyReply>(`${BASE}/apply`, {
    review_id: reviewId,
    confirmed: true,
    client_request_id: commandId(),
    expires_at: new Date(serverNow() + TTL_MS).toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });
export const postCheck = (reviewId: string) => post<CheckReply>(`${BASE}/reviews/${encodeURIComponent(reviewId)}/check`);
export const getVersions = (offset = 0, limit = 20) => get<{ fetched_at: string | null; versions: VersionsPage }>(`${BASE}/versions?offset=${offset}&limit=${limit}`);
export const getCompare = (before: number, after: number) => get<{ compare: CompareReply }>(`${BASE}/compare?before=${before}&after=${after}`);
export const getRollbackDraft = (revision: number) => get<RollbackDraft>(`${BASE}/versions/${revision}/draft`);
export function getSuggestions(userId: string, fields: readonly string[]) {
  const qs = new URLSearchParams({ user_id: userId });
  for (const f of fields) qs.append('field', f);
  return get<{ fetched_at: string | null; suggestions: Suggestions }>(`${BASE}/suggestions?${qs.toString()}`);
}
