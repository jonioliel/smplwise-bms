/**
 * NVRLESS-CAMERAS-2411 (owner decision 2א, 08.11): which catalogue cameras the screens show when the installation has no NVR.
 *
 * NN1 D5 keeps the camera rows of a removed NVR in the catalogue (history intact) but never draws them without an NVR. A camera
 * WITHOUT a recorder (pseudo-recorder `standalone`, CAMERA-STREAM-SOURCES-2410) does not depend on an NVR: its live video and
 * snapshots come from its own address, so it stays visible. Pure functions (no session import) so the unit specs can drive them.
 */

/** The pseudo-recorder of the cameras without a recorder (smplwise/services/camera_sources.py STANDALONE). */
export const STANDALONE_RECORDER = 'standalone';

/** A camera row (or a camera-card source) of the pseudo-recorder `standalone`. */
export const isStandaloneRow = (c: { standalone?: boolean; recorder_id?: string | null } | null | undefined): boolean =>
  !!c && (c.standalone === true || c.recorder_id === STANDALONE_RECORDER);

/** The cameras a screen may show: all of them with an NVR; without one, only the cameras without a recorder (D5). */
export function visibleCameras<T extends { standalone?: boolean; recorder_id?: string | null }>(cams: T[], hasNvr: boolean): T[] {
  return hasNvr ? cams : cams.filter(isStandaloneRow);
}

/** The recorder groups of a camera picker (`{recorder_id}` or `{id}`): without an NVR only the `standalone` group is left. */
export function visibleRecorderGroups<T extends { recorder_id?: string; id?: string }>(groups: T[], hasNvr: boolean): T[] {
  return hasNvr ? groups : groups.filter((g) => (g.recorder_id ?? g.id) === STANDALONE_RECORDER);
}

/** A camera card's NVR-kind source is drawn without an NVR only when it is a camera without a recorder (D5 otherwise). */
export const nvrSourceShown = (source: { kind: string; recorder_id?: string } | null | undefined, hasNvr: boolean): boolean =>
  !source || source.kind !== 'nvr' || hasNvr || source.recorder_id === STANDALONE_RECORDER;
