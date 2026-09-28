/**
 * The timing constants and the one timing helper of the 3D element (CR-006 slice 1a/1b), kept apart from the element
 * so a node spec can pin them without Lit or three: the frame-budget probe's windows and the settings wait.
 */

/** Level 2 is measured over this window from its first reported frame (continuous frames); under `minFps` it falls
 * back. The first frame itself is not timed: shader compilation and the shadow map build are one-off costs. */
export const PROBE_MS = 2500;
/** The timer that decides when no report landed in time: the window plus a generous slack, so a device that reports
 * once a second (the counters go out at most once a second) still gets its own verdict (review nit of slice 1a). */
export const PROBE_FALLBACK_MS = PROBE_MS + 1500;
/** No frame reported this long after level 2 started: the device cannot draw it at all - fall back. */
export const PROBE_FIRST_FRAME_MS = 10000;
/** The window opens only after this many frames drew at level 2: the first ones compile the shaders and build the
 * shadow map (seconds on a software renderer), which is a one-off cost, not the device's rate. */
export const PROBE_WARM_FRAMES = 3;
/** The element waits this long for the installation's settings before it builds at level 1 (review nit of slice 1a:
 * a settings request that hangs must not keep the 3D blank). */
export const SETTINGS_WAIT_MS = 3000;

/** The promise's value, or `fallback` when it has not settled within `ms` (a rejection also gives the fallback). */
export function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve(fallback);
    }, ms);
    p.then(
      (v) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(fallback);
      },
    );
  });
}
