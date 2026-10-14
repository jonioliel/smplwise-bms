/**
 * CR-038 slice 9: the vendor page's cost-claim step - pure logic (no browser page). Runs with
 *   npx playwright test -c playwright.unit.config.ts tests/unit-public-claim-model.spec.ts
 * The arithmetic vectors are the server's (smplwise_vms/backend/tests/test_tickets_money.py): the page's display figures must
 * be exactly what services/tickets/money.py stores.
 */
import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type ApiResult,
  type ClaimFormSettings,
  type DocsAction,
  type DocsState,
  type NewPage,
  type Revision,
  DEFAULT_LIMITS,
  EMPTY_DOCS,
  beginSubmit,
  buildPayload,
  classify,
  cleanText,
  computeForm,
  docsFromRevision,
  docsProblems,
  docsReady,
  docsReduce,
  dropLostPages,
  endSubmit,
  formFromRevision,
  formatMinorPlain,
  formatMoney,
  formatRate,
  halfUpDiv,
  laborTotal,
  lineFigure,
  loadDraft,
  newForm,
  newLine,
  newRequestId,
  nextUpload,
  normalizeDecimal,
  parseAmount,
  parseDraft,
  parseHours,
  parseQuantity,
  partsTotal,
  runUploads,
  saveDraft,
  serializeDraft,
  validateForm,
  vatModeFor,
  vatOf,
  viewOf,
  UUID_RE,
} from '../src/public-ticket/claim/claim-model';
import { CLAIM_LANGS, CLAIM_TEXT, CLAIM_TEXT_KEYS, claimDir, claimLang, ct, errorText, itemLabels, renderItem } from '../src/public-ticket/claim/claim-text';
import { autoLevelsGray, dragRect, fitLongSide } from '../src/public-ticket/claim/capture-editor';
import { ACCEPT, fileKind, looksInApp } from '../src/public-ticket/claim/pick';

const SETTINGS: ClaimFormSettings = {
  currencies: ['ILS'],
  vat: { exempt: false, rate_bp: 1800, default: 'excluded' },
  labor_rate_minor: 15000,
  require_invoice: false,
  limits: { ...DEFAULT_LIMITS },
};

function ids(prefix = 'id'): () => string {
  let n = 0;
  return () => {
    n += 1;
    return `${prefix}${n}`;
  };
}

// ---------------------------------------------------------------- arithmetic (the server's vectors)

test('amounts parse to minor units exactly like money.parse_amount', () => {
  for (const [text, minor] of [['0', 0], ['1', 100], ['1.5', 150], ['1.05', 105], ['12.50', 1250], ['999999999.99', 99999999999]] as const) {
    expect(parseAmount(text)).toEqual({ ok: true, value: minor });
  }
  for (const bad of ['', '1.234', '-1', '1e3', '0x10', ' ', '1.', '.5', '1234567890', '1,000.5', 'abc']) {
    expect(parseAmount(bad).ok, bad).toBe(false);
  }
});

test('what a person types is normalised to the server form (Arabic-Indic digits, a lone comma)', () => {
  expect(normalizeDecimal(' 1,5 ')).toBe('1.5');
  expect(normalizeDecimal('١٢٫٥')).toBe('12.5');
  expect(normalizeDecimal('۳')).toBe('3');
  expect(normalizeDecimal('1,000.5')).toBe('1,000.5'); // not guessed - refused as a format error
  expect(parseAmount('١٥٠')).toEqual({ ok: true, value: 15000 });
});

test('half-up division is integer-only and rounds halves up', () => {
  expect(halfUpDiv(5n, 10n)).toBe(1n);
  expect(halfUpDiv(4n, 10n)).toBe(0n);
  expect(halfUpDiv(15n, 10n)).toBe(2n);
  expect(halfUpDiv(25n, 10n)).toBe(3n);
  expect(halfUpDiv(0n, 7n)).toBe(0n);
  expect(() => halfUpDiv(-1n, 2n)).toThrow();
});

test('hours are quarter hours 0.25..200; quantities have three decimals', () => {
  for (const [text, q] of [['0.25', 1], ['1', 4], ['1.5', 6], ['1.75', 7], ['200', 800]] as const) expect(parseHours(text)).toEqual({ ok: true, value: q });
  for (const [bad, code] of [['0', 'range'], ['0.1', 'quarter_hours'], ['1.33', 'quarter_hours'], ['200.25', 'range'], ['abc', 'format']] as const) {
    expect(parseHours(bad)).toEqual({ ok: false, code });
  }
  expect(parseQuantity('0.5')).toEqual({ ok: true, value: 500 });
  expect(parseQuantity('1.234')).toEqual({ ok: true, value: 1234 });
  expect(parseQuantity('1.2345').ok).toBe(false);
  expect(parseQuantity('0')).toEqual({ ok: false, code: 'range' });
  expect(parseQuantity('100000')).toEqual({ ok: true, value: 100_000_000 });
});

