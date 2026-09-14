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
});
