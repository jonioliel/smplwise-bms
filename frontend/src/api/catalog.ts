/**
 * Catalogue data source: the backend when a session exists, otherwise the demo fixtures (static
 * preview / design review). Screens call these helpers instead of touching fixtures directly.
 */
import { del, get, patch, post } from './client';
import { isApi } from './session';
import type { Building, Floor, Site, SitesResponse } from './types';
import { demoBuildings, demoSites } from '../fixtures/catalog';
import { demoFloors } from '../fixtures/demo';

export interface CatalogTree {
  source: 'api' | 'demo';
  sites: Site[];
  canCreateSite: boolean;
}

function demoTree(): CatalogTree {
  const sites: Site[] = demoSites.map((s, i) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    timezone: 'Asia/Jerusalem',
    sort_order: i,
    updated_at: '',
    buildings: demoBuildings
      .filter((b) => b.siteId === s.id)
      .map((b, j) => ({
        id: b.id,
        site_id: s.id,
        name: b.name,
        sort_order: j,
        updated_at: '',
        floors: b.floors.map((f, k) => {
          const df = demoFloors.find((x) => x.id === f.id);
          return {
            id: f.id,
            building_id: b.id,
            name: f.name,
            level: -k,
            sort_order: k,
            ha_area_id: null,
            has_plan: f.hasPlan,
            published_version_id: f.hasPlan ? `demo-${f.id}` : null,
            plan_width_px: df?.planWidth ?? null,
            plan_height_px: df?.planHeight ?? null,
            draft_version_id: null,
            anchor_count: f.cameras + f.entities,
            camera_count: f.cameras,
            updated_at: '',
          } satisfies Floor;
        }),
      })),
  }));
  return { source: 'demo', sites, canCreateSite: true };
}

export async function loadTree(): Promise<CatalogTree> {
  if (!isApi()) return demoTree();
  const res = await get<SitesResponse>('sites?tree=true');
  return { source: 'api', sites: res.sites, canCreateSite: res.can_create_site };
}

export const createSite = (body: { name: string; address?: string }) => post<Site>('sites', body);
export const updateSite = (id: string, body: Partial<Pick<Site, 'name' | 'address' | 'sort_order'>>) => patch<Site>(`sites/${id}`, body);
export const deleteSite = (id: string) => del(`sites/${id}`);
export const createBuilding = (siteId: string, body: { name: string }) => post<Building>(`sites/${siteId}/buildings`, body);
export const updateBuilding = (id: string, body: Partial<Pick<Building, 'name' | 'sort_order'>>) => patch<Building>(`buildings/${id}`, body);
export const deleteBuilding = (id: string) => del(`buildings/${id}`);
export const createFloor = (buildingId: string, body: { name: string; level: number }) => post<Floor>(`buildings/${buildingId}/floors`, body);
export const updateFloor = (id: string, body: Partial<Pick<Floor, 'name' | 'level' | 'sort_order'>>) => patch<Floor>(`floors/${id}`, body);
export const deleteFloor = (id: string, force = false) => del(`floors/${id}${force ? '?force=true' : ''}`);

/** Find a floor (with its building and site) in a loaded tree. */
export function findFloor(tree: CatalogTree, floorId: string): { site: Site; building: Building; floor: Floor } | null {
  for (const site of tree.sites) {
    for (const building of site.buildings ?? []) {
      const floor = (building.floors ?? []).find((f) => f.id === floorId);
      if (floor) return { site, building, floor };
    }
  }
  return null;
}

export function firstFloor(tree: CatalogTree): Floor | null {
  for (const site of tree.sites) for (const building of site.buildings ?? []) for (const floor of building.floors ?? []) return floor;
  return null;
}
