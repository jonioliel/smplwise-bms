import { test } from '@playwright/test';

// TEMPORARY diagnostic for GATE2370-C (removed in the next commit): what in the weather card reaches under the edit bar at 1920 row.
// Needs the Vite DEV server (the harness imports /src/; a preview build has no tests/ page, the gate's classifier reads this line).
test.describe('diag gate2370c', () => {
  for (const skin of ['classic', 'bubble']) {
    test(`diag ${skin}`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop only');
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(`/tests/widget-break-harness/index.html?skin=${skin}&scheme=light`);
      await page.waitForFunction(() => (window as unknown as { wbReady?: boolean }).wbReady === true, null, { timeout: 60_000 });
      await page.evaluate((ids) => (window as unknown as { wbMountRow: (a: string[], b: null, c: object) => Promise<void> }).wbMountRow(ids, null, { layout: 'row', editing: true }), ['clock', 'weather', 'quick', 'notices', 'alarm']);
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      const rep = await page.evaluate(() => {
        const sr = (document.querySelector('home-widgets') as HTMLElement).shadowRoot as ShadowRoot;
        const R = (r: DOMRect) => `${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.width)}x${Math.round(r.height)} (bottom ${Math.round(r.bottom)})`;
        const lines: string[] = [];
        for (const card of Array.from(sr.querySelectorAll<HTMLElement>('[data-home-widget]'))) {
          const bar = card.querySelector<HTMLElement>('[data-home-edit-bar]')!;
          const cs = getComputedStyle(card);
          lines.push(`CARD ${card.getAttribute('data-home-widget')} class="${card.className}" rect ${R(card.getBoundingClientRect())} pad-end ${cs.paddingBlockEnd} --wg-e-h ${card.style.getPropertyValue('--wg-e-h')} display ${cs.display} overflow ${cs.overflow} | BAR ${R(bar.getBoundingClientRect())}`);
          if (card.getAttribute('data-home-widget') !== 'weather') continue;
          const b = bar.getBoundingClientRect();
          for (const e of Array.from(card.querySelectorAll<HTMLElement>('*'))) {
            if (e.closest('[data-home-edit-bar]') || /^(STYLE|SCRIPT)$/.test(e.tagName)) continue;
            const ecs = getComputedStyle(e);
            const r = e.getBoundingClientRect();
            const chain: string[] = [];
            let clip = '';
            for (let p: HTMLElement | null = e; p && p !== card; p = p.parentElement) {
              chain.push(`${p.tagName.toLowerCase()}.${typeof p.className === 'string' ? p.className.split(' ').join('.') : 'svg'}`);
              const pcs = getComputedStyle(p);
              if (!clip && p !== e && (pcs.overflow !== 'visible')) clip = `${p.tagName.toLowerCase()}.${p.className} overflow ${pcs.overflow} rect ${R(p.getBoundingClientRect())}`;
            }
            lines.push(`  ${r.bottom > b.top + 1 ? 'UNDER ' : ''}${chain.reverse().join(' > ')} rect ${R(r)} display ${ecs.display} vis ${ecs.visibility} text "${(e.textContent ?? '').trim().slice(0, 30)}" clip [${clip}]`);
          }
        }
        return lines.join('\n');
      });
      console.log(`=== ${skin}\n${rep}`);
    });
  }
});
