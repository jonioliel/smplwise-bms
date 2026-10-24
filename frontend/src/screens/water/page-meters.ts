import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-button';
import '../../components/sw-dialog';
import '../../components/sw-state-panel';
import '../../water/meter-card';
import { describeError } from '../../api/client';
import { areaKey, buildWaterAreaTree, DEFAULT_RULES, nightFlows, readableAlerts, water, type Candidate, type LeakRules, type Meter, type MeterKind, type WaterEvent } from '../../api/water';
import type { SnoozeSettings } from '../../api/water-billing';
import { navigate } from '../../router';
import { onWaterAccess, waterAccess, type WaterAccess } from '../../water/access';
import { waterCss } from '../../water/styles';
import { alertOf, kindLabel, m3OfL, meterChip, METER_KINDS, nightText, store, stored } from '../../water/ui';
import { wt } from '../../water/i18n';
import { fmtM3 } from '../../water/billing-format';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';

const VIEW_KEY = 'sw.water.meters.view';
const COLLAPSE_KEY = 'sw.water.meters.collapsed';
const POLL_MS = 60_000;

/**
 * תשתיות › מים › מונים (CR-WATER78 section 5.1): `screens/electricity/page-meters.ts` with the water adapter - the head row (search, כרטיסים /
 * טבלה, "+ הוספת מונה" for water.manage; the area select on the phone), the four tiles (היום, מתחילת החודש, מדווחים x מתוך y, דליפה חשודה),
 * the areas tree, the table (with ספיקת לילה), the cards, the phone rows, and the meter card drawer (`?meter=<id>`). States as electricity's.
 */
