import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORDS, pickedKind, refusalKey, uploadForm } from '../src/public-ticket/rfq/rfq-upload';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_KEYS } from '../src/tickets/rfq-text';
import { eventLine } from '../src/tickets/rfq-model';

/**
 * RFQ-VENDOR-UPLOAD (contract 19.10): the vendor's upload card (a lazy chunk of the public page) and the managers' comparison row -
 * node-only checks (no browser): the picker's courtesy checks, the refusal words, the four languages, the lazy wiring, the guards.
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => readFileSync(path.resolve(HERE, '../src', p), 'utf8');

test('the picker offers only the server\'s kinds - by the server list, never WebP / HEIC / executables', () => {
  const types = ['jpg', 'png', 'pdf'];
  expect(pickedKind('roof.JPG', types)).toBe('image');
  expect(pickedKind('roof.jpeg', types)).toBe('image');
  expect(pickedKind('offer.pdf', types)).toBe('doc');
  for (const bad of ['a.webp', 'a.heic', 'a.exe', 'a.svg', 'a.html', 'a.docx', 'a', 'pdf']) expect(pickedKind(bad, types), bad).toBeNull();
  expect(pickedKind('boq.xlsx', [...types, 'docx', 'xlsx'])).toBe('doc'); // only while the office switch is on (the server's list)
});

test('every refusal code maps to the vendor\'s words; an unknown code is the generic "not saved"', () => {
  expect(refusalKey('unsupported_format')).toBe('type');
  expect(refusalKey('office_disabled')).toBe('type');
  expect(refusalKey('too_large')).toBe('size');
  expect(refusalKey('upload_limit')).toBe('full');
  expect(refusalKey('upload_total')).toBe('full');
  expect(refusalKey('quote_closed')).toBe('closed');
  expect(refusalKey('read_only')).toBe('closed');
  expect(refusalKey('busy')).toBe('busy');
  expect(refusalKey('rate_limited')).toBe('busy');
  for (const c of ['pdf_refused', 'pdf_invalid', 'office_refused', 'image_invalid', 'whatever']) expect(refusalKey(c)).toBe('failed');
});

test('owner 2026-10-17: a file is bound to EXACTLY one target - his quote or his question; the real name only as a text field', () => {
  const f = new File([new Uint8Array([37, 80, 68, 70])], 'הצעה סופית.PDF', { type: 'application/pdf' });
  const q = uploadForm(f, { quote_id: 'q-1' });
  expect(q.get('quote_id')).toBe('q-1');
  expect(q.has('message_id')).toBe(false);
  expect((q.get('file') as File).name).toBe('upload.pdf');
  expect(q.get('name')).toBe('הצעה סופית.PDF');
  const m = uploadForm(f, { message_id: 'm-1' });
  expect(m.get('message_id')).toBe('m-1');
  expect(m.has('quote_id')).toBe(false);
  expect(String(m.get('client_request_id'))).toMatch(/^[0-9a-f-]{36}$/);
  expect(refusalKey('question_not_found')).toBe('closed');
  expect(refusalKey('message_limit')).toBe('closed');
});

test('four languages, every key, no branding, no internal codes', () => {
  const keys = Object.keys(WORDS.he);
  for (const l of ['en', 'ar', 'ru'] as const) expect(Object.keys(WORDS[l]).sort()).toEqual([...keys].sort());
  const all = JSON.stringify(WORDS);
  expect(all).not.toMatch(/Home Assistant|\bHA\b|RFQ|rfq_/);
});

test('the upload card is a lazy chunk: rfq-page imports it dynamically, never statically; no link, no innerHTML, token in the header', () => {
  const page = src('public-ticket/rfq/rfq-page.ts');
  expect(page).toContain("import('./rfq-upload')");
  expect(page).not.toMatch(/from '\.\/rfq-upload'/);
  const up = src('public-ticket/rfq/rfq-upload.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(up).not.toMatch(/innerHTML|createElement\(['"]a['"]\)|\.href\s*=|localStorage|fetch\(/);
  expect(up).toContain("rawCall(host.creds, 'POST', '/t/api/rfq/upload'");
  // the file's own name never travels as the multipart filename (the server ignores it anyway): a fixed `upload.<ext>` + a text field
  expect(up).toContain('`upload.${');
});

test('managers: the comparison row and the timeline know the vendor files; the read is the internal vendor-files route', () => {
  expect(RFQ_TEXT_KEYS).toEqual(expect.arrayContaining(['rowVendorFiles', 'vfRemoved', 'vfVersion', 'ev_vendor_file_added', 'ev_vendor_file_removed']));
  expect(RFQ_TEXT_EN_KEYS).toEqual(expect.arrayContaining(['rowVendorFiles', 'vfRemoved', 'vfVersion', 'ev_vendor_file_added', 'ev_vendor_file_removed']));
  const ev = { id: 1, kind: 'vendor_file_added', at: '2026-10-17T10:00:00Z', vendor_id: 'v1', actor: { kind: 'contact', name: 'x' }, data: { file_id: 'f1' } };
  expect(eventLine(ev as never, () => 'קירור', (m) => String(m)).key).toBe('ev_vendor_file_added');
  const cmp = src('tickets/rfq-compare.ts');
  expect(cmp).toContain("import('./rfq-files')");
  expect(src('api/tickets-rfq.ts')).toContain('/vendor-files/');
  // owner 2026-10-17 (1): the work order lists the referenced vendor files as downloads; (3): the limits card with the server's hard caps
  expect(src('api/tickets.ts')).toContain('/rfq-vendor-files/');
  expect(src('tickets/overview-tab.ts')).toContain('data-rfq-vendor-file');
  const st = src('screens/system-tickets.ts');
  expect(st).toContain('data-card="rfq-vendor-uploads"');
  for (const [key, max] of [['max_files', 10], ['max_uploads', 30], ['max_image_mb', 8], ['max_doc_mb', 10], ['max_total_mb', 50]] as const) {
    expect(st, key).toMatch(new RegExp(`key: '${key}', label: '[A-Za-z]+', max: ${max}\\b`));
  }
  expect(RFQ_TEXT_EN_KEYS).toEqual(expect.arrayContaining(['stVendorUploads', 'stVuFiles', 'stVuUploads', 'stVuImage', 'stVuDoc', 'stVuTotal', 'stVuUploadsBelow']));
  expect(src('tickets/rfq-message-dialog.ts')).toContain('data-rfq-question-file');
});
