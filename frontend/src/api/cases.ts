/**
 * Investigation cases (T049): a case links events, recording clips and notes from several cameras. A clip is a
 * bookmark into the NVR until an export job preserves a copy; footage the NVR no longer has is reported as missing.
 */
import { apiUrl, del, get, patch, post, upload } from './client';

export type CaseStatus = 'open' | 'in_review' | 'closed';
export type CaseItemKind = 'event' | 'clip' | 'note' | 'snapshot';
export type Preservation = 'preserved' | 'preserving' | 'nvr_only' | 'missing' | 'unknown' | 'none';

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = { open: 'פתוח', in_review: 'בבדיקה', closed: 'סגור' };
export const PRESERVATION_LABEL: Record<Preservation, string> = {
  preserved: 'עותק שמור',
  preserving: 'מעתיק מה־NVR…',
  nvr_only: 'סימנייה ל־NVR בלבד',
  missing: 'חסר: ה־NVR כבר לא מחזיק את הקטע',
  unknown: 'לא נבדק מול ה־NVR',
  none: '',
};

export interface CaseCounts {
  items: number;
  events: number;
  clips: number;
  notes: number;
  snapshots: number;
  preserved: number;
}

export interface Case {
  id: string;
  title: string;
  description: string;
  status: CaseStatus;
  tags: string[];
  owner_user_id: string;
  owner_username: string;
  revision: number;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  counts: CaseCounts;
}

export interface CaseItem {
  id: string;
  case_id: string;
  kind: CaseItemKind;
  camera_id: string | null;
  camera_name: string | null;
  event_id: string | null;
  event: { type: string; occurred_at: string; ended_at: string | null; severity: string; confidence: string; thumbnail?: string; acked_at: string | null; source: string } | null;
  export_job_id: string | null;
  from_at: string | null;
  to_at: string | null;
  note: string;
  added_by_username: string;
  created_at: string;
  preservation: Preservation;
  export: { id: string; state: string; progress: number; download_ready: boolean; error: string | null } | null;
  file_path?: string | null;
  file_sha256?: string | null;
  file_url?: string | null;
}

export interface CaseDetail extends Case {
  items: CaseItem[];
  hidden_items: number;
  can_manage: boolean;
  /** false when the NVR could not be asked (no NVR configured or check=false): preservation reads "unknown". */
  checked: boolean;
}

export interface NewCaseItem {
  kind: CaseItemKind;
  event_id?: string;
  camera_id?: string;
  from_at?: string;
  to_at?: string;
  note?: string;
}

export function listCases(opts: { status?: CaseStatus; q?: string } = {}) {
  const p = new URLSearchParams();
  if (opts.status) p.set('status', opts.status);
  if (opts.q) p.set('q', opts.q);
  const qs = p.toString();
  return get<{ cases: Case[]; can_manage: boolean }>(`cases${qs ? `?${qs}` : ''}`);
}
export const createCase = (body: { title: string; description?: string; tags?: string[]; status?: CaseStatus }) => post<Case>('cases', body);
export const getCase = (id: string, check = true) => get<CaseDetail>(`cases/${id}${check ? '' : '?check=false'}`);
export const updateCase = (id: string, body: { revision: number; title?: string; description?: string; tags?: string[]; status?: CaseStatus }) => patch<Case>(`cases/${id}`, body);
export const deleteCase = (id: string) => del(`cases/${id}`);
export const addCaseItem = (id: string, body: NewCaseItem) => post<CaseItem>(`cases/${id}/items`, body);
export const removeCaseItem = (id: string, itemId: string) => del(`cases/${id}/items/${itemId}`);
export const preserveCaseItem = (id: string, itemId: string) => post<CaseItem>(`cases/${id}/items/${itemId}/preserve`);

const isoSec = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
/** A clip bookmark around an instant (default 15 s before, 45 s after). */
export const clipAround = (at: Date, beforeS = 15, afterS = 45) => ({ from_at: isoSec(new Date(at.getTime() - beforeS * 1000)), to_at: isoSec(new Date(at.getTime() + afterS * 1000)) });

/** Evidence bundle of a case (T050): one ZIP with a manifest and a SHA-256 per file; verification recomputes them. */
export interface Bundle {
  name: string;
  bytes: number;
  created_at: string;
  download_url: string;
  sha256?: string;
  files?: number;
  skipped?: { item_id: string; reason: string }[];
}
export interface BundleVerification {
  ok: boolean;
  schema: string | null;
  case?: string;
  generated_at?: string;
  manifest_ok: boolean | null;
  files: { path: string; status: 'ok' | 'mismatch' | 'missing'; expected: string; actual: string | null }[];
  extra: string[];
  errors: string[];
}
export const createBundle = (id: string) => post<Bundle>(`cases/${id}/bundle`);
export const listBundles = (id: string) => get<{ bundles: Bundle[] }>(`cases/${id}/bundles`);
export const bundleUrl = (id: string, name: string) => apiUrl(`cases/${id}/bundles/${name}`);
export const caseItemFileUrl = (id: string, itemId: string) => apiUrl(`cases/${id}/items/${itemId}/file`);
export function verifyBundle(file: File) {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<BundleVerification>('cases/bundles/verify', form);
}
