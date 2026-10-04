import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, type Page } from '@playwright/test';

// Unreleased (owner request 2026-10-04): evidence screenshots of the `capsule` dropdown - closed and open, desktop and phone, light and dark, the
// three sizes - for the owner's review. SW_SHOTS=<dir> saves them elsewhere (default docs/evidence/dropdown-capsule). One project only: the specs set
// the width themselves. Needs the Vite DEV server:  ~/run_remote.sh spec <branch> tests/evidence-dropdown-capsule.spec.ts --project=desktop
const SHOTS = process.env.SW_SHOTS ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/evidence/dropdown-capsule');

const FLOORS = [
  { id: 'all', label: 'כל הקומות', icon: 'home', count: 14 },
  { id: 'd1', label: '', divider: true },
  { id: 'f0', label: 'קומת קרקע', icon: 'layers', count: 6 },
  { id: 'f1', label: 'קומה ראשונה', icon: 'layers', count: 5 },
  { id: 'f2', label: 'קומה שנייה', icon: 'layers', count: 3 },
  { id: 'f3', label: 'גג', icon: 'layers', count: 0 },
];

/** A neutral page behind the capsule (some cards, so the translucent panel has something to blur), the capsule in the corner like the floor chip. */
async function stage(page: Page, width: number, scheme: string, sizes: string[], skin = 'classic') {
  await page.setViewportSize({ width, height: width <= 480 ? 844 : 760 });
  await page.goto('about:blank');
  await page.goto(`./?design=a&skin=${skin}&scheme=${scheme}#/devices/building`);
  await page.waitForFunction(() => !!customElements.get('sw-dropdown') && !!customElements.get('sw-tabs'));
  await page.waitForTimeout(800);
  await page.evaluate(([list, items]) => {
    document.querySelectorAll('#stage').forEach((e) => e.remove());
    const st = document.createElement('div');
    st.id = 'stage';
    st.style.cssText = 'position:fixed;inset:0;z-index:10;background:var(--sw-bg,#fff);padding:20px 16px;display:flex;flex-direction:column;gap:14px;align-items:flex-start;overflow:hidden';
    const bar = document.createElement('div');
    bar.style.cssText = 'display:flex;gap:12px;align-items:center;flex-wrap:wrap;inline-size:100%';
    for (const z of list as string[]) {
      const t = document.createElement('sw-tabs') as HTMLElement & { items: unknown; active: string };
      t.setAttribute('variant', 'dropdown');
      t.setAttribute('dd-style', 'capsule');
      t.setAttribute('dd-size', z);
      t.setAttribute('group-label', 'קומה');
      t.setAttribute('data-t', z);
      t.items = items;
      t.active = 'all';
      bar.appendChild(t);
    }
    st.appendChild(bar);
    for (let i = 0; i < 6; i++) {
      const card = document.createElement('div');
      card.style.cssText = 'inline-size:100%;min-block-size:84px;border-radius:16px;background:var(--sw-surface,#fff);box-shadow:var(--sw-shadow-1);padding:14px;color:var(--sw-text-2);font:14px system-ui';
      card.textContent = ['סלון', 'מטבח', 'חדר שינה', 'משרד', 'מרפסת', 'חצר'][i] + ' - ' + (3 + i) + ' התקנים';
      st.appendChild(card);
    }
    document.body.appendChild(st);
  }, [sizes, FLOORS] as [string[], unknown[]]);
  await page.waitForTimeout(400);
}

const shot = (page: Page, name: string) => page.screenshot({ path: path.join(SHOTS, name) });

for (const [label, width] of [['desktop-1280', 1280], ['phone-390', 390]] as const) {
  for (const scheme of ['light', 'dark']) {
    test(`capsule ${label} ${scheme}: closed and open`, async ({ page }) => {
      test.skip(test.info().project.name !== 'desktop', 'one project: the width is set here');
      await stage(page, width, scheme, ['md']);
      await shot(page, `capsule-closed-${label}-${scheme}.png`);
      await page.locator('#stage sw-tabs[data-t=md] sw-dropdown .chip').click();
      await page.waitForTimeout(500);
      await shot(page, `capsule-open-${label}-${scheme}.png`);
    });
  }
}

test('capsule: the three sizes side by side (desktop, light)', async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'one project');
  await stage(page, 1280, 'light', ['sm', 'md', 'lg']);
  await shot(page, 'capsule-sizes-desktop-1280-light.png');
});

for (const skin of ['domus', 'tesla', 'bubble']) {
  test(`capsule in the ${skin} skin (desktop, open)`, async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'one project');
    await stage(page, 1280, 'light', ['md'], skin);
    await page.locator('#stage sw-tabs[data-t=md] sw-dropdown .chip').click();
    await page.waitForTimeout(500);
    await shot(page, `capsule-open-${skin}-desktop-1280-light.png`);
  });
}
