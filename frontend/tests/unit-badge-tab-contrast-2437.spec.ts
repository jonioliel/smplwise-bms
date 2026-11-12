import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SKIN_IDS } from '../src/design/skins';
import { skinTable } from '../src/design/css';
import { contrastRatio, over, parseColor, type RGBA } from '../src/design/contrast';

// SYS-AUDIT-QUICKFIX-2437 (design audit round 30, finding 12): a FILLED sw-badge read 2.54:1 ("סגור"), 3.76:1 ("קריטי") in light and
// 2.51:1 ("מידע") in dark. Node only: the label / field pair of every filled kind is read from the badge's OWN CSS (so the old rules
// fail here) and resolved through every skin's token table, light and dark. Threshold: WCAG 2.x 4.5:1 (the label is 12-13 px).
// The in-browser receipt of the same pairs (and of the dark selected tabs, finding 3) is tests/evidence-sys-audit-quickfix-2437.spec.ts.

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const BADGE = readFileSync(path.join(SRC, 'components/sw-badge.ts'), 'utf8');
const KINDS = ['neutral', 'live', 'recorded', 'historic', 'offline', 'stale', 'partial', 'unknown', 'forbidden', 'error'] as const;

/** the declarations of one CSS rule of the badge, by its exact selector list entry */
function decls(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of BADGE.matchAll(re)) {
    const sels = m[1].replace(/\/\*[\s\S]*?\*\//g, '').split(',').map((s) => s.trim());
    if (!sels.includes(selector)) continue;
    const body = m[2].replace(/\/\*[\s\S]*?\*\//g, '');
    for (const d of body.matchAll(/(background|color)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
  }
  return out;
}

/** the filled pair of a kind as the cascade gives it: :host([filled]) first, then :host([filled][kind='x']) */
function pair(kind: (typeof KINDS)[number]): { bg: string; fg: string } {
  const base = decls(':host([filled])');
  const own = kind === 'neutral' ? {} : decls(`:host([filled][kind='${kind}'])`);
  const bg = own.background ?? base.background;
  const fg = own.color ?? base.color;
  if (!bg || !fg) throw new Error(`filled ${kind}: no background / color in sw-badge.ts`);
  return { bg, fg };
}

test('filled sw-badge: every kind reads >= 4.5:1, every skin, light and dark ("סגור" was 2.54:1, "קריטי" 3.76:1)', () => {
  const rows: string[] = [];
  const fails: string[] = [];
  for (const id of SKIN_IDS) {
    const t = skinTable(id);
    for (const scheme of ['light', 'dark'] as const) {
      const val = (expr: string): RGBA => {
        const m = expr.match(/^var\((--sw-[\w-]+)\)$/);
        const raw = m ? t[m[1]]?.[scheme] : expr;
        const c = raw ? parseColor(raw) : null;
        if (!c) throw new Error(`${id}/${scheme}: cannot resolve ${expr} (${raw})`);
        return c;
      };
      // the badge sits on the panel: a translucent field is composited over the solid surface
      const panel = val('var(--sw-surface-solid)');
      for (const kind of KINDS) {
        const { bg, fg } = pair(kind);
        const field = over(val(bg), panel);
        const r = contrastRatio(over(val(fg), field), field);
        const row = `${id}/${scheme} ${kind}: ${fg} on ${bg} = ${r.toFixed(2)}`;
        rows.push(row);
        if (!(r >= 4.5)) fails.push(row);
      }
    }
  }
  console.log(rows.join('\n'));
  expect(fails).toEqual([]);
});

test('filled sw-badge: the field is a contrast-proven ink, never the bare state colour under white ink', () => {
  // the rule that measured 2.54:1 / 3.76:1: white (--sw-text-inverse) on --sw-text-3 / --sw-danger / --sw-offline / --sw-accent
  expect(pair('neutral')).toEqual({ bg: 'var(--sw-text-2)', fg: 'var(--sw-surface-solid)' });
  for (const k of ['error', 'forbidden', 'offline', 'recorded', 'historic', 'stale', 'partial'] as const) {
    expect(pair(k).fg, k).not.toBe('var(--sw-text-inverse)');
    expect(pair(k).bg, k).toMatch(/-text\)$/);
  }
  // owner round 22 (SKIN-QA-FOLLOWUP-2404, Q5 = a) stays: the filled live badge is dark ink on the green
  expect(pair('live')).toEqual({ bg: 'var(--sw-success)', fg: 'var(--sw-on-success)' });
});
