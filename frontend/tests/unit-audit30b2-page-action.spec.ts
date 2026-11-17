import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AUDIT30-B2-PAGE-ACTION (design audit round 30, finding 8; owner gate Q5 = option א, lead 12.11): sw-page gets a dedicated `primary`
// slot - in the header row at 768 px and up, one floating action above the bottom navigation up to 767 px. Node only: source guards.
// The browser receipts (positions, 52 px, the empty slot) are tests/evidence-audit30b2-page-action.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const flat = (f: string) => readFileSync(path.join(SRC, f), 'utf8').replace(/\s+/g, ' ');

test('sw-page: a primary slot next to the actions; the actions slot is unchanged', () => {
  const s = flat('components/sw-page.ts');
  expect(s).toContain('<div class="actions"><slot name="actions"></slot><div class="primary" part="primary" data-page-primary><slot name="primary" @slotchange=${this.onPrimarySlot}></slot></div></div>');
  // nothing is drawn for an empty slot (every existing screen is unchanged)
  expect(s).toContain('.primary { display: none; align-items: center; }');
  expect(s).toContain(':host([has-primary]) .primary { display: flex; }');
  expect(s).toContain("this.toggleAttribute('has-primary', has);");
});

test('sw-page: up to 767 px the primary action floats above the bottom navigation (FIXES.md B6 values)', () => {
  const s = flat('components/sw-page.ts');
  const phone = s.slice(s.indexOf('@media (max-width: 767px)'));
  expect(phone).toContain('position: fixed; inset-block-end: calc(var(--sw-bottomnav-h) + 12px + env(safe-area-inset-bottom)); inset-inline-end: 14px;');
  expect(phone).toContain('box-shadow: var(--sw-shadow-3);');
  expect(phone).toContain('transition: transform var(--sw-t-fast) var(--sw-ease);');
  expect(phone).toContain(':host([has-primary]) .primary:active { transform: scale(0.97); }');
  expect(phone).toContain('--sw-ctl-h-md: 52px;');
  expect(phone).toContain('--sw-r-sm: var(--sw-r-pill);');
  // below drawers and dialogs
  expect(phone).toContain('z-index: calc(var(--sw-z-drawer) - 1);');
  // no hover lift on the floating key, and the page keeps room for it
  expect(phone).toContain('--sw-hover-lift: 0px;');
  expect(phone).toContain(':host([has-primary]) .body { padding-block-end: calc(52px + 12px); }');
  // the floating rules are only in the phone query
  const desk = s.slice(0, s.indexOf('@media (max-width: 767px)'));
  expect(desk).not.toContain('position: fixed');
});
