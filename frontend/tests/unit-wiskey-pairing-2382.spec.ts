import { test, expect } from '@playwright/test';
import { featureCounts, groupFeatures, KIND_TEXT, probeIsStale, PROBE_STALE_MS, VERDICT_TEXT, type FeatureRow, type PairingProbe } from '../src/api/wiskey-pairing';

// WISKEY-PAIRING-2382: the pure helpers of the pairing block (node only).
//   npx playwright test -c playwright.unit.config.ts tests/unit-wiskey-pairing-2382.spec.ts
const probe = (at: string): PairingProbe => ({ at, accepted: true, code: null, outcome: null, service_subject: true, repository: true, capabilities: null, discovery_error: null });
const row = (key: string, group: string, state: FeatureRow['state']): FeatureRow => ({ row: 1, key, group, label: key, state, reasons: [], link: null });

test('a missing, unparsable or old probe is stale; a fresh one is not', () => {
  const now = Date.parse('2026-11-03T18:00:00Z');
  expect(probeIsStale(null, now)).toBe(true);
  expect(probeIsStale(probe('not a date'), now)).toBe(true);
  expect(probeIsStale(probe('2026-11-03T17:59:00Z'), now)).toBe(false);
  expect(probeIsStale(probe(new Date(now - PROBE_STALE_MS - 1).toISOString()), now)).toBe(true);
});

test('features keep the server order inside groups and the groups their first appearance', () => {
  const rows = [row('a', 'חיבור', 'on'), row('b', 'מדיה', 'blocked'), row('c', 'חיבור', 'off'), row('d', 'דלתות', 'unknown')];
  expect(groupFeatures(rows).map(([g, rs]) => [g, rs.map((r) => r.key)])).toEqual([['חיבור', ['a', 'c']], ['מדיה', ['b']], ['דלתות', ['d']]]);
  expect(featureCounts(rows)).toEqual({ on: 1, off: 1, blocked: 1, unknown: 1 });
  expect(featureCounts([])).toEqual({ on: 0, off: 0, blocked: 0, unknown: 0 });
});

test('every verdict and reason kind has Hebrew text', () => {
  for (const t of [...Object.values(VERDICT_TEXT), ...Object.values(KIND_TEXT)]) expect(t).toMatch(/[֐-׿]/);
  expect(Object.keys(KIND_TEXT).sort()).toEqual(['OWN', 'PAIR', 'POL', 'RUN', 'SET', 'WK']);
});
