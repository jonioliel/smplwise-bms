import { html, type TemplateResult } from 'lit';
import type { UiSettings } from '../api/tickets';
import { TABLE_MID_WIDTH, parseTableMid, type TableMidWidth } from './table-model';
import { lt } from './list-text';

/**
 * TICKETS-1440-COLUMN-SETTING-2360: the row of Settings > the module > display ("פתיחה והצגה" card of system-tickets.ts) that picks the
 * column the default table keeps at a medium width, where the "מה קורה" sentence and the department column cannot both fit
 * (`ui.table_mid_width`: sentence - default, as before - or department). Saved through the card's own `saveDoc({ ui })`.
 */
export function tableMidRow(ui: Partial<UiSettings> | undefined, busy: boolean, save: (patch: Partial<UiSettings>) => void): TemplateResult {
  const cur = parseTableMid(ui?.table_mid_width);
  const word = (v: TableMidWidth) => (v === 'sentence' ? lt('tmSentence') : lt('tmDepartment'));
  return html`<div class="row" data-setting="table_mid_width"><span class="lbl">${lt('setTableMid')}<span class="muted">${lt('setTableMidSub')}</span></span>
    <span class="seg" role="radiogroup" aria-label=${lt('setTableMid')}>${TABLE_MID_WIDTH.map((v) => html`<button type="button" role="radio" aria-pressed=${String(cur === v)} aria-checked=${String(cur === v)}
      data-ui-table-mid=${v} ?disabled=${busy} @click=${() => save({ table_mid_width: v })}>${word(v)}</button>`)}</span></div>`;
}
