import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  effectiveChoice,
  encodeLadder,
  FREEZE_AFTER_MS,
  freezeFallback,
  freezeStep,
  lanLadder,
  localPolicy,
  planSteps,
  playerPlan,
  retryIndex,
  stationPlayer,
  transportOrder,
  type PlanOptions,
  type Profile,
  type TransportChoice,
  type VideoChannel,
} from '../src/api/video-policy';
import { LEGACY_TRANSPORT_KEY, legacyTransport, parsePolicy, seedFromLegacy } from '../src/api/video-transport';
import type { Me } from '../src/api/types';

// VIDEO-TRANSPORT-2400 (owner decisions 2026-11-04): the transport is exactly what the viewer's choice says on every channel and
// surface; only `auto` tries two. The server decides (backend services/video_transport.py, GET /media/video-policy); the frontend's
// mirror (`planSteps`, the demo mode and an older server) must compute the same table - the case file the backend test pins
// (contracts/fixtures/video_transport/policy_cases.json: every installation x personal x channel x remote.mse_fallback x profile x
// surface). Node only (pure functions); the players on the screens: evidence-video-transport-2400.spec.ts.

const here = path.dirname(fileURLToPath(import.meta.url));
const CASES = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'contracts', 'fixtures', 'video_transport', 'policy_cases.json'), 'utf8')) as {
  installation: TransportChoice | null;
  personal: TransportChoice | null;
  channel: VideoChannel;
  mse_fallback: boolean;
  profile: Profile;
  surface: string;
  choice: TransportChoice;
  source: string;
  order: string[];
  plan: string;
}[];

const SURFACES: Record<string, PlanOptions> = {
  viewer: {},
  wall_default: { autoProfile: true },
  station: { singleProfile: true, offered: { main: ['mse', 'webrtc'], sub: ['mse', 'webrtc'] } },
  station_mse_only: { singleProfile: true, offered: { main: ['mse'] } },
  undecodable_main: { webrtcOk: { main: false, sub: true } },
};

const me = (channel: VideoChannel, mse: 'true' | 'false' = 'true') => ({ channel, remote: channel === 'remote' ? { 'remote.default_profile': 'main', 'remote.mse_fallback': mse } : null }) as unknown as Me;

test.describe('one decision, executed everywhere', () => {
  test('the frontend mirror computes the server case table exactly (480 cases)', () => {
    expect(CASES.length).toBe(480);
    for (const c of CASES) {
      const { choice, source } = effectiveChoice(c.installation, c.personal);
      expect([choice, source], JSON.stringify(c)).toEqual([c.choice, c.source]);
      expect(transportOrder(choice, c.channel, c.mse_fallback), JSON.stringify(c)).toEqual(c.order);
      const steps = planSteps(choice, c.channel, c.profile, { mseFallback: c.mse_fallback, ...SURFACES[c.surface] });
      expect(steps.length ? encodeLadder(steps) : 'none', JSON.stringify(c)).toBe(c.plan);
    }
  });

  test('every setting x channel x personal choice: an explicit choice never plans the other transport', () => {
    for (const c of CASES) {
      if (c.choice === 'auto' || c.plan === 'none') continue;
      expect(new Set(c.plan.split(',').map((s) => s.split(':')[1])), JSON.stringify(c)).toEqual(new Set([c.choice]));
    }
    for (const c of CASES.filter((x) => x.choice === 'auto')) expect(c.order.length >= 1 && c.order[0] === 'webrtc', JSON.stringify(c)).toBe(true);
  });

  test('the remote channel: MSE only is MSE only (lab audit finding 1), whatever remote.mse_fallback says', () => {
    for (const fb of ['true', 'false'] as const) {
      expect(playerPlan('main', null, 'mse', me('remote', fb)).plan).toBe('main:mse');
      expect(playerPlan('sub', null, 'mse', me('remote', fb)).plan).toBe('sub:mse');
    }
    expect(playerPlan('main', null, 'auto', me('remote', 'true')).plan).toBe('main:webrtc,main:mse');
    expect(playerPlan('main', null, 'mse', me('local')).plan, 'local: the player walks its chain of the same choice').toBe('');
    expect(lanLadder('main', 'mse', true)).toEqual([{ profile: 'main', transport: 'mse' }, { profile: 'sub', transport: 'mse' }]);
  });

  test('the settings-derived policy (demo / an older server) has the installation choice only', () => {
    expect(localPolicy('mse', me('remote'))).toMatchObject({ choice: 'mse', source: 'installation', channel: 'remote', order: ['mse'] });
    expect(localPolicy(undefined, me('local'))).toMatchObject({ choice: 'auto', source: 'default', order: ['webrtc', 'mse'], remote: null });
    expect(localPolicy('auto', me('remote', 'false')).order).toEqual(['webrtc']);
  });

  test('a station follows the choice on either profile and never substitutes a transport', () => {
    const both = { main: ['mse', 'webrtc'], sub: ['webrtc', 'mse'] } as const;
    for (const ch of ['local', 'remote'] as const) {
      expect(stationPlayer('mse', 'main', both, null, me(ch)).mode).toBe('mse');
      expect(stationPlayer('webrtc', 'main', both, null, me(ch)).mode).toBe('webrtc');
    }
    expect(stationPlayer('auto', 'main', both, null, me('remote'))).toEqual({ mode: 'auto', plan: 'main:webrtc,main:mse', blocked: false });
    expect(stationPlayer('mse', 'main', both, null, me('remote'))).toEqual({ mode: 'mse', plan: 'main:mse', blocked: false });
    expect(stationPlayer('auto', 'main', both, 'main:mse', me('local')), 'the server plan wins').toEqual({ mode: 'mse', plan: '', blocked: false });
    expect(stationPlayer('webrtc', 'main', both, 'none', me('local')).blocked).toBe(true);
    expect(stationPlayer('webrtc', 'main', { main: ['mse'] }, null, me('local')).blocked).toBe(true);
  });
});

