import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Shared helpers of the electricity (accounts / bills / customers / billing settings) specs of pilot/elec-ui-bills: the harness page, the demo
// controls of the mock layer (localStorage `sw.demo.electricity`), screenshots into docs/design/evidence/electricity-ui-bills/ (fake data only).
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const EVIDENCE = path.resolve(HERE, '..', '..', 'docs', 'design', 'evidence', 'electricity-ui-bills');
export const HARNESS = '/tests/electricity-harness/index.html';
export const EL = '/infra/electricity';

export interface Ctl {
  persona?: 'full' | 'view' | 'bills_only';
  empty?: boolean;
  fail?: string;
  pdf_failed?: boolean;
  pdf_error?: string;
  create_error?: string;
  latency?: number;
  /** EL5: account a4 bills on a time-of-use tariff */
  tou?: boolean;
}
export interface Opts {
  skin?: 'classic' | 'domus' | 'tesla' | 'bubble';
  scheme?: 'light' | 'dark';
  ctl?: Ctl;
}

/** Opens a hash route in the harness. `route` starts with `/` (for example `/infra/electricity/accounts`). */
export async function open(page: Page, route: string, o: Opts = {}): Promise<void> {
  await page.addInitScript((ctl) => {
    try {
      localStorage.setItem('sw.demo.electricity', JSON.stringify(ctl));
    } catch {
      /* storage unavailable */
    }
  }, o.ctl ?? {});
  const q = new URLSearchParams({ skin: o.skin ?? 'classic', scheme: o.scheme ?? 'light' });
  await page.goto('about:blank');
  await page.goto(`${HARNESS}?${q}#${route}`);
  await page.waitForSelector('[data-harness]');
  await page.evaluate(() => document.fonts.ready);
}

/** Waits for a screen root (`data-elec`) to leave its loading state and returns it. */
export async function screen(page: Page, name: string, state = 'ready'): Promise<Locator> {
  const root = page.locator(`[data-elec="${name}"]`).first();
  await expect(root).toHaveAttribute('data-state', state, { timeout: 20_000 });
  return root;
}

export async function shot(page: Page, info: TestInfo, name: string, o: { full?: boolean } = {}): Promise<void> {
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(EVIDENCE, `${name}-${info.project.name}.png`), fullPage: o.full ?? true });
}

/** No horizontal page overflow (RTL layouts must not scroll sideways). */
export async function noOverflow(page: Page): Promise<void> {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(over, 'horizontal overflow of the page').toBeLessThanOrEqual(1);
}

/** Collects page errors and console errors; call `.expectNone()` at the end of a test. */
export function watchErrors(page: Page): { expectNone: () => void } {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/Failed to load resource|favicon|\/api\//.test(m.text())) errs.push(m.text());
  });
  return { expectNone: () => expect(errs, 'page / console errors').toEqual([]) };
}

export const phone = (info: TestInfo): boolean => info.project.name === 'mobile';

/** Clicks a visually hidden control (the radio / checkbox of a row, opacity 0) the way a tap on its row does, whatever the viewport. */
export const tap = (l: Locator): Promise<void> => l.evaluate((e) => (e as HTMLElement).click());
