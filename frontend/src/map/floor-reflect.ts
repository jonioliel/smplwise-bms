/**
 * PLAN3D-LEVEL3-2435: floor reflections of the realistic rung - a screen-space reflection (SSR) limited to the reflective floors.
 *
 * How the floors are found: the floor materials (variant `floor`) whose finish reflects (FLOOR_REFLECT: the polished marble
 * and the luxury ceramic strongly, tiles and lacquered wood a little, concrete / carpet not at all) write their reflectivity
 * into the beauty pass's ALPHA while REFLECT_ON is 1: `1 - 0.25 * k`. Opaque materials draw without blending, so the code
 * reaches the post chain intact; the SSR pass reads it, puts the pixel's alpha back to 1 and, where the GTAO pass's normal
 * buffer says the surface faces up, marches the reflected ray through GTAO's depth buffer (SSR_STEPS steps, a 4-step
 * refinement) and mixes in the colour it hits. No extra scene render, no extra target: the depth and the normals are the
 * ones the GTAO pass already draws, so the pass exists on the realistic rung only (the lite rung has no GTAO and draws the
 * floors' environment reflection alone - the cost of a plain textured floor).
 *
 * REFLECT_ON is raised by the post chain around its own render only: a thumbnail, a still bake or a level-2 frame never
 * sees a floor with alpha below 1. Off by the `floor_reflections` dial (the pass is disabled, the materials keep alpha 1).
 */
import type { MeshStandardMaterial } from './three-bundle';
import { FINISH_CERAMIC, FINISH_MARBLE, FINISH_TRAVERTINE } from './floor-finish';

/** The floor's reflectivity (0..1) by material id; unlisted ids do not reflect. */
export const FLOOR_REFLECT: Readonly<Record<string, number>> = {
  [FINISH_MARBLE]: 1,
  [FINISH_CERAMIC]: 0.8,
  [FINISH_TRAVERTINE]: 0.3, // PLAN3D-R32-ANSWERS-2438: honed stone - a soft sheen, not a mirror
  tiles_white: 0.4,
  tiles_grey: 0.35,
  floor_sport: 0.3,
  oak: 0.22,
};
export const floorReflectivity = (id: string): number => FLOOR_REFLECT[id] ?? 0;

/** The alpha code of a reflectivity (and back): 1 = not a reflective floor. */
export const reflectAlpha = (k: number): number => 1 - 0.25 * Math.min(1, Math.max(0, k));
export const alphaReflect = (a: number): number => (a < 0.7 || a > 0.996 ? 0 : Math.min(1, (1 - a) * 4));

/** Raised to 1 by the post chain while it renders the beauty pass with the SSR pass on (module note). */
export const REFLECT_ON = { value: 0 };

/** Patch a floor material to write its reflectivity code (once per material; the program is shared by key). */
export function injectFloorReflect(m: MeshStandardMaterial, k: number): void {
  if (m.userData.swRefl !== undefined || !(k > 0)) return;
  m.userData.swRefl = k;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    shader.uniforms.swReflOn = REFLECT_ON;
    shader.uniforms.swReflA = { value: reflectAlpha(k) };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float swReflOn;\nuniform float swReflA;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif ( swReflOn > 0.5 ) gl_FragColor.a = swReflA;');
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|swrefl1`;
}

export const SSR_STEPS = 20;

/** The SSR pass's look by style: how much of the hit colour a fully reflective floor takes, how far a ray goes (m). */
export const SSR_LOOK = { light: { strength: 0.7, maxDist: 4.0 }, dark: { strength: 0.75, maxDist: 4.0 } } as const;

export const SSR_VERT = `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 ); }`;

export const SSR_FRAG = `
#define SW_STEPS ${SSR_STEPS}
uniform sampler2D tDiffuse;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform mat4 uProj;
uniform mat4 uInvProj;
uniform mat4 uCamWorld;
uniform float uStrength;
uniform float uMaxDist;
uniform float uThickness;
uniform vec2 uTexel;
varying vec2 vUv;

vec3 swViewPos( vec2 uv, float d ) {
  vec4 c = uInvProj * vec4( uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0 );
  return c.xyz / c.w;
}
vec2 swProject( vec3 q ) {
  vec4 c = uProj * vec4( q, 1.0 );
  return c.xy / c.w * 0.5 + 0.5;
}
float swIgn( vec2 p ) { return fract( 52.9829189 * fract( dot( p, vec2( 0.06711056, 0.00583715 ) ) ) ); }

void main() {
  vec4 col = texture2D( tDiffuse, vUv );
  float a = col.a;
  if ( a < 0.7 || a > 0.996 ) { gl_FragColor = col; return; }
  col.a = 1.0;
  float k = clamp( ( 1.0 - a ) * 4.0, 0.0, 1.0 );
  float d = texture2D( tDepth, vUv ).x;
  vec3 n = normalize( texture2D( tNormal, vUv ).xyz * 2.0 - 1.0 );
  vec3 nw = normalize( mat3( uCamWorld ) * n );
  if ( d >= 1.0 || nw.y < 0.85 ) { gl_FragColor = col; return; }
  vec3 P = swViewPos( vUv, d );
  vec3 V = uProj[ 3 ][ 3 ] > 0.5 ? vec3( 0.0, 0.0, - 1.0 ) : normalize( P );
  vec3 R = normalize( reflect( V, n ) );
  float stepLen = uMaxDist / float( SW_STEPS );
  float t = stepLen * ( 0.25 + 0.75 * swIgn( gl_FragCoord.xy ) );
  float prevT = 0.0;
  vec2 huv = vec2( 0.0 );
  float hit = 0.0;
  for ( int i = 0; i < SW_STEPS; i ++ ) {
    vec3 Q = P + R * t;
    vec2 uv = swProject( Q );
    if ( uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0 ) break;
    float sd = texture2D( tDepth, uv ).x;
    if ( sd < 1.0 ) {
      float dz = swViewPos( uv, sd ).z - Q.z;
      if ( dz > 0.0 && dz < uThickness ) {
        float lo = prevT;
        float hi = t;
        for ( int j = 0; j < 4; j ++ ) {
          float mid = 0.5 * ( lo + hi );
          vec3 M = P + R * mid;
          vec2 muv = swProject( M );
          if ( swViewPos( muv, texture2D( tDepth, muv ).x ).z - M.z > 0.0 ) { hi = mid; uv = muv; } else lo = mid;
        }
        huv = uv;
        hit = 1.0;
        t = hi;
        break;
      }
    }
    prevT = t;
    t += stepLen;
  }
  if ( hit > 0.0 ) {
    vec2 e = smoothstep( 0.0, 0.06, huv ) * ( 1.0 - smoothstep( 0.94, 1.0, huv ) );
    float fade = e.x * e.y * ( 1.0 - smoothstep( 0.45 * uMaxDist, uMaxDist, t ) );
    float cosv = clamp( dot( - V, n ), 0.0, 1.0 );
    float fres = mix( 0.4, 1.0, pow( 1.0 - cosv, 3.0 ) );
    // three taps across the hit soften the jittered march's stipple (a polished, not a mirror, finish)
    vec2 px = uTexel * 1.5;
    vec3 rc = ( texture2D( tDiffuse, huv ).rgb * 2.0 + texture2D( tDiffuse, huv + vec2( px.x, 0.0 ) ).rgb + texture2D( tDiffuse, huv - vec2( 0.0, px.y ) ).rgb ) * 0.25;
    col.rgb = mix( col.rgb, rc, clamp( k * uStrength * fade * fres, 0.0, 1.0 ) );
  }
  gl_FragColor = col;
}`;
