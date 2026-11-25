import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '../components/sw-dropdown';
import type { DropdownChange } from '../components/sw-dropdown';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-badge';
import '../components/sw-dialog';
import '../components/sw-state-panel';
import { ApiError, describeError } from '../api/client';
import { fmtWhen } from '../api/access';
import { approveRelayMap, getRelayInventory, getRelayMap, type RelayInventory, type RelayMap, type RelayMapStation } from '../api/wiskey-relay-map';
import {
  OFF, approveQuestion, approvedLine, canApprove, draftOf, inventoryView, mapDiff, parseChoice, relayChoices, relayName, rowsBody, stationStatus, typedWordNeeded, type RelayDraft,
} from './wiskey-relay-map-logic';
import { tr } from '../i18n/msg/wiskey';
import { serverWordMatches, shownConfirmWord } from '../i18n/confirm-words';

/**
 * Settings › הגדרת מערכת › WisKey: "מיפוי ממסרים" (WISKEY-RELAYMAP-2310). Per WisKey station, which api relay drives which
 * physical relay (door), approved explicitly and saved against the station revision. The map is what the WisKey emergency and
 * door-automation grants are built from; nothing is sent to a station or a door from here. System administrator edits;
 * `access.admin.read` sees it read-only. The station's id is never shown.
 *
 * WISKEY-RELAY-INV-2520: per station, on request, what WisKey itself knows about the relays (`stations/relay_inventory_v1`, READ only):
 * the API outputs, WisKey's saved mapping, the physical count and roles as unknown, and that no harmless relay test exists. It is shown
 * next to the mapping and never changes it; nothing is sent to a relay.
 */
