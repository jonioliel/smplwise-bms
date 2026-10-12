import { test, expect, type Page } from '@playwright/test';
import { inPageCheck, summarize, type Finding } from './layout-guard';
import { NOW as SETTINGS_NOW, SKINS, url } from './access-control-mocks';
import { installMessagingSettings } from './wiskey-messaging-settings';
import { extraPeople, install, newMock, type PeopleMock } from './wiskey-people-mock';

// CR-036 WA: the layout guard (tests/layout-guard.ts) over the messaging UI - the person's page "הודעות" tab (the history and the opt-out
// switch), the message dialog (single, the bulk form, the bulk confirmation, the run in progress, the per-recipient result table) and the
// Settings page "הודעות" (the switches, the limits, the templates, with errors) - in every skin the product has, light and dark, across widths
// 320..1440, against the mocked backends (tests/wiskey-people-mock.ts, tests/wiskey-messaging-settings.ts). FAILS on escape / overflow /
// floating / clipped / target.  The shared sw-button is a component-level size and is skipped by the guard here; this UI's OWN controls (the
// template chips, the tabs, the opt-out switch, the rows, the form fields) are measured: at least 44 px high in touch layouts.
// The drawer and the dialog are top-layer / fixed layers: the guard walks the composed tree where the shell's column is their ancestor, so their
// boxes are measured by `layerCheck` instead (inside the viewport, no horizontal scroll in the body, every control inside the box).
// One test per skin x scheme (the gate's workers share the sweep).   npx playwright test tests/layout-wiskey-messaging.spec.ts --project=desktop
//   LAYOUT_QUICK=1: four widths and two skins (classic, bubble) in light - the quick local loop; the runner runs the whole sweep.
const QUICK = !!process.env.LAYOUT_QUICK;
const WIDTHS = QUICK ? [320, 390, 820, 1440] : [320, 360, 390, 480, 600, 768, 820, 1024, 1100, 1280, 1440];
const SKIN_SET = QUICK ? SKINS.filter((s) => s === 'classic' || s === 'bubble') : SKINS;
const THEMES = QUICK ? (['light'] as const) : (['light', 'dark'] as const);
const NOW = '2026-10-12T10:00:00Z';
const SCREEN = 'wiskey-people';
const height = (w: number) => (w <= 480 ? 844 : w <= 820 ? 1100 : 900);
const settle = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const SKIP = 'sw-button, sw-badge, sw-avatar, .trap, .sk, .skeletons';

async function check(page: Page, results: Finding[], ctx: string, keep: Finding['cls'][], root: string, within?: string) {
  await settle(page);
  const found = await page.evaluate(inPageCheck, { ctx, skip: SKIP, roots: [root], ...(within ? { within } : {}) });
  results.push(...found.filter((f) => keep.includes(f.cls)));
}

