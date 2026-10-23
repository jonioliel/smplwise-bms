/**
 * CR-LOGOS295: the installation's logo and look choices - the company (developer / property-management) logo, the logo size scale, the
 * dark-background behaviour and the browser-tab title. Administrators set them in הגדרות › כללי › מראה המערכת › לוגו ושם המערכת
 * (screens/system-brand-logos.ts); the backend carries them in `/me.brand` (signed in) and `GET /brand/public` (the sign-in page, no session).
 *
 * This module is the one owner of that state: a tiny store that every placement (shell strip, sign-in card, wall header, the notice-board
 * TV page, the Settings preview) subscribes to through `<sw-brand>` (components/sw-brand.ts), plus the pure rules the placements share -
 * the size scale, which file a surface draws and on what (the dark-background rule), and the tab-title composition. The last known choice
 * is cached in localStorage (`sw.ui.brandlogo`) so the first paint already has the right logo and size (no flash of the other state).
 */
import { resourceUrl } from '../api/client';

export type LogoSize = 's' | 'm' | 'l' | 'xl';
export type DarkMode = 'plate' | 'file' | 'invert';
export type TitleMode = 'both' | 'dev' | 'project';
export type CompanyKind = 'developer' | 'management' | 'other';
export type LogoVariant = 'light' | 'dark';

export const LOGO_SIZES: readonly LogoSize[] = ['s', 'm', 'l', 'xl'];
export const DARK_MODES: readonly DarkMode[] = ['plate', 'file', 'invert'];
export const TITLE_MODES: readonly TitleMode[] = ['both', 'dev', 'project'];
export const COMPANY_KINDS: readonly CompanyKind[] = ['developer', 'management', 'other'];
/** One scale multiplies every logo box of every placement (CR-LOGOS295 4.4 rule 3). */
export const LOGO_SCALE: Readonly<Record<LogoSize, number>> = { s: 0.75, m: 1, l: 1.25, xl: 1.5 };
export const TITLE_PREFIX_DEFAULT = 'Smplwise Arx';

/** The brand block as the backend sends it (`/me.brand`, `GET /brand`; `GET /brand/public` has the first three fields only). */
export interface BrandView {
  company: { name: string; kind?: CompanyKind; logo: Record<LogoVariant, string | null>; logo_file?: Record<LogoVariant, string | null> };
  size: LogoSize;
  dark_mode: DarkMode;
  title?: { prefix: string; mode: TitleMode };
  project?: { name: string };
}

export interface BrandLogoState {
  companyName: string;
  kind: CompanyKind;
  /** the stamped file name of each variant (`<stamp>.png` / `.svg`), null = none uploaded */
  files: Record<LogoVariant, string | null>;
  size: LogoSize;
  darkMode: DarkMode;
  titlePrefix: string;
  titleMode: TitleMode;
  projectName: string;
}

const CACHE_KEY = 'sw.ui.brandlogo';

export const EMPTY_BRAND: BrandLogoState = {
  companyName: '',
  kind: 'developer',
  files: { light: null, dark: null },
  size: 'm',
  darkMode: 'plate',
  titlePrefix: TITLE_PREFIX_DEFAULT,
  titleMode: 'both',
  projectName: '',
};

const FILE = /^[0-9a-f]{16}\.(png|svg)$/;
const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
const file = (v: unknown): string | null => (typeof v === 'string' && FILE.test(v) ? v : null);

/** A server (or cached) brand block as state; anything unknown reads as the default, so a corrupt value never reaches the page. */
export function brandFromView(v: Partial<BrandView> | null | undefined, base: BrandLogoState = EMPTY_BRAND): BrandLogoState {
  if (!v || typeof v !== 'object') return base;
  const lf = v.company?.logo_file;
  return {
    companyName: typeof v.company?.name === 'string' ? v.company.name : base.companyName,
    kind: oneOf(COMPANY_KINDS, v.company?.kind, base.kind),
    files: { light: file(lf?.light), dark: file(lf?.dark) },
    size: oneOf(LOGO_SIZES, v.size, base.size),
    darkMode: oneOf(DARK_MODES, v.dark_mode, base.darkMode),
    titlePrefix: typeof v.title?.prefix === 'string' && v.title.prefix.trim() ? v.title.prefix : base.titlePrefix,
    titleMode: oneOf(TITLE_MODES, v.title?.mode, base.titleMode),
    projectName: typeof v.project?.name === 'string' ? v.project.name : base.projectName,
  };
}

function readCache(): BrandLogoState {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? brandFromView(JSON.parse(raw) as Partial<BrandView>) : EMPTY_BRAND;
  } catch {
    return EMPTY_BRAND;
  }
}

let state: BrandLogoState = readCache();
const listeners = new Set<() => void>();

