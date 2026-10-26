import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-page';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import {
  putTransitSettings, refreshTransitCatalogue, searchTransitStops, transitCities, transitSettings, transitStatus, type CatalogueStop, type TransitSettings,
} from '../api/transit';
import { tr, type TrKey } from '../i18n/transit';
import { canAdd, clampInt, moveStop, stopsBody } from '../transit/model';
import { noticesCss } from '../notices/styles';

/**
 * BUSTIMES-295: הגדרות › תחבורה ציבורית (#/system/transit). The installation's part of the feature: the module switch, up to four stops
 * (found in the LOCAL catalogue by city, name or code - no outside call while configuring), the general rules (when minutes give way to a
 * clock time, how long last-known data may show, the walking time) and the source's health. What each SCREEN shows is chosen in that board's
 * תצוגה tab. Reading needs system.configure or notices.boards; every write needs system.configure (the server re-checks).
 */
@customElement('system-transit')
export class SystemTransit extends LitElement {
  static styles = [
    noticesCss,
    css`
      .stack { display: grid; gap: 14px; }
      .stop { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 0; border-block-end: 1px solid var(--sw-border); }
      .stop:last-child { border-block-end: 0; }
      .stop .code { font-size: var(--sw-fs-xs); color: var(--sw-text-3); }
      .stop .acts { display: flex; gap: 6px; }
      .res { display: grid; gap: 0; max-block-size: 320px; overflow: auto; border: 1px solid var(--sw-border); border-radius: var(--sw-r-md); }
      .res .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 12px; border-block-end: 1px solid var(--sw-border); }
      .res .row:last-child { border-block-end: 0; }
      .res .row b { display: block; font-weight: var(--sw-fw-medium); color: var(--sw-heading); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .res .row span { font-size: var(--sw-fs-xs); color: var(--sw-text-2); }
      .state { display: inline-flex; align-items: center; gap: 6px; }
      .alert { display: flex; gap: 8px; align-items: flex-start; margin-block-start: 8px; padding: 8px 10px; border-radius: var(--sw-r-md); background: var(--sw-warning-soft); color: var(--sw-warning-text); font-size: var(--sw-fs-sm); }
    `,
  ];

