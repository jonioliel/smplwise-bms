#!/usr/bin/env node
// M074 visual-diff driver around tests/visual-matrix.spec.ts (Playwright toHaveScreenshot; no extra dependencies).
//
//   node scripts/visual.mjs plan   [--touched [--base origin/main]] [--screens a,b]   print the selected screens, run nothing
//   node scripts/visual.mjs run    [selection] [--projects desktop,mobile] [--schemes light,dark] [--out DIR]
//   node scripts/visual.mjs accept <selection REQUIRED, or --all> [--projects ...]    deliberately rewrite baselines
//   node scripts/visual.mjs report <playwright-json> [--out DIR]                       rebuild summary.md / index.html
//
// selection: --screens a,b | --touched (screens whose `sources` match files changed vs --base, default origin/main) | --all.
// Exit code: 1 when any screen differs from its baseline, 0 otherwise (a missing baseline is "no baseline", never a pass).
// Artifacts in <out> (default visual-out/<timestamp>/): summary.md, index.html (expected | actual | diff side by side),
// images/, results.json. Baselines live in tests/visual-matrix.spec.ts-snapshots/ with the platform suffix (-win32 / -linux).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '..');
const MATRIX = path.join(FRONTEND, 'tests', 'visual', 'matrix.json');

export const loadMatrix = (file = MATRIX) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** Screens affected by a list of repo-relative changed files (forward slashes). */
export function selectTouched(changed, matrix) {
  const files = changed.map((f) => f.replace(/\\/g, '/'));
  if (files.some((f) => matrix.shared.some((p) => f.startsWith(p)))) return matrix.screens.map((s) => s.id);
  return matrix.screens.filter((s) => files.some((f) => s.sources.some((p) => f.startsWith(p)))).map((s) => s.id);
}

export function parseArgs(argv) {
  const o = { cmd: argv[0], rest: [], flags: {} };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--') && !['touched', 'all'].includes(k)) {
        o.flags[k] = next;
        i++;
      } else o.flags[k] = true;
    } else o.rest.push(a);
  }
  return o;
}

