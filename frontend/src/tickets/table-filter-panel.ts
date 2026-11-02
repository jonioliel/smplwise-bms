import { css, html, nothing, type TemplateResult } from 'lit';
import type { Meta } from '../api/tickets';
import { PRIORITY_KEYS, costColumnsOn, type ExtraFilters } from './table-model';
import { tbt, type TableTextKey } from './table-text';
import { COST_FILTER_STATUSES } from './cost-model';
import { ct, type CostTextKey } from './cost-text';
import { fromLocalInput, toLocalInput } from './model';
import { dateInputLang } from '../api/day-format';
import { panelSection, type ActiveChip } from './list-toolbar';

/**
 * POLISH-LEFTOVERS-2341: the table view's server-side filters (priority, handler, waiting for a manager, stuck, cost state, opened
 * between) as sections of the page's ONE "סינון" panel - the table toolbar no longer has its own "סינון" button there (two buttons with
 * the same name, TICKETS-POLISH-2331 "Left"). The page owns the state (`ExtraFilters`) and hands it to `<tickets-table .extra>`; the
 * data hooks are the toolbar's own (data-f-priority, data-f-assignee, data-f-holders, data-f-waiting, data-f-stuck, data-f-cost-status,
 * data-f-from, data-f-to); the panel's foot (data-f-reset / data-f-clear) clears them with the page filters.
 */
export function tableFilterSections(e: ExtraFilters, meta: Meta | null, holders: readonly { key: string; name: string }[], set: (next: ExtraFilters) => void): TemplateResult {
  const patch = (p: Partial<ExtraFilters>) => set({ ...e, ...p });
  const prioName = (k: string) => meta?.departments[0]?.priorities.find((p) => p.key === k)?.name ?? tbt(`prio_${k}` as TableTextKey);
  const radio = (value: string, label: string) => html`<button type="button" class="rc" aria-pressed=${String(e.assignee === value)} data-f-assignee=${value || 'any'} @click=${() => patch({ assignee: value })}>${label}</button>`;
  return html`<div class="tfilters" data-table-filters>
    ${panelSection(tbt('fPriority'), html`<div class="fchips" role="group" aria-label=${tbt('fPriority')}>${PRIORITY_KEYS.map((k) => html`<button type="button" class="rc" aria-pressed=${String(e.priority.includes(k))} data-f-priority=${k}
      @click=${() => patch({ priority: e.priority.includes(k) ? e.priority.filter((x) => x !== k) : [...e.priority, k] })}>${prioName(k)}</button>`)}</div>`, 'priority')}
    ${panelSection(tbt('fAssignee'), html`<div class="fchips" role="group" aria-label=${tbt('fAssignee')}>${radio('', tbt('fAssigneeAny'))}${radio('none', tbt('fAssigneeNone'))}${radio('me', tbt('fAssigneeMe'))}</div>
      ${holders.length ? html`<div class="fchips" data-f-holders>${holders.map((h) => radio(h.key, h.name))}</div>` : nothing}`, 'assignee')}
    <div class="fchips" role="group">
      <button type="button" class="rc" aria-pressed=${String(e.waiting === 'manager')} data-f-waiting @click=${() => patch({ waiting: e.waiting ? '' : 'manager' })}>${tbt('fWaiting')}</button>
      <button type="button" class="rc" aria-pressed=${String(e.stuck === 'any')} data-f-stuck @click=${() => patch({ stuck: e.stuck ? '' : 'any' })}>${tbt('fStuck')}</button>
    </div>
    ${costColumnsOn() ? panelSection(ct('colCostStatus'), html`<div class="fchips" role="group" aria-label=${ct('colCostStatus')}>${COST_FILTER_STATUSES.map((k) => html`<button type="button" class="rc" aria-pressed=${String(e.cost_status.includes(k))} data-f-cost-status=${k}
      @click=${() => patch({ cost_status: e.cost_status.includes(k) ? e.cost_status.filter((x) => x !== k) : [...e.cost_status, k] })}>${ct(`cs_${k}` as CostTextKey)}</button>`)}</div>`, 'cost') : nothing}
    <div class="tdates">
      <label>${tbt('fCreatedFrom')}<input class="inp" type="datetime-local" lang=${dateInputLang()} data-f-from .value=${toLocalInput(e.created_from)} @change=${(ev: Event) => patch({ created_from: fromLocalInput((ev.target as HTMLInputElement).value) })} /></label>
      <label>${tbt('fCreatedTo')}<input class="inp" type="datetime-local" lang=${dateInputLang()} data-f-to .value=${toLocalInput(e.created_to)} @change=${(ev: Event) => patch({ created_to: fromLocalInput((ev.target as HTMLInputElement).value) })} /></label>
    </div>
  </div>`;
}

