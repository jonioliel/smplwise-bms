/** VPORTAL: the organisation's logo on the public pages (routers/tickets_admin.py `/tickets/settings/logo`, services/tickets/brand.py).
 * JPEG or PNG by content only (SVG and every other type refused), <= 512 KB; the server re-encodes it to a fresh JPEG of <= 512 px and
 * answers its public file name. system.configure, audited as tickets.settings.update. */
import { api, apiUrl, upload } from './client';

export interface LogoAnswer {
  logo: string | null;
  revision: number;
}

export const LOGO_MAX_BYTES = 512 * 1024;

export function uploadLogo(file: File): Promise<LogoAnswer> {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload<LogoAnswer>('tickets/settings/logo', form);
}

export const deleteLogo = () => api<LogoAnswer>('tickets/settings/logo', { method: 'DELETE' });

/** The preview address (signed-in, system.configure); the stamp makes a new logo a new address. */
export function logoPreviewUrl(stamp: string): string {
  return `${apiUrl('tickets/settings/logo')}?v=${encodeURIComponent(stamp)}`;
}
