import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Batch, BatchItem, BatchVerify, EncodingPreview, ItemVerify } from '../src/api/nvr-batch';
import {
  OUTCOME_TONE,
  REFUSAL_HINT,
  REFUSAL_ITEMS,
  WORKLIST,
  encodingLead,
  encodingUndoLead,
  isVerifyActive,
  normalizeRefusal,
  outcomeLabel,
  outcomeTone,
  recentLabel,
  recentReports,
  recheckErrorLine,
  reportTitle,
  verifyRows,
  verifySummary,
  verifyTabs,
} from '../src/screens/nvr-verify-logic';
import { encodingConfirmModel, startRequest } from '../src/screens/nvr-encoding-logic';
import { batchView, doneToast, undoConfirmModel } from '../src/screens/nvr-batch-logic';

// CAM-H264-VERIFY-2361: the verification report of a bulk encoding change (labels, worklist, summary, re-check words), the refusal policy
// ("לדלג ולהמשיך" default / "לעצור את כל ההמרה") in the confirmation and the start, and source guards (the report only reads, the re-check
// calls only its route). Node only (no page, no server).

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

const v = (outcome: ItemVerify['outcome'], over: Partial<ItemVerify> = {}): ItemVerify => ({ outcome, label: '', detail: '', ...over });
const item = (index: number, status: BatchItem['status'], verify: ItemVerify | null, skipped = false): BatchItem => ({
  index, camera_id: `c${index}`, stream_ref: `${index}01`, status, verify, skipped,
});
const counts = (o: Partial<BatchVerify['counts']> = {}): BatchVerify['counts'] => ({ confirmed: 0, nvr_accepted: 0, still_old: 0, restart_needed: 0, failed: 0, unchanged: 0, ...o });
const verify = (o: Partial<BatchVerify> = {}): BatchVerify => ({ state: 'done', counts: counts(), worklist: [], skipped: [], can_recheck: false, ...o });
const batch = (items: BatchItem[], o: Partial<Batch> = {}): Batch => ({ batch_id: 'b1', kind: 'write', state: 'completed', mode: 'encoding', items, total: items.length, ...o });

test.describe('the report: labels and tones', () => {
  test('the server label wins; the fallbacks name the codec', () => {
    expect(outcomeLabel(v('confirmed', { label: 'המצלמה אישרה (H.264)' }))).toBe('המצלמה אישרה (H.264)');
    expect(outcomeLabel(v('confirmed', { expected: 'H.264' }))).toBe('המצלמה אישרה (H.264)');
    expect(outcomeLabel(v('still_old', { media_codec: 'H.265' }))).toBe('עדיין H.265');
    expect(outcomeLabel(v('nvr_accepted'))).toBe('המקליט קיבל');
    expect(outcomeLabel(v('restart_needed'))).toBe('צריך אתחול');
    expect(outcomeLabel(v('failed', { reason: 'nvr_not_supported' }))).toMatch(/^נכשל: /);
    expect(outcomeLabel(null)).toBe('');
    expect(outcomeLabel({ outcome: 'bogus' } as unknown as ItemVerify)).toBe('');
  });

  test('tones: confirmed ok, still old / restart warn, failed bad, the NVR alone info', () => {
    expect(outcomeTone(v('confirmed'))).toBe('ok');
    expect(outcomeTone(v('still_old'))).toBe('warn');
    expect(outcomeTone(v('restart_needed'))).toBe('warn');
    expect(outcomeTone(v('failed'))).toBe('bad');
    expect(outcomeTone(v('nvr_accepted'))).toBe('info');
    expect(OUTCOME_TONE.unchanged).toBe('muted');
    expect([...WORKLIST].sort()).toEqual(['failed', 'restart_needed', 'still_old']);
  });
});

