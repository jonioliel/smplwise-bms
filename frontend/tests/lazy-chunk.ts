import type { Page } from '@playwright/test';

/**
 * CR-SHELL-LAZY-2436: a spec that places an on-demand element on the page by hand (document.createElement) must load its chunk first -
 * nothing on the page imports it any more until the person opens the part. Under `vite preview` the chunk's file name comes from the
 * entry chunk (`<name>-<hash>.js` next to it); under the `vite` dev server the source module is imported. Waits until `tag` is defined.
 */
export async function loadLazyChunk(page: Page, tag: string, chunk: string, devModule: string): Promise<void> {
  await page.evaluate(
    async ([t, name, dev]) => {
      if (customElements.get(t)) return;
      const entry = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js$/.test(s));
      let url = new URL(dev, document.baseURI).href;
      if (entry) {
        const m = new RegExp(`${name}-[\\w-]+\\.js`).exec(await (await fetch(entry)).text());
        if (m) url = new URL(`./${m[0]}`, entry).href;
      }
      await import(/* @vite-ignore */ url);
    },
    [tag, chunk, devModule] as const,
  );
  await page.waitForFunction((t) => !!customElements.get(t), tag);
}
