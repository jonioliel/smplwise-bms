/**
 * The summary tiles' shape (owner 2026-09-29): the Live overview's "תמונת מצב" tiles and the devices screens' counters
 * ("0/33 מתגים פעילים") are either tall CARDS (icon above the value - today's look) or COMPACT rectangles (the icon at
 * the inline-start side, the value and label beside it, one line of secondary text).
 *
 * The product setting `ui.tile_layout` (הגדרות › כללי › עיצוב הממשק) is the installation default: `auto` (compact on a
 * narrow screen - under COMPACT_BELOW_PX - cards above), `cards` or `compact`. A browser can override
 * it for itself (localStorage, never sent to the server). The resolved shape is put on a screen's host as
 * `data-tile-layout="cards" | "compact"` and on each tile (`sw-kpi layout=...`); the sizes are theme knobs
 * (docs/design/DEVICE_THEMES.md §9, styles/tile-knobs.ts).
 */
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { productSettings } from './prefs';
import { isApi } from './session';

/** The setting's values (keep in step with ui.tile_layout in smplwise_vms/backend/smplwise/routers/settings.py). */
export const TILE_LAYOUTS = ['auto', 'cards', 'compact'] as const;
export type TileLayoutSetting = (typeof TILE_LAYOUTS)[number];
export type TileLayout = 'cards' | 'compact';

/** `auto` is compact below this viewport width (a phone), cards from it up. */
export const COMPACT_BELOW_PX = 600;
const OVERRIDE_KEY = 'sw.tiles.override';

export const TILE_LAYOUT_LABEL: Record<TileLayoutSetting, string> = { auto: 'אוטומטי', cards: 'כרטיסים', compact: 'קומפקטי' };

function isSetting(v: unknown): v is TileLayoutSetting {
  return typeof v === 'string' && (TILE_LAYOUTS as readonly string[]).includes(v);
}

let installation: TileLayoutSetting = 'auto';
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
let query: MediaQueryList | null = null;

function safeGet(): string | null {
  try {
    return localStorage.getItem(OVERRIDE_KEY);
  } catch {
    return null;
  }
}

function notify() {
  listeners.forEach((fn) => fn());
}

function watchWidth() {
  if (query) return;
  try {
    query = window.matchMedia(`(max-width: ${COMPACT_BELOW_PX - 1}px)`);
    query.addEventListener('change', notify);
  } catch {
    query = null;
  }
}

/** This browser's own choice, or null (then the installation's setting applies). */
export function tileLayoutOverride(): TileLayoutSetting | null {
  const v = safeGet();
  return isSetting(v) ? v : null;
}

export function setTileLayoutOverride(v: TileLayoutSetting | null) {
  try {
    if (v === null) localStorage.removeItem(OVERRIDE_KEY);
    else localStorage.setItem(OVERRIDE_KEY, v);
  } catch {
    /* private mode: the choice lasts for this page only */
  }
  notify();
}

/** The installation's setting as last read (or saved from the settings screen). */
export function installationTileLayout(): TileLayoutSetting {
  return installation;
}

/** The settings screen saved a new installation value: every open screen follows at once. */
export function setInstallationTileLayout(v: unknown) {
  installation = isSetting(v) ? v : 'auto';
  notify();
}

/** The setting in force in this browser: its own override, else the installation's. */
export function effectiveTileSetting(): TileLayoutSetting {
  return tileLayoutOverride() ?? installation;
}

/** `auto` resolved against the viewport width. */
export function resolveTileLayout(setting: TileLayoutSetting = effectiveTileSetting(), width?: number): TileLayout {
  if (setting !== 'auto') return setting;
  const w = width ?? (typeof window !== 'undefined' ? window.innerWidth : 1024);
  return w < COMPACT_BELOW_PX ? 'compact' : 'cards';
}

/** Reads the installation's setting once per page load (the shared settings cache); never throws. */
export function loadTileLayout(): Promise<void> {
  if (!loaded) {
    loaded = (async () => {
      if (!isApi()) return;
      try {
        setInstallationTileLayout((await productSettings())['ui.tile_layout']);
      } catch {
        /* keep auto */
      }
    })();
  }
  return loaded;
}

export function onTileLayout(fn: () => void): () => void {
  watchWidth();
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * A screen's tile shape: resolves the setting (and re-resolves it on a width change, an override or a saved setting),
 * reflects it on the host as `data-tile-layout` and re-renders the host. `layout` is what to pass to each `sw-kpi`.
 */
export class TileLayoutController implements ReactiveController {
  layout: TileLayout = resolveTileLayout();
  private off: (() => void) | null = null;

  constructor(private host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
  }

  private apply = () => {
    const next = resolveTileLayout();
    this.host.setAttribute('data-tile-layout', next);
    if (next !== this.layout) {
      this.layout = next;
      this.host.requestUpdate();
    }
  };

  hostConnected() {
    this.off = onTileLayout(this.apply);
    this.layout = resolveTileLayout();
    this.host.setAttribute('data-tile-layout', this.layout);
    void loadTileLayout().then(this.apply);
  }

  hostDisconnected() {
    this.off?.();
    this.off = null;
  }
}
