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

/** NVRLESS-CAMERAS-2411 (owner, 08.11: "show, but a WebRTC server is required"): where the video (WebRTC) server is configured. */
export const WEBRTC_SETTINGS_HREF = '#/system/setup';
export const WEBRTC_SETTINGS_LABEL = 'להגדרות ← חיבורים';
/** The notice on the wall, the camera screen and the overview's cameras tile when no video server is configured. */
export const WEBRTC_REQUIRED_TEXT = 'כדי להציג וידאו נדרש שרת WebRTC. אפשר להגדיר אותו בהגדרות ← חיבורים.';
/** The same explanation where a camera without a recorder is added or a stream is tested (the server answers 409 webrtc_server_required). */
export const WEBRTC_REQUIRED_ADD_TEXT = 'כדי להוסיף מצלמה או לבדוק זרם נדרש שרת WebRTC. אפשר להגדיר אותו בהגדרות ← חיבורים.';
export const WEBRTC_REQUIRED_SHORT = 'נדרש שרת WebRTC';

/** Is the video server configured? `webrtc_server_configured` from the capability block, else (an older backend) `go2rtc`. */
export const webrtcServerReady = (c: { go2rtc: boolean; webrtc_server_configured?: boolean } | null | undefined): boolean =>
  !c || (typeof c.webrtc_server_configured === 'boolean' ? c.webrtc_server_configured : c.go2rtc);

/** What the add / test controls of a camera's manual source may do (the server refuses the same two without the video server). */
export function sourceControls(webrtc: boolean, o: { ready: boolean; testing: boolean }): { canAdd: boolean; canTest: boolean; note: string } {
  return webrtc ? { canAdd: true, canTest: o.ready && !o.testing, note: '' } : { canAdd: false, canTest: false, note: WEBRTC_REQUIRED_ADD_TEXT };
}

/** The camera layer of the floor map: with an NVR every camera anchor; without one only the anchors of cameras without a recorder
 * (owner answer "א", 08.11). `standaloneIds` = the ids of the cameras without a recorder this user may see. */
export function mapCameraAnchors<T extends { resource_type: string; resource_id?: string | null }>(anchors: T[], hasNvr: boolean, standaloneIds: ReadonlySet<string>): T[] {
  return hasNvr ? anchors : anchors.filter((a) => a.resource_type !== 'camera' || (!!a.resource_id && standaloneIds.has(a.resource_id)));
}

/** Does the floor map offer its camera layer at all? With an NVR, or without one when a camera without a recorder exists. */
export const mapCameraLayerShown = (hasNvr: boolean, camerasAvailable: boolean): boolean => hasNvr || camerasAvailable;
