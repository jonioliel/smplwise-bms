import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { getWaste, type RangeQuery, type WasteAnswer } from '../api/insights';
import { InsightList } from '../insights/list-base';
import { kpi, pageHead } from '../insights/chrome';
import { deviceLabel, fmtClock, fmtHM, fmtNum, fmtWhen, placeLabel, wasteCounts, wasteLines, type WasteFilter } from '../insights/model';
import { insightCss } from '../insights/styles';
import { ix, type IxKey } from '../i18n/insights';
import { bubbleChrome } from '../styles/bubble-chrome';

/**
 * סקירה ודוחות › בזבוז (CR-INSIGHT215): lights and air conditioning left on in an empty room or after hours, and night consumption above the
 * median of the same weekday. Room level only - never a person. Protected switches are never listed; an unknown state is never waste.
 */
@customElement('insights-waste')
export class InsightsWaste extends InsightList<WasteAnswer> {
  @state() private filter: WasteFilter = 'all';

  static styles = [insightCss, bubbleChrome];

  protected fetchData(q: RangeQuery) {
    return getWaste(q);
  }
  protected placed(a: WasteAnswer) {
    return a.devices.items.map((d) => ({ floor: d.floor, area: d.area, w: 1 }));
  }

  private rangeText(): string {
    return ix(this.range === 'custom' ? 'rCustom' : this.range === '24h' ? 'r24h' : this.range === '30d' ? 'r30d' : 'r7d');
  }

  private table(a: WasteAnswer) {
    const rows = wasteLines(a, this.place, this.filter);
    if (!rows.length) return nothing;
    return html`<div class="tw"><table><thead><tr><th>${ix('place')}</th><th class="hide-m">${ix('device')}</th><th>${ix('kind')}</th><th class="hide-m">${ix('when')}</th><th class="n">${ix('duration')}</th></tr></thead>
      <tbody>${rows.map((r) => html`<tr data-waste-row=${r.kind}><td class="title">${r.area ?? r.name}${r.floor ? html` <span class="muted">· ${r.floor}</span>` : nothing}</td>
        <td class="hide-m">${r.area ? r.name : ''} <span class="muted">${ix(deviceLabel(r.domain))}</span></td>
        <td>${ix(r.kind === 'empty_room' ? 'kEmpty' : 'kAfter')}</td>
        <td class="hide-m date">${fmtWhen(r.first_at, a.zone)}-${fmtClock(r.last_at, a.zone)}</td><td class="n">${fmtHM(r.minutes)}</td></tr>`)}</tbody></table></div>`;
  }

  private night(a: WasteAnswer) {
    if (!a.energy.available || !a.energy.items.length) return nothing;
    const items = [...a.energy.items].reverse();
    const max = Math.max(...items.map((i) => Math.max(i.kwh, i.baseline_kwh))) * 1.08 || 1;
    return html`<div class="card pad" data-night><div class="row" style="justify-content:space-between;margin-block-end:10px"><h2>${ix('nightUse')}</h2><span class="muted num">${a.night.from}-${a.night.to}</span></div>
      <div class="bars" dir="ltr" aria-label=${ix('nightChartLabel')}>${items.map((i) => html`<div class="col" title="${i.name} ${fmtNum(i.kwh, 1)}"><i style="block-size:${((i.kwh / max) * 100).toFixed(1)}%"></i><u style="inset-block-end:${((i.baseline_kwh / max) * 100).toFixed(1)}%"></u></div>`)}</div>
      <div class="axis" dir="ltr">${items.map((i) => html`<span>${i.night.slice(8)}.${i.night.slice(5, 7)}</span>`)}</div>
      <div class="legend"><span><i style="inline-size:10px;block-size:10px;border-radius:2px;background:var(--sw-warning);display:inline-block"></i>${ix('nightLegend')}</span>
        <span><i style="inline-size:14px;border-block-start:1.5px dashed var(--sw-text-3);display:inline-block"></i>${ix('medianLegend')}</span></div></div>`;
  }

  private content(a: WasteAnswer) {
    const nodes = this.treeNodes();
    const c = wasteCounts(a, this.place);
    const pill = (f: WasteFilter, label: IxKey, look: 'bad' | 'warn' | 'ok' | 'unk' | '') => kpi(String(c[f]), ix(label), look, { pressed: this.filter === f, onClick: () => (this.filter = f), key: f });
    const rows = this.table(a);
    const empty = this.filter === 'night' ? !a.energy.items.length : rows === nothing;
    return html`<div class="kpis" role="group" aria-label=${ix('kind')} data-kpis>
        ${pill('all', 'all', 'unk')}${pill('empty_room', 'kEmpty', 'warn')}${pill('after_hours', 'kAfter', 'warn')}${pill('night', 'kNight', 'bad')}</div>
      <div class="layout">${this.tree(nodes)}
        <div style="display:grid;gap:14px;min-inline-size:0"><div class="card"><div class="toolbar">${this.placeSelect(nodes)}${this.rangeBar()}</div>
          ${this.filter === 'night' ? nothing : empty
            ? html`<div class="blank" data-state="empty"><sw-icon name="check" style="color:var(--sw-success-text)"></sw-icon><b>${ix('emptyWasteTitle')}</b><span class="muted">${ix('emptyDoorsBody', { range: this.rangeText(), place: placeLabel(nodes, this.place) })}</span></div>`
            : rows}
          ${a.devices.items_more ? html`<div class="pad muted">${ix('moreItems', { n: a.devices.items_more })}</div>` : nothing}</div>
          ${this.filter === 'all' || this.filter === 'night' ? this.night(a) : nothing}</div></div>`;
  }

  render() {
    const gone = this.gone();
    if (gone !== nothing) return gone;
    const sub = this.data ? ix('subWaste', { range: this.rangeText(), place: placeLabel(this.treeNodes(), this.place) }) : '';
    return html`${pageHead('waste', ix('wasteTitle'), sub)}
      ${this.phase === 'loading' ? html`<div class="card">${this.skeleton()}</div>` : this.phase === 'error' ? html`<div class="card">${this.errorBlock()}</div>` : this.data ? this.content(this.data) : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'insights-waste': InsightsWaste;
  }
}
