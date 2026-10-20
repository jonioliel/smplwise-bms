import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VRT_KEYS, VRT_TABLES, vrt } from '../src/i18n/vendor-reports';
import { REPORTS_DEFAULTS, documentFieldsEnabled, limitedInt, numberPatch, reportsOf, subControlsEnabled } from '../src/tickets/reports-settings-model';

// VENDORQ2-295: Settings > the module > message channel > "Reports to vendors": the pure rules, the four-language catalogue and the copy rules.
//   npx playwright test -c playwright.unit.config.ts tests/unit-reports-settings.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

test.describe('reports settings model', () => {
  test('everything is off by default; an older server without the block shows nothing', () => {
    expect(REPORTS_DEFAULTS).toEqual({ to_contacts: false, email: false, documents: false, document_hours: 72, document_max_opens: 5 });
    expect(reportsOf(undefined)).toBeNull();
    expect(reportsOf(null)).toBeNull();
    expect(reportsOf({})).toEqual(REPORTS_DEFAULTS);
    expect(reportsOf({ to_contacts: true, email: 'yes' as never, document_hours: 3.5 as never })).toEqual({ ...REPORTS_DEFAULTS, to_contacts: true });
  });

  test('the number fields accept only whole numbers inside the server range', () => {
    expect(limitedInt('72', 'document_hours')).toBe(72);
    expect(limitedInt('1', 'document_hours')).toBe(1);
    expect(limitedInt('168', 'document_hours')).toBe(168);
    for (const bad of ['0', '169', '-1', '1.5', '', ' ', 'abc', '1e2', '00000']) expect(limitedInt(bad, 'document_hours'), bad).toBeNull();
    expect(limitedInt('20', 'document_max_opens')).toBe(20);
    expect(limitedInt('21', 'document_max_opens')).toBeNull();
  });

  test('a number patch is sent only when valid and changed', () => {
    const s = reportsOf({ to_contacts: true, documents: true })!;
    expect(numberPatch(s, 'document_hours', '48')).toEqual({ document_hours: 48 });
    expect(numberPatch(s, 'document_hours', '72')).toBeNull();
    expect(numberPatch(s, 'document_hours', '999')).toBeNull();
    expect(numberPatch(s, 'document_max_opens', '3')).toEqual({ document_max_opens: 3 });
  });

  test('the sub-switches and the link fields follow the master switch', () => {
    expect(subControlsEnabled(REPORTS_DEFAULTS)).toBe(false);
    expect(documentFieldsEnabled({ ...REPORTS_DEFAULTS, documents: true })).toBe(false);
    expect(documentFieldsEnabled({ ...REPORTS_DEFAULTS, to_contacts: true })).toBe(false);
    expect(documentFieldsEnabled({ ...REPORTS_DEFAULTS, to_contacts: true, documents: true })).toBe(true);
  });
});

test.describe('reports settings catalogue and copy rules', () => {
  test('he / en / ar / ru carry exactly the same keys, none empty', () => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
      expect(Object.keys(VRT_TABLES[lang]).sort(), lang).toEqual([...VRT_KEYS].sort());
      for (const k of VRT_KEYS) expect((VRT_TABLES[lang][k] ?? '').trim(), `${lang}.${k}`).not.toBe('');
    }
    expect(vrt('title', 'ar')).not.toBe(vrt('title', 'he'));
  });

  test('no platform branding and no hint paragraphs on the screen', () => {
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
      for (const k of VRT_KEYS) {
        const v = VRT_TABLES[lang][k] ?? '';
        expect(v, `${lang}.${k}`).not.toMatch(/home ?assistant|\bHA\b|ingress/i);
        expect(v.length, `${lang}.${k}`).toBeLessThanOrEqual(60); // labels and units only
      }
    }
    const src = readFileSync(path.join(SRC, 'tickets/reports-settings.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(src).not.toMatch(/class="muted">\$\{vrt\(['"](?!hoursUnit|opensUnit)/); // only the units use the muted style
    expect(src).not.toMatch(/(create|open|new)\w*ticket|service[- ]?request/i); // the card offers no ticket action (tickets-module-off rule)
  });

  test('the card is mounted inside the module settings only, behind the administrators tab', () => {
    const channel = readFileSync(path.join(SRC, 'tickets/settings-channel.ts'), 'utf8');
    expect(channel).toContain('<tickets-reports-settings>');
    const tabs = readFileSync(path.join(SRC, 'tickets/settings-tabs.ts'), 'utf8');
    expect(tabs).toMatch(/t === 'channel'[^?]*\? system/); // the channel tab needs system.configure
  });
});
