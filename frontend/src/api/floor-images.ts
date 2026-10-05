/**
 * K88: own floor images - one picture per floor and variant ("off" = lights off, "on" = lights on), made anywhere,
 * aligned once by its four corners over the plan. The live map draws the "off" image under the room state layer and
 * the "on" image clipped to the lit rooms.
 */
import { del, get, put, resourceUrl, upload } from './client';

export type FloorImageVariant = 'off' | 'on';

export interface FloorImageRow {
  id: string;
  floor_id: string;
  variant: FloorImageVariant;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  created_at: string;
  /** Relative to the API root; resolve with `resourceUrl`. */
  url: string;
}

export interface FloorImageLayout {
  /** top-left, top-right, bottom-right, bottom-left in plan-normalised coordinates. */
  corners: [number, number][];
  opacity: number;
  updated_at: string | null;
  aligned: boolean;
}

export interface FloorImagesInfo {
  floor_id: string;
  images: Record<FloorImageVariant, FloorImageRow | null>;
  layout: FloorImageLayout;
}

export const DEFAULT_CORNERS: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];

export const getFloorImages = (floorId: string) => get<FloorImagesInfo>(`floors/${floorId}/images`);
export const uploadFloorImage = (floorId: string, variant: FloorImageVariant, file: File) => {
  const form = new FormData();
  form.append('variant', variant);
  form.append('file', file, file.name || `${variant}.png`);
  return upload<FloorImageRow & { replaced: boolean; layout: FloorImageLayout }>(`floors/${floorId}/images`, form);
};
export const deleteFloorImage = (floorId: string, variant: FloorImageVariant) => del(`floors/${floorId}/images/${variant}`);
export const putFloorImageLayout = (floorId: string, corners: [number, number][], opacity?: number) =>
  put<FloorImageLayout>(`floors/${floorId}/images/layout`, opacity === undefined ? { corners } : { corners, opacity });
export const floorImageUrl = (row: FloorImageRow | null) => (row ? resourceUrl(row.url) : null);
