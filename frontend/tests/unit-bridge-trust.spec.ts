import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RotationRow, TrustView } from '../src/api/bridge-trust';
import {
  bridgeLine, canCheck, codeText, openKind, openText, rotateBlockedText, rowLine, seenLine, shortId, stateLabel, stateTone, versionAtLeast,
} from '../src/access-control/bridge-trust-logic';
import { BRIDGE_TRUST_HE, tt } from '../src/i18n/bridge-trust';

// CR-040 (WXROT): the pure logic of the segment "מפתח הגשר" (no browser page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-bridge-trust.spec.ts
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

const row = (over: Partial<RotationRow> = {}): RotationRow => ({
  request_id: '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b', initiator: 'יוני', epoch_from: 2, epoch_to: 3, state: 'rotated', code: 'rotated',
  requested_at: '2026-10-13T09:30:00Z', resolved_at: '2026-10-13T09:30:01Z', status_checks: 0, ...over,
});

const view = (over: Partial<TrustView> = {}, bridge: Partial<TrustView['bridge']> = {}): TrustView => ({
  epoch: 3,
  bridge: { paired: true, version: '0.9.1', required: '0.9.1', supported: true, epoch_seen: 3, seen_at: '2026-10-13T09:29:00Z', ...bridge },
  open: null, history: [], can_rotate: true, blocked: null, ...over,
});

test('every state has a label and a tone; unknown and in flight are not success', () => {
  expect(stateLabel('rotated')).toBe('הוחלף');
  expect(stateLabel('not_rotated')).toBe('לא הוחלף');
  expect(stateLabel('unknown')).toBe('לא ידוע');
  expect(stateLabel('dispatching')).toBe('בתהליך');
  expect(stateLabel('superseded')).toBe('הוחלף בצימוד מחדש');
  expect([stateTone('rotated'), stateTone('unknown'), stateTone('dispatching'), stateTone('not_rotated'), stateTone('superseded')]).toEqual(['ok', 'warn', 'warn', 'err', 'muted']);
});

test('codes in words: a known refusal names its reason, others a general one, nothing raw', () => {
  expect(codeText('rotated')).toBe('הגשר אישר');
  expect(codeText('status_applied')).toBe('בדיקת המצב אישרה');
  expect(codeText('refused:state/epoch_mismatch')).toBe('הגשר בדור אחר');
  expect(codeText('refused:state/storage_unavailable')).toBe('הגשר לא הצליח לשמור');
  expect(codeText('refused:signature/bad_signature')).toBe('הגשר דחה');
  expect(codeText('status_refused:time/expired')).toBe('הגשר דחה את בדיקת המצב');
  expect(codeText('neither_key')).toBe('הגשר אינו מקבל אף מפתח');
  expect(codeText('fenced')).toBe('בדיקת המצב: לא הוחל');
  expect(codeText('something_new')).toBe('תשובה לא תקינה');
  expect(codeText(null)).toBe('');
  // every closed code of the server has its own words (services/bridge_trust.py)
  for (const c of ['not_sent', 'bridge_outdated', 'ha_forbidden', 'reverted_on_bridge', 'transport', 'bridge_error', 'invalid_response', 'interrupted',
    'status_unreachable', 'status_transport', 'inconsistent', 'repaired']) {
    expect(`c_${c}` in BRIDGE_TRUST_HE, c).toBe(true);
  }
});

test('a row: when, who, from which generation to which; the reference is short', () => {
  expect(rowLine(row(), () => '13.10.2026, 12:30')).toBe('13.10.2026, 12:30 · יוני · מדור 2 לדור 3');
  expect(shortId(row().request_id)).toBe('3f2b8c1e');
});

test('versions compare by number', () => {
  expect(versionAtLeast('0.8.1', '0.8.1')).toBe(true);
  expect(versionAtLeast('0.8.10', '0.8.9')).toBe(true);
  expect(versionAtLeast('0.9', '0.8.1')).toBe(true);
  expect(versionAtLeast('0.8.0', '0.8.1')).toBe(false);
  expect(versionAtLeast(null, '0.8.1')).toBe(false);
});

test('the bridge line says what is missing', () => {
  expect(bridgeLine(view())).toEqual({ tone: 'ok', text: 'גרסה 0.9.1 · תומך בהחלפת מפתח' });
  expect(bridgeLine(view({}, { supported: false, version: '0.9.0' }))).toEqual({ tone: 'warn', text: 'מותקנת גרסה 0.9.0; נדרשת 0.9.1 לפחות' });
  expect(bridgeLine(view({}, { supported: false, version: '0.9.1' }))).toEqual({ tone: 'warn', text: 'הגשר עוד לא דיווח שהוא תומך בהחלפת מפתח' });
  expect(bridgeLine(view({}, { supported: false, version: null })).text).toBe('נדרש עדכון של רכיב החיבור לגרסה 0.9.1 לפחות');
  expect(bridgeLine(view({}, { paired: false })).tone).toBe('err');
  expect(bridgeLine(view({ blocked: 'ha_not_configured', can_rotate: false })).text).toBe('אין גישה לתשתית המערכת');
});

