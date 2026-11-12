// HOME-V3-P1-2430: the "עוד בבית" hub (mockup v3 `S.more`): every added capability as a tile with its live line. The tiles come from
// more-registry.ts (each module registers its own); a capability whose module or permission is off has no tile. Pages, never scrolls.
import { html, nothing } from 'lit';
import { registerScreen, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import { moreTiles } from './more-registry';

/** Keeps the home screen's "עוד" chip line current (tiles shown, waiting badges). */
export function moreSummary(h: HomeHost): { tiles: number; badges: number } {
  const tiles = moreTiles(h);
  const badges = tiles.reduce((a, t) => a + (t.line(h).badge ?? 0), 0);
  const v = { tiles: tiles.length, badges };
  h.extState.moreSummary = v;
  return v;
}

registerScreen((h: HomeHost) => ({
  id: 'more',
  names: ['more'],
  navCur: () => 'more',
  back: () => null,
  enter() {
    for (const t of moreTiles(h)) t.warm?.(h);
  },
  render() {
    const all = moreTiles(h);
    moreSummary(h);
    const pg = paged(all, h.phone ? 12 : 18, h.pg('hub'));
    if (!all.length) return html`${h.head('עוד בבית', '')}${h.empty('grid', 'אין כאן עדיין יכולות נוספות', 'מנהל הבית מפעיל יכולות נוספות לכל אדם. כשיופעלו, הן יופיעו כאן.')}`;
    return html`${h.head('עוד בבית', 'כל מה שהבית יודע לעשות, מעבר לחדרים', h.pager('hub', pg.pages))}
      <div class="hub">${pg.items.map((t) => {
        const l = t.line(h);
        return html`<a class="tile hubt" href=${h.href(t.href)} data-mod=${t.id} data-act=${t.act?.(h) ?? nothing}>${l.badge ? html`<b class="count num">${l.badge}</b>` : nothing}${hi(t.icon)}<b class="hl clamp1">${t.label}</b><span class="hs2 clamp2" data-tone=${l.tone ?? nothing}>${l.tone ? html`<i class="dot"></i>` : nothing}${l.text}</span></a>`;
      })}</div>`;
  },
}));
