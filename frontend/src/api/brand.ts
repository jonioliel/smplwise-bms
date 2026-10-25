import { apiUrl, del, get, put, upload } from './client';
import type { BrandView, LogoVariant } from '../design/brand-logo';

/** CR-LOGOS295: the facts of one stored logo file (never its bytes). */
export interface BrandFileMeta {
  stamp: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  uploaded_by: string | null;
  uploaded_at: string;
}

export interface BrandFull extends BrandView {
  company: NonNullable<BrandView['company']>;
  files: Record<LogoVariant, BrandFileMeta | null>;
}

/** PUT /brand body: every field optional (the server changes only what is sent). */
export interface BrandPatch {
  company_name?: string;
  company_kind?: string;
  logo_size?: string;
  logo_side?: string;
  company_logo_size?: string;
  dark_mode?: string;
  title_prefix?: string;
  title_mode?: string;
  project_name?: string;
}

export const getBrand = () => get<BrandFull>('brand');
export const putBrand = (body: BrandPatch) => put<BrandFull>('brand', body);
export function uploadLogo(variant: LogoVariant, file: File): Promise<{ stamp: string; warnings: { code: string; message: string }[]; view: BrandView; files: BrandFull['files'] }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload(`brand/company-logo/${variant}`, form);
}
export const deleteLogo = (variant: LogoVariant) => del(`brand/company-logo/${variant}`) as unknown as Promise<BrandFull>;

/** WHITELABEL097-295: the installer (white-label) profile of GET /brand/white-label. */
export interface InstallerFull {
  enabled: boolean;
  name: string;
  contact: string;
  accent: string;
  logo: Record<LogoVariant, string | null>;
  logo_file: Record<LogoVariant, string | null>;
  files: Record<LogoVariant, BrandFileMeta | null>;
}
export interface InstallerPatch {
  enabled?: boolean;
  name?: string;
  contact?: string;
  accent?: string;
}
export const getInstaller = () => get<InstallerFull>('brand/white-label');
export const putInstaller = (body: InstallerPatch) => put<InstallerFull>('brand/white-label', body);
export function uploadInstallerLogo(variant: LogoVariant, file: File): Promise<{ stamp: string; warnings: { code: string; message: string }[]; view: InstallerFull }> {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload(`brand/white-label/logo/${variant}`, form);
}
export const deleteInstallerLogo = (variant: LogoVariant) => del(`brand/white-label/logo/${variant}`) as unknown as Promise<InstallerFull>;
export function importInstallerPack(file: File): Promise<InstallerFull> {
  const form = new FormData();
  form.append('file', file, file.name);
  return upload('brand/white-label/pack', form);
}
/** The pack as a file download: fetched with the session, handed to the browser as a blob (a refusal surfaces as a thrown error). */
export async function downloadInstallerPack(): Promise<void> {
  const res = await fetch(apiUrl('brand/white-label/pack'), { credentials: 'same-origin' });
  if (!res.ok) throw new Error(`pack ${res.status}`);
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = 'smplwise-brand-pack.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
