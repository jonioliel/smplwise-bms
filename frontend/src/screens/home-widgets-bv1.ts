import { html, css, nothing, svg, type TemplateResult } from 'lit';
import { classMap } from 'lit/directives/class-map.js';
import '../components/sw-icon';
import {
  AGENDA_SHOWN, agendaWhen, clockParts, forecastIsDaily, forecastLabel, forecastShown, hasValue, hebrewDate, QUICK_ACTION_LABEL, valueText, WEATHER_FIELD_LABEL, WEATHER_HE, weatherGlyph,
  type HomeConfig, type HomeData, type LaunchItemCfg, type WeatherField, type WeatherGlyph, type WidgetItem,
} from '../api/home-config';
import { idLabel, launchAllowed, launchIcon, launchRoute, runLaunch, type LaunchItem } from '../api/launcher';
import { bidi, ltrNum } from '../i18n/bidi';

/**
 * BV1 (2026-10-05): the new Bubble variants of the home widgets, kept apart from home-widgets.ts (which wires them in): the clock
 * and weather TILES (`style: tile`, Bubble only), the AGENDA tile (the next event of each chosen calendar) and the quick LAUNCHER
 * grid (round launch buttons), plus the surfaceless look of every widget (`surface: none`). Everything reads what the screen
 * already has (`config`, `data`, the clock); a launch button runs through api/launcher.ts (scenes / scripts: the same requests
 * the automations screen sends; routes navigate; a quick action goes through the screen's own bulk dialog via `home-quick`).
 */

/** What the renderers need from the host element. */
export interface Bv1Host {
  config: HomeConfig;
  data: HomeData;
  now: Date;
  zone: string;
  editing: boolean;
  bubble: boolean;
  quickAllowed: Partial<Record<string, boolean>>;
  /** The host's card shell (the section with the edit chrome). */
  shell(it: WidgetItem, cls: string, extra: Record<string, string>, body: TemplateResult): TemplateResult;
  head(it: WidgetItem, icon: TemplateResult, small?: string): TemplateResult;
  glyph(g: WeatherGlyph): TemplateResult;
  emit<T>(name: string, detail: T): void;
  /** The launch feedback (a short line under the grid for a few seconds). */
  launchNote: string;
  setLaunchNote(v: string): void;
}

export const CAL_ICON = svg`<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>`;
export const GRID_ICON = svg`<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>`;
const PIN = svg`<path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z"/><circle cx="12" cy="11" r="2.2"/>`;

/** The decorative hue of the weather tile by condition (never meaning: the text says the condition). */
export function weatherHue(cond: string): number {
  const g = weatherGlyph(cond);
  if (g === 'moon') return 7;
  if (g === 'rain' || g === 'storm') return 1;
  if (g === 'snow' || g === 'fog') return 8;
  if (g === 'cloud' || g === 'wind') return 4;
  return 6; // sun, partly: the warm hue
}

