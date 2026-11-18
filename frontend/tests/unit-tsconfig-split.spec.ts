import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-TSCONFIG-SPLIT-2443: tsconfig.json is the app alone, tsconfig.tests.json is everything the gate type-checks. The gate runs
// tsconfig.tests.json INSTEAD of tsconfig.json, which is only sound while the first is a superset of the second with the same
// compiler options. These cases pin that, and that no type-check program is left out of `npm run typecheck` or of the gate engine.
const FE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const json = (name: string) => JSON.parse(fs.readFileSync(path.join(FE, name), 'utf8')) as Record<string, unknown>;
const configs = fs.readdirSync(FE).filter((f) => /^tsconfig(\..+)?\.json$/.test(f)).sort();

test('tsconfig.tests.json covers everything tsconfig.json covers, with the same compiler options', () => {
  const app = json('tsconfig.json');
  const all = json('tsconfig.tests.json');
  expect(all.extends).toBe('./tsconfig.json');
  expect(all.compilerOptions, 'an override here would make the two programs disagree about src').toBeUndefined();
  for (const entry of app.include as string[]) expect(all.include as string[]).toContain(entry);
  expect(app.exclude, 'an exclude of the app config is not inherited by the tests config').toBeUndefined();
  expect(all.include as string[]).toEqual(expect.arrayContaining(['tests', 'playwright.config.ts', 'playwright.*.config.ts']));
  expect(all.exclude).toEqual(['tests/archive']);
});

test('every type-check program is in `npm run typecheck`', () => {
  const typecheck = (json('package.json').scripts as Record<string, string>).typecheck;
  expect(configs).toEqual(['tsconfig.json', 'tsconfig.scripts.json', 'tsconfig.tests.json']);
  for (const c of configs.filter((f) => f !== 'tsconfig.json')) expect(typecheck).toContain(`-p ${c}`);
});

test('the gate engine runs tsconfig.tests.json and every other tsconfig.*.json', () => {
  const engine = fs.readFileSync(path.join(FE, '..', 'scripts', 'gate', 'release_gate.py'), 'utf8');
  expect(engine).toContain('for cmd in tsc_commands(fe):');
  expect(engine).toContain('"-p", "tsconfig.tests.json"');
  expect(engine).toContain('fe.glob("tsconfig.*.json")');
});