test('line totals round per line, half up (1.25 x 33.33 -> 41.66; 0.5 x 0.05 -> 0.03; 3 x 0.33 -> 0.99)', () => {
  expect(laborTotal(5, 3333)).toBe(4166);
  expect(partsTotal(500, 5)).toBe(3);
  expect(partsTotal(3000, 33)).toBe(99);
  const labor = { ...newLine('labor', null, 'a'), hours: '1.25', rate: '33.33' };
  expect(lineFigure(labor, 0)).toEqual({ total: 4166, errors: [] });
  const parts = { ...newLine('parts', null, 'b'), description: 'צינור', quantity: '0.5', unit_price: '0.05' };
  expect(lineFigure(parts, 1).total).toBe(3);
  // the largest inputs never lose precision (BigInt products): 100000 x 999999999.99
  expect(partsTotal(100_000_000, 99_999_999_999)).toBe(9_999_999_999_900_000);
});

test('VAT excluded / included / none by basis points, rounded once', () => {
  expect(vatOf(10000, 'excluded', 1800)).toEqual({ vat: 1800, total: 11800, net: 10000 });
  expect(vatOf(11800, 'included', 1800)).toEqual({ vat: 1800, total: 11800, net: 10000 });
  expect(vatOf(100, 'included', 1800)).toEqual({ vat: 15, total: 100, net: 85 }); // the server's vector: 1.00 incl. -> 0.15 VAT
  expect(vatOf(10000, 'included', 1800)).toEqual({ vat: 1525, total: 10000, net: 8475 }); // 100.00 incl. -> 15.25 VAT, 84.75 net
  expect(vatOf(12345, 'none', 1800)).toEqual({ vat: 0, total: 12345, net: 12345 });
  expect(vatOf(12345, 'excluded', 0)).toEqual({ vat: 0, total: 12345, net: 12345 });
  expect(vatOf(1, 'excluded', 1800)).toEqual({ vat: 0, total: 1, net: 1 });
  expect(vatModeFor(true, true, false)).toBe('none');
  expect(vatModeFor(false, true, true)).toBe('none');
  expect(vatModeFor(false, true, false)).toBe('included');
  expect(vatModeFor(false, false, false)).toBe('excluded');
});

test('the form figures: 2h x 150 + parts 800 + travel 50 + other 25.50, excluded 18% -> 1175.50 / 211.59 / 1387.09', () => {
  const form = newForm(SETTINGS);
  form.lines = [
    { ...newLine('labor', SETTINGS, 'l1'), hours: '2' },
    { ...newLine('parts', SETTINGS, 'l2'), description: 'מדחס', quantity: '1', unit_price: '800' },
    { ...newLine('travel', SETTINGS, 'l3'), amount: '50' },
    { ...newLine('other', SETTINGS, 'l4'), description: 'פינוי', amount: '25.5' },
  ];
  expect(form.lines[0].rate).toBe('150'); // prefilled from labor_rate_minor
  const f = computeForm(form, SETTINGS);
  expect(f.byKind).toEqual({ labor: 30000, parts: 80000, travel: 5000, other: 2550 });
  expect(f.subtotal).toBe(117550);
  expect(f.vat).toBe(21159);
  expect(f.total).toBe(138709);
  expect(f.net).toBe(117550);
  expect(f.complete).toBe(true);
  expect(formatMinorPlain(f.total)).toBe('1387.09');
  // included: what was typed is the total
  const inc = computeForm({ ...form, include_vat: true }, SETTINGS);
  expect(inc.vatMode).toBe('included');
  expect(inc.total).toBe(117550);
  expect(inc.vat).toBe(Number(halfUpDiv(117550n * 1800n, 11800n)));
  expect(inc.net).toBe(117550 - inc.vat);
  // exempt vendor: none
  const ex = computeForm(form, { ...SETTINGS, vat: { exempt: true, rate_bp: 1800, default: 'none' } });
  expect([ex.vatMode, ex.vat, ex.total]).toEqual(['none', 0, 117550]);
  // an incomplete line counts as 0 and the figures say so
  const part = computeForm({ ...form, lines: [...form.lines, newLine('travel', SETTINGS, 'l5')] }, SETTINGS);
  expect(part.complete).toBe(false);
  expect(part.subtotal).toBe(117550);
});

test('formatting: plain decimals, rates, money in the contact language', () => {
  expect(formatMinorPlain(5)).toBe('0.05');
  expect(formatMinorPlain(0)).toBe('0.00');
  expect(formatMinorPlain(-150)).toBe('-1.50');
  expect(formatRate(1800)).toBe('18');
  expect(formatRate(1750)).toBe('17.5');
  expect(formatRate(1725)).toBe('17.25');
  for (const lang of CLAIM_LANGS) {
    const s = formatMoney(138709, 'ILS', lang);
    expect(s.replace(/[^\d]/g, ''), lang).toBe('138709'); // Western digits in every language, two decimals
  }
  expect(formatMoney(100, 'XXX-bad', 'he')).toBe('1.00 XXX-bad');
});

// ---------------------------------------------------------------- validation