export const BV1_STYLES = css`
  /* ---- the tiles (Bubble, style: tile): a hue surface, a big glyph / number, the facts under it ---- */
  :host([data-skin='bubble']) .wg.tile {
    justify-content: flex-start;
    gap: 8px;
    padding: 16px 18px;
    background: var(--tile-bg, var(--sw-surface));
    color: var(--tile-fg, var(--sw-text));
  }
  :host([data-skin='bubble']) .wg.tile.hued {
    --tile-bg: var(--h);
    --tile-fg: var(--sw-ring-on-hue);
  }
  :host([data-skin='bubble']) .wg.tile :is(.wg-h, .wg-h small, .wg-h svg, .t-big, .t-sub, .t-facts, .t-facts b, .t-facts svg, .wx-fc, .wx-fc b, .wx-fc i, .wx-fc span, .wx-fc svg, .t-chip) {
    color: inherit;
  }
  :host([data-skin='bubble']) .wg.tile .wx-fc {
    border-color: rgba(255, 255, 255, 0.25);
  }
  /* only the clock / weather tiles are square (their content is fixed); the agenda grows with its rows */
  :host([layout='hero'][data-skin='bubble']) .wg.tile.sq:not([data-size='l']) {
    aspect-ratio: 1 / 1;
    flex-grow: 0;
  }
  :host([layout='side'][data-skin='bubble']) .wg.tile.sq:not([data-size='l']) {
    aspect-ratio: 4 / 3;
  }
  :host([layout='row'][data-skin='bubble']) .wg.tile {
    flex-direction: row;
    align-items: center;
    gap: 14px;
  }
  .t-ic {
    inline-size: var(--tic, 48px);
    block-size: var(--tic, 48px);
    flex: none;
    stroke-width: 1.4;
  }
  .t-big {
    font-size: var(--tbig, 44px);
    font-weight: 300;
    letter-spacing: -0.03em;
    line-height: 1;
    direction: ltr;
    unicode-bidi: isolate;
    display: inline-block;
  }
  .t-big b {
    font-weight: 300;
    opacity: 0.55;
  }
  .t-sub {
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .t-main {
    display: flex;
    align-items: center;
    gap: 12px;
    min-inline-size: 0;
  }
  .t-main > div {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-inline-size: 0;
  }
  .t-facts {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: var(--sw-fs-sm);
    opacity: 0.92;
  }
  .t-facts span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
  }
  .t-facts b {
    font-weight: var(--sw-fw-semibold);
    direction: ltr;
    unicode-bidi: isolate;
  }
  .t-chip {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    min-block-size: 24px;
    padding: 0 10px;
    border-radius: var(--sw-r-pill);
    background: rgba(0, 0, 0, 0.14);
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    white-space: nowrap;
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wg.tile[data-size='s'] {
    --tic: 32px;
    --tbig: 30px;
    gap: 4px;
  }
  .wg.tile[data-size='l'] {
    --tic: 56px;
    --tbig: 56px;
  }
  /* ---- the agenda ---- */
  .ag {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-inline-size: 0;
  }
  .ag-ev {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 10px;
    align-items: start;
    min-inline-size: 0;
  }
  .ag-when {
    font-size: var(--sw-fs-sm);
    font-weight: var(--sw-fw-semibold);
    color: var(--sw-accent-text);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
    padding-block-start: 1px;
  }
  .ag-t {
    display: flex;
    flex-direction: column;
    min-inline-size: 0;
  }
  .ag-m {
    font-size: var(--sw-fs-base);
    font-weight: var(--sw-fw-semibold);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ag-x {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    display: inline-flex;
    align-items: center;
    gap: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-inline-size: 0;
  }
  .ag-x svg {
    inline-size: 12px;
    block-size: 12px;
    flex: none;
  }
  .ag-empty {
    font-size: var(--sw-fs-sm);
    color: var(--sw-text-3);
  }
  .ag-more {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    align-self: center; /* away from the tile's rounded corners */
  }
  :host([data-skin='bubble']) .wg-agenda {
    --h: var(--sw-hue-5);
  }
  :host([data-skin='bubble']) .wg-agenda .ag-when {
    color: var(--sw-accent-text);
  }
  :host([data-skin='bubble']) .wg-agenda .ag-ev {
    padding: 6px 10px;
    border-radius: var(--sw-r-md);
    background: var(--sw-layer);
  }
  :host([layout='row']) .wg-agenda .ag {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px 18px;
  }
  /* ---- the launcher grid: round buttons, icon above a short label ---- */
  .lg {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--lgc, 76px), 1fr));
    gap: 8px 6px;
    min-inline-size: 0;
  }
  .wg-launcher[data-size='s'] .lg {
    --lgc: 64px;
    --lgb: 44px;
  }
  .wg-launcher[data-size='l'] .lg {
    --lgc: 92px;
    --lgb: 60px;
  }
  .lb {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    min-inline-size: 0;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--sw-text);
    font: inherit;
    font-size: var(--sw-fs-xs);
    cursor: pointer;
  }
  .lb .lr {
    inline-size: var(--lgb, 52px);
    block-size: var(--lgb, 52px);
    min-inline-size: var(--sw-touch-desktop);
    min-block-size: var(--sw-touch-desktop);
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--sw-surface-2);
    border: 1px solid var(--sw-border-strong);
    color: var(--sw-accent);
    transition: transform var(--sw-t-fast) var(--sw-ease-thumb), background var(--sw-t-fast) var(--sw-ease);
  }
  .lb:hover .lr {
    background: var(--sw-surface-3);
  }
  .lb:active .lr {
    transform: scale(0.94);
  }
  .lb:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .lb.busy .lr {
    color: var(--sw-text-3);
  }
  .lb.done .lr {
    background: var(--sw-success-soft);
    color: var(--sw-success-text);
  }
  .lb.danger .lr {
    color: var(--sw-danger);
  }
  .lb:focus-visible {
    outline: none;
  }
  .lb:focus-visible .lr {
    outline: 2px solid var(--sw-focus, var(--sw-accent));
    outline-offset: 2px;
  }
  .lb .ll {
    max-inline-size: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }
  .wg-launcher[data-size='s'] .lb .ll {
    display: none;
  }
  .l-note {
    font-size: var(--sw-fs-xs);
    color: var(--sw-text-3);
    min-block-size: 1.2em;
  }
  .l-note.bad {
    color: var(--sw-danger-text);
  }
  :host([data-skin='bubble']) .lb .lr {
    border: 0;
    background: var(--sw-layer-2, var(--sw-surface-2));
    color: var(--sw-text);
  }
  :host([data-skin='bubble']) .lb.route .lr {
    background: var(--sw-accent);
    color: var(--sw-text-inverse);
  }
  :host([data-skin='bubble']) .lb.scene .lr {
    background: var(--h, var(--sw-hue-5));
    color: var(--sw-ring-on-hue);
  }
  :host([data-skin='bubble']) .lb.quick .lr {
    background: var(--sw-lit);
    color: var(--sw-on-lit);
  }
  :host([data-skin='bubble']) .lb.quick.danger .lr {
    background: var(--sw-danger-soft);
    color: var(--sw-danger-text);
  }
  :host([layout='row']) .wg-launcher .lg {
    display: flex;
    flex-wrap: wrap;
  }
  /* the hero band: the launcher takes a wider place (three to four columns of buttons), not a two-column tower that stretches the band */
  :host([layout='hero']) .wg-launcher[data-size='m'] {
    flex-basis: 330px;
    flex-grow: 1.6;
  }
  :host([layout='hero']) .wg-launcher[data-size='l'] {
    flex-basis: 420px;
    flex-grow: 2;
  }
  :host([layout='hero']) .wg-launcher .wg-b,
  :host([layout='side']) .wg-launcher .wg-b {
    justify-content: flex-start;
  }
  @media (max-width: 1100px) {
    .lb .lr {
      min-inline-size: 44px;
      min-block-size: 44px;
    }
    .wg-launcher:not([data-size='s']) .lb .lr {
      inline-size: 56px;
      block-size: 56px;
    }
  }
  /* ---- the surfaceless look (surface: none, Bubble): widgets and tiles have no fill - a hairline frame only ---- */
  :host([data-skin='bubble'][data-surface='none']) .wg:not(.ghost) {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    color: var(--sw-text);
  }
  :host([data-skin='bubble'][data-surface='none']) .wg.tile.hued {
    --tile-bg: transparent;
    --tile-fg: var(--sw-text);
  }
  :host([data-skin='bubble'][data-surface='none']) .wg.tile.hued .t-ic,
  :host([data-skin='bubble'][data-surface='none']) .wg.tile.hued .t-chip {
    color: var(--h);
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
  }
  :host([data-skin='bubble'][data-surface='none']) .wg.tile.hued .t-ic {
    box-shadow: none;
  }
  :host([data-skin='bubble'][data-surface='none']) .wg-agenda .ag-ev {
    background: transparent;
    box-shadow: inset 0 -1px 0 var(--sw-border-strong);
    border-radius: 0;
  }
  :host([data-skin='bubble'][data-surface='none']) .lb .lr {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
    color: var(--sw-text);
  }
  :host([data-skin='bubble'][data-surface='none']) .lb.route .lr {
    color: var(--sw-accent-text);
  }
  :host([data-skin='bubble'][data-surface='none']) .mchip,
  :host([data-skin='bubble'][data-surface='none']) .qbtn {
    background: transparent;
    box-shadow: inset 0 0 0 1px var(--sw-border-strong);
  }
  /* the glass surface: the tiles and the launcher ring are translucent layers like the pills */
  :host([data-skin='bubble'][data-surface='glass']) .wg:not(.ghost):not(.tile.hued) {
    background: var(--sw-perf-glass-bg, rgba(var(--sw-sheet-rgb), 0.42));
    -webkit-backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur-sheet));
    backdrop-filter: var(--sw-perf-blur, var(--sw-glass-blur-sheet));
    box-shadow: inset 0 1px 0 var(--sw-highlight), inset 0 0 0 1px var(--sw-border-strong);
  }
  @media (prefers-reduced-transparency: reduce) {
    :host([data-skin='bubble'][data-surface='glass']) .wg:not(.ghost):not(.tile.hued) {
      background: var(--sw-surface);
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .lb .lr {
      transition: none;
    }
  }
`;

