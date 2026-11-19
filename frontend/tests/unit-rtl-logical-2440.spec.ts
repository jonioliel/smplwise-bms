import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FE-SMALL-2440 (code review 06:RTL-1): the last eight physical text-align / padding sites of the finding use logical values.
// Every one of them sits on an LTR element (dir="ltr" or direction: ltr: code, JSON, attribute lists), so start / end resolve to
// the same side as the former left / right - the rendering is unchanged, the screens just stop mixing physical and logical CSS.
// Node only:  npx playwright test -c playwright.unit.config.ts tests/unit-rtl-logical-2440.spec.ts

const SCREENS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/screens');
const FILES = [
  'automation-block-forms.ts',
  'automation-code.ts',
  'explore-entities.ts',
  'investigate-history-map.ts',
  'system-fleet-report.ts',
  'system-notices.ts',
  'system-video-conn-test.ts',
  'system-audit.ts',
];
const PHYSICAL = /text-align:\s*(left|right)\b|\b(?:margin|padding|border)-(?:left|right)\s*:/g;

for (const file of FILES) {
  test(`${file}: no physical text-align / margin / padding / border side`, () => {
    const src = readFileSync(path.join(SCREENS, file), 'utf8');
    const hits = src.split('\n').flatMap((line, i) => (line.match(PHYSICAL) ?? []).map((m) => `${i + 1}: ${m}`));
    expect(hits).toEqual([]);
  });
}

test('the automation code editor keeps its gutter clearance on the start side of its LTR box', () => {
  const src = readFileSync(path.join(SCREENS, 'automation-code.ts'), 'utf8');
  expect(src).toMatch(/\.wrap \{[^}]*direction: ltr;/);
  expect(src).toMatch(/textarea \{[^}]*padding-inline: 56px 12px;[^}]*direction: ltr;\s*text-align: start;/);
  expect(src).toMatch(/\.nums \{[^}]*inset-inline-start: 0;[^}]*text-align: end;/);
});
