import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FleetStatus } from '../src/api/fleet-report';
import {
  FIELD_COUNT, FIELD_GROUPS, NEVER_SENT, answerOf, logLines, nextAttemptAt, readyTitle, shortCode, shortId, silentProblem, viewOf, whenInSentence, whenText,
} from '../src/fleet/fleet-model';
import { FLEET_TEXT_KEYS, ft } from '../src/i18n/fleet-report';
import { AREA_TABS, INSTALLATION_ONLY_HREFS, TAB_PERMISSIONS, tabAllowed } from '../src/shell/nav';

// CR-FLEET215: the pure model of Settings › דיווח בריאות (src/fleet/fleet-model.ts), its text catalogue, the 52 listed fields against the
// receiver's closed schema, and the shell entries.
//   npx playwright test -c playwright.unit.config.ts tests/unit-fleet-report.spec.ts
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '../src');
const NOW = new Date(2026, 9, 23, 14, 0, 0); // 23.10.2026 14:00 local

const iso = (d: Date) => d.toISOString();
const at = (day: number, h: number, m: number) => iso(new Date(2026, 9, day, h, m, 0));

function status(over: Partial<FleetStatus> = {}): FleetStatus {
  return {
    enabled: true, receiver_configured: true, receiver_problem: null, sending: true, installation_id: '8c41d2f09a6b4e1c93f57a20b6d1e07b', kid: '3f9a0c71be52d846',
    alg: 'Ed25519', last_seq: 412, last_attempt_at: at(23, 3, 12), last_result: 'ok', last_ok_at: at(23, 3, 12), schema: 'smplwise-fleet-report/1', period_h: 24, retry_h: 3,
    silent_after_h: 36, silent_range_h: [26, 168], silent_default_h: 36, stopped_at: null, stopped_result: null, ...over,
  };
}

test('the four pages: off, on, no address, failed', () => {
  expect(viewOf(status({ enabled: false }))).toBe('off');
  expect(viewOf(status())).toBe('on');
  expect(viewOf(status({ receiver_configured: false, receiver_problem: 'receiver_not_configured' }))).toBe('nourl');
  expect(viewOf(status({ last_result: 'unreachable' }))).toBe('failed');
  expect(viewOf(status({ last_result: 'rejected' }))).toBe('failed');
  expect(viewOf(status({ last_result: 'schema_refused' }))).toBe('failed');
  // off wins over everything; a missing address wins over an old failure
  expect(viewOf(status({ enabled: false, last_result: 'unreachable' }))).toBe('off');
  expect(viewOf(status({ receiver_configured: false, last_result: 'unreachable' }))).toBe('nourl');
});

test('the answer card says it in words, with one thing to do', () => {
  const on = answerOf(status(), NOW);
  expect(on).toMatchObject({ view: 'on', tone: 'ok', title: 'הדיווח פועל ותקין', doText: 'אין מה לעשות.', canSend: true });
  expect(on.sub).toBe('הדוח האחרון התקבל היום בשעה 03:12. הבא נשלח לבד מחר בשעה 03:12.');
  expect(on.lastLine).toBe('היום 03:12 · התקבל · דוח מספר 412');
  const off = answerOf(status({ enabled: false, last_ok_at: at(20, 3, 10) }), NOW);
  expect(off).toMatchObject({ view: 'off', tone: 'mute', title: 'הדיווח כבוי', canSend: false });
  expect(off.doText).toContain('הדליקו את המתג');
  expect(off.lastLine).toBe('הדוח האחרון נשלח לפני הכיבוי: 20.10 · 03:10');
  const nourl = answerOf(status({ receiver_configured: false, receiver_problem: 'receiver_not_configured', last_attempt_at: null, last_ok_at: null }), NOW);
  expect(nourl).toMatchObject({ view: 'nourl', tone: 'warn', canSend: false });
  expect(nourl.doText).toContain('המתקין');
  const bad = answerOf(status({ receiver_configured: false, receiver_problem: 'receiver_url_invalid' }), NOW);
  expect(bad.doText).toContain('אינה תקינה');
  const failed = answerOf(status({ last_result: 'unreachable', last_attempt_at: at(23, 12, 0), last_ok_at: at(22, 3, 11) }), NOW);
  expect(failed).toMatchObject({ view: 'failed', tone: 'bad', title: 'השליחה האחרונה נכשלה', canSend: true });
  expect(failed.sub).toBe('הדוח של היום בשעה 12:00 לא הגיע ל-SmplWise. המערכת תנסה שוב לבד היום בשעה 15:00.');
  const first = answerOf(status({ last_attempt_at: null, last_ok_at: null, last_seq: 0 }), NOW);
  expect(first).toMatchObject({ view: 'on', title: 'הדיווח פועל, מחכה לדוח הראשון', canSend: true });
});

