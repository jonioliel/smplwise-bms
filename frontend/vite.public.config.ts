import { defineConfig, type Plugin } from 'vite';

// CR-038 slice 4 (spec 5 / 10.7): the handler page is a SECOND, separate Vite build - its own entry (public-ticket.html ->
// src/public-ticket/main.ts), its own output OUTSIDE smplwise_vms/www (the main app mounts www at / under the Ingress origin; a
// public page built there would run with the main app's cookies and without the public CSP - code review W16), no shared chunk
// with the app, no service worker, no module-preload polyfill (no inline script: CSP `script-src 'self'`), no inline style
// (CSP `style-src 'self'`). The public listener serves `<out>/index.html` at /t/ and /t/r/<rid>, and `<out>/assets/*` at
// /t/assets/* (content-hashed names are cached `immutable`).
//   npm run build:public              -> dist-public/ (local look, Playwright evidence)
//   npm run build:public:addon        -> ../smplwise_vms/www-public/ (the add-on image; part of build:addon)

/** The listener reads index.html: the entry file keeps its descriptive name in the source tree. */
function entryAsIndex(): Plugin {
  return {
    name: 'public-ticket-entry-as-index',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [key, item] of Object.entries(bundle)) {
        if (item.type === 'asset' && item.fileName === 'public-ticket.html') {
          item.fileName = 'index.html';
          delete bundle[key];
          bundle['index.html'] = item;
        }
      }
    },
  };
}

export default defineConfig({
  base: '/t/',
  publicDir: false,
  plugins: [entryAsIndex()],
  build: {
    outDir: process.env.SW_PUBLIC_OUT || 'dist-public',
    emptyOutDir: true,
    sourcemap: false,
    target: 'es2020',
    modulePreload: false,
    cssCodeSplit: false,
    assetsInlineLimit: 0, // never a data: URL (CSP: img-src 'self' blob:)
    rollupOptions: {
      input: { 'public-ticket': 'public-ticket.html' },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  preview: { port: 4175, strictPort: true },
});
