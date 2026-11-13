import { test, expect } from '@playwright/test';
import { ApiError } from '../src/api/client';
import { elecCustomerNumberError, elecForbidden } from '../src/api/electricity-billing';
import { floorLinks, type FloorLink } from '../src/map/connector-targets';
import type { GeomConnector } from '../src/map/geometry';
import { otherOutlineIsUpper } from '../src/map/shared-space';
import { cardModel, type CardItem } from '../src/tickets/list-card-model';
import { sentenceAwaitsHandler } from '../src/tickets/status-sentence';
import { sectionLinksOf } from '../src/xsection/xs-data';

// FE-LEAK-TEXTKEY-2435 (code review 2026-11-13, frontend F03): program logic must never be decided by the wording of a display text.
// Every case below runs once with today's Hebrew texts (the behaviour must not move) and once with an English or reworded text, which
// the old checks (/הרשאה/, /מספר/, /מעלית/, 'מפלס עליון', /שיוך|assign/) got wrong. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-textkey-2435.spec.ts

const err = (status: number, code: string, user_message: string, details: Record<string, unknown> = {}) =>
  new ApiError(status, { code, user_message, retryable: false, correlation_id: 't', details });

test.describe('electricity: a refusal is recognised by its status and code', () => {
  test('403 means "no permission" whatever the message says', () => {
    expect(elecForbidden(err(403, 'forbidden', 'אין הרשאה לחיובים.'))).toBe(true); // the demo store's text
    expect(elecForbidden(err(403, 'forbidden', ''))).toBe(true);
    expect(elecForbidden(err(403, 'forbidden', 'You may not read the billing settings.'))).toBe(true); // English: /הרשאה/ missed it
    expect(elecForbidden(err(403, 'scope_denied', 'נחסם עבור האזור הזה'))).toBe(true); // reworded Hebrew: /הרשאה/ missed it
  });

  test('another error is not "no permission", even when its words mention permission', () => {
    expect(elecForbidden(err(409, 'revision_conflict', 'ההרשאה לפריט השתנתה בינתיים'))).toBe(false); // /הרשאה/ matched it
    expect(elecForbidden(err(500, 'internal', 'שגיאה'))).toBe(false);
    expect(elecForbidden(new TypeError('Failed to fetch'))).toBe(false);
    expect(elecForbidden(new Error('אין הרשאה'))).toBe(false);
  });

  test('the new-customer error lands under the number field by code or by the field the server names', () => {
    // the backend's two number errors (services/energy_billing._customer_number), Hebrew as today and reworded in English
    expect(elecCustomerNumberError(err(409, 'customer_number_taken', 'מספר הלקוח כבר בשימוש.', { customer_number: '0007' }))).toBe(true);
    expect(elecCustomerNumberError(err(409, 'customer_number_taken', 'This customer ID is already used.'))).toBe(true);
    expect(elecCustomerNumberError(err(422, 'validation', 'מספר לקוח חייב להכיל ספרות בלבד (עד 9).', { fields: ['customer_number'] }))).toBe(true);
    expect(elecCustomerNumberError(err(422, 'validation', 'Digits only, please.', { fields: ['customer_number'] }))).toBe(true);
    expect(elecCustomerNumberError(err(422, 'validation', 'bad', { fields: { customer_number: 'bad' } }))).toBe(true);
  });

  test('any other new-customer error stays under the name field, even when its words contain "number"', () => {
    expect(elecCustomerNumberError(err(422, 'validation', 'צריך לכתוב שם ללקוח.', { fields: { name: 'x' } }))).toBe(false);
    expect(elecCustomerNumberError(err(422, 'validation', 'מספר הטלפון אינו תקין', { fields: ['phone'] }))).toBe(false); // /מספר/ matched it
    expect(elecCustomerNumberError(err(500, 'internal', 'שגיאה'))).toBe(false);
    expect(elecCustomerNumberError(new TypeError('Failed to fetch'))).toBe(false);
  });
});

