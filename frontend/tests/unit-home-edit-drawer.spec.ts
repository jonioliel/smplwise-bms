import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// HOME-EDIT-DRAWER-2351 (docs/changes/HOME-EDIT-DRAWER-2351.md): the home screen's edit mode lives in a drawer, not in the page flow.
// A source contract (node only, no app build):
//   npx playwright test -c playwright.unit.config.ts tests/unit-home-edit-drawer.spec.ts
// The browser half (the drawer beside the preview, no page scroll, Escape, the focus wrap) is for the runner's evidence specs.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
const code = (rel: string) => read(rel).split('\n').filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join('\n');

test.describe('home edit drawer', () => {
  const drawer = code('screens/home-edit-drawer.ts');
  const building = code('screens/devices-building.ts');

  test('the edit panel is no longer drawn in the page body: the drawer holds it, with the card panel', () => {
    // the body template (floors / tiles / plan) no longer starts with the edit panel
    expect(building).not.toMatch(/\$\{this\.lay\.editing \? this\.renderHomeEdit\(t\) : nothing\}/);
    expect(building).toMatch(/\$\{this\.lay\.editing \? this\.renderEditDrawer\(t\) : this\.lay\.renderPanel\(\)\}/);
    expect(building).toMatch(/home: this\.renderHomeEdit\(t\),\s*card: this\.lay\.renderPanel\(\),/);
    // no page scroll toward the panel any more: the widget row is brought into view inside the drawer
    expect(building).not.toMatch(/querySelector\('home-edit-panel'\)\?\.scrollIntoView/);
    expect(building).toMatch(/<home-edit-panel flat /);
  });

  test('save and cancel sit in the drawer footer and call the layout editor (same permission and audit path as the bar)', () => {
    expect(drawer).toMatch(/<footer class="he-df">[\s\S]*data-home-drawer-cancel[\s\S]*data-home-drawer-save[\s\S]*<\/footer>/);
    expect(building).toMatch(/onSave: \(\) => void this\.lay\.save\(\)/);
    expect(building).toMatch(/onCancel: \(\) => this\.lay\.cancel\(\)/);
    // the footer never scrolls away: the body is the drawer's one scroll container
    expect(drawer).toMatch(/\.he-db \{[^}]*overflow: auto;[^}]*overscroll-behavior: contain;/);
    expect(drawer).toMatch(/\.he-df \{[^}]*flex: none;/);
  });

  test('keyboard: Escape closes, Tab wraps inside, the tabs walk with the arrows, focus returns to the bar key', () => {
    expect(drawer).toMatch(/import \{ modalKeydown, tablistKeydown \} from '\.\.\/components\/a11y-keys'/);
    expect(drawer).toMatch(/if \(e\.key === 'Escape' && e\.defaultPrevented\) return;/);
    expect(drawer).toMatch(/role="dialog" aria-modal="false"[^>]*@keydown=\$\{\(e: KeyboardEvent\) => drawerKeydown\(e, v\.onClose\)\}/);
    expect(drawer).toMatch(/role="tablist"[^>]*@keydown=\$\{tablistKeydown\}/);
    expect(drawer).toMatch(/data-home-drawer-toggle aria-controls=\$\{HOME_DRAWER_ID\} aria-expanded=/);
    expect(building).toMatch(/querySelector<HTMLElement>\('\[data-home-drawer-toggle\]'\)\?\.focus/);
  });

  test('the drawer test hooks never repeat the bar\'s own (a spec locator stays unique)', () => {
    for (const hook of ['data-layout-save', 'data-layout-cancel', 'data-layout-bar']) expect(drawer).not.toContain(hook);
  });

  test('layout: side drawer from 1200 px, bottom sheet below (OWNER-R12-2341), motion on tokens, reduced motion without travel', () => {
    expect(drawer).toMatch(/@media \(max-width: 1199px\) \{\s*\.he-drawer \{[^}]*inset-inline: 8px;/);
    expect(drawer).toMatch(/transition:\s*opacity var\(--sw-t-sheet\) var\(--sw-ease-out\),\s*transform var\(--sw-t-sheet\) var\(--sw-ease-out\);/);
    expect(drawer).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*@starting-style \{\s*\.he-drawer \{\s*transform: none;/);
  });

  test('the phone rule is unchanged: edit mode is refused on a phone when the installation hides the layout editor there', () => {
    expect(building).toMatch(/if \(this\.lay\.canEdit && !phoneRestricted\('layout_editor'\)\) void this\.lay\.enter\(\);/);
    expect(code('shell/sw-app.ts')).toMatch(/can\('system\.configure'\) && !phoneRestricted\('layout_editor'\)/);
  });

  test('the edit panel lays itself out by its own width (container query), so it fits the drawer', () => {
    const panel = code('screens/home-edit-panel.ts');
    expect(panel).toMatch(/container-type: inline-size;/);
    expect(panel).toMatch(/@container \(max-width: 640px\) \{\s*\.home-edit \{\s*grid-template-columns: minmax\(0, 1fr\);/);
    expect(panel).toMatch(/:host\(\[flat\]\) \.home-edit \{/);
  });
});
