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
  buildings?: Building[];
}

export interface Building {
  id: string;
  site_id: string;
  name: string;
  sort_order: number;
  updated_at: string;
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
  image_url: string;
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

export interface FloorMap {
  floor: Floor;
  building: Building;
  site: Site;
  plan: PlanVersion | null;
  anchors: Anchor[];
  needs_alignment: boolean;
  permissions: { edit: boolean; publish: boolean; import: boolean };
  cameras: Camera[];
}
