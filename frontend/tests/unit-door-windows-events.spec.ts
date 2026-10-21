import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import {
  AUTOMATION_RE, STORM_PER_HOUR, armView, canReset, emptyEventDraft, eventBodyOf, eventDraftOf, eventProblem, eventRules, hourChoices, holidayMonths, kindChoices,
  limitsOf, openableDoors, plannedEnd, reasonKey, refusalReason, triggerFacts, validDay,
} from '../src/door-windows/events-logic';
import { DWE_KEYS, DWE_TABLES, dwe, dweDynamic } from '../src/i18n/door-windows-events';
import type { DoorRow, HolidayRow, Rule, RuleTrigger } from '../src/api/door-windows';

// DOORWIN3-295: the pure logic and the words of the event-rule editor, the holiday list and "open for N hours". Runs in Node (no page):
//   npx playwright test -c playwright.unit.config.ts tests/unit-door-windows-events.spec.ts

const lim = limitsOf({ max_hours: '4', max_per_day_per_door: '3', quiet_from: '22:00', quiet_to: '06:00' });
const door = (key: string, over: Partial<DoorRow> = {}): DoorRow => ({ key, station_id: key.split(':')[0], relay: 1, label: key, station_name: 's', name: 'n', zone: 'Asia/Jerusalem',
                                                                         manage: true, cancel: true, exterior: false, ...over });
const trig = (over: Partial<RuleTrigger> = {}): RuleTrigger => ({ source: 'ha_event', duration_s: 3600, automation_id: null, allowed_from: '08:00', allowed_to: '18:00', max_per_day: 2,
                                                                  cooldown_s: 900, arm_state: 'simulate', has_token: true, token_set_at: null, can_arm: false, ...over });

test('limits come from the state settings, with the server defaults', () => {
  expect(lim).toEqual({ maxHours: 4, maxPerDay: 3, quiet: ['22:00', '06:00'] });
  expect(limitsOf({})).toEqual({ maxHours: 4, maxPerDay: 3, quiet: ['22:00', '06:00'] });
  expect(STORM_PER_HOUR).toBe(20);
});

test('event draft: client checks mirror validate_trigger', () => {
  const d = emptyEventDraft();
  expect(eventProblem(d, lim)).toEqual({ scope: 'dwt', key: 'errName' });
  d.name = 'כפתור כניסה';
  expect(eventProblem(d, lim)).toEqual({ scope: 'dwt', key: 'errDoors' });
  d.doors.add('st:with:colons:2');
  expect(eventProblem(d, lim)).toBeNull();
  d.durationMin = '300';
  expect(eventProblem(d, lim)).toEqual({ scope: 'dwe', key: 'errDuration', vars: { h: 4 } });
  d.durationMin = '0';
  expect(eventProblem(d, lim)?.key).toBe('errDuration');
  d.durationMin = '240';
  expect(eventProblem(d, lim)).toBeNull();
  d.maxPerDay = '4';
  expect(eventProblem(d, lim)).toEqual({ scope: 'dwe', key: 'errCap', vars: { n: 3 } });
  d.maxPerDay = '2';
  d.cooldownMin = '1441';
  expect(eventProblem(d, lim)?.key).toBe('errCooldown');
  d.cooldownMin = '0';
  d.limitHours = true;
  d.from = '18:00';
  d.to = '09:00';
  expect(eventProblem(d, lim)?.key).toBe('errAllowed');
  d.from = '20:00';
  d.to = '23:00'; // touches the quiet hours 22:00-06:00
  expect(eventProblem(d, lim)?.key).toBe('errQuiet');
  d.from = '08:00';
  d.to = '18:00';
  expect(eventProblem(d, lim)).toBeNull();
  d.source = 'arx_automation';
  expect(eventProblem(d, lim)?.key).toBe('errAutomation');
  d.automationId = ' automation.entrance_button ';
  expect(eventProblem(d, lim)).toBeNull();
  expect(AUTOMATION_RE.test('automation.Bad Name')).toBe(false);
});

