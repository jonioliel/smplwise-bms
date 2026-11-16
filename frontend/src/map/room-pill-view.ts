/**
 * PLAN3D-R28-UI-2433: the DOM side of the room pills (room-pills.ts) and of the spread levels' tags (stack-layout.ts) over the 3D
 * view, kept out of sw-plan-3d (the element that also owns the stage, the probe, the time pill, the strip and the walk) as a Lit
 * reactive controller: the element hands it the pills, the tags and the settings, renders its template inside the stage, and calls
 * `layout()` after every drawn frame. The controller projects the points itself (one batch per frame, one size read per new text),
 * picks the distance (far / mid) and the near room, stacks overlapping pills (pill-layout.ts), and asks the element for a render
 * only when the distance, the near room or the popover changed - never per frame.
 *
 * What a pill does (round 28, questions.html group א): a tap opens the small popover (the room's devices by weight, each row selects
 * its device; "כרטיס החדר" opens the room card) or, with `map.room_pill_tap` = card, the room card at once; a mouse hover opens the
 * popover too (it closes when the pointer leaves both). Every panel here is a HUD panel: the opaque menu surface, the strong border.
 */
import { css, html, nothing, type ReactiveController, type ReactiveControllerHost, type TemplateResult } from 'lit';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { resolvePillOverlaps, type PillBox } from './pill-layout';
import { isQuiet, nearRoom, openWords, pillAria, pillLod, pillTone, popoverRows, soleDevice, type PillLod, type RoomDevice, type RoomPill, type RoomPillPrefs, DEFAULT_PILL_PREFS } from './room-pills';
import { temperatureText } from './room-state';
import type { LevelTag } from './stack-layout';
import type { Vec3 } from './scene-builder';

export interface RoomOpenDetail {
  id: string;
}
export interface StackLevelDetail {
  id: string;
  /** "פתח את הקומה": enter the level now (the tag's tap leaves it to the host's pick rule). */
  enter: boolean;
}
/** What the controller needs from the element. */
export interface PillHost extends ReactiveControllerHost, HTMLElement {
  renderRoot: HTMLElement | DocumentFragment;
}
interface Projector {
  projectPoints(points: readonly Vec3[]): ({ x: number; y: number } | null)[];
}

const POP_W = 264;
const HOVER_OPEN_MS = 160;
const HOVER_CLOSE_MS = 240;
/** The pill's bottom edge stands this far above its point (as the entity pills). */
const GAP_PX = 6;

export class RoomPillLayer implements ReactiveController {
  pills: RoomPill[] = [];
  tags: LevelTag[] = [];
  prefs: RoomPillPrefs = DEFAULT_PILL_PREFS;
  /** The room shown as selected (the room card is open on it). */
  selected: string | null = null;
  /** Summarised but not drawn (the level tags speak for the levels). */
  hidden = false;
  /** Off in the walk and in the wall's bare view. */
  active = true;
  /** The phone-wide stage (sw-plan-3d PHONE_STAGE_PX): always far. */
  phoneW = 640;
  lod: PillLod = 'mid';
  near: string | null = null;
  pop: string | null = null;
  private pinned = false;
  private hoverTimer = 0;
  private sizes = new Map<string, { w: number; h: number }>();
  private placed = new Map<string, { x: number; y: number; w: number; h: number }>();

  constructor(private readonly host: PillHost) {
    host.addController(this);
  }

  /** A render of the element with the changed key recorded (its willUpdate re-filters the entity pills on `pillNear`). */
  private request(key: string, old: unknown): void {
    (this.host as unknown as { requestUpdate(name: string, oldValue: unknown): void }).requestUpdate(key, old);
  }

