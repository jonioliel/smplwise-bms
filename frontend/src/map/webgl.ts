/**
 * WebGL availability (T087, ruling R-P4-5): the 3D toggle is disabled with a Hebrew note when the browser gives no
 * context, and the 2D map stays as it is. Checked once per page (creating contexts is not free).
 */
export const WEBGL_UNAVAILABLE_HE = 'תלת-ממד לא זמין בדפדפן זה';

import { gpuClass, type GpuClass, type GpuFacts } from './quality-ladder';

let known: boolean | null = null;
let gpu: GpuFacts | null = null;

export function webglAvailable(): boolean {
  if (known !== null) return known;
  try {
    const canvas = document.createElement('canvas');
    known = !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    known = false;
  }
  return known;
}

/** What the browser says about its GPU (PLAN3D-POLISH-2430): read once per page from a throw-away context, which is released at
 * once (WEBGL_lose_context) so it never counts against the browser's context limit. */
export function gpuFacts(): GpuFacts {
  if (gpu) return gpu;
  const nav = (globalThis.navigator ?? {}) as Navigator & { deviceMemory?: number };
  const cores = typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency > 0 ? nav.hardwareConcurrency : null;
  const memoryGb = typeof nav.deviceMemory === 'number' && nav.deviceMemory > 0 ? nav.deviceMemory : null;
  gpu = { renderer: '', webgl2: false, maxTexture: 0, cores, memoryGb };
  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = (gl2 ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (gl) {
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = { renderer: String(gl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? ''), webgl2: !!gl2, maxTexture: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0, cores, memoryGb };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    /* no context: the facts stay empty (weak) */
  }
  return gpu;
}

/** The device's GPU class for the `auto` start (quality-ladder.gpuClass). */
export const detectGpuClass = (): GpuClass => gpuClass(gpuFacts());

/** Forget the cached answer (tests). */
export function resetWebglCheck(): void {
  known = null;
  gpu = null;
}
