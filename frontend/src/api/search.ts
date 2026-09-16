/**
 * Global search (design M48, pilot scope): rooms / zones, cameras, floors, buildings and HA entities by name.
 * The server filters by the caller's scope and returns the route that opens each hit.
 */
import { get } from './client';
import type { IconName } from '../components/sw-icon';

export type SearchKind = 'zone' | 'camera' | 'floor' | 'building' | 'entity';

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

export const KIND_LABEL: Record<SearchKind, string> = { zone: 'חדר / אזור', camera: 'מצלמה', floor: 'קומה', building: 'מבנה', entity: 'ישות HA' };
export const KIND_ICON: Record<SearchKind, IconName> = { zone: 'map', camera: 'camera', floor: 'floor', building: 'building', entity: 'light' };

export const search = (q: string, limit = 8) => get<SearchResponse>(`search?q=${encodeURIComponent(q)}&limit=${limit}`);
