import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// USERMENU-FIX-2271: the account level's <details> sections are re-created closed whenever the level is drawn again
// (main -> account -> main -> account). Their "open" flags gate the lazily loaded children, so every level change and every
// open of the menu must drop them together; otherwise a hidden section keeps its child mounted and the state is lost / stale.
//   npx playwright test -c playwright.unit.config.ts tests/unit-user-menu-sections.spec.ts
const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'shell', 'sw-user-menu.ts'), 'utf8');

function body(name: string): string {
  const i = src.indexOf(name);
  expect(i, name).toBeGreaterThan(-1);
  const start = src.indexOf('{', i);
  let depth = 0;
  for (let k = start; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}' && --depth === 0) return src.slice(start, k);
  }
  throw new Error('unbalanced ' + name);
}

const FLAGS = ['sessionsOpen', 'wiskeyOpen', 'homeOpen', 'factorOpen', 'deviceOpen', 'staffOpen'];

test('closeSections drops every section flag', () => {
  const b = body('private closeSections()');
  for (const f of FLAGS) expect(b).toContain(`this.${f} = false`);
});

test('every @state section flag is covered, and both goLevel and willUpdate call closeSections', () => {
  const declared = [...src.matchAll(/@state\(\) private (\w+Open)\b/g)].map((m) => m[1]).sort();
  expect(declared).toEqual([...FLAGS].sort());
  expect(body('private goLevel(')).toContain('this.closeSections()');
  expect(body('protected willUpdate(')).toContain('this.closeSections()');
});
