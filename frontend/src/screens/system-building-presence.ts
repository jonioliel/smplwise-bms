import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-toggle';
import '../components/sw-dialog';
import { describeError } from '../api/client';
import {
  EMPTY_RANGE, HOLD_RANGE, RETENTION_RANGE, getPresenceCandidates, getPresenceHistory, purgePresenceHistory, putPresenceRoom, putPresenceSettings, putPresenceTags,
  type BuildingPresenceSettings, type HomeDisplay, type PresenceCandidate, type PresenceHistorySummary, type PresenceRoomOption,
} from '../api/building-presence';
import { groupByRoom, settingsProblem, toggledTags } from '../api/building-presence-logic';
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
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 6px 16px;
    }
    .sensor {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      font-size: var(--sw-fs-md);
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
      gap: 4px;
    }
    .seg button[aria-pressed='true'] {
      font-weight: var(--sw-fw-bold);
      border-color: var(--sw-accent);
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
    void this.load();
  }

  private async load() {
    try {
      const r = await getPresenceCandidates();
      this.list = r.sensors;
      this.rooms = r.rooms ?? [];
      this.cfg = { ...DEFAULT_CFG, ...r.settings };
      if (this.cfg.enabled) this.hist = await getPresenceHistory();
    } catch (err) {
      this.list = [];
      if (!(err instanceof Error && /403|אין הרשאה/.test(err.message))) this.error = describeError(err);
    }
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
    return html`<sw-card heading=${BP.heading} subheading=${tagged ? `${tagged} ${BP.tagged}` : BP.subheading} data-building-presence-card>
      ${list.length ? nothing : html`<div class="muted">${BP.noSensors}</div>`}
      ${groupByRoom(list).map(
        (g) => html`<div class="room">${g.room}</div>
          <div class="grid">${g.items.map(
            (c) => html`<div class="sensor" data-building-sensor=${c.entity_id}>
              <label><input type="checkbox" .checked=${c.tagged} ?disabled=${!this.editable || this.busy} @change=${(e: Event) => void this.toggleTag(c.entity_id, (e.target as HTMLInputElement).checked)} />${c.name}</label>
              <span class="muted">${BP.stateWord(c.state)}</span>
              ${c.tagged && this.editable
                ? html`<select data-building-room aria-label=${BP.roomPick} ?disabled=${this.busy} @change=${(e: Event) => void this.setRoom(c.entity_id, (e.target as HTMLSelectElement).value)}>
                    <option value="" ?selected=${!c.placed}>${BP.ownRoom}</option>
                    ${this.rooms.map((r) => html`<option value=${r.area_id} ?selected=${!!c.placed && c.area_id === r.area_id}>${r.name}</option>`)}</select>`
                : nothing}
            </div>`,
          )}</div>`,
      )}
      <div class="row muted">${BP.tagNote}</div>
    </sw-card>`;
  }

  private renderTimes() {
    const bad = settingsProblem(this.cfg);
    const seg = (v: HomeDisplay, label: string) =>
      html`<button type="button" aria-pressed=${String(this.cfg.home_display === v)} data-building-home=${v} ?disabled=${!this.editable || this.busy} @click=${() => void this.patch({ home_display: v })}>${label}</button>`;
    return html`<sw-card heading=${BP.timesHeading} data-building-presence-settings>
      <div class="row">
        <label>${BP.holdLabel} <input type="number" data-building-hold min=${HOLD_RANGE.min} max=${HOLD_RANGE.max} step="1" .value=${String(this.cfg.hold_seconds)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('hold_seconds', e)} /> ${BP.holdUnit}</label>
        <label>${BP.emptyLabel} <input type="number" data-building-empty min=${EMPTY_RANGE.min} max=${EMPTY_RANGE.max} step="1" .value=${String(this.cfg.empty_minutes)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('empty_minutes', e)} /> ${BP.emptyUnit}</label>
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
        <label>${BP.retentionLabel} <input type="number" data-building-retention min=${RETENTION_RANGE.min} max=${RETENTION_RANGE.max} step="1" .value=${String(this.cfg.retention_days)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('retention_days', e)} /> ${BP.retentionUnit}</label>
        ${this.editable ? html`<sw-button size="sm" data-building-retention-save ?disabled=${this.busy || bad} @click=${() => void this.patch({ retention_days: this.cfg.retention_days })}>${BP.save}</sw-button>` : nothing}
      </div>
      <div class="priv" data-building-privacy>${BP.privacy}</div>
      <div class="row muted"><span>${BP.rowsKept}: <b data-building-rows>${h?.rows ?? 0}</b></span><span>${BP.oldest}: <b>${oldest}</b></span></div>
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
    if (this.list === null) return nothing;
    if (!this.editable && !this.cfg.enabled) return nothing;
    return html`${this.renderMaster()}${this.cfg.enabled ? html`${this.renderSensors(this.list)}${this.renderTimes()}${this.renderHistory()}` : nothing}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-building-presence': SystemBuildingPresence;
  }
}
