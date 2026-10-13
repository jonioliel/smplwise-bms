import { test, expect, type Page } from '@playwright/test';
import { SKIN_IDS } from '../src/design/skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { installTrustMock, newTrustMock, openTrust, openUnknown, type TrustMock } from './bridge-trust-mocks';

// CR-040 (WXROT): the layout guard (tests/layout-guard.ts) over the segment "מפתח הגשר" of Settings > בקרת כניסה, against the MOCKED backend,
// in every skin the build has x light / dark x widths 320-1440, in the segment's states: ready with results, an open unknown request, the
// confirmation, an old bridge, no results yet. It FAILS on escape / overflow / clipped (nothing leaves its row, no text is cut without an
// ellipsis, the page never scrolls sideways). The 44 px rule is asserted for what this segment owns: the "הבנתי" row of the confirmation in
// every skin, and the segment's buttons in the skins whose buttons follow the shared size dial (classic, tesla, bubble) - domus and crystal
// size every sw-button in their own skin rules for the whole product (as in layout-wxunblk.spec.ts).
// One test per skin x theme x state (50 bounded tests, 10 widths each) rather than one long test per skin x theme: the same coverage, a
// budget each test can keep on a loaded shared runner, and the workers share the sweep (the first run of the all-states shape exceeded 30 min).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-bridge-trust.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = QUICK ? SKIN_IDS.filter((s) => s === 'classic' || s === 'bubble') : SKIN_IDS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const SKIP = ".sk, sw-icon, svg, input[type='checkbox']";
const SCREEN = 'system-access-trust';
const BUBBLE = '.row, .note, .ch, .main, .side, .facts, .hist';
const SKIN_SIZED_BUTTONS = new Set(['domus', 'crystal']);

// two animation frames; never more than a second (a throttled frame must not hold the sweep - the 150 ms wait before already let the layout settle)
const settle = (page: Page) =>
  page.evaluate(() => new Promise<void>((r) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        r();
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(finish));
    setTimeout(finish, 1000);
  }));

interface Shot {
  name: string;
  mock: () => TrustMock;
  then?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  { name: 'ready', mock: () => newTrustMock() },
  { name: 'open-unknown', mock: () => newTrustMock({ history: [...newTrustMock().history, openUnknown()] }) },
  {
    name: 'question',
    mock: () => newTrustMock(),
    then: async (p) => {
      await p.locator(`${SCREEN} sw-button[data-trust-rotate]`).click();
      await p.waitForSelector(`${SCREEN} sw-dialog[data-trust-dialog][open]`);
    },
  },
  { name: 'old-bridge', mock: () => newTrustMock({ version: '0.8.0', supported: false, epochSeen: null }) },
  { name: 'empty', mock: () => newTrustMock({ history: [], epoch: 1, epochSeen: 1 }) },
];

/** Runs inside the page: this segment's own controls smaller than the hit area (the "הבנתי" row, its buttons). */
function ownTargets(args: { ctx: string; buttons: boolean }): string[] {
  const out: string[] = [];
  const min = innerWidth <= 1100 ? 44 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sw-touch-desktop')) || 44;
  const app = document.querySelector('sw-app')?.shadowRoot;
  const find = (root: ParentNode | null | undefined, sel: string): Element | null => {
    if (!root) return null;
    const hit = root.querySelector(sel);
    if (hit) return hit;
    for (const el of Array.from(root.querySelectorAll('*'))) {
      const sr = (el as Element & { shadowRoot: ShadowRoot | null }).shadowRoot;
      const deep = sr ? find(sr, sel) : null;
      if (deep) return deep;
    }
    return null;
  };
  const host = find(app, 'system-access-trust') as HTMLElement | null;
  const root = host?.shadowRoot;
  if (!root) return [`${args.ctx}: the segment was not found`];
  const seen = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const check = (el: Element, name: string) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < min - 0.5 || r.height < min - 0.5) out.push(`${args.ctx}: ${name} ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`);
  };
  for (const el of Array.from(root.querySelectorAll('label.ack'))) check(el, 'label.ack');
  if (args.buttons) {
    for (const el of Array.from(root.querySelectorAll('sw-button'))) {
      const inner = el.shadowRoot?.querySelector('button');
      if (inner && !(inner as HTMLButtonElement).disabled) check(inner, `sw-button "${(el.textContent || '').trim().slice(0, 14)}"`);
    }
  }
  return out;
}

test.describe('CR-040 layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.describe.configure({ timeout: 10 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
  });

  for (const skin of SKINS) {
    for (const theme of THEMES) {
      for (const shot of SHOTS) {
        test(`${skin} ${theme} ${shot.name}: the segment across widths`, async ({ page }) => {
          const errors: string[] = [];
          const results: Finding[] = [];
          const own: string[] = [];
          page.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await page.emulateMedia({ reducedMotion: 'reduce' });
          await installTrustMock(page, shot.mock());
          await page.setViewportSize({ width: 1440, height: 900 });
          await openTrust(page, { skin, scheme: theme });
          await page.waitForSelector(`${SCREEN} sw-card[data-trust-card]`, { timeout: 30_000 });
          if (shot.then) await shot.then(page);
          await page.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: height(w) });
            await page.waitForTimeout(150);
            await settle(page);
            const ctx = `${shot.name} ${skin} ${theme} ${w}`;
            const found = await page.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, within: SCREEN });
            // the floating rule and the dialog's own close button belong to the shared dialog; `target` is asserted by the guard in the bubble skin
            results.push(...found.filter((f) => !(f.cls === 'floating') && (skin === 'bubble' || f.cls !== 'target')));
            own.push(...(await page.evaluate(ownTargets, { ctx, buttons: !SKIN_SIZED_BUTTONS.has(skin) })));
            expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${ctx}: the page scrolls sideways`).toBeLessThanOrEqual(1);
          }
          const { byCls, lines } = summarize(results);
          console.log(`layout-bridge-trust ${skin} ${theme} ${shot.name}: ${WIDTHS.length} checks, findings ${results.length} (${JSON.stringify(byCls)}), own targets under the hit area ${new Set(own).size}, page errors ${errors.length}`);
          for (const l of lines) console.log('  ' + l);
          for (const l of [...new Set(own)].slice(0, 30)) console.log('  [own target] ' + l);
          expect(errors, 'page errors').toEqual([]);
          expect(lines, 'layout findings').toEqual([]);
          expect([...new Set(own)], 'controls below the hit area').toEqual([]);
        });
      }
    }
  }
});
