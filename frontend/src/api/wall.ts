/** CR-030 wall display API: the display's own reads (`wall/config`, `wall/states`) and the Settings administration (`wall/profiles`). */
import { api, apiUrl, del, get, patch, post, upload } from './client';
import type { WallPlanSetting } from '../map/wall-plan-mode';
import { tr } from '../i18n/msg/api-media';
import type * as Wire from './generated/wire-wall';

/* The wire shapes are the backend's response models (smplwise_vms/backend/smplwise/wire/wall.py), generated into ./generated/wire-wall.ts:
 * a field the server renames or drops is a compile error here (code review 07:F8 step 2). Kept by hand: WallConfig (the stored wall
 * configuration document, validated by services/wall.WallConfig on write; the wire passes it through). Narrowed on purpose: `config`,
 * `last_channel` (the two channels), `desktop` / `has_other_roles` / `foldable_open` / `critical_close_s` optional (an older server). */

type WallLayout = 'auto' | 'tablet-landscape' | 'tablet-portrait' | 'single';
type WallStatus = Wire.WallProfile['status'];

export interface WallWindow { days: number[]; from: string; to: string }
export interface WallConfig {
  cameras: string[];
  scope: 'floor' | 'cameras';
  layout: WallLayout;
  grid: 'auto' | { cols: number; rows: number };
  rotate_s: 0 | 15 | 30 | 60 | 120;
  stream: 'sub';
  strip: string[];
  state_entities: string[];
  show_map: boolean;
  /** CR-029 S5-B: how the map band draws the plan - live 3D or the baked stills, at which quality, after how long it idles
   * into the still. "follow" hands a dial to this browser's pin, then the installation (map/wall-plan-mode.ts). Absent in an
   * answer from before the block existed: read it as follow everywhere. */
  plan?: WallPlanSetting;
  theme: 'follow' | 'dark' | 'light';
  alerts: { enabled: boolean; categories: string[]; min_severity: string; ack_allowed: boolean; takeover_timeout_s: number; sound: boolean };
  frame: { enabled: boolean; folder: string | null; idle_min: number; interval_s: number; fit: string; clock: boolean; motion: string };
  burn_in: { shift: boolean; dim_after_min: number; dim_to: number; shuffle_h: number };
  schedule: { windows: WallWindow[]; wake_on_alert_severity: string; wake_on_touch: boolean };
  offline: { show_last_frame_s: number; then: 'clock' };
}

export type WallDisplayConfig = Omit<Wire.WallConfig, 'config'> & { config: WallConfig };

export type WallState = Wire.WallState;

export interface WallProfile extends Omit<Wire.WallProfile, 'config' | 'last_channel' | 'desktop' | 'has_other_roles'> {
  /** "מסך קיר גם במחשב" (WALL-FOLLOWUPS-2390): the wall display also takes over a desktop-class browser (no touch: a mini-PC behind a
   * wall monitor). A field of the profile, not of `config`, since WALL-ANSWERS-2400 (a rollback cannot reset the configuration). Absent = false. */
  desktop?: boolean;
  config: WallConfig;
  last_channel: 'local' | 'remote' | null;
  has_other_roles?: boolean;
}

export const getWallConfig = () => get<WallDisplayConfig>('wall/config');
export const getWallStates = (ids: string[]) => get<Wire.WallStates>(`wall/states?ids=${encodeURIComponent(ids.join(','))}`);
export const wallSocketUrl = (): string => {
  const u = new URL(apiUrl('wall/ws'));
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  return u.toString();
};

/** WALL-ANSWERS-2400: how an unfolded foldable is classified, installation-wide (device-class.ts `FoldableOpen`). */
export type WallFoldableOpen = Wire.WallSettings['foldable_open'];
export const listWallProfiles = () => get<Omit<Wire.WallProfiles, 'profiles' | 'foldable_open'> & { profiles: WallProfile[]; foldable_open?: WallFoldableOpen }>('wall/profiles');
export const patchWallSettings = (body: { foldable_open: WallFoldableOpen }) => patch<Wire.WallSettings>('wall/settings', body);
export const wallCandidates = () => get<Wire.WallCandidates>('wall/candidates');
export const createWallProfile = (body: { user_id: string; title: string; floor_id?: string | null; area_id?: string | null; cameras?: string[] }) => post<WallProfile>('wall/profiles', body);
export const patchWallProfile = (userId: string, body: { title?: string; area_id?: string | null; enabled?: boolean; remote_allowed?: boolean; desktop?: boolean; config?: Partial<Record<keyof WallConfig, unknown>> }) =>
  patch<WallProfile>(`wall/profiles/${encodeURIComponent(userId)}`, body);
export const removeWallProfile = (userId: string) => del(`wall/profiles/${encodeURIComponent(userId)}`);

/** The Hebrew label of a list status (the "מצב" column). */
export const WALL_STATUS_LABEL: Record<WallStatus, string> = { connected: tr('מחובר'), not_connected: tr('לא מחובר'), never: tr('טרם התחבר'), disabled: tr('מושבת') };

// ---- WDX: alert tiles and the picture frame
export type WallAlert = Wire.WallAlert;
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by CR-030 (wall alert tiles).
export const getWallAlerts = () => get<Wire.WallAlerts>('wall/alerts');
/** ANNOUNCEB-295: the voice announcement this wall display shows right now (text only), and how often to ask (0 = this display is not an announcement screen). */
export const getWallAnnouncement = () => get<Omit<Wire.WallAnnouncement, 'announcement' | 'critical_close_s'> & { announcement: import('../announce/screen-overlay').ScreenAnnouncement | null;
  /** ANNOUNCE-297: an emergency one cannot be closed on the display for this many seconds (absent on an older server) */ critical_close_s?: number }>('wall/announcement');
export const ackWallAlert = (id: string) => post<Wire.WallAcknowledged>(`wall/alerts/${encodeURIComponent(id)}/ack`);
export const getFrameList = () => get<Wire.WallPhotos>('wall/frame/list');
export const frameUrl = (id: string) => apiUrl(`wall/frame/${encodeURIComponent(id)}`);

/** A photo set in the listing (`used_by` is listing-only on the wire; the screens read it from the listing). */
export type PhotoSet = Required<Wire.WallPhotoSet>;
type PhotoSetsResponse = Omit<Wire.WallPhotoSets, 'sets'> & { sets: PhotoSet[] };
export const listPhotoSets = () => get<PhotoSetsResponse>('wall/photo-sets');
export const createPhotoSet = (name: string) => post<Wire.WallPhotoSet>('wall/photo-sets', { name });
export const deletePhotoSet = (id: string) => api<Wire.WallPhotoSetDeleted>(`wall/photo-sets/${encodeURIComponent(id)}`, { method: 'DELETE' });
export const listSetPhotos = (id: string) => get<Wire.WallPhotos>(`wall/photo-sets/${encodeURIComponent(id)}/photos`);
export const photoPreviewUrl = (set: string, photo: string) => apiUrl(`wall/photo-sets/${encodeURIComponent(set)}/photos/${encodeURIComponent(photo)}`);
export const deleteSetPhoto = (set: string, photo: string) => del(`wall/photo-sets/${encodeURIComponent(set)}/photos/${encodeURIComponent(photo)}`);
export const uploadSetPhoto = (set: string, file: File) => {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<Wire.WallPhotoUploaded>(`wall/photo-sets/${encodeURIComponent(set)}/upload`, form);
};