// ------------------------------------------------------------------------------------------------ the tiles

/** The clock as a tile (Bubble): the time big, the date under it, the Hebrew date as a chip. */
export function renderClockTile(h: Bv1Host, it: WidgetItem, clockIcon: TemplateResult): TemplateResult {
  const c = h.config.clock;
  const p = clockParts(h.now, h.zone);
  const dated = c.mode === 'datetime';
  const sensor = h.config.calendar.date ? h.data.sensors[h.config.calendar.date] : undefined;
  const hebrew = c.hebrew && dated ? (h.config.calendar.date ? (hasValue(sensor) ? sensor.state : '') : hebrewDate(h.now, h.zone)) : '';
  return h.shell(it, 'wg-clock tile sq', {}, html`${h.head(it, clockIcon)}
    <div class="t-main"><div><span class="t-big" role="timer" aria-label="השעה עכשיו" data-home-time>${p.h}<b>:</b>${p.m}${c.seconds && it.size === 'l' ? html`<b class="ss"> ${p.s}</b>` : nothing}</span>
      ${dated ? html`<span class="t-sub"><span class="only-s">${p.weekdayShort} · ${p.dateShort}</span><span class="ge-m">${p.weekdayLong}, ${it.size === 'l' ? p.dateYear : p.dateLong}</span></span>` : nothing}</div></div>
    ${hebrew ? html`<span class="t-chip ge-m" data-home-hebrew-date>${hebrew}</span>` : nothing}`);
}

