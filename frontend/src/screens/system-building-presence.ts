import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import { describeError } from '../api/client';
import {
  EMPTY_RANGE, HOLD_RANGE, getPresenceCandidates, putPresenceSettings, putPresenceTags,
  type BuildingPresenceSettings, type PresenceCandidate,
} from '../api/building-presence';
import { groupByRoom, settingsProblem, toggledTags } from '../api/building-presence-logic';
import { BP } from '../i18n/building-presence';

/**
 * BUILDING-PRESENCE-2271 `<system-building-presence>`: the owner's tag. A short grouped list of the presence / motion sensors the
 * installation mirrors (a check per sensor) and two numbers - the debounce hold and the empty timeout. Saved on change; one card, no
 * paragraphs, no scrolling list (rooms wrap in a grid). Rendered only for an editor; shows nothing when no sensor exists at all.
 */
@customElement('system-building-presence')
export class SystemBuildingPresence extends LitElement {
  @property({ type: Boolean }) editable = false;
  @state() private list: PresenceCandidate[] | null = null;
  @state() private cfg: BuildingPresenceSettings = { hold_seconds: 60, empty_minutes: 10 };
  @state() private busy = false;
  @state() private message = '';
  @state() private error = '';

  static styles = css`
    :host {
      display: block;
    }
    .room {
      font-weight: var(--sw-fw-bold);
      font-size: var(--sw-fs-sm);
      color: var(--sw-heading, var(--sw-text));
      margin-block: 10px 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 6px 16px;
    }
    label.chk {
      display: flex;
      align-items: center;
      gap: 8px;
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
      padding-block: 10px 0;
    }
    input[type='number'] {
      inline-size: 84px;
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
      this.cfg = r.settings;
    } catch (err) {
      this.list = [];
      if (!(err instanceof Error && /403|אין הרשאה/.test(err.message))) this.error = describeError(err);
    }
  }

  private async toggle(id: string, on: boolean) {
    if (!this.list || this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      const r = await putPresenceTags(toggledTags(this.list, id, on));
      this.list = r.sensors;
      this.flash();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private async saveSettings() {
    if (settingsProblem(this.cfg)) return;
    this.busy = true;
    this.error = '';
    try {
      this.cfg = (await putPresenceSettings(this.cfg)).settings;
      this.flash();
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  private flash() {
    this.message = BP.saved;
    setTimeout(() => (this.message = ''), 2500);
  }

  private num(field: keyof BuildingPresenceSettings, e: Event) {
    const v = (e.target as HTMLInputElement).valueAsNumber;
    this.cfg = { ...this.cfg, [field]: Number.isFinite(v) ? v : NaN };
  }

  render() {
    if (this.list === null) return nothing;
    if (!this.list.length && !this.error) return nothing;
    const tagged = this.list.filter((c) => c.tagged).length;
    const bad = settingsProblem(this.cfg);
    return html`<sw-card heading=${BP.heading} subheading=${tagged ? `${tagged} ${BP.tagged}` : BP.subheading} data-building-presence-card>
      ${groupByRoom(this.list).map(
        (g) => html`<div class="room">${g.room}</div>
          <div class="grid">${g.items.map(
            (c) => html`<label class="chk" data-building-sensor=${c.entity_id}><input type="checkbox" .checked=${c.tagged} ?disabled=${!this.editable || this.busy} @change=${(e: Event) => void this.toggle(c.entity_id, (e.target as HTMLInputElement).checked)} />${c.name}<span class="muted">${BP.stateWord(c.state)}</span></label>`,
          )}</div>`,
      )}
      <div class="row" data-building-presence-settings>
        <label>${BP.holdLabel} <input type="number" data-building-hold min=${HOLD_RANGE.min} max=${HOLD_RANGE.max} step="1" .value=${String(this.cfg.hold_seconds)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('hold_seconds', e)} /> ${BP.holdUnit}</label>
        <label>${BP.emptyLabel} <input type="number" data-building-empty min=${EMPTY_RANGE.min} max=${EMPTY_RANGE.max} step="1" .value=${String(this.cfg.empty_minutes)} ?disabled=${!this.editable || this.busy} @input=${(e: Event) => this.num('empty_minutes', e)} /> ${BP.emptyUnit}</label>
        ${this.editable ? html`<sw-button size="sm" data-building-save ?disabled=${this.busy || !!bad} @click=${() => void this.saveSettings()}>${BP.save}</sw-button>` : nothing}
        ${this.message ? html`<span class="ok" role="status">${this.message}</span>` : nothing}
        ${this.error ? html`<span class="err" role="alert">${this.error}</span>` : nothing}
      </div>
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'system-building-presence': SystemBuildingPresence;
  }
}
