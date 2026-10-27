import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { addressAction } from '../src/screens/automations-logic';

// XSECFOLLOW-297 (follow-up c of the XSECFIX-297 review, M4 web half): `?do=run` in an address only opens the run confirmation; nothing
// runs without the user's tap. Node only (playwright.unit.config.ts): the rule itself, and a source guard that the drawer's address
// handler goes through it and never calls the run.

const ALL = { run: true, copy: true, delete: true };
const NONE = { run: false, copy: false, delete: false };

test('?do=run opens the run confirmation only, and only with the run right', () => {
  expect(addressAction('run', ALL)).toBe('run');
  expect(addressAction('run', { ...ALL, run: false })).toBeNull();
  expect(addressAction('run', NONE)).toBeNull();
});

test('?do=copy and ?do=delete open their own dialog with their own right', () => {
  expect(addressAction('copy', ALL)).toBe('copy');
  expect(addressAction('copy', { ...ALL, copy: false })).toBeNull();
  expect(addressAction('delete', ALL)).toBe('delete');
  expect(addressAction('delete', { ...ALL, delete: false })).toBeNull();
});

test('any other value of do opens nothing', () => {
  for (const v of ['', null, undefined, 'RUN', 'Run', ' run', 'run ', 'run&confirm=1', 'execute', 'trigger', 'stop', 'toggle', 'restore', 'dryrun', 'edit']) {
    expect(addressAction(v, ALL), String(v)).toBeNull();
  }
});

test('the drawer applies the address through addressAction and never runs from it', () => {
  const src = readFileSync(fileURLToPath(new URL('../src/screens/automation-drawer.ts', import.meta.url)), 'utf8');
  const start = src.indexOf('private applyAction()');
  expect(start).toBeGreaterThan(0);
  const end = src.indexOf('\n  }\n', start);
  const body = src.slice(start, end);
  expect(body).toContain('addressAction(');
  expect(body).toContain('this.confirm = open');
  // no run, script run, delete or copy call from the address: only a dialog opens
  for (const call of ['this.run(', 'runAutomation(', 'runScriptNow(', 'this.doDelete(', 'this.doCopy(', 'deleteItem(', 'copyItem(']) {
    expect(body, call).not.toContain(call);
  }
});
