import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_BOUNDS, blankDraft, draftOf, effectiveLimit, limitProblem, parseWhole, placeholdersOk, ruleBody, ruleProblems, serverProblems, sourceLabel, stored,
  type RuleDraft, type RulesDoc, type TicketRuleView,
} from '../src/tickets/rules-model';
import { RULES_TEXT_EN, RULES_TEXT_HE } from '../src/tickets/rules-text';
import { SETTINGS_TABS, visibleTabs } from '../src/tickets/settings-tabs';

// TKRULES-291: the pure rules of Settings › service management › "פתיחה אוטומטית" (tickets opened from alerts). Node only.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-rules.spec.ts

const doc: Pick<RulesDoc, 'sources' | 'departments' | 'bounds'> = {
  sources: [{ key: 'sensor.leak', label: 'דליפת מים', category: 'safety', subject: 'entity' }],
  departments: [
    { id: 'd1', name: 'אחזקה', priorities: [{ id: 'p1', name: 'רגיל', is_default: true }], categories: [{ id: 'c1', name: 'אינסטלציה' }] },
    { id: 'd2', name: 'ניקיון', priorities: [{ id: 'p2', name: 'רגיל', is_default: true }], categories: [] },
  ],
  bounds: DEFAULT_BOUNDS,
};

const draft = (over: Partial<RuleDraft> = {}): RuleDraft => ({ ...blankDraft(doc.sources, doc.departments), name: 'דליפה', ...over });

const view = (over: Partial<TicketRuleView> = {}): TicketRuleView => ({
  id: 'r1', name: 'דליפה', enabled: true, source: 'sensor.leak', subject_id: '', hold_min: 5, department_id: 'd1', priority_id: null, category_id: null,
  title: '{alert}', description: '', on_clear: 'comment', daily_limit: null, effective_limit: 20, today_created: 0, limit_reached: false, suppressed_today: 0,
  last_fired_at: null, ...over,
});

test('a new rule starts valid apart from its name, with the first source and department and no limit override', () => {
  const d = blankDraft(doc.sources, doc.departments);
  expect(d.source).toBe('sensor.leak');
  expect(d.department_id).toBe('d1');
  expect(d.daily_limit).toBe('');
  expect(d.on_clear).toBe('comment');
  expect(ruleProblems(d, doc)).toEqual({ name: 'required' });
  expect(ruleProblems(draft(), doc)).toEqual({});
});

test('the daily limit: empty override = the installation default, 1..200, whole numbers only', () => {
  expect(effectiveLimit(null, 20)).toBe(20);
  expect(effectiveLimit(5, 20)).toBe(5);
  expect(effectiveLimit(0, 20)).toBe(20);
  expect(limitProblem('', 200, true)).toBeNull();
  expect(limitProblem('', 200, false)).toBe('required');
  expect(limitProblem('1', 200, true)).toBeNull();
  expect(limitProblem('200', 200, true)).toBeNull();
  expect(limitProblem('0', 200, true)).toBe('range');
  expect(limitProblem('201', 200, true)).toBe('range');
  expect(limitProblem('-4', 200, true)).toBe('range');
  expect(limitProblem('2.5', 200, true)).toBe('integer');
  expect(limitProblem('abc', 200, true)).toBe('integer');
  expect(ruleProblems(draft({ daily_limit: '250' }), doc)).toEqual({ daily_limit: 'range' });
  expect(ruleProblems(draft({ daily_limit: '7' }), doc)).toEqual({});
  expect(parseWhole(' 12 ')).toBe(12);
  expect(parseWhole('')).toBeNull();
});

test('placeholders: only the five known names, braces balanced, doubled braces are literal', () => {
  expect(placeholdersOk('{alert} - {place} ({since})', DEFAULT_BOUNDS.placeholders)).toBe(true);
  expect(placeholdersOk('{{literal}}', DEFAULT_BOUNDS.placeholders)).toBe(true);
  expect(placeholdersOk('{name}', DEFAULT_BOUNDS.placeholders)).toBe(false);
  expect(placeholdersOk('{alert!r}', DEFAULT_BOUNDS.placeholders)).toBe(false);
  expect(placeholdersOk('{0}', DEFAULT_BOUNDS.placeholders)).toBe(false);
  expect(placeholdersOk('{alert', DEFAULT_BOUNDS.placeholders)).toBe(false);
  expect(placeholdersOk('alert}', DEFAULT_BOUNDS.placeholders)).toBe(false);
  expect(ruleProblems(draft({ title: '{secret}' }), doc)).toEqual({ title: 'placeholder' });
  expect(ruleProblems(draft({ description: '{x}' }), doc)).toEqual({ description: 'placeholder' });
});

