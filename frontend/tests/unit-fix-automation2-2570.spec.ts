import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resetAutomationsMock } from '../src/api/automations-mock';
import { offersEnableNow } from '../src/screens/automations-logic';
import { en as devicesEn } from '../src/i18n/lang/en/i18n/msg/devices';
import { en as automationEn } from '../src/i18n/lang/en/i18n/msg/automation';

// FIX-AUTOMATION2-2570: a copied or restored automation comes back switched off (the server's CD2-04 rule). "Turn on now" takes the enable
// route of the list switch (`toggleAutomation`) with its confirmation dialog when the item / the server asks for one: in the drawer after a copy
// or a trash restore (the drawer is modal, a toast button under it cannot be pressed), in the toast after the delete toast's undo.
// Node only (playwright.unit.config.ts).

const can = (toggle: boolean) => ({ edit: true, code_view: false, toggle, run: true, delete: true, copy: true });
let n = 0;
const rid = () => `fa2-${++n}`;

test('"turn on now" is offered for a switched-off automation the caller may switch on, and for nothing else', () => {
  expect(offersEnableNow({ kind: 'automation', state: 'off', can: can(true) })).toBe(true);
  expect(offersEnableNow({ kind: 'automation', state: 'on', can: can(true) })).toBe(false);
  expect(offersEnableNow({ kind: 'automation', state: 'off', can: can(false) })).toBe(false);
  expect(offersEnableNow({ kind: 'script', state: 'off', can: can(true) })).toBe(false);
  expect(offersEnableNow({ kind: 'scene', state: 'scene', can: can(true) })).toBe(false);
  expect(offersEnableNow(null)).toBe(false);
  expect(offersEnableNow(undefined)).toBe(false);
});

test('the demo store copies and restores an automation switched off, as the server does (CD2-04)', async () => {
  const m = resetAutomationsMock();
  const src = (await m.list({ kind: 'automation' })).items.find((i) => i.state === 'on')!;
  const c = await m.copy('automation', src.id, { name: 'עותק', client_request_id: rid() });
  expect(c.item!.state).toBe('off');
  expect(offersEnableNow(c.item)).toBe(true);
  const d = await m.get('automation', src.id);
  const del = await m.remove('automation', src.id, { base_revision: d.revision, client_request_id: rid() });
  const back = await m.restoreTrash(del.trash_id, { client_request_id: rid() });
  expect(back.item!.state).toBe('off');
  // the enable path then switches it on (with the confirmation the item asks for, if any)
  const on = await m.setEnabled(c.item!.id, true, { confirm: true, client_request_id: rid() });
  expect(on.item.state).toBe('on');
});

test('the screen and the drawer offer it through the enable path, with the text in Hebrew and English', () => {
  const screen = readFileSync(fileURLToPath(new URL('../src/screens/devices-automations.ts', import.meta.url)), 'utf8');
  const drawer = readFileSync(fileURLToPath(new URL('../src/screens/automation-drawer.ts', import.meta.url)), 'utf8');
  // the screen (the delete toast's undo; the drawer is closed then): the list switch's own toggle, with its confirmation dialog
  expect(screen).toMatch(/enableNowAction\(item: Item\)[^]*?run: \(\) => void this\.toggle\(item, true\)/);
  expect(screen).toMatch(/undoDelete[^]*?offersEnableNow\(r\.item\)[^]*?this\.enableNowAction\(r\.item!\)/);
  expect(screen).toMatch(/onCopied[^]*?offersEnableNow\(e\.detail\.item\)/);
  // the drawer (copy, trash restore): the offer, then toggleAutomation with `confirm` only after its own dialog (unknown effects or a 409)
  expect(drawer).toMatch(/doCopy[^]*?this\.enableOffer = offersEnableNow\(r\.item\)/);
  expect(drawer).toMatch(/restoreFromTrash[^]*?this\.enableOffer = offersEnableNow\(r\.item\)/);
  expect(drawer).toMatch(/enableNow\(confirmed = false\)[^]*?it\.unknown_effects\) \{ this\.confirm = 'enable'[^]*?toggleAutomation\(it\.id, true, \{ confirm: confirmed \|\| undefined \}\)[^]*?needsConfirmation\(err\) && !confirmed\) this\.confirm = 'enable'/);
  expect(drawer).toContain('@click=${() => void this.enableNow(true)}');
  expect(automationEn['"{name}" כבוי עד שתפעילו אותו.']).toBe('"{name}" stays off until you turn it on.');
  for (const he of ['הפעל עכשיו', '"{name}" שוחזר. הוא כבוי עד שתפעילו אותו.']) {
    expect(devicesEn[he as keyof typeof devicesEn]).toBeTruthy();
    expect(automationEn[he as keyof typeof automationEn]).toBeTruthy();
  }
  expect(devicesEn['שוכפל. העותק כבוי עד שתפעילו אותו.']).toBe('Duplicated. The copy stays off until you turn it on.');
});
