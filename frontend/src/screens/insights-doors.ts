import { html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-icon';
import { getDoors, type DoorRow, type DoorsAnswer, type EvidenceReason, type RangeQuery } from '../api/insights';
import { InsightList } from '../insights/list-base';
import { kpi, pageHead } from '../insights/chrome';
import { doorCounts, doorLines, doorsConfigured, fmtClock, fmtMS, fmtWhen, inPlace, placeLabel, timelineSpan, type DoorFilter, type DoorLine } from '../insights/model';
import { insightCss } from '../insights/styles';
import { ix, type IxKey } from '../i18n/insights';
import { bubbleChrome } from '../styles/bubble-chrome';

const REASONS: EvidenceReason[] = ['lock', 'unlocked', 'command', 'rex', 'window'];
const REASON_ICON = { lock: 'lock', unlocked: 'unlock', command: 'user', rex: 'door', window: 'clock' } as const;

/**
 * סקירה ודוחות › דלתות (CR-INSIGHT215): door openings without a matching entry event, per door, with the verdict (explained, unexplained,
 * cannot verify). Door and time only - never a person. The evidence is the lock, the exit input, the system's own commands and the door windows.
 * The floors / areas tree stays beside the list; the KPI tiles are the verdict filters. Only the openings that need a look are listed
 * (the server returns the explained ones as counts with their evidence kinds).
 */
@customElement('insights-doors')
export class InsightsDoors extends InsightList<DoorsAnswer> {
  @state() private filter: DoorFilter = 'unexplained';
  @state() private open = '';

  static styles = [insightCss, bubbleChrome];

  protected fetchData(q: RangeQuery) {
    return getDoors(q);
  }
  protected placed(a: DoorsAnswer) {
    return a.doors.map((d) => ({ floor: d.floor, area: d.area, w: d.openings }));
  }

  private rangeText(): string {
    return ix(this.range === 'custom' ? 'rCustom' : this.range === '24h' ? 'r24h' : this.range === '30d' ? 'r30d' : 'r7d');
  }

  private timeline(l: DoorLine, a: DoorsAnswer) {
    const sp = timelineSpan(a.window.before_s, a.window.after_s, l.duration_s);
    const opened = fmtClock(l.at, undefined, true);
    const closed = l.open_at_end ? ix('tlStillOpen') : ix('tlClosed', { t: fmtClock(new Date(new Date(l.at).getTime() + l.duration_s * 1000).toISOString(), undefined, true) });
    return html`<div class="tl" dir="ltr" aria-label=${ix('timelineLabel')}><div class="track"></div><div class="win"></div>
      <div class="open" style="inset-inline-start:${sp.start}%;inline-size:${sp.width}%"></div>
      <span class="mk" style="inset-inline-start:0">${ix('tlBefore', { s: a.window.before_s })}</span>
      <span class="mk" style="inset-inline-start:${sp.start}%">${ix('tlOpened', { t: opened })}</span>
      <span class="mk" style="inset-inline-end:0">${closed}</span></div>
      <div class="evs">${l.why === 'no_lock_or_exit' ? html`<span class="ev">${ix('evNoPair')}</span>`
        : l.why === 'lock_unknown' ? html`<span class="ev"><sw-icon name="lock"></sw-icon>${ix('evLockUnknown')}</span>`
        : html`<span class="ev"><sw-icon name="lock"></sw-icon>${ix('evNoLock')}</span><span class="ev"><sw-icon name="door"></sw-icon>${ix('evNoRex')}</span>
          <span class="ev"><sw-icon name="user"></sw-icon>${ix('evNoCommand')}</span><span class="ev"><sw-icon name="clock"></sw-icon>${ix('evNoWindow')}</span>`}</div>`;
  }

  private rows(a: DoorsAnswer) {
    const lines = doorLines(a, this.place).filter((l) => this.filter === 'all' || l.verdict === this.filter);
    if (!lines.length) return nothing;
    return html`<div class="tw"><table><thead><tr><th>${ix('when')}</th><th>${ix('door')}</th><th class="n hide-m">${ix('duration')}</th><th>${ix('result')}</th></tr></thead>
      <tbody class="click">${lines.map((l) => {
        const open = this.open === l.id;
        return html`<tr class="hit" data-door-row=${l.verdict} tabindex="0" aria-expanded=${open} @click=${() => (this.open = open ? '' : l.id)}
            @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.open = open ? '' : l.id; } }}>
          <td class="date">${fmtWhen(l.at)}</td><td class="title">${l.door}${l.area ? html` <span class="muted">· ${l.area}</span>` : nothing}</td>
          <td class="n hide-m">${fmtMS(l.duration_s)}</td>
          <td><span class="state ${l.verdict === 'unexplained' ? 's-bad' : 's-unk'}">${ix(l.verdict === 'unexplained' ? 'vUnexplained' : 'vUnverifiable')}</span></td></tr>
          ${open ? html`<tr class="det"><td colspan="4">${this.timeline(l, a)}</td></tr>` : nothing}`;
      })}</tbody></table></div>`;
  }

  private explainedRows(a: DoorsAnswer) {
    const doors = a.doors.filter((d) => inPlace(d, this.place) && d.explained > 0);
    if (!doors.length) return nothing;
    const ev = (d: DoorRow) => REASONS.filter((r) => d.by_reason[r] > 0).map((r) => html`<span class="ev"><sw-icon name=${REASON_ICON[r]}></sw-icon>${ix(`ev_${r}` as IxKey)} <span class="num">${d.by_reason[r]}</span></span>`);
    return html`<div class="tw"><table><thead><tr><th>${ix('door')}</th><th class="n">${ix('explained')}</th><th class="hide-m">${ix('evidence')}</th></tr></thead>
      <tbody>${doors.map((d) => html`<tr data-door-explained><td class="title">${d.name}</td><td class="n">${d.explained}</td><td class="hide-m">${ev(d)}</td></tr>`)}</tbody></table></div>`;
  }

  private content(a: DoorsAnswer) {
    if (!doorsConfigured(a)) {
      return html`<div class="blank" data-state="empty"><sw-icon name="door"></sw-icon><b>${ix('noDoorsConfigured')}</b>
        ${this.access.manage ? html`<a class="btn" href="#/system/infra/insights">${ix('toSettings')}</a>` : nothing}</div>`;
    }
    const nodes = this.treeNodes();
    const c = doorCounts(a, this.place);
    const shown = this.filter === 'explained' ? this.explainedRows(a) : this.rows(a);
    const none = shown === nothing;
    const pill = (f: DoorFilter, n: number, label: IxKey, look: 'bad' | 'warn' | 'ok' | 'unk') =>
      kpi(String(n), ix(label), look, { pressed: this.filter === f, onClick: () => (this.filter = f), key: f });
    return html`<div class="kpis" role="group" aria-label=${ix('result')} data-kpis>
        ${pill('all', c.all, 'openings', 'unk')}${pill('unexplained', c.unexplained, 'vUnexplained', 'bad')}${pill('unverifiable', c.unverifiable, 'vUnverifiable', 'warn')}${pill('explained', c.explained, 'vExplained', 'ok')}</div>
      <div class="layout">${this.tree(nodes)}
        <div class="card"><div class="toolbar">${this.placeSelect(nodes)}${this.rangeBar()}</div>
          ${none
            ? html`<div class="blank" data-state="empty"><sw-icon name="check" style="color:var(--sw-success-text)"></sw-icon><b>${ix('emptyDoorsTitle')}</b>
                <span class="muted">${ix('emptyDoorsBody', { range: this.rangeText(), place: placeLabel(nodes, this.place) })}</span></div>`
            : shown}
          ${a.doors.some((d) => d.items_more > 0) ? html`<div class="pad muted">${ix('moreItems', { n: a.doors.reduce((n, d) => n + d.items_more, 0) })}</div>` : nothing}</div></div>`;
  }

  render() {
    const gone = this.gone();
    if (gone !== nothing) return gone;
    const sub = this.data ? ix('subDoors', { range: this.rangeText(), place: placeLabel(this.treeNodes(), this.place) }) : '';
    return html`${pageHead('doors', ix('doorsTitle'), sub)}
      ${this.phase === 'loading' ? html`<div class="card">${this.skeleton()}</div>` : this.phase === 'error' ? html`<div class="card">${this.errorBlock()}</div>` : this.data ? this.content(this.data) : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'insights-doors': InsightsDoors;
  }
}