/** One removable chip per active table filter group (the same groups activeExtraCount counts), so the "סינון" badge keeps its number. */
export function tableFilterChips(e: ExtraFilters, meta: Meta | null, holders: readonly { key: string; name: string }[], set: (next: ExtraFilters) => void): ActiveChip[] {
  const out: ActiveChip[] = [];
  const prioName = (k: string) => meta?.departments[0]?.priorities.find((p) => p.key === k)?.name ?? tbt(`prio_${k}` as TableTextKey);
  if (e.priority.length) out.push({ key: 'priority', label: `${tbt('fPriority')}: ${e.priority.map(prioName).join(', ')}`, remove: () => set({ ...e, priority: [] }) });
  if (e.assignee) {
    const who = e.assignee === 'none' ? tbt('fAssigneeNone') : e.assignee === 'me' ? tbt('fAssigneeMe') : holders.find((h) => h.key === e.assignee)?.name ?? tbt('fAssignee');
    out.push({ key: 'assignee', label: `${tbt('fAssignee')}: ${who}`, remove: () => set({ ...e, assignee: '' }) });
  }
  if (e.waiting) out.push({ key: 'waiting', label: tbt('fWaiting'), remove: () => set({ ...e, waiting: '' }) });
  if (e.stuck) out.push({ key: 'stuck', label: tbt('fStuck'), remove: () => set({ ...e, stuck: '' }) });
  if (e.cost_status.length) out.push({ key: 'cost_status', label: `${ct('colCostStatus')}: ${e.cost_status.map((k) => ct(`cs_${k}` as CostTextKey)).join(', ')}`, remove: () => set({ ...e, cost_status: [] }) });
  if (e.created_from || e.created_to) {
    const day = (iso: string) => {
      const [, m, d] = toLocalInput(iso).slice(0, 10).split('-');
      return d && m ? `${Number(d)}.${Number(m)}` : '';
    };
    const label = [e.created_from ? `${tbt('fCreatedFrom')}${day(e.created_from)}` : '', e.created_to ? `${tbt('fCreatedTo')} ${day(e.created_to)}` : ''].filter(Boolean).join(' ');
    out.push({ key: 'created', label, remove: () => set({ ...e, created_from: '', created_to: '' }) });
  }
  return out;
}

/** The page panel's look for the table sections (the toolbar's `.dates` lived in the table's own styles). */
export const tableFilterPanelStyles = css`
  .tfilters {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-inline-size: 0;
  }
  .tdates {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .tdates label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 200px;
    min-inline-size: 0;
    font-size: var(--sw-fs-sm);
    font-weight: 700;
    color: var(--dv-text-2);
  }
  .tdates .inp {
    min-block-size: 36px;
    box-sizing: border-box;
    padding-inline: 10px;
    border: 1px solid var(--dv-border-strong);
    border-radius: var(--sw-r-md);
    background: var(--dv-surface-2);
    color: var(--dv-text);
    font: inherit;
    font-size: var(--sw-fs-base);
    font-weight: 400;
  }
  .tdates .inp:focus-visible {
    outline: 2px solid var(--dv-focus);
    outline-offset: 1px;
  }
  @media (max-width: 767px) {
    .tdates .inp {
      min-block-size: 44px;
    }
  }
`;