test('validation mirrors the server limits and field paths', () => {
  const docs: DocsState = EMPTY_DOCS;
  const form = newForm(SETTINGS);
  // the prefilled labor line has no hours yet
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([{ field: 'lines.0.hours', code: 'required' }]);
  form.lines[0].hours = '1.1';
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([{ field: 'lines.0.hours', code: 'quarter_hours' }]);
  form.lines[0].hours = '1.25';
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([]);
  // other / parts need a description; descriptions <= 120 after cleaning
  form.lines.push({ ...newLine('other', SETTINGS, 'o'), amount: '5' });
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([{ field: 'lines.1.description', code: 'required' }]);
  form.lines[1].description = '\u202e' + 'x'.repeat(120) + '\u200b'; // hidden characters do not count
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([]);
  form.lines[1].description = 'x'.repeat(121);
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([{ field: 'lines.1.description', code: 'too_long' }]);
  form.lines[1].description = 'פינוי';
  // vendor_ref <= 40, notes <= 1000
  form.vendor_ref = 'r'.repeat(41);
  form.notes = 'n'.repeat(1001);
  expect(validateForm(form, { settings: SETTINGS, docs })).toEqual([
    { field: 'vendor_ref', code: 'too_long' },
    { field: 'notes', code: 'too_long' },
  ]);
  form.vendor_ref = 'INV-1';
  form.notes = '';
  // 30 lines at most
  const many = { ...form, lines: Array.from({ length: 31 }, (_, i) => ({ ...newLine('travel', SETTINGS, `t${i}`), amount: '1' })) };
  expect(validateForm(many, { settings: SETTINGS, docs })).toContainEqual({ field: 'lines', code: 'too_many' });
  // no lines without "no charge"
  expect(validateForm({ ...form, lines: [] }, { settings: SETTINGS, docs })).toEqual([{ field: 'lines', code: 'required' }]);
  // "no charge": lines are not checked (they are not sent)
  expect(validateForm({ ...form, no_charge: true, lines: [newLine('labor', SETTINGS)] }, { settings: SETTINGS, docs })).toEqual([]);
  // the fat-finger cap
  const big = { ...form, lines: [{ ...newLine('travel', SETTINGS, 'big'), amount: '999999.99' }] };
  expect(validateForm(big, { settings: SETTINGS, docs })).toEqual([{ field: 'total', code: 'claim_too_large' }]);
  // an invoice when the settings require one
  const needs = { ...SETTINGS, require_invoice: true };
  expect(validateForm(form, { settings: needs, docs })).toEqual([{ field: 'documents', code: 'invoice_required' }]);
  expect(validateForm({ ...form, no_charge: true }, { settings: needs, docs })).toEqual([]);
  // an unknown currency
  expect(validateForm({ ...form, currency: 'USD' }, { settings: SETTINGS, docs })).toContainEqual({ field: 'currency', code: 'unknown' });
});

test('cleanText mirrors text_hygiene.clean_text for the length checks', () => {
  expect(cleanText('\u202eמסנן\u200b')).toBe('מסנן');
  expect(cleanText('  a \t b\nc  ')).toBe('a b c');
  expect(cleanText('a\r\n\r\n\r\n\r\nb  \n', true)).toBe('a\n\nb');
  expect(cleanText('x\u2028y', true)).toBe('x\ny');
});

// ---------------------------------------------------------------- the payload

test('the payload: decimal strings only, no totals, normalised numbers, documents in page order', () => {
  const form = newForm(SETTINGS);
  form.lines = [
    { ...newLine('labor', SETTINGS, 'l1'), hours: '1,5' },
    { ...newLine('parts', SETTINGS, 'l2'), description: '  מסנן \u200b', quantity: '2', unit_price: '12.5' },
    { ...newLine('travel', SETTINGS, 'l3'), amount: '50' },
  ];
  form.vendor_ref = ' INV-7 ';
  const docs: DocsState = {
    docs: [
      {
        key: 'd1',
        kind: 'photo',
        finished: true,
        pages: [
          { key: 'p2', kind: 'photo', name: '', bytes: 1, requestId: 'r2', fileId: 'f2', state: 'uploaded', error: null },
          { key: 'p1', kind: 'photo', name: '', bytes: 1, requestId: 'r1', fileId: 'f1', state: 'uploaded', error: null },
        ],
      },
    ],
  };
  const body = buildPayload(form, docs, SETTINGS, 'crid');
  expect(body).toEqual({
    lines: [
      { kind: 'labor', hours: '1.5', rate: '150' },
      { kind: 'parts', description: 'מסנן', quantity: '2', unit_price: '12.5' },
      { kind: 'travel', amount: '50' },
    ],
    currency: 'ILS',
    amounts_include_vat: false,
    vendor_ref: 'INV-7',
    documents: [{ file_ids: ['f2', 'f1'] }],
    client_request_id: 'crid',
  });
  expect(JSON.stringify(body)).not.toMatch(/total|subtotal|vat_minor/);
  for (const ln of body.lines) for (const v of Object.values(ln)) expect(typeof v).toBe('string');
  // no charge: no lines, no VAT toggle
  expect(buildPayload({ ...form, no_charge: true }, EMPTY_DOCS, SETTINGS, 'c2')).toEqual({ lines: [], currency: 'ILS', documents: [], client_request_id: 'c2', vendor_ref: 'INV-7', no_charge: true });
  // an exempt vendor sends no toggle
  expect('amounts_include_vat' in buildPayload(form, EMPTY_DOCS, { ...SETTINGS, vat: { exempt: true, rate_bp: 1800, default: 'none' } }, 'c3')).toBe(false);
});

