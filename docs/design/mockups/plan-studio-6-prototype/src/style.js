/**
 * The two visual styles of Studio 6 (owner Q12: both, selectable) as NUMBERS, not adjectives - the look spec
 * (docs/design/studio6/LOOK_SPEC.md) is generated from this table. A style is: a material palette (one tint per
 * material id, applied on top of neutral detail textures), a light rig per time band, a post chain recipe, the
 * section-cut treatment, the ground / backdrop colours and the UI accent. Switching a style never rebuilds geometry.
 *
 * Palette rules (plan L2): warm whites / greige / oak / charcoal metal; at most one muted accent per room; chroma of any
 * material class below ~0.12 in OKLCH terms (the hexes below were picked under that rule).
 */
export const STYLES = {
  light: {
    id: 'light',
    name: 'אדריכלי בהיר',
    /** material id -> hex tint multiplied into the neutral detail texture (level 3) or used flat (levels 1-2) */
    palette: {
      plaster_white: 0xece6dc, plaster_exterior: 0xd3ccc0, plaster_ceiling: 0xf4f2ee, concrete: 0xb0ada6, tiles_white: 0xe2e1dc, tiles_grey: 0xb2b5b8,
      oak: 0xbf9a6a, carpet: 0xaea79c, fabric_grey: 0x8a93a0, fabric_accent: 0x667a8e, fabric_rug: 0xad9281, linen: 0xe9e4da, leather: 0x4e4236,
      wood_light: 0xd0b694, wood_dark: 0x6b5647, door_wood: 0xbb9e7c, metal_dark: 0x3c4046, metal_light: 0xbabdc1, asphalt: 0x6b6c6e, grass: 0x879c72,
      screen_off: 0x15181d, shutter: 0xd9dbdd, section_cap: 0x2f3237, section_edge: 0x2f3237, cone: 0x2767ed, presence: 0x2767ed, open_door: 0xe4463c, lock_ok: 0x2fa36b,
    },
    /** light rig: multipliers over the sun/sky recipe of sun.js (by elevation + weather) */
    rig: {
      exposureDay: 0.68, exposureNight: 0.9, sunScale: 1.3, skyScale: 1.0, envDay: 0.5, envNight: 0.22, hemiScale: 0.22, interiorFill: [0.55, 1.0],
      lampEmissiveDay: 1.6, lampEmissiveNight: 3.0, lampPoolDay: 0.5, lampPoolNight: 1.0, lampKelvinOffset: 0,
      moonScale: 0.5,
    },
    post: { bloomThresholdDay: 2.0, bloomThresholdNight: 1.6, bloomStrengthDay: 0.12, bloomStrengthNight: 0.38, bloomRadius: 0.35, aoRadius: 0.6, aoIntensity: 0.55, contactAlpha: 0.42, junctionAlpha: 0.5 },
    cut: { fraction: 0.6, edge: false, edgeWidth: 0, ghostWalls: 0 },
    ground: { disc: 0xd4d8dd, discNight: 0x1a2130, contact: 0.38, horizonFade: true },
    backdrop: { topDay: '#cfdff2', horizonDay: '#eef3f9', topNight: '#0d1a33', horizonNight: '#1a2b47', groundTint: 0.96 },
    ui: { accent: '#2767ed', labelBg: 'rgba(255,255,255,.86)', labelText: '#22314c', theme: 'light' },
  },
  dark: {
    id: 'dark',
    name: 'תאום דיגיטלי כהה',
    palette: {
      plaster_white: 0x4b5364, plaster_exterior: 0x343b4a, plaster_ceiling: 0x3e4554, concrete: 0x4b5059, tiles_white: 0x6c7178, tiles_grey: 0x4f555e,
      oak: 0x7a6650, carpet: 0x4d525b, fabric_grey: 0x5b6572, fabric_accent: 0x4c6a86, fabric_rug: 0x605b67, linen: 0x9a9da6, leather: 0x332b24,
      wood_light: 0x8a7560, wood_dark: 0x3f3530, door_wood: 0x6e5b47, metal_dark: 0x2a2e35, metal_light: 0x8d949c, asphalt: 0x33363b, grass: 0x3e5340,
      screen_off: 0x0b0d12, shutter: 0x7a8088, section_cap: 0x151b27, section_edge: 0x5fd3ff, cone: 0x38bdf8, presence: 0x38bdf8, open_door: 0xff6b62, lock_ok: 0x3ddc84,
    },
    rig: {
      exposureDay: 0.72, exposureNight: 0.8, sunScale: 0.55, skyScale: 0.32, envDay: 0.5, envNight: 0.2, hemiScale: 0.35, interiorFill: [0.45, 0.9],
      lampEmissiveDay: 2.6, lampEmissiveNight: 3.4, lampPoolDay: 1.0, lampPoolNight: 1.2, lampKelvinOffset: 0,
      moonScale: 0.8,
    },
    post: { bloomThresholdDay: 1.2, bloomThresholdNight: 1.0, bloomStrengthDay: 0.32, bloomStrengthNight: 0.5, bloomRadius: 0.45, aoRadius: 0.6, aoIntensity: 0.5, contactAlpha: 0.5, junctionAlpha: 0.55 },
    cut: { fraction: 0.6, edge: true, edgeWidth: 1, ghostWalls: 0 },
    ground: { disc: 0x11161f, discNight: 0x0b0f17, contact: 0.5, horizonFade: true },
    backdrop: { topDay: '#111a2b', horizonDay: '#1b2a44', topNight: '#070c17', horizonNight: '#111c33', groundTint: 0.5 },
    ui: { accent: '#38bdf8', labelBg: 'rgba(21,28,44,.86)', labelText: '#e6ebf5', theme: 'dark' },
  },
};

export const STYLE_IDS = Object.keys(STYLES);

/** The style a UI theme pairs with by default (owner Q11/Q12: the user can override in settings; stored per browser). */
export function defaultStyleFor(theme) { return theme === 'dark' ? STYLES.dark : STYLES.light; }

export function hexCss(h) { return `#${h.toString(16).padStart(6, '0')}`; }
