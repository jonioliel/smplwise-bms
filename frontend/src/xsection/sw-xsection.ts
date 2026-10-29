import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { bidi, ltrNum } from '../i18n/bidi';
import { xt } from '../i18n/xsection';
import { xi } from './xs-icons';
import { tempState, totalsOf, XS_DEFAULT, type FloorSignal, type XsOptions } from './xs-model';

/** A stairs or a lift that links floors: the floors it reaches (ids, top to bottom as drawn) and those whose twin is not published yet. */
export interface SectionLink { kind: 'stairs' | 'lift'; label: string; floors: string[]; pending?: string[] }

const deg = (f: FloorSignal) => (f.nodata || f.temp === null ? html`<span class="deg none">-</span>` : html`<span class="deg">${f.temp.toFixed(1)}<small>°</small></span>`);
const litText = (f: FloorSignal) => (f.lit === null || f.lights === null ? '-' : `${f.lit}/${f.lights}`);

/** The little facade: k windows, the lit share filled. Unknown lights = all windows dark (and the row says "no data" in words). */
export function panes(f: Pick<FloorSignal, 'lit' | 'lights'>, k: number): TemplateResult {
  const on = f.lights ? Math.round(((f.lit ?? 0) / f.lights) * k) : 0;
  return html`<span class="fac" aria-hidden="true">${Array.from({ length: k }, (_, i) => html`<i class=${i < on ? 'on' : ''}></i>`)}</span>`;
}

/** The phone tile beside a floor card (option A): level, degrees and 3 windows. A button: it selects like the card. */
export function xsTile(f: FloorSignal, o: XsOptions, selected: boolean, pick: () => void): TemplateResult {
  const t = tempState(f, o.temp_threshold);
  const short = f.level === 0 ? xt('ground').slice(0, 1) : f.level > 0 ? String(f.level) : `‎${f.level}`;
  return html`<button class="xtile" data-xs-tile=${f.id} aria-pressed=${selected} aria-label=${xt('tileFor', { name: f.name })} data-temp=${t ?? ''} ?data-off=${f.nodata} @click=${pick}>
    <span class="lv">${short}</span><span class="tv">${f.nodata || f.temp === null ? '-' : `${f.temp.toFixed(1)}°`}</span>${panes(f, 3)}
  </button>`;
}

/** The chips of the section head and the compact card: the whole building, with the unknown left out in words. */
export function totalChips(fl: FloorSignal[], o: XsOptions): TemplateResult {
  const t = totalsOf(fl, o.temp_threshold);
  return html`<span class="chips">
    ${t.avg !== null ? html`<span class="chip">${xi('therm')}${xt('avgTemp')} <b>${t.avg.toFixed(1)}°</b></span>` : nothing}
    ${t.litKnown ? html`<span class="chip warm">${xi('light')}<b>${t.lit}/${t.lights}</b> ${xt('lightsOn')}</span>` : nothing}
    ${t.hot ? html`<span class="chip hot">${xi('flame')}${xt('hotCount', { n: t.hot })}</span>` : nothing}
    ${t.cold ? html`<span class="chip cold">${xi('snow')}${xt('coldCount', { n: t.cold })}</span>` : nothing}
    ${t.nodata ? html`<span class="chip off">${xi('offline')}${xt('noDataCount', { n: t.nodata })}</span>` : nothing}
  </span>`;
}

/**
 * The building cross-section (release 2.29.0, mock-up v3): the floors drawn one above the other, top to bottom, each a row with its name,
 * a small facade (lit windows), the state in a word + icon (hot / cold / no data) and the temperature. Stairs (dashed) and lifts (solid)
 * run beside the rows. A click on a row fires `xs-pick` ({ id }); the host decides what it means (select / open). Rows have no scroll:
 * they share the height (the density steps down with the number of floors).
 */
