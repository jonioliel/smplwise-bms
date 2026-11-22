/**
 * Investigation cases (T049): a case links events, recording clips and notes from several cameras. A clip is a
 * bookmark into the NVR until an export job preserves a copy; footage the NVR no longer has is reported as missing.
 */
import { api, apiUrl, del, get, patch, path, post, query } from './client';
import { tr } from '../i18n/msg/api-video';
import { isoZ } from './day-format';
import type * as Wire from './generated/wire-cases';

export type CaseStatus = 'open' | 'in_review' | 'closed';
type CaseItemKind = 'event' | 'clip' | 'note' | 'snapshot';
export type Preservation = Wire.CaseItem['preservation'];

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = { open: tr('פתוח'), in_review: tr('בבדיקה'), closed: tr('סגור') };
export const PRESERVATION_LABEL: Record<Preservation, string> = {
  preserved: tr('עותק שמור'),
  preserving: tr('מעתיק מה־NVR…'),
  nvr_only: tr('סימנייה ל־NVR בלבד'),
  missing: tr('חסר: ה־NVR כבר לא מחזיק את הקטע'),
  unknown: tr('לא נבדק מול ה־NVR'),
  not_in_bundle: tr('לא נכלל בחבילת המקור (סימנייה בלבד)'),
  none: '',
};

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/cases.py, generated into
 * ./generated/wire-cases.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Kept by hand:
 * the stored documents (an imported case's provenance, an imported item's origin, the bundle report's signature / origin). Narrowed:
 * the stored strings `status` / `kind` / `origin` to the values the screens know. */
export interface Case
  extends Pick<Wire.CaseRow, 'id' | 'title' | 'description' | 'tags' | 'owner_user_id' | 'owner_username' | 'revision' | 'created_at' | 'updated_at' | 'closed_at' | 'counts'> {
  status: CaseStatus;
  /** T050 import: 'imported' = the case came from an evidence bundle; provenance says from where. */
  origin?: 'local' | 'imported';
  provenance?: CaseProvenance | null;
}
/** Where an imported case came from (recorded at import; the bundle verified cleanly then). */
interface CaseProvenance {
  source_installation_id: string | null;
  source_app_version: string | null;
  exported_at: string | null;
  exported_by: string | null;
  exported_by_display: string | null;
  timezone: string | null;
  this_installation: boolean | null;
  confirmed_by_signature: boolean;
  basis: 'installation_id' | 'signing_key' | 'unknown';
  /** this_confirmed = signed by a key of this installation; this_claimed = our (public) id without our signature. */
  producer?: Producer;
  bundle_sha256: string;
  bundle_bytes: number;
  bundle_name: string | null;
  signature: { present: boolean; valid: boolean; trust: SignatureVerdict['trust']; kid: string | null; known: boolean; retired: boolean | null };
  verification: { ok: boolean; files: number; schema: string | null; verified_at: string };
  source_case: { id: string | null; title: string | null; status: string | null; owner_username: string | null; created_at: string | null; updated_at: string | null };
  imported_at: string;
  imported_by: string | null;
  files_stored: number;
  bytes_stored: number;
  skipped_at_source: number;
}

/** What the bundle said about an imported item: the source camera is a name only, never a camera here. */
interface ItemOrigin {
  bundle_sha256: string;
  source_installation_id: string | null;
  source_item_id: string | null;
  kind: CaseItemKind;
  camera_id: string | null;
  camera_name: string | null;
  added_by: string | null;
  created_at: string | null;
  preservation: string | null;
  in_bundle: boolean;
  stored: boolean;
}

export interface CaseItem
  extends Pick<Wire.CaseItem, 'id' | 'case_id' | 'camera_id' | 'camera_name' | 'event_id' | 'export_job_id' | 'from_at' | 'to_at' | 'note' | 'added_by_username' | 'created_at' | 'preservation' | 'export'>,
    Partial<Pick<Wire.CaseItem, 'file_path' | 'file_sha256' | 'file_url' | 'imported'>> {
  kind: CaseItemKind;
  /** The event's summary; an imported item's event is the copy the bundle carried (a stored document). */
  event: { type: string; occurred_at: string; ended_at: string | null; severity: string; confidence: string; thumbnail?: string | null; acked_at: string | null; source: string } | null;
  origin?: ItemOrigin | null;
}
export interface CaseDetail extends Case, Pick<Wire.CaseDetail, 'hidden_items' | 'can_manage' | 'checked'> {
  items: CaseItem[];
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
  return get<Omit<Wire.CaseList, 'cases'> & { cases: Case[] }>(`cases${qs ? `?${qs}` : ''}`);
}
export const createCase = (body: { title: string; description?: string; tags?: string[]; status?: CaseStatus }) => post<Case>('cases', body);
export const getCase = (id: string, check = true) => get<CaseDetail>(path`cases/${id}` + query({ check: check ? undefined : false }));
export const updateCase = (id: string, body: { revision: number; title?: string; description?: string; tags?: string[]; status?: CaseStatus }) => patch<Case>(path`cases/${id}`, body);
export const deleteCase = (id: string) => del(path`cases/${id}`);
export const addCaseItem = (id: string, body: NewCaseItem) => post<CaseItem>(path`cases/${id}/items`, body);
export const removeCaseItem = (id: string, itemId: string) => del(path`cases/${id}/items/${itemId}`);
export const preserveCaseItem = (id: string, itemId: string) => post<CaseItem>(path`cases/${id}/items/${itemId}/preserve`);

/** A bookmark on the playback timeline (T049): an event / clip item of a case, for one camera and local day.
 * `nvr` = the NVR still has to serve it (no copy yet); preserved / preserving follow the export job. */
export interface Bookmark extends Pick<Wire.CaseBookmark, 'id' | 'case_id' | 'case_title' | 'event_id' | 'note' | 'added_by_username' | 'preservation'> {
  case_status: CaseStatus;
  kind: CaseItemKind;
  /** a bookmark is an event / clip item: its window is always set */
  from_at: string;
  to_at: string;
}export const BOOKMARK_LABEL: Record<Bookmark['preservation'], string> = { preserved: tr('עותק שמור'), preserving: tr('מעתיק מה־NVR…'), nvr: tr('סימנייה ל־NVR') };
export const listBookmarks = (cameraId: string, date: string) => get<Omit<Wire.CaseBookmarks, 'bookmarks'> & { bookmarks: Bookmark[] }>(`cases/bookmarks?camera_id=${encodeURIComponent(cameraId)}&date=${encodeURIComponent(date)}`);

const isoSec = (d: Date) => isoZ(d);
/** A clip bookmark around an instant (default 15 s before, 45 s after). */
export const clipAround = (at: Date, beforeS = 15, afterS = 45) => ({ from_at: isoSec(new Date(at.getTime() - beforeS * 1000)), to_at: isoSec(new Date(at.getTime() + afterS * 1000)) });

/** Evidence bundle of a case (T050): one ZIP with a manifest and a SHA-256 per file; verification recomputes them. */
/** One answer type for a listed bundle (`signed`) and a new one (`sha256`, `files`, `skipped`, `signature`). */
export type Bundle = Pick<Wire.CaseBundleFile, 'name' | 'bytes' | 'created_at' | 'download_url'> &
  Partial<Pick<Wire.CaseBundleFile, 'signed'>> &
  Partial<Pick<Wire.CaseBundle, 'sha256' | 'files' | 'skipped' | 'signature'>>;/** Verdict on the manifest signature: integrity since export, and whether the key belongs to this installation. */
export interface SignatureVerdict {
  present: boolean;
  valid: boolean;
  kid?: string | null;
  known?: boolean;
  retired?: boolean | null;
  trust: 'installation' | 'embedded_key_only' | 'unsigned';
  reason?: string | null;
}
/** Narrowed: a key's id, public half and creation time (always written with the key). */
export type SigningInfo = Omit<Wire.CaseSigning, 'keys'> & {
  keys: { kid: string; alg: string; public_key: string; created_at: string; retired_at: string | null }[];
};export type BundleFileStatus = 'ok' | 'mismatch' | 'missing' | 'corrupt';
export const FILE_STATUS_LABEL: Record<BundleFileStatus, string> = { ok: tr('תואם'), mismatch: tr('שונה'), missing: tr('חסר'), corrupt: tr('פגום') };
/** The producing installation as the manifest names it; `confirmed_by_signature` = signed by a key of this installation. */
interface BundleOrigin {
  installation_id: string | null;
  app_version: string | null;
  exported_at: string | null;
  exported_by: string | null;
  exported_by_display: string | null;
  timezone: string | null;
  this_installation: boolean | null;
  basis: 'installation_id' | 'signing_key' | 'unknown';
  confirmed_by_signature: boolean;
  producer?: Producer;
}
type Producer = 'this_confirmed' | 'this_claimed' | 'other' | 'unknown';
/** Who made a bundle, worded honestly: the installation id is public, only a signature of this installation confirms it. */
export function producerOf(o: { producer?: Producer; this_installation: boolean | null; confirmed_by_signature: boolean } | null | undefined): Producer {
  if (!o) return 'unknown';
  if (o.producer) return o.producer;
  return o.this_installation === true ? (o.confirmed_by_signature ? 'this_confirmed' : 'this_claimed') : o.this_installation === false ? 'other' : 'unknown';
}
export const PRODUCER_LABEL: Record<Producer, string> = {
  this_confirmed: tr('התקנה זו (מאושר בחתימה)'),
  this_claimed: tr('התקנה זו לפי המזהה בלבד (לא מאושר בחתימה)'),
  other: tr('התקנה אחרת'),
  unknown: tr('לא ידוע (חבילה ללא מזהה התקנה)'),
};
/** The verification report; `case` / `generated_at` only when the manifest was readable. Plain-language `summary`: a matching hash =
 * unchanged since export, not proof that the footage is genuine. Kept by hand: the signature verdict and the origin (report documents). */
export type BundleVerification = Omit<Wire.CaseVerify, 'files' | 'signature' | 'origin' | 'counts'> & {
  files: (Omit<Wire.CaseVerifyFile, 'status'> & { status: BundleFileStatus })[];
  signature: SignatureVerdict;
  origin: BundleOrigin | null;
  counts: Record<BundleFileStatus | 'extra', number>;
};
type BundleImport = Omit<Wire.CaseImport, 'case' | 'report'> & {
  case: Case;
  report: Pick<BundleVerification, 'ok' | 'summary' | 'counts' | 'origin' | 'signature' | 'schema' | 'schema_version' | 'authenticity'>;
};export type CaseIntegrity = Omit<Wire.CaseIntegrity, 'files'> & { files: (Omit<Wire.CaseIntegrityFile, 'kind'> & { kind: CaseItemKind })[] };export const getSigning = () => get<SigningInfo>('evidence/signing');
export const rotateSigning = () => post<SigningInfo>('evidence/signing/rotate');
export const createBundle = (id: string) => post<Bundle>(path`cases/${id}/bundle`);
export const listBundles = (id: string) => get<{ bundles: Bundle[] }>(path`cases/${id}/bundles`);
export const bundleUrl = (id: string, name: string) => apiUrl(path`cases/${id}/bundles/${name}`);
export const caseItemFileUrl = (id: string, itemId: string) => apiUrl(path`cases/${id}/items/${itemId}/file`);
/** The ZIP goes as the raw request body (streamed to a temp file on the server, never held in memory there). */
const zipBody = (file: Blob) => ({ method: 'POST', body: file, headers: { 'Content-Type': 'application/zip' } });
const named = (path: string, file: File | Blob) => (file instanceof File && file.name ? `${path}?name=${encodeURIComponent(file.name.slice(0, 200))}` : path);
export const verifyBundle = (file: File | Blob) => api<BundleVerification>(named('cases/bundles/verify', file), zipBody(file));
export const importBundle = (file: File | Blob) => api<BundleImport>(named('cases/bundles/import', file), zipBody(file));
export const checkCaseIntegrity = (id: string) => post<CaseIntegrity>(path`cases/${id}/integrity`);