test('a rejected revision prefills the form and its documents', () => {
  const rev: Revision = {
    id: 'r1', seq: 2, source: 'vendor', kind: 'submission', no_charge: false,
    lines: [
      { kind: 'labor', description: '', total_minor: 4166, hours: '1.25', rate_minor: 3333 },
      { kind: 'parts', description: 'מסנן', total_minor: 99, quantity: '3', unit_minor: 33 },
      { kind: 'other', description: 'אגרה', total_minor: 1200, amount_minor: 1200 },
    ],
    labor_minor: 4166, parts_minor: 99, travel_minor: 0, other_minor: 1200, subtotal_minor: 5465, vat_mode: 'included', vat_rate_bp: 1800,
    vat_minor: 834, net_minor: 4631, total_minor: 5465, currency: 'ILS', vendor_ref: 'A-1', notes: 'שורה', created_at: '2026-10-14T08:00:00Z',
    documents: [{ no: 1, kind: 'pdf', pages: [{ id: 'f9', kind: 'pdf', bytes: 1234, name: 'invoice.pdf' }] }],
  };
  const f = formFromRevision(rev, SETTINGS);
  expect(f.lines.map((l) => [l.kind, l.hours, l.rate, l.quantity, l.unit_price, l.amount, l.description])).toEqual([
    ['labor', '1.25', '33.33', '', '', '', ''],
    ['parts', '', '', '3', '0.33', '', 'מסנן'],
    ['other', '', '', '', '', '12', 'אגרה'],
  ]);
  expect([f.include_vat, f.vendor_ref, f.notes, f.currency]).toEqual([true, 'A-1', 'שורה', 'ILS']);
  // the display figures of the prefilled form equal the server's stored revision
  const fig = computeForm(f, SETTINGS);
  expect([fig.subtotal, fig.vat, fig.total, fig.net]).toEqual([rev.subtotal_minor, rev.vat_minor, rev.total_minor, rev.net_minor]);
  const d = docsFromRevision(rev, ids('q'));
  expect(d.docs).toHaveLength(1);
  expect(d.docs[0].pages[0]).toMatchObject({ fileId: 'f9', state: 'uploaded', kind: 'pdf' });
  expect(docsReady(d)).toBe(true);
});

// ---------------------------------------------------------------- documents and pages

function page(key: string, kind: 'photo' | 'pdf' = 'photo', bytes = 300_000): NewPage {
  return { key, kind, name: kind === 'pdf' ? `${key}.pdf` : '', bytes, requestId: `rq-${key}` };
}

function run(s: DocsState, ...actions: DocsAction[]): { state: DocsState; errors: (string | null)[] } {
  const errors: (string | null)[] = [];
  for (const a of actions) {
    const r = docsReduce(s, a);
    s = r.state;
    errors.push(r.error);
  }
  return { state: s, errors };
}

test('pages: add, retake, delete, reorder, finish', () => {
  let { state, errors } = run(
    EMPTY_DOCS,
    { type: 'add_page', docKey: 'd1', page: page('a') },
    { type: 'add_page', docKey: 'd1', page: page('b') },
    { type: 'add_page', docKey: 'd1', page: page('c') },
  );
  expect(errors).toEqual([null, null, null]);
  expect(state.docs[0].pages.map((p) => p.key)).toEqual(['a', 'b', 'c']);
  expect(state.docs[0].finished).toBe(false);
  ({ state } = run(state, { type: 'move_page', docKey: 'd1', pageKey: 'c', delta: -1 }));
  expect(state.docs[0].pages.map((p) => p.key)).toEqual(['a', 'c', 'b']);
  ({ state } = run(state, { type: 'move_page', docKey: 'd1', pageKey: 'a', delta: -1 })); // already first: unchanged
  expect(state.docs[0].pages.map((p) => p.key)).toEqual(['a', 'c', 'b']);
  // a retake replaces the page in place with new content and a NEW request id
  ({ state } = run(state, { type: 'retake', docKey: 'd1', pageKey: 'c', page: page('c2') }));
  expect(state.docs[0].pages.map((p) => [p.key, p.requestId, p.state])).toEqual([
    ['a', 'rq-a', 'local'],
    ['c2', 'rq-c2', 'local'],
    ['b', 'rq-b', 'local'],
  ]);
  ({ state } = run(state, { type: 'delete_page', docKey: 'd1', pageKey: 'a' }, { type: 'finish_document', docKey: 'd1' }));
  expect(state.docs[0].pages.map((p) => p.key)).toEqual(['c2', 'b']);
  expect(state.docs[0].finished).toBe(true);
  // deleting the last page removes the document
  ({ state } = run(state, { type: 'delete_page', docKey: 'd1', pageKey: 'c2' }, { type: 'delete_page', docKey: 'd1', pageKey: 'b' }));
  expect(state.docs).toEqual([]);
});

