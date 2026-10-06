import { test, expect } from '@playwright/test';
import { clusterBox, clusterMarkers, worstState, type ClusterInput } from '../src/map/marker-cluster';

// M037: the pure clustering. Below the threshold nothing changes; above it crowded pins merge into counted clusters with
// the worst status, the selection stays individual, and the zoom opens clusters up.
const mk = (n: number, spread = 1): ClusterInput[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, x: ((i * 37) % 100) / 100 * spread, y: ((i * 53) % 100) / 100 * spread, state: 'live' as const }));
const base = { planWidth: 1000, planHeight: 700, scale: 0.6 };

test('a small site is untouched (at or below the threshold)', () => {
  const m = mk(60);
  const r = clusterMarkers(m, base);
  expect(r.clusters).toHaveLength(0);
  expect(r.singles).toBe(m);
});

test('a large site clusters, and every marker is in exactly one place', () => {
  const m = mk(300);
  const r = clusterMarkers(m, base);
  expect(r.clusters.length).toBeGreaterThan(0);
  expect(r.singles.length + r.clusters.reduce((t, c) => t + c.members.length, 0)).toBe(300);
  for (const c of r.clusters) expect(c.members.length).toBeGreaterThanOrEqual(2);
  // deterministic
  expect(clusterMarkers(m, base).clusters.map((c) => c.id)).toEqual(r.clusters.map((c) => c.id));
});

test('zooming in splits clusters; at the cap every marker is shown', () => {
  // distinct positions (mk() repeats each position three times for 300 markers, which stay clustered at every zoom below the cap)
  const m: ClusterInput[] = Array.from({ length: 300 }, (_, i) => ({ id: `z${i}`, x: ((i * 37) % 100) / 100, y: ((i * 53) % 100) / 100 * 0.3 + Math.floor(i / 100) * 0.35, state: 'live' as const }));
  const inClusters = (s: number) => clusterMarkers(m, { ...base, scale: s }).clusters.reduce((t, c) => t + c.members.length, 0);
  const far = inClusters(0.6);
  const near = inClusters(1.6);
  expect(near).toBeLessThan(far);
  const cap = clusterMarkers(m, { ...base, scale: 2.5 });
  expect(cap.clusters).toHaveLength(0);
  expect(cap.singles).toHaveLength(300);
});

test('coincident pins always expand at the cap', () => {
  const m = Array.from({ length: 80 }, (_, i) => ({ id: `d${i}`, x: 0.5, y: 0.5, state: 'live' as const }));
  expect(clusterMarkers(m, base).clusters).toHaveLength(1);
  expect(clusterMarkers(m, { ...base, scale: 2.5 }).clusters).toHaveLength(0);
});

test('the cluster takes the worst member status and counts per status', () => {
  const m: ClusterInput[] = Array.from({ length: 70 }, (_, i) => ({ id: `s${i}`, x: 0.5, y: 0.5, state: i === 3 ? 'offline' : i === 4 ? 'stale' : 'live' }));
  const [c] = clusterMarkers(m, base).clusters;
  expect(c.state).toBe('offline');
  expect(c.byState).toEqual({ live: 68, offline: 1, stale: 1 });
  expect(worstState(['live', 'error', 'offline'])).toBe('error');
  expect(worstState(['live', 'neutral'])).toBe('live');
  expect(worstState([])).toBe('neutral');
});

test('selected markers stay individual and a cluster centres on its members', () => {
  const m: ClusterInput[] = Array.from({ length: 70 }, (_, i) => ({ id: `k${i}`, x: 0.2 + (i % 2) * 0.001, y: 0.3, state: 'live' as const }));
  const r = clusterMarkers(m, { ...base, keepIds: ['k5'] });
  expect(r.singles.map((s) => s.id)).toContain('k5');
  expect(r.clusters.flatMap((c) => c.members.map((x) => x.id))).not.toContain('k5');
  const b = clusterBox(r.clusters[0]);
  expect(b.x0).toBeCloseTo(0.2);
  expect(b.x1).toBeCloseTo(0.201);
  expect(r.clusters[0].x).toBeGreaterThan(0.2);
});
