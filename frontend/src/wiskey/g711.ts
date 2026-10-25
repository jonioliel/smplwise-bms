/**
 * The talk frames (CR-036 slice S18): microphone samples -> 8 kHz mono -> G.711 (mu-law or A-law) -> 20 ms frames of 160 bytes,
 * the `pcmu_frames` transport of the descriptor contract (docs/changes/CR-036-S18-MEDIA.md). Pure functions and two small
 * classes, so the encoder is unit-tested without a microphone (tests/unit-wiskey-station-media.spec.ts). The reference is the
 * public ITU-T G.711 algorithm (the classic `linear2ulaw` / `linear2alaw` routines).
 */

const MU_BIAS = 0x84;
const MU_CLIP = 32635;

/** One 16-bit linear sample to one mu-law byte. */
export function muLaw(sample: number): number {
  let s = Math.max(-32768, Math.min(32767, Math.round(sample)));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  if (s > MU_CLIP) s = MU_CLIP;
  s += MU_BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; exponent -= 1, mask >>= 1);
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

const A_SEG_END = [0x1f, 0x3f, 0x7f, 0xff, 0x1ff, 0x3ff, 0x7ff, 0xfff];

/** One 16-bit linear sample to one A-law byte. */
export function aLaw(sample: number): number {
  let pcm = Math.max(-32768, Math.min(32767, Math.round(sample))) >> 3;
  let mask: number;
  if (pcm >= 0) mask = 0xd5;
  else {
    mask = 0x55;
    pcm = -pcm - 1;
  }
  let seg = 0;
  while (seg < 8 && pcm > A_SEG_END[seg]) seg += 1;
  if (seg >= 8) return 0x7f ^ mask;
  let aval = seg << 4;
  aval |= seg < 2 ? (pcm >> 1) & 0x0f : (pcm >> seg) & 0x0f;
  return aval ^ mask;
}

/** A float sample (-1..1, Web Audio) as a 16-bit linear one. */
export const to16 = (x: number): number => Math.round(Math.max(-1, Math.min(1, x)) * 32767);

/** Down to 8 kHz by averaging each output period's input samples (a box filter: crude, but enough for a door-station voice
 * channel, and it keeps aliasing below the plain drop-samples way). Keeps its phase between chunks. */
export class Downsampler {
  private readonly ratio: number;
  private pos = 0;
  private acc = 0;
  private count = 0;

  constructor(inRate: number, outRate = 8000) {
    this.ratio = Math.max(1, inRate / outRate);
  }

  push(input: ArrayLike<number>): number[] {
    const out: number[] = [];
    for (let i = 0; i < input.length; i++) {
      this.acc += input[i];
      this.count += 1;
      this.pos += 1;
      if (this.pos >= this.ratio) {
        out.push(this.acc / this.count);
        this.pos -= this.ratio;
        this.acc = 0;
        this.count = 0;
      }
    }
    return out;
  }
}

/** Encodes 8 kHz float samples and hands out whole frames (`frameBytes`, 160 = 20 ms) - never a partial one. */
export class FramePacker {
  private buf: number[] = [];

  constructor(
    private readonly codec: 'pcmu' | 'pcma',
    private readonly frameBytes = 160,
  ) {}

  push(samples8k: ArrayLike<number>): Uint8Array[] {
    const enc = this.codec === 'pcma' ? aLaw : muLaw;
    for (let i = 0; i < samples8k.length; i++) this.buf.push(enc(to16(samples8k[i])));
    const frames: Uint8Array[] = [];
    while (this.buf.length >= this.frameBytes) frames.push(Uint8Array.from(this.buf.splice(0, this.frameBytes)));
    return frames;
  }

  /** Drop what is buffered (the button was released: the next press starts clean). */
  reset(): void {
    this.buf = [];
  }
}

/** The inverse of the original G.711 encoders for the native incoming talk packets. */
export function g711Sample(byte: number, codec: 'pcmu' | 'pcma'): number {
  if (codec === 'pcmu') {
    const v = (~byte) & 255;
    const sample = (((v & 15) << 3) + 0x84) << ((v >> 4) & 7);
    return ((v & 128) ? 0x84 - sample : sample - 0x84) / 32768;
  }
  const v = byte ^ 0x55;
  const exponent = (v >> 4) & 7;
  let sample = (v & 15) << 4;
  sample += exponent === 0 ? 8 : 0x108;
  if (exponent > 1) sample <<= exponent - 1;
  return ((v & 128) ? sample : -sample) / 32768;
}
