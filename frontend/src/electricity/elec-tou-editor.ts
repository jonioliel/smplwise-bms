/**
 * EL5 (הגדרות › תשתיות › חשמל › מחירים ומע״מ): the editor of a time-of-use tariff version. Three parts, most used first:
 *  1. prices - a table of bands x seasons (a band a season can never use shows a dash);
 *  2. hours - per season, per day type, the day drawn as a 24-hour bar (the band colours of the legend) and the editable ranges of the
 *     non-default bands (quarter hours; a range may cross midnight);
 *  3. structure (folded) - the seasons' date ranges, the bands, which day type each weekday, a holiday and a holiday eve count as.
 * Every change emits `tou-change` with a new definition; the owner of the dialog saves it and the server validates (the first error comes
 * back with a path, `errorPath` marks the field). No Israeli number is assumed: the template's prices are empty.
 * CR-FE-LOGEXPORT-TARIFF-EN-2440: every season, day type and band may carry an optional English name ("שם באנגלית", Latin text up to
 * 40 characters - the server's `name_en` rule); the English interface shows it wherever a name is shown (touName), else the Hebrew.
 */
import { css, html, nothing, type TemplateResult } from 'lit';
import '../components/sw-button';
import '../components/sw-field';
import '../components/sw-table';
import type { TableColumn } from '../components/sw-table';
import { customElement, property } from 'lit/decorators.js';
import { ElecBase, n } from './elec-ui';
import { f4 } from './elec-format';
import { bandColor, bandsUsed, cloneDef, freshId, fromMin, NAME_EN_MAX, nameEnValid, touName, WEEK, WEEK_HE, weekGrid, type TouDefinition, type TouKind, type TouRange } from './elec-tou';
import type { PriceMode } from '../api/electricity-billing';
import { tr } from '../i18n/msg/electricity';

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
      /* CR-FIELD-UNIT-2470: the price grid (sw-table): the band's swatch and name, a price field of one fixed width with the ₪ inside
         its frame; the price cells sit on 8 px so four seasons fit the dialog */
      sw-table.t {
        --sw-table-cell-pad: 8px 10px;
      }
      sw-table.t::part(tou-band) {
        display: inline-flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 4px 6px;
      }
      sw-table.t::part(tou-swatch) {
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--sw-r-2xs);
        border: 1px solid var(--sw-border-strong);
        flex: none;
      }
      sw-table.t::part(tou-price) {
        inline-size: 128px;
        max-inline-size: 100%;
        gap: 4px;
      }
      .hint {
        font-size: var(--sw-fs-sm);
        color: var(--sw-text-3);
      }
      .sw {
        display: inline-block;
        inline-size: 12px;
        block-size: 12px;
        border-radius: var(--sw-r-2xs);
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
        border-radius: var(--sw-r-xs);
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
        font-size: var(--sw-fs-xs);
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
      .en {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-inline-size: 0;
      }
      .en .hint.bad {
        color: var(--sw-danger-text);
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
    const b = this.definition?.bands.find((x) => x.id === id);
    return b ? touName('bands', b) : id;
  }

  // ------------------------------------------------------------------ prices
  /** CR-FIELD-UNIT-2470 (owner N10): the prices are the shared sw-table (bare in the card, read-only rows; row hook `data-tou-band`), one
   * row per band and one column per season. Each price is the shared field with the ₪ unit inside its frame (`data-tou-price` on the
   * input; a price the server refused keeps the `err` class and is aria-invalid) and the other side of the VAT as its hint. A band a
   * season never uses shows a dash. On a phone the rows stack (each price under its season's caption): nothing scrolls sideways. */
  private prices(d: TouDefinition): TemplateResult {
    type Band = TouDefinition['bands'][number];
    return html`<div class="card" data-tou-prices>
      <div class="hd"><b class="h3">${tr('מחירים לקוט״ש')}</b><span class="sp"></span><span class="hint">${this.priceMode === 'inc_vat' ? tr('המחירים כוללים מע״מ') : tr('המחירים לפני מע״מ')}</span></div>
      <sw-table bare static-rows class="t" .columns=${this.priceColumns(d) as unknown as TableColumn[]} .rows=${d.bands as unknown as Record<string, unknown>[]}
        .rowAttrs=${(r: Record<string, unknown>) => ({ 'data-tou-band': (r as unknown as Band).id })}></sw-table>
    </div>`;
  }
  private priceColumns(d: TouDefinition): TableColumn<TouDefinition['bands'][number]>[] {
    return [
      {
        key: 'band',
        label: tr('פס'),
        render: (b) => html`<span part="tou-band"><span part="tou-swatch" style="background:${bandColor(d, b.id)}"></span><b>${touName('bands', b)}</b>${b.id === d.default_band ? html`<span class="mut">(${tr('שאר השעות')})</span>` : nothing}</span>`,
      },
      ...d.seasons.map(
        (s): TableColumn<TouDefinition['bands'][number]> => ({ key: `season-${s.id}`, label: touName('seasons', s), render: (b) => this.priceCell(d, s, b) }),
      ),
    ];
  }
  private priceCell(d: TouDefinition, s: TouDefinition['seasons'][number], b: TouDefinition['bands'][number]): TemplateResult {
    const v = d.prices[s.id]?.[b.id] ?? '';
    if (!bandsUsed(d, s.id).includes(b.id) && (v === '' || v === null)) return html`<span class="mut">-</span>`;
    const rate = this.vatRate;
    const num = Number(v);
    const other = rate !== null && v !== '' && Number.isFinite(num) ? (this.priceMode === 'ex_vat' ? num * (1 + rate) : num / (1 + rate)) : null;
    const hint = other !== null ? `${this.priceMode === 'ex_vat' ? tr('כולל מע״מ') : tr('לפני מע״מ')} ${f4(other)}` : '';
    const bad = !!this.bad(`prices.${s.id}.${b.id}`);
    return html`<sw-field part="field tou-price" unit="₪" hint=${hint}><input class="ltr ${bad ? 'err' : ''}" inputmode="decimal" aria-label=${tr('{band} ב{season}', { band: touName('bands', b), season: touName('seasons', s) })}
      aria-invalid=${bad ? 'true' : 'false'} data-tou-price=${`${s.id}:${b.id}`} .value=${v ?? ''} ?disabled=${this.readonly}
      @input=${(e: Event) => this.edit((x) => { (x.prices[s.id] ??= {})[b.id] = (e.target as HTMLInputElement).value.trim() || null; })} /></sw-field>`;
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
          <select aria-label=${tr('משעה')} ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][0] = (e.target as HTMLSelectElement).value; })}>${QUARTERS.slice(0, 96).map((q) => html`<option .selected=${q === r[0]} value=${q}>${q}</option>`)}</select>
          <span>${tr('עד')}</span>
          <select aria-label=${tr('עד שעה')} ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][1] = (e.target as HTMLSelectElement).value; })}>${QUARTERS.slice(1).map((q) => html`<option .selected=${q === r[1]} value=${q}>${q}</option>`)}</select>
          <select aria-label=${tr('פס')} ?disabled=${this.readonly} @change=${(e: Event) => this.edit((x) => { x.schedule[sid][did][j][2] = (e.target as HTMLSelectElement).value; })}>${d.bands.map((b) => html`<option .selected=${b.id === r[2]} value=${b.id}>${touName('bands', b)}</option>`)}</select>
          ${this.readonly ? nothing : html`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${tr('הסרת טווח')} data-tou-remove @click=${() => this.edit((x) => { x.schedule[sid][did].splice(j, 1); if (!x.schedule[sid][did].length) delete x.schedule[sid][did]; })}></sw-button>`}
        </div>`)}
        ${this.readonly || !others.length ? nothing : html`<div><sw-button variant="ghost" size="sm" data-tou-add=${`${sid}:${did}`} @click=${() => this.edit((x) => { ((x.schedule[sid] ??= {})[did] ??= []).push(['17:00', '22:00', others[0].id]); })}>${tr('+ טווח שעות')}</sw-button></div>`}
      </div>`;
  }
  private hours(d: TouDefinition): TemplateResult {
    const grid = weekGrid(d);
    const rng = (s: TouDefinition['seasons'][number]) => s.ranges.map(([a, b]) => `${a.split('-').reverse().join('.')}-${b.split('-').reverse().join('.')}`).join(', ');
    return html`<div class="card" data-tou-hours>
      <div class="hd"><b class="h3">${tr('שעות לפי עונה')}</b><span class="sp"></span>
        <span class="legend">${d.bands.map((b) => html`<span><i style="background:${bandColor(d, b.id)}"></i>${touName('bands', b)}</span>`)}</span></div>
      <div class="col">${d.seasons.map((s) => html`<div class="season" data-tou-season=${s.id}>
        <div class="row"><b class="h3">${touName('seasons', s)}</b><span class="mut">${n(rng(s))}</span></div>
        <div class="dt">${d.day_types.map((t) => this.dayRow(d, s.id, t.id, touName('day_types', t), grid))}</div>
      </div>`)}</div>
      <div class="hint" style="margin-block-start:8px">${tr('כל שעה שאינה בטווח שייכת ל{band}. השעות הן שעון מקומי; טווח שעובר את חצות (22:00 עד 06:00) נספר באותו תאריך.', { band: this.bandName(d.default_band) })}</div>
    </div>`;
  }

  // ------------------------------------------------------------------ English names
  /** CR-FE-LOGEXPORT-TARIFF-EN-2440: the optional English name of a season / day type / band. Empty = no `name_en` in the definition
   * (a definition without English names hashes as before); a Hebrew letter or more than 40 characters is marked here and refused by
   * the server (path `<list>[i].name_en`). */
  private nameEn(kind: TouKind, i: number, id: string, value: string | undefined): TemplateResult {
    const v = value ?? '';
    const ok = nameEnValid(v);
    return html`<div class="en">
      <input class="ltr ${ok && !this.bad(`${kind}[${i}].name_en`) ? '' : 'err'}" dir="ltr" lang="en" maxlength=${NAME_EN_MAX} aria-label=${tr('שם באנגלית')} placeholder=${tr('שם באנגלית (רשות)')}
        data-tou-name-en=${`${kind}:${id}`} .value=${v} ?disabled=${this.readonly} aria-invalid=${ok ? 'false' : 'true'}
        @input=${(e: Event) => this.setNameEn(kind, i, (e.target as HTMLInputElement).value)} />
      ${ok ? nothing : html`<span class="hint bad" data-tou-name-en-error>${tr('שם באנגלית: אותיות לטיניות בלבד, עד {max} תווים.', { max: NAME_EN_MAX })}</span>`}
    </div>`;
  }
  private setNameEn(kind: TouKind, i: number, value: string): void {
    this.edit((x) => {
      const it = (x[kind] as { name_en?: string }[])[i];
      if (!it) return;
      if (value.trim()) it.name_en = value;
      else delete it.name_en;
    });
  }

  // ------------------------------------------------------------------ structure
  private structure(d: TouDefinition): TemplateResult {
    const ro = this.readonly;
    const dtSel = (value: string | null, path: string, set: (x: TouDefinition, v: string | null) => void, allowNone: boolean) => html`<select class="${this.bad(path) ? 'err' : ''}" ?disabled=${ro} @change=${(e: Event) => this.edit((x) => set(x, (e.target as HTMLSelectElement).value || null))}>
      ${allowNone ? html`<option value="" .selected=${value === null}>${tr('ללא שינוי')}</option>` : nothing}${d.day_types.map((t) => html`<option value=${t.id} .selected=${t.id === value}>${touName('day_types', t)}</option>`)}</select>`;
    return html`<details class="card" data-tou-structure ?open=${!!this.errorPath && /^(seasons|bands|week|holiday|day_types|default_band)/.test(this.errorPath)}>
      <summary>${tr('מבנה התעריף: עונות, פסים וימים')}</summary>
      <div class="stru">
        <div class="col">
          <b>${tr('עונות')}</b>
          ${d.seasons.map((s, i) => html`<div class="season ${this.bad(`seasons[${i}]`)}" data-tou-season-def=${s.id}>
            <div class="row"><input aria-label=${tr('שם העונה')} .value=${s.name_he} ?disabled=${ro} @input=${(e: Event) => this.edit((x) => { x.seasons[i].name_he = (e.target as HTMLInputElement).value; })} />
              ${ro || d.seasons.length < 2 ? nothing : html`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${tr('הסרת העונה')} @click=${() => this.edit((x) => { const [gone] = x.seasons.splice(i, 1); delete x.schedule[gone.id]; delete x.prices[gone.id]; })}></sw-button>`}</div>
            ${this.nameEn('seasons', i, s.id, s.name_en)}
            ${s.ranges.map((r, j) => html`<div class="rng"><span class="mut">${tr('מ')}</span><input class="md ltr" aria-label=${tr('מתאריך (חודש-יום)')} placeholder="MM-DD" .value=${r[0]} ?disabled=${ro} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (MD.test(v)) this.edit((x) => { x.seasons[i].ranges[j][0] = v; }); }} />
              <span class="mut">${tr('עד')}</span><input class="md ltr" aria-label=${tr('עד תאריך (חודש-יום)')} placeholder="MM-DD" .value=${r[1]} ?disabled=${ro} @change=${(e: Event) => { const v = (e.target as HTMLInputElement).value.trim(); if (MD.test(v)) this.edit((x) => { x.seasons[i].ranges[j][1] = v; }); }} />
              ${ro || s.ranges.length < 2 ? nothing : html`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${tr('הסרת טווח תאריכים')} @click=${() => this.edit((x) => { x.seasons[i].ranges.splice(j, 1); })}></sw-button>`}</div>`)}
            ${ro ? nothing : html`<div><sw-button variant="ghost" size="sm" @click=${() => this.edit((x) => { x.seasons[i].ranges.push(['01-01', '01-31']); })}>${tr('+ טווח תאריכים')}</sw-button></div>`}
          </div>`)}
          // i18n-keep: the value of the name_he field (the Hebrew name of a bilingual name pair)
          ${ro ? nothing : html`<div><sw-button size="sm" data-tou-add-season @click=${() => this.edit((x) => { const id = freshId('season', x.seasons.map((s) => s.id)); x.seasons.push({ id, name_he: 'עונה חדשה', ranges: [['01-01', '01-31']] }); x.prices[id] = {}; })}>${tr('+ עונה')}</sw-button></div>`}
          <div class="hint">${tr('העונות חייבות לכסות את כל השנה בלי חפיפה. 29 בפברואר שייך לעונה של 28 בפברואר.')}</div>
        </div>
        <div class="col">
          <b>${tr('פסי תעריף')}</b>
          ${d.bands.map((b, i) => html`<div class="row ${this.bad(`bands[${i}]`)}"><span class="sw" style="background:${bandColor(d, b.id)}"></span>
            <input aria-label=${tr('שם הפס')} .value=${b.name_he} data-tou-band-name=${b.id} ?disabled=${ro} @input=${(e: Event) => this.edit((x) => { x.bands[i].name_he = (e.target as HTMLInputElement).value; })} />
            ${ro || b.id === d.default_band || d.bands.length < 2 ? nothing : html`<sw-button variant="ghost" size="sm" iconOnly icon="close" label=${tr('הסרת הפס')} @click=${() => this.edit((x) => {
              x.bands.splice(i, 1);
              for (const per of Object.values(x.schedule)) for (const k of Object.keys(per)) { per[k] = per[k].filter((r) => r[2] !== b.id); if (!per[k].length) delete per[k]; }
              for (const p of Object.values(x.prices)) delete p[b.id];
            })}></sw-button>`}</div>
            ${this.nameEn('bands', i, b.id, b.name_en)}`)}
          // i18n-keep: the value of the name_he field (the Hebrew name of a bilingual name pair)
          ${ro || d.bands.length >= 8 ? nothing : html`<div><sw-button size="sm" data-tou-add-band @click=${() => this.edit((x) => { x.bands.push({ id: freshId('band', x.bands.map((b) => b.id)), name_he: 'פס חדש' }); })}>${tr('+ פס')}</sw-button></div>`}
          <div class="fld"><label>${tr('שאר השעות שייכות ל')}</label><select ?disabled=${ro} @change=${(e: Event) => this.edit((x) => { x.default_band = (e.target as HTMLSelectElement).value; })}>${d.bands.map((b) => html`<option value=${b.id} .selected=${b.id === d.default_band}>${touName('bands', b)}</option>`)}</select></div>
          <b>${tr('סוגי ימים')}</b>
          <div class="dt" data-tou-day-types>${d.day_types.map((t, i) => html`<span class="${this.bad(`day_types[${i}]`)}">${t.name_he}</span>${this.nameEn('day_types', i, t.id, t.name_en)}`)}</div>
          <b>${tr('ימים')}</b>
          <div class="dt">${WEEK.map((w) => html`<span>${WEEK_HE[w]}</span>${dtSel(d.week[w], `week.${w}`, (x, v) => { x.week[w] = v ?? x.day_types[0].id; }, false)}`)}
            <span>${tr('חג')}</span>${dtSel(d.holiday, 'holiday', (x, v) => { x.holiday = v; }, true)}
            <span>${tr('ערב חג')}</span>${dtSel(d.holiday_eve, 'holiday_eve', (x, v) => { x.holiday_eve = v; }, true)}</div>
          <div class="hint">${tr('יום שמתאים לכמה סוגים (שבת שהיא גם ערב חג) מקבל את הסוג המאוחר ברשימה:')} ${d.day_types.map((t) => touName('day_types', t)).join(` ${tr('←')} `)}.</div>
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
