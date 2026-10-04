// Shapes returned by the add-on backend (smplwise_vms/backend). Keep in step with the routers.

export interface Me {
  user: { id: string; username: string; display_name: string; source: 'ingress' | 'dev' | 'remote' };
  /** CR-008: the entry channel - `remote` through SmplWise Arx (`/arx/`), `local` through Ingress (or a developer backend). */
  channel?: 'remote' | 'local';
  /** CR-008: the remote.* settings the Arx client needs; null outside the remote channel. */
  remote?: Record<string, string | number> | null;
  bindings: { id: string; role_id: string; role_name: string; scope_type: string; scope_id: string; scope_name: string; effect: string }[];
  permissions_installation: string[];
  /** Held at any scope (union of the allow bindings, minus installation-wide denies): what the shell may show. */
  permissions_any?: string[];
  has_access: boolean;
  permission_revision: number;
  /** T055: false once Home Assistant disabled the user (every request is refused from then on). */
  active?: boolean;
  /** T055: hash of everything this user's access depends on; moves exactly when their permissions may have changed. */
  permissions_fingerprint?: string;
  /** T055: /me?known=<fingerprint> - whether it moved since. */
  permissions_changed?: boolean;
  bootstrap_state: string;
  /** NVR-less mode (owner request 2026-09-29): `ha_only` when the add-on options name no NVR host - the shell hides the
   * NVR areas for everyone. Absent on an older backend (= full). */
  mode?: 'full' | 'ha_only';
  /** CR-022 section 8: a saved / removed NVR connection waits for a restart. Present only for holders of system.configure. */
  connection_pending_restart?: boolean;
  /** NN1: what this installation has (NVR, media server, Home Assistant ...), derived by the server; the shell hides what cannot work.
   * Booleans for everyone; `recorders` only for whoever may read the NVR configuration (CR-022). */
  capabilities?: import('./capabilities').Capabilities;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  timezone: string;
  sort_order: number;
  updated_at: string;
  /** R1 (0.1.67): a photo of the site, served by the API (null without one). */
  image_url?: string | null;
  buildings?: Building[];
}

export interface Building {
  id: string;
  site_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
  image_url?: string | null;
  floors?: Floor[];
}

export interface Floor {
  id: string;
  building_id: string;
  name: string;
  level: number;
  sort_order: number;
  ha_area_id: string | null;
  has_plan: boolean;
  published_version_id: string | null;
  plan_width_px: number | null;
  plan_height_px: number | null;
  draft_version_id: string | null;
  anchor_count: number;
  camera_count: number;
  /** CR-009: the anchors / cameras of rooms other floors share with this one (their home floor counts them). */
  shared_anchor_count?: number;
  shared_camera_count?: number;
  updated_at: string;
}

export interface SitesResponse {
  sites: Site[];
  can_create_site: boolean;
}

export interface PlanAsset {
  /** pdf / dxf / image, from the server's content sniffing (T065). */
  kind?: 'pdf' | 'dxf' | 'image';
  id: string;
  floor_id: string;
  original_name: string;
  mime: string;
  sha256: string;
  bytes: number;
  page_count: number;
  created_at: string;
  pages: { page: number; preview_url: string }[];
}

export interface PlanVersion {
  id: string;
  floor_id: string;
  asset_id: string;
  page: number;
  rotation: number;
  crop: { x: number; y: number; w: number; h: number } | null;
  width_px: number;
  height_px: number;
  scale_m_per_px: number | null;
  /** Calibration record (Plan Studio): two-point pairs, or a door-width estimate (status "estimated", phase 3). */
  calibration?: { method: string; status?: 'measured' | 'estimated'; pairs: { a: [number, number]; b: [number, number]; metres: number }[]; residual_pct: number | null; reason?: string | null } | null;
  status: 'draft' | 'published' | 'archived';
  revision: number;
  notes: string;
  created_at: string;
  published_at: string | null;
  archived_at?: string | null;
  created_by?: string | null;
  published_by?: string | null;
  /** Active anchors placed on this version (version history, T038). */
  anchors_on?: number;
  image_url: string;
  /** 'stylized' serves the SMPLWISE-language rendering as the map background (the source stays). */
  render_mode?: 'source' | 'stylized';
  stylized_url?: string | null;
  source_url?: string;
}

/** Plan Studio (T084): the structure document the map bundle points to - fetched separately and cached by hash. */
export interface GeometryRef {
  id: string | null;
  doc_hash: string;
  status: 'new' | 'draft' | 'published' | 'archived';
  revision: number;
  published_at: string | null;
  /** CR-009: the document's hash plus what the shared rooms attach on read - the client's cache key when present. */
  view_hash?: string;
}

export interface Camera {
  id: string;
  recorder_id: string;
  channel: number;
  name: string;
  name_source: string;
  alias: string | null;
  enabled: boolean;
  sort_order: number;
  /** T091: how many grid columns wide this camera's tile is on the all-cameras grid (1-4, default 1). */
  grid_col_span: number;
  /** Wall arrangement: "לא להציג" - left out of the all-cameras wall and the kiosk pages derived from it (absent = shown). */
  wall_hidden?: boolean;
  main_track: number | null;
  sub_track: number | null;
  status: 'online' | 'offline' | 'unknown';
  last_seen_at: string | null;
  stream?: { codec?: string; resolution?: string; fps?: number; bitrate_kbps?: number } | null;
  /** CR-008 D7: the main / sub stream encodings the discovery read from the NVR, with the WebRTC verdict of each. */
  encoding?: CameraEncoding | null;
  can_view_live?: boolean;
}