test('limits: 3 documents, 10 pages per document, 25 files, a PDF is a document alone', () => {
  // a PDF alone
  let r = run(EMPTY_DOCS, { type: 'add_pdf', docKey: 'pdf1', page: page('x', 'pdf') });
  expect(r.errors).toEqual([null]);
  expect(r.state.docs[0]).toMatchObject({ kind: 'pdf', finished: true });
  expect(docsReduce(r.state, { type: 'add_page', docKey: 'pdf1', page: page('y') }).error).toBe('mixed_document');
  expect(docsReduce(r.state, { type: 'add_page', docKey: 'new', page: page('z', 'pdf') }).error).toBe('mixed_document');
  expect(docsReduce(r.state, { type: 'add_pdf', docKey: 'big', page: page('big', 'pdf', 11 * 1024 * 1024) }).error).toBe('too_large');
  expect(docsReduce(r.state, { type: 'add_page', docKey: 'big2', page: page('big2', 'photo', 9 * 1024 * 1024) }).error).toBe('too_large');
  // 10 pages per document
  const ten: DocsAction[] = Array.from({ length: 10 }, (_, i) => ({ type: 'add_page', docKey: 'd2', page: page(`p${i}`) }));
  r = run(r.state, ...ten);
  expect(r.errors.every((e) => e === null)).toBe(true);
  expect(docsReduce(r.state, { type: 'add_page', docKey: 'd2', page: page('p10') }).error).toBe('too_many_pages');
  // 3 documents
  r = run(r.state, { type: 'finish_document', docKey: 'd2' }, { type: 'add_page', docKey: 'd3', page: page('q0') });
  expect(r.errors).toEqual([null, null]);
  expect(docsReduce(r.state, { type: 'add_page', docKey: 'd4', page: page('w') }).error).toBe('too_many_documents');
  expect(docsReduce(r.state, { type: 'add_pdf', docKey: 'd4', page: page('w', 'pdf') }).error).toBe('too_many_documents');
  // 25 files in total: 10 + 10 + 5
  const three: DocsState = {
    docs: ['a', 'b', 'c'].map((k, i) => ({
      key: k, kind: 'photo' as const, finished: false,
      pages: Array.from({ length: i < 2 ? 10 : 5 }, (_, j) => ({ key: `${k}${j}`, kind: 'photo' as const, name: '', bytes: 1, requestId: `r${k}${j}`, fileId: null, state: 'local' as const, error: null })),
    })),
  };
  expect(docsReduce(three, { type: 'add_page', docKey: 'c', page: page('c5') }).error).toBe('too_many_files');
  expect(docsProblems(three)).toEqual([]);
  // the reducer refuses keys the server would refuse
  expect(docsReduce(EMPTY_DOCS, { type: 'add_page', docKey: 'bad key!', page: page('k') }).error).toBe('invalid');
  expect(docsProblems({ docs: [{ key: 'm', kind: 'pdf', finished: true, pages: [{ ...three.docs[0].pages[0], kind: 'pdf' }, three.docs[0].pages[1]] }] })).toContainEqual({ field: 'documents.0', code: 'mixed_document' });
});

// ---------------------------------------------------------------- uploads and the submission id

function finishedDoc(): DocsState {
  return run(EMPTY_DOCS, { type: 'add_page', docKey: 'd1', page: page('a') }, { type: 'add_page', docKey: 'd1', page: page('b') }, { type: 'finish_document', docKey: 'd1' }).state;
}

test('classify: what is retried with the same id and what is definite', () => {
  expect(classify({ status: 201, body: { id: 'f1' } }).kind).toBe('ok');
  expect(classify({ status: 0, body: null })).toEqual({ kind: 'retry', code: 'offline', retryAfterS: 0 });
  expect(classify({ status: 429, body: { code: 'busy', retry_after_s: 7 } })).toEqual({ kind: 'retry', code: 'busy', retryAfterS: 7 });
  expect(classify({ status: 409, body: { code: 'request_in_progress', retry_after_s: 2 } }).kind).toBe('retry');
  expect(classify({ status: 503, body: {} }).kind).toBe('retry');
  expect(classify({ status: 507, body: { code: 'storage_full' } })).toEqual({ kind: 'refused', code: 'storage_full' });
  expect(classify({ status: 413, body: { code: 'too_large' } })).toEqual({ kind: 'refused', code: 'too_large' });
  expect(classify({ status: 415, body: { code: 'unsupported_format' } })).toEqual({ kind: 'refused', code: 'unsupported_format' });
  expect(classify({ status: 409, body: { code: 'duplicate_file' } })).toEqual({ kind: 'refused', code: 'duplicate_file' });
  expect(classify({ status: 422, body: { code: 'invalid', fields: [{ field: 'lines.0.hours', code: 'quarter_hours' }] } })).toEqual({
    kind: 'refused', code: 'quarter_hours', fields: [{ field: 'lines.0.hours', code: 'quarter_hours' }],
  });
  expect(classify({ status: 403, body: { code: 'code_required' } })).toEqual({ kind: 'code_required' });
  expect(classify({ status: 404, body: { code: 'link_unavailable' } })).toEqual({ kind: 'unavailable' });
});

test('uploads go one at a time, only for finished documents; a retry keeps the same client_request_id', async () => {
  let state = run(EMPTY_DOCS, { type: 'add_page', docKey: 'open', page: page('o') }).state;
  expect(nextUpload(state)).toBeNull(); // an open document does not upload yet
  state = finishedDoc();
  const seen: string[] = [];
  const answers: ApiResult[] = [{ status: 0, body: null }];
  const deps = {
    getState: () => state,
    dispatch: (a: DocsAction) => {
      state = docsReduce(state, a).state;
    },
    upload: async (job: { page: { requestId: string }; pageNo: number }) => {
      seen.push(`${job.page.requestId}#${job.pageNo}`);
      return answers.shift() ?? { status: 201, body: { id: `file-${seen.length}` } };
    },
  };
  // first run: no reception -> paused, the page is "failed" (retryable) with its id unchanged
  expect(await runUploads(deps)).toEqual({ kind: 'paused', code: 'offline', retryAfterS: 0 });
  expect(state.docs[0].pages[0]).toMatchObject({ state: 'failed', requestId: 'rq-a', fileId: null });
  // second run: the same id goes again, then the next page
  expect(await runUploads(deps)).toEqual({ kind: 'done' });
  expect(seen).toEqual(['rq-a#1', 'rq-a#1', 'rq-b#2']);
  expect(state.docs[0].pages.map((p) => [p.state, p.fileId])).toEqual([
    ['uploaded', 'file-2'],
    ['uploaded', 'file-3'],
  ]);
  expect(docsReady(state)).toBe(true);
});

