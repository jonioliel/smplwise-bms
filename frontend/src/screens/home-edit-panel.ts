import { LitElement, html, css, nothing, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';
import '../components/sw-icon';
import '../components/sw-button';
import { bidi } from '../i18n/bidi';
import {
  CALENDAR_FIELD_LABEL, CALENDAR_FIELDS, CLOCK_MODE_LABEL, CLOCK_MODES, DIRECTION_LABEL, DIRECTION_LETTER, DIRECTIONS, EXTRAS_MAX, FORECAST_LENS, forecastCount, HOME_TITLE_DEFAULT, HOME_TITLE_MAX, LABEL_MAX, moveId,
  moveWidget, PHONE_LAYOUT_LABEL, PHONE_LAYOUTS, previewData, widgetOn, widgetSize, QUICK_ACTION_LABEL, QUICK_ACTIONS, SIDE_LABEL, SIDES, SIZE_LABEL, SIZES, WEATHER_FIELD_LABEL, WEATHER_FIELDS, WEATHER_SOURCE_FIELDS, WIDGET_NAME,
  type CalendarField, type Direction, type ForecastLen, type PhoneLayout, type HomeCandidates, type HomeConfig, type HomeData, type HomeSettings, type QuickAction, type Side, type Size, type WeatherField, type WidgetId,
} from '../api/home';

/** One place of the panel to open: a widget's row (from a card's "הגדרות" button). */
export interface HomeEditFloor {
  id: string;
  name: string;
}

/** A sensor list for a `<select>`: the Jewish Calendar integration's first, the current value kept even if it left the list. */
function optionsOf(list: { entity_id: string; name: string }[], current: string, blank: string, suggestion?: { entity_id: string; name: string }): TemplateResult[] {
  const known = list.some((x) => x.entity_id === current);
  return [
    html`<option value="" ?selected=${!current}>${blank}</option>`,
    ...(suggestion && !current && list.some((x) => x.entity_id === suggestion.entity_id) ? [html`<option value=${suggestion.entity_id}>הצעה: ${suggestion.name} · ${suggestion.entity_id}</option>`] : []),
    ...(current && !known ? [html`<option value=${current} selected>${current}</option>`] : []),
    ...list.map((x) => html`<option value=${x.entity_id} ?selected=${x.entity_id === current}>${x.name} · ${x.entity_id}</option>`),
  ];
}

/**
 * The home screen's edit mode, next to the layout bar (owner decisions 2026-09-30): the title, the direction (a: control
 * centre, b: side panel, c: compact row) and the side of b's column, EVERY widget (on / off, size for this direction, heading,
 * order, and the entity that feeds each field) and the floor order. It edits a draft the screen owns (`draft`); every change
 * is one `home-draft` event carrying the whole new draft, and "שמור" of the layout bar saves it. The weather checklist lists
 * exactly the fields the chosen entity reports (`candidates`), the Jewish-calendar fields each take their own sensor with a
 * suggestion when the integration is installed, and nothing here reaches the network.
 */
@customElement('home-edit-panel')
export class HomeEditPanel extends LitElement {
  @property({ attribute: false }) draft!: HomeSettings;
  @property({ attribute: false }) candidates: HomeCandidates | null = null;
  @property({ attribute: false }) candidatesError = '';
  @property({ attribute: false }) baseData!: HomeData;
  @property({ attribute: false }) floors: HomeEditFloor[] = [];
  /** The widget whose settings are open (a card's "הגדרות" button sets it). */
  @property() open: WidgetId | '' = '';
  @state() private dragFloor = '';

  static styles = css`
    :host {
      display: block;
    }
    .home-edit {
      display: grid;
      grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr);
      gap: 12px 24px;
      padding: 12px 14px;
      border: 1px dashed var(--sw-border-strong);
      border-radius: var(--sw-r-md);
      background: var(--sw-surface);
      backdrop-filter: var(--sw-glass-blur, none);
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-inline-size: 0;
    }
    h3 {
      margin: 0;
      font-size: var(--sw-fs-xs);
      font-weight: var(--sw-fw-semibold);
      color: var(--sw-text-3);
      letter-spacing: 0.02em;
    }
    .f,
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
      min-inline-size: 0;
    }
    input[type='text'],
    select {
      box-sizing: border-box;
      min-block-size: 32px;
      max-inline-size: 100%;
      padding-inline: 8px;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
    }
    select:disabled {
      opacity: 0.5;
    }
    input:focus-visible,
    select:focus-visible,
    button:focus-visible {
      outline: 2px solid var(--sw-focus, var(--sw-accent));
      outline-offset: 2px;
    }
    .seg {
      display: inline-flex;
      align-self: flex-start;
      border: 1px solid var(--sw-border-strong);
      border-radius: 8px;
      overflow: hidden;
      flex-wrap: wrap;
    }
    .seg button {
      border: 0;
      padding: 5px 12px;
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      cursor: pointer;
    }
    .seg button + button {
      border-inline-start: 1px solid var(--sw-border-strong);
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-accent);
      color: var(--sw-on-accent, #fff);
    }
    .seg button:disabled {
      opacity: 0.45;
      cursor: default;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 12px 16px;
      flex-wrap: wrap;
    }
    .check {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text);
    }
    /* a widget's row */
    .w {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: 10px;
      background: var(--sw-surface-2);
    }
    .w.off {
      opacity: 0.7;
    }
    .w-top {
      display: flex;
      align-items: center;
      gap: 8px 12px;
      flex-wrap: wrap;
    }
    .w-phone {
      display: flex;
      align-items: center;
      gap: 6px 12px;
      flex-wrap: wrap;
      padding-block-start: 6px;
      border-block-start: 1px dashed var(--sw-border);
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-2);
    }
    .w-phone .pl {
      font-weight: var(--sw-fw-semibold);
      min-inline-size: 44px;
    }
    .w-phone select {
      min-block-size: 30px;
      max-inline-size: 100%;
    }
    .w-name {
      font-weight: var(--sw-fw-semibold);
      font-size: var(--sw-fs-sm);
      min-inline-size: 84px;
    }
    .w-top .grow {
      flex: 1;
    }
    .w-body {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 8px 12px;
      align-items: start;
      padding-block-start: 8px;
      border-block-start: 1px solid var(--sw-border);
    }
    .w-body > .wide {
      grid-column: 1 / -1;
    }
    .ib {
      display: inline-grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .ib:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .fields {
      display: flex;
      flex-wrap: wrap;
      gap: 6px 16px;
    }
    .frow {
      display: grid;
      grid-template-columns: minmax(110px, auto) minmax(0, 1fr);
      gap: 4px 8px;
      align-items: center;
    }
    .frow select {
      min-block-size: 28px;
      font-size: var(--sw-fs-xs);
    }
    .val {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-xs);
      direction: ltr;
      unicode-bidi: isolate;
    }
    .extra {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .err {
      color: var(--sw-danger);
      font-size: var(--sw-fs-xs);
    }
    ol {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .floor {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 8px;
      border: 1px solid var(--sw-border);
      border-radius: 8px;
      background: var(--sw-surface-2);
    }
    .floor.dragging {
      opacity: 0.5;
    }
    .grip {
      color: var(--sw-text-3);
      cursor: grab;
      display: inline-flex;
    }
    .nm {
      flex: 1;
      min-inline-size: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--sw-fs-sm);
    }
    .floor button {
      display: inline-grid;
      place-items: center;
      inline-size: 28px;
      block-size: 28px;
      padding: 0;
      border: 1px solid var(--sw-border-strong);
      border-radius: 7px;
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
    }
    .floor button:disabled {
      opacity: 0.35;
      cursor: default;
    }
    @media (max-width: 899px) {
      .home-edit {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `;

  private change(patch: Partial<HomeSettings>) {
    this.dispatchEvent(new CustomEvent('home-draft', { detail: { ...this.draft, ...patch }, bubbles: true, composed: true }));
  }

  private setConfig(fn: (c: HomeConfig) => void) {
    const c = JSON.parse(JSON.stringify(this.draft.config)) as HomeConfig;
    fn(c);
    this.change({ config: c });
  }

  private setWidget<K extends WidgetId>(id: K, patch: Partial<HomeConfig[K]>) {
    this.setConfig((c) => Object.assign(c[id], patch));
  }

  /** The phone's own on / off: stored only when it differs from the desktop's (null = follow it). */
  private setPhoneOn(id: WidgetId, on: boolean) {
    this.setConfig((c) => (c[id].phone_on = on === c[id].on ? null : on));
  }

  private toggleOpen(id: WidgetId) {
    this.dispatchEvent(new CustomEvent('home-edit-open', { detail: { id: this.open === id ? '' : id }, bubbles: true, composed: true }));
  }

  private moveW(id: WidgetId, to: number) {
    this.setConfig((c) => (c.order = moveWidget(c.order, id, to)));
    // the draft is re-rendered by the screen: focus the same row's button (or the other one at an end) once that is done
    void this.updateComplete.then(() => requestAnimationFrame(() => this.renderRoot.querySelector<HTMLElement>(`[data-home-wrow="${id}"] [data-home-wmove]:not([disabled])`)?.focus()));
  }

  // ------------------------------------------------------------------------------------------------ render

  private get view(): HomeData {
    return previewData(this.draft.config, this.baseData, this.candidates);
  }

  render() {
    const d = this.draft;
    if (!d) return nothing;
    const ids = this.floors.map((f) => f.id);
    return html`<section class="home-edit" data-home-edit aria-label="הגדרות המסך הראשי">
      <div class="col">
        <label class="f" data-home-title-field>כותרת המסך
          <input type="text" data-home-title maxlength=${HOME_TITLE_MAX} .value=${d.title} placeholder=${HOME_TITLE_DEFAULT} @input=${(e: Event) => this.change({ title: (e.target as HTMLInputElement).value })} />
        </label>
        <div class="row">
          <div class="lbl" id="he-dir">כיוון
            <span class="seg" role="group" aria-labelledby="he-dir" data-home-directions>
              ${DIRECTIONS.map((x: Direction) => html`<button type="button" data-home-direction=${x} aria-pressed=${String(d.direction === x)} @click=${() => this.change({ direction: x })}>${DIRECTION_LETTER[x]} · ${DIRECTION_LABEL[x]}</button>`)}
            </span>
          </div>
          ${d.direction === 'b'
            ? html`<div class="lbl" id="he-side">צד הלוח
                <span class="seg" role="group" aria-labelledby="he-side">${SIDES.map((s: Side) => html`<button type="button" data-home-side=${s} aria-pressed=${String(d.side === s)} @click=${() => this.change({ side: s })}>${SIDE_LABEL[s]}</button>`)}</span>
              </div>`
            : nothing}
        </div>
        <div class="lbl" id="he-phone">בנייד: איך הווידג׳טים מוצגים
          <span class="seg" role="group" aria-labelledby="he-phone" data-home-phone-layouts>
            ${PHONE_LAYOUTS.map((p: PhoneLayout) => html`<button type="button" data-home-phone-layout=${p} aria-pressed=${String(d.config.phone_layout === p)} @click=${() => this.setConfig((c) => (c.phone_layout = p))}>${PHONE_LAYOUT_LABEL[p]}</button>`)}
          </span>
        </div>
        <h3>ווידג׳טים</h3>
        ${repeat(d.config.order, (id) => id, (id, i) => this.widgetRow(id, i))}
        ${this.candidatesError ? html`<div class="err" role="alert">${this.candidatesError}</div>` : nothing}
      </div>
      <div class="col" data-home-floors-col>
        <span class="lbl" id="he-floors-lbl">סדר הקומות</span>
        <ol data-home-floors aria-labelledby="he-floors-lbl">
          ${ids.map(
            (id, i) => html`<li class=${classMap({ floor: true, dragging: this.dragFloor === id })} data-home-floor=${id} draggable="true"
              @dragstart=${(e: DragEvent) => this.onFloorDrag(e, id)} @dragend=${() => (this.dragFloor = '')} @dragover=${(e: DragEvent) => this.dragFloor && e.preventDefault()} @drop=${(e: DragEvent) => this.onFloorDrop(e, ids, i)}>
              <span class="grip" aria-hidden="true"><sw-icon name="grip" size=${14}></sw-icon></span>
              <span class="nm">${bidi(this.floors[i].name)}</span>
              <button type="button" data-home-floor-up=${id} aria-label=${`העבר את ${this.floors[i].name} למעלה`} title="למעלה" ?disabled=${i === 0} @click=${() => this.moveFloor(ids, id, i - 1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
              <button type="button" data-home-floor-down=${id} aria-label=${`העבר את ${this.floors[i].name} למטה`} title="למטה" ?disabled=${i === ids.length - 1} @click=${() => this.moveFloor(ids, id, i + 1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
            </li>`,
          )}
        </ol>
        <sw-button size="sm" data-home-reset-widgets @click=${() => this.dispatchEvent(new CustomEvent('home-reset', { bubbles: true, composed: true }))}>אפס ווידג׳טים לברירת מחדל</sw-button>
      </div>
    </section>`;
  }

  private widgetRow(id: WidgetId, index: number) {
    const d = this.draft;
    const w = d.config[id];
    const open = this.open === id;
    const last = d.config.order.length - 1;
    return html`<div class=${classMap({ w: true, off: !w.on })} data-home-wrow=${id}>
      <div class="w-top">
        <label class="check"><input type="checkbox" data-home-toggle=${id} .checked=${w.on} @change=${(e: Event) => this.setWidget(id, { on: (e.target as HTMLInputElement).checked } as never)} aria-label=${`הצג ${WIDGET_NAME[id]}`} /><span class="w-name">${WIDGET_NAME[id]}</span></label>
        <span class="seg" role="group" aria-label=${`גודל: ${WIDGET_NAME[id]}`}>${SIZES.map((s: Size) => html`<button type="button" data-home-wsize=${`${id}:${s}`} aria-pressed=${String(w.sizes[d.direction] === s)} ?disabled=${!w.on} @click=${() => this.setConfig((c) => (c[id].sizes[d.direction] = s))}>${SIZE_LABEL[s]}</button>`)}</span>
        <span class="grow"></span>
        <button type="button" class="ib" data-home-wmove=${id} data-home-wearlier=${id} aria-label=${`הקדם את ${WIDGET_NAME[id]}`} title="הקדם" ?disabled=${index === 0} @click=${() => this.moveW(id, index - 1)}><sw-icon name="arrowUp" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wmove=${id} data-home-wlater=${id} aria-label=${`אחר את ${WIDGET_NAME[id]}`} title="אחר" ?disabled=${index === last} @click=${() => this.moveW(id, index + 1)}><sw-icon name="arrowDown" size=${13}></sw-icon></button>
        <button type="button" class="ib" data-home-wopen=${id} aria-expanded=${String(open)} aria-label=${`הגדרות: ${WIDGET_NAME[id]}`} title="הגדרות" @click=${() => this.toggleOpen(id)}><sw-icon name=${open ? 'chevronDown' : 'chevronBack'} size=${14}></sw-icon></button>
      </div>
      <div class="w-phone" data-home-wphone=${id}>
        <span class="pl">בנייד</span>
        <label class="check"><input type="checkbox" data-home-phone-on=${id} .checked=${widgetOn(w, true)} aria-label=${`הצג בנייד: ${WIDGET_NAME[id]}`} @change=${(e: Event) => this.setPhoneOn(id, (e.target as HTMLInputElement).checked)} />הצג</label>
        <select data-home-phone-size=${id} aria-label=${`גודל בנייד: ${WIDGET_NAME[id]}`} ?disabled=${!widgetOn(w, true)} @change=${(e: Event) => this.setWidget(id, { phone_size: ((e.target as HTMLSelectElement).value || null) as Size | null } as never)}>
          <option value="" ?selected=${!w.phone_size}>אוטומטי (${SIZE_LABEL[widgetSize({ ...w, phone_size: null }, d.direction, true)]})</option>
          ${SIZES.map((s: Size) => html`<option value=${s} ?selected=${w.phone_size === s}>${SIZE_LABEL[s]}</option>`)}
        </select>
      </div>
      ${open
        ? html`<div class="w-body" data-home-wbody=${id}>
            <label class="f">כותרת <input type="text" data-home-label=${id} maxlength=${LABEL_MAX} .value=${w.label} placeholder=${WIDGET_NAME[id]} @input=${(e: Event) => this.setWidget(id, { label: (e.target as HTMLInputElement).value } as never)} /></label>
            ${id === 'clock' ? this.clockBody() : id === 'weather' ? this.weatherBody() : id === 'shabbat' ? this.shabbatBody() : id === 'alarm' ? this.alarmBody() : this.quickBody()}
          </div>`
        : nothing}
    </div>`;
  }

  // ---- clock

  private clockBody() {
    const c = this.draft.config;
    const sensors = this.candidates?.sensors ?? [];
    const sug = this.suggestion('date');
    return html`<div class="f">תצוגה<span class="seg" role="group" aria-label="תצוגת השעון">${CLOCK_MODES.map((m) => html`<button type="button" data-home-clock-mode=${m} aria-pressed=${String(c.clock.mode === m)} @click=${() => this.setWidget('clock', { mode: m })}>${CLOCK_MODE_LABEL[m]}</button>`)}</span></div>
      <div class="f"><label class="check"><input type="checkbox" data-home-clock-seconds .checked=${c.clock.seconds} @change=${(e: Event) => this.setWidget('clock', { seconds: (e.target as HTMLInputElement).checked })} />עם שניות (בגודל גדול)</label>
        <label class="check"><input type="checkbox" data-home-clock-hebrew ?disabled=${c.clock.mode !== 'datetime'} .checked=${c.clock.hebrew} @change=${(e: Event) => this.setWidget('clock', { hebrew: (e.target as HTMLInputElement).checked })} />תאריך עברי</label></div>
      <label class="f wide">חיישן התאריך העברי<select data-home-cal="date" ?disabled=${!c.clock.hebrew} @change=${(e: Event) => this.setCal('date', (e.target as HTMLSelectElement).value)}>${optionsOf(sensors, c.calendar.date, 'לא נבחר: מחושב בדפדפן', sug)}</select></label>`;
  }

  // ---- weather

  private weatherBody() {
    const c = this.draft.config;
    const cfg = c.weather;
    const cands = this.candidates?.weather ?? [];
    const w = this.view.weather;
    const offers = (w?.offers ?? ['condition']) as WeatherField[];
    const sensors = this.candidates?.sensors ?? [];
    const check = (f: WeatherField) => html`<label class="check" data-home-wfield-row=${f}><input type="checkbox" data-home-wfield=${f} .checked=${cfg.fields.includes(f)} @change=${(e: Event) => this.toggleField(f, (e.target as HTMLInputElement).checked)} />${WEATHER_FIELD_LABEL[f]}${w?.values[f] ? html`<span class="val">${w.values[f]!.v}${w.values[f]!.unit ? ` ${w.values[f]!.unit}` : ''}</span>` : nothing}</label>`;
    const shown = WEATHER_FIELDS.filter((f) => offers.includes(f));
    const hasForecast = offers.includes('forecast');
    return html`<label class="f wide">ישות מזג האוויר
        <select data-home-weather-entity @change=${(e: Event) => this.pickWeather((e.target as HTMLSelectElement).value)}>${optionsOf(cands, cfg.entity, 'לא נבחר')}</select></label>
      ${cfg.entity && !w ? html`<div class="err wide" data-home-wx-missing>הישות לא נמצאה בקטלוג.</div>` : nothing}
      ${w && !w.available ? html`<div class="err wide" data-home-wx-unavailable>הישות לא זמינה כרגע: הווידג׳ט מוסתר עד שתחזור.</div>` : nothing}
      ${w
        ? html`<div class="f wide" data-home-wfields>מה להציג (רק מה שהישות מדווחת)
            <div class="fields">${shown.map(check)}</div></div>
          ${hasForecast
            ? html`<div class="f wide">אורך התחזית<span class="seg" role="group" aria-label="אורך התחזית">${FORECAST_LENS.map((l: ForecastLen) => html`<button type="button" data-home-forecast-len=${l} aria-pressed=${String(cfg.forecast === l)} ?disabled=${!cfg.fields.includes('forecast')} @click=${() => this.setWidget('weather', { forecast: l })}>${l === 'max' ? `מקסימום (${forecastCount(w.forecast_len, 'max')})` : `${l} (${forecastCount(w.forecast_len, l)})`}</button>`)}</span></div>`
            : nothing}
          <div class="f wide" data-home-wsources>מקור אחר לשדה (לא חובה)
            ${WEATHER_SOURCE_FIELDS.filter((f) => cfg.fields.includes(f)).map((f) => html`<div class="frow"><span>${WEATHER_FIELD_LABEL[f]}</span><select data-home-wsource=${f} @change=${(e: Event) => this.setSource(f, (e.target as HTMLSelectElement).value)}>${optionsOf(sensors, cfg.sources[f] ?? '', 'מישות מזג האוויר')}</select></div>`)}
          </div>`
        : nothing}`;
  }

  private toggleField(f: WeatherField, on: boolean) {
    this.setConfig((c) => {
      const cur = c.weather.fields.filter((x) => x !== f);
      c.weather.fields = on ? WEATHER_FIELDS.filter((x) => x === f || cur.includes(x)) : cur;
    });
  }

  /** Choosing another entity keeps the owner's field wishes (the card shows only what the entity offers, and a wish comes back
   * when an entity that offers it is chosen again); when none of them is offered by the new entity, the default set it can show. */
  private pickWeather(entity: string) {
    this.setConfig((c) => {
      c.weather.entity = entity;
      c.weather.sources = {};
      const cand = this.candidates?.weather.find((x) => x.entity_id === entity);
      const offers = (cand?.offers ?? []) as WeatherField[];
      if (entity && offers.length && !c.weather.fields.some((f) => offers.includes(f))) {
        c.weather.fields = (['temperature', 'condition', 'humidity', 'wind', 'forecast'] as WeatherField[]).filter((f) => offers.includes(f));
      }
    });
  }

  private setSource(f: WeatherField, id: string) {
    this.setConfig((c) => {
      if (id) c.weather.sources[f] = id;
      else delete c.weather.sources[f];
    });
  }

  // ---- shabbat

  private suggestion(f: CalendarField): { entity_id: string; name: string } | undefined {
    const id = this.candidates?.suggested_calendar?.[f];
    const s = id ? this.candidates?.sensors.find((x) => x.entity_id === id) : undefined;
    return s ? { entity_id: s.entity_id, name: s.name } : undefined;
  }

  private setCal(f: CalendarField, id: string) {
    this.setConfig((c) => (c.calendar[f] = id));
  }

  private suggestAll() {
    this.setConfig((c) => {
      for (const f of CALENDAR_FIELDS) if (!c.calendar[f] && this.candidates?.suggested_calendar?.[f]) c.calendar[f] = this.candidates.suggested_calendar[f]!;
    });
  }

  private shabbatBody() {
    const cal = this.draft.config.calendar;
    const sensors = this.candidates?.sensors ?? [];
    const groups = (current: string, blank: string, sug?: { entity_id: string; name: string }) => {
      const suggested = sensors.filter((s) => s.suggested);
      const others = sensors.filter((s) => !s.suggested);
      const opt = (x: { entity_id: string; name: string }) => html`<option value=${x.entity_id} ?selected=${x.entity_id === current}>${x.name} · ${x.entity_id}</option>`;
      return html`<option value="" ?selected=${!current}>${blank}</option>
        ${sug && !current ? html`<option value=${sug.entity_id}>הצעה: ${sug.name} · ${sug.entity_id}</option>` : nothing}
        ${current && !sensors.some((x) => x.entity_id === current) ? html`<option value=${current} selected>${current}</option>` : nothing}
        ${suggested.length ? html`<optgroup label="לוח שנה עברי">${suggested.map(opt)}</optgroup>` : nothing}
        <optgroup label="כל החיישנים">${others.map(opt)}</optgroup>`;
    };
    const hasSuggestions = CALENDAR_FIELDS.some((f) => !cal[f] && this.candidates?.suggested_calendar?.[f]);
    const fields = (['parsha', 'candles', 'havdalah', 'holiday'] as CalendarField[]).map(
      (f) => html`<label class="f">${CALENDAR_FIELD_LABEL[f]}<select data-home-cal=${f} @change=${(e: Event) => this.setCal(f, (e.target as HTMLSelectElement).value)}>${groups(cal[f], 'לא נבחר', this.suggestion(f))}</select></label>`,
    );
    return html`${fields}
      ${hasSuggestions ? html`<div class="wide"><sw-button size="sm" data-home-suggest @click=${() => this.suggestAll()}>מלא הצעות אוטומטיות</sw-button></div>` : nothing}
      <div class="f wide" data-home-extras>שדות נוספים (עד ${EXTRAS_MAX})
        ${cal.extras.map(
          (x, i) => html`<div class="extra" data-home-extra=${i}>
            <select aria-label="חיישן" data-home-extra-entity=${i} @change=${(e: Event) => this.setExtra(i, { entity_id: (e.target as HTMLSelectElement).value })}>${groups(x.entity_id, 'בחר חיישן')}</select>
            <input type="text" aria-label="כותרת" data-home-extra-label=${i} maxlength=${LABEL_MAX} .value=${x.label} placeholder="כותרת" @input=${(e: Event) => this.setExtra(i, { label: (e.target as HTMLInputElement).value })} />
            <button type="button" class="ib" data-home-extra-remove=${i} aria-label="הסר שדה" @click=${() => this.setConfig((c) => c.calendar.extras.splice(i, 1))}><sw-icon name="close" size=${13}></sw-icon></button>
          </div>`,
        )}
        ${cal.extras.length < EXTRAS_MAX ? html`<div><sw-button size="sm" icon="plus" data-home-extra-add @click=${() => this.setConfig((c) => c.calendar.extras.push({ entity_id: '', label: '' }))}>הוסף שדה</sw-button></div>` : nothing}
      </div>`;
  }

  private setExtra(i: number, patch: Partial<{ entity_id: string; label: string }>) {
    this.setConfig((c) => Object.assign(c.calendar.extras[i], patch));
  }

  // ---- alarm / quick

  private alarmBody() {
    const cfg = this.draft.config.alarm;
    const alarms = this.candidates?.alarms ?? [];
    return html`<label class="f">לוח האזעקה<select data-home-alarm-entity @change=${(e: Event) => this.setWidget('alarm', { entity: (e.target as HTMLSelectElement).value })}>${optionsOf(alarms, cfg.entity, 'אוטומטי: הדחוף ביותר')}</select></label>`;
  }

  private quickBody() {
    const cfg = this.draft.config.quick;
    return html`<div class="f wide">פעולות
      <div class="fields">${QUICK_ACTIONS.map((a: QuickAction) => html`<label class="check"><input type="checkbox" data-home-quick-action=${a} .checked=${cfg.actions.includes(a)} @change=${(e: Event) => this.toggleAction(a, (e.target as HTMLInputElement).checked)} />${QUICK_ACTION_LABEL[a]}</label>`)}</div></div>`;
  }

  private toggleAction(a: QuickAction, on: boolean) {
    this.setConfig((c) => (c.quick.actions = QUICK_ACTIONS.filter((x) => (x === a ? on : c.quick.actions.includes(x)))));
  }

  // ---- floors

  private moveFloor(ids: string[], id: string, to: number) {
    const up = to < ids.indexOf(id);
    this.change({ floorOrder: moveId(ids, id, to) });
    // keyboard users keep their place: focus stays on the same direction's button of the moved floor (or the other one at an end)
    void this.updateComplete.then(() =>
      requestAnimationFrame(() => {
        // (the screen re-renders the draft first, so the list is read one frame later)
        const root = this.renderRoot as ParentNode;
        const li = `[data-home-floor="${CSS.escape(id)}"]`;
        root.querySelector<HTMLButtonElement>(`${li} [data-home-floor-${up ? 'up' : 'down'}]:not([disabled])`)?.focus() ?? root.querySelector<HTMLButtonElement>(`${li} button:not([disabled])`)?.focus();
      }),
    );
  }

  private onFloorDrag(e: DragEvent, id: string) {
    this.dragFloor = id;
    e.dataTransfer?.setData('text/plain', id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }

  private onFloorDrop(e: DragEvent, ids: string[], index: number) {
    e.preventDefault();
    const id = this.dragFloor;
    this.dragFloor = '';
    if (id) this.change({ floorOrder: moveId(ids, id, index) });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'home-edit-panel': HomeEditPanel;
  }
}
