import { del, get, put, upload } from './client';
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
