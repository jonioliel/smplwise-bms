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
  },
  server: {
    // Dev loop: the FastAPI backend runs on 8099 (`python -m smplwise` with SW_DEV_USER); the UI on 5173.
    proxy: { '/api': 'http://127.0.0.1:8099', '/healthz': 'http://127.0.0.1:8099' },
  },
  preview: {
    proxy: { '/api': 'http://127.0.0.1:8099', '/healthz': 'http://127.0.0.1:8099' },
  },
});
