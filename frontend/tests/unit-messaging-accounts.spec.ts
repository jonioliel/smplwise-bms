import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WhatsappView } from '../src/api/messaging-accounts';
import {
  accountWarnings, draftFrom, isDirty, manualProblem, newManualKey, pacingProblem, toPutBody, useOptions, useWarnings, usesOf, usesText, warningText,
} from '../src/messaging/accounts-model';
import { WA_TEXT_KEYS, wt } from '../src/i18n/messaging-accounts';
import { AREA_TABS, INSTALLATION_ONLY_HREFS, TAB_PERMISSIONS, tabAllowed } from '../src/shell/nav';

// CR-038 slice 5a: the pure model of Settings › ערוץ ההודעות (src/messaging/accounts-model.ts), its text catalogue and the shell entries.
//   npx playwright test -c playwright.unit.config.ts tests/unit-messaging-accounts.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const PACE = { min_gap_s: 15, jitter_s: 10, per_hour: 30, per_day: 150, per_recipient_hour: 4, hold_when_down_min: 15 };
const RANGES = { min_gap_s: [5, 600], jitter_s: [0, 300], per_hour: [1, 200], per_day: [1, 1000], per_recipient_hour: [1, 30], hold_when_down_min: [1, 240] } as WhatsappView['pacing_ranges'];

function view(): WhatsappView {
  return {
    revision: 4, can_manage: true, ws_connected: true,
    accounts: [
      { key: 'entry:01JA', kind: 'discovered', label: 'משרד', label_set: true, last4: '0191', state: 'connected', state_source: 'entity', in_mirror: true, stored: true, shared_outside: false, removed: false, pacing: { ...PACE }, uses: ['tickets.messages'], sends_24h: 3, last_send_at: null, has_status_entity: true },
      { key: 'entry:01JB', kind: 'discovered', label: 'וואטסאפ 01JB', label_set: false, last4: null, state: 'disconnected', state_source: 'entity', in_mirror: true, stored: false, shared_outside: false, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: true },
      { key: 'manual:abcd1234', kind: 'manual', label: 'ישן', label_set: true, last4: '0097', state: 'unknown', state_source: 'sends', in_mirror: false, stored: true, shared_outside: true, removed: false, pacing: { ...PACE }, uses: [], sends_24h: 0, last_send_at: null, has_status_entity: false, account: '15555550097', status_entity_id: null },
    ],
    uses: [
      { key: 'tickets.messages', module: 'tickets', label: 'הודעות פניות', inherits: null, inherits_label: null, per_department: true, required: true, value: 'entry:01JA', resolved: 'entry:01JA', queued: 0,
        departments: [{ id: 'd1', name: 'אחזקה', value: null, resolved: 'entry:01JA' }] },
      { key: 'tickets.codes', module: 'tickets', label: 'קודי אימות לפניות', inherits: 'tickets.messages', inherits_label: 'הודעות פניות', per_department: false, required: false, value: null, resolved: 'entry:01JA', queued: 0 },
    ],
    mapping: { 'tickets.messages': 'entry:01JA', 'tickets.codes': null },
    warnings: [
      { code: 'shared_outside', use: 'tickets.messages', department_id: 'd1', account_key: 'manual:abcd1234', severity: 'amber' },
      { code: 'shared_module', use: 'tickets.messages', department_id: null, account_key: 'entry:01JA', module: 'access', severity: 'amber' },
      { code: 'account_down', use: 'tickets.codes', department_id: null, account_key: 'entry:01JB', state: 'missing', severity: 'red' },
    ],
    channels: [{ key: 'whatsapp', state: 'active' }, { key: 'email', state: 'not_configured' }, { key: 'inapp', state: 'active' }, { key: 'sms', state: 'soon' }],
    modules: { tickets: 'פניות', access: 'בקרת כניסה' },
    pacing_ranges: RANGES, pacing_default: { ...PACE }, test_send: { enabled: false },
  };
}

test('the draft round-trips: clean after load, dirty after an edit, the PUT body carries the revision and nulls', () => {
  const v = view();
  const d = draftFrom(v);
  expect(isDirty(v, d)).toBe(false);
  expect(d.accounts.find((a) => a.key === 'entry:01JB')?.label, 'a suggested label is not typed - it stays the suggestion').toBe('');
  d.uses = { ...d.uses, 'tickets.messages@dept:d1': 'entry:01JB' };
  expect(isDirty(v, d)).toBe(true);
  const body = toPutBody(v, d);
  expect(body.revision).toBe(4);
  expect(body.uses).toEqual({ 'tickets.messages': 'entry:01JA', 'tickets.codes': null, 'tickets.messages@dept:d1': 'entry:01JB' });
  expect(body.accounts.find((a) => a.key === 'manual:abcd1234')).toEqual({ key: 'manual:abcd1234', kind: 'manual', label: 'ישן', shared_outside: true, pacing: PACE, account: '15555550097', status_entity_id: null });
  expect(body.accounts.find((a) => a.key === 'entry:01JA')).not.toHaveProperty('account');
  expect(toPutBody(v, d, true).confirm_queued).toBe(true);
  expect('confirm_queued' in body).toBe(false);
  // a mapping that only adds an explicit null is not a change
  expect(isDirty(v, { ...draftFrom(v), uses: { ...v.mapping, 'tickets.messages@dept:d1': null } })).toBe(false);
});

