import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NO_TRAP, holdsTab, isTopLayer, layerCount, removeLayer, syncLayer, takesEscape, topLayer } from '../src/components/modal-stack';

// CR-MODAL-STACK-B-2442 (code review 07:F13, the part CR-MODAL-STACK-2441 left open): every hand-built `role="dialog"` /
// `role="alertdialog"` box is either ON the shared modal stack (components/modal-stack.ts, directly or through components/hand-modal.ts)
// or listed below with the reason it is not. A NEW hand-built dialog fails this spec until its author does one of the two:
//   1. put it on the stack (HandModal, or syncLayer / pushLayer + takesEscape) and add / raise its file's count in ON_STACK, or
//   2. add / raise its file's count in ALLOWED with a reason a reviewer can check.
// The better answer is nearly always a third one: use sw-dialog / sw-drawer / sw-sheet.
//   npx playwright test -c playwright.unit.config.ts tests/unit-modal-stack-guard-2442.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

/** The three primitives: they ARE the stack's layers. */
const PRIMITIVES = new Set(['components/sw-dialog.ts', 'components/sw-drawer.ts', 'components/sw-sheet.ts']);

/** A hand-built dialog box in markup or set from code. */
const DIALOG = /role=["'](?:alert)?dialog["']|['"]role['"]\s*,\s*['"](?:alert)?dialog['"]/g;
/** The file talks to the stack. */
const USES_STACK = /from '(?:\.\.?\/)+(?:components\/)?(?:modal-stack|hand-modal)'/;

/** file -> the number of dialog boxes it draws, and (for a template module) the file whose layer it is drawn in. */
const ON_STACK: Record<string, { n: number; via?: string }> = {
  // the home interface: every overlay is drawn in sw-home's `ovl` slot - one HandModal layer
  'home/sw-home.ts': { n: 11 },
  'home/home-alarm.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-calendar.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-intercom.ts': { n: 2, via: 'home/sw-home.ts' },
  'home/home-notices.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-p3-announce.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-p3-media.ts': { n: 2, via: 'home/sw-home.ts' },
  'home/home-scene-new.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-schedules.ts': { n: 1, via: 'home/sw-home.ts' },
  'home/home-tickets.ts': { n: 2, via: 'home/sw-home.ts' },
  'home/sw-home-call.ts': { n: 1 },
  'home/home-wall-rest.ts': { n: 2 }, // HOME-WALL-NIGHT-2500: the wall panel's takeover (alarm / urgent notice), its own HandModal layer
  // calendars
  'calendars/grid-overlays.ts': { n: 4 },
  'calendars/resident.ts': { n: 4 },
  // the shell
  'components/notify-center.ts': { n: 1 },
  'shell/sw-user-menu.ts': { n: 1 },
  'shell/sw-app.ts': { n: 2 },
  // screens
  'screens/mapping-assistant.ts': { n: 1 },
  'screens/area-quick-sheet.ts': { n: 2 }, // the panel, and its reset confirmation (drawn inside the panel, closed first by the panel's Escape)
  'screens/devices-building.ts': { n: 1 },
  // cast
  'components/sw-cast-picker.ts': { n: 2 }, // the docked panel, and its "busy screen" question (drawn inside the panel)
  'components/sw-cast-pill.ts': { n: 1 },
  // tickets
  'tickets/table-toolbar.ts': { n: 4 },
  'tickets/list-toolbar.ts': { n: 1 },
};

/** file -> the number of dialog boxes it draws and why they are not layers of the stack. */
const ALLOWED: Record<string, { n: number; why: string }> = {
  'calendars/connect-dialogs.ts': { n: 1, why: 'an inline confirmation row inside an sw-dialog (the dialog is the layer); it has no key listener' },
  'components/media-queue-list.ts': { n: 2, why: 'inline confirmation rows of the queue list (no scrim, no key listener); the list lives in panels that are layers themselves' },
  'components/wk-door-tech.ts': { n: 1, why: 'an inline confirmation block inside an sw-dialog (the dialog is the layer); it has no key listener' },
  'maintenance/task-sheet.ts': { n: 2, why: 'inline confirmation alerts inside an sw-dialog (the dialog is the layer); they have no key listener' },
  'screens/door-automation-block.ts': { n: 1, why: 'an inline confirmation block of a form section (no scrim, no key listener)' },
  'components/sw-popover.ts': { n: 1, why: 'a non-modal card (aria-modal="false") beside the page; its Escape acts only with focus inside it and skips a key already taken' },
  'components/sw-recorded-month.ts': { n: 1, why: 'a native popover="auto": the browser owns its top layer, Escape and light dismiss' },
  'map/room-pill-view.ts': { n: 1, why: 'a hover / focus popover of a map pill (non-modal, leaves with the pointer)' },
  'pwa/arx-pwa-prompts.ts': { n: 2, why: 'non-modal install cards (no scrim, no Escape, the page stays in use)' },
  'screens/home-edit-drawer.ts': { n: 1, why: 'edit mode\'s docked panel (aria-modal="false", open the whole time beside the page it edits); a layer would hold Escape over the page' },
  'screens/scenario-recipients.ts': { n: 1, why: 'an inline picker of a form field; Escape acts only with focus inside it' },
  'temperature/detail.ts': { n: 1, why: 'a footer popover inside the modal sw-drawer, already ordered by the drawer\'s data-nested-open walk' },
};

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

/** rel path -> the number of hand-built dialog boxes in it. */
function found(): Map<string, number> {
  const out = new Map<string, number>();
  for (const full of walk(SRC)) {
    const rel = path.relative(SRC, full).split(path.sep).join('/');
    if (PRIMITIVES.has(rel)) continue;
    const n = readFileSync(full, 'utf8').match(DIALOG)?.length ?? 0;
    if (n) out.set(rel, n);
  }
  return out;
}

test('every hand-built role="dialog" is on the modal stack or allow-listed with a reason', () => {
  const problems: string[] = [];
  const seen = found();
  for (const [rel, n] of seen) {
    const on = ON_STACK[rel];
    const ok = ALLOWED[rel];
    if (on && ok) problems.push(`${rel}: listed twice (ON_STACK and ALLOWED)`);
    else if (!on && !ok) problems.push(`${rel}: ${n} hand-built dialog(s) that are neither on the modal stack nor allow-listed - use sw-dialog / sw-drawer / sw-sheet, or HandModal`);
    else if ((on ?? ok)!.n !== n) problems.push(`${rel}: ${n} hand-built dialog(s), the list says ${(on ?? ok)!.n} - a new one must join the stack (or be allow-listed) and the count updated`);
  }
  for (const rel of [...Object.keys(ON_STACK), ...Object.keys(ALLOWED)]) if (!seen.has(rel)) problems.push(`${rel}: listed, but it draws no hand-built dialog any more - remove the entry`);
  expect(problems, problems.join('\n')).toEqual([]);
});

test('a file listed as on the stack really talks to it (itself, or the file that draws its template)', () => {
  const problems: string[] = [];
  for (const [rel, { via }] of Object.entries(ON_STACK)) {
    const owner = via ?? rel;
    if (via && (!ON_STACK[via] || ON_STACK[via].via)) problems.push(`${rel}: via ${via}, which is not a direct ON_STACK entry`);
    if (!USES_STACK.test(read(owner))) problems.push(`${rel}: ${owner} does not import modal-stack or hand-modal`);
  }
  expect(problems, problems.join('\n')).toEqual([]);
});

test('every allow-listed file carries a real reason and does not talk to the stack', () => {
  for (const [rel, { why }] of Object.entries(ALLOWED)) {
    expect(why.trim().length, rel).toBeGreaterThan(20);
    expect(USES_STACK.test(read(rel)), `${rel} imports the stack: move it to ON_STACK`).toBe(false);
  }
});

test('HandModal: enters the stack, takes Escape only on top, holds Tab, leaves on close and on release', () => {
  const src = read('components/hand-modal.ts');
  expect(src).toContain('pushLayer(this, { traps: this.o.traps })');
  expect(src).toContain('if (!takesEscape(this, e)) return;');
  expect(src).toContain('!holdsTab(this)');
  expect(src).toContain('restoreFocus(back)');
  expect(src).toMatch(/private leave\(\) \{\s*removeLayer\(this\);\s*window\.removeEventListener\('keydown', this\.onKey\);/);
  expect(src).toContain("el.setAttribute('inert', '')");
  expect(src).toContain("el.removeAttribute('inert')");
  // the screens that used to listen for Escape themselves do not any more (the layer's listener replaced it)
  expect(read('home/sw-home.ts')).not.toMatch(/ev\.key === 'Escape' && this\.ovl/);
});

test('syncLayer: said after every render, it enters once, keeps its place and leaves when closed', () => {
  const pop = { n: 'popover' };
  const dialog = { n: 'dialog' };
  syncLayer(pop, true, NO_TRAP);
  syncLayer(dialog, true);
  syncLayer(pop, true, NO_TRAP); // a re-render of the popover under the dialog: it must NOT jump over the dialog
  expect(layerCount()).toBe(2);
  expect(topLayer()).toBe(dialog);
  expect(holdsTab(dialog)).toBe(true);
  expect(holdsTab(pop)).toBe(false);
  const press = {};
  expect(takesEscape(pop, press)).toBe(false);
  expect(takesEscape(dialog, press)).toBe(true);
  syncLayer(dialog, false);
  syncLayer(dialog, false); // closing twice is harmless
  expect(isTopLayer(pop)).toBe(true);
  expect(takesEscape(pop, press)).toBe(false); // the same press was answered by the dialog
  expect(takesEscape(pop, {})).toBe(true);
  expect(holdsTab(pop)).toBe(false); // a popover never traps
  syncLayer(pop, false);
  removeLayer(dialog);
  expect(layerCount()).toBe(0);
});