test.describe('the report: rows, tabs, summary', () => {
  const b = batch([
    item(0, 'applied', v('confirmed')),
    item(1, 'applied', v('still_old')),
    item(2, 'refused', v('failed', { skipped: true }), true),
    item(3, 'applied', v('restart_needed')),
    item(4, 'applied', v('nvr_accepted')),
  ], { verify: verify({ counts: counts({ confirmed: 1, still_old: 1, failed: 1, restart_needed: 1, nvr_accepted: 1 }), skipped: [{ index: 2, camera_id: 'c2', stream_ref: '201' }] }) });

  test('the worklist is the cameras that did not change; the skipped tab lists what the change stepped over', () => {
    expect(verifyRows(b, 'all')).toHaveLength(5);
    expect(verifyRows(b, 'worklist').map((i) => i.index)).toEqual([1, 2, 3]);
    expect(verifyRows(b, 'skipped').map((i) => i.index)).toEqual([2]);
    expect(verifyTabs(b).map((t) => [t.id, t.label, t.count])).toEqual([['all', 'כל הזרמים', 5], ['worklist', 'מצלמות שלא השתנו', 3], ['skipped', 'דולגו', 1]]);
    expect(verifyTabs(batch([item(0, 'applied', v('confirmed'))])).map((t) => t.id)).toEqual(['all', 'worklist']);
  });

  test('the summary line by state', () => {
    expect(verifySummary(b.verify)).toBe('המצלמה אישרה: זרם אחד · המקליט קיבל (לא נבדק במצלמה): זרם אחד · עדיין בקידוד הקודם: זרם אחד · צריך אתחול: זרם אחד · נכשל: זרם אחד · דולגו: זרם אחד');
    expect(verifySummary(verify({ state: 'running' }))).toBe('בודק מה כל מצלמה שולחת בפועל…');
    expect(verifySummary(verify({ state: 'pending' }))).toBe('הבדיקה תתחיל בסיום השינוי.');
    expect(verifySummary(verify({ state: 'interrupted', counts: counts({ confirmed: 2 }) }))).toBe('הבדיקה נקטעה; אפשר לבדוק שוב · המצלמה אישרה: 2 זרמים');
    expect(verifySummary(null)).toBe('');
    expect(isVerifyActive(verify({ state: 'running' })) && isVerifyActive(verify({ state: 'pending' })) && !isVerifyActive(verify())).toBe(true);
  });

  test('titles, the list of earlier reports, the re-check refusals', () => {
    expect(reportTitle({ kind: 'write' })).toBe('דוח בדיקה · שינוי קידוד');
    expect(reportTitle({ kind: 'rollback' })).toBe('דוח בדיקה · החזרה לערכים הקודמים');
    const list = recentReports([
      batch([], { batch_id: 'old', created_at: '2026-11-01T10:00:00Z', settings: { codec: 'H.264' } }),
      batch([], { batch_id: 'svc', mode: 'svc', created_at: '2026-11-02T10:00:00Z' }),
      batch([], { batch_id: 'new', created_at: '2026-11-02T09:00:00Z', kind: 'rollback' }),
    ]);
    expect(list.map((x) => x.batch_id)).toEqual(['new', 'old']);
    expect(recentLabel(list[1])).toMatch(/^המרה ל־H\.264 · \d\d\.\d\d \d\d:\d\d$/);
    expect(recentLabel(list[0])).toMatch(/^החזרה לערכים הקודמים/);
    expect(recheckErrorLine({ status: 429, code: 'verify_too_soon' })).toBe('בדיקה חוזרת אפשרית בעוד כמה שניות.');
    expect(recheckErrorLine({ status: 409, code: 'nothing_to_verify' })).toBe('אין מצלמות לבדיקה חוזרת.');
    expect(recheckErrorLine({ status: 403, code: 'forbidden' })).toBe('אין הרשאה לפעולה הזו.');
  });
});

