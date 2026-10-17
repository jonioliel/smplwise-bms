import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RFQ_SOURCES, TICKET_SOURCES, VISIBILITY_PERMISSION } from '../src/api/notifications';
import { RFQ_NOTIFY_EN, RFQ_NOTIFY_HE, rnt } from '../src/i18n/rfq-notify';
import { matrixGroups, openLabel } from '../src/components/notify-logic';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_HE } from '../src/tickets/rfq-text';

// TKRFQ5: the request-for-quotation notification sources in Settings › התראות and the centre (contract section 16.1).

const here = path.dirname(fileURLToPath(import.meta.url));
const py = readFileSync(path.resolve(here, '../../smplwise_vms/backend/smplwise/services/tickets/notify_sources.py'), 'utf8');

test('the four RFQ sources, in the tickets category, visible by tickets.view (the server decides by rfq.visible)', () => {
  expect(RFQ_SOURCES.map((s) => s.key)).toEqual(['rfq.quote_received', 'rfq.declined', 'rfq.question', 'rfq.due_passed', 'rfq.arrival']); // + CR-RFQ-PAYMENT-SCHEDULE
  expect(RFQ_SOURCES.every((s) => s.category === 'tickets')).toBe(true);
  expect(VISIBILITY_PERMISSION.rfq).toBe('tickets.view');
  expect(TICKET_SOURCES.some((s) => s.key.startsWith('rfq.'))).toBe(false);
});

test('the backend catalogue and the client agree on keys, Hebrew and English labels', () => {
  for (const s of RFQ_SOURCES) {
    const key = s.key as keyof typeof RFQ_NOTIFY_HE;
    expect(py, s.key).toContain(`{"key": "${s.key}", "label": "${RFQ_NOTIFY_HE[key]}", "label_en": "${RFQ_NOTIFY_EN[key]}"`);
    expect(rnt(key, 'he')).toBe(RFQ_NOTIFY_HE[key]);
    expect(rnt(key, 'en')).toBe(RFQ_NOTIFY_EN[key]);
    expect(rnt(key, 'he')).not.toMatch(/קריא(ה|ות|ת)/);
  }
});

test('the settings matrix lists the RFQ rows the server sends, and the centre names the request', () => {
  const pol = (source: string) => ({ source, enabled: true, severity: 'info' as const, category: 'tickets' as const, after_s: 0, dedupe_window_s: 0, resolve_notice: false,
    recipients: { rule: 'scope' as const }, channels: { inbox: true, webpush: true, email: false, app: false, announce: false, ha_mobile: false, whatsapp: false }, revision: 1 });
  const groups = matrixGroups(RFQ_SOURCES.map((s) => pol(s.key)) as never, [...TICKET_SOURCES, ...RFQ_SOURCES]);
  expect(groups.flatMap((g) => g.rows.map((r) => r.info.key))).toEqual(RFQ_SOURCES.map((s) => s.key));
  expect(openLabel({ subject: { kind: 'rfq', id: 'r1', area_id: null } } as never)).toBe(rnt('open'));
});

test('the manager thread marks a WhatsApp reply in Hebrew and English', () => {
  expect(RFQ_TEXT_HE.viaWhatsapp).toBe('בוואטסאפ · שולח לא מאומת');
  expect(RFQ_TEXT_EN_KEYS).toContain('viaWhatsapp');
});