  private readonly onDown = (e: Event): void => {
    if (!this.pop) return;
    const inside = e.composedPath().some((n) => n instanceof HTMLElement && (n.classList.contains('rpop') || n.classList.contains('rp')));
    if (!inside) this.closePop();
  };
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.closePop();
  };

  hostConnected(): void {
    this.host.addEventListener('pointerdown', this.onDown, true);
    this.host.addEventListener('keydown', this.onKey);
  }

  hostDisconnected(): void {
    window.clearTimeout(this.hoverTimer);
    this.host.removeEventListener('pointerdown', this.onDown, true);
    this.host.removeEventListener('keydown', this.onKey);
  }

  /** The members of a pilled room that show as their own pills now: none at mid / far, every one of the near room
   * (`room` mode). The element keeps an entity pill unless this says it is summarised. */
  summarised(anchorId: string): boolean {
    if (!this.active || !this.pills.length || this.prefs.mode === 'device') return false;
    for (const p of this.pills) {
      if (!p.devices.some((d) => d.anchorId === anchorId)) continue;
      return !(this.prefs.mode === 'room' && p.id === this.near);
    }
    return false;
  }

  /** Drop the popover (the pills changed under it, or Escape). */
  closePop(): void {
    if (!this.pop) return;
    const old = this.pop;
    this.pop = null;
    this.pinned = false;
    this.request('pillPop', old);
  }

  private openPop(id: string, pin: boolean): void {
    window.clearTimeout(this.hoverTimer);
    const old = this.pop;
    this.pop = id;
    this.pinned = pin;
    if (old !== id) this.request('pillPop', old);
  }

  private emit<T>(name: string, detail: T): void {
    this.host.dispatchEvent(new CustomEvent<T>(name, { detail, bubbles: true, composed: true }));
  }

  private onPillClick(e: Event, p: RoomPill): void {
    e.stopPropagation();
    if (this.prefs.tap === 'card' || !p.devices.length) {
      this.closePop();
      this.emit<RoomOpenDetail>('room-open', { id: p.id });
      return;
    }
    if (this.pop === p.id && this.pinned) this.closePop();
    else this.openPop(p.id, true);
  }

  private onPillEnter(e: PointerEvent, p: RoomPill): void {
    if (e.pointerType !== 'mouse' || this.prefs.tap === 'card' || !p.devices.length || this.pinned) return;
    window.clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => this.openPop(p.id, false), HOVER_OPEN_MS);
  }

  private onLeave(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || this.pinned) return;
    window.clearTimeout(this.hoverTimer);
    this.hoverTimer = window.setTimeout(() => this.closePop(), HOVER_CLOSE_MS);
  }

  private onPopEnter(): void {
    window.clearTimeout(this.hoverTimer);
  }

  private pill(p: RoomPill, lod: PillLod, dim: boolean): TemplateResult {
    const tone = pillTone(p);
    const quiet = isQuiet(p);
    const sole = soleDevice(p);
    const pressed = this.selected === p.id || this.pop === p.id;
    const common = (cls: string, body: TemplateResult) => html`<button type="button" class=${`rp ${cls}${dim ? ' dim' : ''}`} data-room-pill=${p.id} data-rp-part=${p.id} data-tone=${tone} data-lod=${lod}
      aria-label=${pillAria(p)} aria-pressed=${pressed ? 'true' : 'false'} aria-haspopup=${this.prefs.tap === 'popover' && p.devices.length ? 'dialog' : nothing}
      @click=${(e: Event) => this.onPillClick(e, p)} @pointerenter=${(e: PointerEvent) => this.onPillEnter(e, p)} @pointerleave=${(e: PointerEvent) => this.onLeave(e)}>${body}</button>`;
    if (quiet && !sole) {
      if (this.prefs.quiet === 'bubble') return common('', html`<span class="n">${p.name}</span><i class="sep"></i><span class="s">הכול סגור</span>`);
      return common('quiet', html`<span class="n">${p.name}</span>`);
    }
    if (sole && lod !== 'far') {
      return common('sole', html`<sw-icon name=${sole.icon as IconName} size=${13}></sw-icon><span class="n">${sole.label}</span>${sole.words ? html`<i class="sep"></i><span class="s" data-kind=${sole.kind}>${sole.words}</span>` : nothing}`);
    }
    if (lod === 'far') {
      return common('far', html`<span class="n">${p.name}</span>${p.open ? html`<i class="b open">${p.open}</i>` : nothing}${p.presence ? html`<i class="b pres"></i>` : nothing}${p.lit ? html`<i class="b lit">${p.lit}</i>` : nothing}`);
    }
    const parts: TemplateResult[] = [];
    if (p.open) parts.push(html`<span class="s open">${openWords(p.open)}</span>`);
    if (p.presence) parts.push(html`<span class="s pres"><sw-icon name="user" size=${13}></sw-icon></span>`);
    if (p.lit) parts.push(html`<span class="s lit"><sw-icon name="light" size=${13}></sw-icon><span class="num">${p.lit}</span></span>`);
    if (p.temp !== null) parts.push(html`<span class="s num">${temperatureText(p.temp)}</span>`);
    return common('', html`<span class="n">${p.name}</span>${parts.map((x) => html`<i class="sep"></i>${x}`)}`);
  }

  private row(d: RoomDevice): TemplateResult {
    return html`<button type="button" class="row" data-kind=${d.kind} data-rp-device=${d.anchorId} @click=${(e: Event) => { e.stopPropagation(); this.closePop(); this.emit('part-select', { id: d.anchorId, kind: 'entity' }); }}>
      <sw-icon name=${d.icon as IconName} size=${15}></sw-icon><span class="l">${d.label}</span><span class="v">${d.words}</span></button>`;
  }

  private popover(p: RoomPill): TemplateResult {
    const r = popoverRows(p, 6);
    return html`<div class="rpop" role="dialog" aria-label=${p.name} data-room-pop=${p.id} @pointerenter=${() => this.onPopEnter()} @pointerleave=${(e: PointerEvent) => this.onLeave(e)} @click=${(e: Event) => e.stopPropagation()}>
      <h3>${p.name}<small>${p.devices.length} התקנים</small></h3>
      ${r.open.length ? html`<div class="grp">פתוחים (${p.devices.filter((d) => d.kind === 'open').length})</div>${r.open.map((d) => this.row(d))}` : nothing}
      ${r.lit.length ? html`<div class="grp">אורות דולקים (${p.devices.filter((d) => d.kind === 'lit').length})</div>${r.lit.map((d) => this.row(d))}` : nothing}
      ${r.rest.length ? html`<div class="grp">מצב</div>${r.rest.map((d) => this.row(d))}` : nothing}
      ${r.more ? html`<div class="moredev">ועוד ${r.more} התקנים בכרטיס החדר</div>` : nothing}
      <button type="button" class="card" data-room-pop-card @click=${(e: Event) => { e.stopPropagation(); this.closePop(); this.emit<RoomOpenDetail>('room-open', { id: p.id }); }}>כרטיס החדר<sw-icon name="chevron" size=${13}></sw-icon></button>
    </div>`;
  }

  private tag(t: LevelTag, fixed: boolean): TemplateResult {
    return html`<button type="button" class=${`ltag ${t.state}${fixed ? ' fixed' : ''}`} data-level-tag=${t.id} data-lt-part=${fixed ? nothing : t.id} aria-pressed=${t.state === 'sel' ? 'true' : 'false'}
      @click=${(e: Event) => { e.stopPropagation(); this.emit<StackLevelDetail>('stack-level', { id: t.id, enter: false }); }}>
      <span class="lvl num">${t.short}</span><span class="tx"><b>${t.name}</b><span class="sum">
        ${t.open ? html`<span class="open"><sw-icon name="door" size=${12}></sw-icon>${openWords(t.open)}</span>` : nothing}
        ${t.presence ? html`<span class="pres"><sw-icon name="user" size=${12}></sw-icon>נוכחות</span>` : nothing}
        ${t.lit ? html`<span class="lit"><sw-icon name="light" size=${12}></sw-icon><span class="num">${t.lit}</span></span>` : nothing}
        ${t.temp !== null ? html`<span class="num">${temperatureText(t.temp)}</span>` : nothing}
        ${!t.open && !t.presence && !t.lit && t.temp === null ? html`<span>הכול סגור</span>` : nothing}</span></span></button>`;
  }

  /** The layer's template: the room pills, the popover, the level tags (spread: beside each level; focused: a column with the
   * entry button). Nothing in the walk. */
  render(): TemplateResult | typeof nothing {
    if (!this.active || (!this.pills.length && !this.tags.length)) return nothing;
    const focused = this.tags.find((t) => t.state === 'sel') ?? null;
    const pop = this.pop ? this.pills.find((p) => p.id === this.pop) : null;
    return html`<div class="rplayer" data-room-pills=${this.pills.length} data-pill-lod=${this.lod} data-pill-near=${this.near ?? ''}>
      ${this.hidden ? nothing : this.pills.map((p) => {
        if (p.id === this.near && this.prefs.mode === 'room') return nothing; // its devices stand on their own
        return this.pill(p, this.near ? 'far' : this.lod, !!this.near && p.id !== this.near);
      })}
      ${pop ? this.popover(pop) : nothing}
      ${focused
        ? html`<div class="ltcol" role="group" aria-label="קומות" data-level-column>${[...this.tags].reverse().map((t) => this.tag(t, true))}
            <div class="ltcta"><button type="button" class="enter" data-stack-enter @click=${(e: Event) => { e.stopPropagation(); this.emit<StackLevelDetail>('stack-level', { id: focused.id, enter: true }); }}>פתח את הקומה<sw-icon name="chevron" size=${13}></sw-icon></button></div></div>`
        : this.tags.map((t) => this.tag(t, false))}
    </div>`;
  }

  /** Place every pill and tag at its projected point (called per drawn frame; imperative, no Lit render). */
  layout(view: Projector, stageW: number, stageH: number): void {
    if (!this.active || (!this.pills.length && !this.tags.length)) return;
    const root = this.host.renderRoot;
    const layer = root.querySelector<HTMLElement>('.rplayer');
    if (!layer) return;
    const tagFree = !this.tags.some((t) => t.state === 'sel');
    const pts: Vec3[] = [];
    for (const p of this.pills) pts.push(p.pos, [p.pos[0] + 1, p.pos[1], p.pos[2]], [p.pos[0], p.pos[1], p.pos[2] + 1]);
    if (tagFree) for (const t of this.tags) pts.push(t.pos);
    const at = view.projectPoints(pts);
    const scale = new Map<string, { x: number; y: number; pxPerM: number }>();
    this.pills.forEach((p, i) => {
      const a = at[i * 3];
      const bx = at[i * 3 + 1];
      const bz = at[i * 3 + 2];
      if (!a) return;
      const s = Math.max(bx ? Math.hypot(bx.x - a.x, bx.y - a.y) : 0, bz ? Math.hypot(bz.x - a.x, bz.y - a.y) : 0);
      scale.set(p.id, { x: a.x, y: a.y, pxPerM: s });
    });
    // the distance from the median scale (one far room does not turn the floor far), the near room from the pills' sizes
    const ss = [...scale.values()].map((v) => v.pxPerM).sort((a, b) => a - b);
    const lod = pillLod(ss.length ? ss[Math.floor(ss.length / 2)] : 0, stageW, this.phoneW);
    const near = stageW >= this.phoneW && !this.hidden ? nearRoom(this.pills, scale, stageW, stageH) : null;
    if (lod !== this.lod || near !== this.near) {
      const old = { lod: this.lod, near: this.near };
      this.lod = lod;
      this.near = near;
      this.request('pillNear', old); // the template and the element's entity pills follow; this frame places what is there
    }
    // the pills: standing on their points, stacked off one another
    const els = [...layer.querySelectorAll<HTMLElement>('[data-rp-part]')];
    const boxes: PillBox[] = [];
    const byId = new Map<string, HTMLElement>();
    for (const el of els) {
      const id = el.getAttribute('data-rp-part') ?? '';
      const a = scale.get(id);
      if (!a) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'flex';
      const key = `${id}|${el.textContent ?? ''}|${el.getAttribute('data-lod')}`;
      let size = this.sizes.get(key);
      if (!size) {
        size = { w: el.offsetWidth, h: el.offsetHeight };
        if (size.w > 0) this.sizes.set(key, size);
      }
      boxes.push({ id, x: Math.round(a.x), y: Math.round(a.y) - GAP_PX, w: size.w, h: size.h });
      byId.set(id, el);
    }
    const raised = boxes.length > 1 ? resolvePillOverlaps(boxes, 3) : null;
    this.placed.clear();
    for (const b of boxes) {
      const el = byId.get(b.id)!;
      const y = b.y + Math.round(raised?.get(b.id) ?? 0);
      const t = `translate(${b.x}px, ${y}px) translate(-50%, -100%)`;
      if (el.style.transform !== t) el.style.transform = t;
      this.placed.set(b.id, { x: b.x, y, w: b.w, h: b.h });
    }
    // the popover under its pill (above it when the stage ends first), inside the stage
    const pop = layer.querySelector<HTMLElement>('.rpop');
    const at0 = this.pop ? this.placed.get(this.pop) : null;
    if (pop && at0) {
      const h = pop.offsetHeight;
      const left = Math.max(8, Math.min(stageW - POP_W - 8, at0.x - POP_W / 2));
      let top = at0.y + 8;
      const above = top + h > stageH - 8;
      if (above) top = Math.max(8, at0.y - at0.h - 8 - h);
      pop.style.transformOrigin = `${Math.round(at0.x - left)}px ${above ? '100%' : '0'}`; // it grows out of its pill
      pop.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      pop.style.visibility = 'visible';
    } else if (pop) pop.style.visibility = 'hidden';
    // the spread levels' tags: beside the level's far corner, inside the stage
    if (tagFree) {
      const base = this.pills.length * 3;
      const tagEls = [...layer.querySelectorAll<HTMLElement>('[data-lt-part]')];
      const tagBoxes: PillBox[] = [];
      const tagAt = new Map<string, { el: HTMLElement; x: number; y: number; w: number }>();
      this.tags.forEach((t, i) => {
        const el = tagEls.find((x) => x.getAttribute('data-lt-part') === t.id);
        const a = at[base + i];
        if (!el) return;
        if (!a) {
          el.style.display = 'none';
          return;
        }
        el.style.display = 'flex';
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        const x = Math.max(8, Math.min(stageW - w - 8, Math.round(a.x) + 14));
        tagBoxes.push({ id: t.id, x: x + w / 2, y: Math.round(a.y) + h / 2, w, h });
        tagAt.set(t.id, { el, x, y: Math.round(a.y) + h / 2, w });
      });
      const up = tagBoxes.length > 1 ? resolvePillOverlaps(tagBoxes, 6) : null;
      for (const [id, v] of tagAt) {
        const tr = `translate(${v.x}px, ${v.y + Math.round(up?.get(id) ?? 0)}px) translate(0, -100%)`;
        if (v.el.style.transform !== tr) v.el.style.transform = tr;
      }
    }
  }
}

