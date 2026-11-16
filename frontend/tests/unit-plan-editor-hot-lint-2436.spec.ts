import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-PLAN-EDITOR-HOT-2436 (docs/changes/CR-PLAN-EDITOR-HOT-2436.md), the static half: it reads the plan editor's source.
//   1. MSG-1: every timed message goes through flash() (one stored timer, cleared on disconnect); no site writes its own
//      `setTimeout(() => (this.info = ''), N)`, whose older timer used to wipe a newer message early.
//   2. PERF-5: the canvas binding hands no fresh `?? []` literal (a "changed" prop on every render); the shared frozen EMPTY instead.
//   3. RACE-7: searchEntities re-checks its request number after the await, in the answer and in the failure.
// The browser half is tests/unit-plan-editor-hot-2436.spec.ts.
//   npx playwright test -c playwright.unit.config.ts tests/unit-plan-editor-hot-lint-2436.spec.ts

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/screens/explore-plan-editor.ts');
const src = readFileSync(SRC, 'utf8');

/** The body of a class method: from its signature to the first line that closes it at two-space indent. */
function method(sig: string): string {
  const at = src.indexOf(sig);
  expect(at, sig).toBeGreaterThan(-1);
  const end = src.indexOf('\n  }\n', at);
  return src.slice(at, end);
}

test.describe('plan editor hot path (static)', () => {
  test('MSG-1: no message writes its own clearing timer; flash() keeps one stored timer and disconnect clears it', () => {
    expect(src.match(/setTimeout\(\(\)\s*=>\s*\(?this\.info\b/g) ?? []).toEqual([]);
    expect(src.match(/setTimeout\(\(\)\s*=>\s*\(?this\.error\s*=/g) ?? []).toEqual([]);
    const flash = method('private flash(text: string');
    expect(flash).toMatch(/clearTimeout\(this\.infoTimer\)/);
    expect(flash).toMatch(/this\.infoTimer = window\.setTimeout/);
    expect(flash).toMatch(/this\.info === text/); // a message someone else wrote in the meantime is not wiped
    const off = method('disconnectedCallback() {');
    expect(off).toMatch(/clearTimeout\(this\.infoTimer\)/);
    expect(off).toMatch(/clearTimeout\(this\.errorTimer\)/);
  });

  test('PERF-5: the canvas binding has no fresh empty-array literal', () => {
    const at = src.indexOf('<sw-plan-canvas editable');
    const end = src.indexOf('</sw-plan-canvas>', at);
    const canvas = src.slice(at, end);
    expect(canvas.length).toBeGreaterThan(100);
    expect(canvas.match(/\?\?\s*\[\]|:\s*\[\]\s*\}/g) ?? []).toEqual([]);
    expect(src).toMatch(/const EMPTY: never\[\] = Object\.freeze\(\[\]\)/);
  });

  test('RACE-7: searchEntities compares its request number after the await, in the answer and in the failure', () => {
    const body = method('private async searchEntities()');
    expect(body).toMatch(/const seq = \+\+this\.entSeq/);
    const tryPart = body.slice(body.indexOf('try {'), body.indexOf('} catch'));
    const catchPart = body.slice(body.indexOf('} catch'), body.indexOf('} finally'));
    expect(tryPart).toMatch(/seq !== this\.entSeq/);
    expect(catchPart).toMatch(/seq !== this\.entSeq/);
  });
});