test.describe('the player helpers', () => {
  test('a retry starts from the step that played last, else from the top', () => {
    const steps = planSteps('auto', 'remote', 'main');
    expect(retryIndex(steps, { profile: 'main', transport: 'mse' })).toBe(1);
    expect(retryIndex(steps, null)).toBe(0);
    expect(retryIndex(steps, { profile: 'sub', transport: 'mse' }), 'a step the plan no longer holds').toBe(0);
  });

  test('frozen MSE: the playhead (or, paused, the buffer) must move within FREEZE_AFTER_MS; a hidden tab is never judged', () => {
    let r = freezeStep(null, { t: 1, end: 3, now: 0, paused: false });
    expect(r.frozen).toBe(false);
    r = freezeStep(r.mark, { t: 1.01, end: 3, now: FREEZE_AFTER_MS - 1, paused: false });
    expect(r.frozen).toBe(false);
    r = freezeStep(r.mark, { t: 1.01, end: 9, now: FREEZE_AFTER_MS, paused: false });
    expect(r.frozen, 'the buffer grows but the playhead is stuck: a stalled decoder').toBe(true);
    const moving = freezeStep({ t: 1, end: 3, at: 0 }, { t: 2, end: 3, now: 60_000, paused: false });
    expect(moving).toEqual({ frozen: false, mark: { t: 2, end: 3, at: 60_000 } });
    expect(freezeStep({ t: 1, end: 3, at: 0 }, { t: 1, end: 4, now: 60_000, paused: true }).frozen, 'paused (autoplay refused) but data arrives').toBe(false);
    expect(freezeStep({ t: 1, end: 3, at: 0 }, { t: 1, end: 3, now: 60_000, paused: true }).frozen).toBe(true);
    expect(freezeStep({ t: 1, end: 3, at: 0 }, { t: 1, end: 3, now: 60_000, paused: false, hidden: true })).toEqual({ frozen: false, mark: null });
  });

  test('after repeated freezes only `auto` moves on to WebRTC', () => {
    const auto = planSteps('auto', 'local', 'sub');
    expect(freezeFallback(auto, { profile: 'sub', transport: 'mse' }, 'auto')).toEqual({ profile: 'sub', transport: 'webrtc' });
    expect(freezeFallback(planSteps('mse', 'local', 'sub'), { profile: 'sub', transport: 'mse' }, 'mse')).toBeNull();
    expect(freezeFallback(auto, { profile: 'sub', transport: 'mse' }, 'mse')).toBeNull();
    expect(freezeFallback(planSteps('auto', 'remote', 'main', { mseFallback: true }), { profile: 'main', transport: 'mse' }, 'auto')).toEqual({ profile: 'main', transport: 'webrtc' });
  });
});

test.describe('the personal choice moves to the server', () => {
  const store = (v: string | null) => {
    const m = new Map<string, string>(v === null ? [] : [[LEGACY_TRANSPORT_KEY, v]]);
    return { getItem: (k: string) => m.get(k) ?? null, removeItem: (k: string) => void m.delete(k), has: () => m.has(LEGACY_TRANSPORT_KEY) };
  };
  const policy = (personal: TransportChoice | null) => parsePolicy({ choice: personal ?? 'auto', source: personal ? 'personal' : 'installation', installation: 'auto', personal, channel: 'local', order: [] })!;

  test('the old per-browser key seeds an empty server choice once, then is gone', async () => {
    const s = store('mse');
    const puts: string[] = [];
    const out = await seedFromLegacy(policy(null), { put: async (v) => void puts.push(v), reload: async () => policy('mse') }, s);
    expect(puts).toEqual(['mse']);
    expect(out.choice).toBe('mse');
    expect(s.has()).toBe(false);
    expect(legacyTransport(s)).toBeNull();
  });

  test('a server choice already set wins; a failed seed keeps the installation choice; the key is removed either way', async () => {
    const s1 = store('webrtc');
    const puts: string[] = [];
    expect((await seedFromLegacy(policy('mse'), { put: async (v) => void puts.push(v), reload: async () => null }, s1)).choice).toBe('mse');
    expect(puts).toEqual([]);
    expect(s1.has()).toBe(false);
    const s2 = store('webrtc');
    const out = await seedFromLegacy(policy(null), { put: async () => Promise.reject(new Error('403')), reload: async () => null }, s2);
    expect(out.choice).toBe('auto');
    expect(s2.has()).toBe(false);
    const s3 = store('garbage');
    expect((await seedFromLegacy(policy(null), { put: async () => undefined, reload: async () => null }, s3)).choice).toBe('auto');
  });

  test('the server answer is checked; anything unreadable is not a policy', () => {
    expect(parsePolicy(null)).toBeNull();
    expect(parsePolicy({ choice: 'hls' })).toBeNull();
    expect(parsePolicy({ choice: 'mse', source: 'personal', channel: 'remote', order: ['mse'], remote: { default_profile: 'sub', mse_fallback: false } })).toMatchObject({ choice: 'mse', explicit: true, channel: 'remote', remote: { default_profile: 'sub', mse_fallback: false } });
  });
});
