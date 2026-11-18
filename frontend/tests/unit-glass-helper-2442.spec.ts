import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-GLASS-HELPER-2442 (code review 08:F13): the glass host helper lives in styles/glass.ts; api/automations-demo.ts only re-exports it.
// Source guards (node-only): the two files stay in step and nobody goes back to the old path.
const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const read = (rel: string): string => fs.readFileSync(path.join(SRC, rel), 'utf8');
const KEY = /DEMO_KEY = '([^']+)'/;

test('the glass helper reads the same demo key as the automations demo layer', () => {
  const glass = KEY.exec(read('styles/glass.ts'))?.[1];
  const demo = KEY.exec(read('api/automations-demo.ts'))?.[1];
  expect(glass).toBeTruthy();
  expect(glass).toBe(demo);
});

test('styles/glass.ts does not import the demo layer back, and the old path re-exports the helper', () => {
  expect(read('styles/glass.ts')).not.toMatch(/from '[^']*automations-demo'/);
  const demo = read('api/automations-demo.ts');
  expect(demo).toContain("export { applyAutomationsGlass } from '../styles/glass';");
  expect(demo).not.toMatch(/from '\.\.\/screens\//); // the API layer no longer depends on a screen
});

test('no module imports the glass helper through the old path', () => {
  const offenders: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && /import \{[^}]*\bapplyAutomationsGlass\b[^}]*\} from '[^']*automations-demo'/.test(fs.readFileSync(p, 'utf8'))) offenders.push(path.relative(SRC, p));
    }
  };
  walk(SRC);
  expect(offenders).toEqual([]);
});
