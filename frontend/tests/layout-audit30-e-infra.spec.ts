import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installGeneratorMock } from './generator-mocks';
import { installTemperature, units } from './temperature-mocks';
import { installWaterMock } from './wkwater-mocks';

// AUDIT30-E-INFRA (operator/admin consistency audit, round 30, branch E - electricity, water, generator, temperature). One regression
// case per fix, measured the way the audit's probe measured it (private/design-system-2026-10-27/round30/system-audit/tools/shoot.mjs):
//   E1 (#8)  the keys of these screens sit on the shared button scale: a visible button with a box is 28 / 34 / 40 / 44 px tall with the
//            --sw-r-sm radius (10 px in classic) or a pill - the audit found 32 px keys with an 8 px radius (the segmented control's thumb)
//   E2 (#6, #9) every infrastructure screen is a <sw-page>: exactly one h1, drawn by sw-page, the same weight on every screen (temperature
//            drew its own at 700), and no area row of one tab (the lone "מוני חשמל" chip)
//   E5 (#14) the meters pages' areas list is the shared places tree; the chosen row is the soft accent wash, never a filled accent key
//   E6 (#5)  the control screens do not scroll the page at 1366x768 (kept from NOSCROLL-1366-2437; re-checked here with the sw-page frame)
// plus the pixel baselines of the four screens (`pixel-stable`, desktop 1440, classic light; generated on the runner with -u).
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/layout-audit30-e-infra.spec.ts --project=desktop --workers=1

// the overflow probe of layout-noscroll-1366.spec.ts (copied: a spec must not import another spec file)
/** The vertical overflow of the document, the shell's main, the screen's wrapper, the screen, and the biggest page-sized panel inside it. */
const overflow = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const screen = main ? [...main.querySelectorAll<HTMLElement>(':scope > *, :scope > div > *')].reverse().find((el) => el.tagName.includes('-') && !el.tagName.startsWith('SW-DEMO') && el.tagName !== 'SW-TABS' && el.tagName !== 'SYSTEM-NAV') : null;
    const over = (el: Element | null | undefined) => (el ? el.scrollHeight - el.clientHeight : 0);
    const se = document.scrollingElement;
    const vw = innerWidth;
    const vh = innerHeight;
    let panel = 0;
    let panelTag = '';
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        const cs = getComputedStyle(el);
        if (!/(auto|scroll)/.test(cs.overflowY)) continue;
        const o = el.scrollHeight - el.clientHeight;
        if (o <= 8) continue;
        const r = el.getBoundingClientRect();
        const area = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
        if (area / (vw * vh) < 0.55) continue;
        if (o > panel) {
          panel = o;
          const host = (el.getRootNode() as ShadowRoot).host?.localName ?? '';
          panelTag = `${host}|${el.localName}${el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''}`;
        }
      }
    };
    if (screen) {
      walk(screen.shadowRoot ?? screen);
    }
    return { doc: over(se), main: over(main), wrap: screen && screen.parentElement !== main ? over(screen.parentElement) : 0, screen: over(screen), panel, panelTag, tag: screen?.tagName.toLowerCase() ?? '' };
  });

type Mock = 'demo' | 'generator' | 'temperature' | 'water';
interface Case {
  id: string;
  hash: string;
  mock: Mock;
  ready: string;
  host: string;
}
const CASES: Case[] = [
  { id: 'elec-meters', hash: '/infra/electricity/meters', mock: 'demo', ready: 'elec-meters-page [data-state="ready"]', host: 'infra-electricity' },
  { id: 'elec-bills', hash: '/infra/electricity/bills', mock: 'demo', ready: 'elec-bills-page', host: 'infra-electricity' },
  { id: 'water', hash: '/infra/water/meters', mock: 'water', ready: 'water-meters-page [data-state="ready"]', host: 'infra-water' },
  { id: 'generator', hash: '/infra/generator/live', mock: 'generator', ready: 'gen-live-page', host: 'infra-generator' },
  { id: 'gen-charts', hash: '/infra/generator/charts', mock: 'generator', ready: 'gen-charts-page', host: 'infra-generator' },
  { id: 'temperature', hash: '/infra/temperature', mock: 'temperature', ready: 'infra-temperature [data-temp-unit]', host: 'infra-temperature' },
];