/** The weather as a tile (Bubble): the condition's hue, the glyph and the temperature big, the condition, two facts, the forecast at l. */
export function renderWeatherTile(h: Bv1Host, it: WidgetItem, fieldIcon: (f: WeatherField) => TemplateResult): TemplateResult {
  const w = h.data.weather!;
  const cfg = h.config.weather;
  const has = (f: WeatherField) => cfg.fields.includes(f);
  const cond = w.condition ?? '';
  const valueOf = (f: WeatherField) => {
    const src = cfg.sources[f];
    if (src) {
      const s = h.data.sensors[src];
      if (hasValue(s)) {
        const n = Number(s.state);
        return Number.isFinite(n) ? { v: n, unit: s.unit } : undefined;
      }
    }
    return w.values[f];
  };
  const temp = has('temperature') ? valueOf('temperature') : undefined;
  const facts = (['apparent', 'humidity', 'wind', 'pressure', 'visibility', 'uv', 'precipitation'] as WeatherField[]).filter(has).map((f) => ({ f, v: valueOf(f) })).filter((x) => x.v).slice(0, it.size === 'l' ? 4 : 2);
  const entries = has('forecast') && it.size === 'l' ? forecastShown(w.forecast, cfg.forecast) : [];
  const daily = forecastIsDaily(entries);
  const glyph = weatherGlyph(cond);
  return h.shell(it, 'wg-weather tile hued sq', { cond: glyph, style: `--h:var(--sw-hue-${weatherHue(cond)})` }, html`${h.head(it, h.glyph('partly'), w.name)}
    <div class="t-main"><svg class="t-ic" viewBox="0 0 24 24" aria-hidden="true">${h.glyph(glyph)}</svg>
      <div>${temp ? html`<span class="t-big" data-home-temp>${valueText('temperature', { v: temp.v, unit: temp.unit ?? null })}</span>` : nothing}
        ${has('condition') && cond ? html`<span class="t-sub" data-home-cond>${WEATHER_HE[cond] ?? cond}</span>` : nothing}</div></div>
    ${facts.length ? html`<div class="t-facts ge-m" data-home-facts>${facts.map(({ f, v }) => html`<span data-home-fact=${f}><svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${fieldIcon(f)}</svg>${WEATHER_FIELD_LABEL[f]} <b>${valueText(f, { v: v!.v, unit: v!.unit ?? null })}</b></span>`)}</div>` : nothing}
    ${entries.length ? html`<div class="wx-fc only-l" data-home-forecast style=${`--fcn:${entries.length}`} aria-label="תחזית לימים הקרובים">${entries.map((e) => html`<div class="fc" data-cond=${weatherGlyph(e.condition)}><span>${forecastLabel(e.datetime, h.zone, daily)}</span><svg viewBox="0 0 24 24" aria-hidden="true">${h.glyph(weatherGlyph(e.condition))}</svg>${e.temperature !== null ? html`<span class="hl"><b>${Math.round(e.temperature)}°</b>${e.templow !== undefined ? html`<i>${Math.round(e.templow)}°</i>` : nothing}</span>` : nothing}</div>`)}</div>` : nothing}`);
}

