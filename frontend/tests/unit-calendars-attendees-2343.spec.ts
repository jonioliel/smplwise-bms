import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CONTACT_NOTE, KIND_LABEL, ROLE_LABEL, STATUS_LABEL, addHit, chipLabel, countText, draftOfAttendee, draftOfGuest, draftOfHit, freshHits, hasErrors, normalisePhone,
  payloadOf, statusSummary, toggleRole, validateGuest, type AttendeeDraft,
} from '../src/calendars/attendee-logic';

// CAL-ATTENDEES-2343 (owner 2026-11-02, answers 6C + 7B): the attendee picker's pure logic - Hebrew labels, the guest validation that mirrors
// the server (services/calendar/attendees.py), chips, the create payload - plus a static a11y check of the picker's markup. Node only.

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (f: string) => fs.readFileSync(path.join(here, '..', 'src', f), 'utf8');

test('Hebrew labels for kinds, roles and answers', () => {
  expect(KIND_LABEL).toEqual({ user: 'משתמש', resident: 'דייר', guest: 'אורח' });
  expect(ROLE_LABEL).toEqual({ required: 'חובה', optional: 'רשות' });
  expect(STATUS_LABEL.accepted).toBe('מגיע');
  expect(CONTACT_NOTE).toContain('למארגן ולמנהלי היומן');
});

test('phone normalisation follows the server (local 0 -> +972, 00 -> +)', () => {
  expect(normalisePhone('050-555-0142')).toBe('+972505550142');
  expect(normalisePhone('(050) 555 0142')).toBe('+972505550142');
  expect(normalisePhone('0044 20 7946 0958')).toBe('+442079460958');
  expect(normalisePhone('+1 555 010 0199')).toBe('+15550100199');
});

test('guest validation: a name and a phone OR an e-mail, each well formed', () => {
  expect(validateGuest('דנה', '050-555-0142', '')).toEqual({});
  expect(validateGuest('דנה', '', 'dana@example.com')).toEqual({});
  expect(validateGuest('', '050-555-0142', '').name).toBe('חסר שם האורח.');
  expect(validateGuest('דנה', '', '').phone).toBe('לאורח צריך טלפון או דוא״ל.');
  expect(validateGuest('דנה', '12', '').phone).toBe('מספר הטלפון אינו תקין.');
  expect(validateGuest('דנה', '', 'not-an-email').email).toBe('כתובת הדוא״ל אינה תקינה.');
  expect(validateGuest('דנה', '', 'a@b').email).toBeTruthy(); // a domain needs a dot, like the server
  expect(hasErrors(validateGuest('א'.repeat(81), '050-555-0142', ''))).toBe(true);
});

test('drafts, chips and the create payload', () => {
  const g = draftOfGuest('  רות ', '050 555 0142', ' Ruth@Example.COM ');
  expect(g).toMatchObject({ kind: 'guest', name: 'רות', phone: '+972505550142', email: 'ruth@example.com', role: 'required' });
  let list: AttendeeDraft[] = [];
  list = addHit(list, { kind: 'user', ref_id: 'u1', name: 'נועה' });
  list = addHit(list, { kind: 'user', ref_id: 'u1', name: 'נועה' }); // never doubled
  list = addHit(list, { kind: 'resident', ref_id: 'r1', name: 'דוד' });
  list = [...list, g];
  expect(list).toHaveLength(3);
  list = list.map((d) => (d.ref_id === 'r1' ? { ...d, role: toggleRole(d.role) } : d));
  expect(payloadOf(list)).toEqual([
    { kind: 'user', ref_id: 'u1', role: 'required' },
    { kind: 'resident', ref_id: 'r1', role: 'optional' },
    { kind: 'guest', name: 'רות', role: 'required', phone: '+972505550142', email: 'ruth@example.com' },
  ]);
  expect(chipLabel({ ...draftOfHit({ kind: 'user', ref_id: 'u1', name: 'נועה' }), status: 'accepted' })).toBe('נועה, משתמש, חובה, מגיע');
  expect(freshHits([{ kind: 'user', ref_id: 'u1', name: 'נועה' }, { kind: 'user', ref_id: 'u2', name: 'אורי' }], list).map((h) => h.ref_id)).toEqual(['u2']);
});

test('an existing attendee becomes a chip; a guest without a reference is keyed by its id', () => {
  const d = draftOfAttendee({ id: 'att_1', kind: 'guest', ref_id: null, name: 'אורח', role: 'optional', status: 'invited', notified: true, you: false, contact: { phone: '+972505550142', email: '' } });
  expect(d).toMatchObject({ key: 'id:att_1', id: 'att_1', phone: '+972505550142', email: undefined, role: 'optional' });
  const u = draftOfAttendee({ id: 'att_2', kind: 'user', ref_id: 'u9', name: 'נועה', role: 'required', status: 'declined', notified: false, you: true });
  expect(u.key).toBe('user:u9');
  expect(u.phone).toBeUndefined(); // no contact for users / residents, ever
});

test('count and status summary texts', () => {
  expect(countText(null)).toBe('');
  expect(countText(0)).toBe('אין מוזמנים');
  expect(countText(1)).toBe('מוזמן אחד');
  expect(countText(7)).toBe('7 מוזמנים');
  expect(statusSummary([{ status: 'accepted' }, { status: 'accepted' }, { status: 'declined' }, { status: 'invited' }])).toBe('2 מגיעים · 1 לא מגיעים · 1 טרם ענו');
});

test('picker markup: combobox + listbox, labelled controls, a live region, 44 px phone targets, no HA branding', () => {
  const s = src('calendars/attendee-picker.ts');
  for (const needle of ["role=\"combobox\"", 'aria-expanded=', 'aria-controls=', 'aria-activedescendant=', "role=\"listbox\"", "role=\"option\"", 'aria-live="polite"',
    'aria-pressed=', 'aria-invalid=', 'aria-describedby=', 'aria-label=${`הסרת ${d.name}`}', 'min-block-size: 44px']) {
    expect(s, needle).toContain(needle);
  }
  expect(s).not.toMatch(/Home Assistant/);
  const sec = src('calendars/attendees-section.ts');
  expect(sec).toContain('data-cal-attendees');
  expect(sec).toContain('role="group"');
});

test('the drawer carries exactly one attendees section per mode and sends `attendees` with a new entry', () => {
  const d = src('calendars/event-drawer.ts');
  // 2.35.0 train: the existing-entry view draws the section itself; the form draws it through the grid branch's attendee slot
  expect((d.match(/<cal-attendees-section/g) ?? []).length).toBe(1);
  expect((d.match(/attendeeSlot\(\{ surface: 'drawer'/g) ?? []).length).toBe(1);
  expect(src('calendars/attendees-section.ts')).toMatch(/calHooks\.attendees = \(p\) => \(p\.surface === 'drawer' \? html`<cal-attendees-section/);
  expect(d).toContain("querySelector('cal-attendees-section')");
  expect(d).toContain('Object.assign(out, { attendees })');
});