test('a refused page is marked and the queue moves on; code_required stops it', async () => {
  let state = finishedDoc();
  const answers: ApiResult[] = [{ status: 415, body: { code: 'unsupported_format' } }, { status: 201, body: { id: 'ok' } }];
  const deps = {
    getState: () => state,
    dispatch: (a: DocsAction) => {
      state = docsReduce(state, a).state;
    },
    upload: async () => answers.shift() ?? { status: 500, body: {} },
  };
  expect(await runUploads(deps)).toEqual({ kind: 'done' });
  expect(state.docs[0].pages.map((p) => [p.state, p.error])).toEqual([
    ['refused', 'unsupported_format'],
    ['uploaded', null],
  ]);
  expect(docsReady(state)).toBe(false);
  expect(docsProblems(state)).toContainEqual({ field: 'documents.0', code: 'refused_page' });
  let s2 = finishedDoc();
  const r = await runUploads({ getState: () => s2, dispatch: (a) => (s2 = docsReduce(s2, a).state), upload: async () => ({ status: 403, body: { code: 'code_required' } }) });
  expect(r).toEqual({ kind: 'code_required' });
  // an upload function that throws reads as "no answer"
  let s3 = finishedDoc();
  const r3 = await runUploads({ getState: () => s3, dispatch: (a) => (s3 = docsReduce(s3, a).state), upload: async () => { throw new Error('net'); } });
  expect(r3.kind).toBe('paused');
});

test('the submission keeps one client_request_id while its outcome is unknown, and takes a new one after a definite answer', () => {
  const gen = ids('00000000-0000-4000-8000-00000000000');
  const t1 = beginSubmit(null, gen);
  expect(t1.crid).toBe('00000000-0000-4000-8000-000000000001');
  // offline / 429 / 5xx: the same id again
  const after = endSubmit(t1, classify({ status: 0, body: null }));
  expect(after).toEqual({ crid: t1.crid, pending: true });
  expect(beginSubmit(after, gen).crid).toBe(t1.crid);
  const busy = endSubmit(t1, classify({ status: 429, body: { code: 'busy' } }));
  expect(beginSubmit(busy, gen).crid).toBe(t1.crid);
  // a success or a refusal: a new id next time
  expect(endSubmit(t1, classify({ status: 201, body: { ok: true } }))).toBeNull();
  expect(endSubmit(t1, classify({ status: 422, body: { code: 'invalid', fields: [] } }))).toBeNull();
  expect(beginSubmit(null, gen).crid).toBe('00000000-0000-4000-8000-000000000002');
});

test('request ids are UUID v4', () => {
  const a = newRequestId();
  const b = newRequestId();
  expect(a).toMatch(UUID_RE);
  expect(b).toMatch(UUID_RE);
  expect(a).not.toBe(b);
});

// ---------------------------------------------------------------- the draft

class MemoryStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.has(k) ? (this.data.get(k) as string) : null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

test('the draft survives a reload: form, pages with their ids, the pending submission id; storage failures are swallowed', () => {
  const store = new MemoryStorage();
  const form = newForm(SETTINGS);
  form.lines[0].hours = '2';
  form.notes = 'הערה';
  let docs = finishedDoc();
  docs = docsReduce(docs, { type: 'upload_started', pageKey: 'a' }).state;
  const submit = { crid: '11111111-2222-4333-8444-555555555555', pending: true };
  expect(saveDraft(store, 'k', { form, docs, submit })).toBe(true);
  const back = loadDraft(store, 'k');
  expect(back?.form).toEqual(form);
  expect(back?.submit).toEqual(submit);
  // an upload that was in flight waits again, with the same id
  expect(back?.docs.docs[0].pages[0]).toMatchObject({ key: 'a', state: 'local', requestId: 'rq-a' });
  // pages whose content was lost are dropped
  const dropped = dropLostPages(back!.docs, (k) => k === 'b');
  expect(dropped.dropped).toBe(1);
  expect(dropped.state.docs[0].pages.map((p) => p.key)).toEqual(['b']);
  // broken or foreign drafts are ignored
  expect(parseDraft('{')).toBeNull();
  expect(parseDraft(JSON.stringify({ v: 2 }))).toBeNull();
  expect(parseDraft(serializeDraft({ form: { ...form, lines: [{ kind: 'bribe' }] } as never, docs, submit: null }))).toBeNull();
  // a storage that throws (private mode, blocked) never breaks the page
  const hostile = { getItem: () => { throw new Error('x'); }, setItem: () => { throw new Error('x'); }, removeItem: () => { throw new Error('x'); } };
  expect(saveDraft(hostile, 'k', { form, docs, submit })).toBe(false);
  expect(loadDraft(hostile, 'k')).toBeNull();
  expect(loadDraft(null, 'k')).toBeNull();
});

