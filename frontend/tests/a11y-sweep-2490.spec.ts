import { test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  AREA_TABS,
  CALENDARS_HREF,
  INFRA_ELECTRICITY_PAGES,
  INFRA_GENERATOR_PAGES,
  INFRA_WATER_PAGES,
  NAV_A,
  NOTICES_AREA,
  SECTION_TABS,
  SECURITY_SETTINGS_TABS,
  TICKETS_MAINTENANCE_PAGES,
  TICKETS_REPORTS_PAGES,
  TICKETS_REQUESTS_PAGES,
  TICKETS_SCOPE_TABS,
  TICKETS_VENDORS_PAGES,
} from '../src/shell/nav';
import type { TabItem } from '../src/components/sw-tabs';
import { installTicketsMock } from './tickets-mocks';

// A11Y-AUDIT-2490: the accessibility sweep - a REPORT, not a gate (like scripts/complexity-report.mjs). It never fails on a finding.
// Every main route of the navigation tables (src/shell/nav.ts: the rail areas, their tab rows and the second-level page rows) is opened
// on demo data (no backend; the tickets routes on tests/tickets-mocks.ts), then axe-core (devDependency, pinned) runs over the whole
// document - open shadow roots included - in the light and the dark scheme. On the phone project a 44 px touch-target probe runs too
// (the hit-cross method of layout-a11y-295: an invisible ::after ring counts). Only critical / serious findings are recorded.
//   SW_A11Y_SWEEP=1 SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/a11y-sweep-2490.spec.ts --project=desktop --project=mobile --workers=1
//   node scripts/a11y-report.mjs            (groups test-results/a11y-sweep/*.jsonl by rule and by module; `npm run report:a11y` does both)
// SW_A11Y_ROUTES=<substring>[,<substring>]: only the routes whose hash contains one of them (a module's re-check after its fix).
// Skipped unless SW_A11Y_SWEEP=1, so the release gate's full runs do not pay for it.

const ON = process.env.SW_A11Y_SWEEP === '1';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'test-results', 'a11y-sweep');
const AXE_SRC = (() => {
  if (!ON) return '';
  const file = process.env.SW_AXE_PATH || createRequire(import.meta.url).resolve('axe-core/axe.min.js');
  return fs.readFileSync(file, 'utf8');
})();

const pages = (items: readonly TabItem[]) => items.map((t) => t.href ?? '').filter((h) => h.startsWith('#/'));

/** Every main route, once, in the navigation's order. */
function sweepRoutes(): string[] {
  const all = [
    '#/home',
    ...NAV_A.map((a) => a.href),
    NOTICES_AREA.href,
    ...Object.values(AREA_TABS).flatMap(pages),
    ...Object.values(SECTION_TABS).flatMap(pages),
    ...pages(SECURITY_SETTINGS_TABS),
    ...pages(INFRA_ELECTRICITY_PAGES),
    ...pages(INFRA_GENERATOR_PAGES),
    ...pages(INFRA_WATER_PAGES),
    ...pages(TICKETS_REQUESTS_PAGES),
    ...pages(TICKETS_SCOPE_TABS),
    ...pages(TICKETS_MAINTENANCE_PAGES),
    ...pages(TICKETS_VENDORS_PAGES),
    ...pages(TICKETS_REPORTS_PAGES),
    CALENDARS_HREF,
    ...['rooms', 'approvals', 'maint', 'manage'].map((v) => `#/calendars/${v}`),
  ];
  const only = (process.env.SW_A11Y_ROUTES ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...new Set(all)].filter((h) => !only.length || only.some((o) => h.includes(o)));
}

interface AxeNode { target: unknown[]; html: string; failureSummary?: string }
interface AxeResult { id: string; impact: string | null; help: string; helpUrl: string; nodes: AxeNode[] }

