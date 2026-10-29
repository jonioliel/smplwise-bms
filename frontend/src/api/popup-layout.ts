/**
 * AREAEDIT-2290: what the area quick-control pop-up shows and in which order - the types, the tolerant reader and the two save calls.
 * Stored on the server inside `home.screen.popup` (smplwise_vms/backend/smplwise/services/popup_layout.py keeps the same section list;
 * tests/test_popup_layout_2290.py compares it). A layout only reduces or reorders what a person may already see: the pop-up intersects
 * it with the devices the server returned for that person, so no permission depends on it.
 */
import { ApiError, put } from './client';
import { invalidateSettings } from './prefs';
import type { PopupAlert } from './home-screen';

/** Every section of the pop-up, in today's fixed order. */
export const POPUP_SECTIONS = ['quick', 'lighting', 'switches', 'climate', 'heating', 'covers', 'media', 'sensors', 'cameras', 'scenes', 'schedules', 'events'] as const;
/** The sections whose single items the manager may hide / reorder. */
export const POPUP_ITEM_SECTIONS = ['lighting', 'switches', 'climate', 'heating', 'covers', 'media', 'sensors', 'cameras'] as const;

export interface PopupItems {
  order: string[];
  hidden: string[];
}
export interface PopupLayout {
  /** Section ids in the order shown; a section missing from the list follows, in today's order. */
  sections: string[];
  hidden: string[];
  items: Record<string, PopupItems>;
}
export interface PopupState {
  version: number;
  site: PopupLayout | null;
  areas: Record<string, PopupLayout>;
}

export const EMPTY_LAYOUT: PopupLayout = { sections: [], hidden: [], items: {} };

const strings = (v: unknown, allowed?: readonly string[]): string[] => {
  const out: string[] = [];
  if (Array.isArray(v)) for (const x of v) if (typeof x === 'string' && x && (!allowed || allowed.includes(x)) && !out.includes(x)) out.push(x);
  return out;
};

export function layoutOf(raw: unknown): PopupLayout | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const items: Record<string, PopupItems> = {};
  if (o.items && typeof o.items === 'object') {
    for (const [sec, v] of Object.entries(o.items as Record<string, unknown>)) {
      if (!(POPUP_ITEM_SECTIONS as readonly string[]).includes(sec) || !v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      const it = { order: strings(e.order), hidden: strings(e.hidden) };
      if (it.order.length || it.hidden.length) items[sec] = it;
    }
  }
  return { sections: strings(o.sections, POPUP_SECTIONS), hidden: strings(o.hidden, POPUP_SECTIONS), items };
}

/** What the server sent, read tolerantly: anything missing or foreign = nothing configured (today's fixed pop-up). */
export function popupOf(raw: unknown): PopupState {
  const out: PopupState = { version: 0, site: null, areas: {} };
  if (!raw || typeof raw !== 'object') return out;
  const o = raw as Record<string, unknown>;
  if (typeof o.version === 'number' && Number.isInteger(o.version) && o.version >= 0) out.version = o.version;
  out.site = layoutOf(o.site);
  if (o.areas && typeof o.areas === 'object') {
    for (const [id, v] of Object.entries(o.areas as Record<string, unknown>)) {
      const l = layoutOf(v);
      if (id && l) out.areas[id] = l;
    }
  }
  return out;
}

export interface PopupSaved {
  popup: PopupState;
  popup_alert: PopupAlert;
  affected_areas?: number;
}

/** Save one area's layout (`layout` null = back to the site default) or, with `areaId` null, the site default. A stale `version` throws an
 * ApiError with code `version_conflict` unless `force`. `alert` (site saves, and area saves by an installation manager) sets the alert choice. */
export async function savePopupLayout(areaId: string | null, version: number, layout: PopupLayout | null, opts: { force?: boolean; alert?: PopupAlert } = {}): Promise<PopupSaved> {
  const path = areaId === null ? '/devices/popup-layout' : `/devices/areas/${encodeURIComponent(areaId)}/popup-layout`;
  const body: Record<string, unknown> = { version, layout };
  if (opts.force) body.force = true;
  if (opts.alert) body.popup_alert = opts.alert;
  const r = await put<{ popup: unknown; popup_alert: PopupAlert; affected_areas?: number }>(path, body);
  invalidateSettings();
  return { popup: popupOf(r.popup), popup_alert: r.popup_alert, affected_areas: r.affected_areas };
}

export const isVersionConflict = (e: unknown): boolean => e instanceof ApiError && e.code === 'version_conflict';
