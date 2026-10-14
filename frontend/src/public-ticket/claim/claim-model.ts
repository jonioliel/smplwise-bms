/**
 * CR-038 slice 9 (spec 11A.2 / 11A.4 / 11A.6 / 11A.6A / 10.7): the vendor page's cost-claim step - PURE logic, no DOM.
 *
 * What lives here (every function is deterministic and node-testable):
 *  - the display arithmetic, a mirror of the server's services/tickets/money.py: INTEGERS in minor units only (BigInt inside the
 *    products, so a 9-digit amount x a 6-digit quantity never loses precision), per-line half-up rounding, VAT by basis points
 *    (excluded: vat = round(subtotal x rate / 10000), total = subtotal + vat; included: total = subtotal,
 *    vat = round(total x rate / (10000 + rate)), net = total - vat; none: vat 0). The page shows these figures for display only:
 *    the server recomputes everything and ITS numbers are the record (the page shows the server's revision after a submit);
 *  - the form validation with the server's limits and field paths (`lines.0.hours`, `vendor_ref`, `documents`, ...);
 *  - the documents / pages reducer (up to 3 documents, each ONE PDF or 1-10 photographed pages, at most 25 files);
 *  - the upload queue and the submission's idempotency: every file keeps its own client_request_id across retries; the
 *    submission keeps one id while its outcome is unknown (network failure, 429, 5xx) and takes a new one after a definite answer;
 *  - the draft kept in sessionStorage for bad reception (every storage access in try/catch).
 */

// ---------------------------------------------------------------- types of the wire contract (GET /t/api/claim, POST answers)

export type VatMode = 'excluded' | 'included' | 'none';
export type LineKind = 'labor' | 'parts' | 'travel' | 'other';
export type ClaimStatus = 'none' | 'awaiting' | 'submitted' | 'rejected' | 'approved' | 'paid';

export const LINE_KINDS: readonly LineKind[] = ['labor', 'parts', 'travel', 'other'];

export interface ClaimLimits {
  lines: number;
  description: number;
  vendor_ref: number;
  notes: number;
  documents: number;
  pages: number;
  files: number;
  pdf_bytes: number;
  photo_bytes: number;
  max_total_minor: number;
}

export interface ClaimFormSettings {
  currencies: string[];
  vat: { exempt: boolean; rate_bp: number; default: VatMode };
  labor_rate_minor: number | null;
  require_invoice: boolean;
  limits: ClaimLimits;
}

export interface RevisionLine {
  kind: LineKind;
  description?: string;
  total_minor: number;
  hours?: string;
  rate_minor?: number;
  quantity?: string;
  unit_minor?: number;
  amount_minor?: number;
}

export interface RevisionPage {
  id: string;
  kind: 'photo' | 'pdf';
  bytes: number;
  name: string;
}

export interface Revision {
  id: string;
  seq: number;
  source: string;
  kind: string;
  no_charge: boolean;
  lines: RevisionLine[];
  labor_minor: number;
  parts_minor: number;
  travel_minor: number;
  other_minor: number;
  subtotal_minor: number;
  vat_mode: VatMode;
  vat_rate_bp: number;
  vat_minor: number;
  net_minor: number;
  total_minor: number;
  currency: string;
  vendor_ref?: string | null;
  notes?: string | null;
  created_at: string;
  documents: { no: number; kind: 'photo' | 'pdf'; pages: RevisionPage[] }[];
}

export interface ClaimInfo {
  status: ClaimStatus;
  required?: boolean;
  claim_until?: string | null;
  writable?: boolean;
  currency?: string;
  no_charge?: boolean;
  rejection_reason?: string | null;
  approved?: { total_minor: number; currency: string; adjusted: boolean; reason: string | null } | null;
  revisions?: Revision[];
  form?: ClaimFormSettings;
  claim_mode?: boolean;
}

/** What the injected fetch helpers answer: `status` 0 = the request never got an answer (offline, dropped connection). */
export interface ApiResult {
  status: number;
  body: unknown;
}

export const DEFAULT_LIMITS: ClaimLimits = {
  lines: 30,
  description: 120,
  vendor_ref: 40,
  notes: 1000,
  documents: 3,
  pages: 10,
  files: 25,
  pdf_bytes: 10 * 1024 * 1024,
  photo_bytes: 8 * 1024 * 1024,
  max_total_minor: 100_000_000,
};

// ---------------------------------------------------------------- parsing (mirrors money.py)

export type Parsed<T> = { ok: true; value: T } | { ok: false; code: string };

const AMOUNT_RE = /^(\d{1,9})(?:\.(\d{1,2}))?$/;
const HOURS_RE = /^(\d{1,3})(?:\.(\d{1,2}))?$/;
const QTY_RE = /^(\d{1,6})(?:\.(\d{1,3}))?$/;
export const MAX_HOURS_Q = 200 * 4;
export const MAX_QTY_MILLI = 100_000 * 1000;

/** What a person types -> the server's decimal form: Arabic-Indic / Persian digits become ASCII, the Arabic decimal separator and
 * a lone comma (no dot) become a dot, spaces go. Nothing else is guessed ("1,000.5" stays and is refused as a format error). */
