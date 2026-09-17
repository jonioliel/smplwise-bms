// Shapes returned by the add-on backend (smplwise_vms/backend). Keep in step with the routers.

export interface Me {
  user: { id: string; username: string; display_name: string; source: 'ingress' | 'dev' };
  bindings: { id: string; role_id: string; role_name: string; scope_type: string; scope_id: string; scope_name: string; effect: string }[];
  permissions_installation: string[];
  has_access: boolean;
  permission_revision: number;
  bootstrap_state: string;
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

export interface Camera {
  id: string;
  recorder_id: string;
  channel: number;
  name: string;
  name_source: string;
  alias: string | null;
  enabled: boolean;
  sort_order: number;
  main_track: number | null;
  sub_track: number | null;
  status: 'online' | 'offline' | 'unknown';
  last_seen_at: string | null;
  stream?: { codec?: string; resolution?: string; fps?: number; bitrate_kbps?: number } | null;
  can_view_live?: boolean;
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
  layer_id: string;
  label: string | null;
  revision: number;
  effective_from: string;
  effective_to: string | null;
  updated_at: string;
  camera?: Camera | null;
  /** Synced Home Assistant entity for ha_entity anchors (actions present only with ha.entity.control on the floor). */
  entity?: import('./ha').HaEntity | null;
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
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface FloorMap {
  floor: Floor;
  building: Building;
  site: Site;
  plan: PlanVersion | null;
  anchors: Anchor[];
  zones?: SpatialZone[];
  needs_alignment: boolean;
  /** Set when the bundle was requested at an instant (historical map, T038). */
  at?: string | null;
  history?: 'exact' | 'current' | null;
  history_from?: string | null;
  /** Coverage of the local HA state history (present in a historical bundle). */
  ha_history?: { from: string | null; to: string | null; rows: number; retention_days: number; forward_fill_max_s: number } | null;
  permissions: { edit: boolean; publish: boolean; import: boolean };
  cameras: Camera[];
}
