import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWireBody } from '../src/api/tickets-rfq';
import { mockRfq, resetDemoRfq } from '../src/api/tickets-rfq-mock';
import { ApiError } from '../src/api/client';
import { DEFAULT_LIMITS, displayName, formatBytes, localKind, precheck, vendorFiles } from '../src/tickets/rfq-files-model';
import { invitePreview, refusalKey } from '../src/tickets/rfq-model';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_KEYS } from '../src/tickets/rfq-text';
import { fileRoute, sizeText } from '../src/public-ticket/rfq/rfq-files';

// RFQATT (owner 17.10, RFQ contract section 19): the manager's attachment rules (node only) - what the picker offers, the checks before
// a byte leaves the browser (the server checks again by content), what each vendor receives, the invitation's "N files" line (never a
// name), the demo store's attachment routes, and the public chunk's helpers (routes carry the id only; never a token in an address).
//   npx playwright test -c playwright.unit.config.ts tests/unit-rfq-attachments.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MB = 1024 * 1024;
const file = (name: string, type: string, size: number) => ({ name, type, size });

test('the picker offers pictures, PDF, Word and Excel only - by declared type or extension (the server decides by content)', () => {
  expect(localKind(file('a.JPG', '', 1))).toBe('image');
  expect(localKind(file('scan', 'image/webp', 1))).toBe('image');
  expect(localKind(file('plan.pdf', 'application/octet-stream', 1))).toBe('pdf');
  expect(localKind(file('boq.xlsx', '', 1))).toBe('xlsx');
  expect(localKind(file('spec.docx', '', 1))).toBe('docx');
  for (const n of ['run.exe', 'x.svg', 'a.heic', 'macro.docm', 'macro.xlsm', 'page.html', 'a.zip', 'a.gif']) expect(localKind(file(n, '', 1)), n).toBeNull();
});

test('precheck: type, per-file size, count and the documents\' total - in order, each refusal named', () => {
  const r = precheck([file('a.jpg', 'image/jpeg', 2 * MB), file('b.exe', '', 10), file('c.pdf', 'application/pdf', 11 * MB), file('d.jpg', 'image/jpeg', 9 * MB)], []);
  expect(r.accepted.map((f) => f.name)).toEqual(['a.jpg']);
  expect(r.refused).toEqual([{ name: 'b.exe', reason: 'type' }, { name: 'c.pdf', reason: 'size' }, { name: 'd.jpg', reason: 'size' }]);
  const nine = Array.from({ length: 9 }, () => ({ bytes: 1000 }));
  const c = precheck([file('x.pdf', 'application/pdf', 10), file('y.pdf', 'application/pdf', 10)], nine);
  expect(c.accepted.map((f) => f.name)).toEqual(['x.pdf']);
  expect(c.refused).toEqual([{ name: 'y.pdf', reason: 'count' }]);
  // a removed file does not count; documents fill the total, pictures are judged by the server (re-encoded smaller)
  const t = precheck([file('big.pdf', 'application/pdf', 9 * MB), file('pic.jpg', 'image/jpeg', 7 * MB)], [{ bytes: 35 * MB }, { bytes: 1, removed: true }]);
  expect(t.refused).toEqual([{ name: 'big.pdf', reason: 'total' }]);
  expect(t.accepted.map((f) => f.name)).toEqual(['pic.jpg']);
  expect(precheck([file('empty.pdf', 'application/pdf', 0)], []).refused[0].reason).toBe('size');
  expect(DEFAULT_LIMITS).toMatchObject({ files: 10, image_bytes: 8 * MB, document_bytes: 10 * MB, total_bytes: 40 * MB });
});

test('what each vendor receives: live, visible files only; names as the server will give them; sizes in words', () => {
  const files = [{ id: '1', visible_vendors: true }, { id: '2', visible_vendors: false }, { id: '3', visible_vendors: true, removed: true }];
  expect(vendorFiles(files).map((f) => f.id)).toEqual(['1']);
  expect(displayName('C:\\Users\\dana\\Desktop\\חזית.png', 'image')).toBe('חזית.jpg');
  expect(displayName('../../etc/passwd', 'pdf')).toBe('passwd.pdf');
  expect(displayName('', 'xlsx')).toBe('file.xlsx');
  expect(formatBytes(980_000, 'en')).toBe('957 KB');
  expect(formatBytes(1.24 * MB, 'en')).toBe('1.2 MB');
  expect(formatBytes(12 * MB, 'he')).toBe('12 מ״ב');
  expect(sizeText(512, 'ru')).toBe('1 КБ');
  expect(sizeText(3 * MB, 'ar')).toBe('3 م.ب');
});

