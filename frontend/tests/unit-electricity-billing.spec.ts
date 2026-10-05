import { test, expect } from '@playwright/test';
import { astToTokens, coefficients, detectPreset, evaluate, factorLabel, meterIdsOf, parseTokens, presetTokens, sentence, textToTokens, tokensToText, type Tok } from '../src/electricity/elec-formula';
import { baseNumber, billNumber, nextPeriods, periodContaining } from '../src/electricity/elec-format';
import { chartBars, hasComparison } from '../src/electricity/elec-chart-data';
import { mockBackend, mockHistoryWire } from '../src/api/electricity-billing-mock';
import { ERROR_TEXT, PDF_RETRYABLE, buildHistory, eventText, type BillHistory } from '../src/api/electricity-billing';
import { ENERGY_PERMISSIONS, ENERGY_PERMISSION_LABELS, energyPermissionLabel } from '../src/electricity/access';

// Pure logic of the electricity screens (CR-023): the formula grammar and AST, presets, text mode, periods and numbers, the chart data and the golden
// bill of the mock layer. No DOM, no browser (the module imports are DOM-free).
const m = (id: string): Tok => ({ t: 'm', id });
const op = (v: '+' | '-' | '*' | '/' | '(' | ')'): Tok => ({ t: 'op', v });
const num = (v: string, pct = false): Tok => ({ t: 'n', v, pct });
const name = (id: string) => ({ a: 'לוח סטודיו', b: 'תאורת לובי', c: 'מזגן' })[id] ?? id;
const kwh = (id: string) => ({ a: 685.48, b: 302.4, c: 100 })[id] ?? 0;

test.describe('formula engine', () => {
  test('sum, subtraction and percentages evaluate to the CR example', () => {
    const r = parseTokens([m('a'), op('+'), num('30', true), op('*'), m('b')]);
    expect(r.issues).toEqual([]);
    expect(r.ast).toEqual({ op: '+', args: [{ m: 'a' }, { op: '*', args: [{ n: '0.3' }, { m: 'b' }] }] });
    expect(evaluate(r.ast!, kwh)).toBeCloseTo(776.2, 6);
    expect(meterIdsOf(r.ast!)).toEqual(['a', 'b']);
    expect(coefficients(r.ast!)).toEqual({ a: 1, b: 0.3 });
    const sub = parseTokens([m('a'), op('-'), m('b'), op('-'), m('c')]);
    expect(evaluate(sub.ast!, kwh)).toBeCloseTo(283.08, 6);
    expect(coefficients(sub.ast!)).toEqual({ a: 1, b: -1, c: -1 });
  });

  test('meter times a number on the right, division by a constant, parentheses and unary minus', () => {
    expect(evaluate(parseTokens([m('a'), op('*'), num('2')]).ast!, kwh)).toBeCloseTo(1370.96, 6);
    expect(evaluate(parseTokens([m('a'), op('/'), num('2')]).ast!, kwh)).toBeCloseTo(342.74, 6);
    expect(evaluate(parseTokens([num('50', true), op('*'), op('('), m('a'), op('+'), m('b'), op(')')]).ast!, kwh)).toBeCloseTo(493.94, 6);
    expect(evaluate(parseTokens([op('-'), m('a'), op('+'), m('b')]).ast!, kwh)).toBeCloseTo(-383.08, 6);
  });

  test('errors: empty, parentheses, meter times meter, a dangling operator, a number alone', () => {
    const codes = (t: Tok[]) => parseTokens(t).issues.map((i) => i.code);
    expect(codes([])).toEqual(['empty']);
    expect(codes([op('('), m('a')])).toContain('paren_open');
    expect(codes([m('a'), op(')')])).toContain('paren_close');
    expect(codes([m('a'), op('*'), m('b')])).toContain('meter_times_meter');
    expect(codes([m('a'), op('/'), m('b')])).toContain('divide_by_meter');
    expect(codes([m('a'), op('+')])).toContain('dangling');
    expect(codes([num('3')])).toContain('number_alone');
    expect(codes([num('3'), op('*'), num('4')])).toContain('number_times_number');
    expect(parseTokens([m('a'), op('+'), m('a')]).warnings).toHaveLength(1);
    expect(parseTokens([op('('), m('a')]).ast).toBeNull();
  });

  test('presets, detection, text mode and the AST round trip', () => {
    const ids = ['a', 'b', 'c'];
    expect(presetTokens('sum', ids)).toEqual([m('a'), op('+'), m('b'), op('+'), m('c')]);
    expect(detectPreset(presetTokens('sum', ids), ids)).toBe('sum');
    expect(presetTokens('mainsub', ids, { main: 'b' })).toEqual([m('b'), op('-'), m('a'), op('-'), m('c')]);
    expect(detectPreset(presetTokens('mainsub', ids, { main: 'b' }), ids)).toBe('mainsub');
    expect(detectPreset(presetTokens('pct', ids, { pct: '30' }), ids)).toBe('pct');
    expect(detectPreset([m('a'), op('+'), num('2'), op('*'), m('b')], ids)).toBe('custom');
    const toks = [m('a'), op('+'), num('30', true), op('*'), m('b')];
    expect(tokensToText(toks, name)).toBe('[לוח סטודיו] + 30% * [תאורת לובי]');
    expect(sentence(toks, name)).toBe('לוח סטודיו + 30% × תאורת לובי');
    const back = textToTokens('[לוח סטודיו] + 30% * [תאורת לובי]', (n) => ({ 'לוח סטודיו': 'a', 'תאורת לובי': 'b' })[n] ?? null);
    expect(back.issues).toEqual([]);
    expect(back.toks).toEqual(toks);
    expect(textToTokens('[אין כזה]', () => null).issues[0].code).toBe('unknown_meter');
    const ast = parseTokens([m('a'), op('-'), op('('), m('b'), op('+'), m('c'), op(')')]).ast!;
    expect(parseTokens(astToTokens(ast)).ast).toEqual(ast);
    expect(factorLabel(0.3)).toBe('30%');
    expect(factorLabel(-1)).toBe('−');
    expect(factorLabel(1)).toBe('');
  });
});