@customElement('sw-xsection')
export class SwXSection extends LitElement {
  @property({ attribute: false }) floors: FloorSignal[] = [];
  @property({ attribute: false }) links: SectionLink[] = [];
  @property({ attribute: false }) opts: XsOptions = { ...XS_DEFAULT };
  @property() selectedId: string | null = null;
  @property() hoverId: string | null = null;
  /** A phone sheet shows the section without its own gear / legend chrome. */
  @property({ type: Boolean }) sheet = false;
  /** floor id -> the alarm / fault state of the demo (never drawn without the label). */
  @property({ attribute: false }) fire: Record<string, { state: string }> | null = null;

  static styles = [
    css`
      :host { display: block; min-inline-size: 0; min-block-size: 0; block-size: 100%; }
      .card { block-size: 100%; min-block-size: 0; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; padding: 16px 18px 14px; background: var(--sw-surface); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); border: 1px solid var(--sw-border); }
      :host([sheet]) .card { box-shadow: none; border: 0; padding: 4px 2px 0; }
      .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
      h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.02em; color: var(--sw-heading); white-space: nowrap; }
      h2 .xi { inline-size: 20px; block-size: 20px; color: var(--sw-text-3); }
      .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; min-inline-size: 0; }
      .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .chip b { color: var(--sw-text); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
      .xi { inline-size: 14px; block-size: 14px; flex: none; }
      .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); color: var(--sw-text); }
      .chip.hot { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.cold { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text-3); }
      .body { min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
      .body.has-shafts { padding-block-start: 22px; }
      .stack { container-type: size; position: relative; min-block-size: 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 6px; }
      .row, .xtile { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }

          .row { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(150px, auto); align-items: center; gap: 14px; padding: 0 14px; border: 0; border-radius: 12px; background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
      .row:active { transform: scale(var(--sw-press-scale, 0.98)); }
      @media (hover: hover) and (pointer: fine) { .row:hover:not(.sel), .row.hl:not(.sel) { background: var(--sw-surface-3); } }
      .nm { min-inline-size: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
      .t { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .s { font-size: 12.5px; color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; gap: 6px; align-items: center; }
      .fac { position: relative; align-self: center; block-size: min(calc(100% - 20px), 36px); display: flex; align-items: stretch; gap: 3px; padding: 3px; border-radius: 7px; background: var(--sw-border); }
      .fac i { flex: 1 1 0; min-inline-size: 3px; border-radius: 3px; background: var(--sw-surface-2); }
      .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
      .val { min-inline-size: 0; display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
      .val .chip { block-size: 26px; }
      .deg { min-inline-size: 64px; text-align: end; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); line-height: 1; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
      .deg small { font-size: 0.6em; font-weight: 700; color: var(--sw-text-3); }
      .deg.none { color: var(--sw-text-3); }
      .row[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
      .row[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
      .row[data-off] { background: repeating-linear-gradient(135deg, transparent 0 7px, color-mix(in srgb, var(--sw-border) 55%, transparent) 7px 8px), var(--sw-surface-2); box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
      .row[data-off] .fac { opacity: 0.45; }
      .row[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); box-shadow: inset 0 0 0 2px var(--sw-danger); }
      .row.below:not([data-off]):not([data-temp]):not([data-fire]) { background: color-mix(in srgb, var(--sw-surface-2) 70%, var(--sw-surface-3)); }
      .row.sel { background: var(--sw-accent-soft); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .row.sel::after { content: ''; position: absolute; inset-inline-start: -7px; top: 50%; inline-size: 12px; block-size: 12px; margin-block-start: -6px; background: var(--sw-accent); border-radius: 2px; transform: rotate(45deg); }
      .ground { position: relative; flex: none; block-size: 2px; margin: 4px 6px; border-radius: 2px; background: var(--sw-border-strong); }
      .ground span { position: absolute; inset-inline-end: 0; top: 50%; transform: translateY(-50%); padding: 0 8px; background: var(--sw-surface); color: var(--sw-text-3); font-size: 11.5px; font-weight: 600; border-radius: 999px; line-height: 18px; box-shadow: inset 0 0 0 1px var(--sw-border); }
      .shafts { display: flex; gap: 6px; min-block-size: 0; }
      .shaft { position: relative; inline-size: 26px; display: flex; flex-direction: column; gap: 6px; }
      .shaft .hd { position: absolute; top: -24px; inset-inline-start: 50%; transform: translateX(-50%); color: var(--sw-text-3); }
      .shaft .hd .xi { inline-size: 15px; block-size: 15px; }
      .shaft .c { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; }
      .shaft .c.gnd { flex: none; block-size: 10px; }
      .shaft .c.in::before { content: ''; position: absolute; inset-inline-start: 50%; top: -4px; bottom: -4px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft[data-k='stairs'] .c.in::before { border-inline-start-style: dashed; }
      .shaft .c.gnd.in-g::before { content: ''; position: absolute; inset-inline-start: 50%; top: -16px; bottom: -16px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft[data-k='stairs'] .c.gnd.in-g::before { border-inline-start-style: dashed; }
      .shaft .c.top::before { top: 50%; }
      .shaft .c.bot::before { bottom: 50%; }
      .shaft .c.in::after { content: ''; position: absolute; inset-inline-start: 50%; top: 50%; inline-size: 8px; block-size: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--sw-surface); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .shaft .c.in.pend::after { box-shadow: inset 0 0 0 2px var(--sw-text-3); background: var(--sw-surface-2); }
      .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--sw-text-3); }
      .legend span { display: inline-flex; align-items: center; gap: 5px; }
      .legend i { inline-size: 10px; block-size: 10px; border-radius: 3px; background: var(--sw-border-strong); }
      .legend i.cold { background: var(--sw-cool); }
      .legend i.hot { background: var(--sw-heat); }
      .legend i.lit { background: var(--sw-lit); }
      .legend i.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-text-3); }
      .legend i.ln { inline-size: 14px; block-size: 0; border-radius: 0; border-block-start: 2px solid var(--sw-accent); background: none; }
      .legend i.ln.d { border-block-start-style: dashed; }
      .empty { display: grid; place-items: center; gap: 6px; padding: 24px; text-align: center; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
      /* density: the rows share the height, so fewer pixels per row as floors are added (no scrolling) */
      .stack[data-d='m'] .s { display: none; }
      .stack[data-d='m'] .deg { font-size: clamp(10px, calc((100cqh - 6px * var(--n, 10)) / var(--n, 10) * 0.6), 19px); min-inline-size: 54px; }
      .stack[data-d='s'] .row { gap: 10px; padding-inline: 10px; border-radius: 8px; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(110px, auto); }
      .stack[data-d='s'] .s { display: none; }
      .stack[data-d='s'] .t { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.55), 13px); font-weight: 600; line-height: 1; }
      .stack[data-d='s'] .deg { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.6), 14.5px); font-weight: 700; min-inline-size: 44px; }
      .stack[data-d='s'] .fac { block-size: calc(100% - 6px); padding: 2px; gap: 2px; border-radius: 4px; }
      .stack[data-d='s'] .fac i { border-radius: 2px; }
      .stack[data-d='s'] .val .chip { block-size: 20px; padding: 0 7px; font-size: 11.5px; gap: 3px; }
      .stack[data-d='s'] .val .chip .w, .stack[data-d='s'] .val .chip.lc { display: none; }
      .stack[data-d='s'] .row.sel { flex-grow: 2.2; }
      .stack[data-d='s'] .row.sel .t { font-size: clamp(9px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.8), 15px); font-weight: 700; }
      .stack[data-d='s'] .row.sel::after { inline-size: 9px; block-size: 9px; margin-block-start: -4.5px; inset-inline-start: -5px; }
      .stack[data-d='s'] .ground { margin-block: 2px; }
      /* entrance: fade only unless motion is allowed and the option is on */
      .stack[data-enter] .row { animation: xs-fade 160ms var(--sw-ease, ease) both; }
      @media (prefers-reduced-motion: no-preference) {
        .stack[data-enter='rise'] .row { animation: xs-rise 260ms var(--sw-ease, ease) both; animation-delay: calc(var(--i, 0) * var(--step, 20ms) * 0.4); }
      }
      @keyframes xs-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes xs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @media (max-width: 1100px) { .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; } .s { display: none; } }
      :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
    `,
  ];

