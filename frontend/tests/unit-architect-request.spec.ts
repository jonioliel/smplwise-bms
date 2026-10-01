import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAILTO_MAX, MAILTO_SHORT_BODY, copyText, mailtoHref, normalizeRequest, requestBlob, requestFromMarkdown, requestSubject } from '../src/components/architect-request';

// "בקשה לאדריכל": the helpers behind the dialog (no browser page) and the drift guard between the maintained document
// (docs/operations/ARCHITECT_PLANS_REQUEST_HE.md) and the copy the app ships (frontend/src/content/architect-request.he.txt).
// The dialog itself (rendering, the clipboard, the download, the entry points) is covered by evidence-architect-request.spec.ts.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DOC = path.resolve(HERE, '..', '..', 'docs', 'operations', 'ARCHITECT_PLANS_REQUEST_HE.md');
const COPY = path.resolve(HERE, '..', 'src', 'content', 'architect-request.he.txt');

test.describe('architect request text', () => {
  test('the shipped copy is identical to the document (drift guard)', () => {
    const doc = requestFromMarkdown(fs.readFileSync(DOC, 'utf8'));
    const copy = normalizeRequest(fs.readFileSync(COPY, 'utf8'));
    expect(copy.length).toBeGreaterThan(1000);
    expect(copy, 'frontend/src/content/architect-request.he.txt must equal docs/operations/ARCHITECT_PLANS_REQUEST_HE.md (minus its maintainers comment): edit both').toBe(doc);
  });

  test('the copy keeps the owner-reviewed structure: title, three priority groups, quality sections, file names', () => {
    const t = normalizeRequest(fs.readFileSync(COPY, 'utf8'));
    expect(requestSubject(t)).toBe('בקשה לתוכניות מהאדריכל – מערכת ניהול ובקרה (SmplWise Arx)');
    for (const h of ['א. חובה', 'ב. מומלץ מאוד', 'ג. אם קיים', 'דרישות איכות לקבצי DXF / DWG', 'דרישות איכות ל־PDF ולתמונות', 'שמות קבצים ומידע נלווה']) expect(t, h).toContain(h);
    expect(t).not.toContain('<!--');
    expect(t).not.toContain('\r');
  });

  test('normalizing: CRLF, BOM and trailing blank lines do not matter; the maintainers comment is not part of the request', () => {
    expect(normalizeRequest('﻿a\r\nb\r\n\r\n')).toBe('a\nb');
    expect(requestFromMarkdown('<!-- note\nmore -->\r\n\r\nשלום\r\nעולם\r\n')).toBe('שלום\nעולם');
    expect(requestFromMarkdown('שלום')).toBe('שלום');
  });
});

test.describe('mail link', () => {
  test('a short request goes into the body whole, with CRLF line breaks', () => {
    const m = mailtoHref('כותרת\nגוף');
    expect(m.full).toBe(true);
    expect(m.href.startsWith('mailto:?subject=')).toBe(true);
    const body = decodeURIComponent(m.href.split('&body=')[1]);
    expect(body).toBe('כותרת\r\nגוף');
    expect(decodeURIComponent(m.href.split('&body=')[0].replace('mailto:?subject=', ''))).toBe('כותרת');
  });

  test('the shipped request is far beyond a mail link: the body is the one-line pointer and the link stays under the ceiling', () => {
    const t = normalizeRequest(fs.readFileSync(COPY, 'utf8'));
    expect(encodeURIComponent(t).length, 'the full text is too long for a mailto body').toBeGreaterThan(MAILTO_MAX);
    const m = mailtoHref(t);
    expect(m.full).toBe(false);
    expect(m.href.length).toBeLessThanOrEqual(MAILTO_MAX);
    expect(decodeURIComponent(m.href.split('&body=')[1])).toBe(MAILTO_SHORT_BODY);
    expect(decodeURIComponent(m.href.split('&body=')[0].replace('mailto:?subject=', ''))).toBe(requestSubject(t));
  });

  test('the boundary: a body that makes the link exactly MAILTO_MAX still goes whole, one more character does not', () => {
    const subject = 'ס';
    const base = `mailto:?subject=${encodeURIComponent(subject)}&body=`.length;
    const pad = (n: number) => `${subject}\n${'a'.repeat(n)}`;
    const room = MAILTO_MAX - base - encodeURIComponent(subject).length - encodeURIComponent('\r\n').length;
    expect(mailtoHref(pad(room)).full).toBe(true);
    expect(mailtoHref(pad(room + 1)).full).toBe(false);
  });
});

test.describe('copy and download', () => {
  test('the async clipboard receives the exact text', async () => {
    const written: string[] = [];
    const ok = await copyText('הטקסט\nשלי', { clipboard: { writeText: async (t) => void written.push(t) } });
    expect(ok).toBe(true);
    expect(written).toEqual(['הטקסט\nשלי']);
  });

  test('a refused or missing clipboard falls back to the hidden-textarea copy with the same text', async () => {
    const fb: string[] = [];
    const refused = await copyText('x', { clipboard: { writeText: async () => { throw new Error('denied'); } }, fallback: (t) => (fb.push(t), true) });
    expect(refused).toBe(true);
    const missing = await copyText('y', { clipboard: null, fallback: (t) => (fb.push(t), true) });
    expect(missing).toBe(true);
    expect(fb).toEqual(['x', 'y']);
    expect(await copyText('z', { clipboard: null, fallback: () => false })).toBe(false);
  });

  test('the downloadable file holds the same text, UTF-8, no BOM', async () => {
    const t = normalizeRequest(fs.readFileSync(COPY, 'utf8'));
    const blob = requestBlob(t);
    expect(blob.type).toBe('text/plain;charset=utf-8');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(t);
  });
});
