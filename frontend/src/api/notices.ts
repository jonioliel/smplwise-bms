/**
 * CR-NOTICE106: the ONLY module of the application that talks to `/api/v1/notices...` (smplwise_vms/backend/smplwise/routers/notices.py).
 * The TV page (src/notice-tv/) has its own fetch of the display feed and never imports this file.
 */
import { api, del, get, patch, post, put } from './client';
import type { Display } from '../notice-tv/tv-logic';

export type Severity = 'info' | 'alert' | 'critical';
export type NoticeState = 'draft' | 'scheduled' | 'active' | 'expired' | 'archived';

export interface Audience {
  everyone?: boolean;
  floors?: string[];
  areas?: string[];
  groups?: string[];
  roles?: string[];
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  starts_at: string;
  ends_at: string | null;
  pinned: boolean;
  state: NoticeState;
  dwell_s: number | null;
  when_text: string | null;
  published_at: string | null;
  updated_at: string;
  boards: string[];
  read?: boolean;
  audience?: Audience;
  status?: 'draft' | 'published' | 'archived';
  reads?: number;
  push_requested?: boolean;
  pushed_at?: string | null;
}

export interface NoticesCan {
  view: boolean;
  manage: boolean;
  manage_all: boolean;
  push: boolean;
  boards: boolean;
  configure: boolean;
  /** NOTICEDEL-295: `notices.delete` (absent from older servers) */
  delete?: boolean;
}

export interface NoticesList {
  notices: Notice[];
  can: NoticesCan;
  now: string;
  defaults: { default_days: number; default_severity: 'info' | 'alert'; push_default?: 'by_severity' | 'always' | 'never'; home_empty?: 'hide' | 'line'; show_places_tree?: boolean };
}

