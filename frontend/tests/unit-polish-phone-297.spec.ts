import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { COARSE_MQ, MOBILE_POLISH_DOCUMENT, MOBILE_POLISH_SHADOW, PHONE_MQ } from '../src/design/mobile-polish-css';
import { TOKENS } from '../src/design/tokens';

// POLISH-PHONE-297 (round 4, P5): the phone layer is a set of gated rules - the contract here is that every rule that changes a drawing is
// gated to the phone / a touch pointer / no hover (a desktop draws what it drew), that the never-ship list of the mobile-native skill is
// respected (no maximum-scale, 16 px fields, hover gated), and that the status bar colour is the page's own background. Node only; the
// measured behaviour is in private/design-system-2026-10-27/round4/p5-phone (Playwright, Pixel 7).
//   npx playwright test tests/unit-polish-phone-297.spec.ts --project=desktop

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const indexHtml = readFileSync(resolve(ROOT, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(resolve(ROOT, 'public/arx-manifest.webmanifest'), 'utf8')) as { theme_color: string; background_color: string };

/** The top-level blocks of a sheet: [prelude, body] pairs (nested braces balanced). */
function topBlocks(css: string): { prelude: string; body: string }[] {
  const out: { prelude: string; body: string }[] = [];
  let depth = 0;
  let start = 0;
  let prelude = '';
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === '{') {
      if (depth === 0) {
        prelude = css.slice(start, i).replace(/\/\*[\s\S]*?\*\//g, '').trim();
        start = i + 1;
      }
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0) {
        out.push({ prelude, body: css.slice(start, i) });
        start = i + 1;
      }
    }
  }
  return out;
}

test('the viewport keeps user zoom (no maximum-scale / user-scalable=no) and names the safe areas', () => {
  const vp = /<meta name="viewport" content="([^"]+)"/.exec(indexHtml)?.[1] ?? '';
  expect(vp).toContain('width=device-width');
  expect(vp).toContain('viewport-fit=cover');
  expect(vp).not.toMatch(/maximum-scale|user-scalable/);
});

test('theme-color: one meta per colour scheme carrying the base background tokens, and the manifest matches the light one', () => {
  const light = /<meta name="theme-color" media="\(prefers-color-scheme: light\)" content="([^"]+)"/.exec(indexHtml)?.[1];
  const dark = /<meta name="theme-color" media="\(prefers-color-scheme: dark\)" content="([^"]+)"/.exec(indexHtml)?.[1];
  expect(light).toBe(TOKENS['--sw-bg'].light);
  expect(dark).toBe(TOKENS['--sw-bg'].dark);
  expect(indexHtml.match(/name="theme-color"/g)?.length).toBe(2);
  expect(manifest.theme_color).toBe(TOKENS['--sw-bg'].light);
  expect(manifest.background_color).toBe(TOKENS['--sw-bg'].light);
});

test('the document sheet: tap highlight off and text-size-adjust on everywhere; pull-to-refresh off on the phone only', () => {
  const blocks = topBlocks(MOBILE_POLISH_DOCUMENT);
  const html = blocks.find((b) => b.prelude === 'html');
  expect(html?.body).toContain('-webkit-tap-highlight-color: transparent');
  expect(html?.body).toContain('text-size-adjust: 100%');
  const phone = blocks.find((b) => b.prelude === `@media ${PHONE_MQ}`);
  expect(phone?.body).toContain('overscroll-behavior: none');
  expect(MOBILE_POLISH_DOCUMENT).not.toContain('user-select');
});

test('the shadow sheet: every drawing rule is gated (phone / coarse / hover: none); only touch-action is ungated', () => {
  const blocks = topBlocks(MOBILE_POLISH_SHADOW);
  expect(blocks.length).toBeGreaterThan(3);
  for (const b of blocks) {
    if (b.prelude.startsWith('@media')) {
      expect(b.prelude, b.prelude).toMatch(new RegExp(`\\(max-width: 767px\\)|${COARSE_MQ.replace(/[()]/g, '\\$&')}|\\(hover: none\\)`));
    } else {
      // the one ungated block: touch-action: manipulation on controls (no drawing)
      expect(b.body.replace(/\s+/g, ' ').trim()).toBe('touch-action: manipulation;');
    }
  }
});

test('phone fields read at 16 px (the cause of the iOS zoom), controls do not select on a long press, hover resets live under hover: none', () => {
  const phoneCoarse = topBlocks(MOBILE_POLISH_SHADOW).find((b) => b.prelude === `@media ${PHONE_MQ} and ${COARSE_MQ}`);
  expect(phoneCoarse?.body).toMatch(/select[^{]*textarea[^{]*\{[^}]*font-size: max\(16px, 1em\)/);
  const coarse = topBlocks(MOBILE_POLISH_SHADOW).find((b) => b.prelude === `@media ${COARSE_MQ}`);
  expect(coarse?.body).toContain('user-select: none');
  expect(coarse?.body).toContain('-webkit-touch-callout: none');
  expect(coarse?.body).not.toMatch(/\bbody\b/);
  const hoverNone = topBlocks(MOBILE_POLISH_SHADOW).find((b) => b.prelude === '@media (hover: none)');
  for (const sel of [':host(sw-button) button:hover', ':host(sw-tabs) a:hover:not(.on)', ':host(sw-table) tbody tr:hover:not(.selected)']) expect(hoverNone?.body).toContain(sel);
  // press feedback keeps the colour and drops the scale under reduced motion
  const reduced = topBlocks(MOBILE_POLISH_SHADOW).find((b) => b.prelude === `@media ${COARSE_MQ} and (prefers-reduced-motion: reduce)`);
  expect(reduced?.body).toContain('transform: none');
});

test('no literal colours and no fallback on a declared token: the layer only moves tokens around', () => {
  expect(MOBILE_POLISH_SHADOW).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  // a component knob (sw-dropdown's --sw-dd-bg) keeps its own fallback; a token of the sheet never needs one
  const withFallback = [...MOBILE_POLISH_SHADOW.matchAll(/var\((--sw-[a-z0-9-]+),/g)].map((m) => m[1]);
  expect(withFallback.filter((n) => n in TOKENS)).toEqual([]);
});
