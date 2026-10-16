import { LitElement, css, html, nothing, type TemplateResult } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import './sw-card';
import './sw-button';
import './sw-badge';
import { LOCAL_ONLY_GENERIC, onRemote } from '../api/session';
import { describeError } from '../api/client';
import { SECRET_TEST_LABEL, clearSecret, listSecrets, saveSecret, testSecret, type SecretStatus, type SecretTest } from '../api/secrets';

const STATE_BADGE: Record<string, [string, string]> = {
  set: ['live', 'מוגדר'],
  not_set: ['neutral', 'לא מוגדר'],
  unreadable: ['error', 'לא ניתן לפענוח'],
  legacy: ['partial', 'מהגדרה ישנה'],
};

function when(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * TKSECRETS2 (docs/operations/ADDON_OPTION_REMOVAL_NOTE.md): הגדרות › חיבורים › סודות / Secrets - the go2rtc API password, the WisKey
 * stations' password, the WisKey background token, the OpenAI API key and the push relay key, which used to be add-on options of type
 * `password`. `system.configure` only (the host screen hides the card otherwise; the server enforces it). WRITE-ONLY: the server answers
 * whether a value is set, since when and by whom - "החלף" / "מחק" / "בדוק חיבור" (go2rtc, WisKey); the value is never shown again.
 */
@customElement('sw-secrets-card')
export class SwSecretsCard extends LitElement {
  @state() private items: SecretStatus[] | null = null;
  @state() private editing: string | null = null;
  @state() private draft = '';
  @state() private confirmClear: string | null = null;
  @state() private busy = false;
  @state() private error = '';
  @state() private tests: Record<string, SecretTest> = {};
  @state() private restartNote = false;

  static styles = css`
    :host {
      display: block;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px 14px;
      padding: 10px 0;
      border-block-end: 1px solid var(--sw-border);
      flex-wrap: wrap;
    }
    .row:last-of-type {
      border-block-end: 0;
    }
    .lbl {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-inline-size: 0;
      font-size: var(--sw-fs-md);
      font-weight: var(--sw-fw-medium);
    }
    .muted {
      font-size: var(--sw-fs-xs);
      color: var(--sw-text-3);
      font-weight: var(--sw-fw-regular);
    }
    .ltr {
      direction: ltr;
      unicode-bidi: isolate;
    }
    .acts {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    input {
      box-sizing: border-box;
      min-block-size: 36px;
      padding-inline: 10px;
      border: 1px solid var(--sw-border-strong);
      border-radius: var(--sw-r-sm);
      background: var(--sw-surface);
      color: var(--sw-text);
      font: inherit;
      font-size: var(--sw-fs-sm);
      direction: ltr;
      inline-size: min(280px, 100%);
    }
    .ok {
      color: var(--sw-success-text, var(--sw-text-2));
    }
    .bad {
      color: var(--sw-danger-text);
    }
    .err {
      color: var(--sw-danger-text);
      font-size: var(--sw-fs-sm);
      padding-block: 6px;
    }
    .hint {
      font-size: var(--sw-fs-sm);
      color: var(--sw-text-2);
      padding-block: 6px;
    }
  `;

  connectedCallback(): void {
    super.connectedCallback();
    if (!onRemote()) void this.load();
  }

  private async load() {
    try {
      this.items = (await listSecrets()).secrets;
    } catch (err) {
      this.error = describeError(err);
    }
  }

  private replaceItem(s: SecretStatus) {
    this.items = (this.items ?? []).map((x) => (x.name === s.name ? s : x));
  }

  private async run<T>(fn: () => Promise<T>): Promise<T | null> {
    this.busy = true;
    this.error = '';
    try {
      return await fn();
    } catch (err) {
      this.error = describeError(err);
      return null;
    } finally {
      this.busy = false;
    }
  }

  private async save(name: string) {
    const r = await this.run(() => saveSecret(name, this.draft));
    if (!r) return;
    this.replaceItem(r.secret);
    this.restartNote = this.restartNote || r.restart_required;
    this.editing = null;
    this.draft = '';
    const { [name]: _drop, ...rest } = this.tests;
    this.tests = rest;
  }

  private async clear(name: string) {
    const r = await this.run(() => clearSecret(name));
    this.confirmClear = null;
    if (!r) return;
    this.replaceItem(r.secret);
    this.restartNote = this.restartNote || r.restart_required;
  }

  private async test(name: string, candidate?: string) {
    const r = await this.run(() => testSecret(name, candidate));
    if (r) this.tests = { ...this.tests, [name]: r };
  }

  private status(s: SecretStatus): string {
    if (s.state === 'unreadable') return 'הערך השמור אינו ניתן לפענוח (מפתח ההתקנה השתנה) - יש להזין אותו מחדש';
    if (s.state === 'legacy') return s.source === 'environment' ? 'בשימוש ממשתנה סביבה של הרצת פיתוח' : 'בשימוש מהגדרת התוסף הישנה - יועבר בהפעלה הבאה';
    if (!s.configured) return s.updated_at ? `נמחק ${when(s.updated_at)}${s.updated_by_name ? ` · ${s.updated_by_name}` : ''}` : 'לא הוגדר';
    const by = s.source === 'addon_import' ? 'הועבר מהגדרות התוסף' : s.updated_by_name ?? '';
    return `הוגדר ${when(s.updated_at)}${by ? ` · ${by}` : ''}`;
  }

  private renderRow(s: SecretStatus): TemplateResult {
    const [kind, label] = STATE_BADGE[s.state] ?? ['neutral', s.state];
    const t = this.tests[s.name];
    const edit = this.editing === s.name || s.state === 'not_set' || s.state === 'unreadable';
    return html`<div class="row" data-secret-row=${s.name}>
      <span class="lbl">${s.label_he}<span class="muted"><span class="ltr">${s.name}</span> · <span data-secret-status>${this.status(s)}</span></span>
        ${t ? html`<span class=${`muted ${t.ok ? 'ok' : 'bad'}`} data-secret-test-result=${t.code}>${SECRET_TEST_LABEL[t.code] ?? t.code}</span>` : nothing}</span>
      <span class="acts"><sw-badge kind=${kind} label=${label} data-secret-state=${s.state}></sw-badge>
        ${edit
          ? html`<input type="password" autocomplete="new-password" spellcheck="false" .value=${this.editing === s.name ? this.draft : ''} aria-label=${s.label_he} data-secret-input
                @focus=${() => { if (this.editing !== s.name) { this.editing = s.name; this.draft = ''; } }}
                @input=${(e: Event) => { this.editing = s.name; this.draft = (e.target as HTMLInputElement).value; }} />
              <sw-button size="sm" variant="primary" ?disabled=${this.busy || this.editing !== s.name || !this.draft.trim()} data-secret-save @click=${() => void this.save(s.name)}>שמור</sw-button>
              ${s.testable ? html`<sw-button size="sm" ?disabled=${this.busy || this.editing !== s.name || !this.draft.trim()} data-secret-test @click=${() => void this.test(s.name, this.draft)}>בדוק</sw-button>` : nothing}
              ${s.configured || this.editing === s.name ? html`<sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => { this.editing = null; this.draft = ''; }}>ביטול</sw-button>` : nothing}`
          : this.confirmClear === s.name
            ? html`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear-confirm @click=${() => void this.clear(s.name)}>מחק סופית</sw-button>
                <sw-button size="sm" variant="ghost" ?disabled=${this.busy} @click=${() => (this.confirmClear = null)}>ביטול</sw-button>`
            : html`<sw-button size="sm" ?disabled=${this.busy} data-secret-replace @click=${() => { this.editing = s.name; this.draft = ''; }}>החלף</sw-button>
                ${s.testable ? html`<sw-button size="sm" ?disabled=${this.busy} data-secret-test-stored @click=${() => void this.test(s.name)}>בדוק חיבור</sw-button>` : nothing}
                ${s.state === 'set' ? html`<sw-button size="sm" variant="danger" ?disabled=${this.busy} data-secret-clear @click=${() => (this.confirmClear = s.name)}>מחק</sw-button>` : nothing}`}
      </span>
    </div>`;
  }

  protected render(): TemplateResult {
    const body = onRemote()
      ? html`<div class="hint" data-secrets-local-only>${LOCAL_ONLY_GENERIC}</div>`
      : !this.items
        ? this.error ? nothing : html`<div class="hint">טוען…</div>`
        : html`${this.items.map((s) => this.renderRow(s))}
            ${this.restartNote ? html`<div class="hint" data-secrets-restart>השינוי חל מיד על המסכים; שירותי הרקע (סנכרון זרמי go2rtc, ערוצי WisKey) יקבלו אותו בהפעלה הבאה של המערכת.</div>` : nothing}`;
    return html`<sw-card heading="סודות" subheading="Secrets · סיסמאות ומפתחות של שירותים חיצוניים, שמורים מוצפנים · הערכים עצמם אינם מוצגים שוב" data-secrets>
      ${body}
      ${this.error ? html`<div class="err" role="alert" data-secrets-error>${this.error}</div>` : nothing}
    </sw-card>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sw-secrets-card': SwSecretsCard;
  }
}
