/**
 * The 3D placement of a map anchor (T087, ruling R-P4-8): metres above its level's floor and degrees of downward
 * tilt. The anchor stores them only when someone set them; otherwise the kind's default applies here, on every
 * client, and nothing is written back. No Lit, no three: the scene builder, the anchor panel and a node spec share
 * it.
 */
export const ANCHOR_3D_DEFAULTS = {
  camera: { mount_height_m: 2.5, tilt_deg: 10 },
  door_station: { mount_height_m: 1.4, tilt_deg: 0 },
  other: { mount_height_m: 1.2, tilt_deg: 0 },
} as const;

export type Anchor3dKind = keyof typeof ANCHOR_3D_DEFAULTS;

/** A camera; an entity on the doors layer (a lock, a door station, a gate) at hand height; every other entity. */
export function anchor3dKind(a: { resource_type: string; layer_id: string }): Anchor3dKind {
  if (a.resource_type === 'camera') return 'camera';
  return a.layer_id === 'doors' ? 'door_station' : 'other';
}

export function anchor3d(a: { resource_type: string; layer_id: string; mount_height_m?: number | null; tilt_deg?: number | null }): { mount_height_m: number; tilt_deg: number; defaulted: boolean } {
  const d = ANCHOR_3D_DEFAULTS[anchor3dKind(a)];
  const mount = typeof a.mount_height_m === 'number' && Number.isFinite(a.mount_height_m) ? a.mount_height_m : null;
  const tilt = typeof a.tilt_deg === 'number' && Number.isFinite(a.tilt_deg) ? a.tilt_deg : null;
  return { mount_height_m: mount ?? d.mount_height_m, tilt_deg: tilt ?? d.tilt_deg, defaulted: mount === null || tilt === null };
}
