import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ClaimForm, type ClaimFormSettings, type ClaimInfo, type ClaimPayload, type FieldError, DEFAULT_LIMITS, computeForm } from '../src/public-ticket/claim/claim-model';
import { attach } from '../src/public-ticket/claim/claim-prefill';

// CR-CLAIM-PREFILL: the payment demand loaded from the approved quote (node-only: the form, the check and the payload; no DOM)

const SETTINGS: ClaimFormSettings = {
  currencies: ['ILS'], vat: { exempt: false, rate_bp: 1800, default: 'excluded' }, labor_rate_minor: null, require_invoice: false, limits: DEFAULT_LIMITS,
};

const PREFILL = {
  version: 2, partial: false, currency: 'ILS', vat_mode: 'excluded' as const, vat_rate_bp: 1800,
  lines: [{ kind: 'labor' as const, description: '', total_minor: 30000, hours: '2', rate_minor: 15000 },
    { kind: 'parts' as const, description: 'מדחס', total_minor: 80000, quantity: '1', unit_minor: 80000 }],
  subtotal_minor: 110000, vat_minor: 19800, total_minor: 129800, work_from: null, work_to: null,
  instalments: [{ index: 0, kind: 'advance' as const, amount_minor: 38940, due: 'date' as const, date: '2026-11-02', days: null, due_date: '2026-11-02' },
    { index: 1, kind: 'final' as const, amount_minor: 90860, due: 'completion' as const, date: null, days: null, due_date: null }],
  instalment: null as number | null,
};

function host(info: ClaimInfo, lang = 'he') {
  const state: { form: ClaimForm | null; changed: number } = { form: null, changed: 0 };
  const ext = attach({
    lang, info: () => info, settings: () => SETTINGS, form: () => state.form!, set: (f) => (state.form = f),
    slot: () => { throw new Error('no DOM in a unit test'); }, changed: () => (state.changed += 1),
  });
  state.form = ext.form();
  return { ext, state };
}

function body(): ClaimPayload {
  return { lines: [], currency: 'ILS', documents: [], client_request_id: '00000000-0000-4000-8000-000000000000' };
}

test('a fresh demand starts from the approved lines and equals the approved total', () => {
  const { ext, state } = host({ status: 'awaiting', prefill: { ...PREFILL } });
  const f = state.form!;
  expect(f.lines.map((l) => [l.kind, l.hours, l.rate, l.quantity, l.unit_price, l.description])).toEqual([
    ['labor', '2', '150', '', '', ''], ['parts', '', '', '1', '800', 'מדחס']]);
  expect(f.include_vat).toBe(false);
  expect(computeForm(f, SETTINGS).total).toBe(PREFILL.total_minor);
  const errors: FieldError[] = [];
  ext.check(errors);
  expect(errors).toEqual([]);
  const b = body();
  ext.payload(b);
  expect(b.instalment_index).toBeUndefined();
  expect(b.above_reason).toBeUndefined();
});

test('the instalment a manager opened is pre-selected: one line of its amount (VAT included), sent with its index', () => {
  const { ext, state } = host({ status: 'awaiting', prefill: { ...PREFILL, instalment: 0 } });
  const f = state.form!;
  expect(f.lines).toHaveLength(1);
  expect([f.lines[0].kind, f.lines[0].hours, f.lines[0].rate, f.lines[0].description]).toEqual(['labor', '1', '389.40', 'מקדמה']);
  expect(f.include_vat).toBe(true);
  expect(computeForm(f, SETTINGS).total).toBe(38940);
  const b = body();
  ext.payload(b);
  expect(b.instalment_index).toBe(0);
});

test('above the approved amount a reason is required (and sent); equal or below needs none', () => {
  const { ext, state } = host({ status: 'awaiting', prefill: { ...PREFILL } });
  state.form!.lines[0].hours = '3'; // + 150 net -> above
  const errors: FieldError[] = [];
  ext.check(errors);
  expect(errors).toEqual([{ field: 'above_reason', code: 'required' }]);
  state.form!.lines[0].hours = '1'; // below: accepted as it is, flagged for the manager by the server
  const none: FieldError[] = [];
  ext.check(none);
  expect(none).toEqual([]);
});

test('a correction keeps the instalment and the reason of the last revision', () => {
  const rev = {
    id: 'r1', seq: 1, source: 'vendor', kind: 'submission', no_charge: false, lines: [], labor_minor: 0, parts_minor: 0, travel_minor: 0, other_minor: 0,
    subtotal_minor: 0, vat_mode: 'included' as const, vat_rate_bp: 1800, vat_minor: 0, net_minor: 0, total_minor: 40000, currency: 'ILS', created_at: '2026-10-17T08:00:00Z',
    documents: [], basis: { basis: 'instalment' as const, instalment_index: 0, basis_minor: 38940, above_reason: 'עבודה נוספת' },
  };
  const { ext } = host({ status: 'rejected', prefill: { ...PREFILL, instalment: 1 }, revisions: [rev] });
  const b = body();
  ext.payload(b);
  expect(b.instalment_index).toBe(0); // his own choice wins over the manager's open demand
});

test('the chunk is lazy, its text is complete in he / en / ar / ru, and it carries no bank field', () => {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/public-ticket/claim');
  const step = readFileSync(path.join(dir, 'claim-step.ts'), 'utf8');
  expect(step).toMatch(/import type \{ PrefillExt \} from '\.\/claim-prefill'/);
  expect(step).not.toMatch(/^import \{[^}]*\} from '\.\/claim-prefill'/m);
  expect(step).toMatch(/import\('\.\/claim-prefill'\)/);
  const src = readFileSync(path.join(dir, 'claim-prefill.ts'), 'utf8');
  for (const lang of ['he', 'en', 'ar', 'ru']) expect(src).toMatch(new RegExp(`\\n  ${lang}: \\{\\n(    [a-z_]+: '[^']+',\\n){9}  \\}`));
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // the doc comment says "no bank data" - the code holds none
  expect(code).not.toMatch(/iban|bank|account|swift|branch/i);
});