/** The layer's styles (adopted by sw-plan-3d next to its own). */
export const roomPillStyles = css`
  /* the spread view's backdrop when \`map.stack_backdrop\` is dark (round 28 Q7 b): the night sky whatever the theme */
  :host([data-stack-dark]) {
    background: linear-gradient(180deg, #060b18 0%, #152442 100%);
  }
  .rplayer {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 1;
  }
  .rp,
  .ltag {
    position: absolute;
    left: 0;
    top: 0;
    display: none;
    align-items: center;
    gap: 5px;
    pointer-events: auto;
    cursor: pointer;
    font: inherit;
    direction: rtl;
    white-space: nowrap;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    color: var(--sw-text);
    box-shadow: var(--sw-shadow-1);
    transition: opacity 160ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)), box-shadow 160ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1)), scale 120ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
  }
  .rp {
    border-radius: var(--sw-r-pill);
    padding: 3px 10px;
    min-height: 26px;
    font-size: var(--sw-fs-xs);
    font-weight: 600;
    line-height: 1.2;
  }
  .rp .n {
    font-weight: 700;
  }
  .rp .sep {
    inline-size: 1px;
    block-size: 12px;
    background: var(--sw-border-strong);
  }
  .rp .s {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-weight: 600;
    color: var(--sw-text-2);
  }
  .rp .s.open,
  .rp .s[data-kind='open'] {
    color: var(--sw-danger-text);
  }
  .rp .s.pres,
  .rp .s[data-kind='pres'] {
    color: var(--sw-accent-text);
  }
  .rp .s.lit,
  .rp .s[data-kind='lit'] {
    color: var(--sw-warning-text);
  }
  .rp .num,
  .ltag .num {
    font-variant-numeric: tabular-nums;
    direction: ltr;
    unicode-bidi: isolate;
  }
  .rp[data-tone='open'] {
    border-color: var(--sw-danger-text);
  }
  .rp.quiet {
    color: var(--sw-text-2);
    font-weight: 600;
    box-shadow: none;
  }
  .rp.quiet .n {
    font-weight: 600;
  }
  .rp.far {
    gap: 4px;
    padding-inline: 8px 5px;
  }
  .rp .b {
    display: inline-grid;
    place-items: center;
    min-inline-size: 17px;
    block-size: 17px;
    padding: 0 4px;
    border-radius: var(--sw-r-pill);
    font-style: normal;
    font-size: var(--sw-fs-2xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--sw-menu-surface);
  }
  .rp .b.open {
    background: var(--sw-danger-text);
  }
  .rp .b.lit {
    background: var(--sw-warning-text);
  }
  .rp .b.pres {
    min-inline-size: 9px;
    block-size: 9px;
    padding: 0;
    background: var(--sw-accent-text);
  }
  .rp.dim {
    opacity: 0.62;
  }
  .rp[aria-pressed='true'] {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-2);
    opacity: 1;
  }
  .rp:focus-visible,
  .ltag:focus-visible,
  .rpop button:focus-visible {
    outline: 2px solid var(--sw-accent);
    outline-offset: 2px;
  }
  @media (hover: hover) and (pointer: fine) {
    .rp:hover {
      box-shadow: var(--sw-shadow-2);
      opacity: 1;
    }
  }
  .rp:active {
    scale: 0.97;
  }
  /* the popover: a small card under its pill */
  .rpop {
    position: absolute;
    left: 0;
    top: 0;
    inline-size: 264px;
    visibility: hidden;
    pointer-events: auto;
    direction: rtl;
    background: var(--sw-menu-surface);
    border: 1px solid var(--sw-border-strong);
    border-radius: var(--sw-r-md);
    box-shadow: var(--sw-shadow-3);
    padding: 10px 10px 8px;
    color: var(--sw-text);
    font-size: var(--sw-fs-sm);
    animation: rp-in 150ms var(--sw-ease-out, cubic-bezier(0.23, 1, 0.32, 1));
    transform-origin: top center;
  }
  @keyframes rp-in {
    from {
      opacity: 0;
      scale: 0.97;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .rpop {
      animation: rp-fade 150ms ease;
    }
    .rp,
    .ltag {
      transition: none;
    }
  }
  @keyframes rp-fade {
    from {
      opacity: 0;
    }
  }
  .rpop h3 {
    margin: 0 4px 6px;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .rpop h3 small {
    font-weight: 500;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .grp {
    margin: 6px 4px 2px;
    font-size: var(--sw-fs-2xs);
    font-weight: 700;
    color: var(--sw-text-2);
  }
  .rpop .row {
    display: flex;
    align-items: center;
    gap: 8px;
    inline-size: 100%;
    min-block-size: 32px;
    padding: 4px 6px;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: var(--sw-menu-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    text-align: start;
    cursor: pointer;
  }
  @media (hover: hover) and (pointer: fine) {
    .rpop .row:hover {
      background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
    }
  }
  .rpop .row sw-icon {
    color: var(--sw-text-2);
  }
  .rpop .row .l {
    flex: 1;
    min-inline-size: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rpop .row .v {
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .row[data-kind='open'] .v,
  .rpop .row[data-kind='open'] sw-icon {
    color: var(--sw-danger-text);
  }
  .rpop .row[data-kind='lit'] .v,
  .rpop .row[data-kind='lit'] sw-icon {
    color: var(--sw-warning-text);
  }
  .rpop .row[data-kind='pres'] .v,
  .rpop .row[data-kind='pres'] sw-icon {
    color: var(--sw-accent-text);
  }
  .rpop .moredev {
    margin: 4px 6px 0;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .rpop .card,
  .ltcta .enter {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    inline-size: 100%;
    min-block-size: 36px;
    margin-block-start: 8px;
    border: 0;
    border-radius: var(--sw-r-sm);
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
    font: inherit;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    cursor: pointer;
  }
  .rpop .card:active,
  .ltcta .enter:active {
    scale: 0.98;
  }
  /* the spread levels' tags */
  .ltag {
    gap: 10px;
    padding: 7px 12px 7px 14px;
    border-radius: var(--sw-r-md);
    text-align: start;
    font-size: var(--sw-fs-sm);
  }
  .ltag .lvl {
    display: inline-grid;
    place-items: center;
    inline-size: 28px;
    block-size: 28px;
    border-radius: var(--sw-r-sm);
    background: linear-gradient(var(--sw-accent-soft), var(--sw-accent-soft)), var(--sw-menu-surface);
    color: var(--sw-accent-text);
    font-weight: 800;
  }
  .ltag .tx {
    display: grid;
    gap: 2px;
  }
  .ltag b {
    font-weight: 700;
  }
  .ltag .sum {
    display: flex;
    gap: 10px;
    color: var(--sw-text-2);
    font-size: var(--sw-fs-xs);
  }
  .ltag .sum > span {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .ltag .open {
    color: var(--sw-danger-text);
  }
  .ltag .pres {
    color: var(--sw-accent-text);
  }
  .ltag .lit {
    color: var(--sw-warning-text);
  }
  .ltag.sel {
    border-color: var(--sw-accent);
    box-shadow: 0 0 0 1px var(--sw-accent), var(--sw-shadow-2);
  }
  .ltag.away {
    opacity: 0.7;
  }
  .ltcol {
    position: absolute;
    inset-inline-start: 12px;
    inset-block-start: 12px;
    display: grid;
    gap: 8px;
    pointer-events: auto;
    max-inline-size: 260px;
  }
  .ltcol .ltag {
    position: static;
    display: flex;
  }
  @media (max-width: 640px) {
    .ltag {
      padding: 5px 9px;
    }
    .ltag .sum {
      display: none;
    }
    .rpop {
      inline-size: min(264px, calc(100% - 16px));
    }
  }
`;
