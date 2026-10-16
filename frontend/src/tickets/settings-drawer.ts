import { html, type TemplateResult } from 'lit';
import type { UiSettings } from '../api/tickets';
import { DRAWER_TABS, DRAWER_SIZES, PHONE_SHEETS, parseSheet, parseSize, parseTab } from './drawer-model';
import { dwt, type DrawerTextKey } from './drawer-text';

/**
 * TKUI1 (2.6.0): the request drawer's rows of Settings › the module › display ("תצוגה" card of system-tickets.ts, the settings-row pattern
 * of the card around them): the default tab (any of the four; a deep link's `?tab=` still wins), the desktop drawer size (a viewer's own
 * switch wins, per browser) and how the phone sheet opens. Saved through the card's own `saveDoc({ ui: {...} })` (the `tickets.settings`
 * document, keys `ui.detail_tab` / `ui.drawer_size` / `ui.phone_sheet`).
 */
export function drawerSettingsRows(ui: Partial<UiSettings> | undefined, busy: boolean, save: (patch: Partial<UiSettings>) => void): TemplateResult {
  const tab = parseTab(ui?.detail_tab) ?? 'overview';
  const size = parseSize(ui?.drawer_size) ?? 'wide';
  const sheet = parseSheet(ui?.phone_sheet) ?? 'full';
  const seg = <T extends string>(label: DrawerTextKey, values: readonly T[], current: T, word: (v: T) => string, attr: string, key: keyof UiSettings) =>
    html`<span class="seg" role="radiogroup" aria-label=${dwt(label)}>${values.map((v) => html`<button type="button" role="radio" aria-pressed=${String(current === v)} aria-checked=${String(current === v)}
      data-ui-drawer=${`${attr}:${v}`} ?disabled=${busy} @click=${() => save({ [key]: v } as Partial<UiSettings>)}>${word(v)}</button>`)}</span>`;
  return html`
    <div class="row" data-setting="detail_tab"><span class="lbl">${dwt('setDrawerTab')}<span class="muted">${dwt('setDrawerTabSub')}</span></span>
      ${seg('setDrawerTab', DRAWER_TABS, tab, (v) => dwt(`tab_${v}` as DrawerTextKey), 'tab', 'detail_tab')}</div>
    <div class="row" data-setting="drawer_size"><span class="lbl">${dwt('setDrawerSize')}<span class="muted">${dwt('setDrawerSizeSub')}</span></span>
      ${seg('setDrawerSize', DRAWER_SIZES, size, (v) => dwt(`size_${v}` as DrawerTextKey), 'size', 'drawer_size')}</div>
    <div class="row" data-setting="phone_sheet"><span class="lbl">${dwt('setPhoneSheet')}<span class="muted">${dwt('setPhoneSheetSub')}</span></span>
      ${seg('setPhoneSheet', PHONE_SHEETS, sheet, (v) => dwt(`ps_${v}` as DrawerTextKey), 'sheet', 'phone_sheet')}</div>`;
}