export interface Board {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  display?: Display;
  has_token?: boolean;
  /** NOTICEPERM-295: the link token is also stored sealed, so an administrator can copy the SAME link again. */
  has_stored_link?: boolean;
  token_rotated_at?: string | null;
  last_seen_at?: string | null;
  item_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface NoticesSettings {
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
}

/** NOTICERSS-295: one entry of the installation's editable list of news sources (`custom` = a raw URL a board stored, not yet in the list). */
export interface NewsSource {
  id: string;
  name: string;
  url: string;
  enabled?: boolean;
  has_logo?: boolean;
  /** a stamped relative URL of the signed-in logo route ('' without a logo) */
  logo_url?: string;
  custom?: boolean;
}
export interface NewsSourcesAnswer {
  sources: NewsSource[];
  max: number;
  name_max: number;
}

export interface SettingsResponse {
  settings: NoticesSettings;
  can: NoticesCan;
  weather_entities: { entity_id: string; name: string }[];
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

export const noticesModule = () => get<{ enabled: boolean; can: NoticesCan }>('notices/module');
export const noticesSettings = () => get<SettingsResponse>('notices/settings');
export const patchNoticesSettings = (body: Partial<Omit<NoticesSettings, 'news_sources'>>) => patch<{ settings: NoticesSettings }>('notices/settings', body);
export const getNewsSources = () => get<NewsSourcesAnswer>('notices/news-sources');
/** the whole list in the order shown; a source without an id is new */
export const putNewsSources = (sources: { id?: string; name: string; url: string; enabled: boolean }[]) => put<NewsSourcesAnswer>('notices/news-sources', { sources });
export const uploadNewsLogo = (id: string, file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<NewsSourcesAnswer>(`notices/news-sources/${encodeURIComponent(id)}/logo`, { method: 'PUT', body: form });
};
export const removeNewsLogo = (id: string) => api<NewsSourcesAnswer>(`notices/news-sources/${encodeURIComponent(id)}/logo`, { method: 'DELETE' });
export const uploadCompanyLogo = (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return api<{ company_logo: boolean }>('notices/settings/logo', { method: 'PUT', body: form });
};
export const removeCompanyLogo = () => del('notices/settings/logo');

export const listNotices = (scope: 'mine' | 'all') => get<NoticesList>(`notices?scope=${scope}`);
export const createNotice = (body: NoticeInput) => post<{ notice: Notice; push?: { requested: boolean; sent: boolean; recipients: number } }>('notices', body);
export const patchNotice = (id: string, body: Partial<NoticeInput>) => patch<{ notice: Notice }>(`notices/${encodeURIComponent(id)}`, body);
export const publishNotice = (id: string, push?: boolean) =>
  post<{ notice: Notice; push?: { requested: boolean; sent: boolean; recipients: number } }>(`notices/${encodeURIComponent(id)}/publish`, push === undefined ? undefined : { push });
export const archiveNotice = (id: string) => post<{ notice: Notice }>(`notices/${encodeURIComponent(id)}/archive`);
/** NOTICEDEL-295: `confirmLive` is the extra step for a notice that is on air (the server answers 409 `confirm_live_required` without it). */
export const deleteNotice = (id: string, confirmLive = false) => del(`notices/${encodeURIComponent(id)}${confirmLive ? '?confirm_live=true' : ''}`);
export const markRead = (id: string) => post<{ read: boolean }>(`notices/${encodeURIComponent(id)}/read`);
export const audiencePreview = (audience: Audience) => post<{ users: number; in_scope: boolean }>('notices/audience/preview', { audience });
export const audienceOptions = () =>
  get<{ floors: { id: string; name: string; building: string }[]; areas?: { id: string; name: string; floor: string }[]; groups: { id: string; name: string }[]; roles: { id: string; name: string }[] }>('notices/audience/options');

/** NOTICEPAGE-295: "מי קרא" - names only while the installation shows them (`reads_names`); else the two counts. */
export interface ReadsAnswer {
  audience: number;
  read: number;
  users?: { user_id: string; name: string; place?: string; read_at: string }[];
  unread?: { user_id: string; name: string; place?: string }[];
}
export const getReads = (id: string) => get<ReadsAnswer>(`notices/${encodeURIComponent(id)}/reads`);

export const listBoards = () => get<{ boards: Board[]; full: boolean; max?: number; remote?: boolean }>('notices/boards');
export const getBoard = (id: string) =>
  get<{ board: Board; notices: { id: string; title: string; severity: Severity; starts_at: string; ends_at: string | null; pinned: boolean; state: NoticeState; position: number }[] }>(
    `notices/boards/${encodeURIComponent(id)}`,
  );
export const createBoard = (body: { name: string; slug: string; display?: Partial<Display> }) => post<{ board: Board; token: string }>('notices/boards', body);
export const patchBoard = (id: string, body: { name?: string; enabled?: boolean; display?: Partial<Display> | Record<string, unknown> }) =>
  patch<{ board: Board }>(`notices/boards/${encodeURIComponent(id)}`, body);
export const rotateBoardToken = (id: string) => post<{ token: string; board: Board }>(`notices/boards/${encodeURIComponent(id)}/rotate-token`);
export const getBoardLink = (id: string) => get<{ token: string }>(`notices/boards/${encodeURIComponent(id)}/link`);
export const issueBoardLink = (id: string) => post<{ token: string; board: Board }>(`notices/boards/${encodeURIComponent(id)}/issue-link`);
export const deleteBoard = (id: string) => del(`notices/boards/${encodeURIComponent(id)}`);
export const putBoardItems = (id: string, notice_ids: string[]) => put<{ notice_ids: string[] }>(`notices/boards/${encodeURIComponent(id)}/items`, { notice_ids });
export const boardControl = (id: string, cmd: 'next' | 'prev' | 'pause' | 'play') => post<{ control: { seq: number; cmd: string } }>(`notices/boards/${encodeURIComponent(id)}/control`, { cmd });

/** The TV link of a board: the page next to the application root, the token in the fragment (never sent to a server). */
export function boardLink(slug: string, token: string, origin?: string): string {
  const base = origin ? origin.replace(/\/+$/, '') + '/' : new URL('./', location.href).toString();
  return `${base}b/${slug}#t=${token}`;
}

// ---- NOTICESLIDES-295: promo slides (one slide may be shown on several boards) and the building photo of template 2
export interface Slide {
  id: string;
  title: string;
  text: string;
  seconds: number | null;
  has_image: boolean;
  stamp: string;
  boards: string[];
}
export interface SlidesDoc {
  slides: Slide[];
  limit: number;
  seconds: { min: number; max: number };
  photo?: { has: boolean; stamp: string };
}
export const listSlides = () => get<SlidesDoc>('notices/promo-slides/all');
export const boardSlides = (boardId: string) => get<SlidesDoc>(`notices/boards/${encodeURIComponent(boardId)}/slides`);
export const createSlide = (body: { title: string; text?: string; seconds?: number | null; board_ids?: string[] }) => post<{ id: string } & SlidesDoc>('notices/promo-slides', body);
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
export const deleteBoardPhoto = (boardId: string) => api<SlidesDoc>(`notices/boards/${encodeURIComponent(boardId)}/photo`, { method: 'DELETE' });
/** The signed-in URL of a slide picture / a board's photo (the stamp is the cache key). */
export const slideImageUrl = (s: Pick<Slide, 'id' | 'stamp'>) => `api/v1/notices/promo-slides/${encodeURIComponent(s.id)}/image?v=${encodeURIComponent(s.stamp)}`;
export const boardPhotoUrl = (boardId: string, stamp: string) => `api/v1/notices/boards/${encodeURIComponent(boardId)}/photo?v=${encodeURIComponent(stamp)}`;
