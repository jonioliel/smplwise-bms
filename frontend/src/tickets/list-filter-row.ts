import { html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import { activeCardFilters, handlerChoices, NO_CARD_FILTERS, offeredFlags, priorityChoices, toggleIn, type CardFilters, type CardFlag } from './list-filters';
import type { CardItem } from './list-card-model';
import { listIcon } from './list-icons';
import { lt, type ListTextKey } from './list-text';
import { tIcon } from './icons';

/**
 * TKUI4 (release 2.6.0): the filter row of the cards and the board (mock-up v5 "סינון"): hidden until the "סינון" button asks for it, then
 * one glass row - the priorities the held rows use, the handler picker, the flags (stuck / waiting for me / cost to approve, offered only
 * when the rows carry them) and "ניקוי". A template function, not an element: the host's glass styles (`ticketListFrameStyles`,
 * `mediaPageStyles`) dress it, and it changes nothing by itself - every choice goes to `change`. Client-side over the held rows
 * (tickets/list-filters.ts), so it never widens what the server's visibility rule allowed.
 */
const FLAG_LABEL: Record<CardFlag, ListTextKey> = { stuck: 'lfStuck', waiting: 'lfWaiting', cost: 'lfCost' };

/** The "סינון" button of the header: pressed while the row is open; the count of active choices in its label. */
export function filterButton(open: boolean, active: number, toggle: () => void): TemplateResult {
  return html`<button type="button" class=${`btn sm filterbtn${open || active ? ' primary' : ''}`} aria-expanded=${String(open)} aria-controls="filter-row" data-filter-toggle @click=${toggle}>${tIcon('filter')}${active ? lt('lfBtnCount', { n: active }) : lt('lfBtn')}</button>`;
}

export function filterRow(rows: readonly CardItem[], f: CardFilters, change: (next: CardFilters) => void): TemplateResult {
  const prios = priorityChoices(rows);
  const who = handlerChoices(rows);
  const flags = offeredFlags(rows);
  const active = activeCardFilters(f);
  return html`<div class="frow glass" id="filter-row" role="group" aria-label=${lt('lfGroup')} data-filter-row>
    ${prios.length ? html`<span class="lbl">${lt('lfPriority')}</span>
      ${prios.map((p) => html`<button type="button" class="rc sm" aria-pressed=${String(f.priority.includes(p.key))} data-f-priority=${p.key} @click=${() => change({ ...f, priority: toggleIn(f.priority, p.key) })}>${bidi(p.name)}</button>`)}
      <span class="sep"></span>` : nothing}
    <span class="lbl">${lt('lfHandler')}</span>
    <label class="vh" for="f-handler">${lt('lfHandler')}</label>
    <select id="f-handler" data-f-handler .value=${f.handler} @change=${(e: Event) => change({ ...f, handler: (e.target as HTMLSelectElement).value })}>
      <option value="" ?selected=${f.handler === ''}>${lt('lfAnyHandler')}</option>
      <option value="none" ?selected=${f.handler === 'none'}>${lt('lfNoHandler')}</option>
      ${who.map((h) => html`<option value=${h.key} ?selected=${f.handler === h.key}>${h.name}</option>`)}
    </select>
    ${flags.length ? html`<span class="sep"></span>
      ${flags.map((k) => html`<button type="button" class="rc sm" aria-pressed=${String(f.flags.includes(k))} data-f-flag=${k} @click=${() => change({ ...f, flags: toggleIn(f.flags, k) })}>${k === 'stuck' ? tIcon('warning') : k === 'cost' ? listIcon('coin') : listIcon('hand')}${lt(FLAG_LABEL[k])}</button>`)}` : nothing}
    <span class="grow"></span>
    <button type="button" class="btn sm" data-f-clear ?disabled=${!active} @click=${() => change({ ...NO_CARD_FILTERS })}>${tIcon('x')}${lt('lfClear')}</button>
  </div>`;
}
