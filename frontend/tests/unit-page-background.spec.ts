import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// BGFIX-293: the page background is the shell's skin canvas on every screen. A glass palette's --dv-backdrop reaches a page only
// through --dv-page-backdrop / --dv-page-fill (styles/devices-themes.ts), which are transparent / the skin canvas unless the glass area's
// scheme differs from the product's (devices-style.ts sets data-devices-own-backdrop). No screen may paint --dv-backdrop directly.
// The browser sweep is tests/layout-page-background.spec.ts.

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });

test('no screen paints the glass palette backdrop over the skin canvas', () => {
  const hits: string[] = [];
  for (const f of files(SRC)) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/background(-image)?\s*:[^;]*var\(--dv-backdrop\b/.test(line)) hits.push(`${path.relative(SRC, f)}:${i + 1}: ${line.trim()}`);
    });
  }
  expect(hits, 'use var(--dv-page-backdrop) (or --dv-page-fill for an opaque full-page surface)').toEqual([]);
});

test('the page-backdrop knobs: transparent / the canvas by default, the palette backdrop only with data-devices-own-backdrop', () => {
  const css = readFileSync(path.join(SRC, 'styles', 'devices-themes.ts'), 'utf8');
  expect(css).toMatch(/:host\(\[data-devices-style='glass'\]\) \{\s*--dv-page-backdrop: transparent;\s*--dv-page-fill: var\(--sw-canvas\);/);
  expect(css).toMatch(/:host\(\[data-devices-style='glass'\]\[data-devices-own-backdrop\]\) \{\s*--dv-page-backdrop: var\(--dv-backdrop\);/);
  expect(css).toMatch(/:host\(\[data-devices-style='glass'\]\) sw-page \{\s*background: var\(--dv-page-backdrop\);/);
  const js = readFileSync(path.join(SRC, 'screens', 'devices-style.ts'), 'utf8');
  expect(js).toMatch(/toggleAttribute\('data-devices-own-backdrop', needsOwnBackdrop\(/);
});
