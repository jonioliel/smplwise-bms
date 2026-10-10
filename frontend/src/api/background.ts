/** CRY (2026-10-10): the installation's own background pictures (routers/ui_background.py). A slot is `day` or `night`; the server
 * re-encodes the upload (PNG / JPG / WebP by content, <= 12 MB, longest side 2560 px) and answers with the version stamps of both slots,
 * which the product settings carry as `ui.background_images` (design/background.ts). system.configure, audited as settings.update. */
import { api, upload } from './client';
import type { BackgroundImages, BackgroundSlot } from '../design/background';

export interface BackgroundImagesResponse {
  images: BackgroundImages;
}

export function uploadBackground(slot: BackgroundSlot, file: File): Promise<BackgroundImagesResponse> {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<BackgroundImagesResponse>(`settings/background/${slot}`, form);
}

export const deleteBackground = (slot: BackgroundSlot) => api<BackgroundImagesResponse>(`settings/background/${slot}`, { method: 'DELETE' });