test('the step view of a GET /t/api/claim answer', () => {
  expect(viewOf({ status: 'none' })).toBe('none');
  expect(viewOf(null)).toBe('none');
  expect(viewOf({ status: 'awaiting', required: true, writable: true })).toBe('required');
  expect(viewOf({ status: 'awaiting', required: false, writable: true })).toBe('optional');
  expect(viewOf({ status: 'awaiting', required: true, writable: false })).toBe('window_closed');
  expect(viewOf({ status: 'submitted', writable: true })).toBe('submitted');
  expect(viewOf({ status: 'rejected', writable: true })).toBe('rejected');
  expect(viewOf({ status: 'approved', writable: false })).toBe('approved');
  expect(viewOf({ status: 'paid', writable: false })).toBe('paid');
});

// ---------------------------------------------------------------- the editor's pure helpers and the picker

test('editor helpers: 2048 px long side, drag rectangles, grayscale auto-levels', () => {
  expect(fitLongSide(4000, 3000)).toEqual({ w: 2048, h: 1536 });
  expect(fitLongSide(3000, 4000)).toEqual({ w: 1536, h: 2048 });
  expect(fitLongSide(800, 600)).toEqual({ w: 800, h: 600 });
  expect(dragRect({ x: 500, y: 400 }, { x: 100, y: -50 }, { w: 1000, h: 800 })).toEqual({ x: 100, y: 0, w: 400, h: 400 });
  expect(dragRect({ x: 10, y: 10 }, { x: 20, y: 20 }, { w: 1000, h: 800 })).toBeNull();
  // two grey levels stretch to black and white
  const px = new Uint8ClampedArray([100, 100, 100, 255, 150, 150, 150, 255, 100, 100, 100, 255, 150, 150, 150, 255]);
  autoLevelsGray(px, 0);
  expect([...px]).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255]);
  // a flat picture stays as it is (gray)
  const flat = new Uint8ClampedArray([10, 20, 30, 255]);
  autoLevelsGray(flat);
  expect(flat[0]).toBe(flat[1]);
});

test('picker: accepted types, file routing, in-app browser hint', () => {
  expect(ACCEPT.camera).toBe('image/jpeg,image/png');
  expect(ACCEPT.pdf).toBe('application/pdf');
  expect(fileKind({ type: 'application/pdf', name: 'a.pdf' })).toBe('pdf');
  expect(fileKind({ type: '', name: 'A.PDF' })).toBe('pdf');
  expect(fileKind({ type: 'image/jpeg', name: 'x' })).toBe('photo');
  expect(fileKind({ type: '', name: 'IMG_1.HEIC' })).toBe('photo');
  expect(fileKind({ type: 'text/plain', name: 'a.txt' })).toBe('other');
  expect(looksInApp('Mozilla/5.0 (Linux; Android 14; wv) AppleWebKit/537.36 WhatsApp/2.24')).toBe(true);
  expect(looksInApp('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) [FBAN/FBIOS;FBAV/450.0]')).toBe(true);
  expect(looksInApp('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128 Mobile Safari/537.36')).toBe(false);
});

// ---------------------------------------------------------------- the text catalogue

/** The old Hebrew word for a service call, built from code points so this file does not carry it either. */
const OLD_WORD = new RegExp(String.fromCharCode(0x05e7, 0x05e8, 0x05d9, 0x05d0) + '(' + String.fromCharCode(0x05d4) + '|' + String.fromCharCode(0x05d5, 0x05ea) + '|' + String.fromCharCode(0x05ea) + ')');

test('the catalogue is complete in he / en / ar / ru, with the same placeholders, and directions follow the language', () => {
  expect(CLAIM_TEXT_KEYS.length).toBeGreaterThan(60);
  const ph = (s: string) => (s.match(/\{[a-z_]+(?::[^{}]*)?\}/g) ?? []).sort().join(',');
  for (const lang of CLAIM_LANGS) {
    const cat = CLAIM_TEXT[lang];
    expect(Object.keys(cat).sort(), lang).toEqual([...CLAIM_TEXT_KEYS].sort());
    for (const k of CLAIM_TEXT_KEYS) {
      expect(cat[k].trim(), `${lang}.${k}`).not.toBe('');
      expect(ph(cat[k]), `${lang}.${k} placeholders`).toBe(ph(CLAIM_TEXT.he[k]));
    }
  }
  expect(claimDir('he')).toBe('rtl');
  expect(claimDir('ar')).toBe('rtl');
  expect(claimDir('en')).toBe('ltr');
  expect(claimDir('ru')).toBe('ltr');
  expect(claimLang('xx')).toBe('he');
  expect(claimLang('ru')).toBe('ru');
});