  private pick(id: string) {
    this.dispatchEvent(new CustomEvent('xs-pick', { detail: { id }, bubbles: true, composed: true }));
  }
  private hover(id: string | null) {
    this.dispatchEvent(new CustomEvent('xs-hover', { detail: { id }, bubbles: true, composed: true }));
  }

  private rowHtml(f: FloorSignal, index: number) {
    const t = tempState(f, this.opts.temp_threshold);
    const fz = this.fire?.[f.id];
    const alarm = fz?.state === 'alarm';
    const sub = f.nodata ? html`${xi('offline')}${xt('noDataSince')}` : html`${xt('level', { n: ltrNum(f.level) })}${f.target !== null ? html`<span> · ${xt('target', { n: `${f.target.toFixed(1)}°` })}</span>` : nothing}`;
    const label = xt('floorLabel', { name: f.name, temp: f.nodata || f.temp === null ? xt('noTemp') : xt('degrees', { n: f.temp.toFixed(1) }), lit: f.lit === null ? xt('noData') : xt('litOf', { lit: f.lit, lights: f.lights ?? 0 }), alert: alarm ? `, ${xt('fireAlarm')} (${xt('fireDemo')})` : '' });
    const sel = this.selectedId === f.id;
    return html`<button class="row ${f.level < 0 ? 'below' : ''} ${sel ? 'sel' : ''} ${this.hoverId === f.id ? 'hl' : ''}" style="--i:${index}" data-xs-row=${f.id} aria-pressed=${sel} aria-label=${label}
        data-temp=${t ?? ''} ?data-off=${f.nodata} data-fire=${alarm ? 'alarm' : ''} @click=${() => this.pick(f.id)} @pointerenter=${(e: PointerEvent) => e.pointerType === 'mouse' && this.hover(f.id)} @pointerleave=${(e: PointerEvent) => e.pointerType === 'mouse' && this.hover(null)}>
      <span class="nm"><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span><span class="s">${sub}</span></span>
      ${panes(f, 10)}
      <span class="val">
        ${alarm ? html`<span class="chip hot" style="background:var(--sw-danger);color:#fff">${xi('flame')}<span class="w">${xt('fireAlarm')}</span></span>` : nothing}
        ${f.nodata ? html`<span class="chip off">${xi('offline')}<span class="w">${xt('noData')}</span></span>` : t === 'hot' ? html`<span class="chip hot">${xi('flame')}<span class="w">${xt('hot')}</span></span>` : t === 'cold' ? html`<span class="chip cold">${xi('snow')}<span class="w">${xt('cold')}</span></span>` : nothing}
        ${f.nodata ? nothing : html`<span class="chip ${f.lit ? 'warm' : ''} lc">${xi('light')}<b>${litText(f)}</b></span>`}
        ${deg(f)}
      </span>
    </button>`;
  }

