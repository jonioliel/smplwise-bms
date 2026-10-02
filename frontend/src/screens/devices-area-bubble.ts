import { html, css, nothing, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-pill';
import '../components/sw-sheet';
import '../components/sw-icon';
import type { IconName } from '../components/sw-icon';
import { ALARM_HE, climateRange, HVAC_ACTION_HE, HVAC_HE, type CardId, type DeviceRow } from '../api/devices';
import { fmtTime } from '../api/ha';
import { bidi, ltrNum } from '../i18n/bidi';
import { deg, rowLabel, type DeviceControls } from './devices-controls';
import { hueOf } from '../design/skin';
import { navigate } from '../router';

/**
 * The area screen in the Bubble skin (phase C, owner 2026-10-02; the approved board docs/design/mockups/bubble-taste/area.html):
 * every device is an `sw-pill` row - a light is a slider pill (fill = brightness), a switch a toggle pill, a cover a position pill
 * with up / stop / down sub-buttons, a climate unit a pill with its -/+ stepper, a player a pill with play / mute, a sensor a tile
 * or a plain pill - and the ring of every pill opens the device's `sw-sheet` (translucent, over the dimmed live page) with the
 * full controls. The commands, the arm-then-confirm rule of covers and the status phases are the area screen's own
 * (devices-controls.ts): this file only draws. The sections are separators (icon, label, a rounded rule, the bulk button), the
 * devices sit in a grid of `--sw-grid-min` columns (the density dial; `row` = one column, the list view).
 */

export interface BubbleAreaHost {
  ctl: DeviceControls;
  /** Opens the device's sheet (the pill's ring, or a plain pill's tap). */
  openSheet(r: DeviceRow, card: CardId): void;
  /** The "׳׳׳ ׳©׳™׳•׳" bucket's assign action (the classic row's button), or nothing. */
  assignButton(r: DeviceRow): TemplateResult | typeof nothing;
}

const SECTION_ICON: Record<CardId, IconName> = { lighting: 'light', switches: 'bolt', climate: 'snow', heating: 'flame', covers: 'layers', security: 'shield', media: 'play', sensors: 'activity' };

export function sectionIcon(id: CardId): IconName {
  return SECTION_ICON[id];
}

export const bubbleAreaStyles = css`
  /* ---- the bubble skin: sections are separators, devices are pills in a grid, nothing is a card ---- */
  :host([data-skin='bubble']) sw-page {
    gap: 12px;
  }
  :host([data-skin='bubble']) .grid:not(.lay-grid),
  :host([data-skin='bubble'][data-area-design]) .grid:not(.lay-grid) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    column-width: auto;
  }
  :host([data-skin='bubble']) .grid:not(.lay-grid) > sw-card,
  :host([data-skin='bubble'][data-area-design]) .grid:not(.lay-grid) > sw-card {
    display: block;
    padding: 0;
    margin: 0;
    grid-column: auto;
    grid-row: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }
  :host([data-skin='bubble']) .lay-grid > .lay-item > sw-card {
    border: 0;
    background: var(--sw-layer);
    box-shadow: none;
    padding: 10px 12px;
  }
  :host([data-skin='bubble']) sw-card[data-empty] {
    background: transparent;
  }
  /* the separator: icon, bold label, a rounded 6 px rule, the count and the section's bulk button */
  .bsep {
    display: flex;
    align-items: center;
    gap: 10px;
    min-block-size: 44px;
    margin: 6px 4px 8px;
    color: var(--sw-text);
    font-weight: var(--sw-fw-bold);
    font-size: var(--sw-fs-lg);
  }
  .bsep > sw-icon {
    flex: none;
    color: var(--sw-text-2);
  }
  .bsep .bt {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0;
    cursor: default;
    text-align: start;
  }
  .bsep .bt.fold {
    cursor: pointer;
    min-block-size: 44px;
    border-radius: var(--sw-r-pill);
    padding-inline: 4px 10px;
  }
  .bsep .bt.fold:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 2px;
  }
  .bsep .bt.fold sw-icon {
    transition: transform var(--sw-t-med) var(--sw-ease);
  }
  .bsep .bt.fold[aria-expanded='false'] sw-icon {
    transform: rotate(-90deg);
  }
  .bsep .bn {
    flex: none;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-medium);
    color: var(--sw-text-2);
    font-variant-numeric: tabular-nums;
  }
  .bsep .rule {
    flex: 1 1 24px;
    min-inline-size: 24px;
    block-size: 6px;
    border-radius: 3px;
    background: var(--sw-surface-2);
    opacity: 0.9;
  }
  .bsep .acts {
    flex: none;
    display: inline-flex;
    gap: 6px;
  }
  /* the pills: a grid of --sw-grid-min columns; row density = one column of touching rows */
  .bgrid {
    display: grid;
    gap: var(--sw-gap-grid);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    align-items: start;
  }
  :host([data-skin='bubble']) .lay-tgrid.tiles {
    gap: var(--sw-gap-grid);
  }
  /* an arranged card and the media card's leftover rows keep their containers: pills inside, the bubble grid's columns */
  :host([data-skin='bubble']) .tiles:not(.lay-tgrid),
  :host([data-skin='bubble']) .rows {
    display: grid;
    gap: var(--sw-gap-grid);
    grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--sw-grid-min)), 1fr));
    align-items: start;
  }
  :host([data-skin='bubble']) .sensor-groups {
    gap: 8px;
  }
  :host([data-skin='bubble']) .bgroup {
    margin-block-end: var(--sw-gap-grid);
  }
  .bgrid.list {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--sw-gap);
  }
  /* sub-buttons inside pills: round, the sub size, 44 px in touch layouts */
  .sb {
    inline-size: var(--sw-sub-size, var(--sw-sub));
    block-size: var(--sw-sub-size, var(--sw-sub));
    min-inline-size: var(--sw-touch-desktop, 44px);
    min-block-size: var(--sw-touch-desktop, 44px);
    box-sizing: border-box;
    border: 0;
    border-radius: 50%;
    background: var(--sw-surface-2);
    color: var(--sw-text);
    display: grid;
    place-items: center;
    cursor: pointer;
    padding: 0;
    font: inherit;
    transition: background var(--sw-t-fast) var(--sw-ease), transform var(--sw-t-fast) var(--sw-ease-thumb);
  }
  .sb:hover {
    background: var(--sw-surface-3);
  }
  .sb:active {
    transform: scale(0.94);
  }
  .sb:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .sb.on,
  .sb.armed {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .sb.dark {
    background: var(--sw-text);
    color: var(--sw-bg);
  }
  .sb:focus-visible,
  .chip:focus-visible,
  .bbtn:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 2px;
  }
  .chip {
    block-size: var(--sw-sub-size, var(--sw-sub));
    min-block-size: var(--sw-touch-desktop, 44px);
    min-inline-size: var(--sw-touch-desktop, 44px);
    box-sizing: border-box;
    justify-content: center;
    padding: 0 12px;
    border: 0;
    border-radius: var(--sw-r-md);
    background: var(--sw-surface-2);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-xs);
    font-weight: var(--sw-fw-semibold);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
  }
  .chip:hover {
    background: var(--sw-surface-3);
  }
  .chip.on,
  .chip[aria-pressed='true'] {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .chip.armed {
    background: var(--sw-warning-soft);
    color: var(--sw-warning-text);
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .chip.plain {
    cursor: default;
  }
  .chip.plain:hover {
    background: var(--sw-surface-2);
  }
  @media (max-width: 1100px) {
    .sb,
    .chip,
    .bbtn {
      min-block-size: 44px;
    }
    .sb,
    .chip {
      min-inline-size: 44px;
    }
  }
  /* the sensor tiles (value big, name small) */
  .kv {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
    gap: var(--sw-gap);
  }
  .kv > div {
    border-radius: var(--sw-r-md);
    background: var(--sw-surface);
    padding: 12px 16px;
    min-inline-size: 0;
  }
  .kv .k {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .kv .v {
    font-size: var(--sw-fs-xl);
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
    overflow-wrap: anywhere;
  }
  .kv .v.sm {
    font-size: var(--sw-fs-md);
  }
  .kv .lc {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
  }
  .kv > div.hot {
    background: var(--sw-warning-soft);
  }
  .kv > div.unavailable {
    opacity: 0.6;
  }
  .bmore {
    inline-size: 100%;
    min-block-size: var(--sw-touch-desktop, 44px);
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface);
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-sm);
    cursor: pointer;
  }
  .bmore:focus-visible {
    outline: 2px solid var(--sw-focus);
    outline-offset: 2px;
  }
  /* the head pill of the area (name, counts, the temperature, all off): a plain-variant pill is not a button */
  .bhead {
    cursor: default;
  }
  .bhead:hover {
    background: var(--pill-base, var(--sw-surface));
  }
  /* the security strip as pill chips */
  :host([data-skin='bubble']) .sec-strip {
    border: 0;
    border-radius: var(--sw-r-lg);
    background: var(--sw-surface);
    box-shadow: none;
    padding: 8px 12px;
    gap: 8px;
  }
  :host([data-skin='bubble']) .sec-chip {
    border: 0;
    background: var(--sw-layer-2);
    min-block-size: 36px;
    padding: 0 12px;
  }
  :host([data-skin='bubble']) .note,
  :host([data-skin='bubble']) .count {
    padding-inline: 8px;
  }
  /* ---- inside the sheet: pills are translucent layers over the sheet, chips and a big target ---- */
  sw-sheet sw-pill {
    --pill-base: var(--sw-layer);
  }
  sw-sheet .kv > div {
    background: var(--sw-layer);
  }
  .bsh {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-text-2);
    display: flex;
    align-items: center;
    gap: 10px;
    margin-block-start: 4px;
  }
  .bsh::after {
    content: '';
    flex: 1;
    block-size: 4px;
    border-radius: 2px;
    background: var(--sw-layer);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .target {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 12px 8px;
    border-radius: var(--sw-r-lg);
    background: var(--sw-layer);
  }
  .target .tv {
    flex: 1 1 auto;
    min-inline-size: 0;
    text-align: center;
  }
  .target .tv .n {
    font-size: 40px;
    font-weight: var(--sw-fw-bold);
    font-variant-numeric: tabular-nums;
    line-height: 1.1;
  }
  .target .tv .l {
    display: block;
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-2);
  }
  .target .sb {
    inline-size: 56px;
    block-size: 56px;
  }
  .bbtn {
    min-block-size: var(--sw-touch-desktop, 44px);
    padding: 0 18px;
    border: 0;
    border-radius: var(--sw-r-pill);
    background: var(--sw-surface-2);
    color: var(--sw-text);
    font: inherit;
    font-weight: var(--sw-fw-semibold);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }
  .bbtn.primary {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  .bbtn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .brow {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .brow > .bbtn {
    flex: 1 1 100px;
  }
  .bstatus {
    font-size: var(--sw-fs-xs);
    border-radius: var(--sw-r-md);
    padding: 8px 12px;
    background: var(--sw-layer);
  }
  .bstatus.bad {
    color: var(--sw-danger-text);
    background: var(--sw-danger-soft);
  }
  .bstatus.pending {
    color: var(--sw-warning-text);
    background: var(--sw-warning-soft);
  }
  @media (prefers-reduced-motion: reduce) {
    .sb,
    .bsep .bt.fold sw-icon {
      transition: none;
    }
  }
`;

const unavailableOf = (r: DeviceRow) => !r.available || r.state === 'unavailable';

/** The pill's state line: the command status while something is in flight, else what HA reports. */
function stateOf(h: BubbleAreaHost, r: DeviceRow, base: string): string {
  const s = h.ctl.pillStatus(r.entity_id);
  return s ? s.text : base;
}

function sensorValue(r: DeviceRow): string {
  if (unavailableOf(r)) return '׳׳ ׳–׳׳™׳';
  if (r.domain === 'sensor' && r.value !== null && r.value !== undefined) return `${ltrNum(Number.isInteger(r.value) ? r.value : r.value.toFixed(1))}${r.unit ? (r.unit.startsWith('ֲ°') || r.unit === '%' ? r.unit : ` ${r.unit}`) : ''}`;
  if (r.domain === 'sensor') return r.state ?? 'ג€”';
  return rowLabel(r);
}

function sensorIcon(r: DeviceRow): IconName {
  const c = r.device_class ?? '';
  if (c === 'temperature') return 'thermometer';
  if (c === 'humidity') return 'sensor';
  if (c === 'motion' || c === 'occupancy' || c === 'presence' || c === 'moving') return 'activity';
  if (c === 'door' || c === 'window' || c === 'opening' || c === 'garage_door') return 'door';
  if (c === 'power' || c === 'energy') return 'bolt';
  if (c === 'battery') return 'storage';
  return 'sensor';
}

// ------------------------------------------------------------------------------------------------------------ the pills

/** One device as a pill row. `card` decides the shape; `can` the controls (read-only pills still open their sheet). */
export function renderBubblePill(h: BubbleAreaHost, r: DeviceRow, card: CardId): TemplateResult {
  const unavailable = unavailableOf(r);
  const can = r.can_control && !unavailable;
  const hue = hueOf(r.entity_id);
  const ctl = h.ctl;
  const pending = ctl.rowPending(r.entity_id);
  const open = () => h.openSheet(r, card);
  const common = { 'data-entity': r.entity_id };
  void common;
  if (card === 'lighting' || card === 'switches') {
    const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
    const dimmable = r.domain === 'light' && r.brightness_pct !== null && r.brightness_pct !== undefined;
    const pct = ctl.live<number>(r.entity_id, 'brightness') ?? r.brightness_pct ?? 0;
    const label = on ? (dimmable ? `׳“׳•׳׳§ ֲ· ${ltrNum(Math.round(pct))}%` : r.domain === 'light' ? '׳“׳•׳׳§' : '׳₪׳•׳¢׳') : unavailable ? '׳׳ ׳–׳׳™׳' : '׳›׳‘׳•׳™';
    const alarm = r.alarm_managed ? html`<button slot="subs" type="button" class="chip" aria-label=${r.managed_label ?? '׳ ׳©׳׳˜ ׳׳׳¡׳ ׳”׳׳–׳¢׳§׳”'} data-alarm-managed @click=${() => navigate('/security/alarm')}><sw-icon name="shield" size=${14}></sw-icon></button>` : nothing;
    if (dimmable) {
      return html`<sw-pill variant="slider" icon="light" .label=${bidi(r.name)} .state=${stateOf(h, r, label)} .value=${Math.max(0, Math.min(1, pct / 100))} ?on=${on} .hue=${hue} ?unavailable=${unavailable || !r.can_control}
        data-entity=${r.entity_id} data-active=${String(on)} ?data-can-control=${can} ?data-pending=${pending} title=${r.entity_id}
        @toggle=${(e: CustomEvent<{ on: boolean }>) => can && ctl.power(r, e.detail.on)}
        @input=${(e: CustomEvent<{ value: number }>) => can && ctl.brightness(r, Math.round(e.detail.value * 100))}
        @icon-click=${open}>${alarm}${h.assignButton(r)}</sw-pill>`;
    }
    return html`<sw-pill variant="toggle" .icon=${card === 'lighting' ? 'light' : 'bolt'} .label=${bidi(r.name)} .state=${stateOf(h, r, label)} ?on=${on} ?accent=${on && card === 'switches'} .hue=${hue} ?unavailable=${unavailable || !r.can_control}
      data-entity=${r.entity_id} data-active=${String(on)} ?data-can-control=${can} ?data-pending=${pending} title=${r.entity_id}
      @toggle=${(e: CustomEvent<{ on: boolean }>) => can && ctl.power(r, e.detail.on)} @icon-click=${open}>${alarm}${h.assignButton(r)}</sw-pill>`;
  }
  if (card === 'covers') {
    if (r.door_class) {
      return html`<sw-pill variant="plain" icon="door" .label=${bidi(r.name)} .state=${rowLabel(r)} .hue=${hue} ?unavailable=${unavailable} data-entity=${r.entity_id} data-active=${String(r.active)} data-door-class="true" title=${r.entity_id} @activate=${open} @icon-click=${open}>${h.assignButton(r)}</sw-pill>`;
    }
    const hasPos = r.position !== null && r.position !== undefined;
    const shown = ctl.coverShown(r);
    const draft = ctl.coverDraft(r);
    const moving = ctl.coverMoving(r);
    const posLabel = hasPos && !unavailable ? `${r.state === 'opening' ? '׳ ׳₪׳×׳—ג€¦' : r.state === 'closing' ? '׳ ׳¡׳’׳¨ג€¦' : shown > 0 ? '׳₪׳×׳•׳—' : '׳¡׳’׳•׳¨'} ֲ· ${ltrNum(Math.round(shown))}%` : rowLabel(r);
    const subs = can
      ? html`<button slot="subs" type="button" class=${classMap({ sb: true, armed: ctl.coverArmed(r, 'open') })} aria-label=${ctl.coverArmed(r, 'open') ? '׳׳׳©׳¨ ׳₪׳×׳™׳—׳”?' : '׳₪׳×׳—'} ?disabled=${moving} data-control="open" @click=${() => ctl.coverMove(r, 'open')}><sw-icon name="arrowUp" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class="sb" aria-label="׳¢׳¦׳•׳¨" data-control="stop" @click=${() => ctl.coverMove(r, 'stop')}><sw-icon name="pause" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${classMap({ sb: true, armed: ctl.coverArmed(r, 'close') })} aria-label=${ctl.coverArmed(r, 'close') ? '׳׳׳©׳¨ ׳¡׳’׳™׳¨׳”?' : '׳¡׳’׳•׳¨'} ?disabled=${moving} data-control="close" @click=${() => ctl.coverMove(r, 'close')}><sw-icon name="arrowDown" size=${18}></sw-icon></button>
          ${draft !== undefined ? html`<button slot="subs" type="button" class="chip armed" data-control="position-confirm" @click=${() => ctl.coverConfirm(r)}>${`׳׳׳©׳¨ ${ltrNum(draft)}%?`}</button>` : nothing}`
      : nothing;
    const armedAny = ctl.coverArmed(r, 'open') || ctl.coverArmed(r, 'close');
    return html`<sw-pill variant=${hasPos && can ? 'slider' : 'plain'} icon="layers" .label=${bidi(r.name)} .state=${stateOf(h, r, armedAny ? '׳׳—׳™׳¦׳” ׳ ׳•׳¡׳₪׳× ׳׳׳©׳¨׳×' : posLabel)} .value=${Math.max(0, Math.min(1, shown / 100))} ?on=${hasPos && shown > 0 && !unavailable} fill-color="var(--sw-accent-soft)" keep-text .hue=${hue} ?unavailable=${unavailable}
      data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${can} ?data-pending=${pending} data-door-class="false" title=${r.entity_id}
      @toggle=${() => (hasPos && can ? ctl.coverStage(r, shown > 0 ? 0 : 100) : open())} @change=${(e: CustomEvent<{ value: number }>) => can && ctl.coverStage(r, Math.round(e.detail.value * 100))} @activate=${open} @icon-click=${open}>${subs}${h.assignButton(r)}</sw-pill>`;
  }
  if (card === 'climate' || card === 'heating') {
    if (r.domain === 'climate') {
      const { min, max, step } = climateRange(r);
      const target = ctl.live<number>(r.entity_id, 'temp') ?? r.target_temperature;
      const mode = ctl.live<string>(r.entity_id, 'mode') ?? r.hvac_mode ?? '';
      const active = r.active && !unavailable && mode !== 'off';
      const heat = r.hvac_action === 'heating' || mode === 'heat' || r.climate_kind === 'heating';
      const state = unavailable ? '׳׳ ׳–׳׳™׳' : `${HVAC_HE[mode] ?? mode ?? ''}${r.hvac_action && HVAC_ACTION_HE[r.hvac_action] && r.hvac_action !== mode ? ` ֲ· ${HVAC_ACTION_HE[r.hvac_action]}` : ''}${r.current_temperature !== null && r.current_temperature !== undefined ? ` ֲ· ׳‘׳—׳“׳¨ ${deg(r.current_temperature)}` : ''}`;
      const subs = can && target !== null && target !== undefined
        ? html`<button slot="subs" type="button" class="sb" aria-label="׳”׳ ׳׳" data-control="temp-down" ?disabled=${target <= min} @click=${() => ctl.climateTemp(r, target - step)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <button slot="subs" type="button" class="chip" aria-label=${`׳™׳¢׳“ ${deg(target)}`} data-control="temp-value" @click=${open}>${deg(target)}</button>
            <button slot="subs" type="button" class="sb" aria-label="׳”׳’׳‘׳”" data-control="temp-up" ?disabled=${target >= max} @click=${() => ctl.climateTemp(r, target + step)}><sw-icon name="plus" size=${18}></sw-icon></button>`
        : nothing;
      return html`<sw-pill variant="plain" .icon=${heat ? 'flame' : 'snow'} .label=${bidi(r.name)} .state=${stateOf(h, r, state)} ?on=${active} fill-color=${heat ? 'var(--sw-heat)' : 'var(--sw-cool)'} .hue=${hue} ?unavailable=${unavailable}
        data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${can} ?data-pending=${pending} title=${r.entity_id} @activate=${open} @icon-click=${open}>${subs}${h.assignButton(r)}</sw-pill>`;
    }
    // a fan or a humidifier: its power on the pill, the rest in the sheet
    const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
    const fan = r.domain === 'fan';
    const pct = ctl.live<number>(r.entity_id, 'percentage') ?? r.percentage;
    return html`<sw-pill variant=${fan && can && pct !== null && pct !== undefined ? 'slider' : 'plain'} .icon=${fan ? 'fan' : 'activity'} .label=${bidi(r.name)} .state=${stateOf(h, r, rowLabel(r))} .value=${Math.max(0, Math.min(1, (pct ?? 0) / 100))} ?on=${on} fill-color="var(--sw-accent-soft)" keep-text .hue=${hue} ?unavailable=${unavailable}
      data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${can} ?data-pending=${pending} title=${r.entity_id}
      @toggle=${(e: CustomEvent<{ on: boolean }>) => can && fan && ctl.power(r, e.detail.on)} @input=${(e: CustomEvent<{ value: number }>) => can && fan && ctl.fanPercentage(r, Math.round(e.detail.value * 100))} @activate=${open} @icon-click=${open}>${h.assignButton(r)}</sw-pill>`;
  }
  if (card === 'security') {
    const icon: IconName = r.kind === 'lock' ? (r.locked ? 'lock' : 'unlock') : r.kind === 'alarm' ? 'shield' : r.kind === 'camera' ? 'camera' : 'door';
    const state = unavailable ? '׳׳ ׳–׳׳™׳' : r.kind === 'lock' ? (r.locked ? '׳ ׳¢׳•׳' : rowLabel(r)) : r.kind === 'camera' ? '׳׳¦׳׳׳× ׳”׳×׳§׳' : rowLabel(r);
    const go = r.kind === 'alarm' ? () => navigate('/security/alarm') : open;
    return html`<sw-pill variant="plain" .icon=${icon} .label=${bidi(r.name)} .state=${state} .hue=${hue} ?on=${r.kind === 'alarm' ? r.state === 'triggered' : r.kind === 'binary_sensor' ? r.state === 'on' : false} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${unavailable}
      data-entity=${r.entity_id} data-kind=${r.kind ?? ''} title=${r.entity_id} @activate=${go} @icon-click=${go}>${h.assignButton(r)}</sw-pill>`;
  }
  if (card === 'media') {
    const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
    const playing = (ctl.live<string>(r.entity_id, 'playpause') ?? r.state) === 'playing';
    const muted = ctl.live<boolean>(r.entity_id, 'mute') ?? Boolean(r.muted);
    const state = unavailable ? '׳׳ ׳–׳׳™׳' : [rowLabel(r), r.media_title, r.source].filter(Boolean).join(' ֲ· ');
    const subs = can
      ? html`<button slot="subs" type="button" class=${classMap({ sb: true, dark: playing })} aria-label=${playing ? '׳”׳©׳”׳”' : '׳ ׳’׳'} data-control="playpause" @click=${() => ctl.mediaPlayPause(r)}><sw-icon .name=${playing ? 'pause' : 'play'} size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${classMap({ sb: true, on: muted })} aria-label=${muted ? '׳‘׳˜׳ ׳”׳©׳×׳§׳”' : '׳”׳©׳×׳§׳”'} data-control="mute" @click=${() => ctl.mediaMute(r)}><sw-icon name="volume" size=${18}></sw-icon></button>
          <button slot="subs" type="button" class=${classMap({ sb: true, on })} role="switch" aria-checked=${String(on)} aria-label=${on ? '׳›׳‘׳”' : '׳”׳“׳׳§'} data-control="power" @click=${() => ctl.power(r, !on)}><sw-icon name="power" size=${18}></sw-icon></button>`
      : nothing;
    return html`<sw-pill variant="plain" icon="play" .label=${bidi(r.name)} .state=${stateOf(h, r, state)} ?on=${playing && !unavailable} fill-color="var(--sw-lit)" .hue=${hue} ?unavailable=${unavailable}
      data-entity=${r.entity_id} data-active=${String(r.active)} ?data-can-control=${can} ?data-pending=${pending} title=${r.entity_id} @activate=${open} @icon-click=${open}>${subs}${h.assignButton(r)}</sw-pill>`;
  }
  // sensors
  return html`<sw-pill variant="plain" .icon=${sensorIcon(r)} .label=${bidi(r.name)} .state=${sensorValue(r)} .hue=${hue} ?on=${r.domain === 'binary_sensor' && r.state === 'on'} fill-color="var(--sw-warning-soft)" keep-text ?unavailable=${unavailable}
    data-entity=${r.entity_id} data-active=${String(r.active)} title=${r.entity_id} @activate=${open} @icon-click=${open}>${h.assignButton(r)}</sw-pill>`;
}

/** A main-strip sensor as a value tile. */
export function renderBubbleSensorTile(r: DeviceRow, slot: string | null): TemplateResult {
  const unavailable = unavailableOf(r);
  return html`<div class=${classMap({ unavailable, hot: r.domain === 'binary_sensor' && r.state === 'on' })} data-main-sensor=${r.entity_id} data-slot=${slot ?? ''} title=${r.entity_id}>
    <span class="k">${bidi(r.name)}</span><div class="v">${sensorValue(r)}</div>
  </div>`;
}

/** The section separator: icon, label, rule, count, the fold (phone) and the section's actions. */
export function renderBubbleSep(opts: { id: CardId; icon: IconName; label: string; count: string; fold?: { open: boolean; toggle: () => void } | null; actions?: TemplateResult | typeof nothing }): TemplateResult {
  const fold = opts.fold;
  return html`<div class="bsep" data-bubble-section=${opts.id}>
    ${fold
      ? html`<button type="button" class="bt fold" aria-expanded=${String(fold.open)} aria-label=${`${fold.open ? '׳›׳•׳•׳¥' : '׳”׳¨׳—׳‘'} ${opts.label}`} @click=${fold.toggle}><sw-icon name="chevronDown" size=${16}></sw-icon><sw-icon .name=${opts.icon} size=${18}></sw-icon><span>${opts.label}</span></button>`
      : html`<sw-icon .name=${opts.icon} size=${18}></sw-icon><span class="bt">${opts.label}</span>`}
    ${opts.count ? html`<span class="bn">${opts.count}</span>` : nothing}
    <span class="rule"></span>
    ${opts.actions ? html`<span class="acts">${opts.actions}</span>` : nothing}
  </div>`;
}

// ------------------------------------------------------------------------------------------------------------ the sheets

function status(h: BubbleAreaHost, r: DeviceRow) {
  const s = h.ctl.pillStatus(r.entity_id);
  return s ? html`<div class=${classMap({ bstatus: true, bad: s.tone === 'bad', pending: s.tone === 'pending' })} role="status" data-cmd-status=${s.tone === 'bad' ? 'rolled_back' : s.tone}>${s.text}</div>` : nothing;
}

function facts(r: DeviceRow, extra: { k: string; v: string }[] = []) {
  const all = [...extra, ...(r.last_changed ? [{ k: '׳©׳™׳ ׳•׳™ ׳׳—׳¨׳•׳', v: fmtTime(r.last_changed) }] : [])];
  if (!all.length) return nothing;
  return html`<div class="kv">${all.map((f) => html`<div><span class="k">${f.k}</span><div class=${classMap({ v: true, sm: f.v.length > 12 })}>${f.v}</div></div>`)}</div>`;
}

const chips = (list: readonly string[], current: string, label: (v: string) => string, pick: (v: string) => void, control: string) =>
  html`<div class="chips" role="group" data-control=${control}>${list.map((m) => html`<button type="button" class="chip" aria-pressed=${String(m === current)} @click=${() => pick(m)}>${label(m)}</button>`)}</div>`;

/** The body of a device's sheet, per card. The head (the device's own pill) is drawn by the caller. */
export function renderBubbleSheetBody(h: BubbleAreaHost, r: DeviceRow, card: CardId): TemplateResult {
  const ctl = h.ctl;
  const unavailable = unavailableOf(r);
  const can = r.can_control && !unavailable;
  if (card === 'lighting' || card === 'switches') {
    const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
    const dimmable = r.domain === 'light' && r.brightness_pct !== null && r.brightness_pct !== undefined;
    const pct = ctl.live<number>(r.entity_id, 'brightness') ?? r.brightness_pct ?? 0;
    return html`${dimmable
        ? html`<sw-pill variant="slider" icon="light" label="׳‘׳”׳™׳¨׳•׳×" .state=${on ? `${ltrNum(Math.round(pct))}%` : '׳›׳‘׳•׳™'} .value=${Math.max(0, Math.min(1, pct / 100))} ?on=${on} ?unavailable=${!can} data-control="brightness"
            @toggle=${(e: CustomEvent<{ on: boolean }>) => can && ctl.power(r, e.detail.on)} @input=${(e: CustomEvent<{ value: number }>) => can && ctl.brightness(r, Math.round(e.detail.value * 100))}></sw-pill>`
        : nothing}
      ${can ? html`<div class="brow"><button type="button" class=${classMap({ bbtn: true, primary: !on })} data-control="power" @click=${() => ctl.power(r, !on)}><sw-icon name="power" size=${18}></sw-icon>${on ? '׳›׳‘׳”' : '׳”׳“׳׳§'}</button></div>` : nothing}
      ${status(h, r)}
      ${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }])}`;
  }
  if (card === 'covers') {
    if (r.door_class || !can) return html`${status(h, r)}${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }, ...(r.door_class ? [{ k: '׳¡׳•׳’', v: '׳“׳׳× / ׳©׳¢׳¨' }] : [])])}`;
    const axis = (ax: 'position' | 'tilt', label: string, has: boolean) => {
      if (!has) return nothing;
      const shown = ctl.coverShown(r, ax);
      const draft = ctl.coverDraft(r, ax);
      const moving = ctl.coverMoving(r, ax);
      return html`<div class="bsh">${label}</div>
        <sw-pill variant="slider" .icon=${ax === 'tilt' ? 'move' : 'layers'} .label=${ax === 'tilt' ? '׳”׳˜׳™׳”' : '׳׳™׳§׳•׳'} .state=${`${ltrNum(Math.round(shown))}%${draft !== undefined ? ' ֲ· ׳˜׳¨׳ ׳ ׳©׳׳—' : ''}`} .value=${Math.max(0, Math.min(1, shown / 100))} ?on=${shown > 0} fill-color="var(--sw-accent-soft)" keep-text data-control=${ax === 'tilt' ? 'tilt-position' : 'position'}
          @toggle=${() => ctl.coverStage(r, shown > 0 ? 0 : 100, ax)} @change=${(e: CustomEvent<{ value: number }>) => ctl.coverStage(r, Math.round(e.detail.value * 100), ax)}>
          ${draft !== undefined ? html`<button slot="subs" type="button" class="chip armed" data-control=${ax === 'tilt' ? 'tilt-position-confirm' : 'position-confirm'} @click=${() => ctl.coverConfirm(r, ax)}>${`׳׳׳©׳¨ ${ltrNum(draft)}%?`}</button>` : nothing}
        </sw-pill>
        <div class="brow" data-control=${ax === 'tilt' ? 'cover-tilt' : 'cover'}>
          <button type="button" class=${classMap({ bbtn: true, primary: ctl.coverArmed(r, 'open', ax) })} ?disabled=${moving} data-control=${ax === 'tilt' ? 'open-tilt' : 'open'} @click=${() => ctl.coverMove(r, 'open', ax)}><sw-icon name="arrowUp" size=${18}></sw-icon>${ctl.coverArmed(r, 'open', ax) ? '׳׳׳©׳¨ ׳₪׳×׳™׳—׳”?' : '׳₪׳×׳™׳—׳”'}</button>
          <button type="button" class="bbtn" data-control=${ax === 'tilt' ? 'stop-tilt' : 'stop'} @click=${() => ctl.coverMove(r, 'stop', ax)}><sw-icon name="pause" size=${18}></sw-icon>׳¢׳¦׳™׳¨׳”</button>
          <button type="button" class=${classMap({ bbtn: true, primary: ctl.coverArmed(r, 'close', ax) })} ?disabled=${moving} data-control=${ax === 'tilt' ? 'close-tilt' : 'close'} @click=${() => ctl.coverMove(r, 'close', ax)}><sw-icon name="arrowDown" size=${18}></sw-icon>${ctl.coverArmed(r, 'close', ax) ? '׳׳׳©׳¨ ׳¡׳’׳™׳¨׳”?' : '׳¡׳’׳™׳¨׳”'}</button>
        </div>`;
    };
    return html`${axis('position', '׳׳™׳§׳•׳', true)}${axis('tilt', '׳”׳˜׳™׳”', r.tilt !== null && r.tilt !== undefined)}${status(h, r)}${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }])}`;
  }
  if (card === 'climate' || card === 'heating') {
    if (r.domain === 'climate') {
      const { min, max, step } = climateRange(r);
      const target = ctl.live<number>(r.entity_id, 'temp') ?? r.target_temperature;
      const mode = ctl.live<string>(r.entity_id, 'mode') ?? r.hvac_mode ?? '';
      const modes = (r.hvac_modes ?? []).filter((m) => ['off', 'heat', 'cool', 'heat_cool', 'auto', 'dry', 'fan_only'].includes(m));
      const fan = ctl.live<string>(r.entity_id, 'fan') ?? r.fan_mode ?? '';
      const preset = ctl.live<string>(r.entity_id, 'preset') ?? r.preset_mode ?? '';
      const swing = ctl.live<string>(r.entity_id, 'swing') ?? r.swing_mode ?? '';
      const hum = ctl.live<number>(r.entity_id, 'humidity') ?? r.target_humidity;
      const sub = [r.current_temperature !== null && r.current_temperature !== undefined ? `׳‘׳—׳“׳¨ ${deg(r.current_temperature)}` : '', r.current_humidity !== null && r.current_humidity !== undefined ? `׳׳—׳•׳× ${ltrNum(r.current_humidity)}%` : ''].filter(Boolean).join(' ֲ· ');
      return html`${target !== null && target !== undefined
          ? html`<div class="target" data-control="climate">
              <button type="button" class="sb" aria-label="׳”׳ ׳׳" data-control="temp-down" ?disabled=${!can || target <= min} @click=${() => ctl.climateTemp(r, target - step)}><sw-icon name="minus" size=${22}></sw-icon></button>
              <div class="tv"><span class="l">׳™׳¢׳“</span><div class="n" data-control="temp-value">${deg(target)}</div>${sub ? html`<span class="l">${sub}</span>` : nothing}</div>
              <button type="button" class="sb" aria-label="׳”׳’׳‘׳”" data-control="temp-up" ?disabled=${!can || target >= max} @click=${() => ctl.climateTemp(r, target + step)}><sw-icon name="plus" size=${22}></sw-icon></button>
            </div>`
          : nothing}
        ${modes.length && can ? html`<div class="bsh">׳׳¦׳‘</div>${chips(modes, mode, (m) => HVAC_HE[m] ?? m, (m) => ctl.climateMode(r, m), 'mode')}` : nothing}
        ${r.fan_modes?.length && can ? html`<div class="bsh">׳׳׳•׳•׳¨׳¨</div>${chips(r.fan_modes, fan, (m) => m, (m) => ctl.climateChoice(r, 'fan', m), 'fan-mode')}` : nothing}
        ${r.preset_modes?.length && can ? html`<div class="bsh">׳׳¦׳‘ ׳׳•׳’׳“׳¨</div>${chips(r.preset_modes, preset, (m) => m, (m) => ctl.climateChoice(r, 'preset', m), 'preset-mode')}` : nothing}
        ${r.swing_modes?.length && can ? html`<div class="bsh">׳ ׳“׳ ׳•׳“</div>${chips(r.swing_modes, swing, (m) => m, (m) => ctl.climateChoice(r, 'swing', m), 'swing-mode')}` : nothing}
        ${hum !== null && hum !== undefined && can
          ? html`<div class="bsh">׳׳—׳•׳× ׳™׳¢׳“</div><div class="brow" data-control="humidity">
              <button type="button" class="sb" aria-label="׳”׳₪׳—׳× ׳׳—׳•׳× ׳™׳¢׳“" data-control="humidity-down" @click=${() => ctl.humidity(r, hum - 5)}><sw-icon name="minus" size=${18}></sw-icon></button>
              <span class="chip plain" data-control="humidity-value">${ltrNum(hum)}%</span>
              <button type="button" class="sb" aria-label="׳”׳’׳‘׳¨ ׳׳—׳•׳× ׳™׳¢׳“" data-control="humidity-up" @click=${() => ctl.humidity(r, hum + 5)}><sw-icon name="plus" size=${18}></sw-icon></button>
            </div>`
          : nothing}
        ${status(h, r)}
        ${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }, ...(r.hvac_action ? [{ k: '׳¢׳›׳©׳™׳•', v: HVAC_ACTION_HE[r.hvac_action] ?? r.hvac_action }] : [])])}`;
    }
    if (r.domain === 'fan') {
      const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
      const pct = ctl.live<number>(r.entity_id, 'percentage') ?? r.percentage;
      return html`${pct !== null && pct !== undefined
          ? html`<sw-pill variant="slider" icon="fan" label="׳¢׳•׳¦׳׳”" .state=${on ? `${ltrNum(Math.round(pct))}%` : '׳›׳‘׳•׳™'} .value=${Math.max(0, Math.min(1, pct / 100))} ?on=${on} fill-color="var(--sw-accent-soft)" keep-text ?unavailable=${!can} data-control="percentage"
              @toggle=${(e: CustomEvent<{ on: boolean }>) => can && ctl.power(r, e.detail.on)} @input=${(e: CustomEvent<{ value: number }>) => can && ctl.fanPercentage(r, Math.round(e.detail.value * 100))}></sw-pill>`
          : nothing}
        ${can ? html`<div class="brow"><button type="button" class=${classMap({ bbtn: true, primary: !on })} data-control="power" @click=${() => ctl.power(r, !on)}><sw-icon name="power" size=${18}></sw-icon>${on ? '׳›׳‘׳”' : '׳”׳“׳׳§'}</button></div>` : nothing}
        ${status(h, r)}${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }])}`;
    }
    // a humidifier
    const modeH = ctl.live<string>(r.entity_id, 'mode') ?? r.mode ?? '';
    const humH = ctl.live<number>(r.entity_id, 'humidity') ?? r.target_humidity;
    return html`${r.available_modes?.length && can ? html`<div class="bsh">׳׳¦׳‘</div>${chips(r.available_modes, modeH, (m) => m, (m) => ctl.climateChoice(r, 'hmode', m), 'mode')}` : nothing}
      ${humH !== null && humH !== undefined && can
        ? html`<div class="bsh">׳׳—׳•׳× ׳™׳¢׳“</div><div class="brow" data-control="humidifier">
            <button type="button" class="sb" aria-label="׳”׳₪׳—׳× ׳׳—׳•׳× ׳™׳¢׳“" data-control="humidity-down" @click=${() => ctl.humidity(r, humH - 5)}><sw-icon name="minus" size=${18}></sw-icon></button>
            <span class="chip plain" data-control="humidity-value">${ltrNum(humH)}%</span>
            <button type="button" class="sb" aria-label="׳”׳’׳‘׳¨ ׳׳—׳•׳× ׳™׳¢׳“" data-control="humidity-up" @click=${() => ctl.humidity(r, humH + 5)}><sw-icon name="plus" size=${18}></sw-icon></button>
          </div>`
        : nothing}
      ${status(h, r)}${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }, ...(r.current_humidity !== null && r.current_humidity !== undefined ? [{ k: '׳׳—׳•׳×', v: `${ltrNum(r.current_humidity)}%` }] : [])])}`;
  }
  if (card === 'media') {
    const on = (ctl.live<boolean>(r.entity_id, 'power') ?? r.active) && !unavailable;
    const playing = (ctl.live<string>(r.entity_id, 'playpause') ?? r.state) === 'playing';
    const muted = ctl.live<boolean>(r.entity_id, 'mute') ?? Boolean(r.muted);
    return html`${can
        ? html`<div class="brow" data-control="media">
            <button type="button" class="bbtn primary" data-control="playpause" @click=${() => ctl.mediaPlayPause(r)}><sw-icon .name=${playing ? 'pause' : 'play'} size=${18}></sw-icon>${playing ? '׳”׳©׳”׳”' : '׳ ׳’׳'}</button>
            <button type="button" class=${classMap({ bbtn: true, primary: muted })} data-control="mute" @click=${() => ctl.mediaMute(r)}><sw-icon name="volume" size=${18}></sw-icon>${muted ? '׳‘׳˜׳ ׳”׳©׳×׳§׳”' : '׳”׳©׳×׳§'}</button>
            <button type="button" class="bbtn" data-control="power" @click=${() => ctl.power(r, !on)}><sw-icon name="power" size=${18}></sw-icon>${on ? '׳›׳‘׳”' : '׳”׳“׳׳§'}</button>
          </div>`
        : nothing}
      ${status(h, r)}
      ${facts(r, [{ k: '׳׳¦׳‘', v: rowLabel(r) }, ...(r.media_title ? [{ k: '׳׳×׳ ׳’׳', v: r.media_title }] : []), ...(r.source ? [{ k: '׳׳§׳•׳¨', v: r.source }] : []), ...(r.volume_pct !== null && r.volume_pct !== undefined ? [{ k: '׳¢׳•׳¦׳׳”', v: `${ltrNum(r.volume_pct)}%${r.muted ? ' ֲ· ׳׳•׳©׳×׳§' : ''}` }] : [])])}`;
  }
  if (card === 'security') {
    const state = unavailable ? '׳׳ ׳–׳׳™׳' : r.kind === 'alarm' ? (ALARM_HE[r.state ?? ''] ?? r.state ?? '') : r.kind === 'lock' ? (r.locked ? '׳ ׳¢׳•׳' : rowLabel(r)) : r.kind === 'camera' ? '׳׳¦׳׳׳× ׳”׳×׳§׳' : rowLabel(r);
    return html`${facts(r, [{ k: '׳׳¦׳‘', v: state }])}`;
  }
  return html`${facts(r, [{ k: '׳¢׳¨׳', v: sensorValue(r) }])}`;
}
