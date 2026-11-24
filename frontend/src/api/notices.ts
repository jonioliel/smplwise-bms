/**
 * CR-NOTICE106: the ONLY module of the application that talks to `/api/v1/notices...` (smplwise_vms/backend/smplwise/routers/notices.py).
 * The TV page (src/notice-tv/) has its own fetch of the display feed and never imports this file.
 */
import { api, del, get, patch, post, put } from './client';
import type { Display, Tv2Defaults, TvDefaults } from '../notice-tv/tv-logic';
import type { TvFitDefaults } from '../notices/display-fit-model';
import type { Severity } from './types';
import type * as Wire from './generated/wire-notices';

export type { Severity } from './types'; // CR-API-PATHS-2439 (07:F21): one definition
/* The answers of the module-gated routes are the backend's response models (smplwise_vms/backend/smplwise/wire/notices.py), generated into
 * ./generated/wire-notices.ts: a field the server renames or drops is a compile error here (code review 07:F8 step 2). Kept by hand on
 * purpose: the audience (a stored document), a board's `display` (the TV page's own document, notice-tv/tv-logic), the TV option defaults,
 * and the answers of the routes that answer while the module is off (module, settings, logos - not modelled yet; the news sources are). Fields an
 * older server lacks stay optional (`can.delete`, the list defaults past `default_severity`, the audience options' `areas`). */

export interface Audience {
  everyone?: boolean;
  floors?: string[];
  areas?: string[];
  groups?: string[];
  roles?: string[];
}

export interface Notice extends Omit<Wire.NoticeRow, 'audience' | 'created_at'> {
  audience?: Audience;
}

/** NOTICEDEL-295: `delete` (`notices.delete`) is absent from older servers. */
type NoticesCan = Omit<Wire.NoticesCan, 'delete'> & Partial<Pick<Wire.NoticesCan, 'delete'>>;

export interface NoticesList extends Omit<Wire.NoticesList, 'notices' | 'can' | 'defaults'> {
  notices: Notice[];
  can: NoticesCan;
  defaults: Pick<Wire.NoticesDefaults, 'default_days' | 'default_severity'> & Partial<Omit<Wire.NoticesDefaults, 'default_days' | 'default_severity'>>;
}

/** A board: the name fields always; the rest only for notices.boards (a notice manager's list carries the names only). NOTICEPERM-295:
 * `has_stored_link` - the link token is also stored sealed, so an administrator can copy the SAME link again. */
export type Board = Wire.NoticeBoardBrief & Partial<Omit<Wire.NoticeBoard, keyof Wire.NoticeBoardBrief | 'display'>> & { display?: Display };
type FullBoard = Omit<Wire.NoticeBoard, 'display'> & { display: Display };
type NoticePush = Wire.NoticePush;

interface NoticesSettings {
  enabled: boolean;
  default_days: number;
  default_severity: 'info' | 'alert';
  push_default: 'by_severity' | 'always' | 'never';
  reads_names: boolean;
  retention_days: number;
  /** NOTICEPAGE-295: the home widget with no active notice - absent, or one line */
  home_empty: 'hide' | 'line';
  /** NOTICEDEL-295: the places tree on the notices page (default on) */
  show_places_tree: boolean;
  boards_remote: boolean;
  boards_max: number;
  weather_entity: string;
  weather_fallback: boolean;
  news_custom: boolean;
  building_name: string;
  boards_origin: string;
  /** NOTICECAPS-295: the TV listener's connection caps (total 4..256, per address 1..64) */
  conn_total: number;
  conn_per_address: number;
  news_sources: NewsSource[];
  /** TVOPT-295: the installation defaults of the TV options (absent from an older backend) */
  tv_defaults?: TvDefaults;
  /** BOARDV2-297: the installation defaults of the V2 board options (absent from an older backend) */
  /** TV-SETTINGS-2380: the group also carries `portrait_chips` / `safe_margin` (absent from an older backend) */
  tv2_defaults?: Tv2Defaults & Partial<TvFitDefaults>;
  /** TV-CHIPS-2381: the entities the parking / gym chips read (absent from an older backend = none) */
  parking_entities?: string[];
  gym_entities?: string[];
  /** BOARD-ANSWERS-2400 (owner 04.11, Q16 = A): the picked on / off entities read the other way round ("הפוך"); absent = none */
  parking_inverted?: string[];
  gym_inverted?: string[];
}

