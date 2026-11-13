import { test, expect, type Page } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// AUDIT30-D-MULTIMEDIA (design audit round 30, 2026-11-12, FIXES.md section 5): regression guard for the multimedia screens.
//   D1 (#4, Q3 a)  the chosen room chip is the soft accent fill with the accent ink (it was a black pill), 34 px high on a desktop
//   D2 (#17)       a floor / section heading is --sw-fs-xl semibold, one tier under the page title; one <h1> per screen
//   D3 (#6)        the three screens are framed by the shared <sw-page> (its <h1>, its subheading, actions at the row's end)
//   D4 (#5, Q7 a)  no page scroll at 1366x768 (kept from NOSCROLL-1366-2437: pages instead of scrolling)
//   D5             no raw-ms transition / animation duration and no px border radius in the module's own files
//   SW_BASE_URL=http://127.0.0.1:<port>/ npx playwright test tests/audit30-d-multimedia.spec.ts --project=desktop

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');
const read = (f: string) => readFileSync(join(SRC, f), 'utf8');
/** the files branch D owns (components/media-remote-css.ts is the glass bridge's; *-logic.ts carry no CSS) */
const OWNED = [
  ...readdirSync(join(SRC, 'screens')).filter((f) => f.startsWith('multimedia-')).map((f) => `screens/${f}`),
  ...readdirSync(join(SRC, 'components')).filter((f) => f.startsWith('media-') && f !== 'media-remote-css.ts' && !f.endsWith('logic.ts')).map((f) => `components/${f}`),
  'styles/media-page.ts',
];
const SCREENS = [
  { id: 'screens', file: 'screens/multimedia-screens.ts', hash: '/multimedia/screens', tag: 'multimedia-screens', title: 'מסכים' },
  { id: 'players', file: 'screens/multimedia-players.ts', hash: '/multimedia/players', tag: 'multimedia-players', title: 'נגנים ורמקולים' },
  { id: 'groups', file: 'screens/multimedia-groups.ts', hash: '/multimedia/groups', tag: 'multimedia-groups', title: 'קבוצות' },
] as const;

test.describe('AUDIT30-D sources', () => {
  test('D1: the selected room chip is the Blue Wash pair in both copies of the rule, never the black pill', () => {
    for (const f of ['styles/media-page.ts', 'screens/multimedia-screens.ts']) {
      const rule = /\.rc\[aria-pressed='true'\] \{([\s\S]*?)\}/.exec(read(f))?.[1] ?? '';
      expect(rule, f).toContain('background: var(--sw-accent-soft)');
      expect(rule, f).toContain('color: var(--sw-accent-text)');
      expect(rule, f).toContain('box-shadow: none');
      expect(rule, f).not.toContain('--dv-text');
      expect(rule, f).not.toContain('--mm-text-inverse');
      const chip = /\n    \.rc \{([\s\S]*?)\}/.exec(read(f))?.[1] ?? '';
      expect(chip, f).toContain('block-size: var(--sw-ctl-h-md)');
    }
  });

  test('D2: the section heading is the xl step, semibold, in both copies', () => {
    for (const f of ['styles/media-page.ts', 'screens/multimedia-screens.ts']) {
      const rule = /\.sh h2 \{([\s\S]*?)\}/.exec(read(f))?.[1] ?? '';
      expect(rule, f).toContain('font-size: var(--sw-fs-xl)');
      expect(rule, f).toContain('font-weight: var(--sw-fw-semibold)');
    }
  });

  test('D3: the three screens are framed by sw-page and draw no <h1> of their own', () => {
    for (const s of SCREENS) {
      const src = read(s.file);
      expect(src, s.file).toContain(`<sw-page class="page" wide heading="${s.title}"`);
      expect(src, s.file).not.toMatch(/<h1\b/);
    }
  });

  test('D5: no raw-ms duration and no px radius in the module (tokens only)', () => {
    const bad: string[] = [];
    for (const f of OWNED) {
      const src = read(f);
      for (const m of src.match(/(transition|animation)[^;{}]*?\b\d+(\.\d+)?m?s\b/g) ?? []) bad.push(`${f}: ${m}`);
      for (const m of src.match(/border-radius:\s*[\d.]+px/g) ?? []) bad.push(`${f}: ${m}`);
    }
    expect(bad).toEqual([]);
  });
});

