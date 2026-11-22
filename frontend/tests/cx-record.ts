import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FE-COMPLEXITY-2450 (review 08:F22, 06:STRUCT-1 steps 2-3): characterisation records for the logic functions that were split.
// Each unit-cx-*.spec.ts runs a fixed list of inputs through one function and compares the whole answer with the answer the UNCHANGED
// function gave, recorded once in tests/fixtures/cx/<name>.json. A split that moves code verbatim must keep every answer identical.
// Recording (only when the function's behaviour is meant to change, never to make a red test green):
//   SW_CX_RECORD=1 npx playwright test -c playwright.unit.config.ts tests/unit-cx-<name>.spec.ts --workers=1
// The encoding keeps what plain JSON would lose: undefined members, NaN / Infinity / -0, Map and Set (in insertion order).
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures', 'cx');

function encode(_key: string, v: unknown): unknown {
  if (v === undefined) return { $undefined: true };
  if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))) return { $number: Object.is(v, -0) ? '-0' : String(v) };
  if (v instanceof Map) return { $map: [...v.entries()] };
  if (v instanceof Set) return { $set: [...v.values()] };
  return v;
}

/** The answer as recorded text (stable: the same input always gives the same text); a list is written one element per line. */
export const cxText = (value: unknown): string =>
  Array.isArray(value) ? `[\n${value.map((v) => JSON.stringify(v, encode)).join(',\n')}\n]\n` : `${JSON.stringify(value, encode)}\n`;

/** Compares `value` with the record `name` (or writes the record with SW_CX_RECORD=1). */
export function expectRecorded(name: string, value: unknown): void {
  const file = path.join(DIR, `${name}.json`);
  const text = cxText(value);
  if (process.env.SW_CX_RECORD === '1') {
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(file, text);
    return;
  }
  expect(JSON.parse(text)).toEqual(JSON.parse(fs.readFileSync(file, 'utf8')));
}
