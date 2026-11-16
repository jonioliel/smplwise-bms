import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// AUDIT30-A-GLASS-BRIDGE (design audit round 30, finding 13: "two darks, two inks"). Measured in the browser, demo fixtures, classic
// skin: on the glass screens the palette "default" knobs resolve to the PRODUCT's tokens - the ink (--dv-text / -2 / -3), the solid
// surfaces, the hairline - and the translucent panel is the product's navy in dark (it was rgba(28, 28, 30, .72), a neutral black-grey,
// with ink #f5f5f7 beside the product's #e4e9f3). The page canvas behind the service-calls board equals the one behind the
// electricity meters. Source-level guard: tests/unit-glass-bridge-audit30a.spec.ts. Pixel: tests/pixel-audit30a-glass-bridge.spec.ts.
//   run_smart.py preview <branch> tests/evidence-audit30a-glass-bridge.spec.ts --project=desktop --workers=1

const EVIDENCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/design/evidence/AUDIT30-A-GLASS-BRIDGE');
type Scheme = 'light' | 'dark';

async function open(page: Page, hash: string, scheme: Scheme) {
  await page.route('**/api/v1/**', (route) => route.abort()); // demo mode whatever runs on the preview's proxy target
  await page.addInitScript((sch) => {
    try {
      localStorage.setItem('sw.demo.automations', JSON.stringify({ user: 'installer', scheme: sch }));
    } catch {
      /* private window */
    }
  }, scheme);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.goto('about:blank');
  await page.goto(`/?design=a&fit=off&skin=classic&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(1800);
}

interface Knobs {
  host: string;
  theme: string | null;
  scheme: string | null;
  own: boolean;
  knob: Record<string, string>;
  product: Record<string, string>;
  ink: string;
  panel: string;
}

/** the first glass host of the screen (any shadow depth): its resolved knobs, the product tokens on the shell, its ink and its panel */
async function knobsOf(page: Page, tag: string): Promise<Knobs | null> {
  return page.evaluate((tag) => {
    let host: HTMLElement | null = null;
    const walk = (root: Document | ShadowRoot) => {
      for (const el of root.querySelectorAll('*')) {
        if (!host && el.localName === tag && el.getAttribute('data-devices-style') === 'glass') host = el as HTMLElement;
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    const h = host as HTMLElement | null;
    if (!h) return null;
    // normalise any colour (hex, rgb, color-mix) to rgb(a) through a probe element's computed background
    const norm = (inside: Element | ShadowRoot, v: string) => {
      const p = document.createElement('i');
      p.style.background = v;
      (inside as Element).appendChild(p);
      const c = getComputedStyle(p).backgroundColor;
      p.remove();
      return c;
    };
    const root = h.shadowRoot ?? h;
    const app = document.querySelector('sw-app') as HTMLElement;
    const keys = ['--dv-text', '--dv-text-2', '--dv-text-3', '--dv-surface-solid', '--dv-border'];
    const knob: Record<string, string> = {};
    for (const k of keys) knob[k] = norm(root, `var(${k})`);
    const product: Record<string, string> = {};
    for (const k of ['--sw-text', '--sw-text-2', '--sw-text-3', '--sw-surface-solid', '--sw-border']) product[k] = norm(app.shadowRoot ?? app, getComputedStyle(app).getPropertyValue(k).trim());
    return {
      host: h.localName,
      theme: h.getAttribute('data-devices-theme'),
      scheme: h.getAttribute('data-devices-scheme'),
      own: h.hasAttribute('data-devices-own-backdrop'),
      knob,
      product,
      ink: getComputedStyle(h).color,
      panel: norm(root, 'var(--dv-surface)'),
    };
  }, tag);
}

/** [r, g, b (0-255), alpha] of an rgb() / rgba() / color(srgb 0-1 ...) computed value (color-mix() computes to the last form) */
const rgb = (s: string) => {
  const n = (s.replace(/^color\(srgb/, '').match(/[\d.]+/g) ?? []).map(Number);
  return s.startsWith('color(srgb') ? [...n.slice(0, 3).map((v) => v * 255), n[3] ?? 1] : n;
};

/** the bottom-left pixel of the viewport (the page canvas: the rail is at the inline start, on the right in RTL) */
async function cornerPixel(page: Page): Promise<number[]> {
  const png = await page.screenshot({ type: 'png' });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d')!;
    g.drawImage(img, 0, 0);
    return [...g.getImageData(3, img.height - 3, 1, 1).data].slice(0, 3);
  }, png.toString('base64'));
}

const SCREENS = [
  ['/tickets/board', 'tickets-board'],
  ['/devices/schedules', 'devices-schedules'],
  ['/multimedia/players', 'multimedia-players'],
  ['/system/notifications', 'system-notifications'],
] as const;

test.describe('AUDIT30-A: the glass screens read the product ink and surfaces (finding 13)', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-fixture spec');

  for (const scheme of ['light', 'dark'] as const) {
    for (const [hash, tag] of SCREENS) {
      test(`${tag} ${scheme}: the glass knobs are the product tokens; dark panels are navy`, async ({ page }, info) => {
        test.skip(info.project.name !== 'desktop', 'colour tokens do not depend on the viewport');
        await open(page, hash, scheme);
        const k = await knobsOf(page, tag);
        expect(k, `${tag}: no glass host`).not.toBeNull();
        expect(k!.theme).toBe('default');
        expect(k!.own, 'the glass scheme follows the product (no own backdrop)').toBe(false);
        expect(k!.scheme).toBe(scheme);
        expect(k!.knob['--dv-text']).toBe(k!.product['--sw-text']);
        expect(k!.knob['--dv-text-2']).toBe(k!.product['--sw-text-2']);
        expect(k!.knob['--dv-text-3']).toBe(k!.product['--sw-text-3']);
        expect(k!.knob['--dv-surface-solid']).toBe(k!.product['--sw-surface-solid']);
        expect(k!.knob['--dv-border']).toBe(k!.product['--sw-border']);
        expect(k!.ink, 'the screen draws in the product ink').toBe(k!.product['--sw-text']);
        const [r, g, b, a] = rgb(k!.panel);
        expect(a ?? 1, 'the panel stays translucent glass').toBeLessThan(1);
        if (scheme === 'dark') expect(b - r, `dark panel ${k!.panel} must be navy (blue above red), not neutral black-grey`).toBeGreaterThanOrEqual(8);
        void g;
        if (tag === 'tickets-board') {
          fs.mkdirSync(EVIDENCE, { recursive: true });
          await page.screenshot({ path: path.join(EVIDENCE, `${tag}-${scheme}-1440.png`) });
        }
      });
    }

    test(`${scheme}: the canvas behind the service-calls board equals the one behind the electricity meters`, async ({ page }, info) => {
      test.skip(info.project.name !== 'desktop', 'one size');
      await open(page, '/infra/electricity/meters', scheme);
      const meters = await cornerPixel(page);
      await open(page, '/tickets/board', scheme);
      const board = await cornerPixel(page);
      for (let i = 0; i < 3; i++) expect(Math.abs(board[i] - meters[i]), `board ${board} vs meters ${meters}`).toBeLessThanOrEqual(2);
    });
  }
});
