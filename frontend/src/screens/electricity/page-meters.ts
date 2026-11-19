import { html, css, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-button';
import '../../components/sw-dialog';
import '../../components/sw-place-tree';
import '../../components/sw-state-panel';
import '../../electricity/meter-picker';
import '../../electricity/meter-card';
import { addMeters, buildAreaTree, listMeters, summarize, type Meter } from '../../api/electricity-meters';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../../electricity/access';
import { fmtInt, fmtKwh, fmtTime } from '../../electricity/format';
import { checkMeterName, meterNames, meterSearchText } from '../../electricity/meter-name';
import { elecCss } from '../../electricity/styles';
import { STATUS_CLASS, STATUS_LABEL } from '../../electricity/meter-card';
import { bubbleChrome } from '../../styles/bubble-chrome';
import { MetersPageBase, metersGridCss, metersResponsiveCss, type MetersFrameState, type MetersPageTexts } from '../meters-page-base';
import { tr } from '../../i18n/msg/screens';

/** The words of the shared parts of the page (screens/meters-page-base.ts). */
const TEXTS: MetersPageTexts = {
  search: tr('חיפוש מונה'),
  view: tr('תצוגה'),
  cards: tr('כרטיסים'),
  table: tr('טבלה'),
  area: tr('אזור'),
  areas: tr('אזורים'),
  allAreas: tr('כל האזורים'),
  fold: tr('כיווץ'),
  unfold: tr('הרחבה'),
  addMeter: tr('הוספת מונה'),
  loadError: tr('לא ניתן לטעון את המונים'),
  retry: tr('נסה שוב'),
};

/**
 * תשתיות › מוני חשמל › מונים (CR-023, mockups "מונים: טבלה / כרטיסים / טעינה / ריק / שגיאה", "כרטיס מונה", "הוספת מונה"): the tiles, the floors and
 * areas tree (per-floor collapse) beside a table or cards of the meters, search, the meter card in a drawer (`?meter=<id>`), and the add-a-meter dialog
 * (`?add=1`) with the search by name and the kWh / kW verdicts. Meters carry no money: the screen needs only `energy.view`; `energy.manage` adds the
 * add button and the card's actions. CR-DUP-METERS-2440: the page's frame, head row, areas tree, poll and filters are screens/meters-page-base.ts;
 * this file is the electricity adapter (the kWh tiles, table, cards and rows, the add dialog with the meter picker, and the meter card).
 */
@customElement('elec-meters-page')
export class ElecMetersPage extends MetersPageBase<Meter, EnergyAccess> {
  @state() private picked: string[] = [];
  /** the friendly name typed for each picked sensor (pre-filled from the picker's suggestion) */
  @state() private pickedNames: Record<string, string> = {};
  @state() private nameTouched = false;
  @state() private adding = false;
  @state() private addErrors: string[] = [];

  static styles = [
    elecCss,
    metersGridCss,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 14px;
        min-inline-size: 0;
      }
      .head .inp {
        flex: 0 1 280px;
      }
      .ent {
        font-weight: var(--sw-fw-regular);
        font-size: var(--sw-fs-sm);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        max-inline-size: 100%;
      }
      td .ent {
        max-inline-size: 320px;
      }
      .phone-only {
        display: none;
      }
      .notice {
        font-size: var(--sw-fs-sm);
        color: var(--sw-success-text, var(--sw-live-text));
      }
      .errs {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-block-start: 8px;
      }
    `,
    metersResponsiveCss,
    css`
      @media (max-width: 899px) {
        .phone-only {
          display: flex;
        }
        .desk-only {
          display: none;
        }
      }
      @media (max-width: 1099px) {
        .dsk {
          display: none;
        }
      }
      /* R5 fix: the R5 type (bolder chips and names) made the meters table 8 px wider than its card at 1024 px (classic); the cells
         give 2 px of inline padding a side back so the table fits its card again */
      table.t[data-meters-table] th,
      table.t[data-meters-table] td {
        padding-inline: 10px;
      }
    `,
    bubbleChrome,
  ];

  constructor() {
    super({ viewKey: 'sw.elec.meters.view', collapseKey: 'sw.elec.meters.collapsed', route: '/infra/electricity/meters', access: energyAccess, onAccess: onEnergyAccess });
  }

  protected texts(): MetersPageTexts {
    return TEXTS;
  }

  protected fetchMeters(): Promise<Meter[]> {
    return listMeters();
  }

  protected areaTree() {
    return buildAreaTree(this.meters);
  }

  protected inArea(m: Meter, area: string): boolean {
    const floor = area.startsWith('floor:') ? area.slice(6) : '';
    return floor ? (m.floor_id ?? m.floor_name ?? '_none') === floor : m.area_id === area;
  }

  protected matchesSearch(m: Meter, needle: string): boolean {
    return meterSearchText(m).includes(needle) || (m.area_name ?? '').toLowerCase().includes(needle);
  }

  private flash(text: string) {
    this.toaster.show(text, { ms: 6000 });
  }

  protected openAdd() {
    this.picked = [];
    this.pickedNames = {};
    this.nameTouched = false;
    this.addErrors = [];
    this.setParams({ add: '1', meter: null });
  }

  private closeAdd() {
    this.setParams({ add: null });
  }

  private onPick(e: CustomEvent<{ selected: string[]; names?: Record<string, string> }>) {
    this.picked = e.detail.selected;
    const next: Record<string, string> = {};
    for (const id of this.picked) next[id] = this.pickedNames[id] ?? e.detail.names?.[id] ?? '';
    this.pickedNames = next;
  }

  /** The names this add would create: each checked, with a duplicate flag against the registered meters and the other new ones. */
  private nameChecks() {
    return this.picked.map((id) => {
      const others = [...this.meters.map((m) => m.name), ...this.picked.filter((x) => x !== id).map((x) => this.pickedNames[x] ?? '')];
      return { id, ...checkMeterName(this.pickedNames[id] ?? '', others) };
    });
  }

  private async confirmAdd() {
    if (!this.picked.length || this.adding) return;
    this.nameTouched = true;
    const checks = this.nameChecks();
    if (checks.some((c) => c.error)) return;
    this.adding = true;
    this.addErrors = [];
    const res = await addMeters(checks.map((c) => ({ entity_id: c.id, name: c.name })));
    this.adding = false;
    if (res.added.length) {
      await this.load(false);
      this.flash(res.added.length === 1 ? tr('המונה נוסף') : tr('{n} מונים נוספו', { n: res.added.length }));
    }
    if (res.failed.length) {
      this.addErrors = res.failed.map((f) => f.message);
      this.picked = res.failed.map((f) => f.entity_id);
    } else {
      this.picked = [];
      this.closeAdd();
    }
  }

  private statusChip(m: Meter) {
    return html`<span class="chip ${STATUS_CLASS[m.status]}" data-status=${m.status}>${STATUS_LABEL[m.status]}</span>`;
  }

  private staleNote(m: Meter) {
    return m.status === 'stale' && m.last_report_at ? html` <span class="mut">${tr('מ-')}<span class="num">${fmtTime(m.last_report_at)}</span></span>` : nothing;
  }

  protected openMeter(m: Meter) {
    this.setParams({ meter: m.id });
  }

  protected renderTiles() {
    const s = summarize(this.meters);
    return html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">${tr('היום')}</div><div class="v"><span class="num">${fmtInt(s.today_kwh)}</span><span class="u">${tr('קוט״ש')}</span></div></div>
      <div class="tile"><div class="k">${tr('מתחילת החודש')}</div><div class="v"><span class="num" data-month>${this.meters.some((m) => m.month_kwh != null) ? fmtInt(s.month_kwh) : '-'}</span><span class="u">${tr('קוט״ש')}</span></div></div>
      <div class="tile"><div class="k">${tr('מדווחים')}</div><div class="v"><span class="num" data-count="reporting">${s.reporting}</span><span class="u">${tr('מתוך {n}', { n: s.total })}</span></div></div>
      <div class="tile" ?data-warn=${s.stale > 0}><div class="k">${tr('לא מדווחים')}</div><div class="v" style=${s.stale ? 'color:var(--sw-warning-text)' : ''}><span class="num" data-count="stale">${s.stale}</span></div></div>
    </div>`;
  }

  /** The sensor's name under the device's name, only when it differs. */
  private entityLine(m: Meter, cls: string) {
    const s = meterNames(m).secondary;
    return s ? html`<div class="${cls} ent" data-meter-entity title=${tr('שם הישות')}>${s}</div>` : nothing;
  }

  private nameOf(m: Meter) {
    return html`${meterNames(m).primary}${this.entityLine(m, 'mut')}`;
  }

  protected renderTable(list: Meter[]) {
    const showAcc = list.some((m) => m.accounts_count != null);
    return html`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>${tr('שם')}</th><th>${tr('אזור')}</th><th class="n">${tr('קריאה נוכחית (קוט״ש)')}</th><th class="n">${tr('היום')}</th><th class="n">${tr('מתחילת החודש')}</th><th>${tr('מצב')}</th>${showAcc ? html`<th class="dsk">${tr('בחשבונות')}</th>` : nothing}</tr></thead>
      <tbody>${list.map((m) => html`<tr class="pick" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
        <td class="b">${this.nameOf(m)}</td><td>${m.area_name ?? '-'}<span class="mut dsk"> · ${m.floor_name ?? ''}</span></td>
        <td class="n"><span class="num">${fmtKwh(m.reading_kwh)}</span></td><td class="n"><span class="num">${fmtKwh(m.today_kwh)}</span></td><td class="n"><span class="num">${fmtKwh(m.month_kwh)}</span></td>
        <td>${this.statusChip(m)}${this.staleNote(m)}</td>${showAcc ? html`<td class="dsk">${m.accounts_count || html`<span class="mut">-</span>`}</td>` : nothing}</tr>`)}</tbody></table></div>`;
  }

  protected renderCards(list: Meter[]) {
    return html`<div class="cards desk-only" data-meters-cards>${list.map((m) => html`<div class="card mcard" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="row"><b>${meterNames(m).primary}</b><span class="sp"></span>${this.statusChip(m)}</div>
      ${this.entityLine(m, 'mut')}
      <div class="mut">${m.area_name ?? ''}${m.floor_name ? ` · ${m.floor_name}` : ''}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${fmtKwh(m.today_kwh)}</span><span class="mut">${tr('קוט״ש היום')}</span><span class="sp"></span><span class="mut num">${fmtKwh(m.reading_kwh)}</span></div></div>`)}</div>`;
  }

  /** The phone's list (the same rows as the table, one line of context). */
  protected renderRows(list: Meter[]) {
    return html`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${list.map((m) => html`<div class="li pick" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.openMeter(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="grow"><div class="t1">${meterNames(m).primary}</div>${this.entityLine(m, 't2')}<div class="t2">${m.area_name ?? ''} · ${tr('היום')} <span class="num">${fmtKwh(m.today_kwh)}</span> ${tr('קוט״ש')}</div></div>
      <div style="text-align:end">${this.statusChip(m)}<div class="t2 num" style="margin-block-start:4px">${fmtKwh(m.reading_kwh)}</div></div></div>`)}</div>`;
  }

  private renderNames() {
    return html`<div class="names" data-add-names>
      ${this.nameChecks().map((c, i) => {
        const show = c.error && (this.nameTouched || c.duplicate);
        return html`<div class="fld">
          <label for="mn${i}">${this.picked.length > 1 ? tr('שם המונה {n}', { n: i + 1 }) : tr('שם המונה')}</label>
          <div class="inp ${show ? 'err' : ''}"><input id="mn${i}" data-add-name=${c.id} autocomplete="off" aria-invalid=${show ? 'true' : 'false'} .value=${this.pickedNames[c.id] ?? ''}
            @input=${(e: Event) => (this.pickedNames = { ...this.pickedNames, [c.id]: (e.target as HTMLInputElement).value })} /></div>
          ${show ? html`<div class="msg" role="alert" data-add-name-error>${c.error}</div>` : nothing}
        </div>`;
      })}
    </div>`;
  }

  protected renderAdd() {
    const open = this.params.get('add') === '1' && this.access.manage;
    return html`<sw-dialog ?open=${open} wide heading=${tr('הוספת מונה')} data-add-dialog @close=${() => this.closeAdd()}>
      ${open ? html`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${(e: CustomEvent<{ selected: string[]; names?: Record<string, string> }>) => this.onPick(e)}></elec-meter-picker>` : nothing}
      ${open && this.picked.length ? this.renderNames() : nothing}
      ${this.addErrors.length ? html`<div class="errs" data-add-errors>${this.addErrors.map((m) => html`<div class="alert err" role="alert">${m}</div>`)}</div>` : nothing}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length || this.adding || this.nameChecks().some((c) => c.duplicate)} @click=${() => void this.confirmAdd()}>${tr('הוספה')}${this.picked.length > 1 ? ` (${this.picked.length})` : ''}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${() => this.closeAdd()}>${tr('ביטול')}</sw-button>
    </sw-dialog>`;
  }

  protected frame(state: MetersFrameState, body: TemplateResult) {
    return html`<div data-elec="meters" data-state=${state} aria-busy=${state === 'loading' ? 'true' : nothing} style=${state === 'ready' ? 'display:flex;flex-direction:column;gap:14px' : nothing}>${body}</div>`;
  }

  protected renderForbidden() {
    return html`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`;
  }

  protected skeletonRow(cells: TemplateResult) {
    return html`<div class="row" style="padding:10px 0">${cells}</div>`;
  }

  protected renderEmpty(addButton: TemplateResult | typeof nothing) {
    return html`<sw-state-panel icon="bolt" state="empty" heading=${tr('אין מונים עדיין')}>${addButton}</sw-state-panel>`;
  }

  protected renderNoResults() {
    return html`<sw-state-panel icon="bolt" state="empty" compact heading=${tr('לא נמצאו מונים')} data-no-results></sw-state-panel>`;
  }

  protected renderCard(meterId: string) {
    return html`<elec-meter-card .meterId=${meterId} ?canManage=${this.access.manage} @close=${() => this.setParams({ meter: null })} @changed=${() => void this.load(false)}></elec-meter-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-meters-page': ElecMetersPage;
  }
}