test.describe('cross-section: a lift is recognised by the connector kind', () => {
  const C = (o: Partial<GeomConnector>): GeomConnector => ({
    id: 'c', kind: 'stairs', polyline: [[0.1, 0.1], [0.2, 0.1]], width_m: 1.2, level_from: 'L0', level_to: 'L1', floor_ids: ['f0', 'f1'], ...o,
  } as GeomConnector);
  const LV = [{ id: 'L0', name: 'מפלס ראשי', elevation_m: 0, ceiling_height_m: 2.8, is_default: true }];
  const FLOORS = [{ id: 'f0', name: 'קומה 0' }, { id: 'f1', name: 'קומה 1' }];

  test('floorLinks carries the stored kind beside the Hebrew label', () => {
    const links = floorLinks([{ floorId: 'f0', connectors: [C({ id: 'el', kind: 'elevator' }), C({ id: 'st' })], levels: LV }], FLOORS);
    expect(links.map((l) => [l.id, l.kind, l.kindLabel])).toEqual([['el', 'elevator', 'מעלית'], ['st', 'stairs', 'מדרגות']]);
  });

  test('the section draws a lift shaft for an elevator, with the Hebrew label and with any other label', () => {
    const end = { floorId: 'f0', at: [0, 0] as [number, number], label: '' };
    const link = (id: string, kind: string, kindLabel: string): FloorLink => ({ id, kind, kindLabel, a: end, b: { ...end, floorId: 'f1' }, farLabel: '' });
    const he = sectionLinksOf([link('el', 'elevator', 'מעלית'), link('st', 'stairs', 'מדרגות')]);
    expect(he.map((s) => [s.kind, s.label])).toEqual([['lift', 'מעלית'], ['stairs', 'מדרגות']]);
    const en = sectionLinksOf([link('el', 'elevator', 'Lift'), link('st', 'stairs', 'Stairs')]);
    expect(en.map((s) => s.kind)).toEqual(['lift', 'stairs']); // /מעלית/ made the English lift a staircase
    // a label that happens to contain the Hebrew word does not turn stairs into a lift
    expect(sectionLinksOf([link('st', 'stairs', 'מדרגות ליד המעלית')]).map((s) => s.kind)).toEqual(['stairs']);
  });
});

test.describe('plan canvas: the upper outline of a shared space is recognised by the datum', () => {
  test('the server rule: "מפלס תחתון" exactly when the other floor is below (negative datum)', () => {
    expect(otherOutlineIsUpper({ datum_m: 3 })).toBe(true); // the court's floor: the wider upper level ("מפלס עליון")
    expect(otherOutlineIsUpper({ datum_m: null })).toBe(true); // no datum: the server labels it "מפלס עליון"
    expect(otherOutlineIsUpper({ datum_m: -3 })).toBe(false); // the upper floor: the court below ("מפלס תחתון")
  });

  test('the canvas no longer compares the label text', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/map/sw-plan-canvas.ts', import.meta.url), 'utf8');
    expect(src).not.toContain("other_label === 'מפלס עליון'");
    expect(src).toContain('otherOutlineIsUpper(e)');
  });
});

test.describe('tickets cards: "no handler" is left out by status, not by the sentence wording', () => {
  const NOW = new Date(2026, 10, 13, 12, 0, 0);
  const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
  const tk = (o: Partial<CardItem> = {}): CardItem => ({
    id: 'a'.repeat(16), number: 1044, title: 'נזילה', excerpt: 'x', status: 'new', origin: 'manual',
    department: { id: 'd1', key: 'maint', name: 'אחזקה', icon: null, color: null }, category: null, priority: null,
    place_text: '', device_name: '', created_by: { id: 'u9', name: 'דנה לוי' }, created_at: ago(180), last_activity_at: ago(60),
    assignee: null, last_assignee_name: null, eta_at: null, waiting_on: 'manager', waiting_reason: null, reopen_count: 0, external_stale: false,
    closed_at: null, revision: 1, view: 'full', ...o,
  });
  const g = globalThis as unknown as { document?: unknown };
  test.afterEach(() => { delete g.document; });

  test('the statuses whose sentence says it waits for a handler', () => {
    expect(['new', 'returned'].every((s) => sentenceAwaitsHandler(s as CardItem['status']))).toBe(true);
    expect(['assigned', 'acknowledged', 'in_progress', 'waiting_part', 'done', 'closed', 'cancelled'].some((s) => sentenceAwaitsHandler(s as CardItem['status']))).toBe(false);
  });

  test('Hebrew, as today: a new or returned request without a handler does not repeat "ללא מטפל"', () => {
    for (const status of ['new', 'returned'] as const) {
      const m = cardModel(tk({ status }), { role: 'manager', now: NOW });
      expect(m.sentence).toContain('ממתין לשיוך');
      expect(m.run.text).not.toContain('ללא מטפל');
    }
  });

  test('English: the sentence says "waiting for a handler" without the word "assign" - still not repeated', () => {
    g.document = { documentElement: { lang: 'en' } };
    for (const status of ['new', 'returned'] as const) {
      const m = cardModel(tk({ status }), { role: 'manager', now: NOW });
      expect(m.sentence).toMatch(/waiting for a (new )?handler/i);
      expect(m.sentence).not.toMatch(/שיוך|assign/i); // the old check could not see it
      // the footer keeps only the time (the old check added " · <no handler>")
      expect(m.run.text).not.toContain('·');
      expect(m.run.tone).toBe('bad');
    }
  });

  test('a free-text name that contains the word does not hide "ללא מטפל" for a request that is not waiting for assignment', () => {
    const m = cardModel(tk({ status: 'in_progress', last_assignee_name: 'צוות שיוך' }), { role: 'manager', now: NOW });
    expect(m.sentence).toContain('צוות שיוך'); // /שיוך/ matched the name
    expect(m.run.text).toContain('ללא מטפל');
  });
});
