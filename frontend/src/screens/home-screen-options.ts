import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import {
  CHOICES, defaultQuick, QUICK_KINDS, SUMMARY_KINDS,
  type ChoiceKey, type HomeScreenForm, type HomeScreenOptions, type QuickKind, type SummaryKind,
} from '../api/home-screen';
import { INFO_STYLES } from '../api/screen-display';
import type { DeviceCounts } from '../api/devices';
import { bidi } from '../i18n/bidi';
import { hs, type HsKey } from '../i18n/home-screen';

/** One area for the quick-actions editor: its id, name, floor and counts (what kinds it has). */
export interface OptionsArea {
  id: string;
  name: string;
  floor: string;
  counts: DeviceCounts;
}

export type { HomeScreenForm };

const LABEL_KEY: Record<ChoiceKey, HsKey> = {
  summary_chooser: 'summaryChooser',
  row_actions: 'rowActions',
  tile_blinds: 'tileBlinds',
  tile_climate: 'tileClimate',
  phone_area: 'phoneArea',
  floor_off: 'floorOff',
  many_floors: 'manyFloors',
  building_off_tablet: 'buildingOff',
  phone_floors: 'phoneFloors',
};
const VALUE_PREFIX: Record<ChoiceKey, string> = {
  summary_chooser: 'chooser_',
  row_actions: 'row_',
  tile_blinds: 'blinds_',
  tile_climate: 'climate_',
  phone_area: 'area_',
  floor_off: 'off_',
  many_floors: 'floors_',
  building_off_tablet: 'bo_',
  phone_floors: 'pf_',
};
const QUICK_LABEL: Record<QuickKind, HsKey> = { lights: 'qLights', climate: 'qClimate', covers: 'qCovers', switches: 'qSwitches' };
const QUICK_ICON: Record<QuickKind, string> = { lights: 'light', climate: 'snow', covers: 'layers', switches: 'bolt' };

/**
 * HOME-295 (owner answers on the home mockup round 2): every display choice of the home screen in one form - the default view, the info
 * row, the summary tiles (and who chooses them), the quick actions per area, the area row of the cards view, the blinds and the climate
 * on a tile, how an area opens on a phone, the floor-off control, more than four floors and the "building off" card on a landscape
 * tablet. Used by הגדרות › חשמל והתקנים › מסך ראשי (saved at once) and by the screen editor (saved with "שמור"). The form only emits
 * `hs-change` with the whole next value; the host decides when to save. Read-only without `editable`.
 */
@customElement('home-screen-options')
export class HomeScreenOptionsForm extends LitElement {
  @property({ attribute: false }) value!: HomeScreenForm;
  @property({ attribute: false }) areas: OptionsArea[] = [];
  @property({ type: Boolean }) editable = false;
  /** The screen editor shows the per-area quick actions first and opens on this area. */
  @property() area = '';
  @state() private picked = '';

  static styles = css`
    :host {
      display: block;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 12px 18px;
    }
    .f {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-inline-size: 0;
    }
    .k {
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-2);
    }
    .seg {
      display: flex;
      flex-wrap: wrap;
      gap: 2px;
      padding: 3px;
      background: var(--sw-surface-3);
      border-radius: var(--sw-r-md);
      inline-size: fit-content;
      max-inline-size: 100%;
    }
    .seg button,
    .pick {
      all: unset;
      box-sizing: border-box;
      min-block-size: 32px;
      padding: 0 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: var(--sw-r-sm);
      color: var(--sw-text-2);
      font-weight: var(--sw-fw-medium);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-seg-on-bg, var(--sw-surface));
      color: var(--sw-seg-on-text, var(--sw-accent-text));
      box-shadow: var(--sw-shadow-1);
      font-weight: var(--sw-fw-semibold);
    }
    .picks {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pick {
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-pill);
      background: var(--sw-surface);
      min-block-size: 30px;
    }
    .pick[aria-pressed='true'] {
      background: var(--sw-accent);
      border-color: transparent;
      color: var(--sw-text-inverse);
      font-weight: var(--sw-fw-semibold);
    }
    .pick .n {
      font-variant-numeric: tabular-nums;
      opacity: 0.8;
    }
    button:disabled {
      cursor: default;
      opacity: 0.6;
    }
    button:focus-visible {
      outline: var(--sw-focus-w, 2px) solid var(--sw-focus);
      outline-offset: 2px;
    }
    select {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: 6px 8px;
      max-inline-size: 100%;
    }
    .wide {
      grid-column: 1 / -1;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .muted {
      color: var(--sw-text-3);
    }
    .lnk {
      all: unset;
      cursor: pointer;
      color: var(--sw-accent-text);
      font-weight: var(--sw-fw-semibold);
    }
  `;

  private emit(next: HomeScreenForm) {
    this.dispatchEvent(new CustomEvent<HomeScreenForm>('hs-change', { detail: next, bubbles: true, composed: true }));
  }

  private setScreen(patch: Partial<HomeScreenOptions>) {
    this.emit({ ...this.value, screen: { ...this.value.screen, ...patch } });
  }