export const brandLogo = (): BrandLogoState => state;
export const logoScale = (s: LogoSize = state.size): number => LOGO_SCALE[s];

export function onBrandLogo(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The view the backend sent (or the Settings card just saved): replaces the state, caches it, re-titles the page, tells every placement. */
export function setBrandView(view: Partial<BrandView> | null | undefined, opts: { title?: boolean } = {}): void {
  const next = brandFromView(view, state);
  if (JSON.stringify(next) === JSON.stringify(state)) {
    if (opts.title !== false) applyBrandTitle(); // the first answer equals the cache: the tab still gets its title
    return;
  }
  state = next;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ company: { name: next.companyName, kind: next.kind, logo_file: next.files, logo: next.files }, size: next.size, dark_mode: next.darkMode, title: { prefix: next.titlePrefix, mode: next.titleMode }, project: { name: next.projectName } }));
  } catch {
    /* private window / blocked storage: the cache is a convenience */
  }
  if (opts.title !== false) applyBrandTitle();
  listeners.forEach((fn) => fn());
}

/** The sign-in page: no session, so the public view (name, logos, size, dark-background mode). A failure keeps what we have (the
 * SmplWise-only layout when there is nothing) - never an empty box. */
export async function loadPublicBrand(): Promise<void> {
  try {
    const res = await fetch(resourceUrl('api/v1/brand/public'), { credentials: 'same-origin' });
    if (res.ok) setBrandView((await res.json()) as BrandView, { title: false });
  } catch {
    /* offline: keep the cache */
  }
}

/** The URL of a stored company logo variant (public, immutable: a replaced logo is a new file name). */
export function companyLogoUrl(variant: LogoVariant, fileName: string | null = state.files[variant]): string | null {
  return fileName && FILE.test(fileName) ? resourceUrl(`api/v1/brand/company-logo/${variant}/${fileName}`) : null;
}

/** The SmplWise product logo (a bundle file; the owner's final artwork replaces these files - CR-LOGOS295 4.1). */
export const productLogoUrl = (base: string = import.meta.env.BASE_URL): string => `${base}brand/smplwise-logo.png`;
export const productMarkUrl = (base: string = import.meta.env.BASE_URL): string => `${base}brand/smplwise-mark.png`;

/**
 * Which file a surface draws and how it is treated (CR-LOGOS295 4.4 rule 2). `dark` = the surface is dark (the scheme in force, or an
 * always-dark surface such as the notice-board TV). Never a CSS invert unless the administrator chose `invert`.
 *  - light surface: the light file, as uploaded;
 *  - dark surface, mode `file` and a dark file exists: the dark file;
 *  - dark surface, mode `invert`: the light file with the administrator-chosen invert filter;
 *  - dark surface otherwise (`plate`, or `file` without a dark file - the fallback, so a dark surface never shows an empty slot):
 *    the light file on a light plate.
 * A dark file on a light surface is never used.
 */
export interface LogoDraw {
  variant: LogoVariant;
  treatment: 'plain' | 'plate' | 'darkplate' | 'invert';
  file: string;
}
export function chooseCompanyLogo(files: Record<LogoVariant, string | null>, mode: DarkMode, dark: boolean): LogoDraw | null {
  if (!files.light && !files.dark) return null;
  if (!dark) return files.light ? { variant: 'light', treatment: 'plain', file: files.light } : { variant: 'dark', treatment: 'darkplate', file: files.dark as string };
  if (mode === 'file' && files.dark) return { variant: 'dark', treatment: 'plain', file: files.dark };
  const light = files.light ?? (files.dark as string);
  const variant: LogoVariant = files.light ? 'light' : 'dark';
  return { variant, treatment: mode === 'invert' ? 'invert' : 'plate', file: light };
}

const FSI = '⁨';
const PDI = '⁩';
/** `<prefix> - <developer> · <project>` (or only one of them); each name sits in first-strong isolates so a Hebrew name beside a Latin
 * project name keeps its own direction. Empty names are left out; no name at all gives the prefix alone. */
export function composeTitle(prefix: string, mode: TitleMode, dev: string, project: string): string {
  const pre = prefix.trim() || TITLE_PREFIX_DEFAULT;
  const d = dev.trim();
  const p = project.trim();
  const parts = mode === 'dev' ? [d] : mode === 'project' ? [p] : [d, p];
  const named = parts.filter(Boolean).map((x) => `${FSI}${x}${PDI}`);
  return named.length ? `${pre} - ${named.join(' · ')}` : pre;
}

/** The browser-tab title the administrator composed (the screen name is not appended: the owner asked for these names only). */
export function applyBrandTitle(): void {
  if (typeof document === 'undefined') return;
  const s = state;
  document.title = composeTitle(s.titlePrefix, s.titleMode, s.companyName, s.projectName);
}