// ------------------------------------------------------------------------------------------------ the agenda

/** The agenda: the next events of the chosen calendars, `AGENDA_SHOWN[size]` of them; the empty state inside the card. */
export function renderAgenda(h: Bv1Host, it: WidgetItem): TemplateResult {
  const a = h.data.agenda;
  const events = a?.events ?? [];
  const shown = events.slice(0, AGENDA_SHOWN[it.size]);
  const rest = events.length - shown.length;
  const multi = (h.config.agenda.calendars.length > 1);
  const cls = h.bubble ? 'wg-agenda tile' : 'wg-agenda';
  return h.shell(it, cls, {}, html`${h.head(it, CAL_ICON, a && it.size !== 's' ? a.calendars.filter((c) => c.available).map((c) => c.name).join(' · ') : '')}
    <div class="ag" data-home-agenda>
      ${shown.length
        ? shown.map((e) => html`<div class="ag-ev" data-home-event=${e.calendar}>
            <span class="ag-when">${ltrNum(agendaWhen(e, h.now, h.zone))}</span>
            <span class="ag-t"><span class="ag-m" title=${e.message}>${bidi(e.message)}</span>
              ${(e.location || multi) && it.size !== 's' ? html`<span class="ag-x">${e.location ? html`<svg viewBox="0 0 24 24" aria-hidden="true">${PIN}</svg>${bidi(e.location)}` : nothing}${e.location && multi ? ' · ' : nothing}${multi ? bidi(e.calendar_name) : nothing}</span>` : nothing}</span>
          </div>`)
        : html`<span class="ag-empty" data-home-agenda-empty>אין אירועים קרובים</span>`}
      ${rest > 0 ? html`<span class="ag-more">${ltrNum(`+${rest}`)} נוספים</span>` : nothing}
    </div>`);
}

