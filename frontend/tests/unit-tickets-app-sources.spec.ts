import { test, expect } from '@playwright/test';
import { SOURCE_CATALOG, TICKET_SOURCES } from '../src/api/notifications';
import { NMT_TABLES, sourceLabel } from '../src/i18n/notify-matrix';
import { matrixGroups } from '../src/components/notify-logic';

// PUSHSVC-295: the two phone-app ticket sources in the notification matrix. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-app-sources.spec.ts

const NEW = ['ticket.status_update', 'ticket.comment_added'];
const pol = (source: string) => ({ source, enabled: true, severity: 'info' as const, category: 'tickets' as const, after_s: 0, dedupe_window_s: 0, resolve_notice: false,
  recipients: { rule: 'assignee' as const }, channels: { inbox: true, webpush: true, email: false, app: true, announce: false, ha_mobile: false, whatsapp: false }, revision: 1 });

test('both sources are in TICKET_SOURCES (tickets category, info), and not in the module-free catalogue', () => {
  const keys = TICKET_SOURCES.map((s) => s.key);
  for (const k of NEW) {
    expect(keys).toContain(k);
    const s = TICKET_SOURCES.find((x) => x.key === k)!;
    expect(s.category).toBe('tickets');
    expect(s.severity).toBe('info');
    expect(SOURCE_CATALOG.some((x) => x.key === k)).toBe(false);
  }
  expect(keys.indexOf('ticket.assigned')).toBeLessThan(keys.indexOf('ticket.status_update'));
});

test('labels in Hebrew, English, Arabic and Russian; the Hebrew label is the catalogue label', () => {
  expect(sourceLabel('ticket.status_update', 'x', 'he')).toBe('סטטוס עודכן');
  expect(sourceLabel('ticket.comment_added', 'x', 'he')).toBe('נוספה הערה');
  expect(sourceLabel('ticket.status_update', 'x', 'en')).toBe('Status updated');
  expect(sourceLabel('ticket.comment_added', 'x', 'en')).toBe('Note added');
  for (const lang of ['he', 'en', 'ar', 'ru'] as const) {
    for (const k of NEW) expect(sourceLabel(k, 'fallback', lang), `${lang}.${k}`).not.toBe('fallback');
    expect(NMT_TABLES[lang].src_ticket_status_update).toBeTruthy();
    expect(NMT_TABLES[lang].src_ticket_comment_added).toBeTruthy();
  }
  for (const k of NEW) expect(TICKET_SOURCES.find((s) => s.key === k)!.label).toBe(sourceLabel(k, '', 'he'));
  for (const k of NEW) expect(sourceLabel(k, '', 'he')).not.toMatch(/קריא(ה|ות|ת)|\bTickets?\b/);
});

test('module off: the server lists no ticket policies, so the matrix shows no ticket row; module on: both rows appear', () => {
  const catalog = [...SOURCE_CATALOG, ...TICKET_SOURCES];
  const off = matrixGroups([pol('backup.failed')] as never, catalog);
  expect(off.flatMap((g) => g.rows.map((r) => r.info.key))).not.toEqual(expect.arrayContaining(NEW));
  expect(off.some((g) => g.category === 'tickets')).toBe(false);
  const on = matrixGroups([pol('backup.failed'), ...NEW.map(pol)] as never, catalog);
  const tickets = on.find((g) => g.category === 'tickets')!;
  expect(tickets.rows.map((r) => r.info.key)).toEqual(NEW);
});
