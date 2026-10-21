import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * UXFIX-A11Y-295 (UX audit 2026-10-20, finding 4): the empty preset of sw-state-panel was the map pin, and 105 of 110 empty states
 * did not override it ("no alarm panel", "no meters", "no elevators" all showed a map). The preset is now the neutral tray and every
 * screen's empty state names its own topical icon (`icon=`), which only the EMPTY state reads.
 */
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') ? [p] : [];
  });

/** The panels that stay on the neutral tray on purpose: the style guide's state gallery, the "not built yet" placeholder and the
 * "available on a computer" notice (no topic of their own). */
const NEUTRAL_OK = ['styleguide-screen.ts', 'placeholder-screen.ts', 'sw-app.ts:desktop-only'];

test('the empty preset is the neutral tray, not the map pin; the icon override applies to the empty state only', () => {
  const panel = readFileSync(path.join(SRC, 'components', 'sw-state-panel.ts'), 'utf8');
  expect(panel).toMatch(/empty: \{ icon: 'inbox'/);
  expect(panel).toMatch(/this\.state === 'empty' && this\.icon \? this\.icon : preset\.icon/);
  expect(readFileSync(path.join(SRC, 'components', 'sw-icon.ts'), 'utf8')).toMatch(/\n  inbox: svg`/);
});

test('every empty (or state-bound) sw-state-panel names a topical icon', () => {
  const missing: string[] = [];
  const icons = new Map<string, number>();
  let empties = 0;
  for (const f of files(SRC)) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/<sw-state-panel(?=\s)/g)) {
      const tag = s.slice(m.index! + m[0].length, m.index! + m[0].length + 600).split('></sw-state-panel')[0];
      const st = /\sstate="(\w+)"/.exec(tag);
      if (st && st[1] !== 'empty') continue; // a fixed loading / error / forbidden / stale / partial panel keeps its preset icon
      empties++;
      const base = path.basename(f);
      const line = s.slice(0, m.index).split('\n').length;
      const icon = /^\s*icon=(?:"(\w+)"|\$\{)/.exec(tag);
      if (icon) {
        icons.set(icon[1] ?? '(bound)', (icons.get(icon[1] ?? '(bound)') ?? 0) + 1);
        continue;
      }
      const key = base === 'sw-app.ts' && /DESKTOP_ONLY/.test(tag) ? 'sw-app.ts:desktop-only' : base;
      if (!NEUTRAL_OK.includes(key)) missing.push(`${path.relative(SRC, f)}:${line}`);
    }
  }
  console.log(`empty-capable panels: ${empties}; icons: ${[...icons].map(([k, v]) => `${k} ${v}`).join(', ')}`);
  expect(empties).toBeGreaterThan(100);
  expect(missing).toEqual([]);
  // the map pin is kept only where the empty state IS about the map (floor map, plan editor, plan import)
  expect(icons.get('map') ?? 0).toBeLessThanOrEqual(8);
});

test('the screens the audit named carry their own icon: alarm, meters, elevators, sites, events', () => {
  const has = (rel: string, icon: string) => expect(readFileSync(path.join(SRC, rel), 'utf8'), `${rel} -> ${icon}`).toContain(`<sw-state-panel icon="${icon}"`);
  has('screens/security-alarm.ts', 'shield');
  has('screens/electricity/page-meters.ts', 'bolt');
  has('screens/infra-elevators.ts', 'elevator');
  has('screens/explore-sites.ts', 'building');
  has('screens/investigate-events.ts', 'history');
});
