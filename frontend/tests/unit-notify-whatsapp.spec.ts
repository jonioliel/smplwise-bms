import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WaMine, WaNotifyView } from '../src/api/notify-whatsapp';
import { waLogic } from '../src/components/notify-whatsapp-logic';
import { NWT_KEYS, NWT_TABLES, nwt } from '../src/i18n/notify-whatsapp';

// NOTIFWA: the pure rules of the WhatsApp section of Settings › התראות, its four-language catalogue and the copy rules.
//   npx playwright test -c playwright.unit.config.ts tests/unit-notify-whatsapp.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

function view(over: Partial<WaNotifyView> = {}): WaNotifyView {
  return {
    enabled: false, per_user_hour: 4, dedupe_min: 30, budget_pct: 50, budget_critical_pct: 80, detail: 'type_place', detail_levels: ['generic', 'type_place'], normalized: [], revision: 0,
    ranges: { per_user_hour: [1, 30], dedupe_min: [5, 1440], budget_pct: [10, 90], budget_critical_pct: [10, 90] },
    account: { mapped: true, label: 'וואטסאפ ····0191', state: 'connected' }, reachable_users: 2, accounts_href: '#/system/messaging-accounts',
    test: { own_number: true, masked: '····0191' }, ...over,
  };
}

test.describe('notify-whatsapp section logic', () => {
  test('the cap stepper clamps to the server range', () => {
    expect(waLogic.stepCap(view(), 1)).toBe(5);
    expect(waLogic.stepCap(view({ per_user_hour: 1 }), -1)).toBe(1);
    expect(waLogic.stepCap(view({ per_user_hour: 30 }), 1)).toBe(30);
  });

  test('tone, warning and the test button', () => {
    expect(waLogic.tone(view())).toBe('off');
    expect(waLogic.tone(view({ enabled: true }))).toBe('ok');
    expect(waLogic.tone(view({ enabled: true, account: { mapped: true, label: 'x', state: 'disconnected' } }))).toBe('bad');
    expect(waLogic.tone(view({ enabled: true, account: { mapped: false, label: null, state: null } }))).toBe('bad');
    expect(waLogic.warning(view({ enabled: true, account: { mapped: false, label: null, state: null } }))).toBe('no_account');
    expect(waLogic.warning(view({ account: { mapped: false, label: null, state: null } }))).toBeNull(); // switched off: nothing to warn about
    expect(waLogic.canTest(view())).toBe(true);
    expect(waLogic.canTest(view({ test: { own_number: false, masked: null } }))).toBe(false);
    expect(waLogic.canTest(view({ account: { mapped: false, label: null, state: null } }))).toBe(false);
  });
});

test.describe('notify-whatsapp review fixes', () => {
  test('F3: the budget steppers clamp and keep critical >= normal', () => {
    expect(waLogic.stepPct(view(), 'budget_pct', 10)).toEqual({ budget_pct: 60, budget_critical_pct: 80 });
    expect(waLogic.stepPct(view({ budget_pct: 80 }), 'budget_pct', 10)).toEqual({ budget_pct: 90, budget_critical_pct: 90 });
    expect(waLogic.stepPct(view(), 'budget_critical_pct', -40)).toEqual({ budget_pct: 40, budget_critical_pct: 40 });
    expect(waLogic.stepPct(view({ budget_pct: 10, budget_critical_pct: 10 }), 'budget_pct', -10)).toEqual({ budget_pct: 10, budget_critical_pct: 10 });
    expect(waLogic.stepPct(view({ budget_critical_pct: 90 }), 'budget_critical_pct', 10).budget_critical_pct).toBe(90); // re-review R4: never above 90 %
    expect(waLogic.stepPct(view({ budget_pct: 90, budget_critical_pct: 90 }), 'budget_pct', 10)).toEqual({ budget_pct: 90, budget_critical_pct: 90 });
  });

  test('F1 / F2: the own row - hidden while off, a changed number asks for a new confirmation', () => {
    const m = (over: Partial<WaMine> = {}): WaMine => ({ channel_enabled: true, has_number: true, masked: '····0191', source: 'directory', opted_in: false, number_changed: false, directory_declined: false, consent: 'declined', confirm: 'abcdabcdabcdabcd', ...over });
    expect(waLogic.mineState(null)).toBe('hidden');
    expect(waLogic.mineState(m({ channel_enabled: false, opted_in: true }))).toBe('hidden');
    expect(waLogic.mineState(m({ has_number: false, masked: null }))).toBe('none');
    expect(waLogic.mineState(m())).toBe('off'); // the default is NOT opted in
    expect(waLogic.mineState(m({ opted_in: true, consent: 'granted' }))).toBe('on');
    expect(waLogic.mineState(m({ number_changed: true }))).toBe('changed');
    expect(waLogic.mineState(m({ directory_declined: true, opted_in: true }))).toBe('declined');
    expect(waLogic.canStop(m({ directory_declined: true, opted_in: true }))).toBe(true); // re-review R5: always withdrawable
    expect(waLogic.canStop(m())).toBe(false);
    expect(waLogic.canStop(m({ channel_enabled: false, opted_in: true }))).toBe(false);
  });
});

test.describe('notify-whatsapp texts', () => {
  test('every language has every key; placeholders survive', () => {
    for (const lang of ['en', 'ar', 'ru'] as const) {
      const missing = NWT_KEYS.filter((k) => !NWT_TABLES[lang][k]);
      expect(missing, lang).toEqual([]);
    }
    expect(nwt('testHint', { masked: '····0191' }, 'he')).toBe('נשלחת רק למספר שלך (····0191)');
    expect(nwt('testHint', { masked: '····91' }, 'ru')).toContain('····91');
    expect(nwt('title', undefined, 'ar')).toBe('واتساب');
  });

  test('copy rules: no platform name, never the forbidden Hebrew word, no number', () => {
    const he = NWT_KEYS.map((k) => nwt(k, undefined, 'he')).join(' ');
    expect(he).not.toMatch(/Home Assistant|\bHA\b|Ingress|Companion/);
    expect(he).not.toMatch(/קריאה|קריאות|קריאת/);
    for (const lang of ['he', 'en', 'ar', 'ru'] as const) expect(NWT_KEYS.map((k) => nwt(k, undefined, lang)).join(' ')).not.toMatch(/\d{6,}/);
  });

  test('the section is one separable element, placed by the settings screen', () => {
    const screen = readFileSync(path.join(SRC, 'screens/system-notifications.ts'), 'utf8');
    expect(screen).toContain('<notify-whatsapp-section');
    expect(screen).not.toContain('WhatsApp – בקרוב');
    expect(screen).toContain('<notify-whatsapp-mine>');
    const mine = readFileSync(path.join(SRC, 'components/notify-whatsapp-mine.ts'), 'utf8');
    expect(mine).not.toMatch(/var\(--dv-/);
    const section = readFileSync(path.join(SRC, 'components/notify-whatsapp-section.ts'), 'utf8');
    expect(section).not.toMatch(/var\(--dv-/); // only --sw-* tokens in the new element
    expect(section).not.toMatch(/unsafeHTML/);
  });
});
