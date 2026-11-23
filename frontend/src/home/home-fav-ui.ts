// HOME-FAVORITES-2500 (owner 22.11): the favourites grid of a room screen, its pieces outside sw-home.ts.
// Q78: a hole the order leaves in the grid is a "+ הוסף" tile; tapping it offers what may still be added and puts the pick exactly
// there (home-favgrid.ts places the tiles and finds the holes). Q77: in "עריכה", a long press lifts a tile and a drag drops it on
// another tile (it takes that place) or on a hole; the arrows stay. sw-home.ts calls in from sRoom / widget / onPointerDown only.
import { html, nothing } from 'lit';
import { registerScreen, type ExtOvl, type HomeHost } from './home-ext';
import { hi } from './home-icons';
import { paged } from './home-logic';
import type { Fav } from './home-api';
import { addCandidates, cellArea, dropIndex, insertAt, moveTo, type FavHole } from './home-favgrid';
import { tr } from '../i18n/msg/home';

/** How long a press lasts before the tile lifts (ms), and how far the finger may wander before that (px). */
const LIFT_MS = 450;
const SLOP = 10;

type Target = { kind: 'fav'; ix: number; el: HTMLElement } | { kind: 'hole'; at: number; el: HTMLElement };

/** The long-press drag of the favourites grid while "עריכה" is on. Listens on the window from the press to the release only. */
export class FavDrag {
  private timer = 0;
  private start = { x: 0, y: 0 };
  private src: HTMLElement | null = null;
  private from = -1;
  private lifted = false;
  private target: Target | null = null;

  constructor(private readonly h: HomeHost) {}

  /** sw-home's pointerdown: arms the long press on a favourite tile (edit mode only). */
  down(ev: PointerEvent): void {
    if (!this.h.favApi.editing() || ev.button > 0 || this.h.kioskLocked()) return;
    const tile = (ev.composedPath() as Element[]).find((n) => n instanceof HTMLElement && n.classList.contains('wdg') && n.dataset.ix != null) as HTMLElement | undefined;
    if (!tile) return;
    this.reset();
    this.start = { x: ev.clientX, y: ev.clientY };
    this.src = tile;
    this.from = Number(tile.dataset.ix);
    window.addEventListener('pointermove', this.move, { passive: false });
    window.addEventListener('pointerup', this.up);
    window.addEventListener('pointercancel', this.cancel);
    this.timer = window.setTimeout(() => this.lift(), LIFT_MS);
  }

  private lift() {
    const src = this.src;
    if (!src) return;
    this.lifted = true;
    this.h.favApi.claim();
    src.classList.add('fav-lift');
    src.closest('.wgrid')?.classList.add('fav-dragging');
    navigator.vibrate?.(15);
  }

  private move = (ev: PointerEvent) => {
    const dx = ev.clientX - this.start.x;
    const dy = ev.clientY - this.start.y;
    if (!this.lifted) {
      if (Math.abs(dx) + Math.abs(dy) > SLOP) this.reset();
      return;
    }
    ev.preventDefault();
    this.h.favApi.claim();
    if (this.src) this.src.style.translate = `${dx}px ${dy}px`;
    this.mark(this.find(ev.clientX, ev.clientY));
  };

  private up = (ev: PointerEvent) => {
    if (!this.lifted) { this.reset(); return; }
    this.h.favApi.claim();
    const t = this.find(ev.clientX, ev.clientY) ?? this.target;
    const from = this.from;
    this.reset();
    if (!t || (t.kind === 'fav' && t.ix === from)) return;
    const key = this.h.favApi.key();
    const list = this.h.favApi.list(key);
    const to = dropIndex(from, t, list.length);
    if (to === from) return;
    this.h.favApi.save(key, moveTo(list, from, to));
    this.h.toast(tr('הסדר נשמר'));
  };

  private cancel = () => this.reset();

