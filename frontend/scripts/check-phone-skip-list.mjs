// PHONE-SKIP-DESKTOP-SHOTS-2490: every file in tests/phone-skip-list.json must still exist, and carry a reason.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const tests = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests');
const { files } = JSON.parse(readFileSync(join(tests, 'phone-skip-list.json'), 'utf8'));
const bad = [];
for (const [name, reason] of Object.entries(files)) {
  if (!existsSync(join(tests, name))) bad.push(`${name}: file no longer exists - remove it from tests/phone-skip-list.json`);
  else if (typeof reason !== 'string' || reason.trim().length < 10) bad.push(`${name}: needs a one-line reason`);
}
if (bad.length) {
  console.error(bad.join('\n'));
  process.exit(1);
}
console.log(`phone skip list ok: ${Object.keys(files).length} files`);
