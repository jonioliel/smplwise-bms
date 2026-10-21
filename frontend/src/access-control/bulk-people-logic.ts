/**
 * CR-BULKPEOPLE-295: the pure logic of the bulk people dialog (no DOM, no fetch) - what step a job is at, the summary counts of a
 * dry-run, the words of a row's codes, a diff value as text, and the bulk edit request built from the form. Unit-tested in Node
 * (tests/unit-bulk-people.spec.ts).
 */
import type { BulkEdit, BulkJob, DryRunRow, ReportEntry, RowResult } from '../api/bulk-people';
import { btDynamic, type BtLang } from '../i18n/bulk-people';

export type Step = 'report' | 'preview' | 'confirm' | 'apply' | 'done' | 'closed';

/** The step the dialog shows for a job. */
export function stepOf(job: BulkJob): Step {
  switch (job.state) {
    case 'staged':
      return 'report';
    case 'previewed':
      return 'preview';
    case 'confirmed':
    case 'applying':
    case 'paused':
      return 'apply';
    case 'done':
      return 'done';
    default:
      return 'closed';
  }
}

export interface PreviewCounts {
  create: number;
  update: number;
  unchanged: number;
  error: number;
}

export function previewCounts(rows: readonly DryRunRow[]): PreviewCounts {
  const out: PreviewCounts = { create: 0, update: 0, unchanged: 0, error: 0 };
  for (const r of rows) {
    if (r.status === 'error') out.error += 1;
    else if (r.status === 'unchanged') out.unchanged += 1;
    else if (r.op === 'create') out.create += 1;
    else out.update += 1;
  }
  return out;
}

/** A row's codes and fields as one line ("שם: ערך שנראה כנוסחה"). */
export function codesText(entry: Pick<ReportEntry, 'codes' | 'fields'>, lang?: BtLang): string {
  const fields = entry.fields.map((f) => btDynamic(`field_${f}`, 'code_generic', undefined, lang));
  const codes = entry.codes.map((c) => btDynamic(`code_${c}`, 'code_generic', undefined, lang));
  return fields.length ? `${fields.join(', ')}: ${codes.join(', ')}` : codes.join(', ');
}

/** A diff value as text: doors `{st: [1, 2]}` -> `st: 1+2`, lists joined, booleans and null spelled out. */
export function valueText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length ? entries.map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join('+') : String(v)}`).join('; ') : '—';
  }
  if (typeof value === 'boolean') return value ? '✓' : '✗';
  return String(value);
}

/** Whether the dialog should call apply again by itself: more rows, not stalled, still applying. */
export function shouldContinue(job: BulkJob): boolean {
  return job.more === true && job.stalled !== true && (job.state === 'paused' || job.state === 'applying');
}

/** The rows that need a person's attention after writing: failed and unknown (never re-sent). */
export function attention(results: readonly RowResult[]): RowResult[] {
  return results.filter((r) => r.outcome === 'failed' || r.outcome === 'unknown');
}

export interface EditForm {
  validFrom: string;
  validUntil: string;
  active: 'keep' | 'on' | 'off';
  doorsAdd: Record<string, number[]>;
  doorsRemove: string[];
  groupsAdd: string[];
  groupsRemove: string[];
}

export const EMPTY_EDIT: EditForm = { validFrom: '', validUntil: '', active: 'keep', doorsAdd: {}, doorsRemove: [], groupsAdd: [], groupsRemove: [] };

/** The bulk edit request from the form, or null when nothing is chosen (or the window is half filled). */
export function editRequest(personIds: readonly string[], f: EditForm): BulkEdit | null {
  const out: BulkEdit = { person_ids: [...new Set(personIds)] };
  if (!out.person_ids.length) return null;
  if (Boolean(f.validFrom) !== Boolean(f.validUntil)) return null;
  if (f.validFrom && f.validUntil) {
    if (f.validFrom > f.validUntil) return null;
    out.valid_from = f.validFrom;
    out.valid_until = f.validUntil;
  }
  if (f.active !== 'keep') out.active = f.active === 'on';
  const add = Object.fromEntries(Object.entries(f.doorsAdd).filter(([, v]) => v.length));
  if (Object.keys(add).length) out.doors_add = add;
  if (f.doorsRemove.length) out.doors_remove = [...new Set(f.doorsRemove)];
  if (f.groupsAdd.length) out.groups_add = [...new Set(f.groupsAdd)];
  if (f.groupsRemove.length) out.groups_remove = [...new Set(f.groupsRemove)];
  if (out.doors_add && out.doors_remove && out.doors_remove.some((s) => s in out.doors_add!)) return null;
  if (out.groups_add && out.groups_remove && out.groups_remove.some((g) => out.groups_add!.includes(g))) return null;
  const changes = ['valid_from', 'active', 'doors_add', 'doors_remove', 'groups_add', 'groups_remove'].filter((k) => k in out);
  return changes.length ? out : null;
}

/** A file the server will refuse anyway, caught before the upload (size; a header naming a credential or a photo). */
export function precheckFile(name: string, size: number, firstLine: string, maxBytes: number): 'too_large' | 'not_csv' | 'secret_column' | null {
  if (size > maxBytes) return 'too_large';
  if (!/\.csv$/i.test(name)) return 'not_csv';
  if (/(pin|card|code|photo|password|secret|token|קוד|כרטיס|תמונה|סיסמ)/i.test(firstLine)) return 'secret_column';
  return null;
}
