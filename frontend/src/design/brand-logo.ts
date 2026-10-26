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
import { LOGO_SCALE, chooseCompanyLogo, type DarkMode, type LogoDraw, type LogoSize, type LogoVariant } from './brand-choice';

// the pure placement rules live in brand-choice.ts (no imports: the notice-board TV bundle uses them too); re-exported here
export { LOGO_SCALE, chooseCompanyLogo };
export type { DarkMode, LogoDraw, LogoSize, LogoVariant };
import { brandColors, normalizeBrand, setBrandColors } from './brand';

/** LOGOSIDE-295: which side of the top header the company / installer logos take - `start` (the right in RTL) or `end` (beside the SmplWise logo in the corner). */
export type LogoSide = 'start' | 'end';
/** LOGOSIDE-295: the company / installer logo's own scale; `same` follows the general scale. */
export type CompanySize = 'same' | LogoSize;
export type TitleMode = 'both' | 'dev' | 'project';
export type CompanyKind = 'developer' | 'management' | 'other';

export const LOGO_SIZES: readonly LogoSize[] = ['s', 'm', 'l', 'xl'];
export const LOGO_SIDES: readonly LogoSide[] = ['start', 'end'];
export const COMPANY_SIZES: readonly CompanySize[] = ['same', 's', 'm', 'l', 'xl'];
export const DARK_MODES: readonly DarkMode[] = ['plate', 'file', 'invert'];
export const TITLE_MODES: readonly TitleMode[] = ['both', 'dev', 'project'];
export const COMPANY_KINDS: readonly CompanyKind[] = ['developer', 'management', 'other'];
export const TITLE_PREFIX_DEFAULT = 'Smplwise Arx';

/** The brand block as the backend sends it (`/me.brand`, `GET /brand`; `GET /brand/public` has the first three fields only). */
export interface BrandView {
  company: { name: string; kind?: CompanyKind; logo: Record<LogoVariant, string | null>; logo_file?: Record<LogoVariant, string | null> };
  size: LogoSize;
  logo_side?: LogoSide;
  company_logo_size?: CompanySize;
  dark_mode: DarkMode;
  title?: { prefix: string; mode: TitleMode };
  project?: { name: string };
  /** WHITELABEL097-295: the installer company's profile; the backend sends `{ enabled: false }` and nothing else while it is off. */
  installer?: { enabled: boolean; name?: string; contact?: string; accent?: string; logo_file?: Record<LogoVariant, string | null> };
}

/** The installer (white-label) profile as the placements read it; `enabled` false = the SmplWise branding only. */
export interface InstallerState {
  enabled: boolean;
  name: string;
  contact: string;
  /** a preset id of design/brand.ts, or 'default' */
  accent: string;
  files: Record<LogoVariant, string | null>;
}

export interface BrandLogoState {
  companyName: string;
  kind: CompanyKind;
  /** the stamped file name of each variant (`<stamp>.png` / `.svg`), null = none uploaded */
  files: Record<LogoVariant, string | null>;
  size: LogoSize;
  logoSide: LogoSide;
  companySize: CompanySize;
  darkMode: DarkMode;
  titlePrefix: string;
  titleMode: TitleMode;
  projectName: string;
  wl: InstallerState;
}

export const EMPTY_INSTALLER: InstallerState = { enabled: false, name: '', contact: '', accent: 'default', files: { light: null, dark: null } };

const CACHE_KEY = 'sw.ui.brandlogo';

export const EMPTY_BRAND: BrandLogoState = {
  companyName: '',
  kind: 'developer',
  files: { light: null, dark: null },
  size: 'm',
  logoSide: 'start',
  companySize: 'same',
  darkMode: 'invert', // HOME-295 (owner answers round 2, item 12): invert by default; plate / dark file selectable
  titlePrefix: TITLE_PREFIX_DEFAULT,
  titleMode: 'both',
  projectName: '',
  wl: EMPTY_INSTALLER,
};

const FILE = /^[0-9a-f]{16}\.(png|svg)$/;
const BRAND_PRESET_IDS: Readonly<Record<string, true>> = { ios_green: true, ios_blue: true, teal: true, purple: true, orange: true, pink: true, graphite: true };
const oneOf = <T extends string>(list: readonly T[], v: unknown, d: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : d);
const file = (v: unknown): string | null => (typeof v === 'string' && FILE.test(v) ? v : null);

