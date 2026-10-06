import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// M074 visual-diff matrix: every screen in tests/visual/matrix.json x state x scheme, at the Playwright project's viewport
// (desktop 1440 / tablet 1024 / mobile 390), compared with toHaveScreenshot against the committed per-OS baselines in
// tests/visual-matrix.spec.ts-snapshots/. Run it through `node scripts/visual.mjs` (selection, report, deliberate accept).
// Demo mode (no backend); `?skin=` / `?scheme=` are the session override. Baselines are per OS (win32 / linux): a missing
// baseline is skipped with an annotation (the design-foundation rule) and listed as "no baseline" in the report.
// Env: SW_VISUAL_ONLY=a,b screens to run | SW_VISUAL_SCHEMES=light | SW_VISUAL_THRESHOLD / SW_VISUAL_RATIO override the matrix.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const M = JSON.parse(fs.readFileSync(path.join(HERE, 'visual', 'matrix.json'), 'utf8')) as {
  threshold: number;
  maxDiffPixelRatio: number;
  schemes: string[];
  skin: string;
  fixedTime: string;
  screens: { id: string; hash: string; states: string[]; threshold?: number; maxDiffPixelRatio?: number }[];
};
const only = (process.env.SW_VISUAL_ONLY || '').split(',').map((s) => s.trim()).filter(Boolean);
const schemesEnv = (process.env.SW_VISUAL_SCHEMES || '').split(',').map((s) => s.trim()).filter(Boolean);
const SCHEMES = schemesEnv.length ? schemesEnv : M.schemes;

/** `--update-snapshots` writes the baseline; without it a missing file is a skip, not a failure. */
const noBaseline = (info: { snapshotPath: (...name: string[]) => string; config: { updateSnapshots: string } }, name: string) =>
  !['all', 'changed', 'missing'].includes(info.config.updateSnapshots) && !fs.existsSync(info.snapshotPath(name));

async function open(page: Page, hash: string, scheme: string) {
  await page.clock.setFixedTime(new Date(M.fixedTime));
  await page.addInitScript(() => {
    try {
      localStorage.setItem('sw.devices.layout', 'cards');
    } catch {
      /* storage unavailable */
    }
  });
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

test.describe('visual matrix', () => {
  test.skip(process.env.SW_LIVE === '1', 'demo-mode spec');
  for (const s of M.screens) {
    if (only.length && !only.includes(s.id)) continue;
    for (const state of s.states) {
      for (const scheme of SCHEMES) {
        // "pixel-stable" in the title: the release gate's pixel group greps for it
        test(`vm ${s.id} ${state} ${scheme} is pixel-stable`, async ({ page }, info) => {
          const name = `${s.id}-${state}-${scheme}.png`;
          test.skip(noBaseline(info, name), `no ${process.platform} baseline yet (visual.mjs --accept)`);
          await open(page, s.hash, scheme);
          await applyState(page, state);
          await expect(page).toHaveScreenshot(name, {
            animations: 'disabled',
            threshold: Number(process.env.SW_VISUAL_THRESHOLD ?? s.threshold ?? M.threshold),
            maxDiffPixelRatio: Number(process.env.SW_VISUAL_RATIO ?? s.maxDiffPixelRatio ?? M.maxDiffPixelRatio),
          });
        });
      }
    }
  }
});