  private shafts(fl: FloorSignal[]) {
    if (!this.opts.shafts || !this.links.length) return nothing;
    const hasBelow = fl.some((f) => f.level < 0) && fl.some((f) => f.level >= 0);
    return html`<div class="shafts" aria-hidden="true">${this.links.map((l) => {
      const idx = fl.map((f) => l.floors.includes(f.id));
      const first = idx.indexOf(true);
      const last = idx.lastIndexOf(true);
      let groundDone = false;
      const cells: TemplateResult[] = [];
      fl.forEach((f, i) => {
        if (hasBelow && f.level < 0 && !groundDone) {
          groundDone = true;
          cells.push(html`<span class="c gnd ${i > first && i <= last ? 'in-g' : ''}"></span>`);
        }
        const inn = i >= first && i <= last && idx[i];
        cells.push(html`<span class="c ${inn ? 'in' : ''} ${i === first ? 'top' : ''} ${i === last ? 'bot' : ''} ${l.pending?.includes(f.id) ? 'pend' : ''}"></span>`);
      });
      return html`<div class="shaft" data-k=${l.kind} title=${l.label}><span class="hd">${xi(l.kind === 'lift' ? 'lift' : 'stairs')}</span>${cells}</div>`;
    })}</div>`;
  }

  render() {
    const fl = this.floors;
    if (!fl.length) {
      return html`<section class="card" aria-label=${xt('sectionAria')}><div class="empty">${xi('section')}<b>${xt('sectionEmptyTitle')}</b><span>${xt('sectionEmptyBody')}</span></div></section>`;
    }
    const d = fl.length > 14 ? 's' : fl.length > 8 ? 'm' : 'l';
    let groundDone = false;
    const hasBelow = fl.some((f) => f.level < 0) && fl.some((f) => f.level >= 0);
    const rows: TemplateResult[] = [];
    fl.forEach((f, i) => {
      if (hasBelow && f.level < 0 && !groundDone) {
        groundDone = true;
        rows.push(html`<div class="ground"><span>${xt('ground')}</span></div>`);
      }
      rows.push(this.rowHtml(f, fl.length - i));
    });
    const hasShafts = this.opts.shafts && this.links.length > 0;
    return html`<section class="card" aria-label=${xt('sectionAria')} data-xsection>
      <div class="head"><h2>${xi('section')}${xt('sectionTitle')}</h2>${totalChips(fl, this.opts)}<slot name="tools"></slot></div>
      <div class="body ${hasShafts ? 'has-shafts' : ''}">
        <div class="stack" data-d=${d} data-enter=${this.opts.animate ? 'rise' : 'fade'} style="--step:${Math.min(30, Math.round(360 / Math.max(1, fl.length)))}ms;--n:${fl.length}">${rows}</div>
        ${this.shafts(fl)}
      </div>
      <div class="legend">
        <span><i class="cold"></i>${xt('cold')}</span><span><i class="hot"></i>${xt('hot')}</span><span><i class="lit"></i>${xt('lightsOn')}</span><span><i class="off"></i>${xt('noData')}</span>
        ${this.links.some((l) => l.kind === 'stairs') ? html`<span><i class="ln d"></i>${xt('stairs')}</span>` : nothing}${this.links.some((l) => l.kind === 'lift') ? html`<span><i class="ln"></i>${xt('lift')}</span>` : nothing}
      </div>
    </section>`;
  }
}