export function normalizeDecimal(raw: string): string {
  let s = (raw ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)).replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
  s = s.replace(/٫/g, '.').replace(/[\s  ]/g, '');
  if (s.includes(',') && !s.includes('.') && s.split(',').length === 2) s = s.replace(',', '.');
  return s;
}

export function parseAmount(raw: string): Parsed<number> {
  const m = AMOUNT_RE.exec(normalizeDecimal(raw));
  if (!m) return { ok: false, code: 'format' };
  return { ok: true, value: Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0')) };
}

/** Labor hours in 0.25 steps, 0.25..200 -> quarter hours. */
export function parseHours(raw: string): Parsed<number> {
  const m = HOURS_RE.exec(normalizeDecimal(raw));
  if (!m) return { ok: false, code: 'format' };
  const hundredths = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  if (hundredths % 25) return { ok: false, code: 'quarter_hours' };
  const q = hundredths / 25;
  if (q < 1 || q > MAX_HOURS_Q) return { ok: false, code: 'range' };
  return { ok: true, value: q };
}

/** A parts quantity, at most three decimals, 0.001..100000 -> thousandths. */
export function parseQuantity(raw: string): Parsed<number> {
  const m = QTY_RE.exec(normalizeDecimal(raw));
  if (!m) return { ok: false, code: 'format' };
  const milli = Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
  if (milli < 1 || milli > MAX_QTY_MILLI) return { ok: false, code: 'range' };
  return { ok: true, value: milli };
}

/** round(n / d) with halves away from zero, for n >= 0, d > 0 - integer arithmetic only (money.half_up_div). */
export function halfUpDiv(n: bigint, d: bigint): bigint {
  if (d <= 0n || n < 0n) throw new RangeError('halfUpDiv is defined for n >= 0, d > 0');
  return (2n * n + d) / (2n * d);
}

export function laborTotal(quarters: number, rateMinor: number): number {
  return Number(halfUpDiv(BigInt(quarters) * BigInt(rateMinor), 4n));
}

export function partsTotal(milli: number, unitMinor: number): number {
  return Number(halfUpDiv(BigInt(milli) * BigInt(unitMinor), 1000n));
}

/** (vat, total, net) of a subtotal - money.vat_of. */
export function vatOf(subtotal: number, mode: VatMode, rateBp: number): { vat: number; total: number; net: number } {
  if (mode === 'none' || rateBp === 0) return { vat: 0, total: subtotal, net: subtotal };
  const s = BigInt(subtotal);
  const r = BigInt(rateBp);
  if (mode === 'excluded') {
    const vat = Number(halfUpDiv(s * r, 10_000n));
    return { vat, total: subtotal + vat, net: subtotal };
  }
  const vat = Number(halfUpDiv(s * r, 10_000n + r));
  return { vat, total: subtotal, net: subtotal - vat };
}

export function vatModeFor(exempt: boolean, includeVat: boolean, noCharge: boolean): VatMode {
  if (exempt || noCharge) return 'none';
  return includeVat ? 'included' : 'excluded';
}

// ---------------------------------------------------------------- text hygiene (mirror of text_hygiene.clean_text, for the length checks)

const HIDDEN = /[\p{Cc}\p{Cf}\p{Cs}\ufdd0-\ufdef\ufffe\uffff]/gu;
const BREAKS = /\r\n|[\n\r\u000b\u000c\u0085\u2028\u2029]/g;

/** The server strips Cc / Cf characters before the length checks; the page does the same so its limits agree. */
export function cleanText(value: string, multiline = false): string {
  let s = value ?? '';
  if (multiline) {
    s = s.replace(BREAKS, '\n').replace(/\t/g, ' ');
    s = s.split('\n').map((l) => l.replace(HIDDEN, '').replace(/\s+$/u, '')).join('\n');
    return s.replace(/\n{3,}/g, '\n\n').trim();
  }
  s = s.replace(BREAKS, ' ').replace(/\t/g, ' ').replace(HIDDEN, '');
  return s.split(/\s+/u).filter(Boolean).join(' ');
}

/** Length in code points (Python's len), not UTF-16 units. */
export function textLength(value: string): number {
  return [...value].length;
}

// ---------------------------------------------------------------- formatting

export function formatMinorPlain(minor: number): string {
  const neg = minor < 0;
  const a = Math.abs(Math.trunc(minor));
  return `${neg ? '-' : ''}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** Minor units -> the form's input text ("150", "33.33", "0.05"). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined || !Number.isFinite(minor)) return '';
  const p = formatMinorPlain(minor);
  return p.endsWith('.00') ? p.slice(0, -3) : p;
}

const LOCALES: Record<string, string> = { he: 'he-IL', en: 'en-IL', ar: 'ar-IL-u-nu-latn', ru: 'ru-RU' };

/** A display amount in the contact language's number format with the currency symbol (never a conversion). The value goes to Intl
 * as a decimal string built from integers; a number built from it is exact to the two decimals shown. */
export function formatMoney(minor: number, currency: string, lang: string): string {
  const plain = formatMinorPlain(minor);
  try {
    return new Intl.NumberFormat(LOCALES[lang] ?? 'he-IL', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(plain));
  } catch {
    return `${plain} ${currency}`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** 1800 bp -> "18", 1750 -> "17.5". */
export function formatRate(rateBp: number): string {
  const whole = Math.floor(rateBp / 100);
  const frac = rateBp % 100;
  if (!frac) return String(whole);
  return `${whole}.${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

// ---------------------------------------------------------------- the form

export interface LineDraft {
  key: string;
  kind: LineKind;
  description: string;
  hours: string;
  rate: string;
  quantity: string;
  unit_price: string;
  amount: string;
}

export interface ClaimForm {
  lines: LineDraft[];
  currency: string;
  include_vat: boolean;
  no_charge: boolean;
  vendor_ref: string;
  notes: string;
}

export interface FieldError {
  field: string;
  code: string;
}

let lineSeq = 0;
export function newLine(kind: LineKind, settings?: ClaimFormSettings | null, key?: string): LineDraft {
  lineSeq += 1;
  return {
    key: key ?? `l${Date.now().toString(36)}${lineSeq}`,
    kind,
    description: '',
    hours: '',
    rate: kind === 'labor' ? minorToInput(settings?.labor_rate_minor ?? null) : '',
    quantity: kind === 'parts' ? '1' : '',
    unit_price: '',
    amount: '',
  };
}

/** A fresh form: the claim's currency, the vendor's VAT default, one labor line with the vendor's hourly rate prefilled. */
export function newForm(settings: ClaimFormSettings | null | undefined, currency?: string): ClaimForm {
  const cur = currency && (!settings || settings.currencies.includes(currency)) ? currency : (settings?.currencies[0] ?? 'ILS');
  return {
    lines: [newLine('labor', settings)],
    currency: cur,
    include_vat: settings?.vat.default === 'included',
    no_charge: false,
    vendor_ref: '',
    notes: '',
  };
}

/** The form prefilled from a revision (after a rejection, or to correct a pending submission). Files are not part of the form. */
export function formFromRevision(rev: Revision, settings?: ClaimFormSettings | null): ClaimForm {
  const lines = (rev.lines ?? []).map((ln) => {
    const d = newLine(ln.kind, null);
    d.description = ln.description ?? '';
    if (ln.kind === 'labor') {
      d.hours = ln.hours ?? '';
      d.rate = minorToInput(ln.rate_minor);
    } else if (ln.kind === 'parts') {
      d.quantity = ln.quantity ?? '';
      d.unit_price = minorToInput(ln.unit_minor);
    } else {
      d.amount = minorToInput(ln.amount_minor);
    }
    return d;
  });
  const exempt = settings?.vat.exempt ?? rev.vat_mode === 'none';
  return {
    lines: rev.no_charge ? [] : lines,
    currency: rev.currency,
    include_vat: exempt ? false : rev.vat_mode === 'included' || (rev.vat_mode === 'none' && settings?.vat.default === 'included'),
    no_charge: !!rev.no_charge,
    vendor_ref: rev.vendor_ref ?? '',
    notes: rev.notes ?? '',
  };
}

export interface LineFigure {
  total: number | null;
  errors: FieldError[];
}

/** One line's display total (null while it is incomplete or invalid) and its field problems. */
export function lineFigure(line: LineDraft, index: number, limits: ClaimLimits = DEFAULT_LIMITS): LineFigure {
  const base = `lines.${index}`;
  const errors: FieldError[] = [];
  const desc = cleanText(line.description);
  if ((line.kind === 'parts' || line.kind === 'other') && !desc) errors.push({ field: `${base}.description`, code: 'required' });
  if (textLength(desc) > limits.description) errors.push({ field: `${base}.description`, code: 'too_long' });
  const need = (raw: string, field: string, parse: (s: string) => Parsed<number>): number | null => {
    if (!normalizeDecimal(raw)) {
      errors.push({ field: `${base}.${field}`, code: 'required' });
      return null;
    }
    const p = parse(raw);
    if (!p.ok) {
      errors.push({ field: `${base}.${field}`, code: p.code });
      return null;
    }
    return p.value;
  };
  let total: number | null = null;
  if (line.kind === 'labor') {
    const q = need(line.hours, 'hours', parseHours);
    const r = need(line.rate, 'rate', parseAmount);
    if (q !== null && r !== null) total = laborTotal(q, r);
  } else if (line.kind === 'parts') {
    const q = need(line.quantity, 'quantity', parseQuantity);
    const u = need(line.unit_price, 'unit_price', parseAmount);
    if (q !== null && u !== null) total = partsTotal(q, u);
  } else {
    total = need(line.amount, 'amount', parseAmount);
  }
  return { total, errors };
}

export interface Figures {
  lines: (number | null)[];
  byKind: Record<LineKind, number>;
  subtotal: number;
  vatMode: VatMode;
  rateBp: number;
  vat: number;
  total: number;
  net: number;
  /** every line is complete and valid - the figures are what the server will compute */
  complete: boolean;
}

/** The form's figures for display (incomplete lines count as 0 and `complete` is false). */
export function computeForm(form: ClaimForm, settings: ClaimFormSettings | null | undefined): Figures {
  const limits = settings?.limits ?? DEFAULT_LIMITS;
  const byKind: Record<LineKind, number> = { labor: 0, parts: 0, travel: 0, other: 0 };
  const lines = form.no_charge ? [] : form.lines.map((ln, i) => lineFigure(ln, i, limits).total);
  let complete = true;
  if (!form.no_charge) {
    form.lines.forEach((ln, i) => {
      const t = lines[i];
      if (t === null || t === undefined) complete = false;
      else byKind[ln.kind] += t;
    });
  }
  const subtotal = byKind.labor + byKind.parts + byKind.travel + byKind.other;
  const mode = vatModeFor(!!settings?.vat.exempt, form.include_vat, form.no_charge);
  const rateBp = settings?.vat.rate_bp ?? 0;
  const { vat, total, net } = vatOf(subtotal, mode, rateBp);
  return { lines, byKind, subtotal, vatMode: mode, rateBp, vat, total, net, complete };
}

export interface ValidationContext {
  settings: ClaimFormSettings | null | undefined;
  docs: DocsState;
}

/** Every problem the server would report for this form, with the same field paths and codes. */
export function validateForm(form: ClaimForm, ctx: ValidationContext): FieldError[] {
  const limits = ctx.settings?.limits ?? DEFAULT_LIMITS;
  const out: FieldError[] = [];
  // with "no charge" on, the lines are dropped from the payload (the server refuses lines with no_charge) - nothing to check
  if (!form.no_charge) {
    if (!form.lines.length) out.push({ field: 'lines', code: 'required' });
    if (form.lines.length > limits.lines) out.push({ field: 'lines', code: 'too_many' });
    form.lines.forEach((ln, i) => out.push(...lineFigure(ln, i, limits).errors));
  }
  if (ctx.settings && !ctx.settings.currencies.includes(form.currency)) out.push({ field: 'currency', code: 'unknown' });
  if (textLength(cleanText(form.vendor_ref)) > limits.vendor_ref) out.push({ field: 'vendor_ref', code: 'too_long' });
  if (textLength(cleanText(form.notes, true)) > limits.notes) out.push({ field: 'notes', code: 'too_long' });
  if (!out.some((e) => e.field.startsWith('lines'))) {
    const f = computeForm(form, ctx.settings);
    if (f.total > limits.max_total_minor) out.push({ field: 'total', code: 'claim_too_large' });
  }
  out.push(...docsProblems(ctx.docs, limits));
  if (ctx.settings?.require_invoice && !form.no_charge && !ctx.docs.docs.some((d) => d.pages.length)) out.push({ field: 'documents', code: 'invoice_required' });
  return out;
}

export function lineHasInput(l: LineDraft): boolean {
  return !!(cleanText(l.description) || l.hours || (l.quantity && l.quantity !== '1') || l.unit_price || l.amount);
}

// ---------------------------------------------------------------- documents and pages (11A.2 / 11A.6A)

export type PageState = 'local' | 'uploading' | 'uploaded' | 'failed' | 'refused';

export interface ClaimPage {
  /** the page's own key - the step keeps its Blob under it until the upload succeeded */
  key: string;
  kind: 'photo' | 'pdf';
  name: string;
  bytes: number;
  /** the upload's client_request_id: kept across retries of THIS content; a retake is new content with a new id */
  requestId: string;
  fileId: string | null;
  state: PageState;
  error: string | null;
}

export interface ClaimDocument {
  /** the upload's `document_key` ([A-Za-z0-9_-]{1,32}) */
  key: string;
  kind: 'photo' | 'pdf';
  pages: ClaimPage[];
  /** "סיום מסמך" was tapped (a PDF is finished at once); only finished documents upload */
  finished: boolean;
}

export interface DocsState {
  docs: ClaimDocument[];
}

export interface NewPage {
  key: string;
  kind: 'photo' | 'pdf';
  name: string;
  bytes: number;
  requestId: string;
}

export type DocsAction =
  | { type: 'add_pdf'; docKey: string; page: NewPage }
  | { type: 'add_page'; docKey: string; page: NewPage }
  | { type: 'retake'; docKey: string; pageKey: string; page: NewPage }
  | { type: 'delete_page'; docKey: string; pageKey: string }
  | { type: 'delete_document'; docKey: string }
  | { type: 'move_page'; docKey: string; pageKey: string; delta: number }
  | { type: 'finish_document'; docKey: string }
  | { type: 'upload_started'; pageKey: string }
  | { type: 'upload_done'; pageKey: string; fileId: string }
  | { type: 'upload_failed'; pageKey: string; code: string; retryable: boolean };

export const EMPTY_DOCS: DocsState = { docs: [] };
export const DOCUMENT_KEY_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function fileCount(s: DocsState): number {
  return s.docs.reduce((n, d) => n + d.pages.length, 0);
}

/** The photo document that is still being built (pages are being added), if any. */
export function openDocument(s: DocsState): ClaimDocument | null {
  return s.docs.find((d) => d.kind === 'photo' && !d.finished) ?? null;
}

function mapPage(s: DocsState, pageKey: string, fn: (p: ClaimPage) => ClaimPage): DocsState {
  return { docs: s.docs.map((d) => (d.pages.some((p) => p.key === pageKey) ? { ...d, pages: d.pages.map((p) => (p.key === pageKey ? fn(p) : p)) } : d)) };
}

function freshPage(p: NewPage): ClaimPage {
  return { key: p.key, kind: p.kind, name: p.name, bytes: p.bytes, requestId: p.requestId, fileId: null, state: 'local', error: null };
}

/** The documents reducer: `{state, error}` - on a refusal (`error` set) the state is returned unchanged. */
export function docsReduce(s: DocsState, a: DocsAction, limits: ClaimLimits = DEFAULT_LIMITS): { state: DocsState; error: string | null } {
  const refuse = (error: string) => ({ state: s, error });
  const ok = (state: DocsState) => ({ state, error: null });
  switch (a.type) {
    case 'add_pdf': {
      if (a.page.kind !== 'pdf') return refuse('mixed_document');
      if (!DOCUMENT_KEY_RE.test(a.docKey) || s.docs.some((d) => d.key === a.docKey)) return refuse('invalid');
      if (s.docs.length >= limits.documents) return refuse('too_many_documents');
      if (fileCount(s) + 1 > limits.files) return refuse('too_many_files');
      if (a.page.bytes > limits.pdf_bytes) return refuse('too_large');
      return ok({ docs: [...s.docs, { key: a.docKey, kind: 'pdf', pages: [freshPage(a.page)], finished: true }] });
    }
    case 'add_page': {
      if (a.page.kind !== 'photo') return refuse('mixed_document');
      if (a.page.bytes > limits.photo_bytes) return refuse('too_large');
      if (fileCount(s) + 1 > limits.files) return refuse('too_many_files');
      const doc = s.docs.find((d) => d.key === a.docKey);
      if (doc) {
        if (doc.kind !== 'photo') return refuse('mixed_document');
        if (doc.pages.length >= limits.pages) return refuse('too_many_pages');
        // a page added to a finished document re-opens it (its new page uploads when it is finished again)
        return ok({ docs: s.docs.map((d) => (d.key === a.docKey ? { ...d, finished: false, pages: [...d.pages, freshPage(a.page)] } : d)) });
      }
      if (!DOCUMENT_KEY_RE.test(a.docKey)) return refuse('invalid');
      if (s.docs.length >= limits.documents) return refuse('too_many_documents');
      return ok({ docs: [...s.docs, { key: a.docKey, kind: 'photo', pages: [freshPage(a.page)], finished: false }] });
    }
    case 'retake': {
      const doc = s.docs.find((d) => d.key === a.docKey);
      if (!doc || !doc.pages.some((p) => p.key === a.pageKey)) return refuse('invalid');
      if (a.page.kind !== doc.kind) return refuse('mixed_document');
      if (a.page.bytes > (a.page.kind === 'pdf' ? limits.pdf_bytes : limits.photo_bytes)) return refuse('too_large');
      return ok({ docs: s.docs.map((d) => (d.key === a.docKey ? { ...d, pages: d.pages.map((p) => (p.key === a.pageKey ? freshPage(a.page) : p)) } : d)) });
    }
    case 'delete_page': {
      const doc = s.docs.find((d) => d.key === a.docKey);
      if (!doc) return refuse('invalid');
      const pages = doc.pages.filter((p) => p.key !== a.pageKey);
      if (pages.length === doc.pages.length) return refuse('invalid');
      return ok({ docs: pages.length ? s.docs.map((d) => (d.key === a.docKey ? { ...d, pages } : d)) : s.docs.filter((d) => d.key !== a.docKey) });
    }
    case 'delete_document':
      if (!s.docs.some((d) => d.key === a.docKey)) return refuse('invalid');
      return ok({ docs: s.docs.filter((d) => d.key !== a.docKey) });
    case 'move_page': {
      const doc = s.docs.find((d) => d.key === a.docKey);
      const i = doc ? doc.pages.findIndex((p) => p.key === a.pageKey) : -1;
      if (!doc || i < 0) return refuse('invalid');
      const j = i + Math.sign(a.delta);
      if (j < 0 || j >= doc.pages.length || j === i) return ok(s);
      const pages = [...doc.pages];
      [pages[i], pages[j]] = [pages[j], pages[i]];
      return ok({ docs: s.docs.map((d) => (d.key === a.docKey ? { ...d, pages } : d)) });
    }
    case 'finish_document': {
      const doc = s.docs.find((d) => d.key === a.docKey);
      if (!doc) return refuse('invalid');
      return ok({ docs: s.docs.map((d) => (d.key === a.docKey ? { ...d, finished: true } : d)) });
    }
    case 'upload_started':
      return ok(mapPage(s, a.pageKey, (p) => ({ ...p, state: 'uploading', error: null })));
    case 'upload_done':
      return ok(mapPage(s, a.pageKey, (p) => ({ ...p, state: 'uploaded', fileId: a.fileId, error: null })));
    case 'upload_failed':
      return ok(mapPage(s, a.pageKey, (p) => ({ ...p, state: a.retryable ? 'failed' : 'refused', error: a.code })));
  }
}

/** The documents' problems against the limits (the server's codes, field `documents`). */
export function docsProblems(s: DocsState, limits: ClaimLimits = DEFAULT_LIMITS): FieldError[] {
  const out: FieldError[] = [];
  if (s.docs.length > limits.documents) out.push({ field: 'documents', code: 'too_many_documents' });
  if (fileCount(s) > limits.files) out.push({ field: 'documents', code: 'too_many_files' });
  s.docs.forEach((d, i) => {
    if (d.pages.length > limits.pages) out.push({ field: `documents.${i}`, code: 'too_many_pages' });
    if (d.pages.some((p) => p.kind === 'pdf') && (d.pages.length !== 1 || d.pages.some((p) => p.kind !== 'pdf'))) out.push({ field: `documents.${i}`, code: 'mixed_document' });
    if (d.pages.some((p) => p.state === 'refused')) out.push({ field: `documents.${i}`, code: 'refused_page' });
  });
  return out;
}

/** True when every page of every document has a server file id (the submission can reference them). */
export function docsReady(s: DocsState): boolean {
  return s.docs.every((d) => d.pages.every((p) => p.state === 'uploaded' && !!p.fileId));
}

/** The pages from a revision (after a rejection the corrected revision may carry the same files again - the server accepts the
 * files already attached to the claim). */
export function docsFromRevision(rev: Revision | null | undefined, idGen: () => string = newRequestId): DocsState {
  if (!rev) return { docs: [] };
  return {
    docs: (rev.documents ?? []).map((d) => ({
      key: `r${rev.seq}d${d.no}`,
      kind: d.kind,
      finished: true,
      pages: d.pages.map((p) => ({ key: `f-${p.id}`, kind: p.kind, name: p.name, bytes: p.bytes, requestId: idGen(), fileId: p.id, state: 'uploaded' as PageState, error: null })),
    })),
  };
}

// ---------------------------------------------------------------- the upload queue

export type Outcome =
  | { kind: 'ok'; body: Record<string, unknown> }
  | { kind: 'retry'; code: string; retryAfterS: number }
  | { kind: 'refused'; code: string; fields?: FieldError[] }
  | { kind: 'code_required' }
  | { kind: 'unavailable' };

function bodyOf(r: ApiResult): Record<string, unknown> {
  return r.body && typeof r.body === 'object' && !Array.isArray(r.body) ? (r.body as Record<string, unknown>) : {};
}

/** One answer of the claim routes, classified. Retried with the SAME client_request_id: no answer (offline), 429 busy, 409
 * request_in_progress, 5xx other than 507 storage_full. Everything else is definite. */
export function classify(r: ApiResult): Outcome {
  const b = bodyOf(r);
  const code = typeof b.code === 'string' ? b.code : '';
  const after = typeof b.retry_after_s === 'number' && b.retry_after_s > 0 ? b.retry_after_s : 0;
  if (r.status >= 200 && r.status < 300) return { kind: 'ok', body: b };
  if (r.status === 0) return { kind: 'retry', code: 'offline', retryAfterS: after };
  if (r.status === 429) return { kind: 'retry', code: 'busy', retryAfterS: after || 60 };
  if (r.status === 409 && code === 'request_in_progress') return { kind: 'retry', code, retryAfterS: after || 2 };
  if (r.status === 403 && code === 'code_required') return { kind: 'code_required' };
  if (r.status === 404) return { kind: 'unavailable' };
  if (r.status === 507) return { kind: 'refused', code: 'storage_full' };
  if (r.status >= 500) return { kind: 'retry', code: 'server', retryAfterS: after || 10 };
  if (r.status === 413) return { kind: 'refused', code: 'too_large' };
  if (r.status === 415) return { kind: 'refused', code: 'unsupported_format' };
  if (r.status === 422) {
    const fields = Array.isArray(b.fields)
      ? (b.fields as unknown[]).filter((f): f is FieldError => !!f && typeof f === 'object' && typeof (f as FieldError).field === 'string' && typeof (f as FieldError).code === 'string')
      : [];
    const first = fields[0]?.code;
    return { kind: 'refused', code: code === 'invalid' && first ? first : code || 'invalid', fields };
  }
  return { kind: 'refused', code: code || 'error' };
}

export interface UploadJob {
  doc: ClaimDocument;
  page: ClaimPage;
  pageNo: number;
}

/** The next page to upload: of a FINISHED document, a page that is local or failed with a retryable error (one at a time - the
 * server takes one upload in flight per link). */
export function nextUpload(s: DocsState): UploadJob | null {
  for (const doc of s.docs) {
    if (!doc.finished) continue;
    const i = doc.pages.findIndex((p) => p.state === 'local' || p.state === 'failed');
    if (i >= 0) return { doc, page: doc.pages[i], pageNo: i + 1 };
  }
  return null;
}

export interface UploadDeps {
  /** sends one page: the multipart `file`, `client_request_id` = page.requestId, `document_key`, `page_no`, `name` */
  upload: (job: UploadJob) => Promise<ApiResult>;
  getState: () => DocsState;
  dispatch: (a: DocsAction) => void;
}

export type QueueResult = { kind: 'done' } | { kind: 'paused'; code: string; retryAfterS: number } | { kind: 'code_required' } | { kind: 'unavailable' };

/** Upload every waiting page in order; stops at the first retryable failure (the caller retries later with the same ids). A refused
 * page is marked and the queue moves on. */
export async function runUploads(deps: UploadDeps): Promise<QueueResult> {
  for (let guard = 0; guard < 200; guard += 1) {
    const job = nextUpload(deps.getState());
    if (!job) return { kind: 'done' };
    deps.dispatch({ type: 'upload_started', pageKey: job.page.key });
    let res: ApiResult;
    try {
      res = await deps.upload(job);
    } catch {
      res = { status: 0, body: null };
    }
    const o = classify(res);
    if (o.kind === 'ok') {
      const id = typeof o.body.id === 'string' ? o.body.id : '';
      if (!id) {
        deps.dispatch({ type: 'upload_failed', pageKey: job.page.key, code: 'error', retryable: true });
        return { kind: 'paused', code: 'error', retryAfterS: 10 };
      }
      deps.dispatch({ type: 'upload_done', pageKey: job.page.key, fileId: id });
    } else if (o.kind === 'retry') {
      deps.dispatch({ type: 'upload_failed', pageKey: job.page.key, code: o.code, retryable: true });
      return { kind: 'paused', code: o.code, retryAfterS: o.retryAfterS };
    } else if (o.kind === 'refused') {
      deps.dispatch({ type: 'upload_failed', pageKey: job.page.key, code: o.code, retryable: false });
    } else {
      deps.dispatch({ type: 'upload_failed', pageKey: job.page.key, code: o.kind, retryable: true });
      return o;
    }
  }
  return { kind: 'done' };
}

// ---------------------------------------------------------------- the submission

export interface SubmitTracker {
  /** the submission's client_request_id */
  crid: string;
  /** the last attempt with this id got no definite answer: the next attempt MUST reuse it (no duplicate revision) */
  pending: boolean;
}

/** The id for the next attempt: the pending one when the last outcome was unknown, else a new one. */
export function beginSubmit(prev: SubmitTracker | null | undefined, idGen: () => string = newRequestId): SubmitTracker {
  if (prev && prev.pending && UUID_RE.test(prev.crid)) return prev;
  return { crid: idGen(), pending: true };
}

/** After an attempt: kept (pending) on a retryable outcome, dropped after a definite answer (a success or a refusal). */
export function endSubmit(t: SubmitTracker, outcome: Outcome): SubmitTracker | null {
  return outcome.kind === 'retry' ? { ...t, pending: true } : null;
}

export interface ClaimPayload {
  lines: Record<string, string>[];
  currency: string;
  amounts_include_vat?: boolean;
  vendor_ref?: string;
  notes?: string;
  no_charge?: boolean;
  documents: { file_ids: string[] }[];
  client_request_id: string;
}

/** POST /t/api/claim's body: decimal STRINGS only, no totals (the server refuses unknown keys and computes every figure). */
export function buildPayload(form: ClaimForm, docs: DocsState, settings: ClaimFormSettings | null | undefined, crid: string): ClaimPayload {
  const lines: Record<string, string>[] = form.no_charge
    ? []
    : form.lines.map((ln) => {
        const desc = cleanText(ln.description);
        const out: Record<string, string> = { kind: ln.kind };
        if (desc || ln.kind === 'parts' || ln.kind === 'other') out.description = desc;
        if (ln.kind === 'labor') {
          out.hours = normalizeDecimal(ln.hours);
          out.rate = normalizeDecimal(ln.rate);
        } else if (ln.kind === 'parts') {
          out.quantity = normalizeDecimal(ln.quantity);
          out.unit_price = normalizeDecimal(ln.unit_price);
        } else {
          out.amount = normalizeDecimal(ln.amount);
        }
        return out;
      });
  const body: ClaimPayload = {
    lines,
    currency: form.currency,
    documents: docs.docs.filter((d) => d.pages.length).map((d) => ({ file_ids: d.pages.map((p) => p.fileId ?? '') })),
    client_request_id: crid,
  };
  if (!settings?.vat.exempt && !form.no_charge) body.amounts_include_vat = form.include_vat;
  const ref = cleanText(form.vendor_ref);
  if (ref) body.vendor_ref = ref;
  const notes = cleanText(form.notes, true);
  if (notes) body.notes = notes;
  if (form.no_charge) body.no_charge = true;
  return body;
}

// ---------------------------------------------------------------- ids

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A UUID v4 (crypto.randomUUID when present - it needs a secure context, which the HTTPS page is - else getRandomValues). */
export function newRequestId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(b);
  else for (let i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function newDocumentKey(): string {
  return `d${newRequestId().replace(/-/g, '').slice(0, 12)}`;
}

// ---------------------------------------------------------------- the draft (sessionStorage; bad reception, 10.7)

export interface ClaimDraft {
  v: 1;
  form: ClaimForm;
  docs: DocsState;
  submit: SubmitTracker | null;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function serializeDraft(d: Omit<ClaimDraft, 'v'>): string {
  return JSON.stringify({ v: 1, form: d.form, docs: d.docs, submit: d.submit });
}

function isStr(v: unknown): v is string {
  return typeof v === 'string';
}

/** A stored draft back, or null when it is missing or not ours. An upload that was in flight is waiting again (same id). */
export function parseDraft(text: string | null | undefined): ClaimDraft | null {
  if (!text) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1 || !r.form || typeof r.form !== 'object' || !r.docs || typeof r.docs !== 'object') return null;
  const f = r.form as Record<string, unknown>;
  if (!Array.isArray(f.lines) || !isStr(f.currency)) return null;
  const lines: LineDraft[] = [];
  for (const l of f.lines as unknown[]) {
    if (!l || typeof l !== 'object') return null;
    const x = l as Record<string, unknown>;
    if (!LINE_KINDS.includes(x.kind as LineKind)) return null;
    lines.push({
      key: isStr(x.key) ? x.key : newLine('labor').key,
      kind: x.kind as LineKind,
      description: isStr(x.description) ? x.description : '',
      hours: isStr(x.hours) ? x.hours : '',
      rate: isStr(x.rate) ? x.rate : '',
      quantity: isStr(x.quantity) ? x.quantity : '',
      unit_price: isStr(x.unit_price) ? x.unit_price : '',
      amount: isStr(x.amount) ? x.amount : '',
    });
  }
  const form: ClaimForm = {
    lines,
    currency: f.currency as string,
    include_vat: f.include_vat === true,
    no_charge: f.no_charge === true,
    vendor_ref: isStr(f.vendor_ref) ? f.vendor_ref : '',
    notes: isStr(f.notes) ? f.notes : '',
  };
  const dd = (r.docs as Record<string, unknown>).docs;
  if (!Array.isArray(dd)) return null;
  const docs: ClaimDocument[] = [];
  for (const d of dd as unknown[]) {
    const x = d as Record<string, unknown>;
    if (!x || !isStr(x.key) || !DOCUMENT_KEY_RE.test(x.key) || (x.kind !== 'photo' && x.kind !== 'pdf') || !Array.isArray(x.pages)) return null;
    const pages: ClaimPage[] = [];
    for (const p of x.pages as unknown[]) {
      const y = p as Record<string, unknown>;
      if (!y || !isStr(y.key) || !isStr(y.requestId) || (y.kind !== 'photo' && y.kind !== 'pdf')) return null;
      const st = y.state as PageState;
      const state: PageState = st === 'uploading' ? 'local' : (['local', 'uploaded', 'failed', 'refused'] as PageState[]).includes(st) ? st : 'local';
      pages.push({
        key: y.key,
        kind: y.kind,
        name: isStr(y.name) ? y.name : '',
        bytes: typeof y.bytes === 'number' ? y.bytes : 0,
        requestId: y.requestId,
        fileId: isStr(y.fileId) ? y.fileId : null,
        state: state === 'uploaded' && !isStr(y.fileId) ? 'local' : state,
        error: isStr(y.error) ? y.error : null,
      });
    }
    docs.push({ key: x.key, kind: x.kind, pages, finished: x.finished === true });
  }
  const s = r.submit as Record<string, unknown> | null | undefined;
  const submit = s && isStr(s.crid) && UUID_RE.test(s.crid) ? { crid: s.crid, pending: s.pending === true } : null;
  return { v: 1, form, docs: { docs }, submit };
}

/** Pages that were not uploaded and whose content is gone (a reload lost the in-memory Blob) are dropped; returns the dropped count. */
export function dropLostPages(s: DocsState, has: (pageKey: string) => boolean): { state: DocsState; dropped: number } {
  let dropped = 0;
  const docs = s.docs
    .map((d) => {
      const pages = d.pages.filter((p) => {
        const keep = p.state === 'uploaded' || has(p.key);
        if (!keep) dropped += 1;
        return keep;
      });
      return { ...d, pages };
    })
    .filter((d) => d.pages.length);
  return { state: { docs }, dropped };
}

export function saveDraft(storage: StorageLike | null | undefined, key: string, d: Omit<ClaimDraft, 'v'>): boolean {
  try {
    if (!storage) return false;
    storage.setItem(key, serializeDraft(d));
    return true;
  } catch {
    return false;
  }
}

export function loadDraft(storage: StorageLike | null | undefined, key: string): ClaimDraft | null {
  try {
    return storage ? parseDraft(storage.getItem(key)) : null;
  } catch {
    return null;
  }
}

export function clearDraft(storage: StorageLike | null | undefined, key: string): void {
  try {
    storage?.removeItem(key);
  } catch {
    /* storage refused (private mode, blocked): nothing to clear */
  }
}

// ---------------------------------------------------------------- the view state of the step

export type StepView =
  | 'loading'
  | 'none'
  | 'required'
  | 'optional'
  | 'submitted'
  | 'rejected'
  | 'approved'
  | 'paid'
  | 'window_closed'
  | 'code_required'
  | 'busy'
  | 'unavailable'
  | 'error';

/** Which view a GET /t/api/claim answer shows. */
export function viewOf(info: ClaimInfo | null | undefined): StepView {
  if (!info || info.status === 'none') return 'none';
  if (info.status === 'approved') return 'approved';
  if (info.status === 'paid') return 'paid';
  if (!info.writable) return 'window_closed';
  if (info.status === 'submitted') return 'submitted';
  if (info.status === 'rejected') return 'rejected';
  return info.required ? 'required' : 'optional';
}

/** The latest vendor revision (what a correction or a rejected claim prefills from). */
export function latestRevision(info: ClaimInfo | null | undefined): Revision | null {
  const revs = info?.revisions ?? [];
  if (!revs.length) return null;
  return revs.reduce((a, b) => (b.seq > a.seq ? b : a));
}
