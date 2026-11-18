import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-FE-GATES-ENFORCE-2442 (docs/changes/CR-FE-GATES-ENFORCE-2442.md, review 07:F19 / 06:DEAD-1): scripts/unused-exports.mjs
// with `--enforce`. The two lists of the report (exports nobody references, exports used only inside their own file) are compared
// with a baseline of `module#name` keys: an export on a list and not in the baseline fails (exit 1), so the lists can only shrink;
// a baseline entry that is gone is a printed note, not a failure. Without `--enforce` the script stays a report (exit 0).
// The specs run the script on a synthetic source tree; the committed baseline (scripts/gates-baseline.json) is only checked for
// its shape - the gate runs the real comparison (`node scripts/unused-exports.mjs --enforce`).

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'unused-exports.mjs');
const COMMITTED = path.join(HERE, '..', 'scripts', 'gates-baseline.json');

interface Baseline {
  unusedExports: { unreferenced: string[]; fileLocal: string[] };
}

function tree(extra = ''): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-unused-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(
    path.join(root, 'src', 'a.ts'),
    ['export const used = 1;', 'export const dead = 2;', 'export function local(): number { return 3; }', 'export const twice = local() + local();', extra].join('\n'),
  );
  fs.writeFileSync(path.join(root, 'src', 'b.ts'), "import { used, twice } from './a';\nconsole.log(used, twice);\n");
  fs.writeFileSync(path.join(root, 'tests', 'a.spec.ts'), '// nothing\n');
  return root;
}

function baseline(root: string, unreferenced: string[], fileLocal: string[]): string {
  const file = path.join(root, 'baseline.json');
  fs.writeFileSync(file, JSON.stringify({ bundle: { keep: true }, unusedExports: { unreferenced, fileLocal } }));
  return file;
}

function run(args: string[]): { code: number | null; out: string } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { code: r.status, out: `${r.stdout}${r.stderr}` };
}

test.describe('unused-exports.mjs --enforce', () => {
  test('without --enforce it is a report: counts, exit 0', () => {
    const { code, out } = run(['--root', tree()]);
    expect(code).toBe(0);
    expect(out).toMatch(/report-only/);
    expect(out).toMatch(/unreferenced \(no other file, no second use in its own file\): 1 /);
    expect(out).toMatch(/file-local \(used only inside their own file\): 1 /);
  });

  test('every reported export is in the baseline: exit 0', () => {
    const root = tree();
    const { code, out } = run(['--root', root, '--enforce', '--baseline', baseline(root, ['src/a.ts#dead'], ['src/a.ts#local'])]);
    expect(out).toMatch(/-> OK/);
    expect(code).toBe(0);
  });

  test('a new unreferenced export fails (exit 1) and is named with its file and line', () => {
    const root = tree('export const fresh = 9;');
    const { code, out } = run(['--root', root, '--enforce', '--baseline', baseline(root, ['src/a.ts#dead'], ['src/a.ts#local'])]);
    expect(code).toBe(1);
    expect(out).toMatch(/NEW unreferenced\s+const\s+fresh\s+\(src\/a\.ts:5\)/);
    expect(out).toMatch(/-> FAIL: 1 export\(s\) outside the baseline/);
  });

  test('a new file-local export fails too', () => {
    const root = tree();
    const { code, out } = run(['--root', root, '--enforce', '--baseline', baseline(root, ['src/a.ts#dead'], [])]);
    expect(code).toBe(1);
    expect(out).toMatch(/NEW file-local\s+function\s+local\s+\(src\/a\.ts:3\)/);
  });

  test('the same name in another module is not covered by the baseline entry', () => {
    const root = tree();
    const { code } = run(['--root', root, '--enforce', '--baseline', baseline(root, ['src/other.ts#dead'], ['src/a.ts#local'])]);
    expect(code).toBe(1);
  });

  test('a baseline entry that is gone is a note, not a failure', () => {
    const root = tree();
    const { code, out } = run(['--root', root, '--enforce', '--baseline', baseline(root, ['src/a.ts#dead', 'src/a.ts#removedLongAgo'], ['src/a.ts#local'])]);
    expect(code).toBe(0);
    expect(out).toMatch(/note: 1 baseline entries are no longer on a list/);
    expect(out).toMatch(/gone\s+src\/a\.ts#removedLongAgo/);
  });

  test('--update-baseline writes the two sorted lists and keeps the other sections of the file', () => {
    const root = tree('export const alpha = 0;');
    const file = baseline(root, ['src/a.ts#removedLongAgo'], []);
    expect(run(['--root', root, '--update-baseline', '--baseline', file]).code).toBe(0);
    const b = JSON.parse(fs.readFileSync(file, 'utf8')) as Baseline & { bundle: unknown };
    expect(b.unusedExports).toEqual({ unreferenced: ['src/a.ts#alpha', 'src/a.ts#dead'], fileLocal: ['src/a.ts#local'] });
    expect(b.bundle).toEqual({ keep: true });
    expect(run(['--root', root, '--enforce', '--baseline', file]).code).toBe(0);
  });

  test('a baseline that cannot be read is a failure under --enforce (exit 2), never a pass', () => {
    const root = tree();
    expect(run(['--root', root, '--enforce', '--baseline', path.join(root, 'missing.json')]).code).toBe(2);
  });

  test('the committed baseline: two sorted lists of unique module#name keys', () => {
    const b = (JSON.parse(fs.readFileSync(COMMITTED, 'utf8')) as Baseline).unusedExports;
    for (const list of [b.unreferenced, b.fileLocal]) {
      expect(list).toEqual([...new Set(list)].sort());
      for (const k of list) expect(k).toMatch(/^src\/[\w./-]+\.ts#[A-Za-z_$][\w$]*$/);
    }
    test.info().annotations.push({ type: 'baseline', description: `unreferenced ${b.unreferenced.length}, file-local ${b.fileLocal.length}` });
  });
});
