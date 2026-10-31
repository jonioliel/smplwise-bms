import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { bidi, ltrNum } from '../i18n/bidi';
import { xt, type XtKey } from '../i18n/xsection';
import { xi } from './xs-icons';
import { tempState, totalsOf, XS_DEFAULT, type FloorHow, type FloorMatchInfo, type FloorSignal, type XsOptions } from './xs-model';

/** A stairs or a lift that links floors: the floors it reaches (ids, top to bottom as drawn) and those whose twin is not published yet. */
export interface SectionLink { kind: 'stairs' | 'lift'; label: string; floors: string[]; pending?: string[] }

/** SYNOPTIC-HA-2310: where the host's floor card of each floor sits (px from the top of the host's card column), so the rows line up. */
export interface RowBox { id: string; top: number; height: number }

const deg = (f: FloorSignal) => (f.nodata || f.temp === null ? html`<span class="deg none">-</span>` : html`<span class="deg">${f.temp.toFixed(1)}<small>°</small></span>`);
const litText = (f: FloorSignal) => (f.lit === null || f.lights === null ? '-' : `${f.lit}/${f.lights}`);

export const HOW_KEY: Record<FloorHow | 'map', XtKey> = { link: 'matchLink', map: 'matchMap', level: 'matchLevel', name: 'matchName' };

/** SYNOPTIC-HA-2310: one line that says which home-system floor a floor stands for and how; `linked` false = the hint asks for a link. */
export function matchLine(m: FloorMatchInfo | null | undefined): { text: string; linked: boolean } | null {
  if (!m) return null;
  if (m.how && m.haFloors.length) return { text: xt('matchOf', { floor: m.haFloors.map((h) => h.name).join(', '), how: xt(HOW_KEY[m.how]) }), linked: true };
  if (m.areas.length) return { text: m.areas.every((a) => a.source === 'map') ? xt('matchMap') : xt('matchManual'), linked: true };
  if (m.suggestion) return { text: xt('matchSuggest', { floor: m.suggestion.haFloorName, how: xt(HOW_KEY[m.suggestion.why]) }), linked: false };
  return { text: m.ambiguous ? xt('matchAmbiguous') : xt('matchNone'), linked: false };
}

/** The floors that no rule links to the home system (none when there is no tree: nothing to say then). */
export const unlinkedFloors = (fl: FloorSignal[]) => fl.filter((f) => matchLine(f.match)?.linked === false);

/** The little facade: k windows, the lit share filled. Only for a floor with data (a floor without data draws no placeholder). */
export function panes(f: Pick<FloorSignal, 'lit' | 'lights'>, k: number): TemplateResult {
  const on = f.lights ? Math.round(((f.lit ?? 0) / f.lights) * k) : 0;
  return html`<span class="fac" aria-hidden="true">${Array.from({ length: k }, (_, i) => html`<i class=${i < on ? 'on' : ''}></i>`)}</span>`;
}

/** The phone tile beside a floor card (option A): level, degrees and 3 windows. A button: it selects like the card. */
export function xsTile(f: FloorSignal, o: XsOptions, selected: boolean, pick: () => void): TemplateResult {
  const t = tempState(f, o.temp_threshold);
  const short = f.level === 0 ? xt('ground').slice(0, 1) : f.level > 0 ? String(f.level) : `‎${f.level}`;
  return html`<button class="xtile" data-xs-tile=${f.id} aria-pressed=${selected} aria-label=${xt('tileFor', { name: f.name })} data-temp=${t ?? ''} ?data-off=${f.nodata} @click=${pick}>
    <span class="lv">${short}</span><span class="tv">${f.nodata || f.temp === null ? '-' : `${f.temp.toFixed(1)}°`}</span>${f.nodata ? nothing : panes(f, 3)}
  </button>`;
}

