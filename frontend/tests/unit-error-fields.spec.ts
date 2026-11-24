import { expect, test } from '@playwright/test';
import { ApiError, fieldsOf, problemsOf, type ApiErrorBody, type FieldProblem } from '../src/api/client';
import { fieldErrors } from '../src/api/insights';

// ADR019-STEP0-2500 (ADR-019 Step 0, item 3): the one field-error reader. `fieldsOf` / `problemsOf` read the canonical
// `details.fields` (names) and `details.problems` ({field, code, message?}) first and every legacy form second: `field`, `key`,
// `fields` as objects / as a map, a domain `errors` list with `path` or the global handler's `loc`. Pure logic, no browser page.

const err = (details: Record<string, unknown>, status = 422, code = 'validation') =>
  new ApiError(status, { code, user_message: 'ערך לא תקין.', retryable: false, correlation_id: 'c-1', details } satisfies ApiErrorBody);

test('canonical fields and problems', () => {
  const e = err({ fields: ['a', 'b'], problems: [{ field: 'b', code: 'format', message: 'פורמט' }, { field: 'c', code: 'missing' }] });
  expect(fieldsOf(e)).toEqual(['a', 'b', 'c']);
  expect(problemsOf(e)).toEqual<FieldProblem[]>([{ field: 'b', code: 'format', message: 'פורמט' }, { field: 'c', code: 'missing' }]);
});

test('the canonical keys win over a legacy key sent beside them (the migration window)', () => {
  const e = err({ field: 'old', fields: ['to'], code: 'format', problems: [{ field: 'to', code: 'format' }] });
  expect(fieldsOf(e)).toEqual(['to']);
  expect(problemsOf(e)).toEqual([{ field: 'to', code: 'format' }]);
  // the global handler: the raw `errors` list stays beside the canonical keys and is not read twice
  const v = err({ errors: [{ loc: ['name'], type: 'missing', msg: 'm' }], fields: ['name'], problems: [{ field: 'name', code: 'missing', message: 'שדה חובה' }] });
  expect(fieldsOf(v)).toEqual(['name']);
  expect(problemsOf(v)).toEqual([{ field: 'name', code: 'missing', message: 'שדה חובה' }]);
});

test('legacy details.field and details.key', () => {
  expect(fieldsOf(err({ field: 'color' }))).toEqual(['color']);
  expect(fieldsOf(err({ key: 'theme.accent' }))).toEqual(['theme.accent']);
  expect(problemsOf(err({ field: 'color' }))).toEqual([]); // a name without a reason
  expect(fieldsOf(err({ field: '' }))).toEqual([]);
});

test('legacy fields as objects {field, code}', () => {
  const e = err({ fields: [{ field: 'award_notice', code: 'disabled' }, { field: 'work_from', code: 'invalid' }] });
  expect(fieldsOf(e)).toEqual(['award_notice', 'work_from']);
  expect(problemsOf(e)).toEqual([{ field: 'award_notice', code: 'disabled' }, { field: 'work_from', code: 'invalid' }]);
});

test('legacy fields as a map field -> message', () => {
  const e = err({ fields: { 'customer.name': 'חסר שם', rate: '' } });
  expect(fieldsOf(e)).toEqual(['customer.name', 'rate']);
  expect(problemsOf(e)).toEqual([{ field: 'customer.name', code: 'invalid', message: 'חסר שם' }, { field: 'rate', code: 'invalid' }]);
});

test('legacy errors lists: {path, code, message}, {loc, type, msg}, {loc, msg}; plain strings are not fields', () => {
  const issues = err({ errors: [{ path: 'triggers[0].entity_id', code: 'unknown_entity', message: 'ישות לא מוכרת' }, { path: ['actions', 1], code: 'x' }] });
  expect(fieldsOf(issues)).toEqual(['triggers[0].entity_id', 'actions.1']);
  expect(problemsOf(issues)).toEqual([{ field: 'triggers[0].entity_id', code: 'unknown_entity', message: 'ישות לא מוכרת' }, { field: 'actions.1', code: 'x' }]);
  const raw = err({ errors: [{ loc: ['doors', 'pairs', 0], type: 'missing', msg: 'Field required' }] });
  expect(fieldsOf(raw)).toEqual(['doors.pairs.0']);
  expect(problemsOf(raw)).toEqual([{ field: 'doors.pairs.0', code: 'missing', message: 'Field required' }]);
  const wall = err({ errors: [{ loc: ['tiles'], msg: 'too many' }] });
  expect(problemsOf(wall)).toEqual([{ field: 'tiles', code: 'invalid', message: 'too many' }]);
  expect(fieldsOf(err({ errors: ['layout is too big'] }))).toEqual([]);
});

test('each field once, in order; a mixed list keeps only names', () => {
  expect(fieldsOf(err({ fields: ['a', 'a', 'b', 7, null] }))).toEqual(['a', 'b']);
  expect(fieldsOf(err({ field: 'x', key: 'x' }))).toEqual(['x']);
});

test('nothing to read: no details, another error, not an ApiError', () => {
  expect(fieldsOf(err({}))).toEqual([]);
  expect(problemsOf(err({ reason: 'clock' }, 401, 'unauthenticated'))).toEqual([]);
  expect(fieldsOf(new Error('x'))).toEqual([]);
  expect(problemsOf(undefined)).toEqual([]);
  expect(fieldsOf(err({ fields: [] }))).toEqual([]);
});

test('family 1 screen reader: insights fieldErrors reads through fieldsOf (422 only)', () => {
  expect(fieldErrors(err({ fields: ['doors.min_open_s', 'doors.pairs[0].lock_entity_id'], message_en: 'Invalid value.' }))).toEqual([
    'doors.min_open_s',
    'doors.pairs[0].lock_entity_id',
  ]);
  expect(fieldErrors(err({ fields: ['x'] }, 409, 'revision_conflict'))).toEqual([]);
  expect(fieldErrors(new Error('x'))).toEqual([]);
});
