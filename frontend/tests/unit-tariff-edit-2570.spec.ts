import { test, expect } from '@playwright/test';
import { decimalKey, tariffEditPlan, versionInForce } from '../src/electricity/tariff-edit';
import { mockBackend } from '../src/api/electricity-billing-mock';
import type { Tariff, TariffVersion } from '../src/api/electricity-billing';

// FIX-UTIL-A-2570 (review CU2-08): saving the dialog of an existing electricity tariff. A rename alone is a rename - never a price version
// dated today (which split every later bill period); an unchanged form writes nothing; prices compare as decimal text, never as floats.
const v = (id: string, from: string, price: string, mode: 'ex_vat' | 'inc_vat' = 'ex_vat'): TariffVersion => ({ id, effective_from: from, price, price_mode: mode });
const tariff = (versions: TariffVersion[], name = 'תעריף כללי'): Tariff => ({ id: 't1', name, currency: 'ILS', kind: 'fixed', used_by: 1, versions, current: versions[0] ?? null });
const T = tariff([v('v2', '2026-07-01', '0.5430'), v('v1', '2026-01-01', '0.5000')]);

test.describe('tariff edit plan', () => {
  test('a rename alone is a rename, an unchanged form is nothing', () => {
    expect(tariffEditPlan(T, { name: 'תעריף א', price: '0.5430', mode: 'ex_vat', from: '2026-11-28' }, null, null)).toBe('rename');
    expect(tariffEditPlan(T, { name: ' תעריף כללי ', price: '0.543', mode: 'ex_vat', from: '2026-11-28' }, null, null)).toBe('nothing');
  });

  test('a new price, mode or (for a corrected version) date is a version', () => {
    expect(tariffEditPlan(T, { name: 'תעריף כללי', price: '0.5500', mode: 'ex_vat', from: '2026-11-28' }, null, null)).toBe('version');
    expect(tariffEditPlan(T, { name: 'תעריף כללי', price: '0.5430', mode: 'inc_vat', from: '2026-11-28' }, null, null)).toBe('version');
    expect(tariffEditPlan(T, { name: 'שם', price: '0.5000', mode: 'ex_vat', from: '2026-02-01' }, T.versions[1], null)).toBe('version');
    expect(tariffEditPlan(T, { name: 'שם', price: '0.5000', mode: 'ex_vat', from: '2026-01-01' }, T.versions[1], null)).toBe('rename');
  });

  test('the version compared is the one in force on the chosen date', () => {
    expect(versionInForce(T, '2026-03-01')?.id).toBe('v1');
    expect(versionInForce(T, '2026-07-01')?.id).toBe('v2');
    // 0.5000 on 1.3 is the price already in force then: not a new version
    expect(tariffEditPlan(T, { name: 'תעריף כללי', price: '0.5', mode: 'ex_vat', from: '2026-03-01' }, null, null)).toBe('nothing');
  });

  test('prices compare as decimal text', () => {
    expect(decimalKey('0.5430')).toBe('0.543');
    expect(decimalKey('00.50')).toBe('0.5');
    expect(decimalKey('1.000')).toBe('1');
    expect(decimalKey('0.1000000000000000055')).not.toBe(decimalKey('0.1'));
  });
});

test.describe('mock backend follows the server rule', () => {
  test('rename keeps the versions; the same price is nothing_changed', async () => {
    const before = (await mockBackend.listTariffs())[0];
    const renamed = await mockBackend.renameTariff(before.id, 'שם חדש');
    expect(renamed.name).toBe('שם חדש');
    expect(renamed.versions.length).toBe(before.versions.length);
    const cur = renamed.current!;
    await expect(
      mockBackend.correctTariffVersion(before.id, { name: 'שם חדש', price: cur.price ?? '', price_mode: cur.price_mode, effective_from: '2099-01-01' }, { replaceId: null, base: null, confirm: false }),
    ).rejects.toMatchObject({ body: { code: 'nothing_changed' } });
    await mockBackend.renameTariff(before.id, before.name); // the mock is shared module state: put the name back
  });
});
