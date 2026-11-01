import { test, expect } from '@playwright/test';
import { canDecodeH265, detectH265, h265Param, h265Reaction, H265_REFUSAL_CLOSE, H265_UNSUPPORTED_HE, normalizePolicy, orderForH265, parseServed, servedTag, streamCodec, transcodeCapHe, type H265Env } from '../src/api/h265-support';
import { lanLadder } from '../src/api/video-policy';
import type { CameraEncoding } from '../src/api/types';

// LIVE-H265-2341: the browser's H.265 capability per transport (getCapabilities / isTypeSupported mocked), the per-attempt
// `h265` flag, the MSE-first order of an H.265 stream, and what the player does with the server's choice / refusals.
// Node only (pure functions); the server's selection itself: smplwise_vms/backend/tests/test_live_h265.py.

const env = (webrtcMimes: string[], mseTypes: string[] | null): H265Env => ({
  RTCRtpReceiver: { getCapabilities: (kind: string) => (kind === 'video' ? { codecs: webrtcMimes.map((mimeType) => ({ mimeType })) } : null) },
  MediaSource: mseTypes === null ? undefined : { isTypeSupported: (t: string) => mseTypes.some((m) => t.includes(m)) },
});

const enc = (main: string | null, sub: string | null) => ({ main: main === null ? null : { codec: main, webrtc: 'unknown', reason: '' }, sub: sub === null ? null : { codec: sub, webrtc: 'unknown', reason: '' }, checked_at: '', error: null }) as unknown as CameraEncoding;

test.describe('H.265 capability check', () => {
  test('Chrome / Edge without HEVC: neither transport', () => {
    expect(detectH265(env(['video/VP8', 'video/H264', 'video/AV1'], []))).toEqual({ webrtc: false, mse: false });
  });

  test('hardware HEVC in Chromium: MSE only', () => {
    expect(detectH265(env(['video/H264'], ['hvc1.1.6.L153.B0']))).toEqual({ webrtc: false, mse: true });
    expect(detectH265(env(['video/H264'], ['hev1.1.6.L153.B0']))).toEqual({ webrtc: false, mse: true });
  });

  test('Safari with H.265 over WebRTC: both (the mime type is matched case-insensitively, HEVC too)', () => {
    expect(detectH265(env(['video/H264', 'video/H265'], ['hvc1']))).toEqual({ webrtc: true, mse: true });
    expect(detectH265(env(['video/hevc'], null))).toEqual({ webrtc: true, mse: false });
  });

  test('missing or throwing APIs read as "cannot"', () => {
    expect(detectH265({})).toEqual({ webrtc: false, mse: false });
    expect(detectH265(undefined)).toEqual({ webrtc: false, mse: false });
    const throwing: H265Env = { RTCRtpReceiver: { getCapabilities: () => { throw new Error('x'); } }, MediaSource: { isTypeSupported: () => { throw new Error('y'); } } };
    expect(detectH265(throwing)).toEqual({ webrtc: false, mse: false });
    expect(detectH265({ RTCRtpReceiver: { getCapabilities: () => null } })).toEqual({ webrtc: false, mse: false });
  });

  test('the per-attempt flag follows the transport of the attempt', () => {
    const mseOnly = { webrtc: false, mse: true };
    expect(canDecodeH265(mseOnly, 'webrtc')).toBe(false);
    expect(h265Param(mseOnly, 'webrtc')).toBe('0');
    expect(h265Param(mseOnly, 'mse')).toBe('1');
    expect(h265Param({ webrtc: true, mse: false }, 'webrtc')).toBe('1');
  });
});

test.describe('codec of a stream', () => {
  test('folds the vendor spellings like the server', () => {
    expect(streamCodec(enc('H.265', 'H.264'), 'main')).toBe('h265');
    expect(streamCodec(enc('H.265', 'H.264'), 'sub')).toBe('h264');
    expect(streamCodec(enc('H.265+', null), 'main')).toBe('h265');
    expect(streamCodec(enc('HEVC', null), 'main')).toBe('h265');
    expect(streamCodec(enc('MJPEG', null), 'main')).toBe('mjpeg');
    expect(streamCodec(enc('MPEG4', null), 'main')).toBe('other');
    expect(streamCodec(enc(null, null), 'main')).toBe('unknown');
    expect(streamCodec(null, 'sub')).toBe('unknown');
    expect(streamCodec({ main: { codec: null, reason: 'h265' } } as unknown as CameraEncoding, 'main')).toBe('h265');
  });
});