async function open(page: Page, hash: string, tag: string, scheme: 'light' | 'dark') {
  await page.route('**/api/v1/**', (route) => route.abort());
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* storage unavailable */
    }
  });
  await page.goto(`/?design=a&skin=classic&scheme=${scheme}#${hash}`);
  await page.locator(`sw-app ${tag} sw-page`).first().waitFor({ timeout: 30_000 });
  await page.locator(`sw-app ${tag} [data-mm-state="ready"]`).first().waitFor({ timeout: 20_000 });
  await page.evaluate(() => document.fonts.ready);
}

/** Every <h1> under the shell's main, shadow roots pierced, with the host that draws it. */
const headings = (page: Page) =>
  page.evaluate(() => {
    const out: { host: string; text: string; fs: number }[] = [];
    const main = document.querySelector('sw-app')?.shadowRoot?.querySelector('main');
    const walk = (root: ParentNode) => {
      for (const el of root.querySelectorAll<HTMLElement>('*')) {
        if (el.shadowRoot) walk(el.shadowRoot);
        if (el.localName === 'h1' && el.getClientRects().length) out.push({ host: (el.getRootNode() as ShadowRoot).host?.localName ?? '', text: el.textContent?.trim() ?? '', fs: parseFloat(getComputedStyle(el).fontSize) });
      }
    };
    if (main) walk(main);
    return out;
  });

test.describe('AUDIT30-D in the browser (demo data, classic)', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  for (const s of SCREENS) {
    test(`${s.id}: one h1 from sw-page, smaller section headings, no page scroll at 1366x768`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop viewport set by the test');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await open(page, s.hash, s.tag, 'light');
      const h = await headings(page);
      expect(h).toHaveLength(1);
      expect(h[0]).toMatchObject({ host: 'sw-page', text: s.title });
      const sec = await page.locator(`sw-app ${s.tag}`).evaluate((el) => [...el.shadowRoot!.querySelectorAll('.sh h2')].filter((x) => x.getClientRects().length).map((x) => ({ fs: parseFloat(getComputedStyle(x).fontSize), fw: Number(getComputedStyle(x).fontWeight) })));
      expect(sec.length).toBeGreaterThan(0);
      for (const x of sec) {
        expect(x.fs).toBeLessThan(h[0].fs);
        expect(x.fw).toBeLessThanOrEqual(600);
      }
      const over = await page.locator(`sw-app ${s.tag}`).evaluate((el) => {
        const main = document.querySelector('sw-app')!.shadowRoot!.querySelector('main')!;
        return Math.max(el.scrollHeight - el.clientHeight, main.scrollHeight - main.clientHeight, document.scrollingElement!.scrollHeight - document.scrollingElement!.clientHeight);
      });
      expect(over).toBeLessThanOrEqual(1);
    });
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`D1 selected room chip, ${scheme}: soft accent fill, accent ink, no shadow, 34 px`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'desktop viewport set by the test');
      for (const s of SCREENS.slice(0, 2)) {
        await open(page, s.hash, s.tag, scheme);
        const chip = page.locator(`sw-app ${s.tag} .rc[aria-pressed="true"]`).first();
        await expect(chip).toBeVisible();
        const st = await chip.evaluate((el) => {
          const cs = getComputedStyle(el);
          const probe = document.createElement('span');
          probe.style.cssText = 'background: var(--sw-accent-soft); color: var(--sw-accent-text)';
          el.parentElement!.append(probe);
          const ref = getComputedStyle(probe);
          const out = { bg: cs.backgroundColor, fg: cs.color, refBg: ref.backgroundColor, refFg: ref.color, shadow: cs.boxShadow, h: el.getBoundingClientRect().height };
          probe.remove();
          return out;
        });
        expect(st.bg, s.id).toBe(st.refBg);
        expect(st.fg, s.id).toBe(st.refFg);
        expect(st.shadow, s.id).toBe('none');
        expect(Math.round(st.h), s.id).toBe(34);
      }
    });
  }
});
