/**
 * CR-036 S8: "print = the browser's print of the list". The loaded rows go into a small document of their own (a title, the
 * period, one table) that a hidden frame prints: the app's own page cannot be printed meaningfully (its screens scroll inside
 * the shell), and nothing but the rows the person already sees is put on the paper. This file is its own document: plain
 * print colours, no design tokens (a printed page has no skin).
 */

export interface PrintInput {
  title: string;
  /** One line under the title (the period and station chosen, when any). */
  subtitle: string;
  columns: string[];
  rows: string[][];
  /** The line in the footer (when it was printed). */
  footer: string;
  lang: 'he' | 'en';
}

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ESC[c]);

/** The printable HTML document (a string; the caller prints it). Every value is escaped. */
export function printDocument(p: PrintInput): string {
  const dir = p.lang === 'he' ? 'rtl' : 'ltr';
  const head = p.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('');
  const body = p.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('');
  return `<!doctype html><html lang="${p.lang}" dir="${dir}"><head><meta charset="utf-8"><title>${escapeHtml(p.title)}</title><style>
@page { margin: 14mm; }
body { font: 12px/1.45 "Heebo", "Segoe UI", Arial, sans-serif; color: #111; margin: 0; }
h1 { font-size: 18px; margin: 0 0 2px; }
p.sub { margin: 0 0 10px; color: #444; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #999; padding: 4px 6px; text-align: start; vertical-align: top; }
th { background: #eee; }
tr { break-inside: avoid; }
td.t { white-space: nowrap; }
footer { margin-top: 10px; color: #555; font-size: 11px; }
</style></head><body><h1>${escapeHtml(p.title)}</h1><p class="sub">${escapeHtml(p.subtitle)}</p><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><footer>${escapeHtml(p.footer)}</footer></body></html>`;
}

/** Print the document through a hidden frame (the browser's print dialog). The frame is removed afterwards. Returns false
 * when the browser could not (no document, no frame) - the caller says so. */
export function printHtml(html: string): boolean {
  if (typeof document === 'undefined') return false;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.setAttribute('tabindex', '-1');
  frame.setAttribute('data-sw-print', '');
  frame.style.cssText = 'position:fixed;inset-block-end:0;inset-inline-end:0;inline-size:0;block-size:0;border:0;visibility:hidden';
  const done = () => window.setTimeout(() => frame.remove(), 1500);
  frame.addEventListener('load', () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } finally {
      done();
    }
  });
  frame.srcdoc = html;
  document.body.appendChild(frame);
  return true;
}
