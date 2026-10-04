import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { candidateMessage, listMeters, meterCandidates, type Meter, type MeterCandidate } from '../api/electricity-meters';
import { SkinController } from '../design/skin';
import { fmtKwh } from './format';
import { elecCss } from './styles';

/** One row, whichever source it came from. `sensor`: an infrastructure sensor shown in 'choose' mode for its reason only (never selectable). */
interface Pick {
  id: string;
  name: string;
  area: string;
  value: string;
  verdict: 'ok' | 'warn' | 'rejected' | 'added';
  message: string;
  sensor: boolean;
  /** the chip's word when it is not the verdict's own (a registered meter that does not report, or is paused) */
  tag?: string;
}

/**
 * Meter picker (CR-023 section 5, mockups "הוספת מונה" and wizard step 1): search by name, an area filter, and a verdict per sensor. A sensor that
 * measures instantaneous power (kW) or any other non-energy unit is listed with its reason and cannot be selected; pressing it explains why.
 *   mode 'register'  the sensors of the infrastructure (GET energy/candidates, searched on the server); selected ids are entity ids
 *   mode 'choose'    only the meters already registered (GET energy/meters, or `.meters` when the host already holds them); selected ids are meter
 *                    ids (wizard step 1). With `sensors`, the sensors that are not meters are listed too, unselectable, with their reason.
 * Event `change` with detail `{ selected: string[] }`.
 */
@customElement('elec-meter-picker')
export class ElecMeterPicker extends LitElement {
  readonly bubbleSkin = new SkinController(this);
  @property() mode: 'register' | 'choose' = 'register';
  @property({ type: Boolean }) multi = true;
  @property({ type: Boolean }) sensors = false;
  @property({ attribute: false }) selected: string[] = [];
  /** 'choose' mode: the registered meters, when the host has loaded them already (no second read). */
  @property({ attribute: false }) meters: Meter[] | null = null;

  @state() private q = '';
  @state() private area = '';
  @state() private items: Pick[] = [];
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private rejected: Pick | null = null;
  private timer = 0;
  private seq = 0;