test('the pickers: "כמו ..." for an inheriting use, "ברירת המחדל" for a department, "ללא" otherwise; discovered first, with digits and state', () => {
  const v = view();
  const d = draftFrom(v);
  const [msgs, codes] = v.uses;
  const o = useOptions(v, d, msgs);
  expect(o[0]).toEqual({ value: '', label: wt('none') });
  expect(o.map((x) => x.value)).toEqual(['', 'entry:01JA', 'entry:01JB', 'manual:abcd1234']);
  expect(o[1].label).toBe('משרד · ····0191');
  expect(o[2].label).toBe(`וואטסאפ 01JB · ${wt('st_disconnected')}`);
  expect(o[3].label).toBe(`ישן · ····0097 · ${wt('st_unknown')}`);
  expect(useOptions(v, d, codes)[0].label).toBe('כמו הודעות פניות');
  expect(useOptions(v, d, msgs, true)[0].label).toBe(wt('deptDefault'));
});

test('manual accounts: value rules, a discovered entry id is refused, fresh keys, removal blocked while mapped', () => {
  const v = view();
  const d = draftFrom(v);
  expect(manualProblem('15555550199', v)).toBeNull();
  expect(manualProblem('01JA', v)).toBe('manual_equals_discovered');
  expect(manualProblem('bad value!', v)).toBe('manual_value_invalid');
  expect(manualProblem('', v)).toBe('manual_value_invalid');
  let n = 0;
  const seq = [0, 0, 0, 0, 0, 0, 0, 0];
  const key = newManualKey({ ...d, accounts: [...d.accounts, { ...d.accounts[2], key: 'manual:aaaaaaaa' }] }, () => (n++ < 8 ? seq[n - 1] : 0.5));
  expect(key).toMatch(/^manual:[a-z0-9]{8}$/);
  expect(key).not.toBe('manual:aaaaaaaa');
  expect(usesOf(d, 'entry:01JA')).toEqual(['tickets.messages']);
  expect(usesOf(d, 'manual:abcd1234')).toEqual([]);
});

test('pacing problems mirror the server ranges', () => {
  const v = view();
  expect(pacingProblem(v, PACE)).toBeNull();
  expect(pacingProblem(v, { ...PACE, per_hour: 0 })).toEqual({ field: 'per_hour', code: 'pacing_out_of_range' });
  expect(pacingProblem(v, { ...PACE, per_day: 10, per_hour: 20 })).toEqual({ field: 'per_day', code: 'pacing_day_below_hour' });
  expect(pacingProblem(v, { ...PACE, min_gap_s: 1.5 })?.code).toBe('pacing_out_of_range');
});

test('warnings: per row, per account, in words, the module name as the server rendered it', () => {
  const v = view();
  expect(useWarnings(v, 'tickets.messages', null).map((w) => w.code)).toEqual(['shared_module']);
  expect(useWarnings(v, 'tickets.messages', 'd1').map((w) => w.code)).toEqual(['shared_outside']);
  expect(accountWarnings(v, 'entry:01JA').map((w) => w.code)).toEqual(['shared_module']);
  expect(warningText(v.warnings[1], v.modules)).toBe('המספר משותף גם לבקרת כניסה - קצב שליחה משותף');
  expect(warningText(v.warnings[2], v.modules)).toBe(wt('w_down_missing'));
  expect(warningText({ code: 'required_unmapped', severity: 'red' }, v.modules)).toBe('לא נבחר חשבון - הודעות לא יישלחו בוואטסאפ');
  expect(usesText(v, ['tickets.messages', 'tickets.messages@dept:d1'])).toBe('הודעות פניות, הודעות פניות · אחזקה');
});

test('the catalogue: every key has Hebrew text, no platform name, no default name of the tickets module (D33)', () => {
  for (const k of WA_TEXT_KEYS) expect(wt(k).length, k).toBeGreaterThan(0);
  const src = readFileSync(path.join(SRC, 'i18n/messaging-accounts.ts'), 'utf8') + readFileSync(path.join(SRC, 'screens/system-messaging-accounts.ts'), 'utf8')
    + readFileSync(path.join(SRC, 'messaging/accounts-model.ts'), 'utf8');
  const strings = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  expect(strings).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  expect(strings).not.toMatch(/קריא(ה|ות|ת)|בקש(ת|ות) שירות|ניהול השירות|[Tt]ickets?'/); // neither the old nor the 14.10 default name
});

test('the shell: one settings tab, both read permissions, installation scope only', () => {
  const tab = AREA_TABS.system.find((t) => t.id === 'messaging-accounts');
  expect(tab?.href).toBe('#/system/messaging-accounts');
  expect(TAB_PERMISSIONS['#/system/messaging-accounts']).toEqual(['system.configure', 'messaging.accounts.manage']);
  expect(INSTALLATION_ONLY_HREFS.has('#/system/messaging-accounts')).toBe(true);
  const holds = (set: string[]) => (p: string, inst?: boolean) => set.includes(p) && inst !== false;
  expect(tabAllowed('#/system/messaging-accounts', holds(['messaging.accounts.manage']))).toBe(true);
  expect(tabAllowed('#/system/messaging-accounts', holds(['system.configure']))).toBe(true);
  expect(tabAllowed('#/system/messaging-accounts', holds(['tickets.configure']))).toBe(false);
  const index = readFileSync(path.join(SRC, 'screens/system-index.ts'), 'utf8');
  expect(index).toContain("href: '#/system/messaging-accounts'");
  const app = readFileSync(path.join(SRC, 'shell/sw-app.ts'), 'utf8');
  expect(app).toContain("import '../screens/system-messaging-accounts'");
  expect(app).toContain("s[1] === 'messaging-accounts'");
});
