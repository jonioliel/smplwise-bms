import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-dialog';
import '../components/sw-drawer';
import '../components/sw-field';
import '../components/sw-pager';
import '../components/sw-icon';
import '../components/sw-state-panel';
import { describeError } from '../api/client';
import {
  EMPTY_RANGE, HOLD_RANGE, RETENTION_RANGE, getPresenceCandidates, getPresenceHistory, purgePresenceHistory, putPresenceRoom, putPresenceSettings, putPresenceTags,
  type BuildingPresenceSettings, type HomeDisplay, type PresenceCandidate, type PresenceHistorySummary, type PresenceRoomOption,
} from '../api/building-presence';
import { filterSensors, pageSlice, settingsProblem, toggledTags, type SensorFilter } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';

const DEFAULT_CFG: BuildingPresenceSettings = { enabled: false, hold_seconds: 60, empty_minutes: 10, retention_days: 30, home_display: 'chip', map_tint: true };

/**
 * `<system-building-presence>` - הגדרות › נוכחות › חיישנים במבנה (mockup round 7). The master switch comes first and is OFF by default: while it is off
 * nothing else is offered (no sensor is read, no history is kept, no card / chip / map tag / cockpit block exists). When on: the grouped sensor list (a
 * check per sensor, the room of a tagged one editable, the tag lives in Arx only), the times and display (hold, empty timeout, home display, map tag),
 * and the history (days kept, a short privacy note, the number of records, "delete all" with a confirmation). Saved on change; no scrolling list
 * (rooms wrap in a grid). Rendered for an editor; a viewer sees nothing.
 */
@customElement('system-building-presence')
export class SystemBuildingPresence extends LitElement {
  @property({ type: Boolean }) editable = false;
  @state() private list: PresenceCandidate[] | null = null;
  @state() private rooms: PresenceRoomOption[] = [];
  @state() private cfg: BuildingPresenceSettings = DEFAULT_CFG;
  @state() private hist: PresenceHistorySummary | null = null;
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';
  @state() private confirmPurge = false;
  /** Mockup round 7: the sensor list is a filtered, paged table (no scrolling list); the "..." of a row opens the tag editor drawer. */
  @state() private filter: SensorFilter = 'all';
  @state() private page = 1;
  @state() private editId = '';
  @state() private narrow = false;
  /** PRESENCE-DESIGN-2300: the first read failed (not a refusal) - an error panel with a retry, never the switch drawn as "off". */
  @state() private loadFailed = '';
  private mq = window.matchMedia('(max-width: 700px)');
  private onMq = () => {
    this.narrow = this.mq.matches;
    this.page = 1;
  };

