import { test, expect, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { installBubbleMock, tree } from './bubble-mocks';

// ELEVFIX-297: the elevators HOME widget in narrow cards. The widget is forced to card widths 240..420 px and fed worst-case data (long
// Hebrew names, mixed Hebrew/English, 1 / 9 elevators, all out of service, everything hidden); nothing may leave its card, no state badge may
// be clipped, the summary stays on one line, and a name keeps a readable minimum width. No pixel baseline: geometry assertions only.
// Fake data only. ELEVFIX_SHOTS=<dir> also writes screenshots (light + dark, every width) for the review.
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-elevators-widget-297.spec.ts --project=desktop
const NOW = '2026-10-27T09:00:00Z';
const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
const ROLES = ['fault', 'fire_service', 'out_of_service', 'waiting'];
const live = (state: string) => ({
  state, reason: state, partial: false, stale: false, since: state === 'unknown' ? null : NOW, roles: ROLES, extras: [],
  flags: { fault: state === 'fault', fire_service: state === 'fire_service', out_of_service: state === 'out_of_service', waiting: state === 'waiting' },
  history: null,
});
function mk(names: string[], states: string[]) {
  return names.map((name, i) => ({ id: `e${i + 1}`, name, area_id: null, area_name: null, ...live(states[i % states.length]) }));
}
type El = ReturnType<typeof mk>[number];
const LONG = 'מעלית משא ראשית של הבניין הצפוני כולל חניון תת קרקעי';
const DATA: Record<string, El[]> = {
  normal: mk(['מעלית צפונית', 'מעלית דרומית'], ['active', 'out_of_service']),
  one: mk(['מעלית ראשית'], ['out_of_service']),
  nine: mk(Array.from({ length: 9 }, (_, i) => `${LONG} ${i + 1}`), ['active', 'fault', 'out_of_service', 'fire_service', 'waiting', 'unknown']),
  alloff: mk(['מעלית A', 'מעלית B', 'Lift C (קומה 3) — Gate 7', 'מעלית D'], ['out_of_service']),
  mixed: mk(['Lobby-12 מעלית שירות 🛗', 'Freight elevator B7 — מעלית משא', 'א'], ['out_of_service', 'active', 'fault']),
};
const WIDTHS = [240, 280, 320, 360, 420];

async function install(page: Page, list: El[], mode: string, size: string, hidden: string[] = []) {
  await installBubbleMock(page, { perms: ['devices.read', 'devices.control', 'devices.control_bulk', 'map.read'] });
  const sizes = { a: size, b: size, c: size };
  const home = { direction: 'a', side: 'end', time_zone: 'Asia/Jerusalem', personalize: false, config: { elevators: { on: true, mode, hidden, filter: 'all', sizes } }, data: {} };
  await page.route('**/api/v1/devices/tree', (route) => json(route, { ...tree(), home }));
  await page.route('**/api/v1/infra/elevators**', (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'infra/elevators') return json(route, { elevators: list, summary: {}, stale: false, at: NOW });
    return json(route, { code: 'not_found', user_message: 'x', retryable: false, correlation_id: 'mock', details: {} }, 404);
  });
}

const W = 'sw-app devices-building home-widgets';
const SECTIONS = `${W} [data-home-widget="elevators"], ${W} [data-home-widget-part="elevators-cards"]`;