  static styles = [
    elecCss,
    css`
      :host {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-inline-size: 0;
      }
      .head {
        display: flex;
        gap: 10px;
        align-items: stretch;
      }
      .head .inp:first-child {
        flex: 1;
      }
      .head .inp:last-child {
        flex: 0 1 190px;
      }
      .check {
        flex: none;
        inline-size: 20px;
        block-size: 20px;
        border: 2px solid var(--sw-border-strong);
        border-radius: 6px;
        display: grid;
        place-items: center;
        color: var(--sw-text-inverse);
      }
      .check.on {
        background: var(--sw-accent);
        border-color: var(--sw-accent);
      }
      .check.dis {
        opacity: 0.4;
      }
      .scroll {
        max-block-size: min(46vh, 420px);
        overflow: auto;
      }
      .li.pick[aria-disabled='true'] {
        cursor: help;
      }
      .li.pick.flag {
        border-color: var(--sw-danger);
        opacity: 1;
      }
      @media (max-width: 600px) {
        .head {
          flex-direction: column;
        }
        .head .inp:last-child {
          flex: 1;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback() {
    window.clearTimeout(this.timer);
    super.disconnectedCallback();
  }

  protected updated(changed: Map<string, unknown>) {
    if (changed.has('meters') && changed.get('meters') !== undefined && this.mode === 'choose') void this.load();
  }

  private async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    try {
      const items = this.mode === 'choose' ? await this.loadChoose() : this.fromCandidates(await meterCandidates(this.q, this.area || undefined));
      if (my !== this.seq) return;
      this.items = items;
      this.phase = 'ready';
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  /** 'choose': the meters (and, with `sensors`, the sensors that are not meters); searched and filtered here, read once. */
  private async loadChoose(): Promise<Pick[]> {
    const [list, sensors] = await Promise.all([
      this.meters ? Promise.resolve(this.meters) : listMeters(),
      this.sensors ? meterCandidates('').catch(() => [] as MeterCandidate[]) : Promise.resolve([] as MeterCandidate[]),
    ]);
    return [...this.fromMeters(list), ...this.fromSensors(sensors)];
  }

  private fromCandidates(list: MeterCandidate[]): Pick[] {
    return list.map((c) => ({ id: c.entity_id, name: c.name, area: c.area_name ?? '', value: c.value ?? '', verdict: c.already_added ? 'added' : c.verdict, message: c.already_added ? '' : candidateMessage(c), sensor: false }));
  }

  private fromMeters(list: Meter[]): Pick[] {
    return list.map((m) => ({
      id: m.id,
      name: m.name,
      area: m.area_name ?? '',
      value: `${fmtKwh(m.reading_kwh)} kWh`,
      verdict: m.status === 'reporting' ? 'ok' : 'warn',
      message: m.status === 'stale' ? 'המונה לא מדווח כרגע' : m.status === 'paused' ? 'המונה מושהה' : '',
      sensor: false,
      tag: m.status === 'stale' ? 'לא מדווח' : m.status === 'paused' ? 'מושהה' : undefined,
    }));
  }

  /** A sensor that is not a registered meter: never a choice here. A warning one (a daily counter) can be added on the meters screen first. */
  private fromSensors(list: MeterCandidate[]): Pick[] {
    return list
      .filter((c) => c.verdict !== 'ok' && !c.already_added)
      .map((c) => ({
        id: c.entity_id,
        name: c.name,
        area: c.area_name ?? '',
        value: c.value ?? '',
        verdict: c.verdict === 'warn' ? 'warn' : 'rejected',
        message: c.verdict === 'warn' ? `${candidateMessage(c)} צריך להוסיף אותו קודם במסך המונים.` : candidateMessage(c),
        sensor: true,
      }));
  }

  /** The rows shown: 'choose' filters here (search by name or area, the area filter); 'register' is searched on the server. */
  private listed(): Pick[] {
    if (this.phase !== 'ready') return [];
    if (this.mode !== 'choose') return this.items;
    const needle = this.q.trim().toLowerCase();
    return this.items.filter((p) => (!this.area || p.area === this.area) && (!needle || p.name.toLowerCase().includes(needle) || p.area.toLowerCase().includes(needle)));
  }

  private onSearch(e: Event) {
    this.q = (e.target as HTMLInputElement).value;
    if (this.mode === 'choose') return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.load(), 250);
  }

  private onArea(e: Event) {
    this.area = (e.target as HTMLSelectElement).value;
    if (this.mode !== 'choose') void this.load();
  }

  private off(p: Pick): boolean {
    return p.sensor || p.verdict === 'rejected' || p.verdict === 'added';
  }

  private toggle(p: Pick) {
    if (this.off(p)) {
      this.rejected = p.verdict === 'added' ? null : p;
      return;
    }
    this.rejected = null;
    const has = this.selected.includes(p.id);
    const next = this.multi ? (has ? this.selected.filter((x) => x !== p.id) : [...this.selected, p.id]) : has ? [] : [p.id];
    this.selected = next;
    this.dispatchEvent(new CustomEvent('change', { detail: { selected: next }, bubbles: true, composed: true }));
  }

  private chip(p: Pick) {
    if (p.verdict === 'ok') return html`<span class="chip c-ok" data-verdict="ok">מתאים</span>`;
    if (p.verdict === 'warn') return html`<span class="chip c-warn" data-verdict="warn">${p.tag ?? 'אזהרה'}</span>`;
    if (p.verdict === 'added') return html`<span class="chip c-acc" data-verdict="added">נוסף</span>`;
    return html`<span class="chip c-err" data-verdict="rejected">לא מתאים</span>`;
  }

  render() {
    const choose = this.mode === 'choose';
    const areas = [...new Set(this.items.map((i) => i.area).filter(Boolean))];
    const listed = this.listed();
    return html`
      <div class="head">
        <label class="inp">
          <sw-icon name="search" size="16"></sw-icon>
          <input type="search" data-picker-search placeholder=${choose ? 'חיפוש מונה לפי שם' : 'חיפוש לפי שם'} aria-label=${choose ? 'חיפוש מונה לפי שם' : 'חיפוש לפי שם'} .value=${this.q} @input=${this.onSearch} />
        </label>
        <label class="inp">
          <select data-picker-area aria-label="אזור" @change=${this.onArea}>
            <option value="" ?selected=${!this.area}>כל האזורים</option>
            ${[...new Set([...areas, this.area].filter(Boolean))].map((a) => html`<option value=${a} ?selected=${a === this.area}>${a}</option>`)}
          </select>
        </label>
      </div>
      ${this.rejected ? html`<div class="alert err" role="alert" data-picker-reject><span class="x" aria-hidden="true">!</span><div><b>${this.rejected.name}</b> לא נבחר. ${this.rejected.message}</div></div>` : nothing}
      ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
      ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading=${choose ? 'לא ניתן לטעון את המונים' : 'לא ניתן לטעון את החיישנים'} hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel>` : nothing}
      ${this.phase === 'ready' && !listed.length ? html`<sw-state-panel state="empty" compact data-no-match heading=${choose ? (this.items.length ? 'לא נמצא מונה בשם הזה' : 'אין מונים עדיין') : 'לא נמצאו חיישנים'}></sw-state-panel>` : nothing}
      ${listed.length
        ? html`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi ? 'true' : 'false'} aria-label=${choose ? 'מונים' : 'חיישנים'} data-picker-list>
            ${listed.map((p) => {
              const on = this.selected.includes(p.id);
              const off = this.off(p);
              return html`<button type="button" class="li pick ${on ? 'sel' : ''} ${off ? 'dis' : ''} ${this.rejected?.id === p.id ? 'flag' : ''}" role="option" aria-selected=${on ? 'true' : 'false'} aria-disabled=${off ? 'true' : 'false'} data-picker-item=${p.id} data-verdict=${p.verdict} ?data-sensor=${p.sensor} @click=${() => this.toggle(p)}>
                <span class="check ${on ? 'on' : ''} ${off ? 'dis' : ''}">${on ? html`<sw-icon name="check" size="14"></sw-icon>` : nothing}</span>
                <span class="grow">
                  <div class="t1">${p.name}</div>
                  <div class="t2">${p.area}${p.area && p.value ? ' · ' : ''}<span class="num">${p.value}</span></div>
                  ${p.message && (p.verdict === 'warn' || p.verdict === 'rejected') ? html`<div class="t2 wrap" style="color:${p.verdict === 'warn' ? 'var(--sw-warning-text)' : 'var(--sw-danger-text)'}">${p.message}</div>` : nothing}
                </span>
                ${this.chip(p)}
              </button>`;
            })}
          </div>`
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-meter-picker': ElecMeterPicker;
  }
}
