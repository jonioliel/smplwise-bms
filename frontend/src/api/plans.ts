/**
 * Plan versions beyond import: the stylized "SMPLWISE language" rendering (local image processing of the
 * uploaded plan: text and dimension lines removed, walls and rooms emphasised) and the render mode that
 * decides which picture the map shows. The source image is never modified.
 */
import { get, patch, post, resourceUrl } from './client';
import type { PlanVersion } from './types';

export type RoomFill = 'white' | 'tint' | 'none';
export const ROOM_FILL_LABEL: Record<RoomFill, string> = { white: 'לבן', tint: 'גוון לכל חדר', none: 'ללא מילוי' };

export interface StylizeResult {
  version_id: string;
  rooms: number;
  strength: 'light' | 'medium' | 'strong';
  keep_lines: boolean;
  room_fill: RoomFill;
  width_px: number;
  height_px: number;
  ms: number;
  /** Absolute (base-resolved) URLs for the comparison view. */
  source_url: string;
  stylized_url: string;
}

export async function stylizeVersion(versionId: string, opts: { strength: 'light' | 'medium' | 'strong'; keep_lines: boolean; room_fill?: RoomFill }): Promise<StylizeResult> {
  const r = await post<Omit<StylizeResult, 'source_url' | 'stylized_url'> & { source_url: string; stylized_url: string }>(`plan-versions/${versionId}/stylize`, opts);
  return { ...r, source_url: resourceUrl(r.source_url) + `?v=${Date.now()}`, stylized_url: resourceUrl(r.stylized_url) + `?v=${Date.now()}` };
}

export const setRenderMode = (versionId: string, render_mode: 'source' | 'stylized') => patch<PlanVersion>(`plan-versions/${versionId}`, { render_mode });
export const getVersion = (versionId: string) => get<PlanVersion>(`plan-versions/${versionId}`);
