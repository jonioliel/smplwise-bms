/**
 * Global search (design M48, pilot scope): rooms / zones, cameras, floors, buildings and HA entities by name.
 * The server filters by the caller's scope and returns the route that opens each hit.
 */
import { get } from './client';
import type { IconName } from '../components/sw-icon';

export type SearchKind = 'zone' | 'camera' | 'floor' | 'building' | 'entity' | 'object';

export interface SearchResult {
  kind: SearchKind;
  id: string;
  title: string;
  subtitle: string;
  /** Hash route (without '#') that opens the hit. */
  route: string;
  floor_id?: string | null;
}

export interface SearchResponse {
  q: string;
  results: SearchResult[];
  counts: Partial<Record<SearchKind, number>>;
}

export const KIND_LABEL: Record<SearchKind, string> = { zone: 'חדר / אזור', camera: 'מצלמה', floor: 'קומה', building: 'מבנה', entity: 'ישות HA', object: 'עצם' };
export const KIND_ICON: Record<SearchKind, IconName> = { zone: 'map', camera: 'camera', floor: 'floor', building: 'building', entity: 'light', object: 'grid' };

export const search = (q: string, limit = 8) => get<SearchResponse>(`search?q=${encodeURIComponent(q)}&limit=${limit}`);

/** Semantic search (T063): the local baseline parses the question into the event centre's filters; results are metadata matches, never identity evidence. */
export interface SemanticPlace {
  kind: 'zone' | 'floor' | 'camera';
  id: string;
  name: string;
  floor_id?: string;
  match: 'exact' | 'partial';
  term: string;
}
export interface SemanticParsed {
  objects: string[];
  types: string[];
  places: SemanticPlace[];
  window: { from: string; to: string; label: string } | null;
  terms_used: string[];
  unsupported: { term: string; reason: string }[];
  leftovers: string[];
}
export interface SemanticProvider {
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
export interface SemanticHit {
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
export const OBJECT_LABEL: Record<string, string> = { person: 'אדם', vehicle: 'רכב', motion: 'תנועה', door: 'דלת', line: 'חציית קו', field: 'חדירה' };