test.describe('fallback choice in the player', () => {
  const none = { webrtc: false, mse: false };
  const mseOnly = { webrtc: false, mse: true };
  const both = { webrtc: true, mse: true };
  const auto = lanLadder('main', 'auto', false); // main:webrtc, main:mse

  test('an H.265 stream the browser decodes over MSE only starts on MSE (it plays as is)', () => {
    expect(orderForH265(auto, enc('H.265', 'H.264'), mseOnly, 'auto', 'auto').map((s) => s.transport)).toEqual(['mse', 'webrtc']);
    // the wall's default quality (autoProfile): the other profile's steps keep their place after the MSE one
    const wall = orderForH265(lanLadder('main', 'auto', true), enc('H.265', 'H.264'), mseOnly, 'auto', 'transcode');
    expect(wall[0]).toEqual({ profile: 'main', transport: 'mse' });
    expect(wall.length).toBe(4);
  });

  test('otherwise the chain is kept: the server picks the fallback per attempt', () => {
    expect(orderForH265(auto, enc('H.265', 'H.264'), none, 'auto', 'auto')).toEqual(auto); // h265=0 on both: sub, else transcode
    expect(orderForH265(auto, enc('H.265', 'H.264'), both, 'auto', 'auto')).toEqual(auto); // WebRTC decodes it
    expect(orderForH265(auto, enc('H.264', 'H.265'), mseOnly, 'auto', 'auto')).toEqual(auto); // the requested stream is H.264
    expect(orderForH265(auto, enc(null, null), mseOnly, 'auto', 'auto')).toEqual(auto); // unknown codec
    expect(orderForH265(auto, enc('H.265', 'H.264'), mseOnly, 'auto', 'off')).toEqual(auto); // "כבוי": as it is
    const webrtcOnly = lanLadder('main', 'webrtc', false);
    expect(orderForH265(webrtcOnly, enc('H.265', 'H.264'), mseOnly, 'webrtc', 'auto')).toEqual(webrtcOnly); // never MSE on a WebRTC choice
    const mse = lanLadder('main', 'mse', false);
    expect(orderForH265(mse, enc('H.265', 'H.264'), mseOnly, 'mse', 'auto')).toEqual(mse);
    expect(orderForH265([], enc('H.265', 'H.264'), mseOnly, 'auto', 'auto')).toEqual([]);
  });

  test('refusals: the next step first, else the message (no alternative) or the refreshing snapshot (cap)', () => {
    expect(h265Reaction('h265_unsupported', true)).toBe('next');
    expect(h265Reaction('transcode_cap', true)).toBe('next');
    expect(h265Reaction('h265_unsupported', false)).toBe('message');
    expect(h265Reaction('transcode_cap', false)).toBe('still');
    expect(H265_REFUSAL_CLOSE[4415]).toBe('h265_unsupported');
    expect(H265_REFUSAL_CLOSE[4430]).toBe('transcode_cap');
    expect(H265_REFUSAL_CLOSE[4429]).toBeUndefined();
    expect(H265_UNSUPPORTED_HE).toBe('הדפדפן לא תומך בקידוד H.265 של המצלמה; אין זרם חלופי');
    expect(transcodeCapHe(2)).toContain('(2)');
    expect(transcodeCapHe(0)).not.toContain('(');
  });

  test('the server\'s arx/stream frame', () => {
    const sub = parseServed({ requested: 'main', profile: 'sub', variant: '', kind: 'other_profile', codec: 'h264', message: 'm' });
    expect(sub).toEqual({ requested: 'main', profile: 'sub', variant: '', kind: 'other_profile', codec: 'h264', message: 'm' });
    expect(servedTag(sub!)).toBe('זרם משני');
    const tc = parseServed({ requested: 'main', profile: 'main', variant: 'h264', kind: 'transcode' });
    expect(tc?.variant).toBe('h264');
    expect(servedTag(tc!)).toBe('H.264 · תרגום');
    expect(parseServed({ requested: 'main', profile: 'main', kind: 'native' })?.kind).toBe('native');
    expect(parseServed({ requested: 'x', profile: 'main' })).toBeNull();
    expect(parseServed('text')).toBeNull();
    expect(parseServed(null)).toBeNull();
  });

  test('policy values', () => {
    for (const p of ['auto', 'sub', 'transcode', 'off'] as const) expect(normalizePolicy(p)).toBe(p);
    expect(normalizePolicy(undefined)).toBe('auto');
    expect(normalizePolicy('always')).toBe('auto');
  });
});
