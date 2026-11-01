import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-dialog';
import '../components/sw-field';
import '../components/sw-button';
import { bidi, ltrNum } from '../i18n/bidi';
import { xt, type XtKey } from '../i18n/xsection';
import { putHomeLink, type AreaLinkMode, type HomeLinks } from '../api/catalog';
import { describeError } from '../api/client';
import type { DeviceTree } from '../api/devices';
import type { Floor } from '../api/types';
import { matchFloors, treeAreas, treeFloors, type AreaSource, type MatchLinks } from './xs-model';
import { HOW_KEY, matchLine } from './sw-xsection';

const SRC_KEY: Record<AreaSource, XtKey> = { manual: 'homeLinkSrcManual', link: 'homeLinkSrcLink', map: 'homeLinkSrcMap', level: 'homeLinkSrcLevel', name: 'homeLinkSrcName' };

/**
 * SYNOPTIC-HA-2310 - "קישור למערכת הבית" of one of our floors, on the mapping rows of PROPOSAL-MULTI-BUILDING-HOME (layer 1: platform
 * floor -> our floor; layer 2: per-area override; layer 3: map placement, read-only here). Top: the platform floors of this floor (by hand,
 * or the automatic level / name match), a suggestion to confirm, assign another. Then the floor's areas with their source, remove (an
 * area the platform floor brings is taken off - "לא משויך"; one added by hand goes back to automatic), restore, and add any area. The
 * lists are computed live with the matching the screens use (xs-model matchFloors), so this is what the section and the synoptic map
 * will count. One PUT /floors/{id}/home-link saves it (audited floor.home_link; the server checks the floor-edit permission on every floor
 * a row is taken from). Fires `saved` ({ links }); the dialog's own `close` bubbles.
 */
@customElement('sw-floor-home-link')
export class SwFloorHomeLink extends LitElement {
  @property({ attribute: false }) floor!: Floor;
  /** The floors of the floor's building (they compete for the same platform floors and areas). */
  @property({ attribute: false }) floors: Floor[] = [];
  /** Every floor name of the installation the caller sees (for "now on <floor>"). */
  @property({ attribute: false }) floorNames: Map<string, string> = new Map();
  @property({ attribute: false }) tree: DeviceTree | null = null;
  @property({ attribute: false }) links: HomeLinks | null = null;
  @property({ type: Boolean }) singleBuilding = true;
  @property({ type: Boolean }) demo = false;
  @state() private haFloors: string[] = [];
  @state() private modes: Record<string, AreaLinkMode> = {};
  @state() private busy = false;
  @state() private error = '';
  private seeded = '';

  static styles = css`
    :host { display: contents; }
    .sec { display: grid; gap: 8px; margin-block-start: 14px; }
    .sec.first { margin-block-start: 0; }
    h3 { margin: 0; font-size: var(--sw-fs-sm); font-weight: var(--sw-fw-semibold); color: var(--sw-text-2); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
    li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; align-items: center; gap: 10px; min-block-size: 40px; padding: 0 6px 0 12px; border-radius: var(--sw-r-md); background: var(--sw-surface-2); font-size: var(--sw-fs-sm); }
    li .n { min-inline-size: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--sw-heading); font-weight: var(--sw-fw-medium); }
    li.off .n { color: var(--sw-text-3); }
    li .w { color: var(--sw-text-3); font-size: 12px; white-space: nowrap; }
    .tag { font-size: 11.5px; padding: 2px 8px; border-radius: 999px; background: var(--sw-surface); color: var(--sw-text-2); box-shadow: inset 0 0 0 1px var(--sw-border); white-space: nowrap; }
    .tag[data-src='manual'], .tag[data-src='link'] { background: var(--sw-accent-soft); color: var(--sw-accent-text, var(--sw-accent)); box-shadow: none; }
    .none, .now { font-size: var(--sw-fs-sm); color: var(--sw-text-2); }
    .none { color: var(--sw-text-3); }
    .sug { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: var(--sw-r-md); background: var(--sw-accent-soft); font-size: var(--sw-fs-sm); color: var(--sw-text); }
    .sug span { flex: 1 1 200px; min-inline-size: 0; }
    .err { color: var(--sw-danger); font-size: var(--sw-fs-xs); margin-block-start: 10px; }
    .note { color: var(--sw-text-3); font-size: var(--sw-fs-xs); margin-block-start: 10px; }
    select { inline-size: 100%; }
  `;

  protected willUpdate() {
    if (this.floor && this.seeded !== this.floor.id) {
      this.seeded = this.floor.id;
      this.haFloors = this.savedHaFloors();
      this.modes = {};
    }
  }

  private savedHaFloors(): string[] {
    return (this.links?.floors ?? []).filter((r) => r.floor_id === this.floor.id).map((r) => r.ha_floor_id);
  }

