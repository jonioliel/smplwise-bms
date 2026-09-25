import { defineConfig } from 'vite';

// `base: './'` keeps every asset URL relative so the same build works under the HA Ingress
// prefix (/api/hassio_ingress/<token>/) and on a plain dev server.
// SW_API_PORT: the backend the dev server and the preview proxy to (a throwaway second instance); default 8099.
const API = `http://127.0.0.1:${process.env.SW_API_PORT || '8099'}`;

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
    // `ws: true` forwards the live-video WebSocket relay (/api/v1/media/live/<id>/ws) as well.
    proxy: { '/api': { target: API, ws: true }, '/healthz': API },
  },
  preview: {
    proxy: { '/api': { target: API, ws: true }, '/healthz': API },
  },
});
