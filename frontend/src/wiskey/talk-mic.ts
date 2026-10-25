/**
 * The microphone of a talk session (CR-036 slice S18): getUserMedia -> Web Audio -> 8 kHz -> G.711 frames (wiskey/g711.ts).
 * Frames are produced only while the session says the microphone is open and unmuted (`setActive(true)`); the track is disabled
 * otherwise, and `stop()` releases the device (the browser's microphone indicator goes off).
 *
 * WKF01F02-295 (full duplex, owner 25.10) - echo / feedback: the microphone stays open while the station's sound plays, so
 * - the browser's own echo canceller is requested (`echoCancellation: true`, with noise suppression and gain control) and what the
 *   browser actually applied is reported (`echoCancellation` on the handle, from the track's settings; null when it does not say);
 *   the talk screen tells the operator to use a headset when it is off;
 * - there is no software loop: the station's packets play from their own buffer sources straight to the speakers, and the
 *   microphone graph (source -> script processor) writes silence (its output buffer is never filled), so no station sample is
 *   ever routed back into the microphone path; the live video's own sound is muted for the whole talk (`talk-floor`).
 * Whether the acoustic echo is cancelled on a given device / browser is NOT measured here (no real microphone or speaker).
 *
 * A ScriptProcessorNode rather than an AudioWorklet on purpose: a worklet module must be fetched from a URL, which the add-on's
 * strict Content-Security-Policy and the Ingress path make fragile, and 8 kHz voice needs no more than the main thread gives.
 */
import { Downsampler, FramePacker, g711Sample } from './g711';

export type MicProblem = 'insecure' | 'denied' | 'no_mic' | 'mic_busy' | 'failed';

export class MicFailure extends Error {
  constructor(readonly code: MicProblem) {
    super(code);
  }
}

export interface MicHandle {
  setActive(on: boolean): void;
  stop(): void;
  play?(packet: Uint8Array): void;
  /** Echo cancellation as the browser applied it to the microphone (null: the browser does not say). */
  echoCancellation?: boolean | null;
}

/** The constraints of the talk microphone (exported so a test pins the echo canceller request). */
export const MIC_CONSTRAINTS: MediaStreamConstraints = {
  audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

/** The microphone permission as far as the browser says without asking: `insecure` when no microphone can be had at all here
 * (a plain-HTTP page), `unknown` when the browser does not tell. */
export async function micPermission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown' | 'insecure'> {
  if (typeof window === 'undefined' || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) return 'insecure';
  try {
    const status = await navigator.permissions?.query({ name: 'microphone' as PermissionName });
    return status ? (status.state as 'granted' | 'denied' | 'prompt') : 'unknown';
  } catch {
    return 'unknown';
  }
}

function problemOf(err: unknown): MicProblem {
  const name = (err as { name?: string } | null)?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no_mic';
  if (name === 'NotReadableError' || name === 'AbortError' || name === 'TrackStartError') return 'mic_busy';
  return 'failed';
}

export async function openMic(codec: 'pcmu' | 'pcma', frameBytes: number, onFrame: (frame: Uint8Array) => void): Promise<MicHandle> {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new MicFailure('insecure');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  } catch (err) {
    throw new MicFailure(problemOf(err));
  }
  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new MicFailure('no_mic');
  }
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    stream.getTracks().forEach((t) => t.stop());
    throw new MicFailure('failed');
  }
  const source = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const down = new Downsampler(ctx.sampleRate, 8000);
  const pack = new FramePacker(codec, frameBytes);
  let active = false;
  let stopped = false;
  let playAt = 0;
  const playing = new Set<AudioBufferSourceNode>();
  track.enabled = false;
  proc.onaudioprocess = (ev: AudioProcessingEvent) => {
    if (!active) return;
    for (const frame of pack.push(down.push(ev.inputBuffer.getChannelData(0)))) onFrame(frame);
  };
  source.connect(proc);
  proc.connect(ctx.destination); // a script processor runs only when connected; it writes silence (its output is never filled)
  const applied = typeof track.getSettings === 'function' ? track.getSettings().echoCancellation : undefined;
  return {
    echoCancellation: typeof applied === 'boolean' ? applied : null,
    play(packet: Uint8Array) {
      if (stopped || packet.byteLength !== 800) return;
      if (ctx.state === 'suspended') void ctx.resume();
      if (playAt > ctx.currentTime + 0.3) {
        for (const node of playing) node.stop();
        playing.clear();
        playAt = ctx.currentTime;
      }
      const buffer = ctx.createBuffer(1, packet.length, 8000);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < packet.length; i++) samples[i] = g711Sample(packet[i], codec);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      playing.add(node);
      node.onended = () => { playing.delete(node); node.disconnect(); };
      playAt = Math.max(ctx.currentTime, playAt);
      node.start(playAt);
      playAt += buffer.duration;
    },
    setActive(on: boolean) {
      active = on;
      track.enabled = on;
      if (!on) pack.reset();
      if (on && ctx.state === 'suspended') void ctx.resume();
    },
    stop() {
      stopped = true;
      for (const node of playing) node.stop();
      playing.clear();
      active = false;
      proc.onaudioprocess = null;
      try {
        proc.disconnect();
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close().catch(() => undefined);
    },
  };
}
