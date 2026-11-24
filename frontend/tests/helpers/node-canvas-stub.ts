import { test } from '@playwright/test';

/**
 * FLAKY-SWEEP-2480: a Node-only spec that runs the 3D builders needs a `document.createElement('canvas')` without a 2D context (the
 * contact / disc / band textures then stay blank). It used to be installed at module level with `document ??= {...}` and never taken
 * away again. A Playwright worker runs many spec files in one process, so every later file of that worker saw the stub: lit-html, first
 * imported there, called `document.createTreeWalker` at load ("createTreeWalker is not a function", unit-plan3d-real, 2.46.0 gate), and a
 * spec that put its own `document ??= { baseURI }` kept the canvas stub instead ("Invalid URL", unit-video-sub-fallback-2402). The stub is
 * now there only while this file's tests run, and the previous value comes back after them.
 */
export function nodeCanvasDocument(): void {
  const g = globalThis as { document?: unknown };
  let before: unknown;
  let had = false;
  test.beforeAll(() => {
    had = 'document' in g;
    before = g.document;
    g.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  });
  test.afterAll(() => {
    if (had) g.document = before;
    else delete g.document;
  });
}