test('time wording: today, yesterday, a date, and next attempt only in the future', () => {
  expect(whenText(at(23, 3, 12), NOW)).toBe('היום 03:12');
  expect(whenText(at(22, 3, 11), NOW)).toBe('אתמול 03:11');
  expect(whenText(at(21, 3, 11), NOW)).toBe('21.10 · 03:11');
  expect(whenText(iso(new Date(2025, 11, 30, 8, 5)), NOW)).toBe('30.12.2025 · 08:05');
  expect(whenText(null, NOW)).toBe('');
  expect(whenText('not a date', NOW)).toBe('');
  expect(whenInSentence(at(21, 3, 11), NOW)).toBe('ב-21.10 בשעה 03:11');
  expect(nextAttemptAt(status({ last_attempt_at: at(23, 3, 12) }), NOW)?.getTime()).toBe(new Date(2026, 9, 24, 3, 12).getTime());
  expect(nextAttemptAt(status({ last_attempt_at: at(21, 3, 12) }), NOW)).toBeNull(); // overdue -> "soon"
  expect(nextAttemptAt(status({ last_attempt_at: null }), NOW)).toBeNull();
});

test('the log lines: words and tones, the stop message is labelled', () => {
  const lines = logLines([
    { id: 3, seq: 413, kid: 'k', at: at(23, 3, 12), trigger: 'schedule', result: 'unreachable', http_status: null, payload: {} },
    { id: 2, seq: 412, kid: 'k', at: at(22, 3, 11), trigger: 'manual', result: 'ok', http_status: 202, payload: {} },
    { id: 1, seq: 414, kid: 'k', at: at(21, 3, 11), trigger: 'stop', result: 'ok', http_status: 202, payload: {} },
    { id: 0, seq: 5, kid: null, at: at(20, 3, 11), trigger: 'schedule', result: 'schema_refused', http_status: null, payload: null },
  ], NOW);
  expect(lines.map((l) => [l.when, l.text, l.tone, l.seq])).toEqual([
    ['היום 03:12', 'לא נשלח, אין חיבור', 'bad', '413'],
    ['אתמול 03:11', 'התקבל', 'ok', '412'],
    ['21.10 · 03:11', 'הודעת הפסקה · התקבל', 'ok', '414'],
    ['20.10 · 03:11', 'נעצר בבדיקה, לא נשלח', 'bad', '5'],
  ]);
});

test('readiness title and the silence threshold validation', () => {
  expect(readyTitle(0)).toBe('מוכנות ההתקנה: הכול מוכן');
  expect(readyTitle(1)).toBe('מוכנות ההתקנה: דבר אחד עוד חסר');
  expect(readyTitle(4)).toBe('מוכנות ההתקנה: 4 דברים עוד חסרים');
  expect(silentProblem('36', [26, 168])).toBeNull();
  expect(silentProblem('26', [26, 168])).toBeNull();
  expect(silentProblem('168', [26, 168])).toBeNull();
  for (const bad of ['25', '169', '', ' ', 'x', '36.5', '-3']) expect(silentProblem(bad, [26, 168]), bad).toBe('בין 26 ל-168 שעות');
});

