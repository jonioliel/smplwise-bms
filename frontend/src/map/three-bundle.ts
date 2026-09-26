/**
 * The chunk boundary of the 3D view (T087, design 10.1): the only module under src/ that imports three. Vite's
 * manualChunks (vite.config.ts) puts everything under node_modules/three into the `three` chunk, and scene-three.ts
 * imports from here, so the library reaches the browser only through the dynamic import of sw-plan-3d - the 2D bundle
 * does not grow, and with `base: './'` the chunk URL stays relative (the Ingress rule).
 */
export * from 'three';
export { OrbitControls } from 'three/addons/controls/OrbitControls.js';
export { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
