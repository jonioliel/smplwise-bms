/**
 * WebGL availability (T087, ruling R-P4-5): the 3D toggle is disabled with a Hebrew note when the browser gives no
 * context, and the 2D map stays as it is. Checked once per page (creating contexts is not free).
 */
export const WEBGL_UNAVAILABLE_HE = 'תלת-ממד לא זמין בדפדפן זה';

let known: boolean | null = null;

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

/** Forget the cached answer (tests). */
export function resetWebglCheck(): void {
  known = null;
}
