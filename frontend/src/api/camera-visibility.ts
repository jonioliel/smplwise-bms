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

/** EVIDENCE-CAMERAS-2412: the hint of the "this area needs an NVR" panel (a direct URL to a recorder-only area). With a camera without
 * a recorder the live screens and the cameras ARE available, so the panel must not say they are not (the 2.41.1 text did). */
export const NVR_LESS_HINT = 'ההתקנה פועלת במצב ללא NVR: לייב, מצלמות, אירועים, הקלטות, תיקים וייצוא אינם זמינים; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.';
export const NVR_LESS_HINT_WITH_CAMERAS = 'ההתקנה פועלת במצב ללא NVR: הקלטות, ניגון, תיקים וייצוא אינם זמינים. מצלמות ללא מקליט מוצגות בלייב; המפה, חשמל והתקנים ו־WisKey עובדים כרגיל.';
export const nvrLessHint = (camerasAvailable: boolean): string => (camerasAvailable ? NVR_LESS_HINT_WITH_CAMERAS : NVR_LESS_HINT);

/** EVIDENCE-CAMERAS-2412: the floor map card and the plan editor said "NVR · ch N" / "שם ב־NVR" / "צילום מה־NVR" for a camera without a
 * recorder too. These are the words for such a camera; an NVR camera keeps its existing words (callers branch on isStandaloneRow). */
export const STANDALONE_LABEL = 'מצלמה ללא מקליט';
const STATUS_HE: Record<string, string> = { online: 'מחוברת', offline: 'מנותקת' };
/** A camera's status in words (the plan editor's camera list printed the raw `offline` / `unknown`). */
export const cameraStatusText = (status: string | null | undefined): string => STATUS_HE[status ?? ''] ?? 'מצב לא ידוע';
/** The plan editor's camera list: the line under the name. */
export const editorCameraMeta = (c: { standalone?: boolean; recorder_id?: string | null; channel: number; status: string }): string =>
  isStandaloneRow(c) ? `${STANDALONE_LABEL} · ${cameraStatusText(c.status)}` : `ch ${c.channel} · ${c.status}`;
/** The plan editor's camera inspector: the "source" value. */
export const editorCameraSource = (c: { standalone?: boolean; recorder_id?: string | null; channel: number }): string =>
  isStandaloneRow(c) ? STANDALONE_LABEL : `NVR · ch ${c.channel}`;
/** The floor map card's note under a camera without a recorder (its picture comes from the camera, not from an NVR). */
export const standaloneMapNote = (state: 'offline' | 'still'): string =>
  state === 'offline' ? 'המצלמה אינה עונה בכתובת הווידאו שלה.' : 'תמונה: צילום מהמצלמה (מתרענן).';
/** The floor map card's picture area of an offline camera without a recorder (the NVR camera's says "not connected to the NVR"). */
export const STANDALONE_OFFLINE_TILE = 'המצלמה אינה עונה בכתובת הווידאו שלה';

/** EVIDENCE-CAMERAS-2412: what the camera screen draws in place of the video. Without the WebRTC server the notice wins over a stored
 * "offline" status too: such a status is left over from before the server was removed (nothing can check the camera without it), and
 * the 2.41.1 screen said "the camera does not answer" instead of the owner's "a WebRTC server is required" (answer Q1). */
export type CameraPane = 'still' | 'webrtc_required' | 'player' | 'off';
export function cameraPane(c: { can_view_live?: boolean; status?: string | null; live_kind?: string | null }, webrtc: boolean): CameraPane {
  const allowed = c.can_view_live !== false;
  const canView = allowed && c.status !== 'offline';
  if (canView && c.live_kind === 'still') return 'still';
  if (allowed && !webrtc && c.live_kind !== 'still') return 'webrtc_required';
  return canView ? 'player' : 'off';
}
