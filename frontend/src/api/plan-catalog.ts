/**
 * Plan Studio object library (T085): the built-in catalog merged with the installation's custom items, fetched once and
 * refreshed when the map bundle's catalog_revision differs; custom item calls; the client-side search the library
 * panel runs (design 4.3: names he / en and tags, synonyms included).
 */
import { del, get, patch, post, resourceUrl } from './client';
import type { CatalogLookup, GeomSize, ObjectShape } from '../map/geometry';
import type { Catalog3DLookup } from '../map/scene-builder';

export interface ParamSpec {
  type: 'number' | 'int' | 'level';
  min?: number;
  max?: number;
  he: string;
}
/** A relative part of a composite item (T087): a box or a cylinder, its size in metres and its offset from the item's
 * footprint centre (x right, y up, z down the plan) before the item's rotation. */
export interface MeshPart {
  shape: 'box' | 'cylinder';
  size: [number, number, number];
  offset: [number, number, number];
  color_token?: string;
}
export interface CatalogItem {
  id: string;
  category: string;
  names: { he: string; en: string };
  tags: string[];
  role: string;
  shape: ObjectShape;
  size: GeomSize;
  /** Ceiling items carry a negative z_m offset from the level's ceiling; floor items an absolute height. */
  z_ref: 'floor' | 'ceiling';
  z_m: number;
  params: Record<string, unknown>;
  params_schema: Record<string, ParamSpec>;
  icon: string;
  color_token: string;
  /** HA domains an object of this item may be the body of (light -> light / switch). */
  anchor_kinds: string[];
  /** Composite items only (T087); null / absent for every other shape. */
  mesh?: MeshPart[] | null;
  ifc: { class: string; predefined_type: string };
  custom: boolean;
  based_on: string | null;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}
export interface CatalogCategory {
  id: string;
  he: string;
  en: string;
}
export interface CatalogLibrary {
  catalog_version: string;
  revision: string;
  categories: CatalogCategory[];
  icons: string[];
  color_tokens: string[];
  items: CatalogItem[];
}
export interface CustomItemBody {
  based_on?: string | null;
  names?: { he: string; en?: string };
  category?: string;
  tags?: string[];
  role?: string;
  shape?: ObjectShape;
  size?: GeomSize;
  z_m?: number;
  params?: Record<string, unknown>;
  icon?: string;
  color_token?: string;
}

let cache: CatalogLibrary | null = null;
let inflight: Promise<CatalogLibrary> | null = null;

/** The library, fetched once per revision: a caller that knows the bundle's catalog_revision passes it. */
export function loadLibrary(revision?: string | null): Promise<CatalogLibrary> {
  if (cache && (!revision || cache.revision === revision)) return Promise.resolve(cache);
  if (!inflight) {
    inflight = get<CatalogLibrary>('catalog/objects')
      .then((lib) => {
        cache = lib;
        return lib;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function invalidateLibrary(): void {
  cache = null;
}

export function lookupOf(lib: CatalogLibrary): CatalogLookup {
  const m = new Map(lib.items.map((i) => [i.id, { shape: i.shape, icon: i.icon, color_token: i.color_token }]));
  return (id) => m.get(id);
}

/** What the scene builder needs from the library for one item (T087): the shape, the colour, the role and the parts
 * of a composite. */
export function lookup3dOf(lib: CatalogLibrary): Catalog3DLookup {
  const m = new Map(lib.items.map((i) => [i.id, { shape: i.shape, color_token: i.color_token, role: i.role, mesh: i.shape === 'composite' && Array.isArray(i.mesh) ? i.mesh : null }]));
  return (id) => m.get(id);
}

export const itemOf = (lib: CatalogLibrary, id: string): CatalogItem | undefined => lib.items.find((i) => i.id === id);

const fold = (s: string): string => s.toLocaleLowerCase().replace(/[֑-ׇ]/g, '');

/** Items whose Hebrew or English name or a tag contains the query (case folded); an empty query lists the category. */
export function searchItems(items: CatalogItem[], q: string, category: string | null): CatalogItem[] {
  const needle = fold(q.trim());
  return items.filter((i) => (!category || i.category === category) && (!needle || [i.names.he, i.names.en, ...i.tags].some((s) => fold(s).includes(needle))));
}

const refresh = <T>(x: T): T => {
  invalidateLibrary();
  return x;
};
export const createItem = (body: CustomItemBody) => post<CatalogItem>('catalog/objects', body).then(refresh);
export const updateItem = (id: string, body: CustomItemBody) => patch<CatalogItem>(`catalog/objects/${encodeURIComponent(id)}`, body).then(refresh);
export const deleteItem = (id: string) => del(`catalog/objects/${encodeURIComponent(id)}`).then(refresh);
export const importItems = (items: unknown[]) => post<{ imported: number; replaced: number; revision: string }>('catalog/import', { format: 'smplwise-catalog-1', items }).then(refresh);
export const exportUrl = () => resourceUrl('api/v1/catalog/export');