async function open(page: Page, c: Case, scheme: 'light' | 'dark' = 'light') {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  if (c.mock === 'demo') await page.route('**/api/v1/**', (route) => route.abort());
  else if (c.mock === 'generator') await installGeneratorMock(page);
  else if (c.mock === 'temperature') await installTemperature(page, units());
  else await installWaterMock(page);
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto('about:blank');
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#${c.hash}`);
  await page.waitForSelector('sw-app', { timeout: 60_000 });
  await page.locator(`sw-app ${c.ready}`).first().waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(600);
}

/** Every visible h1 in the screen (shadow roots pierced): its host, weight and size. */
const headings = (page: Page, host: string) =>
  page.evaluate((h) => {
    const out: { host: string; fw: string; fs: string; text: string }[] = [];
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.localName !== 'h1') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) continue;
        const cs = getComputedStyle(el);
        out.push({ host: (el.getRootNode() as ShadowRoot).host?.localName ?? '', fw: cs.fontWeight, fs: cs.fontSize, text: (el.textContent ?? '').trim() });
      }
    };
    const screen = document.querySelector('sw-app')!.shadowRoot!.querySelector(h);
    if (screen) walk(screen.shadowRoot ?? screen);
    return out;
  }, host);

/** The audit's button rule: a visible button (or role=button) with a box and a label is 28 / 34 / 40 / 44 px tall and r10 or a pill. */
const offScaleButtons = (page: Page, host: string) =>
  page.evaluate((h) => {
    const bad: string[] = [];
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.localName !== 'button' && el.getAttribute('role') !== 'button') continue;
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue;
        const box = (parseFloat(cs.backgroundColor.split(',')[3] ?? '1') > 0.05 && !cs.backgroundColor.endsWith(', 0)') && cs.backgroundColor !== 'transparent') || parseFloat(cs.borderTopWidth) > 0;
        const txt = (el.textContent ?? '').trim();
        if (!box || txt.length <= 1 || r.height >= 70 || r.width >= 420) continue;
        const height = Math.round(r.height);
        const rad = parseFloat(cs.borderTopLeftRadius);
        if (![28, 34, 40, 44].includes(height) || !(rad === 10 || rad >= 100)) bad.push(`h${height} r${rad} ${(el.getRootNode() as ShadowRoot).host?.localName}|${el.localName}.${el.className} "${txt.slice(0, 20)}"`);
      }
    };
    const screen = document.querySelector('sw-app')!.shadowRoot!.querySelector(h);
    if (screen) walk(screen.shadowRoot ?? screen);
    return bad;
  }, host);

test.describe('AUDIT30-E-INFRA: the infrastructure screens on the shared components', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo / mocked-backend spec');
  test.beforeEach(async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'the viewport is set per case; one project is enough');
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  for (const c of CASES) {
    test(`E2 ${c.id}: one h1, drawn by sw-page at the shared weight; no area row of one tab`, async ({ page }) => {
      await open(page, c);
      const h = await headings(page, c.host);
      expect(h, JSON.stringify(h)).toHaveLength(1);
      expect(h[0].host).toBe('sw-page');
      expect(h[0].fw).toBe('800'); // classic --sw-h1-weight (temperature drew its own h1 at 700)
      await expect(page.locator('sw-app [data-infra-l1]')).toHaveCount(0);
    });

    test(`E1 ${c.id}: every key on the shared button scale (28 / 34 / 40 / 44 px, r10 or pill)`, async ({ page }) => {
      await open(page, c);
      expect(await offScaleButtons(page, c.host)).toEqual([]);
    });
  }

  for (const id of ['elec-meters', 'water']) {
    test(`E5 ${id}: the areas list is the shared places tree; the chosen row is the soft accent wash`, async ({ page }) => {
      const c = CASES.find((x) => x.id === id)!;
      await open(page, c);
      const tree = page.locator(`sw-app ${c.host} sw-place-tree[data-area-tree]`);
      await expect(tree).toBeVisible();
      const picks = tree.locator('[data-place-pick]');
      expect(await picks.count()).toBeGreaterThan(2);
      const area = tree.locator('[data-place-row]:not(.floor) [data-place-pick]:not([data-place-pick="all"])').first();
      await area.click();
      await expect(area).toHaveAttribute('aria-current', 'true');
      const look = await area.evaluate((b) => {
        const cs = getComputedStyle(b);
        const probe = document.createElement('span');
        probe.style.cssText = 'background: var(--sw-accent-soft); color: var(--sw-accent-text)';
        b.parentElement!.appendChild(probe);
        const want = getComputedStyle(probe);
        const res = { bg: cs.backgroundColor, ink: cs.color, wantBg: want.backgroundColor, wantInk: want.color };
        probe.remove();
        return res;
      });
      expect(look.bg).toBe(look.wantBg);
      expect(look.ink).toBe(look.wantInk);
      // a floor's fold hides its areas
      const fold = tree.locator('[data-place-fold]').first();
      const before = await picks.count();
      await fold.click();
      await expect.poll(() => picks.count()).toBeLessThan(before);
    });
  }

  for (const id of ['elec-meters', 'water', 'generator', 'temperature']) {
    test(`E6 ${id} at 1366x768: no page or page-sized panel scroll inside the sw-page frame`, async ({ page }) => {
      await page.setViewportSize({ width: 1366, height: 768 });
      await open(page, CASES.find((x) => x.id === id)!);
      let worst = 99;
      await expect
        .poll(async () => {
          const o = await overflow(page);
          worst = Math.max(o.doc, o.main, o.wrap, o.screen, o.panel);
          return worst;
        }, { timeout: 8_000 })
        .toBeLessThanOrEqual(1)
        .catch(() => undefined);
      expect(worst).toBeLessThanOrEqual(1);
    });
  }
});

