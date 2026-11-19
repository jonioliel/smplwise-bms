import { html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-place-tree';
import '../../components/sw-button';
import '../../components/sw-dialog';
import '../../components/sw-state-panel';
import '../../water/meter-card';
import { describeError } from '../../api/client';
import { areaKey, buildWaterAreaTree, DEFAULT_RULES, nightFlows, readableAlerts, water, type Candidate, type LeakRules, type Meter, type MeterKind, type WaterEvent } from '../../api/water';
import type { SnoozeSettings } from '../../api/water-billing';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { alertOf, kindLabel, m3OfL, meterChip, METER_KINDS, nightText } from '../../water/ui';
import { wt } from '../../water/i18n';
import { fmtM3 } from '../../water/billing-format';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { MetersPageBase, metersGridCss, metersResponsiveCss, type MetersFrameState, type MetersPageTexts } from '../meters-page-base';

/**
 * תשתיות › מים › מונים (CR-WATER78 section 5.1): `screens/electricity/page-meters.ts` with the water adapter - the head row (search, כרטיסים /
 * טבלה, "+ הוספת מונה" for water.manage; the area select on the phone), the four tiles (היום, מתחילת החודש, מדווחים x מתוך y, דליפה חשודה),
 * the areas tree, the table (with ספיקת לילה), the cards, the phone rows, and the meter card drawer (`?meter=<id>`). States as electricity's.
 * CR-DUP-METERS-2440: the shared parts are now really shared (screens/meters-page-base.ts); this file is the water adapter.
 */
@customElement('water-meters-page')
export class WaterMetersPage extends MetersPageBase<Meter, WaterAccess> {
  @state() private open: WaterEvent[] = [];
  @state() private night: Record<string, number | null | 'off'> = {};
  @state() private rules: LeakRules = DEFAULT_RULES;
  @state() private snooze: SnoozeSettings | null = null;
  // the add dialog
  @state() private cq = '';
  @state() private cands: Candidate[] = [];
  @state() private candPhase: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private picked: Candidate | null = null;
  @state() private newName = '';
  @state() private newKind: MeterKind = 'sub';
  @state() private adding = false;
  @state() private addError = '';
  /** the open alerts read with the list (applied with it) */
  private loadedEvents: { items: WaterEvent[] } | null = null;
  private candTimer = 0;

  static styles = [
    waterCss,
    metersGridCss,
    css`
      .mcard:focus-visible {
        outline: var(--sw-focus-w) solid var(--sw-focus);
        outline-offset: var(--sw-focus-offset);
      }
      .mcard .base {
        align-items: baseline;
      }
      .cand {
        display: flex;
        flex-direction: column;
        gap: 4px;
        max-block-size: 300px;
        overflow: auto;
      }
      .cand .li[aria-pressed='true'] {
        outline: 2px solid var(--sw-accent);
      }
    `,
    metersResponsiveCss,
    bubbleChrome,
  ];

  constructor() {
    super({ viewKey: 'sw.water.meters.view', collapseKey: 'sw.water.meters.collapsed', route: '/infra/water/meters', access: waterAccess, onAccess: onWaterAccess });
  }

  disconnectedCallback() {
    window.clearTimeout(this.candTimer);
    super.disconnectedCallback();
  }

  willUpdate(ch: Map<string, unknown>) {
    // a deep link to the add dialog (?add=1) lists the candidates as the button does
    if (ch.has('params') && this.params.get('add') === '1' && this.candPhase === 'idle' && this.access.manage) void this.searchCands();
  }

  protected texts(): MetersPageTexts {
    return {
      search: wt('search'),
      view: wt('view'),
      cards: wt('cards'),
      table: wt('table'),
      area: wt('area'),
      areas: wt('areas'),
      allAreas: wt('allAreas'),
      fold: wt('fold'),
      unfold: wt('unfold'),
      addMeter: wt('addMeter'),
      loadError: wt('loadMetersError'),
      retry: wt('retry'),
    };
  }

  protected async fetchMeters(): Promise<Meter[]> {
    const [meters, ev] = await Promise.all([water.listMeters(), water.events('open').catch(() => null)]);
    this.loadedEvents = ev;
    return meters;
  }

  /** The open alerts land with the list; the first load also reads the leak rules and the night flows. */
  protected async afterLoad(initial: boolean, meters: Meter[]) {
    const ev = this.loadedEvents;
    if (ev) this.open = ev.items;
    if (initial) {
      const cfg = await readableAlerts();
      if (cfg) {
        this.rules = cfg.rules;
        this.snooze = cfg.snooze;
      }
      this.night = await nightFlows(meters, this.rules);
    }
  }

  protected areaTree() {
    return buildWaterAreaTree(this.meters);
  }

  protected inArea(m: Meter, area: string): boolean {
    const floor = area.startsWith('floor:') ? area.slice(6) : null;
    return floor !== null ? (m.floor_id ?? '') === floor : areaKey(m) === area;
  }

  protected matchesSearch(m: Meter, needle: string): boolean {
    return `${m.display_name} ${m.device_name ?? ''} ${m.area_name ?? ''}`.toLowerCase().includes(needle);
  }

  protected openMeter(m: Meter) {
    this.setParams({ meter: m.id, add: null });
  }

  private chip(m: Meter) {
    return meterChip(m, alertOf(m.id, this.open));
  }

  protected renderTiles() {
    const live = this.meters.filter((m) => m.status !== 'retired');
    const sum = (k: 'today_l' | 'month_l') => (live.some((m) => m[k] != null) ? live.reduce((s, m) => s + (m[k] ?? 0), 0) / 1000 : null);
    const reporting = live.filter((m) => m.state === 'reporting').length;
    const leaks = live.filter((m) => alertOf(m.id, this.open) === 'leak').length;
    return html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${wt('tToday')}</div><div class="v"><span class="num" data-t="today">${fmtM3(sum('today_l'))}</span><span class="u">${wt('m3')}</span></div></div>
      <div class="tile"><div class="k">${wt('tMonth')}</div><div class="v"><span class="num" data-t="month">${fmtM3(sum('month_l'))}</span><span class="u">${wt('m3')}</span></div></div>
      <div class="tile"><div class="k">${wt('tReporting')}</div><div class="v"><span class="num" data-t="reporting">${reporting}</span><span class="u">${wt('tOf', { n: live.length })}</span></div></div>
      <div class="tile"><div class="k">${wt('tLeak')}</div><div class="v ${leaks ? 'alarm' : ''}" data-t-leak><span class="num" data-t="leaks">${leaks}</span><span class="u">${wt('tMeters')}</span></div></div>
    </div>`;
  }

  protected renderTable(list: Meter[]) {
    return html`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${wt('colName')}</th><th>${wt('colArea')}</th><th class="n">${wt('colReading')}</th><th class="n">${wt('colToday')}</th><th class="n dsk">${wt('colMonth')}</th><th class="n">${wt('colNight')}</th><th>${wt('colState')}</th></tr></thead>
      <tbody>${list.map((m) => html`<tr class="pick" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
        <td class="b">${m.display_name}</td><td>${m.area_name ?? '-'}<span class="mut dsk">${m.floor_name ? ` · ${m.floor_name}` : ''}</span></td>
        <td class="n"><span class="num">${m3OfL(m.value_l)}</span></td><td class="n"><span class="num">${m3OfL(m.today_l)}</span></td><td class="n dsk"><span class="num">${m3OfL(m.month_l)}</span></td>
        <td class="n"><span class="num ${alertOf(m.id, this.open) === 'leak' ? 'bad' : ''}">${nightText(this.night[m.id])}</span></td>
        <td>${this.chip(m)}</td></tr>`)}</tbody></table></div>`;
  }

  protected renderCards(list: Meter[]) {
    return html`<div class="cards desk-only" data-meters-cards>${list.map((m) => html`<div class="card mcard" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="row"><b>${m.display_name}</b><span class="sp"></span>${this.chip(m)}</div>
      <div class="mut">${m.area_name ?? ''}${m.floor_name ? ` · ${m.floor_name}` : ''}</div>
      <div class="row base"><span class="big num">${m3OfL(m.today_l)}</span><span class="mut">${wt('todayM3')}</span><span class="sp"></span><span class="mut num">${m3OfL(m.value_l)}</span></div>
      <div class="mut">${wt('colNight')} <span class="num">${nightText(this.night[m.id])}</span>${typeof this.night[m.id] === 'number' ? ` ${wt('lph')}` : ''}</div></div>`)}</div>`;
  }

  protected renderRows(list: Meter[]) {
    return html`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${list.map((m) => html`<div class="li pick" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="grow"><div class="t1">${m.display_name}</div><div class="t2">${m.area_name ?? ''} · ${wt('tToday')} <span class="num">${m3OfL(m.today_l)}</span> ${wt('m3')}</div></div>
      <div class="rowend">${this.chip(m)}<div class="t2 num">${m3OfL(m.value_l)}</div></div></div>`)}</div>`;
  }

  // ---------------------------------------------------------------- add a meter (water.manage)
  protected openAdd() {
    this.picked = null;
    this.newName = '';
    this.newKind = 'sub';
    this.addError = '';
    this.cq = '';
    this.setParams({ add: '1', meter: null });
    void this.searchCands();
  }

  private async searchCands() {
    this.candPhase = 'loading';
    try {
      this.cands = await water.candidates(this.cq.trim());
      this.candPhase = 'ready';
    } catch {
      this.candPhase = 'error';
    }
  }

  private onCq(v: string) {
    this.cq = v;
    window.clearTimeout(this.candTimer);
    this.candTimer = window.setTimeout(() => void this.searchCands(), 300);
  }

  private pick(c: Candidate) {
    if (c.verdict === 'rejected' || c.already_meter_id) return;
    this.picked = c;
    this.newName = c.device_name || c.name;
  }

  private async confirmAdd() {
    const c = this.picked;
    if (!c || this.adding) return;
    if (!this.newName.trim()) return void (this.addError = wt('nameRequired'));
    this.adding = true;
    this.addError = '';
    try {
      await water.createMeter({ source_ref: c.ref, display_name: this.newName.trim(), kind: this.newKind });
      this.setParams({ add: null });
      this.toaster.show(wt('added'), { ms: 5000 });
      await this.load(false);
    } catch (err) {
      this.addError = describeError(err);
    } finally {
      this.adding = false;
    }
  }

  protected renderAdd() {
    const open = this.params.get('add') === '1' && this.access.manage;
    if (!open) return nothing;
    return html`<sw-dialog open wide heading=${wt('addTitle')} data-add-dialog @close=${() => this.setParams({ add: null })}>
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-cand-search placeholder=${wt('candSearch')} aria-label=${wt('candSearch')} .value=${this.cq} @input=${(e: Event) => this.onCq((e.target as HTMLInputElement).value)} /></label>
      <div class="cand list" data-candidates>
        ${this.candPhase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
        ${this.candPhase === 'error' ? html`<sw-state-panel state="error" compact actionLabel=${wt('retry')} @action=${() => void this.searchCands()}></sw-state-panel>` : nothing}
        ${this.candPhase === 'ready' && !this.cands.length ? html`<sw-state-panel icon="drop" state="empty" compact heading=${wt('candNone')}></sw-state-panel>` : nothing}
        ${this.candPhase === 'ready'
          ? this.cands.map((c) => {
              const off = c.verdict === 'rejected' || !!c.already_meter_id;
              return html`<div class="li ${off ? 'dis' : 'pick'}" role="button" tabindex=${off ? -1 : 0} aria-disabled=${off ? 'true' : 'false'} aria-pressed=${this.picked?.ref === c.ref ? 'true' : 'false'} data-cand=${c.ref}
                @click=${() => this.pick(c)} @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.pick(c); } }}>
                <div class="grow"><div class="t1">${c.device_name || c.name}</div><div class="t2 wrap">${[c.area_name, c.unit].filter(Boolean).join(' · ')}${c.verdict !== 'accepted' && c.message ? html` · <span class=${c.verdict === 'rejected' ? 'bad' : ''}>${c.message}</span>` : nothing}</div></div>
                ${off ? html`<span class="chip c-mut nodot">${wt('candRejected')}</span>` : nothing}</div>`;
            })
          : nothing}
      </div>
      ${this.picked
        ? html`<div class="formgrid">
            <div class="fld"><label for="wnm">${wt('meterName')}</label><div class="inp"><input id="wnm" data-add-name .value=${this.newName} @input=${(e: Event) => (this.newName = (e.target as HTMLInputElement).value)} /></div></div>
            <div class="fld"><label for="wnk">${wt('meterKind')}</label><div class="inp"><select id="wnk" data-add-kind @change=${(e: Event) => (this.newKind = (e.target as HTMLSelectElement).value as MeterKind)}>${METER_KINDS.map((k) => html`<option value=${k} ?selected=${k === this.newKind}>${kindLabel(k)}</option>`)}</select></div></div>
          </div>`
        : nothing}
      ${this.addError ? html`<div class="alert err" role="alert" data-add-error>${this.addError}</div>` : nothing}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked || this.adding} @click=${() => void this.confirmAdd()}>${wt('add')}</sw-button>
      <sw-button slot="footer" @click=${() => this.setParams({ add: null })}>${wt('cancel')}</sw-button>
    </sw-dialog>`;
  }

  protected frame(state: MetersFrameState, body: TemplateResult) {
    return html`<div class=${state === 'ready' ? 'page' : nothing} data-water="meters" data-state=${state} aria-busy=${state === 'loading' ? 'true' : nothing}>${body}</div>`;
  }

  protected renderForbidden() {
    return html`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`;
  }

  protected skeletonRow(cells: TemplateResult) {
    return html`<div class="row skrow">${cells}</div>`;
  }

  protected renderEmpty(addButton: TemplateResult | typeof nothing) {
    return html`<sw-state-panel icon="drop" state="empty" heading=${wt('emptyMeters')}>${addButton}</sw-state-panel>`;
  }

  protected renderNoResults() {
    return html`<sw-state-panel icon="drop" state="empty" compact heading=${wt('noResults')} data-no-results></sw-state-panel>`;
  }

  protected renderCard(meterId: string) {
    return html`<water-meter-card .meterId=${meterId} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[meterId]}
          @close=${() => this.setParams({ meter: null })} @changed=${() => void this.load(false)}></water-meter-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-meters-page': WaterMetersPage;
  }
}