/** This UI's own controls: at least 44 px high in touch layouts (the template chips, the tabs, the switches, the form fields, the rows). */
async function ownTargets(page: Page, results: Finding[], ctx: string, hosts: string[]) {
  if ((page.viewportSize()?.width ?? 1440) > 1100) return;
  const small = await page.evaluate((tags) => {
    const out: string[] = [];
    const SEL = '.chip, .chipbtn, .tabs button, .sw, input:not([type="checkbox"]), select, textarea, .linkbtn, li';
    const visit = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (el.shadowRoot) visit(el.shadowRoot);
        if (!el.matches(SEL)) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.height < 43.5) out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.width)}x${Math.round(r.height)}`);
      }
    };
    const find = (root: Document | ShadowRoot, tag: string): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === tag) return el;
        const inner = el.shadowRoot && find(el.shadowRoot, tag);
        if (inner) return inner;
      }
      return null;
    };
    for (const tag of tags) {
      const host = find(document, tag);
      if (host?.shadowRoot) visit(host.shadowRoot);
    }
    return out;
  }, hosts);
  for (const s of small) results.push({ cls: 'target', el: 'own control', detail: `${s} < 44`, ctx });
}

/** A top-layer drawer / a fixed dialog: inside the viewport, no horizontal scroll in its body, every control inside its box. */
async function layerCheck(page: Page, results: Finding[], ctx: string, kind: 'drawer' | 'dialog') {
  const bad = await page.evaluate((k) => {
    const out: string[] = [];
    const find = (root: Document | ShadowRoot, tag: string): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === tag) return el;
        const inner = el.shadowRoot && find(el.shadowRoot, tag);
        if (inner) return inner;
      }
      return null;
    };
    const host = find(document, k === 'drawer' ? 'SW-DRAWER' : 'SW-DIALOG');
    if (!host) return ['not found'];
    const box = (k === 'drawer' ? host.shadowRoot!.querySelector('dialog') : host.shadowRoot!.querySelector('.box')) as HTMLElement | null;
    if (!box) return ['no box'];
    const r = box.getBoundingClientRect();
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) out.push(`box outside the viewport (${Math.round(r.left)}..${Math.round(r.right)} of ${innerWidth}, bottom ${Math.round(r.bottom)} of ${innerHeight})`);
    const body = host.shadowRoot!.querySelector('.body') as HTMLElement | null;
    if (body && body.scrollWidth > body.clientWidth + 1) out.push(`body scrolls horizontally (${body.scrollWidth} > ${body.clientWidth})`);
    const inside = (root: ParentNode) => {
      for (const c of root.querySelectorAll('select, input, textarea, button, sw-button, sw-badge, sw-avatar, table')) {
        const b = c.getBoundingClientRect();
        if (b.width && (b.left < r.left - 1 || b.right > r.right + 1)) out.push(`${c.tagName.toLowerCase()} outside the box`);
      }
    };
    inside(host);
    inside(host.shadowRoot!);
    return out;
  }, kind);
  for (const d of bad) results.push({ cls: 'overflow', el: kind, detail: d, ctx });
}

/** The results table of a bulk run: no horizontal scroll inside it, the pills not clipped, every row's text inside its cell. */
async function tableCheck(page: Page, results: Finding[], ctx: string) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const find = (root: Document | ShadowRoot): Element | null => {
      for (const el of root.querySelectorAll('*')) {
        if (el.tagName === 'WISKEY-MESSAGE-DIALOG') return el;
        const inner = el.shadowRoot && find(el.shadowRoot);
        if (inner) return inner;
      }
      return null;
    };
    const host = find(document);
    const table = host?.shadowRoot?.querySelector('table.results') as HTMLElement | null;
    if (!table) return ['no result table'];
    const t = table.getBoundingClientRect();
    // the dialog's scrolling body lives inside sw-dialog's own shadow root (the table is slotted into it)
    const body = host?.shadowRoot?.querySelector('sw-dialog')?.shadowRoot?.querySelector('.body') as HTMLElement | null;
    if (!body) out.push('no dialog body');
    else {
      const b = body.getBoundingClientRect();
      if (t.left < b.left - 1 || t.right > b.right + 1) out.push(`the table leaves the dialog's body (${Math.round(t.left)}..${Math.round(t.right)} of ${Math.round(b.left)}..${Math.round(b.right)})`);
    }
    if (table.scrollWidth > table.clientWidth + 1) out.push(`the table scrolls horizontally (${table.scrollWidth} > ${table.clientWidth})`);
    for (const td of table.querySelectorAll('td')) {
      if ((td as HTMLElement).scrollWidth > (td as HTMLElement).clientWidth + 1) out.push(`a cell overflows (${(td as HTMLElement).scrollWidth} > ${(td as HTMLElement).clientWidth}): ${(td.textContent ?? '').trim().slice(0, 30)}`);
      const r = td.getBoundingClientRect();
      if (r.right > t.right + 1 || r.left < t.left - 1) out.push('a cell outside the table');
    }
    return out;
  });
  for (const d of bad) results.push({ cls: 'overflow', el: 'result table', detail: d, ctx });
}

const people = (): PeopleMock => {
  const st = newMock('admin');
  st.messaging = true;
  st.people = [...st.people, ...extraPeople(6)];
  st.people[0].display_name = 'דנה כהן-לוי מורשית לכל התחנות של הארגון'; // a long name: the table and the history wrap it
  st.msg.bulkMax = 12;
  st.msg.quota = { limit: 40, used: 3 };
  st.msg.failFor = { p2: 'not_registered', p4: 'uncertain' };
  st.msg.history.p1 = [
    { id: 'a', at: '2026-10-12T08:21:00Z', by: 'מנהל אתר עם שם ארוך מאוד של משתמש', kind: 'template', template_id: 'closure', template_label: 'הכניסה סגורה זמנית עד להודעה חדשה', outcome: 'sent', reason: null, bulk: true },
    { id: 'b', at: '2026-10-11T16:02:00Z', by: 'בודק', kind: 'free', template_id: null, template_label: null, outcome: 'refused', reason: 'not_registered', bulk: false },
    { id: 'c', at: '2026-10-10T09:00:00Z', by: 'בודק', kind: 'template', template_id: 'x', template_label: null, outcome: 'unknown', reason: 'uncertain', bulk: false },
  ];
  return st;
};

