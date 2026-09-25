import { defineConfig } from 'vite';

// `base: './'` keeps every asset URL relative so the same build works under the HA Ingress
// prefix (/api/hassio_ingress/<token>/) and on a plain dev server.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        // Plan Studio 3D (T087): three.js in a chunk of its own, fetched only by the dynamic import of sw-plan-3d.
        manualChunks: (id) => (id.includes('/node_modules/three/') ? 'three' : undefined),
      },
    },
  },
  server: {
    // Dev loop: the FastAPI backend runs on 8099 (`python -m smplwise` with SW_DEV_USER); the UI on 5173.
    // `ws: true` forwards the live-video WebSocket relay (/api/v1/media/live/<id>/ws) as well.
    proxy: { '/api': { target: 'http://127.0.0.1:8099', ws: true }, '/healthz': 'http://127.0.0.1:8099' },
  },
  preview: {
    proxy: { '/api': { target: 'http://127.0.0.1:8099', ws: true }, '/healthz': 'http://127.0.0.1:8099' },
  },
});
