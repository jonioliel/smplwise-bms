import { test, expect } from '@playwright/test';
import { lanLadder, orderLadder, playerPlan, remoteVideoFor } from '../src/api/video-policy';
import type { Me } from '../src/api/types';

// Owner bug 2026-10-01: "WebRTC only" (media.transport_default, or the viewer's override) still played MSE. On the remote
// channel the plan ignored the transport and, with remote.mse_fallback on (the default), ended on MSE. Node only (pure
// functions); the screens: evidence-webrtc-only.spec.ts.

const remoteMe = (mse: 'true' | 'false') => ({ channel: 'remote', remote: { 'remote.default_profile': 'main', 'remote.mse_fallback': mse } }) as unknown as Me;
const lanMe = { channel: 'local', remote: null } as unknown as Me;

test.describe('WebRTC only never plans MSE', () => {
  test('remote plan: an explicit WebRTC choice walks the other profile over WebRTC instead of MSE', () => {
    expect(playerPlan('main', null, 'webrtc', remoteMe('true')).plan).toBe('main:webrtc,sub:webrtc');
    expect(playerPlan('main', null, 'webrtc', remoteMe('false')).plan).toBe('main:webrtc,sub:webrtc');
    expect(playerPlan('sub', { main: { webrtc: 'no' } } as never, 'webrtc', remoteMe('true')).plan).toBe('sub:webrtc');
    expect(playerPlan('main', { main: { webrtc: 'no' }, sub: { webrtc: 'no' } } as never, 'webrtc', remoteMe('true')).plan).toBe('none');
    expect(remoteVideoFor('webrtc', remoteMe('true'))?.mseFallback).toBe(false);
  });

  test('auto / mse / unset keep remote.mse_fallback as it is', () => {
    for (const t of ['auto', 'mse', '']) {
      expect(playerPlan('main', null, t, remoteMe('true')).plan).toBe('main:webrtc,main:mse');
      expect(playerPlan('main', null, t, remoteMe('false')).plan).toBe('main:webrtc,sub:webrtc');
    }
    expect(remoteVideoFor('auto', remoteMe('true'))?.mseFallback).toBe(true);
  });

  test('LAN: no plan; the chain of a WebRTC choice has no MSE step and a remembered MSE step is not replayed', () => {
    expect(playerPlan('main', null, 'webrtc', lanMe).plan).toBe('');
    expect(remoteVideoFor('webrtc', lanMe)).toBeNull();
    const chain = lanLadder('sub', 'webrtc', true);
    expect(chain.every((s) => s.transport === 'webrtc')).toBe(true);
    expect(orderLadder(chain, { profile: 'sub', transport: 'mse' })).toEqual(chain);
    expect(orderLadder(chain, { profile: 'main', transport: 'mse' })).toEqual(chain);
  });
});