interface Step {
  name: string;
  /** Brings the page into the state (at 1440 px, so the layers open the same way everywhere); the widths are swept after it. */
  run: (page: Page) => Promise<void>;
  /** The checks of the state at the current width. */
  check: (page: Page, results: Finding[], ctx: string, own: Finding['cls'][]) => Promise<void>;
}

interface Shot {
  name: string;
  /** `people` = the people screen with the message UI; `settings` = the Settings segment. */
  kind: 'people' | 'settings';
  steps: Step[];
}

const dlg = (p: Page) => p.locator('wiskey-message-dialog');
const drw = (p: Page) => p.locator('wiskey-person-drawer');
const SETTINGS = 'sw-app system-access-control system-access-messaging';
const stOf = new WeakMap<Page, PeopleMock>();
const st = (p: Page): PeopleMock => stOf.get(p)!;
const layer = (kind: 'drawer' | 'dialog', hosts: string[]): Step['check'] => async (p, r, ctx) => {
  await layerCheck(p, r, ctx, kind);
  await ownTargets(p, r, ctx, hosts);
};

const openBulk = async (p: Page, ids: string[]) => {
  await p.locator(`${SCREEN} [data-people-select-mode]`).click();
  for (const id of ids) await p.locator(`${SCREEN} [data-person-select="${id}"]`).click();
  await p.locator(`${SCREEN} [data-people-bulk-message]`).click();
  await expect(dlg(p).locator('[data-msg-preview]')).toBeVisible();
  await dlg(p).locator('[data-msg-template="closure"]').click();
};

const SHOTS: Shot[] = [
  {
    name: 'tab',
    kind: 'people',
    steps: [
      {
        name: 'history',
        run: async (p) => {
          await p.locator(`${SCREEN} [data-person-row="p1"]`).click();
          await drw(p).locator('[data-person-tab="messages"]').click();
          await expect(drw(p).locator('[data-msg-history-item]')).toHaveCount(3);
        },
        check: layer('drawer', ['wiskey-person-drawer', 'wiskey-person-messages']),
      },
    ],
  },
  {
    name: 'dialog-single',
    kind: 'people',
    steps: [
      {
        name: 'form',
        run: async (p) => {
          await p.locator(`${SCREEN} [data-person-row="p1"] [data-person-message-row]`).first().click();
          await expect(dlg(p).locator('[data-msg-recipient]')).toBeVisible();
          await dlg(p).locator('[data-msg-template="closure"]').click();
        },
        check: layer('dialog', ['wiskey-message-dialog']),
      },
      {
        name: 'uncertain',
        run: async (p) => {
          st(p).msg.mode = 'uncertain';
          await dlg(p).locator('[data-msg-send]').click();
          await expect(dlg(p).locator('[data-msg-line="failed"]')).toBeVisible();
        },
        check: layer('dialog', ['wiskey-message-dialog']),
      },
    ],
  },
  {
    name: 'dialog-bulk',
    kind: 'people',
    steps: [
      { name: 'form', run: (p) => openBulk(p, ['p1', 'p2', 'p4', 'p5', 'p3']), check: layer('dialog', ['wiskey-message-dialog']) },
      {
        name: 'confirm',
        run: async (p) => {
          await dlg(p).locator('[data-msg-send]').click();
          await expect(dlg(p).locator('[data-msg-line="confirm"]')).toBeVisible();
        },
        check: layer('dialog', ['wiskey-message-dialog']),
      },
      {
        name: 'result',
        run: async (p) => {
          await dlg(p).locator('[data-msg-confirm]').click();
          await expect(dlg(p).locator('[data-msg-results]')).toBeVisible();
        },
        check: async (p, r, ctx) => {
          await layerCheck(p, r, ctx, 'dialog');
          await tableCheck(p, r, ctx);
        },
      },
    ],
  },
  {
    name: 'dialog-running',
    kind: 'people',
    steps: [
      {
        name: 'running',
        run: async (p) => {
          st(p).msg.delayMs = 60_000; // the first send is still in flight while the widths are swept
          await openBulk(p, ['p1', 'p3', 'p7']);
          await dlg(p).locator('[data-msg-send]').click();
          await dlg(p).locator('[data-msg-confirm]').click();
          await expect(dlg(p).locator('[data-msg-stop]')).toBeVisible();
        },
        check: layer('dialog', ['wiskey-message-dialog']),
      },
    ],
  },
  {
    name: 'settings',
    kind: 'settings',
    steps: [
      {
        name: 'default',
        run: async () => {},
        check: async (p, r, ctx, own) => {
          await check(p, r, ctx, own, 'system-access-control');
          await ownTargets(p, r, ctx, ['system-access-messaging']);
        },
      },
      {
        name: 'errors',
        run: async (p) => {
          await p.locator(`${SETTINGS} [data-msg-template-body]`).first().fill('שלום {name}, הקוד שלך {pin} והוא נשלח ב־{phone}');
          await p.locator(`${SETTINGS} [data-msg-setting="bulk_max"]`).fill('0');
          await p.locator(`${SETTINGS} [data-msg-setting="organization"]`).fill('{name}');
          await p.locator(`${SETTINGS} [data-msg-save]`).click();
          await expect(p.locator(`${SETTINGS} [data-msg-notice="invalid"]`)).toBeVisible();
        },
        check: async (p, r, ctx, own) => {
          await check(p, r, ctx, own, 'system-access-control');
          await ownTargets(p, r, ctx, ['system-access-messaging']);
        },
      },
    ],
  },
];

