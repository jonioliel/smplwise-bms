import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { arrivalWire } from '../src/public-ticket/rfq/rfq-page-terms';
import { RFQ_TEXT_HE, RFQ_TEXT_EN_KEYS } from '../src/tickets/rfq-text';
import { refusalKey, eventLine } from '../src/tickets/rfq-model';
import { RFQ_NOTIFY_HE, RFQ_NOTIFY_EN } from '../src/i18n/rfq-notify';
import type { RfqEvent } from '../src/api/tickets-rfq';

// CR-AWARD-NOTICE (RFQ contract 20.16 / 20.17): the vendor page's postponement wire, the manager screens' words, refusals and timeline
// lines, the notification label - pure logic (node only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-rfq-award-notice.spec.ts

const HERE = path.dirname(fileURLToPath(import.meta.url));

test('the postponement wire carries the day (start of day in the building zone) and the trimmed reason only - no acknowledgement', () => {
  const body = arrivalWire('postpone', { ack: true, open: false, from: '2026-11-01', to: '', pp: true, pf: '2026-11-20', why: '  ספק החלקים איחר  ' }, 'Asia/Jerusalem');
  expect(Object.keys(body).sort()).toEqual(['action', 'reason', 'work_from']);
  expect(body.action).toBe('postpone');
  expect(body.reason).toBe('ספק החלקים איחר');
  expect(String(body.work_from)).toMatch(/^2026-11-19T22:00:00(\.000)?Z$/); // 00:00 in Israel (UTC+2 in November)
  // confirm / propose are unchanged (the schedule acknowledgement stays theirs)
  expect(arrivalWire('confirm', { ack: true, open: false, from: '', to: '' }, 'Asia/Jerusalem')).toEqual({ action: 'confirm', acknowledge_schedule: true });
});

test('the manager words exist in Hebrew and English; refusals and timeline kinds map to them', () => {
  const keys = ['ev_award_notice', 'ev_award_notice_failed', 'ev_vendor_postponement', 'ev_postponement_acknowledged', 'anTitle', 'anSend', 'anAuto',
    'anAutoSkip', 'anNote', 'anCannot', 'anWhy_vendor', 'anWhy_page', 'anWhy_link', 'anWhy_channel', 'anWhy_outbox', 'anSentAt', 'anNotSent',
    'anSendNow', 'anSentDone', 'ppTitle', 'ppProposed', 'ppScheduled', 'ppLeadBefore', 'ppLeadAfter', 'ppReason', 'ppAck', 'ppAckDone',
    'ppMoveHint', 'err_award_notice_unavailable', 'err_award_notice_off', 'err_postponement_not_found'];
  for (const k of keys) {
    expect(Object.keys(RFQ_TEXT_HE)).toContain(k);
    expect(RFQ_TEXT_EN_KEYS).toContain(k);
  }
  for (const code of ['award_notice_unavailable', 'award_notice_off', 'postponement_not_found']) expect(refusalKey(code)).toBe(`err_${code}`);
  const ev = (kind: string, data: Record<string, unknown> = {}): RfqEvent => ({ id: 1, kind, at: '2026-11-01T08:00:00Z', vendor_id: 'v1', actor: { kind: 'user', name: 'דנה' }, data } as RfqEvent);
  const name = () => 'קליימה-טק';
  const money = () => '';
  expect(eventLine(ev('award_notice', { queued: true }), name, money).key).toBe('ev_award_notice');
  expect(eventLine(ev('award_notice', { queued: false, reason: 'link' }), name, money).key).toBe('ev_award_notice_failed');
  expect(eventLine(ev('vendor_postponement', { lead_seconds: 3600 }), name, money).key).toBe('ev_vendor_postponement');
  expect(eventLine(ev('postponement_acknowledged'), name, money).key).toBe('ev_postponement_acknowledged');
});

test('the notification label is the backend catalogue\'s Hebrew and has an English column', () => {
  const src = readFileSync(path.resolve(HERE, '../../smplwise_vms/backend/smplwise/services/tickets/notify_sources.py'), 'utf8');
  expect(src).toContain(`"rfq.vendor_postponement", "label": "${RFQ_NOTIFY_HE['rfq.vendor_postponement']}"`);
  expect(RFQ_NOTIFY_EN['rfq.vendor_postponement']).toBeTruthy();
});

test('the vendor page shows the server\'s sentence (no copy in the page bundle) and never builds markup from it', () => {
  const terms = readFileSync(path.resolve(HERE, '../src/public-ticket/rfq/rfq-page-terms.ts'), 'utf8');
  expect(terms).toContain('b.text');
  expect(terms).not.toMatch(/innerHTML|insertAdjacentHTML/);
  expect(terms).not.toMatch(/מחייבת|and binding/); // the sentence lives on the server (rfq_award_notice.PAGE_TEXT)
});

test('owner 2026-10-17: a late postponement notice reads as a tag on the timeline; the words exist in Hebrew and English', () => {
  for (const k of ['ev_vendor_postponement_late', 'ppLate', 'ppLateTitle']) {
    expect(Object.keys(RFQ_TEXT_HE)).toContain(k);
    expect(RFQ_TEXT_EN_KEYS).toContain(k);
  }
  const ev = (data: Record<string, unknown>): RfqEvent => ({ id: 2, kind: 'vendor_postponement', at: '2026-11-01T08:00:00Z', vendor_id: 'v1', actor: { kind: 'contact', name: '' }, data } as RfqEvent);
  expect(eventLine(ev({ late: true }), () => 'x', () => '').key).toBe('ev_vendor_postponement_late');
  expect(eventLine(ev({ late: false }), () => 'x', () => '').key).toBe('ev_vendor_postponement');
});
