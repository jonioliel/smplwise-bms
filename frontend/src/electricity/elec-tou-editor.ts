/**
 * EL5 (הגדרות › תשתיות › חשמל › מחירים ומע״מ): the editor of a time-of-use tariff version. Three parts, most used first:
 *  1. prices - a table of bands x seasons (a band a season can never use shows a dash);
 *  2. hours - per season, per day type, the day drawn as a 24-hour bar (the band colours of the legend) and the editable ranges of the
 *     non-default bands (quarter hours; a range may cross midnight);
 *  3. structure (folded) - the seasons' date ranges, the bands, which day type each weekday, a holiday and a holiday eve count as.
 * Every change emits `tou-change` with a new definition; the owner of the dialog saves it and the server validates (the first error comes
 * back with a path, `errorPath` marks the field). No Israeli number is assumed: the template's prices are empty.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ElecBase, n } from './elec-ui';
import { f4 } from './elec-format';
import { bandColor, bandsUsed, cloneDef, freshId, fromMin, WEEK, WEEK_HE, weekGrid, type TouDefinition, type TouRange } from './elec-tou';
import type { PriceMode } from '../api/electricity-billing';

const QUARTERS = Array.from({ length: 97 }, (_, i) => fromMin(i * 15));
const MD = /^\d{2}-\d{2}$/;

@customElement('elec-tou-editor')
export class ElecTouEditor extends ElecBase {
  @property({ attribute: false }) definition: TouDefinition | null = null;
  @property({ type: Boolean }) readonly = false;
  /** the path of the server's first error (`prices.summer.peak`, `schedule.winter.weekday[0]`, `seasons[1].ranges[0]`...) */
  @property() errorPath = '';
  @property() priceMode: PriceMode = 'ex_vat';
  /** the VAT rate in force (0.18), for the "including VAT" hint under each price; null = unknown */
  @property({ type: Number }) vatRate: number | null = null;

  static styles = [
    ...ElecBase.styles,
    css`
      .tou {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      table.t td.pc {
        padding: 6px 8px;
        min-inline-size: 120px;
      }
      table.t td.pc .unit {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      table.t td.pc input {
        inline-size: 110px;
      }
      .hint {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      .sw {
        display: inline-block;
        inline-size: 12px;
        block-size: 12px;
        border-radius: 3px;
        vertical-align: -1px;
        margin-inline-end: 6px;
        border: 1px solid var(--sw-border-strong);
      }
      .season {
        border: 1px solid var(--sw-border);
        border-radius: var(--sw-r-md);
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .dt {
        display: grid;
        grid-template-columns: 130px minmax(0, 1fr);
        gap: 6px 12px;
        align-items: start;
      }
      .day {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .bar {
        display: flex;
        block-size: 22px;
        border-radius: 6px;
        overflow: hidden;
        border: 1px solid var(--sw-border-strong);
      }
      .bar i {
        display: block;
        block-size: 100%;
      }
      .ticks {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--sw-text-3);
      }
      .rng {
        display: flex;
        gap: 6px;
        align-items: center;
        flex-wrap: wrap;
      }
      .rng select {
        inline-size: auto;
        min-inline-size: 92px;
      }
      .err-on {
        outline: 2px solid var(--sw-danger);
        outline-offset: 2px;
        border-radius: var(--sw-r-sm);
      }
      details > summary {
        cursor: pointer;
        font-weight: var(--sw-fw-semibold);
        color: var(--sw-heading);
        min-block-size: var(--elec-touch);
        display: flex;
        align-items: center;
      }
      .stru {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-block-start: 10px;
      }
      .stru .md {
        inline-size: 92px;
      }
      @media (max-width: 767px) {
        .dt {
          grid-template-columns: minmax(0, 1fr);
        }
        .stru {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ];

  private emit(d: TouDefinition): void {
    this.definition = d;
    this.dispatchEvent(new CustomEvent<TouDefinition>('tou-change', { detail: d, bubbles: true, composed: true }));
  }
  private edit(fn: (d: TouDefinition) => void): void {
    if (!this.definition || this.readonly) return;
    const d = cloneDef(this.definition);
    fn(d);
    this.emit(d);
  }
  private bad(path: string): string {
    return this.errorPath && (this.errorPath === path || this.errorPath.startsWith(path + '[') || this.errorPath.startsWith(path + '.')) ? 'err-on' : '';
  }
  private bandName(id: string): string {
    return this.definition?.bands.find((b) => b.id === id)?.name_he ?? id;
  }

  // ------------------------------------------------------------------ prices
  private prices(d: TouDefinition): TemplateResult {
    const rate = this.vatRate;
    return html`<div class="card flush" data-tou-prices>
      <div class="hd"><b class="h3">מחירים לקוט״ש</b><span class="sp"></span><span class="hint">${this.priceMode === 'inc_vat' ? 'המחירים כוללים מע״מ' : 'המחירים לפני מע״מ'}</span></div>
      <div class="scrollx"><table class="t">
        <thead><tr><th>פס</th>${d.seasons.map((s) => html`<th>${s.name_he}</th>`)}</tr></thead>
        <tbody>${d.bands.map((b) => html`<tr><td class="b"><span class="sw" style="background:${bandColor(d, b.id)}"></span>${b.name_he}${b.id === d.default_band ? html` <span class="hint">(שאר השעות)</span>` : nothing}</td>
          ${d.seasons.map((s) => {
            const used = bandsUsed(d, s.id).includes(b.id);
            const v = d.prices[s.id]?.[b.id] ?? '';
            const path = `prices.${s.id}.${b.id}`;
            if (!used && (v === '' || v === null)) return html`<td class="pc"><span class="hint">-</span></td>`;
            const num = Number(v);
            const other = rate !== null && v !== '' && Number.isFinite(num) ? (this.priceMode === 'ex_vat' ? num * (1 + rate) : num / (1 + rate)) : null;
            return html`<td class="pc"><div class="unit"><input class="ltr ${this.bad(path) ? 'err' : ''}" inputmode="decimal" aria-label=${`${b.name_he} ב${s.name_he}`} data-tou-price=${`${s.id}:${b.id}`} .value=${v ?? ''} ?disabled=${this.readonly}
              @input=${(e: Event) => this.edit((x) => { (x.prices[s.id] ??= {})[b.id] = (e.target as HTMLInputElement).value.trim() || null; })} /><span>₪</span></div>
              ${other !== null ? html`<div class="hint">${this.priceMode === 'ex_vat' ? 'כולל מע״מ' : 'לפני מע״מ'} ${n(f4(other))}</div>` : nothing}</td>`;
          })}</tr>`)}</tbody>
      </table></div>
    </div>`;
  }

  // ------------------------------------------------------------------ hours
  private dayRow(d: TouDefinition, sid: string, did: string, name: string, grid: ReturnType<typeof weekGrid>): TemplateResult {
    const ranges: TouRange[] = d.schedule[sid]?.[did] ?? [];
    const others = d.bands.filter((b) => b.id !== d.default_band);
    const cells = grid[sid]?.[did] ?? [];
    const width = (a: string, b: string) => ((Number(b.slice(0, 2)) * 60 + Number(b.slice(3)) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)))) / 1440) * 100;
    const path = `schedule.${sid}.${did}`;
    return html`<div class="b">${name}</div>
      <div class="day ${this.bad(path)}" data-tou-day=${`${sid}:${did}`}>
        <div class="bar" role="img" aria-label=${`${name}: ` + cells.map((c) => `${c.from}-${c.to} ${this.bandName(c.band)}`).join(', ')}>${cells.map((c) => html`<i style="inline-size:${width(c.from, c.to)}%;background:${bandColor(d, c.band)}" title=${`${c.from}-${c.to} ${this.bandName(c.band)}`} data-cell=${c.band}></i>`)}</div>
        <div class="ticks" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        ${ranges.map((r, j) => html`<div class="rng" data-tou-range=${`${sid}:${did}:${j}`}>
          <select aria-label="משעה" ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][0] = (e.target as HTMLSelectElement).value; })}>${QUARTERS.slice(0, 96).map((q) => html`<option .selected=${q === r[0]} value=${q}>${q}</option>`)}</select>
          <span>עד</span>
          <select aria-label="עד שעה" ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][1] = (e.target as HTMLSelectElement).value; })}>${QUARTERS.slice(1).map((q) => html`<option .selected=${q === r[1]} value=${q}>${q}</option>`)}</select>
          <select aria-label="פס" ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][2] = (e.target as HTMLSelectElement).value; })}>${d.bands.map((b) => html`<option .selected=${b.id === r[2]} value=${b.id}>${b.name_he}</option>`)}</select>
          ${this.readonly ? nothing : html`<button type="button" class="btn ghost sm ic" aria-label="הסרת טווח" data-tou-remove @click=${() => this.edit((x) => { x.schedule[sid][did].splice(j, 1); if (!x.schedule[sid][did].length) delete x.schedule[sid][did]; })}>✕</button>`}
        </div>`)}
        ${this.readonly || !others.length ? nothing : html`<div><button type="button" class="btn ghost sm" data-tou-add=${`${sid}:${did}`} @click=${() => this.edit((x) => { ((x.schedule[sid] ??= {})[did] ??= []).push(['17:00', '22:00', others[0].id]); })}>+ טווח שעות</button></div>`}
      </div>`;
  }
  private hours(d: TouDefinition): TemplateResult {
    const grid = weekGrid(d);
    const rng = (s: TouDefinition['seasons'][number]) => s.ranges.map(([a, b]) => `${a.split('-').reverse().join('.')}-${b.split('-').reverse().join('.')}`).join(', ');
    return html`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">שעות לפי עונה</b><span class="sp"></span>
        <span class="legend">${d.bands.map((b) => html`<span><i style="background:${bandColor(d, b.id)}"></i>${b.name_he}</span>`)}</span></div>
      <div class="col">${d.seasons.map((s) => html`<div class="season" data-tou-season=${s.id}>
        <div class="row"><b class="h3">${s.name_he}</b><span class="mut">${n(rng(s))}</span></div>
        <div class="dt">${d.day_types.map((t) => this.dayRow(d, s.id, t.id, t.name_he, grid))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">כל שעה שאינה בטווח שייכת ל${this.bandName(d.default_band)}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.</div>
    </div>`;
  }

  // ------------------------------------------------------------------ structure
  private structure(d: TouDefinition): TemplateResult {
    const ro = this.readonly;
    const dtSel = (value: string | null, path: string, set: (x: TouDefinition, v: string | null) => void, allowNone: boolean) => html`<select class="${this.bad(path) ? 'err' : ''}" ?disabled=${ro} @change=${(e: Event) => this.edit((x) => set(x, (e.target as HTMLSelectElement).value || null))}>
      ${allowNone ? html`<option value="" .selected=${value === null}>ללא שינוי</option>` : nothing}${d.day_types.map((t) => html`<option value=${t.id} .selected=${t.id === value}>${t.name_he}</option>`)}</select>`;
    return html`<details class="card" data-tou-structure ?open=${!!this.errorPath && /^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>מבנה התעריף: עונות, פסים וימים</summary>
      <div class="stru">
        <div class="col">
          <b>עונות</b>
          ${d.seasons.map((s, i) => html`<div class="season ${this.bad(`seasons[${i}]`)}" data-tou-season-def=${s.id}>
            <div class="row"><input aria-label="שם העונה" .value=${s.name_he} ?disabled=${ro} @input=${(e: Event) => this.edit((x) => { x.seasons[i].name_he = (e.target as HTMLInputElement).value; })} />
              ${ro || d.seasons.length < 2 ? nothing : html`<button type="button" class="btn ghost sm ic" aria-label="הסרת העונה" @click=${() => this.edit((x) => { const [gone] = x.seasons.splice(i, 1); delete x.schedule[gone.id]; delete x.prices[gone.id]; })}>✕</button>`}</div>
            ${s.ranges.map((r, j) => html`<div class="rng"><span class="mut">מ</span><input class="md ltr" aria-label="מתאריך (חודש-יום)" placeholder="MM-DD" .value=${r[0]} ?disabled=${ro} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (MD.test(v)) this.edit((x) => { x.seasons[i].ranges[j][0] = v; }); }} />
              <span class="mut">עד</span><input class="md ltr" aria-label="עד תאריך (חודש-יום)" placeholder="MM-DD" .value=${r[1]} ?disabled=${ro} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (MD.test(v)) this.edit((x) => { x.seasons[i].ranges[j][1] = v; }); }} />
              ${ro || s.ranges.length < 2 ? nothing : html`<button type="button" class="btn ghost sm ic" aria-label="הסרת טווח תאריכים" @click=${() => this.edit((x) => { x.seasons[i].ranges.splice(j, 1); })}>✕</button>`}</div>`)}
            ${ro ? nothing : html`<div><button type="button" class="btn ghost sm" @click=${() => this.edit((x) => { x.seasons[i].ranges.push(['01-01', '01-31']); })}>+ טווח תאריכים</button></div>`}
          </div>`)}
          ${ro ? nothing : html`<div><button type="button" class="btn sm" data-tou-add-season @click=${() => this.edit((x) => { const id = freshId('season', x.seasons.map((s) => s.id)); x.seasons.push({ id, name_he: 'עונה חדשה', ranges: [['01-01', '01-31']] }); x.prices[id] = {}; })}>+ עונה</button></div>`}
          <div class="hint">העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.</div>
        </div>
        <div class="col">
          <b>פסי תעריף</b>
          ${d.bands.map((b, i) => html`<div class="row ${this.bad(`bands[${i}]`)}"><span class="sw" style="background:${bandColor(d, b.id)}"></span>
            <input aria-label="שם הפס" .value=${b.name_he} data-tou-band-name=${b.id} ?disabled=${ro} @input=${(e: Event) => this.edit((x) => { x.bands[i].name_he = (e.target as HTMLInputElement).value; })} />
            ${ro || b.id === d.default_band || d.bands.length < 2 ? nothing : html`<button type="button" class="btn ghost sm ic" aria-label="הסרת הפס" @click=${() => this.edit((x) => {
              x.bands.splice(i, 1);
              for (const per of Object.values(x.schedule)) for (const k of Object.keys(per)) { per[k] = per[k].filter((r) => r[2] !== b.id); if (!per[k].length) delete per[k]; }
              for (const p of Object.values(x.prices)) delete p[b.id];
            })}>✕</button>`}</div>`)}
          ${ro || d.bands.length >= 8 ? nothing : html`<div><button type="button" class="btn sm" data-tou-add-band @click=${() => this.edit((x) => { x.bands.push({ id: freshId('band', x.bands.map((b) => b.id)), name_he: 'פס חדש' }); })}>+ פס</button></div>`}
          <div class="fld"><label>שאר השעות שייכות ל</label><select ?disabled=${ro} @change=${(e: Event) => this.edit((x) => { x.default_band = (e.target as HTMLSelectElement).value; })}>${d.bands.map((b) => html`<option value=${b.id} .selected=${b.id === d.default_band}>${b.name_he}</option>`)}</select></div>
          <b>ימים</b>
          <div class="dt">${WEEK.map((w) => html`<span>${WEEK_HE[w]}</span>${dtSel(d.week[w], `week.${w}`, (x, v) => { x.week[w] = v ?? x.day_types[0].id; }, false)}`)}
            <span>חג</span>${dtSel(d.holiday, 'holiday', (x, v) => { x.holiday = v; }, true)}
            <span>ערב חג</span>${dtSel(d.holiday_eve, 'holiday_eve', (x, v) => { x.holiday_eve = v; }, true)}</div>
          <div class="hint">יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה: ${d.day_types.map((t) => t.name_he).join(' ← ')}.</div>
        </div>
      </div>
    </details>`;
  }

  render() {
    const d = this.definition;
    if (!d) return nothing;
    return html`<div class="tou" data-tou-editor>${this.prices(d)}${this.hours(d)}${this.structure(d)}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'elec-tou-editor': ElecTouEditor;
  }
}
