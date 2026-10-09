/**
 * A tiny static server for the headless captures (Chromium's screenshot timing is steadier over http than file:///).
 *   node tools/serve.mjs [port]      (default 4190; serves the prototype folder, read-only, no directory listing)
 * Stop it with its own PID (printed on start) - never by process name.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = +(process.argv[2] || process.env.SW_PORT || 4190);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.css': 'text/css', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.md': 'text/plain; charset=utf-8' };

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root)) { res.writeHead(403); res.end(); return; }
    const st = await stat(file);
    if (!st.isFile()) { res.writeHead(404); res.end(); return; }
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': body.length });
    res.end(body);
  } catch {
    res.writeHead(404); res.end();
  }
});
server.listen(port, '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}/index.html  pid ${process.pid}`));
