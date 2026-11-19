// Shapes returned by the add-on backend (smplwise_vms/backend). Keep in step with the routers.

export interface Me {
  /** CR-LOGOS295: the company logo / name, logo size, dark-background mode and the browser-tab title parts (design/brand-logo.ts). */
  brand?: import('../design/brand-logo').BrandView;
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
  /** CR-030: presence of an enabled wall profile; `desktop` (WALL-FOLLOWUPS-2390): the wall display also takes over a desktop-class browser;
   * `foldable_open` (WALL-ANSWERS-2400): an unfolded foldable counts as a tablet (default) or a phone. Absent in an older answer: false / tablet. */
  /** HOME-SIMPLE-2420: which interface opens (home / full), the switch, home-only and the wall-panel lock (absent on an older add-on). */
  interface?: import('../home/home-api').InterfacePolicy | null;
  wall?: { enabled: boolean; profile_version: number; desktop?: boolean; foldable_open?: 'tablet' | 'phone' } | null;
  bootstrap_state: string;
  /** NVR-less mode (owner request 2026-09-29): `ha_only` when the add-on options name no NVR host - the shell hides the
   * NVR areas for everyone. Absent on an older backend (= full). */
  mode?: 'full' | 'ha_only';
  /** CR-022 section 8: a saved / removed NVR connection waits for a restart. Present only for holders of system.configure. */
  connection_pending_restart?: boolean;
  /** NN1: what this installation has (NVR, media server, Home Assistant ...), derived by the server; the shell hides what cannot work.
   * Booleans for everyone; `recorders` only for whoever may read the NVR configuration (CR-022). */
  capabilities?: import('./capabilities').Capabilities;
  /** CR-027: what the required-sensors policy says about this caller on this channel; present once a policy was ever written,
   * null when it applies to nobody. `blocked` is what the shell acts on (the server refuses every other request too). */
  presence_gate?: import('./presence').PresenceGate | null;
  /** CR-038 section 6: the optional modules the shell offers - the tickets module's switch (permissions decide the rest) and its
   * display name per language (owner decision D33: every text that names the module is rendered through tickets/naming.ts). Absent on
   * an older backend (= off). */
  /** CR-READY96: the last RECORDED readiness score (system.configure holders only; null until the first check) and the demo-mode state every signed-in user is told. */
  readiness?: { score: number; level: 'building' | 'almost' | 'ready'; at: string } | null;
  demo?: import('./readiness').DemoState;
  modules?: { tickets: boolean; notices?: boolean /* CR-NOTICE106 */; tickets_name?: Partial<Record<import('../tickets/naming').TicketLang, import('../tickets/naming').TicketName>>; tickets_long_press?: 'sheet' | 'menu' /* D17 (slice 3) */; incidents?: boolean /* CR-LIVEEVENT100: the live event mode switch (OFF by default) */; announce?: boolean /* FIX2200: announce.enabled - the הכרזות tab */ };
}

/* Site / building / floor are the backend's response models (smplwise_vms/backend/smplwise/wire/catalog.py, generated into
 * ./generated/wire-catalog.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2). Optional on
 * purpose: the picture, the shared flags and counts (the demo tree has none of them) and the tree children (absent with `?tree=false`). */
type WireSite = import('./generated/wire-catalog').CatalogSite;
type WireBuilding = import('./generated/wire-catalog').CatalogBuilding;
type WireFloor = import('./generated/wire-catalog').CatalogFloor;

export interface Site extends Pick<WireSite, 'id' | 'name' | 'address' | 'timezone' | 'sort_order' | 'updated_at'>, Partial<Pick<WireSite, 'image_url'>> {
  buildings?: Building[];
}

export interface Building extends Pick<WireBuilding, 'id' | 'site_id' | 'name' | 'sort_order' | 'updated_at'>, Partial<Pick<WireBuilding, 'image_url' | 'is_shared'>> {
  /** MULTIBUILDING-HOME-2330: `is_shared` = the site's shared building ("משותף": parking, main electrical room, garden) - listed last on
   * the home screen with its own icon and colour, unchecked by default in "כבה הכל באתר". */
  floors?: Floor[];
}

/** CR-009: `shared_anchor_count` / `shared_camera_count` = the anchors / cameras of rooms other floors share with this one. */
export type Floor = Omit<WireFloor, 'shared_anchor_count' | 'shared_camera_count'> & Partial<Pick<WireFloor, 'shared_anchor_count' | 'shared_camera_count'>>;

