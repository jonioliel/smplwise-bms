import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { fmtWhen } from '../api/access';
import { approveRelayMap, getRelayMap, type RelayMap, type RelayMapStation } from '../api/wiskey-relay-map';
import {
  OFF, approveQuestion, approvedLine, canApprove, draftOf, mapDiff, parseChoice, relayChoices, relayName, rowsBody, stationStatus, typedWordNeeded, type RelayDraft,
} from './wiskey-relay-map-logic';

/**
 * Settings › הגדרת מערכת › WisKey: "מיפוי ממסרים" (WISKEY-RELAYMAP-2310). Per WisKey station, which api relay drives which
 * physical relay (door), approved explicitly and saved against the station revision. The map is what the WisKey emergency and
 * door-automation grants are built from; nothing is sent to a station or a door from here. System administrator edits;
 * `access.admin.read` sees it read-only. The station's id is never shown.
 */
@customElement('sw-wiskey-relay-map')
export class SwWiskeyRelayMap extends LitElement {
  @state() private map: RelayMap | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private drafts: Record<string, RelayDraft> = {};
  @state() private pending: RelayMapStation | null = null;
  @state() private word = '';

  static styles = css`
    :host {
      display: block;
      margin-block-start: var(--sw-s-3);
    }
    .station {
      padding: var(--sw-s-2) 0;
      border-block-end: 1px solid var(--sw-border);
    }
    .station:last-child {
      border-block-end: 0;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-3);
      flex-wrap: wrap;
    }
    .who {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
    }
    .name {
      font-weight: var(--sw-fw-medium);
      color: var(--sw-text);
    }
    .sub {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    .rows {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: var(--sw-s-2) var(--sw-s-3);
      margin-block: var(--sw-s-2);
    }
    label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--sw-s-2);
      color: var(--sw-text-2);
    }
    .tag {
      color: var(--sw-text-3);
      font-size: var(--sw-fs-sm);
    }
    select,
    input {
      font: inherit;
      color: var(--sw-text);
      background: var(--sw-surface);
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      padding: var(--sw-s-1) var(--sw-s-2);
      min-block-size: 36px;
      max-inline-size: 100%;
    }
    select:disabled {
      color: var(--sw-text-2);
      background: transparent;
    }
    select:focus-visible,
    input:focus-visible {
      outline: 2px solid var(--sw-focus);
      outline-offset: 1px;
    }
    .actions {
      display: flex;
      align-items: center;
      gap: var(--sw-s-2);
      flex-wrap: wrap;
    }
    .err,
    .warn {
      font-size: var(--sw-fs-sm);
    }
    .err {
      color: var(--sw-danger-text);
    }
    .warn {
      color: var(--sw-warning-text, var(--sw-text-2));
    }
    .word {
      display: flex;
      flex-direction: column;
      gap: var(--sw-s-1);
      margin-block-start: var(--sw-s-2);
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load() {
    try {
      this.map = await getRelayMap();
      this.drafts = {};
      this.error = '';
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private draft(s: RelayMapStation): RelayDraft {
    return this.drafts[s.id] ?? draftOf(s);
  }

  private pick(s: RelayMapStation, api: number, value: string) {
    this.drafts = { ...this.drafts, [s.id]: { ...this.draft(s), [api]: parseChoice(value) } };
  }

  private ask(s: RelayMapStation) {
    this.word = '';
    this.pending = s;
  }

  private async approve() {
    const s = this.pending;
    if (!s) return;
    const d = this.draft(s);
    this.busy = true;
    try {
      await approveRelayMap(s.id, s.revision, rowsBody(d), typedWordNeeded(s, d) ? this.word.trim() : undefined);
      this.pending = null;
      await this.load();
    } catch (err) {
      const message = describeError(err);
      this.pending = null;
      // a stale revision (409): nothing was written; show the current map (the draft is dropped). Other refusals keep the draft.
      if (err instanceof ApiError && err.status === 409) await this.load();
      this.error = message;
    } finally {
      this.busy = false;
    }
  }

  private stationBlock(m: RelayMap, s: RelayMapStation) {
    const d = this.draft(s);
    const status = stationStatus(s);
    const diff = mapDiff(s, d);
    const editable = m.can_edit && s.in_copy;
    const choices = relayChoices(s);
    return html`<div class="station" data-relay-map-station=${s.name}>
      <div class="head">
        <div class="who"><span class="name">${s.name || 'תחנה ללא שם'}</span><span class="sub">${approvedLine(s, fmtWhen)}</span></div>
        <sw-badge kind=${status.tone} label=${status.text}></sw-badge>
      </div>
      <div class="rows">
        ${s.rows.map((r) => {
          const current = d[r.api_relay] ?? null;
          return html`<label data-relay-map-row=${r.api_relay}>
            <span>ממסר API ${r.api_relay}</span>
            <select aria-label=${`${s.name}: ממסר API ${r.api_relay}`} ?disabled=${!editable || this.busy} @change=${(e: Event) => this.pick(s, r.api_relay, (e.target as HTMLSelectElement).value)}>
              ${choices.map((o) => html`<option value=${o.value} ?selected=${o.value === (current === null ? OFF : String(current))}>${o.label}</option>`)}
            </select>
          </label>`;
        })}
      </div>
      ${s.automated_relays.length
        ? html`<div class="sub" data-relay-map-automated>יש אוטומציה על ${s.automated_relays.map((p) => relayName(s, p)).join(', ')}</div>`
        : nothing}
      ${diff.duplicate.length ? html`<div class="err" role="alert">כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד.</div>` : nothing}
      ${editable && diff.changed
        ? html`<div class="actions">
            <sw-button size="sm" variant="primary" data-relay-map-approve ?disabled=${this.busy || !canApprove(s, d, m.can_edit)} @click=${() => this.ask(s)}>אישור מיפוי</sw-button>
            <sw-button size="sm" variant="ghost" data-relay-map-reset ?disabled=${this.busy} @click=${() => { const { [s.id]: _drop, ...rest } = this.drafts; this.drafts = rest; }}>ביטול שינויים</sw-button>
          </div>`
        : nothing}
    </div>`;
  }

  private dialog(m: RelayMap, s: RelayMapStation) {
    const d = this.draft(s);
    const needWord = typedWordNeeded(s, d);
    const ok = !needWord || this.word.trim() === m.confirm_word;
    return html`<sw-dialog open heading="מיפוי ממסרים" data-relay-map-confirm @close=${() => { this.pending = null; }}>
      <p>${approveQuestion(s, d)}</p>
      ${needWord
        ? html`<div class="word">
            <span class="warn">כדי לאשר יש להקליד "${m.confirm_word}"</span>
            <input data-relay-map-word aria-label=${`להקליד ${m.confirm_word}`} .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} />
          </div>`
        : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => { this.pending = null; }}>ביטול</sw-button>
      <sw-button slot="footer" variant="primary" data-relay-map-ok ?disabled=${this.busy || !ok} @click=${() => this.approve()}>אישור</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (this.error && !this.map) return html`<sw-state-panel state="error" hint=${this.error} actionLabel="נסה שוב" @action=${() => this.load()}></sw-state-panel>`;
    if (!this.map) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const m = this.map;
    const sub = m.can_edit
      ? 'לכל תחנה: איזה ממסר פיזי (דלת) כל ממסר API מפעיל · חירום ואוטומציות דרך WisKey פועלים רק על מיפוי מאושר · לא נשלחת פקודה לתחנה'
      : 'לצפייה בלבד · שינוי המיפוי שמור למנהל המערכת';
    return html`<sw-card heading="מיפוי ממסרים" subheading=${sub} data-relay-map-card>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      ${m.stations.length
        ? m.stations.map((s) => this.stationBlock(m, s))
        : html`<sw-state-panel icon="door" state="empty" heading="אין תחנות" hint=${m.has_copy ? 'WisKey לא מסר תחנות.' : 'נתוני WisKey אינם זמינים כרגע.'}></sw-state-panel>`}
      ${this.pending ? this.dialog(m, this.pending) : nothing}
    </sw-card>`;
  }
}