/** The compact building card of the phone (option B, and option A above 12 floors): mini facades per floor and the totals; a tap opens the sheet. */
@customElement('sw-xs-compact')
export class SwXsCompact extends LitElement {
  @property({ attribute: false }) floors: FloorSignal[] = [];
  @property({ attribute: false }) opts: XsOptions = { ...XS_DEFAULT };
  @property() selectedId: string | null = null;

  static styles = css`
    :host { display: block; }
    button { inline-size: 100%; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px 12px; border-radius: 16px; background: var(--sw-surface); box-shadow: var(--sw-shadow-1); border: 1px solid var(--sw-border); text-align: start; font: inherit; color: inherit; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; }
    button:active { transform: scale(var(--sw-press-scale, 0.98)); }
    b.tt { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 800; color: var(--sw-heading); }
    .xi { inline-size: 14px; block-size: 14px; flex: none; }
    .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-block-start: 6px; }
    .chip { display: inline-flex; align-items: center; gap: 4px; block-size: 24px; padding: 0 8px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 11.5px; white-space: nowrap; }
    .chip b { color: var(--sw-text); direction: ltr; unicode-bidi: isolate; }
    .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); }
    .chip.hot { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); }
    .chip.cold { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); }
    .chip.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); }
    .mb { display: flex; flex-direction: column; gap: 3px; inline-size: 132px; }
    .r { display: grid; grid-template-columns: 1fr auto; gap: 6px; align-items: center; block-size: var(--mh, 14px); padding: 0 6px; border-radius: 4px; background: var(--sw-surface-2); font-size: 10.5px; font-weight: 700; color: var(--sw-heading); direction: ltr; }
    .r.sel { background: var(--sw-accent); color: #fff; }
    .r[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 18%, var(--sw-surface)); }
    .r[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 18%, var(--sw-surface)); }
    .r[data-off] { background: repeating-linear-gradient(135deg, transparent 0 4px, var(--sw-border) 4px 5px), var(--sw-surface-2); }
    .fac { display: flex; gap: 1px; padding: 1px; block-size: 7px; inline-size: 34px; border-radius: 2px; background: var(--sw-border); }
    .fac i { flex: 1 1 0; background: var(--sw-surface-2); border-radius: 1px; }
    .fac i.on { background: var(--sw-lit); }
    .gnd { block-size: 2px; background: var(--sw-border-strong); border-radius: 2px; margin: 0 2px; }
    :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
  `;