test('event draft: the body is what the server expects (minutes to seconds, no periods, token only when asked)', () => {
  const d = emptyEventDraft();
  d.name = '  כפתור  ';
  d.doors.add('st:with:colons:2');
  d.durationMin = '90';
  d.maxPerDay = '2';
  d.cooldownMin = '10';
  let b = eventBodyOf(d, true);
  expect(b).toMatchObject({ name: 'כפתור', kind: 'event', periods: [], enable: true, doors: [{ station_id: 'st:with:colons', relay: 2 }] });
  expect(b.trigger).toEqual({ source: 'ha_event', duration_s: 5400, allowed_from: null, allowed_to: null, max_per_day: 2, cooldown_s: 600, automation_id: null });
  expect(b).not.toHaveProperty('revision');
  d.id = 'r1';
  d.revision = 4;
  d.regenerate = true;
  d.limitHours = true;
  b = eventBodyOf(d, false);
  expect(b.revision).toBe(4);
  expect(b.trigger).toMatchObject({ allowed_from: '08:00', allowed_to: '18:00', regenerate_token: true });
  d.source = 'arx_automation';
  d.automationId = 'automation.door';
  expect(eventBodyOf(d, false).trigger).toMatchObject({ source: 'arx_automation', automation_id: 'automation.door' });
  expect(eventBodyOf(d, false).trigger).not.toHaveProperty('regenerate_token');
});

test('a saved event rule round-trips through the editor', () => {
  const rule: Rule = { id: 'r1', name: 'x', kind: 'event', state: 'enabled', calendar_policy: 'skip_holidays', notes: '', revision: 3, updated_at: null, approved: true,
                       doors: [{ station_id: 'a', relay: 1, key: 'a:1', label: 'a', visible: true }], periods: [], trigger: trig({ source: 'arx_automation', automation_id: 'automation.x' }) };
  const d = eventDraftOf(rule);
  expect(d).toMatchObject({ id: 'r1', revision: 3, source: 'arx_automation', durationMin: '60', limitHours: true, from: '08:00', to: '18:00', maxPerDay: '2', cooldownMin: '15', automationId: 'automation.x' });
  expect([...d.doors]).toEqual(['a:1']);
  expect(eventRules([rule, { ...rule, id: 'w', kind: 'weekly' }, { ...rule, id: 'n', trigger: undefined }]).map((r) => r.id)).toEqual(['r1']);
  expect(triggerFacts(rule.trigger!).map((f) => f.key)).toEqual(['capLength', 'capHours', 'capDay', 'capCooldown']);
});

test('simulate vs armed: a rule is simulated, and today nothing offers arming', () => {
  // the contract reports no automation actor: no arm action, a plain "not available" chip
  expect(armView(trig(), true, false)).toEqual({ state: 'arm_simulate', tone: 'warn', unavailable: true, action: null });
  expect(armView(trig({ can_arm: false }), true, undefined)).toMatchObject({ unavailable: true, action: null });
  // the day the server says it can: the action appears, only for a manager
  expect(armView(trig({ can_arm: true }), true, true)).toMatchObject({ unavailable: false, action: 'arm' });
  expect(armView(trig({ can_arm: true }), false, true)).toMatchObject({ unavailable: false, action: null });
  // armed: disarm is always possible for a manager
  expect(armView(trig({ arm_state: 'armed', can_arm: false }), true, false)).toEqual({ state: 'arm_armed', tone: 'ok', unavailable: false, action: 'disarm' });
});

test('trigger log reasons map to words, unknown codes fall back', () => {
  expect(reasonKey('storm')).toBe('reason_storm');
  expect(reasonKey(null)).toBe('reason_other');
  for (const code of ['storm', 'exterior_not_allowed', 'closed_day', 'outside_hours', 'too_long', 'crosses_midnight', 'ambiguous_time', 'quiet_hours', 'relock_unconfirmed', 'emergency',
                      'paused', 'inside_window', 'overlaps_window', 'already_covered', 'would_extend_running', 'extended_already', 'would_extend', 'daily_cap', 'rule_daily_cap', 'cooldown',
                      'unknown_rule', 'bad_token', 'item_changed', 'authorising_actor_lost', 'already_handled']) {
    expect(DWE_KEYS, code).toContain(reasonKey(code));
  }
  expect(dweDynamic('reason_nonsense', 'reason_other', undefined)).toBe(dwe('reason_other'));
});

const row = (date: string, over: Partial<HolidayRow> = {}): HolidayRow => ({ date, kind: 'holiday', name_he: 'חג', source: 'generated', generated_kind: null, ...over });

