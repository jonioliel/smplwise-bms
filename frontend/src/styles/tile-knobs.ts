import { css } from 'lit';

/**
 * The summary tiles' compact shape (owner 2026-09-29, setting `ui.tile_layout`, api/tile-layout.ts) as theme knobs, so a
 * designer adjusts it without touching a screen (docs/design/DEVICE_THEMES.md §9).
 *
 * `sw-kpi` reads only `--sw-kpi-compact-*` (with its own fallbacks). Two families set them:
 * - the device screens: `--dv-kpi-*` (styles/devices-themes.ts, every style and palette; a palette may override them);
 * - the Live overview: `--lv-tile-*` (below, `liveTileKnobs`, on the live-overview host).
 * Both families have the same suffixes and roles.
 */
export const TILE_KNOBS: Record<string, string> = {
  'compact-min-block': 'minimum height of a compact tile (the tap target is the whole tile - keep >= 44px)',
  'compact-pad-block': 'compact tile padding, top and bottom',
  'compact-pad-inline': 'compact tile padding, start and end',
  'compact-gap': 'space between the icon and the text',
  'compact-icon': 'size of the icon square at the inline start',
  'compact-value-fs': 'font size of the value ("0/33")',
  'compact-col-min': 'minimum column width of the compact grid on a tablet / desktop (auto-fill)',
  'compact-cols-phone': 'columns of the compact grid on a phone (under 600px)',
  'compact-grid-gap': 'gap between compact tiles',
};

/** The Live overview's knobs (its "תמונת מצב" tiles). */
export const liveTileKnobs = css`
  :host {
    --lv-tile-compact-min-block: 60px;
    --lv-tile-compact-pad-block: 8px;
    --lv-tile-compact-pad-inline: 12px;
    --lv-tile-compact-gap: 10px;
    --lv-tile-compact-icon: 32px;
    --lv-tile-compact-value-fs: 17px;
    --lv-tile-compact-col-min: 168px;
    --lv-tile-compact-cols-phone: 2;
    --lv-tile-compact-grid-gap: 8px;
    --sw-kpi-compact-min-block: var(--lv-tile-compact-min-block);
    --sw-kpi-compact-pad-block: var(--lv-tile-compact-pad-block);
    --sw-kpi-compact-pad-inline: var(--lv-tile-compact-pad-inline);
    --sw-kpi-compact-gap: var(--lv-tile-compact-gap);
    --sw-kpi-compact-icon: var(--lv-tile-compact-icon);
    --sw-kpi-compact-value-fs: var(--lv-tile-compact-value-fs);
  }
`;
