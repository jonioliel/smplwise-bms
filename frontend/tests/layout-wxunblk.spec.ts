import { test, expect, type Page } from '@playwright/test';
import { SKINS_UNDER_TEST as SKIN_IDS } from './helpers/frozen-skins';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { ENTITIES, installBlocksMock, manyEntities, newBlocksMock, openSetup, type BlocksMock } from './wxunblk-mocks';

// WXUNBLK: the layout guard (tests/layout-guard.ts) over the card "חסימות פתיחת דלתות" on Settings > חיבורים, against the MOCKED backend, in every skin
// the build has x light / dark x widths 320-1440, in the states of the card: the list, a list with a release, a long list with a search, the
// question of a release with the note's problem showing, and the installation with no door. It FAILS on escape / overflow / clipped (nothing
// leaves its row, no text is cut without an ellipsis, the page never scrolls sideways). The 44 px rule is asserted for what this card owns
// in every skin - the search box and the switch's box (a press on the host flips it) - and for its buttons in the skins whose buttons follow
// the shared size dial (classic, tesla, bubble); domus and crystal set every sw-button to 30-34 px in their own skin rules
// (design/skins/domus.ts, crystal.ts), for the whole product, so there the button sizes are the skins' and not asserted here. The guard's own
// `target` class is asserted in the bubble skin, the way the S12 spec does (the shared chip and the switch keep their own sizes elsewhere).
//   SW_BASE_URL=http://127.0.0.1:<port>/ LAYOUT_QUICK=1 npx playwright test tests/layout-wxunblk.spec.ts --project=desktop --workers=1
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1280, 1440];
const SKINS = QUICK ? SKIN_IDS.filter((s) => s === 'classic' || s === 'bubble') : SKIN_IDS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
// the skeleton and the icons carry no text of their own; the switch's own 42 x 24 button is measured through its host below
const SKIP = ".skl, sw-icon, svg, sw-toggle, [role='switch']";
const SCREEN = 'sw-door-blocks';
const BUBBLE = '.ent, .item, .row, .tools, .ctl, .who';
// the skins whose own rules size every sw-button (30-34 px); the dial the card sets (--sw-ctl-h-*) is theirs to ignore
const SKIN_SIZED_BUTTONS = new Set(['domus', 'crystal']);

const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

interface Shot {
  name: string;
  mock: () => BlocksMock;
  then?: (page: Page) => Promise<void>;
}

const SHOTS: Shot[] = [
  { name: 'list', mock: () => newBlocksMock() },
  { name: 'released', mock: () => newBlocksMock({ released: { 'switch.gate': { note: 'מתג רגיל של הדייר, מחובר לשער החצר ולא פותח דלת', by: 'יוני', at: '2026-10-12T07:00:00Z' } } }) },
  {
    name: 'long-search',
    mock: () => newBlocksMock({ entities: [...ENTITIES.map((e) => ({ ...e })), ...manyEntities(120)] }),
    then: async (p) => {
      await p.locator(`${SCREEN} input[data-door-blocks-search]`).fill('תאורה 0');
      await p.waitForSelector(`${SCREEN} [data-door-block]`);
    },
  },
  {
    name: 'question',
    mock: () => newBlocksMock(),
    then: async (p) => {
      await p.locator(`${SCREEN} [data-door-block="switch.gate"] sw-toggle`).click();
      await p.locator(`${SCREEN} sw-button[data-door-block-ok]`).click(); // the reason is missing: the problem shows
      await p.waitForSelector(`${SCREEN} [data-door-block-problem]`);
    },
  },
  { name: 'no-door', mock: () => newBlocksMock({ present: false }) },
];

/** Runs inside the page: this card's own controls that are smaller than the hit area (the search box, the switch's host, its buttons). */
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
  const host = find(app, 'sw-door-blocks') as HTMLElement | null;
  const root = host?.shadowRoot;
  if (!root) return [`${args.ctx}: the card was not found`];
  const seen = (el: Element) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const check = (el: Element, name: string) => {
    if (!seen(el)) return;
    const r = el.getBoundingClientRect();
    if (r.width < min - 0.5 || r.height < min - 0.5) out.push(`${args.ctx}: ${name} ${Math.round(r.width)}x${Math.round(r.height)} < ${min}`);
  };
  for (const el of Array.from(root.querySelectorAll('input, textarea'))) check(el, el.tagName.toLowerCase());
  for (const el of Array.from(root.querySelectorAll('sw-toggle'))) check(el, 'sw-toggle (host)');
  if (args.buttons) {
    for (const el of Array.from(root.querySelectorAll('sw-button'))) {
      const inner = el.shadowRoot?.querySelector('button');
      if (inner && !(inner as HTMLButtonElement).disabled) check(inner, `sw-button "${(el.textContent || '').trim().slice(0, 14)}"`);
    }
  }
  return out;
}

test.describe('WXUNBLK layout guard', () => {
  test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  test.describe.configure({ timeout: 30 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
  });

  for (const skin of SKINS) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: the card across widths in its states`, async ({ page, context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        const own: string[] = [];
        let runs = 0;
        for (const shot of SHOTS) {
          const p = await context.newPage();
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          await installBlocksMock(p, shot.mock());
          await p.setViewportSize({ width: 1440, height: 900 });
          await openSetup(p, { skin, scheme: theme });
          await p.waitForSelector(`${SCREEN} sw-card[data-door-blocks-card], ${SCREEN} sw-state-panel`, { timeout: 30_000 });
          if (shot.then) await shot.then(p);
          await p.evaluate(() => document.fonts.ready);
          for (const w of WIDTHS) {
            await p.setViewportSize({ width: w, height: height(w) });
            await p.waitForTimeout(150);
            await settle(p);
            runs++;
            const ctx = `${shot.name} ${skin} ${theme} ${w}`;
            const found = await p.evaluate(inPageCheck, { ctx, bubble: BUBBLE, skip: SKIP, within: SCREEN });
            // the floating rule and the dialog's own close button belong to the shared dialog; `target` is asserted by the guard in the bubble skin
            results.push(...found.filter((f) => !(f.cls === 'floating') && (skin === 'bubble' || f.cls !== 'target')));
            own.push(...(await p.evaluate(ownTargets, { ctx, buttons: !SKIN_SIZED_BUTTONS.has(skin) })));
            expect(await p.evaluate(() => document.documentElement.scrollWidth - innerWidth), `${ctx}: the page scrolls sideways`).toBeLessThanOrEqual(1);
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-wxunblk ${skin} ${theme}: ${runs} checks, findings ${results.length} (${JSON.stringify(byCls)}), own targets under the hit area ${new Set(own).size}, page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        for (const l of [...new Set(own)].slice(0, 30)) console.log('  [own target] ' + l);
        void page;
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
        expect([...new Set(own)], 'controls below the hit area').toEqual([]);
      });
    }
  }
});
