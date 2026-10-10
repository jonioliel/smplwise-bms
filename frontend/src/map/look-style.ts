/**
 * Plan Studio 6, slice S1 (LOOK_SPEC sections 1-5, round 2): the two visual styles of the realistic level as numbers -
 * `light` (architectural render) and `dark` (digital twin). The material palette is the library's (materials.json
 * `tint.light` / `tint.dark`); this table holds the rest: the light rig multipliers, the post chain, the section cut, the
 * glass, the ground, the backdrop, the horizon, the CSS grade and the state colours. A style switch re-tints and re-lights;
 * it never rebuilds geometry. Pure data plus the choice rule (`auto` follows the UI theme: light -> light, dark -> dark).
 */
export type StyleId = 'light' | 'dark';

export interface LookStyle {
  id: StyleId;
  he: string;
  rig: {
    exposureDay: number;
    exposureNight: number;
    sunScale: number;
    skyScale: number;
    envDay: number;
    envNight: number;
    hemiScale: number;
    interiorFill: [number, number];
    shadowRadius: number;
    rim: { color: number; intensity: number } | null;
    floorSheen: number;
    fog: { color: string; density: number };
    lampEmissiveDay: number;
    lampEmissiveNight: number;
    lampPoolDay: number;
    lampPoolNight: number;
    moonScale: number;
  };
  post: { bloomThresholdDay: number; bloomThresholdNight: number; bloomStrengthDay: number; bloomStrengthNight: number; bloomRadius: number; aoRadius: number; aoBlend: number; blobAlpha: number; junctionAlpha: number };
  grade: { vignette: number; vignetteColor: string; contrast: number; saturation: number };
  cut: { fraction: number; cap: number; edge: number | null; edgeWidth: number };
  glass: { tint: number; opacity: number; env: number };
  ground: { disc: number; discNight: number; contact: number };
  backdrop: { topDay: string; horizonDay: string; topNight: string; horizonNight: string; groundTint: number };
  horizon: { color: number; radius: number; height: number };
  states: { open_door: number; presence: number; cone: number; lock_ok: number };
}

export const LOOK_STYLES: Readonly<Record<StyleId, LookStyle>> = {
  light: {
    id: 'light',
    he: 'אדריכלי בהיר',
    rig: {
      exposureDay: 0.62, exposureNight: 0.9, sunScale: 1.3, skyScale: 1.0, envDay: 0.5, envNight: 0.22, hemiScale: 0.26, interiorFill: [0.55, 1.0],
      shadowRadius: 8, rim: null, floorSheen: 1.0, fog: { color: '#dfe6ee', density: 0.028 },
      lampEmissiveDay: 1.6, lampEmissiveNight: 3.0, lampPoolDay: 0.5, lampPoolNight: 1.0, moonScale: 0.5,
    },
    post: { bloomThresholdDay: 2.0, bloomThresholdNight: 1.6, bloomStrengthDay: 0.12, bloomStrengthNight: 0.38, bloomRadius: 0.35, aoRadius: 0.6, aoBlend: 0.55, blobAlpha: 0.46, junctionAlpha: 0.62 },
    grade: { vignette: 0.32, vignetteColor: 'rgba(20,24,32,.42)', contrast: 1.06, saturation: 1.05 },
    cut: { fraction: 0.6, cap: 0x3a3e46, edge: null, edgeWidth: 0 },
    glass: { tint: 0xcfe0ea, opacity: 0.22, env: 1.6 },
    ground: { disc: 0xd4d8dd, discNight: 0x1a2130, contact: 0.38 },
    backdrop: { topDay: '#cfdff2', horizonDay: '#eef3f9', topNight: '#0d1a33', horizonNight: '#1a2b47', groundTint: 0.96 },
    horizon: { color: 0x9aa897, radius: 55, height: 7 },
    states: { open_door: 0xe4463c, presence: 0x2767ed, cone: 0x2767ed, lock_ok: 0x2fa36b },
  },
  dark: {
    id: 'dark',
    he: 'תאום דיגיטלי כהה',
    rig: {
      exposureDay: 0.72, exposureNight: 0.8, sunScale: 0.55, skyScale: 0.32, envDay: 0.5, envNight: 0.2, hemiScale: 0.35, interiorFill: [0.45, 0.9],
      shadowRadius: 8, rim: { color: 0x7cc8ff, intensity: 0.55 }, floorSheen: 0.72, fog: { color: '#0a1322', density: 0.045 },
      lampEmissiveDay: 2.6, lampEmissiveNight: 3.4, lampPoolDay: 1.0, lampPoolNight: 1.2, moonScale: 0.8,
    },
    post: { bloomThresholdDay: 1.2, bloomThresholdNight: 1.0, bloomStrengthDay: 0.32, bloomStrengthNight: 0.5, bloomRadius: 0.45, aoRadius: 0.6, aoBlend: 0.5, blobAlpha: 0.52, junctionAlpha: 0.62 },
    grade: { vignette: 0.4, vignetteColor: 'rgba(0,0,0,.6)', contrast: 1.08, saturation: 1.0 },
    cut: { fraction: 0.6, cap: 0x151b27, edge: 0x5fd3ff, edgeWidth: 1.5 },
    glass: { tint: 0x9fc4de, opacity: 0.2, env: 1.8 },
    ground: { disc: 0x11161f, discNight: 0x0b0f17, contact: 0.5 },
    backdrop: { topDay: '#111a2b', horizonDay: '#1b2a44', topNight: '#070c17', horizonNight: '#111c33', groundTint: 0.5 },
    horizon: { color: 0x121a24, radius: 55, height: 7 },
    states: { open_door: 0xff6b62, presence: 0x38bdf8, cone: 0x38bdf8, lock_ok: 0x3ddc84 },
  },
};

/** The style a view draws: the person's dial (`auto` follows the UI theme). */
export function styleFor(dial: 'auto' | StyleId, theme: 'light' | 'dark'): StyleId {
  return dial === 'auto' ? theme : dial;
}

/** Bloom numbers for a night factor 0..1 (LOOK_SPEC section 4). */
export function bloomFor(style: LookStyle, night: number): { threshold: number; strength: number; radius: number } {
  const n = Math.max(0, Math.min(1, night));
  return { threshold: style.post.bloomThresholdDay + (style.post.bloomThresholdNight - style.post.bloomThresholdDay) * n, strength: style.post.bloomStrengthDay + (style.post.bloomStrengthNight - style.post.bloomStrengthDay) * n, radius: style.post.bloomRadius };
}

/** A room's daylight factor (LOOK_SPEC section 3): glazed area / floor area x 5, clamped 0..1. */
export const daylightFactor = (glazedM2: number, floorM2: number): number => Math.max(0, Math.min(1, (glazedM2 / Math.max(1, floorM2)) * 5));