  private seg<T extends string>(key: string, values: readonly T[], on: T, label: (v: T) => string, set: (v: T) => void) {
    return html`<span class="seg" role="group" data-hs-option=${key}>${values.map(
      (v) => html`<button type="button" data-hs-value=${v} aria-pressed=${String(v === on)} ?disabled=${!this.editable} @click=${() => v !== on && set(v)}>${label(v)}</button>`,
    )}</span>`;
  }

  private choice(key: ChoiceKey) {
    const values = CHOICES[key] as readonly string[];
    const on = this.value.screen[key] as string;
    return html`<div class="f"><span class="k">${hs(LABEL_KEY[key])}</span>${this.seg(key, values, on, (v) => hs(`${VALUE_PREFIX[key]}${v}` as HsKey), (v) => this.setScreen({ [key]: v } as Partial<HomeScreenOptions>))}</div>`;
  }

  private toggleTile(k: SummaryKind) {
    const cur = this.value.screen.summary_tiles ?? [...SUMMARY_KINDS];
    const next = cur.includes(k) ? cur.filter((x) => x !== k) : SUMMARY_KINDS.filter((x) => x === k || cur.includes(x));
    this.setScreen({ summary_tiles: next });
  }

  private summary() {
    const t = this.value.screen.summary_tiles;
    return html`<div class="f wide"><span class="k">${hs('summaryTiles')}</span>
      <div class="picks" data-hs-option="summary_tiles">
        <button type="button" class="pick" data-hs-tiles-all aria-pressed=${String(t === null)} ?disabled=${!this.editable} @click=${() => this.setScreen({ summary_tiles: null })}>${hs('summaryAll')}</button>
        ${SUMMARY_KINDS.map((k) => html`<button type="button" class="pick" data-hs-tile=${k} aria-pressed=${String(t !== null && t.includes(k))} ?disabled=${!this.editable} @click=${() => this.toggleTile(k)}>${hs(`k_${k}` as HsKey)}</button>`)}
      </div></div>`;
  }

  private quickEditor() {
    const areas = this.areas;
    if (!areas.length) return nothing;
    const id = areas.some((a) => a.id === this.picked) ? this.picked : areas.some((a) => a.id === this.area) ? this.area : areas[0].id;
    const a = areas.find((x) => x.id === id)!;
    const own = this.value.screen.area_quick[id];
    const list = own ?? defaultQuick(a.counts);
    const has = (k: QuickKind) => (a.counts[k] ?? 0) > 0;
    const toggle = (k: QuickKind) => {
      const next = list.includes(k) ? list.filter((x) => x !== k) : [...list, k];
      this.setScreen({ area_quick: { ...this.value.screen.area_quick, [id]: next } });
    };
    const reset = () => {
      const { [id]: _drop, ...rest } = this.value.screen.area_quick;
      this.setScreen({ area_quick: rest });
    };
    return html`<div class="f wide" data-hs-area-quick>
      <span class="k">${hs('areaQuick')}</span>
      <div class="row">
        <label class="row">${hs('areaPick')}
          <select data-hs-area-select @change=${(e: Event) => (this.picked = (e.target as HTMLSelectElement).value)}>
            ${areas.map((x) => html`<option value=${x.id} ?selected=${x.id === id}>${x.floor ? `${x.floor} · ` : ''}${x.name}</option>`)}
          </select>
        </label>
        ${own ? html`<button type="button" class="lnk" data-hs-area-reset ?disabled=${!this.editable} @click=${reset}>${hs('areaReset')}</button>` : html`<span class="muted">${hs('areaDefault')}</span>`}
      </div>
      <div class="picks" data-hs-area=${id}>
        ${QUICK_KINDS.filter(has).map((k) => {
          const i = list.indexOf(k);
          return html`<button type="button" class="pick" data-hs-quick=${k} aria-pressed=${String(i >= 0)} ?disabled=${!this.editable} @click=${() => toggle(k)}><sw-icon name=${QUICK_ICON[k]} size=${14}></sw-icon>${hs(QUICK_LABEL[k])}${i >= 0 ? html`<span class="n">${i + 1}</span>` : nothing}</button>`;
        })}
      </div>
      <span class="muted">${bidi(a.name)}</span>
    </div>`;
  }

  render() {
    const v = this.value;
    if (!v) return nothing;
    return html`<div class="grid" data-home-screen-options>
      <div class="f"><span class="k">${hs('defaultView')}</span>${this.seg('default_view', ['cards', 'tiles'] as const, v.view, (x) => hs(x === 'cards' ? 'viewCards' : 'viewTiles'), (x) => this.emit({ ...v, view: x }))}</div>
      <div class="f"><span class="k">${hs('infoRow')}</span>${this.seg('info_style', INFO_STYLES, v.info, (x) => hs(`info_${x}` as HsKey), (x) => this.emit({ ...v, info: x }))}</div>
      ${this.summary()}
      ${this.choice('summary_chooser')}
      ${this.quickEditor()}
      ${this.choice('row_actions')}
      ${this.choice('tile_blinds')}
      ${this.choice('tile_climate')}
      ${this.choice('floor_off')}
      ${this.choice('many_floors')}
      ${this.choice('building_off_tablet')}
      ${this.choice('phone_floors')}
      ${this.choice('phone_area')}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-screen-options': HomeScreenOptionsForm;
  }
}
