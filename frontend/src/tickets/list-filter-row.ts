import { html, nothing, type TemplateResult } from 'lit';
import { bidi } from '../i18n/bidi';
import { handlerChoices, offeredFlags, priorityChoices, toggleIn, type CardFilters, type CardFlag } from './list-filters';
import type { CardItem } from './list-card-model';
import { listIcon } from './list-icons';
import { lt, type ListTextKey } from './list-text';
import { tIcon } from './icons';
import { panelSection, type ActiveChip } from './list-toolbar';

/**
 * TKUI4 (release 2.6.0): the filter row of the cards and the board (mock-up v5 "סינון"): hidden until the "סינון" button asks for it, then
 * one glass row - the priorities the held rows use, the handler picker, the flags (stuck / waiting for me / cost to approve, offered only
 * when the rows carry them) and "ניקוי". A template function, not an element: the host's glass styles (`ticketListFrameStyles`,
 * `mediaPageStyles`) dress it, and it changes nothing by itself - every choice goes to `change`. Client-side over the held rows
 * (tickets/list-filters.ts), so it never widens what the server's visibility rule allowed.
 */
const FLAG_LABEL: Record<CardFlag, ListTextKey> = { stuck: 'lfStuck', waiting: 'lfWaiting', cost: 'lfCost' };

/**
 * TICKETS-POLISH-2331: the card filters as sections of the one "סינון" panel (tickets/list-toolbar.ts) - עדיפות (chips), מטפל (a select),
 * and the flags - each with its own heading instead of one wrapping row of labels and separators. The panel resets them all.
 */
export function filterRow(rows: readonly CardItem[], f: CardFilters, change: (next: CardFilters) => void): TemplateResult {
  const prios = priorityChoices(rows);
  const who = handlerChoices(rows);
  const flags = offeredFlags(rows);
  return html`<div class="frow" id="filter-row" role="group" aria-label=${lt('lfGroup')} data-filter-row>
    ${prios.length ? panelSection(lt('lfPriority'), html`<div class="fchips">
      ${prios.map((p) => html`<button type="button" class="rc sm" aria-pressed=${String(f.priority.includes(p.key))} data-f-priority=${p.key} @click=${() => change({ ...f, priority: toggleIn(f.priority, p.key) })}>${bidi(p.name)}</button>`)}
    </div>`, 'priority') : nothing}
    ${panelSection(lt('lfHandler'), html`<label class="vh" for="f-handler">${lt('lfHandler')}</label>
      <select id="f-handler" data-f-handler .value=${f.handler} @change=${(e: Event) => change({ ...f, handler: (e.target as HTMLSelectElement).value })}>
        <option value="" ?selected=${f.handler === ''}>${lt('lfAnyHandler')}</option>
        <option value="none" ?selected=${f.handler === 'none'}>${lt('lfNoHandler')}</option>
        ${who.map((h) => html`<option value=${h.key} ?selected=${f.handler === h.key}>${h.name}</option>`)}
      </select>`, 'handler')}
    ${flags.length ? panelSection(lt('tbFlags'), html`<div class="fchips">
      ${flags.map((k) => html`<button type="button" class="rc sm" aria-pressed=${String(f.flags.includes(k))} data-f-flag=${k} @click=${() => change({ ...f, flags: toggleIn(f.flags, k) })}>${k === 'stuck' ? tIcon('warning') : k === 'cost' ? listIcon('coin') : listIcon('hand')}${lt(FLAG_LABEL[k])}</button>`)}
    </div>`, 'flags') : nothing}
  </div>`;
}

/** TICKETS-POLISH-2331: the card filters that are on, as removable chips of the toolbar (names read from the held rows). */
export function cardFilterChips(rows: readonly CardItem[], f: CardFilters, change: (next: CardFilters) => void): ActiveChip[] {
  const out: ActiveChip[] = [];
  const prios = priorityChoices(rows);
  for (const key of f.priority) out.push({ key: `priority:${key}`, label: `${lt('lfPriority')}: ${prios.find((p) => p.key === key)?.name ?? key}`, remove: () => change({ ...f, priority: f.priority.filter((x) => x !== key) }) });
  if (f.handler) {
    const name = f.handler === 'none' ? lt('lfNoHandler') : handlerChoices(rows).find((h) => h.key === f.handler)?.name ?? lt('lfHandler');
    out.push({ key: 'handler', label: f.handler === 'none' ? name : `${lt('lfHandler')}: ${name}`, remove: () => change({ ...f, handler: '' }) });
  }
  for (const k of f.flags) out.push({ key: `flag:${k}`, label: lt(FLAG_LABEL[k]), remove: () => change({ ...f, flags: f.flags.filter((x) => x !== k) }) });
  return out;
}
