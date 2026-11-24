import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// HAND-SWITCH-HOME-EDIT-2500 (follow-up of HAND-SWITCH-HOME-PERSONAL-2500): in the installation's home editor
// (screens/home-edit-panel.ts) a widget's two on / off choices - "הצג" beside the widget's name and "הצג" on its phone line - are the
// compact shared switch of HAND-SWITCH-2480, the same pattern as the personal list: sw-toggle size="sm" inside the row's <label>
// (in-label: a press on the text flips it too), labelHidden with the old check box's accessible name, the test hook on the host,
// disabled while the layout bar's "שמור" is on its way. The clock, weather-field, quick-action and include lists stay check boxes
// (pick-lists, HAND-SWITCH-2480 "choosers stay").
//   npx playwright test -c playwright.unit.config.ts tests/unit-hand-switch-home-edit-2500.spec.ts

const src = readFileSync(new URL('../src/screens/home-edit-panel.ts', import.meta.url), 'utf8');
const building = readFileSync(new URL('../src/screens/devices-building.ts', import.meta.url), 'utf8');
const line = (hook: string) => src.split('\n').find((l) => l.includes(`${hook}=\${id}`));

test.describe('the home editor: a widget\'s on / off choices are switches', () => {
  test('"הצג" beside the widget\'s name is sw-toggle (compact, in the label, named as the check box was, hook on the host, disabled while saving)', () => {
    const row = line('data-home-toggle');
    expect(row, 'the widget on / off row').toBeTruthy();
    expect(row).toContain("<label class=\"check\"><sw-toggle size=\"sm\" labelHidden in-label label=${tr('הצג {name}', { name: WIDGET_NAME[id] })} data-home-toggle=${id}");
    expect(row).toContain('.checked=${w.on} ?disabled=${this.busy}');
    expect(row).toContain('@change=${(e: Event) => this.setWidget(id, { on: toggled(e) } as never)}');
    // the visible name stays beside the switch, as it stood beside the check box
    expect(row).toContain('</sw-toggle><span class="w-name">${WIDGET_NAME[id]}</span></label>');
    expect(row).not.toContain('type="checkbox"');
  });

  test('"הצג" on the phone line is sw-toggle with the same pattern', () => {
    const row = line('data-home-phone-on');
    expect(row, 'the phone on / off row').toBeTruthy();
    expect(row).toContain("<label class=\"check\"><sw-toggle size=\"sm\" labelHidden in-label label=${tr('הצג בנייד: {name}', { name: WIDGET_NAME[id] })} data-home-phone-on=${id}");
    expect(row).toContain('.checked=${widgetOn(w, true)} ?disabled=${this.busy}');
    expect(row).toContain('@change=${(e: Event) => this.setPhoneOn(id, toggled(e))}');
    expect(row).toContain("</sw-toggle>${tr('הצג')}</label>");
    expect(row).not.toContain('type="checkbox"');
  });

  test('the value is read with toggled(); the track keeps its size; the screen passes its save state as busy', () => {
    expect(src).toMatch(/^import \{ toggled \} from '\.\.\/components\/sw-toggle';$/m);
    expect(src).toMatch(/\.check sw-toggle \{\s*flex: none;\s*\}/);
    expect(src).toMatch(/@property\(\{ type: Boolean \}\) busy = false;/);
    expect(building).toContain('<home-edit-panel flat ?busy=${this.lay.busy} ');
  });

  test('the pick-lists stay check boxes: clock (seconds, Hebrew date), weather fields, elevators / temperature include, quick actions', () => {
    for (const hook of ['data-home-clock-seconds', 'data-home-clock-hebrew', 'data-home-wfield=', 'data-home-elevator-include=', 'data-home-temp-include=', 'data-home-quick-action=']) {
      expect(src, hook).toMatch(new RegExp(`<input type="checkbox" ${hook.replace(/[-=]/g, (c) => `\\${c}`)}`));
    }
    expect(src.match(/type="checkbox"/g) ?? []).toHaveLength(6);
    expect(src.match(/<sw-toggle /g) ?? []).toHaveLength(2);
  });
});