  @state() private s: TransitSettings | null = null;
  @state() private error = '';
  @state() private forbidden = false;
  @state() private toast = '';
  @state() private cities: string[] = [];
  @state() private city = '';
  @state() private q = '';
  @state() private code = '';
  @state() private results: CatalogueStop[] | null = null;
  @state() private busy = false;
  @state() private refreshing = false;
  private toastTimer = 0;
  private pollTimer = 0;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.toastTimer);
    clearInterval(this.pollTimer);
  }

  private say(msg: string): void {
    this.toast = msg;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast = ''), 2600);
  }

  private async load(): Promise<void> {
    this.error = '';
    try {
      this.s = await transitSettings();
      this.forbidden = false;
      void this.loadCities();
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) this.forbidden = true;
      else this.error = describeError(e);
    }
  }

  private async loadCities(): Promise<void> {
    try {
      this.cities = (await transitCities()).cities;
    } catch {
      this.cities = [];
    }
  }

  /** A change to the installation's settings: sent whole, the server's answer replaces the form. */
  private async save(body: Parameters<typeof putTransitSettings>[0], msg = tr('saved')): Promise<void> {
    this.busy = true;
    try {
      this.s = await putTransitSettings(body);
      this.say(msg);
    } catch (e) {
      this.say(describeError(e) || tr('saveError'));
    } finally {
      this.busy = false;
    }
  }

  private async runSearch(): Promise<void> {
    const q = this.code.trim() || this.q.trim();
    if (!this.city && !q) {
      this.results = [];
      return;
    }
    try {
      const r = await searchTransitStops(this.city, q);
      this.results = r.stops;
      if (this.s) this.s = { ...this.s, catalogue: r.catalogue };
    } catch (e) {
      this.say(describeError(e));
    }
  }

  private async addStop(stop: CatalogueStop): Promise<void> {
    const cfg = this.s!.config;
    const can = canAdd(cfg.stops, stop.code, this.s!.limits.max_stops);
    if (can === 'dup') return;
    if (can === 'full') return this.say(tr('limit'));
    await this.save({ stops: [...stopsBody(cfg.stops), { code: stop.code, name: '' }] }, tr('added'));
  }

  private async refreshCatalogue(): Promise<void> {
    this.refreshing = true;
    try {
      await refreshTransitCatalogue();
    } catch (e) {
      this.refreshing = false;
      return this.say(describeError(e));
    }
    clearInterval(this.pollTimer);
    this.pollTimer = window.setInterval(async () => {
      try {
        const r = await transitStatus();
        if (this.s) this.s = { ...this.s, catalogue: r.catalogue, health: r.health };
        const done = r.catalogue.ok_at !== this.s?.catalogue.ok_at || !!r.catalogue.error;
        if (done || r.catalogue.count > 0) {
          this.refreshing = false;
          clearInterval(this.pollTimer);
          void this.loadCities();
        }
      } catch {
        /* the next tick tries again */
      }
    }, 3000);
  }

  render() {
    if (this.forbidden) return html`<sw-page heading=${tr('title')}><sw-state-panel state="forbidden" heading=${tr('forbidden')} hint=${tr('forbiddenHint')}></sw-state-panel></sw-page>`;
    if (this.error && !this.s) return html`<sw-page heading=${tr('title')}><sw-state-panel state="error" heading=${tr('loadError')} hint=${this.error} actionLabel=${tr('retry')} @action=${() => this.load()}></sw-state-panel></sw-page>`;
    if (!this.s) return html`<sw-page heading=${tr('title')}><sw-state-panel state="loading"></sw-state-panel></sw-page>`;
    const edit = this.s.can.configure;
    return html`<sw-page heading="" data-transit-settings>
      <div class="top"><div><h1>${tr('title')}</h1><p class="sub">${tr('sub')}</p></div></div>
      <div class="stack">
        ${this.moduleCard(edit)}
        <div class="two">${this.stopsCard(edit)}${edit ? this.searchCard() : nothing}</div>
        <div class="two">${this.rulesCard(edit)}${this.refreshCard(edit)}</div>
        ${this.catalogueCard(edit)}
        ${this.healthCard()}
      </div></sw-page>${this.toast ? html`<div class="toast" role="status">${this.toast}</div>` : nothing}`;
  }

  private moduleCard(edit: boolean) {
    const on = this.s!.config.enabled;
    return html`<div class="panel" data-transit-module><div class="hd"><h2>${tr('moduleCard')}</h2><span class="sp"></span>
      <sw-toggle .checked=${on} ?disabled=${!edit || this.busy} label=${on ? tr('moduleOn') : tr('moduleOff')} data-transit-switch
        @change=${(e: CustomEvent<{ checked: boolean }>) => this.save({ enabled: e.detail.checked })}></sw-toggle></div>
      <p class="hint">${tr('moduleHint')}</p></div>`;
  }

  private stopsCard(edit: boolean) {
    const { config, limits } = this.s!;
    return html`<div class="panel" data-transit-stops><div class="hd"><h2>${tr('stopsCard')}</h2><span class="chip num">${config.stops.length} / ${limits.max_stops}</span></div>
      <p class="hint">${tr('stopsHint', { n: limits.max_stops })}</p>
      ${config.stops.length === 0 ? html`<p class="mut" data-stops-empty>${tr('stopsEmpty')}</p>` : config.stops.map((st, i) => html`<div class="stop" data-stop=${st.code}>
        <span class="chip num ltr">${st.code}</span>
        <div class="fld"><input class="inp" maxlength="60" aria-label=${tr('displayName')} placeholder=${st.catalogue_name || tr('displayName')} .value=${st.name} ?disabled=${!edit}
          @change=${(e: Event) => this.rename(i, (e.target as HTMLInputElement).value)}><span class="code">${st.city || ''}</span></div>
        ${edit ? html`<div class="acts"><sw-button size="sm" variant="ghost" ?disabled=${i === 0 || this.busy} @click=${() => this.move(i, -1)}>${tr('up')}</sw-button>
          <sw-button size="sm" variant="ghost" ?disabled=${i === config.stops.length - 1 || this.busy} @click=${() => this.move(i, 1)}>${tr('down')}</sw-button>
          <sw-button size="sm" variant="ghost" data-remove-stop=${st.code} ?disabled=${this.busy} @click=${() => this.removeStop(i)}>${tr('remove')}</sw-button></div>` : nothing}
      </div>`)}</div>`;
  }

  private rename(i: number, name: string): void {
    const list = stopsBody(this.s!.config.stops);
    list[i] = { ...list[i], name };
    void this.save({ stops: list });
  }

  private move(i: number, dir: -1 | 1): void {
    void this.save({ stops: stopsBody(moveStop(this.s!.config.stops, i, dir)) });
  }

  private removeStop(i: number): void {
    void this.save({ stops: stopsBody(this.s!.config.stops.filter((_s, k) => k !== i)) });
  }

  private searchCard() {
    const { catalogue, config, limits } = this.s!;
    return html`<div class="panel" data-transit-search><div class="hd"><h2>${tr('searchCard')}</h2></div>
      ${catalogue.count === 0 ? html`<p class="hint">${tr('catalogueEmpty')}</p>` : html`<div class="form" @keydown=${(e: KeyboardEvent) => e.key === 'Enter' && this.runSearch()}>
        <div class="r">
          <div class="fld"><label for="tr-city">${tr('city')}</label><select id="tr-city" class="inp" data-v=${this.city} .value=${this.city} @change=${(e: Event) => (this.city = (e.target as HTMLSelectElement).value)}>
            <option value="">${tr('cityAny')}</option>${this.cities.map((c) => html`<option value=${c} ?selected=${c === this.city}>${c}</option>`)}</select></div>
          <div class="fld"><label for="tr-q">${tr('nameFilter')}</label><input id="tr-q" class="inp" maxlength="60" .value=${this.q} @input=${(e: Event) => (this.q = (e.target as HTMLInputElement).value)}></div>
          <div class="fld"><label for="tr-code">${tr('codeFilter')}</label><input id="tr-code" class="inp ltr" inputmode="numeric" maxlength="8" .value=${this.code} @input=${(e: Event) => (this.code = (e.target as HTMLInputElement).value)}></div>
        </div>
        <div><sw-button variant="primary" icon="search" data-transit-search-btn @click=${() => this.runSearch()}>${tr('search')}</sw-button></div>
        ${this.results === null ? nothing : this.results.length === 0 ? html`<p class="mut">${tr('noResults')}</p>` : html`<div class="res" data-transit-results>${this.results.map((r) => html`<div class="row" data-result=${r.code}>
          <div><b>${r.name}</b><span>${r.city} · ${tr('stopCode', { c: r.code })}</span></div>
          <sw-button size="sm" ?disabled=${this.busy || config.stops.length >= limits.max_stops || config.stops.some((s) => s.code === r.code)} @click=${() => this.addStop(r)}>
            ${config.stops.some((s) => s.code === r.code) ? tr('added') : tr('add')}</sw-button></div>`)}</div>
          ${this.results.length >= 40 ? html`<p class="hint">${tr('resultsMore')}</p>` : nothing}`}
      </div>`}</div>`;
  }

  private numField(key: 'clock_after_min' | 'stale_grace_min' | 'hide_closer_min' | 'refresh_s' | 'poll_s' | 'position_fresh_min', label: TrKey, hint: TrKey, range: [number, number], edit: boolean,
                   unit: TrKey = 'minutes') {
    const v = this.s!.config[key];
    return html`<div class="fld"><label for=${'tr-' + key}>${tr(label)}</label>
      <div class="sum"><input id=${'tr-' + key} class="inp short num" type="number" min=${range[0]} max=${range[1]} step="1" .value=${live(String(v))} ?disabled=${!edit || this.busy} data-field=${key}
        @change=${(e: Event) => this.saveNumber(key, clampInt((e.target as HTMLInputElement).value, range[0], range[1], v))}><span class="mut">${tr(unit)}</span></div>
      <span class="hint">${tr(hint)}</span></div>`;
  }

  /** A number from the rules; a poll interval under the community-service floor is kept at the floor unless the owner confirmed it. */
  private saveNumber(key: string, v: number): void {
    const c = this.s!.config;
    if (key === 'poll_s' && v < this.s!.limits.poll_floor_s && !c.poll_floor_ack) v = this.s!.limits.poll_floor_s;
    void this.save({ [key]: v });
  }

  private refreshCard(edit: boolean) {
    const { config, limits } = this.s!;
    return html`<div class="panel" data-transit-refresh><div class="hd"><h2>${tr('refreshCard')}</h2></div><div class="form">
      ${this.numField('refresh_s', 'refreshS', 'refreshSHint', limits.refresh_range, edit, 'seconds')}
      ${this.numField('poll_s', 'pollS', 'pollSHint', limits.poll_range, edit, 'seconds')}
      <label class="ck"><input type="checkbox" data-field="poll_floor_ack" .checked=${config.poll_floor_ack} ?disabled=${!edit || this.busy}
        @change=${(e: Event) => this.save({ poll_floor_ack: (e.target as HTMLInputElement).checked, ...((e.target as HTMLInputElement).checked || config.poll_s >= limits.poll_floor_s ? {} : { poll_s: limits.poll_floor_s }) })}>${tr('pollAck')}</label>
      ${this.numField('position_fresh_min', 'positionFresh', 'positionFreshHint', limits.position_fresh_range, edit)}
      <label class="ck"><input type="checkbox" data-field="show_distance" .checked=${config.show_distance} ?disabled=${!edit || this.busy}
        @change=${(e: Event) => this.save({ show_distance: (e.target as HTMLInputElement).checked })}>${tr('showDistance')}</label>
      <span class="hint">${tr('showDistanceHint')}</span>
    </div></div>`;
  }

  private rulesCard(edit: boolean) {
    const lim = this.s!.limits;
    return html`<div class="panel" data-transit-rules><div class="hd"><h2>${tr('generalCard')}</h2></div><div class="form">
      ${this.numField('clock_after_min', 'clockAfter', 'clockAfterHint', lim.clock_after_range, edit)}
      ${this.numField('stale_grace_min', 'grace', 'graceHint', lim.grace_range, edit)}
      ${this.numField('hide_closer_min', 'hideCloser', 'hideCloserHint', lim.walk_range, edit)}
    </div></div>`;
  }

  private catalogueCard(edit: boolean) {
    const c = this.s!.catalogue;
    return html`<div class="panel" data-transit-catalogue><div class="hd"><h2>${tr('catalogueCard')}</h2><span class="sp"></span>
      ${edit ? html`<sw-button size="sm" data-refresh-catalogue ?disabled=${this.refreshing} @click=${() => this.refreshCatalogue()}>${this.refreshing ? tr('refreshing') : tr('refreshNow')}</sw-button>` : nothing}</div>
      ${c.count === 0 ? html`<p class="hint">${tr('catalogueEmpty')}</p>` : html`<p class="sum num">${tr('catalogueInfo', { n: c.count, d: c.date ?? '' })}</p>`}
      <p class="hint">${tr('catalogueNightly')}</p>
      ${c.error ? html`<div class="alert">${tr('catalogueError', { e: c.error })}</div>` : nothing}</div>`;
  }

  private healthCard() {
    const h = this.s!.health;
    const look = h.state === 'ok' ? 'ok' : h.state === 'off' ? 'off' : h.state === 'stale' ? 'warn' : 'alarm';
    const age = h.age_s === null ? tr('never') : tr('ageMin', { n: Math.floor(h.age_s / 60) });
    return html`<div class="panel" data-transit-health><div class="hd"><h2>${tr('healthCard')}</h2><span class="badge state" data-look=${look} data-health=${h.state}>${tr(('st_' + h.state) as TrKey)}</span></div>
      <dl class="kv"><dt>${tr('lastOk')}</dt><dd class=${h.last_ok_at ? 'num ltr' : ''}>${h.last_ok_at ? h.last_ok_at.replace('T', ' ').replace('Z', '') : tr('never')}</dd>
        <dt>${tr('dataAge')}</dt><dd>${age}</dd><dt>${tr('codesInUse')}</dt><dd class="num">${h.codes_in_use}</dd>
        <dt>${tr('errorsCount')}</dt><dd class="num">${h.errors}</dd>
        ${h.last_error ? html`<dt>${tr('lastError')}</dt><dd class="ltr">${h.last_error}</dd>` : nothing}
        ${h.backoff_until ? html`<dt></dt><dd class="mut">${tr('backoff')}</dd>` : nothing}</dl></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-transit': SystemTransit;
  }
}
