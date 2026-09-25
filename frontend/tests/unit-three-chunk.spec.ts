import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// Plan Studio phase 4 (T087, design 10.1): three.js lives in a chunk of its own, loaded only when someone opens 3D, and
// that chunk stays under 200 KB gzip. Runs in node: the first test builds the chunk boundary module through a small
// synthetic consumer with the same Vite + wasm rollup the app uses (no dist needed); the second reads the app's own
// dist when it exists (Task 5 adds it).
//
// Deviation from task-1-brief.md's pasted draft, recorded per the T087 process rule (contradictions are recorded, not
// silently resolved): the draft built three-bundle.ts directly, with nothing importing any of its named exports.
// That does not measure a real chunk size under this Vite's actual defaults - confirmed by hand before writing this:
// Vite sets `preserveEntrySignatures: false` for a plain (non-lib, non-SSR) build, so an entry whose exports nobody
// uses tree-shakes to an empty chunk (measured: both the boundary chunk and the three chunk landed at ~21 bytes
// gzip, and the two emitted file names both matched the draft's `/^three-[\w-]+\.js$/` filter anyway, so `toHaveLength(1)`
// could never pass). Forcing `preserveEntrySignatures: 'exports-only'` keeps all ~400 of three's exports alive instead
// (none is individually "used"), which blows the boundary facade past the 4 KB budget (5,088 bytes measured, because
// Rollup flattens a cross-chunk `export *` into one import/export pair per binding) and leaves the chunk itself at
// 204,698 bytes gzip - inside the 200 KB cap by only 102 bytes, too fragile to trust as a regression gate. A synthetic
// probe that imports and calls the handful of classes a minimal 3D scene actually needs (mirroring what Task 5's
// scene module will do) lets ordinary tree-shaking narrow the chunk the way the design intends: 146,719 bytes gzip
// with real headroom, consistent with the 160 KB the plan writer measured.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(HERE, '..');
const LIMIT_GZIP = 200 * 1024;

export const gzipBytes = (file: string): number => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;

/** Build one entry through Vite into a fresh temp folder and return the emitted asset file names with their gzip sizes. */
export async function buildProbe(entry: string): Promise<{ dir: string; files: { name: string; gzip: number }[] }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-three-probe-'));
  await build({
    configFile: false,
    root: FRONTEND,
    logLevel: 'silent',
    build: {
      outDir: dir,
      emptyOutDir: true,
      target: 'es2022',
      sourcemap: false,
      rollupOptions: { input: entry, output: { manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined) } },
    },
  });
  const assets = path.join(dir, 'assets');
  const files = fs.readdirSync(assets).filter((f) => f.endsWith('.js')).map((name) => ({ name, gzip: gzipBytes(path.join(assets, name)) }));
  return { dir, files };
}

/**
 * A synthetic entry exercising the three-bundle exports a minimal Plan Studio 3D scene needs: geometry, a material,
 * lights, the camera/renderer pair, and the two named addons. Written to its own temp folder (separate from the
 * build output) so nothing under src/ changes - three-bundle.ts stays the zero-logic re-export Task 5 expects.
 */
function writeUsageEntry(): { file: string; srcDir: string } {
  const srcDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw-three-probe-src-'));
  const boundary = path.join(FRONTEND, 'src', 'map', 'three-bundle.ts').replace(/\\/g, '/');
  const file = path.join(srcDir, 'usage-probe.ts');
  fs.writeFileSync(
    file,
    [
      `import { Scene, PerspectiveCamera, WebGLRenderer, Mesh, BoxGeometry, MeshStandardMaterial, AmbientLight, DirectionalLight, Group, Vector3, OrbitControls, GLTFExporter } from '${boundary}';`,
      'const scene = new Scene();',
      'const camera = new PerspectiveCamera(75, 1, 0.1, 1000);',
      'const renderer = new WebGLRenderer();',
      'scene.add(new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial()), new AmbientLight(), new DirectionalLight(), new Group());',
      'const controls = new OrbitControls(camera, renderer.domElement);',
      'const exporter = new GLTFExporter();',
      'void new Vector3(); void controls; void exporter;',
      '',
    ].join('\n'),
  );
  return { file, srcDir };
}

test('the three chunk built from a representative scene consumer is separate and under 200 KB gzip', async () => {
  test.setTimeout(120_000);
  const { file: entry, srcDir } = writeUsageEntry();
  const { dir, files } = await buildProbe(entry);
  try {
    const three = files.filter((f) => /^three-[\w-]+\.js$/.test(f.name));
    expect(three, `one three chunk among ${files.map((f) => f.name).join(', ')}`).toHaveLength(1);
    console.log(`three chunk: ${three[0].name} ${three[0].gzip} bytes gzip`);
    expect(three[0].gzip).toBeLessThanOrEqual(LIMIT_GZIP);
    expect(three[0].gzip).toBeGreaterThan(50 * 1024); // a chunk this small would mean three was not bundled at all
    const probe = files.find((f) => /^usage-probe-[\w-]+\.js$/.test(f.name));
    expect(probe, 'the boundary module itself is a tiny re-export').toBeTruthy();
    expect(probe!.gzip).toBeLessThan(4 * 1024);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(srcDir, { recursive: true, force: true });
  }
});
