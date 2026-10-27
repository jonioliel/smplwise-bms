import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarInitials } from '../src/components/avatar-initials';
import { SKINS } from '../src/design/skins/index';
import { SKIN_RULE_BUDGET, ruleCount } from '../src/design/skins/define';

// POLISH-CLASSIC-DOMUS-297 (round 4, second pass): the shared-component contracts of the polish - node only, no page.
const here = path.dirname(fileURLToPath(import.meta.url));
const src = (p: string) => fs.readFileSync(path.join(here, '..', 'src', p), 'utf8');

test('avatar initials: graphemes, letters only, one script, the person icon when there is no letter (break-ui worst cases)', () => {
  expect(avatarInitials('Dana Levi')).toBe('DL');
  expect(avatarInitials('Aleksandra Wiśniewska-Kowalczyk Montgomery III')).toBe('AM'); // the suffix is not the last name
  expect(avatarInitials("אלכסנדרה ויסניבסקה-קובלצ'יק בן-שושן")).toBe('אב');
  expect(avatarInitials('יוני')).toBe('יו'); // one word: its first two letters, as before
  expect(avatarInitials('Jo')).toBe('Jo');
  expect(avatarInitials('ג')).toBe('ג');
  expect(avatarInitials('👨‍👩‍👧‍👦')).toBe(''); // a family emoji is one grapheme and no letter: the icon is drawn
  expect(avatarInitials('🎮 חדר משחקים של הילדים 🧸')).toBe('חה');
  expect(avatarInitials('לובי Lobby-12')).toBe('ל'); // never a Hebrew + Latin pair
  expect(avatarInitials('   ')).toBe('');
  expect(avatarInitials('12 34')).toBe('');
});

/** Every `:hover` rule outside an `@media (hover: hover) and (pointer: fine)` block (a tapped control kept its hover on a phone). */
function ungatedHovers(css: string): number[] {
  const lines = css.split('\n');
  const out: number[] = [];
  let gate = 0; // brace depth inside the hover media block, 0 = outside
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const delta = (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length;
    if (gate > 0) {
      gate += delta;
      continue;
    }
    if (/@media \(hover: hover\) and \(pointer: fine\)/.test(l)) {
      gate = delta;
      continue;
    }
    if (/:hover/.test(l) && !/^\s*(\/\/|\/\*|\*)/.test(l) && !/:disabled:hover/.test(l)) out.push(i + 1);
  }
  return out;
}

test('one hover convention: the shared controls hover only under a pointer that hovers', () => {
  for (const f of ['sw-button', 'sw-card', 'sw-chip', 'sw-field', 'sw-toggle', 'sw-dropdown', 'sw-table', 'sw-tabs', 'sw-dialog', 'sw-state-panel', 'sw-kpi', 'sw-view-switch', 'sw-sheet']) {
    expect(ungatedHovers(src(`components/${f}.ts`)), `${f}: ungated :hover lines`).toEqual([]);
  }
});

test('focus and press: the controls draw the product focus ring and read the press scale (1 = none in a skin that sets none)', () => {
  for (const f of ['sw-button', 'sw-chip', 'sw-toggle', 'sw-tabs']) {
    const s = src(`components/${f}.ts`);
    expect(s, `${f} focus`).toMatch(/focus-visible[\s\S]{0,120}var\(--sw-focus\)/);
  }
  for (const f of ['sw-button', 'sw-chip', 'sw-tabs', 'sw-dropdown']) expect(src(`components/${f}.ts`), `${f} press`).toContain('scale(var(--sw-press-scale))');
});

test('compact KPI: the value never wraps, only the label is clamped; the skeleton primitive exists and stops shimmering under reduced motion', () => {
  const kpi = src('components/sw-kpi.ts');
  expect(kpi).toMatch(/:host\(\[layout='compact'\]\) \.value \{[^}]*white-space: nowrap[^}]*tabular-nums/);
  expect(kpi).toMatch(/:host\(\[layout='compact'\]\) \.label \{[^}]*line-clamp: var\(--sw-kpi-label-lines, 2\)/); // HOMEFABLE-297: the host may ask for its own line count
  const sk = src('components/sw-skeleton.ts');
  expect(sk).toContain("@customElement('sw-skeleton')");
  expect(sk).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation: none/);
  expect(sk).toContain('aria-hidden="true"');
});

test('classic and domus polish stay inside the rule budget', () => {
  for (const id of ['classic', 'domus'] as const) expect(ruleCount(SKINS[id].rules), id).toBeLessThanOrEqual(SKIN_RULE_BUDGET);
});