  /** The installation's rows with this floor's draft applied. */
  private draft(modes = this.modes, haFloors = this.haFloors): MatchLinks {
    const fid = this.floor.id;
    const floors = (this.links?.floors ?? []).filter((r) => r.floor_id !== fid && !haFloors.includes(r.ha_floor_id));
    for (const h of haFloors) floors.push({ ha_floor_id: h, floor_id: fid });
    const areas = new Map((this.links?.areas ?? []).map((r) => [r.area_id, r.floor_id]));
    for (const [aid, mode] of Object.entries(modes)) {
      if (mode === 'auto') areas.delete(aid);
      else areas.set(aid, mode === 'include' ? fid : null);
    }
    return { floors, areas: [...areas.entries()].map(([area_id, floor_id]) => ({ area_id, floor_id })) };
  }

  private matchAll(modes = this.modes, haFloors = this.haFloors) {
    return matchFloors(this.floors, this.tree, { links: this.draft(modes, haFloors), singleBuilding: this.singleBuilding });
  }

  /** Take an area off this floor: back to automatic when that already leaves it elsewhere, else "unassigned" by hand. */
  private dropArea(aid: string) {
    const auto = { ...this.modes, [aid]: 'auto' as const };
    const stays = this.matchAll(auto).get(this.floor.id)!.areas.some((a) => a.area.area_id === aid);
    this.modes = stays ? { ...this.modes, [aid]: 'exclude' } : auto;
  }

  private reset() {
    const modes: Record<string, AreaLinkMode> = {};
    for (const r of this.links?.areas ?? []) if (r.floor_id === this.floor.id) modes[r.area_id] = 'auto';
    for (const x of this.matchAll().get(this.floor.id)!.excluded) modes[x.area.area_id] = 'auto';
    this.haFloors = [];
    this.modes = modes;
  }