/**
 * NOTICERSS-295: one entry of the installation's editable list of news sources (`custom` = a raw URL a board stored, not yet in the list;
 * `logo_url` = a stamped relative URL of the signed-in logo route, '' without a logo). NOTICE-NEWS-FEEDS-2500: the backend's model
 * (Wire.NoticeNewsSource) with `last_ok_at` / `last_error`, the feed's health; every field past the address stays optional (an older
 * backend, and the settings document that carries the same rows).
 */
export type NewsSource = Pick<Wire.NoticeNewsSource, 'id' | 'name' | 'url'> & Partial<Omit<Wire.NoticeNewsSource, 'id' | 'name' | 'url'>>;
export interface NewsSourcesAnswer extends Omit<Wire.NoticeNewsSources, 'sources'> {
  sources: NewsSource[];
}

export interface SettingsResponse {
  settings: NoticesSettings;
  can: NoticesCan;
  weather_entities: { entity_id: string; name: string }[];
  /** TV-CHIPS-2381: what the parking / gym source pickers may offer (absent from an older backend) */
  info_entities?: { parking?: { entity_id: string; name: string; domain: string }[]; gym?: { entity_id: string; name: string; domain: string }[] };
  company_logo: boolean;
  listener: boolean;
  building_fallback: string;
}

export interface NoticeInput {
  title: string;
  body?: string;
  severity?: Severity;
  starts_at?: string | null;
  ends_at?: string | null;
  until_archived?: boolean;
  pinned?: boolean;
  dwell_s?: number | null;
  clear_dwell?: boolean;
  when_text?: string;
  audience?: Audience;
  boards?: string[];
  publish?: boolean;
  push?: boolean; // NOTICEPUSH-295: the author's tick (omitted = the installation's default)
}

// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICES106B (notice board).
export const noticesModule = () => get<{ enabled: boolean; can: NoticesCan }>('notices/module');
export const noticesSettings = () => get<SettingsResponse>('notices/settings');
export const patchNoticesSettings = (body: Partial<Omit<NoticesSettings, 'news_sources' | 'tv_defaults'>>) => patch<{ settings: NoticesSettings }>('notices/settings', body);
/** TVOPT-295: the installation defaults of the four TV options (notices.boards) */
export const putTvDefaults = (body: Partial<TvDefaults & Tv2Defaults & TvFitDefaults>) => put<{ tv_defaults: TvDefaults; tv2_defaults?: Tv2Defaults & Partial<TvFitDefaults> }>('notices/tv-defaults', body);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICERSS-295 (news sources).
export const getNewsSources = () => get<NewsSourcesAnswer>('notices/news-sources');
/** the whole list in the order shown; a source without an id is new */
export const putNewsSources = (sources: { id?: string; name: string; url: string; enabled: boolean }[]) => put<NewsSourcesAnswer>('notices/news-sources', { sources });
export const uploadNewsLogo = (id: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<NewsSourcesAnswer>(`notices/news-sources/${encodeURIComponent(id)}/logo`, { method: 'PUT', body: form });
};
export const removeNewsLogo = (id: string) => api<NewsSourcesAnswer>(`notices/news-sources/${encodeURIComponent(id)}/logo`, { method: 'DELETE' });
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICES106B (notice board).
export const uploadCompanyLogo = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<{ company_logo: boolean }>('notices/settings/logo', { method: 'PUT', body: form });
};
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICES106B (notice board).
export const removeCompanyLogo = () => del('notices/settings/logo');

