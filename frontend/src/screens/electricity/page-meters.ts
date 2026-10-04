import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../../components/sw-icon';
import '../../components/sw-button';
import '../../components/sw-dialog';
import '../../components/sw-state-panel';
import '../../electricity/meter-picker';
import '../../electricity/meter-card';
import { describeError } from '../../api/client';
import { addMeters, buildAreaTree, listMeters, summarize, type Meter } from '../../api/electricity-meters';
import { navigate } from '../../router';
import { energyAccess, onEnergyAccess, type EnergyAccess } from '../../electricity/access';
import { fmtInt, fmtKwh, fmtTime } from '../../electricity/format';
import { electricityCss } from '../../electricity/styles';
import { STATUS_CLASS, STATUS_LABEL } from '../../electricity/meter-card';
import { SkinController } from '../../design/skin';
import { bubbleChrome } from '../../styles/bubble-chrome';

const VIEW_KEY = 'sw.elec.meters.view';
const COLLAPSE_KEY = 'sw.elec.meters.collapsed';
const POLL_MS = 60_000;

function stored<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
}

/**
 * תשתיות › מוני חשמל › מונים (CR-023, mockups "מונים: טבלה / כרטיסים / טעינה / ריק / שגיאה", "כרטיס מונה", "הוספת מונה"): the tiles, the floors and
 * areas tree (per-floor collapse) beside a table or cards of the meters, search, the meter card in a drawer (`?meter=<id>`), and the add-a-meter dialog
 * (`?add=1`) with the search by name and the kWh / kW verdicts. Meters carry no money: the screen needs only `energy.view`; `energy.manage` adds the
 * add button and the card's actions.
 */
