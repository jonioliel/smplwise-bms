import { test, expect } from '@playwright/test';
import { applyWiskeyUi, tabAllowed, WISKEY_UI, type Can } from '../src/shell/nav';

// CR-036 S7: the People tab of the WisKey area. While the screen is the embedded panel the tab keeps access.read at installation
// scope (WisKey's own per-area permissions decide inside the frame); once the owner switched it to the native Arx screen it needs
// the NEW permission access.people.read, held at ANY scope a station can be. Node only.

const PEOPLE = '#/wiskey/people';
const EVENTS = '#/wiskey/events';

/** A caller: permissions at installation scope and at any scope (what /me reports as permissions_installation / permissions_any). */
const caller = (installation: string[], any: string[] = installation): Can => (p, installationOnly = false) => (installationOnly ? installation : any).includes(p);

test.afterEach(() => applyWiskeyUi({}));

test('the embedded panel (the default): the tab keeps access.read at installation scope', () => {
  applyWiskeyUi({});
  expect(WISKEY_UI.people).toBe('wiskey');
  expect(tabAllowed(PEOPLE, caller(['access.read']))).toBe(true);
  expect(tabAllowed(PEOPLE, caller([], ['access.read']))).toBe(false); // access.read below installation scope never opened the WisKey area
  expect(tabAllowed(PEOPLE, caller(['access.people.read']))).toBe(false);
});

test('the native screen: a viewer (access.read only) is not offered the tab; an operator is', () => {
  applyWiskeyUi({ 'access.ui.people': 'smplwise' });
  expect(WISKEY_UI.people).toBe('smplwise');
  expect(tabAllowed(PEOPLE, caller(['access.read']))).toBe(false);
  expect(tabAllowed(PEOPLE, caller(['access.read', 'access.people.read']))).toBe(true);
});

test('the native screen: the permission counts at any scope (a station-scoped operator)', () => {
  applyWiskeyUi({ 'access.ui.people': 'smplwise' });
  expect(tabAllowed(PEOPLE, caller([], ['access.people.read']))).toBe(true);
  expect(tabAllowed(PEOPLE, caller([], ['access.read']))).toBe(false);
});

test('the other tabs are unchanged: the events tab keeps access.read at installation scope whatever the people choice', () => {
  applyWiskeyUi({ 'access.ui.people': 'smplwise' });
  expect(tabAllowed(EVENTS, caller(['access.read']))).toBe(true);
  expect(tabAllowed(EVENTS, caller([], ['access.read']))).toBe(false);
  expect(tabAllowed(EVENTS, caller(['access.people.read']))).toBe(false);
});

test('without a permission check (the static preview) every tab is offered', () => {
  applyWiskeyUi({ 'access.ui.people': 'smplwise' });
  expect(tabAllowed(PEOPLE)).toBe(true);
});