  static styles = css`
    :host {
      display: grid;
      gap: 12px;
    }
    .room {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading, var(--sw-text));
      margin-block: 10px 4px;
    }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-end: 8px;
    }
    .tbl {
      display: grid;
      gap: 6px;
    }
    .sensor {
      display: grid;
      grid-template-columns: 24px minmax(0, 1.3fr) minmax(0, 1fr) 124px 44px;
      align-items: center;
      gap: 10px;
      padding: 6px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-md, 12px);
      background: var(--sw-surface);
      font-size: var(--sw-fs-md);
      min-block-size: 46px;
    }
    .sensor[data-tagged='false'] {
      background: transparent;
    }
    .sensor .nm {
      display: grid;
      min-inline-size: 0;
    }
    .sensor .nm b {
      font-weight: var(--sw-fw-semibold);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .sensor select {
      inline-size: 100%;
      max-inline-size: none;
    }
    .st {
      justify-self: start;
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: 999px;
      border: 1px solid var(--sw-border);
      font-size: var(--sw-fs-sm);
      white-space: nowrap;
      color: var(--sw-text-2);
      background: var(--sw-surface);
    }
    .st[data-st='on'] {
      color: var(--sw-success-text);
      background: var(--sw-success-soft);
      border-color: transparent;
      font-weight: var(--sw-fw-semibold);
    }
    .st[data-st='na'] {
      border-style: dashed;
      color: var(--sw-text-3);
    }
    .more {
      inline-size: 32px;
      block-size: 32px;
      border-radius: 50%;
      border: 1px solid var(--sw-border);
      background: var(--sw-surface);
      color: var(--sw-text);
      cursor: pointer;
      font-weight: var(--sw-fw-bold);
      line-height: 1;
    }
    .more:disabled {
      opacity: 0.5;
      cursor: default;
    }
    /* PRESENCE-DESIGN-2300: a drawn icon instead of a "···" glyph, pressed feedback, focus ring */
    .more {
      display: inline-grid;
      place-items: center;
      padding: 0;
      touch-action: manipulation;
      -webkit-tap-highlight-color: transparent;
    }
    .more:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    @media (prefers-reduced-motion: no-preference) {
      .more,
      .seg button {
        transition: transform 120ms var(--sw-ease-out, ease-out), background-color var(--sw-t-state, 200ms) var(--sw-ease, ease);
      }
      .more:not(:disabled):active,
      .seg button:not(:disabled):active {
        transform: scale(0.96);
      }
    }
    /* mobile-native: a finger gets 44 px targets and 16 px inputs (no zoom on focus) */
    @media (pointer: coarse) {
      .more {
        inline-size: 44px;
        block-size: 44px;
      }
      .seg button {
        min-block-size: 40px;
        padding-inline: 16px;
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        user-select: none;
      }
      input[type='number'],
      select {
        /* no zoom-in on focus on a phone (needs >= 16px; the xl tier is 17-19px in every skin) */
        font-size: var(--sw-fs-xl);
      }
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex-wrap: wrap;
      margin-block-start: 8px;
    }
    .field {
      display: grid;
      gap: 4px;
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .field select {
      max-inline-size: none;
    }
    @media (max-width: 700px) {
      .sensor {
        grid-template-columns: 24px minmax(0, 1fr) auto 44px;
        grid-template-areas: 'c n s m' '. r r r';
        row-gap: 6px;
      }
      .sensor > .ck {
        grid-area: c;
      }
      .sensor > .nm {
        grid-area: n;
      }
      .sensor > .rm {
        grid-area: r;
      }
      .sensor > .st {
        grid-area: s;
      }
      .sensor > .more {
        grid-area: m;
      }
    }
    .muted {
      color: var(--sw-text-muted);
      font-size: var(--sw-fs-sm);
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      padding-block: 8px 0;
    }
    .priv {
      padding: 8px 10px;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-radius-sm, 8px);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    input[type='number'] {
      inline-size: 84px;
    }
    select {
      max-inline-size: 180px;
    }
    .seg {
      display: inline-flex;
      border: 1px solid var(--sw-border);
      border-radius: var(--sw-r-pill);
      padding: 2px;
      background: var(--sw-surface-2);
      flex-wrap: wrap;
    }
    .seg button {
      border: 0;
      background: transparent;
      font: inherit;
      font-size: var(--sw-fs-sm);
      padding: 4px 14px;
      border-radius: var(--sw-r-pill);
      color: var(--sw-text-2);
      cursor: pointer;
    }
    .seg button[aria-pressed='true'] {
      background: var(--sw-surface);
      color: var(--sw-text);
      font-weight: var(--sw-fw-semibold);
      box-shadow: var(--sw-shadow-1);
    }
    .seg button:focus-visible {
      outline: var(--sw-focus-w) solid var(--sw-focus);
      outline-offset: 2px;
    }
    input[type='checkbox'] {
      accent-color: var(--sw-accent);
      inline-size: 18px;
      block-size: 18px;
    }
    /* mockup: the sensor table is the wide column, the times and the history sit beside it */
    @media (min-width: 1280px) {
      :host {
        grid-template-columns: minmax(0, 1fr) 340px;
        align-items: start;
      }
      [data-building-presence-master] {
        grid-column: 1 / -1;
      }
      [data-building-presence-card] {
        grid-column: 1;
        grid-row: 2 / span 2;
      }
      [data-building-presence-settings] {
        grid-column: 2;
        grid-row: 2;
      }
      [data-building-history] {
        grid-column: 2;
        grid-row: 3;
      }
    }
    .ok {
      color: var(--sw-success-text);
    }
    .err {
      color: var(--sw-danger-text);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.narrow = this.mq.matches;
    this.mq.addEventListener('change', this.onMq);
    void this.load();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.mq.removeEventListener('change', this.onMq);
  }

  private async load() {
    this.loadFailed = '';
    try {
      const r = await getPresenceCandidates();
      this.list = r.sensors;
      this.rooms = r.rooms ?? [];
      this.cfg = { ...DEFAULT_CFG, ...r.settings };
      if (this.cfg.enabled) this.hist = await getPresenceHistory();
    } catch (err) {
      // a refusal shows nothing (a viewer); any other failure is an error state, because the real switch position is unknown
      if (err instanceof Error && /403|אין הרשאה/.test(err.message)) this.list = [];
      else {
        this.list = null;
        this.loadFailed = describeError(err) || BP.loadFailed;
      }
    }
  }

  private retry() {
    this.loadFailed = '';
    void this.load();
  }

  private async run(fn: () => Promise<void>, flash = BP.saved) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      await fn();
      this.message = flash;
      setTimeout(() => (this.message = ''), 2500);
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  /** Saves a change of the settings; the server answers with the whole set. */
  private patch(body: Partial<BuildingPresenceSettings>) {
    return this.run(async () => {
      this.cfg = { ...DEFAULT_CFG, ...(await putPresenceSettings(body)).settings };
      this.hist = this.cfg.enabled ? await getPresenceHistory() : null;
    });
  }

  private toggleTag(id: string, on: boolean) {
    if (!this.list) return;
    const ids = toggledTags(this.list, id, on);
    return this.run(async () => {
      const r = await putPresenceTags(ids);
      this.list = r.sensors;
      this.rooms = r.rooms ?? this.rooms;
    });
  }

  private setRoom(id: string, areaId: string) {
    return this.run(async () => {
      const r = await putPresenceRoom(id, areaId || null);
      this.list = r.sensors;
    });
  }

  private purge() {
    this.confirmPurge = false;
    return this.run(async () => {
      this.hist = await purgePresenceHistory();
    }, BP.purged);
  }

  private num(field: 'hold_seconds' | 'empty_minutes' | 'retention_days', e: Event) {
    const v = (e.target as HTMLInputElement).valueAsNumber;
    this.cfg = { ...this.cfg, [field]: Number.isFinite(v) ? v : NaN };
  }

  private renderMaster() {
    return html`<sw-card heading=${BP.masterLabel} data-building-presence-master>
      <div class="row">
        <sw-toggle label=${BP.masterLabel} labelHidden data-building-enabled .checked=${this.cfg.enabled} ?disabled=${!this.editable || this.busy}
          @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patch({ enabled: e.detail.checked })}></sw-toggle>
        ${this.cfg.enabled ? nothing : html`<b data-building-off-note>${BP.masterOffNote}</b>`}
        <span class="muted">${BP.masterHint}</span>
        ${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }

  private renderSensors(list: PresenceCandidate[]) {
    const tagged = list.filter((c) => c.tagged).length;
    const filtered = filterSensors(list, this.filter);
    const size = this.narrow ? 5 : 6;
    const pg = pageSlice(filtered, this.page, size);
    const chip = (v: SensorFilter, label: string) => html`<button type="button" aria-pressed=${String(this.filter === v)} data-building-filter=${v} @click=${() => { this.filter = v; this.page = 1; }}>${label}</button>`;
    return html`<sw-card heading=${BP.heading} subheading=${tagged ? `${tagged} ${BP.tagged} · ${list.length} ${BP.found}` : BP.subheading} data-building-presence-card>
      <div class="bar"><span class="seg" role="group" aria-label=${BP.filterLabel}>${chip('all', BP.filterAll)}${chip('tagged', BP.filterTagged)}${chip('untagged', BP.filterUntagged)}</span></div>
      ${list.length ? nothing : html`<div class="muted">${BP.noSensors}</div>`}
      <div class="tbl" data-building-table>${pg.items.map((c) => this.renderRow(c))}</div>
      <div class="foot"><span class="muted">${BP.tagNote}</span>${pg.pages > 1 ? html`<sw-pager .page=${pg.page} .pages=${pg.pages} @page-change=${(e: CustomEvent<{ page: number }>) => (this.page = e.detail.page)}></sw-pager>` : nothing}</div>
      ${this.renderEditor(list)}
    </sw-card>`;
  }

  private stateChip(c: PresenceCandidate) {
    const st = c.state === 'on' ? 'on' : c.state === 'off' ? 'off' : 'na';
    return html`<span class="st" data-st=${st} data-building-state>${BP.stateWord(c.state)}</span>`;
  }

  private roomSelect(c: PresenceCandidate, attr: string) {
    return html`<sw-field><select data-building-room=${attr} aria-label=${BP.roomPick} ?disabled=${this.busy || !this.editable} @change=${(e: Event) => void this.setRoom(c.entity_id, (e.target as HTMLSelectElement).value)}>
      <option value="" ?selected=${!c.placed}>${BP.ownRoom}</option>
      ${this.rooms.map((r) => html`<option value=${r.area_id} ?selected=${!!c.placed && c.area_id === r.area_id}>${r.name}</option>`)}</select></sw-field>`;
  }

  private renderRow(c: PresenceCandidate) {
    const edit = this.editable && c.tagged;
    return html`<div class="sensor" data-building-sensor=${c.entity_id} data-tagged=${String(c.tagged)}>
      <label class="ck"><input type="checkbox" aria-label=${c.name} .checked=${c.tagged} ?disabled=${!this.editable || this.busy} @change=${(e: Event) => void this.toggleTag(c.entity_id, (e.target as HTMLInputElement).checked)} /></label>
      <span class="nm"><b title=${c.name} dir="auto">${c.name}</b><span class="muted">${BP.kindWord(c.device_class)}</span></span>
      <span class="rm">${edit ? this.roomSelect(c, 'row') : html`<span class="muted">${c.area_name ?? BP.noRoom}</span>`}</span>
      ${this.stateChip(c)}
      <button type="button" class="more" data-building-more aria-label=${`${BP.editTitle}: ${c.name}`} ?disabled=${!edit} @click=${() => (this.editId = c.entity_id)}><sw-icon name="more" size="18"></sw-icon></button>
    </div>`;
  }

  /** The tag editor (mockup "settings-editor"): the sensor's name as the platform reports it, its room, what it says now, and remove-tag.
   * Per-sensor "active when" and hold are NOT stored by the server yet (the hold is building-wide), so they are not offered. */
  private renderEditor(list: PresenceCandidate[]) {
    const c = list.find((x) => x.entity_id === this.editId);
    if (!c) return nothing;
    return html`<sw-drawer modal .open=${true} heading=${c.name} subheading=${c.area_name ?? BP.noRoom} data-building-editor @close=${() => (this.editId = '')}>
      <div class="field">${BP.stateNow}<div>${this.stateChip(c)}</div></div>
      <label class="field">${BP.roomPick}${this.roomSelect(c, 'editor')}</label>
      <div class="priv">${BP.tagNote}</div>
      <div slot="footer" class="row">
        <sw-button variant="danger" data-building-untag ?disabled=${this.busy || !this.editable} @click=${() => { const id = c.entity_id; this.editId = ''; void this.toggleTag(id, false); }}>${BP.removeTag}</sw-button>
        <sw-button @click=${() => (this.editId = '')}>${BP.close}</sw-button>
      </div>
    </sw-drawer>`;
  }

  private renderTimes() {
    const bad = settingsProblem(this.cfg);
    const seg = (v: HomeDisplay, label: string) =>
      html`<button type="button" aria-pressed=${String(this.cfg.home_display === v)} data-building-home=${v} ?disabled=${!this.editable || this.busy} @click=${() => void this.patch({ home_display: v })}>${label}</button>`;
    return html`<sw-card heading=${BP.timesHeading} data-building-presence-settings>
      <div class="row">
        <label>${BP.holdLabel} <sw-field inline><input type="number" data-building-hold min=${HOLD_RANGE.min} max=${HOLD_RANGE.max} step="1" .value=${String(this.cfg.hold_seconds)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('hold_seconds', e)} /></sw-field> ${BP.holdUnit}</label>
        <label>${BP.emptyLabel} <sw-field inline><input type="number" data-building-empty min=${EMPTY_RANGE.min} max=${EMPTY_RANGE.max} step="1" .value=${String(this.cfg.empty_minutes)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('empty_minutes', e)} /></sw-field> ${BP.emptyUnit}</label>
        ${this.editable ? html`<sw-button size="sm" data-building-save ?disabled=${this.busy || !!bad} @click=${() => void this.patch({ hold_seconds: this.cfg.hold_seconds, empty_minutes: this.cfg.empty_minutes })}>${BP.save}</sw-button>` : nothing}
      </div>
      <div class="row"><span>${BP.homeLabel}</span><span class="seg" role="group">${seg('card', BP.homeCard)}${seg('chip', BP.homeChip)}${seg('off', BP.homeOff)}</span></div>
      <div class="row"><sw-toggle label=${BP.tintLabel} data-building-tint .checked=${this.cfg.map_tint} ?disabled=${!this.editable || this.busy}
        @change=${(e: CustomEvent<{ checked: boolean }>) => void this.patch({ map_tint: e.detail.checked })}></sw-toggle><span class="muted">${BP.tintHint}</span></div>
    </sw-card>`;
  }

  private renderHistory() {
    const h = this.hist;
    const bad = settingsProblem(this.cfg)?.field === 'retention_days';
    const oldest = h?.oldest ? new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' }).format(new Date(h.oldest)) : '—';
    return html`<sw-card heading=${BP.historyHeading} data-building-history>
      <div class="row">
        <label>${BP.retentionLabel} <sw-field inline><input type="number" data-building-retention min=${RETENTION_RANGE.min} max=${RETENTION_RANGE.max} step="1" .value=${String(this.cfg.retention_days)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('retention_days', e)} /></sw-field> ${BP.retentionUnit}</label>
        ${this.editable ? html`<sw-button size="sm" data-building-retention-save ?disabled=${this.busy || bad} @click=${() => void this.patch({ retention_days: this.cfg.retention_days })}>${BP.save}</sw-button>` : nothing}
      </div>
      <div class="priv" data-building-privacy>${BP.privacy}</div>
      <div class="row muted"><span>${BP.rowsKept}: <b data-building-rows>${BP.count(h?.rows ?? 0)}</b></span><span>${BP.oldest}: <b>${oldest}</b></span></div>
      ${this.editable ? html`<div class="row"><sw-button size="sm" variant="danger" data-building-purge ?disabled=${this.busy || !h?.rows} @click=${() => (this.confirmPurge = true)}>${BP.purge}</sw-button></div>` : nothing}
      ${this.confirmPurge
        ? html`<sw-dialog open heading=${BP.purgeTitle} data-building-purge-dialog @close=${() => (this.confirmPurge = false)}>
            <p>${BP.purgeBody(h?.rows ?? 0)}</p>
            <div slot="footer"><sw-button variant="danger" data-building-purge-confirm @click=${() => void this.purge()}>${BP.purgeConfirm}</sw-button><sw-button @click=${() => (this.confirmPurge = false)}>${BP.cancel}</sw-button></div>
          </sw-dialog>`
        : nothing}
    </sw-card>`;
  }

  render() {
    // PRESENCE-DESIGN-2300: the page has a loading and an error state of its own (it used to be blank, then drew a failed read as "off")
    if (this.loadFailed) return html`<sw-state-panel state="error" heading=${BP.loadFailed} hint=${this.loadFailed} actionLabel=${BP.retry} data-building-load-error @action=${() => this.retry()}></sw-state-panel>`;
    if (this.list === null) return this.editable ? html`<sw-state-panel state="loading" compact heading=${BP.loading} data-building-loading></sw-state-panel>` : nothing;
    if (!this.editable && !this.cfg.enabled) return nothing;
    return html`${this.renderMaster()}${this.cfg.enabled ? html`${this.renderSensors(this.list)}${this.renderTimes()}${this.renderHistory()}` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-building-presence': SystemBuildingPresence;
  }
}
