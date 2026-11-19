import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// CR-FE-GATES-2436 (docs/changes/CR-FE-GATES-2436.md, review 07:F20 / 07:F7 / D3): the entry-chunk budget of scripts/bundle-budget.mjs.
// The script prints the entry size against the budget, the `*-mock` and dictionary modules found in the entry's source map, and the
// debug-map bytes of the build. Without `--enforce` it always exits 0 (the report); these specs pin that contract on a synthetic
// build, then run it once on the committed build (smplwise_vms/www) and record the numbers as annotations, without judging them.
// CR-FE-GATES-ENFORCE-2442 (docs/changes/CR-FE-GATES-ENFORCE-2442.md): `--enforce` exits 1 on an entry over the budget, on a mock
// module in the entry, and when there is no build; the budget is the measured entry plus the margin of scripts/gates-baseline.json.
// The gate runs `--dir dist --enforce` after its own build - the specs here judge the script, never the size of the product.

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, '..', 'scripts', 'bundle-budget.mjs');
const COMMITTED = path.join(HERE, '..', '..', 'smplwise_vms', 'www');
const BASELINE = path.join(HERE, '..', 'scripts', 'gates-baseline.json');

interface Report {
  dir: string;
  entry: { file: string; raw: number; gzip: number } | null;
  budget: { gzip: number; raw: number; overGzip: number; overRaw: number; over: boolean };
  denyList: { measured: boolean; mocks: { source: string; bytes: number }[]; dictionaries: { source: string; bytes: number }[]; allowedDictionaries: string[] };
  maps: { files: number; bytes: number; jsFiles: number; jsBytes: number };
  mode: 'report-only' | 'enforce';
  failures?: string[];
}

function run(args: string[]): { code: number | null; out: string; report: Report | null } {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  const out = `${r.stdout}${r.stderr}`;
  let report: Report | null = null;
  if (args.includes('--json')) report = JSON.parse(r.stdout) as Report;
  return { code: r.status, out, report };
}

function fakeBuild(withMap = true, withMock = true): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-entry-'));
  fs.mkdirSync(path.join(dir, 'assets'));
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="./fonts.css" />\n<script type="module" crossorigin src="./assets/index-AbC12.js"></script></head></html>');
  const entry = 'import"./x.js";'.repeat(400);
  fs.writeFileSync(path.join(dir, 'assets', 'index-AbC12.js'), entry);
  fs.writeFileSync(path.join(dir, 'assets', 'other-Zz9.js'), 'console.log(1);');
  const sources = [
    '../../../../smplwisebms/frontend/node_modules/lit-html/lit-html.js',
    '../../../frontend/src/main.ts',
    withMock ? '../../../frontend/src/api/tickets-mock.ts' : '../../../frontend/src/api/tickets.ts',
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

test.describe('bundle-budget.mjs (report mode)', () => {
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

  test('without --enforce an entry over the budget is reported, never failed', () => {
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

test.describe('bundle-budget.mjs --enforce (CR-FE-GATES-ENFORCE-2442)', () => {
  const BIG = ['--budget-gzip', '1000000', '--budget-raw', '1000000'];

  test('an entry inside the budget with no mock module passes (exit 0)', () => {
    const { code, out } = run(['--dir', fakeBuild(true, false), '--enforce', ...BIG]);
    expect(out).toMatch(/-> OK/);
    expect(code).toBe(0);
  });

  test('an entry over the gzip budget fails (exit 1) and says by how much', () => {
    const dir = fakeBuild(true, false);
    const { code, out } = run(['--dir', dir, '--enforce', '--budget-gzip', '10', '--budget-raw', '1000000']);
    expect(code).toBe(1);
    const gz = gzipSync(fs.readFileSync(path.join(dir, 'assets', 'index-AbC12.js')), { level: 9 }).length;
    expect(out).toContain(`entry gzip ${gz} B is ${gz - 10} B over the budget 10 B`);
    expect(out).not.toMatch(/entry raw .* over the budget/);
  });

  test('an entry over the raw budget fails too', () => {
    const { code, out, report } = run(['--dir', fakeBuild(true, false), '--enforce', '--budget-gzip', '1000000', '--budget-raw', '10', '--json']);
    expect(code).toBe(1);
    expect(report?.mode).toBe('enforce');
    expect(report?.failures).toHaveLength(1);
    expect(out).toMatch(/entry raw \d+ B is \d+ B over the budget 10 B/);
  });

  test('a mock module back in the entry fails even inside the byte budget', () => {
    const { code, out } = run(['--dir', fakeBuild(true, true), '--enforce', ...BIG]);
    expect(code).toBe(1);
    expect(out).toMatch(/1 mock module\(s\) in the entry \(allowed 0\): src\/api\/tickets-mock\.ts/);
  });

  test('a build without source maps: the mock rule is not measured, the byte budget still decides', () => {
    expect(run(['--dir', fakeBuild(false), '--enforce', ...BIG]).code).toBe(0);
    expect(run(['--dir', fakeBuild(false), '--enforce', '--budget-gzip', '10']).code).toBe(1);
  });

  test('no build to measure is a failure, not a pass', () => {
    const { code, out } = run(['--dir', path.join(os.tmpdir(), 'sw-no-such-build-2442'), '--enforce']);
    expect(code).toBe(1);
    expect(out).toMatch(/no build/i);
  });

  test('the committed budget is the measured entry plus the stated margin, rounded up to 1000 B; no mock is allowed', () => {
    const b = (JSON.parse(fs.readFileSync(BASELINE, 'utf8')) as { bundle: { measured: { gzip: number; raw: number }; marginPct: number; budget: { gzip: number; raw: number }; mocksInEntry: number } }).bundle;
    const withMargin = (n: number): number => Math.ceil((n * (1 + b.marginPct / 100)) / 1000) * 1000;
    expect(b.marginPct).toBeGreaterThan(0);
    expect(b.marginPct).toBeLessThanOrEqual(5);
    expect(b.budget).toEqual({ gzip: withMargin(b.measured.gzip), raw: withMargin(b.measured.raw) });
    expect(b.mocksInEntry).toBe(0);
  });
});
