/**
 * RFQATT (contract 19): the pure rules of the request attachments on the manager's screens - what the picker accepts, the checks made
 * before a byte leaves the browser (the server makes them again and decides: content, not the name, says what a file is), the sizes
 * in words, and what each vendor will receive. No DOM here (the unit spec reads it).
 */
import type { RfqAttachmentLimits, RfqFile, RfqFileKind } from '../api/tickets-rfq';

/** Until the server's meta arrives: Word / Excel OFF (the installation setting `rfq.attachments.allow_office` is off by default). */
export const DEFAULT_LIMITS: RfqAttachmentLimits = {
  files: 10, image_bytes: 8 * 1024 * 1024, document_bytes: 10 * 1024 * 1024, total_bytes: 40 * 1024 * 1024, caption: 200,
  types: ['jpg', 'png', 'webp', 'pdf'], office: false,
};

const MIME_DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MIME_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Word / Excel are offered only while the server lists them (`limits.types`, the installation switch). */
export function officeAllowed(limits: RfqAttachmentLimits = DEFAULT_LIMITS): boolean {
  return limits.types.includes('docx') || limits.types.includes('xlsx');
}

/** The file input's `accept` (a hint for the picker only - the server sniffs the content); Word / Excel only when allowed. */
export function acceptFor(limits: RfqAttachmentLimits = DEFAULT_LIMITS): string {
  const base = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', '.jpg', '.jpeg', '.png', '.webp', '.pdf'];
  return (officeAllowed(limits) ? [...base, MIME_DOCX, MIME_XLSX, '.docx', '.xlsx'] : base).join(',');
}

/** The kinds line under the drop zone ("JPG, PNG, WebP, PDF[, Word, Excel]"). */
export function typesLabel(limits: RfqAttachmentLimits = DEFAULT_LIMITS): string {
  return ['JPG', 'PNG', 'WebP', 'PDF', ...(officeAllowed(limits) ? ['Word', 'Excel'] : [])].join(', ');
}

/** What a picked file probably is, from its declared type or its extension (null = not offered). The server decides by content. */
export function localKind(f: { name: string; type: string }): RfqFileKind | null {
  const n = (f.name || '').toLowerCase();
  const t = (f.type || '').toLowerCase();
  if (/^image\/(jpeg|png|webp)$/.test(t) || /\.(jpe?g|png|webp)$/.test(n)) return 'image';
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (t === MIME_DOCX || n.endsWith('.docx')) return 'docx';
  if (t === MIME_XLSX || n.endsWith('.xlsx')) return 'xlsx';
  return null;
}

export type Refusal = 'type' | 'office' | 'size' | 'count' | 'total';
export interface PickResult<F> { accepted: F[]; refused: { name: string; reason: Refusal }[] }

/**
 * The files of one pick that may be sent: the allowed kinds (Word / Excel only while the server lists them), each within its size, never more than the request's count, and documents
 * (stored as uploaded) within the bytes still free. A picture is re-encoded - usually much smaller - so only the server judges it
 * against the total.
 */
export function precheck<F extends { name: string; type: string; size: number }>(picked: readonly F[], existing: readonly { bytes: number; removed?: boolean }[],
  limits: RfqAttachmentLimits = DEFAULT_LIMITS): PickResult<F> {
  const live = existing.filter((x) => !x.removed);
  let count = live.length;
  let used = live.reduce((s, x) => s + x.bytes, 0);
  const out: PickResult<F> = { accepted: [], refused: [] };
  for (const f of picked) {
    const kind = localKind(f);
    if (!kind) out.refused.push({ name: f.name, reason: 'type' });
    else if ((kind === 'docx' || kind === 'xlsx') && !limits.types.includes(kind)) out.refused.push({ name: f.name, reason: 'office' });
    else if (f.size <= 0 || f.size > (kind === 'image' ? limits.image_bytes : limits.document_bytes)) out.refused.push({ name: f.name, reason: 'size' });
    else if (count >= limits.files) out.refused.push({ name: f.name, reason: 'count' });
    else if (kind !== 'image' && used + f.size > limits.total_bytes) out.refused.push({ name: f.name, reason: 'total' });
    else {
      out.accepted.push(f);
      count += 1;
      if (kind !== 'image') used += f.size;
    }
  }
  return out;
}

/** "980 KB", "1.2 MB" (or "980 ק״ב", "1.2 מ״ב"). */
export function formatBytes(n: number, lang: 'he' | 'en' = 'he'): string {
  const kb = lang === 'en' ? 'KB' : 'ק״ב';
  const mb = lang === 'en' ? 'MB' : 'מ״ב';
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} ${kb}`;
  const v = n / (1024 * 1024);
  return `${v < 10 ? v.toFixed(1).replace(/\.0$/, '') : Math.round(v)} ${mb}`;
}

/** The files EVERY invited vendor receives through his link: live and "visible to vendors" (an internal-only file never leaves). */
export function vendorFiles<T extends Pick<RfqFile, 'visible_vendors'> & { removed?: boolean }>(files: readonly T[]): T[] {
  return files.filter((f) => f.visible_vendors && !f.removed);
}

/** The display name the server will give a file (the last path segment, the extension of what the content is). */
export function displayName(name: string, kind: RfqFileKind): string {
  const base = (name || '').replace(/^.*[\\/]/, '');
  const stem = (base.includes('.') ? base.slice(0, base.lastIndexOf('.')) : base).trim() || 'file';
  return `${stem}.${kind === 'image' ? 'jpg' : kind}`;
}