  private async save() {
    this.busy = true;
    this.error = '';
    try {
      const links = await putHomeLink(this.floor.id, { ha_floor_ids: this.haFloors, areas: this.modes });
      this.dispatchEvent(new CustomEvent('saved', { detail: { links }, bubbles: true, composed: true }));
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    const f = this.floor;
    const t = this.tree;
    const cancel = () => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
    if (!t) {
      return html`<sw-dialog open heading=${xt('homeLinkTitle')} subheading=${xt('homeLinkSub', { name: f.name })} data-home-link>
        <div class="none">${xt('homeLinkNoTree')}</div>
        <sw-button slot="footer" variant="ghost" @click=${cancel}>${xt('homeLinkCancel')}</sw-button>
      </sw-dialog>`;
    }
    const draft = this.draft();
    const all = this.matchAll();
    const mine = all.get(f.id)!;
    const haAll = treeFloors(t);
    const haName = new Map(haAll.map((h) => [h.floor_id, h.name]));
    const rowOf = new Map(draft.floors.map((r) => [r.ha_floor_id, r.floor_id]));
    const nameOf = (fid: string | null) => (fid ? this.floorNames.get(fid) ?? this.floors.find((x) => x.id === fid)?.name ?? fid : xt('homeLinkUnassigned'));
    const owner = new Map<string, string>();
    for (const x of this.floors) if (x.id !== f.id) for (const a of all.get(x.id)?.areas ?? []) owner.set(a.area.area_id, x.name);
    const onMine = new Set(mine.areas.map((a) => a.area.area_id));
    const groups = new Map<string, ReturnType<typeof treeAreas>>();
    for (const x of treeAreas(t)) {
      if (onMine.has(x.area.area_id) || x.area.map?.floor_id) continue; // a placed area moves only in the plan editor (layer 3)
      const g = x.haFloorId ? haName.get(x.haFloorId) ?? x.haFloorId : xt('homeLinkNoFloor');
      groups.set(g, [...(groups.get(g) ?? []), x]);
    }
    const ml = matchLine(mine);
    const dirty = Object.keys(this.modes).length > 0 || JSON.stringify([...this.haFloors].sort()) !== JSON.stringify(this.savedHaFloors().sort());
    const anyHand = this.haFloors.length > 0 || draft.areas.some((r) => r.floor_id === f.id) || mine.excluded.length > 0;
    return html`<sw-dialog open heading=${xt('homeLinkTitle')} subheading=${xt('homeLinkSub', { name: f.name })} data-home-link>
      <div class="sec first">
        <h3>${xt('homeLinkFloors', { n: mine.haFloors.length })}</h3>
        ${mine.haFloors.length
          ? html`<ul data-home-floors>${mine.haFloors.map((h) => html`<li data-home-floor=${h.id}>
              <span class="n" dir="auto">${bidi(h.name)}</span>
              <span class="tag" data-src=${mine.how ?? ''}>${mine.how === 'link' ? xt('matchLink') : `${xt('homeLinkSrcAuto')} · ${xt(HOW_KEY[mine.how ?? 'level'])}`}</span>
              ${mine.how === 'link'
                ? html`<sw-button size="sm" variant="ghost" icon="close" data-home-floor-remove=${h.id} @click=${() => (this.haFloors = this.haFloors.filter((x) => x !== h.id))}>${xt('homeLinkRemove')}</sw-button>`
                : html`<span></span>`}
            </li>`)}</ul>`
          : html`<div class="none">${xt('homeLinkFloorsNone')}</div>`}
        ${mine.suggestion
          ? html`<div class="sug" data-home-suggest><span>${xt('homeLinkSuggest', { floor: mine.suggestion.haFloorName, how: xt(HOW_KEY[mine.suggestion.why]) })}</span>
              <sw-button size="sm" variant="primary" data-home-confirm @click=${() => (this.haFloors = [...this.haFloors, mine.suggestion!.haFloorId])}>${xt('homeLinkConfirm')}</sw-button></div>`
          : nothing}
        <sw-field label=${xt('homeLinkAddFloor')} hint=${xt('homeLinkAutoHint')}>
          <select data-home-floor-add @change=${(e: Event) => { const s = e.target as HTMLSelectElement; if (s.value && !this.haFloors.includes(s.value)) this.haFloors = [...this.haFloors, s.value]; s.value = ''; }}>
            <option value="" selected>${xt('homeLinkAddFloorPick')}</option>
            ${haAll.filter((h) => !this.haFloors.includes(h.floor_id)).map((h) => html`<option value=${h.floor_id}>${h.name}${h.level !== null ? ` · ${xt('level', { n: ltrNum(h.level) })}` : ''}${rowOf.has(h.floor_id) ? ` ${xt('homeLinkElsewhere', { floor: nameOf(rowOf.get(h.floor_id)!) })}` : ''}</option>`)}
          </select>
        </sw-field>
      </div>
      ${ml ? html`<div class="now" data-home-now>${ml.text}</div>` : nothing}
      <div class="sec">
        <h3>${xt('homeLinkAreas', { n: mine.areas.length })}</h3>
        ${mine.areas.length
          ? html`<ul data-home-areas>${mine.areas.map((a) => html`<li data-home-area=${a.area.area_id}>
              <span class="n" dir="auto" title=${a.area.name}>${bidi(a.area.name)}</span>
              <span class="tag" data-src=${a.source}>${xt(SRC_KEY[a.source])}</span>
              ${a.source === 'map'
                ? html`<span class="w" title=${xt('homeLinkMapNote')}>${xt('homeLinkSrcMap')}</span>`
                : html`<sw-button size="sm" variant="ghost" icon="close" data-home-remove=${a.area.area_id} @click=${() => this.dropArea(a.area.area_id)}>${xt('homeLinkRemove')}</sw-button>`}
            </li>`)}</ul>`
          : html`<div class="none">${xt('homeLinkAreasNone')}</div>`}
      </div>
      ${mine.excluded.length || mine.missing.length
        ? html`<div class="sec">
            <h3>${xt('homeLinkExcluded')}</h3>
            <ul>
              ${mine.excluded.map((x) => html`<li class="off" data-home-excluded=${x.area.area_id}><span class="n" dir="auto">${bidi(x.area.name)}</span>
                <span class="w">${x.to ? xt('homeLinkMovedTo', { floor: nameOf(x.to) }) : xt('homeLinkUnassigned')}</span>
                <sw-button size="sm" variant="ghost" data-home-restore=${x.area.area_id} @click=${() => (this.modes = { ...this.modes, [x.area.area_id]: 'auto' })}>${xt('homeLinkRestore')}</sw-button></li>`)}
              ${mine.missing.map((id) => html`<li class="off" data-home-missing=${id}><span class="n">${xt('homeLinkMissing', { id })}</span><span></span>
                <sw-button size="sm" variant="ghost" @click=${() => { this.haFloors = this.haFloors.filter((x) => x !== id); this.modes = { ...this.modes, [id]: 'auto' }; }}>${xt('homeLinkRemove')}</sw-button></li>`)}
            </ul>
          </div>`
        : nothing}
      <div class="sec">
        <sw-field label=${xt('homeLinkAdd')}>
          <select data-home-add @change=${(e: Event) => { const s = e.target as HTMLSelectElement; if (s.value) this.modes = { ...this.modes, [s.value]: 'include' }; s.value = ''; }}>
            <option value="" selected>${xt('homeLinkAddPick')}</option>
            ${[...groups.entries()].map(([g, xs]) => html`<optgroup label=${g}>${xs.map((x) => html`<option value=${x.area.area_id}>${x.area.name}${owner.has(x.area.area_id) ? ` ${xt('homeLinkElsewhere', { floor: owner.get(x.area.area_id)! })}` : ''}</option>`)}</optgroup>`)}
          </select>
        </sw-field>
      </div>
      ${this.error ? html`<div class="err">${this.error}</div>` : nothing}
      ${this.demo ? html`<div class="note">${xt('homeLinkDemo')}</div>` : nothing}
      ${anyHand ? html`<sw-button slot="footer" variant="ghost" data-home-reset @click=${() => this.reset()}>${xt('homeLinkReset')}</sw-button>` : nothing}
      <sw-button slot="footer" variant="ghost" @click=${cancel}>${xt('homeLinkCancel')}</sw-button>
      <sw-button slot="footer" variant="primary" data-home-save ?disabled=${this.busy || this.demo || !dirty} @click=${() => this.save()}>${xt('homeLinkSave')}</sw-button>
    </sw-dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-floor-home-link': SwFloorHomeLink;
  }
}
