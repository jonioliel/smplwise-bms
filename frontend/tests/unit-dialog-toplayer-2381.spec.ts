import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { liftToTopLayer, raiseLifted, setTopLayer, liftedReset, liftedHostReset } from '../src/components/top-layer';

// DIALOG-TOPLAYER-2381: sw-dialog's backdrop in the browser's top layer (a manual popover), the toasts lifted above it, and the removal of
// the 2.38.0 stopgap (keepBoxInView). Node only, no page: the helpers against stand-in elements, the components by their source.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => fs.readFileSync(path.join(here, '..', 'src', p), 'utf8');

/** A stand-in for an element with the Popover API: records every show / hide. */
class Pop {
  attrs = new Map<string, string>();
  isConnected = true;
  shown = false;
  constructor(readonly id: string, readonly log: string[]) {}
  hasAttribute(n: string) { return this.attrs.has(n); }
  getAttribute(n: string) { return this.attrs.get(n) ?? null; }
  setAttribute(n: string, v: string) { this.attrs.set(n, v); }
  matches(sel: string) { return sel === ':popover-open' && this.shown; }
  showPopover() {
    if (this.shown) throw new Error('InvalidStateError: already showing');
    this.shown = true;
    this.log.push(`show ${this.id}`);
  }
  hidePopover() {
    this.shown = false;
    this.log.push(`hide ${this.id}`);
  }
}
const el = (p: Pop) => p as unknown as HTMLElement;

test('setTopLayer: shows and hides once, quiet when already in that state, when not connected or without the Popover API', () => {
  const log: string[] = [];
  const a = new Pop('a', log);
  setTopLayer(el(a), true);
  setTopLayer(el(a), true); // a re-render while open: no second show (the browser would throw)
  setTopLayer(el(a), false);
  setTopLayer(el(a), false);
  expect(log).toEqual(['show a', 'hide a']);
  const off = new Pop('off', log);
  off.isConnected = false;
  setTopLayer(el(off), true);
  setTopLayer({ isConnected: true, matches: () => false } as unknown as HTMLElement, true); // no showPopover: an old browser
  setTopLayer(null, true);
  expect(log).toEqual(['show a', 'hide a']);
});

test('liftToTopLayer: a manual popover marked data-lifted, shown once; raiseLifted shows the showing ones again (above a dialog just opened)', () => {
  const log: string[] = [];
  const t1 = new Pop('t1', log);
  const t2 = new Pop('t2', log);
  const gone = new Pop('gone', log);
  liftToTopLayer(el(t1));
  liftToTopLayer(el(t1));
  expect(t1.getAttribute('popover')).toBe('manual');
  expect(t1.hasAttribute('data-lifted')).toBe(true);
  liftToTopLayer(el(t2));
  liftToTopLayer(el(gone));
  t2.hidePopover(); // a toast that is lifted but not showing now
  gone.isConnected = false; // a toast that left the page
  log.length = 0;
  raiseLifted();
  expect(log).toEqual(['hide t1', 'show t1']);
  expect(t1.shown && !t2.shown).toBe(true);
  // an element with its own popover attribute keeps it
  const own = new Pop('own', log);
  own.setAttribute('popover', 'auto');
  liftToTopLayer(el(own));
  expect(own.getAttribute('popover')).toBe('auto');
});

