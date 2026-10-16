import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RfqAward, RfqDetail, RfqEvent, RfqVendor } from '../src/api/tickets-rfq';
import { mockRfq, resetDemoRfq } from '../src/api/tickets-rfq-mock';
import { eventLine, notSelectedCount, orderAwards, orderBody, orderForm, orderFormValid, refusalKey, scopeText } from '../src/tickets/rfq-model';
import { RFQ_TEXT_EN_KEYS, RFQ_TEXT_HE, RFQ_TEXT_KEYS } from '../src/tickets/rfq-text';
import { messageEventLine, purposeLabel } from '../src/tickets/message-lines';

// TKRFQ4 (RFQ stage C4, contract v1.2 section 16): the pure logic of the work-order step (tickets/rfq-model.ts), its words, the demo
// store's rules (opening the vendor's item sends nothing; the message leaves only on the explicit send; one item per awarded vendor;
// `ordered` once every approved award has its order) and the item page's lines for an order.
//   npx playwright test -c playwright.unit.config.ts tests/unit-tickets-rfq-order.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const RFQ5 = 'rfq0000000000005';
const RFQ7 = 'rfq0000000000007';

const award = (o: Partial<RfqAward> = {}): RfqAward => ({
  id: 'a1', vendor_id: 'v1', quote_id: 'q1', state: 'approved', line_indexes: [0, 1], finalize: true, first_by: 'דנה', first_at: '', second_required: false, second_by: null,
  second_at: null, revision: 1, currency: 'ILS', subtotal_minor: 1, vat_minor: 0, total_minor: 1, ...o,
});
const vendor = (id: string, state: RfqVendor['state'], quoted = true): RfqVendor => ({
  id, contact: { id: `c-${id}`, name: id, company: '' }, channel: 'whatsapp', state, invited_at: '', sent_at: null, first_opened_at: null, open_count: 0, quoted_at: null,
  declined_at: null, decline_reason: null, link: null, quote: quoted ? { id: `q-${id}`, version: 1, state: 'submitted', created_at: '' } : null, messages: 0, revision: 1,
  can: { remove: false, remind: false, quote_on_behalf: false, decline_on_behalf: false, message: false },
});

test('the approved awards get a work order; the not-selected vendors are counted (they get no message)', () => {
  const d = { awards: [award(), award({ id: 'a2', vendor_id: 'v2', state: 'pending_second' }), award({ id: 'a3', vendor_id: 'v3', state: 'declined' })],
    vendors: [vendor('v1', 'awarded'), vendor('v2', 'quoted'), vendor('v4', 'not_awarded'), vendor('v5', 'declined', false), vendor('v6', 'removed')] } as Pick<RfqDetail, 'awards' | 'vendors'>;
  expect(orderAwards(d).map((a) => a.id)).toEqual(['a1']);
  expect(notSelectedCount(d)).toBe(2); // v2 (quoted, its award pending - not selected yet) and v4; not the one who declined or was removed
});

test('the scope line: the whole quote, the lines of some kinds, or chosen lines', () => {
  const name = (k: string) => ({ labor: 'עבודה', parts: 'חלקים', travel: 'נסיעות', other: 'אחר' })[k] as string;
  expect(scopeText({ kind: 'all', kinds: ['labor', 'parts'], lines: 2 }, name)).toEqual({ key: 'ordScopeAll', vars: {} });
  expect(scopeText({ kind: 'kinds', kinds: ['labor'], lines: 1 }, name)).toEqual({ key: 'ordScopeKinds', vars: { kinds: 'עבודה' } });
  expect(scopeText({ kind: 'lines', kinds: ['parts'], lines: 3 }, name)).toEqual({ key: 'ordScopeLines', vars: { n: 3 } });
  expect(scopeText(null, name)).toBeNull();
});

test('the order form: the server\'s defaults as local days, an end day not before the start, the body with a request key', () => {
  const f = orderForm(award({ order_defaults: { work_from: '2026-10-20T06:00:00Z', work_to: '2026-10-21T06:00:00Z' } }));
  expect(f.from).toMatch(/^2026-10-20$/);
  expect(f.to).toMatch(/^2026-10-21$/);
  expect(orderForm(award({ order_defaults: null }))).toEqual({ from: '', to: '', docs: '' });
  expect(orderFormValid({ from: '2026-10-20', to: '2026-10-21' })).toBe(true);
  expect(orderFormValid({ from: '2026-10-20', to: '' })).toBe(true);
  expect(orderFormValid({ from: '2026-10-22', to: '2026-10-21' })).toBe(false);
  expect(orderFormValid({ from: '', to: '2026-10-21' })).toBe(false);
  const b = orderBody({ from: '2026-10-20', to: '', docs: '  ' }, 'rfq-abcdef123456');
  expect(b.request_key).toBe('rfq-abcdef123456');
  expect(b.work_from).toBe(b.work_to); // one day = start and end
  expect('documents' in b).toBe(false);
  expect(orderBody({ from: '2026-10-20', to: '2026-10-21', docs: ' נוהל עבודה בגובה ' }, 'k1234567').documents).toBe('נוהל עבודה בגובה');
});