/** The chips of the section head and the compact card: the whole building, with the unknown left out in words. */
export function totalChips(fl: FloorSignal[], o: XsOptions, withNoData = true): TemplateResult {
  const t = totalsOf(fl, o.temp_threshold);
  return html`<span class="chips">
    ${t.avg !== null ? html`<span class="chip">${xi('therm')}${xt('avgTemp')} <b>${t.avg.toFixed(1)}°</b></span>` : nothing}
    ${t.litKnown ? html`<span class="chip warm">${xi('light')}<b>${t.lit}/${t.lights}</b> ${xt('lightsOn')}</span>` : nothing}
    ${t.hot ? html`<span class="chip hot">${xi('flame')}${xt('hotCount', { n: t.hot })}</span>` : nothing}
    ${t.cold ? html`<span class="chip cold">${xi('snow')}${xt('coldCount', { n: t.cold })}</span>` : nothing}
    ${withNoData && t.nodata ? html`<span class="chip off">${xi('offline')}${xt('noDataCount', { n: t.nodata })}</span>` : nothing}
  </span>`;
}

/**
 * The building cross-section (release 2.29.0, mock-up v3; SYNOPTIC-HA-2310 layout): the floors one above the other, top to bottom, each a
 * row with its name, the home-system floor it stands for, a small facade (lit windows), the state in a word + icon and the temperature.
 * Stairs (dashed) and lifts (solid) run beside the rows. A click on a row fires `xs-pick` ({ id }); the "link" hint fires `xs-link` ({ id }).
 * With `rowBoxes` (the floors screen beside its cards) every row takes its card's top and height, so a card and its row read as one line;
 * otherwise (the phone sheet, two card columns, "near") the rows fill the panel top-down and share its height. Never a scroll.
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
  /** The host's card boxes (same floors, same order); null = rows fill the panel on their own. */
  @property({ attribute: false }) rowBoxes: RowBox[] | null = null;
  /** The height of the host's card column (the rows area in the aligned layout). */
  @property({ type: Number }) boxesHeight = 0;
  /** May the viewer edit the floors' home-system link? (the hint offers the link only then) */
  @property({ type: Boolean }) canLink = false;

  static styles = [
    css`
      :host { display: block; min-inline-size: 0; min-block-size: 0; block-size: 100%; }
      .card { block-size: 100%; min-block-size: 0; box-sizing: border-box; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; gap: 12px; padding: 16px 18px 14px; background: var(--sw-surface); border-radius: var(--sw-r-lg); box-shadow: var(--sw-shadow-1); border: 1px solid var(--sw-border); }
      :host([sheet]) .card { box-shadow: none; border: 0; padding: 4px 2px 0; }
      /* aligned beside the floor cards: no panel chrome - the rows are wells like the cards, so a card and its row read as one table line */
      .card.aligned { grid-template-rows: auto auto; align-content: start; gap: 14px; padding: 0; background: none; border: 0; box-shadow: none; border-radius: 0; }
      .head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-inline-size: 0; }
      h2 { margin: 0; display: flex; align-items: center; gap: 8px; font-size: var(--sw-fs-xl); font-weight: var(--sw-fw-bold); letter-spacing: -0.02em; color: var(--sw-heading); white-space: nowrap; }
      h2 .xi { inline-size: 20px; block-size: 20px; color: var(--sw-text-3); }
      .aligned h2 { font-size: var(--sw-fs-md); }
      .aligned h2 .xi { inline-size: 16px; block-size: 16px; }
      .foot { display: flex; flex-direction: column; gap: 10px; min-inline-size: 0; }
      .chips { display: inline-flex; gap: 6px; flex-wrap: wrap; min-inline-size: 0; }
      .chip { display: inline-flex; align-items: center; gap: 5px; block-size: 28px; padding: 0 10px; border-radius: 999px; background: var(--sw-surface-2); color: var(--sw-text-2); font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .chip b { color: var(--sw-text); font-weight: var(--sw-fw-bold); direction: ltr; unicode-bidi: isolate; }
      .xi { inline-size: 14px; block-size: 14px; flex: none; }
      .chip.warm { background: color-mix(in srgb, var(--sw-lit) 26%, var(--sw-surface)); color: var(--sw-text); }
      .chip.hot { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.cold { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); color: var(--sw-text); }
      .chip.off { background: transparent; box-shadow: inset 0 0 0 1px var(--sw-border-strong); color: var(--sw-text-3); }
      /* white on --sw-danger is 3.8:1; the darker mix is 5.3:1 (ui-ux-pro-max contrast pass) */
      .chip.alarm { background: color-mix(in srgb, var(--sw-danger) 80%, #000); color: #fff; font-weight: var(--sw-fw-bold); }
      .hint { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: var(--sw-fs-sm); color: var(--sw-text-2); min-inline-size: 0; }
      .hint .xi { color: var(--sw-text-3); }
      .hint span { min-inline-size: 0; overflow-wrap: anywhere; }
      .lnk { font: inherit; font-weight: var(--sw-fw-semibold); color: var(--sw-accent-text, var(--sw-accent)); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; white-space: nowrap; }
      .body { min-block-size: 0; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; }
      .stack { container-type: size; position: relative; min-block-size: 0; display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; }
      .stack.abs { display: block; container-type: normal; }
      .stack.abs > .row, .stack.abs > .ground { position: absolute; inset-inline: 0; box-sizing: border-box; }
      .row, .xtile { user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
      .row { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr) minmax(150px, auto); align-items: center; gap: 14px; padding: 0 14px; border: 2px solid transparent; border-radius: 12px; background: var(--sw-surface-2); text-align: start; color: inherit; font: inherit; cursor: pointer; overflow: hidden; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), border-color var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
      .stack.abs > .row { max-block-size: none; }
      .row:active { transform: scale(var(--sw-press-scale, 0.98)); }
      @media (hover: hover) and (pointer: fine) { .row:hover:not(.sel), .row.hl:not(.sel) { background: var(--sw-surface-3); } }
      .nm { min-inline-size: 0; display: flex; flex-direction: column; justify-content: center; gap: 2px; }
      .t { font-size: var(--sw-fs-md); font-weight: var(--sw-fw-bold); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .s { font-size: 12.5px; color: var(--sw-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .s.warn { color: var(--sw-text-3); }
      .fac { position: relative; align-self: center; block-size: min(calc(100% - 20px), 36px); display: flex; align-items: stretch; gap: 3px; padding: 3px; border-radius: 7px; background: var(--sw-border); }
      .fac i { flex: 1 1 0; min-inline-size: 3px; border-radius: 3px; background: var(--sw-surface-2); }
      .fac i.on { background: color-mix(in srgb, var(--sw-lit) 82%, var(--sw-surface)); }
      .quiet { justify-self: start; font-size: 12.5px; color: var(--sw-text-3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-inline-size: 0; }
      .val { min-inline-size: 0; display: flex; align-items: center; gap: 8px; justify-content: flex-end; }
      .val .chip { block-size: 26px; }
      .deg { min-inline-size: 64px; text-align: end; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: var(--sw-heading); line-height: 1; direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
      .deg small { font-size: 0.6em; font-weight: 700; color: var(--sw-text-3); }
      .deg.none { color: var(--sw-text-3); }
      .row[data-temp='hot'] .deg { color: color-mix(in srgb, var(--sw-heat) 62%, var(--sw-heading)); }
      .row[data-temp='cold'] .deg { color: color-mix(in srgb, var(--sw-cool) 62%, var(--sw-heading)); }
      .row[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 12%, var(--sw-surface-2)); }
      .row[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 12%, var(--sw-surface-2)); }
      /* no data: the same well, said once in muted words - no stripes, no extra edge, no empty facade */
      .row[data-off] .t { color: var(--sw-text-2); }
      .row[data-fire='alarm'] { background: color-mix(in srgb, var(--sw-danger) 14%, var(--sw-surface)); border-color: var(--sw-danger); }
      .row.below:not([data-temp]):not([data-fire]):not(.sel) { background: color-mix(in srgb, var(--sw-surface-2) 70%, var(--sw-surface-3)); }
      .row.sel { background: var(--sw-accent-soft); border-color: var(--sw-accent); }
      .row.sel .t { color: var(--sw-accent-text, var(--sw-heading)); }
      .row.sel[data-fire='alarm'] { box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--sw-danger) 45%, transparent); }
      .ground { position: relative; flex: none; block-size: 2px; margin: 2px 6px; border-radius: 2px; background: var(--sw-border-strong); }
      .stack.abs > .ground { margin: 0; inset-inline: 6px; }
      .shafts { display: flex; gap: 6px; min-block-size: 0; }
      .shaft { position: relative; inline-size: 22px; display: flex; flex-direction: column; gap: 6px; }
      .shaft .c { position: relative; flex: 1 1 0; min-block-size: 0; max-block-size: 132px; }
      .shaft .c.gnd { flex: none; block-size: 6px; }
      .shaft .c.in::before { content: ''; position: absolute; inset-inline-start: 50%; top: -4px; bottom: -4px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft .c.mid::before { content: ''; position: absolute; inset-inline-start: 50%; top: -4px; bottom: -4px; border-inline-start: 2px solid var(--sw-accent); margin-inline-start: -1px; }
      .shaft[data-k='stairs'] .c::before { border-inline-start-style: dashed; }
      .shaft .c.top::before { top: 50%; }
      .shaft .c.bot::before { bottom: 50%; }
      .shaft .c.in::after { content: ''; position: absolute; inset-inline-start: 50%; top: 50%; inline-size: 8px; block-size: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--sw-surface); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .shaft .c.in.pend::after { box-shadow: inset 0 0 0 2px var(--sw-text-3); background: var(--sw-surface-2); }
      /* aligned: one line from the first served row to the last, a stop on each served row */
      .shaft.abs { display: block; }
      .shaft.abs .ln { position: absolute; inset-inline-start: 50%; margin-inline-start: -1px; border-inline-start: 2px solid var(--sw-accent); }
      .shaft.abs[data-k='stairs'] .ln { border-inline-start-style: dashed; }
      .shaft.abs .stop { position: absolute; inset-inline-start: 50%; inline-size: 8px; block-size: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: var(--sw-surface); box-shadow: inset 0 0 0 2px var(--sw-accent); }
      .shaft.abs .stop.pend { box-shadow: inset 0 0 0 2px var(--sw-text-3); background: var(--sw-surface-2); }
      .legend { display: flex; gap: 12px; flex-wrap: wrap; font-size: 12px; color: var(--sw-text-3); }
      .legend span { display: inline-flex; align-items: center; gap: 5px; }
      .legend i { inline-size: 10px; block-size: 10px; border-radius: 3px; background: var(--sw-border-strong); }
      .legend i.cold { background: var(--sw-cool); }
      .legend i.hot { background: var(--sw-heat); }
      .legend i.lit { background: var(--sw-lit); }
      .legend i.ln { inline-size: 14px; block-size: 0; border-radius: 0; border-block-start: 2px solid var(--sw-accent); background: none; }
      .legend i.ln.d { border-block-start-style: dashed; }
      .empty { display: grid; place-items: center; gap: 6px; padding: 24px; text-align: center; color: var(--sw-text-3); font-size: var(--sw-fs-sm); }
      /* density: by the row height (aligned) or the number of floors (filling) - fewer pixels, fewer words. Never a scroll. */
      .quiet { display: none; }
      /* roomy rows: the second line may take two lines (the home-system floor and how it was matched); a floor without data has no
         facade or values, so its words take the row */
      @media (min-width: 1101px) {
        .stack[data-d='l'] .s, .stack[data-d='l'] .t { white-space: normal; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; overflow-wrap: anywhere; }
        .stack[data-d='l'] .row { grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) minmax(150px, auto); }
        .stack[data-d='l'] .row[data-off]:not([data-fire='alarm']) .nm { grid-column: 1 / -1; }
      }
      .stack[data-d='m'] .s, .stack[data-d='s'] .s { display: none; }
      .stack[data-d='m'] .quiet, .stack[data-d='s'] .quiet { display: block; }
      .stack[data-d='m'] .deg { font-size: 19px; min-inline-size: 54px; }
      .stack[data-d='s'] .row { gap: 10px; padding-inline: 10px; grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr) minmax(110px, auto); }
      .stack[data-d='s'] .t { font-size: 13px; font-weight: 600; line-height: 1.1; }
      .stack[data-d='s'] .deg { font-size: 14.5px; font-weight: 700; min-inline-size: 44px; }
      .stack[data-d='s'] .fac { block-size: calc(100% - 8px); max-block-size: 22px; padding: 2px; gap: 2px; border-radius: 4px; }
      .stack[data-d='s'] .fac i { border-radius: 2px; }
      .stack[data-d='s'] .quiet { font-size: 11.5px; }
      .stack[data-d='s'] .val .chip { block-size: 20px; padding: 0 7px; font-size: 11.5px; gap: 3px; }
      .stack[data-d='s'] .val .chip .w, .stack[data-d='s'] .val .chip.lc { display: none; }
      .stack:not(.abs)[data-d='m'] .deg { font-size: clamp(10px, calc((100cqh - 6px * var(--n, 10)) / var(--n, 10) * 0.6), 19px); }
      .stack:not(.abs)[data-d='s'] .t { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.55), 13px); }
      .stack:not(.abs)[data-d='s'] .deg { font-size: clamp(8px, calc((100cqh - 6px * var(--n, 16)) / var(--n, 16) * 0.6), 14.5px); }
      .stack:not(.abs)[data-d='s'] .row { border-radius: 8px; }
      /* entrance: fade only unless motion is allowed and the option is on */
      .stack[data-enter] .row { animation: xs-fade 160ms var(--sw-ease, ease) backwards; }
      @media (prefers-reduced-motion: no-preference) {
        .stack[data-enter='rise'] .row { animation: xs-rise 260ms var(--sw-ease, ease) backwards; animation-delay: calc(var(--i, 0) * var(--step, 20ms) * 0.4); }
      }
      @keyframes xs-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes xs-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
      @media (max-width: 1100px) { .row { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto; gap: 10px; } .s { display: none; } .quiet { display: block; } }
      :focus-visible { outline: 2px solid var(--sw-focus, var(--sw-accent)); outline-offset: 2px; }
    `,
  ];

  private pick(id: string) {
    this.dispatchEvent(new CustomEvent('xs-pick', { detail: { id }, bubbles: true, composed: true }));
  }
  private hover(id: string | null) {
    this.dispatchEvent(new CustomEvent('xs-hover', { detail: { id }, bubbles: true, composed: true }));
  }
  private link(id: string) {
    this.dispatchEvent(new CustomEvent('xs-link', { detail: { id }, bubbles: true, composed: true }));
  }

  private rowHtml(f: FloorSignal, index: number, box: RowBox | null) {
    const t = tempState(f, this.opts.temp_threshold);
    const fz = this.fire?.[f.id];
    const alarm = fz?.state === 'alarm';
    const ml = matchLine(f.match);
    // the second line: the home-system floor and how it was matched (else the level), and the target; for a floor without data the
    // reason, once - the middle column says "no data" only when that line is hidden by the density
    const sub = f.nodata
      ? html`<span class="s warn">${ml ? ml.text : xt('noDataSince')}${ml?.linked ? ` · ${xt('noDataQuiet')}` : ''}</span>`
      : html`<span class="s">${ml ? ml.text : xt('level', { n: ltrNum(f.level) })}${f.target !== null ? ` · ${xt('target', { n: `${f.target.toFixed(1)}°` })}` : ''}</span>`;
    const label = xt('floorLabel', { name: f.name, temp: f.nodata || f.temp === null ? xt('noTemp') : xt('degrees', { n: f.temp.toFixed(1) }), lit: f.lit === null ? xt('noData') : xt('litOf', { lit: f.lit, lights: f.lights ?? 0 }), alert: alarm ? `, ${xt('fireAlarm')} (${xt('fireDemo')})` : '' }) + (ml ? ` · ${ml.text}` : '');
    const sel = this.selectedId === f.id;
    const radius = box ? (box.height >= 64 ? 'var(--sw-r-lg)' : box.height >= 40 ? 'var(--sw-r-md)' : 'var(--sw-r-sm)') : '';
    const style = `--i:${index}${box ? `;top:${box.top}px;block-size:${box.height}px;border-radius:${radius}` : ''}`;
    return html`<button class="row ${f.level < 0 ? 'below' : ''} ${sel ? 'sel' : ''} ${this.hoverId === f.id ? 'hl' : ''}" style=${style} data-xs-row=${f.id} aria-pressed=${sel} aria-label=${label}
        data-temp=${t ?? ''} ?data-off=${f.nodata} data-fire=${alarm ? 'alarm' : ''} @click=${() => this.pick(f.id)} @pointerenter=${(e: PointerEvent) => e.pointerType === 'mouse' && this.hover(f.id)} @pointerleave=${(e: PointerEvent) => e.pointerType === 'mouse' && this.hover(null)}>
      <span class="nm"><span class="t" dir="auto" title=${f.name}>${bidi(f.name)}</span>${sub}</span>
      ${f.nodata ? html`<span class="quiet" title=${ml?.text ?? ''}>${xt('noDataQuiet')}</span>` : panes(f, 10)}
      ${f.nodata && !alarm ? nothing : html`<span class="val">
        ${alarm ? html`<span class="chip alarm">${xi('flame')}<span class="w">${xt('fireAlarm')}</span></span>` : nothing}
        ${f.nodata ? nothing : t === 'hot' ? html`<span class="chip hot">${xi('flame')}<span class="w">${xt('hot')}</span></span>` : t === 'cold' ? html`<span class="chip cold">${xi('snow')}<span class="w">${xt('cold')}</span></span>` : nothing}
        ${f.nodata ? nothing : html`<span class="chip ${f.lit ? 'warm' : ''} lc">${xi('light')}<b>${litText(f)}</b></span>`}
        ${f.nodata ? nothing : deg(f)}
      </span>`}
    </button>`;
  }

  /** The links that reach at least two of the drawn floors (one floor alone is not a shaft: no lone dot). */
  private shaftLinks(fl: FloorSignal[]) {
    if (!this.opts.shafts) return [];
    return this.links.filter((l) => fl.filter((f) => l.floors.includes(f.id)).length >= 2);
  }

  private shafts(fl: FloorSignal[]) {
    const links = this.shaftLinks(fl);
    if (!links.length) return nothing;
    const hasBelow = fl.some((f) => f.level < 0) && fl.some((f) => f.level >= 0);
    return html`<div class="shafts" aria-hidden="true">${links.map((l) => {
      const idx = fl.map((f) => l.floors.includes(f.id));
      const first = idx.indexOf(true);
      const last = idx.lastIndexOf(true);
      let groundDone = false;
      const cells: TemplateResult[] = [];
      fl.forEach((f, i) => {
        if (hasBelow && f.level < 0 && !groundDone) {
          groundDone = true;
          cells.push(html`<span class="c gnd ${i > first && i <= last ? 'mid' : ''}"></span>`);
        }
        const inn = idx[i];
        const through = !inn && i > first && i < last;
        cells.push(html`<span class="c ${inn ? 'in' : through ? 'mid' : ''} ${i === first ? 'top' : ''} ${i === last ? 'bot' : ''} ${l.pending?.includes(f.id) ? 'pend' : ''}"></span>`);
      });
      return html`<div class="shaft" data-k=${l.kind} title=${l.label}>${cells}</div>`;
    })}</div>`;
  }

  private shaftsAligned(fl: FloorSignal[], boxes: Map<string, RowBox>) {
    const links = this.shaftLinks(fl);
    if (!links.length) return nothing;
    return html`<div class="shafts" aria-hidden="true">${links.map((l) => {
      const served = fl.filter((f) => l.floors.includes(f.id)).map((f) => ({ f, b: boxes.get(f.id)! }));
      const mid = (b: RowBox) => b.top + b.height / 2;
      const y0 = mid(served[0].b);
      const y1 = mid(served[served.length - 1].b);
      return html`<div class="shaft abs" data-k=${l.kind} title=${l.label}>
        <span class="ln" style=${`top:${y0}px;block-size:${y1 - y0}px`}></span>
        ${served.map(({ f, b }) => html`<span class="stop ${l.pending?.includes(f.id) ? 'pend' : ''}" style=${`top:${mid(b)}px`}></span>`)}
      </div>`;
    })}</div>`;
  }

  private legend(fl: FloorSignal[]) {
    const links = this.shaftLinks(fl);
    return html`<div class="legend">
      <span><i class="cold"></i>${xt('cold')}</span><span><i class="hot"></i>${xt('hot')}</span><span><i class="lit"></i>${xt('lightsOn')}</span>
      ${links.some((l) => l.kind === 'stairs') ? html`<span><i class="ln d"></i>${xt('stairs')}</span>` : nothing}${links.some((l) => l.kind === 'lift') ? html`<span><i class="ln"></i>${xt('lift')}</span>` : nothing}
    </div>`;
  }

  /** The floors without a home-system link, said once for the panel, with the way to fix it (only for a viewer who may edit floors). */
  private hint(fl: FloorSignal[]) {
    const un = unlinkedFloors(fl);
    if (!un.length) return nothing;
    const text = un.length === 1 ? xt('matchHintOne', { name: un[0].name }) : xt('matchHintMany', { n: un.length });
    return html`<div class="hint" data-xs-hint>${xi('offline')}<span>${text}</span>${this.canLink ? html`<button class="lnk" data-xs-link=${un[0].id} @click=${() => this.link(un[0].id)}>${xt('matchHintAction')}</button>` : nothing}</div>`;
  }

  render() {
    const fl = this.floors;
    if (!fl.length) {
      return html`<section class="card" aria-label=${xt('sectionAria')}><div class="empty">${xi('section')}<b>${xt('sectionEmptyTitle')}</b><span>${xt('sectionEmptyBody')}</span></div></section>`;
    }
    const hasBelow = fl.some((f) => f.level < 0) && fl.some((f) => f.level >= 0);
    const boxes = new Map((this.rowBoxes ?? []).map((b) => [b.id, b]));
    const aligned = !this.sheet && !!this.rowBoxes && this.boxesHeight > 0 && fl.every((f) => boxes.has(f.id));
    const enter = this.opts.animate ? 'rise' : 'fade';
    const step = `--step:${Math.min(30, Math.round(360 / Math.max(1, fl.length)))}ms;--n:${fl.length}`;
    const head = html`<div class="head"><h2>${xi('section')}${xt('sectionTitle')}</h2>${totalChips(fl, this.opts, false)}<slot name="tools"></slot></div>`;
    if (aligned) {
      const minH = Math.min(...fl.map((f) => boxes.get(f.id)!.height));
      const d = minH >= 64 ? 'l' : minH >= 40 ? 'm' : 's';
      const rows: TemplateResult[] = [];
      fl.forEach((f, i) => {
        const b = boxes.get(f.id)!;
        if (hasBelow && f.level < 0 && i > 0 && fl[i - 1].level >= 0) {
          const prev = boxes.get(fl[i - 1].id)!;
          rows.push(html`<div class="ground" aria-hidden="true" style=${`top:${Math.round((prev.top + prev.height + b.top) / 2) - 1}px`}></div>`);
        }
        rows.push(this.rowHtml(f, fl.length - i, b));
      });
      return html`<section class="card aligned" aria-label=${xt('sectionAria')} data-xsection data-xs-aligned>
        <div class="body">
          <div class="stack abs" data-d=${d} data-enter=${enter} style=${`${step};block-size:${this.boxesHeight}px`}>${rows}</div>
          ${this.shaftsAligned(fl, boxes)}
        </div>
        <div class="foot">${head}${this.hint(fl)}${this.legend(fl)}</div>
      </section>`;
    }
    const d = fl.length > 14 ? 's' : fl.length > 8 ? 'm' : 'l';
    let groundDone = false;
    const rows: TemplateResult[] = [];
    fl.forEach((f, i) => {
      if (hasBelow && f.level < 0 && !groundDone) {
        groundDone = true;
        rows.push(html`<div class="ground" aria-hidden="true"></div>`);
      }
      rows.push(this.rowHtml(f, fl.length - i, null));
    });
    return html`<section class="card" aria-label=${xt('sectionAria')} data-xsection>
      ${head}
      <div class="body">
        <div class="stack" data-d=${d} data-enter=${enter} style=${step}>${rows}</div>
        ${this.shafts(fl)}
      </div>
      <div class="foot">${this.hint(fl)}${this.legend(fl)}</div>
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
    button { transition: transform var(--sw-t-press, 100ms) var(--sw-ease, ease), box-shadow var(--sw-t-hover, 120ms) var(--sw-ease-color, ease); }
    button:active { transform: scale(var(--sw-press-scale, 0.98)); }
    @media (hover: hover) and (pointer: fine) { button:hover { box-shadow: var(--sw-shadow-2, var(--sw-shadow-1)); } }
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
    .r[data-off] { color: var(--sw-text-3); font-weight: 600; }
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
      rows.push(html`<span class="r ${this.selectedId === f.id ? 'sel' : ''}" data-temp=${t ?? ''} ?data-off=${f.nodata}>${mh >= 12 && !f.nodata ? panes(f, 4) : html`<span></span>`}<span>${mh >= 11 ? (f.nodata || f.temp === null ? '-' : `${f.temp.toFixed(1)}°`) : ''}</span></span>`);
    }
    return html`<button data-xs-compact aria-label=${xt('sectionTitle')} @click=${() => this.dispatchEvent(new CustomEvent('xs-open-sheet', { bubbles: true, composed: true }))}>
      <span><b class="tt">${xi('section')}${xt('sectionTitle')}</b>${totalChips(fl, this.opts)}</span>
      <span class="mb" style="--mh:${mh}px">${rows}${fl.length > show.length ? html`<span class="r"><span>+${fl.length - show.length}</span><span></span></span>` : nothing}</span>
    </button>`;
  }
}

/** The tile's styles, included by the host that draws tiles beside its cards (explore-floors). */
export const xsTileStyles = css`
  .xtile { inline-size: 54px; flex: none; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; border: 0; border-radius: var(--sw-r-md); background: var(--sw-surface-2); padding: 0; font: inherit; color: var(--sw-heading); font-size: 12.5px; font-weight: 700; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; user-select: none; min-block-size: 44px; transition: background var(--sw-t-hover, 120ms) var(--sw-ease-color, ease), transform var(--sw-t-press, 100ms) var(--sw-ease, ease); }
  .xtile:active { transform: scale(var(--sw-press-scale, 0.98)); }
  .xtile .tv { font-size: 12px; font-weight: 600; color: var(--sw-text-2); direction: ltr; unicode-bidi: isolate; font-variant-numeric: tabular-nums; }
  .xtile[data-temp='hot'] { background: color-mix(in srgb, var(--sw-heat) 16%, var(--sw-surface)); }
  .xtile[data-temp='cold'] { background: color-mix(in srgb, var(--sw-cool) 16%, var(--sw-surface)); }
  .xtile[data-off]:not([aria-pressed='true']) { color: var(--sw-text-3); }
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