/** Forces every elevators section to `px` and measures it; returns the problems found. */
async function widthAndMeasure(page: Page, px: number): Promise<string[]> {
  const sections = page.locator(SECTIONS);
  await sections.evaluateAll((els, w) => els.forEach((e) => { const s = (e as HTMLElement).style; s.width = `${w}px`; s.maxWidth = `${w}px`; s.flex = 'none'; }), px);
  await page.waitForTimeout(60);
  return sections.evaluateAll((els) => {
    const bad: string[] = [];
    const tag = (e: Element) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ').join('.')}`;
    for (const root of els as HTMLElement[]) {
      const r = root.getBoundingClientRect();
      if (root.scrollWidth > root.clientWidth + 1) bad.push(`section scrolls ${root.scrollWidth}>${root.clientWidth}`);
      for (const e of Array.from(root.querySelectorAll('*')) as HTMLElement[]) {
        if (e.closest('sw-icon') && e.tagName.toLowerCase() !== 'sw-icon') continue;
        const b = e.getBoundingClientRect();
        if (!b.width || !b.height) continue;
        if (b.left < r.left - 1 || b.right > r.right + 1) bad.push(`${tag(e)} leaves its card (${Math.round(b.left - r.left)}..${Math.round(b.right - r.left)} of ${Math.round(r.width)})`);
      }
      for (const badge of Array.from(root.querySelectorAll('.el-badge')) as HTMLElement[]) {
        if (badge.scrollWidth > badge.clientWidth + 1) bad.push('badge text clipped');
        const host = badge.closest('.el-row, .el-card, .el-big, .t') as HTMLElement | null;
        const hb = host?.getBoundingClientRect(); const bb = badge.getBoundingClientRect();
        if (hb && (bb.right > hb.right + 1 || bb.left < hb.left - 1)) bad.push('badge clipped by its row/card');
      }
      for (const s of Array.from(root.querySelectorAll('[data-home-elevators-summary], .el-big small')) as HTMLElement[]) {
        const lh = parseFloat(getComputedStyle(s).lineHeight) || parseFloat(getComputedStyle(s).fontSize) * 1.4;
        if (s.getBoundingClientRect().height < lh * 0.8) bad.push('summary has no height (collapsed)');
        if (s.getBoundingClientRect().height > lh * 1.6) bad.push(`summary wraps (${Math.round(s.getBoundingClientRect().height)}px)`);
        if (s.scrollWidth > s.clientWidth + 1 && !(s.getAttribute('title') || '').length) bad.push('summary truncated without a title');
      }
      for (const n of Array.from(root.querySelectorAll('.el-row .nm, .el-card .t b, [data-home-elevators-top], .el-h b')) as HTMLElement[]) {
        const cut = n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1; // an ellipsis / line clamp is at work
        if (cut && n.getBoundingClientRect().width < 100) bad.push(`name too narrow (${Math.round(n.getBoundingClientRect().width)}px): ${n.textContent?.slice(0, 12)}`);
        if (cut && !(n.getAttribute('title') || '').length) bad.push('name truncated without a title');
      }
      for (const o of Array.from(root.querySelectorAll('.el-badge[data-look="off"], .eicon[data-look="off"] u')) as HTMLElement[]) {
        if (getComputedStyle(o).backgroundImage.includes('repeating')) bad.push('out-of-service still drawn with diagonal stripes');
      }
    }
    return bad;
  });
}

for (const mode of ['both', 'cards']) {
  test(`no clipping in narrow cards (mode ${mode})`, async ({ page }) => {
    test.setTimeout(180_000);
    const problems: string[] = [];
    for (const size of ['s', 'm', 'l']) {
      for (const [name, list] of Object.entries(DATA)) {
        await install(page, list, mode, size);
        await page.goto('about:blank');
        await page.goto('/?design=a&skin=classic#/devices/building');
        await expect(page.locator(SECTIONS).first()).toBeAttached();
        for (const w of WIDTHS) for (const p of await widthAndMeasure(page, w)) problems.push(`${mode}/${size}/${name}/${w}: ${p}`);
      }
    }
    expect([...new Set(problems)].slice(0, 40)).toEqual([]);
  });
}

test('everything hidden: the message stays inside a narrow card', async ({ page }) => {
  await install(page, DATA.normal, 'both', 'm', ['e1', 'e2']);
  await page.goto('about:blank');
  await page.goto('/?design=a&skin=classic#/devices/building');
  await expect(page.locator(SECTIONS).first()).toBeAttached();
  for (const w of WIDTHS) expect(await widthAndMeasure(page, w)).toEqual([]);
});

test('screenshots for review', async ({ page }) => {
  const dir = process.env.ELEVFIX_SHOTS;
  test.skip(!dir, 'ELEVFIX_SHOTS not set');
  fs.mkdirSync(dir!, { recursive: true });
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const name of ['normal', 'nine', 'alloff', 'mixed']) {
      for (const size of ['s', 'm']) {
        await install(page, DATA[name], 'both', size);
        await page.goto('about:blank');
        await page.goto(`/?design=a&skin=classic${scheme === 'dark' ? '&theme=night' : ''}#/devices/building`);
        await expect(page.locator(SECTIONS).first()).toBeAttached();
        const themeAttr = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
        if (scheme === 'dark') expect(themeAttr).toBe('dark');
        for (const w of [240,280, 320, 360, 420, 0]) {
          if (w) await widthAndMeasure(page, w);
          else await page.locator(SECTIONS).evaluateAll((els) => els.forEach((e) => { const s = (e as HTMLElement).style; s.width = ''; s.maxWidth = ''; s.flex = ''; }));
          await page.waitForTimeout(80);
          const box = await page.locator(W).boundingBox();
          await page.screenshot({ path: path.join(dir!, `${name}-${size}-${scheme}-${w || 'desktop'}.png`), clip: box ? { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(box.width + 16, 1000), height: Math.min(box.height + 16, 1200) } : undefined });
        }
      }
    }
  }
});