test('owner rule 14.10: the Hebrew strings never use the old word; the item is "בקשת שירות" and follows the API labels', () => {
  for (const [k, v] of Object.entries(CLAIM_TEXT.he)) expect(OLD_WORD.test(v), `he.${k}: ${v}`).toBe(false);
  // the lint catches a planted line
  expect(OLD_WORD.test('ה' + String.fromCharCode(0x05e7, 0x05e8, 0x05d9, 0x05d0, 0x05d4) + ' נסגרה')).toBe(true);
  expect(ct('he', 'heading_item', { number: 'T-12' })).toBe('דרישת עלות - בקשת שירות T-12');
  expect(ct('he', 'heading_item', { number: 'T-12' }, itemLabels('he', { one: 'תקלה', many: 'תקלות', gender: 'f' }))).toBe('דרישת עלות - תקלה T-12');
  expect(itemLabels('he', null).one).toBe('בקשת שירות');
  expect(itemLabels('he', { one: '' })).toEqual(itemLabels('he', null));
  expect(renderItem('{f:חדשה|m:חדש} {ticket}', { one: 'בקשת שירות', many: 'בקשות שירות', gender: 'f' })).toBe('חדשה בקשת שירות');
  expect(renderItem('{f:a|m:b|n:c}', { one: '', many: '', gender: 'n' })).toBe('c');
  // the required strings of the step
  expect(CLAIM_TEXT.he.vat_included).toBe('הסכומים כוללים מע"מ');
  expect(CLAIM_TEXT.he.vat_excluded).toBe('לפני מע"מ');
  expect(CLAIM_TEXT.he.camera_fallback).toBe('לא ניתן לפתוח את המצלמה - אפשר לבחור תמונה מהגלריה או מקובץ');
  expect(CLAIM_TEXT.he.saved_offline).toBe('נשמר במכשיר, יישלח כשתהיה קליטה');
  expect(CLAIM_TEXT.he.busy).toBe('יש עומס. נסו שוב בעוד דקה.');
  for (const k of ['no_charge', 'capture', 'gallery', 'retake', 'rotate', 'crop', 'contrast', 'add_page', 'finish_doc', 'submit', 'later', 'card_title'] as const) {
    expect(CLAIM_TEXT.he[k]).toBe({ no_charge: 'ללא חיוב', capture: 'צילום חשבונית', gallery: 'בחירה מהגלריה / מקובץ', retake: 'צילום מחדש', rotate: 'סיבוב', crop: 'חיתוך', contrast: 'שיפור ניגודיות', add_page: 'הוספת עמוד', finish_doc: 'סיום מסמך', submit: 'שליחה', later: 'אשלים אחר כך', card_title: 'הגשת דרישת עלות' }[k]);
  }
  // English text names the item only through the tokens
  for (const [k, v] of Object.entries(CLAIM_TEXT.en)) expect(/\bTickets?\b/.test(v), `en.${k}`).toBe(false);
});

test('every error code of the wire contract has its own text (none falls back to the generic message)', () => {
  const codes = [
    'required', 'format', 'quarter_hours', 'range', 'too_long', 'claim_too_large', 'invoice_required', 'no_charge_with_lines', 'too_many_documents',
    'too_many_pages', 'too_many_files', 'mixed_document', 'unknown_file', 'expired_file', 'duplicate_file', 'file_reused', 'too_large',
    'unsupported_format', 'image_invalid', 'pdf_invalid', 'pdf_refused', 'file_limit', 'storage_full', 'claim_closed', 'claim_window_closed',
    'claim_not_open', 'busy', 'code_required', 'link_unavailable',
  ];
  for (const lang of CLAIM_LANGS) {
    const generic = ct(lang, 'error_generic');
    for (const c of codes) expect(errorText(lang, c), `${lang}:${c}`).not.toBe(generic);
    expect(errorText(lang, 'something_new')).toBe(generic);
  }
  expect(errorText('he', 'too_many_pages', { n: 10 })).toBe('עד 10 עמודים במסמך');
});

// ---------------------------------------------------------------- source lint of the claim step

const CLAIM_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/public-ticket/claim');

test('the claim sources: no unsafe HTML sinks, no style attributes, no old Hebrew word, no third-party imports', () => {
  const files = readdirSync(CLAIM_DIR).filter((f) => f.endsWith('.ts') || f.endsWith('.css'));
  expect(files).toEqual(expect.arrayContaining(['claim-model.ts', 'claim-text.ts', 'claim-step.ts', 'capture-editor.ts', 'pick.ts', 'claim.css']));
  for (const f of files) {
    const src = readFileSync(path.join(CLAIM_DIR, f), 'utf8');
    expect(OLD_WORD.test(src), `${f}: the old word`).toBe(false);
    if (!f.endsWith('.ts')) continue;
    expect(src, f).not.toMatch(/\.innerHTML\b|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/);
    expect(src, f).not.toMatch(/setAttribute\(\s*['"]style['"]|\.style\.cssText|\.style\s*=/);
    expect(src, f).not.toMatch(/getUserMedia/);
    for (const m of src.matchAll(/from\s+'([^']+)'/g)) expect(m[1].startsWith('./'), `${f} imports ${m[1]}`).toBe(true);
  }
  // the editor is loaded lazily: the step imports it only as a type and through import()
  const step = readFileSync(path.join(CLAIM_DIR, 'claim-step.ts'), 'utf8');
  expect(step).toMatch(/import type \{ PageEditor \} from '\.\/capture-editor'/);
  expect(step).not.toMatch(/^import \{[^}]*\} from '\.\/capture-editor'/m);
  expect(step).toMatch(/import\('\.\/capture-editor'\)/);
});