@customElement('water-meters-page')
export class WaterMetersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();

  @state() private meters: Meter[] = [];
  @state() private open: WaterEvent[] = [];
  @state() private night: Record<string, number | null | 'off'> = {};
  @state() private rules: LeakRules = DEFAULT_RULES;
  @state() private snooze: SnoozeSettings | null = null;
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private q = '';
  @state() private view: 'table' | 'cards' = stored<'table' | 'cards'>(VIEW_KEY, 'table');
  @state() private collapsed: string[] = stored<string[]>(COLLAPSE_KEY, []);
  @state() private access: WaterAccess = waterAccess();
  @state() private notice = '';
  // the add dialog
  @state() private cq = '';
  @state() private cands: Candidate[] = [];
  @state() private candPhase: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
  @state() private picked: Candidate | null = null;
  @state() private newName = '';
  @state() private newKind: MeterKind = 'sub';
  @state() private adding = false;
  @state() private addError = '';
  private stop?: () => void;
  private poll = 0;
  private candTimer = 0;

  static styles = [
    waterCss,
    css`
      .cols {
        display: grid;
        grid-template-columns: 240px minmax(0, 1fr);
        gap: 14px;
        align-items: start;
      }
      .tree {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .tree button {
        display: flex;
        align-items: center;
        gap: 8px;
        inline-size: 100%;
        min-block-size: var(--elec-touch);
        padding: 0 10px;
        border: 0;
        background: transparent;
        color: var(--sw-text);
        font: inherit;
        font-size: var(--sw-fs-sm);
        border-radius: var(--sw-r-sm);
        cursor: pointer;
        text-align: start;
      }
      .tree button:hover {
        background: var(--sw-surface-2);
      }
      .tree button[aria-current='true'] {
        background: var(--sw-accent-soft);
        color: var(--sw-accent-text);
        font-weight: var(--sw-fw-semibold);
      }
      .tree .fl {
        color: var(--sw-text-2);
        font-weight: var(--sw-fw-semibold);
        font-size: var(--sw-fs-xs);
      }
      .tree .ar {
        padding-inline-start: 30px;
      }
      .tree .cnt {
        margin-inline-start: auto;
        color: var(--sw-text-3);
        font-size: var(--sw-fs-xs);
      }
      .tree sw-icon {
        flex: none;
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
        gap: 12px;
      }
      .mcard {
        display: flex;
        flex-direction: column;
        gap: 6px;
        text-align: start;
        font: inherit;
        color: inherit;
        cursor: pointer;
        min-block-size: var(--elec-touch);
      }
      .mcard .big {
        font-size: var(--sw-fs-3xl);
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
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
      @media (max-width: 899px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
        .tree-card {
          display: none;
        }
        .head .inp {
          flex: 1 1 200px;
        }
        .head .inp.phone-only {
          flex: 1 1 160px;
        }
      }
    `,
    bubbleChrome,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.stop = onWaterAccess((a) => (this.access = a));
    void this.load(true);
    this.poll = window.setInterval(() => void this.load(false), POLL_MS);
  }

  disconnectedCallback() {
    this.stop?.();
    window.clearInterval(this.poll);
    window.clearTimeout(this.candTimer);
    super.disconnectedCallback();
  }

  willUpdate(ch: Map<string, unknown>) {
    // a deep link to the add dialog (?add=1) lists the candidates as the button does
    if (ch.has('params') && this.params.get('add') === '1' && this.candPhase === 'idle' && this.access.manage) void this.searchCands();
  }

  private async load(initial: boolean) {
    if (initial) this.phase = 'loading';
    try {
      const [meters, ev] = await Promise.all([water.listMeters(), water.events('open').catch(() => null)]);
      this.meters = meters;
      if (ev) this.open = ev.items;
      this.phase = 'ready';
      this.error = '';
      if (initial) {
        const cfg = await readableAlerts();
        if (cfg) {
          this.rules = cfg.rules;
          this.snooze = cfg.snooze;
        }
        this.night = await nightFlows(meters, this.rules);
      }
    } catch (err) {
      if (initial || this.phase !== 'ready') {
        this.error = describeError(err);
        this.phase = 'error';
      }
    }
  }

  private get areaFilter(): string {
    return this.params.get('area') ?? '';
  }

  private setParams(patch: Record<string, string | null>) {
    const p = new URLSearchParams(this.params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const rec: Record<string, string> = {};
    p.forEach((v, k) => (rec[k] = v));
    navigate('/infra/water/meters', rec);
  }

  private setView(v: 'table' | 'cards') {
    this.view = v;
    store(VIEW_KEY, v);
  }

  private toggleFloor(id: string) {
    this.collapsed = this.collapsed.includes(id) ? this.collapsed.filter((x) => x !== id) : [...this.collapsed, id];
    store(COLLAPSE_KEY, this.collapsed);
  }

  private visible(): Meter[] {
    const needle = this.q.trim().toLowerCase();
    const area = this.areaFilter;
    return this.meters.filter((m) => (!area || areaKey(m) === area) && (!needle || `${m.display_name} ${m.device_name ?? ''} ${m.area_name ?? ''}`.toLowerCase().includes(needle)));
  }

  private openMeter(m: Meter) {
    this.setParams({ meter: m.id, add: null });
  }

  private onKey(e: KeyboardEvent, m: Meter) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.openMeter(m);
    }
  }

  private chip(m: Meter) {
    return meterChip(m, alertOf(m.id, this.open));
  }

  private renderTiles() {
    const live = this.meters.filter((m) => m.status !== 'retired');
    const sum = (k: 'today_l' | 'month_l') => (live.some((m) => m[k] != null) ? live.reduce((s, m) => s + (m[k] ?? 0), 0) / 1000 : null);
    const reporting = live.filter((m) => m.state === 'reporting').length;
    const leaks = live.filter((m) => alertOf(m.id, this.open) === 'leak').length;
    return html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${wt('tToday')}</div><div class="v"><span class="num" data-t="today">${fmtM3(sum('today_l'))}</span><span class="u">${wt('m3')}</span></div></div>
      <div class="tile"><div class="k">${wt('tMonth')}</div><div class="v"><span class="num" data-t="month">${fmtM3(sum('month_l'))}</span><span class="u">${wt('m3')}</span></div></div>
      <div class="tile"><div class="k">${wt('tReporting')}</div><div class="v"><span class="num" data-t="reporting">${reporting}</span><span class="u">${wt('tOf', { n: live.length })}</span></div></div>
      <div class="tile"><div class="k">${wt('tLeak')}</div><div class="v" style=${leaks ? 'color:var(--sw-danger-text)' : ''} data-t-leak><span class="num" data-t="leaks">${leaks}</span><span class="u">${wt('tMeters')}</span></div></div>
    </div>`;
  }

  private renderTree() {
    const tree = buildWaterAreaTree(this.meters);
    const sel = this.areaFilter;
    return html`<nav class="tree" aria-label=${wt('areas')} data-area-tree>
      <button type="button" aria-current=${!sel ? 'true' : 'false'} data-area="" @click=${() => this.setParams({ area: null })}>${wt('allAreas')} <span class="cnt num">${this.meters.length}</span></button>
      ${tree.map((f) => {
        const col = this.collapsed.includes(f.floor_id);
        return html`<button type="button" class="fl" aria-expanded=${col ? 'false' : 'true'} data-floor=${f.floor_id} @click=${() => this.toggleFloor(f.floor_id)}>
            <sw-icon name=${col ? 'chevronBack' : 'chevronDown'} size="14"></sw-icon>${f.name}<span class="cnt num">${f.count}</span></button>
          ${col ? nothing : f.areas.map((a) => html`<button type="button" class="ar" aria-current=${sel === a.area_id ? 'true' : 'false'} data-area=${a.area_id} @click=${() => this.setParams({ area: a.area_id })}>${a.name}<span class="cnt num">${a.count}</span></button>`)}`;
      })}
    </nav>`;
  }

  private renderTable(list: Meter[]) {
    return html`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${wt('colName')}</th><th>${wt('colArea')}</th><th class="n">${wt('colReading')}</th><th class="n">${wt('colToday')}</th><th class="n dsk">${wt('colMonth')}</th><th class="n">${wt('colNight')}</th><th>${wt('colState')}</th></tr></thead>
      <tbody>${list.map((m) => html`<tr class="pick" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
        <td class="b">${m.display_name}</td><td>${m.area_name ?? '-'}<span class="mut dsk">${m.floor_name ? ` · ${m.floor_name}` : ''}</span></td>
        <td class="n"><span class="num">${m3OfL(m.value_l)}</span></td><td class="n"><span class="num">${m3OfL(m.today_l)}</span></td><td class="n dsk"><span class="num">${m3OfL(m.month_l)}</span></td>
        <td class="n"><span class="num ${alertOf(m.id, this.open) === 'leak' ? 'bad' : ''}">${nightText(this.night[m.id])}</span></td>
        <td>${this.chip(m)}</td></tr>`)}</tbody></table></div>`;
  }

  private renderCards(list: Meter[]) {
    return html`<div class="cards desk-only" data-meters-cards>${list.map((m) => html`<div class="card mcard" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="row"><b>${m.display_name}</b><span class="sp"></span>${this.chip(m)}</div>
      <div class="mut">${m.area_name ?? ''}${m.floor_name ? ` · ${m.floor_name}` : ''}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${m3OfL(m.today_l)}</span><span class="mut">${wt('todayM3')}</span><span class="sp"></span><span class="mut num">${m3OfL(m.value_l)}</span></div>
      <div class="mut">${wt('colNight')} <span class="num">${nightText(this.night[m.id])}</span>${typeof this.night[m.id] === 'number' ? ` ${wt('lph')}` : ''}</div></div>`)}</div>`;
  }

  private renderRows(list: Meter[]) {
    return html`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${list.map((m) => html`<div class="li pick" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="grow"><div class="t1">${m.display_name}</div><div class="t2">${m.area_name ?? ''} · ${wt('tToday')} <span class="num">${m3OfL(m.today_l)}</span> ${wt('m3')}</div></div>
      <div style="text-align:end">${this.chip(m)}<div class="t2 num" style="margin-block-start:4px">${m3OfL(m.value_l)}</div></div></div>`)}</div>`;
  }

  // ---------------------------------------------------------------- add a meter (water.manage)
  private openAdd() {
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
      this.notice = wt('added');
      window.setTimeout(() => (this.notice = ''), 5000);
      await this.load(false);
    } catch (err) {
      this.addError = describeError(err);
    } finally {
      this.adding = false;
    }
  }

  private renderAdd() {
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

  private renderHead() {
    const tree = buildWaterAreaTree(this.meters);
    return html`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-meters-search placeholder=${wt('search')} aria-label=${wt('search')} .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      <div class="seg desk-only" role="group" aria-label=${wt('view')}><button type="button" aria-pressed=${this.view === 'cards' ? 'true' : 'false'} data-view="cards" @click=${() => this.setView('cards')}>${wt('cards')}</button><button type="button" aria-pressed=${this.view === 'table' ? 'true' : 'false'} data-view="table" @click=${() => this.setView('table')}>${wt('table')}</button></div>
      <span class="sp"></span>
      <label class="inp phone-only"><select data-area-select aria-label=${wt('area')} @change=${(e: Event) => this.setParams({ area: (e.target as HTMLSelectElement).value || null })}>
        <option value="" ?selected=${!this.areaFilter}>${wt('allAreas')}</option>
        ${tree.flatMap((f) => f.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.areaFilter}>${a.name}</option>`))}</select></label>
      ${this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => this.openAdd()}>${wt('addMeter')}</sw-button>` : nothing}
    </div>`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-water="meters" data-state="forbidden"></sw-state-panel>`;
    const meterId = this.params.get('meter') ?? '';
    const card = meterId
      ? html`<water-meter-card .meterId=${meterId} ?canManage=${this.access.manage} ?canAck=${this.access.ack} .rules=${this.rules} .snooze=${this.snooze} .night=${this.night[meterId]}
          @close=${() => this.setParams({ meter: null })} @changed=${() => void this.load(false)}></water-meter-card>`
      : nothing;
    if (this.phase === 'loading') {
      return html`<div data-water="meters" data-state="loading" aria-busy="true"><div class="card">${Array.from({ length: 7 }, () => html`<div class="row" style="padding:10px 0"><div class="skl" style="inline-size:30%"></div><span class="sp"></span><div class="skl" style="inline-size:14%"></div><div class="skl" style="inline-size:10%"></div></div>`)}</div></div>`;
    }
    if (this.phase === 'error') {
      return html`<div data-water="meters" data-state="error"><sw-state-panel state="error" heading=${wt('loadMetersError')} hint=${this.error} actionLabel=${wt('retry')} @action=${() => void this.load(true)}></sw-state-panel></div>`;
    }
    if (!this.meters.length) {
      return html`<div data-water="meters" data-state="empty"><sw-state-panel icon="drop" state="empty" heading=${wt('emptyMeters')}>${this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => this.openAdd()}>${wt('addMeter')}</sw-button>` : nothing}</sw-state-panel>${this.renderAdd()}</div>`;
    }
    const list = this.visible();
    const body = !list.length
      ? html`<sw-state-panel icon="drop" state="empty" compact heading=${wt('noResults')} data-no-results></sw-state-panel>`
      : html`${this.view === 'cards' ? this.renderCards(list) : this.renderTable(list)}${this.renderRows(list)}`;
    return html`<div class="page" data-water="meters" data-state="ready">
      ${this.renderHead()}
      ${this.notice ? html`<div class="notice" role="status" data-notice>${this.notice}</div>` : nothing}
      ${this.renderTiles()}
      <div class="cols"><div class="card tree-card">${this.renderTree()}</div><div>${body}</div></div>
      ${this.renderAdd()}${card}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'water-meters-page': WaterMetersPage;
  }
}
