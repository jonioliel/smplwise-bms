/**
 * The chunk boundary of the realistic level's post chain (CR-029 S1, ST7 build plan 5.2): the only module that imports
 * three's post-processing addons. vite.config.ts puts `three/examples/jsm/{postprocessing,shaders,math}` into the lazy
 * `three-post` chunk, and post-chain.ts reaches this module only through a dynamic import, so the composer, GTAO, bloom,
 * SMAA and the output pass never enter the `three` chunk (<= 200 KB gzip, unit-three-chunk.spec.ts) nor load for levels 1-2.
 */
export { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
export { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
export { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
export { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
export { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
export { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