export const listNotices = (scope: 'mine' | 'all') => get<NoticesList>(`notices?scope=${scope}`);
export const createNotice = (body: NoticeInput) => post<{ notice: Notice; push?: NoticePush }>('notices', body);
export const patchNotice = (id: string, body: Partial<NoticeInput>) => patch<{ notice: Notice }>(`notices/${encodeURIComponent(id)}`, body);
export const publishNotice = (id: string, push?: boolean) =>
  post<{ notice: Notice; push: NoticePush }>(`notices/${encodeURIComponent(id)}/publish`, push === undefined ? undefined : { push });
/** BOARD-MGMT-2381 (owner 03.11, answer 6A): the manual "שלח שוב" of a published notice - never called automatically after an edit. */
export const resendNotice = (id: string) =>
  post<{ notice: Notice; push: NoticePush }>(`notices/${encodeURIComponent(id)}/resend`);
export const archiveNotice = (id: string) => post<{ notice: Notice }>(`notices/${encodeURIComponent(id)}/archive`);
/** NOTICEDEL-295: `confirmLive` is the extra step for a notice that is on air (the server answers 409 `confirm_live_required` without it). */
export const deleteNotice = (id: string, confirmLive = false) => del(`notices/${encodeURIComponent(id)}${confirmLive ? '?confirm_live=true' : ''}`);
export const markRead = (id: string) => post<Wire.NoticeRead>(`notices/${encodeURIComponent(id)}/read`);
export const audiencePreview = (audience: Audience) => post<Wire.NoticeAudiencePreview>('notices/audience/preview', { audience });
export const audienceOptions = () =>
  get<Omit<Wire.NoticeAudienceOptions, 'areas'> & Partial<Pick<Wire.NoticeAudienceOptions, 'areas'>>>('notices/audience/options');

/** NOTICEPAGE-295: "מי קרא" - names only while the installation shows them (`reads_names`); else the two counts. `place` is absent from
 * a server before NOTICEPAGE-295. */
export interface ReadsAnswer extends Pick<Wire.NoticeReads, 'audience' | 'read'> {
  users?: (Omit<Wire.NoticeReader, 'place'> & Partial<Pick<Wire.NoticeReader, 'place'>>)[];
  unread?: (Omit<Wire.NoticeNonReader, 'place'> & Partial<Pick<Wire.NoticeNonReader, 'place'>>)[];
}
export const getReads = (id: string) => get<ReadsAnswer>(`notices/${encodeURIComponent(id)}/reads`);

/** MULTI-BUILDING-HOME-2500 (Q68): `buildings` - the buildings a board can belong to, only on a multi-building site */
export const listBoards = () => get<{ boards: Board[]; full: boolean } & Partial<Pick<Wire.NoticeBoardListFull, 'max' | 'remote' | 'buildings'>>>('notices/boards');
export const getBoard = (id: string) =>
  get<Omit<Wire.NoticeBoardDetail, 'board'> & { board: FullBoard }>(
    `notices/boards/${encodeURIComponent(id)}`,
  );
export const createBoard = (body: { name: string; slug: string; display?: Partial<Display> }) => post<Omit<Wire.NoticeBoardCreated, 'board'> & { board: FullBoard }>('notices/boards', body);
export const patchBoard = (id: string, body: { name?: string; enabled?: boolean; display?: Partial<Display> | Record<string, unknown>; building_id?: string }) =>
  patch<{ board: FullBoard }>(`notices/boards/${encodeURIComponent(id)}`, body);
