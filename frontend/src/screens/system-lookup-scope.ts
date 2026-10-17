/**
 * "בירור מצב פעולה ישנה" (CR-WISKEY-LEASE-REVOCATION-EVENT section 5, owner decision option א + question 5): who may look up the
 * status of an OLD intercom action. Two values - the current holder of the action's permission (default), or also holders of
 * the audit-view permission. System administrator only (the card hides itself on 403); the wider value needs the typed
 * confirmation word; explicit deny still wins under both (server side). Settings › הרשאות, tab "אודיט הרשאות".
 */
import { LitElement, html, css, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import '../components/sw-card';
import '../components/sw-button';
import '../components/sw-field';
import { describeError } from '../api/client';
import { getCaptureLeaseSettings, LOOKUP_WIDE_WORD, setLookupScope, type LookupScope } from '../api/capture-lease';

const LABEL: Record<LookupScope, string> = {
  holder: 'מי שמחזיק כעת בהרשאה לפעולה המקורית (ברירת מחדל)',
  holder_or_audit_readers: 'גם מחזיקי הרשאת צפייה באודיט',
};

@customElement('sw-lookup-scope')
export class SwLookupScope extends LitElement {
  @state() private value: LookupScope | null = null;
  @state() private pending: LookupScope | null = null;
  @state() private word = '';
  @state() private notAllowed = false;
  @state() private busy = false;
  @state() private error = '';
  @state() private saved = false;

  static styles = css`
    :host { display: block; margin-block-end: var(--sw-space-4, 16px); }
    .row { display: flex; flex-wrap: wrap; gap: var(--sw-space-3, 12px); align-items: end; }
    select, input { min-width: 16rem; max-width: 100%; }
    .err { color: var(--sw-danger); }
    .ok { color: var(--sw-success); }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const s = await getCaptureLeaseSettings();
      this.value = s.lookup_scope;
      this.pending = s.lookup_scope;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 403 || status === 404) this.notAllowed = true;
      else this.error = describeError(err);
    }
  }

  private async save(): Promise<void> {
    if (!this.pending || this.pending === this.value) return;
    this.busy = true;
    this.error = '';
    this.saved = false;
    try {
      const s = await setLookupScope(this.pending, this.pending === 'holder_or_audit_readers' ? this.word.trim() : undefined);
      this.value = s.lookup_scope;
      this.pending = s.lookup_scope;
      this.word = '';
      this.saved = true;
    } catch (err) {
      this.error = describeError(err);
    } finally {
      this.busy = false;
    }
  }

  render() {
    if (this.notAllowed) return nothing;
    if (this.value === null) return this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing;
    const wider = this.pending === 'holder_or_audit_readers' && this.value !== 'holder_or_audit_readers';
    return html`<sw-card heading="בירור מצב פעולה ישנה" data-lookup-scope>
      <div class="row">
        <sw-field label="מי רשאי לברר מצב של פעולת אינטרקום ישנה">
          <select data-lookup-scope-select .value=${live(this.pending ?? 'holder')} ?disabled=${this.busy}
            @change=${(e: Event) => { this.pending = (e.target as HTMLSelectElement).value as LookupScope; this.saved = false; }}>
            ${(Object.keys(LABEL) as LookupScope[]).map((v) => html`<option value=${v} ?selected=${v === this.pending}>${LABEL[v]}</option>`)}
          </select>
        </sw-field>
        ${wider
          ? html`<sw-field label=${`לאישור ההרחבה הקלידו "${LOOKUP_WIDE_WORD}"`}>
              <input data-lookup-scope-word .value=${live(this.word)} ?disabled=${this.busy} @input=${(e: Event) => (this.word = (e.target as HTMLInputElement).value)} />
            </sw-field>`
          : nothing}
        <sw-button variant="primary" data-lookup-scope-save ?disabled=${this.busy || this.pending === this.value || (wider && this.word.trim() !== LOOKUP_WIDE_WORD)}
          @click=${() => void this.save()}>שמירה</sw-button>
      </div>
      ${this.error ? html`<p class="err" role="alert">${this.error}</p>` : nothing}
      ${this.saved ? html`<p class="ok" role="status">נשמר</p>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-lookup-scope': SwLookupScope;
  }
}
