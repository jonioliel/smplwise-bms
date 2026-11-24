import type { Locator } from '@playwright/test';

/**
 * FLAKY-SWEEP-2480: after a level-3 rung button, the style guide host answers the element's `realistic-change` with a new description
 * that carries `real` (styleguide-screen onRealistic), and the element rebuilds the level-3 graph inside its own update - seconds of
 * main-thread work on SwiftShader. The specs polled `description.real` from Node with a 20 s / 30 s budget; every poll is a page
 * evaluation that waits behind that same work, so on a loaded runner the budget ran out while the page was simply busy (2.45.0 gate:
 * unit-plan-3d-realistic L48; 2.46.0 gate: unit-plan-3d-look-r3 L44). This waits inside the page for the real condition - the
 * description with its realistic part has arrived - one host update, element update and frame at a time. No clock of its own: the
 * test's timeout bounds it, as it bounds the build.
 */
export async function realisticDescription(el: Locator): Promise<void> {
  await el.evaluate(async (n) => {
    const e = n as HTMLElement & { description?: { real?: unknown } | null; updateComplete: Promise<boolean> };
    const root = n.getRootNode();
    const host = (root instanceof ShadowRoot ? root.host : null) as (Element & { updateComplete?: Promise<boolean> }) | null;
    while (!e.description?.real) {
      await host?.updateComplete;
      await e.updateComplete;
      await new Promise((r) => requestAnimationFrame(r));
    }
  });
}
