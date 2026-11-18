import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FE-TYPES-2443 (code review 2026-11-13, 08:F19 tickets items): the three ticket files read API fields through casts (two of them
// through `unknown`) that hid gaps in the API types. The fields are now declared where the answer is typed, the casts are gone, and
// `npx tsc --noEmit` checks every read. This spec keeps them gone (source only; no runtime change to test).
//   npx playwright test -c playwright.unit.config.ts tests/unit-fe-types-2443.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');

test('no cast through unknown is left in the three ticket files', () => {
  for (const f of ['tickets/external-assign.ts', 'tickets/costs-tab.ts', 'tickets/vendor-accounts.ts']) expect(read(f), f).not.toMatch(/as unknown as/);
});

test('the assign preview type declares what the dialog reads (slice 5b lines, slice 9 cost claim)', () => {
  const s4 = read('api/tickets-s4.ts');
  expect(s4).toMatch(/export interface AssignPreview extends AssignPreviewExtra \{/);
  expect(s4).toMatch(/\n  cost_claim\?: CostClaimOption;\n/);
  const dlg = read('tickets/external-assign.ts');
  expect(dlg).toMatch(/const opt = this\.preview\?\.cost_claim;/);
  expect(dlg).not.toMatch(/as AssignPreview & AssignPreviewExtra/);
});

test('the costs tab passes its ticket to canWriteVendor as it is', () => {
  expect(read('tickets/costs-tab.ts')).toMatch(/canWriteVendor\(t\)/);
});