/** The installer block as state: anything unknown reads as "off", a free colour as "default" (a preset id only). */
export function installerFromView(v: BrandView['installer'] | null | undefined): InstallerState {
  if (!v || typeof v !== 'object' || v.enabled !== true) return EMPTY_INSTALLER;
  const accent = typeof v.accent === 'string' && Object.prototype.hasOwnProperty.call(BRAND_PRESET_IDS, v.accent) ? v.accent : 'default';
  return {
    enabled: true,
    name: typeof v.name === 'string' ? v.name : '',
    contact: typeof v.contact === 'string' ? v.contact : '',
    accent,
    files: { light: file(v.logo_file?.light), dark: file(v.logo_file?.dark) },
  };
}

/** A server (or cached) brand block as state; anything unknown reads as the default, so a corrupt value never reaches the page. */
export function brandFromView(v: Partial<BrandView> | null | undefined, base: BrandLogoState = EMPTY_BRAND): BrandLogoState {
  if (!v || typeof v !== 'object') return base;
  const lf = v.company?.logo_file;
  return {
    companyName: typeof v.company?.name === 'string' ? v.company.name : base.companyName,
    kind: oneOf(COMPANY_KINDS, v.company?.kind, base.kind),
    files: { light: file(lf?.light), dark: file(lf?.dark) },
    size: oneOf(LOGO_SIZES, v.size, base.size),
    logoSide: oneOf(LOGO_SIDES, v.logo_side, base.logoSide),
    companySize: oneOf(COMPANY_SIZES, v.company_logo_size, base.companySize),
    darkMode: oneOf(DARK_MODES, v.dark_mode, base.darkMode),
    titlePrefix: typeof v.title?.prefix === 'string' && v.title.prefix.trim() ? v.title.prefix : base.titlePrefix,
    titleMode: oneOf(TITLE_MODES, v.title?.mode, base.titleMode),
    projectName: typeof v.project?.name === 'string' ? v.project.name : base.projectName,
    wl: v.installer === undefined ? base.wl : installerFromView(v.installer),
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
/** LOGOSIDE-295: the multiplier of the company / installer logo boxes - the general scale unless the administrator gave the company logo its own. */
export const companyScale = (general: LogoSize = state.size, own: CompanySize = state.companySize): number => LOGO_SCALE[own === 'same' ? general : own];

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
    localStorage.setItem(CACHE_KEY, JSON.stringify({ company: { name: next.companyName, kind: next.kind, logo_file: next.files, logo: next.files }, size: next.size, logo_side: next.logoSide, company_logo_size: next.companySize, dark_mode: next.darkMode, title: { prefix: next.titlePrefix, mode: next.titleMode }, project: { name: next.projectName }, installer: { enabled: next.wl.enabled, name: next.wl.name, contact: next.wl.contact, accent: next.wl.accent, logo_file: next.wl.files } }));
  } catch {
    /* private window / blocked storage: the cache is a convenience */
  }
  if (opts.title !== false) applyBrandTitle();
  pushColors();
  listeners.forEach((fn) => fn());
}

// WHITELABEL097-295: while the installer profile is ON and names a preset accent, that accent replaces the installation's `ui.accent`
// (the switch-on colour is left alone). The installation's own colours come from the product settings (sw-app) through applyInstallationColors.
let baseColors: { accent: unknown; toggle: unknown } | null = null;

function pushColors(): void {
  const wl = state.wl;
  const override = wl.enabled && wl.accent !== 'default';
  if (!baseColors) {
    if (override) setBrandColors(wl.accent, brandColors().toggle); // the sign-in page: no product settings yet
    return;
  }
  setBrandColors(override ? wl.accent : baseColors.accent, baseColors.toggle);
}

/** The installation's `ui.accent` / `ui.toggle_on` (product settings): applied through the installer override above. */
export function applyInstallationColors(accent: unknown, toggle: unknown): void {
  baseColors = { accent: normalizeBrand(accent), toggle };
  pushColors();
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

/** The URL of the installer's logo variant (public while the profile is on; a replaced logo is a new file name). */
export function installerLogoUrl(variant: LogoVariant, fileName: string | null = state.wl.files[variant]): string | null {
  return fileName && FILE.test(fileName) ? resourceUrl(`api/v1/brand/white-label/logo/${variant}/${fileName}`) : null;
}

/** The SmplWise product logo (a bundle file; the owner's final artwork replaces these files - CR-LOGOS295 4.1). */

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

// the last known choice names the tab from the first paint (a static preview, a slow /me); an installation that never set anything keeps index.html's title
if (state !== EMPTY_BRAND) {
  applyBrandTitle();
  pushColors(); // WHITELABEL097-295: an installer accent from the cache applies from the first paint
}