  render() {
    const fl = this.floors;
    if (!fl.length) return nothing;
    const show = fl.slice(0, 8);
    const mh = Math.max(7, Math.min(16, Math.floor(76 / show.length) - 3));
    const hasBelow = fl.some((f) => f.level < 0) && fl.some((f) => f.level >= 0);
    let g = false;
    const rows: TemplateResult[] = [];
    for (const f of show) {
      if (hasBelow && f.level < 0 && !g) {
        g = true;
        rows.push(html`<i class="gnd"></i>`);
      }
      const t = tempState(f, this.opts.temp_threshold);
      rows.push(html`<span class="r ${this.selectedId === f.id ? 'sel' : ''}" data-temp=${t ?? ''} ?data-off=${f.nodata}>${mh >= 12 ? panes(f, 4) : html`<span></span>`}<span>${mh >= 11 ? (f.nodata || f.temp === null ? '-' : `${f.temp.toFixed(1)}°`) : ''}</span></span>`);
    }
    return html`<button data-xs-compact aria-label=${xt('sectionTitle')} @click=${() => this.dispatchEvent(new CustomEvent('xs-open-sheet', { bubbles: true, composed: true }))}>
      <span><b class="tt">${xi('section')}${xt('sectionTitle')}</b>${totalChips(fl, this.opts)}</span>
      <span class="mb" style="--mh:${mh}px">${rows}${fl.length > show.length ? html`<span class="r"><span>+${fl.length - show.length}</span><span></span></span>` : nothing}</span>
    </button>`;
  }
}

/** The tile's styles, included by the host that draws tiles beside its cards (explore-floors). */
export const xsTileStyles = css`
  .xtile { inline-size: 54px; flex: none; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); padding: 0; font: inherit; color: var(--sw-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; min-block-size: 44px; }
  .xtile:active { transform: scale(var(--sw-press-scale, 0.98)); }
  .xtile .tv { font-size: 11.5px; font-weight: 600; color: var(--sw-text-2); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .xtile[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); }
  .xtile[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); }
  .xtile[data-off] { background: repeating-linear-gradient(135deg, transparent 0 5px, var(--sw-border) 5px 6px), var(--sw-surface-2); }
  .xtile[aria-pressed='true'] { background: var(--sw-accent); color: #fff; }
  .xtile[aria-pressed='true'] .tv { color: #fff; }
  .xtile .fac { block-size: 9px; inline-size: 26px; display: flex; gap: 1.5px; padding: 1.5px; border-radius: 3px; background: var(--sw-border); }
  .xtile .fac i { flex: 1 1 0; background: var(--sw-surface-2); border-radius: 1px; }
  .xtile .fac i.on { background: var(--sw-lit); }
  .xtile[aria-pressed='true'] .fac { background: rgba(255, 255, 255, 0.35); }
`;

declare global {
  interface HTMLElementTagNameMap {
    'sw-xsection': SwXSection;
    'sw-xs-compact': SwXsCompact;
  }
}