test('short forms keep the full value out of the line', () => {
  expect(shortCode('arx-fleet-1.8c41d2f09a6b4e1c93f57a20b6d1e07b.3f9a0c71be52d846.AAAA')).toBe('arx-fleet-1.8c41d2f0…');
  expect(shortCode('short')).toBe('short');
  expect(shortId('8c41d2f09a6b4e1c93f57a20b6d1e07b')).toBe('8c41…e07b');
  expect(shortId(null)).toBe('');
});

/** every leaf path of the receiver's closed schema (services/fleet-receiver/src/schema.json, generated from the backend's SCHEMA_KEYS) */
function schemaLeaves(node: { type: string; keys?: Record<string, unknown> }, prefix = ''): string[] {
  if (node.type !== 'object') return [prefix];
  return Object.entries(node.keys ?? {}).flatMap(([k, v]) => schemaLeaves(v as { type: string; keys?: Record<string, unknown> }, prefix ? `${prefix}.${k}` : k));
}

test('the list shows exactly the 52 fields of the closed schema - no more, no fewer', () => {
  const schema = JSON.parse(readFileSync(path.resolve(HERE, '../../services/fleet-receiver/src/schema.json'), 'utf8'));
  const leaves = schemaLeaves(schema).sort();
  const listed = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f[1])).sort();
  expect(FIELD_COUNT).toBe(52);
  expect(listed).toEqual(leaves);
  expect(new Set(listed).size).toBe(listed.length);
  for (const g of FIELD_GROUPS) for (const [label] of g.fields) expect(label.length, g.id).toBeGreaterThan(0);
});

test('the never-sent list names what the CR promises is absent', () => {
  expect(NEVER_SENT.length).toBe(15);
  for (const w of ['סיסמאות ומפתחות', 'תמונות ווידאו', 'כתובות רשת', 'שמות אנשים']) expect(NEVER_SENT).toContain(w);
});

test('the catalogue: every key has Hebrew text, no platform product name, no English-only jargon in the plain wording', () => {
  for (const k of FLEET_TEXT_KEYS) expect(ft(k).length, k).toBeGreaterThan(0);
  const src = [
    readFileSync(path.join(SRC, 'i18n/fleet-report.ts'), 'utf8'), readFileSync(path.join(SRC, 'screens/system-fleet-report.ts'), 'utf8'),
    readFileSync(path.join(SRC, 'fleet/fleet-model.ts'), 'utf8'),
  ].join('\n');
  const strings = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  expect(strings).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  // the plain-Hebrew rule of the approved mock-up: no hash / schema / enrollment / epoch wording in the sentences a technician reads
  const he = FLEET_TEXT_KEYS.map((k) => ft(k)).join('\n');
  expect(he).not.toMatch(/hash|epoch|enroll|\bJSON\b|Ed25519/i);
  expect(he).toContain('לעולם לא');
});

test('the shell: one settings tab, system.configure only, installation scope only, wired into the app and the index', () => {
  const tab = AREA_TABS.system.find((t) => t.id === 'fleet-report');
  expect(tab?.href).toBe('#/system/fleet-report');
  expect(tab?.label).toBe('דיווח בריאות');
  expect(TAB_PERMISSIONS['#/system/fleet-report']).toEqual(['system.configure']);
  expect(INSTALLATION_ONLY_HREFS.has('#/system/fleet-report')).toBe(true);
  const holds = (set: string[]) => (p: string, inst?: boolean) => set.includes(p) && inst !== false;
  expect(tabAllowed('#/system/fleet-report', holds(['system.configure']))).toBe(true);
  expect(tabAllowed('#/system/fleet-report', holds(['messaging.accounts.manage', 'tickets.configure']))).toBe(false);
  expect(tabAllowed('#/system/fleet-report', holds([]))).toBe(false);
  const index = readFileSync(path.join(SRC, 'screens/system-index.ts'), 'utf8');
  expect(index).toContain("href: '#/system/fleet-report'");
  const app = readFileSync(path.join(SRC, 'shell/sw-app.ts'), 'utf8');
  expect(app).toContain("import '../screens/system-fleet-report'");
  expect(app).toContain("s[1] === 'fleet-report'");
});