test.describe('the refusal policy', () => {
  const plan: EncodingPreview = {
    recorder_id: 'nvr-1', settings: { codec: 'H.264' }, counts: { change: 2, unchanged: 0, skip: 0 }, changes_total: 2, adjusted: 0, batch_in_progress: false, on_refusal: 'skip',
    items: [0, 1].map((i) => ({ index: i, camera_id: `c${i}`, stream_ref: `${i}01`, role: 'main', status: 'change' as const, if_match: '0123456789abcdef', changes: { codec: 'H.264' }, fields: { codec: ['H.265', 'H.264'] as [unknown, unknown] }, notes: [], reason: null, message: null })),
  };

  test('the two choices, skip first and the default (owner 2026-11-02)', () => {
    expect(REFUSAL_ITEMS.map((x) => [x.id, x.label])).toEqual([['skip', 'לדלג ולהמשיך'], ['stop', 'לעצור את כל ההמרה']]);
    expect(normalizeRefusal(undefined)).toBe('skip');
    expect(normalizeRefusal('stop')).toBe('stop');
    expect(normalizeRefusal('nonsense', 'stop')).toBe('stop');
    expect(REFUSAL_HINT.skip).toContain('ממשיכה');
    expect(REFUSAL_HINT.stop).toContain('נעצרת');
  });

  test('the confirmation says what a refused camera does; an older server keeps the S2C words', () => {
    expect(encodingConfirmModel(plan, (i) => i.camera_id, 'skip').lead).toBe(encodingLead('skip'));
    expect(encodingLead('skip')).toContain('תדולג וההמרה תמשיך');
    expect(encodingLead('stop')).toContain('ויעצור בשגיאה הראשונה');
    expect(encodingConfirmModel(plan, (i) => i.camera_id).lead).toContain('ויעצור בשגיאה הראשונה');
    expect(undoConfirmModel(['a'], 'encoding', 'skip').lead).toBe(encodingUndoLead('skip'));
    expect(undoConfirmModel(['a'], 'encoding').lead).toContain('ותעצור בשגיאה הראשונה');
  });

  test('the start carries the choice only when the server named its default', () => {
    expect(startRequest(plan, 'stop').on_refusal).toBe('stop');
    expect('on_refusal' in startRequest(plan)).toBe(false);
    expect(startRequest(plan, 'skip').targets).toHaveLength(2);
  });

  test('a completed batch with skipped streams says so (title tone, sub line, toast)', () => {
    const b = batch([item(0, 'applied', null), item(1, 'refused', null, true), item(2, 'applied', null)], { skipped: 1, can_rollback: true });
    const view = batchView(b, (i) => i.camera_id ?? '');
    expect(view.tone).toBe('warn');
    expect(view.sub).toContain('דולג');
    expect(doneToast(b).message).toMatch(/^נשמר .* · דולג /);
    expect(doneToast(batch([item(0, 'applied', null)], { skipped: 0 })).message).not.toContain('דולג');
  });
});

test.describe('source guards', () => {
  test('the report reads only (the batch, the latest batches, the re-check route) and renders server lines as text', () => {
    const report = read('screens/nvr-verify-report.ts');
    expect(report).not.toMatch(/startEncoding|\.undo\(|\.start\(|\.stop\(|unsafeHTML|innerHTML/);
    expect(report).toMatch(/nvrBatch\(\)\.recheck\(/);
    const api = read('api/nvr-batch.ts');
    expect(api).toMatch(/recheck: async \(id\) => normalizeBatch\(await post<Batch>\(`nvr\/stream-batches\/\$\{enc\(id\)\}\/verify`, \{\}\)\)/);
  });

  test('the encoding dialog sends the choice and opens the earlier reports; the batch dialog opens the report', () => {
    const enc = read('screens/nvr-encoding-batch.ts');
    expect(enc).toContain("startRequest(p, this.refusalKnown ? this.onRefusal : undefined)");
    expect(enc).toContain("this.emit('verify-reports')");
    const cb = read('screens/nvr-camera-batch.ts');
    expect(cb).toContain("this.emit('verify-report', { batchId: b.batch_id })");
    const host = read('screens/system-security-cameras.ts');
    expect(host).toContain('<nvr-verify-report');
    expect(host).toMatch(/@verify-report=/);
    expect(read('screens/system-diagnostics.ts')).toContain("this.set('nvr.batch_on_refusal'");
  });
});