test.describe('periods and numbers', () => {
  test('monthly and two-monthly periods, the next periods from a first start', () => {
    expect(periodContaining('2026-10-04', 1, 1, 1)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(periodContaining('2026-10-04', 1, 15, 1)).toEqual({ from: '2026-09-15', to: '2026-10-14' });
    expect(periodContaining('2026-10-04', 2, 1, 1)).toEqual({ from: '2026-09-01', to: '2026-10-31' });
    expect(periodContaining('2026-10-04', 2, 1, 2)).toEqual({ from: '2026-10-01', to: '2026-11-30' });
    const p = nextPeriods('2026-02-01', 2, 1, 2, '', 3);
    expect(p.map((x) => `${x.from}..${x.to}`)).toEqual(['2026-02-01..2026-03-31', '2026-04-01..2026-05-31', '2026-06-01..2026-07-31']);
    expect(nextPeriods('2026-10-10', 1, 1, 1, '', 2)[0]).toEqual({ from: '2026-10-10', to: '2026-10-31' });
  });
  test('bill numbers: year-month-customer, revision suffix, running suffix', () => {
    expect(billNumber('2026-09-30', '0001', '')).toBe('2026-09-0001');
    expect(billNumber('2026-12-31', '0001', '', 2)).toBe('2026-12-0001-2');
    expect(baseNumber('2026-12-0001-2')).toBe('2026-12-0001');
    expect(baseNumber('2026-12-0001/2-3')).toBe('2026-12-0001/2');
    expect(baseNumber('2026-09-0002')).toBe('2026-09-0002');
  });
});

const H = (over: Partial<BillHistory>): BillHistory => ({ current: { from: '2026-09-01', to: '2026-09-30', kwh: '776.20' }, previous: [], same_period_last_year: null, ...over });
const P = (ym: string, kwh: string | null, status: 'measured' | 'partial' | 'missing' = 'measured') => ({ from: `${ym}-01`, to: `${ym}-28`, kwh, status, source: null });

test.describe('consumption chart data (owner round 3)', () => {
  test('full data: previous periods oldest first, the current one last, last year first', () => {
    const bars = chartBars(H({ previous: [P('2026-07', '845'), P('2026-08', '812.4')], same_period_last_year: { from: '2025-09-01', to: '2025-09-30', kwh: '690', status: 'measured', source: 'readings' } }));
    expect(bars.map((b) => b.kind)).toEqual(['ly', 'prev', 'prev', 'cur']);
    expect(bars.map((b) => b.kwh)).toEqual([690, 845, 812.4, 776.2]);
    expect(hasComparison(H({ previous: [P('2026-08', '812.4')] }))).toBe(true);
  });
  test('missing periods have no value, partial ones are marked; never more than 12 previous', () => {
    const prev = Array.from({ length: 14 }, (_, i) => P(`2025-${String((i % 12) + 1).padStart(2, '0')}`, i === 3 ? null : '100', i === 5 ? 'partial' : 'measured'));
    const bars = chartBars(H({ previous: prev }));
    expect(bars.filter((b) => b.kind === 'prev')).toHaveLength(12);
    expect(bars.some((b) => b.kwh === null)).toBe(true);
    expect(bars.some((b) => b.partial)).toBe(true);
  });
  test('a first bill with no history draws nothing; last year alone is not invented', () => {
    expect(hasComparison(H({}))).toBe(false);
    expect(chartBars(null)).toEqual([]);
    expect(hasComparison(H({ previous: [P('2026-08', null, 'missing')] }))).toBe(false);
  });
  test('last year that is also a previous period marks that bar instead of adding one', () => {
    const ly = { from: '2025-09-01', to: '2025-09-28', kwh: '700', status: 'measured' as const, source: null };
    const bars = chartBars(H({ previous: [P('2025-09', '700'), P('2025-10', '710')], same_period_last_year: ly }));
    expect(bars.filter((b) => b.kind === 'ly')).toHaveLength(0);
    expect(bars.find((b) => b.lyMark)?.kwh).toBe(700);
  });
});

test.describe('mock layer arithmetic (golden bill)', () => {
  test('776.20 kWh at 0.5430 before VAT: 421.48 + 75.87 = 497.35', async () => {
    const b = await mockBackend.getBill('b102');
    expect(b.snapshot.lines[0].kwh).toBe('776.20');
    expect(b.snapshot.totals.amount_ex_vat).toBe('421.48');
    expect(b.snapshot.totals.vat_amount).toBe('75.87');
    expect(b.total).toBe('497.35');
    expect(b.number).toBe('2026-09-0001');
  });
  test('a price entered including VAT: the customer pays exactly kWh x price', async () => {
    const b = await mockBackend.getBill('b101'); // shared areas, tariff entered including VAT
    expect(b.snapshot.lines[0].price_mode).toBe('inc_vat');
    const k = Number(b.snapshot.lines[0].kwh);
    expect(Number(b.total)).toBeCloseTo(Math.round(k * 0.6402 * 100) / 100, 2);
    expect(b.snapshot.totals.price_mode_note_he).toContain('כולל מע״מ');
  });
  test('lifecycle: issue, send, pay, correct, cancel rules and the overlap refusal', async () => {
    await expect(mockBackend.createBill('a1', { kind: 'last' })).rejects.toMatchObject({ body: { code: 'period_overlap' } });
    const d = await mockBackend.createBill('a4', { kind: 'range', from: '2026-10-01', to: '2026-10-03' });
    expect(d.state).toBe('draft');
    const i = await mockBackend.issueBill(d);
    expect(i.number).toMatch(/^2026-10-0004/);
    await expect(mockBackend.voidBill(i.id, '  ')).rejects.toMatchObject({ body: { code: 'reason_required' } });
    const s = await mockBackend.markSent(i.id, { at: '2026-10-04', how: 'email', note: '' });
    expect(s.state).toBe('sent');
    const p = await mockBackend.markPaid(i.id, { at: '2026-10-04', reference: '' });
    expect(p.state).toBe('paid');
    expect(p.actions).toEqual(['correct', 'pdf']);
    await expect(mockBackend.voidBill(i.id, 'x')).rejects.toMatchObject({ body: { code: 'bill_state' } });
    const c = await mockBackend.correctBill(i.id);
    const ci = await mockBackend.issueBill(c);
    expect(ci.number).toBe(`${i.number}-2`);
    expect((await mockBackend.getBill(i.id)).state).toBe('void');
  });
  test('the account status is derived from the wire answers', async () => {
    const st = await mockBackend.accountStatus('a1');
    expect(st.kwh).toBeGreaterThan(0);
  });
});

test.describe('account history (GET /energy/accounts/{aid}/history?past=N)', () => {
  test('ended periods oldest first: kWh from the issued bill, else the readings; the comparison with the same period last year', () => {
    const w = mockHistoryWire('a1', 12);
    expect(w.periods).toHaveLength(12);
    for (const p of w.periods) expect(p.to < '2026-10-01', 'only ended periods').toBe(true);
    const last = w.periods[w.periods.length - 1];
    expect(last).toMatchObject({ from: '2026-09-01', to: '2026-09-30', kwh: '776.20', status: 'measured', source: 'bill' });
    expect(last.bill?.number).toBe('2026-09-0001');
    expect(w.periods[0]).toMatchObject({ from: '2025-10-01', to: '2025-10-31', status: 'measured', source: 'readings', bill: null });
    // August: the cancelled bill is skipped, the corrected revision counts
    expect(w.periods.find((p) => p.from === '2026-08-01')).toMatchObject({ kwh: '812.40', source: 'bill' });
    expect(w.comparison.current).toEqual({ from: '2026-09-01', to: '2026-09-30', kwh: '776.20' });
    expect(w.comparison.previous).toHaveLength(12);
    // last year comes from the readings: no bill of 2025 is needed
    expect(w.comparison.same_period_last_year).toMatchObject({ from: '2025-09-01', to: '2025-09-30', kwh: '671.80', source: 'readings' });
    expect(mockHistoryWire('a1', 24).periods).toHaveLength(13); // the readings reach 12 periods back, nothing older is invented
    expect(mockHistoryWire('a1', 3).periods.map((p) => p.from)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  test('a missing period stays a row without a number, a partial one is flagged; the change needs both periods', async () => {
    const h = await mockBackend.accountHistory('a2', 12);
    expect(h.rows).toHaveLength(12);
    const miss = h.rows.find((r) => r.from === '2026-02-01')!;
    expect(miss).toMatchObject({ kwh: null, status: 'missing', source: null, change_pct: null, bill: null });
    expect(h.rows.find((r) => r.from === '2026-03-01')!.change_pct).toBeNull();
    expect(h.rows.find((r) => r.from === '2025-10-01')!.status).toBe('partial');
    const jun = h.rows.find((r) => r.from === '2026-06-01')!;
    expect(jun).toMatchObject({ source: 'readings', bill: null });
    expect(jun.amount, 'no bill, no amount').toBeUndefined();
    const aug = h.rows.find((r) => r.from === '2026-08-01')!;
    expect(aug.source).toBe('bill');
    expect(aug.amount).toBe(aug.bill!.total);
    const sep = h.rows[h.rows.length - 1];
    const prev = h.rows[h.rows.length - 2];
    expect(sep.change_pct).toBeCloseTo(((sep.kwh! - prev.kwh!) / prev.kwh!) * 100, 6);
  });

  test('an account with periods but no readings: the billed period only, the rest is no data, no current point', () => {
    const w = mockHistoryWire('a4', 12);
    expect(w.periods.map((p) => [p.from, p.source, p.status])).toEqual([
      ['2026-07-01', null, 'missing'],
      ['2026-08-01', 'bill', 'measured'],
      ['2026-09-01', null, 'missing'],
    ]);
    expect(w.comparison.current).toBeNull();
    expect(w.comparison.same_period_last_year).toBeNull();
  });

  test('buildHistory maps the wire answer: labels, null kWh kept, money only from a bill total', () => {
    const h = buildHistory({
      periods: [
        { from: '2026-07-01', to: '2026-07-31', kwh: '100.00', status: 'measured', source: 'readings', bill: null },
        { from: '2026-08-01', to: '2026-08-31', kwh: null, status: 'missing', source: null, bill: null },
        { from: '2026-09-01', to: '2026-10-31', kwh: '150.00', status: 'partial', source: 'readings', bill: null },
      ],
      comparison: { current: null, previous: [], same_period_last_year: null },
    });
    expect(h.rows.map((r) => r.kwh)).toEqual([100, null, 150]);
    expect(h.rows[1].status).toBe('missing');
    expect(h.rows[2]).toMatchObject({ status: 'partial', change_pct: null });
    expect(h.rows[0].label).toBe('יולי 26');
    expect(h.rows[2].label).toBe('01.09.2026 - 31.10.2026');
    expect(h.rows.every((r) => r.amount === undefined)).toBe(true);
  });
});

test.describe('bill sent / paid and the PDF state', () => {
  test('sent and paid carry a DATE, the server default is today, a stale row_version is refused', async () => {
    const b = await mockBackend.getBill('b104');
    await expect(mockBackend.markSent('b104', { how: 'hand', row_version: b.row_version + 5 })).rejects.toMatchObject({ body: { code: 'revision_conflict' } });
    const s = await mockBackend.markSent('b104', { at: '2026-10-03', how: 'hand', row_version: b.row_version });
    expect(s.sent).toEqual({ at: '2026-10-03', how: 'hand', note: '' });
    const p = await mockBackend.markPaid('b104', { reference: 'A-1', row_version: s.row_version });
    expect(p.paid).toEqual({ at: '2026-10-04', reference: 'A-1' });
    expect((await mockBackend.getBill('b102')).sent?.at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('pdf: ready for a draft, stored for an issued bill, failed with the demo flag until a new render, the error codes', async () => {
    expect((await mockBackend.getBill('b101')).pdf).toMatchObject({ state: 'ready', error_code: null });
    expect((await mockBackend.getBill('b103')).pdf).toMatchObject({ state: 'stored', engine: 'weasyprint' });
    const g = globalThis as { localStorage?: unknown };
    const ctl = (o: object) => (g.localStorage = { getItem: () => JSON.stringify(o) });
    try {
      ctl({ pdf_failed: true });
      expect((await mockBackend.getBill('b102')).pdf).toMatchObject({ state: 'failed', error_code: 'pdf_render_failed' });
      expect((await mockBackend.getBill('b102')).pdf?.failed_at).toMatch(/Z$/);
      await mockBackend.fetchPdf('b102');
      expect((await mockBackend.getBill('b102')).pdf?.state).toBe('stored');
      ctl({ pdf_error: 'pdf_page_limit' });
      await expect(mockBackend.fetchPdf('b102')).rejects.toMatchObject({ status: 422, body: { code: 'pdf_page_limit', retryable: false } });
      expect((await mockBackend.getBill('b102')).pdf).toMatchObject({ state: 'failed', error_code: 'pdf_page_limit' });
      ctl({ pdf_error: 'pdf_timeout' });
      await expect(mockBackend.fetchPdf('b102')).rejects.toMatchObject({ status: 503, body: { code: 'pdf_timeout', retryable: true } });
      ctl({ pdf_error: 'pdf_no_lines' });
      await expect(mockBackend.fetchPdf('b102')).rejects.toMatchObject({ status: 422, body: { code: 'pdf_no_lines', retryable: false } });
      ctl({ pdf_error: 'pdf_invalid_snapshot' });
      await expect(mockBackend.fetchPdf('b102')).rejects.toMatchObject({ status: 422, body: { code: 'pdf_invalid_snapshot', retryable: false } });
      ctl({ pdf_error: 'pdf_unavailable' });
      expect((await mockBackend.getBill('b102')).pdf?.state).toBe('unavailable');
    } finally {
      delete g.localStorage;
    }
    for (const c of ['pdf_render_failed', 'pdf_timeout', 'pdf_page_limit', 'pdf_too_large', 'pdf_no_lines', 'pdf_invalid_snapshot', 'pdf_unavailable']) expect(ERROR_TEXT[c], c).toMatch(/[א-ת]/);
    for (const c of ['pdf_no_lines', 'pdf_invalid_snapshot', 'pdf_page_limit', 'pdf_too_large', 'pdf_unavailable']) expect(PDF_RETRYABLE, c).not.toContain(c);
    for (const c of ['pdf_render_failed', 'pdf_timeout']) expect(PDF_RETRYABLE, c).toContain(c);
    expect(eventText({ at: '', action: 'pdf_failed', actor: { kind: 'system' }, details: { code: 'pdf_timeout' } })).toBe('הפקת ה-PDF נכשלה');
  });
});

test.describe('energy permissions: one source', () => {
  test('three permissions with the approved labels', () => {
    expect([...ENERGY_PERMISSIONS]).toEqual(['energy.view', 'energy.bills', 'energy.manage']);
    expect(ENERGY_PERMISSION_LABELS).toEqual({
      'energy.view': 'צפייה במונים ובצריכה',
      'energy.bills': 'חיובים: סכומים, לקוחות, הפקה וביטול',
      'energy.manage': 'ניהול מונים, חשבונות, לקוחות ומחירים',
    });
    expect(energyPermissionLabel('map.read')).toBeUndefined();
  });
});