import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import { candidateMessage, listMeters, meterCandidates, type Meter, type MeterCandidate } from '../api/electricity-meters';
import { fmtKwh } from './format';
import { electricityCss } from './styles';

/** One selectable row, whichever source it came from. */
interface Pick {
  id: string;
  name: string;
  area: string;
  value: string;
  verdict: 'ok' | 'warn' | 'rejected' | 'added';
  message: string;
}

/**
 * Meter picker (CR-023 section 5, mockups "הוספת מונה" and wizard step 1): search by name, an area filter, and a verdict per sensor. A sensor that
 * measures instantaneous power (kW) or any other non-energy unit is listed with its reason and cannot be selected; pressing it explains why.
 *   mode 'register'  the sensors of the infrastructure (GET energy/candidates); selected ids are entity ids
 *   mode 'choose'    only the meters already registered (GET energy/meters); selected ids are meter ids (wizard step 1)
 * Event `change` with detail `{ selected: string[] }`.
 */
@customElement('elec-meter-picker')
export class ElecMeterPicker extends LitElement {
  @property() mode: 'register' | 'choose' = 'register';
  @property({ type: Boolean }) multi = true;
  @property({ attribute: false }) selected: string[] = [];

  @state() private q = '';
  @state() private area = '';
  @state() private items: Pick[] = [];
  @state() private phase: 'loading' | 'ready' | 'error' = 'loading';
  @state() private error = '';
  @state() private rejected: Pick | null = null;
  private timer = 0;
  private seq = 0;

  static styles = [
    electricityCss,
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
        color: var(--sw-text-inverse, #fff);
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

  private async load() {
    const my = ++this.seq;
    this.phase = 'loading';
    try {
      const items = this.mode === 'choose' ? this.fromMeters(await listMeters()) : this.fromCandidates(await meterCandidates(this.q, this.area || undefined));
      if (my !== this.seq) return;
      this.items = items;
      this.phase = 'ready';
    } catch (err) {
      if (my !== this.seq) return;
      this.error = describeError(err);
      this.phase = 'error';
    }
  }

  private fromCandidates(list: MeterCandidate[]): Pick[] {
    return list.map((c) => ({ id: c.entity_id, name: c.name, area: c.area_name ?? '', value: c.value ?? '', verdict: c.already_added ? 'added' : c.verdict, message: c.already_added ? '' : candidateMessage(c) }));
  }

  private fromMeters(list: Meter[]): Pick[] {
    const needle = this.q.trim().toLowerCase();
    return list
      .filter((m) => !needle || m.name.toLowerCase().includes(needle) || (m.area_name ?? '').toLowerCase().includes(needle))
      .filter((m) => !this.area || m.area_name === this.area)
      .map((m) => ({ id: m.id, name: m.name, area: m.area_name ?? '', value: `${fmtKwh(m.reading_kwh)} kWh`, verdict: m.status === 'stale' ? 'warn' : 'ok', message: m.status === 'stale' ? 'המונה לא מדווח כרגע' : '' }));
  }

  private onSearch(e: Event) {
    this.q = (e.target as HTMLInputElement).value;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.load(), 250);
  }

  private onArea(e: Event) {
    this.area = (e.target as HTMLSelectElement).value;
    void this.load();
  }

  private toggle(p: Pick) {
    if (p.verdict === 'rejected' || p.verdict === 'added') {
      this.rejected = p.verdict === 'rejected' ? p : null;
      return;
    }
    this.rejected = null;
    const has = this.selected.includes(p.id);
    const next = this.multi ? (has ? this.selected.filter((x) => x !== p.id) : [...this.selected, p.id]) : has ? [] : [p.id];
    this.selected = next;
    this.dispatchEvent(new CustomEvent('change', { detail: { selected: next }, bubbles: true, composed: true }));
  }

  private chip(p: Pick) {
    if (p.verdict === 'ok') return html`<span class="chip ok" data-verdict="ok">מתאים</span>`;
    if (p.verdict === 'warn') return html`<span class="chip warn" data-verdict="warn">אזהרה</span>`;
    if (p.verdict === 'added') return html`<span class="chip acc" data-verdict="added">נוסף</span>`;
    return html`<span class="chip err" data-verdict="rejected">לא מתאים</span>`;
  }

  render() {
    const areas = [...new Set(this.items.map((i) => i.area).filter(Boolean))];
    const listed = this.phase === 'ready' ? this.items : [];
    return html`
      <div class="head">
        <label class="inp">
          <sw-icon name="search" size="16"></sw-icon>
          <input type="search" data-picker-search placeholder="חיפוש לפי שם" aria-label="חיפוש לפי שם" .value=${this.q} @input=${this.onSearch} />
        </label>
        <label class="inp">
          <select data-picker-area aria-label="אזור" @change=${this.onArea}>
            <option value="" ?selected=${!this.area}>כל האזורים</option>
            ${[...new Set([...areas, this.area].filter(Boolean))].map((a) => html`<option value=${a} ?selected=${a === this.area}>${a}</option>`)}
          </select>
        </label>
      </div>
      ${this.rejected ? html`<div class="alert err" role="alert" data-picker-reject><span class="x"><span>!</span></span><div><b>${this.rejected.name}</b> לא נבחר. ${this.rejected.message}</div></div>` : nothing}
      ${this.phase === 'loading' ? html`<sw-state-panel state="loading" compact></sw-state-panel>` : nothing}
      ${this.phase === 'error' ? html`<sw-state-panel state="error" compact heading="לא ניתן לטעון את החיישנים" hint=${this.error} actionLabel="נסה שוב" @action=${() => void this.load()}></sw-state-panel>` : nothing}
      ${this.phase === 'ready' && !listed.length ? html`<sw-state-panel state="empty" compact heading="לא נמצאו חיישנים"></sw-state-panel>` : nothing}
      ${listed.length
        ? html`<div class="list scroll" role="listbox" aria-multiselectable=${this.multi ? 'true' : 'false'} data-picker-list>
            ${listed.map((p) => {
              const on = this.selected.includes(p.id);
              const off = p.verdict === 'rejected' || p.verdict === 'added';
              return html`<button type="button" class="li pick ${on ? 'sel' : ''} ${off ? 'dis' : ''}" role="option" aria-selected=${on ? 'true' : 'false'} aria-disabled=${off ? 'true' : 'false'} data-picker-item=${p.id} data-verdict=${p.verdict} @click=${() => this.toggle(p)}>
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
