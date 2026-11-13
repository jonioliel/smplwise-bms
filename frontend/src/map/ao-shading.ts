/**
 * PLAN3D-REALISM2-2433: the realistic level's two shader patches on the standard material (no extra pass, no extra draw):
 *
 * - S1 baked AO (`injectBakedAo`): every opaque library material samples the baked AO volume (ao-volume.ts) at its world
 *   position lifted VOL_BIAS_M along its normal - R (the up hemisphere) on up-facing surfaces, G over the flat-wall reference
 *   on the vertical ones - and darkens the indirect light by it (a share of the direct light too: the contact a cutaway
 *   render shows). One shared uniform set per view (`AoUniforms`): the placeholder volume (one open texel) or strength 0 draws
 *   exactly the material without the patch.
 * - S3 window glass (`injectGlassFresnel`): the cheap translucent glass gains a view-angle (Schlick-like) edge and keeps what
 *   the environment reflects: its alpha rises with the fresnel term and the reflected luminance, so the panes read as glass
 *   in the iso views on both rungs, without the transmission pass of MeshPhysicalMaterial.
 */
import { ClampToEdgeWrapping, Data3DTexture, LinearFilter, RGFormat, UnsignedByteType, Vector3, type MeshStandardMaterial } from './three-bundle';
import { VOL_BIAS_M, type AoVolume } from './ao-volume';

export interface AoUniforms {
  swAoVol: { value: Data3DTexture };
  swAoOrigin: { value: Vector3 };
  swAoSize: { value: Vector3 };
  swAoStrength: { value: number };
  swAoWallRef: { value: number };
  swAoDirect: { value: number };
}
/** The look of the bake on screen (tuned on the look-dev house, PLAN3D-REALISM2-2433 evidence). */
export const AO_LOOK = { strength: 1, direct: 0.7, power: 1.5 } as const;

function texture(data: Uint8Array, w: number, h: number, d: number): Data3DTexture {
  const t = new Data3DTexture(data, w, h, d);
  t.format = RGFormat;
  t.type = UnsignedByteType;
  t.minFilter = LinearFilter;
  t.magFilter = LinearFilter;
  t.wrapS = ClampToEdgeWrapping;
  t.wrapT = ClampToEdgeWrapping;
  t.wrapR = ClampToEdgeWrapping;
  t.unpackAlignment = 1;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

const placeholder = (): Data3DTexture => texture(new Uint8Array([255, 255]), 1, 1, 1);

export function createAoUniforms(): AoUniforms {
  return {
    swAoVol: { value: placeholder() },
    swAoOrigin: { value: new Vector3(0, 0, 0) },
    swAoSize: { value: new Vector3(1, 1, 1) },
    swAoStrength: { value: 0 },
    swAoWallRef: { value: 1 },
    swAoDirect: { value: AO_LOOK.direct },
  };
}

/** Put a baked volume on the uniforms (null: back to the placeholder, the patch then changes nothing). */
export function applyVolume(u: AoUniforms, v: AoVolume | null): void {
  u.swAoVol.value.dispose();
  if (!v) {
    u.swAoVol.value = placeholder();
    u.swAoStrength.value = 0;
    return;
  }
  const [nx, ny, nz] = v.plan.dims;
  u.swAoVol.value = texture(v.data, nx, ny, nz);
  u.swAoOrigin.value.set(...v.plan.origin);
  u.swAoSize.value.set(...v.plan.size);
  u.swAoWallRef.value = Math.max(0.05, v.wallRef);
  u.swAoStrength.value = AO_LOOK.strength;
}

export function disposeAoUniforms(u: AoUniforms): void {
  u.swAoVol.value.dispose();
}

const VERT_PARS = /* glsl */ `
varying vec3 vSwAoPos;
varying vec3 vSwAoN;`;
const VERT_MAIN = /* glsl */ `
	vec4 swAoW = vec4( transformed, 1.0 );
	vec3 swAoNo = objectNormal;
	#ifdef USE_INSTANCING
		swAoW = instanceMatrix * swAoW;
		swAoNo = mat3( instanceMatrix ) * swAoNo;
	#endif
	vSwAoPos = ( modelMatrix * swAoW ).xyz;
	vSwAoN = mat3( modelMatrix ) * swAoNo;`;
const FRAG_PARS = /* glsl */ `
uniform highp sampler3D swAoVol;
uniform vec3 swAoOrigin;
uniform vec3 swAoSize;
uniform float swAoStrength;
uniform float swAoWallRef;
uniform float swAoDirect;
varying vec3 vSwAoPos;
varying vec3 vSwAoN;
float swBakedAo() {
	if ( swAoStrength <= 0.0 ) return 1.0;
	float nl = length( vSwAoN );
	if ( !( nl > 1e-4 ) ) return 1.0; // a part without normals (a NaN here would spread through the bloom over the frame)
	vec3 n = vSwAoN / nl;
	vec3 q = ( vSwAoPos + n * ${VOL_BIAS_M.toFixed(3)} - swAoOrigin ) / swAoSize;
	if ( any( lessThan( q, vec3( 0.0 ) ) ) || any( greaterThan( q, vec3( 1.0 ) ) ) ) return 1.0;
	vec2 ao = texture( swAoVol, q ).rg;
	float side = clamp( ao.g / swAoWallRef, 0.0, 1.0 );
	float a = mix( side, ao.r, smoothstep( 0.35, 0.9, n.y ) );
	a = pow( a, ${AO_LOOK.power.toFixed(2)} ); // deepen the contact: the open (1) stays open
	return mix( 1.0, a, swAoStrength );
}`;
const FRAG_MAIN = /* glsl */ `
	{
		float swAo = swBakedAo();
		reflectedLight.indirectDiffuse *= swAo;
		reflectedLight.indirectSpecular *= mix( 1.0, swAo, 0.8 );
		reflectedLight.directDiffuse *= mix( 1.0, swAo, swAoDirect );
	}`;

/** Patch an opaque library material to read the baked AO volume (once per material; the program is shared by key). */
export function injectBakedAo(m: MeshStandardMaterial, u: AoUniforms): void {
  if (m.userData.swAo) return;
  m.userData.swAo = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (shader, renderer) => {
    prev.call(m, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VERT_PARS}`)
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>${VERT_MAIN}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_PARS}`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>${FRAG_MAIN}`);
  };
  const prevKey = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = () => `${prevKey()}|swao1`;
}

/** The glass look per style (alpha added at the grazing edge, and per unit of reflected luminance). */
export const GLASS_FRESNEL = { edge: 0.55, reflect: 0.9, max: 0.88, power: 4 } as const;

/** S3: the fresnel edge and the kept reflection on a translucent glass material. */
export function injectGlassFresnel(m: MeshStandardMaterial): void {
  if (m.userData.swGlass) return;
  m.userData.swGlass = true;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `{
		float swF = pow( 1.0 - saturate( dot( normal, geometryViewDir ) ), ${GLASS_FRESNEL.power.toFixed(1)} );
		float swR = dot( reflectedLight.indirectSpecular + reflectedLight.directSpecular, vec3( 0.2126, 0.7152, 0.0722 ) );
		diffuseColor.a = clamp( diffuseColor.a + swF * ${GLASS_FRESNEL.edge.toFixed(3)} + swR * ${GLASS_FRESNEL.reflect.toFixed(3)}, 0.0, ${GLASS_FRESNEL.max.toFixed(3)} );
	}
	#include <opaque_fragment>`,
    );
  };
  m.customProgramCacheKey = () => 'swglass1';
}
