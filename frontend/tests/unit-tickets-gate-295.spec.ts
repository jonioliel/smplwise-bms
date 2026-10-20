import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTicketsHidden } from '../src/shell/nav';
import { ticketsEnabled } from '../src/tickets/gate';
import { deviceTicketsOn } from '../src/tickets/device-entry';
import { rowActions, type Notification } from '../src/api/notifications';

// TICKGATE-295 (owner rule 2026-10-20): while the tickets module is OFF no "open a service request" entry point renders anywhere.
// Node-only: the one switch (tickets/gate.ts) and the pure entry-point decisions run with the module OFF (and ON, so tickets-on stays as
// it was); the lint pins that every UI entry point found by the sweep asks the switch before it renders.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-gate-295.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');
const all = () => true;
const ticketRow = (kind: string) => ({ state: 'open', can_ack: false, link: '#/tickets/t-1', has_snapshot: false, subject: { kind }, me: { read_at: null, snoozed_until: null } }) as unknown as Notification;

test.afterEach(() => { applyTicketsHidden({ 'tickets.enabled': 'false' }); });

test('module OFF: the shared switch and every pure entry point say no', () => {
  applyTicketsHidden({ 'tickets.enabled': 'false' });
  expect(ticketsEnabled()).toBe(false);
  expect(ticketsEnabled('tickets.create', all)).toBe(false);
  expect(deviceTicketsOn(all)).toBe(false);
  expect(rowActions(ticketRow('ticket'), Date.now()).open).toBe(false);
  expect(rowActions(ticketRow('rfq'), Date.now()).open).toBe(false);
  expect(rowActions(ticketRow('camera'), Date.now()).open).toBe(true); // other rows keep their deep link
});

test('module ON: unchanged', () => {
  applyTicketsHidden({ 'tickets.enabled': 'true' });
  expect(ticketsEnabled()).toBe(true);
  expect(ticketsEnabled('tickets.create', (p) => p === 'tickets.create')).toBe(true);
  expect(ticketsEnabled('tickets.create', () => false)).toBe(false);
  expect(deviceTicketsOn(all)).toBe(true);
  expect(rowActions(ticketRow('ticket'), Date.now()).open).toBe(true);
});

test('lint: each UI entry point of the sweep asks the switch before rendering', () => {
  const det = read('temperature/detail.ts');
  expect(det).toMatch(/this\.canAck && ticketsEnabled\(\) \? html`<button[^`]*data-temp-ticket-btn/);
  expect(det).toMatch(/this\.ticket && ticketsEnabled\(\) \? html`<temp-ticket/);
  expect(det).toMatch(/!ticketsEnabled\(\) \|\| !list\.length/);
  expect(read('temperature/temp-settings.ts')).toContain("ticketsEnabled() || !k.startsWith('ticket_')");
  expect(read('access-external/request-dialog.ts')).toMatch(/const tk = ticketsEnabled\(\)/);
  expect(read('shell/sw-user-menu.ts')).toContain('ticketsEnabled() && canAnywhere(\'tickets.view\')');
  expect(read('components/notify-detail.ts')).toMatch(/renderDigest[^\n]*\n\s*if \(!ticketsEnabled\(\)\) return nothing/);
  expect(read('tickets/map-create.ts')).toMatch(/return moduleOn && held\('tickets\.create'\)/); // mapTicketsOn (a Lit element: not importable in node)
  // the entry points that already had a module check keep it
  expect(read('screens/explore-floor-map.ts')).toContain('mapTicketsOn() ?');
  expect(read('screens/explore-floor-map.ts')).toContain('deviceTicketsOn() ?');
  expect(read('screens/live-camera.ts')).toContain('mapTicketsOn() ?');
  expect(read('components/device-activity-press.ts')).toContain('deviceTicketsOn()');
});