@customElement('sw-wiskey-relay-map')
export class SwWiskeyRelayMap extends LitElement {
  @state() private map: RelayMap | null = null;
  @state() private error = '';
  @state() private busy = false;
  @state() private drafts: Record<string, RelayDraft> = {};
  @state() private pending: RelayMapStation | null = null;
  @state() private word = '';
  /** WisKey's relay inventory per station id: the answer, `loading`, or an error text (shown only when asked for) */
  @state() private inventory: Record<string, RelayInventory | 'loading' | { error: string }> = {};

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
    .inv {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 2px var(--sw-s-3);
      margin-block-start: var(--sw-s-2);
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
    }
    .inv dt {
      color: var(--sw-text-3);
    }
    .inv dd {
      margin: 0;
      min-inline-size: 0;
    }
    .inv .note {
      grid-column: 1 / -1;
      color: var(--sw-text-3);
    }
    @media (max-width: 599px) {
      .inv {
        grid-template-columns: 1fr;
      }
      .inv dd {
        margin-block-end: var(--sw-s-1);
      }
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

  private async toggleInventory(s: RelayMapStation) {
    if (this.inventory[s.id] && this.inventory[s.id] !== 'loading') {
      const { [s.id]: _drop, ...rest } = this.inventory;
      this.inventory = rest;
      return;
    }
    if (this.inventory[s.id] === 'loading') return;
    this.inventory = { ...this.inventory, [s.id]: 'loading' };
    try {
      const answer = await getRelayInventory(s.id);
      this.inventory = { ...this.inventory, [s.id]: answer };
    } catch (err) {
      this.inventory = { ...this.inventory, [s.id]: { error: describeError(err) } };
    }
  }

  private inventoryBlock(s: RelayMapStation) {
    const inv = this.inventory[s.id];
    if (!inv) return nothing;
    if (inv === 'loading') return html`<div class="sub" data-relay-inventory="loading">${tr('קורא מ-WisKey…')}</div>`;
    if ('error' in inv) return html`<div class="err" role="alert" data-relay-inventory="error">${inv.error}</div>`;
    const view = inventoryView(inv);
    if (view.message) return html`<div class="sub" data-relay-inventory=${inv.state}>${view.message}</div>`;
    return html`<dl class="inv" data-relay-inventory="ready">
      ${view.lines.map((l) => html`<dt>${l.label}</dt><dd data-relay-inventory-line=${l.key} data-unknown=${l.unknown ? 'true' : nothing}>${l.value}</dd>`)}
      <dd class="note">${tr('יציאות API אינן ממסרים פיזיים. המיפוי שאושר כאן הוא אישור, לא מדידה, ואינו משתנה מהקריאה.')}</dd>
    </dl>`;
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
        <div class="who"><span class="name">${s.name || tr('תחנה ללא שם')}</span><span class="sub">${approvedLine(s, fmtWhen)}</span></div>
        <sw-badge kind=${status.tone} label=${status.text}></sw-badge>
      </div>
      <div class="rows">
        ${s.rows.map((r) => {
          const current = d[r.api_relay] ?? null;
          return html`<label data-relay-map-row=${r.api_relay}>
            <span>${tr('ממסר API {n}', { n: r.api_relay })}</span>
            <sw-dropdown label=${`${s.name}: ${tr('ממסר API {n}', { n: r.api_relay })}`} data-relay-map-pick=${r.api_relay} .value=${current === null ? OFF : String(current)}
              .items=${choices.map((o) => ({ id: o.value, label: o.label }))} ?inert=${!editable || this.busy} aria-disabled=${(!editable || this.busy) ? 'true' : nothing} style=${(!editable || this.busy) ? 'opacity: var(--sw-disabled-opacity)' : ''}
              @change=${(e: CustomEvent<DropdownChange>) => this.pick(s, r.api_relay, e.detail.id)}></sw-dropdown>
          </label>`;
        })}
      </div>
      ${s.in_copy
        ? html`<div class="actions">
            <sw-button size="sm" variant="ghost" data-relay-inventory-toggle aria-expanded=${this.inventory[s.id] ? 'true' : 'false'} ?disabled=${this.inventory[s.id] === 'loading'}
              @click=${() => this.toggleInventory(s)}>${this.inventory[s.id] ? tr('הסתרת מה ש-WisKey יודע') : tr('מה WisKey יודע על הממסרים')}</sw-button>
          </div>`
        : nothing}
      ${this.inventoryBlock(s)}
      ${s.automated_relays.length
        ? html`<div class="sub" data-relay-map-automated>${tr('יש אוטומציה על {relays}', { relays: s.automated_relays.map((p) => relayName(s, p)).join(', ') })}</div>`
        : nothing}
      ${diff.duplicate.length ? html`<div class="err" role="alert">${tr('כל ממסר פיזי יכול להיות משויך לממסר API אחד בלבד.')}</div>` : nothing}
      ${editable && diff.changed
        ? html`<div class="actions">
            <sw-button size="sm" variant="primary" data-relay-map-approve ?disabled=${this.busy || !canApprove(s, d, m.can_edit)} @click=${() => this.ask(s)}>${tr('אישור מיפוי')}</sw-button>
            <sw-button size="sm" variant="ghost" data-relay-map-reset ?disabled=${this.busy} @click=${() => { const { [s.id]: _drop, ...rest } = this.drafts; this.drafts = rest; }}>${tr('ביטול שינויים')}</sw-button>
          </div>`
        : nothing}
    </div>`;
  }

  private dialog(m: RelayMap, s: RelayMapStation) {
    const d = this.draft(s);
    const needWord = typedWordNeeded(s, d);
    const ok = !needWord || serverWordMatches(m.confirm_word, this.word);
    const word = shownConfirmWord(m.confirm_word); // the interface's own word (i18n/confirm-words.ts)
    return html`<sw-dialog open heading=${tr('מיפוי ממסרים')} data-relay-map-confirm @close=${() => { this.pending = null; }}>
      <p>${approveQuestion(s, d)}</p>
      ${needWord
        ? html`<div class="word">
            <span class="warn">${tr('כדי לאשר יש להקליד "{word}"', { word })}</span>
            <input data-relay-map-word aria-label=${tr('להקליד {word}', { word })} .value=${this.word} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} />
          </div>`
        : nothing}
      <sw-button slot="footer" variant="ghost" @click=${() => { this.pending = null; }}>${tr('ביטול')}</sw-button>
      <sw-button slot="footer" variant="primary" data-relay-map-ok ?disabled=${this.busy || !ok} @click=${() => this.approve()}>${tr('אישור')}</sw-button>
    </sw-dialog>`;
  }

  render() {
    if (this.error && !this.map) return html`<sw-state-panel state="error" hint=${this.error} actionLabel=${tr('נסה שוב')} @action=${() => this.load()}></sw-state-panel>`;
    if (!this.map) return html`<sw-state-panel state="loading"></sw-state-panel>`;
    const m = this.map;
    const sub = m.can_edit
      ? `${tr('לכל תחנה: איזה ממסר פיזי (דלת) כל ממסר API מפעיל')} · ${tr('חירום ואוטומציות דרך WisKey פועלים רק על מיפוי מאושר')} · ${tr('לא נשלחת פקודה לתחנה')}`
      : `${tr('לצפייה בלבד')} · ${tr('שינוי המיפוי שמור למנהל המערכת')}`;
    return html`<sw-card heading=${tr('מיפוי ממסרים')} subheading=${sub} data-relay-map-card>
      ${this.error ? html`<div class="err" role="alert">${this.error}</div>` : nothing}
      ${m.stations.length
        ? m.stations.map((s) => this.stationBlock(m, s))
        : html`<sw-state-panel icon="door" state="empty" heading=${tr('אין תחנות')} hint=${m.has_copy ? tr('WisKey לא מסר תחנות.') : tr('נתוני WisKey אינם זמינים כרגע.')}></sw-state-panel>`}
      ${this.pending ? this.dialog(m, this.pending) : nothing}
    </sw-card>`;
  }
}