@customElement('elec-meters-page')
export class ElecMetersPage extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  /** Set by the shell: the route segments after `meters` and the query. */
  @property({ attribute: false }) segments: string[] = [];
  @property({ attribute: false }) params: URLSearchParams = new URLSearchParams();

  @state() private meters: Meter[] = [];
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private q = '';
  @state() private view: 'table' | 'cards' = stored<'table' | 'cards'>(VIEW_KEY, 'table');
  @state() private collapsed: string[] = stored<string[]>(COLLAPSE_KEY, []);
  @state() private access: EnergyAccess = energyAccess();
  @state() private picked: string[] = [];
  @state() private adding = false;
  @state() private addErrors: string[] = [];
  @state() private notice = '';
  private stopAccess?: () => void;
  private poll = 0;
  private noticeTimer = 0;

  static styles = [
    electricityCss,
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
        font-size: 22px;
        font-weight: var(--sw-fw-bold);
        color: var(--sw-heading, var(--sw-text));
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
      @media (max-width: 899px) {
        .cols {
          grid-template-columns: minmax(0, 1fr);
        }
        .tree-card {
          display: none;
        }
        .phone-only {
          display: flex;
        }
        .head .inp {
          flex: 1 1 200px;
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
    `,
    bubbleChrome,
  ];

  connectedCallback() {
    super.connectedCallback();
    this.stopAccess = onEnergyAccess((a) => (this.access = a));
    void this.load(true);
    this.poll = window.setInterval(() => void this.load(false), POLL_MS);
  }

  disconnectedCallback() {
    this.stopAccess?.();
    window.clearInterval(this.poll);
    window.clearTimeout(this.noticeTimer);
    super.disconnectedCallback();
  }

  /** `initial`: show the loading state; a later refresh keeps the rows and only an error on the first load is a screen state. */
  private async load(initial: boolean) {
    if (initial) this.phase = 'loading';
    try {
      this.meters = await listMeters();
      this.phase = 'ready';
      this.error = '';
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
    navigate('/infra/electricity/meters', rec);
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
    return this.meters.filter((m) => (!area || m.area_id === area) && (!needle || m.name.toLowerCase().includes(needle) || (m.area_name ?? '').toLowerCase().includes(needle)));
  }

  private flash(text: string) {
    this.notice = text;
    window.clearTimeout(this.noticeTimer);
    this.noticeTimer = window.setTimeout(() => (this.notice = ''), 6000);
  }

  private openAdd() {
    this.picked = [];
    this.addErrors = [];
    this.setParams({ add: '1', meter: null });
  }

  private closeAdd() {
    this.setParams({ add: null });
  }

  private async confirmAdd() {
    if (!this.picked.length || this.adding) return;
    this.adding = true;
    this.addErrors = [];
    const res = await addMeters(this.picked.map((entity_id) => ({ entity_id })));
    this.adding = false;
    if (res.added.length) {
      await this.load(false);
      this.flash(res.added.length === 1 ? 'המונה נוסף' : `${res.added.length} מונים נוספו`);
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
    return m.status === 'stale' && m.last_report_at ? html` <span class="mut">מ-<span class="num">${fmtTime(m.last_report_at)}</span></span>` : nothing;
  }

  private open(m: Meter) {
    this.setParams({ meter: m.id });
  }

  private onKey(e: KeyboardEvent, m: Meter) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.open(m);
    }
  }

  private renderTiles() {
    const s = summarize(this.meters);
    return html`<div class="tiles" data-tiles>
      <div class="tile"><div class="k">היום</div><div class="v"><span class="num">${fmtInt(s.today_kwh)}</span><span class="u">קוט״ש</span></div></div>
      <div class="tile"><div class="k">מתחילת החודש</div><div class="v"><span class="num" data-month>${this.meters.some((m) => m.month_kwh != null) ? fmtInt(s.month_kwh) : '-'}</span><span class="u">קוט״ש</span></div></div>
      <div class="tile"><div class="k">מדווחים</div><div class="v"><span class="num" data-count="reporting">${s.reporting}</span><span class="u">מתוך ${s.total}</span></div></div>
      <div class="tile"><div class="k">לא מדווחים</div><div class="v" style=${s.stale ? 'color:var(--sw-warning-text)' : ''}><span class="num" data-count="stale">${s.stale}</span></div></div>
    </div>`;
  }

  private renderTree() {
    const tree = buildAreaTree(this.meters);
    const sel = this.areaFilter;
    return html`<nav class="tree" aria-label="אזורים" data-area-tree>
      <button type="button" aria-current=${!sel ? 'true' : 'false'} data-area="" @click=${() => this.setParams({ area: null })}>כל האזורים <span class="cnt num">${this.meters.length}</span></button>
      ${tree.map((f) => {
        const col = this.collapsed.includes(f.floor_id);
        return html`<button type="button" class="fl" aria-expanded=${col ? 'false' : 'true'} data-floor=${f.floor_id} @click=${() => this.toggleFloor(f.floor_id)}>
            <sw-icon name=${col ? 'chevronBack' : 'chevronDown'} size="14"></sw-icon>${f.name}<span class="cnt num">${f.count}</span></button>
          ${col ? nothing : f.areas.map((a) => html`<button type="button" class="ar" aria-current=${sel === a.area_id ? 'true' : 'false'} data-area=${a.area_id} @click=${() => this.setParams({ area: a.area_id })}>${a.name}<span class="cnt num">${a.count}</span></button>`)}`;
      })}
    </nav>`;
  }

  private renderTable(list: Meter[]) {
    const showAcc = list.some((m) => m.accounts_count != null);
    return html`<div class="card flush scrollx desk-only"><table class="t" data-meters-table>
      <thead><tr><th>שם</th><th>אזור</th><th class="n">קריאה נוכחית (קוט״ש)</th><th class="n">היום</th><th class="n">מתחילת החודש</th><th>מצב</th>${showAcc ? html`<th class="dsk">בחשבונות</th>` : nothing}</tr></thead>
      <tbody>${list.map((m) => html`<tr class="pick" tabindex="0" data-meter=${m.id} @click=${() => this.open(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
        <td class="b">${m.name}</td><td>${m.area_name ?? '-'}<span class="mut dsk"> · ${m.floor_name ?? ''}</span></td>
        <td class="n"><span class="num">${fmtKwh(m.reading_kwh)}</span></td><td class="n"><span class="num">${fmtKwh(m.today_kwh)}</span></td><td class="n"><span class="num">${fmtKwh(m.month_kwh)}</span></td>
        <td>${this.statusChip(m)}${this.staleNote(m)}</td>${showAcc ? html`<td class="dsk">${m.accounts_count || html`<span class="mut">-</span>`}</td>` : nothing}</tr>`)}</tbody></table></div>`;
  }

  private renderCards(list: Meter[]) {
    return html`<div class="cards desk-only" data-meters-cards>${list.map((m) => html`<div class="card mcard" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.open(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="row"><b>${m.name}</b><span class="sp"></span>${this.statusChip(m)}</div>
      <div class="mut">${m.area_name ?? ''}${m.floor_name ? ` · ${m.floor_name}` : ''}</div>
      <div class="row" style="align-items:baseline"><span class="big num">${fmtKwh(m.today_kwh)}</span><span class="mut">קוט״ש היום</span><span class="sp"></span><span class="mut num">${fmtKwh(m.reading_kwh)}</span></div></div>`)}</div>`;
  }

  /** The phone's list (the same rows as the table, one line of context). */
  private renderRows(list: Meter[]) {
    return html`<div class="list phone-only" style="flex-direction:column" data-meters-rows>${list.map((m) => html`<div class="li pick" role="button" tabindex="0" data-meter=${m.id} @click=${() => this.open(m)} @keydown=${(e: KeyboardEvent) => this.onKey(e, m)}>
      <div class="grow"><div class="t1">${m.name}</div><div class="t2">${m.area_name ?? ''} · היום <span class="num">${fmtKwh(m.today_kwh)}</span> קוט״ש</div></div>
      <div style="text-align:end">${this.statusChip(m)}<div class="t2 num" style="margin-block-start:4px">${fmtKwh(m.reading_kwh)}</div></div></div>`)}</div>`;
  }

  private renderAdd() {
    const open = this.params.get('add') === '1' && this.access.manage;
    return html`<sw-dialog ?open=${open} wide heading="הוספת מונה" data-add-dialog @close=${() => this.closeAdd()}>
      ${open ? html`<elec-meter-picker mode="register" multi .selected=${this.picked} @change=${(e: CustomEvent<{ selected: string[] }>) => (this.picked = e.detail.selected)}></elec-meter-picker>` : nothing}
      ${this.addErrors.length ? html`<div class="errs" data-add-errors>${this.addErrors.map((m) => html`<div class="alert err" role="alert">${m}</div>`)}</div>` : nothing}
      <sw-button slot="footer" variant="primary" data-add-confirm ?disabled=${!this.picked.length || this.adding} @click=${() => void this.confirmAdd()}>הוספה${this.picked.length > 1 ? ` (${this.picked.length})` : ''}</sw-button>
      <sw-button slot="footer" data-add-cancel @click=${() => this.closeAdd()}>ביטול</sw-button>
    </sw-dialog>`;
  }

  private renderHead() {
    const tree = buildAreaTree(this.meters);
    return html`<div class="row head">
      <label class="inp"><sw-icon name="search" size="16"></sw-icon><input type="search" data-meters-search placeholder="חיפוש מונה" aria-label="חיפוש מונה" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)} /></label>
      <div class="seg desk-only" role="group" aria-label="תצוגה"><button type="button" aria-pressed=${this.view === 'cards' ? 'true' : 'false'} data-view="cards" @click=${() => this.setView('cards')}>כרטיסים</button><button type="button" aria-pressed=${this.view === 'table' ? 'true' : 'false'} data-view="table" @click=${() => this.setView('table')}>טבלה</button></div>
      <span class="sp"></span>
      <label class="inp phone-only" style="flex:0 1 180px"><select data-area-select aria-label="אזור" @change=${(e: Event) => this.setParams({ area: (e.target as HTMLSelectElement).value || null })}>
        <option value="" ?selected=${!this.areaFilter}>כל האזורים</option>
        ${tree.flatMap((f) => f.areas.map((a) => html`<option value=${a.area_id} ?selected=${a.area_id === this.areaFilter}>${a.name}</option>`))}</select></label>
      ${this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => this.openAdd()}>הוספת מונה</sw-button>` : nothing}
    </div>`;
  }

  render() {
    if (!this.access.view) return html`<sw-state-panel state="forbidden" data-elec="meters" data-state="forbidden"></sw-state-panel>`;
    const meterId = this.params.get('meter') ?? '';
    const card = meterId ? html`<elec-meter-card .meterId=${meterId} ?canManage=${this.access.manage} @close=${() => this.setParams({ meter: null })} @changed=${() => void this.load(false)}></elec-meter-card>` : nothing;
    if (this.phase === 'loading') {
      return html`<div data-elec="meters" data-state="loading" aria-busy="true"><div class="card">${Array.from({ length: 7 }, () => html`<div class="row" style="padding:10px 0"><div class="sk" style="inline-size:30%"></div><span class="sp"></span><div class="sk" style="inline-size:14%"></div><div class="sk" style="inline-size:10%"></div></div>`)}</div></div>`;
    }
    if (this.phase === 'error') {
      return html`<div data-elec="meters" data-state="error"><sw-state-panel state="error" heading="לא ניתן לטעון את המונים" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load(true)}></sw-state-panel></div>`;
    }
    if (!this.meters.length) {
      return html`<div data-elec="meters" data-state="empty"><sw-state-panel state="empty" heading="אין מונים עדיין">${this.access.manage ? html`<sw-button variant="primary" icon="plus" data-add-meter @click=${() => this.openAdd()}>הוספת מונה</sw-button>` : nothing}</sw-state-panel>${this.renderAdd()}</div>`;
    }
    const list = this.visible();
    const body = !list.length
      ? html`<sw-state-panel state="empty" compact heading="לא נמצאו מונים" data-no-results></sw-state-panel>`
      : html`${this.view === 'cards' ? this.renderCards(list) : this.renderTable(list)}${this.renderRows(list)}`;
    return html`<div data-elec="meters" data-state="ready" style="display:flex;flex-direction:column;gap:14px">
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
    'elec-meters-page': ElecMetersPage;
  }
}
