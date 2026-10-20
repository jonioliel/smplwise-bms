import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { PERMS } from './tickets-mocks';

// UXREST-295 evidence: before / after screenshots of what the UX audit leftovers fixed. Run against the vite DEV server (never a pixel
// baseline compare): SW_BASE_URL=http://127.0.0.1:<port>/ UX_PHASE=before|after npx playwright test tests/evidence-uxrest-295.spec.ts --project=desktop
// Checks assert the AFTER behaviour only when UX_PHASE=after; the before run just records the pictures.
const PHASE = process.env.UX_PHASE || 'after';
const OUT = `../docs/design/evidence/UXREST-295/${PHASE}`;

async function apiDown(page: Page, mode: 'error' | 'offline') {
  await page.route('**/api/v1/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^.*\/api\/v1\//, '');
    if (p === 'me') {
      const perms = [...PERMS.admin, 'cameras.view', 'events.read', 'alarm.view', 'media.view', 'electricity.view'];
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: { id: 'u1', username: 'ronit', display_name: 'רונית לוי', source: 'ingress' }, channel: 'local', remote: null, bindings: [{ id: 'b1', role_id: 'system_admin', role_name: 'מנהל מערכת', scope_type: 'installation', scope_id: '*', scope_name: 'כל ההתקנה', effect: 'allow' }], permissions_installation: perms, permissions_any: perms, has_access: true, permission_revision: 1, bootstrap_state: 'done', modules: { tickets: true } }) });
    }
    if (mode === 'offline') return route.abort('internetdisconnected');
    return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 'internal_error', user_message: '', retryable: true, correlation_id: 'x', details: {} }) });
  });
}

/** Every visible text of the page, shadow roots included. */
async function pageTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const walk = (root: ParentNode) => {
      for (const el of Array.from(root.querySelectorAll('*'))) {
        if (el.shadowRoot) walk(el.shadowRoot);
        for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent?.trim()) out.push(n.textContent.trim());
      }
    };
    walk(document);
    return out;
  });
}

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

test('dark scheme: the count badge on the live KPI tile reads on its fill', async ({ page }) => {
  await page.goto('/?design=a&scheme=dark#/live');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1500);
  const kpi = page.locator('sw-kpi[badge]').first();
  await kpi.scrollIntoViewIfNeeded();
  await kpi.screenshot({ path: `${OUT}/dark-kpi-badge.png` });
  const ratio = await kpi.evaluate((el) => {
    const b = el.shadowRoot!.querySelector('.badge') as HTMLElement;
    const cs = getComputedStyle(b);
    const c = (s: string) => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
    const L = (rgb: number[]) => { const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]); };
    const a = L(c(cs.color)), z = L(c(cs.backgroundColor));
    return (Math.max(a, z) + 0.05) / (Math.min(a, z) + 0.05);
  });
  console.log(`badge ratio ${PHASE}: ${ratio.toFixed(2)}`);
  if (PHASE === 'after') expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('keyboard: the area summary menu shows the brand focus ring', async ({ page }) => {
  await page.goto('/?design=a#/devices/building');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1800);
  let found: { tag: string; ring: string } | null = null;
  for (let i = 0; i < 40 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.evaluate(() => {
      let e: Element | null = document.activeElement;
      while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement;
      if (!e || !(e as HTMLElement).getAttribute?.('aria-label')?.startsWith('סיכום האזור')) return null;
      const cs = getComputedStyle(e);
      return { tag: e.tagName.toLowerCase(), ring: `${cs.outlineStyle} ${cs.outlineWidth}` };
    });
  }
  expect(found, 'the area summary key is reachable by Tab').toBeTruthy();
  await page.screenshot({ path: `${OUT}/focus-area-summary.png`, clip: { x: 700, y: 440, width: 700, height: 220 } });
  console.log(`area summary focus ${PHASE}: ${found!.ring}`);
  if (PHASE === 'after') expect(found!.ring).toMatch(/solid [1-9]/);
});

test('API down: the home overview and the building tree say so with a retry and never show a machine code', async ({ page }) => {
  await apiDown(page, 'error');
  await page.goto('/#/live');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/error-live.png` });
  const live = await pageTexts(page);
  console.log(`live error ${PHASE}: loading text still shown = ${live.includes('קורא את מצב המערכת…')}`);
  await page.goto('about:blank');
  await page.goto('/#/devices/building');
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/error-building.png` });
  const b = await pageTexts(page);
  console.log(`building error ${PHASE}: machine code shown = ${b.includes('internal_error')}`);
  if (PHASE === 'after') {
    expect(live.some((t) => t.includes('נסו שוב') || t.includes('נסה שוב'))).toBe(true);
    expect(live).not.toContain('קורא את מצב המערכת…');
    expect(b).not.toContain('internal_error');
    expect(b.some((t) => t.includes('נסה שוב'))).toBe(true);
  }
});
