/**
 * PLAN3D-REALISM2-2433 S1: the baked AO volume off the main thread (ao-volume.ts does the work; the same bytes as the
 * in-thread fallback). One message in: { id, input }; one out: { id, volume } (the data buffer transferred) or { id, error }.
 */
import { bakeAoVolume, type AoVolumeInput } from './ao-volume';

interface Req {
  id: number;
  input: AoVolumeInput;
}
const scope = self as unknown as { onmessage: ((e: MessageEvent<Req>) => void) | null; postMessage: (m: unknown, t?: Transferable[]) => void };
scope.onmessage = (e: MessageEvent<Req>) => {
  const { id, input } = e.data;
  bakeAoVolume(input, { now: () => performance.now() })
    .then((volume) => scope.postMessage({ id, volume }, volume ? [volume.data.buffer] : []))
    .catch((err: unknown) => scope.postMessage({ id, error: err instanceof Error ? err.message : String(err) }));
};
