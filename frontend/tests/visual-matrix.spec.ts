import { test, expect, type Page } from '@playwright/test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// M074 visual-diff matrix: every screen in tests/visual/matrix.json x state x scheme, at the Playwright project's viewport
// (desktop 1440 / tablet 1024 / mobile 390), compared with toHaveScreenshot against the committed per-OS baselines in
// tests/visual-matrix.spec.ts-snapshots/. Run it through `node scripts/visual.mjs` (selection, report, deliberate accept).
// Demo mode (no backend); `?skin=` / `?scheme=` are the session override. Baselines are per OS (win32 / linux): a missing
// baseline is skipped with an annotation (the design-foundation rule) and listed as "no baseline" in the report.
// Per screen, matrix.json may set `threshold` / `maxDiffPixelRatio` (tolerance override) and `mask` (CSS selectors of animated or live
// regions, painted over in both baseline and actual; a top-level `mask` applies to every screen; open shadow DOM is pierced).
// Env: SW_VISUAL_ONLY=a,b screens to run | SW_VISUAL_SCHEMES=light | SW_VISUAL_THRESHOLD / SW_VISUAL_RATIO override the matrix.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'visual', 'matrix.json'), 'utf8')) as {
  threshold: number;
  maxDiffPixelRatio: number;
  schemes: string[];
  skin: string;
  fixedTime: string;
  mask?: string[];
  screens: { id: string; hash: string; layout?: string; states: string[]; threshold?: number; maxDiffPixelRatio?: number; mask?: string[] }[];
};
const only = (process.env.SW_VISUAL_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const schemesEnv = (process.env.SW_VISUAL_SCHEMES || '').split(',').map((s) => s.trim()).filter(Boolean);
const SCHEMES = schemesEnv.length ? schemesEnv : M.schemes;

/** `--update-snapshots` writes the baseline; without it a missing file is a skip, not a failure. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed', 'missing'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, hash: string, scheme: string, layout = 'cards') {
  await page.clock.setFixedTime(new Date(M.fixedTime));
  // `layout` (matrix.json, per screen) is the building screen's own view: cards (floor cards) or tiles (area tiles per floor)
  await page.addInitScript((l) => {
    try {
      localStorage.setItem('sw.devices.layout', l);
    } catch {
      /* storage unavailable */
    }
  }, layout);
  await page.goto('about:blank');
  await page.goto(`/?design=a&look=performance:full&skin=${M.skin}&scheme=${scheme}#${hash}`);
  await page.waitForSelector('sw-app');
  await page.waitForTimeout(900);
  await page.evaluate(() => document.fonts.ready);
}

async function applyState(page: Page, state: string) {
  if (state === 'dialog') {
    await page.evaluate(() => {
      const d = document.createElement('sw-dialog') as HTMLElement & { open: boolean; heading: string };
      d.heading = 'לכבות 3 מסכים בקומת קרקע?';
      d.innerHTML =
        '<p style="margin:0 0 10px">הפעולה תכבה את המסכים שדולקים כרגע.</p><sw-field label="הערה"><input value="בדיקת עיצוב" /></sw-field>' +
        '<sw-button slot="footer" variant="ghost">ביטול</sw-button><sw-button slot="footer" variant="primary">כבה</sw-button>';
      document.body.appendChild(d);
      d.open = true;
    });
    await page.waitForTimeout(400);
  } else if (state === 'panels') {
    await page.evaluate(() => {
      const w = document.createElement('div');
      w.style.cssText =
        'position:fixed;inset:0;z-index:99999;background:var(--sw-bg,Canvas);display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;padding:16px;overflow:auto';
      for (const s of ['loading', 'empty', 'error', 'forbidden', 'stale', 'partial']) {
        const p = document.createElement('sw-state-panel');
        p.setAttribute('state', s);
        w.appendChild(p);
      }
      document.body.appendChild(w);
    });
    await page.waitForTimeout(300);
  }
}

const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex');

/** Cases that share state + scheme (and so the viewport of the project) must show different screens. A case whose picture is
 * byte-identical to another case's committed baseline is a routing mistake in matrix.json (devices-building once captured the
 * home page, settings-diagnostics the General tab), not coverage. Only comparable for screens that have a baseline on this OS. */
function duplicateOf(info: { snapshotPath: (...name: string[]) => string }, bytes: Buffer, selfId: string, state: string, scheme: string) {
  const mine = sha(bytes);
  for (const o of M.screens) {
    if (o.id === selfId || !o.states.includes(state)) continue;
    const f = info.snapshotPath(`${o.id}-${state}-${scheme}.png`);
    if (fs.existsSync(f) && sha(fs.readFileSync(f)) === mine) return o.id;
  }
  return null;
}

test.describe('visual matrix', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');

  // The baselines themselves: no two screens may have the same picture (see duplicateOf). Runs without a browser.
  test('vm no two screens share a baseline picture', async ({}, info) => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const s of M.screens) {
      for (const state of s.states) {
        for (const scheme of M.schemes) {
          const f = info.snapshotPath(`${s.id}-${state}-${scheme}.png`);
          if (!fs.existsSync(f)) continue;
          const key = sha(fs.readFileSync(f));
          const prev = seen.get(key);
          if (prev && prev.split(':')[0] !== s.id) dup.push(`${prev} == ${s.id}:${state}:${scheme}`);
          else seen.set(key, `${s.id}:${state}:${scheme}`);
        }
      }
    }
    expect(dup, 'two matrix cases capture the same screen (fix their hash/layout in matrix.json)').toEqual([]);
  });

  for (const s of M.screens) {
    if (only.length && !only.includes(s.id)) continue;
    for (const state of s.states) {
      for (const scheme of SCHEMES) {
        // "pixel-stable" in the title: the release gate's pixel group greps for it
        test(`vm ${s.id} ${state} ${scheme} is pixel-stable`, async ({ page }, info) => {
          const name = `${s.id}-${state}-${scheme}.png`;
          test.skip(noBaseline(info, name), `no ${process.platform} baseline yet (visual.mjs --accept)`);
          await open(page, s.hash, scheme, s.layout);
          await applyState(page, state);
          const twin = duplicateOf(info, await page.screenshot({ animations: 'disabled' }), s.id, state, scheme);
          expect(twin, `${s.id} shows the same picture as ${twin}: its route in matrix.json does not reach its own screen`).toBeNull();
          await expect(page).toHaveScreenshot(name, {
            animations: 'disabled',
            mask: [...(M.mask ?? []), ...(s.mask ?? [])].map((sel) => page.locator(sel)),
            maskColor: '#ff00ff',
            threshold: Number(process.env.SW_VISUAL_THRESHOLD ?? s.threshold ?? M.threshold),
            maxDiffPixelRatio: Number(process.env.SW_VISUAL_RATIO ?? s.maxDiffPixelRatio ?? M.maxDiffPixelRatio),
          });
        });
      }
    }
  }
});
