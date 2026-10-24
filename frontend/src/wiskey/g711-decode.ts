/**
 * WKAUDIN-295: the listen side of G.711 - a station's 20 ms frames of 160 bytes (mu-law or A-law, 8 kHz mono) back to samples the browser can
 * play, and the level of a frame for the meter. The counterpart of ./g711.ts (the talk encoder); the reference is the public ITU-T G.711
 * `ulaw2linear` / `alaw2linear` routines. Pure functions, unit-tested without a browser (tests/unit-wkaudin-295.spec.ts). Nothing here keeps audio.
 */

/** One mu-law byte to a 16-bit linear sample. */
export function muLawDecode(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const sample = ((mantissa << 3) + 0x84) << exponent;
  return sign ? 0x84 - sample : sample - 0x84;
}

/** One A-law byte to a 16-bit linear sample. */
export function aLawDecode(byte: number): number {
  const a = byte ^ 0x55;
  const segment = (a & 0x70) >> 4;
  let t = (a & 0x0f) << 4;
  if (segment === 0) t += 8;
  else if (segment === 1) t += 0x108;
  else t = (t + 0x108) << (segment - 1);
  return (a & 0x80) !== 0 ? t : -t;
}

export type ListenCodec = 'pcmu' | 'pcma';

/** A frame as float samples in -1..1. */
export function decodeFrame(frame: ArrayLike<number>, codec: ListenCodec = 'pcmu'): Float32Array {
  const out = new Float32Array(frame.length);
  const f = codec === 'pcma' ? aLawDecode : muLawDecode;
  for (let i = 0; i < frame.length; i += 1) out[i] = f(frame[i] & 0xff) / 32768;
  return out;
}

/** The meter's reading of a frame, 0..1: the RMS scaled so ordinary speech sits mid-bar (speech RMS is small against full scale). */
export function frameLevel(samples: ArrayLike<number>): number {
  if (!samples.length) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

/** The meter after `dtMs` without a new frame: the last reading halves every 150 ms, so a silent station reads empty within a second. */
export function decayLevel(level: number, dtMs: number): number {
  if (dtMs <= 0) return level;
  const v = level * 0.5 ** (dtMs / 150);
  return v < 0.01 ? 0 : v;
}
