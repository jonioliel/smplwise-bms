import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyTicketsHidden } from '../src/shell/nav';
import { ticketsEnabled } from '../src/tickets/gate';
import { MARKER_FILTERS, byMarker, carriesMarker, filterKey, markerView } from '../src/tickets/vendor-marker';
import { XT_TABLES, xt } from '../src/i18n/access-external';

// VENDMARK-295 (owner GRANTS3 Q1, 2026-10-21): the permanent / temporary vendor marker. Node-only: the pure model, the four-language
// words, and - with the tickets module OFF (owner rule 2026-10-20) - that the marker adds no ticket action anywhere it is shown.
//   npx playwright test -c playwright.unit.config.ts tests/unit-vendor-marker-295.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (f: string) => readFileSync(path.join(SRC, f), 'utf8');

test.afterEach(() => { applyTicketsHidden({ 'tickets.enabled': 'false' }); });

const rows = [
  { id: 'a', permanent_vendor: true }, { id: 'b', permanent_vendor: false }, { id: 'c' }, { id: 'd', permanent_vendor: true },
];

test('the chip: permanent, temporary, and nothing for an unknown value', () => {
  expect(markerView(true)).toMatchObject({ permanent: true, key: 'vm_permanent' });
  expect(markerView(false)).toMatchObject({ permanent: false, key: 'vm_temporary' });
  expect(markerView(undefined)).toBeNull();
  expect(markerView(null)).toBeNull();
});

test('the filter: all / permanent / temporary (a missing flag counts as temporary)', () => {
  expect(MARKER_FILTERS).toEqual(['all', 'permanent', 'temporary']);
  expect(byMarker(rows, 'all').map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
  expect(byMarker(rows, 'permanent').map((r) => r.id)).toEqual(['a', 'd']);
  expect(byMarker(rows, 'temporary').map((r) => r.id)).toEqual(['b', 'c']);
});

test('only vendors and external persons carry the marker', () => {
  expect(carriesMarker('vendor')).toBe(true);
  expect(carriesMarker('person')).toBe(true);
  expect(carriesMarker('employee')).toBe(false);
});

test('he / en / ar / ru: every marker word exists and differs per language, no hint text', () => {
  const keys = ['vm_permanent', 'vm_temporary', 'vm_kind', 'vm_all'] as const;
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of keys) {
    expect(XT_TABLES[lang][k], `${lang}.${k}`).toBeTruthy();
    expect(XT_TABLES[lang][k].length, `${lang}.${k}`).toBeLessThan(32); // a label, never a paragraph
  }
  for (const k of keys) expect(new Set(['he', 'en', 'ar', 'ru'].map((l) => XT_TABLES[l as 'he'][k])).size).toBe(4);
  expect(xt(filterKey('permanent'), undefined, 'ar')).toBe(XT_TABLES.ar.vm_permanent);
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) for (const k of keys) expect(XT_TABLES[lang][k]).not.toMatch(/home assistant|\bHA\b|ingress/i);
});

test('tickets module OFF: the marker still works and brings no ticket action', () => {
  applyTicketsHidden({ 'tickets.enabled': 'false' });
  expect(ticketsEnabled()).toBe(false);
  // the model is independent of the module switch: information shows, filters work
  expect(markerView(true)?.key).toBe('vm_permanent');
  expect(byMarker(rows, 'permanent')).toHaveLength(2);
  // nothing the marker produces is an action: no link, no ticket field in the view
  const v = markerView(true)!;
  expect(Object.keys(v).sort()).toEqual(['key', 'permanent', 'tone']);
  // the places that render it: no link, button-to-ticket, deep link or ticket wording inside the marker pieces
  const model = read('tickets/vendor-marker.ts').replace(/\/\*[\s\S]*?\*\//g, '');
  expect(model).not.toMatch(/href|#\/tickets|ticketsEnabled|openTicket|new-ticket/i);
  const card = read('access-external/identity-card.ts');
  const chip = card.slice(card.indexOf('data-identity-marker') - 120, card.indexOf('data-identity-marker') + 260);
  expect(chip).not.toMatch(/href|<a |#\/tickets|@click/);
  const dir = read('tickets/contacts-directory.ts');
  const piece = dir.slice(dir.indexOf('private markerChip'), dir.indexOf('private listCard'));
  expect(piece.length).toBeGreaterThan(300);
  expect(piece).not.toMatch(/href|<a |#\/tickets|ticket/i);
});

test('lint: the editor sends the marker only for vendors and persons, never for a manager', () => {
  const dir = read('tickets/contacts-directory.ts');
  expect(dir).toContain('carriesMarker(d.kind) && d.permanent_vendor !== before.permanent_vendor');
  expect(dir).toMatch(/employee \|\| this\.mgr \? nothing : seg\(xt\('vm_kind'\)/);
  expect(dir).not.toMatch(/keep = \[[^\]]*permanent_vendor/); // a department manager's body never carries it
});