test('field checks mirror the server', () => {
  expect(ruleProblems(draft({ hold_min: '1441' }), doc).hold_min).toBe('range');
  expect(ruleProblems(draft({ hold_min: '' }), doc).hold_min).toBe('range');
  expect(ruleProblems(draft({ source: 'ticket.stuck' }), doc).source).toBe('unknown');
  expect(ruleProblems(draft({ department_id: 'gone' }), doc).department_id).toBe('unknown');
  expect(ruleProblems(draft({ priority_id: 'p2' }), doc).priority_id).toBe('unknown'); // a priority of another department
  expect(ruleProblems(draft({ category_id: 'c1' }), doc).category_id).toBeUndefined();
  expect(ruleProblems(draft({ title: '' }), doc).title).toBe('required');
  expect(ruleProblems(draft({ title: 'x'.repeat(121) }), doc).title).toBe('too_long');
  expect(ruleProblems(draft({ name: 'x'.repeat(81) }), doc).name).toBe('too_long');
});

test('the body sent to the server: numbers as numbers, empty choices as null, round trip through a stored rule', () => {
  const b = ruleBody(draft({ hold_min: '10', daily_limit: '', priority_id: '', name: '  דליפה  ' }));
  expect(b).toMatchObject({ name: 'דליפה', hold_min: 10, daily_limit: null, priority_id: null, category_id: null, id: null });
  const v = view({ daily_limit: 3, priority_id: 'p1' });
  const back = ruleBody(draftOf(v));
  expect(back).toEqual(stored(v));
  expect(Object.keys(stored(v))).not.toContain('today_created');
});

test('server 422 problems land on the editor fields of the right rule', () => {
  const fields = [{ field: 'rules[1].daily_limit', code: 'range' }, { field: 'rules[0].title', code: 'placeholder' }, { field: 'daily_limit_default', code: 'range' }];
  expect(serverProblems(fields, 1)).toEqual({ daily_limit: 'range' });
  expect(serverProblems(fields, 0)).toEqual({ title: 'placeholder' });
  expect(serverProblems([{ field: 'rule.source', code: 'unknown' }], null)).toEqual({ source: 'unknown' });
  expect(serverProblems([{ field: 'rule.title', code: 'weird' }], null)).toEqual({ title: 'unknown' });
});

test('the source label, and a source the catalogue dropped', () => {
  expect(sourceLabel(doc.sources, 'sensor.leak')).toBe('דליפת מים');
  expect(sourceLabel(doc.sources, 'gone')).toBe('');
});

test('the rules tab is the installation document (system.configure)', () => {
  expect(SETTINGS_TABS).toContain('rules');
  expect(visibleTabs({ api: true, can: (p) => p === 'tickets.configure' })).not.toContain('rules');
  expect(visibleTabs({ api: true, can: (p) => p === 'system.configure' })).toContain('rules');
});

test('Hebrew and English carry the same keys, and every outcome of the dry run has a sentence', () => {
  expect(Object.keys(RULES_TEXT_EN).sort()).toEqual(Object.keys(RULES_TEXT_HE).sort());
  for (const o of ['create', 'absorb', 'suppressed', 'wait_hold', 'nothing', 'already_handled', 'rule_off', 'rules_off']) {
    expect(RULES_TEXT_HE[`would_${o}` as keyof typeof RULES_TEXT_HE]).toBeTruthy();
  }
  expect(RULES_TEXT_HE.limitReached).toBe('הגיע למקסימום היום');
  // the owner's rule (unit-tickets-ui6): the module's name comes from the naming tokens, never the word "call" in Hebrew
  expect(Object.values(RULES_TEXT_HE).join('\n')).not.toMatch(/קריא(ה|ות|ת)/);
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
  for (const f of ['tickets/settings-rules.ts', 'tickets/rules-model.ts', 'api/tickets-rules.ts']) {
    expect(readFileSync(path.join(root, f), 'utf8'), f).not.toMatch(/קריא(ה|ות|ת)/);
  }
});
