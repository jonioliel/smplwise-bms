import { test, expect } from '@playwright/test';
import { applyWiskeyUi, NATIVE_WISKEY_TABS, tabAllowed, WISKEY_UI, type Can } from '../src/shell/nav';

// CR-036 S8 (the carry-over of S3): a WisKey screen shown natively is offered to the holders of the permission its typed read needs, at any
// scope; the embedded panel keeps `access.read` at installation scope. Node only.

/** What the navigation's `can` says for a person: `installation` permissions hold at both scopes, `any` only when the scope is not asked. */
const person = (installation: string[], any: string[] = installation): Can => (permission, installationOnly = false) => (installationOnly ? installation : any).includes(permission);

const viewer = person(['access.read']);
const operator = person(['access.read', 'access.events.read', 'access.people.read']);
const scopedOperator = person([], ['access.read', 'access.events.read']); // bindings on one station only
const nobody = person([]);

const EVENTS = '#/wiskey/events';
const OVERVIEW = '#/wiskey/overview';

test.afterEach(() => applyWiskeyUi({})); // every screen back to the embedded panel

test('the embedded panel: every tab needs access.read at installation scope (unchanged)', () => {
  applyWiskeyUi({ 'access.ui.events': 'wiskey' });
  expect(WISKEY_UI.events).toBe('wiskey');
  expect(tabAllowed(EVENTS, viewer)).toBe(true);
  expect(tabAllowed(EVENTS, operator)).toBe(true);
  expect(tabAllowed(EVENTS, scopedOperator)).toBe(false); // access.read at a station scope is not an installation-wide one
  expect(tabAllowed(EVENTS, nobody)).toBe(false);
});

test('the native screen: the tab needs access.events.read - a viewer is not offered a tab that would only say "not available"', () => {
  applyWiskeyUi({ 'access.ui.events': 'smplwise' });
  expect(WISKEY_UI.events).toBe('smplwise');
  expect(NATIVE_WISKEY_TABS['#/wiskey/events']).toEqual({ screen: 'events', need: ['access.events.read'] });
  expect(tabAllowed(EVENTS, viewer)).toBe(false);
  expect(tabAllowed(EVENTS, operator)).toBe(true);
  expect(tabAllowed(EVENTS, nobody)).toBe(false);
});

test('the native screen: held at a station scope only, the tab is still offered (the server decides per station)', () => {
  applyWiskeyUi({ 'access.ui.events': 'smplwise' });
  expect(tabAllowed(EVENTS, scopedOperator)).toBe(true);
});

test('only the screens that have an entry are re-gated: the entry center keeps access.read until its slice says otherwise', () => {
  applyWiskeyUi({ 'access.ui.events': 'smplwise', 'access.ui.overview': 'smplwise' });
  expect(tabAllowed(OVERVIEW, viewer)).toBe(true);
  expect(tabAllowed('#/wiskey/devices', viewer)).toBe(true); // the embedded-only screens: unchanged
  // the people tab has no row in this slice: S7 adds its own (access.people.read); until then it is gated like every other tab
  if (!NATIVE_WISKEY_TABS['#/wiskey/people']) {
    applyWiskeyUi({ 'access.ui.people': 'smplwise' });
    expect(tabAllowed('#/wiskey/people', viewer)).toBe(true);
  }
});

test('without a permission check (a static preview) every tab is offered', () => {
  applyWiskeyUi({ 'access.ui.events': 'smplwise' });
  expect(tabAllowed(EVENTS)).toBe(true);
});
