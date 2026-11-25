import { expect, test } from '@playwright/test';
import { ApiError, fieldsOf, issueDetails, issuesOf, problemsOf, type ApiErrorBody } from '../src/api/client';
import { automationErrorText, mapAutomationError } from '../src/api/automations';
import { elecCustomerNumberError, elecFieldErrors } from '../src/api/electricity-billing';

// ADR019-FAMILY678-2520 (ADR-019 Step 1, families 6-8): the issue lists of automations, schedules, scenarios and blueprints answer the
// canonical `fields` / `problems` beside their legacy `errors`; billing answers `fields` as names with `problems[].message`. The screens
// read through `issuesOf` / `problemsOf` / `fieldsOf` and show the same words in the same places. Pure logic, no browser page.

const err = (details: Record<string, unknown>, status = 422, code = 'validation') =>
  new ApiError(status, { code, user_message: 'ערך לא תקין.', retryable: false, correlation_id: 'c-1', details } satisfies ApiErrorBody);

const ISSUES = [
  { path: 'alias', code: 'alias_required', message: 'תנו שם' },
  { path: '', code: 'validation', message: 'הטיוטה אינה שלמה' },
];

test('issueDetails mirrors the server: an empty path is the whole body, each field once', () => {
  expect(issueDetails(ISSUES)).toEqual({
    fields: ['alias', 'body'],
    problems: [{ field: 'alias', code: 'alias_required', message: 'תנו שם' }, { field: 'body', code: 'validation', message: 'הטיוטה אינה שלמה' }],
  });
  expect(issueDetails([{ path: 'templates.0', code: 'type' }])).toEqual({ fields: ['templates.0'], problems: [{ field: 'templates.0', code: 'type' }] });
});

test('issuesOf: canonical problems first (body -> empty path), the legacy errors list second, the same issues either way', () => {
  const both = err({ errors: ISSUES, ...issueDetails(ISSUES) });
  const canonical = err(issueDetails(ISSUES));
  const legacy = err({ errors: ISSUES });
  expect(issuesOf(both)).toEqual(ISSUES);
  expect(issuesOf(canonical)).toEqual(ISSUES);
  expect(issuesOf(legacy)).toEqual(ISSUES); // an older server: the empty path is kept
  expect(issuesOf(err({ errors: [{ path: 'templates.0', code: 'type' }] }))).toEqual([{ path: 'templates.0', code: 'type', message: '' }]);
  expect(issuesOf(err({ fields: ['a'] }))).toEqual([]);
  expect(issuesOf(new Error('x'))).toEqual([]);
});

test('family 6 screens: automationErrorText and mapAutomationError read the same first issue from either form', () => {
  const one = [{ path: 'alias', code: 'alias_required', message: 'תנו שם' }];
  for (const details of [{ errors: one }, { errors: one, ...issueDetails(one) }, issueDetails(one)]) {
    expect(automationErrorText(err(details))).toBe('ערך לא תקין — alias: תנו שם');
    expect(mapAutomationError(err(details)).issues).toEqual(one);
  }
  const promoted = [{ path: 'actions.0', code: 'action_not_allowed', message: 'אסור' }];
  expect(mapAutomationError(err({ errors: promoted, path: 'actions.0', ...issueDetails(promoted) }, 422, 'action_not_allowed')).issues).toEqual(promoted);
});

test('family 7: elecFieldErrors reads per-field messages through problemsOf (canonical, legacy map), never a message-less problem', () => {
  const map = { name: 'צריך לכתוב שם ללקוח' };
  expect(elecFieldErrors(err({ fields: map }))).toEqual(map); // an older demo store / server: the map
  expect(elecFieldErrors(err({ fields: ['name'], problems: [{ field: 'name', code: 'invalid', message: 'צריך לכתוב שם ללקוח' }] }))).toEqual(map);
  // a refused tariff definition / formula: the text is the error's own message, so no field message (the screen shows the line)
  expect(elecFieldErrors(err({ errors: [{ code: 'gap', path: 'seasons.0', message: 'm' }], fields: ['definition.seasons.0'], problems: [{ field: 'definition.seasons.0', code: 'gap' }] }, 422, 'tariff_definition_invalid'))).toEqual({});
  expect(elecFieldErrors(err({ fields: ['customer_number'] }))).toEqual({}); // names only: no message
  expect(elecFieldErrors(new Error('x'))).toEqual({});
});

test('family 7: elecCustomerNumberError reads fieldsOf (names, the legacy map, problems)', () => {
  expect(elecCustomerNumberError(err({ fields: ['customer_number'] }))).toBe(true);
  expect(elecCustomerNumberError(err({ fields: { customer_number: 'x' } }))).toBe(true);
  expect(elecCustomerNumberError(err({ fields: ['customer_number'], problems: [{ field: 'customer_number', code: 'invalid', message: 'x' }] }))).toBe(true);
  expect(elecCustomerNumberError(err({ fields: ['name'] }))).toBe(false);
});

test('family 6/8 single-field refusals: the legacy key and the canonical one name the same field', () => {
  expect(fieldsOf(err({ key: 'scenarios.kill_switch', fields: ['scenarios.kill_switch'] }, 422, 'invalid_setting'))).toEqual(['scenarios.kill_switch']);
  expect(fieldsOf(err({ key: 'scenarios.kill_switch' }, 422, 'invalid_setting'))).toEqual(['scenarios.kill_switch']);
  expect(problemsOf(err({ field: 'title', fields: ['title'] }))).toEqual([]);
});
