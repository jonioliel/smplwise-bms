#!/usr/bin/env node
// GATE-TRUST-2540 (review finding TR-04): prove that the shipped UI bundle is the build of the gated source.
//
// `npm run build:addon` runs this LAST, after the two Vite builds and sourcemaps-archive.mjs. It writes
// ../smplwise_vms/www/build-stamp.json:
//   { "schema": 1, "version": <config.yaml version>, "inputs_sha256": <digest>, "files": <count>, "inputs": [<paths>],
//     "source_commit": <git HEAD at build time>, "built_at": <ISO time>, "tool": "frontend/scripts/build-stamp.mjs" }
// scripts/release_check.py recomputes the digest on the checkout under test (the release gate runs it on its worktree) and fails a
// release whose bundle was built from other sources: a forgotten or partial rebuild, or a frontend fix committed after the rebuild.
//
// The digest (the same algorithm in release_check.py, inputs_digest()):
//   files  = `git ls-files -z --cached --others --exclude-standard -- <paths>` (paths from scripts/build-stamp-inputs.json, relative
//            to the repository root), de-duplicated, sorted by their UTF-8 bytes;
//   line   = <path> NUL <sha256 hex of the file's bytes with CRLF turned into LF> LF   (a listed file missing on disk: "<missing>")
//   digest = sha256 hex of all lines, in order.
// Vite's --emptyOutDir removes the stamp at the start of a build, so a build that fails half way leaves none (release_check then fails).
//
// Usage: node scripts/build-stamp.mjs [--root <repo>] [--out <file>] [--print]
//   --print  print the stamp as JSON and write nothing.   Exit 0 ok, 1 error (git missing, no inputs), 2 usage.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const INPUTS_FILE = path.join(HERE, 'build-stamp-inputs.json');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** The pathspecs of the build inputs (scripts/build-stamp-inputs.json of the tree that builds). */
export function inputPaths(file = INPUTS_FILE) {
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(doc.paths) || !doc.paths.length) throw new Error(`no "paths" in ${file}`);
  return doc.paths.map(String);
}

/** The bytes of one input as hashed: CRLF -> LF (a Windows checkout with autocrlf hashes like the runner's LF checkout). */
export function normalised(buf) {
  const CRLF = Buffer.from([13, 10]);
  let at = buf.indexOf(CRLF);
  if (at < 0) return buf;
  const parts = [];
  let from = 0;
  while (at >= 0) {
    parts.push(buf.subarray(from, at));   // drop the CR, keep the LF
    from = at + 1;
    at = buf.indexOf(CRLF, from);
  }
  parts.push(buf.subarray(from));
  return Buffer.concat(parts);
}

/** {digest, files} of the inputs under `root` (the repository root). */
export function inputsDigest(root, paths) {
  const raw = execFileSync('git', ['-C', root, 'ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', ...paths],
    { encoding: 'buffer', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  const names = [...new Set(raw.toString('utf8').split('\0').filter(Boolean))]
    .sort((a, b) => Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')));
  const h = createHash('sha256');
  for (const n of names) {
    const p = path.join(root, n);
    let hex = '<missing>';
    try {
      hex = sha256(normalised(fs.readFileSync(p)));
    } catch {
      /* a listed file deleted on disk: hashed as missing, like release_check.py */
    }
    h.update(Buffer.from(`${n}\0${hex}\n`, 'utf8'));
  }
  return { digest: h.digest('hex'), files: names.length };
}

function addonVersion(root) {
  const m = /^version:\s*"([^"]+)"/m.exec(fs.readFileSync(path.join(root, 'smplwise_vms', 'config.yaml'), 'utf8'));
  if (!m) throw new Error('no version: line in smplwise_vms/config.yaml');
  return m[1];
}

function gitHead(root) {
  try {
    return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

export function makeStamp(root, inputsFile = INPUTS_FILE) {
  const paths = inputPaths(inputsFile);
  const { digest, files } = inputsDigest(root, paths);
  if (!files) throw new Error(`no build input found under ${root} for ${paths.join(', ')}`);
  return {
    schema: 1, version: addonVersion(root), inputs_sha256: digest, files, inputs: paths,
    source_commit: gitHead(root), built_at: new Date().toISOString(), tool: 'frontend/scripts/build-stamp.mjs',
  };
}

function main(argv) {
  const o = { root: path.resolve(HERE, '..', '..'), out: null, print: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root') o.root = path.resolve(argv[++i]);
    else if (a === '--out') o.out = path.resolve(argv[++i]);
    else if (a === '--print') o.print = true;
    else {
      console.error(`unknown argument: ${a}`);
      return 2;
    }
  }
  try {
    const stamp = makeStamp(o.root);
    if (o.print) {
      console.log(JSON.stringify(stamp, null, 1));
      return 0;
    }
    const out = o.out || path.join(o.root, 'smplwise_vms', 'www', 'build-stamp.json');
    fs.writeFileSync(out, `${JSON.stringify(stamp, null, 1)}\n`);
    console.log(`build-stamp: ${stamp.files} input files, sha256 ${stamp.inputs_sha256.slice(0, 12)}..., version ${stamp.version} -> ${out}`);
    return 0;
  } catch (e) {
    console.error(`build-stamp: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