  /** The tile or the hole under the finger (the lifted tile itself lets the pointer through). */
  private find(x: number, y: number): Target | null {
    const root = this.h.renderRoot as ShadowRoot;
    for (const el of root.elementsFromPoint(x, y)) {
      if (!(el instanceof HTMLElement) || el === this.src) continue;
      const cell = el.closest('.wgrid > .wdg[data-ix], .wgrid > .fav-add[data-at]') as HTMLElement | null;
      if (!cell || cell === this.src) continue;
      return cell.dataset.ix != null ? { kind: 'fav', ix: Number(cell.dataset.ix), el: cell } : { kind: 'hole', at: Number(cell.dataset.at), el: cell };
    }
    return null;
  }

  private mark(t: Target | null) {
    if (this.target?.el === t?.el) return;
    this.target?.el.classList.remove('fav-drop');
    t?.el.classList.add('fav-drop');
    this.target = t;
  }

  private reset() {
    window.clearTimeout(this.timer);
    window.removeEventListener('pointermove', this.move);
    window.removeEventListener('pointerup', this.up);
    window.removeEventListener('pointercancel', this.cancel);
    if (this.src) {
      this.src.classList.remove('fav-lift');
      this.src.style.translate = '';
      this.src.closest('.wgrid')?.classList.remove('fav-dragging');
    }
    this.target?.el.classList.remove('fav-drop');
    this.src = null;
    this.target = null;
    this.lifted = false;
  }
}

/** A hole of the grid: "+ הוסף" (nothing on a locked wall panel, where the favourites are not edited). */
export function favHole(h: HomeHost, x: FavHole) {
  if (h.kioskLocked()) return html`<span class="fav-gap" style=${cellArea(x)} aria-hidden="true"></span>`;
  return html`<button class="tile fav-add" style=${cellArea(x)} data-act="favAddAt" data-at=${x.at} aria-label="${tr('הוסף מועדף כאן')}">${hi('plus')}<span class="bt">${tr('הוסף')}</span></button>`;
}

const st: { at: number; key: string } = { at: 0, key: 'home' };

const ICON: Record<Fav['t'], string> = { scene: 'scenes', light: 'bulb', switch: 'plug', climate: 'thermo', shade: 'shade', door: 'door', cam: 'cam', allLights: 'bulb', energy: 'bolt', security: 'shield' };

registerScreen((h: HomeHost) => ({
  id: 'favAdd',
  names: [],
  render: () => nothing,
  ovl(_o: ExtOvl) {
    const all = addCandidates(st.key, h.favApi.world(), h.favApi.list(st.key));
    const pg = paged(all, h.phone ? 4 : 6, h.pg('favAdd'));
    const r = h.ctx();
    return html`<div class="hscrim" data-act="close"></div><section class="sheet dialog wide v3" role="dialog" aria-modal="true" aria-label="${tr('הוספת מועדף')}" data-sheet="favAdd"><header class="menu-h">${hi('star')}<span class="mh-t"><b>${tr('הוספת מועדף')}</b><span class="muted clamp1">${r ? r.name : tr('הבית שלי')}${tr(', במקום הפנוי')}</span></span><button class="rb" data-act="close" aria-label="${tr('סגור')}">${hi('x')}</button></header>
      ${pg.items.length ? html`<div class="pick-list wide fav-pick">${pg.items.map((f, i) => html`<button class="mrow" data-act="favAddPick" data-i=${String(i)}>${hi(ICON[f.t])}<span class="clamp1">${h.favApi.label(f)}</span></button>`)}</div>${h.pager('favAdd', pg.pages)}`
        : html`<p class="muted">${tr('כל מה שאפשר כבר נמצא במועדפים כאן.')}</p>`}</section>`;
  },
  acts: {
    favAddAt: (el) => {
      st.at = Number(el.dataset.at ?? 0);
      st.key = h.favApi.key();
      h.page = { ...h.page, favAdd: 0 };
      h.ovl = { type: 'ext', mod: 'favAdd' } as ExtOvl;
    },
    favAddPick: (el) => {
      const all = addCandidates(st.key, h.favApi.world(), h.favApi.list(st.key));
      const per = h.phone ? 4 : 6;
      const f = all[h.pg('favAdd') * per + Number(el.dataset.i ?? 0)];
      if (!f) return;
      h.favApi.save(st.key, insertAt(h.favApi.list(st.key), st.at, f));
      h.ovl = null;
      h.toast(tr('נוסף למועדפים'));
    },
  },
}));