export type SitesResponse = Omit<import('./generated/wire-catalog').CatalogSites, 'sites'> & { sites: Site[] };

/* The plan asset and version fields are the backend's response models (smplwise_vms/backend/smplwise/wire/plans.py, generated into
 * ./generated/wire-plans.ts; code review 07:F8 step 2): a field the server renames or drops is a compile error here. Fields the demo
 * plans and older bundles leave out stay optional; `crop` / `calibration` (stored documents) keep their hand-written shapes. */
type PlanAssetWire = import('./generated/wire-plans').PlanAsset;
type PlanVersionWire = import('./generated/wire-plans').PlanVersionListed;
export interface PlanAsset extends Pick<PlanAssetWire, 'id' | 'floor_id' | 'original_name' | 'mime' | 'sha256' | 'bytes' | 'page_count' | 'created_at' | 'pages'>, Partial<Pick<PlanAssetWire, 'kind'>> {}

export interface PlanVersion
  extends Pick<PlanVersionWire, 'id' | 'floor_id' | 'asset_id' | 'page' | 'rotation' | 'width_px' | 'height_px' | 'scale_m_per_px' | 'status' | 'revision' | 'notes' | 'created_at' | 'published_at' | 'image_url'>,
    Partial<Pick<PlanVersionWire, 'archived_at' | 'created_by' | 'published_by' | 'anchors_on' | 'render_mode' | 'stylized_url' | 'source_url'>> {
  crop: { x: number; y: number; w: number; h: number } | null;
  /** Calibration record (Plan Studio): two-point pairs, or a door-width estimate (status "estimated", phase 3). */
  calibration?: { method: string; status?: 'measured' | 'estimated'; pairs: { a: [number, number]; b: [number, number]; metres: number }[]; residual_pct: number | null; reason?: string | null } | null;
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

/* The camera fields are the backend's response model (smplwise_vms/backend/smplwise/wire/cameras.py `CameraRow` / `CameraListed`,
 * generated into ./generated/wire-cameras.ts): a field the server renames or drops is a compile error here (code review 07:F8 step 2).
 * Narrowed on purpose: `status` (the registry's three states), `stream` / `encoding` (stored documents the server passes through), and
 * the list-only fields stay optional (a row from PATCH / POST and the demo cameras have none of them). Client-only: `still_refresh_s`. */
type CameraWire = import('./generated/wire-cameras').CameraListed;
export interface Camera
  extends Pick<CameraWire, 'id' | 'recorder_id' | 'channel' | 'name' | 'name_source' | 'alias' | 'enabled' | 'sort_order' | 'grid_col_span' | 'main_track' | 'sub_track' | 'last_seen_at'>,
    Partial<Pick<CameraWire, 'wall_hidden' | 'can_view_live' | 'recorder_name' | 'recorder_enabled' | 'live_kind' | 'video_source' | 'standalone' | 'area_id'>> {
  status: 'online' | 'offline' | 'unknown';
  stream?: { codec?: string; resolution?: string; fps?: number; bitrate_kbps?: number } | null;
  /** CR-008 D7: the main / sub stream encodings the discovery read from the NVR, with the WebRTC verdict of each. */
  encoding?: CameraEncoding | null;
  /** NN5-F1B: seconds between refreshes of the still (the tile never goes below 5; set by the client, api/frigate.ts). */
  still_refresh_s?: number;
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

/* The anchor fields are the backend's response model (smplwise_vms/backend/smplwise/wire/anchors.py `Anchor` / `MapAnchor`, generated into
 * ./generated/wire-anchors.ts; code review 07:F8 step 2). Narrowed on purpose: `coverage_polygon` (pairs), `camera` / `entity` (the
 * client's Camera and catalogue entity types), `shared` (map/shared-space); the fields older bundles and the demo map leave out stay
 * optional. */
type AnchorWire = import('./generated/wire-anchors').MapAnchor;
export interface Anchor
  extends Pick<AnchorWire, 'id' | 'floor_id' | 'plan_version_id' | 'resource_type' | 'resource_id' | 'position' | 'rotation_degrees' | 'field_of_view_degrees' | 'layer_id' | 'label' | 'revision' | 'effective_from' | 'effective_to' | 'updated_at'>,
    Partial<Pick<AnchorWire, 'coverage_radius' | 'level_id' | 'mount_height_m' | 'tilt_deg' | 'room_candidate' | 'shared_member'>> {
  /** Manual coverage (R2): a free polygon [[x, y], ...] normalized to the plan; null = the cone. */
  coverage_polygon?: [number, number][] | null;
  /** R4: where the name label sits - auto | top | bottom | left | right. */
  label_pos?: string | null;
  camera?: Camera | null;
  /** Synced Home Assistant entity for ha_entity anchors (actions present only with ha.entity.control on the floor). */
  entity?: import('./ha').HaEntity | null;
  /** CR-009: an anchor of a room another floor shares with this one - its real id, its home floor, and its position in
   * this plan's coordinates; edits go through ?from_floor_id. */
  shared?: import('../map/shared-space').SharedAnchorMark;
}

export interface ZonePoint {
  x: number;
  y: number;
}

/** Named room / area polygon on a floor (normalized plan coordinates, origin top-left). The fields are the backend's response model
 * (smplwise_vms/backend/smplwise/wire/zones.py `Zone`, generated into ./generated/wire-zones.ts; code review 07:F8 step 2). Narrowed on
 * purpose: `kind` / `source` (the values the server writes), `shared` (map/shared-space); the fields the demo rooms leave out stay
 * optional. */
type ZoneWire = import('./generated/wire-zones').Zone;
export interface SpatialZone
  extends Pick<ZoneWire, 'id' | 'floor_id' | 'plan_version_id' | 'name' | 'polygon' | 'color' | 'searchable' | 'revision' | 'created_at' | 'updated_at'>,
    Partial<Pick<ZoneWire, 'label_pos' | 'level_id' | 'ceiling_height_m' | 'tags' | 'area_id'>> {
  kind: 'room' | 'zone' | 'corridor' | 'outdoor' | 'service';
  source: 'auto' | 'manual';
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

/** The floor map bundle (`GET /floors/{id}/map`, smplwise_vms/backend/smplwise/wire/anchors.py `FloorMap`, generated into
 * ./generated/wire-anchors.ts). The scalar fields come from the generated type; the parts other modules own (geometry reference, levels,
 * circuits, floor pictures, bakes, the HA history coverage, the permissions) keep their typed client shapes. */
type FloorMapWire = import('./generated/wire-anchors').FloorMap;
export interface FloorMap extends Pick<FloorMapWire, 'needs_alignment'>, Partial<Pick<FloorMapWire, 'catalog_revision' | 'at' | 'history' | 'history_from' | 'reach'>> {
  floor: Floor;
  building: Building;
  site: Site;
  plan: PlanVersion | null;
  /** Reference to the structure document of the shown version: the draft (else the published one) for an editor bundle,
   * the row in force at the instant for an exact-history bundle, else the published one; null when none. */
  geometry?: GeometryRef | null;
  /** T085: the levels of the referenced document and the circuit switch states. */
  levels?: import('../map/geometry').GeomLevel[];
  circuit_states?: Record<string, CircuitState>;
  /** K88: the floor's own images (urls relative to the API root) and their alignment; null when none. */
  floor_images?: { off: string | null; on: string | null; corners: [number, number][]; opacity?: number } | null;
  /** CR-029 S3: the CURRENT stills / masks / lightmaps per level (urls relative to the API root); null when the floor has none. */
  bakes?: import('../map/still-bake').BundleBakes | null;
  anchors: Anchor[];
  zones?: SpatialZone[];
  /** Coverage of the local HA state history (present in a historical bundle). */
  ha_history?: { from: string | null; to: string | null; rows: number; retention_days: number; forward_fill_max_s: number } | null;
  permissions: { edit: boolean; publish: boolean; import: boolean; structure: boolean };
  cameras: Camera[];
}

/** CR-API-PATHS-2439 (review 07:F21): the severity of a notification, a notice and a ticket rule - one definition (it was three
 * identical copies in api/notifications.ts, api/notices.ts, api/tickets.ts, which re-export it). */
export type Severity = 'info' | 'alert' | 'critical';

/** CR-API-PATHS-2439 (review 07:F21): a weekday key - one definition. The automations' copy ("mon" first) and the notifications' copy
 * ("sun" first) were the same seven values: a union has no order. The display order is each module's `WEEKDAYS` array (Sunday first
 * in both), unchanged. api/automations.ts and api/notifications.ts re-export it. */
export type Weekday = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';
