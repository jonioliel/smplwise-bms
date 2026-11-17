// node --test scripts/sourcemaps-archive.test.mjs : CR-BUILD-GUARDS-2438 - the add-on build moves its debug maps out (07:F7).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { archive, stripMapComment, addonVersion, archiveBase } from './sourcemaps-archive.mjs';

function fakeAddon() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-maps-'));
  const addon = path.join(root, 'smplwise_vms');
  fs.mkdirSync(path.join(addon, 'www', 'assets'), { recursive: true });
  fs.mkdirSync(path.join(addon, 'www-public', 'assets'), { recursive: true });
  fs.writeFileSync(path.join(addon, 'config.yaml'), 'name: "x"\nversion: "9.8.7"\n');
  fs.writeFileSync(path.join(addon, 'www', 'index.html'), '<script src="./assets/index-A.js"></script>');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'index-A.js'), 'console.log(1);\n//# sourceMappingURL=index-A.js.map\n');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'index-A.js.map'), '{"version":3}');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'chunk-B.js'), 'export const b=2;\n//# sourceMappingURL=chunk-B.js.map');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'chunk-B.js.map'), '{"version":3,"x":1}');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'style-C.css'), 'a{color:red}\n/*# sourceMappingURL=style-C.css.map */\n');
  fs.writeFileSync(path.join(addon, 'www', 'assets', 'style-C.css.map'), '{}');
  fs.writeFileSync(path.join(addon, 'www-public', 'assets', 'public-ticket-D.js'), 'let d;\n');
  return { root, addon };
}

const files = (dir) => fs.existsSync(dir) ? fs.readdirSync(dir, { recursive: true }).map(String).map((p) => p.split(path.sep).join('/')).sort() : [];

test('strip: removes only the trailing map comment', () => {
  assert.equal(stripMapComment('a();\n//# sourceMappingURL=a.js.map\n', '.js'), 'a();\n');
  assert.equal(stripMapComment('a();\n//@ sourceMappingURL=a.js.map', '.js'), 'a();\n');
  assert.equal(stripMapComment('a{}\n/*# sourceMappingURL=a.css.map */', '.css'), 'a{}\n');
  const keep = 'const s = "//# sourceMappingURL=x";\nrun(s);\n';
  assert.equal(stripMapComment(keep, '.js'), keep, 'a string in the middle of the file is not the trailing comment');
});

test('archive: no .map and no comment left in the shipped folders; the maps and a manifest land under <base>/<version>', () => {
  const { root, addon } = fakeAddon();
  const base = path.join(root, 'archive');
  const m = archive({ addon, base, log: () => {} });
  assert.equal(m.version, '9.8.7');
  assert.equal(m.maps, 3);
  assert.equal(m.stripped_comments, 3);
  for (const f of [...files(path.join(addon, 'www')), ...files(path.join(addon, 'www-public'))]) assert.ok(!f.endsWith('.map'), f);
  for (const f of ['index-A.js', 'chunk-B.js', 'style-C.css']) {
    assert.ok(!fs.readFileSync(path.join(addon, 'www', 'assets', f), 'utf8').includes('sourceMappingURL'), f);
  }
  assert.deepEqual(files(path.join(base, '9.8.7')).filter((f) => f.endsWith('.map')),
    ['www/assets/chunk-B.js.map', 'www/assets/index-A.js.map', 'www/assets/style-C.css.map']);
  const man = JSON.parse(fs.readFileSync(path.join(base, '9.8.7', 'MANIFEST.json'), 'utf8'));
  const a = man.files.find((x) => x.path === 'www/assets/index-A.js.map');
  assert.equal(a.file, 'www/assets/index-A.js');
  assert.match(a.file_sha256, /^[0-9a-f]{64}$/);
  fs.rmSync(root, { recursive: true, force: true });
});

test('archive: a second run is a no-op on the shipped folders and keeps the archive', () => {
  const { root, addon } = fakeAddon();
  const base = path.join(root, 'archive');
  archive({ addon, base, log: () => {} });
  const again = archive({ addon, base, log: () => {} });
  assert.equal(again.maps, 0);
  assert.equal(again.stripped_comments, 0);
  assert.ok(fs.existsSync(path.join(base, '9.8.7', 'www', 'assets', 'index-A.js.map')), 'an empty run must not wipe the archive');
  fs.rmSync(root, { recursive: true, force: true });
});

test('dry run changes nothing', () => {
  const { root, addon } = fakeAddon();
  const before = fs.readFileSync(path.join(addon, 'www', 'assets', 'index-A.js'), 'utf8');
  const m = archive({ addon, base: path.join(root, 'archive'), dryRun: true, log: () => {} });
  assert.equal(m.maps, 3);
  assert.equal(fs.readFileSync(path.join(addon, 'www', 'assets', 'index-A.js'), 'utf8'), before);
  assert.ok(fs.existsSync(path.join(addon, 'www', 'assets', 'index-A.js.map')));
  assert.ok(!fs.existsSync(path.join(root, 'archive')));
  fs.rmSync(root, { recursive: true, force: true });
});

test('version and archive base', () => {
  const { root, addon } = fakeAddon();
  assert.equal(addonVersion(addon), '9.8.7');
  assert.equal(archiveBase(path.join(root, 'x')), path.join(root, 'x'));
  const prev = process.env.SW_SOURCEMAP_ARCHIVE;
  process.env.SW_SOURCEMAP_ARCHIVE = path.join(root, 'env');
  assert.equal(archiveBase(), path.join(root, 'env'));
  if (prev === undefined) delete process.env.SW_SOURCEMAP_ARCHIVE; else process.env.SW_SOURCEMAP_ARCHIVE = prev;
  fs.rmSync(root, { recursive: true, force: true });
});