const KEEP = new Set(['critical', 'serious']);
/** SW_A11Y_SCHEMES=light|dark: one scheme only (default both). */
const SCHEMES = (['light', 'dark'] as const).filter((s) => !process.env.SW_A11Y_SCHEMES || process.env.SW_A11Y_SCHEMES === s);

/** The innermost custom element on an axe target path (the component that draws the node), for the module grouping. */
function hostOf(target: unknown[]): string {
  const flat = target.flat(3).map(String);
  let host = '';
  // attribute selectors and their quoted values are dropped first (`[part="key key-on"]` names no element)
  for (const sel of flat) for (const m of sel.replace(/\[[^\]]*\]/g, '').matchAll(/(?:^|[\s>+~])([a-z][a-z0-9]*-[a-z0-9-]+)/g)) host = m[1];
  return host || 'document';
}

async function runAxe(page: Page): Promise<AxeResult[]> {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE_SRC });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: AxeResult[] }> } }).axe;
    const r = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
      resultTypes: ['violations'],
    });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, helpUrl: v.helpUrl, nodes: v.nodes.map((n) => ({ target: n.target, html: n.html.slice(0, 240), failureSummary: (n.failureSummary ?? '').slice(0, 300) })) }));
  });
}

/** Phone: every visible control in the first screen (document and open shadow roots) whose 44 px hit cross misses it. */
async function touchTargets(page: Page): Promise<AxeResult[]> {
  const nodes = await page.evaluate((half) => {
    const SEL = 'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="tab"], [role="switch"], [role="checkbox"], [role="radio"], [role="menuitem"], [role="option"], [tabindex]:not([tabindex="-1"])';
    const out: { target: string[]; html: string; failureSummary: string }[] = [];
    const deepHit = (x: number, y: number): Element | null => {
      let e = document.elementFromPoint(x, y);
      while (e?.shadowRoot) {
        const inner = e.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === e) break;
        e = inner;
      }
      return e;
    };
    const inside = (t: Element | null, el: Element): boolean => {
      for (let n: Node | null = t; n; n = n.parentNode ?? (n as ShadowRoot).host ?? null) if (n === el) return true;
      return false;
    };
    // axe's shape: one selector per shadow root, outermost host first - the last host is the component whose template draws the control
    // (a control slotted into <sw-page> belongs to the screen that renders it, not to sw-page)
    const pathOf = (el: Element): string[] => {
      const p = [el.tagName.toLowerCase() + (el.id ? `#${el.id}` : '') + (el.className && typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '')];
      for (let root = el.getRootNode(); root instanceof ShadowRoot; root = root.host.getRootNode()) p.unshift(root.host.tagName.toLowerCase());
      return p;
    };
    const walk = (root: Document | ShadowRoot) => {
      root.querySelectorAll(SEL).forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.display === 'inline' || cs.visibility === 'hidden' || (el as HTMLElement).closest?.('[inert]')) return;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return;
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        if (cx - half < 0 || cy - half < 0 || cx + half > innerWidth || cy + half > innerHeight) return; // first screen only, fully inside
        if (!inside(deepHit(cx, cy), el)) return; // covered (a dialog, an overlay): not reachable now
        const miss = ([[-half, 0, 'start'], [half, 0, 'end'], [0, -half, 'top'], [0, half, 'bottom']] as const).filter(([dx, dy]) => !inside(deepHit(cx + dx, cy + dy), el)).map(([, , n]) => n);
        if (miss.length) out.push({ target: pathOf(el), html: el.outerHTML.slice(0, 240), failureSummary: `drawn ${Math.round(r.width)}x${Math.round(r.height)}, the 44 px cross misses: ${miss.join(', ')}` });
      });
      root.querySelectorAll('*').forEach((el) => el.shadowRoot && walk(el.shadowRoot));
    };
    walk(document);
    return out;
  }, 21);
  return nodes.length ? [{ id: 'touch-target-44', impact: 'serious', help: 'Touch targets are at least 44 x 44 px on a phone (owner rule; WCAG 2.5.5 AAA)', helpUrl: '', nodes }] : [];
}

