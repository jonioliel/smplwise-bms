#!/usr/bin/env node
// CR-BUILD-GUARDS-2438 (review 07:F7, owner decision O3 / Q-CODE-3 a): the debug source maps do not ship in the add-on.
//
// `npm run build:addon` runs this right after the two Vite builds. For each shipped folder (../smplwise_vms/www and
// ../smplwise_vms/www-public) it:
//   1. moves every `*.map` file into the archive, under <archive>/<version>/<folder>/<same relative path>;
//   2. removes the `sourceMappingURL` comment from every `.js` / `.css` file (so the browser asks for no missing file);
//   3. writes <archive>/<version>/MANIFEST.json: version, git commit, time, and per map its bytes plus the sha256 of the shipped
//      file it belongs to (after step 2), so a map can be matched to the exact file a site runs.
// The add-on then carries no `.map` (scripts/release_check.py fails the release if one is there).
//
// Where the archive is (first match):
//   --archive <dir> | env SW_SOURCEMAP_ARCHIVE    an explicit base folder
//   ~/smplwise-results/sourcemaps                 when ~/smplwise-results exists (the runner, where releases are built)
//   frontend/.sourcemaps                          otherwise (a workstation build; gitignored)
// The version is `version:` of smplwise_vms/config.yaml. A rebuild of the same version replaces that version's folder (the last
// build of a version is the one committed in the release).
//
// Usage: node scripts/sourcemaps-archive.mjs [--archive <dir>] [--addon <smplwise_vms dir>] [--dry-run]
// Exit 0 on success (also when there was nothing to move), 1 on an error, 2 on usage.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '..');
export const SHIPPED = ['www', 'www-public'];
// the trailing comment Vite (and esbuild) writes; `//@` is the legacy spelling
const JS_MAP_COMMENT = /\n?\/\/[#@]\s*sourceMappingURL=[^\n]*\s*$/;
const CSS_MAP_COMMENT = /\n?\/\*[#@]\s*sourceMappingURL=[^*]*\*\/\s*$/;

export function stripMapComment(text, ext) {
  const re = ext === '.css' ? CSS_MAP_COMMENT : JS_MAP_COMMENT;
  return re.test(text) ? text.replace(re, '\n') : text;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

export function addonVersion(addon) {
  const cfg = fs.readFileSync(path.join(addon, 'config.yaml'), 'utf8');
  const m = cfg.match(/^version:\s*"([^"]+)"/m);
  if (!m) throw new Error(`no version: line in ${path.join(addon, 'config.yaml')}`);
  return m[1];
}

export function archiveBase(explicit) {
  if (explicit) return path.resolve(explicit);
  if (process.env.SW_SOURCEMAP_ARCHIVE) return path.resolve(process.env.SW_SOURCEMAP_ARCHIVE);
  const results = path.join(os.homedir(), 'smplwise-results');
  if (fs.existsSync(results)) return path.join(results, 'sourcemaps');
  return path.join(FRONTEND, '.sourcemaps');
}

function gitHead(cwd) {
  try {
    return execFileSync('git', ['-C', cwd, 'rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

/** Move the maps out of the shipped folders and strip the comments. Returns the manifest (also written unless dryRun). */
export function archive({ addon, base, dryRun = false, log = console.log }) {
  const version = addonVersion(addon);
  const dest = path.join(base, version);
  const maps = [];
  const stripped = [];
  for (const folder of SHIPPED) {
    const root = path.join(addon, folder);
    for (const f of walk(root)) {
      const ext = path.extname(f);
      if (ext === '.js' || ext === '.css') {
        const text = fs.readFileSync(f, 'utf8');
        const next = stripMapComment(text, ext);
        if (next !== text) {
          stripped.push(path.relative(addon, f).split(path.sep).join('/'));
          if (!dryRun) fs.writeFileSync(f, next);
        }
      }
    }
    for (const f of walk(root).filter((p) => p.endsWith('.map'))) {
      const rel = path.relative(addon, f).split(path.sep).join('/');
      const owner = f.slice(0, -'.map'.length);
      maps.push({
        path: rel,
        bytes: fs.statSync(f).size,
        file: fs.existsSync(owner) ? path.relative(addon, owner).split(path.sep).join('/') : null,
        file_sha256: fs.existsSync(owner) ? sha256(dryRun ? Buffer.from(stripMapComment(fs.readFileSync(owner, 'utf8'), path.extname(owner))) : fs.readFileSync(owner)) : null,
      });
    }
  }
  const manifest = {
    version,
    commit: gitHead(addon),
    built_at: new Date().toISOString(),
    maps: maps.length,
    bytes: maps.reduce((n, m) => n + m.bytes, 0),
    stripped_comments: stripped.length,
    files: maps,
  };
  if (!dryRun && maps.length) {
    fs.rmSync(dest, { recursive: true, force: true });
    for (const m of maps) {
      const to = path.join(dest, ...m.path.split('/'));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      const from = path.join(addon, ...m.path.split('/'));
      try {
        fs.renameSync(from, to);
      } catch {
        fs.copyFileSync(from, to); // another drive / file system
        fs.rmSync(from);
      }
    }
    fs.writeFileSync(path.join(dest, 'MANIFEST.json'), JSON.stringify(manifest, null, 1) + '\n');
  }
  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  log(`sourcemaps-archive: ${maps.length} .map file(s), ${kb(manifest.bytes)}, ${dryRun ? 'would move' : 'moved'} to ${dest}; `
    + `sourceMappingURL comment removed from ${stripped.length} file(s)${dryRun ? ' (dry run)' : ''}`);
  return manifest;
}

function main(argv) {
  const o = { archive: null, addon: path.resolve(FRONTEND, '..', 'smplwise_vms'), dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--archive') o.archive = argv[++i];
    else if (a === '--addon') o.addon = path.resolve(argv[++i]);
    else if (a === '--dry-run') o.dryRun = true;
    else {
      console.error(`unknown argument: ${a}`);
      return 2;
    }
  }
  try {
    archive({ addon: o.addon, base: archiveBase(o.archive), dryRun: o.dryRun });
    return 0;
  } catch (e) {
    console.error(`sourcemaps-archive: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
