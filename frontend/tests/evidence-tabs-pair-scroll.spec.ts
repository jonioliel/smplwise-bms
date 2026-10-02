import { test, expect, type Page } from '@playwright/test';
import { ADMIN, fresh, install, open } from './media-players-harness';

// 0.1.153 x the phone scroll fix: the players page header keeps its height while scrolling in EVERY presentation mode. In the tabs form the
// room chips fade in place (styles/media-page.ts); in the dropdown form the room filter lives in the shell's pair row, so the page header
// has nothing that folds. The mode is set as the installation default (no network).
//   $env:SW_API_PORT='59999'; npx vite --host 127.0.0.1 --port 5196   then
//   $env:SW_BASE_URL='http://127.0.0.1:5196/'; npx playwright test evidence-tabs-pair-scroll --project=mobile --workers=1
const MODE_URL = ['/src', 'shell', 'tabs-mode.ts'].join('/');

const DEEP = `const deep = (root, sel) => { const f = root.querySelector(sel); if (f) return f; for (const e of root.querySelectorAll('*')) { if (e.shadowRoot) { const r = deep(e.shadowRoot, sel); if (r) return r; } } return null; };`;
interface Probe { st: number; cardTop: number; hdr: number; compact: boolean; max: number; pair: boolean; rooms: boolean }
const probe = (page: Page) =>
  page.evaluate(`(() => { ${DEEP}
    const host = deep(document, 'multimedia-players'); const root = host.shadowRoot;
    const card = root.querySelector('media-player-card'); const dh = root.querySelector('.dh');
    const app = deep(document, 'sw-app');
    return { st: host.scrollTop, cardTop: card.getBoundingClientRect().top, hdr: dh.getBoundingClientRect().height,
      compact: dh.classList.contains('compact'), max: host.scrollHeight - host.clientHeight,
      pair: !!app.shadowRoot.querySelector('.tabpair [data-pair-chip]'), rooms: !!root.querySelector('.rooms[role=group]') };
  })()`) as Promise<Probe>;

for (const mode of ['tabs', 'dropdown', 'hybrid'] as const) {
  test(`players page, ${mode}: stepping down and up never jumps and the header keeps its height`, async ({ page }, info) => {
    test.skip(info.project.name !== 'mobile', 'phone only');
    await install(page, fresh(ADMIN));
    await open(page, '/multimedia/players', '390');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForSelector('multimedia-players media-player-card');
    await page.waitForTimeout(800);
    await page.evaluate(async ([url, m]) => (await import(/* @vite-ignore */ url as string)).setInstallationTabsMode({ 'ui.tabs_mode': m, 'ui.tabs_mode_groups': {} }), [MODE_URL, mode] as const);
    await page.waitForTimeout(600);
    await page.mouse.move(195, 420);
    const first = await probe(page);
    if (mode === 'dropdown') expect(first.pair).toBe(true); // the room filter is in the shell's pair row, not in the page header
    if (mode === 'tabs') expect(first.rooms).toBe(true);
    expect(first.max).toBeGreaterThan(150);
    let prev = first;
    let worst = 0;
    const walk = async (dy: number, steps: number) => {
      for (let i = 0; i < steps; i++) {
        await page.mouse.wheel(0, dy);
        await page.waitForTimeout(260);
        const p = await probe(page);
        worst = Math.max(worst, Math.abs(p.cardTop - prev.cardTop + (p.st - prev.st)));
        expect(Math.abs(p.hdr - first.hdr), `header height at scrollTop ${p.st}`).toBeLessThanOrEqual(2);
        prev = p;
      }
    };
    await walk(15, 14);
    await walk(40, 4);
    for (let i = 0; i < 80 && prev.st > 0; i++) await walk(-30, 1);
    info.annotations.push({ type: 'worst-shift-px', description: String(worst) });
    expect(worst).toBeLessThanOrEqual(2);
  });
}
