// node --test scripts/build-stamp.test.mjs : GATE-TRUST-2540 (TR-04) - the shipped bundle carries the digest of the sources it was built from.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { inputsDigest, makeStamp, normalised } from './build-stamp.mjs';

function fakeRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-stamp-'));
  const w = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  };
  w('smplwise_vms/config.yaml', 'name: "x"\nversion: "9.8.7"\n');
  w('frontend/src/a.ts', 'export const a = 1;\n');
  w('frontend/src/sub/b.ts', 'export const b = 2;\n');
  w('frontend/tests/t.spec.ts', 'test\n');
  w('frontend/index.html', '<html></html>\n');
  w('inputs.json', JSON.stringify({ paths: ['frontend/src', 'frontend/index.html'] }));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'add', '-A']);
  execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1']);
  return { root, w };
}

test('normalised: CRLF becomes LF, nothing else changes', () => {
  assert.deepEqual(normalised(Buffer.from('a\r\nb\rc\r\n')), Buffer.from('a\nb\rc\n'));
  const plain = Buffer.from('x\ny');
  assert.equal(normalised(plain), plain);
});

test('stamp: version, inputs and a digest that follows the sources only', () => {
  const { root, w } = fakeRepo();
  const s1 = makeStamp(root, path.join(root, 'inputs.json'));
  assert.equal(s1.version, '9.8.7');
  assert.equal(s1.files, 3);
  assert.match(s1.inputs_sha256, /^[0-9a-f]{64}$/);
  w('frontend/tests/t.spec.ts', 'another test\n');            // not an input
  assert.equal(inputsDigest(root, ['frontend/src', 'frontend/index.html']).digest, s1.inputs_sha256);
  w('frontend/src/sub/b.ts', 'export const b = 3;\n');        // an input changed after the build
  assert.notEqual(inputsDigest(root, ['frontend/src', 'frontend/index.html']).digest, s1.inputs_sha256);
  w('frontend/src/sub/b.ts', 'export const b = 2;\r\n');      // the same content with CRLF: the same digest
  assert.equal(inputsDigest(root, ['frontend/src', 'frontend/index.html']).digest, s1.inputs_sha256);
  w('frontend/src/new.ts', 'export {};\n');                    // an untracked new source counts too
  assert.notEqual(inputsDigest(root, ['frontend/src', 'frontend/index.html']).digest, s1.inputs_sha256);
  fs.rmSync(root, { recursive: true, force: true });
});
