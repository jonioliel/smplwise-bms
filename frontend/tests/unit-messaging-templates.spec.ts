import { test, expect } from '@playwright/test';
import { DEFAULT_LIMITS, bodyProblems, cleanBody, insertAt, problemsAt, settingsProblems } from '../src/access-control/messaging-templates';
import { problemText, MESSAGING_KEYS, mt } from '../src/i18n/access-messaging';

// CR-036 WA: the browser's copy of the server's template and settings rules (services/intercom_messaging.py validate_settings) - the same
// codes, so a server answer and a local check render alike. The server is the judge; this only answers sooner. Node only.

const L = DEFAULT_LIMITS;
const doc = (over: Record<string, unknown> = {}) => ({ bulk_max: 50, rate_per_hour: 60, organization: '', account: '', templates: [{ label: 'כרטיס מוכן', body: 'שלום {name}, כרטיס הכניסה שלך מוכן.' }], ...over }) as Parameters<typeof settingsProblems>[0];

test.describe('a template body', () => {
  const code = (body: string, org = '') => bodyProblems(body, 'b', org, L).map((p) => p.code);

  test('the placeholders: {name} and {organization} and nothing else in curly braces', () => {
    expect(code('שלום {name}')).toEqual([]);
    expect(code('שלום {name} מ{organization}', 'מגדל')).toEqual([]);
    expect(code('שלום {phone}')).toEqual(['unknown_placeholder']);
    expect(code('שלום { name }')).toEqual(['unknown_placeholder']);
    expect(code('שלום {name')).toEqual(['bad_braces']);
    expect(code('שלום name}')).toEqual(['bad_braces']);
    expect(code('שלום {{name}}')).toEqual(['bad_braces']);
    expect(code('שלום מ{organization}', '   ')).toEqual(['organization_missing']);
    expect(code('{name}'.repeat(7))).toEqual(['too_many_placeholders']);
  });

  test('never a credential: a placeholder for one, or a text that reads like one', () => {
    for (const bad of ['הקוד שלך {pin}', 'שלום {card}', '{credential_section}', 'שלום, הקוד שלך 4821', 'your PIN: 123456', 'קוד הגישה 99887']) expect(code(bad), bad).toEqual(['credential']);
    for (const ok of ['הכניסה סגורה בין 12:00 ל־14:00', 'מספר העובד שלך 1001', 'נפגש ב־15.10.2026']) expect(code(ok), ok).toEqual([]);
  });

  test('empty, long, control characters', () => {
    expect(code('   ')).toEqual(['empty']);
    expect(code('ב'.repeat(601))).toEqual(['too_long']);
    expect(code('ב'.repeat(600))).toEqual([]);
    expect(code('שלום\u0007')).toEqual(['control_chars']);
    expect(code('שורה\nשנייה')).toEqual([]);
  });

  test('the body is normalised the way the server normalises it', () => {
    expect(cleanBody('  שלום  \r\n  דנה  \r\n')).toBe('שלום\n  דנה');
    expect(cleanBody('\n\n')).toBe('');
  });
});

test.describe('the whole document', () => {
  test('a good one has no problem', () => {
    expect(settingsProblems(doc())).toEqual([]);
    expect(settingsProblems(doc({ templates: [] }))).toEqual([]);
  });

  test('numbers: a whole number inside the range', () => {
    expect(settingsProblems(doc({ bulk_max: 0 }))).toEqual([{ path: 'bulk_max', code: 'range' }]);
    expect(settingsProblems(doc({ bulk_max: 201 }))).toEqual([{ path: 'bulk_max', code: 'range' }]);
    expect(settingsProblems(doc({ bulk_max: Number.NaN }))).toEqual([{ path: 'bulk_max', code: 'type' }]);
    expect(settingsProblems(doc({ rate_per_hour: 1001 }))).toEqual([{ path: 'rate_per_hour', code: 'range' }]);
    expect(settingsProblems(doc({ rate_per_hour: 1.5 }))).toEqual([{ path: 'rate_per_hour', code: 'type' }]);
  });

  test('the organization: bounded, no braces, no control characters', () => {
    expect(settingsProblems(doc({ organization: 'ב'.repeat(61) }))).toEqual([{ path: 'organization', code: 'too_long' }]);
    expect(settingsProblems(doc({ organization: '{name}' }))).toEqual([{ path: 'organization', code: 'bad_braces' }]);
    expect(settingsProblems(doc({ organization: 'a\u0007b' }))).toEqual([{ path: 'organization', code: 'control_chars' }]);
    expect(settingsProblems(doc({ organization: 'מגדל', templates: [{ label: 'a', body: 'מ{organization}' }] }))).toEqual([]);
  });

  test('the templates: labels are unique and bounded, the count is bounded, each problem sits at its own path', () => {
    const many = Array.from({ length: 21 }, (_v, i) => ({ label: `t${i}`, body: 'ב' }));
    expect(settingsProblems(doc({ templates: many }))).toEqual([{ path: 'templates', code: 'too_many' }]);
    const p = settingsProblems(doc({ templates: [{ label: 'א', body: 'ב' }, { label: ' א ', body: 'ג {pin}' }, { label: '', body: 'ד' }, { label: 'ל'.repeat(41), body: 'ה' }] }));
    expect(p).toEqual([
      { path: 'templates.1.label', code: 'duplicate_label' },
      { path: 'templates.1.body', code: 'credential' },
      { path: 'templates.2.label', code: 'empty' },
      { path: 'templates.3.label', code: 'too_long' },
    ]);
    expect(problemsAt(p, 'templates.1.body').map((x) => x.code)).toEqual(['credential']);
  });

  test('inserting a placeholder lands at the caret and the caret follows it', () => {
    expect(insertAt('שלום , ברוך הבא', '{name}', 5, 5)).toEqual({ text: 'שלום {name}, ברוך הבא', caret: 11 });
    expect(insertAt('abc', '{name}', null, null)).toEqual({ text: 'abc{name}', caret: 9 });
    expect(insertAt('abcdef', 'X', 1, 4)).toEqual({ text: 'aXef', caret: 2 });
  });
});

test.describe('the words of a problem', () => {
  test('every code the server and the browser produce has a sentence of its own; an unknown one is a plain "invalid"', () => {
    for (const code of ['empty', 'too_long', 'control_chars', 'credential', 'unknown_placeholder', 'bad_braces', 'too_many_placeholders', 'organization_missing', 'duplicate_label', 'range', 'type', 'too_many']) {
      expect(problemText(code), code).not.toBe(mt('err.other'));
      expect(MESSAGING_KEYS).toContain(`err.${code}`);
    }
    expect(problemText('something_new')).toBe(mt('err.other'));
    expect(problemText('constructor')).toBe(mt('err.other'));
  });
});