function git(...args) {
  const r = spawnSync('git', args, { cwd: FRONTEND, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean);
}

export function changedFiles(base) {
  // three-dot: what this branch changed since it left <base>, plus uncommitted work
  const committed = git('diff', '--name-only', `${base}...HEAD`);
  const dirty = git('diff', '--name-only', 'HEAD');
  const untracked = git('ls-files', '--others', '--exclude-standard', '--full-name');
  return [...new Set([...committed, ...dirty, ...untracked])];
}

export function selection(flags, matrix) {
  const ids = matrix.screens.map((s) => s.id);
  let sel = null;
  if (flags.all) sel = ids;
  else if (flags.screens) sel = String(flags.screens).split(',').map((s) => s.trim()).filter(Boolean);
  else if (flags.touched) sel = selectTouched(changedFiles(flags.base || 'origin/main'), matrix);
  if (sel) {
    const bad = sel.filter((s) => !ids.includes(s));
    if (bad.length) throw new Error(`unknown screen id(s): ${bad.join(', ')} (known: ${ids.join(', ')})`);
  }
  return sel;
}

// ---- report -------------------------------------------------------------------------------------------------------

/** Flatten a Playwright JSON report into one row per (screen, state, scheme, project). */
export function flatten(json) {
  const rows = [];
  const walk = (suite) => {
    for (const spec of suite.specs || []) {
      const m = /^vm (\S+) (\S+) (\S+) is pixel-stable$/.exec(spec.title);
      if (!m) continue;
      for (const t of spec.tests || []) {
        const r = (t.results || []).at(-1) || {};
        const att = Object.fromEntries((r.attachments || []).filter((a) => a.path).map((a) => [a.name.replace(/\.png$/, ''), a.path]));
        const key = (suffix) => Object.entries(att).find(([k]) => k.endsWith(suffix))?.[1];
        let status = r.status === 'passed' ? 'pass' : r.status === 'skipped' || t.status === 'skipped' ? 'no-baseline' : 'diff';
        if (status === 'diff' && !key('-diff') && !key('-actual')) status = 'error';
        rows.push({
          screen: m[1], state: m[2], scheme: m[3], project: t.projectName, status,
          expected: key('-expected'), actual: key('-actual'), diff: key('-diff'),
          message: status === 'diff' || status === 'error' ? String(r.error?.message || '').replace(/\u001b\[[0-9;]*m/g, '').split('\n').slice(0, 6).join('\n') : '',
        });
      }
    }
    (suite.suites || []).forEach(walk);
  };
  (json.suites || []).forEach(walk);
  return rows;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function summarize(rows) {
  const c = { pass: 0, diff: 0, 'no-baseline': 0, error: 0 };
  rows.forEach((r) => (c[r.status] += 1));
  return c;
}

/** Copy the images next to the report and return markdown + html. */
export function writeReport(rows, outDir, meta = {}) {
  const img = path.join(outDir, 'images');
  fs.mkdirSync(img, { recursive: true });
  const rel = (p, tag) => {
    if (!p || !fs.existsSync(p)) return null;
    const name = `${tag}.png`;
    fs.copyFileSync(p, path.join(img, name));
    return `images/${name}`;
  };
  rows.forEach((r, i) => {
    const tag = `${String(i).padStart(3, '0')}-${r.screen}-${r.state}-${r.scheme}-${r.project}`;
    r.imgs = r.status === 'diff' || r.status === 'error' ? { expected: rel(r.expected, `${tag}-expected`), actual: rel(r.actual, `${tag}-actual`), diff: rel(r.diff, `${tag}-diff`) } : {};
  });
  const c = summarize(rows);
  const bad = rows.filter((r) => r.status === 'diff' || r.status === 'error');
  const nb = rows.filter((r) => r.status === 'no-baseline');
  const head = `Visual diff (M074) - ${meta.when || new Date().toISOString()}${meta.platform ? ` - ${meta.platform}` : ''}${meta.selection ? ` - screens: ${meta.selection}` : ''}`;
  const md = [
    `# ${head}`,
    '',
    `pass ${c.pass} | differs ${c.diff} | error ${c.error} | no baseline ${c['no-baseline']} | total ${rows.length}`,
    '',
    ...(bad.length
      ? ['## Differences', '', '| screen | state | scheme | viewport | diff image |', '|---|---|---|---|---|', ...bad.map((r) => `| ${r.screen} | ${r.state} | ${r.scheme} | ${r.project} | ${r.imgs.diff || r.imgs.actual || '-'} |`), '']
      : ['No differences against the baselines that exist.', '']),
    ...(nb.length ? ['## No baseline on this platform', '', `${nb.length} case(s): run \`node scripts/visual.mjs accept --screens <ids>\` on this platform to create them.`, ''] : []),
  ].join('\n');
  const cell = (p, label) => (p ? `<figure><figcaption>${label}</figcaption><a href="${p}"><img src="${p}" loading="lazy"></a></figure>` : '');
  const html = `<!doctype html><meta charset="utf-8"><title>Visual diff</title>
<style>body{font:14px system-ui;margin:20px;background:#f7f7f8;color:#111}h1{font-size:18px}.row{background:#fff;border:1px solid #ddd;border-radius:8px;padding:10px;margin:12px 0}
.imgs{display:flex;gap:10px;flex-wrap:wrap}figure{margin:0;flex:1 1 280px}figcaption{font-size:12px;color:#555}img{max-width:100%;border:1px solid #ccc}pre{font-size:12px;white-space:pre-wrap}</style>
<h1>${esc(head)}</h1><p>pass ${c.pass} | differs ${c.diff} | error ${c.error} | no baseline ${c['no-baseline']} | total ${rows.length}</p>
${bad.map((r) => `<div class="row"><b>${esc(r.screen)}</b> / ${esc(r.state)} / ${esc(r.scheme)} / ${esc(r.project)}<div class="imgs">${cell(r.imgs.expected, 'expected (baseline)')}${cell(r.imgs.actual, 'actual')}${cell(r.imgs.diff, 'diff')}</div><pre>${esc(r.message)}</pre></div>`).join('') || '<p>No differences.</p>'}
${nb.length ? `<h2>No baseline (${nb.length})</h2><ul>${nb.map((r) => `<li>${esc(r.screen)} / ${esc(r.state)} / ${esc(r.scheme)} / ${esc(r.project)}</li>`).join('')}</ul>` : ''}`;
  fs.writeFileSync(path.join(outDir, 'summary.md'), md);
  fs.writeFileSync(path.join(outDir, 'index.html'), html);
  fs.writeFileSync(path.join(outDir, 'results.json'), JSON.stringify(rows.map(({ expected, actual, diff, ...r }) => r), null, 1));
  return { counts: c, md };
}

// ---- CLI ----------------------------------------------------------------------------------------------------------

function runPlaywright({ cmd, flags }, sel, outDir) {
  const args = ['playwright', 'test', 'tests/visual-matrix.spec.ts', '--reporter=list,json', `--output=${path.join(outDir, 'pw')}`];
  for (const p of String(flags.projects || 'desktop,tablet,mobile').split(',')) args.push(`--project=${p.trim()}`);
  if (cmd === 'accept') args.push('--update-snapshots=changed');
  const env = {
    ...process.env,
    PLAYWRIGHT_JSON_OUTPUT_NAME: path.join(outDir, 'playwright.json'),
    ...(sel ? { SW_VISUAL_ONLY: sel.join(',') } : {}),
    ...(flags.schemes ? { SW_VISUAL_SCHEMES: String(flags.schemes) } : {}),
  };
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { cwd: FRONTEND, env, stdio: 'inherit', shell: process.platform === 'win32' });
  return r.status ?? 1;
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const matrix = loadMatrix();
  if (o.cmd === 'report') {
    const out = path.resolve(String(o.flags.out || path.join(FRONTEND, 'visual-out', 'report')));
    fs.mkdirSync(out, { recursive: true });
    const { counts, md } = writeReport(flatten(JSON.parse(fs.readFileSync(o.rest[0], 'utf8'))), out);
    console.log(md);
    process.exit(counts.diff + counts.error ? 1 : 0);
  }
  if (!['plan', 'run', 'accept'].includes(o.cmd)) {
    console.error('usage: visual.mjs plan|run|accept|report ... (see the header of this file)');
    process.exit(2);
  }
  const sel = selection(o.flags, matrix);
  if (o.cmd === 'accept' && !sel) {
    console.error('accept rewrites baselines: name them with --screens a,b, --touched, or --all. Nothing was changed.');
    process.exit(2);
  }
  if (o.flags.touched && sel && !sel.length) {
    console.log('visual: no screen is touched by this change; nothing to compare.');
    process.exit(0);
  }
  const total = matrix.screens.filter((s) => !sel || sel.includes(s.id)).reduce((n, s) => n + s.states.length, 0) * matrix.schemes.length;
  console.log(`visual ${o.cmd}: ${sel ? sel.join(', ') : 'all screens'} (${total} case(s) per viewport)`);
  if (o.cmd === 'plan') process.exit(0);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.resolve(String(o.flags.out || path.join(FRONTEND, 'visual-out', stamp)));
  fs.mkdirSync(out, { recursive: true });
  const code = runPlaywright(o, sel, out);
  const jf = path.join(out, 'playwright.json');
  if (!fs.existsSync(jf)) {
    console.error('visual: Playwright produced no JSON report (build/preview failed?).');
    process.exit(code || 1);
  }
  const { counts, md } = writeReport(flatten(JSON.parse(fs.readFileSync(jf, 'utf8'))), out, { platform: process.platform, selection: sel ? sel.join(',') : 'all' });
  console.log(`\n${md}\nartifacts: ${out}`);
  process.exit(o.cmd === 'accept' ? code : counts.diff + counts.error ? 1 : code);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main().catch((e) => { console.error(e.message); process.exit(2); });