/** One stream's encoding as the NVR reports it (services/stream_codecs.py); `webrtc` = can a browser decode it there. */
export interface StreamEncoding {
  codec: string | null;
  profile?: string | null;
  b_frames?: boolean | null;
  svc?: boolean | null;
  smart_codec?: boolean | null;
  /** frames between key frames (ISAPI GovLength) */
  gov_length?: number | null;
  resolution?: string | null;
  fps?: number | null;
  source?: 'isapi' | 'track';
  webrtc: 'ok' | 'no' | 'unknown';
  /** h265 | mjpeg | b_frames | svc | h264 | h264_no_b_frames | b_frames_not_reported | codec_unknown | codec_other */
  reason: string;
}

export interface CameraEncoding {
  main: StreamEncoding | null;
  sub: StreamEncoding | null;
  checked_at: string;
  error: string | null;
  /** only on /cameras/{id}/capabilities: the Hebrew settings hint when the main stream will not play over WebRTC */
  hint?: string | null;
}

export interface Anchor {
  id: string;
  floor_id: string;
  plan_version_id: string;
  resource_type: 'camera' | 'ha_entity';
  resource_id: string;
  position: { x: number; y: number };
  rotation_degrees: number;
  field_of_view_degrees: number | null;
  /** Manual coverage (R2): cone radius as a fraction of the plan width; null = the default illustration. */
  coverage_radius?: number | null;
  /** Manual coverage (R2): a free polygon [[x, y], ...] normalized to the plan; null = the cone. */
  coverage_polygon?: [number, number][] | null;
  /** R4: where the name label sits - auto | top | bottom | left | right. */
  label_pos?: string | null;
  /** Plan Studio level of the floor (null = the default level). */
  level_id?: string | null;
  /** T087: metres above the level's floor and the downward tilt in degrees; null = the kind's default (map/anchor-3d.ts). */
  mount_height_m?: number | null;
  tilt_deg?: number | null;
  layer_id: string;
  label: string | null;
  revision: number;
  effective_from: string;
  effective_to: string | null;
  updated_at: string;
  camera?: Camera | null;
  /** Synced Home Assistant entity for ha_entity anchors (actions present only with ha.entity.control on the floor). */
  entity?: import('./ha').HaEntity | null;
  /** CR-009: an anchor of a room another floor shares with this one - its real id, its home floor, and its position in
   * this plan's coordinates; edits go through ?from_floor_id. */
  shared?: import('../map/shared-space').SharedAnchorMark;
  /** CR-009: this floor's anchor lies in a shared room but is not a member - shown here only; the editor may add it. */
  room_candidate?: string;
  /** CR-009: this floor's anchor is a member of the shared room (zone id): shown on every floor of it. */
  shared_member?: string;
}

export interface ZonePoint {
  x: number;
  y: number;
}

/** Named room / area polygon on a floor (normalized plan coordinates, origin top-left). */
export interface SpatialZone {
  id: string;
  floor_id: string;
  plan_version_id: string | null;
  name: string;
  kind: 'room' | 'zone' | 'corridor' | 'outdoor' | 'service';
  polygon: ZonePoint[];
  color: string;
  source: 'auto' | 'manual';
  searchable: boolean;
  /** R4: where the name label sits - auto | top | bottom | left | right. */
  label_pos?: string;
  level_id?: string | null;
  ceiling_height_m?: number | null;
  /** Free-text tags (T085), as walls and objects of the structure document carry them; [] when none. */
  tags?: string[];
  revision: number;
  created_at: string;
  updated_at: string;
  /** CR-009: a room shown on more than one floor - "mirror" (another floor's room, polygon in this plan's coordinates)
   * or "home" (this floor's room that other floors show). */
  shared?: import('../map/shared-space').SharedZoneMark;
}

/** The switch of a lighting circuit as the live map needs it (T085): its state, and the turn on / off actions when the
 * caller may control entities on the floor. */
export interface CircuitState {
  entity_id: string;
  name: string | null;
  color_token: string | null;
  member_ids: string[];
  power_w: number | null;
  state: string | null;
  known: boolean;
  fresh: boolean;
  available: boolean;
  can_control: boolean;
  actions: import('./ha').HaActionSpec[];
}

export interface FloorMap {
  floor: Floor;
  building: Building;
  site: Site;
  plan: PlanVersion | null;
  /** Reference to the structure document of the shown version: the draft (else the published one) for an editor bundle,
   * the row in force at the instant for an exact-history bundle, else the published one; null when none. */
  geometry?: GeometryRef | null;
  /** T085: the library revision the map needs, the levels of the referenced document and the circuit switch states. */
  catalog_revision?: string;
  levels?: import('../map/geometry').GeomLevel[];
  circuit_states?: Record<string, CircuitState>;
  anchors: Anchor[];
  zones?: SpatialZone[];
  needs_alignment: boolean;
  /** Set when the bundle was requested at an instant (historical map, T038). */
  at?: string | null;
  history?: 'exact' | 'current' | null;
  history_from?: string | null;
  /** Coverage of the local HA state history (present in a historical bundle). */
  ha_history?: { from: string | null; to: string | null; rows: number; retention_days: number; forward_fill_max_s: number } | null;
  permissions: { edit: boolean; publish: boolean; import: boolean; structure: boolean };
  cameras: Camera[];
}
