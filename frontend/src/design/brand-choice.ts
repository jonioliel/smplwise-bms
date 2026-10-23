/**
 * CR-LOGOS295: the pure rules of a logo placement, with no imports - shared by the application (design/brand-logo.ts re-exports them) and
 * by the notice-board TV page, a separate small bundle that must not pull in the API client.
 */
export type LogoSize = 's' | 'm' | 'l' | 'xl';
export type DarkMode = 'plate' | 'file' | 'invert';
export type LogoVariant = 'light' | 'dark';

/** One scale multiplies every logo box of every placement (CR-LOGOS295 4.4 rule 3). */
export const LOGO_SCALE: Readonly<Record<LogoSize, number>> = { s: 0.75, m: 1, l: 1.25, xl: 1.5 };

export interface LogoDraw {
  variant: LogoVariant;
  treatment: 'plain' | 'plate' | 'darkplate' | 'invert';
  file: string;
}

/**
 * Which file a surface draws and how it is treated (CR-LOGOS295 4.4 rule 2). `dark` = the surface is dark (the scheme in force, or an
 * always-dark surface such as the notice-board TV at night). Never a CSS invert unless the administrator chose `invert`.
 *  - light surface: the light file, as uploaded;
 *  - dark surface, mode `file` and a dark file exists: the dark file;
 *  - dark surface, mode `invert`: the light file with the administrator-chosen invert filter;
 *  - dark surface otherwise (`plate`, or `file` without a dark file - the fallback, so a dark surface never shows an empty slot):
 *    the light file on a light plate.
 * A dark file on a light surface is never used when a light file exists; alone it sits on a dark plate.
 */
export function chooseCompanyLogo(files: Record<LogoVariant, string | null>, mode: DarkMode, dark: boolean): LogoDraw | null {
  if (!files.light && !files.dark) return null;
  if (!dark) return files.light ? { variant: 'light', treatment: 'plain', file: files.light } : { variant: 'dark', treatment: 'darkplate', file: files.dark as string };
  if (mode === 'file' && files.dark) return { variant: 'dark', treatment: 'plain', file: files.dark };
  const light = files.light ?? (files.dark as string);
  const variant: LogoVariant = files.light ? 'light' : 'dark';
  return { variant, treatment: mode === 'invert' ? 'invert' : 'plate', file: light };
}
