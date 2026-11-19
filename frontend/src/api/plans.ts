/**
 * Plan versions beyond import: the stylized "SMPLWISE language" rendering (local image processing of the
 * uploaded plan: text and dimension lines removed, walls and rooms emphasised) and the render mode that
 * decides which picture the map shows. The source image is never modified.
 */
import { get, patch, path, post, resourceUrl } from './client';
import type { PlanVersion } from './types';
import type * as PlanWire from './generated/wire-plans';
import { tr } from '../i18n/msg/api-home';

export type RoomFill = 'white' | 'tint' | 'none';
export const ROOM_FILL_LABEL: Record<RoomFill, string> = { white: tr('לבן'), tint: tr('גוון לכל חדר'), none: tr('ללא מילוי') };

/** `POST /plan-versions/{id}/stylize` (wire/plans.py `PlanStylized`, generated), narrowed to the request's choices; the two URLs are
 * made absolute (base-resolved) for the comparison view. */
export interface StylizeResult extends Pick<PlanWire.PlanStylized, 'version_id' | 'rooms' | 'keep_lines' | 'width_px' | 'height_px' | 'ms' | 'source_url' | 'stylized_url'> {
  strength: 'light' | 'medium' | 'strong';
  room_fill: RoomFill;
}

export async function stylizeVersion(versionId: string, opts: { strength: 'light' | 'medium' | 'strong'; keep_lines: boolean; room_fill?: RoomFill }): Promise<StylizeResult> {
  const r = await post<StylizeResult>(path`plan-versions/${versionId}/stylize`, opts);
  return { ...r, source_url: resourceUrl(r.source_url) + `?v=${Date.now()}`, stylized_url: resourceUrl(r.stylized_url) + `?v=${Date.now()}` };
}

export const setRenderMode = (versionId: string, render_mode: 'source' | 'stylized') => patch<PlanVersion>(path`plan-versions/${versionId}`, { render_mode });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by the plan editor (plan versions, 0.1.9).
export const getVersion = (versionId: string) => get<PlanVersion>(path`plan-versions/${versionId}`);
