import type { Page } from '@playwright/test';

/**
 * Wait until the page has really stopped changing, instead of sleeping for a fixed time and hoping the machine was fast enough.
 * A pixel spec compares the whole viewport with 0 (or a handful of) differing pixels, so a screenshot taken while a late fixture
 * answer, a lazily imported chunk, a web font or a Lit update is still on its way differs from the baseline - on a busy runner
 * the old fixed waits (400 / 500 / 900 ms) were simply too short.
 *
 * Settled means, for `quietMs` of consecutive animation frames: fonts loaded, no image still loading, no Lit element with a pending
 * update (shadow roots included), no finite animation or transition running, and the element count / document height unchanged.
 * The quiet window restarts whenever any of that moves, so it adapts to the load; `timeout` only bounds a page that never settles.
 */
export async function settlePage(page: Page, opts: { quietMs?: number; timeout?: number } = {}): Promise<void> {
  const { quietMs = 400, timeout = 20_000 } = opts;
  await page.evaluate(() => document.fonts.ready);
  await page.waitForLoadState('networkidle', { timeout }).catch(() => undefined);
  const settled = await page.evaluate(
    async ({ quietMs: quiet, timeout: limit }) => {
      const walk = (root: ParentNode, out: Element[]): Element[] => {
        for (const el of Array.from(root.querySelectorAll('*'))) {
          out.push(el);
          const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
          if (sr) walk(sr, out);
        }
        return out;
      };
      const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
      const snapshot = (): string => {
        const els = walk(document, []);
        let pending = 0;
        let loading = 0;
        for (const el of els) {
          if ((el as Element & { isUpdatePending?: boolean }).isUpdatePending) pending++;
          if (el instanceof HTMLImageElement && !el.complete) loading++;
        }
        const animating = document.getAnimations().filter((a) => a.playState === 'running' && Number.isFinite(a.effect?.getTiming().iterations ?? 1)).length;
        return JSON.stringify([els.length, pending, loading, animating, document.documentElement.scrollHeight, document.fonts.status]);
      };
      const start = performance.now();
      let last = '';
      let since = performance.now();
      while (performance.now() - start < limit) {
        await frame();
        await frame();
        const now = snapshot();
        const parsed = JSON.parse(now) as [number, number, number, number, number, string];
        const busy = parsed[1] > 0 || parsed[2] > 0 || parsed[3] > 0 || parsed[5] !== 'loaded';
        if (now !== last || busy) {
          last = now;
          since = performance.now();
        } else if (performance.now() - since >= quiet) return true;
      }
      return false;
    },
    { quietMs, timeout },
  );
  if (!settled) throw new Error(`the page did not settle within ${timeout} ms (a pixel check on a moving page is meaningless)`);
}
