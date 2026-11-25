import { expect, test } from '@playwright/test';
import { ApiError, fieldsOf, problemsOf, type ApiErrorBody, type FieldProblem } from '../src/api/client';
import { fieldErrors } from '../src/api/insights';
import { errorLine } from '../src/screens/nvr-cameras-edit';
import { settingsProblems } from '../src/api/access-messaging';
import { outcomeOf as scheduleOutcomeOf } from '../src/api/schedule-writes';
import { problemsOf as draftProblemsOf } from '../src/access-control/profiles-logic';
import { serverProblems } from '../src/tickets/rules-model';

// ADR019-STEP0-2500 (ADR-019 Step 0, item 3): the one field-error reader. `fieldsOf` / `problemsOf` read the canonical
// `details.fields` (names) and `details.problems` ({field, code, message?}) first and every legacy form second: `field`, `key`,
// `fields` as objects / as a map, a domain `errors` list with `path` or the global handler's `loc`. Pure logic, no browser page.

const err = (details: Record<string, unknown>, status = 422, code = 'validation') =>
  new ApiError(status, { code, user_message: 'ערך לא תקין.', retryable: false, correlation_id: 'c-1', details } satisfies ApiErrorBody);

test('canonical fields and problems', () => {
  const e = err({ fields: ['a', 'b'], problems: [{ field: 'b', code: 'format', message: 'פורמט' }, { field: 'c', code: 'missing' }] });
  expect(fieldsOf(e)).toEqual(['a', 'b', 'c']);
  const want: FieldProblem[] = [{ field: 'b', code: 'format', message: 'פורמט' }, { field: 'c', code: 'missing' }];
  expect(problemsOf(e)).toEqual(want);
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

test('family 3 screen reader: the NVR stream editor names the refused field through fieldsOf (canonical, legacy, both)', () => {
  const line = (details: Record<string, unknown>) => errorLine({ status: 422, code: 'value_not_allowed', details }).text;
  const want = 'GOP: הערך אינו נתמך במצלמה.';
  expect(line({ fields: ['gop'], field: 'gop' })).toBe(want); // the migration window: both keys
  expect(line({ fields: ['gop'] })).toBe(want); // after Step 1 (d): the canonical key alone
  expect(line({ field: 'gop' })).toBe(want); // an older server: the legacy key alone
  expect(line({ fields: ['not_a_stream_field'] })).toBe('הערך אינו נתמך במצלמה.');
  expect(errorLine({ status: 422, code: 'field_locked', details: { fields: ['gop'] } }).text).toBe('השדה נעול כרגע.');
});

test('family 4 readers: the tickets / messaging-accounts `{field, code}` lists read through problemsOf (canonical, legacy objects)', () => {
  const canonical = err({ fields: ['rules[0].title'], problems: [{ field: 'rules[0].title', code: 'placeholder' }] });
  const legacy = err({ fields: [{ field: 'rules[0].title', code: 'placeholder' }] });
  for (const e of [canonical, legacy]) {
    expect(problemsOf(e)).toEqual([{ field: 'rules[0].title', code: 'placeholder' }]);
    expect(fieldsOf(e)).toEqual(['rules[0].title']);
    expect(serverProblems(problemsOf(e), 0)).toEqual(serverProblems([{ field: 'rules[0].title', code: 'placeholder' }], 0));
  }
  // two problems of one field: `fields` names it once, `problems` keeps both (the message-template body checks)
  const two = err({ fields: ['body'], problems: [{ field: 'body', code: 'too_long' }, { field: 'body', code: 'link_required' }] });
  expect(fieldsOf(two)).toEqual(['body']);
  expect(problemsOf(two).map((p) => p.code)).toEqual(['too_long', 'link_required']);
  // a 409 that only names a field (module_key_missing): no problem, so the contacts line stays the plain message
  expect(problemsOf(err({ fields: ['phone'], field: 'phone' }, 409, 'module_key_missing'))).toEqual([]);
});

test('family 5 readers: access messaging settings, profile drafts and schedule writes (canonical, legacy, both)', () => {
  const issues = [{ path: 'templates.1.body', code: 'credential' }];
  const canonical = { fields: ['templates.1.body'], problems: [{ field: 'templates.1.body', code: 'credential' }] };
  for (const details of [canonical, { ...canonical, errors: issues }, { errors: issues }]) {
    expect(settingsProblems(err(details, 422, 'message_settings_invalid'))).toEqual(issues);
  }
  expect(settingsProblems(err(canonical, 422, 'validation'))).toBeNull();
  const draft = { fields: ['fields.0.label'], problems: [{ field: 'fields.0.label', code: 'label' }] };
  expect(draftProblemsOf(err(draft, 422, 'profiles_invalid_draft'))).toEqual({ 'fields.0.label': 'label' });
  expect(draftProblemsOf(err({ problems: [{ path: 'fields.0.label', code: 'label' }] }, 422, 'profiles_invalid_draft'))).toEqual({ 'fields.0.label': 'label' });
  const sched = { outcome: 'not_sent', wiskey_code: 'schedule_overlap', reason: 'x' };
  for (const details of [{ ...sched, field: 'weekly.Monday', fields: ['weekly.Monday'], problems: [{ field: 'weekly.Monday', code: 'schedule_overlap' }] },
    { ...sched, field: 'weekly.Monday' }]) {
    expect(scheduleOutcomeOf(err(details, 422, 'schedule_invalid_draft'))).toMatchObject({ status: 'not_sent', code: 'schedule_overlap', field: 'weekly.Monday' });
  }
});
