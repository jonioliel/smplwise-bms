/** The request to the architect ("בקשה לאדריכל"): pure helpers shared by the dialog and its unit tests (no DOM at import time).
 * The text itself is frontend/src/content/architect-request.he.txt, a verbatim copy of docs/operations/ARCHITECT_PLANS_REQUEST_HE.md
 * (a unit test fails when the two drift). */

export const REQUEST_TITLE = 'בקשה לאדריכל';
export const REQUEST_FILE_NAME = 'בקשה_לאדריכל.txt';
/** A mailto: link longer than this is unreliable in mail clients and browsers (the practical ceiling is ~2000 characters). */
export const MAILTO_MAX = 1800;
export const MAILTO_SHORT_BODY = 'הבקשה המלאה מצורפת';

/** LF line endings, no BOM, no trailing blank lines: the same text whatever way the file was checked out. */
export function normalizeRequest(raw: string): string {
  return raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trimEnd();
}

/** The maintainers' comment at the top of the Markdown source is not part of the request. */
export function requestFromMarkdown(md: string): string {
  return normalizeRequest(md.replace(/^﻿?\s*<!--[\s\S]*?-->\s*/, ''));
}

export const requestSubject = (text: string): string => text.split('\n', 1)[0].trim();

/** `mailto:` with the whole request as the body when it fits, else a one-line body (the full text goes with the copy). */
export function mailtoHref(text: string): { href: string; full: boolean } {
  const subject = encodeURIComponent(requestSubject(text));
  const full = `mailto:?subject=${subject}&body=${encodeURIComponent(text.replace(/\n/g, '\r\n'))}`;
  if (full.length <= MAILTO_MAX) return { href: full, full: true };
  return { href: `mailto:?subject=${subject}&body=${encodeURIComponent(MAILTO_SHORT_BODY)}`, full: false };
}

export interface ClipboardDeps {
  clipboard?: { writeText(text: string): Promise<void> } | null;
  /** Last resort for a page without the async clipboard (plain http, an old WebView): a hidden textarea and execCommand('copy'). */
  fallback?: (text: string) => boolean;
}

/** Hidden-textarea copy: works from a user gesture where `navigator.clipboard` is missing or refused. */
export function execCommandCopy(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.setAttribute('aria-hidden', 'true');
  ta.style.cssText = 'position:fixed;inset-block-start:0;inset-inline-start:0;inline-size:1px;block-size:1px;opacity:0;pointer-events:none';
  const prev = document.activeElement as HTMLElement | null;
  document.body.append(ta);
  ta.select();
  ta.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  ta.remove();
  prev?.focus?.({ preventScroll: true });
  return ok;
}

/** true when the text reached the clipboard. */
export async function copyText(text: string, deps: ClipboardDeps = {}): Promise<boolean> {
  const clip = deps.clipboard === undefined ? (typeof navigator !== 'undefined' ? navigator.clipboard : null) : deps.clipboard;
  if (clip?.writeText) {
    try {
      await clip.writeText(text);
      return true;
    } catch {
      /* refused (permissions policy, no focus): the fallback below */
    }
  }
  const fb = deps.fallback ?? (typeof document !== 'undefined' ? execCommandCopy : undefined);
  return fb ? fb(text) : false;
}

/** The downloadable file: UTF-8, no BOM, the same text. */
export const requestBlob = (text: string): Blob => new Blob([text], { type: 'text/plain;charset=utf-8' });