test('the confirmation by the bridge: none yet, the same generation, another one', () => {
  expect(seenLine(view({}, { epoch_seen: null }), () => 'x')).toEqual({ tone: 'muted', text: 'עוד לא התקבל דיווח מהגשר' });
  expect(seenLine(view(), () => 'עכשיו')).toEqual({ tone: 'ok', text: 'דור 3 · עכשיו' });
  expect(seenLine(view({}, { epoch_seen: 2 }), () => 'x')).toEqual({ tone: 'warn', text: 'הגשר דיווח על דור 2' });
});

test('the open request: in flight, unknown (checkable), neither key (re-pair); nothing open', () => {
  expect(openKind(null)).toBeNull();
  expect(openKind(row({ state: 'dispatching', code: null }))).toBe('running');
  expect(openKind(row({ state: 'unknown', code: 'transport' }))).toBe('unknown');
  expect(openKind(row({ state: 'unknown', code: 'neither_key' }))).toBe('neither');
  expect(canCheck(row({ state: 'unknown', code: 'transport' }))).toBe(true);
  expect(canCheck(row({ state: 'dispatching', code: null }))).toBe(false);
  expect(canCheck(row({ state: 'unknown', code: 'neither_key' }))).toBe(false);
  expect(canCheck(null)).toBe(false);
  expect(openText('neither')).toContain('צימוד מחדש');
  expect(openText('unknown')).toContain('לא תישלח שוב');
});

test('why the rotate button is off', () => {
  expect(rotateBlockedText(view())).toBeNull();
  expect(rotateBlockedText(view({ can_rotate: false, blocked: 'in_progress' }))).toBe('החלפה פתוחה מחכה לבירור');
  expect(rotateBlockedText(view({ can_rotate: false, blocked: 'not_paired' }))).toBe('הגשר לא צומד עדיין');
  expect(rotateBlockedText(view({ can_rotate: false, blocked: 'unsupported' }, { supported: false, version: '0.9.0' }))).toBe('מותקנת גרסה 0.9.0; נדרשת 0.9.1 לפחות');
});

test('placeholders are filled and the confirmation states the switch, the pause and the UNKNOWN rule', () => {
  expect(tt('confirmSwitch', { next: 4 })).toContain('לדור 4');
  expect(tt('confirmSwitch', { next: 4 })).toContain('בבת אחת');
  expect(tt('confirmPause')).toContain('לא תישלח שוב');
  expect(tt('confirmUnknown')).toContain('לא ידוע');
  for (const [k, v] of Object.entries(BRIDGE_TRUST_HE)) {
    for (const word of ['Home Assistant', 'HA ', 'Ingress', 'salt', 'nonce']) expect(v, `${k}: ${word}`).not.toContain(word);
  }
});

test('the segment is wired: only --sw-* tokens, the page offers it for the permission, the nav opens for it', () => {
  const seg = readFileSync(path.join(SRC, 'screens', 'system-access-trust.ts'), 'utf8');
  expect(seg).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  expect(seg).not.toMatch(/font-size:\s*[0-9.]+px/);
  expect(seg.match(/var\(--([a-z0-9-]+)/g)?.every((v) => v.startsWith('var(--sw-') || v.startsWith('var(--_t'))).toBe(true);
  const page = readFileSync(path.join(SRC, 'screens', 'system-access-control.ts'), 'utf8');
  expect(page).toContain("this.trust = !isApi() || can('access.trust.rotate');");
  expect(page).toContain("if (isApi() && !this.admin && !this.trust)");
  const nav = readFileSync(path.join(SRC, 'shell', 'nav.ts'), 'utf8');
  expect(nav).toContain("[ACCESS_CONTROL_SETTINGS_HREF]: ['access.admin.read', 'access.trust.rotate']");
});

test('the settings index offers each access-control sub-entry to whoever may use it', async () => {
  const { visibleGroups } = await import('../src/screens/system-index');
  const hrefs = (anywhere: string[], installation: string[] = anywhere) =>
    visibleGroups(true, (p, installationOnly) => (installationOnly ? installation : anywhere).includes(p)).flatMap((g) => g.entries).map((e) => e.href);
  const keyholder = hrefs(['access.trust.rotate']);
  expect(keyholder).toContain('#/system/access-control');
  expect(keyholder).toContain('#/system/access-control/trust');
  for (const sub of ['audit', 'groups', 'policy', 'messaging']) expect(keyholder, sub).not.toContain(`#/system/access-control/${sub}`);
  const acAdmin = hrefs(['access.admin.read']);
  expect(acAdmin).toContain('#/system/access-control/audit');
  expect(acAdmin).not.toContain('#/system/access-control/trust');
  expect(hrefs(['access.trust.rotate'], [])).not.toContain('#/system/access-control/trust'); // held below installation scope only
  expect(visibleGroups(false).flatMap((g) => g.entries).map((e) => e.href)).toContain('#/system/access-control/trust'); // the static preview
});

test('the settings index lists the segment and its search finds it', async () => {
  const { SETTINGS_GROUPS, searchSettings, visibleGroups } = await import('../src/screens/system-index');
  const entry = SETTINGS_GROUPS.flatMap((g) => g.entries).find((e) => e.href === '#/system/access-control/trust');
  expect(entry?.label).toBe('מפתח הגשר');
  expect(entry?.sub).toBe(true);
  expect(searchSettings(visibleGroups(false), 'החלפת מפתח')[0]?.entry.href).toBe('#/system/access-control/trust');
});