test('the invitation preview says how many files - never a name or an address - and drops the line without files', () => {
  const base = { name: 'דנה', number: '7', title: 'שיפוץ', place: '', due: '20.10', window: 'גמיש', link: '[קישור]', organization: '' };
  const withFiles = invitePreview({ ...base, files: 'מצורפים לבקשה 2 קבצים (בקישור).' }, 'he');
  expect(withFiles).toContain('מצורפים לבקשה 2 קבצים (בקישור).');
  expect(invitePreview(base, 'he')).not.toContain('קבצים');
  expect(invitePreview({ ...base, files: '2 files are attached to the request (see the link).' }, 'en')).toContain('2 files are attached');
});

test('the create body never carries files; refusals have words; every new key has its Hebrew', () => {
  const body = { department_id: 'd1', title: 'T', vendors: [{ contact_id: 'c1' }], client_request_id: 'rfq-12345678' };
  expect(createWireBody(body, { vendor_options: true, attachments: true })).not.toHaveProperty('file_ids');
  for (const code of ['attachment_limit', 'attachment_total', 'attachment_locked', 'attachment_not_found', 'unsupported_format', 'pdf_refused', 'office_refused',
    'payload_too_large', 'heic_refused', 'storage_full']) {
    expect(refusalKey(code), code).toBe(`err_${code}`);
    expect(RFQ_TEXT_KEYS, code).toContain(`err_${code}`);
    expect(RFQ_TEXT_EN_KEYS, code).toContain(`err_${code}`);
  }
  for (const k of ['secFiles', 'fVisible', 'fInternal', 'fCaption', 'sendFiles', 'sendFilesInternal', 'previewFiles', 'previewFile1', 'ev_attachment_added']) {
    expect(RFQ_TEXT_KEYS, k).toContain(k);
    expect(RFQ_TEXT_EN_KEYS, k).toContain(k);
  }
});

test('the public chunk: routes carry the file id only (the token rides in a header), thumbnails have their own path', () => {
  expect(fileRoute('rfq', 'abc')).toBe('/t/api/rfq/file/abc');
  expect(fileRoute('rfq', 'abc', true)).toBe('/t/api/rfq/file/abc/thumb');
  expect(fileRoute('ticket', 'a/b')).toBe('/t/api/ticket/rfq-file/a%2Fb');
  const src = readFileSync(path.resolve(HERE, '../src/public-ticket/rfq/rfq-files.ts'), 'utf8');
  expect(src).toContain("'X-Ticket-Token'");
  expect(src).not.toMatch(/[?&]token=|innerHTML|window\.open\(/);
});

test('the demo store: upload, caption, internal-only, remove, the count limit and the state lock', async () => {
  resetDemoRfq();
  const id = 'rfq0000000000007';
  let d = await mockRfq.get(id);
  expect(d.can.attach).toBe(true);
  expect(d.attachments?.map((f) => f.kind)).toEqual(['image', 'pdf', 'xlsx']);
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const up = await mockRfq.uploadAttachment(id, new File([blob], '../tmp/plan.pdf', { type: 'application/pdf' }), { caption: 'תוכנית', visible_vendors: false });
  expect(up.attachment).toMatchObject({ name: 'plan.pdf', caption: 'תוכנית', visible_vendors: false, kind: 'pdf' });
  d = await mockRfq.editAttachment(id, up.attachment!.id, { visible_vendors: true });
  expect(d.attachments?.find((f) => f.id === up.attachment!.id)?.visible_vendors).toBe(true);
  d = await mockRfq.removeAttachment(id, up.attachment!.id);
  expect(d.attachments?.some((f) => f.id === up.attachment!.id)).toBe(false);
  await expect(mockRfq.uploadAttachment(id, new File(['x'], 'run.exe'))).rejects.toMatchObject({ code: 'unsupported_format' });
  for (let i = d.attachments!.length; i < 10; i++) await mockRfq.uploadAttachment(id, new File([blob], `p${i}.pdf`, { type: 'application/pdf' }));
  const err = await mockRfq.uploadAttachment(id, new File([blob], 'one-more.pdf', { type: 'application/pdf' })).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(ApiError);
  expect((err as ApiError).code).toBe('attachment_limit');
});
