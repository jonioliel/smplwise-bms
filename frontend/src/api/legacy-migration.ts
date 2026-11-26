/**
 * LEGACY-IMPORT-UI-2550 (T070, owner rule = recommendation Q1 a): the client of routers/legacy_migration.py - the import from the
 * legacy "Hikvision NVR Panel" add-on (v1.5.27). System administrators only (the server refuses everyone else with 403
 * `not_system_admin`; an older server without the routes answers 404 - the card is then not drawn).
 *
 *   GET  migration/legacy                               the runs so far, the upload limit, the backup kind, the confirm word
 *   POST migration/legacy/dry-run                       the body is the file itself (raw bytes): the report and its `plan_digest`
 *   POST migration/legacy/apply?plan_digest=&confirm=   the SAME file again; 409 `legacy_plan_changed` when the file or Arx changed
 *                                                       since the dry run, 409 `legacy_backup_failed` when the backup first failed
 *
 * The file is never kept by the browser past the screen (the component holds the File object only while the report is open).
 */
import { api, get, query } from './client';

export type LegacyAction = 'create' | 'update' | 'same' | 'keep' | 'skip' | 'manual' | 'info';
export const LEGACY_ACTIONS: readonly LegacyAction[] = ['update', 'create', 'manual', 'keep', 'same', 'skip', 'info'];
/** The actions an apply carries out (services/legacy_import.WRITES). */
export const LEGACY_WRITES: readonly LegacyAction[] = ['create', 'update'];

export interface LegacyRun {
  at: string;
  by: string | null;
  sha256: string;
  container: string;
  applied: number;
  unchanged: number;
  backup: string | null;
  plan_digest: string;
}

export interface LegacyStatus {
  runs: LegacyRun[];
  max_bytes: number;
  backup_kind: string;
  confirm: { he: string; en: string };
  legacy_version: string;
}

export interface LegacyItem {
  id: string;
  area: string;
  action: LegacyAction | string;
  code: string;
  /** in the reader's language (the server picks Hebrew / English) */
  note: string;
  target?: Record<string, unknown> | null;
  value?: string | null;
}

export interface LegacyReport {
  schema: string;
  source: { container: string; sha256: string; bytes: number; legacy_version: string | null; found: string[]; ignored_members: number; read_at: string };
  summary: Record<LegacyAction, number>;
  items: LegacyItem[];
  warnings: { code: string; note: string }[];
  time: { mode: string; direction: string; minutes: number; auto_minutes: number; manual_minutes: number; effective_minutes: number; zone: string } | null;
  writes: Record<string, string>;
  plan_digest: string;
  applied_before: LegacyRun[];
}

export interface LegacyApplyResult {
  applied: number;
  unchanged: number;
  cameras: { camera_id: string; channel: number }[];
  backup: { name: string; bytes: number; created_at: string } | null;
  already_applied: boolean;
  run: LegacyRun;
}

const RAW = { 'Content-Type': 'application/octet-stream' };

export const legacyStatus = () => get<LegacyStatus>('migration/legacy');

export const legacyDryRun = (file: Blob) => api<LegacyReport>('migration/legacy/dry-run', { method: 'POST', body: file, headers: RAW });

export const legacyApply = (file: Blob, planDigest: string, confirm: string) =>
  api<LegacyApplyResult>('migration/legacy/apply' + query({ plan_digest: planDigest, confirm }), { method: 'POST', body: file, headers: RAW });

/** How many rows of the report a write would change (create + update). */
export const writeCount = (r: Pick<LegacyReport, 'summary'>): number => LEGACY_WRITES.reduce((n, a) => n + (r.summary[a] ?? 0), 0);

/** The report's rows ordered for the table: by area in the order the server wrote them (first appearance), the server's order inside. */
export function groupedItems(items: readonly LegacyItem[]): LegacyItem[] {
  const order = new Map<string, number>();
  for (const it of items) if (!order.has(it.area)) order.set(it.area, order.size);
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => (order.get(a.it.area)! - order.get(b.it.area)!) || a.i - b.i)
    .map((x) => x.it);
}

/** One page of the grouped rows, each group opened by a heading row (repeated at the top of a page that continues a group). */
export type LegacyRow = { kind: 'head'; id: string; area: string; count: number } | ({ kind: 'item' } & LegacyItem);

export function pageRows(items: readonly LegacyItem[], page: number, size: number): { rows: LegacyRow[]; pages: number; page: number } {
  const sorted = groupedItems(items);
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const p = Math.min(Math.max(1, page), pages);
  const count = new Map<string, number>();
  for (const it of sorted) count.set(it.area, (count.get(it.area) ?? 0) + 1);
  const rows: LegacyRow[] = [];
  let area = '';
  for (const it of sorted.slice((p - 1) * size, p * size)) {
    if (it.area !== area) {
      area = it.area;
      rows.push({ kind: 'head', id: `head:${area}`, area, count: count.get(area) ?? 0 });
    }
    rows.push({ kind: 'item', ...it });
  }
  return { rows, pages, page: p };
}
