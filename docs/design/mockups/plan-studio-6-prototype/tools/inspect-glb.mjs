// List materials, mesh count and triangle count of each .glb (reads the JSON chunk; no loader, no execution).
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
const dir = process.argv[2];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.glb')).sort()) {
  const b = readFileSync(path.join(dir, f));
  const len = b.readUInt32LE(12); const json = JSON.parse(b.toString('utf8', 20, 20 + len));
  let tris = 0; for (const m of json.meshes || []) for (const p of m.primitives || []) { const a = json.accessors[p.indices]; tris += a ? a.count / 3 : 0; }
  const texs = (json.images || []).length;
  console.log(f.padEnd(26), String(statSync(path.join(dir, f)).size).padStart(7), 'B', 'tris', String(Math.round(tris)).padStart(5), 'meshes', (json.meshes || []).length, 'images', texs, 'materials:', (json.materials || []).map((m) => m.name).join(', '));
}
