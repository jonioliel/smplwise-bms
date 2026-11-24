import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// HAND-SWITCH-HOME-PERSONAL-2500 (owner Q32 "yes, after the home panel edit"): in the personal home section of the user menu
// (shell/sw-home-personal.ts) a widget's own on / off is the compact shared switch of HAND-SWITCH-2480 - sw-toggle size="sm" inside the
// row's <label> (in-label: a press on the widget's name flips it too), its accessible name the widget's name, the test hook on the host,
// disabled while a save is on its way. The elevators "include" list stays a list of check boxes (a chooser - pick the items - as the
// installation's elevator settings and home editor keep it, HAND-SWITCH-2480 "choosers stay").
//   npx playwright test -c playwright.unit.config.ts tests/unit-hand-switch-home-personal-2500.spec.ts

const src = readFileSync(new URL('../src/shell/sw-home-personal.ts', import.meta.url), 'utf8');

test.describe('the personal home section: the widget on / off is a switch', () => {
  test('the on / off row draws sw-toggle (compact, in the label, named by the widget, hook on the host, disabled while busy)', () => {
    const row = src.split('\n').find((l) => l.includes('data-home-personal-on='));
    expect(row, 'the widget on / off row').toBeTruthy();
    expect(row).toContain('<label class="check"><sw-toggle size="sm" labelHidden in-label label=${WIDGET_NAME[id]} data-home-personal-on=${id}');
    expect(row).toContain('.checked=${on} ?disabled=${this.busy}');
    expect(row).toContain('@change=${(e: Event) => this.setOn(id, toggled(e))}');
    // the visible name stays beside the switch, as it stood beside the check box
    expect(row).toContain('</sw-toggle><span class="lbl">${WIDGET_NAME[id]}</span></label>');
    expect(row).not.toContain('type="checkbox"');
  });

  test('the value is read with toggled() from the shared switch module', () => {
    expect(src).toMatch(/^import \{ toggled \} from '\.\.\/components\/sw-toggle';$/m);
    expect(src).toMatch(/\.check sw-toggle \{\s*flex: none;\s*\}/);
  });

  test('only the elevators "include" chooser keeps check boxes (one per elevator, still disabled when the administrator hid it)', () => {
    const boxes = src.match(/type="checkbox"/g) ?? [];
    expect(boxes).toHaveLength(1);
    expect(src).toContain('<input type="checkbox" data-home-personal-elevator=${e.id}');
    expect(src).toContain('?disabled=${this.busy || byAdmin}');
  });
});
