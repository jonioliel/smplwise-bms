/**
 * Global search (design M48, pilot scope): rooms / zones, cameras, floors, buildings and HA entities by name.
 * The server filters by the caller's scope and returns the route that opens each hit.
 */
import { get } from './client';
import type { IconName } from '../components/sw-icon';
import { tr } from '../i18n/msg/api-video';
import type { BuildingFilterMeta } from '../components/building-filter-logic';

/** page (CR-010): a screen of the app itself (the security sections), matched in the browser - never sent to the server. */
type SearchKind = 'zone' | 'camera' | 'floor' | 'building' | 'entity' | 'object' | 'page';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  /** Hash route (without '#') that opens the hit. */
  route: string;
  floor_id?: string | null;
  /** CR-009: every floor that shows the hit (a room shared between floors) and the caller may read. */
  floor_ids?: string[];
}

/** The route that opens a hit: a room shown on several floors opens on the floor the person is on when that floor is
 * one of them (CR-009), else where the server said. currentPath is the hash path now ("/explore/floors/<id>..."). */
export function routeFor(r: SearchResult, currentPath: string | null | undefined): string {
  const m = /^\/explore\/floors\/([^/?]+)/.exec(currentPath ?? '');
  const here = m ? m[1] : null;
  if (!here || !r.floor_ids?.includes(here) || r.floor_id === here) return r.route;
  return r.route.replace(/^\/explore\/floors\/[^/?]+/, `/explore/floors/${here}`);
}

interface SearchResponse {
  q: string;
  results: SearchResult[];
  counts: Partial<Record<SearchKind, number>>;
  /** MULTI-BUILDING-NEXT-2500: only on a multi-building site whose hits sit in two or more buildings (or a building was named). */
  building_filter?: BuildingFilterMeta;
}

export const KIND_LABEL: Record<SearchKind, string> = { zone: tr('חדר / אזור'), camera: tr('מצלמה'), floor: tr('קומה'), building: tr('מבנה'), entity: tr('התקן'), object: tr('עצם'), page: tr('מסך') };
export const KIND_ICON: Record<SearchKind, IconName> = { zone: 'map', camera: 'camera', floor: 'floor', building: 'building', entity: 'light', object: 'grid', page: 'shield' };

/** `building` (MULTI-BUILDING-NEXT-2500): keep one building's hits - the server ignores it while the multi-building filter is off. */
export const search = (q: string, limit = 8, building = '') =>
  get<SearchResponse>(`search?q=${encodeURIComponent(q)}&limit=${limit}${building ? `&building=${encodeURIComponent(building)}` : ''}`);

/** Semantic search (T063): the local baseline parses the question into the event centre's filters; results are metadata matches, never identity evidence. */
interface SemanticPlace {
  kind: 'zone' | 'floor' | 'camera';
  id: string;
  name: string;
  floor_id?: string;
  match: 'exact' | 'partial';
  term: string;
}
interface SemanticParsed {
  objects: string[];
  types: string[];
  places: SemanticPlace[];
  window: { from: string; to: string; label: string } | null;
  terms_used: string[];
  unsupported: { term: string; reason: string }[];
  leftovers: string[];
}
interface SemanticProvider {
  id: string;
  name: string;
  model_version: string;
  privacy: string;
  network: boolean;
  budget_daily: number;
  opt_in_required: boolean;
  capabilities: string[];
  available?: boolean;
  reason?: string;
}
interface SemanticHit {
  id: string;
  type: string;
  source: string;
  camera_id: string | null;
  camera_name?: string | null;
  occurred_at: string;
  severity: string;
  confidence: 'measured' | 'inferred';
  details: Record<string, unknown>;
  match: { confidence: 'exact' | 'partial'; basis: string[] };
}
export interface SemanticResponse {
  q: string;
  provider: SemanticProvider;
  parsed: SemanticParsed;
  results: SemanticHit[];
  total: number;
  note: string;
  unsupported: { term: string; reason: string }[];
}
export interface ProvidersResponse {
  providers: SemanticProvider[];
  active: string;
  settings: { 'ai.provider': string; 'ai.privacy_ack': string; 'ai.budget_daily': number };
  note: string;
}
export const semanticSearch = (q: string, limit = 30) => get<SemanticResponse>(`search/semantic?q=${encodeURIComponent(q)}&limit=${limit}`);
export const searchProviders = () => get<ProvidersResponse>('search/providers');
export const OBJECT_LABEL: Record<string, string> = { person: tr('אדם'), vehicle: tr('רכב'), motion: tr('תנועה'), door: tr('דלת'), line: tr('חציית קו'), field: tr('חדירה') };