test('holiday list: grouped by month, the past drops out, manual rows can be reset', () => {
  const months = holidayMonths([row('2026-12-14'), row('2026-11-02'), row('2026-10-01'), row('2026-11-30')], '2026-11-01');
  expect(months.map((m) => [m.month, m.rows.map((r) => r.date)])).toEqual([['2026-11', ['2026-11-02', '2026-11-30']], ['2026-12', ['2026-12-14']]]);
  expect(canReset(row('2026-11-02'))).toBe(false);
  expect(canReset(row('2026-11-02', { source: 'manual', kind: 'regular', generated_kind: 'holiday' }))).toBe(true);
  expect(kindChoices(row('2026-11-02'))).toContain('regular'); // a generated day can be cancelled
  expect(kindChoices(null)).not.toContain('regular'); // a new day is a holiday, an eve or closed
  expect(validDay('2026-02-30')).toBe(false);
  expect(validDay('2026-11-09')).toBe(true);
});

test('open for N hours: choices are whole hours up to the limit; only managed, non-exterior doors; off when the switch is off', () => {
  expect(hourChoices(4)).toEqual([1, 2, 3, 4]);
  expect(hourChoices(0)).toEqual([1]);
  expect(hourChoices(99)).toHaveLength(12);
  const st = { enabled: true, settings: { exterior_allowed: 'false' }, doors: [door('a:1'), door('b:1', { exterior: true }), door('c:1', { manage: false })] };
  expect(openableDoors(st).map((d) => d.key)).toEqual(['a:1']);
  expect(openableDoors({ ...st, settings: { exterior_allowed: 'true' } }).map((d) => d.key)).toEqual(['a:1', 'b:1']);
  expect(openableDoors({ ...st, enabled: false })).toEqual([]);
  expect(plannedEnd('2026-11-02T07:10:20Z', 2)).toBe('2026-11-02T09:11:00.000Z');
  expect(refusalReason({ body: { details: { reason: 'closed_day' } } })).toBe('closed_day');
  expect(refusalReason(new Error('x'))).toBeNull();
});

test('the words: every key in all four languages, placeholders kept, no platform name, no ticket action, no hint paragraph', () => {
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  for (const lang of ['en', 'ar', 'ru'] as const) {
    expect(Object.keys(DWE_TABLES[lang]).sort()).toEqual([...DWE_KEYS].sort());
    for (const k of DWE_KEYS) {
      expect(DWE_TABLES[lang][k].trim().length, `${lang}.${k}`).toBeGreaterThan(0);
      expect(holes(DWE_TABLES[lang][k]), `${lang}.${k}`).toBe(holes(DWE_TABLES.he[k]));
    }
  }
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of DWE_KEYS) {
      expect(DWE_TABLES[lang][k].toLowerCase(), `${lang}.${k}`).not.toMatch(/wiskey|home assistant|\bha\b|ingress|hikvision|supervisor|add-on|ticket|service request|קריאת שירות|פנייה|интерком|домофон/);
    }
  }
  expect(dwe('capStorm', { n: 20 }, 'en')).toBe('Storm cap: 20 per hour');
});

test('the three parts: no platform name or ticket action in the code, 44px on phone only, gated on the state permissions', () => {
  const src = ['event-rules', 'holidays', 'open-for', 'events-styles', 'events-logic'].map((f) => readFileSync(`src/door-windows/${f}.ts`, 'utf-8')).join('\n');
  expect(src).not.toMatch(/home assistant|ticket|service.request/i);
  expect(readFileSync('src/door-windows/events-styles.ts', 'utf-8')).toMatch(/@media \(max-width: 767px\) and \(pointer: coarse\)[^}]*\n?[^}]*44px/);
  const events = readFileSync('src/door-windows/event-rules.ts', 'utf-8');
  expect(events).toContain('d.can.manage'); // the new-rule button
  expect(events).toContain('r.manageable'); // the edit / arm / token actions
  const screen = readFileSync('src/screens/door-windows.ts', 'utf-8');
  expect(screen).toContain('openableDoors(d).length'); // the header "open for" button needs a manageable door
  expect(screen).toContain('.canManage=${d.can.manage}');
  expect(screen).toContain('.canConfigure=${d.can.configure}');
});