test.describe('AUDIT30-E-INFRA: pixel baselines', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo / mocked-backend spec');
  const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
    !['all', 'changed'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

  for (const id of ['elec-meters', 'water', 'generator', 'temperature']) {
    test(`pixel-stable: ${id} 1440 classic light`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop baseline only');
      test.setTimeout(180_000);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.clock.install({ time: new Date('2026-10-05T09:00:00Z') });
      await page.setViewportSize({ width: 1440, height: 900 });
      const c = CASES.find((x) => x.id === id)!;
      await open(page, c);
      const file = `audit30e-${id}-1440.png`;
      if (noBaseline(info, file)) test.info().annotations.push({ type: 'skipped-pixel', description: `${file}: no baseline on ${process.platform}` });
      // the live readings (sparklines, ages) move with the mocks' clock: mask the numbers' boxes, compare the frame
      else await expect(page).toHaveScreenshot(file, { maxDiffPixelRatio: 0.02, animations: 'disabled', caret: 'hide', timeout: 20_000, mask: [page.locator('sw-app .num, sw-app svg, sw-app canvas')] });
    });
  }
});

test.describe('AUDIT30-E-INFRA: sources', () => {
  const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
  const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

  test('E2: the four screens render <sw-page> and draw no area row of one tab', () => {
    for (const f of ['infra-electricity', 'infra-water', 'infra-generator', 'infra-temperature', 'infra-elevators']) {
      const s = read(`screens/${f}.ts`);
      expect(s, f).not.toContain('data-infra-l1');
      if (f !== 'infra-elevators') {
        expect(s, f).toMatch(/<sw-page heading=\$\{/);
        expect(s, f).not.toMatch(/<h1\b/);
      }
    }
  });

  test('E1: the electricity, water and generator modules draw their action keys with <sw-button>', () => {
    // what stays local: links styled as keys (<a class="btn">), split / menu keys with aria state, the snooze split key
    const files = ['electricity/elec-wizard.ts', 'electricity/elec-bill-page.ts', 'electricity/elec-settings.ts', 'generator/gen-settings.ts', 'generator/gen-alerts-page.ts', 'screens/water/page-accounts.ts', 'screens/water/page-bills.ts'];
    for (const f of files) {
      const s = read(f);
      const raw = (s.match(/<button[^>]*class="btn\b/g) ?? []).length;
      expect(raw, `${f}: local .btn buttons left`).toBeLessThanOrEqual(1);
      expect(s, f).toContain('<sw-button');
    }
  });

  test('E1: the local keys that stay sit on the shared scale (control-height tokens, pill segmented control)', () => {
    const css = read('electricity/styles.ts');
    expect(css).toContain('--elec-key-md: max(var(--sw-ctl-h-md), var(--elec-touch));');
    expect(css).toContain('--elec-key-sm: var(--elec-key-md);'); // never below the module's hit area (layout-electricity.spec.ts)
    expect(css).not.toContain('calc(var(--sw-r-sm) - 2px)');
  });

  test('E5: the meters pages use the shared places tree and no local filled-accent selection', () => {
    for (const f of ['screens/electricity/page-meters.ts', 'screens/water/page-meters.ts']) {
      const s = read(f);
      expect(s, f).toContain('<sw-place-tree data-area-tree');
      expect(s, f).not.toMatch(/\.tree button\[aria-current='true'\]/);
    }
  });
});