test('the resets weigh nothing against the lifted element\'s own rules: :where() for a toast inside a shadow root, :host(:where()) for a host', () => {
  expect(liftedReset.cssText).toMatch(/:where\(\[data-lifted\]\[popover\]\)\s*\{/);
  expect(liftedHostReset.cssText).toMatch(/:host\(:where\(\[data-lifted\]\[popover\]\)\)\s*\{/);
  for (const c of [liftedReset.cssText, liftedHostReset.cssText]) {
    for (const d of ['inset: auto', 'inline-size: auto', 'block-size: auto', 'margin: 0', 'border: 0', 'padding: 0', 'overflow: visible', 'color: inherit', 'background: transparent']) expect(c).toContain(d);
  }
});

test('sw-dialog: the backdrop is a manual popover shown after the opener is kept, hidden on close, shown again when put back; the stopgap is gone', () => {
  const s = src('components/sw-dialog.ts');
  expect(s).toMatch(/<div class="backdrop" popover="manual" @click=/);
  expect(s).not.toMatch(/keepBoxInView|GATE2380-B|scrollIntoView/);
  // the browser's [popover] box put back to a full-viewport layer
  const back = s.slice(s.indexOf('    .backdrop {'), s.indexOf('@starting-style'));
  for (const d of ['position: fixed;', 'inset: 0;', 'inline-size: auto;', 'block-size: auto;', 'max-inline-size: none;', 'max-block-size: none;', 'margin: 0;', 'border: 0;', 'overflow: visible;', 'color: inherit;', 'background: var(--sw-overlay);', 'z-index: var(--sw-z-modal);']) expect(back).toContain(d);
  // the open animation and reduced motion are untouched
  expect(s).toMatch(/@starting-style \{\s*\.backdrop \{\s*opacity: 0;/);
  expect(s).toContain('transform: scale(0.96) translateY(6px);');
  // updated(): the opener is read BEFORE the backdrop enters the top layer (showing it may move focus), then the focus pick runs
  const upd = s.slice(s.indexOf('  updated(changed'), s.indexOf('  /** DIALOG-TOPLAYER-2381: the backdrop in / out'));
  expect(upd.indexOf('this.opener = a')).toBeGreaterThan(0);
  expect(upd.indexOf('this.layer(true)')).toBeGreaterThan(upd.indexOf('this.opener = a'));
  expect(upd.indexOf('requestAnimationFrame')).toBeGreaterThan(upd.indexOf('this.layer(true)'));
  expect(upd).toMatch(/changed\.has\('open'\) && !this\.open\) this\.layer\(false\)/);
  expect(s).toMatch(/setTopLayer\(this\.renderRoot\.querySelector\('\.backdrop'\), show\);\s*if \(show\) raiseLifted\(\);/);
  const conn = s.slice(s.indexOf('  connectedCallback()'), s.indexOf('  disconnectedCallback()'));
  expect(conn).toMatch(/this\.track\(true\);\s*this\.layer\(true\)/);
  // Escape, the stack and the trap are the element's own, as before
  expect(s).toContain('const OPEN_STACK: SwDialog[] = [];');
  expect(s).toMatch(/if \(top && top !== this\) return;/);
  expect(s).toContain('private trapTab(e: KeyboardEvent)');
  expect(s).toContain('role="dialog" aria-modal="true"');
});

test('the skins still reach the dialog by the same class names (.backdrop, .box), so the glass and solid looks carry over', () => {
  expect(src('design/skins/domus.ts')).toContain(':host(sw-dialog) .box');
  expect(src('design/skins/crystal.ts')).toContain(':host(sw-dialog) .backdrop');
  expect(src('design/skins/tesla.ts')).toContain(':host(sw-dialog) .box');
});

test('every toast that can show while an sw-dialog is open is lifted to the top layer, with the reset in its styles', () => {
  const lifted: [string, RegExp, RegExp][] = [
    ['screens/access-external.ts', /<div class="toasts" aria-live="polite" \$\{liftRef\(\)/, /liftedReset,/],
    ['screens/door-windows.ts', /<div class="toast" role="status" \$\{liftRef\(\)/, /\[dwCss, liftedReset,/],
    ['maintenance/tags-page.ts', /class="toast noprint"[^>]*\$\{liftRef\(\)/, /maintCss/],
    ['maintenance/list-page.ts', /<div class="toast" role="status" aria-live="polite" \$\{liftRef\(\)/, /maintCss/],
    ['maintenance/close-prompt.ts', /<div class="toast" role="status" aria-live="polite" \$\{liftRef\(\)/, /\[liftedReset, css`/],
    ['screens/tree-unassigned.ts', /class="tl-toast"[^>]*\$\{liftRef\(\)\}/, /TREE_UNASSIGNED_CSS = css`\s*\$\{liftedReset\}/],
    ['screens/tickets-rfqs.ts', /data-rfq-toast \$\{liftRef\(\)/, /mediaPageStyles/],
    ['screens/tickets-handlers.ts', /data-handlers-error \$\{liftRef\(\)/, /mediaPageStyles/],
    ['screens/multimedia-groups.ts', /class="toast" role="status" \$\{liftRef\(\)/, /mediaPageStyles/],
    ['screens/multimedia-players.ts', /class="toast" role="status" \$\{liftRef\(\)/, /mediaPageStyles/],
    ['screens/multimedia-screens.ts', /class="toast" role="status" \$\{liftRef\(\)/, /liftedReset, css`/],
    ['screens/system-notifications.ts', /data-set-toast \$\{liftRef\(\)/, /mediaPageStyles/],
    ['screens/security-alarm.ts', /class="toast" role="status" aria-live="polite" \$\{liftRef\(\)/, /\[liftedReset, css`/],
    ['screens/system-calendar-sync.ts', /data-sync-toast \$\{liftRef\(\)/, /liftedReset, css`/],
    ['screens/system-calendars.ts', /data-calset-toast \$\{liftRef\(\)/, /liftedReset, css`/],
    ['screens/nvr-undo-toast.ts', /if \(this\.message\) liftToTopLayer\(this\);/, /static styles = \[liftedHostReset, css`/],
    ['pwa/arx-pwa-prompts.ts', /liftToTopLayer\(this\);/, /static styles = \[liftedHostReset, css`/],
  ];
  for (const [file, use, style] of lifted) {
    const s = src(file);
    expect(s, file).toMatch(use);
    expect(s, file).not.toMatch(/="[^"]* \$\{liftRef\(\)/); // the directive never lands inside an attribute's quotes (role="status ${...}")
    expect(s, file).toMatch(style);
    expect(s, file).toMatch(/from '\.\.\/components\/top-layer'/);
  }
  // the shared style sheets carry the reset for their users
  expect(src('maintenance/styles.ts')).toMatch(/maintCss = \[tempCss, liftedReset,/);
  expect(src('styles/media-page.ts')).toMatch(/mediaPageStyles = css`\s*\$\{liftedReset\}/);
});
