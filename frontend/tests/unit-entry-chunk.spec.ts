import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// CR-FE-GATES-2436 (docs/changes/CR-FE-GATES-2436.md, review 07:F20 / 07:F7 / D3): the entry-chunk budget of scripts/bundle-budget.mjs.
// REPORT-ONLY in this branch: the script prints the entry size against the budget, the `*-mock` and dictionary modules found in the
// entry's source map, and the debug-map bytes of the build - and always exits 0. These specs pin that contract on a synthetic build,
// then run it once on the committed build (smplwise_vms/www) and record the numbers as annotations, without judging them.
// CR-FE-GATES-ENFORCE turns the budget into a failure; until then nothing here may fail because the product grew.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'bundle-budget.mjs');
const COMMITTED = path.join(HERE, '..', '..', 'smplwise_vms', 'www');

interface Report {
  dir: string;
  entry: { file: string; raw: number; gzip: number } | null;
  budget: { gzip: number; raw: number; overGzip: number; overRaw: number; over: boolean };
  denyList: { measured: boolean; mocks: { source: string; bytes: number }[]; dictionaries: { source: string; bytes: number }[]; allowedDictionaries: string[] };
  maps: { files: number; bytes: number; jsFiles: number; jsBytes: number };
  mode: 'report-only';
}

function run(args: string[]): { code: number | null; out: string; report: Report | null } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  let report: Report | null = null;
  if (args.includes('--json')) report = JSON.parse(r.stdout) as Report;
  return { code: r.status, out, report };
}

function fakeBuild(withMap = true): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-entry-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="./fonts.css" />\n<script type="module" crossorigin src="./assets/index-AbC12.js"></script></head></html>');
  const entry = 'import"./x.js";'.repeat(400);
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbC12.js'), entry);
  fs.writeFileSync(path.join(dir, 'assets', 'other-Zz9.js'), 'console.log(1);');
  const sources = [
    '../../../../smplwisebms/frontend/node_modules/lit-html/lit-html.js',
    '../../../frontend/src/main.ts',
    '../../../frontend/src/api/tickets-mock.ts',
    '../../../frontend/src/i18n/he.ts',
    '../../../frontend/src/i18n/access-external.ts',
    '../../../frontend/src/tickets/rfq-text.ts',
    '../../../frontend/src/tickets/text.ts',
  ];
  const content = ['lit', 'main', 'm'.repeat(300), 'h'.repeat(50), 'a'.repeat(120), 'r'.repeat(70), 't'.repeat(40)];
  if (withMap) {
    fs.writeFileSync(path.join(dir, 'assets', 'index-AbC12.js.map'), JSON.stringify({ version: 3, sources, sourcesContent: content, mappings: '' }));
    fs.writeFileSync(path.join(dir, 'assets', 'other-Zz9.js.map'), JSON.stringify({ version: 3, sources: [], mappings: '' }));
    fs.writeFileSync(path.join(dir, 'arx-sw.js.map'), JSON.stringify({ version: 3, sources: [], mappings: '' }));
  }
  return dir;
}

test.describe('bundle-budget.mjs (report-only)', () => {
  test('measures the entry named by index.html: raw and gzip bytes', () => {
    const dir = fakeBuild();
    const { code, report } = run(['--dir', dir, '--json']);
    expect(code).toBe(0);
    const raw = fs.readFileSync(path.join(dir, 'assets', 'index-AbC12.js'));
    expect(report?.entry).toEqual({ file: 'assets/index-AbC12.js', raw: raw.length, gzip: gzipSync(raw, { level: 9 }).length });
    expect(report?.mode).toBe('report-only');
  });

  test('lists every *-mock module and every dictionary module of the entry source map, with its source bytes', () => {
    const { report } = run(['--dir', fakeBuild(), '--json']);
    expect(report?.denyList.measured).toBe(true);
    expect(report?.denyList.mocks).toEqual([{ source: 'src/api/tickets-mock.ts', bytes: 300 }]);
    // the base dictionary (i18n/he.ts) is allowed in the entry; every other dictionary is reported, largest first
    expect(report?.denyList.dictionaries).toEqual([
      { source: 'src/i18n/access-external.ts', bytes: 120 },
      { source: 'src/tickets/rfq-text.ts', bytes: 70 },
      { source: 'src/tickets/text.ts', bytes: 40 },
    ]);
    expect(report?.denyList.allowedDictionaries).toEqual(['src/i18n/he.ts']);
  });

  test('counts the debug-map files and bytes of the whole build next to the JavaScript (07:F7, report only)', () => {
    const dir = fakeBuild();
    const { report } = run(['--dir', dir, '--json']);
    expect(report?.maps.files).toBe(3);
    expect(report?.maps.jsFiles).toBe(2);
    const mapBytes = ['assets/index-AbC12.js.map', 'assets/other-Zz9.js.map', 'arx-sw.js.map'].reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0);
    expect(report?.maps.bytes).toBe(mapBytes);
  });

  test('an entry over the budget is reported, never failed', () => {
    const { code, out } = run(['--dir', fakeBuild(), '--budget-gzip', '10', '--budget-raw', '10']);
    expect(code).toBe(0);
    expect(out).toMatch(/over budget/i);
    expect(out).toMatch(/report-only/i);
    const j = run(['--dir', fakeBuild(), '--budget-gzip', '10', '--json']).report;
    expect(j?.budget.over).toBe(true);
    expect(j?.budget.overGzip).toBe((j?.entry?.gzip ?? 0) - 10);
  });

  test('a build without source maps: the deny-list is "not measured", still exit 0', () => {
    const { code, report } = run(['--dir', fakeBuild(false), '--json']);
    expect(code).toBe(0);
    expect(report?.denyList.measured).toBe(false);
    expect(report?.maps.files).toBe(0);
  });

  test('no build at all: a note and exit 0', () => {
    const { code, out } = run(['--dir', path.join(os.tmpdir(), 'sw-no-such-build-2436')]);
    expect(code).toBe(0);
    expect(out).toMatch(/no build/i);
  });

  test('the committed add-on build: recorded, not judged', () => {
    test.skip(!fs.existsSync(path.join(COMMITTED, 'index.html')), 'smplwise_vms/www is not in this checkout');
    const { code, report } = run(['--dir', COMMITTED, '--json']);
    expect(code).toBe(0);
    expect(report?.entry?.gzip ?? 0).toBeGreaterThan(0);
    const r = report as Report;
    test.info().annotations.push(
      { type: 'entry', description: `${r.entry?.file} raw ${r.entry?.raw} gzip ${r.entry?.gzip} (budget gzip ${r.budget.gzip}, over by ${r.budget.overGzip})` },
      { type: 'deny-list', description: `mocks ${r.denyList.mocks.length}, dictionaries ${r.denyList.dictionaries.length}` },
      { type: 'maps', description: `${r.maps.files} map files, ${r.maps.bytes} bytes against ${r.maps.jsBytes} bytes of JavaScript` },
    );
  });
});