export const rotateBoardToken = (id: string) => post<Omit<Wire.NoticeBoardNewToken, 'board'> & { board: FullBoard }>(`notices/boards/${encodeURIComponent(id)}/rotate-token`);
export const getBoardLink = (id: string) => get<Wire.NoticeBoardLink>(`notices/boards/${encodeURIComponent(id)}/link`);
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICEPERM-295 (permanent TV link).
export const issueBoardLink = (id: string) => post<Omit<Wire.NoticeBoardNewToken, 'board'> & { board: FullBoard }>(`notices/boards/${encodeURIComponent(id)}/issue-link`);
export const deleteBoard = (id: string) => del(`notices/boards/${encodeURIComponent(id)}`);
export const putBoardItems = (id: string, notice_ids: string[]) => put<Wire.NoticeBoardItems>(`notices/boards/${encodeURIComponent(id)}/items`, { notice_ids });
export const boardControl = (id: string, cmd: 'next' | 'prev' | 'pause' | 'play') => post<Wire.NoticeBoardControl>(`notices/boards/${encodeURIComponent(id)}/control`, { cmd });

/** The TV link of a board: the page next to the application root, the token in the fragment (never sent to a server). */
export function boardLink(slug: string, token: string, origin?: string): string {
  const base = origin ? origin.replace(/\/+$/, '') + '/' : new URL('./', location.href).toString();
  return `${base}b/${slug}#t=${token}`;
}

// ---- NOTICESLIDES-295: promo slides (one slide may be shown on several boards) and the building photo of template 2
export type Slide = Wire.NoticeSlide;
export type SlidesDoc = Wire.NoticeSlides;
// CR-FE-DEAD-CODE-2442 (O15 a): no caller yet - kept; built ahead by NOTICESLIDES-295 (promo slides).
export const listSlides = () => get<SlidesDoc>('notices/promo-slides/all');
export const boardSlides = (boardId: string) => get<SlidesDoc>(`notices/boards/${encodeURIComponent(boardId)}/slides`);
export const createSlide = (body: { title: string; text?: string; seconds?: number | null; board_ids?: string[] }) => post<Wire.NoticeSlideCreated>('notices/promo-slides', body);
export const patchSlide = (id: string, body: { title?: string; text?: string; seconds?: number | null; board_ids?: string[] }) =>
  patch<SlidesDoc>(`notices/promo-slides/${encodeURIComponent(id)}`, body);
export const deleteSlide = (id: string) => api<SlidesDoc>(`notices/promo-slides/${encodeURIComponent(id)}`, { method: 'DELETE' });
const picture = (path: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<SlidesDoc>(path, { method: 'PUT', body: form });
};
export const putSlideImage = (id: string, file: File) => picture(`notices/promo-slides/${encodeURIComponent(id)}/image`, file);
export const deleteSlideImage = (id: string) => api<SlidesDoc>(`notices/promo-slides/${encodeURIComponent(id)}/image`, { method: 'DELETE' });
export const putBoardPhoto = (boardId: string, file: File) => picture(`notices/boards/${encodeURIComponent(boardId)}/photo`, file);
export const putBoardPhotoNight = (boardId: string, file: File) => picture(`notices/boards/${encodeURIComponent(boardId)}/photo-night`, file);
export const deleteBoardPhotoNight = (boardId: string) => api<SlidesDoc>(`notices/boards/${encodeURIComponent(boardId)}/photo-night`, { method: 'DELETE' });
export const deleteBoardPhoto = (boardId: string) => api<SlidesDoc>(`notices/boards/${encodeURIComponent(boardId)}/photo`, { method: 'DELETE' });
/** The signed-in URL of a slide picture / a board's photo (the stamp is the cache key). */
export const slideImageUrl = (s: Pick<Slide, 'id' | 'stamp'>) => `api/v1/notices/promo-slides/${encodeURIComponent(s.id)}/image?v=${encodeURIComponent(s.stamp)}`;
export const boardPhotoNightUrl = (boardId: string, stamp: string) => `api/v1/notices/boards/${encodeURIComponent(boardId)}/photo-night?v=${encodeURIComponent(stamp)}`;
export const boardPhotoUrl = (boardId: string, stamp: string) => `api/v1/notices/boards/${encodeURIComponent(boardId)}/photo?v=${encodeURIComponent(stamp)}`;