test('timeline rows and refusal codes of the order map to words', () => {
  const ev = (kind: string): RfqEvent => ({ id: 1, kind, at: '', vendor_id: 'v1', actor: { kind: 'user', name: 'דנה' }, data: {} });
  for (const k of ['order_created', 'order_sent']) expect(eventLine(ev(k), () => 'x', () => '').key).toBe(`ev_${k}`);
  for (const code of ['order_exists', 'order_not_found', 'order_channel_unavailable', 'order_link_unavailable', 'order_ticket_closed', 'public_link_unavailable']) {
    expect(RFQ_TEXT_KEYS, code).toContain(refusalKey(code));
  }
});

test('the words: English keys exist in Hebrew; no retired word; the module noun only through its token; no amount in the order message', () => {
  for (const k of RFQ_TEXT_EN_KEYS) expect(RFQ_TEXT_KEYS, k).toContain(k);
  const he = Object.entries(RFQ_TEXT_HE).filter(([k]) => k.startsWith('ord') || k.startsWith('err_order') || k.startsWith('ev_order')).map(([, v]) => v).join('\n');
  expect(he).not.toMatch(/קריא(ה|ות|ת)/);
  expect(he).not.toMatch(/דרישת עלות/);
  expect(he).not.toMatch(/בקש(ת|ות) ה?שירות/);
  for (const f of ['tickets/rfq-order.ts', 'tickets/overview-tab.ts', 'tickets/drawer-text.ts', 'tickets/messages-text.ts']) {
    const src = readFileSync(path.join(SRC, f), 'utf8');
    expect(src, f).not.toMatch(/קריא(ה|ות|ת)/);
    expect(src, f).not.toMatch(/Home Assistant|\bHA\b|Ingress/);
  }
});

test('the item page: the order message has its delivery label and the order rows their timeline lines', () => {
  expect(purposeLabel('rfq_order')).toBe('הזמנת עבודה');
  const ev = (kind: string, data: Record<string, unknown> = {}) => ({ id: 1, kind, at: '', actor: { kind: 'user', name: 'דנה' }, data } as never);
  expect(messageEventLine(ev('rfq_order', { number: 7 }))?.text).toContain('RFQ-07');
  expect(messageEventLine(ev('rfq_order_sent'))?.text).toBe('הזמנת העבודה נשלחה לספק');
});

test('demo store: opening the order sends nothing, the explicit send sends once, a replay opens no second item', async () => {
  resetDemoRfq();
  const d = await mockRfq.get(RFQ5);
  const a = d.awards.find((x) => x.state === 'approved') as RfqAward;
  expect(a.can?.order).toBe(true);
  expect(a.order).toBeNull();
  expect(a.order_defaults?.work_from).toBeTruthy();
  await expect(mockRfq.sendOrder(RFQ5, a.id)).rejects.toMatchObject({ code: 'order_not_found' });
  const first = await mockRfq.createOrder(RFQ5, a.id, { request_key: 'rfq-key-0001' });
  expect(first.award?.order?.sent).toBeNull();
  expect(first.rfq.state).toBe('ordered');
  const again = await mockRfq.createOrder(RFQ5, a.id, { request_key: 'rfq-key-0001' });
  expect(again.replayed).toBe(true);
  expect(again.ticket?.number).toBe(first.ticket?.number);
  await expect(mockRfq.createOrder(RFQ5, a.id, { request_key: 'rfq-key-0002' })).rejects.toMatchObject({ code: 'order_exists' });
  const pv = await mockRfq.orderPreview(RFQ5, a.id);
  expect(pv.text).toContain('[קישור]');
  expect(pv.text).not.toMatch(/₪|\d{1,3},\d{3}/);
  const sent = await mockRfq.sendOrder(RFQ5, a.id);
  expect(sent.notified?.already).toBe(false);
  expect(sent.award?.order?.sent?.channel).toBe('whatsapp');
  expect((await mockRfq.sendOrder(RFQ5, a.id)).notified?.already).toBe(true);
});

test('demo store: a split gives one item per vendor and the request is ordered after the last one; a pending award has none', async () => {
  resetDemoRfq();
  const cmp = await mockRfq.comparison(RFQ7);
  const [q1, q2] = cmp.quotes;
  await mockRfq.award(RFQ7, { quote_id: q1.quote_id, revision: q1.revision, kinds: ['labor'], finalize: false });
  const ans = await mockRfq.award(RFQ7, { quote_id: q2.quote_id, revision: q2.revision, kinds: ['parts'], finalize: true });
  const approved = ans.rfq.awards.filter((x) => x.state === 'approved');
  expect(approved).toHaveLength(2);
  const one = await mockRfq.createOrder(RFQ7, approved[0].id, { request_key: 'rfq-split-0001' });
  expect(one.rfq.state).toBe('awarded');
  const two = await mockRfq.createOrder(RFQ7, approved[1].id, { request_key: 'rfq-split-0002' });
  expect(two.rfq.state).toBe('ordered');
  expect(one.ticket?.number).not.toBe(two.ticket?.number);
});
