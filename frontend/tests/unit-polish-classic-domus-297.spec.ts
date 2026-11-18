import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { avatarInitials } from '../src/components/avatar-initials';
import { initials as peopleInitials } from '../src/access-control/people-logic';
import { initials as cardInitials } from '../src/tickets/list-card-model';
import { initials as rfqInitials } from '../src/tickets/rfq-model';
import { initials as blockInitials } from '../src/tickets/status-block';
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

// CR-INITIALS-2443 (review 08:F09, owner O6 = a): one initials rule everywhere. The six private copies (people photo frame, ticket
// contacts, department members, ticket list cards, RFQ vendor rows, the ticket status block) now answer exactly what sw-avatar draws.
test('avatar initials: every screen that draws initials uses the one rule (no private copy left)', () => {
  const names = [
    'Dana Levi',
    'dana levi', // lower case: upper-cased like sw-avatar (two of the copies left it lower-case)
    'דנה בת שבע כהן', // three words: first + LAST (two copies took the second word)
    'אלון ד.',
    'Jean-Pierre Dupont',
    'מיזוג',
    '𝒜lice 𝒵eta', // letters outside the BMP: never half a surrogate pair (two copies indexed x[0])
    'לובי Lobby-12',
    'Montgomery III',
    '👨‍👩‍👧‍👦',
    '',
  ];
  const copies: Array<[string, (n: string) => string]> = [
    ['access-control/people-logic', peopleInitials],
    ['tickets/list-card-model', cardInitials],
    ['tickets/status-block', blockInitials],
  ];
  for (const n of names) {
    for (const [where, f] of copies) expect(f(n), `${where}: ${JSON.stringify(n)}`).toBe(avatarInitials(n));
    // the RFQ rows keep the "?" they always drew for a name with no letter
    expect(rfqInitials(n), `tickets/rfq-model: ${JSON.stringify(n)}`).toBe(avatarInitials(n) || '?');
  }
  expect(blockInitials(null)).toBe('');
  expect(blockInitials(undefined)).toBe('');
  expect(avatarInitials('דנה בת שבע כהן')).toBe('דכ');
  expect(avatarInitials('𝒜lice 𝒵eta')).toBe('𝒜𝒵');
  // the two Lit screens keep a module-private alias (not importable in Node): the source names the shared rule
  for (const f of ['tickets/contacts-directory.ts', 'tickets/handlers-members.ts']) {
    const s = src(f);
    expect(s, f).toContain("import { avatarInitials } from '../components/avatar-initials';");
    expect(s, f).toContain('const initials = avatarInitials;');
  }
  // no hand-written initials copy left in the six files (a split-and-index body is the tell)
  for (const f of ['access-control/people-logic.ts', 'tickets/contacts-directory.ts', 'tickets/handlers-members.ts', 'tickets/list-card-model.ts', 'tickets/rfq-model.ts', 'tickets/status-block.ts']) {
    const body = /function initials\([^)]*\)[^{]*\{[\s\S]*?\n\}|const initials = [^\n]*/.exec(src(f))?.[0] ?? '';
    expect(body, f).toContain('avatarInitials');
    expect(body, f).not.toMatch(/split\(|\[0\]|slice\(0, 2\)/);
  }
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
