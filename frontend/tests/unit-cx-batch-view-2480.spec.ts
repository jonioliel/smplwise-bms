import { test } from '@playwright/test';
import type { Batch, BatchItem, BatchItemStatus, BatchState } from '../src/api/nvr-batch';
import { batchView } from '../src/screens/nvr-batch-logic';
import { expectRecorded } from './cx-record';

// COMPLEXITY-3-2480: characterisation of batchView (screens/nvr-batch-logic.ts) before its split. Every batch state x write / rollback x
// SVC (no mode) / encoding x item mixes (all applied, some unchanged, a failure, an unknown, in flight, not attempted, a listing with counts
// only) x the stop reasons, can_rollback, rollback_of, skipped and total, a running batch with and without "stopping"; the answers must
// equal the record taken from the unsplit function (tests/fixtures/cx/batch-view.json), one line each. Node only:
//   npx playwright test -c playwright.unit.config.ts tests/unit-cx-batch-view-2480.spec.ts --workers=1

const item = (index: number, status: BatchItemStatus): BatchItem => ({ index, camera_id: `c${index}`, stream_ref: `s${index}`, status });
const items = (...s: BatchItemStatus[]) => s.map((x, i) => item(i, x));
const MIXES: Array<[string, Partial<Batch>]> = [
  ['none', { items: [] }],
  ['all-applied', { items: items('applied', 'applied', 'applied') }],
  ['one-applied', { items: items('applied') }],
  ['applied-unchanged', { items: items('applied', 'unchanged', 'unchanged') }],
  ['all-unchanged', { items: items('unchanged', 'unchanged') }],
  ['failed-mid', { items: items('applied', 'failed', 'not_attempted', 'not_attempted') }],
  ['refused-first', { items: items('refused', 'not_attempted') }],
  ['diverged-no-effect', { items: items('applied', 'diverged', 'no_effect') }],
  ['unknown', { items: items('applied', 'unknown', 'not_attempted') }],
  ['unknown-and-failed', { items: items('unknown', 'failed') }],
  ['in-flight', { items: items('applied', 'running', 'queued') }],
  ['pending', { items: items('pending', 'queued') }],
  ['rolled-back', { items: items('rolled_back', 'rolled_back', 'applied') }],
  ['rolled-back-part', { items: items('rolled_back', 'failed', 'not_attempted') }],
  ['counts-only', { counts: { applied: 2, failed: 1, unknown: 1, not_attempted: 3 } }],
  ['counts-total', { counts: { applied: 1 }, total: 4 }],
  ['items-total', { items: items('applied', 'failed'), total: 5 }],
];
const STATES: BatchState[] = ['running', 'completed', 'stopped', 'failed', 'stopped_unknown', 'interrupted'];
const EXTRAS: Array<[string, Partial<Batch>]> = [
  ['plain', {}], ['no-rollback', { can_rollback: false }], ['can-rollback', { can_rollback: true }], ['rollback-of', { rollback_of: 'b0' }],
  ['unknown-unverified', { stopped_reason: 'unknown_unverified' }], ['unknown-not-applied', { stopped_reason: 'unknown_not_applied', rollback_of: 'b0' }],
  ['skipped', { skipped: 2 }], ['skipped-zero', { skipped: 0, stopped_reason: 'user' }],
];

test('batchView: every answer equals the record of the unsplit function', () => {
  const nameOf = (i: BatchItem) => `מצלמה ${i.index + 1}`;
  const text = (v: ReturnType<typeof batchView>) => `${v.tone} | ${v.title} | ${v.sub} | ${[v.canStop, v.showUndo, v.canUndo, v.showRetry].map(Number).join('')}${Object.keys(v).length === 7 ? '' : ` ${JSON.stringify(v)}`}`;
  const out: string[] = [];
  for (const state of STATES) {
    for (const kind of ['write', 'rollback'] as const) {
      for (const mode of [undefined, 'encoding'] as const) {
        for (const [m, mix] of MIXES) {
          for (const [e, extra] of EXTRAS) {
            const b = { batch_id: 'b1', kind, state, ...(mode ? { mode } : {}), ...mix, ...extra } as Batch;
            for (const stopping of [false, true]) {
              if (stopping && state !== 'running') continue;
              out.push(`${state} ${kind} ${mode ?? '-'} ${m} ${e}${stopping ? ' stopping' : ''}: ${text(batchView(b, nameOf, stopping))}`);
            }
          }
        }
      }
    }
  }
  out.push(`default stopping: ${text(batchView({ batch_id: 'b', kind: 'write', state: 'running', items: items('running') } as Batch, nameOf))}`);
  expectRecorded('batch-view', out);
});
