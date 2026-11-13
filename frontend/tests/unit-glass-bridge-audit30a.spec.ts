import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, withAlpha, type RGBA } from '../src/design/contrast';

// AUDIT30-A-GLASS-BRIDGE (design audit round 30, finding 13: "two darks, two inks"). The glass screens (service calls, multimedia,
// schedules, automations, the notification settings) drew their own ink (#1c1c1e / #f5f5f7) and neutral black-grey panels
// (rgba(28, 28, 30, .72)) beside the product's navy screens. The fix: palette "default", when its scheme is the product's (no own
// backdrop), reads the product tokens for its COLOUR knobs. Node only: read from devices-themes.ts itself (the old file has no bridge
// block, so every test here fails on it) and resolved through every skin's token table, light and dark.
// The in-browser receipt (computed knobs on the real hosts, pixel) is tests/evidence-audit30a-glass-bridge.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const THEMES = readFileSync(path.join(SRC, 'styles/devices-themes.ts'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const BRIDGE = ":host([data-devices-style='glass'][data-devices-theme='default']:not([data-devices-own-backdrop]):not([data-skin='bubble']))";
const BRIDGE_DARK =
  ":host([data-devices-style='glass'][data-devices-theme='default'][data-devices-scheme='dark']:not([data-devices-own-backdrop]):not([data-skin='bubble']))";
const SECTION1 = ":host([data-devices-style='glass'])";

/** the declarations of every rule whose selector is exactly `sel` (merged in source order) */
function decls(sel: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of THEMES.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].trim() !== sel) continue;
    for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

const EXPECT: Record<string, string> = {
  '--dv-text': 'var(--sw-text)',
  '--dv-text-2': 'var(--sw-text-2)',
  '--dv-text-3': 'var(--sw-text-3)',
  '--dv-surface-solid': 'var(--sw-surface-solid)',
  '--dv-surface-2-solid': 'var(--sw-surface-2-solid)',
  '--dv-border': 'var(--sw-border)',
  '--dv-border-strong': 'var(--sw-border-strong)',
  '--dv-backdrop': 'var(--sw-canvas)',
};

test('the default glass palette bridges its colour knobs to the product tokens (finding 13)', () => {
  const b = decls(BRIDGE);
  for (const [k, v] of Object.entries(EXPECT)) expect(b[k], k).toBe(v);
  // the translucent panels are the product's solid twins at the glass alpha - not a neutral of their own
  expect(b['--dv-surface']).toMatch(/^color-mix\(in srgb, var\(--dv-surface-solid\) \d+%, transparent\)$/);
  expect(b['--dv-surface-2']).toMatch(/^color-mix\(in srgb, var\(--dv-surface-2-solid\) \d+%, transparent\)$/);
  const d = decls(BRIDGE_DARK);
  expect(d['--dv-surface']).toMatch(/^color-mix\(in srgb, var\(--dv-surface-solid\) \d+%, transparent\)$/);
  expect(d['--dv-surface-2']).toMatch(/^color-mix\(in srgb, var\(--dv-surface-2-solid\) \d+%, transparent\)$/);
  // tokens only: no colour literal in the bridge
  for (const [k, v] of Object.entries({ ...b, ...d })) expect(v, k).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
});

test('no custom-property cycle: every --sw-* the bridge reads that section 1 writes from a knob is reset to inherit', () => {
  const s1 = decls(SECTION1);
  const b = decls(BRIDGE);
  const read = new Set(Object.values(b).flatMap((v) => [...v.matchAll(/var\((--sw-[\w-]+)/g)].map((m) => m[1])));
  const cyclic = [...read].filter((n) => /var\(--dv-/.test(s1[n] ?? ''));
  expect(cyclic.length).toBeGreaterThan(0); // --sw-text & co. are bridged in section 1 (the reason for the reset)
  for (const n of cyclic) expect(b[n], `${n} must be inherit in the bridge block`).toBe('inherit');
  // the heading follows the text (section 1 writes it from --dv-text too)
  expect(b['--sw-heading']).toBe('inherit');
});

test('the bridged glass ink and panels read >= 4.5:1 for muted text, and the dark glass is the product navy, every skin', () => {
  const alpha = (v: string) => Number(v.match(/(\d+)%/)![1]) / 100;
  const b = decls(BRIDGE);
  const d = decls(BRIDGE_DARK);
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id as (typeof SKIN_IDS)[number]);
    for (const mode of ['light', 'dark'] as const) {
      const P = (n: string): RGBA => {
        const c = parseColor(t[n][mode]);
        if (!c) throw new Error(`${id}/${mode} ${n}: cannot parse ${t[n][mode]}`);
        return c;
      };
      const k = mode === 'dark' ? { ...b, ...d } : b;
      const bg = P('--sw-bg');
      const solid = P('--sw-surface-solid');
      const solid2 = P('--sw-surface-2-solid');
      const beds: Record<string, RGBA> = {
        'surface over bg': over(withAlpha(solid, alpha(k['--dv-surface'])), bg),
        'surface-2 over surface': over(withAlpha(solid2, alpha(k['--dv-surface-2'])), over(withAlpha(solid, alpha(k['--dv-surface'])), bg)),
        'surface-solid': solid,
        'surface-2-solid': solid2,
      };
      for (const ink of ['--sw-text-2', '--sw-text-3']) {
        for (const [bed, c] of Object.entries(beds)) {
          const r = contrastRatio(P(ink), c);
          rows.push(`${id}/${mode} ${ink} on ${bed}: ${r.toFixed(2)}`);
          if (r < 4.5) fails.push(rows[rows.length - 1]);
        }
      }
      if (mode === 'dark') {
        // the dark glass panel takes the product surface's hue: never a neutral grey when the product surface is tinted
        const p = beds['surface over bg'];
        const tinted = Math.max(...solid.slice(0, 3)) - Math.min(...solid.slice(0, 3)) >= 6;
        if (tinted && Math.max(...p.slice(0, 3)) - Math.min(...p.slice(0, 3)) < 4) fails.push(`${id}/dark glass panel is neutral: ${p.map(Math.round)}`);
      }
    }
  }
  console.log(rows.filter((r) => r.startsWith('classic/')).join('\n'));
  expect(fails, fails.join('\n')).toEqual([]);
});