test.describe('messaging layout guard', () => {
  test.describe.configure({ timeout: 40 * 60_000 });
  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one project runs the whole sweep');
    test.skip(process.env.SW_LIVE === '1', 'mocked-backend spec');
  });

  for (const skin of SKIN_SET) {
    for (const theme of THEMES) {
      test(`${skin} ${theme}: the person tab, the dialog (single, bulk, confirm, running, result) and the Settings page across widths`, async ({ context }) => {
        const errors: string[] = [];
        const results: Finding[] = [];
        let runs = 0;
        const own: Finding['cls'][] = skin === 'bubble' ? ['escape', 'overflow', 'floating', 'clipped', 'target'] : ['escape', 'overflow', 'clipped'];
        for (const shot of SHOTS) {
          const p = await context.newPage(); // a page per screen: the mock routes and the open layers belong to it
          p.on('pageerror', (e) => errors.push(`${shot.name}: ${e.message}`));
          await p.emulateMedia({ reducedMotion: 'reduce' });
          await p.setViewportSize({ width: 1440, height: 900 });
          if (shot.kind === 'people') {
            const mock = people();
            stOf.set(p, mock);
            await p.clock.setFixedTime(new Date(NOW));
            await install(p, mock);
            await p.goto(`/?design=a&skin=${skin}&scheme=${theme}#/wiskey/people`);
            await p.waitForSelector('sw-app');
            await expect(p.locator(`${SCREEN} sw-page`)).toHaveAttribute('data-people-phase', 'ready', { timeout: 20_000 });
          } else {
            await installMessagingSettings(p, { persona: 'admin' });
            await p.clock.setFixedTime(SETTINGS_NOW);
            await p.goto(url('/system/access-control/messaging', skin, theme));
            await p.waitForSelector(`${SETTINGS} [data-access-status="ready"]`, { timeout: 30_000 });
          }
          await p.evaluate(() => document.fonts.ready);
          // the smallest touch dial the owner can pick, WITH its unit (a unitless value makes every var(--sw-touch-desktop) size invalid and
          // the controls collapse to their text); bubble is the skin that makes the dial, so it keeps its own (44 px)
          if (skin !== 'bubble') await p.evaluate(() => document.documentElement.style.setProperty('--sw-touch-desktop', '32px'));
          for (const step of shot.steps) {
            await p.setViewportSize({ width: 1440, height: 900 });
            await step.run(p);
            for (const w of WIDTHS) {
              await p.setViewportSize({ width: w, height: height(w) });
              await p.waitForTimeout(150);
              runs++;
              await step.check(p, results, `${shot.name} ${step.name} ${skin} ${theme} ${w}`, own);
            }
          }
          if (shot.kind === 'people') {
            st(p).msg.delayMs = 0; // lets the send that was held in flight go, so the run finishes before the page closes
            if (shot.name === 'dialog-running') await expect(dlg(p).locator('[data-msg-results]')).toBeVisible({ timeout: 15_000 });
          }
          await p.close();
        }
        const { byCls, lines } = summarize(results);
        console.log(`layout-wiskey-messaging ${skin} ${theme}: ${runs} runs, findings ${results.length} (${JSON.stringify(byCls)}), page errors ${errors.length}`);
        for (const l of lines) console.log('  ' + l);
        expect(errors, 'page errors').toEqual([]);
        expect(lines, 'layout findings').toEqual([]);
      });
    }
  }
});
