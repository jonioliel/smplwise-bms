// node --test scripts/visual.test.mjs : the driver's pure logic (selection, report); no browser needed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadMatrix, selectTouched, parseArgs, selection, flatten, writeReport, summarize } from './visual.mjs';

const matrix = loadMatrix();

test('matrix is well formed', () => {
  const ids = matrix.screens.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of matrix.screens) {
    assert.ok(s.hash.startsWith('/'));
    assert.ok(s.sources.length && s.states.length);
    for (const st of s.states) assert.ok(st in matrix.stateKinds, `${s.id}: unknown state ${st}`);
  }
});

test('touched: a screen source selects only that screen', () => {
  assert.deepEqual(selectTouched(['frontend/src/screens/devices-schedules.ts'], matrix), ['devices-schedules']);
  assert.deepEqual(selectTouched(['backend/app/x.py', 'docs/a.md'], matrix), []);
});

test('touched: shared styles/components select every screen', () => {
  assert.equal(selectTouched(['frontend/src/styles/tokens.css'], matrix).length, matrix.screens.length);
  assert.equal(selectTouched(['frontend\\src\\components\\sw-button.ts'], matrix).length, matrix.screens.length);
});

test('selection: unknown ids are refused, --all and --screens work', () => {
  assert.throws(() => selection({ screens: 'nope' }, matrix), /unknown screen/);
  assert.equal(selection({ all: true }, matrix).length, matrix.screens.length);
  assert.deepEqual(selection({ screens: 'sites,map-floor' }, matrix), ['sites', 'map-floor']);
  assert.equal(selection({}, matrix), null);
});

test('parseArgs: flags with values, boolean flags', () => {
  const o = parseArgs(['run', '--touched', '--base', 'origin/main', '--projects', 'desktop']);
  assert.equal(o.cmd, 'run');
  assert.equal(o.flags.touched, true);
  assert.equal(o.flags.base, 'origin/main');
  assert.equal(o.flags.projects, 'desktop');
});

test('report: pass, diff (with images), no-baseline', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vd-'));
  const png = path.join(tmp, 'a.png');
  fs.writeFileSync(png, 'x');
  const mk = (title, status, atts = [], err) => ({
    title,
    tests: [{ projectName: 'desktop', status: status === 'skipped' ? 'skipped' : 'x', results: [{ status, attachments: atts, error: err }] }],
  });
  const json = {
    suites: [{ suites: [{ specs: [
      mk('vm sites ready light is pixel-stable', 'passed'),
      mk('vm sites ready dark is pixel-stable', 'failed', [
        { name: 'sites-ready-dark-expected.png', path: png }, { name: 'sites-ready-dark-actual.png', path: png }, { name: 'sites-ready-dark-diff.png', path: png },
      ], { message: '812 pixels differ' }),
      mk('vm map-floor ready light is pixel-stable', 'skipped'),
      mk('some other test', 'passed'),
    ] }] }],
  };
  const rows = flatten(json);
  assert.equal(rows.length, 3);
  assert.deepEqual(summarize(rows), { pass: 1, diff: 1, 'no-baseline': 1, error: 0 });
  const { md } = writeReport(rows, path.join(tmp, 'out'));
  assert.match(md, /pass 1 \| differs 1 \| error 0 \| no baseline 1/);
  assert.match(md, /sites \| ready \| dark \| desktop \| images\//);
  assert.ok(fs.existsSync(path.join(tmp, 'out', 'index.html')));
  assert.equal(fs.readdirSync(path.join(tmp, 'out', 'images')).length, 3);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('matrix: per-screen tolerance and mask overrides are well formed', () => {
  const okSel = (a) => a === undefined || (Array.isArray(a) && a.every((x) => typeof x === 'string' && x.trim()));
  assert.ok(okSel(matrix.mask));
  for (const s of matrix.screens) {
    assert.ok(okSel(s.mask), `${s.id}: mask must be a list of non-empty CSS selectors`);
    if (s.threshold !== undefined) assert.ok(s.threshold >= 0 && s.threshold <= 1, `${s.id}: threshold 0..1`);
    if (s.maxDiffPixelRatio !== undefined) assert.ok(s.maxDiffPixelRatio >= 0 && s.maxDiffPixelRatio <= 1, `${s.id}: maxDiffPixelRatio 0..1`);
  }
});
