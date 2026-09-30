// Automated name check against TOKEN_CONTRACT.md (the check the judge ran by hand in round 1).
// Usage: node contract-check.mjs   → lists every contract name that has neither a direct value in tokens.json nor a
// row in contractAliases (src/tokens.mjs); exits 1 if any is missing. Wildcard mentions (`--dv-*`) and prose examples
// (`--sw-blue`: "semantic names, never colour names") are skipped.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { contractAliases } from './src/tokens.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const contract = readFileSync(resolve(here, '../../handoff/TOKEN_CONTRACT.md'), 'utf8');
const ours = new Set(Object.keys(JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'))));
const aliased = new Set(contractAliases.map(([a]) => a));
const skip = new Set(['--sw-blue', '--sw-blue-soft']);

// A table cell like `--dv-text` / `-2` / `-3` or `--dv-kpi-compact-min-block` / `-pad-block` expands from the last full name.
const names = new Set();
for (const line of contract.split('\n')) {
  let base = null;
  for (const [, cell] of line.matchAll(/`([^`]+)`/g)) {
    if (/^--[a-z0-9-]+$/.test(cell)) { names.add(cell); base = cell; continue; }
    if (!base || !/^-[a-z][a-z0-9-]*$/.test(cell)) continue;
    if (base.endsWith('-min-block')) { names.add(base.slice(0, -'-min-block'.length) + cell); continue; }
    const parts = base.split('-'); const last = parts[parts.length - 1];
    const variant = /^(sm|md|lg|xl|1|2|3|bg|start|end|warm|cool|switch|control|block|inline|hover|soft|size|pad|solid|strong|fill|halo)$/.test(last);
    names.add(variant ? parts.slice(0, -1).join('-') + cell : base + cell);
  }
}
const missing = [...names].filter((n) => !n.endsWith('*') && !n.endsWith('-') && !skip.has(n) && !ours.has(n) && !aliased.has(n)).sort();
console.log(`contract names found: ${names.size} · direct: ${[...names].filter((n) => ours.has(n)).length} · aliased: ${[...names].filter((n) => aliased.has(n)).length} · missing: ${missing.length}`);
if (missing.length) { console.log(missing.join('\n')); process.exit(1); }
