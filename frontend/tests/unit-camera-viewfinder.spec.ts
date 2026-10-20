import { test, expect } from '@playwright/test';
import {
  MAX_SIDE, VIDEO_CONSTRAINTS, captureName, classifyCameraError, frameSize, stopStream, viewfinderAvailable,
} from '../src/tickets/camera-viewfinder-model';

// CR-CAMVF-295 (docs/changes/CR-CAMVF-295-SECURITY.md): the pure rules of the opt-in live camera viewfinder.
//   npx playwright test -c playwright.unit.config.ts tests/unit-camera-viewfinder.spec.ts

const OK = { secure: true, hasGetUserMedia: true };

test('available only with the switch strictly true, a ticket that takes photos and a capable secure browser', () => {
  expect(viewfinderAvailable(true, true, OK)).toBe(true);
  for (const setting of [false, undefined, null, 'true', 1, 'on']) expect(viewfinderAvailable(setting, true, OK), String(setting)).toBe(false);
  expect(viewfinderAvailable(true, false, OK)).toBe(false);
  expect(viewfinderAvailable(true, true, { secure: false, hasGetUserMedia: true }), 'insecure context (http LAN Ingress)').toBe(false);
  expect(viewfinderAvailable(true, true, { secure: true, hasGetUserMedia: false })).toBe(false);
});

test('every getUserMedia rejection maps to one of five outcomes', () => {
  const cases: [string, string][] = [
    ['NotAllowedError', 'denied'], ['PermissionDeniedError', 'denied'], ['SecurityError', 'denied'],
    ['NotFoundError', 'no_camera'], ['OverconstrainedError', 'no_camera'], ['DevicesNotFoundError', 'no_camera'],
    ['NotReadableError', 'busy'], ['TrackStartError', 'busy'], ['AbortError', 'busy'],
    ['TypeError', 'insecure'], ['WhateverError', 'failed'],
  ];
  for (const [name, want] of cases) expect(classifyCameraError({ name }), name).toBe(want);
  expect(classifyCameraError(null)).toBe('failed');
  expect(classifyCameraError('boom')).toBe('failed');
  expect(classifyCameraError(new Error('x'))).toBe('failed');
});

test('the request never asks for audio and never uses exact constraints', () => {
  expect(VIDEO_CONSTRAINTS.audio).toBe(false);
  expect(JSON.stringify(VIDEO_CONSTRAINTS)).not.toContain('exact');
  expect(JSON.stringify(VIDEO_CONSTRAINTS)).toContain('"environment"');
});

test('the frame is scaled down to the server limit, never up, aspect kept', () => {
  expect(frameSize(4032, 3024)).toEqual({ width: MAX_SIDE, height: 1536 });
  expect(frameSize(3024, 4032)).toEqual({ width: 1536, height: MAX_SIDE });
  expect(frameSize(1280, 720)).toEqual({ width: 1280, height: 720 });
  expect(frameSize(0, 720)).toEqual({ width: 0, height: 0 });
  expect(frameSize(Number.NaN, 10)).toEqual({ width: 0, height: 0 });
});

test('stopStream ends every live track and is safe on null and on ended tracks', () => {
  const track = () => {
    const t = { readyState: 'live' as MediaStreamTrackState, stops: 0, stop() { this.stops += 1; this.readyState = 'ended'; } };
    return t;
  };
  const a = track();
  const b = track();
  const stream = { getTracks: () => [a, b] as unknown as MediaStreamTrack[] };
  expect(stopStream(stream)).toBe(2);
  expect([a.readyState, b.readyState]).toEqual(['ended', 'ended']);
  expect(stopStream(stream), 'a second stop finds nothing live').toBe(0);
  expect(stopStream(null)).toBe(0);
  expect(stopStream(undefined)).toBe(0);
});

test('the file name carries a time stamp and nothing else', () => {
  expect(captureName(new Date(2026, 9, 20, 7, 5, 9))).toBe('camera-20261020-070509.jpg');
});
