import type { Page } from '@playwright/test';

/**
 * GATE-FIX-2270: wait until the page's finite animations and transitions have ended, so a geometry check reads the resting layout.
 * The R5 round (POLISH-CLASSIC-DOMUS-297, owner-approved) opens a desktop dropdown list from scale(0.97) with `@starting-style`; a
 * measurement taken right after the click read the panel, its rows and its edges at 97 % (232.8 instead of 240 px, 42.7 instead of
 * 44 px). This waits two frames (Lit renders, the transition starts), then for every running animation with a finite end in the
 * document and in every open shadow root, capped at `timeout` ms. Infinite animations (spinners, shimmer) are ignored.
 */
export async function settle(page: Page, timeout = 2000): Promise<void> {
  await page.evaluate(async (cap) => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const all = new Set<Animation>();
    const walk = (root: Document | ShadowRoot) => {
      for (const a of root.getAnimations()) all.add(a);
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) walk(el.shadowRoot);
      });
    };
    walk(document);
    const finite = [...all].filter((a) => a.playState === 'running' && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
    if (!finite.length) return;
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, cap))]);
  }, timeout);
}
