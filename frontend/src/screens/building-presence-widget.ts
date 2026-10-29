import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-icon';
import type { WidgetItem } from '../api/home-config';
import type { BuildingSnapshot } from '../api/building-presence';
import { cardView, clockText, presenceWidgetAvailable } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';

/**
 * PRESENCE-2280: the home widget "נוכחות במבנה" (the building presence card, drawn in the widgets row like every other widget; the approved
 * round-7 mockup). One state word with a lamp (green only while occupied), one quiet line, the rooms that have a sensor as wrapping chips and
 * a note that the numbers are rooms, not people. Read-only. It is ABSENT (edit mode too, no ghost) unless the caller holds
 * presence.building.view and the server reports an enabled, configured module whose home display is "card" (`presenceWidgetAvailable`).
 * Sizes: small = state + the quiet line, medium = + up to 4 room chips, large = + up to 8. The home never scrolls, so the chips are capped
 * (the full list is on the map).
 */

export interface PresenceWidgetHost {
  snap: BuildingSnapshot | null;
  editing: boolean;
  shell: (it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult) => TemplateResult;
}

export { presenceWidgetAvailable };

const CHIPS: Record<WidgetItem['size'], number> = { s: 0, m: 4, l: 8 };

export const PRESENCE_WIDGET_STYLES = css`
  .wg-pres { gap: 6px; }
  .wg-pres .pr-h { display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-sm); color: var(--sw-text-2); font-weight: var(--sw-fw-semibold); min-inline-size: 0; }
  .wg-pres .pr-h b { font-weight: inherit; flex: 1; min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pr-h a { display: inline-flex; align-items: center; min-block-size: 44px; padding-inline: 4px; color: var(--sw-accent-text, var(--sw-accent)); text-decoration: none; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); }
  .wg-pres .pr-h a[aria-disabled='true'] { pointer-events: none; }
  .wg-pres .pr-h a:focus-visible { outline: var(--sw-focus-w, 2px) solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; border-radius: 8px; }
  .wg-pres .pr-state { display: flex; align-items: center; gap: 10px; font-size: var(--sw-fs-xl, 22px); font-weight: var(--sw-fw-bold); line-height: 1.15; }
  .wg-pres .pr-lamp { inline-size: 12px; block-size: 12px; border-radius: 50%; flex: none; background: var(--sw-text-3); }
  .wg-pres[data-tone='ok'] .pr-lamp { background: var(--sw-success); box-shadow: 0 0 0 4px var(--sw-success-soft, transparent); }
  .wg-pres[data-tone='ok'] .pr-state { color: var(--sw-success-text); }
  .wg-pres .pr-sub, .wg-pres .pr-note { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
  .wg-pres .pr-rooms { display: flex; flex-wrap: wrap; gap: 6px; min-inline-size: 0; }
  .wg-pres .pr-r { display: inline-flex; gap: 6px; max-inline-size: 100%; padding: 2px 8px; border: 1px solid var(--sw-border); border-radius: 999px; font-size: var(--sw-fs-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .wg-pres .pr-r[data-tone='ok'] { color: var(--sw-success-text); }
  .wg-pres .pr-r[data-tone='unknown'] { border-style: dashed; color: var(--sw-text-3); }
  .wg-pres .pr-r.more { color: var(--sw-text-2); border-style: dashed; }
`;

/** The widget. Never reached unless the host resolved `presenceWidgetAvailable` first. */
export function renderPresence(h: PresenceWidgetHost, it: WidgetItem): TemplateResult {
  const v = cardView(h.snap);
  const at = clockText(h.snap?.at);
  const cap = CHIPS[it.size];
  const link = html`<a href="#/explore" data-building-card-map aria-disabled=${String(h.editing)} tabindex=${h.editing ? -1 : 0}>${BP.onMap}</a>`;
  const head = html`<div class="pr-h"><sw-icon name="users" size="15"></sw-icon><b>${it.title}${at ? html` <span class="pr-at">· ${BP.updated(at)}</span>` : nothing}</b>${link}</div>`;
  const rooms = cap && v.rooms.length
    ? html`<div class="pr-rooms" data-building-rooms>${v.rooms.slice(0, cap).map((r) => html`<span class="pr-r r" data-tone=${r.tone}>${r.name} · ${r.text}</span>`)}${v.rooms.length > cap ? html`<span class="pr-r r more" data-building-more-rooms>${BP.moreRooms(v.rooms.length - cap)}</span>` : nothing}</div>`
    : nothing;
  return h.shell(it, 'wg-pres', { tone: v.tone }, html`${head}
    <div class="pr-state"><span class="pr-lamp" aria-hidden="true"></span><span data-building-presence-big>${v.big}</span></div>
    <div class="pr-sub">${v.sub}</div>${rooms}${it.size === 'l' ? html`<div class="pr-note">${BP.cardNote}</div>` : nothing}`);
}