async function settle(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const all: Animation[] = [];
    const walk = (root: Document | ShadowRoot) => {
      all.push(...root.getAnimations());
      root.querySelectorAll('*').forEach((el) => el.shadowRoot && walk(el.shadowRoot));
    };
    walk(document);
    const finite = all.filter((a) => a.playState === 'running' && Number.isFinite(Number(a.effect?.getComputedTiming().endTime)));
    await Promise.race([Promise.all(finite.map((a) => a.finished.catch(() => undefined))), new Promise((r) => setTimeout(r, 1500))]);
  });
}

/** What the route actually drew: the address after redirects and the screen elements under the shell. */
const landed = (page: Page) =>
  page.evaluate(() => {
    const app = document.querySelector('sw-app');
    const tags = new Set<string>();
    app?.shadowRoot?.querySelectorAll('*').forEach((e) => {
      const t = e.tagName.toLowerCase();
      if (t.includes('-') && !/^sw-(icon|nav|tab|crumb|user-menu|rail|app-bar|pill)/.test(t)) tags.add(t);
    });
    return { hash: location.hash, screens: [...tags].slice(0, 12) };
  });

function record(info: TestInfo, row: Record<string, unknown>) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.appendFileSync(path.join(OUT, `${info.project.name}.jsonl`), JSON.stringify(row) + '\n');
}

test.describe('a11y sweep (report only)', () => {
  test.skip(!ON, 'report step: SW_A11Y_SWEEP=1 (not part of the release gate)');
  test.skip(({ browserName }) => browserName !== 'chromium', 'chromium only');
  test.use({ reducedMotion: 'reduce' }); // motion "auto" follows the OS: no transition is caught half way, axe reads the resting colours
  test.describe.configure({ timeout: 120_000 });

  for (const route of ON ? sweepRoutes() : []) {
    test(`${route}`, async ({ page }, info) => {
      test.skip(info.project.name === 'tablet', 'desktop 1440 + phone 390 only');
      const tickets = route.startsWith('#/tickets');
      if (tickets) await installTicketsMock(page, { persona: 'admin' });
      const t0 = Date.now();
      try {
        for (const scheme of SCHEMES) {
          // the scheme is the page's own (?scheme=): flipping data-theme on a loaded page left skin rules of the other scheme in force
          // (a dark track with the light key ink, 1.1:1) - a state no user ever sees
          await page.goto('about:blank');
          await page.goto(`/?design=a&scheme=${scheme}#${route.slice(1)}`);
          await page.waitForSelector('sw-app', { timeout: 30_000 });
          await page.waitForTimeout(1500);
          await settle(page);
          const where = await landed(page);
          const found = [...(await runAxe(page)), ...(scheme === 'light' && info.project.name === 'mobile' ? await touchTargets(page) : [])];
          const kept = found.filter((v) => KEEP.has(v.impact ?? ''));
          record(info, {
            route,
            project: info.project.name,
            scheme,
            landed: where,
            ms: Date.now() - t0,
            violations: kept.map((v) => ({
              rule: v.id,
              impact: v.impact,
              help: v.help,
              count: v.nodes.length,
              hosts: [...new Set(v.nodes.map((n) => hostOf(n.target)))],
              examples: v.nodes.slice(0, 6).map((n) => ({ host: hostOf(n.target), target: n.target, html: n.html, summary: n.failureSummary })),
            })),
          });
          console.log(`[${info.project.name}/${scheme}] ${route}: ${kept.map((v) => `${v.id}x${v.nodes.length}`).join(' ') || 'clean'}`);
        }
      } catch (e) {
        record(info, { route, project: info.project.name, error: String(e).slice(0, 400) });
        console.log(`[${info.project.name}] ${route}: ERROR ${String(e).slice(0, 200)}`);
      }
    });
  }
});