// ------------------------------------------------------------------------------------------------ the launcher

/** The label a launch button shows: the owner's own, else the route's name / the entity's known name / the action's name. */
export function launchLabel(item: LaunchItemCfg, names: Map<string, string>): string {
  if (item.label.trim()) return item.label.trim();
  if (item.kind === 'route') return launchRoute(item.id)?.label ?? item.id;
  if (item.kind === 'quick') return item.id === 'all_off' ? 'כבה הכל' : 'כבה תאורה';
  return names.get(item.id) ?? idLabel(item.id);
}

export interface LaunchState {
  busy: Set<string>;
  done: Set<string>;
}

/** The launcher grid: the items this user may press, as round buttons; a scene / script shows "הופעל" for a moment. */
export function renderLauncher(h: Bv1Host, it: WidgetItem, st: LaunchState, names: Map<string, string>, requestUpdate: () => void): TemplateResult {
  const items = h.config.launcher.items.filter((x) => launchAllowed(x as LaunchItem, h.quickAllowed));
  const key = (x: LaunchItemCfg) => `${x.kind}:${x.id}`;
  const press = async (x: LaunchItemCfg) => {
    if (h.editing || st.busy.has(key(x))) return;
    if (x.kind === 'quick') {
      h.emit('home-quick', { action: x.id });
      return;
    }
    if (x.kind === 'route') {
      void runLaunch(x as LaunchItem);
      return;
    }
    st.busy.add(key(x));
    h.setLaunchNote('');
    requestUpdate();
    try {
      await runLaunch(x as LaunchItem);
      st.done.add(key(x));
      h.setLaunchNote(x.kind === 'scene' ? 'הסצנה הופעלה' : 'הסקריפט הופעל');
      window.setTimeout(() => {
        st.done.delete(key(x));
        h.setLaunchNote('');
        requestUpdate();
      }, 2500);
    } catch (err) {
      h.setLaunchNote(`לא הופעל: ${(err as { user_message?: string; message?: string }).user_message ?? (err as Error).message ?? ''}`.trim());
      window.setTimeout(() => {
        h.setLaunchNote('');
        requestUpdate();
      }, 4000);
    } finally {
      st.busy.delete(key(x));
      requestUpdate();
    }
  };
  const btn = (x: LaunchItemCfg) => {
    const k = key(x);
    const label = launchLabel(x, names);
    const aria = x.kind === 'quick' ? QUICK_ACTION_LABEL[x.id as 'lights_off' | 'all_off'] ?? label : label;
    return html`<button type="button" class=${classMap({ lb: true, [x.kind]: true, busy: st.busy.has(k), done: st.done.has(k), danger: x.kind === 'quick' && x.id === 'all_off' })} data-home-launch=${k} aria-label=${aria} title=${aria} ?disabled=${h.editing || st.busy.has(k)} @click=${() => void press(x)}>
      <span class="lr"><sw-icon .name=${st.done.has(k) ? 'check' : launchIcon(x as LaunchItem)} size=${it.size === 's' ? 18 : 22}></sw-icon></span><span class="ll">${bidi(label)}</span>
    </button>`;
  };
  return h.shell(it, 'wg-launcher', {}, html`${h.head(it, GRID_ICON)}
    <div class="lg" data-home-launcher role="group" aria-label=${it.title}>${items.map(btn)}</div>
    ${h.launchNote ? html`<div class=${classMap({ 'l-note': true, bad: h.launchNote.startsWith('לא') })} role="status" data-home-launch-note>${h.launchNote}</div>` : nothing}`);
}
