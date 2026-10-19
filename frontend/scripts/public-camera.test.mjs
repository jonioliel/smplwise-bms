// The vendor page opens the phone's own camera through <input type=file capture=environment> (no getUserMedia, so no
// Permissions-Policy change). Pins that contract for the claim picker. Run: node --test scripts/public-camera.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function fakeDom() {
  const made = [];
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  globalThis.document = {
    body: { appendChild() {} },
    createElement() {
      const el = { attrs: {}, hidden: false, type: '', accept: '', setAttribute(k, v) { this.attrs[k] = v; },
        addEventListener() {}, remove() {}, click() {} };
      made.push(el);
      return el;
    },
  };
  return made;
}

test('camera pick uses a file input with capture=environment, images only', async () => {
  const made = fakeDom();
  const { pickFile, ACCEPT } = await import('../src/public-ticket/claim/pick.ts');
  void pickFile('camera');
  assert.equal(made[0].type, 'file');
  assert.equal(made[0].attrs.capture, 'environment');
  assert.equal(made[0].accept, ACCEPT.camera);
  assert.equal(ACCEPT.camera, 'image/jpeg,image/png');
});

test('gallery pick has no capture attribute', async () => {
  const made = fakeDom();
  const { pickFile } = await import('../src/public-ticket/claim/pick.ts');
  void pickFile('gallery');
  assert.equal(made[0].attrs.capture, undefined);
});

test('ticket photo block keeps the capture input and no live camera stream is used', () => {
  const main = readFileSync(new URL('../src/public-ticket/main.ts', import.meta.url), 'utf8');
  assert.match(main, /capture: capture \? 'environment' : null/);
  for (const f of ['main.ts', 'rfq/rfq-upload.ts', 'claim/claim-step.ts', 'claim/pick.ts']) {
    assert.doesNotMatch(readFileSync(new URL(`../src/public-ticket/${f}`, import.meta.url), 'utf8'), /getUserMedia/);
  }
});
